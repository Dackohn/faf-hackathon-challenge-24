package main

import (
	"crypto/subtle"
	"encoding/json"
	"net/http"
	"strings"
	"time"
)

// GuestLoginHandler issues a guest-scoped JWT for the given guest_id. The
// gateway does not validate the guest_id against any roster — identity
// selection remains the frontend's job; the token just fixes that identity
// for the session.
func GuestLoginHandler(cfg Config) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var body struct {
			GuestID string `json:"guest_id"`
		}
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil || strings.TrimSpace(body.GuestID) == "" {
			writeJSONError(w, http.StatusBadRequest, "guest_id is required")
			return
		}

		now := time.Now()
		claims := Claims{
			Role:    "guest",
			GuestID: body.GuestID,
			Iat:     now.Unix(),
			Exp:     now.Add(cfg.JWTTTL).Unix(),
		}
		token, err := SignJWT(claims, []byte(cfg.JWTSecret))
		if err != nil {
			writeJSONError(w, http.StatusInternalServerError, "failed to issue token")
			return
		}

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]string{"token": token})
	}
}

// AdminLoginHandler issues an admin-scoped JWT when the passcode matches
// ADMIN_PASSCODE. Fails closed if the passcode is unconfigured.
func AdminLoginHandler(cfg Config) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var body struct {
			Passcode string `json:"passcode"`
		}
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
			writeJSONError(w, http.StatusBadRequest, "passcode is required")
			return
		}

		valid := cfg.AdminPasscode != "" &&
			subtle.ConstantTimeCompare([]byte(body.Passcode), []byte(cfg.AdminPasscode)) == 1
		if !valid {
			writeJSONError(w, http.StatusUnauthorized, "invalid passcode")
			return
		}

		now := time.Now()
		claims := Claims{
			Role: "admin",
			Iat:  now.Unix(),
			Exp:  now.Add(cfg.JWTTTL).Unix(),
		}
		token, err := SignJWT(claims, []byte(cfg.JWTSecret))
		if err != nil {
			writeJSONError(w, http.StatusInternalServerError, "failed to issue token")
			return
		}

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]string{"token": token})
	}
}

// MeHandler returns the identity carried by the caller's token.
func MeHandler(cfg Config) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		identity, err := AuthenticateRequest(r, cfg.JWTSecret)
		if err != nil {
			writeJSONError(w, http.StatusUnauthorized, "unauthorized")
			return
		}

		w.Header().Set("Content-Type", "application/json")
		if identity.Role == "admin" {
			json.NewEncoder(w).Encode(map[string]string{"role": "admin"})
			return
		}
		json.NewEncoder(w).Encode(map[string]string{"role": "guest", "guest_id": identity.GuestID})
	}
}
