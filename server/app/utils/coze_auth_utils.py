"""Coze OAuth 认证工具类 (异步版本).

适配新项目架构: FastAPI + httpx + loguru, async/await 风格.
对应历史实现 coze_zhs_py/utils/coze_auth_utils.py (同步版本).

提供:
- load_coze_oauth_config: 加载 OAuth 配置 (优先环境变量, fallback 配置文件)
- get_private_key: 从 settings.COZE_PRIVATE_KEY 获取私钥
- get_coze_access_token: 获取 access_token (带内存缓存, 异步)
"""

import json
import os
import time
import uuid
from typing import Optional

import httpx
from loguru import logger

from app.config import settings

# Token 缓存有效期 (秒), 与 duration_seconds 保持一致
_TOKEN_TTL = 86399

# 内存缓存: {token: str|None, expire_time: int}
_token_cache: dict = {"token": None, "expire_time": 0}


def _default_config_path() -> str:
    """默认配置文件路径: server/coze_oauth_config.json."""
    # 当前文件: app/utils/coze_auth_utils.py -> 上两级为 server/
    current_dir = os.path.dirname(os.path.abspath(__file__))
    return os.path.join(current_dir, "..", "..", "coze_oauth_config.json")


def load_coze_oauth_config(config_path: Optional[str] = None) -> Optional[dict]:
    """加载 Coze OAuth 配置.

    优先从环境变量读取 (COZE_OAUTH_APP_ID / COZE_PUBLIC_KEY_ID / COZE_PRIVATE_KEY 等),
    若环境变量缺失则 fallback 到 coze_oauth_config.json 文件.

    Args:
        config_path: 配置文件路径, None 时使用默认路径 (server/coze_oauth_config.json)

    Returns:
        dict: OAuth 配置字典, 失败返回 None
    """
    try:
        # 优先环境变量
        client_id = settings.COZE_OAUTH_APP_ID
        public_key_id = settings.COZE_PUBLIC_KEY_ID
        private_key = settings.COZE_PRIVATE_KEY

        if client_id and public_key_id and private_key:
            return {
                "client_type": "jwt",
                "client_id": client_id,
                "coze_www_base": "https://www.coze.cn",
                "coze_api_base": settings.COZE_API_BASE,
                "private_key": private_key,
                "public_key_id": public_key_id,
            }

        # fallback 到配置文件
        path = config_path or _default_config_path()
        if os.path.exists(path):
            with open(path, "r", encoding="utf-8") as f:
                logger.info("Coze OAuth 配置从文件加载: {}", path)
                return json.load(f)

        logger.error("Coze OAuth 配置缺失: 环境变量与配置文件均不可用 ({})", path)
        return None
    except Exception as e:
        logger.error("加载 Coze OAuth 配置失败: {}", e)
        return None


def get_private_key() -> Optional[str]:
    """从 settings.COZE_PRIVATE_KEY 获取私钥.

    Returns:
        str: PEM 格式私钥, 失败返回 None
    """
    try:
        private_key = settings.COZE_PRIVATE_KEY
        if not private_key:
            logger.error("未配置 Coze 私钥 (COZE_PRIVATE_KEY)")
            return None
        return private_key
    except Exception as e:
        logger.error("加载私钥失败: {}", e)
        return None


def _build_jwt_token(user_uuid: Optional[str], private_key: str) -> str:
    """生成 RS256 签名的 JWT token.

    payload: iss=client_id, aud=COZE_OAUTH_APP_AUD, iat=now, exp=now+86399,
             jti=32位随机hex, 可选 session_name=user_uuid
    headers: kid=public_key_id
    """
    try:
        import jwt
    except ImportError:
        from jose import jwt  # type: ignore

    now = int(time.time())
    client_id = settings.COZE_OAUTH_APP_ID
    public_key_id = settings.COZE_PUBLIC_KEY_ID

    payload = {
        "iss": client_id,
        "aud": settings.COZE_OAUTH_APP_AUD,
        "iat": now,
        "exp": now + _TOKEN_TTL,
        # jti: 32 位随机 hex (uuid4().hex 即为 32 位)
        "jti": uuid.uuid4().hex,
    }
    if user_uuid:
        payload["session_name"] = user_uuid

    headers = {"kid": public_key_id}
    token = jwt.encode(payload, private_key, algorithm="RS256", headers=headers)
    if isinstance(token, bytes):
        token = token.decode("utf-8")
    return token


async def get_coze_access_token(
    user_uuid: Optional[str] = None,
    private_key: Optional[str] = None,
    force_refresh: bool = False,
) -> Optional[str]:
    """获取 Coze 访问令牌 (异步, 带内存缓存).

    流程:
    1. 检查缓存中的 token 是否有效 (未过期且非强制刷新)
    2. 生成 JWT token (RS256)
    3. 调用 Coze 授权接口换取 access_token
    4. 缓存 token 以便后续使用

    Args:
        user_uuid: 用户 UUID (可选, 用于 session_name)
        private_key: 私钥内容 (可选, 未提供则从 settings 加载)
        force_refresh: 是否强制刷新 token

    Returns:
        str: access_token, 失败返回 None
    """
    try:
        current_time = int(time.time())
        # 1. 检查缓存
        if (
            not force_refresh
            and _token_cache["token"]
            and _token_cache["expire_time"] > current_time
        ):
            logger.debug(
                "使用缓存的 Coze access_token, 剩余 {} 秒",
                _token_cache["expire_time"] - current_time,
            )
            return _token_cache["token"]

        # 2. 准备私钥与配置
        client_id = settings.COZE_OAUTH_APP_ID
        public_key_id = settings.COZE_PUBLIC_KEY_ID
        if private_key is None:
            private_key = get_private_key()
            if not private_key:
                logger.error("无法加载私钥, 获取 access_token 失败")
                return None

        if not all([client_id, public_key_id, private_key]):
            logger.error("JWT 配置不完整, 缺少必要参数 (client_id/public_key_id/private_key)")
            return None

        # 3. 生成 JWT token
        jwt_token = _build_jwt_token(user_uuid, private_key)
        logger.info("生成 Coze JWT token, client_id={}, user_uuid={}", client_id, user_uuid or "N/A")

        # 4. 调用 Coze 授权接口
        token_url = settings.COZE_OAUTH_TOKEN_URL
        headers = {
            "Authorization": "Bearer " + jwt_token,
            "Content-Type": "application/json",
        }
        body = {
            "grant_type": "urn:ietf:params:oauth:grant-type:jwt-bearer",
            "duration_seconds": _TOKEN_TTL,
        }

        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.post(token_url, headers=headers, json=body)
                response.raise_for_status()
                result = response.json()
        except httpx.HTTPError as e:
            logger.error("调用 Coze 授权接口失败: {}", e)
            return None
        except Exception as e:
            logger.error("处理 Coze 授权响应失败: {}", e)
            return None

        if "access_token" not in result:
            logger.error("Coze 授权接口返回异常, 缺少 access_token: {}", result)
            return None

        access_token = result["access_token"]

        # 5. 缓存 token
        _token_cache["token"] = access_token
        _token_cache["expire_time"] = current_time + _TOKEN_TTL
        logger.info("Coze access_token 获取成功, 有效期 {} 秒", _TOKEN_TTL)
        return access_token

    except Exception as e:
        logger.error("生成 Coze access_token 失败: {}", e)
        return None


def clear_token_cache() -> None:
    """清除内存中的 token 缓存 (供强制刷新或测试使用)."""
    _token_cache["token"] = None
    _token_cache["expire_time"] = 0
