"""Coze OAuth App 类 (异步版本).

适配新项目架构: FastAPI + httpx + loguru, async/await 风格.
对应历史实现 coze_zhs_py/api/coze_compat.py 中的 OAuth App 类.

定义 4 种 OAuth App 类, 每个封装对应的 OAuth 流程:
- DeviceOAuthApp: 设备码授权 (device flow)
- WebOAuthApp: Web 授权码流程 (authorization_code)
- PKCEOAuthApp: PKCE 扩展授权码流程
- JWTOAuthApp: JWT 授权 (服务端直接签发, 最常用)

所有网络请求使用 httpx.AsyncClient, 配置来自 settings.COZE_*.
"""

import base64
import hashlib
import secrets
from typing import Optional
from urllib.parse import urlencode

import httpx
from loguru import logger

from app.config import settings
from app.utils.coze_auth_utils import get_coze_access_token, get_private_key

# Token 缓存有效期 (秒), 与 Coze JWT 流程一致
_DEFAULT_TTL = 86399


class _OAuthTokenResult:
    """OAuth 令牌结果 (轻量 dict 包装, 便于路由层序列化)."""

    def __init__(self, data: dict):
        self.access_token: str = data.get("access_token", "")
        self.token_type: str = data.get("token_type", "Bearer")
        self.expires_in: int = data.get("expires_in", _DEFAULT_TTL)
        self.refresh_token: Optional[str] = data.get("refresh_token")
        self.scope: Optional[str] = data.get("scope")
        self.raw: dict = data

    def to_dict(self) -> dict:
        return {
            "access_token": self.access_token,
            "token_type": self.token_type,
            "expires_in": self.expires_in,
            "refresh_token": self.refresh_token,
            "scope": self.scope,
        }


class DeviceOAuthApp:
    """设备码授权 (Device Flow).

    适用于无键盘/无浏览器的设备: 先获取 device_code 与用户验证 URL,
    用户在另一设备完成授权后, 后端轮询换取 access_token.
    """

    def __init__(self, client_id: Optional[str] = None, base_url: Optional[str] = None):
        self.client_id = client_id or settings.COZE_OAUTH_APP_ID
        self.base_url = (base_url or settings.COZE_API_BASE).rstrip("/")

    async def get_device_code(self, workspace_id: Optional[str] = None) -> dict:
        """获取设备码与用户验证 URL."""
        url = self.base_url + "/api/permission/oauth2/device/code"
        payload = {"client_id": self.client_id}
        if workspace_id:
            payload["workspace_id"] = workspace_id
        async with httpx.AsyncClient(timeout=30) as client:
            r = await client.post(url, json=payload)
            r.raise_for_status()
            return r.json()

    async def get_access_token(self, device_code: str, poll: bool = False) -> _OAuthTokenResult:
        """用 device_code 换取 access_token.

        Args:
            device_code: get_device_code 返回的 device_code
            poll: 是否轮询 (True 时会重试直到授权完成或超时)
        """
        url = self.base_url + "/api/permission/oauth2/device/token"
        payload = {"client_id": self.client_id, "device_code": device_code, "grant_type": "device_code"}
        async with httpx.AsyncClient(timeout=30) as client:
            r = await client.post(url, json=payload)
            r.raise_for_status()
            return _OAuthTokenResult(r.json())

    async def refresh_access_token(self, refresh_token: str) -> _OAuthTokenResult:
        """使用 refresh_token 刷新 access_token."""
        url = self.base_url + "/api/permission/oauth2/refresh_token"
        payload = {"client_id": self.client_id, "refresh_token": refresh_token, "grant_type": "refresh_token"}
        async with httpx.AsyncClient(timeout=30) as client:
            r = await client.post(url, json=payload)
            r.raise_for_status()
            return _OAuthTokenResult(r.json())


class WebOAuthApp:
    """Web 授权码流程 (Authorization Code).

    适用于有后端的 Web 应用: 引导用户跳转到 Coze 授权页, 回调拿到 code 后换 token.
    """

    def __init__(
        self,
        client_id: Optional[str] = None,
        client_secret: Optional[str] = None,
        base_url: Optional[str] = None,
    ):
        self.client_id = client_id or settings.COZE_OAUTH_APP_ID
        self.client_secret = client_secret or ""
        self.base_url = (base_url or settings.COZE_API_BASE).rstrip("/")

    def get_oauth_url(self, redirect_uri: str, state: str, scope: Optional[str] = None) -> str:
        """生成授权页 URL (用户浏览器跳转)."""
        params = {
            "client_id": self.client_id,
            "redirect_uri": redirect_uri,
            "response_type": "code",
            "state": state,
        }
        if scope:
            params["scope"] = scope
        return self.base_url + "/api/permission/oauth2/authorize?" + urlencode(params)

    async def get_access_token(self, code: str, redirect_uri: str) -> _OAuthTokenResult:
        """用授权码 code 换取 access_token."""
        url = self.base_url + "/api/permission/oauth2/token"
        payload = {
            "client_id": self.client_id,
            "client_secret": self.client_secret,
            "code": code,
            "redirect_uri": redirect_uri,
            "grant_type": "authorization_code",
        }
        async with httpx.AsyncClient(timeout=30) as client:
            r = await client.post(url, json=payload)
            r.raise_for_status()
            return _OAuthTokenResult(r.json())

    async def refresh_access_token(self, refresh_token: str) -> _OAuthTokenResult:
        """使用 refresh_token 刷新 access_token."""
        url = self.base_url + "/api/permission/oauth2/refresh_token"
        payload = {
            "client_id": self.client_id,
            "client_secret": self.client_secret,
            "refresh_token": refresh_token,
            "grant_type": "refresh_token",
        }
        async with httpx.AsyncClient(timeout=30) as client:
            r = await client.post(url, json=payload)
            r.raise_for_status()
            return _OAuthTokenResult(r.json())


class PKCEOAuthApp:
    """PKCE 扩展授权码流程.

    适用于公开客户端 (SPA/移动端): 在 Web 流程基础上增加 code_verifier/code_challenge,
    避免授权码被中间人截获.
    """

    def __init__(self, client_id: Optional[str] = None, base_url: Optional[str] = None):
        self.client_id = client_id or settings.COZE_OAUTH_APP_ID
        self.base_url = (base_url or settings.COZE_API_BASE).rstrip("/")

    @staticmethod
    def generate_code_verifier() -> str:
        """生成 PKCE code_verifier (43~128 位随机字符串)."""
        return secrets.token_urlsafe(64)

    @staticmethod
    def generate_code_challenge(code_verifier: str, method: str = "S256") -> str:
        """根据 code_verifier 生成 code_challenge.

        S256: BASE64URL(SHA256(code_verifier))
        plain: code_verifier 原值
        """
        if method.upper() == "S256":
            digest = hashlib.sha256(code_verifier.encode("utf-8")).digest()
            return base64.urlsafe_b64encode(digest).rstrip(b"=").decode("utf-8")
        return code_verifier

    def get_oauth_url(
        self,
        redirect_uri: str,
        code_verifier: str,
        code_challenge_method: str = "S256",
        state: Optional[str] = None,
        scope: Optional[str] = None,
    ) -> str:
        """生成授权页 URL (含 code_challenge)."""
        code_challenge = self.generate_code_challenge(code_verifier, code_challenge_method)
        params = {
            "client_id": self.client_id,
            "redirect_uri": redirect_uri,
            "response_type": "code",
            "code_challenge": code_challenge,
            "code_challenge_method": code_challenge_method,
        }
        if state:
            params["state"] = state
        if scope:
            params["scope"] = scope
        return self.base_url + "/api/permission/oauth2/authorize?" + urlencode(params)

    async def get_access_token(
        self, redirect_uri: str, code: str, code_verifier: str
    ) -> _OAuthTokenResult:
        """用授权码 + code_verifier 换取 access_token."""
        url = self.base_url + "/api/permission/oauth2/token"
        payload = {
            "client_id": self.client_id,
            "code": code,
            "redirect_uri": redirect_uri,
            "code_verifier": code_verifier,
            "grant_type": "authorization_code",
        }
        async with httpx.AsyncClient(timeout=30) as client:
            r = await client.post(url, json=payload)
            r.raise_for_status()
            return _OAuthTokenResult(r.json())

    async def refresh_access_token(self, refresh_token: str) -> _OAuthTokenResult:
        """使用 refresh_token 刷新 access_token."""
        url = self.base_url + "/api/permission/oauth2/refresh_token"
        payload = {
            "client_id": self.client_id,
            "refresh_token": refresh_token,
            "grant_type": "refresh_token",
        }
        async with httpx.AsyncClient(timeout=30) as client:
            r = await client.post(url, json=payload)
            r.raise_for_status()
            return _OAuthTokenResult(r.json())


class JWTOAuthApp:
    """JWT 授权 (服务端直接签发, 最常用).

    使用 RS256 私钥签发 JWT, 直接向 Coze 换取 access_token,
    无需用户交互. 适用于后端服务调用 Coze OpenAPI 的场景.
    """

    def __init__(
        self,
        client_id: Optional[str] = None,
        private_key: Optional[str] = None,
        public_key_id: Optional[str] = None,
        base_url: Optional[str] = None,
    ):
        self.client_id = client_id or settings.COZE_OAUTH_APP_ID
        self._private_key = private_key
        self.public_key_id = public_key_id or settings.COZE_PUBLIC_KEY_ID
        self.base_url = (base_url or settings.COZE_API_BASE).rstrip("/")

    def _resolve_private_key(self) -> Optional[str]:
        if self._private_key:
            return self._private_key
        return get_private_key()

    async def get_access_token(
        self,
        user_uuid: Optional[str] = None,
        scope: Optional[str] = None,
        ttl: Optional[int] = None,
        force_refresh: bool = False,
    ) -> _OAuthTokenResult:
        """获取 access_token (带内存缓存).

        Args:
            user_uuid: 用户 UUID (可选, 用于 session_name)
            scope: 授权范围 (可选, 当前 Coze JWT 流程未使用)
            ttl: token 有效期 (可选, 默认 86399 秒)
            force_refresh: 是否强制刷新缓存
        """
        private_key = self._resolve_private_key()
        if not private_key:
            raise ValueError("Coze 私钥未配置, 无法获取 access_token")

        # 复用 coze_auth_utils 的缓存逻辑
        access_token = await get_coze_access_token(
            user_uuid=user_uuid,
            private_key=private_key,
            force_refresh=force_refresh,
        )
        if not access_token:
            raise RuntimeError("获取 Coze access_token 失败")

        return _OAuthTokenResult(
            {
                "access_token": access_token,
                "token_type": "Bearer",
                "expires_in": ttl or _DEFAULT_TTL,
            }
        )

    async def refresh_access_token(self, refresh_token: str) -> _OAuthTokenResult:
        """JWT 流程无 refresh_token, 直接重新签发 access_token."""
        logger.info("JWT 流程无 refresh_token, 重新签发 access_token")
        return await self.get_access_token(force_refresh=True)


__all__ = [
    "DeviceOAuthApp",
    "WebOAuthApp",
    "PKCEOAuthApp",
    "JWTOAuthApp",
]
