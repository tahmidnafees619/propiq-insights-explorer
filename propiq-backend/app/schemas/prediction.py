"""Request and response models for the prediction endpoints."""

from __future__ import annotations

from datetime import date
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator

# The training data ends in 2015, but users legitimately want to price newer
# builds, so the API accepts them and the response flags the extrapolation
# rather than rejecting the request outright.
MAX_YEAR_BUILT = date.today().year + 1
MIN_YEAR_BUILT = 1900
TRAINING_MAX_YEAR = 2015


class PredictionInput(BaseModel):
    """Property attributes accepted by the model.

    Bounds are deliberately a superset of what the UI exposes so that a valid
    form submission can never be rejected by the API.
    """

    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "sqft_living": 2200,
                "sqft_lot": 7500,
                "bedrooms": 3,
                "bathrooms": 2.5,
                "floors": 2,
                "waterfront": 0,
                "view": 0,
                "condition": 3,
                "grade": 8,
                "sqft_above": 1800,
                "sqft_basement": 400,
                "yr_built": 1995,
                "sqft_living15": 2100,
                "sqft_lot15": 7500,
                "lat": 47.5112,
                "long": -122.257,
            }
        }
    )

    sqft_living: float = Field(..., ge=200, le=20000, description="Interior living area (sqft)")
    sqft_lot: float = Field(..., ge=200, le=2_000_000, description="Lot area (sqft)")
    bedrooms: int = Field(..., ge=0, le=15, description="Number of bedrooms")
    bathrooms: float = Field(..., ge=0.0, le=10.0, description="Number of bathrooms")
    floors: float = Field(..., ge=1.0, le=4.0, description="Number of floors")
    waterfront: int = Field(0, ge=0, le=1, description="1 if the lot fronts water")
    view: int = Field(0, ge=0, le=4, description="View quality, 0 (none) to 4 (excellent)")
    condition: int = Field(3, ge=1, le=5, description="Maintenance condition, 1-5")
    grade: int = Field(..., ge=1, le=13, description="King County construction grade, 1-13")
    sqft_above: float = Field(..., ge=0, le=20000, description="Above-ground area (sqft)")
    sqft_basement: float = Field(0, ge=0, le=10000, description="Basement area (sqft)")
    yr_built: int = Field(..., ge=MIN_YEAR_BUILT, le=MAX_YEAR_BUILT, description="Year constructed")

    sqft_living15: float = Field(1800, ge=200, le=20000, description="Mean living area of 15 nearest homes")
    sqft_lot15: float = Field(5000, ge=200, le=2_000_000, description="Mean lot area of 15 nearest homes")
    lat: float = Field(47.5112, ge=47.0, le=47.9, description="Latitude (King County)")
    long: float = Field(-122.257, ge=-122.6, le=-121.3, description="Longitude (King County)")

    @model_validator(mode="after")
    def _check_area_consistency(self) -> PredictionInput:
        """Reject internally contradictory geometry.

        Without this the model happily prices a 1,000 sqft home with a 9,000
        sqft ground floor, which is not a property that can exist. A small
        tolerance absorbs rounding in user-entered values.
        """
        stated_total = self.sqft_above + self.sqft_basement
        if stated_total > 0:
            tolerance = max(50.0, self.sqft_living * 0.05)
            if stated_total > self.sqft_living + tolerance:
                raise ValueError(
                    f"sqft_above ({self.sqft_above:,.0f}) + sqft_basement "
                    f"({self.sqft_basement:,.0f}) = {stated_total:,.0f}, which exceeds "
                    f"sqft_living ({self.sqft_living:,.0f}). Living area must cover "
                    "both floors."
                )
        return self


class ValueDriver(BaseModel):
    """One line of the value breakdown."""

    label: str
    value: float = Field(..., description="Dollar contribution to the final estimate")
    percent: float = Field(..., description="Share of the final estimate, in percent")


class PredictionResponse(BaseModel):
    predicted_price: float
    price_formatted: str
    margin_of_error: float = Field(..., description="Half-width of the confidence interval, in dollars")
    price_low: float = Field(..., description="Lower bound of the prediction interval")
    price_high: float = Field(..., description="Upper bound of the prediction interval")
    confidence_percent: float = Field(..., description="Nominal coverage of the interval, e.g. 90.0")
    confidence_level: Literal["high", "medium", "low"]
    percentile: float = Field(..., description="Where this price sits in the King County market, 0-100")
    breakdown: list[ValueDriver]
    model_used: str
    model_r2: float
    extrapolated: bool = Field(
        False,
        description=f"True when inputs fall outside the training range (e.g. built after {TRAINING_MAX_YEAR}).",
    )
    notes: list[str] = Field(default_factory=list)
    input_summary: dict


class FeatureImportanceItem(BaseModel):
    feature: str
    label: str
    importance: float
    importance_percent: float


class ModelMetricsResponse(BaseModel):
    """Published accuracy figures, read from the trained model's report."""

    model_config = ConfigDict(protected_namespaces=())

    model_name: str
    trained_at: str | None = None
    n_samples: int
    n_features: int
    r2: float = Field(..., description="R-squared on held-out data, in dollar space")
    r2_log: float = Field(..., description="R-squared on the log-transformed target")
    mae: float = Field(..., description="Mean absolute error, in dollars")
    rmse: float
    mape: float = Field(..., description="Mean absolute percentage error")
    median_ape: float = Field(..., description="Median absolute percentage error")
    within_10_pct: float = Field(..., description="Share of homes priced within 10% of actual")
    within_20_pct: float
    leaderboard: list[dict] = Field(default_factory=list)
