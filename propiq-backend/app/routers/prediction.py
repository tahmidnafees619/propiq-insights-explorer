"""Prediction, explainability and model-metrics endpoints."""

from __future__ import annotations

from fastapi import APIRouter, Query

from app.config import settings
from app.schemas.common import ErrorResponse
from app.schemas.prediction import (
    FeatureImportanceItem,
    ModelMetricsResponse,
    PredictionInput,
    PredictionResponse,
)
from app.services.ml_service import ml_service

router = APIRouter(prefix=settings.API_PREFIX, tags=["Prediction"])

COMMON_ERRORS = {
    422: {"model": ErrorResponse, "description": "Validation failed"},
    503: {"model": ErrorResponse, "description": "Model not loaded"},
}


@router.post(
    "/predict",
    response_model=PredictionResponse,
    responses=COMMON_ERRORS,
    summary="Estimate a property's sale price",
)
def predict_price(payload: PredictionInput) -> PredictionResponse:
    """Price a property from its attributes.

    Returns a point estimate alongside a 90% prediction interval calibrated
    on held-out residuals, the price's percentile within the King County
    market, and a breakdown attributing the estimate to size, rooms, quality,
    location and waterfront/view.
    """
    data = payload.model_dump()
    result = ml_service.predict(data)

    return PredictionResponse(
        **result,
        price_formatted=f"${result['predicted_price']:,.0f}",
        input_summary={
            "sqft_living": payload.sqft_living,
            "bedrooms": payload.bedrooms,
            "bathrooms": payload.bathrooms,
            "grade": payload.grade,
            "condition": payload.condition,
            "waterfront": payload.waterfront,
            "yr_built": payload.yr_built,
        },
    )


@router.get(
    "/feature-importance",
    response_model=list[FeatureImportanceItem],
    responses={503: COMMON_ERRORS[503]},
    summary="Rank the model's price drivers",
)
def get_feature_importance(
    limit: int | None = Query(None, ge=1, le=50, description="Return only the top N features"),
) -> list[FeatureImportanceItem]:
    """Feature importances read directly from the trained estimator."""
    return [FeatureImportanceItem(**item) for item in ml_service.get_feature_importance(limit)]


@router.get(
    "/model/metrics",
    response_model=ModelMetricsResponse,
    responses={503: COMMON_ERRORS[503]},
    summary="Published accuracy of the deployed model",
)
def get_model_metrics() -> ModelMetricsResponse:
    """Held-out evaluation scores for the model currently serving traffic.

    Sourced from `models/metrics.json`, which is written by the training
    script, so these figures always describe the deployed artifact.
    """
    return ModelMetricsResponse(**ml_service.get_metrics_report())
