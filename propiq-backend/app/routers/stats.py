"""Market statistics endpoint."""

from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.config import settings
from app.database import get_db
from app.schemas.stats import StatsResponse
from app.services import stats_service

router = APIRouter(prefix=settings.API_PREFIX, tags=["Stats"])


@router.get("/stats", response_model=StatsResponse, summary="Aggregate market statistics")
def get_stats(db: Session = Depends(get_db)) -> StatsResponse:
    """Every aggregate the dashboard renders, in one round trip.

    Includes headline KPIs, price distribution, per-bedroom and per-grade
    breakdowns, monthly trend with sale volume, and a down-sampled scatter
    series. Model accuracy always reflects the deployed model.
    """
    return StatsResponse(**stats_service.get_stats(db))
