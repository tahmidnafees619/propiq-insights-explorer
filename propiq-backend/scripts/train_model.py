"""Train the PropIQ price model and persist inference artifacts.

Usage:
    python scripts/train_model.py [--data PATH] [--quiet]

Pipeline:
    1. Load and clean data/raw/kc_house_data.csv
    2. Engineer features and log-transform the target
    3. Train and compare LinearRegression, Ridge, RandomForest, GradientBoosting
    4. Select the best model by test RMSE and persist:
         models/model.pkl            fitted estimator
         models/scaler.pkl           fitted StandardScaler
         models/feature_columns.pkl  ordered feature list
         models/metrics.json         evaluation report + calibration data

`metrics.json` is the single source of truth for every accuracy figure the
API and UI display, so published numbers always match the deployed model.
"""

from __future__ import annotations

import argparse
import json
import pickle
from datetime import UTC, datetime
from pathlib import Path

import numpy as np
import pandas as pd
from sklearn.ensemble import GradientBoostingRegressor, RandomForestRegressor
from sklearn.linear_model import LinearRegression, Ridge
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler

BASE_DIR = Path(__file__).resolve().parents[1]
DATA_PATH = BASE_DIR / "data" / "raw" / "kc_house_data.csv"
MODEL_DIR = BASE_DIR / "models"

MODEL_PATH = MODEL_DIR / "model.pkl"
SCALER_PATH = MODEL_DIR / "scaler.pkl"
FEATURES_PATH = MODEL_DIR / "feature_columns.pkl"
METRICS_PATH = MODEL_DIR / "metrics.json"

RANDOM_STATE = 42
TEST_SIZE = 0.2

# Ordered feature contract. This list is persisted alongside the model and is
# what MLService reindexes incoming payloads against, so the order is binding.
#
# bedrooms and bathrooms are included deliberately: they are exposed as primary
# controls in the predictor UI, and a model that ignores them makes those
# controls inert.
FEATURE_COLUMNS = [
    "sqft_living",
    "sqft_lot",
    "bedrooms",
    "bathrooms",
    "floors",
    "waterfront",
    "view",
    "condition",
    "grade",
    "sqft_above",
    "sqft_basement",
    "yr_built",
    "lat",
    "long",
    "sqft_living15",
    "sqft_lot15",
]

CANDIDATE_MODELS: dict[str, object] = {
    "LinearRegression": LinearRegression(),
    "Ridge": Ridge(alpha=1.0, random_state=RANDOM_STATE),
    "RandomForestRegressor": RandomForestRegressor(
        n_estimators=300,
        max_depth=None,
        min_samples_leaf=2,
        n_jobs=-1,
        random_state=RANDOM_STATE,
    ),
    "GradientBoostingRegressor": GradientBoostingRegressor(
        n_estimators=500,
        learning_rate=0.05,
        max_depth=5,
        min_samples_leaf=5,
        subsample=0.9,
        random_state=RANDOM_STATE,
    ),
}


def load_data(path: Path) -> pd.DataFrame:
    """Read the raw CSV and drop rows unusable for supervised training."""
    if not path.exists():
        raise FileNotFoundError(
            f"Dataset not found at {path}.\n"
            "Download the King County House Sales dataset and place "
            "kc_house_data.csv in data/raw/."
        )

    df = pd.read_csv(path)
    before = len(df)

    df = df.dropna(subset=["price"])
    df = df[df["price"] > 0]
    df = df[df[FEATURE_COLUMNS].notna().all(axis=1)]

    # A single well-known data-entry error in this dataset: a 1,620 sqft home
    # recorded with 33 bedrooms. Left in, it distorts the bedrooms coefficient.
    df = df[df["bedrooms"] <= 15]
    df = df[df["bedrooms"] >= 1]

    df = df.drop_duplicates(subset=["id", "date"], keep="last")

    print(f"Loaded {before:,} rows -> {len(df):,} after cleaning")
    return df.reset_index(drop=True)


def prepare_features(df: pd.DataFrame) -> tuple[pd.DataFrame, np.ndarray]:
    """Split into the ordered feature matrix and the log-transformed target.

    Price is strongly right-skewed, so the model learns log1p(price) and
    predictions are inverted with expm1 at inference time.
    """
    X = df[FEATURE_COLUMNS].astype(float)
    y = np.log1p(df["price"].astype(float)).to_numpy()
    return X, y


def evaluate(y_true_log: np.ndarray, y_pred_log: np.ndarray) -> dict:
    """Score a model in both log space and real dollars.

    Dollar-space metrics are the ones worth publishing: an R² of 0.88 in log
    space is not the same claim as 0.88 on the actual sale price.
    """
    rmse_log = float(np.sqrt(mean_squared_error(y_true_log, y_pred_log)))
    r2_log = float(r2_score(y_true_log, y_pred_log))

    actual = np.expm1(y_true_log)
    predicted = np.expm1(y_pred_log)

    mae = float(mean_absolute_error(actual, predicted))
    rmse = float(np.sqrt(mean_squared_error(actual, predicted)))
    r2 = float(r2_score(actual, predicted))
    ape = np.abs(predicted - actual) / actual
    within_10 = float((ape <= 0.10).mean())
    within_20 = float((ape <= 0.20).mean())

    return {
        "r2_log": round(r2_log, 4),
        "rmse_log": round(rmse_log, 4),
        "r2": round(r2, 4),
        "mae": round(mae),
        "rmse": round(rmse),
        "mape": round(float(ape.mean()) * 100, 2),
        "median_ape": round(float(np.median(ape)) * 100, 2),
        "within_10_pct": round(within_10 * 100, 1),
        "within_20_pct": round(within_20 * 100, 1),
    }


def calibrate_intervals(y_true_log: np.ndarray, y_pred_log: np.ndarray) -> dict:
    """Derive prediction-interval multipliers from held-out residuals.

    Residuals in log space are approximately symmetric, so their quantiles
    convert into multiplicative bounds on price. This replaces the previous
    hardcoded "±8%" margin with an interval grounded in real test error.
    """
    residuals = y_true_log - y_pred_log
    return {
        "residual_std_log": round(float(residuals.std(ddof=1)), 5),
        "q05": round(float(np.quantile(residuals, 0.05)), 5),
        "q25": round(float(np.quantile(residuals, 0.25)), 5),
        "q75": round(float(np.quantile(residuals, 0.75)), 5),
        "q95": round(float(np.quantile(residuals, 0.95)), 5),
    }


def train_and_select(X: pd.DataFrame, y: np.ndarray) -> tuple[str, object, StandardScaler, dict]:
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=TEST_SIZE, random_state=RANDOM_STATE
    )

    scaler = StandardScaler().fit(X_train)
    X_train_scaled = scaler.transform(X_train)
    X_test_scaled = scaler.transform(X_test)

    leaderboard: list[dict] = []
    best_name: str | None = None
    best_model: object | None = None
    best_pred: np.ndarray | None = None
    best_rmse_log = float("inf")

    for name, model in CANDIDATE_MODELS.items():
        print(f"  training {name} ...")
        model.fit(X_train_scaled, y_train)
        preds = model.predict(X_test_scaled)
        scores = evaluate(y_test, preds)
        leaderboard.append({"model": name, **scores})
        print(
            f"    R2(log)={scores['r2_log']:.4f}  R2($)={scores['r2']:.4f}  "
            f"MAE=${scores['mae']:,}"
        )

        if scores["rmse_log"] < best_rmse_log:
            best_rmse_log = scores["rmse_log"]
            best_name, best_model, best_pred = name, model, preds

    assert best_name and best_model is not None and best_pred is not None

    leaderboard.sort(key=lambda row: row["rmse_log"])

    importances = None
    if hasattr(best_model, "feature_importances_"):
        importances = [
            {"feature": col, "importance": round(float(imp), 6)}
            for col, imp in zip(FEATURE_COLUMNS, best_model.feature_importances_, strict=True)
        ]
        importances.sort(key=lambda row: row["importance"], reverse=True)

    report = {
        "generated_at": datetime.now(UTC).isoformat(timespec="seconds"),
        "best_model": best_name,
        "n_samples": len(X),
        "n_train": len(X_train),
        "n_test": len(X_test),
        "n_features": len(FEATURE_COLUMNS),
        "feature_columns": FEATURE_COLUMNS,
        "target": "log1p(price)",
        "test_size": TEST_SIZE,
        "random_state": RANDOM_STATE,
        "metrics": evaluate(y_test, best_pred),
        "calibration": calibrate_intervals(y_test, best_pred),
        "leaderboard": leaderboard,
        "feature_importance": importances,
    }

    return best_name, best_model, scaler, report


def save_artifacts(model, scaler, report: dict) -> None:
    MODEL_DIR.mkdir(parents=True, exist_ok=True)
    with open(MODEL_PATH, "wb") as fh:
        pickle.dump(model, fh)
    with open(SCALER_PATH, "wb") as fh:
        pickle.dump(scaler, fh)
    with open(FEATURES_PATH, "wb") as fh:
        pickle.dump(FEATURE_COLUMNS, fh)
    METRICS_PATH.write_text(json.dumps(report, indent=2), encoding="utf-8")


def main() -> None:
    parser = argparse.ArgumentParser(description="Train the PropIQ price model.")
    parser.add_argument("--data", type=Path, default=DATA_PATH, help="Path to kc_house_data.csv")
    args = parser.parse_args()

    print("PropIQ model training")
    print("-" * 60)

    df = load_data(args.data)
    X, y = prepare_features(df)
    name, model, scaler, report = train_and_select(X, y)
    save_artifacts(model, scaler, report)

    m = report["metrics"]
    print("-" * 60)
    print(f"Best model      : {name}")
    print(f"R2 (log space)  : {m['r2_log']:.4f}")
    print(f"R2 (dollars)    : {m['r2']:.4f}")
    print(f"MAE             : ${m['mae']:,}")
    print(f"RMSE            : ${m['rmse']:,}")
    print(f"Median abs err  : {m['median_ape']:.1f}%")
    print(f"Within +/-10%   : {m['within_10_pct']:.1f}% of homes")
    print(f"Artifacts       : {MODEL_DIR}")


if __name__ == "__main__":
    main()
