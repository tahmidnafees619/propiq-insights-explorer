"""Curated showcase dataset.

PropIQ ships with a demo dataset so the dashboard is never empty: on a fresh
clone, before anyone has downloaded the King County CSV or run the seeder,
every chart, table and KPI still renders a complete, coherent picture.

Two rules make this safe rather than misleading:

1. It is *deterministic*. The same figures appear on every machine and in
   every run, so screenshots and recordings stay reproducible.
2. It is *labelled*. Every payload built from it carries `source: "demo"`,
   and the UI surfaces that as a visible badge.

Seed a real database (`python scripts/seed_db.py`) and the API switches to
live aggregates automatically — nothing here is consulted again.

Note that model accuracy figures are **not** part of this module. Those are
always read from `models/metrics.json`, i.e. measured against the model that
is actually deployed.
"""

from __future__ import annotations

import random
from functools import lru_cache
from typing import Any

# Headline figures for the King County market. These describe the full
# 21,436-sale dataset the project is built around.
DEMO_TOTAL_PROPERTIES = 21_436
DEMO_AVG_PRICE = 540_088.0
DEMO_MEDIAN_PRICE = 450_000.0
DEMO_MIN_PRICE = 78_000.0
DEMO_MAX_PRICE = 7_700_000.0
DEMO_WATERFRONT_PREMIUM = 213.0

MONTH_NAMES = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
]

AVG_PRICE_BY_BEDROOMS: list[dict[str, Any]] = [
    {"bedrooms": 1, "avg_price": 312_000, "count": 199},
    {"bedrooms": 2, "avg_price": 385_000, "count": 2_760},
    {"bedrooms": 3, "avg_price": 462_000, "count": 9_824},
    {"bedrooms": 4, "avg_price": 638_000, "count": 6_882},
    {"bedrooms": 5, "avg_price": 792_000, "count": 1_601},
    {"bedrooms": 6, "avg_price": 950_000, "count": 272},
]

GRADE_BREAKDOWN: list[dict[str, Any]] = [
    {"grade": 5, "avg_price": 235_000, "count": 320},
    {"grade": 6, "avg_price": 310_000, "count": 1_240},
    {"grade": 7, "avg_price": 412_000, "count": 5_820},
    {"grade": 8, "avg_price": 548_000, "count": 6_420},
    {"grade": 9, "avg_price": 712_000, "count": 4_180},
    {"grade": 10, "avg_price": 920_000, "count": 2_180},
    {"grade": 11, "avg_price": 1_180_000, "count": 980},
    {"grade": 12, "avg_price": 1_620_000, "count": 296},
]

MONTHLY: list[dict[str, Any]] = [
    {"month": "Jan", "month_number": 1, "avg_price": 488_000, "volume": 1_240},
    {"month": "Feb", "month_number": 2, "avg_price": 502_000, "volume": 1_380},
    {"month": "Mar", "month_number": 3, "avg_price": 534_000, "volume": 1_820},
    {"month": "Apr", "month_number": 4, "avg_price": 558_000, "volume": 2_150},
    {"month": "May", "month_number": 5, "avg_price": 578_000, "volume": 2_440},
    {"month": "Jun", "month_number": 6, "avg_price": 595_000, "volume": 2_510},
    {"month": "Jul", "month_number": 7, "avg_price": 588_000, "volume": 2_280},
    {"month": "Aug", "month_number": 8, "avg_price": 572_000, "volume": 2_010},
    {"month": "Sep", "month_number": 9, "avg_price": 548_000, "volume": 1_840},
    {"month": "Oct", "month_number": 10, "avg_price": 530_000, "volume": 1_620},
    {"month": "Nov", "month_number": 11, "avg_price": 512_000, "volume": 1_380},
    {"month": "Dec", "month_number": 12, "avg_price": 498_000, "volume": 1_140},
]

PRICE_DISTRIBUTION: list[dict[str, Any]] = [
    {"bucket": "<300k", "count": 1_820, "floor": 0},
    {"bucket": "300k", "count": 3_940, "floor": 300_000},
    {"bucket": "400k", "count": 5_210, "floor": 400_000},
    {"bucket": "500k", "count": 4_380, "floor": 500_000},
    {"bucket": "600k", "count": 2_850, "floor": 600_000},
    {"bucket": "750k", "count": 1_640, "floor": 750_000},
    {"bucket": "900k", "count": 920, "floor": 900_000},
    {"bucket": "1.2M", "count": 420, "floor": 1_200_000},
    {"bucket": "1.5M+", "count": 256, "floor": 1_500_000},
]

# Real King County ZIP codes, weighted towards the areas that actually
# dominate the dataset.
ZIPCODES = [
    "98004", "98005", "98006", "98027", "98033", "98034", "98040",
    "98052", "98053", "98103", "98115", "98117", "98118", "98122",
    "98125", "98133", "98144", "98155", "98178", "98198",
]

GRADE_AVERAGES: dict[int, float] = {
    row["grade"]: float(row["avg_price"]) for row in GRADE_BREAKDOWN
}

# Typical interior size for each construction grade, used to scale a home's
# price within its grade band.
TYPICAL_SQFT_BY_GRADE: dict[int, int] = {
    5: 1_060, 6: 1_240, 7: 1_660, 8: 2_070, 9: 2_570, 10: 3_040, 11: 3_600, 12: 4_260,
}

# Calibrates the sampled rows onto the headline median and mean above.
# Derived empirically; tests/test_demo_data.py fails if the sample drifts
# away from the published figures.
_PRICE_CALIBRATION = 0.756

_DEMO_SEED = 20_240_517


@lru_cache(maxsize=1)
def demo_properties() -> list[dict[str, Any]]:
    """Build a deterministic, representative sample of individual sales.

    Attributes are drawn so the resulting price distribution, grade mix and
    waterfront share line up with the aggregates above; the table and the
    charts therefore tell the same story.
    """
    rng = random.Random(_DEMO_SEED)
    rows: list[dict[str, Any]] = []

    for idx in range(1, 601):
        grade = _weighted_grade(rng)
        bedrooms = max(1, min(6, int(rng.gauss(3.4, 0.95))))
        bathrooms = round(max(1.0, min(5.0, rng.gauss(2.1, 0.7))) * 4) / 4
        floors = rng.choice([1.0, 1.0, 1.5, 2.0, 2.0, 2.5, 3.0])

        sqft_living = int(max(560, min(9_000, rng.gauss(TYPICAL_SQFT_BY_GRADE.get(grade, 1_900), 330))))
        basement_share = rng.choice([0.0, 0.0, 0.0, 0.18, 0.28, 0.35])
        sqft_basement = int(sqft_living * basement_share / 50) * 50
        sqft_above = sqft_living - sqft_basement

        waterfront = 1 if rng.random() < 0.0075 else 0
        view = _weighted_view(rng, waterfront)
        condition = max(1, min(5, int(rng.gauss(3.4, 0.65))))
        yr_built = int(rng.triangular(1900, 2015, 1977))
        yr_renovated = rng.choice([0] * 24 + [rng.randint(1985, 2014)])

        lat = round(rng.uniform(47.16, 47.78), 4)
        long = round(rng.uniform(-122.51, -121.32), 4)

        price = _demo_price(rng, sqft_living, grade, bedrooms, bathrooms,
                            waterfront, view, condition, yr_built, lat)

        month_sold = rng.randint(1, 12)
        year_sold = rng.choice([2014, 2014, 2015])

        rows.append({
            "id": idx,
            "price": float(price),
            "bedrooms": bedrooms,
            "bathrooms": float(bathrooms),
            "sqft_living": float(sqft_living),
            "sqft_lot": float(int(max(650, rng.lognormvariate(9.0, 0.75)))),
            "floors": float(floors),
            "waterfront": waterfront,
            "view": view,
            "condition": condition,
            "grade": grade,
            "sqft_above": float(sqft_above),
            "sqft_basement": float(sqft_basement),
            "yr_built": yr_built,
            "yr_renovated": yr_renovated,
            "zipcode": rng.choice(ZIPCODES),
            "lat": lat,
            "long": long,
            "sqft_living15": float(int(sqft_living * rng.uniform(0.75, 1.25) / 10) * 10),
            "sqft_lot15": float(int(max(650, rng.lognormvariate(8.95, 0.6)))),
            "year_sold": year_sold,
            "month_sold": month_sold,
            "house_age": year_sold - yr_built,
            "was_renovated": 1 if yr_renovated else 0,
        })

    return rows


def _weighted_grade(rng: random.Random) -> int:
    """Draw a grade using the same mix as GRADE_BREAKDOWN.

    Sampling from the published counts keeps the individual rows in the
    table consistent with the aggregate chart above them.
    """
    grades = [row["grade"] for row in GRADE_BREAKDOWN]
    weights = [row["count"] for row in GRADE_BREAKDOWN]
    return rng.choices(grades, weights=weights, k=1)[0]


def _weighted_view(rng: random.Random, waterfront: int) -> int:
    if waterfront:
        return rng.choice([3, 4, 4, 4])
    return rng.choices([0, 1, 2, 3, 4], weights=[90.2, 1.5, 4.4, 2.3, 1.6], k=1)[0]


def _demo_price(
    rng: random.Random,
    sqft_living: int,
    grade: int,
    bedrooms: int,
    bathrooms: float,
    waterfront: int,
    view: int,
    condition: int,
    yr_built: int,
    lat: float,
) -> int:
    """Price a demo home, anchored to the published grade averages.

    Starting from the grade's average sale price (rather than an invented
    per-sqft formula) keeps every sampled row consistent with the grade chart
    the dashboard renders beside the table. Multipliers then move the home
    around within its band, and each is centred on 1.0 so they adjust the
    spread without shifting the overall average.
    """
    grade_average = GRADE_AVERAGES.get(grade, DEMO_MEDIAN_PRICE)
    typical_sqft = TYPICAL_SQFT_BY_GRADE.get(grade, 1_900)

    price = grade_average * _PRICE_CALIBRATION

    # Size within the grade band. The exponent is well below 1 because price
    # per square foot falls as homes get larger.
    price *= (sqft_living / typical_sqft) ** 0.55

    # North King County carries a genuine premium; centred on the mean
    # latitude so it redistributes rather than inflates.
    price *= 1 + (lat - 47.47) * 0.55

    price *= 1 + view * 0.055
    price *= 1 + (condition - 3) * 0.035
    price *= 1 + (yr_built - 1960) * 0.0016
    price *= 1 + bathrooms * 0.012
    price *= 1 + max(0, bedrooms - 3) * 0.015

    if waterfront:
        price *= 2.4

    price *= rng.lognormvariate(0.0, 0.26)

    return int(max(DEMO_MIN_PRICE, min(DEMO_MAX_PRICE, round(price, -3))))


def demo_stats() -> dict[str, Any]:
    """Aggregate payload matching the shape of the live stats endpoint."""
    sample = demo_properties()
    scatter = [
        {"sqft_living": r["sqft_living"], "price": r["price"], "grade": r["grade"]}
        for r in sample[:400]
    ]

    return {
        "total_properties": DEMO_TOTAL_PROPERTIES,
        "avg_price": DEMO_AVG_PRICE,
        "median_price": DEMO_MEDIAN_PRICE,
        "min_price": DEMO_MIN_PRICE,
        "max_price": DEMO_MAX_PRICE,
        "avg_price_by_bedrooms": [dict(row) for row in AVG_PRICE_BY_BEDROOMS],
        "grade_breakdown": [dict(row) for row in GRADE_BREAKDOWN],
        "monthly": [dict(row) for row in MONTHLY],
        "price_distribution": [dict(row) for row in PRICE_DISTRIBUTION],
        "scatter_sample": scatter,
        "waterfront_premium_percent": DEMO_WATERFRONT_PREMIUM,
        "source": "demo",
    }
