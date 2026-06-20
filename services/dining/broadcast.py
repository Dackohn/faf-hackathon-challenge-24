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


def publish_reservation_confirmed(reservation: dict, restaurant_name: str):
    body = {
        "channel": "resort-wide",
        "message": (
            f"{reservation['guest_id']} booked a table for {reservation['party_size']} "
            f"at {restaurant_name} (slot {reservation['seating_slot']})."
        ),
        "sender": "dining-service",
        "data": {
            "reservation_id": reservation["id"],
            "guest_id": reservation["guest_id"],
            "restaurant_id": reservation["restaurant_id"],
            "restaurant_name": restaurant_name,
            "table_id": reservation["table_id"],
            "party_size": reservation["party_size"],
            "seating_slot": reservation["seating_slot"],
        },
    }
    asyncio.create_task(_post("/dining/reservation_confirmed", body))


def publish_reservation_cancelled(reservation: dict, restaurant_name: str):
    body = {
        "channel": "resort-wide",
        "message": f"{reservation['guest_id']} cancelled their reservation at {restaurant_name}.",
        "sender": "dining-service",
        "data": {
            "reservation_id": reservation["id"],
            "guest_id": reservation["guest_id"],
            "restaurant_id": reservation["restaurant_id"],
            "restaurant_name": restaurant_name,
            "table_id": reservation["table_id"],
            "seating_slot": reservation["seating_slot"],
        },
    }
    asyncio.create_task(_post("/dining/reservation_cancelled", body))


def publish_table_full(restaurant_id: str, restaurant_name: str, table_id: str, seating_slot: int):
    body = {
        "channel": "resort-wide",
        "message": f"A table at {restaurant_name} is already booked for slot {seating_slot}.",
        "sender": "dining-service",
        "data": {"restaurant_id": restaurant_id, "table_id": table_id, "seating_slot": seating_slot},
    }
    asyncio.create_task(_post("/dining/table_full", body))
