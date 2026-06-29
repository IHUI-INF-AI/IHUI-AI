"""
Coze OAuth authentication utilities.

Ported from historical project:
  - H:/历史项目存档/ljd-交接文件/coze_zhs_py/utils/coze_auth_utils.py

Provides async access-token acquisition (JWT RS256 -> Coze OAuth token endpoint),
force-refresh, and local token validation. Uses PyJWT (with python-jose fallback).
"""

from __future__ import annotations

import logging
import time
import uuid

import httpx

from app.config import settings

try:
    import jwt  # type: ignore
except ImportError:  # pragma: no cover
    from jose import jwt  # type: ignore

logger = logging.getLogger("coze_auth_utils")

# Token cache (mirror of historical _token_cache)
_token_cache: dict = {"token": None, "expire_time": 0}

# Token validity duration (seconds), aligned with historical 86399s.
_TOKEN_DURATION_SECONDS = 86399


async def get_access_token(
    user_uuid: str | None = None, force_refresh: bool = False
) -> str | None:
    """获取 Coze 访问令牌 (ported from historical get_coze_access_token).

    1. Return cached token if still valid and not force_refresh.
    2. Build a JWT (RS256) signed with the configured private key.
    3. Exchange the JWT for an access_token at the Coze OAuth endpoint.
    4. Cache the token and return it.

    Args:
        user_uuid: optional user uuid embedded as session_name in the JWT.
        force_refresh: bypass cache and request a new token.

    Returns:
        access_token string, or None on failure.
    """
    try:
        now = int(time.time())
        if (
            not force_refresh
            and _token_cache["token"]
            and _token_cache["expire_time"] > now
        ):
            return _token_cache["token"]

        client_id = settings.COZE_OAUTH_APP_ID
        public_key_id = settings.COZE_PUBLIC_KEY_ID
        private_key = settings.COZE_PRIVATE_KEY
        if not all([client_id, public_key_id, private_key]):
            logger.error(
                "[CozeAuth] JWT config incomplete (client_id/public_key_id/private_key)"
            )
            return None

        payload = {
            "iss": client_id,
            "aud": settings.COZE_OAUTH_APP_AUD,
            "iat": now,
            "exp": now + _TOKEN_DURATION_SECONDS,
            "jti": (uuid.uuid4().hex + uuid.uuid4().hex)[:32],
        }
        if user_uuid:
            payload["session_name"] = user_uuid
        headers = {"kid": public_key_id}

        jwt_token = jwt.encode(payload, private_key, algorithm="RS256", headers=headers)
        if isinstance(jwt_token, bytes):
            jwt_token = jwt_token.decode("utf-8")

        body = {
            "grant_type": "urn:ietf:params:oauth:grant-type:jwt-bearer",
            "duration_seconds": _TOKEN_DURATION_SECONDS,
        }
        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.post(
                settings.COZE_OAUTH_TOKEN_URL,
                headers={
                    "Authorization": f"Bearer {jwt_token}",
                    "Content-Type": "application/json",
                },
                json=body,
            )
        if resp.status_code != 200:
            logger.error(
                "[CozeAuth] token endpoint HTTP %s: %s",
                resp.status_code,
                resp.text[:200],
            )
            return None
        result = resp.json()
        access_token = result.get("access_token")
        if not access_token:
            logger.error("[CozeAuth] no access_token in response: %s", result)
            return None

        _token_cache["token"] = access_token
        _token_cache["expire_time"] = now + _TOKEN_DURATION_SECONDS
        return access_token
    except Exception as e:
        logger.error("[CozeAuth] get_access_token error: %s", e)
        return None


async def refresh_token(user_uuid: str | None = None) -> str | None:
    """强制刷新 Coze 访问令牌 (force_refresh=True).

    Args:
        user_uuid: optional user uuid embedded as session_name in the JWT.

    Returns:
        new access_token string, or None on failure.
    """
    return await get_access_token(user_uuid=user_uuid, force_refresh=True)


async def validate_token(token: str | None = None) -> bool:
    """校验 Coze 访问令牌是否有效 (本地校验，不调用远端 API).

    Args:
        token: access_token to validate; if None, validates the cached token.

    Returns:
        True when the token is considered valid, False otherwise.
    """
    try:
        if token is None:
            target = _token_cache.get("token")
            if not target:
                return False
            return _token_cache.get("expire_time", 0) > int(time.time())
        # Explicit token: basic non-empty check (no remote validation to avoid blocking).
        return bool(token)
    except Exception as e:
        logger.error("[CozeAuth] validate_token error: %s", e)
        return False
