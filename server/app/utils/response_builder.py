"""
Unified API response builder.
Provides consistent JSON response format for all API endpoints.
"""

from typing import Any

from fastapi.responses import JSONResponse


class ApiResponse:
    """Build standardized API responses."""

    @staticmethod
    def success(data: Any = None, message: str = "ok", code: int = 0) -> dict:
        return {"code": code, "message": message, "data": data}

    @staticmethod
    def error(message: str, code: int = -1, data: Any = None) -> dict:
        return {"code": code, "message": message, "data": data}


def json_response(data: Any = None, message: str = "ok", code: int = 0, status_code: int = 200) -> JSONResponse:
    """Return a FastAPI JSONResponse with the standard format."""
    body = {"code": code, "message": message, "data": data}
    return JSONResponse(content=body, status_code=status_code)


def error_response(message: str, code: int = -1, status_code: int = 400) -> JSONResponse:
    """Return a FastAPI JSONResponse for errors."""
    body = {"code": code, "message": message, "data": None}
    return JSONResponse(content=body, status_code=status_code)
