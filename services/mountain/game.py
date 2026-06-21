import threading
import time
from dataclasses import dataclass, field
from typing import Optional

RIDDLES = [
    {
        "id": 0,
        "text": "Many travelers pass through my gates each day. I check their papers before they may stay. Which path leads to my domain?",
        "paths": ["Through the control booths", "Up the cobblestone steps", "Along the sandy shore"],
        "correct": 0,
        "hint": "This is the very first stop on every guest's journey to Purrlington — you passed through it yourself.",
    },
    {
        "id": 1,
        "text": "I hold your nights in numbered rooms. Book me early or face the gloom. Which path leads to my halls?",
        "paths": ["Down to the crashing waves", "Through the grand revolving door", "Toward the flashing beacon"],
        "correct": 1,
        "hint": "Where do you rest your head after a long day on the island? It has rooms, and you need a reservation.",
    },
    {
        "id": 2,
        "text": "My spots fill fast under the sun. Kayaks, volleyball, surfing — join the fun! Which path do the waves call you to?",
        "paths": ["Down to the golden sands", "Into the crowded terminal", "Through the feathered archway"],
        "correct": 0,
        "hint": "Think sand, sun, and activities with limited capacity. You book a spot, not a room.",
    },
    {
        "id": 3,
        "text": "I stand tall above the rest. I see all, I speak to all — island-wide announcements are my test. Which path leads to my signal?",
        "paths": ["Past the arrivals board", "Into the green lobby", "Up toward the flashing beacon"],
        "correct": 2,
        "hint": "Look for the tall structure that broadcasts news to every corner of the island. Admins love it.",
    },
    {
        "id": 4,
        "text": "I speak but have no beak, I think but never sleep. I guide every guest through the island complete. Who am I?",
        "paths": ["The keeper of the flame", "The wise mountain spirit", "The colourful feathered guide"],
        "correct": 2,
        "hint": "You have been talking to me this whole hike. I live in a panel with a feather icon.",
    },
]

MAX_WRONG_PER_RIDDLE = 3


@dataclass
class HikeState:
    guest_id: str
    started_at: float
    step: int = 0
    wrong_this_step: int = 0
    skipped: int = 0
    summited: bool = False
    summited_at: Optional[float] = None


@dataclass
class LeaderboardEntry:
    guest_id: str
    duration_seconds: float
    skipped: int


class MountainGame:
    def __init__(self):
        self._lock = threading.Lock()
        self._hikes: dict[str, HikeState] = {}
        self._leaderboard: list[LeaderboardEntry] = []

    def start(self, guest_id: str) -> dict:
        with self._lock:
            state = HikeState(guest_id=guest_id, started_at=time.time())
            self._hikes[guest_id] = state
        return self._riddle_response(state)

    def answer(self, guest_id: str, choice: int) -> dict:
        with self._lock:
            state = self._hikes.get(guest_id)
            if state is None:
                return {"error": "No active hike. Start one first."}
            if state.summited:
                return {"error": "Already summited!", "summited": True}

            riddle = RIDDLES[state.step]
            if choice == riddle["correct"]:
                state.step += 1
                state.wrong_this_step = 0
                if state.step >= len(RIDDLES):
                    state.summited = True
                    state.summited_at = time.time()
                    duration = state.summited_at - state.started_at
                    self._leaderboard.append(
                        LeaderboardEntry(guest_id, duration, state.skipped)
                    )
                    self._leaderboard.sort(key=lambda e: (e.skipped, e.duration_seconds))
                    self._leaderboard = self._leaderboard[:20]
                    return {
                        "correct": True,
                        "summited": True,
                        "duration_seconds": round(duration, 1),
                        "skipped_count": state.skipped,
                        "message": "You reached the summit! The island stretches below you in all its glory.",
                    }
                return {"correct": True, "summited": False, **self._riddle_response(state)}
            else:
                state.wrong_this_step += 1
                if state.wrong_this_step >= MAX_WRONG_PER_RIDDLE:
                    state.skipped += 1
                    state.step += 1
                    state.wrong_this_step = 0
                    if state.step >= len(RIDDLES):
                        state.summited = True
                        state.summited_at = time.time()
                        duration = state.summited_at - state.started_at
                        self._leaderboard.append(
                            LeaderboardEntry(guest_id, duration, state.skipped)
                        )
                        self._leaderboard.sort(key=lambda e: (e.skipped, e.duration_seconds))
                        self._leaderboard = self._leaderboard[:20]
                        return {
                            "correct": False,
                            "was_skipped": True,
                            "summited": True,
                            "duration_seconds": round(duration, 1),
                            "skipped_count": state.skipped,
                            "message": "The Oracle guided you past the final obstacle. You reached the summit!",
                        }
                    return {
                        "correct": False,
                        "skipped": True,
                        "summited": False,
                        "message": "You slipped three times — the Oracle lends a hand and guides you past this obstacle.",
                        **self._riddle_response(state),
                    }
                return {
                    "correct": False,
                    "skipped": False,
                    "summited": False,
                    "wrong_attempts": state.wrong_this_step,
                    "message": "The path crumbles underfoot. Try another route.",
                    **self._riddle_response(state),
                }

    def status(self, guest_id: str) -> dict:
        with self._lock:
            state = self._hikes.get(guest_id)
            if state is None:
                return {"active": False}
            return {
                "active": True,
                "step": state.step,
                "total_steps": len(RIDDLES),
                "summited": state.summited,
                "skipped": state.skipped,
            }

    def leaderboard(self) -> list[dict]:
        with self._lock:
            return [
                {
                    "rank": i + 1,
                    "guest_id": e.guest_id,
                    "duration_seconds": round(e.duration_seconds, 1),
                    "skipped": e.skipped,
                }
                for i, e in enumerate(self._leaderboard)
            ]

    def _riddle_response(self, state: HikeState) -> dict:
        riddle = RIDDLES[state.step]
        return {
            "step": state.step,
            "total_steps": len(RIDDLES),
            "riddle": riddle["text"],
            "paths": riddle["paths"],
            "hint": riddle["hint"],
        }


game = MountainGame()
