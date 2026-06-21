package main

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"errors"
	"strings"
	"time"
)

// Claims is the JWT payload used for both guest and admin sessions.
// GuestID is omitted for admin tokens.
type Claims struct {
	Role    string `json:"role"`
	GuestID string `json:"guest_id,omitempty"`
	Iat     int64  `json:"iat"`
	Exp     int64  `json:"exp"`
}

var jwtHeaderEnc = base64.RawURLEncoding.EncodeToString([]byte(`{"alg":"HS256","typ":"JWT"}`))

// SignJWT issues an HS256-signed JWT for the given claims.
func SignJWT(claims Claims, secret []byte) (string, error) {
	payloadJSON, err := json.Marshal(claims)
	if err != nil {
		return "", err
	}
	payloadEnc := base64.RawURLEncoding.EncodeToString(payloadJSON)
	signingInput := jwtHeaderEnc + "." + payloadEnc

	mac := hmac.New(sha256.New, secret)
	mac.Write([]byte(signingInput))
	sigEnc := base64.RawURLEncoding.EncodeToString(mac.Sum(nil))

	return signingInput + "." + sigEnc, nil
}

// VerifyJWT validates the signature and expiry of a token and returns its claims.
func VerifyJWT(token string, secret []byte) (*Claims, error) {
	parts := strings.Split(token, ".")
	if len(parts) != 3 {
		return nil, errors.New("malformed token")
	}

	signingInput := parts[0] + "." + parts[1]
	mac := hmac.New(sha256.New, secret)
	mac.Write([]byte(signingInput))
	expected := mac.Sum(nil)

	actual, err := base64.RawURLEncoding.DecodeString(parts[2])
	if err != nil || !hmac.Equal(expected, actual) {
		return nil, errors.New("invalid signature")
	}

	payloadJSON, err := base64.RawURLEncoding.DecodeString(parts[1])
	if err != nil {
		return nil, errors.New("invalid payload")
	}

	var claims Claims
	if err := json.Unmarshal(payloadJSON, &claims); err != nil {
		return nil, errors.New("invalid claims")
	}

	if time.Now().Unix() > claims.Exp {
		return nil, errors.New("token expired")
	}

	return &claims, nil
}
