from fastapi import APIRouter, Depends, Request
from fastapi.responses import JSONResponse
from sqlalchemy.ext.asyncio import AsyncSession

import broadcast
import repository
from database import get_session
from repository import DiningError
from schemas import (
    AvailabilityOut,
    CancelOut,
    ReservationCreateIn,
    ReservationListOut,
    ReservationOut,
    RestaurantListOut,
    RestaurantOut,
    TableOut,
)

router = APIRouter()


def _error(e: DiningError) -> JSONResponse:
    return JSONResponse(status_code=e.status_code, content={"error": e.message, "error_code": e.error_code})


def _reservation_out(r) -> dict:
    return {
        "id": r.id,
        "guest_id": r.guest_id,
        "restaurant_id": r.restaurant_id,
        "table_id": r.table_id,
        "party_size": r.party_size,
        "seating_slot": r.seating_slot,
        "pre_order": r.pre_order,
        "status": r.status,
    }


@router.get("/health")
async def health():
    return {"status": "ok"}


@router.get("/restaurants", response_model=RestaurantListOut)
async def list_restaurants(session: AsyncSession = Depends(get_session)):
    return {"restaurants": await repository.list_restaurants(session)}


@router.get("/restaurants/{restaurant_id}")
async def get_restaurant(restaurant_id: str, session: AsyncSession = Depends(get_session)):
    try:
        restaurant = await repository.get_restaurant(session, restaurant_id)
    except DiningError as e:
        return _error(e)
    return RestaurantOut(
        id=restaurant.id,
        name=restaurant.name,
        cuisine=restaurant.cuisine,
        description=restaurant.description,
        tables=[TableOut(id=t.id, label=t.label, seats=t.seats) for t in restaurant._loaded_tables],
    )


@router.get("/restaurants/{restaurant_id}/availability")
async def get_availability(restaurant_id: str, request: Request, session: AsyncSession = Depends(get_session)):
    raw_slot = request.query_params.get("slot")
    if raw_slot is None or not raw_slot.lstrip("-").isdigit():
        return _error(DiningError(400, "SLOT_REQUIRED", "Query param 'slot' must be an integer"))
    slot = int(raw_slot)

    try:
        tables = await repository.get_availability(session, restaurant_id, slot)
    except DiningError as e:
        return _error(e)
    return AvailabilityOut(restaurant_id=restaurant_id, slot=slot, tables=tables)


@router.post("/reservations", status_code=201)
async def create_reservation(body: ReservationCreateIn, session: AsyncSession = Depends(get_session)):
    try:
        reservation = await repository.book_table(
            session,
            guest_id=body.guest_id,
            restaurant_id=body.restaurant_id,
            table_id=body.table_id,
            party_size=body.party_size,
            seating_slot=body.seating_slot,
            pre_order=body.pre_order,
        )
    except DiningError as e:
        if e.error_code == "TABLE_ALREADY_BOOKED":
            try:
                restaurant = await repository.get_restaurant(session, body.restaurant_id)
                restaurant_name = restaurant.name
            except DiningError:
                restaurant_name = body.restaurant_id
            broadcast.publish_table_full(body.restaurant_id, restaurant_name, body.table_id, body.seating_slot)
        return _error(e)

    out = _reservation_out(reservation)
    try:
        restaurant = await repository.get_restaurant(session, reservation.restaurant_id)
        restaurant_name = restaurant.name
    except DiningError:
        restaurant_name = reservation.restaurant_id
    broadcast.publish_reservation_confirmed(out, restaurant_name)
    return ReservationOut(**out)


@router.get("/reservations/by-guest/{guest_id}", response_model=ReservationListOut)
async def list_reservations_by_guest(guest_id: str, session: AsyncSession = Depends(get_session)):
    reservations = await repository.list_reservations_by_guest(session, guest_id)
    return {"guest_id": guest_id, "reservations": [_reservation_out(r) for r in reservations]}


@router.get("/reservations/{reservation_id}")
async def get_reservation(reservation_id: str, session: AsyncSession = Depends(get_session)):
    try:
        reservation = await repository.get_reservation(session, reservation_id)
    except DiningError as e:
        return _error(e)
    return ReservationOut(**_reservation_out(reservation))


@router.post("/reservations/{reservation_id}/cancel", response_model=CancelOut)
async def cancel_reservation(reservation_id: str, session: AsyncSession = Depends(get_session)):
    try:
        reservation = await repository.cancel_reservation(session, reservation_id)
    except DiningError as e:
        return _error(e)

    try:
        restaurant = await repository.get_restaurant(session, reservation.restaurant_id)
        restaurant_name = restaurant.name
    except DiningError:
        restaurant_name = reservation.restaurant_id
    broadcast.publish_reservation_cancelled(_reservation_out(reservation), restaurant_name)
    return {"id": reservation.id, "status": reservation.status}
