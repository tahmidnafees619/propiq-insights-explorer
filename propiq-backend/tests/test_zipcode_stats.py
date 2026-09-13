"""Tests for the per-ZIP aggregates that shade the price choropleth.

The map renders one polygon per ZIP from a bundled boundary file, so these
guard the contract that file is joined against: every row needs a ZIP key the
GeoJSON can match, and a colour scale that actually spans the data.
"""

from __future__ import annotations

from fastapi.testclient import TestClient

ENDPOINT = "/api/stats/by-zipcode"

REQUIRED_FIELDS = {"zipcode", "median_price", "avg_price", "price_per_sqft", "count"}


class TestZipcodeStatsContract:
    def test_returns_rows_with_every_field_the_map_reads(self, client: TestClient) -> None:
        body = client.get(ENDPOINT).json()
        assert body["zipcodes"], "the choropleth renders nothing without rows"
        for row in body["zipcodes"]:
            assert set(row) >= REQUIRED_FIELDS

    def test_zipcodes_are_five_digit_strings(self, client: TestClient) -> None:
        """The GeoJSON keys on a zero-padded string; an int would never match."""
        body = client.get(ENDPOINT).json()
        for row in body["zipcodes"]:
            assert isinstance(row["zipcode"], str)
            assert len(row["zipcode"]) == 5
            assert row["zipcode"].isdigit()

    def test_scale_bounds_bracket_every_median(self, client: TestClient) -> None:
        """The legend is drawn from these bounds, so they must contain the data."""
        body = client.get(ENDPOINT).json()
        medians = [row["median_price"] for row in body["zipcodes"]]
        assert body["min_median"] == min(medians)
        assert body["max_median"] == max(medians)

    def test_scale_actually_spans_a_range(self, client: TestClient) -> None:
        """A degenerate scale would paint all 70 ZIPs one colour."""
        body = client.get(ENDPOINT).json()
        assert body["max_median"] > body["min_median"]

    def test_every_figure_is_positive(self, client: TestClient) -> None:
        body = client.get(ENDPOINT).json()
        for row in body["zipcodes"]:
            assert row["median_price"] > 0
            assert row["avg_price"] > 0
            assert row["price_per_sqft"] > 0
            assert row["count"] >= 1

    def test_zipcodes_are_unique(self, client: TestClient) -> None:
        """One polygon per ZIP: a duplicate would silently overwrite a shade."""
        body = client.get(ENDPOINT).json()
        codes = [row["zipcode"] for row in body["zipcodes"]]
        assert len(codes) == len(set(codes))


class TestDemoFallback:
    def test_empty_database_still_shades_the_map(self, client: TestClient) -> None:
        """`client` runs against an empty table, so this exercises the fallback."""
        body = client.get(ENDPOINT).json()
        assert body["source"] == "demo"
        assert len(body["zipcodes"]) == 70

    def test_demo_counts_match_the_published_total(self, client: TestClient) -> None:
        """Demo mode advertises 21,436 sales; the per-ZIP volumes must agree."""
        from app.services.demo_data import DEMO_TOTAL_PROPERTIES

        body = client.get(ENDPOINT).json()
        assert sum(row["count"] for row in body["zipcodes"]) == DEMO_TOTAL_PROPERTIES


class TestDatabaseAggregates:
    def test_seeded_database_reports_its_own_rows(self, seeded_client: TestClient) -> None:
        body = seeded_client.get(ENDPOINT).json()
        assert body["source"] == "database"
        assert sum(row["count"] for row in body["zipcodes"]) == 6

    def test_medians_match_hand_computed_values(self, seeded_client: TestClient) -> None:
        """The median runs through a window function, so pin the arithmetic.

        Two of these ZIPs hold an even number of sales, which exercises the
        branch that averages the middle pair rather than taking one row.
        """
        body = seeded_client.get(ENDPOINT).json()
        by_zip = {row["zipcode"]: row for row in body["zipcodes"]}

        expected = {
            "98178": (200_000.0, 1),   # single sale
            "98115": (350_000.0, 2),   # 300k + 400k, even count
            "98052": (550_000.0, 2),   # 500k + 600k, even count
            "98004": (1_400_000.0, 1),
        }
        assert set(by_zip) == set(expected)
        for zipcode, (median, count) in expected.items():
            assert by_zip[zipcode]["median_price"] == median, zipcode
            assert by_zip[zipcode]["count"] == count, zipcode
