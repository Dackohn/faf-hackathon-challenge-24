import { Registry, Counter, Gauge, collectDefaultMetrics } from "prom-client";

export const registry = new Registry();

collectDefaultMetrics({ register: registry });

export const sseClientsGauge = new Gauge({
  name: "broadcast_sse_clients",
  help: "Number of currently connected SSE clients.",
  registers: [registry],
});

export const eventsTotal = new Counter({
  name: "broadcast_events_total",
  help: "Total SSE events broadcast, by event type.",
  labelNames: ["event_type"] as const,
  registers: [registry],
});

export const publishErrorsTotal = new Counter({
  name: "broadcast_publish_errors_total",
  help: "Number of events that could not be delivered to any client.",
  registers: [registry],
});
