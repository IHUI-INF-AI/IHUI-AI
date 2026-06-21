"""限流中间件 - 进程内令牌桶实现,零外部依赖.

默认规则(可由 settings 覆盖):
- 登录/注册: 5 次/分钟/IP
- 验证码: 10 次/分钟/IP
- 文件上传: 10 次/分钟/IP
- 支付: 10 次/分钟/IP
- SSE/流式: 30 次/分钟/IP
- 默认: 60 次/分钟/IP

如需分布式限流,请改用 Redis + slowapi,本文件保留进程内 fallback.
"""
from __future__ import annotations

import logging
import time
from collections import defaultdict, deque
from collections.abc import Callable

from fastapi import Request
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware

logger = logging.getLogger(__name__)

# 路径前缀 -> (次数, 窗口秒)
PATH_LIMITS: tuple[tuple[str, int, int], ...] = (
    ("/api/v1/auth/login", 5, 60),
    ("/api/v1/auth/register", 5, 60),
    ("/api/v1/auth/captcha", 10, 60),
    ("/api/v1/auth/sms", 5, 60),
    ("/api/v1/upload", 10, 60),
    ("/api/v1/file", 10, 60),
    ("/api/v1/payment", 10, 60),
    ("/api/v1/order/pay", 10, 60),
    ("/api/v1/chat/stream", 30, 60),
    ("/api/v1/ai/stream", 30, 60),
)

DEFAULT_LIMIT = (60, 60)  # 60 次 / 60 秒
WHITELIST_PATHS = ("/healthz", "/ready", "/metrics", "/openapi.json", "/docs", "/redoc")


def _match_limit(path: str) -> tuple[int, int]:
    """根据路径返回 (次数, 窗口秒)."""
    for prefix, count, window in PATH_LIMITS:
        if path.startswith(prefix):
            return count, window
    return DEFAULT_LIMIT


# 进程内滑动窗口记录: {ip: {path: deque[timestamp]}}
_request_log: dict[str, dict[str, deque[float]]] = defaultdict(lambda: defaultdict(deque))


def _client_ip(request: Request) -> str:
    xff = request.headers.get("x-forwarded-for", "")
    if xff:
        return xff.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


def _is_whitelisted(path: str) -> bool:
    return any(path.startswith(p) for p in WHITELIST_PATHS)


class RateLimitMiddleware(BaseHTTPMiddleware):
    """FastAPI/Starlette 限流中间件."""

    def __init__(self, app, enabled: bool = True):
        super().__init__(app)
        self.enabled = enabled

    async def dispatch(self, request: Request, call_next: Callable):
        if not self.enabled:
            return await call_next(request)

        path = request.url.path
        if _is_whitelisted(path):
            return await call_next(request)

        ip = _client_ip(request)
        limit, window = _match_limit(path)
        now = time.time()

        bucket = _request_log[ip][path]
        # 清理窗口外的记录
        while bucket and now - bucket[0] > window:
            bucket.popleft()

        if len(bucket) >= limit:
            retry_after = int(window - (now - bucket[0])) if bucket else window
            logger.warning("限流触发: ip=%s path=%s limit=%d/%ds", ip, path, limit, window)
            return JSONResponse(
                status_code=429,
                content={
                    "code": "429",
                    "msg": f"请求过于频繁, 请 {retry_after}s 后再试",
                    "data": None,
                },
                headers={"Retry-After": str(retry_after)},
            )

        bucket.append(now)
        response = await call_next(request)
        response.headers["X-RateLimit-Limit"] = str(limit)
        response.headers["X-RateLimit-Remaining"] = str(max(0, limit - len(bucket)))
        return response


def install_rate_limit(app, enabled: bool = True) -> None:
    """注册限流中间件. 已包含则跳过."""
    for mw in app.user_middleware:
        if mw.cls is RateLimitMiddleware:
            return
    app.add_middleware(RateLimitMiddleware, enabled=enabled)
    logger.info("限流中间件已注册 (进程内, 路径前缀规则)")


__all__ = [
    "DEFAULT_LIMIT",
    "PATH_LIMITS",
    "RateLimitMiddleware",
    "install_rate_limit",
]
