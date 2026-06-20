from sqlalchemy import select

from database import SessionLocal
from models import Restaurant, Table

# Mirrors db/init/seed_restaurants.sql — kept in sync manually. Seeds on startup
# when empty, the same pattern as Beach's ActivitySeeder, since the shared
# postgres container in docker-compose only runs init-db.sql (CREATE DATABASE),
# not per-service db/init/*.sql files.
RESTAURANTS = [
    ("REST001", "The Salty Whisker", "Seafood", "Fresh catch served with zero small talk — order at the kiosk, eat in peace."),
    ("REST002", "Bamboo and Broth", "Asian Fusion", "Self-serve noodle bar with private booths for solo dining."),
    ("REST003", "The Quiet Crust", "Pizza", "Self-serve oven pods — pick a pizza, bake it yourself, no waiter required."),
    ("REST004", "Sunset Grill Pods", "BBQ", "Solo BBQ pods facing the sunset, food delivered by conveyor."),
]

TABLES = [
    ("TBL001", "REST001", "Window table", 4),
    ("TBL002", "REST001", "Booth 1", 2),
    ("TBL003", "REST001", "Booth 2", 2),
    ("TBL004", "REST001", "Patio table", 6),
    ("TBL005", "REST002", "Noodle booth 1", 2),
    ("TBL006", "REST002", "Noodle booth 2", 2),
    ("TBL007", "REST002", "Group table", 8),
    ("TBL008", "REST002", "Counter seat", 1),
    ("TBL009", "REST003", "Oven pod 1", 2),
    ("TBL010", "REST003", "Oven pod 2", 2),
    ("TBL011", "REST003", "Oven pod 3", 4),
    ("TBL012", "REST004", "Sunset pod 1", 2),
    ("TBL013", "REST004", "Sunset pod 2", 2),
    ("TBL014", "REST004", "Sunset pod 3", 4),
    ("TBL015", "REST004", "Group grill", 6),
]


async def seed_if_empty():
    async with SessionLocal() as session:
        existing = (await session.execute(select(Restaurant.id))).first()
        if existing is not None:
            return

        # session.execute() above already opened an implicit transaction
        # (AsyncSession autobegin) — commit it directly rather than nesting
        # another session.begin(), which raises InvalidRequestError.
        for id_, name, cuisine, description in RESTAURANTS:
            session.add(Restaurant(id=id_, name=name, cuisine=cuisine, description=description))
        for id_, restaurant_id, label, seats in TABLES:
            session.add(Table(id=id_, restaurant_id=restaurant_id, label=label, seats=seats))
        await session.commit()
