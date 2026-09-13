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


# Per-ZIP aggregates for the choropleth, derived from the same King County
# dataset the published figures come from, so demo mode and live mode shade
# the map identically. Counts are rescaled to sum to DEMO_TOTAL_PROPERTIES.
# (zipcode, median_price, avg_price, price_per_sqft, sale_count)
_ZIPCODE_ROWS: list[tuple[str, float, float, float, int]] = [
    ("98001", 260000.0, 281194.9, 151.3, 358),
    ("98002", 235000.0, 234284.0, 151.2, 197),
    ("98003", 267475.0, 294111.3, 157.1, 278),
    ("98004", 1150000.0, 1355927.1, 475.4, 315),
    ("98005", 765475.0, 810164.9, 314.9, 167),
    ("98006", 760184.5, 859684.8, 299.1, 494),
    ("98007", 555000.0, 617105.1, 290.1, 140),
    ("98008", 545000.0, 645507.4, 301.7, 281),
    ("98010", 359999.5, 423666.0, 210.1, 99),
    ("98011", 470000.0, 490351.5, 226.0, 193),
    ("98014", 415000.0, 455617.1, 223.1, 123),
    ("98019", 401250.0, 424788.8, 203.0, 189),
    ("98022", 279500.0, 315709.3, 181.8, 232),
    ("98023", 268450.0, 286732.8, 148.9, 495),
    ("98024", 462500.0, 586008.4, 252.3, 79),
    ("98027", 570500.0, 616990.6, 251.6, 409),
    ("98028", 445000.0, 462480.0, 225.1, 281),
    ("98029", 575000.0, 612653.6, 272.1, 319),
    ("98030", 282255.0, 296188.0, 155.2, 254),
    ("98031", 288000.0, 300340.4, 161.1, 271),
    ("98032", 249000.0, 251296.2, 154.2, 124),
    ("98033", 678350.0, 803719.5, 343.2, 429),
    ("98034", 445950.0, 521652.9, 265.9, 541),
    ("98038", 342000.0, 367083.0, 173.7, 585),
    ("98039", 1892500.0, 2160606.6, 568.1, 50),
    ("98040", 993750.0, 1194230.0, 387.3, 280),
    ("98042", 291500.0, 311580.3, 164.4, 543),
    ("98045", 399500.0, 439471.1, 220.5, 219),
    ("98052", 615000.0, 645231.5, 280.4, 570),
    ("98053", 634900.0, 676634.6, 269.5, 401),
    ("98055", 294950.0, 304262.1, 180.4, 266),
    ("98056", 380000.0, 420890.5, 215.5, 403),
    ("98058", 335000.0, 353608.6, 178.2, 452),
    ("98059", 435000.0, 493552.5, 207.2, 464),
    ("98065", 502500.0, 529587.6, 211.0, 306),
    ("98070", 465000.0, 489381.2, 277.9, 116),
    ("98072", 515000.0, 569958.5, 247.5, 271),
    ("98074", 642000.0, 685605.8, 265.7, 438),
    ("98075", 739999.0, 790576.7, 268.6, 356),
    ("98077", 652475.0, 682774.9, 244.3, 196),
    ("98092", 309780.0, 334921.1, 155.8, 348),
    ("98102", 710000.0, 899395.4, 423.8, 103),
    ("98103", 550000.0, 584827.6, 369.8, 596),
    ("98105", 675000.0, 862825.2, 405.1, 227),
    ("98106", 315000.0, 319581.4, 231.3, 332),
    ("98107", 529950.0, 579053.4, 382.9, 264),
    ("98108", 342500.0, 355678.5, 224.4, 185),
    ("98109", 736000.0, 879623.6, 433.4, 108),
    ("98112", 915000.0, 1095499.3, 438.6, 267),
    ("98115", 567000.0, 619900.6, 354.1, 579),
    ("98116", 562750.0, 618634.2, 348.6, 327),
    ("98117", 544000.0, 576795.0, 363.5, 549),
    ("98118", 367500.0, 418011.5, 262.6, 503),
    ("98119", 744975.0, 849448.0, 432.3, 183),
    ("98122", 572000.0, 634360.2, 367.5, 288),
    ("98125", 425000.0, 469899.4, 282.7, 406),
    ("98126", 395750.0, 424706.4, 292.8, 351),
    ("98133", 375000.0, 387011.6, 254.0, 489),
    ("98136", 489950.0, 551688.7, 337.2, 261),
    ("98144", 450000.0, 594547.7, 312.2, 340),
    ("98146", 305000.0, 359483.2, 225.5, 286),
    ("98148", 278000.0, 284908.6, 185.8, 57),
    ("98155", 375000.0, 423725.7, 246.5, 443),
    ("98166", 390000.0, 464231.8, 226.2, 252),
    ("98168", 235000.0, 240328.4, 175.4, 267),
    ("98177", 554000.0, 676185.4, 292.9, 253),
    ("98178", 278277.0, 310612.8, 189.2, 260),
    ("98188", 264000.0, 289078.3, 169.0, 135),
    ("98198", 265000.0, 302878.9, 178.4, 278),
    ("98199", 689800.0, 791820.8, 376.6, 315),
]


def demo_zipcode_stats() -> list[dict[str, Any]]:
    """Per-ZIP aggregates matching the published dataset."""
    return [
        {
            "zipcode": zipcode,
            "median_price": median,
            "avg_price": avg,
            "price_per_sqft": ppsf,
            "count": count,
        }
        for zipcode, median, avg, ppsf, count in _ZIPCODE_ROWS
    ]
