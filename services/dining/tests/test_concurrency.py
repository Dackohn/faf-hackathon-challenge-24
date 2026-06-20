"""Proves Dining does not repeat Beach's (no persistence/no check) or Hotel's
(count-then-create race) booking bug: N concurrent attempts to book the same
table+slot must yield exactly one CONFIRMED reservation.

Requires a real Postgres reachable via TEST_DATABASE_URL (or DATABASE_URL).
"""
import asyncio
import os
import uuid

import pytest
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from models import Base, Reservation, ReservationStatus, Restaurant, Table
from repository import DiningError, book_table

DATABASE_URL = os.environ.get("TEST_DATABASE_URL") or os.environ.get(
    "DATABASE_URL", "postgresql+asyncpg://postgres:postgres@localhost:5432/dining"
)


@pytest.fixture
async def engine():
    eng = create_async_engine(DATABASE_URL)
    async with eng.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield eng
    await eng.dispose()


@pytest.fixture
async def seeded(engine):
    session_factory = async_sessionmaker(engine, expire_on_commit=False)
    restaurant_id = f"TESTREST-{uuid.uuid4().hex[:8]}"
    table_id = f"TESTTBL-{uuid.uuid4().hex[:8]}"
    async with session_factory() as session:
        async with session.begin():
            session.add(Restaurant(id=restaurant_id, name="Test Resto", cuisine="Test", description="x"))
            session.add(Table(id=table_id, restaurant_id=restaurant_id, label="Test table", seats=4))
    yield session_factory, restaurant_id, table_id
    async with session_factory() as session:
        async with session.begin():
            await session.execute(delete(Reservation).where(Reservation.table_id == table_id))
            await session.execute(delete(Table).where(Table.id == table_id))
            await session.execute(delete(Restaurant).where(Restaurant.id == restaurant_id))


@pytest.mark.asyncio
async def test_concurrent_bookings_only_one_succeeds(seeded):
    session_factory, restaurant_id, table_id = seeded
    seating_slot = 18
    n = 20

    async def attempt(i: int):
        async with session_factory() as session:
            try:
                await book_table(
                    session,
                    guest_id=f"guest-{i}-{uuid.uuid4().hex[:6]}",
                    restaurant_id=restaurant_id,
                    table_id=table_id,
                    party_size=2,
                    seating_slot=seating_slot,
                    pre_order=None,
                )
                return "ok"
            except DiningError as e:
                return e.error_code

    results = await asyncio.gather(*(attempt(i) for i in range(n)))

    assert results.count("ok") == 1
    assert all(r in ("ok", "TABLE_ALREADY_BOOKED") for r in results)

    async with session_factory() as session:
        confirmed = (
            await session.execute(
                select(Reservation).where(
                    Reservation.table_id == table_id,
                    Reservation.seating_slot == seating_slot,
                    Reservation.status == ReservationStatus.CONFIRMED.value,
                )
            )
        ).scalars().all()
        assert len(confirmed) == 1
