"""SQLAlchemy engine, session factory, and schema bootstrap."""

from __future__ import annotations

from collections.abc import Iterator
from pathlib import Path

from sqlalchemy import create_engine, event
from sqlalchemy.engine import Engine
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from app.config import settings

_is_sqlite = settings.resolved_database_url.startswith("sqlite")

if _is_sqlite:
    # Create the parent directory for the database file up front, otherwise
    # the first connection fails on a clean checkout.
    db_file = settings.resolved_database_url.removeprefix("sqlite:///")
    Path(db_file).parent.mkdir(parents=True, exist_ok=True)

engine = create_engine(
    settings.resolved_database_url,
    # check_same_thread is a SQLite-only concern; FastAPI serves requests from
    # a threadpool, and each request gets its own short-lived session.
    connect_args={"check_same_thread": False} if _is_sqlite else {},
    pool_pre_ping=True,
    echo=False,
)


if _is_sqlite:

    @event.listens_for(Engine, "connect")
    def _set_sqlite_pragmas(dbapi_connection, _connection_record) -> None:
        """WAL keeps reads from blocking during a seed; the rest are hygiene."""
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA journal_mode=WAL")
        cursor.execute("PRAGMA synchronous=NORMAL")
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.close()


SessionLocal = sessionmaker(bind=engine, autocommit=False, autoflush=False, expire_on_commit=False)


class Base(DeclarativeBase):
    """Declarative base for all ORM models."""


def get_db() -> Iterator[Session]:
    """FastAPI dependency yielding a request-scoped session."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def create_tables() -> None:
    """Create any missing tables. Idempotent."""
    from app import models  # noqa: F401  (registers models on Base.metadata)

    Base.metadata.create_all(bind=engine)
