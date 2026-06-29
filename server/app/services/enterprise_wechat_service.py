# Enterprise WeChat (WeCom) login service.
# Ported from P2 EnterpriseWxLoginServiceImpl.java
import xml.etree.ElementTree as ET
from typing import Any

import httpx
import redis as redis_lib
from loguru import logger

from app.config import settings

SUITE_TOKEN_URL = "https://qyapi.weixin.qq.com/cgi-bin/service/get_suite_token"
JSCODE_SESSION_URL = "https://qyapi.weixin.qq.com/cgi-bin/service/miniprogram/jscode2session?suite_access_token=%s&js_code=%s&grant_type=authorization_code"
USER_INFO_URL = "https://qyapi.weixin.qq.com/cgi-bin/user/get?access_token=%s&userid=%s"
REDIS_PREFIX = "enterprise"


async def save_suite_ticket(xml_param: str) -> bool:
    # Parse suite_ticket from WeCom callback XML and store in Redis
    try:
        root = ET.fromstring(xml_param)
        suite_ticket = root.findtext("SuiteTicket", "")
        suite_id = root.findtext("SuiteId", "")
        if not suite_ticket:
            logger.warning("No SuiteTicket in XML")
            return False
        try:
            r = redis_lib.Redis(
                host=settings.REDIS_HOST,
                port=settings.REDIS_PORT,
                password=settings.REDIS_PASSWORD,
                db=settings.REDIS_DB,
                decode_responses=True,
            )
            r.setex(REDIS_PREFIX + ":SuiteTicket", 1800, suite_ticket)
            r.setex(REDIS_PREFIX + ":suiteId", 1800, suite_id)
            logger.info("Suite ticket saved to Redis")
            return True
        except Exception as e:
            logger.error("Redis save suite ticket error: " + str(e))
            return False
    except Exception as e:
        logger.error("Parse suite XML error: " + str(e))
        return False


def suite_ticket_exists() -> bool:
    # Check if suite_ticket is in Redis
    try:

        r = redis_lib.Redis(
            host=settings.REDIS_HOST,
            port=settings.REDIS_PORT,
            password=settings.REDIS_PASSWORD,
            db=settings.REDIS_DB,
            decode_responses=True,
        )
        val = r.get(REDIS_PREFIX + ":SuiteTicket")
        return val is not None
    except Exception as e:
        logger.error("Redis check suite ticket error: " + str(e))
        return False


async def get_suite_access_token() -> dict[str, Any]:
    # Get suite_access_token from WeCom API
    try:

        r = redis_lib.Redis(
            host=settings.REDIS_HOST,
            port=settings.REDIS_PORT,
            password=settings.REDIS_PASSWORD,
            db=settings.REDIS_DB,
            decode_responses=True,
        )
        suite_ticket = r.get(REDIS_PREFIX + ":SuiteTicket")
        suite_id = r.get(REDIS_PREFIX + ":suiteId")
        if not suite_ticket or not suite_id:
            return {"success": False, "error": "Suite ticket not found"}
        payload = {
            "suite_id": suite_id,
            "suite_secret": settings.WECOM_SECRET,
            "suite_ticket": suite_ticket,
        }
        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.post(SUITE_TOKEN_URL, json=payload)
            body = resp.json()
            token = body.get("suite_access_token")
            if not token:
                return {"success": False, "error": "No suite_access_token in response"}
            return {"success": True, "suite_access_token": token}
    except Exception as e:
        logger.error("Get suite token error: " + str(e))
        return {"success": False, "error": str(e)}


async def code2session(suite_access_token: str, code: str) -> dict[str, Any]:
    # Exchange js_code for session info (userid, session_key)
    url = JSCODE_SESSION_URL % (suite_access_token, code)
    try:
        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.get(url)
            body = resp.json()
            errcode = body.get("errcode", -1)
            if errcode != 0:
                return {
                    "success": False,
                    "error": body.get("errmsg", "code2session failed"),
                }
            return {
                "success": True,
                "userid": body.get("userid"),
                "session_key": body.get("session_key"),
                "open_userid": body.get("open_userid"),
                "corpid": body.get("corpid"),
            }
    except Exception as e:
        logger.error("code2session error: " + str(e))
        return {"success": False, "error": str(e)}


async def get_wecom_user_info(access_token: str, userid: str) -> dict[str, Any]:
    # Get WeCom user details
    url = USER_INFO_URL % (access_token, userid)
    try:
        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.get(url)
            body = resp.json()
            if body.get("errcode", -1) != 0:
                return {"success": False, "error": body.get("errmsg", "")}
            return {
                "success": True,
                "mobile": body.get("mobile"),
                "name": body.get("name"),
                "email": body.get("email"),
                "avatar": body.get("avatar"),
                "gender": body.get("gender"),
            }
    except Exception as e:
        logger.error("Get WeCom user info error: " + str(e))
        return {"success": False, "error": str(e)}


async def enterprise_wechat_login(code: str) -> dict[str, Any]:
    # Full Enterprise WeChat login flow
    if not suite_ticket_exists():
        return {"code": "500", "message": "Suite ticket not received", "data": None}
    token_result = await get_suite_access_token()
    if not token_result.get("success"):
        return {
            "code": "500",
            "message": token_result.get("error", "Get suite token failed"),
            "data": None,
        }
    session_result = await code2session(token_result["suite_access_token"], code)
    if not session_result.get("success"):
        return {
            "code": "500",
            "message": session_result.get("error", "code2session failed"),
            "data": None,
        }
    userid = session_result.get("userid", "")
    # Look up user
    from app.database import get_session

    with get_session() as db:
        from app.models.user_models import User, UserThirdPartyAccount

        third = (
            db.query(UserThirdPartyAccount)
            .filter(
                UserThirdPartyAccount.open_id == userid,
                UserThirdPartyAccount.platform == "WEB_ENTERPRISE",
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
                        "platform": "WEB_ENTERPRISE",
                        "userid": userid,
                    },
                }
        # Try to get user info and auto-register
        info_result = await get_wecom_user_info(session_result.get("session_key", ""), userid)
        if not info_result.get("success"):
            return {
                "code": "40101",
                "message": "User not found",
                "data": {"userid": userid, "platform": "WEB_ENTERPRISE"},
            }
        return {
            "code": "40101",
            "message": "Phone binding required",
            "data": {
                "userid": userid,
                "platform": "WEB_ENTERPRISE",
                "mobile": info_result.get("mobile"),
                "name": info_result.get("name"),
            },
        }
