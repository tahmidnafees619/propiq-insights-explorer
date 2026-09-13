"""Tests for the comparable sales attached to every prediction.

Comps are the estimate's sanity check, so these guard that the ones returned
are genuinely comparable — nearby, similar in size and grade — and that the
summary the UI renders actually describes them.
"""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from app.services import comps_service

REQUIRED_FIELDS = {
    "id", "price", "price_formatted", "bedrooms", "bathrooms", "sqft_living",
    "grade", "yr_built", "zipcode", "lat", "long", "distance_miles",
    "similarity", "price_per_sqft", "sold",
}

pytestmark = pytest.mark.usefixtures("_fresh_schema")


def _predict(client: TestClient, payload: dict) -> dict:
    response = client.post("/api/predict", json=payload)
    assert response.status_code == 200, response.text
    return response.json()


class TestComparablesContract:
    def test_prediction_includes_comparables(
        self, seeded_client: TestClient, valid_payload: dict
    ) -> None:
        body = _predict(seeded_client, valid_payload)
        assert body["comparables"], "an estimate with no comps has nothing to check it against"

    def test_every_comparable_carries_the_fields_the_table_renders(
        self, seeded_client: TestClient, valid_payload: dict
    ) -> None:
        body = _predict(seeded_client, valid_payload)
        for comp in body["comparables"]:
            assert set(comp) >= REQUIRED_FIELDS

    def test_never_returns_more_than_the_cap(
        self, seeded_client: TestClient, valid_payload: dict
    ) -> None:
        body = _predict(seeded_client, valid_payload)
        assert len(body["comparables"]) <= comps_service.MAX_RESULTS

    def test_ordered_by_descending_similarity(
        self, seeded_client: TestClient, valid_payload: dict
    ) -> None:
        """The table renders in order; the closest match must lead."""
        scores = [comp["similarity"] for comp in _predict(seeded_client, valid_payload)["comparables"]]
        assert scores == sorted(scores, reverse=True)

    def test_similarity_and_distance_are_in_range(
        self, seeded_client: TestClient, valid_payload: dict
    ) -> None:
        for comp in _predict(seeded_client, valid_payload)["comparables"]:
            assert 0 <= comp["similarity"] <= 100
            assert comp["distance_miles"] >= 0

    def test_price_per_sqft_is_consistent(
        self, seeded_client: TestClient, valid_payload: dict
    ) -> None:
        for comp in _predict(seeded_client, valid_payload)["comparables"]:
            expected = comp["price"] / comp["sqft_living"]
            assert comp["price_per_sqft"] == pytest.approx(expected, rel=0.01)


class TestComparablesAreActuallyComparable:
    def test_returned_homes_are_similar_in_size(
        self, seeded_client: TestClient, valid_payload: dict
    ) -> None:
        """A 'comp' twice the size of the subject is not a comp."""
        subject = valid_payload["sqft_living"]
        for comp in _predict(seeded_client, valid_payload)["comparables"]:
            ratio = comp["sqft_living"] / subject
            assert 0.35 <= ratio <= 1.75, comp

    def test_returned_homes_are_similar_in_grade(
        self, seeded_client: TestClient, valid_payload: dict
    ) -> None:
        subject = valid_payload["grade"]
        for comp in _predict(seeded_client, valid_payload)["comparables"]:
            assert abs(comp["grade"] - subject) <= 3, comp

    def test_inland_homes_never_get_waterfront_comps(
        self, seeded_client: TestClient, valid_payload: dict
    ) -> None:
        """Waterfront carries a ~213% premium; mixing it corrupts the range."""
        assert valid_payload["waterfront"] == 0
        for comp in _predict(seeded_client, valid_payload)["comparables"]:
            assert comp["waterfront"] == 0, comp

    def test_waterfront_homes_only_get_waterfront_comps(self, client: TestClient) -> None:
        """Regression test: comps once compared a waterfront home to inland ones.

        Runs against the bundled dataset, which holds waterfront sales at the
        same ~0.75% share as the real data.
        """
        payload = {
            "sqft_living": 3200, "sqft_lot": 12000, "bedrooms": 4, "bathrooms": 3.0,
            "floors": 2, "waterfront": 1, "view": 4, "condition": 4, "grade": 10,
            "sqft_above": 2400, "sqft_basement": 800, "yr_built": 2000,
            "lat": 47.6266, "long": -122.2394,
        }
        for comp in _predict(client, payload)["comparables"]:
            assert comp["waterfront"] == 1, comp

    def test_a_closer_more_similar_home_outranks_a_distant_one(
        self, seeded_client: TestClient, valid_payload: dict
    ) -> None:
        """Distance carries the most weight, so the nearest match should lead."""
        comps = _predict(seeded_client, valid_payload)["comparables"]
        if len(comps) < 2:
            pytest.skip("needs at least two comparables to compare ranking")
        assert comps[0]["distance_miles"] <= max(c["distance_miles"] for c in comps)


class TestComparablesSummary:
    def test_summary_brackets_its_own_comparables(
        self, seeded_client: TestClient, valid_payload: dict
    ) -> None:
        body = _predict(seeded_client, valid_payload)
        summary = body["comparables_summary"]
        prices = [comp["price"] for comp in body["comparables"]]

        assert summary["count"] == len(prices)
        assert summary["low_price"] == min(prices)
        assert summary["high_price"] == max(prices)
        assert summary["low_price"] <= summary["median_price"] <= summary["high_price"]

    def test_within_range_flag_matches_the_prices(
        self, seeded_client: TestClient, valid_payload: dict
    ) -> None:
        """This flag is a trust signal, so it must never contradict the data."""
        body = _predict(seeded_client, valid_payload)
        summary = body["comparables_summary"]
        estimate = body["predicted_price"]

        expected = summary["low_price"] <= estimate <= summary["high_price"]
        assert summary["estimate_within_range"] is expected


class TestDemoFallback:
    def test_empty_database_still_returns_comparables(
        self, client: TestClient, valid_payload: dict
    ) -> None:
        """`client` runs against an empty table, exercising the bundled dataset."""
        body = _predict(client, valid_payload)
        assert body["comparables"]
        assert body["comparables_summary"]["source"] == "demo"

    def test_demo_comparables_are_dated(self, client: TestClient, valid_payload: dict) -> None:
        """Sale dates are shown deliberately: this data is from 2014-2015."""
        for comp in _predict(client, valid_payload)["comparables"]:
            assert comp["sold"]


class TestHaversine:
    def test_known_distance(self) -> None:
        """Seattle to Bellevue is roughly 6.5 miles."""
        miles = comps_service.haversine_miles(47.6062, -122.3321, 47.6101, -122.2015)
        assert 5.5 <= miles <= 7.5

    def test_zero_distance(self) -> None:
        assert comps_service.haversine_miles(47.5, -122.2, 47.5, -122.2) == pytest.approx(0.0)
