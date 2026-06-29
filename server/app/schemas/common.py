"""
Common response schemas for all API endpoints.

Migrates from P1's R class and P2's AjaxResult to unified Pydantic models.
错误码标准化: 0 成功, 4xxxxx 客户端, 5xxxxx 服务端, 9xxxxx 业务.
"""

from typing import Any, Generic, TypeVar

from pydantic import BaseModel

from app.schemas.error_codes import ErrorCode, http_status_for

T = TypeVar("T")


class ApiResponse(BaseModel, Generic[T]):
    """Standard API response wrapper."""

    code: str = "0"
    msg: str = "success"
    data: T | None = None
    total: int | None = None


class PaginatedResponse(BaseModel, Generic[T]):
    """Paginated list response."""

    code: str = "0"
    msg: str = "success"
    data: list[T]
    total: int = 0
    page: int = 1
    page_size: int = 20


class PageRequest(BaseModel):
    """Pagination query parameters."""

    page: int = 1
    limit: int = 20


# ---------------------------------------------------------------------------
# Convenience functions
# ---------------------------------------------------------------------------


def success(
    data: Any = None,
    msg: str = "success",
    total: int | None = None,
    page: int | None = None,
    page_size: int | None = None,
) -> dict:
    """Create a success response dict.

    Args:
        data: 业务数据 (任意类型).
        msg: 成功消息 (默认 "success").
        total: 列表总数 (仅列表场景使用, 默认 None 不输出).
        page: 当前页码 (分页场景, 默认 None 不输出).
        page_size: 每页数量 (分页场景, 默认 None 不输出).

    Returns:
        标准响应 dict. 仅当对应参数非 None 时才包含 total/page/page_size 字段,
        保证对原有调用方完全向后兼容.
    """
    result: dict[str, Any] = {"code": ErrorCode.SUCCESS.value, "msg": msg, "data": data}
    if total is not None:
        result["total"] = total
    if page is not None:
        result["page"] = page
    if page_size is not None:
        result["page_size"] = page_size
    return result


def error(
    msg: str = "error",
    code: str | ErrorCode = ErrorCode.INTERNAL_ERROR,
) -> dict:
    """Create a standardized error response dict.

    Args:
        msg: 错误描述
        code: 业务错误码 (ErrorCode 枚举或字符串, 默认 500000)
    """
    code_value = code.value if isinstance(code, ErrorCode) else str(code)
    return {"code": code_value, "msg": msg, "data": None}


def page_result(
    data: list,
    total: int,
    page: int = 1,
    limit: int = 20,
    msg: str = "success",
) -> dict:
    """Create a paginated success response.

    统一分页响应格式:
        {
            "code": "0",
            "msg": "success",
            "data": [...],
            "total": 100,
            "page": 1,
            "limit": 20
        }
    """
    return {
        "code": ErrorCode.SUCCESS.value,
        "msg": msg,
        "data": data,
        "total": total,
        "page": page,
        "limit": limit,
    }


# 重新导出供业务直接 import
__all__ = [
    "ApiResponse",
    "ErrorCode",
    "PageRequest",
    "PaginatedResponse",
    "error",
    "http_status_for",
    "page_result",
    "success",
]
