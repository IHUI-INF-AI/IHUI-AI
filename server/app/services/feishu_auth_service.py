# Feishu (Lark) OAuth authentication service.
# Ported from P2 FeishuLoginServiceImpl.java
from typing import Any

import httpx
from loguru import logger

from app.config import settings

FEISHU_OAUTH_URL = "https://open.feishu.cn/open-apis/authen/v1/oidc/access_token"
FEISHU_USER_INFO_URL = "https://open.feishu.cn/open-apis/authen/v1/user_info"


async def get_feishu_access_token(code: str) -> dict[str, Any]:
    # Exchange auth code for user_access_token via Feishu OIDC
    payload = {
        "grant_type": "authorization_code",
        "client_id": settings.FEISHU_APP_ID,
        "client_secret": settings.FEISHU_APP_SECRET,
        "code": code,
    }
    try:
        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.post(
                FEISHU_OAUTH_URL,
                json=payload,
                headers={"Content-Type": "application/json; charset=utf-8"},
            )
            body = resp.json()
            err_code = body.get("code", -1)
            if err_code != 0:
                logger.error("Feishu OAuth error: " + str(body.get("error_description", "")))
                return {"success": False, "error": body.get("error", "OAuth failed")}
            return {
                "success": True,
                "access_token": body.get("access_token"),
                "refresh_token": body.get("refresh_token"),
                "expires_in": body.get("expires_in"),
            }
    except Exception as e:
        logger.error("Feishu get access token error: " + str(e))
        return {"success": False, "error": str(e)}


async def get_feishu_user_info(access_token: str) -> dict[str, Any]:
    # Fetch user info from Feishu using access_token
    try:
        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.get(
                FEISHU_USER_INFO_URL,
                headers={
                    "Authorization": "Bearer " + access_token,
                    "Content-Type": "application/json; charset=utf-8",
                },
            )
            body = resp.json()
            if body.get("code", -1) != 0:
                return {"success": False, "error": body.get("msg", "Failed")}
            data = body.get("data", {})
            return {
                "success": True,
                "open_id": data.get("open_id"),
                "union_id": data.get("union_id"),
                "name": data.get("name"),
                "avatar": data.get("avatar_url"),
                "mobile": data.get("mobile"),
            }
    except Exception as e:
        logger.error("Feishu get user info error: " + str(e))
        return {"success": False, "error": str(e)}


async def feishu_login_by_code(code: str) -> dict[str, Any]:
    # Full Feishu login flow: code -> access_token -> user_info -> lookup/create user
    token_result = await get_feishu_access_token(code)
    if not token_result.get("success"):
        return {
            "code": "500",
            "message": token_result.get("error", "Auth failed"),
            "data": None,
        }
    access_token = token_result["access_token"]
    info_result = await get_feishu_user_info(access_token)
    if not info_result.get("success"):
        return {
            "code": "500",
            "message": info_result.get("error", "Get user info failed"),
            "data": None,
        }
    open_id = info_result.get("open_id", "")
    union_id = info_result.get("union_id", "")
    # Look up user in DB by open_id or union_id
    from app.database import get_session

    with get_session() as db:
        from app.models.user_models import User, UserThirdPartyAccounts

        third = (
            db.query(UserThirdPartyAccounts)
            .filter(
                UserThirdPartyAccounts.open_id == open_id,
                UserThirdPartyAccounts.platform == "WEB_FEISHU",
            )
            .first()
        )
        if third:
            user = db.query(User).filter(User.uuid == third.user_uuid).first()
            if user:
                return {
                    "code": "200",
                    "message": "Login success",
                    "data": {
                        "user_uuid": user.uuid,
                        "platform": "WEB_FEISHU",
                        "open_id": open_id,
                        "union_id": union_id,
                    },
                }
        # User not found - return 40101 to prompt phone binding
        return {
            "code": "40101",
            "message": "Phone binding required",
            "data": {
                "open_id": open_id,
                "union_id": union_id,
                "platform": "WEB_FEISHU",
            },
        }
