from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from models import Dive, DiveStatus, Porthole, Submarine


class SubmarineError(Exception):
    def __init__(self, status_code: int, error_code: str, message: str):
        self.status_code = status_code
        self.error_code = error_code
        self.message = message
        super().__init__(message)


async def list_submarines(session: AsyncSession) -> list[dict]:
    submarines = (await session.execute(select(Submarine))).scalars().all()
    out = []
    for s in submarines:
        portholes = (await session.execute(select(Porthole).where(Porthole.submarine_id == s.id))).scalars().all()
        out.append({
            "id": s.id,
            "name": s.name,
            "depth_zone": s.depth_zone,
            "description": s.description,
            "porthole_count": len(portholes),
            "total_seats": sum(p.seats for p in portholes),
        })
    return out


async def get_submarine(session: AsyncSession, submarine_id: str) -> Submarine:
    submarine = await session.get(Submarine, submarine_id)
    if submarine is None:
        raise SubmarineError(404, "SUBMARINE_NOT_FOUND", f"Submarine {submarine_id} not found")
    portholes = (await session.execute(select(Porthole).where(Porthole.submarine_id == submarine_id))).scalars().all()
    submarine._loaded_portholes = portholes
    return submarine


async def get_availability(session: AsyncSession, submarine_id: str, slot: int) -> list[dict]:
    submarine = await session.get(Submarine, submarine_id)
    if submarine is None:
        raise SubmarineError(404, "SUBMARINE_NOT_FOUND", f"Submarine {submarine_id} not found")

    portholes = (await session.execute(select(Porthole).where(Porthole.submarine_id == submarine_id))).scalars().all()
    booked_porthole_ids = set(
        (await session.execute(
            select(Dive.porthole_id).where(
                Dive.submarine_id == submarine_id,
                Dive.dive_slot == slot,
                Dive.status == DiveStatus.CONFIRMED.value,
            )
        )).scalars().all()
    )
    return [
        {"id": p.id, "label": p.label, "seats": p.seats, "available": p.id not in booked_porthole_ids}
        for p in portholes
    ]


async def book_dive(
    session: AsyncSession,
    guest_id: str,
    submarine_id: str,
    porthole_id: str,
    party_size: int,
    dive_slot: int,
) -> Dive:
    async with session.begin():
        porthole = (
            await session.execute(
                select(Porthole).where(Porthole.id == porthole_id).with_for_update()
            )
        ).scalar_one_or_none()
        if porthole is None:
            raise SubmarineError(404, "PORTHOLE_NOT_FOUND", f"Porthole {porthole_id} not found")
        if porthole.submarine_id != submarine_id:
            raise SubmarineError(400, "PORTHOLE_SUBMARINE_MISMATCH", f"Porthole {porthole_id} does not belong to submarine {submarine_id}")
        if party_size > porthole.seats:
            raise SubmarineError(409, "PARTY_TOO_LARGE", f"Porthole {porthole_id} seats {porthole.seats}, party size {party_size} too large")

        existing = (
            await session.execute(
                select(Dive).where(
                    Dive.porthole_id == porthole_id,
                    Dive.dive_slot == dive_slot,
                    Dive.status == DiveStatus.CONFIRMED.value,
                )
            )
        ).scalar_one_or_none()
        if existing is not None:
            raise SubmarineError(409, "PORTHOLE_ALREADY_BOOKED", f"Porthole {porthole_id} is already booked for slot {dive_slot}")

        active = (
            await session.execute(
                select(Dive).where(
                    Dive.guest_id == guest_id,
                    Dive.status == DiveStatus.CONFIRMED.value,
                )
            )
        ).scalar_one_or_none()
        if active is not None:
            raise SubmarineError(409, "GUEST_ALREADY_HAS_DIVE", f"Guest {guest_id} already has an active dive")

        dive = Dive(
            guest_id=guest_id,
            submarine_id=submarine_id,
            porthole_id=porthole_id,
            party_size=party_size,
            dive_slot=dive_slot,
            status=DiveStatus.CONFIRMED.value,
        )
        session.add(dive)

        try:
            await session.flush()
        except IntegrityError:
            # Backstop: the partial unique index caught a race the row lock somehow missed.
            raise SubmarineError(409, "PORTHOLE_ALREADY_BOOKED", f"Porthole {porthole_id} is already booked for slot {dive_slot}")

    await session.refresh(dive)
    return dive


async def set_briefing(session: AsyncSession, dive_id: str, briefing: str) -> None:
    """Attach the (LLM or fallback) briefing to a dive.

    Done after the booking commits so the briefing never holds the row lock or
    blocks the booking on a slow model call. We commit directly rather than opening
    a new ``session.begin()`` block: by this point the request has already issued
    reads (which autobegin a transaction), so a nested begin() would raise
    InvalidRequestError.
    """
    dive = await session.get(Dive, dive_id)
    if dive is not None:
        dive.briefing = briefing
    await session.commit()


async def get_dive(session: AsyncSession, dive_id: str) -> Dive:
    dive = await session.get(Dive, dive_id)
    if dive is None:
        raise SubmarineError(404, "DIVE_NOT_FOUND", f"Dive {dive_id} not found")
    return dive


async def list_dives_by_guest(session: AsyncSession, guest_id: str) -> list[Dive]:
    return (
        await session.execute(
            select(Dive).where(
                Dive.guest_id == guest_id,
                Dive.status == DiveStatus.CONFIRMED.value,
            )
        )
    ).scalars().all()


async def cancel_dive(session: AsyncSession, dive_id: str) -> Dive:
    async with session.begin():
        dive = (
            await session.execute(
                select(Dive).where(Dive.id == dive_id).with_for_update()
            )
        ).scalar_one_or_none()
        if dive is None:
            raise SubmarineError(404, "DIVE_NOT_FOUND", f"Dive {dive_id} not found")
        if dive.status == DiveStatus.CANCELLED.value:
            raise SubmarineError(409, "DIVE_ALREADY_CANCELLED", f"Dive {dive_id} is already cancelled")
        dive.status = DiveStatus.CANCELLED.value

    await session.refresh(dive)
    return dive
