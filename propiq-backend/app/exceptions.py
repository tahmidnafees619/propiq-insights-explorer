"""Domain exceptions and the handlers that turn them into JSON responses.

Every error the API returns uses the same envelope:

    {"error": {"code": "...", "message": "...", "details": ..., "request_id": "..."}}

A predictable shape means the frontend has exactly one error path to handle
rather than one per status code.
"""

from __future__ import annotations

from typing import Any

from fastapi import FastAPI, Request, status
from fastapi.encoders import jsonable_encoder
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

from app.logging_config import get_logger

logger = get_logger(__name__)


class PropIQError(Exception):
    """Base class for errors this application raises deliberately."""

    status_code: int = status.HTTP_500_INTERNAL_SERVER_ERROR
    code: str = "internal_error"
    message: str = "An unexpected error occurred."

    def __init__(self, message: str | None = None, details: Any = None) -> None:
        self.message = message or self.message
        self.details = details
        super().__init__(self.message)


class ResourceNotFoundError(PropIQError):
    status_code = status.HTTP_404_NOT_FOUND
    code = "not_found"
    message = "The requested resource does not exist."


class ModelNotReadyError(PropIQError):
    status_code = status.HTTP_503_SERVICE_UNAVAILABLE
    code = "model_unavailable"
    message = "The prediction model is not loaded. Run scripts/train_model.py."


class InvalidInputError(PropIQError):
    status_code = 422
    code = "invalid_input"
    message = "The supplied property attributes are not valid."


def _envelope(
    code: str,
    message: str,
    status_code: int,
    request: Request,
    details: Any = None,
) -> JSONResponse:
    body: dict[str, Any] = {"code": code, "message": message}
    if details is not None:
        body["details"] = jsonable_encoder(details)

    request_id = getattr(request.state, "request_id", None)
    if request_id:
        body["request_id"] = request_id

    return JSONResponse(status_code=status_code, content={"error": body})


def register_exception_handlers(app: FastAPI) -> None:
    """Attach every handler to the application."""

    @app.exception_handler(PropIQError)
    async def _handle_domain_error(request: Request, exc: PropIQError) -> JSONResponse:
        logger.warning(
            "domain error", extra={"code": exc.code, "path": request.url.path}
        )
        return _envelope(exc.code, exc.message, exc.status_code, request, exc.details)

    @app.exception_handler(RequestValidationError)
    async def _handle_validation_error(
        request: Request, exc: RequestValidationError
    ) -> JSONResponse:
        # Flatten pydantic's output into something a form can map to fields.
        details = [
            {
                "field": ".".join(str(part) for part in err["loc"][1:]) or "body",
                "message": err["msg"],
                "type": err["type"],
            }
            for err in exc.errors()
        ]
        return _envelope(
            "validation_error",
            "One or more fields failed validation.",
            422,
            request,
            details,
        )

    @app.exception_handler(StarletteHTTPException)
    async def _handle_http_exception(
        request: Request, exc: StarletteHTTPException
    ) -> JSONResponse:
        code = {
            404: "not_found",
            405: "method_not_allowed",
            401: "unauthorized",
            403: "forbidden",
        }.get(exc.status_code, "http_error")
        return _envelope(code, str(exc.detail), exc.status_code, request)

    @app.exception_handler(Exception)
    async def _handle_unexpected(request: Request, exc: Exception) -> JSONResponse:
        logger.exception("unhandled exception", extra={"path": request.url.path})
        return _envelope(
            "internal_error",
            "An unexpected error occurred. Please try again.",
            status.HTTP_500_INTERNAL_SERVER_ERROR,
            request,
        )
