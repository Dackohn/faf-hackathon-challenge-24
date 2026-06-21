import json
import logging
from openai import AsyncOpenAI
from config import settings

logger = logging.getLogger(__name__)

PROMPT = """\
You are the Mountain Oracle at Purrlington, a fictional tropical island resort.
Generate exactly 5 riddle-style challenges for a mountain hike game.
Each riddle describes one distinct feature of the resort in cryptic, first-person voice.
Cover exactly these five features (one riddle each, in any order):
  Airport (passport control, arrivals queue)
  Hotel (room reservations, check-in)
  Beach (activities, limited spots, sun)
  Lighthouse / Broadcast tower (island-wide announcements, admin view)
  Parrot AI assistant (AI guide, chat, feather icon)

Return a JSON array of exactly 5 objects. Each object must have:
  "text"    – the riddle body (2-3 sentences, cryptic, poetic, first-person of the thing)
  "paths"   – array of exactly 3 answer options (5-8 words each, plausible-sounding)
  "correct" – integer 0, 1, or 2 (index of the correct answer among the three paths)
  "hint"    – one indirect sentence that nudges without revealing the answer

Rules:
- Spread the correct index: do not repeat the same index more than twice.
- Make wrong answers plausible but clearly not the right place once you think about it.
- Keep tone mysterious and island-warm.
- Output ONLY the JSON array, no markdown fences, no extra text.
"""


async def generate_riddles() -> list[dict] | None:
    if not settings.llm_api_key:
        logger.info("No LLM API key — using static riddles")
        return None
    client = AsyncOpenAI(base_url=settings.llm_base_url, api_key=settings.llm_api_key)
    try:
        response = await client.chat.completions.create(
            model=settings.llm_model,
            messages=[{"role": "user", "content": PROMPT}],
            temperature=settings.llm_temperature,
            max_tokens=settings.llm_max_tokens,
        )
        content = (response.choices[0].message.content or "").strip()
        start = content.find("[")
        end = content.rfind("]") + 1
        if start == -1 or end == 0:
            logger.warning("Riddle gen: no JSON array in response")
            return None
        riddles = json.loads(content[start:end])
        if not isinstance(riddles, list) or len(riddles) != 5:
            logger.warning("Riddle gen: got %s riddles, expected 5", len(riddles) if isinstance(riddles, list) else "?")
            return None
        for r in riddles:
            if not all(k in r for k in ("text", "paths", "correct", "hint")):
                logger.warning("Riddle gen: malformed riddle object")
                return None
            if not isinstance(r["paths"], list) or len(r["paths"]) != 3:
                return None
            if r["correct"] not in (0, 1, 2):
                return None
        logger.info("Riddle gen: generated %d riddles successfully", len(riddles))
        return riddles
    except Exception:
        logger.exception("Riddle generation failed")
        return None
    finally:
        await client.close()
