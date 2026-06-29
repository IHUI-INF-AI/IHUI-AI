"""API 响应便捷函数 (包 ApiResponse, 旧代码兼容).

输出统一标准格式: {"code": "0", "msg": "success", "data": ...}
"""

from typing import Any

from app.utils.response_builder import ApiResponse


def success(data: Any = None, message: str = "success", code: int = 0) -> dict:
    """包装 ApiResponse.success."""
    return ApiResponse.success(data=data, message=message, code=code)


def fail(message: str, code: int = -1, data: Any = None) -> dict:
    """包装 ApiResponse.error."""
    return ApiResponse.error(message=message, code=code, data=data)


__all__ = ["ApiResponse", "fail", "success"]
