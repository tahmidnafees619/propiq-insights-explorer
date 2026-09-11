"""FastAPI application factory and entrypoint."""

from __future__ import annotations

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware

from app import __version__
from app.config import settings
from app.database import create_tables
from app.exceptions import register_exception_handlers
from app.logging_config import configure_logging, get_logger
from app.middleware import RequestContextMiddleware
from app.routers import health, prediction, properties, stats
from app.services.ml_service import ml_service

logger = get_logger(__name__)

DESCRIPTION = """
Real estate market intelligence for King County, WA.

PropIQ serves a gradient-boosted price model together with the market
aggregates that put an estimate in context.

**What you get**

* `POST /api/predict` — a price, a calibrated 90% prediction interval, the
  market percentile, and a breakdown of which attributes drove the number.
* `GET /api/stats` — headline KPIs, price distribution, and per-bedroom,
  per-grade and per-month breakdowns.
* `GET /api/properties` — filterable, sortable, paginated sale records.
* `GET /api/model/metrics` — held-out accuracy for the deployed model.

**Data sources.** Endpoints report a `source` field. `database` means real
seeded records; `demo` means the curated showcase dataset that ships with the
project so the dashboard is never empty. Model accuracy is always measured
against the deployed model, never the demo data.
"""

TAGS_METADATA = [
    {"name": "System", "description": "Service metadata and health."},
    {"name": "Prediction", "description": "Price estimation and model explainability."},
    {"name": "Properties", "description": "Query historical sale records."},
    {"name": "Stats", "description": "Aggregate market statistics for the dashboard."},
]


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Prepare the database schema and load model artifacts once at startup."""
    configure_logging()
    logger.info("starting", extra={"app": settings.APP_NAME, "version": __version__})

    create_tables()
    ml_service.load()

    if not ml_service.is_loaded:
        # Not fatal: the read-only endpoints remain useful, and /api/health
        # reports the degraded state with the command needed to fix it.
        logger.warning("started without a model; run scripts/train_model.py")

    logger.info("ready")
    yield
    logger.info("shutting down")


def create_app() -> FastAPI:
    """Build and configure the application."""
    configure_logging()

    app = FastAPI(
        title=settings.APP_NAME,
        version=__version__,
        description=DESCRIPTION,
        openapi_tags=TAGS_METADATA,
        lifespan=lifespan,
        docs_url="/docs",
        redoc_url="/redoc",
        contact={
            "name": "Md. Tahmidur Rahman Nafees",
            "url": "https://github.com/tahmidnafees619/propiq-insights-explorer-main",
        },
        license_info={"name": "MIT", "url": "https://opensource.org/licenses/MIT"},
    )

    # Order matters: request context is outermost so every log line and error
    # envelope carries a request id.
    app.add_middleware(RequestContextMiddleware)
    app.add_middleware(GZipMiddleware, minimum_size=1000)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.allowed_origins,
        allow_credentials=True,
        allow_methods=["GET", "POST", "OPTIONS"],
        allow_headers=["*"],
        expose_headers=["X-Request-ID", "X-Response-Time-ms"],
    )

    register_exception_handlers(app)

    app.include_router(health.router)
    app.include_router(prediction.router)
    app.include_router(properties.router)
    app.include_router(stats.router)

    return app


app = create_app()
