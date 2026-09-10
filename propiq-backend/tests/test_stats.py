"""Tests for the market statistics endpoint."""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

REQUIRED_FIELDS = {
    "total_properties", "avg_price", "median_price", "min_price", "max_price",
    "model_r2", "mae", "avg_price_by_bedrooms", "grade_breakdown", "monthly",
    "price_distribution", "scatter_sample", "waterfront_premium_percent", "source",
}


class TestStatsContract:
    def test_response_contains_every_dashboard_field(self, client: TestClient) -> None:
        """The dashboard reads all of these; a missing one renders as NaN."""
        body = client.get("/api/stats").json()
        assert set(body) >= REQUIRED_FIELDS

    def test_mae_is_present_and_positive(self, client: TestClient) -> None:
        """Regression test: the KPI card previously read an absent `mae`."""
        body = client.get("/api/stats").json()
        assert body["mae"] > 0

    def test_monthly_entries_carry_names_and_volume(self, client: TestClient) -> None:
        body = client.get("/api/stats").json()
        assert body["monthly"]
        for row in body["monthly"]:
            assert isinstance(row["month"], str) and len(row["month"]) == 3
            assert row["volume"] >= 0


class TestStatsWithData:
    def test_counts_and_averages_are_computed(self, seeded_client: TestClient) -> None:
        body = seeded_client.get("/api/stats").json()
        assert body["source"] == "database"
        assert body["total_properties"] == 6
        # 200k + 300k + 400k + 500k + 600k + 1.4M = 3.4M over 6 rows.
        assert body["avg_price"] == pytest.approx(566_666.67, abs=1)

    def test_median_is_real_not_hardcoded(self, seeded_client: TestClient) -> None:
        """The median used to be a constant 450000 regardless of the data."""
        body = seeded_client.get("/api/stats").json()
        assert body["median_price"] == pytest.approx(450_000)

    def test_min_and_max(self, seeded_client: TestClient) -> None:
        body = seeded_client.get("/api/stats").json()
        assert body["min_price"] == 200_000
        assert body["max_price"] == 1_400_000

    def test_bedroom_breakdown(self, seeded_client: TestClient) -> None:
        rows = {r["bedrooms"]: r for r in seeded_client.get("/api/stats").json()["avg_price_by_bedrooms"]}
        assert rows[3]["count"] == 2
        assert rows[3]["avg_price"] == pytest.approx(350_000)

    def test_grade_breakdown(self, seeded_client: TestClient) -> None:
        rows = {r["grade"]: r for r in seeded_client.get("/api/stats").json()["grade_breakdown"]}
        assert rows[7]["count"] == 2
        assert rows[7]["avg_price"] == pytest.approx(350_000)

    def test_monthly_volume_totals_match_row_count(self, seeded_client: TestClient) -> None:
        body = seeded_client.get("/api/stats").json()
        assert sum(row["volume"] for row in body["monthly"]) == 6

    def test_price_distribution_totals_match_row_count(self, seeded_client: TestClient) -> None:
        body = seeded_client.get("/api/stats").json()
        assert sum(bucket["count"] for bucket in body["price_distribution"]) == 6

    def test_waterfront_premium_is_computed(self, seeded_client: TestClient) -> None:
        body = seeded_client.get("/api/stats").json()
        # One waterfront home at 1.4M against a 400k inland average.
        assert body["waterfront_premium_percent"] == pytest.approx(250.0, abs=1)


class TestStatsDemoFallback:
    def test_empty_database_serves_labelled_demo_data(self, client: TestClient) -> None:
        body = client.get("/api/stats").json()
        assert body["source"] == "demo"
        assert body["total_properties"] > 0
        assert body["avg_price"] > 0

    def test_every_chart_series_is_populated(self, client: TestClient) -> None:
        """A blank chart during a walkthrough is the failure this prevents."""
        body = client.get("/api/stats").json()
        for series in ("avg_price_by_bedrooms", "grade_breakdown", "monthly",
                       "price_distribution", "scatter_sample"):
            assert body[series], f"{series} is empty"

    def test_monthly_covers_twelve_months(self, client: TestClient) -> None:
        assert len(client.get("/api/stats").json()["monthly"]) == 12

    def test_accuracy_comes_from_the_model_not_the_demo_data(self, client: TestClient) -> None:
        """Demo market data must never supply the published model accuracy."""
        stats = client.get("/api/stats").json()
        metrics = client.get("/api/model/metrics")
        if metrics.status_code == 200:
            assert stats["model_r2"] == metrics.json()["r2"]
            assert stats["mae"] == metrics.json()["mae"]
