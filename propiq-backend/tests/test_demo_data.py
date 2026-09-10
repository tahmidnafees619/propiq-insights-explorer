"""Guards on the curated showcase dataset.

The demo data is what appears in screenshots and recordings, so it has to
stay internally consistent: the rows in the table must agree with the
aggregates in the charts beside them.
"""

from __future__ import annotations

import statistics

import pytest

from app.services import demo_data


@pytest.fixture(scope="module")
def rows() -> list[dict]:
    return demo_data.demo_properties()


class TestDeterminism:
    def test_repeated_calls_are_identical(self) -> None:
        assert demo_data.demo_properties() == demo_data.demo_properties()

    def test_sample_size_is_stable(self, rows: list[dict]) -> None:
        assert len(rows) == 600

    def test_ids_are_unique_and_sequential(self, rows: list[dict]) -> None:
        assert [row["id"] for row in rows] == list(range(1, len(rows) + 1))


class TestHeadlineConsistency:
    """The sampled rows must match the KPI figures shown above them."""

    def test_median_matches_the_published_median(self, rows: list[dict]) -> None:
        median = statistics.median(row["price"] for row in rows)
        assert median == pytest.approx(demo_data.DEMO_MEDIAN_PRICE, rel=0.05)

    def test_mean_matches_the_published_average(self, rows: list[dict]) -> None:
        mean = statistics.mean(row["price"] for row in rows)
        assert mean == pytest.approx(demo_data.DEMO_AVG_PRICE, rel=0.10)

    def test_prices_stay_within_published_bounds(self, rows: list[dict]) -> None:
        prices = [row["price"] for row in rows]
        assert min(prices) >= demo_data.DEMO_MIN_PRICE
        assert max(prices) <= demo_data.DEMO_MAX_PRICE

    def test_price_per_sqft_is_realistic(self, rows: list[dict]) -> None:
        ppsf = statistics.median(row["price"] / row["sqft_living"] for row in rows)
        assert 150 < ppsf < 400, f"implausible ${ppsf:.0f}/sqft"


class TestRowIntegrity:
    def test_floors_fit_inside_the_living_area(self, rows: list[dict]) -> None:
        """Geometry the prediction endpoint would reject must not appear here."""
        for row in rows:
            assert row["sqft_above"] + row["sqft_basement"] == pytest.approx(
                row["sqft_living"], abs=1
            )

    def test_every_row_has_a_zipcode(self, rows: list[dict]) -> None:
        assert all(len(row["zipcode"]) == 5 for row in rows)

    def test_attribute_ranges_are_valid(self, rows: list[dict]) -> None:
        for row in rows:
            assert 1 <= row["bedrooms"] <= 15
            assert 1 <= row["grade"] <= 13
            assert 1 <= row["condition"] <= 5
            assert 0 <= row["view"] <= 4
            assert row["waterfront"] in (0, 1)
            assert 1900 <= row["yr_built"] <= 2015
            assert 1 <= row["month_sold"] <= 12

    def test_coordinates_fall_inside_king_county(self, rows: list[dict]) -> None:
        for row in rows:
            assert 47.0 <= row["lat"] <= 47.9
            assert -122.6 <= row["long"] <= -121.3

    def test_higher_grades_cost_more_on_average(self, rows: list[dict]) -> None:
        by_grade: dict[int, list[float]] = {}
        for row in rows:
            by_grade.setdefault(row["grade"], []).append(row["price"])
        averages = {g: statistics.mean(p) for g, p in by_grade.items() if len(p) >= 10}
        grades = sorted(averages)
        assert averages[grades[0]] < averages[grades[-1]]


class TestAggregates:
    def test_stats_payload_is_complete(self) -> None:
        stats = demo_data.demo_stats()
        for key in ("total_properties", "avg_price", "median_price",
                    "avg_price_by_bedrooms", "grade_breakdown", "monthly",
                    "price_distribution", "scatter_sample"):
            assert stats[key]

    def test_stats_are_labelled_as_demo(self) -> None:
        assert demo_data.demo_stats()["source"] == "demo"

    def test_distribution_totals_match_the_headline_count(self) -> None:
        stats = demo_data.demo_stats()
        total = sum(bucket["count"] for bucket in stats["price_distribution"])
        assert total == stats["total_properties"]

    def test_monthly_volume_totals_match_the_headline_count(self) -> None:
        stats = demo_data.demo_stats()
        total = sum(row["volume"] for row in stats["monthly"])
        assert total == pytest.approx(stats["total_properties"], rel=0.02)
