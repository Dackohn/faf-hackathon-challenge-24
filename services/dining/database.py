from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase

from config import settings

engine = create_async_engine(settings.database_url, pool_pre_ping=True)


async def ensure_database_exists():
    """Create the dining DB if it doesn't exist (idempotent, safe on every startup)."""
    maintenance_url = settings.database_url.rsplit("/dining", 1)[0] + "/postgres"
    maintenance_engine = create_async_engine(maintenance_url, isolation_level="AUTOCOMMIT")
    try:
        async with maintenance_engine.connect() as conn:
            exists = (await conn.execute(
                text("SELECT 1 FROM pg_database WHERE datname = 'dining'")
            )).scalar()
            if not exists:
                await conn.execute(text("CREATE DATABASE dining"))
    finally:
        await maintenance_engine.dispose()
SessionLocal = async_sessionmaker(engine, expire_on_commit=False, class_=AsyncSession)


class Base(DeclarativeBase):
    pass


async def get_session() -> AsyncSession:
    async with SessionLocal() as session:
        yield session


async def create_all():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)


async def close_engine():
    await engine.dispose()
