"""Global exception handlers and error response utilities.

Provides consistent error handling across the application.
"""

import logging
import traceback
from typing import Any

from fastapi import Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from pydantic import ValidationError
from sqlalchemy.exc import IntegrityError, OperationalError, SQLAlchemyError

logger = logging.getLogger(__name__)


# Standard error codes
class ErrorCode:
    # 4xx Client errors
    VALIDATION_ERROR = "VALIDATION_ERROR"
    UNAUTHORIZED = "UNAUTHORIZED"
    FORBIDDEN = "FORBIDDEN"
    NOT_FOUND = "NOT_FOUND"
    CONFLICT = "CONFLICT"
    RATE_LIMITED = "RATE_LIMITED"
    BAD_REQUEST = "BAD_REQUEST"

    # 5xx Server errors
    INTERNAL_ERROR = "INTERNAL_ERROR"
    DATABASE_ERROR = "DATABASE_ERROR"
    EXTERNAL_SERVICE_ERROR = "EXTERNAL_SERVICE_ERROR"
    SERVICE_UNAVAILABLE = "SERVICE_UNAVAILABLE"


class APIError(Exception):
    """Base API exception with structured error response."""

    def __init__(
        self,
        message: str,
        code: str = ErrorCode.INTERNAL_ERROR,
        status_code: int = status.HTTP_500_INTERNAL_SERVER_ERROR,
        details: dict[str, Any] | None = None,
    ):
        self.message = message
        self.code = code
        self.status_code = status_code
        self.details = details or {}
        super().__init__(message)

    def to_response(self) -> dict[str, Any]:
        return {
            "code": self.code,
            "msg": self.message,
            "data": None,
            "details": self.details,
        }


class ValidationAPIError(APIError):
    """Validation error (400)."""

    def __init__(self, message: str, details: dict | None = None):
        super().__init__(
            message=message,
            code=ErrorCode.VALIDATION_ERROR,
            status_code=status.HTTP_400_BAD_REQUEST,
            details=details,
        )


class UnauthorizedError(APIError):
    """Authentication required (401)."""

    def __init__(self, message: str = "Authentication required"):
        super().__init__(
            message=message,
            code=ErrorCode.UNAUTHORIZED,
            status_code=status.HTTP_401_UNAUTHORIZED,
        )


class ForbiddenError(APIError):
    """Permission denied (403)."""

    def __init__(self, message: str = "Permission denied"):
        super().__init__(
            message=message,
            code=ErrorCode.FORBIDDEN,
            status_code=status.HTTP_403_FORBIDDEN,
        )


class NotFoundError(APIError):
    """Resource not found (404)."""

    def __init__(self, resource: str = "Resource"):
        super().__init__(
            message=f"{resource} not found",
            code=ErrorCode.NOT_FOUND,
            status_code=status.HTTP_404_NOT_FOUND,
        )


class ConflictError(APIError):
    """Resource conflict (409)."""

    def __init__(self, message: str = "Resource conflict"):
        super().__init__(
            message=message,
            code=ErrorCode.CONFLICT,
            status_code=status.HTTP_409_CONFLICT,
        )


class DatabaseError(APIError):
    """Database operation error (500)."""

    def __init__(self, message: str = "Database operation failed"):
        super().__init__(
            message=message,
            code=ErrorCode.DATABASE_ERROR,
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )


# ---------------------------------------------------------------------------
# Exception handlers
# ---------------------------------------------------------------------------


async def api_error_handler(request: Request, exc: APIError) -> JSONResponse:
    """Handle custom API errors."""
    logger.warning(f"API Error: {exc.code} - {exc.message} | Path: {request.url.path}")
    return JSONResponse(
        status_code=exc.status_code,
        content=exc.to_response(),
    )


async def validation_error_handler(request: Request, exc: RequestValidationError) -> JSONResponse:
    """Handle Pydantic validation errors."""
    errors = []
    for error in exc.errors():
        field = ".".join(str(loc) for loc in error["loc"])
        errors.append(
            {
                "field": field,
                "message": error["msg"],
                "type": error["type"],
            }
        )

    logger.warning(f"Validation Error: {len(errors)} errors | Path: {request.url.path}")

    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content={
            "code": ErrorCode.VALIDATION_ERROR,
            "msg": "Validation failed",
            "data": None,
            "errors": errors,
        },
    )


async def sqlalchemy_error_handler(request: Request, exc: SQLAlchemyError) -> JSONResponse:
    """Handle SQLAlchemy database errors."""
    logger.error(f"Database Error: {type(exc).__name__} - {str(exc)[:200]} | " f"Path: {request.url.path}")

    # Determine specific error type
    if isinstance(exc, IntegrityError):
        code = ErrorCode.CONFLICT
        message = "Data integrity violation"
        status_code = status.HTTP_409_CONFLICT
    elif isinstance(exc, OperationalError):
        code = ErrorCode.DATABASE_ERROR
        message = "Database operation failed"
        status_code = status.HTTP_503_SERVICE_UNAVAILABLE
    else:
        code = ErrorCode.DATABASE_ERROR
        message = "Database error occurred"
        status_code = status.HTTP_500_INTERNAL_SERVER_ERROR

    return JSONResponse(
        status_code=status_code,
        content={
            "code": code,
            "msg": message,
            "data": None,
        },
    )


async def generic_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    """Handle unexpected exceptions."""
    # Log full traceback
    tb = traceback.format_exc()
    logger.error(
        f"Unhandled Exception: {type(exc).__name__} | " f"Path: {request.url.path} | " f"Error: {str(exc)[:500]}"
    )
    logger.debug(f"Traceback:\n{tb}")

    # Don't expose internal error details in production
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={
            "code": ErrorCode.INTERNAL_ERROR,
            "msg": "An unexpected error occurred",
            "data": None,
        },
    )


# ---------------------------------------------------------------------------
# Exception handler registration
# ---------------------------------------------------------------------------


def register_exception_handlers(app):
    """Register all exception handlers with the FastAPI app."""
    app.add_exception_handler(APIError, api_error_handler)
    app.add_exception_handler(RequestValidationError, validation_error_handler)
    app.add_exception_handler(ValidationError, validation_error_handler)
    app.add_exception_handler(SQLAlchemyError, sqlalchemy_error_handler)
    app.add_exception_handler(Exception, generic_exception_handler)


# ---------------------------------------------------------------------------
# Convenience response functions
# ---------------------------------------------------------------------------


def success_response(
    data: Any = None,
    message: str = "success",
    code: str = "200",
) -> dict[str, Any]:
    """Create a standardized success response."""
    return {
        "code": code,
        "msg": message,
        "data": data,
    }


def error_response(
    message: str,
    code: str = ErrorCode.BAD_REQUEST,
    data: Any = None,
) -> dict[str, Any]:
    """Create a standardized error response."""
    return {
        "code": code,
        "msg": message,
        "data": data,
    }


def paginated_response(
    items: list,
    total: int,
    page: int = 1,
    page_size: int = 20,
) -> dict[str, Any]:
    """Create a standardized paginated response."""
    return {
        "code": "200",
        "msg": "success",
        "data": items,
        "total": total,
        "page": page,
        "page_size": page_size,
    }
