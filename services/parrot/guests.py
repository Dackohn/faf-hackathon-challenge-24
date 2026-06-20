import json
import logging
from pathlib import Path

logger = logging.getLogger(__name__)

# Guest profiles (name / surname / age / passport) keyed by guest_id. Bundled with the
# service so PII never has to be fetched from — or echoed back through — the LLM. This is
# the local source of truth used to pseudonymize outbound prompts and restore replies.
_DATA_FILE = Path(__file__).parent / "data" / "guests.json"

try:
    _GUESTS: dict[str, dict] = json.loads(_DATA_FILE.read_text(encoding="utf-8"))
    logger.info("Loaded %d guest profiles for PII pseudonymization", len(_GUESTS))
except (OSError, json.JSONDecodeError) as e:
    _GUESTS = {}
    logger.warning("Guest profile dataset unavailable (%s); PII pseudonymization disabled", e)


def get_guest_pii(guest_id: str | None) -> dict | None:
    """Return {name, surname, age, passport} for a guest, or None if unknown."""
    if not guest_id:
        return None
    return _GUESTS.get(guest_id)
