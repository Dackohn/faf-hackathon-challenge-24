package main

import (
	"bytes"
	"net/http"
	"strings"
	"sync"
	"time"
)

type cacheEntry struct {
	status  int
	header  http.Header
	body    []byte
	expires time.Time
}

// inflightCall is a single backend fetch in progress for one cache key. The leader fills in
// the result and closes done; waiters for the same key block on done and share the result.
type inflightCall struct {
	done      chan struct{}
	status    int
	header    http.Header
	body      []byte
	cacheable bool
}

type responseCache struct {
	mu      sync.Mutex
	entries map[string]cacheEntry
	ttl     time.Duration

	// callsMu guards calls only, held just for map lookup/insert — never across a backend
	// fetch — so coalescing one URL never blocks requests for any other URL.
	callsMu sync.Mutex
	calls   map[string]*inflightCall
}

func newResponseCache(ttl time.Duration) *responseCache {
	c := &responseCache{
		entries: make(map[string]cacheEntry),
		ttl:     ttl,
		calls:   make(map[string]*inflightCall),
	}
	go c.janitor()
	return c
}

// beginCall registers an in-flight fetch for key. The first caller is the leader
// (leader=true); concurrent callers for the same key receive the existing call to wait on.
func (c *responseCache) beginCall(key string) (leader bool, call *inflightCall) {
	c.callsMu.Lock()
	defer c.callsMu.Unlock()
	if existing, ok := c.calls[key]; ok {
		return false, existing
	}
	call = &inflightCall{done: make(chan struct{})}
	c.calls[key] = call
	return true, call
}

// endCall removes the in-flight entry (if still this call) and wakes its waiters. The leader
// fills call's result fields before calling this, so the close happens-after those writes.
func (c *responseCache) endCall(key string, call *inflightCall) {
	c.callsMu.Lock()
	if c.calls[key] == call {
		delete(c.calls, key)
	}
	c.callsMu.Unlock()
	close(call.done)
}

// janitor periodically evicts expired entries so keys that are cached once and
// never requested again don't pin memory forever (get() only evicts on access).
func (c *responseCache) janitor() {
	interval := c.ttl
	if interval < time.Minute {
		interval = time.Minute
	}
	for {
		time.Sleep(interval)

		now := time.Now()
		c.mu.Lock()
		for key, e := range c.entries {
			if now.After(e.expires) {
				delete(c.entries, key)
			}
		}
		c.mu.Unlock()
	}
}

func (c *responseCache) get(key string) (cacheEntry, bool) {
	c.mu.Lock()
	defer c.mu.Unlock()
	e, ok := c.entries[key]
	if !ok {
		return cacheEntry{}, false
	}
	if time.Now().After(e.expires) {
		delete(c.entries, key)
		return cacheEntry{}, false
	}
	return e, true
}

func (c *responseCache) set(key string, e cacheEntry) {
	e.expires = time.Now().Add(c.ttl)
	c.mu.Lock()
	c.entries[key] = e
	c.mu.Unlock()
}

// cacheCapture tees a cacheable response into a buffer while passing it through
// to the client. Cacheability is decided on the first WriteHeader (200 +
// non-streaming Content-Type), so SSE responses are never buffered and flushes
// pass straight through — keeping the proxy's FlushInterval = -1 behaviour.
type cacheCapture struct {
	http.ResponseWriter
	buf       bytes.Buffer
	status    int
	cacheable bool
	decided   bool
	// onDecided fires once, the moment cacheability is known (first WriteHeader). The
	// coalescer uses it to release waiters early when a response is streaming/non-200,
	// so concurrent SSE subscribers never block on a leader's stream that won't end.
	onDecided func(cacheable bool)
}

func (c *cacheCapture) WriteHeader(code int) {
	if !c.decided {
		c.status = code
		ct := c.Header().Get("Content-Type")
		c.cacheable = code == http.StatusOK && !strings.HasPrefix(ct, "text/event-stream")
		c.decided = true
		if c.onDecided != nil {
			c.onDecided(c.cacheable)
		}
	}
	c.ResponseWriter.WriteHeader(code)
}

func (c *cacheCapture) Write(b []byte) (int, error) {
	if !c.decided {
		c.WriteHeader(http.StatusOK)
	}
	if c.cacheable {
		c.buf.Write(b)
	}
	return c.ResponseWriter.Write(b)
}

func (c *cacheCapture) Flush() {
	if f, ok := c.ResponseWriter.(http.Flusher); ok {
		f.Flush()
	}
}

// writeEntry replays a stored/shared response to the client as a cache hit.
func writeEntry(w http.ResponseWriter, status int, header http.Header, body []byte) {
	for k, vals := range header {
		for _, v := range vals {
			w.Header().Add(k, v)
		}
	}
	w.Header().Set("X-Cache", "HIT")
	w.WriteHeader(status)
	w.Write(body)
}

// CacheMiddleware caches safe responses (GET/HEAD, status 200, non-streaming) for ttl.
// No-op when ttl <= 0.
//
// On a miss it also coalesces concurrent requests for the same URL: one request (the leader)
// performs the backend fetch while the rest wait and share its result, so the backend is hit
// once rather than once per request. Requests for different URLs run fully in parallel (the
// per-key lock is held only for map bookkeeping, never across a fetch). A response that turns
// out to be streaming (SSE) or non-200 is NOT coalesced: waiters are released the instant the
// leader learns it is non-cacheable, so concurrent SSE subscribers each get their own stream
// instead of blocking on a leader stream that never ends.
func CacheMiddleware(ttl time.Duration) func(http.Handler) http.Handler {
	if ttl <= 0 {
		return func(next http.Handler) http.Handler { return next }
	}
	cache := newResponseCache(ttl)

	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			if r.Method != http.MethodGet && r.Method != http.MethodHead {
				next.ServeHTTP(w, r)
				return
			}

			// Key on method + path + canonicalized query so requests that
			// differ only by query string don't collide.
			key := r.Method + " " + r.URL.Path + "?" + r.URL.Query().Encode()

			if e, ok := cache.get(key); ok {
				writeEntry(w, e.status, e.header, e.body)
				return
			}

			// Coalesce concurrent misses for the same key onto one backend fetch.
			leader, call := cache.beginCall(key)
			if !leader {
				<-call.done
				if call.cacheable {
					// Share the leader's result without touching the backend.
					writeEntry(w, call.status, call.header, call.body)
					return
				}
				// Leader's response can't be shared (streaming/non-200); fetch our own.
				// Different keys are never affected by this.
				cc := &cacheCapture{ResponseWriter: w}
				next.ServeHTTP(cc, r)
				return
			}

			// Leader. release() wakes waiters exactly once: early if the response is
			// non-cacheable (so SSE waiters don't block), otherwise after the result is
			// recorded. defer is the safety net for the cacheable path and panics.
			var once sync.Once
			release := func() { once.Do(func() { cache.endCall(key, call) }) }
			defer release()

			// Another leader may have populated the cache between our get() and beginCall.
			if e, ok := cache.get(key); ok {
				call.status, call.header, call.body, call.cacheable = e.status, e.header, e.body, true
				writeEntry(w, e.status, e.header, e.body)
				return
			}

			cc := &cacheCapture{ResponseWriter: w}
			
			cc.onDecided = func(cacheable bool) {
				if !cacheable {
					call.cacheable = false
					release()
				}
			}
			next.ServeHTTP(cc, r)

			if cc.cacheable {
				// Publish the result for waiters (fields set before release closes done).
				call.status = cc.status
				call.header = w.Header().Clone()
				call.body = cc.buf.Bytes()
				call.cacheable = true
				cache.set(key, cacheEntry{
					status: cc.status,
					header: w.Header().Clone(),
					body:   cc.buf.Bytes(),
				})
			}
		})
	}
}
