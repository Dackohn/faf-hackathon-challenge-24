import threading
import time
from dataclasses import dataclass, field
from typing import Optional

RIDDLES = [
    {
        "id": 0,
        "text": "What is the derivative of f(x) = x^3 · ln(x)?",
        "paths": ["x^2 · (3·ln(x) + 1)", "3x^2 · ln(x) + x^2", "3x^2 · ln(x) + 1/x"],
        "correct": 1,
        "hint": "Apply the product rule: d/dx[u·v] = u'v + uv'.",
    },
    {
        "id": 1,
        "text": "What is the value of the definite integral ∫₀¹ x · e^x dx?",
        "paths": ["e - 2", "1", "e + 1"],
        "correct": 0,
        "hint": "Use integration by parts with u = x and dv = e^x dx.",
    },
    {
        "id": 2,
        "text": "Matrix A = [[2, 1], [5, 3]]. What is det(A)?",
        "paths": ["1", "11", "6"],
        "correct": 0,
        "hint": "For a 2×2 matrix [[a,b],[c,d]], the determinant is a·d - b·c.",
    },
    {
        "id": 3,
        "text": "In how many ways can you choose 3 items from 8 distinct items (order does not matter)?",
        "paths": ["336", "56", "24"],
        "correct": 1,
        "hint": "Use the combination formula C(n, k) = n! / (k! · (n-k)!).",
    },
    {
        "id": 4,
        "text": "What is lim(x→0) [sin(3x) / x]?",
        "paths": ["0", "1", "3"],
        "correct": 2,
        "hint": "Recall that lim(x→0) [sin(ax) / x] = a.",
    },
]

MAX_WRONG_PER_RIDDLE = 3


@dataclass
class HikeState:
    guest_id: str
    started_at: float
    riddles: list = field(default_factory=list)
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

    def start(self, guest_id: str, riddles: list | None = None) -> dict:
        with self._lock:
            state = HikeState(
                guest_id=guest_id,
                started_at=time.time(),
                riddles=riddles if riddles else RIDDLES,
            )
            self._hikes[guest_id] = state
        return self._riddle_response(state)

    def answer(self, guest_id: str, choice: int) -> dict:
        with self._lock:
            state = self._hikes.get(guest_id)
            if state is None:
                return {"error": "No active hike. Start one first."}
            if state.summited:
                return {"error": "Already summited!", "summited": True}

            riddle = state.riddles[state.step]
            if choice == riddle["correct"]:
                state.step += 1
                state.wrong_this_step = 0
                if state.step >= len(state.riddles):
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
                    if state.step >= len(state.riddles):
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
                    "was_skipped": False,
                    "summited": False,
                    "wrong_attempts": state.wrong_this_step,
                    "attempts_left": MAX_WRONG_PER_RIDDLE - state.wrong_this_step,
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
        riddle = state.riddles[state.step]
        return {
            "step": state.step,
            "total_steps": len(state.riddles),
            "riddle": riddle["text"],
            "paths": riddle["paths"],
            "hint": riddle["hint"],
        }


game = MountainGame()
