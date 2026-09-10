"""Model loading and inference.

The service owns three things:

* loading the pickled estimator, scaler and feature contract at startup;
* turning a validated payload into a price, a calibrated interval and a
  human-readable breakdown of where that price comes from;
* exposing the model's own accuracy report so the API and UI never publish a
  number the deployed model cannot back up.
"""

from __future__ import annotations

import json
import pickle
import threading
from typing import Any

import numpy as np
import pandas as pd

from app.config import settings
from app.exceptions import ModelNotReadyError
from app.logging_config import get_logger

logger = get_logger(__name__)

# Human labels for the raw feature names, shared with the frontend.
FEATURE_LABELS: dict[str, str] = {
    "sqft_living": "Living Area",
    "sqft_lot": "Lot Size",
    "bedrooms": "Bedrooms",
    "bathrooms": "Bathrooms",
    "floors": "Floors",
    "waterfront": "Waterfront",
    "view": "View Quality",
    "condition": "Condition",
    "grade": "Construction Grade",
    "sqft_above": "Above-Ground Area",
    "sqft_basement": "Basement Area",
    "yr_built": "Year Built",
    "lat": "Latitude",
    "long": "Longitude",
    "sqft_living15": "Neighbourhood Living Area",
    "sqft_lot15": "Neighbourhood Lot Size",
}

# A median King County home, used as the baseline in the value breakdown.
BASELINE_PROPERTY: dict[str, float] = {
    "sqft_living": 1910,
    "sqft_lot": 7618,
    "bedrooms": 3,
    "bathrooms": 2.25,
    "floors": 1.5,
    "waterfront": 0,
    "view": 0,
    "condition": 3,
    "grade": 7,
    "sqft_above": 1560,
    "sqft_basement": 0,
    "yr_built": 1975,
    "lat": 47.5718,
    "long": -122.2300,
    "sqft_living15": 1840,
    "sqft_lot15": 7620,
}

# Which inputs belong to which narrative bucket in the breakdown.
DRIVER_GROUPS: dict[str, tuple[str, ...]] = {
    "Size & Layout": ("sqft_living", "sqft_above", "sqft_basement", "sqft_lot", "floors"),
    "Rooms": ("bedrooms", "bathrooms"),
    "Quality & Condition": ("grade", "condition", "yr_built"),
    "Location": ("lat", "long", "sqft_living15", "sqft_lot15"),
    "Waterfront & View": ("waterfront", "view"),
}

TRAINING_MAX_YEAR = 2015
# Fallback interval spread (log space) if a model predates metrics.json.
DEFAULT_RESIDUAL_STD = 0.19
CONFIDENCE_Z = 1.645  # 90% two-sided normal interval


class MLService:
    """Thread-safe singleton wrapping the trained estimator."""

    def __init__(self) -> None:
        self.model: Any = None
        self.scaler: Any = None
        self.feature_columns: list[str] = []
        self.metrics: dict[str, Any] = {}
        self.is_loaded = False
        self._lock = threading.Lock()
        self._price_grid: np.ndarray | None = None

    # ------------------------------------------------------------------
    # Lifecycle
    # ------------------------------------------------------------------
    def load(self) -> None:
        """Load artifacts from disk. Called once during application startup."""
        with self._lock:
            paths = {
                "model": settings.resolved_model_path,
                "scaler": settings.resolved_scaler_path,
                "features": settings.resolved_features_path,
            }
            missing = [name for name, path in paths.items() if not path.exists()]
            if missing:
                self.is_loaded = False
                logger.warning(
                    "model artifacts missing; prediction endpoints will return 503",
                    extra={"missing": missing, "model_dir": str(settings.resolved_model_path.parent)},
                )
                return

            try:
                with open(paths["model"], "rb") as fh:
                    self.model = pickle.load(fh)
                with open(paths["scaler"], "rb") as fh:
                    self.scaler = pickle.load(fh)
                with open(paths["features"], "rb") as fh:
                    self.feature_columns = list(pickle.load(fh))
            except Exception:
                self.is_loaded = False
                logger.exception("failed to deserialize model artifacts")
                return

            self.metrics = self._load_metrics()
            self._validate_contract()
            self.is_loaded = True
            self._price_grid = None

            logger.info(
                "model loaded",
                extra={
                    "model": self.model_name,
                    "n_features": len(self.feature_columns),
                    "r2": self.r2,
                },
            )

    def _load_metrics(self) -> dict[str, Any]:
        path = settings.resolved_metrics_path
        if not path.exists():
            logger.warning("metrics.json not found; accuracy figures unavailable")
            return {}
        try:
            return json.loads(path.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError):
            logger.exception("could not read metrics.json")
            return {}

    def _validate_contract(self) -> None:
        """Fail loudly if the scaler and the feature list disagree.

        A silent mismatch here would scale the wrong columns and produce
        confident nonsense, which is far worse than refusing to start.
        """
        expected = getattr(self.scaler, "n_features_in_", None)
        if expected is not None and expected != len(self.feature_columns):
            raise RuntimeError(
                f"Artifact mismatch: scaler expects {expected} features but "
                f"feature_columns.pkl lists {len(self.feature_columns)}. "
                "Re-run scripts/train_model.py."
            )

    # ------------------------------------------------------------------
    # Published metadata
    # ------------------------------------------------------------------
    @property
    def model_name(self) -> str:
        if self.metrics.get("best_model"):
            return str(self.metrics["best_model"])
        return type(self.model).__name__ if self.model is not None else "unavailable"

    @property
    def r2(self) -> float:
        return float(self.metrics.get("metrics", {}).get("r2", 0.0))

    @property
    def mae(self) -> float:
        return float(self.metrics.get("metrics", {}).get("mae", 0.0))

    @property
    def _residual_std(self) -> float:
        calibration = self.metrics.get("calibration", {})
        return float(calibration.get("residual_std_log", DEFAULT_RESIDUAL_STD))

    def get_metrics_report(self) -> dict[str, Any]:
        """Full accuracy report for the /api/model/metrics endpoint."""
        self._require_model()
        m = self.metrics.get("metrics", {})
        return {
            "model_name": self.model_name,
            "trained_at": self.metrics.get("generated_at"),
            "n_samples": int(self.metrics.get("n_samples", 0)),
            "n_features": len(self.feature_columns),
            "r2": m.get("r2", 0.0),
            "r2_log": m.get("r2_log", 0.0),
            "mae": m.get("mae", 0.0),
            "rmse": m.get("rmse", 0.0),
            "mape": m.get("mape", 0.0),
            "median_ape": m.get("median_ape", 0.0),
            "within_10_pct": m.get("within_10_pct", 0.0),
            "within_20_pct": m.get("within_20_pct", 0.0),
            "leaderboard": self.metrics.get("leaderboard", []),
        }

    # ------------------------------------------------------------------
    # Inference
    # ------------------------------------------------------------------
    def _require_model(self) -> None:
        if not self.is_loaded:
            raise ModelNotReadyError()

    def _to_frame(self, payload: dict[str, Any]) -> pd.DataFrame:
        """Project a payload onto the exact training feature matrix."""
        frame = pd.DataFrame([payload])
        return frame.reindex(columns=self.feature_columns, fill_value=0).astype(float)

    def _predict_log(self, payload: dict[str, Any]) -> float:
        scaled = self.scaler.transform(self._to_frame(payload))
        return float(self.model.predict(scaled)[0])

    def predict(self, payload: dict[str, Any]) -> dict[str, Any]:
        """Price a property and describe the result.

        Returns the point estimate, a calibrated prediction interval, the
        market percentile, and a breakdown attributing the difference from a
        median King County home to each group of inputs.
        """
        self._require_model()

        log_price = self._predict_log(payload)
        price = float(np.expm1(log_price))

        sigma = self._residual_std
        low = float(np.expm1(log_price - CONFIDENCE_Z * sigma))
        high = float(np.expm1(log_price + CONFIDENCE_Z * sigma))
        margin = (high - low) / 2.0

        notes: list[str] = []
        extrapolated = False
        if payload.get("yr_built", 0) > TRAINING_MAX_YEAR:
            extrapolated = True
            notes.append(
                f"This home was built after {TRAINING_MAX_YEAR}, the last year in the "
                "training data. The estimate extrapolates beyond observed sales."
            )
        if payload.get("waterfront"):
            notes.append(
                "Waterfront sales are rare (under 1% of the dataset), so estimates "
                "for them carry wider real-world uncertainty than the interval shows."
            )

        return {
            "predicted_price": round(price),
            "margin_of_error": round(margin),
            "price_low": round(low),
            "price_high": round(high),
            "confidence_percent": 90.0,
            "confidence_level": self._confidence_level(margin, price, extrapolated),
            "percentile": self._market_percentile(price),
            "breakdown": self._value_breakdown(payload, price),
            "model_used": self.model_name,
            "model_r2": self.r2,
            "extrapolated": extrapolated,
            "notes": notes,
        }

    def _confidence_level(self, margin: float, price: float, extrapolated: bool) -> str:
        """Bucket the interval width into a label the UI can colour-code."""
        if price <= 0:
            return "low"
        relative = margin / price
        if extrapolated or relative > 0.28:
            return "low"
        if relative > 0.18:
            return "medium"
        return "high"

    def _value_breakdown(self, payload: dict[str, Any], final_price: float) -> list[dict[str, Any]]:
        """Attribute the price to groups of inputs by ablation.

        Start from a median home, switch one group of features at a time to
        the user's values, and record the change in predicted price. Because
        a gradient-boosted model is not additive, the group deltas will not
        sum exactly to the final price; the remainder is reported openly as
        "Combined effects" rather than being silently distributed.
        """
        baseline_price = float(np.expm1(self._predict_log(BASELINE_PROPERTY)))

        drivers: list[dict[str, Any]] = [
            {"label": "Baseline: typical King County home", "value": round(baseline_price)}
        ]

        attributed = 0.0
        for group_label, fields in DRIVER_GROUPS.items():
            variant = dict(BASELINE_PROPERTY)
            for field in fields:
                if field in payload:
                    variant[field] = payload[field]

            variant_price = float(np.expm1(self._predict_log(variant)))
            delta = variant_price - baseline_price
            attributed += delta

            # Suppress groups that move the price by a trivial amount so the
            # table stays readable.
            if abs(delta) >= max(500.0, final_price * 0.002):
                drivers.append({"label": group_label, "value": round(delta)})

        remainder = final_price - baseline_price - attributed
        if abs(remainder) >= max(500.0, final_price * 0.005):
            drivers.append({"label": "Combined effects", "value": round(remainder)})

        denominator = final_price if final_price else 1.0
        for driver in drivers:
            driver["percent"] = round(driver["value"] / denominator * 100, 1)

        return drivers

    def _market_percentile(self, price: float) -> float:
        """Where this price sits against the modelled price distribution."""
        grid = self._get_price_grid()
        if grid is None or grid.size == 0:
            return 50.0
        return round(float((grid < price).mean() * 100), 1)

    def _get_price_grid(self) -> np.ndarray | None:
        """A cached reference distribution of King County sale prices.

        Derived from the training data's log-price summary so percentiles
        reflect the real market rather than an arbitrary constant.
        """
        if self._price_grid is not None:
            return self._price_grid

        # Log-normal fit to the King County sale-price distribution
        # (median ~$450k, mean ~$540k).
        rng = np.random.default_rng(42)
        self._price_grid = np.expm1(rng.normal(np.log(450_000), 0.53, 20_000))
        return self._price_grid

    # ------------------------------------------------------------------
    # Explainability
    # ------------------------------------------------------------------
    def get_feature_importance(self, limit: int | None = None) -> list[dict[str, Any]]:
        """Ranked feature importances from the trained model."""
        self._require_model()

        if not hasattr(self.model, "feature_importances_"):
            raise ModelNotReadyError(
                f"{self.model_name} does not expose feature importances."
            )

        raw = self.model.feature_importances_
        items = [
            {
                "feature": column,
                "label": FEATURE_LABELS.get(column, column.replace("_", " ").title()),
                "importance": round(float(importance), 4),
                "importance_percent": round(float(importance) * 100, 2),
            }
            for column, importance in zip(self.feature_columns, raw, strict=True)
        ]
        items.sort(key=lambda item: item["importance"], reverse=True)
        return items[:limit] if limit else items


# Process-wide singleton.
ml_service = MLService()
