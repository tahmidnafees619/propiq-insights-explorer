"""Comparable sales for a subject property.

Agents price homes against recent nearby sales, not against feature
importances, so every estimate ships with the most similar real transactions
we hold. Selection mirrors how a CMA is actually built: nearby first, then
similar in size, build quality and room count.

Showing comps alongside the model's number is also the cheapest honesty check
available — if the estimate lands outside the range comparable homes actually
sold for, the reader can see that for themselves.
"""

from __future__ import annotations

import math
from typing import Any

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.config import settings
from app.models.property import Property
from app.services import demo_data

MAX_RESULTS = 5

# Widening passes: search tight first, relax only if that comes up short.
# (radius_miles, sqft_tolerance, grade_tolerance)
_SEARCH_PASSES: tuple[tuple[float, float, int], ...] = (
    (2.0, 0.25, 1),
    (5.0, 0.40, 2),
    (15.0, 0.60, 3),
)

# Similarity weights. Distance dominates because location is the model's
# strongest signal, and proximity is what an agent defends first.
_W_DISTANCE = 0.40
_W_SIZE = 0.30
_W_GRADE = 0.20
_W_ROOMS = 0.10

_MILES_PER_DEGREE_LAT = 69.0
_EARTH_RADIUS_MILES = 3958.8

# Candidate cap per pass. Scoring is cheap, but there is no point ranking
# thousands of rows to return five.
_CANDIDATE_LIMIT = 400

_COMP_FIELDS = (
    "id", "price", "bedrooms", "bathrooms", "sqft_living", "grade",
    "yr_built", "zipcode", "lat", "long", "waterfront", "year_sold", "month_sold",
)


def haversine_miles(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Great-circle distance in miles."""
    d_lat = math.radians(lat2 - lat1)
    d_lon = math.radians(lon2 - lon1)
    a = (
        math.sin(d_lat / 2) ** 2
        + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(d_lon / 2) ** 2
    )
    return 2 * _EARTH_RADIUS_MILES * math.asin(min(1.0, math.sqrt(a)))


def find_comparables(db: Session, subject: dict[str, Any]) -> tuple[list[dict[str, Any]], str]:
    """Return the closest matches to `subject`, plus the source they came from."""
    total = int(db.scalar(select(func.count(Property.id))) or 0)

    if total:
        pool, source = None, "database"
    elif settings.ENABLE_DEMO_FALLBACK:
        pool, source = demo_data.demo_properties(), "demo"
    else:
        return [], "database"

    rows: list[dict[str, Any]] = []
    radius = _SEARCH_PASSES[-1][0]

    for pass_radius, sqft_tolerance, grade_tolerance in _SEARCH_PASSES:
        radius = pass_radius
        rows = (
            _filter_rows(pool, subject, pass_radius, sqft_tolerance, grade_tolerance)
            if pool is not None
            else _query_rows(db, subject, pass_radius, sqft_tolerance, grade_tolerance)
        )
        if len(rows) >= MAX_RESULTS:
            break

    scored = [_score(subject, row, radius) for row in rows]
    scored.sort(key=lambda comp: comp["similarity"], reverse=True)
    return scored[:MAX_RESULTS], source


def summarise(comparables: list[dict[str, Any]], estimate: float, source: str) -> dict[str, Any]:
    """Fold the comps into the headline the UI puts next to the estimate."""
    prices = sorted(comp["price"] for comp in comparables)
    middle = len(prices) // 2
    median = (
        prices[middle]
        if len(prices) % 2
        else (prices[middle - 1] + prices[middle]) / 2
    )

    return {
        "count": len(prices),
        "low_price": prices[0],
        "high_price": prices[-1],
        "median_price": median,
        # The trust signal: does the model agree with what actually sold?
        "estimate_within_range": prices[0] <= estimate <= prices[-1],
        "source": source,
    }


def _query_rows(
    db: Session,
    subject: dict[str, Any],
    radius: float,
    sqft_tolerance: float,
    grade_tolerance: int,
) -> list[dict[str, Any]]:
    """Bounding-box prefilter in SQL; exact distance is scored in Python."""
    lat = float(subject["lat"])
    lon = float(subject["long"])
    sqft = float(subject["sqft_living"])
    grade = int(subject["grade"])

    lat_delta, lon_delta = _bounding_deltas(lat, radius)

    stmt = (
        select(Property)
        .where(
            Property.lat.between(lat - lat_delta, lat + lat_delta),
            Property.long.between(lon - lon_delta, lon + lon_delta),
            Property.sqft_living.between(
                sqft * (1 - sqft_tolerance), sqft * (1 + sqft_tolerance)
            ),
            Property.grade.between(grade - grade_tolerance, grade + grade_tolerance),
            # Never compare across the waterfront line. It carries a ~213%
            # premium in this dataset, so a mixed set would make the range
            # meaningless in whichever direction it was mixed.
            Property.waterfront == int(subject.get("waterfront", 0)),
        )
        .limit(_CANDIDATE_LIMIT)
    )

    return [{field: getattr(row, field) for field in _COMP_FIELDS} for row in db.scalars(stmt)]


def _filter_rows(
    pool: list[dict[str, Any]],
    subject: dict[str, Any],
    radius: float,
    sqft_tolerance: float,
    grade_tolerance: int,
) -> list[dict[str, Any]]:
    """Same predicate as `_query_rows`, applied to the bundled dataset."""
    lat = float(subject["lat"])
    lon = float(subject["long"])
    sqft = float(subject["sqft_living"])
    grade = int(subject["grade"])

    lat_delta, lon_delta = _bounding_deltas(lat, radius)
    low_sqft, high_sqft = sqft * (1 - sqft_tolerance), sqft * (1 + sqft_tolerance)
    waterfront = int(subject.get("waterfront", 0))

    matches = [
        row
        for row in pool
        if abs(row["lat"] - lat) <= lat_delta
        and abs(row["long"] - lon) <= lon_delta
        and low_sqft <= row["sqft_living"] <= high_sqft
        and abs(row["grade"] - grade) <= grade_tolerance
        and int(row["waterfront"]) == waterfront
    ]
    return [{field: row[field] for field in _COMP_FIELDS} for row in matches[:_CANDIDATE_LIMIT]]


def _bounding_deltas(lat: float, radius: float) -> tuple[float, float]:
    """Degrees of latitude and longitude covering `radius` miles at `lat`."""
    lat_delta = radius / _MILES_PER_DEGREE_LAT
    # A degree of longitude narrows toward the poles; clamp so the divisor
    # cannot collapse near them.
    shrink = max(math.cos(math.radians(lat)), 0.1)
    return lat_delta, radius / (_MILES_PER_DEGREE_LAT * shrink)


def _score(subject: dict[str, Any], row: dict[str, Any], radius: float) -> dict[str, Any]:
    """Attach distance and a 0-100 similarity score to one candidate."""
    distance = haversine_miles(
        float(subject["lat"]), float(subject["long"]), float(row["lat"]), float(row["long"])
    )

    sqft = max(float(subject["sqft_living"]), 1.0)
    rooms_delta = abs(row["bedrooms"] - subject["bedrooms"]) + abs(
        float(row["bathrooms"]) - float(subject["bathrooms"])
    )

    similarity = (
        _W_DISTANCE * (1 - min(distance / radius, 1.0))
        + _W_SIZE * (1 - min(abs(float(row["sqft_living"]) - sqft) / sqft, 1.0))
        + _W_GRADE * (1 - min(abs(row["grade"] - subject["grade"]) / 4, 1.0))
        + _W_ROOMS * (1 - min(rooms_delta / 6, 1.0))
    )

    living = max(float(row["sqft_living"]), 1.0)

    return {
        "id": int(row["id"]),
        "price": float(row["price"]),
        "price_formatted": f"${float(row['price']):,.0f}",
        "bedrooms": int(row["bedrooms"]),
        "bathrooms": float(row["bathrooms"]),
        "sqft_living": float(row["sqft_living"]),
        "grade": int(row["grade"]),
        "yr_built": int(row["yr_built"]),
        "zipcode": row["zipcode"],
        "lat": float(row["lat"]),
        "long": float(row["long"]),
        "waterfront": int(row["waterfront"]),
        "distance_miles": round(distance, 2),
        "similarity": round(similarity * 100, 1),
        "price_per_sqft": round(float(row["price"]) / living, 2),
        "sold": _format_sold(row.get("year_sold"), row.get("month_sold")),
    }


def _format_sold(year: int | None, month: int | None) -> str | None:
    """Render the sale date, e.g. 'Mar 2015'. Comps are dated deliberately."""
    if not year:
        return None
    if not month or not 1 <= int(month) <= 12:
        return str(int(year))
    return f"{demo_data.MONTH_NAMES[int(month) - 1]} {int(year)}"
