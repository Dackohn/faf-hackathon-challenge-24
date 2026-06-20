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

// inflightCall is a backend fetch in progress for one cache key. The leader fills in the
// result and closes done; waiters for the same key block on done and share the result.
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

	// callsMu guards calls only; it is held just for map lookups/inserts, never across a
	// backend fetch, so coalescing one URL never blocks requests for a different URL.
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

// beginCall registers an in-flight fetch for key. The first caller becomes the leader
// (leader=true); concurrent callers for the same key get the existing call to wait on.
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

// endCall removes the in-flight entry and wakes every waiter. The leader fills call's
// result fields before calling this, so the close happens-after those writes are visible.
func (c *responseCache) endCall(key string, call *inflightCall) {
	c.callsMu.Lock()
	delete(c.calls, key)
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
}

func (c *cacheCapture) WriteHeader(code int) {
	if !c.decided {
		c.status = code
		ct := c.Header().Get("Content-Type")
		c.cacheable = code == http.StatusOK && !strings.HasPrefix(ct, "text/event-stream")
		c.decided = true
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

// CacheMiddleware caches safe responses (GET/HEAD, status 200, non-streaming)
// for ttl. No-op when ttl <= 0.
//
// On a miss, requests for the same URL are coalesced: one request (the leader) performs the
// backend fetch while the rest wait and share its result, so the backend is hit once rather
// than once per request. Requests for different URLs run fully in parallel.
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

			// Coalesce concurrent misses for the same key onto a single backend fetch.
			leader, call := cache.beginCall(key)
			if !leader {
				<-call.done
				if call.cacheable {
					// Share the leader's result without touching the backend.
					writeEntry(w, call.status, call.header, call.body)
					return
				}
				// The leader's response can't be shared (streaming/non-200), so this
				// request makes its own fetch. (Different keys are never affected.)
				cc := &cacheCapture{ResponseWriter: w}
				next.ServeHTTP(cc, r)
				return
			}

			// Leader: always release waiters, even on a panic in the backend handler.
			defer cache.endCall(key, call)

			// Another leader may have populated the cache between our get() and beginCall.
			if e, ok := cache.get(key); ok {
				call.status, call.header, call.body, call.cacheable = e.status, e.header, e.body, true
				writeEntry(w, e.status, e.header, e.body)
				return
			}

			cc := &cacheCapture{ResponseWriter: w}
			next.ServeHTTP(cc, r)

			// Publish the result for any waiters (fields set before endCall closes done).
			call.status = cc.status
			call.header = w.Header().Clone()
			call.body = cc.buf.Bytes()
			call.cacheable = cc.cacheable

			if cc.cacheable {
				cache.set(key, cacheEntry{
					status: cc.status,
					header: w.Header().Clone(),
					body:   cc.buf.Bytes(),
				})
			}
		})
	}
}
