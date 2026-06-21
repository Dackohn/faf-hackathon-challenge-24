import asyncio
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from game import game
from broadcast import notify_summit
from riddle_gen import generate_riddles

router = APIRouter()


class StartRequest(BaseModel):
    guest_id: str


class AnswerRequest(BaseModel):
    guest_id: str
    choice: int  # 0, 1, or 2


@router.get("/health")
def health():
    return {"status": "ok"}


@router.post("/hike/start")
async def hike_start(req: StartRequest):
    riddles = await generate_riddles()  # None → falls back to static riddles
    return game.start(req.guest_id, riddles)


@router.post("/hike/answer")
async def hike_answer(req: AnswerRequest):
    if req.choice not in (0, 1, 2):
        raise HTTPException(status_code=400, detail="choice must be 0, 1, or 2")
    result = game.answer(req.guest_id, req.choice)
    if result.get("summited") and "error" not in result:
        asyncio.ensure_future(
            notify_summit(
                req.guest_id,
                result.get("duration_seconds", 0),
                result.get("skipped_count", 0),
            )
        )
    return result


@router.get("/hike/status/{guest_id}")
def hike_status(guest_id: str):
    return game.status(guest_id)


@router.get("/hike/leaderboard")
def hike_leaderboard():
    return {"leaderboard": game.leaderboard()}
