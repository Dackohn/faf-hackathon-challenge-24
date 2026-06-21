from fastapi import APIRouter, Depends, Request
from fastapi.responses import JSONResponse
from sqlalchemy.ext.asyncio import AsyncSession

import broadcast
import repository
from briefing import generate_briefing
from database import get_session
from repository import SubmarineError
from schemas import (
    AvailabilityOut,
    CancelOut,
    DiveCreateIn,
    DiveListOut,
    DiveOut,
    PortholeOut,
    SubmarineListOut,
    SubmarineOut,
)

router = APIRouter()


def _error(e: SubmarineError) -> JSONResponse:
    return JSONResponse(status_code=e.status_code, content={"error": e.message, "error_code": e.error_code})


def _dive_out(d) -> dict:
    return {
        "id": d.id,
        "guest_id": d.guest_id,
        "submarine_id": d.submarine_id,
        "porthole_id": d.porthole_id,
        "party_size": d.party_size,
        "dive_slot": d.dive_slot,
        "briefing": d.briefing,
        "status": d.status,
    }


@router.get("/health")
async def health():
    return {"status": "ok"}


@router.get("/submarines", response_model=SubmarineListOut)
async def list_submarines(session: AsyncSession = Depends(get_session)):
    return {"submarines": await repository.list_submarines(session)}


@router.get("/submarines/{submarine_id}")
async def get_submarine(submarine_id: str, session: AsyncSession = Depends(get_session)):
    try:
        submarine = await repository.get_submarine(session, submarine_id)
    except SubmarineError as e:
        return _error(e)
    return SubmarineOut(
        id=submarine.id,
        name=submarine.name,
        depth_zone=submarine.depth_zone,
        description=submarine.description,
        portholes=[PortholeOut(id=p.id, label=p.label, seats=p.seats) for p in submarine._loaded_portholes],
    )


@router.get("/submarines/{submarine_id}/availability")
async def get_availability(submarine_id: str, request: Request, session: AsyncSession = Depends(get_session)):
    raw_slot = request.query_params.get("slot")
    if raw_slot is None or not raw_slot.lstrip("-").isdigit():
        return _error(SubmarineError(400, "SLOT_REQUIRED", "Query param 'slot' must be an integer"))
    slot = int(raw_slot)

    try:
        portholes = await repository.get_availability(session, submarine_id, slot)
    except SubmarineError as e:
        return _error(e)
    return AvailabilityOut(submarine_id=submarine_id, slot=slot, portholes=portholes)


@router.post("/dives", status_code=201)
async def create_dive(body: DiveCreateIn, session: AsyncSession = Depends(get_session)):
    try:
        dive = await repository.book_dive(
            session,
            guest_id=body.guest_id,
            submarine_id=body.submarine_id,
            porthole_id=body.porthole_id,
            party_size=body.party_size,
            dive_slot=body.dive_slot,
        )
    except SubmarineError as e:
        if e.error_code == "PORTHOLE_ALREADY_BOOKED":
            try:
                submarine = await repository.get_submarine(session, body.submarine_id)
                submarine_name = submarine.name
            except SubmarineError:
                submarine_name = body.submarine_id
            broadcast.publish_dive_full(submarine_name, body.dive_slot)
        return _error(e)

    # Resolve the submarine for the briefing + the broadcast message.
    try:
        submarine = await repository.get_submarine(session, dive.submarine_id)
        name, zone, description = submarine.name, submarine.depth_zone, submarine.description
    except SubmarineError:
        name, zone, description = dive.submarine_id, "the deep", None

    # Enrich with a flavour briefing (LLM if available, static fallback otherwise).
    # Done after the booking commits, so a slow model never blocks or fails the dive.
    briefing = await generate_briefing(name, zone, description)
    await repository.set_briefing(session, dive.id, briefing)

    out = _dive_out(dive)
    out["briefing"] = briefing
    broadcast.publish_dive_booked(out, name, zone)
    return DiveOut(**out)


@router.get("/dives/by-guest/{guest_id}", response_model=DiveListOut)
async def list_dives_by_guest(guest_id: str, session: AsyncSession = Depends(get_session)):
    dives = await repository.list_dives_by_guest(session, guest_id)
    return {"guest_id": guest_id, "dives": [_dive_out(d) for d in dives]}


@router.get("/dives/{dive_id}")
async def get_dive(dive_id: str, session: AsyncSession = Depends(get_session)):
    try:
        dive = await repository.get_dive(session, dive_id)
    except SubmarineError as e:
        return _error(e)
    return DiveOut(**_dive_out(dive))


@router.post("/dives/{dive_id}/cancel", response_model=CancelOut)
async def cancel_dive(dive_id: str, session: AsyncSession = Depends(get_session)):
    try:
        dive = await repository.cancel_dive(session, dive_id)
    except SubmarineError as e:
        return _error(e)

    try:
        submarine = await repository.get_submarine(session, dive.submarine_id)
        submarine_name = submarine.name
    except SubmarineError:
        submarine_name = dive.submarine_id
    broadcast.publish_dive_cancelled(_dive_out(dive), submarine_name)
    return {"id": dive.id, "status": dive.status}
