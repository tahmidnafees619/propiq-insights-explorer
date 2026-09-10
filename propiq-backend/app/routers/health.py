"""Health and service-metadata endpoints."""

from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.config import settings
from app.database import get_db
from app.logging_config import get_logger
from app.models.property import Property
from app.schemas.common import HealthResponse, RootResponse

logger = get_logger(__name__)
router = APIRouter(tags=["System"])


@router.get("/", response_model=RootResponse, summary="Service index")
def root() -> RootResponse:
    """Point callers at the docs instead of returning a bare 404."""
    return RootResponse(
        name=settings.APP_NAME,
        version=settings.APP_VERSION,
        description="Real Estate Market Intelligence API for King County, WA.",
        docs="/docs",
        health=f"{settings.API_PREFIX}/health",
        endpoints={
            "health": f"{settings.API_PREFIX}/health",
            "predict": f"{settings.API_PREFIX}/predict",
            "feature_importance": f"{settings.API_PREFIX}/feature-importance",
            "model_metrics": f"{settings.API_PREFIX}/model/metrics",
            "properties": f"{settings.API_PREFIX}/properties",
            "stats": f"{settings.API_PREFIX}/stats",
        },
    )


@router.get(f"{settings.API_PREFIX}/health", response_model=HealthResponse, summary="Health check")
def health_check(db: Session = Depends(get_db)) -> HealthResponse:
    """Report whether the model and database are ready to serve traffic.

    Returns 200 with `status: "degraded"` rather than an error status when a
    dependency is down, so a load balancer keeps routing to the instance
    while the read-only endpoints still work.
    """
    from app.services.ml_service import ml_service

    database_connected = True
    property_count = 0
    try:
        property_count = int(db.scalar(select(func.count(Property.id))) or 0)
    except Exception:
        database_connected = False
        logger.exception("health check: database query failed")

    using_demo = property_count == 0 and settings.ENABLE_DEMO_FALLBACK
    healthy = ml_service.is_loaded and database_connected

    if not database_connected:
        message = "Database unreachable."
    elif not ml_service.is_loaded:
        message = "Model artifacts missing. Run: python scripts/train_model.py"
    elif using_demo:
        message = "Serving the curated demo dataset. Run: python scripts/seed_db.py"
    else:
        message = "All systems operational."

    return HealthResponse(
        status="ok" if healthy else "degraded",
        app=settings.APP_NAME,
        version=settings.APP_VERSION,
        environment="development" if settings.DEBUG else "production",
        model_loaded=ml_service.is_loaded,
        model_name=ml_service.model_name if ml_service.is_loaded else None,
        model_r2=ml_service.r2 if ml_service.is_loaded else None,
        database_connected=database_connected,
        property_count=property_count,
        data_source="demo" if using_demo else "database",
        message=message,
    )
