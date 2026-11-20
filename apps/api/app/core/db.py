from collections.abc import AsyncGenerator

from sqlalchemy import create_engine
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import Session, sessionmaker

from app.core.config import settings

_is_sqlite = settings.database_url.startswith("sqlite")

if _is_sqlite:
    engine = create_async_engine(
        settings.database_url,
        connect_args={"check_same_thread": False},
    )
else:
    engine = create_async_engine(
        settings.database_url,
        pool_pre_ping=True,
        pool_size=10,
        max_overflow=20,
    )

AsyncSessionLocal = async_sessionmaker(engine, expire_on_commit=False)

# Sync engine for Celery workers
if _is_sqlite:
    _sync_url = settings.database_url.replace("+aiosqlite", "")
    _sync_engine = create_engine(_sync_url, connect_args={"check_same_thread": False})
else:
    _sync_url = settings.database_url.replace("+asyncpg", "+psycopg2")
    _sync_engine = create_engine(_sync_url, pool_pre_ping=True, pool_size=5)
SyncSession = sessionmaker(_sync_engine, expire_on_commit=False)


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    async with AsyncSessionLocal() as session:
        yield session
