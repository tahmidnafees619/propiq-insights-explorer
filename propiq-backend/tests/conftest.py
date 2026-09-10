"""Shared pytest fixtures.

Every test runs against a throwaway SQLite database so the developer's real
data/propiq.db is never read or written.
"""

from __future__ import annotations

from collections.abc import Iterator

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from app.database import Base, get_db
from app.main import app
from app.models.property import Property

# StaticPool keeps a single in-memory connection alive across sessions, so
# tables created in a fixture are visible to the request handlers.
TEST_ENGINE = create_engine(
    "sqlite://",
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestSession = sessionmaker(bind=TEST_ENGINE, autocommit=False, autoflush=False)


@pytest.fixture(autouse=True)
def _fresh_schema() -> Iterator[None]:
    Base.metadata.create_all(bind=TEST_ENGINE)
    yield
    Base.metadata.drop_all(bind=TEST_ENGINE)


@pytest.fixture
def db_session() -> Iterator[Session]:
    session = TestSession()
    try:
        yield session
    finally:
        session.close()


@pytest.fixture
def client() -> Iterator[TestClient]:
    """A client backed by the empty test database (so demo fallback applies)."""

    def _override_get_db() -> Iterator[Session]:
        session = TestSession()
        try:
            yield session
        finally:
            session.close()

    app.dependency_overrides[get_db] = _override_get_db
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()


@pytest.fixture
def seeded_client(client: TestClient, db_session: Session) -> TestClient:
    """A client whose database holds a small, known set of properties."""
    db_session.add_all(_sample_properties())
    db_session.commit()
    return client


def _sample_properties() -> list[Property]:
    """Six rows with hand-checkable aggregates.

    Prices are 200k/300k/400k/500k/600k/1.4M: mean 566,666.67, median 450,000.
    """
    specs = [
        # price, beds, grade, waterfront, month, zipcode
        (200_000, 2, 6, 0, 1, "98178"),
        (300_000, 3, 7, 0, 3, "98115"),
        (400_000, 3, 7, 0, 3, "98115"),
        (500_000, 4, 8, 0, 6, "98052"),
        (600_000, 4, 9, 0, 6, "98052"),
        (1_400_000, 5, 11, 1, 9, "98004"),
    ]
    rows: list[Property] = []
    for index, (price, beds, grade, waterfront, month, zipcode) in enumerate(specs, start=1):
        rows.append(
            Property(
                id=index,
                price=float(price),
                bedrooms=beds,
                bathrooms=float(beds) - 0.5,
                sqft_living=800.0 + grade * 200,
                sqft_lot=5_000.0,
                floors=1.0,
                waterfront=waterfront,
                view=4 if waterfront else 0,
                condition=3,
                grade=grade,
                sqft_above=800.0 + grade * 200,
                sqft_basement=0.0,
                yr_built=1990,
                yr_renovated=0,
                zipcode=zipcode,
                lat=47.5,
                long=-122.2,
                sqft_living15=1_800.0,
                sqft_lot15=5_000.0,
                year_sold=2015,
                month_sold=month,
                house_age=25,
                was_renovated=0,
            )
        )
    return rows


@pytest.fixture
def valid_payload() -> dict:
    """A well-formed prediction request."""
    return {
        "sqft_living": 2200,
        "sqft_lot": 7500,
        "bedrooms": 3,
        "bathrooms": 2.5,
        "floors": 2,
        "waterfront": 0,
        "view": 0,
        "condition": 3,
        "grade": 8,
        "sqft_above": 1800,
        "sqft_basement": 400,
        "yr_built": 1995,
        "sqft_living15": 2100,
        "sqft_lot15": 7500,
        "lat": 47.5112,
        "long": -122.257,
    }
