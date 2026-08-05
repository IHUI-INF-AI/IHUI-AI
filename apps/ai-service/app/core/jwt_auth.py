"""JWT 验证中间件。

与 apps/api 共享 JWT_SECRET，验证 access token 的签名与过期时间。
未配置 jwt_secret 时跳过验证（开发环境降级）。
"""

import logging
from typing import Any, Awaitable, Callable, Optional, cast

import jwt
from fastapi import Request, HTTPException
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import JSONResponse, Response

from app.core.config import settings

logger = logging.getLogger(__name__)

PUBLIC_PATHS = tuple(p.strip() for p in settings.jwt_public_paths.split(",") if p.strip())


class JWTAuthMiddleware(BaseHTTPMiddleware):
    """验证 Authorization: Bearer <token> 的 JWT 签名。

    - 未配置 jwt_secret 时跳过（开发环境）
    - 白名单路径跳过（health/metrics/legacy）
    - 验证失败返回 401
    - 验证成功将 userId/roleId 注入 request.state
    """

    async def dispatch(
        self, request: Request, call_next: Callable[[Request], Awaitable[Response]]
    ) -> Response:
        if not settings.jwt_secret:
            # 生产环境 fail-fast:jwt_secret 为空是严重配置错误,拒绝所有请求
            # 开发环境(node_env == "development")允许跳过验证
            if settings.node_env == "development":
                return await call_next(request)
            logger.error(
                "[security] JWT_SECRET 未配置但 node_env=%s,拒绝请求(fail-closed)",
                settings.node_env,
            )
            return JSONResponse(
                status_code=500,
                content={
                    "code": 500,
                    "message": "服务端安全配置错误(JWT_SECRET 缺失),拒绝服务",
                },
            )

        path = request.url.path
        # 2026-08-01 P1 安全修复:startswith 前缀匹配导致 /api/health 可绕过 /api/health-admin 等,
        # 改为:非目录路径(不以 / 结尾)用精确匹配,目录路径(以 / 结尾)用前缀匹配。
        if path in PUBLIC_PATHS or any(path.startswith(p) for p in PUBLIC_PATHS if p.endswith("/")):
            return await call_next(request)

        if request.method == "OPTIONS":
            return await call_next(request)

        auth_header = request.headers.get("Authorization", "")
        if not auth_header.startswith("Bearer "):
            return JSONResponse(
                status_code=401,
                content={"code": 401, "message": "Authentication required"},
            )

        token = auth_header[7:].strip()
        payload = self._verify_token(token)
        if payload is None:
            return JSONResponse(
                status_code=401,
                content={"code": 401, "message": "Invalid or expired token"},
            )

        if payload.get("type") == "refresh":
            return JSONResponse(
                status_code=401,
                content={"code": 401, "message": "Refresh token cannot be used as access token"},
            )

        # 兼容 apps/api 的 JWT payload:apps/api 用 setSubject(userId) 写入 sub 字段,
        # 也可能直接写 userId 字段(由 issueTokenPair 不同实现产生)。
        # 优先读 sub(JWT RFC 7519 标准),其次 userId(老格式)。
        user_id = payload.get("sub") or payload.get("userId")
        role_id = payload.get("roleId", 0)
        request.state.user_id = user_id
        request.state.role_id = role_id
        request.state.jwt_payload = payload

        return await call_next(request)

    @staticmethod
    def _verify_token(token: str) -> Optional[dict[str, Any]]:
        try:
            payload = jwt.decode(
                token,
                settings.jwt_secret,
                algorithms=["HS256"],
                issuer=settings.jwt_issuer,
                options={"verify_aud": False},
            )
            if payload.get("type") and payload["type"] != "access":
                return None
            return payload
        except jwt.ExpiredSignatureError:
            logger.debug("JWT expired")
            return None
        except jwt.InvalidTokenError as e:
            logger.debug("JWT invalid: %s", e)
            return None


async def get_current_user_id(request: Request) -> str:
    """FastAPI 依赖项：获取当前用户 ID。"""
    user_id = getattr(request.state, "user_id", None)
    if not user_id:
        raise HTTPException(status_code=401, detail="Not authenticated")
    return cast(str, user_id)


def verify_access_token(token: str) -> Optional[dict[str, Any]]:
    """模块级 access token 校验(供 WebSocket 握手等非 HTTP 场景手动调用)。

    - 与 JWTAuthMiddleware._verify_token 同规则:HS256 + issuer + type=access(拒绝 refresh/challenge)。
    - 返回 payload;无效/过期返回 None。
    """
    if not settings.jwt_secret:
        return None
    try:
        payload = jwt.decode(
            token,
            settings.jwt_secret,
            algorithms=["HS256"],
            issuer=settings.jwt_issuer,
            options={"verify_aud": False},
        )
        # P1-2(2026-08-05):type 必须是 access,拒绝 refresh 与 challenge(2FA 短期 token)
        if payload.get("type") and payload["type"] != "access":
            return None
        return payload
    except jwt.ExpiredSignatureError:
        logger.debug("JWT expired")
        return None
    except jwt.InvalidTokenError as e:
        logger.debug("JWT invalid: %s", e)
        return None
