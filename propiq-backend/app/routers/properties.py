"""Property listing and detail endpoints."""

from __future__ import annotations

from fastapi import APIRouter, Depends, Path, Query
from sqlalchemy.orm import Session

from app.config import settings
from app.database import get_db
from app.schemas.common import ErrorResponse
from app.schemas.property import (
    PropertyFilters,
    PropertyListResponse,
    PropertyResponse,
    SortField,
    SortOrder,
)
from app.services import property_service

router = APIRouter(prefix=f"{settings.API_PREFIX}/properties", tags=["Properties"])


@router.get(
    "",
    response_model=PropertyListResponse,
    summary="List properties",
)
def list_properties(
    limit: int = Query(100, ge=1, le=1000, description="Rows per page"),
    offset: int = Query(0, ge=0, description="Rows to skip"),
    min_price: float | None = Query(None, ge=0),
    max_price: float | None = Query(None, ge=0),
    min_bedrooms: int | None = Query(None, ge=0, le=15),
    max_bedrooms: int | None = Query(None, ge=0, le=15),
    min_bathrooms: float | None = Query(None, ge=0, le=10),
    min_sqft: float | None = Query(None, ge=0),
    max_sqft: float | None = Query(None, ge=0),
    min_grade: int | None = Query(None, ge=1, le=13),
    max_grade: int | None = Query(None, ge=1, le=13),
    waterfront: int | None = Query(None, ge=0, le=1),
    zipcode: str | None = Query(None, max_length=10),
    search: str | None = Query(None, max_length=64, description="Free text over zipcode, price, bedrooms"),
    sort_by: SortField = Query("price"),
    sort_order: SortOrder = Query("desc"),
    db: Session = Depends(get_db),
) -> PropertyListResponse:
    """Return a filtered, sorted page of property sales.

    When the database has not been seeded, the curated demo dataset is served
    instead and `source` is set to `"demo"`.
    """
    filters = PropertyFilters(
        limit=limit,
        offset=offset,
        min_price=min_price,
        max_price=max_price,
        min_bedrooms=min_bedrooms,
        max_bedrooms=max_bedrooms,
        min_bathrooms=min_bathrooms,
        min_sqft=min_sqft,
        max_sqft=max_sqft,
        min_grade=min_grade,
        max_grade=max_grade,
        waterfront=waterfront,
        zipcode=zipcode,
        search=search,
        sort_by=sort_by,
        sort_order=sort_order,
    )
    return PropertyListResponse(**property_service.get_properties(db, filters))


@router.get(
    "/{property_id}",
    response_model=PropertyResponse,
    responses={404: {"model": ErrorResponse, "description": "Property not found"}},
    summary="Fetch a single property",
)
def get_property(
    property_id: int = Path(..., ge=1, description="Property id"),
    db: Session = Depends(get_db),
) -> PropertyResponse:
    """Return one property by id."""
    record = property_service.get_property_by_id(db, property_id)
    return PropertyResponse.model_validate(record)
