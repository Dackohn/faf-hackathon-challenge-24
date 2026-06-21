import asyncio

import httpx

from config import settings
from tracing import request_id_ctx

TIMEOUT = 2.0

_client: httpx.AsyncClient | None = None


def _get_client() -> httpx.AsyncClient:
    global _client
    if _client is None or _client.is_closed:
        headers = {"Content-Type": "application/json"}
        if settings.internal_secret:
            headers["X-Internal-Key"] = settings.internal_secret
        _client = httpx.AsyncClient(timeout=TIMEOUT, headers=headers)
    return _client


def _hdrs() -> dict:
    rid = request_id_ctx.get()
    return {"X-Request-ID": rid} if rid and rid != "-" else {}


async def close_client():
    global _client
    if _client and not _client.is_closed:
        await _client.aclose()
        _client = None


async def _post(path: str, body: dict):
    """Fire-and-forget POST to Broadcast. Never raises — a down/slow Broadcast must never
    add latency or errors to the booking response."""
    try:
        await _get_client().post(f"{settings.broadcast_service_url}{path}", json=body, headers=_hdrs())
    except Exception:
        pass


# We publish to Broadcast's public-announcement route (`/public`) on purpose: that path
# emits a `public.*` event, which is the only prefix the frontend SSE policy forwards to
# browser clients — so a dive booking is actually visible in the live resort feed.

def publish_dive_booked(dive: dict, submarine_name: str, zone: str):
    body = {
        "message": (
            f"🐾🌊 {dive['guest_id']} just dived aboard {submarine_name} into the {zone}!"
        ),
        "guestName": dive["guest_id"],
    }
    asyncio.create_task(_post("/public", body))


def publish_dive_cancelled(dive: dict, submarine_name: str):
    body = {
        "message": f"{dive['guest_id']} surfaced early and cancelled their dive on {submarine_name}.",
        "guestName": dive["guest_id"],
    }
    asyncio.create_task(_post("/public", body))


def publish_dive_full(submarine_name: str, dive_slot: int):
    body = {
        "message": f"A porthole on {submarine_name} is fully booked for dive slot {dive_slot}.",
        "guestName": "Purrlington Deep",
    }
    asyncio.create_task(_post("/public", body))
