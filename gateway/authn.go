package main

import (
	"bytes"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"strings"
)

// Identity is the authenticated caller resolved from a JWT.
type Identity struct {
	Role    string // "guest" or "admin"
	GuestID string // set for guest identities
}

// AuthenticateRequest extracts and verifies the bearer token on the request.
func AuthenticateRequest(r *http.Request, secret string) (*Identity, error) {
	authz := r.Header.Get("Authorization")
	const prefix = "Bearer "
	if authz == "" || !strings.HasPrefix(authz, prefix) {
		return nil, errors.New("missing or malformed authorization header")
	}

	token := strings.TrimSpace(strings.TrimPrefix(authz, prefix))
	claims, err := VerifyJWT(token, []byte(secret))
	if err != nil {
		return nil, err
	}

	return &Identity{Role: claims.Role, GuestID: claims.GuestID}, nil
}

func writeJSONError(w http.ResponseWriter, status int, msg string) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(map[string]string{"error": msg})
}

// RequireAdmin guards a handler so only a valid admin token may proceed.
// Missing/invalid/expired tokens are rejected with 401; a valid non-admin
// token is rejected with 403.
func RequireAdmin(cfg Config, next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		identity, err := AuthenticateRequest(r, cfg.JWTSecret)
		if err != nil {
			writeJSONError(w, http.StatusUnauthorized, "unauthorized")
			return
		}
		if identity.Role != "admin" {
			writeJSONError(w, http.StatusForbidden, "forbidden")
			return
		}
		next(w, r)
	}
}

// peekGuestIDFromBody reads the request body looking for a top-level
// "guest_id" JSON field, then restores the body so downstream handlers
// (the reverse proxy) can still read it in full.
func peekGuestIDFromBody(r *http.Request) (string, error) {
	if r.Body == nil {
		return "", nil
	}

	data, err := io.ReadAll(r.Body)
	r.Body = io.NopCloser(bytes.NewReader(data))
	if err != nil {
		return "", err
	}

	var body struct {
		GuestID string `json:"guest_id"`
	}
	if err := json.Unmarshal(data, &body); err != nil {
		return "", nil // not JSON / no guest_id — not an error, just unknown
	}
	return body.GuestID, nil
}
