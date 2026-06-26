"""标准化全局异常处理器.

统一所有 API 异常为 {code, msg, data} 格式响应, 与 ApiResponse 一致.
错误码: 0 成功, 4xxxxx 客户端, 5xxxxx 服务端, 9xxxxx 业务.
"""

from __future__ import annotations

import html
import traceback
from typing import Any

from fastapi import HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from loguru import logger
from sqlalchemy.exc import (
    DataError,
    IntegrityError,
    OperationalError,
    SQLAlchemyError,
)
from starlette.exceptions import HTTPException as StarletteHTTPException

from app.schemas.error_codes import ErrorCode, http_status_for


def _err_response(
    code: str,
    msg: str,
    status_code: int = 500,
    data: Any = None,
    headers: dict | None = None,
    accept_language: str | None = None,
) -> JSONResponse:
    """统一错误响应格式.

    Args:
        code: 业务错误码
        msg: 显式消息 (若提供则优先使用, 否则用 i18n 翻译 code)
        accept_language: Accept-Language header, 用于 i18n 选语种
    """
    from app.schemas.i18n import t as _i18n_t

    # 如果 msg 是 error code 形式 (如 "InternalError"), 用 i18n 翻译
    final_msg = msg
    if code and (not msg or msg == "Error" or msg.startswith("Error:")):
        final_msg = _i18n_t(code, accept_language)
    return JSONResponse(
        status_code=status_code,
        content={"code": code, "msg": final_msg, "data": data},
        headers=headers,
    )


# ---------- HTTPException ----------
def http_exception_handler(request: Request, exc: HTTPException) -> JSONResponse:
    """FastAPI HTTPException → 统一响应. 业务码由 HTTP 状态码自动映射."""
    logger.warning(f"HTTP {exc.status_code} | {request.method} {request.url.path} | {exc.detail}")
    # 把 HTTP 状态码映射到标准业务码 (e.g. 401 -> 401000, 404 -> 404000)
    try:
        biz_code = ErrorCode(f"{exc.status_code}000").value
    except ValueError:
        biz_code = str(exc.status_code)
    return _err_response(
        code=biz_code,
        msg=str(exc.detail) if exc.detail else "Error",
        status_code=exc.status_code,
        headers=getattr(exc, "headers", None),
        accept_language=request.headers.get("accept-language"),
    )


# ---------- 验证错误 ----------
def validation_exception_handler(request: Request, exc: RequestValidationError) -> JSONResponse:
    """Pydantic 验证错误 → 详细字段错误信息."""
    errors = []
    for e in exc.errors():
        loc = ".".join(str(x) for x in e.get("loc", []))
        errors.append(
            {
                "field": loc,
                "message": e.get("msg", ""),
                "type": e.get("type", ""),
            }
        )
    logger.warning(f"Validation error | {request.method} {request.url.path} | {errors}")
    return _err_response(
        code=ErrorCode.PARAM_INVALID.value,
        msg="请求参数验证失败",
        status_code=422,
        data=errors,
    )


# ---------- SQLAlchemy 错误 ----------
def sqlalchemy_exception_handler(request: Request, exc: SQLAlchemyError) -> JSONResponse:
    """数据库错误 → 友好提示. 错误码使用标准 ErrorCode 枚举."""
    if isinstance(exc, IntegrityError):
        code = ErrorCode.CONFLICT.value
        msg = "数据已存在或违反完整性约束"
        status_code = 409
    elif isinstance(exc, OperationalError):
        code = ErrorCode.SERVICE_UNAVAILABLE.value
        msg = "数据库连接失败, 请稍后重试"
        status_code = 503
    elif isinstance(exc, DataError):
        code = ErrorCode.PARAM_INVALID.value
        msg = "请求数据格式错误"
        status_code = 400
    else:
        code = ErrorCode.DB_ERROR.value
        msg = "数据库操作失败"
        status_code = 500

    logger.error(f"DB error | {request.method} {request.url.path} | " f"{type(exc).__name__}: {str(exc)[:200]}")
    return _err_response(code=code, msg=msg, status_code=status_code)


# ---------- 未捕获异常 ----------
def unhandled_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    """所有未处理异常 → 500 响应, 详细日志记录 traceback."""
    tb = traceback.format_exception(type(exc), exc, exc.__traceback__)
    logger.error(
        f"Unhandled exception | {request.method} {request.url.path} | " f"{type(exc).__name__}: {exc}\n{''.join(tb)}"
    )
    return _err_response(
        code=ErrorCode.INTERNAL_ERROR.value,
        msg="服务器内部错误, 请稍后重试",
        status_code=500,
    )


# ---------- 业务异常基类 ----------
class BusinessException(HTTPException):
    """业务异常基类 - 直接抛出会被全局处理器捕获并格式化响应.

    用法:
        raise BusinessException(code=ErrorCode.INSUFFICIENT_BALANCE, msg="余额不足")
    """

    def __init__(
        self,
        code: str | ErrorCode = ErrorCode.INTERNAL_ERROR,
        msg: str = "Error",
        data: Any = None,
    ):
        code_value = code.value if isinstance(code, ErrorCode) else str(code)
        self.code = code_value
        self.msg = msg
        self.data = data
        self.status_code = http_status_for(code)
        super().__init__(status_code=self.status_code, detail=msg)


def business_exception_handler(request: Request, exc: BusinessException) -> JSONResponse:
    """业务异常处理 - 返回 {code, msg, data} 三元组."""
    logger.info(f"Business error | {request.method} {request.url.path} | " f"{exc.code}: {exc.msg}")
    return _err_response(code=exc.code, msg=exc.msg, status_code=exc.status_code, data=exc.data)


# ---------- 404 兜底 ----------
async def not_found_handler(request: Request, exc: StarletteHTTPException) -> JSONResponse:
    """404 路由不存在 → 友好提示. 浏览器请求返回 HTML, API 请求返回 JSON."""
    path = request.url.path
    accept = request.headers.get("accept", "")

    # API 请求或显式要求 JSON → 统一 JSON 格式
    if path.startswith("/api/") or "application/json" in accept:
        return _err_response(
            code=ErrorCode.NOT_FOUND.value,
            msg=f"路径不存在: {request.method} {path}",
            status_code=404,
        )

    # 浏览器访问 → 返回 404.html 静态页
    # _maybe_html_error 是同步函数 (返回 FileResponse/HTMLResponse/JSONResponse),
    # 不能用 await 调用, 否则 TypeError: object FileResponse can't be used in 'await' expression
    return _maybe_html_error(request, 404, ErrorCode.NOT_FOUND.value, f"路径不存在: {request.method} {path}")


# ---------- 通用 HTML 错误页助手 ----------
def _maybe_html_error(request: Request, status_code: int, code: str, msg: str):
    """根据 Accept 头决定返回 JSON 或 HTML."""
    from pathlib import Path

    from fastapi.responses import FileResponse, HTMLResponse, JSONResponse

    accept = request.headers.get("accept", "")
    path = request.url.path

    if path.startswith("/api/") or "application/json" in accept:
        return JSONResponse(
            status_code=status_code,
            content={"code": code, "msg": msg, "data": None},
        )

    # 浏览器 → 尝试返回对应错误页
    # 静态目录约定: app/static/errors/{status_code}.html
    static_dir = Path(__file__).resolve().parent.parent / "static"
    err_page = static_dir / "errors" / f"{status_code}.html"
    if err_page.exists():
        return FileResponse(str(err_page), status_code=status_code)

    return HTMLResponse(
        status_code=status_code,
        content=f'<!DOCTYPE html><html><body><h1>{status_code}</h1><p>{html.escape(msg)}</p></body></html>',
    )


def register_exception_handlers(app) -> None:
    """注册所有全局异常处理器 (在 FastAPI app 创建后调用)."""
    app.add_exception_handler(BusinessException, business_exception_handler)
    app.add_exception_handler(HTTPException, http_exception_handler)
    app.add_exception_handler(StarletteHTTPException, not_found_handler)
    app.add_exception_handler(RequestValidationError, validation_exception_handler)
    app.add_exception_handler(SQLAlchemyError, sqlalchemy_exception_handler)
    app.add_exception_handler(Exception, unhandled_exception_handler)
    logger.info("[Exception] All global exception handlers registered")
