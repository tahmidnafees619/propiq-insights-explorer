"""Tests for the property listing and detail endpoints."""

from __future__ import annotations

from fastapi.testclient import TestClient


class TestListWithData:
    def test_returns_seeded_rows(self, seeded_client: TestClient) -> None:
        body = seeded_client.get("/api/properties").json()
        assert body["total"] == 6
        assert body["source"] == "database"
        assert len(body["properties"]) == 6

    def test_pagination_metadata_is_consistent(self, seeded_client: TestClient) -> None:
        body = seeded_client.get("/api/properties?limit=2&offset=0").json()
        assert body["total"] == 6
        assert body["count"] == 2
        assert body["limit"] == 2
        assert body["has_more"] is True

    def test_last_page_reports_no_more(self, seeded_client: TestClient) -> None:
        body = seeded_client.get("/api/properties?limit=2&offset=4").json()
        assert body["count"] == 2
        assert body["has_more"] is False

    def test_pages_do_not_overlap(self, seeded_client: TestClient) -> None:
        first = seeded_client.get("/api/properties?limit=3&offset=0").json()["properties"]
        second = seeded_client.get("/api/properties?limit=3&offset=3").json()["properties"]
        assert {row["id"] for row in first}.isdisjoint({row["id"] for row in second})

    def test_default_sort_is_price_descending(self, seeded_client: TestClient) -> None:
        prices = [row["price"] for row in seeded_client.get("/api/properties").json()["properties"]]
        assert prices == sorted(prices, reverse=True)

    def test_sort_ascending(self, seeded_client: TestClient) -> None:
        body = seeded_client.get("/api/properties?sort_by=price&sort_order=asc").json()
        prices = [row["price"] for row in body["properties"]]
        assert prices == sorted(prices)
        assert prices[0] == 200_000

    def test_price_filters(self, seeded_client: TestClient) -> None:
        body = seeded_client.get("/api/properties?min_price=400000&max_price=600000").json()
        assert body["total"] == 3
        assert all(400_000 <= row["price"] <= 600_000 for row in body["properties"])

    def test_bedroom_filter(self, seeded_client: TestClient) -> None:
        body = seeded_client.get("/api/properties?min_bedrooms=4").json()
        assert body["total"] == 3

    def test_waterfront_filter(self, seeded_client: TestClient) -> None:
        body = seeded_client.get("/api/properties?waterfront=1").json()
        assert body["total"] == 1
        assert body["properties"][0]["price"] == 1_400_000

    def test_zipcode_filter(self, seeded_client: TestClient) -> None:
        body = seeded_client.get("/api/properties?zipcode=98115").json()
        assert body["total"] == 2

    def test_filters_combine(self, seeded_client: TestClient) -> None:
        body = seeded_client.get("/api/properties?min_grade=8&waterfront=0").json()
        assert body["total"] == 2

    def test_search_matches_zipcode(self, seeded_client: TestClient) -> None:
        body = seeded_client.get("/api/properties?search=98052").json()
        assert body["total"] == 2

    def test_every_row_exposes_zipcode(self, seeded_client: TestClient) -> None:
        """The dashboard table filters on zipcode, so it must be serialised."""
        body = seeded_client.get("/api/properties").json()
        assert all(row["zipcode"] for row in body["properties"])


class TestDetail:
    def test_fetches_one_property(self, seeded_client: TestClient) -> None:
        body = seeded_client.get("/api/properties/1").json()
        assert body["id"] == 1
        assert body["price"] == 200_000

    def test_unknown_id_returns_404_envelope(self, seeded_client: TestClient) -> None:
        response = seeded_client.get("/api/properties/424242")
        assert response.status_code == 404
        assert response.json()["error"]["code"] == "not_found"

    def test_invalid_id_is_rejected(self, seeded_client: TestClient) -> None:
        assert seeded_client.get("/api/properties/0").status_code == 422


class TestDemoFallback:
    """With an empty database the API serves the curated showcase dataset."""

    def test_returns_demo_rows_when_empty(self, client: TestClient) -> None:
        body = client.get("/api/properties").json()
        assert body["source"] == "demo"
        assert body["total"] > 0
        assert len(body["properties"]) > 0

    def test_demo_rows_are_deterministic(self, client: TestClient) -> None:
        first = client.get("/api/properties?limit=5").json()["properties"]
        second = client.get("/api/properties?limit=5").json()["properties"]
        assert first == second

    def test_demo_rows_honour_filters(self, client: TestClient) -> None:
        body = client.get("/api/properties?min_price=1000000").json()
        assert all(row["price"] >= 1_000_000 for row in body["properties"])

    def test_demo_rows_honour_sorting(self, client: TestClient) -> None:
        body = client.get("/api/properties?sort_by=sqft_living&sort_order=asc").json()
        sizes = [row["sqft_living"] for row in body["properties"]]
        assert sizes == sorted(sizes)

    def test_demo_detail_lookup_works(self, client: TestClient) -> None:
        assert client.get("/api/properties/1").json()["id"] == 1


class TestQueryValidation:
    def test_limit_bounds_are_enforced(self, client: TestClient) -> None:
        assert client.get("/api/properties?limit=0").status_code == 422
        assert client.get("/api/properties?limit=99999").status_code == 422

    def test_negative_offset_is_rejected(self, client: TestClient) -> None:
        assert client.get("/api/properties?offset=-1").status_code == 422

    def test_unknown_sort_field_is_rejected(self, client: TestClient) -> None:
        assert client.get("/api/properties?sort_by=DROP+TABLE").status_code == 422
