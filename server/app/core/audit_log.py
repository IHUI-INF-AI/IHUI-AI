"""审计日志中间件 - 追踪关键操作 (写操作 + 敏感读).

审计范围:
- 写操作: POST / PUT / DELETE / PATCH
- 敏感读: 涉及 user_id / admin / payment / login 关键字
- 输出: 结构化 JSON 日志 (含 user, ip, method, path, status, 耗时)
- 异步: 写入 Redis Stream (有 Redis 时) 或本地文件
"""
from __future__ import annotations

import json
import logging
import time
from collections import deque
from pathlib import Path

from fastapi import Request
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import Response

logger = logging.getLogger(__name__)

# 敏感路径关键字 (含这些关键词的请求都会被审计)
SENSITIVE_KEYWORDS = (
    "login",
    "logout",
    "register",
    "password",
    "reset",
    "admin",
    "permission",
    "role",
    "payment",
    "pay",
    "refund",
    "order",
    "withdraw",
    "transfer",
    "user",
    "delete",
    "upload",
    "import",
    "export",
)

# 写操作方法
WRITE_METHODS = {"POST", "PUT", "DELETE", "PATCH"}

# 内存审计日志 (最近 N 条, 给前端展示或导出)
_AUDIT_BUFFER: deque[dict] = deque(maxlen=5000)
_AUDIT_LOG_FILE: Path | None = None


def _get_log_file() -> Path | None:
    """获取审计日志文件路径."""
    global _AUDIT_LOG_FILE
    if _AUDIT_LOG_FILE is None:
        try:
            log_dir = Path("logs")
            log_dir.mkdir(parents=True, exist_ok=True)
            _AUDIT_LOG_FILE = log_dir / "audit.log"
        except Exception:
            return None
    return _AUDIT_LOG_FILE


def _is_sensitive(path: str, method: str) -> bool:
    """是否敏感操作 (写 或 路径含敏感词)."""
    if method.upper() in WRITE_METHODS:
        return True
    p = path.lower()
    return any(kw in p for kw in SENSITIVE_KEYWORDS)


def _extract_user(request: Request) -> str:
    """从请求提取当前用户 (从 JWT). 失败返回 anonymous."""
    auth = request.headers.get("authorization", "")
    if not auth.startswith("Bearer "):
        return "anonymous"
    token = auth[7:]
    try:
        from app.security import decode_access_token

        payload = decode_access_token(token)
        if payload:
            return payload.get("sub", "anonymous")
    except Exception:
        pass
    return "anonymous"


async def _write_audit(entry: dict) -> None:
    """异步写审计日志到文件 + 内存 buffer."""
    _AUDIT_BUFFER.append(entry)
    log_file = _get_log_file()
    if log_file is None:
        return
    try:
        line = json.dumps(entry, ensure_ascii=False, default=str) + "\n"
        with log_file.open("a", encoding="utf-8") as f:
            f.write(line)
    except Exception as e:
        logger.debug(f"audit log write fail: {e}")


class AuditLogMiddleware(BaseHTTPMiddleware):
    """审计日志中间件 - 追踪关键操作."""

    def __init__(self, app, enabled: bool = True):
        super().__init__(app)
        self.enabled = enabled

    async def dispatch(self, request: Request, call_next) -> Response:
        if not self.enabled:
            return await call_next(request)

        method = request.method
        path = request.url.path

        # 跳过健康检查和 metrics (高频, 无审计价值)
        if path in ("/healthz", "/ready", "/metrics", "/favicon.ico", "/openapi.json"):
            return await call_next(request)

        if not _is_sensitive(path, method):
            return await call_next(request)

        start = time.perf_counter()
        user = _extract_user(request)
        ip = request.headers.get("x-forwarded-for", "").split(",")[0].strip() or (
            request.client.host if request.client else "unknown"
        )
        try:
            response = await call_next(request)
            status = response.status_code
        except Exception as exc:
            status = 500
            entry = {
                "ts": time.time(),
                "user": user,
                "ip": ip,
                "method": method,
                "path": path,
                "status": status,
                "duration_ms": round((time.perf_counter() - start) * 1000, 2),
                "error": str(exc)[:200],
            }
            await _write_audit(entry)
            raise

        entry = {
            "ts": time.time(),
            "user": user,
            "ip": ip,
            "method": method,
            "path": path,
            "status": status,
            "duration_ms": round((time.perf_counter() - start) * 1000, 2),
        }
        await _write_audit(entry)
        return response


def install_audit_log(app, enabled: bool = True) -> None:
    """注册审计日志中间件."""
    for mw in app.user_middleware:
        if mw.cls is AuditLogMiddleware:
            return
    app.add_middleware(AuditLogMiddleware, enabled=enabled)
    logger.info("审计日志中间件已注册")


def get_recent_audits(limit: int = 100) -> list:
    """获取最近 N 条审计日志 (供管理后台展示)."""
    return list(_AUDIT_BUFFER)[-limit:]


__all__ = [
    "SENSITIVE_KEYWORDS",
    "AuditLogMiddleware",
    "get_recent_audits",
    "install_audit_log",
]
