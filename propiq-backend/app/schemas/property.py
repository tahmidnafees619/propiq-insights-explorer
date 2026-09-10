"""Request and response models for the property endpoints."""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

SortField = Literal[
    "price", "sqft_living", "sqft_lot", "bedrooms", "bathrooms",
    "grade", "condition", "yr_built", "id",
]
SortOrder = Literal["asc", "desc"]


class PropertyBase(BaseModel):
    price: float
    bedrooms: int
    bathrooms: float
    sqft_living: float
    sqft_lot: float
    floors: float
    waterfront: int
    view: int
    condition: int
    grade: int
    sqft_above: float
    sqft_basement: float
    yr_built: int
    yr_renovated: int = 0
    zipcode: str | None = None
    lat: float
    long: float
    sqft_living15: float
    sqft_lot15: float
    year_sold: int | None = None
    month_sold: int | None = None
    house_age: int | None = None
    was_renovated: int | None = None


class PropertyResponse(PropertyBase):
    model_config = ConfigDict(from_attributes=True)

    id: int


class PropertyListResponse(BaseModel):
    """A page of properties plus the metadata a table needs to paginate."""

    total: int = Field(..., description="Matching rows before pagination")
    limit: int
    offset: int
    count: int = Field(..., description="Rows in this page")
    has_more: bool
    source: Literal["database", "demo"] = Field(
        "database",
        description="'demo' when the curated showcase dataset is being served.",
    )
    properties: list[PropertyResponse]


class PropertyFilters(BaseModel):
    """Normalised filter set shared by the router and the service layer."""

    limit: int = 500
    offset: int = 0
    min_price: float | None = None
    max_price: float | None = None
    min_bedrooms: int | None = None
    max_bedrooms: int | None = None
    min_bathrooms: float | None = None
    min_sqft: float | None = None
    max_sqft: float | None = None
    min_grade: int | None = None
    max_grade: int | None = None
    waterfront: int | None = None
    zipcode: str | None = None
    search: str | None = None
    sort_by: SortField = "price"
    sort_order: SortOrder = "desc"
