import asyncio
import json
import httpx
from config import settings
from tracing import request_id_ctx

TIMEOUT = 5.0

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
    """Per-request headers — propagates the correlation ID downstream for tracing."""
    rid = request_id_ctx.get()
    return {"X-Request-ID": rid} if rid and rid != "-" else {}


async def close_client():
    global _client
    if _client and not _client.is_closed:
        await _client.aclose()
        _client = None


async def get_airport_stats() -> str:
    r = await _get_client().get(f"{settings.airport_service_url}/stats", headers=_hdrs())
    r.raise_for_status()
    return json.dumps(r.json())


async def get_airport_queue_status() -> str:
    r = await _get_client().get(f"{settings.airport_service_url}/queue", headers=_hdrs())
    r.raise_for_status()
    return json.dumps(r.json())


async def get_hotel_rooms() -> str:
    r = await _get_client().get(f"{settings.hotel_service_url}/rooms", headers=_hdrs())
    r.raise_for_status()
    return json.dumps(r.json())


async def get_guest_arrival_status(guest_id: str) -> str:
    r = await _get_client().get(f"{settings.airport_service_url}/arrivals/{guest_id}", headers=_hdrs())
    r.raise_for_status()
    return json.dumps(r.json())


async def get_guest_clearance_eta(guest_id: str) -> str:
    """Estimated game-seconds until the guest clears passport control."""
    r = await _get_client().get(f"{settings.airport_service_url}/arrivals/{guest_id}/eta", headers=_hdrs())
    r.raise_for_status()
    return json.dumps(r.json())


async def get_room_availability() -> str:
    """Rooms free now and, when full, the soonest game-day a room frees."""
    r = await _get_client().get(f"{settings.hotel_service_url}/rooms/availability", headers=_hdrs())
    r.raise_for_status()
    return json.dumps(r.json())


async def get_beach_activities() -> str:
    """All beach activities with current remaining spots (capacity-based, no schedule)."""
    r = await _get_client().get(f"{settings.beach_service_url}/activities", headers=_hdrs())
    r.raise_for_status()
    return json.dumps(r.json())


async def get_guest_reservation(guest_id: str) -> str:
    r = await _get_client().get(f"{settings.hotel_service_url}/reservation/by-guest/{guest_id}", headers=_hdrs())
    r.raise_for_status()
    return json.dumps(r.json())


async def get_mountain_leaderboard() -> str:
    """Top summit times on the mountain trail."""
    r = await _get_client().get(f"{settings.mountain_service_url}/hike/leaderboard", headers=_hdrs())
    r.raise_for_status()
    return json.dumps(r.json())


async def start_mountain_hike(guest_id: str) -> str:
    """Start a mountain hike for the guest, returns the first riddle and 3 path choices."""
    r = await _get_client().post(
        f"{settings.mountain_service_url}/hike/start",
        json={"guest_id": guest_id},
        headers=_hdrs(),
    )
    r.raise_for_status()
    return json.dumps(r.json())


async def answer_mountain_riddle(guest_id: str, choice: int) -> str:
    """Submit the guest's path choice (0, 1 or 2) for the current mountain riddle."""
    r = await _get_client().post(
        f"{settings.mountain_service_url}/hike/answer",
        json={"guest_id": guest_id, "choice": choice},
        headers=_hdrs(),
    )
    r.raise_for_status()
    return json.dumps(r.json())


async def get_guest_journey_status(guest_id: str) -> str:
    """Combined arrival + reservation snapshot in one call (the two legs run concurrently).

    Each leg tolerates its own failure: a 404 / timeout becomes an {"error": ...} marker
    inside the result rather than failing the whole tool, so the assistant can still report
    whatever did resolve (e.g. arrival cleared but no booking yet).
    """
    client = _get_client()

    async def _leg(url: str) -> dict:
        try:
            r = await client.get(url, headers=_hdrs())
            r.raise_for_status()
            return r.json()
        except httpx.HTTPStatusError as e:
            return {"error": "not_found"} if e.response.status_code == 404 else {"error": f"status_{e.response.status_code}"}
        except (httpx.ConnectError, httpx.TimeoutException):
            return {"error": "unavailable"}

    arrival, reservation = await asyncio.gather(
        _leg(f"{settings.airport_service_url}/arrivals/{guest_id}"),
        _leg(f"{settings.hotel_service_url}/reservation/by-guest/{guest_id}"),
    )
    return json.dumps({"guest_id": guest_id, "arrival": arrival, "reservation": reservation})
