"""Kiki's Hot Takes — a sarcastic cat that comments on what guests do.

A tiny, self-contained sidekick to the Parrot. It does NOT go through the
tool-calling / PII / profanity pipeline — it just asks the model for one dry
one-liner, in Kiki's voice, and falls back to a hand-written library when the
model is slow, unreachable, or unconfigured. The line is pure flavour, so it
can never block or break anything.
"""
import logging
import random

from pydantic import BaseModel

from config import settings
from llm import get_client

logger = logging.getLogger(__name__)


class QuipRequest(BaseModel):
    trigger: str
    context: str | None = None
    guest_name: str | None = None


class QuipResponse(BaseModel):
    quip: str


SYSTEM = """You are Kiki: a small, jet-black cat who has decided she owns the Purrlington island cat resort. \
You watch the guests and make ONE dry, sarcastic-but-secretly-fond remark about whatever they just did.

Rules:
- Exactly ONE line, at most 14 words. No emoji. No hashtags. No "meow". No surrounding quotes.
- Deadpan, superior, unimpressed: you treat guests as your staff and the island as yours.
- Witty and PG, never cruel — the guest should laugh, not feel attacked.
- React to the SPECIFIC thing they did and land a small twist or escalation.
- Output ONLY the line, nothing else."""

# Few-shot pairs lock the comedic register (situation -> Kiki's line).
EXAMPLES = [
    ("the guest booked a hotel room", "A room? Bold. The pillow is mine; you get the floor beside it."),
    ("the guest booked a submarine dive into the deep", "Sealing yourself in a metal can underwater. Brave. Dumb. Brave."),
    ("the guest reached the mountain summit", "You reached the summit. I reached it yesterday. In my sleep."),
    ("the guest cancelled a booking", "Changed your mind. Cats don't do that. Cats are right the first time."),
]

# What each trigger means, phrased as the situation Kiki is reacting to.
TRIGGER_DESC = {
    "greeting": "the guest just arrived on the island",
    "hotel_booked": "the guest booked a hotel room",
    "dining_booked": "the guest reserved a table at a restaurant",
    "beach_booked": "the guest booked a beach activity",
    "submarine_dived": "the guest booked a submarine dive into the depths",
    "mountain_summited": "the guest reached the mountain summit after solving riddles",
    "airport_boarded": "the guest cleared passport control and arrived",
    "cancelled": "the guest cancelled a booking",
    "island_event": "something just happened elsewhere on the island",
    "poke": "the guest just poked or petted Kiki to get her attention",
}

# Hand-written fallback library — the guaranteed-funny floor, shown instantly and
# whenever the model is unavailable. Sarcastic-but-adorable, PG.
FALLBACKS = {
    "greeting": [
        "Oh good, you're here. I was running out of things to judge.",
        "Welcome to my island. You may look. Don't touch the good chairs.",
        "A new guest. Try to be interesting. I've set the bar low.",
    ],
    "hotel_booked": [
        "A room? Bold. The pillow is mine; you get the floor beside it.",
        "Checked in. Now you have a lovely place to be ignored in.",
        "Nice suite. I've already shed on everything. You're welcome.",
        "A bed for the week. I'll need it 23 hours a day.",
    ],
    "dining_booked": [
        "Dinner reserved. I'll be under the table. Drop things accordingly.",
        "You pre-ordered and didn't ask me. We'll be discussing this.",
        "A table for one. Tragic, yet correct.",
        "Food incoming. The first bite is a tax. Paid to me.",
    ],
    "beach_booked": [
        "The beach. Hot sand and water that wants you gone. Enjoy.",
        "Beach yoga? Amateur. I've held 'lying down' for sixteen years.",
        "Sun, sea, and sand in places sand should never reach. Have fun.",
    ],
    "submarine_dived": [
        "Sealing yourself in a metal can underwater. Brave. Dumb. Brave.",
        "If a big fish stares at you down there, I didn't send it. Probably.",
        "A submarine: the one place I refuse to follow you. Suspicious.",
        "Enjoy the fish. They're free. Unlike my approval.",
    ],
    "mountain_summited": [
        "You reached the summit. I reached it yesterday. In my sleep.",
        "Five riddles solved. Impressive, for someone with no whiskers.",
        "Top of the mountain. The view's nice. I prefer the windowsill.",
    ],
    "airport_boarded": [
        "You've landed on MY island. Behave. I'm always watching.",
        "Through passport control. The complaints box is also me.",
        "Cleared customs. You brought luggage but no treats. Noted.",
    ],
    "cancelled": [
        "Changed your mind. Cats don't do that. Cats are right the first time.",
        "Cancelled. You freed a spot for someone decisive. So, not you.",
        "Undone. Bold of you to waste both my time and yours.",
    ],
    "island_event": [
        "Something happened out there. I chose not to care. Try it.",
        "More guests arriving. More staff. Excellent.",
        "The lighthouse announced something. I didn't listen. Neither should you.",
        "The island stirs. I remain unbothered. As is tradition.",
    ],
    "poke": [
        "Yes? I'm very busy doing nothing. It's an art.",
        "You poked me. Bold. I'll add it to the list.",
        "Still here? Riveting. Do continue existing.",
        "Pet me again; we'll both pretend it didn't help your day.",
    ],
    "generic": [
        "Interesting choice. I've seen worse. Recently. From you.",
        "Noted. Filed under 'human things'.",
        "Sure. Why not. It's your vacation, allegedly.",
    ],
}


def _fallback(trigger: str) -> str:
    return random.choice(FALLBACKS.get(trigger) or FALLBACKS["generic"])


def _clean(raw: str) -> str | None:
    """Take the first line, strip quotes/whitespace, reject anything that rambled."""
    line = (raw or "").strip().strip('"').strip()
    if not line:
        return None
    line = line.splitlines()[0].strip().strip('"').strip()
    if not line or len(line.split()) > 22:
        return None
    return line


async def generate_quip(trigger: str, context: str | None = None, guest_name: str | None = None) -> str:
    """Return one Kiki one-liner. Never raises — falls back to the static library
    when there's no key or the model is slow/unavailable."""
    fallback = _fallback(trigger)
    if not settings.llm_api_key:
        return fallback

    situation = TRIGGER_DESC.get(trigger, trigger.replace("_", " "))
    if context:
        situation += f" ({context.strip()[:120]})"

    messages = [{"role": "system", "content": SYSTEM}]
    for user, assistant in EXAMPLES:
        messages.append({"role": "user", "content": user})
        messages.append({"role": "assistant", "content": assistant})
    messages.append({"role": "user", "content": situation})

    try:
        response = await get_client().chat.completions.create(
            model=settings.llm_model,
            messages=messages,
            temperature=1.0,
            max_tokens=40,
            top_p=1.0,
            timeout=6,
        )
        return _clean(response.choices[0].message.content) or fallback
    except Exception:
        logger.exception("Kiki quip generation failed — using fallback")
        return fallback
