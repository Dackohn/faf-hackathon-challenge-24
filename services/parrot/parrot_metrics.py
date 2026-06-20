from prometheus_client import Counter, Histogram

llm_request_duration = Histogram(
    "parrot_llm_request_duration_seconds",
    "Time spent waiting for a single LLM completion call.",
    buckets=[0.1, 0.25, 0.5, 1, 2.5, 5, 10, 30],
)

tool_calls_total = Counter(
    "parrot_tool_calls_total",
    "Number of tool calls executed by the LLM, by tool name.",
    ["tool"],
)

chat_requests_total = Counter(
    "parrot_chat_requests_total",
    "Total chat requests handled, by path (/chat or /chat/stream).",
    ["path"],
)

cursed_notifications_total = Counter(
    "parrot_cursed_notifications_total",
    "Number of profanity-triggered broadcast notifications fired.",
)
