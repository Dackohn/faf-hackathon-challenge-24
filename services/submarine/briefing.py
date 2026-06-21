import logging

from openai import AsyncOpenAI

from config import settings

logger = logging.getLogger(__name__)

PROMPT = """\
You are the dive-master aboard a tourist submarine at the whimsical Purrlington Island cat resort.
Write a short, vivid pre-dive briefing for a guest about to descend aboard "{name}" into the {zone}.

Rules:
- 2 to 3 sentences, at most ~60 words.
- Mention specific marine life, sights, or sensations they will encounter at that depth.
- Keep it playful and on-theme for a cat resort (a curious sea-cat may appear).
- Output ONLY the briefing text — no preamble, no quotes, no markdown.
"""


def _fallback(name: str, zone: str) -> str:
    return (
        f"Welcome aboard {name}. As we slip beneath the surface into the {zone}, keep your "
        f"eyes on the portholes — drifting jellyfish glow like paper lanterns, silver shoals "
        f"wheel past in unison, and if you're lucky a curious sea-cat will press its nose to "
        f"the glass. Mind the bubbles, and enjoy the descent."
    )


async def generate_briefing(name: str, zone: str, description: str | None = None) -> str:
    """Return a flavour briefing for a dive. Never raises — falls back to static text
    when no LLM key is configured or the model call fails/times out, so a booking is
    never blocked by the model being slow or unreachable."""
    fallback = _fallback(name, zone)
    if not settings.llm_api_key:
        return fallback

    client = AsyncOpenAI(base_url=settings.llm_base_url, api_key=settings.llm_api_key)
    try:
        response = await client.chat.completions.create(
            model=settings.llm_model,
            messages=[{"role": "user", "content": PROMPT.format(name=name, zone=zone)}],
            temperature=settings.llm_temperature,
            max_tokens=settings.llm_max_tokens,
            timeout=8,
        )
        text = (response.choices[0].message.content or "").strip()
        return text or fallback
    except Exception:
        logger.exception("Dive briefing generation failed — using fallback")
        return fallback
    finally:
        await client.close()
