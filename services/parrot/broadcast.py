import asyncio
import json
import logging
import urllib.request

from config import settings

logger = logging.getLogger(__name__)


def _post(url: str, payload: dict) -> None:
    data = json.dumps(payload).encode()
    req = urllib.request.Request(
        url,
        data=data,
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=2):
            pass
    except Exception as exc:
        logger.debug("broadcast notify failed: %s", exc)


async def notify_cursed(guest_id: str, message: str, triggered_word: list[str]) -> None:
    """Fire-and-forget POST to /parrot/cursed on the broadcast service."""
    url = settings.broadcast_service_url
    if not url:
        return
    payload = {
        "guest_id": guest_id,
        "message": message,
        "triggered_word": triggered_word,
    }
    await asyncio.to_thread(_post, f"{url}/parrot/cursed", payload)
