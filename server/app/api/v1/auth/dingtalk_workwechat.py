"""DingTalk & WorkWechat (企业微信) 扫码登录路由.

前端调用:
  POST /auth/dingtalk/login  { code, state }
  POST /auth/workwechat/login { code, state, appId }

迁移自 Java 旧后端的 DingTalkLoginController / WorkWechatLoginController.
"""

import time

from fastapi import APIRouter, Body

from app.core.tracking import EVENT_USER_LOGIN, track_event, track_funnel
from app.schemas.common import error, success
from app.services.dingtalk_workwechat_service import dingtalk_login, workwechat_login

router = APIRouter(tags=["Auth: DingTalk & WorkWechat"])


@router.post("/dingtalk/login", summary="钉钉扫码登录")
async def dingtalk_login_endpoint(
    code: str = Body(..., embed=True),
    state: str = Body("", embed=True),
):
    """钉钉扫码登录回调.

    前端 DingTalk.vue 接收 OAuth 回调的 code+state, POST 到此端点.
    后端用 code 换取钉钉用户信息, 查/建用户, 颁发 JWT.
    """
    if not code:
        return error("授权码不能为空", "400")

    track_funnel("login", "login_submit", channel="dingtalk")
    t0 = time.perf_counter()
    result = await dingtalk_login(code, state)
    duration = time.perf_counter() - t0

    if not result["success"]:
        track_event("user_login_failed", channel="dingtalk", reason=result.get("msg", "unknown"))
        return error(result["msg"], "401")

    user_id = (result.get("data") or {}).get("user_id", "") or ""
    track_event(EVENT_USER_LOGIN, user_id=str(user_id), channel="dingtalk")
    track_funnel("login", "login_success", user_id=str(user_id), channel="dingtalk")

    from app.core.tracking import track_latency as _tl
    _tl(EVENT_USER_LOGIN, duration, user_id=str(user_id), channel="dingtalk")

    return success(result["data"])


@router.post("/workwechat/login", summary="企业微信扫码登录")
async def workwechat_login_endpoint(
    code: str = Body(..., embed=True),
    state: str = Body("", embed=True),
    appId: str = Body("", embed=True),
):
    """企业微信扫码登录回调.

    前端 WorkWechat.vue 接收 OAuth 回调的 code+state+appId, POST 到此端点.
    后端用 code 换取企业微信用户信息, 查/建用户, 颁发 JWT.
    """
    if not code:
        return error("授权码不能为空", "400")

    track_funnel("login", "login_submit", channel="workwechat")
    t0 = time.perf_counter()
    result = await workwechat_login(code, state, appId)
    duration = time.perf_counter() - t0

    if not result["success"]:
        track_event("user_login_failed", channel="workwechat", reason=result.get("msg", "unknown"))
        return error(result["msg"], "401")

    user_id = (result.get("data") or {}).get("user_id", "") or ""
    track_event(EVENT_USER_LOGIN, user_id=str(user_id), channel="workwechat")
    track_funnel("login", "login_success", user_id=str(user_id), channel="workwechat")

    from app.core.tracking import track_latency as _tl
    _tl(EVENT_USER_LOGIN, duration, user_id=str(user_id), channel="workwechat")

    return success(result["data"])
