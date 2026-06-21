package main

import (
	"net/http"
	"strings"

	"github.com/go-chi/chi/v5"
)

// Access describes the auth level required for a route.
type Access int

const (
	AccessPublic Access = iota
	AccessGuest
	AccessAdmin
)

// RouteRule describes one explicit route within a proxied service: which
// method/pattern it matches, what access level it requires, and where to
// find the guest_id to check ownership against (path param name, and/or a
// top-level "guest_id" JSON body field).
type RouteRule struct {
	Method      string // "" matches any method
	Pattern     string // chi pattern relative to the service prefix, e.g. "/arrivals/{guest_id}"
	Access      Access
	GuestParam  string // chi URL param holding the guest_id, if any
	GuestInBody bool   // whether to also check a top-level guest_id JSON field
}

// forwarder builds the function that actually rewrites the request and
// forwards it to a backend, picking round-robin across a pool when needed.
func forwarder(prefix string, pool []string) http.HandlerFunc {
	rrPool := NewProxyPool(pool)

	return func(w http.ResponseWriter, r *http.Request) {
		i := 0
		if len(rrPool.proxies) > 1 {
			i = rrPool.pick()
		}
		target := rrPool.targets[i]

		path := strings.TrimPrefix(r.URL.Path, prefix)
		if path == "" {
			path = "/"
		} else if !strings.HasPrefix(path, "/") {
			path = "/" + path
		}

		r.URL.Scheme = target.Scheme
		r.URL.Host = target.Host
		r.URL.Path = path
		r.Host = target.Host

		rrPool.proxies[i].ServeHTTP(w, r)
	}
}

// guarded wraps a forwarding handler with the access check for a given rule.
func guarded(next http.HandlerFunc, access Access, guestParam string, guestInBody bool, cfg Config) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if access == AccessPublic {
			next(w, r)
			return
		}

		identity, err := AuthenticateRequest(r, cfg.JWTSecret)
		if err != nil {
			writeJSONError(w, http.StatusUnauthorized, "unauthorized")
			return
		}

		if access == AccessAdmin {
			if identity.Role != "admin" {
				writeJSONError(w, http.StatusForbidden, "forbidden")
				return
			}
			next(w, r)
			return
		}

		// AccessGuest: admin tokens may act on behalf of any guest.
		if identity.Role == "admin" {
			next(w, r)
			return
		}

		targetGuestID := ""
		if guestParam != "" {
			targetGuestID = chi.URLParam(r, guestParam)
		}
		if targetGuestID == "" && guestInBody {
			if id, _ := peekGuestIDFromBody(r); id != "" {
				targetGuestID = id
			}
		}

		if targetGuestID != "" && targetGuestID != identity.GuestID {
			writeJSONError(w, http.StatusForbidden, "forbidden")
			return
		}

		next(w, r)
	}
}

// mountServiceRoutes registers the explicit access-controlled routes for a
// proxied service, plus a guest-by-default fallback for anything else under
// the prefix.
func mountServiceRoutes(parent chi.Router, prefix string, pool []string, cfg Config, rules []RouteRule, defaultAccess Access) {
	if len(pool) == 0 {
		return
	}
	fwd := forwarder(prefix, pool)

	parent.Route(prefix, func(r chi.Router) {
		if cfg.CacheTTL > 0 {
			r.Use(CacheMiddleware(cfg.CacheTTL))
		}

		for _, rule := range rules {
			h := guarded(fwd, rule.Access, rule.GuestParam, rule.GuestInBody, cfg)
			if rule.Method == "" {
				r.HandleFunc(rule.Pattern, h)
			} else {
				r.MethodFunc(rule.Method, rule.Pattern, h)
			}
		}

		r.HandleFunc("/*", guarded(fwd, defaultAccess, "", false, cfg))
	})
}
