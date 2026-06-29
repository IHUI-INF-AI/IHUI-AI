"""
Unified API response builder.
Provides consistent JSON response format for all API endpoints.

输出统一标准格式: {"code": "0", "msg": "success", "data": ...}
兼容旧调用方: success(data, message="ok", code=0) / error(message, code=-1, data=None)
"""

from typing import Any

from fastapi.responses import JSONResponse

# 整数 code → 标准 ErrorCode 字符串映射
_INT_CODE_MAP: dict[int, str] = {
    0: "0",
    -1: "500000",
    400: "400000",
    401: "401000",
    403: "403000",
    404: "404000",
    409: "409000",
    429: "429000",
    500: "500000",
    503: "503000",
}


def _normalize_code(code: Any) -> str:
    """将整数 code 转换为 6 位字符串 ErrorCode."""
    if isinstance(code, str):
        return code
    if isinstance(code, int):
        return _INT_CODE_MAP.get(code, "500000")
    return "500000"


class ApiResponse:
    """Build standardized API responses."""

    @staticmethod
    def success(data: Any = None, message: str = "success", code: int = 0) -> dict:
        return {"code": "0", "msg": message, "data": data}

    @staticmethod
    def error(message: str, code: int = -1, data: Any = None) -> dict:
        return {"code": _normalize_code(code), "msg": message, "data": data}


def json_response(data: Any = None, message: str = "success", code: int = 0, status_code: int = 200) -> JSONResponse:
    """Return a FastAPI JSONResponse with the standard format."""
    body = {"code": "0", "msg": message, "data": data}
    return JSONResponse(content=body, status_code=status_code)


def error_response(message: str, code: int = -1, status_code: int = 400) -> JSONResponse:
    """Return a FastAPI JSONResponse for errors."""
    body = {"code": _normalize_code(code), "msg": message, "data": None}
    return JSONResponse(content=body, status_code=status_code)
