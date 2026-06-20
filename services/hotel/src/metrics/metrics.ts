import { Registry, Counter, Histogram, collectDefaultMetrics } from 'prom-client';

export const registry = new Registry();

collectDefaultMetrics({ register: registry });

export const httpRequestsTotal = new Counter({
  name: 'hotel_http_requests_total',
  help: 'Total HTTP requests handled by the hotel service.',
  labelNames: ['method', 'status_class'] as const,
  registers: [registry],
});

export const httpRequestDuration = new Histogram({
  name: 'hotel_http_request_duration_seconds',
  help: 'HTTP request duration in seconds.',
  labelNames: ['method', 'route'] as const,
  buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5],
  registers: [registry],
});

export const reservationsTotal = new Counter({
  name: 'hotel_reservations_total',
  help: 'Total reservations by outcome.',
  labelNames: ['status'] as const,
  registers: [registry],
});
