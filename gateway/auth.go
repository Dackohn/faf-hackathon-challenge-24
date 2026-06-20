package main

import (
	"crypto/subtle"
	"net/http"
	"os"
)

// AuthMiddleware guards privileged routes: a request must present an
// X-Internal-Key matching INTERNAL_SECRET, otherwise it is rejected with 401.
// It fails closed — if INTERNAL_SECRET is unset, every request is denied.
func AuthMiddleware(next http.Handler) http.Handler {
	internalSecret := os.Getenv("INTERNAL_SECRET")

	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		key := r.Header.Get("X-Internal-Key")
		// Constant-time comparison avoids leaking the secret via timing.
		authorized := internalSecret != "" &&
			subtle.ConstantTimeCompare([]byte(key), []byte(internalSecret)) == 1
		if !authorized {
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusUnauthorized)
			w.Write([]byte(`{"error": "unauthorized"}`))
			return
		}

		next.ServeHTTP(w, r)
	})
}
