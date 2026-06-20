from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from models import Reservation, ReservationStatus, Restaurant, Table


class DiningError(Exception):
    def __init__(self, status_code: int, error_code: str, message: str):
        self.status_code = status_code
        self.error_code = error_code
        self.message = message
        super().__init__(message)


async def list_restaurants(session: AsyncSession) -> list[dict]:
    restaurants = (await session.execute(select(Restaurant))).scalars().all()
    out = []
    for r in restaurants:
        tables = (await session.execute(select(Table).where(Table.restaurant_id == r.id))).scalars().all()
        out.append({
            "id": r.id,
            "name": r.name,
            "cuisine": r.cuisine,
            "description": r.description,
            "table_count": len(tables),
            "total_seats": sum(t.seats for t in tables),
        })
    return out


async def get_restaurant(session: AsyncSession, restaurant_id: str) -> Restaurant:
    restaurant = await session.get(Restaurant, restaurant_id)
    if restaurant is None:
        raise DiningError(404, "RESTAURANT_NOT_FOUND", f"Restaurant {restaurant_id} not found")
    tables = (await session.execute(select(Table).where(Table.restaurant_id == restaurant_id))).scalars().all()
    restaurant._loaded_tables = tables
    return restaurant


async def get_availability(session: AsyncSession, restaurant_id: str, slot: int) -> list[dict]:
    restaurant = await session.get(Restaurant, restaurant_id)
    if restaurant is None:
        raise DiningError(404, "RESTAURANT_NOT_FOUND", f"Restaurant {restaurant_id} not found")

    tables = (await session.execute(select(Table).where(Table.restaurant_id == restaurant_id))).scalars().all()
    booked_table_ids = set(
        (await session.execute(
            select(Reservation.table_id).where(
                Reservation.restaurant_id == restaurant_id,
                Reservation.seating_slot == slot,
                Reservation.status == ReservationStatus.CONFIRMED.value,
            )
        )).scalars().all()
    )
    return [
        {"id": t.id, "label": t.label, "seats": t.seats, "available": t.id not in booked_table_ids}
        for t in tables
    ]


async def book_table(
    session: AsyncSession,
    guest_id: str,
    restaurant_id: str,
    table_id: str,
    party_size: int,
    seating_slot: int,
    pre_order: list[str] | None,
) -> Reservation:
    async with session.begin():
        table = (
            await session.execute(
                select(Table).where(Table.id == table_id).with_for_update()
            )
        ).scalar_one_or_none()
        if table is None:
            raise DiningError(404, "TABLE_NOT_FOUND", f"Table {table_id} not found")
        if table.restaurant_id != restaurant_id:
            raise DiningError(400, "TABLE_RESTAURANT_MISMATCH", f"Table {table_id} does not belong to restaurant {restaurant_id}")
        if party_size > table.seats:
            raise DiningError(409, "PARTY_TOO_LARGE", f"Table {table_id} seats {table.seats}, party size {party_size} too large")

        existing = (
            await session.execute(
                select(Reservation).where(
                    Reservation.table_id == table_id,
                    Reservation.seating_slot == seating_slot,
                    Reservation.status == ReservationStatus.CONFIRMED.value,
                )
            )
        ).scalar_one_or_none()
        if existing is not None:
            raise DiningError(409, "TABLE_ALREADY_BOOKED", f"Table {table_id} is already booked for slot {seating_slot}")

        active = (
            await session.execute(
                select(Reservation).where(
                    Reservation.guest_id == guest_id,
                    Reservation.status == ReservationStatus.CONFIRMED.value,
                )
            )
        ).scalar_one_or_none()
        if active is not None:
            raise DiningError(409, "GUEST_ALREADY_HAS_RESERVATION", f"Guest {guest_id} already has an active reservation")

        reservation = Reservation(
            guest_id=guest_id,
            restaurant_id=restaurant_id,
            table_id=table_id,
            party_size=party_size,
            seating_slot=seating_slot,
            pre_order=pre_order,
            status=ReservationStatus.CONFIRMED.value,
        )
        session.add(reservation)

        try:
            await session.flush()
        except IntegrityError:
            # Backstop: the partial unique index caught a race the row lock somehow missed.
            raise DiningError(409, "TABLE_ALREADY_BOOKED", f"Table {table_id} is already booked for slot {seating_slot}")

    await session.refresh(reservation)
    return reservation


async def get_reservation(session: AsyncSession, reservation_id: str) -> Reservation:
    reservation = await session.get(Reservation, reservation_id)
    if reservation is None:
        raise DiningError(404, "RESERVATION_NOT_FOUND", f"Reservation {reservation_id} not found")
    return reservation


async def list_reservations_by_guest(session: AsyncSession, guest_id: str) -> list[Reservation]:
    return (
        await session.execute(
            select(Reservation).where(
                Reservation.guest_id == guest_id,
                Reservation.status == ReservationStatus.CONFIRMED.value,
            )
        )
    ).scalars().all()


async def cancel_reservation(session: AsyncSession, reservation_id: str) -> Reservation:
    async with session.begin():
        reservation = (
            await session.execute(
                select(Reservation).where(Reservation.id == reservation_id).with_for_update()
            )
        ).scalar_one_or_none()
        if reservation is None:
            raise DiningError(404, "RESERVATION_NOT_FOUND", f"Reservation {reservation_id} not found")
        if reservation.status == ReservationStatus.CANCELLED.value:
            raise DiningError(409, "RESERVATION_ALREADY_CANCELLED", f"Reservation {reservation_id} is already cancelled")
        reservation.status = ReservationStatus.CANCELLED.value

    await session.refresh(reservation)
    return reservation
