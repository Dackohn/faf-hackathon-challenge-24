from prometheus_client import Gauge, Histogram

gate_queue_depth = Gauge(
    "airport_gate_queue_depth",
    "Number of guests currently queued at each gate.",
    ["gate"],
)

arrivals_processed = Gauge(
    "airport_total_processed",
    "Cumulative number of guests fully processed through passport control.",
)

processing_duration = Histogram(
    "airport_processing_duration_seconds",
    "Real-time seconds a guest spent being processed at the booth.",
    ["gate"],
    buckets=[0.1, 0.5, 1, 2, 5, 10, 30],
)
