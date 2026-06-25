"""Coze OAuth 路由 (FastAPI).

适配新项目架构: FastAPI + httpx + loguru, async/await 风格.
对应历史实现 coze_zhs_py/api/oauth_auth.py.

提供 4 种 OAuth 模式:
- device: 设备码授权
- web: Web 授权码流程
- pkce: PKCE 扩展授权码流程
- jwt: JWT 授权 (最常用, 服务端直接签发)

端点:
- GET  /coze/oauth/authorize  获取授权 URL (支持 device/web/pkce/jwt 四种模式)
- POST /coze/oauth/token      获取 access_token
- POST /coze/oauth/refresh    刷新 token
- POST /coze/oauth/jwt        直接获取 JWT access_token (最常用)
"""

import secrets
from typing import Optional

from fastapi import APIRouter, Query
from loguru import logger
from pydantic import BaseModel

from app.schemas.common import error, success
from app.utils.coze_auth_utils import get_coze_access_token, load_coze_oauth_config
from app.utils.coze_oauth_apps import (
    DeviceOAuthApp,
    JWTOAuthApp,
    PKCEOAuthApp,
    WebOAuthApp,
)

router = APIRouter(prefix="/coze/oauth", tags=["coze-oauth"])

# 支持的 OAuth 模式
_OAUTH_TYPES = ("device", "web", "pkce", "jwt")


# ---------------------------------------------------------------------------
# 请求体模型
# ---------------------------------------------------------------------------


class DeviceAuthorizeBody(BaseModel):
    """设备码授权请求."""

    workspace_id: Optional[str] = None
    base_url: Optional[str] = None


class WebAuthorizeBody(BaseModel):
    """Web 授权请求."""

    client_id: Optional[str] = None
    client_secret: Optional[str] = None
    redirect_uri: str
    state: Optional[str] = None
    scope: Optional[str] = None
    base_url: Optional[str] = None


class PKCEAuthorizeBody(BaseModel):
    """PKCE 授权请求."""

    client_id: Optional[str] = None
    redirect_uri: str
    code_verifier: Optional[str] = None
    code_challenge_method: str = "S256"
    state: Optional[str] = None
    scope: Optional[str] = None
    base_url: Optional[str] = None


class TokenBody(BaseModel):
    """获取 access_token 请求."""

    type: str = "jwt"
    # device
    device_code: Optional[str] = None
    # web
    code: Optional[str] = None
    redirect_uri: Optional[str] = None
    client_id: Optional[str] = None
    client_secret: Optional[str] = None
    # pkce
    code_verifier: Optional[str] = None
    # jwt
    user_uuid: Optional[str] = None
    scope: Optional[str] = None
    ttl: Optional[int] = None
    force_refresh: bool = False
    base_url: Optional[str] = None


class RefreshBody(BaseModel):
    """刷新 token 请求."""

    type: str = "jwt"
    refresh_token: Optional[str] = None
    client_id: Optional[str] = None
    client_secret: Optional[str] = None
    user_uuid: Optional[str] = None
    base_url: Optional[str] = None


class JWTBody(BaseModel):
    """直接获取 JWT access_token 请求 (最常用)."""

    user_uuid: Optional[str] = None
    scope: Optional[str] = None
    ttl: Optional[int] = None
    force_refresh: bool = False


# ---------------------------------------------------------------------------
# GET /authorize - 获取授权 URL
# ---------------------------------------------------------------------------


@router.get("/authorize", summary="获取 Coze 授权 URL")
async def authorize(
    type: str = Query("jwt", description="OAuth 模式: device/web/pkce/jwt"),
    redirect_uri: Optional[str] = Query(None, description="回调地址 (web/pkce 必填)"),
    state: Optional[str] = Query(None, description="CSRF state"),
    scope: Optional[str] = Query(None, description="授权范围"),
    workspace_id: Optional[str] = Query(None, description="工作空间 ID (device 模式)"),
    code_verifier: Optional[str] = Query(None, description="PKCE code_verifier"),
    code_challenge_method: str = Query("S256", description="PKCE challenge 方法"),
    base_url: Optional[str] = Query(None, description="Coze API base URL"),
):
    """获取授权 URL (支持 device/web/pkce/jwt 四种模式).

    - jwt: 直接返回提示 (JWT 模式无需授权 URL, 走 /coze/oauth/jwt)
    - device: 返回 device_code 与用户验证 URL
    - web: 返回授权页 URL
    - pkce: 返回授权页 URL (含 code_challenge)
    """
    if type not in _OAUTH_TYPES:
        return error("不支持的 type, 可选: " + ",".join(_OAUTH_TYPES), code=400)

    try:
        if type == "jwt":
            # JWT 模式无需授权 URL, 提示直接调用 /coze/oauth/jwt
            return success(
                {
                    "type": "jwt",
                    "message": "JWT 模式无需授权 URL, 请直接 POST /coze/oauth/jwt 获取 access_token",
                }
            )

        if type == "device":
            app = DeviceOAuthApp(base_url=base_url)
            data = await app.get_device_code(workspace_id=workspace_id)
            return success(data)

        if type == "web":
            if not redirect_uri:
                return error("web 模式需要 redirect_uri", code=400)
            app = WebOAuthApp(client_id=None, base_url=base_url)
            st = state or secrets.token_urlsafe(16)
            url = app.get_oauth_url(redirect_uri=redirect_uri, state=st, scope=scope)
            return success({"auth_url": url, "state": st})

        # pkce
        if not redirect_uri:
            return error("pkce 模式需要 redirect_uri", code=400)
        app = PKCEOAuthApp(base_url=base_url)
        verifier = code_verifier or app.generate_code_verifier()
        st = state or secrets.token_urlsafe(16)
        url = app.get_oauth_url(
            redirect_uri=redirect_uri,
            code_verifier=verifier,
            code_challenge_method=code_challenge_method,
            state=st,
            scope=scope,
        )
        return success(
            {
                "auth_url": url,
                "state": st,
                "code_verifier": verifier,
                "code_challenge_method": code_challenge_method,
            }
        )
    except Exception as e:
        logger.error("Coze OAuth authorize 失败 (type={}): {}", type, e)
        return error("授权失败: " + str(e))


# ---------------------------------------------------------------------------
# POST /token - 获取 access_token
# ---------------------------------------------------------------------------


@router.post("/token", summary="获取 Coze access_token")
async def token(body: TokenBody):
    """获取 access_token (根据 type 分发到对应 OAuth App)."""
    if body.type not in _OAUTH_TYPES:
        return error("不支持的 type, 可选: " + ",".join(_OAUTH_TYPES), code=400)

    try:
        if body.type == "jwt":
            # JWT 模式: 复用 get_coze_access_token (带缓存)
            access_token = await get_coze_access_token(
                user_uuid=body.user_uuid,
                force_refresh=body.force_refresh,
            )
            if not access_token:
                return error("获取 JWT access_token 失败")
            return success(
                {
                    "access_token": access_token,
                    "token_type": "Bearer",
                    "expires_in": body.ttl or 86399,
                }
            )

        if body.type == "device":
            if not body.device_code:
                return error("device 模式需要 device_code", code=400)
            app = DeviceOAuthApp(client_id=body.client_id, base_url=body.base_url)
            result = await app.get_access_token(device_code=body.device_code)
            return success(result.to_dict())

        if body.type == "web":
            if not body.code or not body.redirect_uri:
                return error("web 模式需要 code 与 redirect_uri", code=400)
            app = WebOAuthApp(
                client_id=body.client_id,
                client_secret=body.client_secret,
                base_url=body.base_url,
            )
            result = await app.get_access_token(code=body.code, redirect_uri=body.redirect_uri)
            return success(result.to_dict())

        # pkce
        if not body.code or not body.redirect_uri or not body.code_verifier:
            return error("pkce 模式需要 code, redirect_uri, code_verifier", code=400)
        app = PKCEOAuthApp(client_id=body.client_id, base_url=body.base_url)
        result = await app.get_access_token(
            redirect_uri=body.redirect_uri,
            code=body.code,
            code_verifier=body.code_verifier,
        )
        return success(result.to_dict())
    except Exception as e:
        logger.error("Coze OAuth token 失败 (type={}): {}", body.type, e)
        return error("获取 token 失败: " + str(e))


# ---------------------------------------------------------------------------
# POST /refresh - 刷新 token
# ---------------------------------------------------------------------------


@router.post("/refresh", summary="刷新 Coze token")
async def refresh(body: RefreshBody):
    """刷新 token (根据 type 分发)."""
    if body.type not in _OAUTH_TYPES:
        return error("不支持的 type, 可选: " + ",".join(_OAUTH_TYPES), code=400)

    try:
        if body.type == "jwt":
            # JWT 流程无 refresh_token, 重新签发
            access_token = await get_coze_access_token(
                user_uuid=body.user_uuid,
                force_refresh=True,
            )
            if not access_token:
                return error("刷新 JWT access_token 失败")
            return success(
                {
                    "access_token": access_token,
                    "token_type": "Bearer",
                    "expires_in": 86399,
                }
            )

        if not body.refresh_token:
            return error("需要 refresh_token", code=400)

        if body.type == "device":
            app = DeviceOAuthApp(client_id=body.client_id, base_url=body.base_url)
        elif body.type == "web":
            app = WebOAuthApp(
                client_id=body.client_id,
                client_secret=body.client_secret,
                base_url=body.base_url,
            )
        else:  # pkce
            app = PKCEOAuthApp(client_id=body.client_id, base_url=body.base_url)

        result = await app.refresh_access_token(body.refresh_token)
        return success(result.to_dict())
    except Exception as e:
        logger.error("Coze OAuth refresh 失败 (type={}): {}", body.type, e)
        return error("刷新 token 失败: " + str(e))


# ---------------------------------------------------------------------------
# POST /jwt - 直接获取 JWT access_token (最常用)
# ---------------------------------------------------------------------------


@router.post("/jwt", summary="直接获取 Coze JWT access_token (最常用)")
async def jwt_token(body: JWTBody):
    """直接获取 JWT access_token (服务端 RS256 签发, 带内存缓存).

    适用于后端服务调用 Coze OpenAPI 的场景, 无需用户交互.
    """
    try:
        app = JWTOAuthApp()
        result = await app.get_access_token(
            user_uuid=body.user_uuid,
            scope=body.scope,
            ttl=body.ttl,
            force_refresh=body.force_refresh,
        )
        return success(result.to_dict())
    except ValueError as e:
        logger.error("Coze JWT token 配置错误: {}", e)
        return error(str(e), code=400)
    except Exception as e:
        logger.error("Coze JWT token 获取失败: {}", e)
        return error("获取 JWT access_token 失败: " + str(e))


# ---------------------------------------------------------------------------
# GET /config - 查看当前 OAuth 配置 (脱敏)
# ---------------------------------------------------------------------------


@router.get("/config", summary="查看 Coze OAuth 配置 (脱敏)")
def config():
    """查看当前生效的 OAuth 配置 (敏感字段脱敏)."""
    cfg = load_coze_oauth_config()
    if not cfg:
        return error("OAuth 配置不可用")
    # 脱敏: private_key 只返回是否配置
    safe = {
        "client_type": cfg.get("client_type"),
        "client_id": cfg.get("client_id"),
        "coze_www_base": cfg.get("coze_www_base"),
        "coze_api_base": cfg.get("coze_api_base"),
        "public_key_id": cfg.get("public_key_id"),
        "private_key_configured": bool(cfg.get("private_key")),
    }
    return success(safe)
