from contextvars import ContextVar

# Correlation ID for the in-flight request. Set by the request middleware and read by the
# outbound HTTP helper so the same id flows through logs and downstream X-Request-ID headers.
request_id_ctx: ContextVar[str] = ContextVar("request_id", default="-")
