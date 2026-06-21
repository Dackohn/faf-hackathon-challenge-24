from sqlalchemy import select

from database import SessionLocal
from models import Porthole, Submarine

# Seeded on startup when empty — the same pattern as Dining/Beach, since the shared
# postgres container in docker-compose only runs init-db.sql (CREATE DATABASE),
# not per-service seed files.
SUBMARINES = [
    ("SUB001", "The Whiskered Nautilus", "Coral Shallows",
     "A glass-bottomed cruiser drifting over sunlit reefs — bright, gentle, and full of clownfish and curious turtles."),
    ("SUB002", "Silent Paws", "Kelp Forest",
     "Glide through swaying kelp cathedrals where otters tumble and sunlight falls in long green ribbons."),
    ("SUB003", "Deep Purrl", "Twilight Trench",
     "Descend past the last of the sunlight into the blue dark, where jellyfish glow and squid drift like ghosts."),
    ("SUB004", "Abyss Whisker", "Midnight Abyss",
     "For the brave only: the crushing black deep, lit by anglerfish lanterns and the glow of your own portholes."),
]

PORTHOLES = [
    ("POR001", "SUB001", "Bow porthole", 2),
    ("POR002", "SUB001", "Port window", 2),
    ("POR003", "SUB001", "Starboard window", 2),
    ("POR004", "SUB001", "Observation dome", 4),
    ("POR005", "SUB002", "Bow porthole", 2),
    ("POR006", "SUB002", "Kelp-view bay", 4),
    ("POR007", "SUB002", "Otter deck", 3),
    ("POR008", "SUB003", "Bow porthole", 2),
    ("POR009", "SUB003", "Twilight bay", 2),
    ("POR010", "SUB003", "Glow lounge", 4),
    ("POR011", "SUB004", "Bow porthole", 2),
    ("POR012", "SUB004", "Abyss dome", 2),
    ("POR013", "SUB004", "Lantern bay", 3),
]


async def seed_if_empty():
    async with SessionLocal() as session:
        existing = (await session.execute(select(Submarine.id))).first()
        if existing is not None:
            return

        # session.execute() above already opened an implicit transaction
        # (AsyncSession autobegin) — commit it directly rather than nesting
        # another session.begin(), which raises InvalidRequestError.
        for id_, name, depth_zone, description in SUBMARINES:
            session.add(Submarine(id=id_, name=name, depth_zone=depth_zone, description=description))
        for id_, submarine_id, label, seats in PORTHOLES:
            session.add(Porthole(id=id_, submarine_id=submarine_id, label=label, seats=seats))
        await session.commit()
