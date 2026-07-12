"""JWT 验证中间件。

与 apps/api 共享 JWT_SECRET，验证 access token 的签名与过期时间。
未配置 jwt_secret 时跳过验证（开发环境降级）。
"""

import logging
from typing import Optional

import jwt
from fastapi import Request, HTTPException
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import JSONResponse

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

    async def dispatch(self, request: Request, call_next):
        if not settings.jwt_secret:
            return await call_next(request)

        path = request.url.path
        if any(path.startswith(p) for p in PUBLIC_PATHS):
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

        request.state.user_id = payload.get("userId")
        request.state.role_id = payload.get("roleId", 0)
        request.state.jwt_payload = payload

        return await call_next(request)

    @staticmethod
    def _verify_token(token: str) -> Optional[dict]:
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
    return user_id
