package main

import (
	"context"
	"fmt"
	"log"
	"net/http"
	"os/signal"
	"syscall"
	"time"

	"github.com/go-chi/chi/v5"
	chimw "github.com/go-chi/chi/v5/middleware"
)

func main() {
	cfg := LoadConfig()

	r := chi.NewRouter()

	// Global middleware (applied to ALL routes)
	r.Use(chimw.RequestID)
	r.Use(chimw.RealIP)
	r.Use(RequestLogger)
	r.Use(chimw.Recoverer)
	r.Use(CORSMiddleware(cfg.CORSOrigins))
	r.Use(MetricsMiddleware)
	rl := NewRateLimiter(cfg.RateLimitPerWindow, cfg.RateLimitWindow)
	r.Use(RateLimitMiddleware(rl))

	// Prometheus metrics — no auth, scrape-only endpoint.
	r.Get("/metrics", MetricsHandler().ServeHTTP)

	// Health check (aggregates all backend health endpoints)
	r.Get("/health", HealthHandler(cfg))

	// Auth: mint and inspect JWTs. Public — these are how a caller gets a token.
	r.Post("/auth/guest", GuestLoginHandler(cfg))
	r.Post("/auth/admin", AdminLoginHandler(cfg))
	r.Get("/auth/me", MeHandler(cfg))

	// Admin: adjust the rate limiter at runtime. Guarded by an admin JWT so
	// the rate-limit control plane is not exposed to public callers.
	r.Put("/admin/rate-limit", RequireAdmin(cfg, AdminRateLimitHandler(rl)))

	// Route to backend services. Each *_SERVICE_URL may list several instances
	// (comma-separated); a pool with more than one URL is round-robined.
	// Each service has explicit per-route access rules (public/guest/admin);
	// anything not explicitly listed falls back to defaultAccess.
	mountServiceRoutes(r, "/api/airport", cfg.AirportServicePool, cfg, []RouteRule{
		{Method: "GET", Pattern: "/stats", Access: AccessPublic},
		{Method: "POST", Pattern: "/arrivals", Access: AccessGuest, GuestInBody: true},
		{Method: "GET", Pattern: "/arrivals/{guest_id}", Access: AccessGuest, GuestParam: "guest_id"},
		{Method: "GET", Pattern: "/arrivals/{guest_id}/eta", Access: AccessGuest, GuestParam: "guest_id"},
		{Method: "POST", Pattern: "/admin/gates", Access: AccessAdmin},
		{Method: "DELETE", Pattern: "/admin/gates/{gate_id}", Access: AccessAdmin},
	}, AccessGuest)

	mountServiceRoutes(r, "/api/hotel", cfg.HotelServicePool, cfg, []RouteRule{
		{Method: "POST", Pattern: "/reservation", Access: AccessGuest, GuestInBody: true},
		{Method: "GET", Pattern: "/reservation/by-guest/{guest_id}", Access: AccessGuest, GuestParam: "guest_id"},
	}, AccessGuest)

	mountServiceRoutes(r, "/api/dining", cfg.DiningServicePool, cfg, []RouteRule{
		{Method: "GET", Pattern: "/restaurants", Access: AccessPublic},
		{Method: "GET", Pattern: "/restaurants/{restaurant_id}", Access: AccessPublic},
		{Method: "GET", Pattern: "/restaurants/{restaurant_id}/availability", Access: AccessPublic},
		{Method: "POST", Pattern: "/reservations", Access: AccessGuest, GuestInBody: true},
		{Method: "GET", Pattern: "/reservations/by-guest/{guest_id}", Access: AccessGuest, GuestParam: "guest_id"},
	}, AccessGuest)

	mountServiceRoutes(r, "/api/parrot", cfg.ParrotServicePool, cfg, []RouteRule{
		{Method: "POST", Pattern: "/chat", Access: AccessGuest, GuestInBody: true},
		{Method: "POST", Pattern: "/chat/stream", Access: AccessGuest, GuestInBody: true},
		{Method: "GET", Pattern: "/history/{guest_id}", Access: AccessGuest, GuestParam: "guest_id"},
		{Method: "GET", Pattern: "/admin/metrics", Access: AccessAdmin},
		{Method: "GET", Pattern: "/admin/conversations", Access: AccessAdmin},
		{Method: "GET", Pattern: "/admin/conversations/{guest_id}", Access: AccessAdmin},
	}, AccessGuest)

	mountServiceRoutes(r, "/api/beach", cfg.BeachServicePool, cfg, []RouteRule{
		{Method: "GET", Pattern: "/activities", Access: AccessPublic},
		{Method: "GET", Pattern: "/activity/{activity_id}", Access: AccessPublic},
		{Method: "POST", Pattern: "/activity", Access: AccessAdmin},
		{Method: "DELETE", Pattern: "/activity/{activity_id}", Access: AccessAdmin},
		{Method: "GET", Pattern: "/admin/activities", Access: AccessAdmin},
	}, AccessGuest)

	mountServiceRoutes(r, "/api/broadcast", cfg.BroadcastServicePool, cfg, nil, AccessPublic)

	mountServiceRoutes(r, "/api/mountain", cfg.MountainServicePool, cfg, []RouteRule{
		{Method: "GET", Pattern: "/hike/leaderboard", Access: AccessPublic},
		{Method: "POST", Pattern: "/hike/start", Access: AccessGuest, GuestInBody: true},
		{Method: "POST", Pattern: "/hike/answer", Access: AccessGuest, GuestInBody: true},
		{Method: "GET", Pattern: "/hike/status/{guest_id}", Access: AccessGuest, GuestParam: "guest_id"},
	}, AccessGuest)

	// Prometheus query API — proxied for the admin metrics UI.
	if cfg.PrometheusServiceURL != "" {
		r.Route("/api/prometheus", func(sr chi.Router) {
			sr.Use(func(next http.Handler) http.Handler {
				return http.HandlerFunc(RequireAdmin(cfg, next.ServeHTTP))
			})
			ProxyRoute(cfg.PrometheusServiceURL)(sr)
		})
	}

	addr := fmt.Sprintf(":%s", cfg.Port)
	srv := &http.Server{Addr: addr, Handler: r}

	ctx, stop := signal.NotifyContext(context.Background(), syscall.SIGINT, syscall.SIGTERM)
	defer stop()

	go func() {
		log.Printf("Gateway starting on %s", addr)
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("listen: %v", err)
		}
	}()

	<-ctx.Done()
	log.Println("Shutting down gracefully...")

	shutdownCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	if err := srv.Shutdown(shutdownCtx); err != nil {
		log.Fatalf("shutdown: %v", err)
	}
	log.Println("Gateway stopped")
}
