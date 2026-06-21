import httpx
import logging
from config import settings

logger = logging.getLogger(__name__)
TIMEOUT = 5.0


async def notify_summit(guest_id: str, duration_seconds: float, skipped: int):
    payload = {
        "channel": "resort-wide",
        "event_type": "mountain.summit",
        "message": f"A guest has reached the mountain summit! ({round(duration_seconds, 1)}s, {skipped} skipped)",
        "sender": "mountain",
        "guest_id": guest_id,
        "data": {
            "guest_id": guest_id,
            "duration_seconds": duration_seconds,
            "skipped": skipped,
        },
    }
    headers = {"Content-Type": "application/json"}
    if settings.parrot_token:
        headers["Authorization"] = f"Bearer {settings.parrot_token}"
    try:
        async with httpx.AsyncClient(timeout=TIMEOUT) as client:
            r = await client.post(
                f"{settings.broadcast_service_url}/events",
                json=payload,
                headers=headers,
            )
            r.raise_for_status()
    except Exception as exc:
        logger.warning("summit broadcast failed: %s", exc)
