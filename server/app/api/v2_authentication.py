"""v2 auth 路由 - 转发到 v1 真实逻辑.

2026-06-21: v2 auth 路由不再返回占位标记, 而是直接调用 auth_service 真实逻辑.
"""

from fastapi import APIRouter, Depends, Query, Request

from app.schemas.common import error, success
from app.security import require_login
from app.services import auth_service

router = APIRouter(tags=["API v2: Authentication"])


@router.post("/api/v2/auth/login", summary="[v2] 密码登录")
async def v2_login(phone: str = Query(...), password: str = Query(None)):
    result = auth_service.login_by_password(phone, password or "")
    if not result["success"]:
        return error(result["msg"], "401")
    return success(result["data"])


@router.post("/api/v2/auth/login/sms", summary="[v2] 短信验证码登录")
async def v2_login_sms(phone: str = Query(...), code: str = Query(...)):
    result = auth_service.login_by_sms(phone, code)
    if not result["success"]:
        return error(result["msg"], "401")
    return success(result["data"])


@router.post("/api/v2/auth/register", summary="[v2] 注册新用户")
async def v2_register(
    phone: str = Query(...),
    password: str = Query(...),
    nickname: str = Query(None),
):
    result = auth_service.register_user(phone, password, nickname)
    if not result["success"]:
        return error(result["msg"], "400")
    return success(result["data"])


@router.post("/api/v2/auth/refresh", summary="[v2] 刷新token")
async def v2_refresh(refresh_token: str = Query(...)):
    result = auth_service.refresh_token(refresh_token)
    if not result["success"]:
        return error(result["msg"], "401")
    return success(result["data"])


@router.get("/api/v2/auth/info", summary="[v2] 获取用户信息")
async def v2_info(user_uuid: str = Depends(require_login)):
    result = auth_service.get_user_info(user_uuid)
    if not result["success"]:
        return error(result["msg"], "404")
    return success(result["data"])


@router.post("/api/v2/auth/logout", summary="[v2] 登出")
async def v2_logout(request: Request):
    from app.core.jwt_blacklist import revoke_token
    auth_header = request.headers.get("authorization", "")
    token = auth_header[7:] if auth_header.startswith("Bearer ") else ""
    if token:
        revoke_token(token)
    return success(msg="logged out")


@router.get("/api/v2/auth/exist/{phone}", summary="[v2] 检查手机号是否注册")
async def v2_check_phone(phone: str):
    result = auth_service.check_phone_exists(phone)
    return success({"exists": result.get("exists", False)})


@router.post("/api/v2/auth/sms/code", summary="[v2] 发送短信验证码")
async def v2_send_sms(phone: str = Query(...)):
    from app.utils.sms_util import send_sms_code
    result = await send_sms_code(phone)
    if not result["success"]:
        return error(result["msg"], "429")
    return success(msg="Code sent")
