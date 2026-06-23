# DingTalk (钉钉) OAuth authentication service.
# Provides DingTalk login config and code-to-user login flow.
from typing import Any

import httpx
from loguru import logger

from app.config import settings


def get_dingtalk_config() -> dict[str, Any]:
    """返回钉钉登录前端配置 (appId, corpId, agentId)."""
    return {
        "appId": settings.DINGTALK_LOGIN_APP_ID or "",
        "corpId": settings.DINGTALK_CORP_ID or "",
        "agentId": settings.DINGTALK_AGENT_ID or "",
        "apiHost": settings.DINGTALK_API_HOST or "https://oapi.dingtalk.com",
    }


async def _get_dingtalk_access_token() -> str | None:
    """通过 appKey/appSecret 获取企业内部应用 access_token."""
    app_key = settings.DINGTALK_APP_KEY
    app_secret = settings.DINGTALK_APP_SECRET
    if not app_key or not app_secret:
        logger.warning("DingTalk appKey/appSecret not configured")
        return None

    url = f"{settings.DINGTALK_API_HOST}/gettoken?appkey={app_key}&appsecret={app_secret}"
    try:
        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.get(url)
            body = resp.json()
            if body.get("errcode", -1) != 0:
                logger.error(f"DingTalk gettoken error: {body}")
                return None
            return body.get("access_token")
    except Exception as e:
        logger.error(f"DingTalk gettoken exception: {e}")
        return None


async def _get_user_info_by_code(access_token: str, code: str) -> dict[str, Any]:
    """用 access_token 和临时授权码获取用户信息."""
    url = f"{settings.DINGTALK_API_HOST}/topapi/v2/user/getuserinfo?access_token={access_token}"
    try:
        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.post(url, json={"code": code})
            body = resp.json()
            if body.get("errcode", -1) != 0:
                logger.error(f"DingTalk getuserinfo error: {body}")
                return {"success": False, "error": body.get("errmsg", "Failed")}
            userid = body.get("result", {}).get("userid", "")
            if not userid:
                return {"success": False, "error": "userid not found"}

            # 获取用户详细信息
            detail_url = f"{settings.DINGTALK_API_HOST}/topapi/v2/user/get?access_token={access_token}"
            detail_resp = await client.post(detail_url, json={"userid": userid})
            detail_body = detail_resp.json()
            if detail_body.get("errcode", -1) != 0:
                logger.error(f"DingTalk user detail error: {detail_body}")
                return {"success": False, "error": detail_body.get("errmsg", "Failed")}

            user_info = detail_body.get("result", {})
            return {
                "success": True,
                "userid": userid,
                "name": user_info.get("name", ""),
                "avatar": user_info.get("avatar", ""),
                "email": user_info.get("email", ""),
                "mobile": user_info.get("mobile", ""),
                "unionid": user_info.get("unionid", ""),
            }
    except Exception as e:
        logger.error(f"DingTalk getuserinfo exception: {e}")
        return {"success": False, "error": str(e)}


async def dingtalk_login_by_code(code: str) -> dict[str, Any]:
    """钉钉登录: 用临时授权码换取用户信息, 查找或创建用户, 签发 JWT.

    Args:
        code: 钉钉 SDK 返回的临时授权码

    Returns:
        dict: {"code": "200", "message": "success", "data": {"token": ..., "user": ...}}
    """
    from app.database import get_session
    from app.models.user_models import User, UserThirdPartyAccount
    from app.security import create_access_token

    # 1. 获取企业 access_token
    access_token = await _get_dingtalk_access_token()
    if not access_token:
        return {"code": "500", "message": "钉钉登录未配置或获取凭证失败", "data": None}

    # 2. 用 code 换取用户信息
    user_info = await _get_user_info_by_code(access_token, code)
    if not user_info.get("success"):
        return {"code": "500", "message": user_info.get("error", "获取用户信息失败"), "data": None}

    userid = user_info["userid"]
    unionid = user_info.get("unionid", "")
    name = user_info.get("name", "")
    avatar = user_info.get("avatar", "")

    # 3. 查找或创建用户
    with get_session() as db:
        user = None
        tp_query = db.query(UserThirdPartyAccount).filter(
            UserThirdPartyAccount.platform == "dingtalk"
        )
        tp = None
        if unionid:
            tp = tp_query.filter(UserThirdPartyAccount.union_id == unionid).first()
        if not tp and userid:
            tp = tp_query.filter(UserThirdPartyAccount.open_id == userid).first()

        if tp:
            user = db.query(User).filter(User.uuid == tp.user_uuid).first()

        if user:
            if name and not user.nickname:
                user.nickname = name
            if avatar and not user.avatar:
                user.avatar = avatar
            db.commit()
        else:
            user = User(
                nickname=name or f"dt_{userid[:8]}",
                avatar=avatar,
            )
            db.add(user)
            db.commit()
            db.refresh(user)

            binding = UserThirdPartyAccount(
                user_uuid=user.uuid,
                open_id=userid,
                union_id=unionid,
                platform="dingtalk",
            )
            db.add(binding)
            db.commit()

        jwt_token = create_access_token({"sub": user.uuid})

    return {
        "code": "200",
        "message": "success",
        "data": {
            "token": jwt_token,
            "user": {
                "uuid": user.uuid,
                "nickname": user.nickname,
                "avatar": user.avatar,
            },
        },
    }
