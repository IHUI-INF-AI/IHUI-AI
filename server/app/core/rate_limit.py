"""限流中间件 - 进程内令牌桶实现,零外部依赖.

默认规则(可由 settings 覆盖):
- 登录/注册: 5 次/分钟/IP
- 验证码: 10 次/分钟/IP
- 文件上传: 10 次/分钟/IP
- 支付: 10 次/分钟/IP
- SSE/流式: 30 次/分钟/IP
- admin 站内信推送 (POST): 30 次/分钟/IP (防止运维误推爆量)
- admin 站内信查询 (GET): 120 次/分钟/IP (供前端 30s 轮询红点)
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

# 路径前缀 -> (次数, 窗口秒) - 全局限流
# 注意: 顺序敏感, 更具体的前缀应放在前面 (例如 /api/admin/migration/notify 必须在 /api/admin/migration 之前)
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
    # admin/migration 通用 (兜底)
    ("/api/admin/migration", 60, 60),
)

# 路径前缀 + 方法 -> (次数, 窗口秒) - 更细粒度限流 (覆写 PATH_LIMITS)
# 用于区分 GET (前端轮询, 较宽松) vs POST (运维推送, 较严格)
METHOD_LIMITS: tuple[tuple[str, str, int, int], ...] = (
    # admin 站内信: POST 写入限流 (防误推爆量), GET 查询较宽松 (供前端 30s 轮询)
    ("/api/admin/migration/notify", "POST", 30, 60),
    ("/api/admin/migration/notify", "GET", 120, 60),
)

DEFAULT_LIMIT = (60, 60)  # 60 次 / 60 秒
WHITELIST_PATHS = ("/healthz", "/ready", "/metrics", "/openapi.json", "/docs", "/redoc")


def _match_limit(path: str, method: str) -> tuple[int, int]:
    """根据路径+方法返回 (次数, 窗口秒).

    优先级: METHOD_LIMITS (路径+方法) > PATH_LIMITS (路径) > DEFAULT_LIMIT
    """
    # 1. 路径+方法 (最细)
    for prefix, m, count, window in METHOD_LIMITS:
        if method == m and path.startswith(prefix):
            return count, window
    # 2. 路径
    for prefix, count, window in PATH_LIMITS:
        if path.startswith(prefix):
            return count, window
    return DEFAULT_LIMIT


# 进程内滑动窗口记录: {ip: {path: deque[timestamp]}}
_request_log: dict[str, dict[str, deque[float]]] = defaultdict(lambda: defaultdict(deque))


def _is_trusted_proxy(ip: str) -> bool:
    """判断 IP 是否为可信代理 (本机/内网). 用于决定是否信任 X-Forwarded-For."""
    try:
        import ipaddress

        addr = ipaddress.ip_address(ip)
        if addr.is_loopback or addr.is_private:
            return True
    except ValueError:
        pass
    return False


def _client_ip(request: Request) -> str:
    """获取客户端真实 IP.

    安全修复: 仅当直连对端是可信代理 (本机/内网) 时才解析 X-Forwarded-For,
    避免外网客户端伪造 XFF 绕过限流.
    """
    direct = request.client.host if request.client else "unknown"
    xff = request.headers.get("x-forwarded-for", "")
    if xff and _is_trusted_proxy(direct):
        parts = [p.strip() for p in xff.split(",") if p.strip()]
        for ip in reversed(parts):
            if not _is_trusted_proxy(ip):
                return ip
        return parts[0] if parts else direct
    return direct


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
        method = request.method
        limit, window = _match_limit(path, method)
        now = time.time()

        bucket = _request_log[ip][f"{method}:{path}"]
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
