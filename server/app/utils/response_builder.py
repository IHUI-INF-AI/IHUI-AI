"""
Unified API response builder.
Provides consistent JSON response format for all API endpoints.

2026-06-25 修复#E: 收敛到 schemas.common 标准.
  - 原本返回 {code:int, message, data} (code 默认 0 int, 字段 message)
  - 现转调 schemas.common.success/error, 返回 {code:str, msg, data} (code 默认 "0" str, 字段 msg)
  - 外部 API 签名不变 (success(data, message, code) / error(message, code, data))
  - 前端 normalizeApiResponse 已兼容 code int/str 和 msg/message, 零破坏
  - 新代码应优先直接 import app.schemas.common, 本文件仅作向后兼容入口
"""

from typing import Any

from fastapi.responses import JSONResponse

from app.schemas.common import error as _common_error
from app.schemas.common import success as _common_success


class ApiResponse:
    """Build standardized API responses.

    转调 schemas.common, 保持外部 API 签名兼容.
    """

    @staticmethod
    def success(data: Any = None, message: str = "ok", code: int = 0) -> dict:
        """成功响应.

        Args:
            data: 响应数据
            message: 消息 (映射到 schemas.common 的 msg)
            code: 业务码 (int, 0=成功; 映射到 schemas.common 的 code str)

        Returns:
            {"code": "0", "msg": "ok", "data": data}
        """
        # code int -> str (schemas.common 用 str "0")
        # message -> msg (schemas.common 用 msg 字段)
        return _common_success(data=data, msg=message)

    @staticmethod
    def error(message: str, code: int = -1, data: Any = None) -> dict:
        """错误响应.

        Args:
            message: 错误消息 (映射到 schemas.common 的 msg)
            code: 业务错误码 (int; 映射到 schemas.common 的 code str)
            data: 附加数据

        Returns:
            {"code": "<code>", "msg": "<message>", "data": None}
        """
        # code int -> str (schemas.common 用 str)
        # schemas.common.error 默认 code=500000, 这里用传入的 code (转 str)
        return _common_error(msg=message, code=str(code))


def json_response(data: Any = None, message: str = "ok", code: int = 0, status_code: int = 200) -> JSONResponse:
    """Return a FastAPI JSONResponse with the standard format.

    转调 schemas.common.success 生成 body, 包装为 JSONResponse.
    """
    body = _common_success(data=data, msg=message)
    return JSONResponse(content=body, status_code=status_code)


def error_response(message: str, code: int = -1, status_code: int = 400) -> JSONResponse:
    """Return a FastAPI JSONResponse for errors.

    转调 schemas.common.error 生成 body, 包装为 JSONResponse.
    """
    body = _common_error(msg=message, code=str(code))
    return JSONResponse(content=body, status_code=status_code)
