"""
Authentication middleware -- JWT validation on every request.
"""

import logging

from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint
from starlette.requests import Request
from starlette.responses import JSONResponse, Response

from app import security as _security
from app.core.jwt_blacklist import is_jwt_revoked

logger = logging.getLogger(__name__)

# Paths that don't need authentication
PUBLIC_PATHS = {
    "/",
    "/health",
    "/healthz",
    "/readyz",
    "/docs",
    "/openapi.json",
    "/redoc",
    "/favicon.ico",
    "/code",
}

# Paths that are public when matched by prefix
PUBLIC_PREFIXES = [
    "/static/",
    "/api/v1/auth/",
    "/api/v1/auth",
    "/api/v1/payments/alipay/notify",
    "/api/v1/payments/wechat/notify",
    "/cozeZhsApi/",
    "/auth/",
    "/ai/login/",
    "/ai/agent/",
    "/ai/bot/",
    "/ai/chat/",
    "/ai/user/",
]

# 路径别名映射 (兼容旧版前缀)
_LEGACY_PATH_ALIASES = {
    "/cozeZhsApi/": "/api/v1/",
    "/auth/": "/api/v1/auth/",
    "/ai/login/pwd/": "/api/v1/auth/",
    "/ai/agent/": "/api/v1/agents/",
    "/ai/bot/": "/api/v1/bots/",
    "/ai/chat/": "/api/v1/chat/",
    "/ai/user/": "/api/v1/user/",
    "/code": "/api/v1/auth/captcha",
}


def _normalize_path(path: str) -> str:
    """将历史路径别名映射到当前 /api/v1 路径."""
    for old, new in _LEGACY_PATH_ALIASES.items():
        if path.startswith(old):
            return new + path[len(old) :]
    return path


def _is_public(path: str) -> bool:
    """判断请求路径是否为公开路径(白名单)."""
    if path in PUBLIC_PATHS:
        return True
    return any(path.startswith(p) for p in PUBLIC_PREFIXES)


# Paths that need auth but skip token-in-url (only header-based)
AUTH_REQUIRED_PATHS = {
    "/api/v1/agents",
    "/api/v1/bots",
    "/api/v1/chat",
    "/api/v1/payments",
    "/api/v1/user/",
    "/api/v1/finance",
    "/api/v1/courses",
    "/api/v1/system",
    "/api/v1/resource",
    "/api/v1/mcp",
    "/api/v1/content",
    "/api/v1/ai/",
    "/api/v1/tools",
    "/api/v1/ws/",
}


class AuthMiddleware(BaseHTTPMiddleware):
    """Validate JWT on every request and attach user info to state."""

    async def dispatch(self, request: Request, call_next: RequestResponseEndpoint) -> Response:
        path = request.url.path

        # Skip public paths
        if _is_public(path):
            return await call_next(request)

        # Extract token from Authorization header
        auth_header = request.headers.get("authorization", "")
        token = None
        if auth_header.startswith("Bearer "):
            token = auth_header[7:]

        # Bug-11 修复: 兜底从 query string (?token=xxx) 取 token
        if not token:
            token = request.query_params.get("token")

        if not token:
            return JSONResponse(
                status_code=401,
                content={"detail": "Missing authentication token", "code": "UNAUTHORIZED"},
            )

        # Use _security.decode_access_token so tests can monkeypatch it
        payload = _security.decode_access_token(token)
        if payload is None:
            return JSONResponse(
                status_code=401,
                content={"detail": "Invalid or expired token", "code": "TOKEN_EXPIRED"},
            )

        # 检查 JWT 黑名单 (Bug-26: 登出后 token 立即失效)
        if is_jwt_revoked(token):
            return JSONResponse(
                status_code=401,
                content={"detail": "Token has been revoked", "code": "TOKEN_REVOKED"},
            )

        # Attach user info to request state
        user_uuid = payload.get("sub")
        request.state.user_uuid = user_uuid
        request.state.user_id = user_uuid
        request.state.jwt_exp = payload.get("exp")
        request.state.jwt_iat = payload.get("iat")
        request.state.jwt_payload = payload

        # 注入到 ContextVar, 让业务侧 _current_user_id() / current_user_id_or_guest() 也能读到
        try:
            from app.core.current_user import set_current_user_id

            set_current_user_id(user_uuid or "guest")
        except Exception as e:
            logger.debug("注入当前用户到 ContextVar 失败: %s", e)

        response = await call_next(request)
        return response
