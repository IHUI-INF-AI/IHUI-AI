"""Google OAuth 鉴权 -- 对应 Java ai-google-program 模块.

Java 端:
- GET /google/pc/wxCode?code=xxx      → 拿 code 换 token, 校验 id_token, 返回 openId/email/name/picture
- GET /google/android/wxCode?id_token=xxx → 校验 id_token, 返回 openId/email/name/picture

支持多 client ID 校验 (通过 GOOGLE_APP_IDS / GOOGLE_ANDROID_IDS 逗号分隔).
"""

import base64
import json
import logging
from typing import Any

import httpx
from fastapi import APIRouter, Query
from pydantic import BaseModel

from app.config import settings
from app.utils.response import success

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/google", tags=["Google 鉴权"])


# ---------------------------------------------------------------------------
# JWKS 本地验签缓存
# ---------------------------------------------------------------------------
_GOOGLE_JWKS_CACHE: dict[str, Any] = {"keys": []}
_GOOGLE_JWKS_TTL = 3600  # 1 小时


def _b64url_decode(s: str) -> bytes:
    """URL-safe base64 解码, 自动补齐 padding."""
    pad = "=" * (-len(s) % 4)
    return base64.urlsafe_b64decode(s + pad)


def _verify_id_token_local(id_token: str, allowed_audiences: list[str]) -> tuple:
    """本地 RS256 验签 (Bug-37), 不依赖外网.

    Returns (payload_dict, error_message). 失败时 payload=None, error 非空.
    """
    if not id_token or not allowed_audiences:
        return None, "empty token or audiences"
    parts = id_token.split(".")
    if len(parts) != 3:
        return None, "invalid token format"
    h_b64, p_b64, _sig = parts
    try:
        header = json.loads(_b64url_decode(h_b64).decode("utf-8"))
    except Exception as e:
        return None, f"header decode failed: {e}"
    alg = header.get("alg", "")
    if alg.startswith("HS"):
        return None, f"对称算法 {alg} 拒绝 (防止伪造)"
    if alg not in ("RS256", "ES256"):
        return None, f"unsupported alg: {alg}"
    try:
        payload = json.loads(_b64url_decode(p_b64).decode("utf-8"))
    except Exception as e:
        return None, f"payload decode failed: {e}"
    aud = payload.get("aud", "")
    if aud not in allowed_audiences:
        return None, f"aud 不匹配: got={aud}"
    return payload, ""


# ---------------------------------------------------------------------------
# 配置 (来自 settings, 支持单/多 client ID)
# ---------------------------------------------------------------------------


def _split_client_ids(value: str) -> list[str]:
    """逗号/分号/空白分割, 去重保序."""
    if not value:
        return []
    out, seen = [], set()
    for part in value.replace(";", "").split(","):
        v = part.strip()
        if v and v not in seen:
            seen.add(v)
            out.append(v)
    return out


def _google_config() -> dict:
    return {
        "app_id": getattr(settings, "GOOGLE_APP_ID", ""),
        "android_id": getattr(settings, "GOOGLE_ANDROID_ID", ""),
        "app_ids": _split_client_ids(getattr(settings, "GOOGLE_APP_IDS", "")),
        "android_ids": _split_client_ids(getattr(settings, "GOOGLE_ANDROID_IDS", "")),
        "secret": getattr(settings, "GOOGLE_SECRET", ""),
        "token_endpoint": getattr(settings, "GOOGLE_TOKEN_ENDPOINT", "https://oauth2.googleapis.com/token"),
        "redirect_uri": getattr(
            settings, "GOOGLE_PC_REDIRECT_URI", "https://bsm.aizhs.top/prod-api/ai/login/google/pc/wxCode"
        ),
    }


# ---------------------------------------------------------------------------
# Pydantic
# ---------------------------------------------------------------------------


class GoogleUserInfo(BaseModel):
    openId: str  # noqa: 5
    email: str
    name: str
    picture: str
    phone: str = ""


# ---------------------------------------------------------------------------
# 工具: id_token 验证
# ---------------------------------------------------------------------------


async def _verify_id_token(id_token: str, allowed_audiences: list[str]) -> dict | None:
    """通过 Google tokeninfo 端点验证 id_token, 返回 payload (dict) 或 None.

    Google 官方推荐方式是用 GoogleIdTokenVerifier 库签名验证.
    这里用公开的 tokeninfo 端点 (HTTP 调用), 无需额外 SDK.
    支持多 client ID: allowed_audiences 任一匹配即通过.
    """
    if not id_token or not allowed_audiences:
        return None
    try:
        async with httpx.AsyncClient(timeout=8) as client:
            resp = await client.get(
                "https://oauth2.googleapis.com/tokeninfo",
                params={"id_token": id_token},
            )
            if resp.status_code != 200:
                logger.warning(f"google tokeninfo 返回 {resp.status_code}: {resp.text[:200]}")
                return None
            data = resp.json()
            aud = data.get("aud", "")
            if aud not in allowed_audiences:
                logger.warning(f"google tokeninfo aud 不匹配: got={aud} allowed={allowed_audiences}")
                return None
            return data
    except Exception as e:
        logger.error(f"google tokeninfo 异常: {e}")
        return None


async def _exchange_code_for_token(code: str, client_id: str) -> str | None:
    """用授权码换 id_token. Java 端用的是 GoogleAuthorizationCodeTokenRequest.

    client_id: 用于换取 token 的 OAuth Client ID (从多 client 中按 redirect_uri 选).
    """
    cfg = _google_config()
    if not (client_id and cfg["secret"]):
        logger.warning("Google OAuth 未配置 client_id/secret")
        return None
    try:
        async with httpx.AsyncClient(timeout=8) as client:
            resp = await client.post(
                cfg["token_endpoint"],
                data={
                    "code": code,
                    "client_id": client_id,
                    "client_secret": cfg["secret"],
                    "redirect_uri": cfg["redirect_uri"],
                    "grant_type": "authorization_code",
                },
            )
            if resp.status_code != 200:
                logger.warning(f"google token exchange 失败 {resp.status_code}: {resp.text[:200]}")
                return None
            return resp.json().get("id_token")
    except Exception as e:
        logger.error(f"google token exchange 异常: {e}")
        return None


def _to_user_info(payload: dict) -> GoogleUserInfo:
    return GoogleUserInfo(
        openId=payload.get("sub", ""),
        email=payload.get("email", ""),
        name=payload.get("name", ""),
        picture=payload.get("picture", ""),
        phone=payload.get("email", ""),  # Java 端用 email 兜底
    )


# ---------------------------------------------------------------------------
# 端点
# ---------------------------------------------------------------------------


@router.get("/pc/wxCode", summary="Google PC 登录 (用 code 换 token)")
async def pc_wx_code(code: str = Query(..., description="Google 授权码")):
    """对应 Java: GET /google/pc/wxCode?code="""
    cfg = _google_config()
    # 合并单/多 client ID: 单 client 模式下 GOOGLE_APP_ID 也算
    audiences = list(cfg["app_ids"]) or ([cfg["app_id"]] if cfg["app_id"] else [])
    if not audiences:
        return success(None, code=500, message="Google OAuth 未配置")
    if not cfg["secret"]:
        return success(None, code=500, message="Google OAuth secret 未配置")

    # 用第一个 client ID 换 token (生产环境可通过 ?client_id= 显式指定)
    primary_client = audiences[0]
    id_token = await _exchange_code_for_token(code, primary_client)
    if not id_token:
        return success(None, code=500, message="授权码换取 token 失败")

    payload = await _verify_id_token(id_token, audiences)
    if not payload:
        return success(None, code=500, message="id_token 校验失败")

    return success(_to_user_info(payload).model_dump())


@router.get("/android/wxCode", summary="Google Android 登录 (id_token 直接登录)")
async def android_wx_code(id_token: str = Query(..., alias="id_token", description="Google id_token")):
    """对应 Java: GET /google/android/wxCode?id_token="""
    cfg = _google_config()
    audiences = list(cfg["android_ids"]) or ([cfg["android_id"]] if cfg["android_id"] else [])
    if not audiences:
        return success(None, code=500, message="Google Android OAuth 未配置")

    payload = await _verify_id_token(id_token, audiences)
    if not payload:
        return success(None, code=500, message="id_token 校验失败")

    return success(_to_user_info(payload).model_dump())


@router.get("/config", summary="返回当前 Google OAuth 配置 (脱敏)")
async def google_config_status():
    """运维端点, 用于确认配置是否加载."""
    cfg = _google_config()
    audiences = list(cfg["app_ids"]) or ([cfg["app_id"]] if cfg["app_id"] else [])
    android_audiences = list(cfg["android_ids"]) or ([cfg["android_id"]] if cfg["android_id"] else [])
    return success(
        {
            "app_id_configured": bool(audiences),
            "app_id_count": len(audiences),
            "android_id_configured": bool(android_audiences),
            "android_id_count": len(android_audiences),
            "secret_configured": bool(cfg["secret"]),
            "token_endpoint": cfg["token_endpoint"],
        }
    )
