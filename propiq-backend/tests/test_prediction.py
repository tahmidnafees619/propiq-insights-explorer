"""Tests for the prediction, explainability and metrics endpoints."""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from app.services.ml_service import ml_service

if not ml_service.is_loaded:
    ml_service.load()

requires_model = pytest.mark.skipif(
    not ml_service.is_loaded,
    reason="Model artifacts not present; run scripts/train_model.py",
)


@requires_model
class TestPredict:
    def test_returns_a_complete_payload(self, client: TestClient, valid_payload: dict) -> None:
        response = client.post("/api/predict", json=valid_payload)
        assert response.status_code == 200

        body = response.json()
        for field in (
            "predicted_price", "price_formatted", "margin_of_error", "price_low",
            "price_high", "confidence_percent", "confidence_level", "percentile",
            "breakdown", "model_used", "model_r2", "input_summary",
        ):
            assert field in body, f"missing field: {field}"

    def test_price_is_plausible(self, client: TestClient, valid_payload: dict) -> None:
        body = client.post("/api/predict", json=valid_payload).json()
        # A 2,200 sqft grade-8 King County home is a mid-market property.
        assert 150_000 < body["predicted_price"] < 3_000_000

    def test_interval_brackets_the_estimate(self, client: TestClient, valid_payload: dict) -> None:
        body = client.post("/api/predict", json=valid_payload).json()
        assert body["price_low"] < body["predicted_price"] < body["price_high"]
        assert body["margin_of_error"] > 0

    def test_price_formatted_matches_price(self, client: TestClient, valid_payload: dict) -> None:
        body = client.post("/api/predict", json=valid_payload).json()
        assert body["price_formatted"] == f"${body['predicted_price']:,.0f}"

    def test_bedrooms_change_the_estimate(self, client: TestClient, valid_payload: dict) -> None:
        """Regression test.

        The original feature set omitted bedrooms and bathrooms, so the
        predictor UI's room controls had no effect on the returned price.
        """
        few = client.post("/api/predict", json={**valid_payload, "bedrooms": 1}).json()
        many = client.post("/api/predict", json={**valid_payload, "bedrooms": 6}).json()
        assert few["predicted_price"] != many["predicted_price"]

    def test_bathrooms_change_the_estimate(self, client: TestClient, valid_payload: dict) -> None:
        few = client.post("/api/predict", json={**valid_payload, "bathrooms": 1.0}).json()
        many = client.post("/api/predict", json={**valid_payload, "bathrooms": 5.0}).json()
        assert few["predicted_price"] != many["predicted_price"]

    def test_higher_grade_costs_more(self, client: TestClient, valid_payload: dict) -> None:
        low = client.post("/api/predict", json={**valid_payload, "grade": 5}).json()
        high = client.post("/api/predict", json={**valid_payload, "grade": 11}).json()
        assert high["predicted_price"] > low["predicted_price"]

    def test_more_space_costs_more(self, client: TestClient, valid_payload: dict) -> None:
        small = client.post(
            "/api/predict",
            json={**valid_payload, "sqft_living": 1000, "sqft_above": 1000, "sqft_basement": 0},
        ).json()
        large = client.post(
            "/api/predict",
            json={**valid_payload, "sqft_living": 4000, "sqft_above": 3000, "sqft_basement": 1000},
        ).json()
        assert large["predicted_price"] > small["predicted_price"]

    def test_waterfront_commands_a_premium(self, client: TestClient, valid_payload: dict) -> None:
        inland = client.post("/api/predict", json={**valid_payload, "waterfront": 0}).json()
        water = client.post(
            "/api/predict", json={**valid_payload, "waterfront": 1, "view": 4}
        ).json()
        assert water["predicted_price"] > inland["predicted_price"]

    def test_breakdown_reconciles_to_the_final_price(
        self, client: TestClient, valid_payload: dict
    ) -> None:
        """Every dollar of the estimate must be accounted for in the breakdown."""
        body = client.post("/api/predict", json=valid_payload).json()
        total = sum(item["value"] for item in body["breakdown"])
        assert total == pytest.approx(body["predicted_price"], rel=0.02)

    def test_percentile_is_a_percentage(self, client: TestClient, valid_payload: dict) -> None:
        body = client.post("/api/predict", json=valid_payload).json()
        assert 0.0 <= body["percentile"] <= 100.0

    def test_post_2015_build_is_flagged_not_rejected(
        self, client: TestClient, valid_payload: dict
    ) -> None:
        """The UI lets users pick recent years; the API must accept them."""
        response = client.post("/api/predict", json={**valid_payload, "yr_built": 2024})
        assert response.status_code == 200
        body = response.json()
        assert body["extrapolated"] is True
        assert body["notes"]


@requires_model
class TestPredictValidation:
    def test_rejects_out_of_range_grade(self, client: TestClient, valid_payload: dict) -> None:
        response = client.post("/api/predict", json={**valid_payload, "grade": 99})
        assert response.status_code == 422
        assert response.json()["error"]["code"] == "validation_error"

    def test_rejects_missing_fields(self, client: TestClient) -> None:
        response = client.post("/api/predict", json={"sqft_living": 2000})
        assert response.status_code == 422

    def test_rejects_impossible_geometry(self, client: TestClient, valid_payload: dict) -> None:
        """Floors that do not fit inside the stated living area."""
        response = client.post(
            "/api/predict",
            json={**valid_payload, "sqft_living": 1000, "sqft_above": 9000, "sqft_basement": 5000},
        )
        assert response.status_code == 422

    def test_error_response_uses_the_standard_envelope(
        self, client: TestClient, valid_payload: dict
    ) -> None:
        body = client.post("/api/predict", json={**valid_payload, "grade": 0}).json()
        assert "error" in body
        assert {"code", "message", "details"} <= set(body["error"])
        assert body["error"]["details"][0]["field"] == "grade"


@requires_model
class TestFeatureImportance:
    def test_returns_ranked_features(self, client: TestClient) -> None:
        body = client.get("/api/feature-importance").json()
        assert len(body) > 0
        values = [item["importance"] for item in body]
        assert values == sorted(values, reverse=True)

    def test_importances_sum_to_one(self, client: TestClient) -> None:
        body = client.get("/api/feature-importance").json()
        assert sum(item["importance"] for item in body) == pytest.approx(1.0, abs=0.01)

    def test_every_item_has_a_display_label(self, client: TestClient) -> None:
        body = client.get("/api/feature-importance").json()
        assert all(item["label"] and item["label"] != item["feature"] for item in body)

    def test_limit_is_honoured(self, client: TestClient) -> None:
        assert len(client.get("/api/feature-importance?limit=5").json()) == 5

    def test_rooms_are_present_in_the_feature_set(self, client: TestClient) -> None:
        features = {item["feature"] for item in client.get("/api/feature-importance").json()}
        assert {"bedrooms", "bathrooms"} <= features


@requires_model
class TestModelMetrics:
    def test_reports_the_deployed_model(self, client: TestClient) -> None:
        body = client.get("/api/model/metrics").json()
        assert body["model_name"]
        assert 0.0 < body["r2"] <= 1.0
        assert body["mae"] > 0
        assert body["n_features"] >= 16

    def test_metrics_match_the_prediction_endpoint(
        self, client: TestClient, valid_payload: dict
    ) -> None:
        """A single source of truth: both endpoints publish the same R²."""
        metrics = client.get("/api/model/metrics").json()
        prediction = client.post("/api/predict", json=valid_payload).json()
        assert prediction["model_r2"] == metrics["r2"]
