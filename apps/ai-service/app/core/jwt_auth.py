# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""JWT 验证中间件。

与 apps/api 共享 JWT_SECRET，验证 access token 的签名与过期时间。
未配置 jwt_secret 时跳过验证（开发环境降级）。
"""

import logging
from collections.abc import Awaitable, Callable
from typing import Any, cast

import jwt
from fastapi import HTTPException, Request
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import JSONResponse, Response

from app.core.config import settings

logger = logging.getLogger(__name__)

# 两条**不由部署配置决定**的边界(2026-09-21 O17 三通道实跑收口):
#  · /.well-known/* 必须匿名可读 —— A2A / OAuth 发现协议的前提,卡片内容不含内网主机与
#    密钥。部署机 .env 一旦覆盖 JWT_PUBLIC_PATHS(pydantic-settings 以 .env 为权威值),
#    代码默认值就被整体替换 ⇒ agent-card 恒 401,严格客户端拿不到凭据前无法发现能力。
#  · /api/mcp 永远不得公开 —— 它是全部 MCP 工具的 JSON-RPC 入口,O1 已把"匿名可调"定性
#    为事故,但 .env 里残留的旧条目会**静默**把这个口子重开。强制剔除 + 告警,不给配置
#    覆盖代码的机会。
_ALWAYS_PUBLIC: tuple[str, ...] = ("/.well-known/agent.json", "/.well-known/agent-card.json")


def _is_never_public(path: str) -> bool:
    return path.rstrip("/") == "/api/mcp" or path.startswith("/api/mcp/")


def _resolve_public_paths(raw: str) -> tuple[str, ...]:
    configured = [p.strip() for p in raw.split(",") if p.strip()]
    dropped = [p for p in configured if _is_never_public(p)]
    if dropped:
        logger.error(
            "[security] JWT_PUBLIC_PATHS 含 %s —— 已强制剔除(/api/mcp 不得匿名可达)",
            ",".join(dropped),
        )
    kept = [p for p in configured if not _is_never_public(p)]
    for path in _ALWAYS_PUBLIC:
        if path not in kept:
            kept.append(path)
    return tuple(kept)


PUBLIC_PATHS = _resolve_public_paths(settings.jwt_public_paths)


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
            # 前端 Next.js 代理到本服务时,内存 token 为空可能仅携带 cookie。
            # 优先读 Authorization: Bearer,兜底读 HttpOnly cookie 的 auth_token。
            cookie_token = request.cookies.get("auth_token")
            if cookie_token:
                auth_header = f"Bearer {cookie_token}"
            else:
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
    def _verify_token(token: str) -> dict[str, Any] | None:
        try:
            payload = jwt.decode(
                token,
                settings.jwt_secret,
                algorithms=["HS256"],
                issuer=settings.jwt_issuer,
                # P1-2 修复(2026-08-06):校验 aud,apps/api 签发 access token 时 aud='ihui-ai-users'
                # (packages/auth/src/jwt.ts AUDIENCE),防跨服务 token 误用。
                audience="ihui-ai-users",
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


def get_current_user_id_sync(request: Request) -> str:
    """同步版：供非依赖项上下文(内部 helper)直接取 user_id。

    与 get_current_user_id 读同一来源(request.state.user_id)，但非 async，
    可在同步函数内安全调用，避免误用协程返回值。
    """
    user_id = getattr(request.state, "user_id", None)
    if not user_id:
        raise HTTPException(status_code=401, detail="Not authenticated")
    return cast(str, user_id)


def verify_access_token(token: str) -> dict[str, Any] | None:
    """模块级 access token 校验(供 WebSocket 握手等非 HTTP 场景手动调用)。

    - 与 JWTAuthMiddleware._verify_token 同规则:
      HS256 + issuer + type=access(拒绝 refresh/challenge)。
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
            # P1-2 修复(2026-08-06):校验 aud='ihui-ai-users',防跨服务 token 误用
            audience="ihui-ai-users",
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
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
