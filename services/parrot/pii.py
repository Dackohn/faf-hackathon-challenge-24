import re

from guests import get_guest_pii

# Placeholder tokens swapped in for guest PII before a prompt leaves the system, and
# swapped back out of the model's reply. One guest per conversation, so fixed labels
# are enough (no numbering). Bracketed + upper-case so they survive the model verbatim
# and never collide with ordinary prose.
NAME = "[GUEST_NAME]"
SURNAME = "[GUEST_SURNAME]"
AGE = "[GUEST_AGE]"
PASSPORT = "[GUEST_PASSPORT]"

ALL_PLACEHOLDERS = (NAME, SURNAME, AGE, PASSPORT)


class Pseudonymizer:
    """Bidirectional guest-PII <-> placeholder mapper for a single guest.

    Outbound (toward the LLM): real name/surname/age/passport are replaced with stable
    placeholders, so personal data never reaches the third-party provider. Inbound
    (model output and stored history shown to the guest): placeholders are restored to
    the real values, so the guest still gets a correct, personalised answer.
    """

    def __init__(self, pii: dict):
        self.name = str(pii["name"])
        self.surname = str(pii["surname"])
        self.age = str(pii["age"])
        self.passport = str(pii["passport"])

        self._restore_map = {
            NAME: self.name,
            SURNAME: self.surname,
            AGE: self.age,
            PASSPORT: self.passport,
        }
        self._restore_re = re.compile("|".join(re.escape(p) for p in ALL_PLACEHOLDERS))

        # Names are distinctive enough to redact anywhere safely. Age (a small integer)
        # and passport ("EU"/"non-EU") are low-cardinality and collide with ordinary
        # resort data, so they are only redacted from the guest's own message — never
        # from tool results / resort context, where the same token means something else.
        self._names_re = self._boundaried(self.surname, self.name)
        self._all_re = self._boundaried(self.surname, self.name, self.passport, self.age)

        # value(lowercased) -> placeholder, built once so the redact methods stay trivial.
        # Longest-value-first matching is handled by the regex alternation, not this map.
        self._all_map = {
            self.passport.lower(): PASSPORT,
            self.age.lower(): AGE,
            self.surname.lower(): SURNAME,
            self.name.lower(): NAME,
        }
        self._names_map = {self.surname.lower(): SURNAME, self.name.lower(): NAME}

    @staticmethod
    def _boundaried(*values: str) -> re.Pattern | None:
        """Whole-token, case-insensitive matcher for the given values, longest first.

        Boundaries exclude word chars and '-' so a value never fires inside a larger
        word/number and "non-EU" wins over "EU"."""
        seen: dict[str, str] = {}
        for v in sorted((v for v in values if v), key=len, reverse=True):
            seen.setdefault(v.lower(), v)
        if not seen:
            return None
        body = "|".join(re.escape(v) for v in seen.values())
        return re.compile(r"(?<![\w-])(" + body + r")(?![\w-])", re.IGNORECASE)

    def _redact(self, text, pattern, placeholder_for):
        if not text or pattern is None:
            return text
        return pattern.sub(lambda m: placeholder_for(m.group(0).lower()), text)

    def redact_message(self, text: str) -> str:
        """Redact every PII field from the guest's own message (names, age, passport)."""
        return self._redact(text, self._all_re, lambda v: self._all_map.get(v, v))

    def redact_data(self, text: str) -> str:
        """Redact only names from tool results / context, where age & passport tokens
        ("3", "EU"…) are resort data rather than this guest's PII."""
        return self._redact(text, self._names_re, lambda v: self._names_map.get(v, v))

    def restore(self, text: str | None) -> str | None:
        """Replace placeholders with the guest's real values for guest-facing output."""
        if not text:
            return text
        return self._restore_re.sub(lambda m: self._restore_map.get(m.group(0), m.group(0)), text)

    def profile_block(self) -> str:
        """Placeholder-only guest profile for the system prompt — carries zero real PII."""
        return (
            "## Current Guest\n"
            f"- Name: {NAME} {SURNAME}\n"
            f"- Age: {AGE}\n"
            f"- Passport: {PASSPORT}\n"
            "Use these placeholder tokens verbatim when you refer to the guest's name, age, "
            "or passport — the system replaces them with the real values before the guest "
            "sees your reply. Never guess or invent other personal details.\n"
        )


class StreamRestorer:
    """Restores placeholders in a token stream without ever emitting a half-written
    placeholder (a token like '[GUEST_NAME]' may be split across SSE deltas)."""

    def __init__(self, pseudonymizer: Pseudonymizer):
        self._p = pseudonymizer
        self._buf = ""

    def push(self, delta: str) -> str:
        self._buf += delta
        cut = self._flushable_len()
        out, self._buf = self._buf[:cut], self._buf[cut:]
        return self._p.restore(out)

    def flush(self) -> str:
        out, self._buf = self._buf, ""
        return self._p.restore(out)

    def _flushable_len(self) -> int:
        """How much of the buffer is safe to emit — i.e. cannot be the start of a
        placeholder that is still arriving."""
        idx = self._buf.rfind("[")
        if idx == -1:
            return len(self._buf)
        tail = self._buf[idx:]
        if "]" in tail:  # bracket expression already closed — safe to emit & restore
            return len(self._buf)
        if any(ph.startswith(tail) for ph in ALL_PLACEHOLDERS):
            return idx  # tail could grow into a placeholder — hold it back
        return len(self._buf)


def make_pseudonymizer(guest_id: str | None) -> Pseudonymizer | None:
    """Build a Pseudonymizer for a guest, or None if the guest/PII is unknown."""
    pii = get_guest_pii(guest_id)
    return Pseudonymizer(pii) if pii else None
