"""Market aggregates for the dashboard.

Computes every figure from the database when it holds data, and falls back to
the curated showcase dataset when it does not. Model accuracy is always read
from the deployed model's own report, never from the fallback.
"""

from __future__ import annotations

from typing import Any

from sqlalchemy import case, func, select
from sqlalchemy.orm import Session

from app.config import settings
from app.models.property import Property
from app.services import demo_data
from app.services.ml_service import ml_service

MONTH_NAMES = demo_data.MONTH_NAMES

# Upper bound of each price band, paired with the label the chart renders.
PRICE_BANDS: list[tuple[str, float, float]] = [
    ("<300k", 0, 300_000),
    ("300k", 300_000, 400_000),
    ("400k", 400_000, 500_000),
    ("500k", 500_000, 600_000),
    ("600k", 600_000, 750_000),
    ("750k", 750_000, 900_000),
    ("900k", 900_000, 1_200_000),
    ("1.2M", 1_200_000, 1_500_000),
    ("1.5M+", 1_500_000, float("inf")),
]

SCATTER_SAMPLE_SIZE = 400


def get_stats(db: Session) -> dict[str, Any]:
    """Return the full dashboard payload."""
    total = int(db.scalar(select(func.count(Property.id))) or 0)

    if total == 0 and settings.ENABLE_DEMO_FALLBACK:
        payload = demo_data.demo_stats()
    elif total == 0:
        payload = _empty_stats()
    else:
        payload = _database_stats(db, total)

    # Accuracy always describes the model that is actually loaded.
    payload["model_r2"] = ml_service.r2 if ml_service.is_loaded else 0.0
    payload["mae"] = ml_service.mae if ml_service.is_loaded else 0.0
    return payload


def _empty_stats() -> dict[str, Any]:
    return {
        "total_properties": 0,
        "avg_price": 0.0,
        "median_price": 0.0,
        "min_price": 0.0,
        "max_price": 0.0,
        "avg_price_by_bedrooms": [],
        "grade_breakdown": [],
        "monthly": [],
        "price_distribution": [],
        "scatter_sample": [],
        "waterfront_premium_percent": 0.0,
        "source": "database",
    }


def _database_stats(db: Session, total: int) -> dict[str, Any]:
    avg_price = float(db.scalar(select(func.avg(Property.price))) or 0)
    min_price = float(db.scalar(select(func.min(Property.price))) or 0)
    max_price = float(db.scalar(select(func.max(Property.price))) or 0)

    return {
        "total_properties": total,
        "avg_price": round(avg_price, 2),
        "median_price": _median_price(db, total),
        "min_price": min_price,
        "max_price": max_price,
        "avg_price_by_bedrooms": _by_bedrooms(db),
        "grade_breakdown": _by_grade(db),
        "monthly": _by_month(db),
        "price_distribution": _distribution(db),
        "scatter_sample": _scatter_sample(db, total),
        "waterfront_premium_percent": _waterfront_premium(db),
        "source": "database",
    }


def _median_price(db: Session, total: int) -> float:
    """True median via offset, rather than the hardcoded constant it replaces."""
    if total == 0:
        return 0.0
    offset = (total - 1) // 2
    lower = db.scalar(select(Property.price).order_by(Property.price).offset(offset).limit(1))
    if total % 2 == 1:
        return float(lower or 0)
    upper = db.scalar(
        select(Property.price).order_by(Property.price).offset(offset + 1).limit(1)
    )
    return round((float(lower or 0) + float(upper or lower or 0)) / 2, 2)


def _by_bedrooms(db: Session) -> list[dict[str, Any]]:
    rows = db.execute(
        select(
            Property.bedrooms,
            func.avg(Property.price).label("avg_price"),
            func.count(Property.id).label("count"),
        )
        .where(Property.bedrooms.between(1, 8))
        .group_by(Property.bedrooms)
        .order_by(Property.bedrooms)
    ).all()
    return [
        {"bedrooms": int(r.bedrooms), "avg_price": round(float(r.avg_price), 2), "count": int(r.count)}
        for r in rows
    ]


def _by_grade(db: Session) -> list[dict[str, Any]]:
    rows = db.execute(
        select(
            Property.grade,
            func.avg(Property.price).label("avg_price"),
            func.count(Property.id).label("count"),
        )
        .group_by(Property.grade)
        .order_by(Property.grade)
    ).all()
    return [
        {"grade": int(r.grade), "avg_price": round(float(r.avg_price), 2), "count": int(r.count)}
        for r in rows
    ]


def _by_month(db: Session) -> list[dict[str, Any]]:
    """Average price and sale volume per calendar month."""
    rows = db.execute(
        select(
            Property.month_sold,
            func.avg(Property.price).label("avg_price"),
            func.count(Property.id).label("volume"),
        )
        .where(Property.month_sold.isnot(None))
        .group_by(Property.month_sold)
        .order_by(Property.month_sold)
    ).all()

    return [
        {
            "month": MONTH_NAMES[int(r.month_sold) - 1],
            "month_number": int(r.month_sold),
            "avg_price": round(float(r.avg_price), 2),
            "volume": int(r.volume),
        }
        for r in rows
        if 1 <= int(r.month_sold) <= 12
    ]


def _distribution(db: Session) -> list[dict[str, Any]]:
    """Bucket sale prices into the dashboard's bands in a single query."""
    band_case = case(
        *[
            (Property.price < upper, label)
            for label, _lower, upper in PRICE_BANDS
            if upper != float("inf")
        ],
        else_=PRICE_BANDS[-1][0],
    )

    rows = db.execute(
        select(band_case.label("bucket"), func.count(Property.id).label("count")).group_by("bucket")
    ).all()
    counts = {row.bucket: int(row.count) for row in rows}

    return [
        {"bucket": label, "count": counts.get(label, 0), "floor": lower}
        for label, lower, _upper in PRICE_BANDS
    ]


def _scatter_sample(db: Session, total: int) -> list[dict[str, Any]]:
    """Evenly sample points for the price-vs-size scatter.

    Sampling every nth row by id keeps the payload small without biasing the
    shape of the cloud, and stays deterministic between requests.
    """
    step = max(1, total // SCATTER_SAMPLE_SIZE)
    rows = db.execute(
        select(Property.sqft_living, Property.price, Property.grade)
        .where(Property.id % step == 0)
        .limit(SCATTER_SAMPLE_SIZE)
    ).all()
    return [
        {"sqft_living": float(r.sqft_living), "price": float(r.price), "grade": int(r.grade)}
        for r in rows
    ]


def _waterfront_premium(db: Session) -> float:
    """Percentage premium waterfront homes command over inland homes."""
    rows = db.execute(
        select(Property.waterfront, func.avg(Property.price).label("avg_price"))
        .group_by(Property.waterfront)
    ).all()
    prices = {int(r.waterfront): float(r.avg_price) for r in rows}

    inland = prices.get(0)
    waterfront = prices.get(1)
    if not inland or not waterfront:
        return 0.0
    return round((waterfront / inland - 1) * 100, 1)
