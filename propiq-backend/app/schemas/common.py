"""Shared response models."""

from __future__ import annotations

from typing import Any

from pydantic import BaseModel, ConfigDict, Field


class HealthResponse(BaseModel):
    """Liveness and readiness signal for the API."""

    model_config = ConfigDict(protected_namespaces=())

    status: str = Field(..., description="'ok' when the service can serve traffic")
    app: str
    version: str
    environment: str
    model_loaded: bool
    model_name: str | None = None
    model_r2: float | None = None
    database_connected: bool
    property_count: int
    data_source: str = Field(..., description="'database' or 'demo'")
    message: str


class ErrorBody(BaseModel):
    code: str
    message: str
    details: Any | None = None
    request_id: str | None = None


class ErrorResponse(BaseModel):
    """The envelope every error in this API is returned in."""

    error: ErrorBody


class RootResponse(BaseModel):
    name: str
    version: str
    description: str
    docs: str
    health: str
    endpoints: dict[str, str]
