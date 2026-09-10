"""Tests for the system endpoints."""

from __future__ import annotations

from fastapi.testclient import TestClient


class TestRoot:
    def test_root_is_an_index_not_a_404(self, client: TestClient) -> None:
        response = client.get("/")
        assert response.status_code == 200
        body = response.json()
        assert body["docs"] == "/docs"
        assert "predict" in body["endpoints"]


class TestHealth:
    def test_reports_ok_when_ready(self, client: TestClient) -> None:
        body = client.get("/api/health").json()
        assert body["status"] in {"ok", "degraded"}
        assert body["database_connected"] is True

    def test_exposes_model_state(self, client: TestClient) -> None:
        body = client.get("/api/health").json()
        assert "model_loaded" in body
        if body["model_loaded"]:
            assert body["model_name"]
            assert body["model_r2"] is not None

    def test_reports_the_active_data_source(self, client: TestClient) -> None:
        assert client.get("/api/health").json()["data_source"] == "demo"

    def test_reports_database_source_when_seeded(self, seeded_client: TestClient) -> None:
        body = seeded_client.get("/api/health").json()
        assert body["data_source"] == "database"
        assert body["property_count"] == 6

    def test_message_is_actionable(self, client: TestClient) -> None:
        assert client.get("/api/health").json()["message"]


class TestDocsAndErrors:
    def test_openapi_schema_is_served(self, client: TestClient) -> None:
        assert client.get("/openapi.json").status_code == 200

    def test_swagger_ui_is_served(self, client: TestClient) -> None:
        assert client.get("/docs").status_code == 200

    def test_unknown_route_uses_the_error_envelope(self, client: TestClient) -> None:
        response = client.get("/api/does-not-exist")
        assert response.status_code == 404
        assert response.json()["error"]["code"] == "not_found"

    def test_responses_carry_a_request_id(self, client: TestClient) -> None:
        assert client.get("/api/health").headers.get("X-Request-ID")

    def test_inbound_request_id_is_preserved(self, client: TestClient) -> None:
        response = client.get("/api/health", headers={"X-Request-ID": "trace-abc-123"})
        assert response.headers["X-Request-ID"] == "trace-abc-123"
