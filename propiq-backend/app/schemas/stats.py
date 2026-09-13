"""Response models for the market statistics endpoint.

The field names here match the `StatsResponse` interface the dashboard
consumes, so the API and the UI share one contract.
"""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


class BedroomStat(BaseModel):
    bedrooms: int
    avg_price: float
    count: int = 0


class GradeStat(BaseModel):
    grade: int
    avg_price: float
    count: int = 0


class MonthlyStat(BaseModel):
    month: str = Field(..., description="Three-letter month abbreviation, e.g. 'Mar'")
    month_number: int
    avg_price: float
    volume: int = Field(..., description="Number of sales closed that month")


class PriceBucket(BaseModel):
    bucket: str = Field(..., description="Human-readable band label, e.g. '400k'")
    count: int
    floor: float = Field(..., description="Inclusive lower bound of the band, in dollars")


class ScatterPoint(BaseModel):
    sqft_living: float
    price: float
    grade: int


class StatsResponse(BaseModel):
    model_config = ConfigDict(protected_namespaces=())

    total_properties: int
    avg_price: float
    median_price: float
    min_price: float
    max_price: float

    # Published model accuracy, sourced from models/metrics.json.
    model_r2: float
    mae: float

    avg_price_by_bedrooms: list[BedroomStat]
    grade_breakdown: list[GradeStat]
    monthly: list[MonthlyStat]
    price_distribution: list[PriceBucket]
    scatter_sample: list[ScatterPoint] = Field(
        default_factory=list,
        description="Down-sampled price/sqft points for the scatter chart.",
    )

    waterfront_premium_percent: float = Field(
        0.0, description="How much more waterfront homes sell for, in percent"
    )
    source: Literal["database", "demo"] = "database"


class ZipcodeStat(BaseModel):
    """Aggregates for a single ZIP code, used to shade the choropleth."""

    zipcode: str
    median_price: float
    avg_price: float
    price_per_sqft: float
    count: int = Field(..., description="Sales recorded in this ZIP code")


class ZipcodeStatsResponse(BaseModel):
    """Per-ZIP aggregates plus the bounds the colour scale needs.

    Returning the extremes here keeps the frontend from having to re-derive
    them, and guarantees the legend matches the shading exactly.
    """

    zipcodes: list[ZipcodeStat]
    min_median: float = Field(..., description="Lowest ZIP median, for the colour scale")
    max_median: float = Field(..., description="Highest ZIP median, for the colour scale")
    source: Literal["database", "demo"] = "database"
