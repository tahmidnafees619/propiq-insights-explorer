"""Property queries, with a demo fallback when the database is empty."""

from __future__ import annotations

from typing import Any

from sqlalchemy import String, asc, desc, func, or_, select
from sqlalchemy.orm import Session

from app.config import settings
from app.exceptions import ResourceNotFoundError
from app.models.property import Property
from app.schemas.property import PropertyFilters
from app.services import demo_data


def _row_count(db: Session) -> int:
    return int(db.scalar(select(func.count(Property.id))) or 0)


def _use_demo(db: Session) -> bool:
    return settings.ENABLE_DEMO_FALLBACK and _row_count(db) == 0


def _apply_filters(stmt, filters: PropertyFilters):
    """Translate the filter set into SQL predicates."""
    conditions = []

    if filters.min_price is not None:
        conditions.append(Property.price >= filters.min_price)
    if filters.max_price is not None:
        conditions.append(Property.price <= filters.max_price)
    if filters.min_bedrooms is not None:
        conditions.append(Property.bedrooms >= filters.min_bedrooms)
    if filters.max_bedrooms is not None:
        conditions.append(Property.bedrooms <= filters.max_bedrooms)
    if filters.min_bathrooms is not None:
        conditions.append(Property.bathrooms >= filters.min_bathrooms)
    if filters.min_sqft is not None:
        conditions.append(Property.sqft_living >= filters.min_sqft)
    if filters.max_sqft is not None:
        conditions.append(Property.sqft_living <= filters.max_sqft)
    if filters.min_grade is not None:
        conditions.append(Property.grade >= filters.min_grade)
    if filters.max_grade is not None:
        conditions.append(Property.grade <= filters.max_grade)
    if filters.waterfront is not None:
        conditions.append(Property.waterfront == filters.waterfront)
    if filters.zipcode:
        conditions.append(Property.zipcode == filters.zipcode)

    if filters.search:
        raw = filters.search.strip()
        term = f"%{raw}%"
        # Free-text search covers zipcode plus the numeric columns a user is
        # most likely to type. Casting to CHAR keeps this portable across
        # SQLite and Postgres.
        search_conditions = [
            Property.zipcode.ilike(term),
            func.cast(Property.price, String).ilike(term),
            func.cast(Property.bedrooms, String).ilike(term),
        ]
        conditions.append(or_(*search_conditions))

    return stmt.where(*conditions) if conditions else stmt


def _apply_sort(stmt, filters: PropertyFilters):
    column = getattr(Property, filters.sort_by, Property.price)
    direction = asc if filters.sort_order == "asc" else desc
    # Tie-break on id so pagination is stable across pages.
    return stmt.order_by(direction(column), asc(Property.id))


def get_properties(db: Session, filters: PropertyFilters) -> dict[str, Any]:
    """Return one page of properties plus pagination metadata."""
    if _use_demo(db):
        return _demo_page(filters)

    base = _apply_filters(select(Property), filters)
    total = int(db.scalar(select(func.count()).select_from(base.subquery())) or 0)

    stmt = _apply_sort(base, filters).offset(filters.offset).limit(filters.limit)
    rows = list(db.scalars(stmt).all())

    return {
        "total": total,
        "limit": filters.limit,
        "offset": filters.offset,
        "count": len(rows),
        "has_more": filters.offset + len(rows) < total,
        "source": "database",
        "properties": rows,
    }


def _demo_page(filters: PropertyFilters) -> dict[str, Any]:
    """Apply the same filter, sort and pagination rules to the demo rows."""
    rows = list(demo_data.demo_properties())

    def keep(row: dict[str, Any]) -> bool:
        if filters.min_price is not None and row["price"] < filters.min_price:
            return False
        if filters.max_price is not None and row["price"] > filters.max_price:
            return False
        if filters.min_bedrooms is not None and row["bedrooms"] < filters.min_bedrooms:
            return False
        if filters.max_bedrooms is not None and row["bedrooms"] > filters.max_bedrooms:
            return False
        if filters.min_bathrooms is not None and row["bathrooms"] < filters.min_bathrooms:
            return False
        if filters.min_sqft is not None and row["sqft_living"] < filters.min_sqft:
            return False
        if filters.max_sqft is not None and row["sqft_living"] > filters.max_sqft:
            return False
        if filters.min_grade is not None and row["grade"] < filters.min_grade:
            return False
        if filters.max_grade is not None and row["grade"] > filters.max_grade:
            return False
        if filters.waterfront is not None and row["waterfront"] != filters.waterfront:
            return False
        if filters.zipcode and row["zipcode"] != filters.zipcode:
            return False
        if filters.search:
            term = filters.search.strip().lower()
            haystack = f"{row['zipcode']} {int(row['price'])} {row['bedrooms']}"
            if term not in haystack.lower():
                return False
        return True

    rows = [row for row in rows if keep(row)]
    rows.sort(
        key=lambda row: (row.get(filters.sort_by, 0), row["id"]),
        reverse=filters.sort_order == "desc",
    )

    total = len(rows)
    page = rows[filters.offset: filters.offset + filters.limit]

    return {
        "total": total,
        "limit": filters.limit,
        "offset": filters.offset,
        "count": len(page),
        "has_more": filters.offset + len(page) < total,
        "source": "demo",
        "properties": page,
    }


def get_property_by_id(db: Session, property_id: int) -> Any:
    """Fetch one property, raising a 404-mapped error when absent."""
    if _use_demo(db):
        for row in demo_data.demo_properties():
            if row["id"] == property_id:
                return row
        raise ResourceNotFoundError(f"No property with id {property_id}.")

    row = db.get(Property, property_id)
    if row is None:
        raise ResourceNotFoundError(f"No property with id {property_id}.")
    return row
