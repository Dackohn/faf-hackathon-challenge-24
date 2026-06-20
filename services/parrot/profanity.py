import re

from config import settings

# Character used to mask a profane word, preserving its length. Single source of
# truth so store-derived metrics (admin.py) can detect a masked message.
MASK_CHAR = "*"

# Stop list sourced from PROFANITY_WORDS (config.py), comma-separated, falling back
# to the curated default when unset.
PROFANITY_WORDS = [w.strip() for w in settings.profanity_words.split(",") if w.strip()]

# Leetspeak / letter-swap stand-ins. Each profane letter may appear as itself or any
# of these visually-equivalent characters, so "a$$" and "sh1t" are caught while plain
# letters stay case-insensitive. '*' is deliberately excluded so already-masked text
# is never re-matched.
_LEET = {
    "a": "@4",
    "b": "8",
    "e": "3",
    "g": "9",
    "i": "1!|",
    "l": "1|",
    "o": "0",
    "s": "$5",
    "t": "7+",
    "z": "2",
}


def _char_class(ch: str) -> str:
    """Regex character class matching `ch` plus its leet look-alikes."""
    variants = ch + _LEET.get(ch.lower(), "")
    return "[" + "".join(re.escape(c) for c in variants) + "]"


def _word_pattern(word: str) -> str:
    """Match a stop-word as a whole token (never as a substring), leet variants and all.

    The lookarounds reject a match that is glued to a surrounding alphanumeric
    character, so "ass" never fires inside "passport"/"assertive" and "hell" never
    fires inside "hello", while a standalone "a$$" still matches.
    """
    body = "".join(_char_class(c) for c in word)
    return r"(?<![A-Za-z0-9])" + body + r"(?![A-Za-z0-9])"


# Longest words first so a longer entry wins over a shorter one it contains. Falls back
# to a never-matching pattern when the stop list is empty, so masking is simply a no-op.
_PATTERN = re.compile(
    "|".join(_word_pattern(w) for w in sorted(PROFANITY_WORDS, key=len, reverse=True))
    or r"(?!x)x",
    re.IGNORECASE,
)


def mask_profanity(text: str) -> str:
    """Mask profane words (incl. leet variants) in text, preserving length with '*'."""
    if not text:
        return text
    return _PATTERN.sub(lambda m: MASK_CHAR * len(m.group(0)), text)


def contains_mask(text) -> bool:
    """True if text carries a profanity mask produced by mask_profanity."""
    return bool(text) and MASK_CHAR in text
