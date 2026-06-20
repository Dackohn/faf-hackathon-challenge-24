package main

import (
	"net/http"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promauto"
	"github.com/prometheus/client_golang/prometheus/promhttp"
)

var (
	requestsTotal = promauto.NewCounterVec(prometheus.CounterOpts{
		Name: "gateway_http_requests_total",
		Help: "Total HTTP requests proxied, labelled by backend service, method, and status class.",
	}, []string{"service", "method", "status_class"})

	requestDuration = promauto.NewHistogramVec(prometheus.HistogramOpts{
		Name:    "gateway_http_request_duration_seconds",
		Help:    "Latency of proxied HTTP requests in seconds.",
		Buckets: []float64{.005, .01, .025, .05, .1, .25, .5, 1, 2.5, 5},
	}, []string{"service", "method"})

	activeRequests = promauto.NewGaugeVec(prometheus.GaugeOpts{
		Name: "gateway_active_requests",
		Help: "Number of in-flight requests currently being proxied per service.",
	}, []string{"service"})
)

// serviceFromPath extracts the backend service name from the request path.
// /api/airport/... → "airport", /health → "gateway"
func serviceFromPath(path string) string {
	parts := strings.SplitN(strings.TrimPrefix(path, "/api/"), "/", 2)
	if len(parts) > 0 && parts[0] != "" {
		return parts[0]
	}
	return "gateway"
}

func statusClass(code int) string {
	switch {
	case code < 200:
		return "1xx"
	case code < 300:
		return "2xx"
	case code < 400:
		return "3xx"
	case code < 500:
		return "4xx"
	default:
		return "5xx"
	}
}

// MetricsMiddleware records per-request Prometheus metrics for all proxied routes.
func MetricsMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		service := serviceFromPath(r.URL.Path)
		method := r.Method

		activeRequests.WithLabelValues(service).Inc()
		defer activeRequests.WithLabelValues(service).Dec()

		rw := chi.NewResponseWriter(w, r)
		start := time.Now()
		next.ServeHTTP(rw, r)

		elapsed := time.Since(start).Seconds()
		code := rw.Status()
		if code == 0 {
			code = http.StatusOK
		}

		requestsTotal.WithLabelValues(service, method, statusClass(code)).Inc()
		requestDuration.WithLabelValues(service, method).Observe(elapsed)
	})
}

// MetricsHandler returns the Prometheus /metrics HTTP handler.
func MetricsHandler() http.Handler {
	return promhttp.Handler()
}

// RateLimiterGauge exposes the current rate-limiter window size as a gauge so
// Prometheus can track live config changes made via PUT /admin/rate-limit.
func NewRateLimitGauge() prometheus.Gauge {
	return promauto.NewGauge(prometheus.GaugeOpts{
		Name: "gateway_rate_limit_per_window",
		Help: "Configured maximum requests per rate-limit window.",
	})
}

