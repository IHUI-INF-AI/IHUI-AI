"""Authentication routes -- login, register, token refresh, SMS."""

import time

from fastapi import APIRouter, Body, Depends, File, Request, UploadFile
from loguru import logger

from app.core.tracking import (
    EVENT_USER_LOGIN,
    EVENT_USER_REGISTER,
    track_event,
    track_funnel,
)
from app.schemas.common import error, success
from app.security import decode_access_token, hash_password, require_login, verify_password
from app.services import auth_service
from app.utils.email_util import is_valid_email, send_email_code
from app.utils.sms_util import send_sms_code

router = APIRouter(prefix="/auth", tags=["Authentication"])


@router.post("/login", summary="Password login")
async def login(
    phone: str = Body(..., embed=True),
    password: str = Body(None, embed=True),
):
    """密码登录 (JSON Body, embed=True 支持 {phone,password,code}).

    2026-06-28 联调: 改 Query→Body, 对齐前端 LOGIN_PWD_PATHS.login 调用方式
    (前端发送 JSON body, 不再用 query string).
    """
    if not phone:
        return error("Phone number required", "400")
    track_funnel("login", "login_submit", channel="password")
    t0 = time.perf_counter()
    try:
        result = auth_service.login_by_password(phone, password or "")
    except Exception as _exc:  # service 异常 (DB/Redis 不可用) 降级为 401
        logger.exception("login_by_password failed: phone={}", phone)
        result = {"success": False, "msg": "用户不存在或密码错误"}
    duration = time.perf_counter() - t0
    if not result["success"]:
        track_event("user_login_failed", user_id=phone, channel="password", reason=result.get("msg", "unknown"))
        return error(result["msg"], "401")
    user_id = (result.get("data") or {}).get("user_id", phone) or phone
    track_event(EVENT_USER_LOGIN, user_id=str(user_id), channel="password")
    track_funnel("login", "login_success", user_id=str(user_id), channel="password")
    from app.core.tracking import track_latency as _tl
    _tl(EVENT_USER_LOGIN, duration, user_id=str(user_id), channel="password")
    return success(result["data"])


@router.post("/login/sms", summary="SMS code login")
async def login_sms(
    phone: str = Body(..., embed=True),
    code: str = Body(..., embed=True),
):
    """短信验证码登录 (JSON Body, embed=True 支持 {phone,code}).

    2026-06-28 联调: 改 Query→Body, 对齐前端 LOGIN_PWD_PATHS.smsVerify 调用方式.
    """
    if not phone or not code:
        return error("Phone and code required", "400")
    track_funnel("login", "login_submit", channel="sms")
    result = auth_service.login_by_sms(phone, code)
    if not result["success"]:
        track_event("user_login_failed", user_id=phone, channel="sms", reason=result.get("msg", "unknown"))
        return error(result["msg"], "401")
    user_id = (result.get("data") or {}).get("user_id", phone) or phone
    track_event(EVENT_USER_LOGIN, user_id=str(user_id), channel="sms")
    track_funnel("login", "login_success", user_id=str(user_id), channel="sms")
    return success(result["data"])


@router.post("/login/email", summary="Email code login")
async def login_email(email: str = Body(..., embed=True), code: str = Body(..., embed=True)):
    """邮箱验证码登录: 自动注册未注册用户.

    请求体 JSON 格式 (embed=True 支持):
        {"email": "user@example.com", "code": "123456"}
    """
    if not email or not code:
        return error("Email and code required", "400")
    email = email.strip().lower()
    if not is_valid_email(email):
        return error("邮箱格式不正确", "400105")
    track_funnel("login", "login_submit", channel="email")
    t0 = time.perf_counter()
    try:
        result = auth_service.login_by_email(email, code)
    except Exception:
        logger.exception("login_by_email failed: email={}", email)
        result = {"success": False, "msg": "登录失败, 请重试"}
    duration = time.perf_counter() - t0
    if not result["success"]:
        track_event("user_login_failed", user_id=email, channel="email", reason=result.get("msg", "unknown"))
        return error(result["msg"], "401")
    user_id = (result.get("data") or {}).get("user_id", email) or email
    track_event(EVENT_USER_LOGIN, user_id=str(user_id), channel="email")
    track_funnel("login", "login_success", user_id=str(user_id), channel="email")
    from app.core.tracking import track_latency as _tl
    _tl(EVENT_USER_LOGIN, duration, user_id=str(user_id), channel="email")
    return success(result["data"])


@router.post("/email/code", summary="Send email verification code")
async def send_email_code_endpoint(email: str = Body(..., embed=True)):
    """发送邮箱验证码.

    请求体 JSON 格式 (embed=True 支持):
        {"email": "user@example.com"}

    发送策略:
      - SMTP 已配置 → 发送真实邮件
      - SMTP 未配置 → 开发模式 (验证码输出到后端日志, 不发真实邮件)
    """
    if not email:
        return error("Email required", "400")
    email = email.strip().lower()
    if not is_valid_email(email):
        return error("邮箱格式不正确", "400105")
    logger.info(f"Email code requested for: {email}")
    result = await send_email_code(email)
    if not result["success"]:
        return error(result["msg"], "429")
    return success(msg=result["msg"] or "Code sent")


@router.get("/email/inbox", summary="Get email inbox (local SMTP dev mode)")
async def get_email_inbox(email: str):
    """查询本地 SMTP 服务器捕获的邮件 (开发模式专用, 免费无账号).

    查询参数:
        email: 邮箱地址

    返回该邮箱收到的所有邮件 (含验证码). 仅在本地 SMTP 模式下可用,
    生产环境配置 SMTP_HOST 后此接口返回空列表.
    """
    if not email:
        return error("Email required", "400")
    email = email.strip().lower()
    if not is_valid_email(email):
        return error("邮箱格式不正确", "400105")
    try:
        from app.utils.local_smtp_server import get_inbox, is_running

        if not is_running():
            return success(data={"running": False, "inbox": [], "msg": "本地 SMTP 服务器未运行"})
        inbox = get_inbox(email)
        return success(data={
            "running": True,
            "email": email,
            "count": len(inbox),
            "inbox": inbox,
        })
    except Exception as e:
        logger.exception("get_email_inbox failed: email={}", email)
        return error(f"查询失败: {e}", "500")


@router.delete("/email/inbox", summary="Clear email inbox (local SMTP dev mode)")
async def clear_email_inbox(email: str = Body(None, embed=True)):
    """清空本地 SMTP 服务器捕获的邮件 (开发模式专用).

    请求体 JSON 格式 (embed=True 支持):
        {"email": "user@example.com"}  # 清空指定邮箱
        {}                              # 清空所有邮箱
    """
    try:
        from app.utils.local_smtp_server import clear_inbox

        cleared = clear_inbox(email)
        return success(msg=f"已清空 {cleared} 封邮件", data={"cleared": cleared})
    except Exception as e:
        logger.exception("clear_email_inbox failed")
        return error(f"清空失败: {e}", "500")


@router.post("/register", summary="Register new user")
async def register(
    phone: str = Body(..., embed=True),
    password: str = Body(..., embed=True),
    nickname: str = Body(None, embed=True),
):
    """注册新用户 (JSON Body, embed=True 支持 {phone,password,nickname}).

    2026-06-28 联调: 改 Query→Body, 对齐前端 LOGIN_PWD_PATHS.registerLogin 调用方式.
    """
    track_event("user_register_attempt", user_id=phone, channel="password")
    try:
        result = auth_service.register_user(phone, password, nickname)
    except Exception as _exc:  # service 异常降级
        logger.exception("register_user failed: phone={}", phone)
        result = {"success": False, "msg": "注册失败, 请重试"}
    if not result["success"]:
        track_event("user_register_failed", user_id=phone, reason=result.get("msg", "unknown"))
        return error(result["msg"], "400")
    user_id = (result.get("data") or {}).get("user_id", phone) or phone
    track_event(EVENT_USER_REGISTER, user_id=str(user_id), channel="password")
    track_funnel("register", "register_success", user_id=str(user_id), channel="password")
    return success(result["data"])


@router.post("/refresh", summary="Refresh access token (rotate)")
async def refresh_token(
    refresh_token: str = Body(..., embed=True, alias="refreshToken"),
):
    """使用 refresh token 轮转颁发新 access + refresh (JSON Body).

    请求体 (兼容前端 camelCase): {"refreshToken": "..."} 或 {"refresh_token": "..."}

    安全机制 (Bug-53 rotate_refresh):
      - 旧 refresh 立即进入黑名单 (Redis SET, 7 天 TTL)
      - 检测同 jti 二次使用 → 整 family 失效 + 上报重放告警
      - 同 family 内的旧 jti 都失效, 用户必须重新登录

    T2 滑动续期:
      - 每次 refresh 都颁发新的 access + refresh (family_id 保持)
      - refresh 有效期 7 天, access 有效期 JWT_EXPIRE_MINUTES
      - 客户端应监控 access 剩余时间, 提前 ~5 分钟调用 refresh

    2026-06-28 联调: alias=refreshToken 对齐前端 utils/request.ts:760 的请求字段
      (前端发送 {refreshToken, uuid}, 后端原期望 refresh_token 不匹配).
      响应同时返回 camelCase + snake_case 双字段, 兼容新旧前端.
    """
    from app.config import settings
    from app.utils.refresh_rotation import rotate_refresh

    payload = decode_access_token(refresh_token)
    if not payload:
        return error("Invalid refresh token", "401")

    result = rotate_refresh(payload)
    if not result:
        return error("Refresh token rejected (revoked or replay)", "401")

    new_access, new_refresh, _new_jti, _new_fid = result
    expires_in = settings.JWT_EXPIRE_MINUTES * 60
    refresh_expires_in = 7 * 24 * 60 * 60
    return success({
        # camelCase (前端 utils/request.ts:813-815 读取)
        "accessToken": new_access,
        "refreshToken": new_refresh,
        "tokenType": "Bearer",
        "expiresIn": expires_in,
        "refreshExpiresIn": refresh_expires_in,
        # snake_case (后端规范, 兼容其他客户端)
        "access_token": new_access,
        "refresh_token": new_refresh,
        "token_type": "Bearer",
        "expires_in": expires_in,
        "refresh_expires_in": refresh_expires_in,
    })


@router.get("/info", summary="Get current user info")
async def get_user_info(
    user_uuid: str = Depends(__import__("app.security", fromlist=["require_login"]).require_login),
):
    from app.services.user_service import get_user_by_uuid

    info = get_user_by_uuid(user_uuid)
    if not info:
        return error("User not found", "404")
    return success(info)


@router.post("/logout", summary="Logout")
async def logout(request: Request):
    """登出 - 把当前 token 加入黑名单, 立即失效."""
    from app.core.jwt_blacklist import revoke_token
    auth_header = request.headers.get("authorization", "")
    token = auth_header[7:] if auth_header.startswith("Bearer ") else ""
    if token:
        revoke_token(token)
    return success(msg="logged out")


@router.get("/exist/{phone}", summary="Check if phone is registered")
async def check_phone_exists(phone: str):
    exists = auth_service.check_phone_exists(phone)
    return success({"exists": exists})


@router.post("/sms/code", summary="Send SMS verification code")
async def send_code(phone: str = Body(..., embed=True)):
    """发送短信验证码 (JSON Body, embed=True 支持 {phone}).

    2026-06-28 联调: 改 Query→Body, 对齐前端 LOGIN_PWD_PATHS.sendBatchSms 调用方式.
    """
    logger.info(f"SMS code requested for: {phone}")
    result = await send_sms_code(phone)
    if not result["success"]:
        return error(result["msg"], "429")
    return success(msg="Code sent")


@router.delete("/cancel", summary="User account cancellation (soft delete)")
async def cancel_account(user_uuid: str = Depends(require_login)):
    """Cancel user account -- soft delete user and mask phone.

    Matches Java SQL:
      UPDATE users u LEFT JOIN user_auth_info uai ON u.uuid = uai.user_uuid
      SET u.status = 3, uai.cancel_phone = uai.phone, uai.phone = NULL
      WHERE u.uuid = #{uuid}

    Note: Java does NOT delete third-party bindings on cancel, only masks phone.
    """
    from app.database import SessionFactory2
    from app.models.user_models import User, UserAuthInfo

    db = SessionFactory2()
    try:
        user = db.query(User).filter(User.uuid == user_uuid).first()
        if not user:
            return error("User not found", "404")
        # Soft delete: status=3 matches Java cancelUser (not 0)
        user.status = 3  # type: ignore[assignment]
        # Mask phone in auth_info (save to cancel_phone, clear phone)
        auth = db.query(UserAuthInfo).filter(UserAuthInfo.user_uuid == user_uuid).first()
        if auth and auth.phone:
            auth.cancel_phone = auth.phone  # type: ignore[assignment]
            auth.phone = None  # type: ignore[assignment]
        db.commit()
        return success(msg="Account cancelled")
    except Exception as e:
        db.rollback()
        logger.error(f"Cancel account error: {e}")
        return error("Cancellation failed", "500")
    finally:
        db.close()


@router.put("/profile", summary="Update personal profile")
async def update_profile(
    nickname: str = Body(None),
    email: str = Body(None),
    gender: int = Body(None),
    user_uuid: str = Depends(require_login),
):
    """Update user profile fields (nickname, email, gender)."""
    from typing import Any

    from app.services.user_service import update_user

    update_data: dict[str, Any] = {}
    if nickname is not None:
        update_data["nickname"] = nickname
    if email is not None:
        update_data["email"] = email
    if gender is not None:
        update_data["gender"] = gender
    if not update_data:
        return error("No fields to update", "400")
    result = update_user(user_uuid, **update_data)
    if not result["success"]:
        return error(result["msg"], "500")
    return success(msg="Profile updated")


@router.post("/profile/avatar", summary="Upload avatar")
async def upload_avatar(
    file: UploadFile = File(...),
    user_uuid: str = Depends(require_login),
):
    """Upload avatar image to MinIO and update user record."""
    from app.database import SessionFactory2
    from app.models.user_models import User
    from app.utils.minio_util import upload_file

    allowed_types = {"image/jpeg", "image/png", "image/gif", "image/webp"}
    if file.content_type not in allowed_types:
        return error("Only JPEG/PNG/GIF/WebP images are allowed", "400")
    try:
        file_data = await file.read()
        if len(file_data) > 5 * 1024 * 1024:
            return error("File size exceeds 5MB limit", "400")
        avatar_url = upload_file(
            file_data=file_data,
            file_name=file.filename or "avatar.jpg",
            content_type=file.content_type,
        )
        db = SessionFactory2()
        try:
            user = db.query(User).filter(User.uuid == user_uuid).first()
            if not user:
                return error("User not found", "404")
            user.avatar = avatar_url  # type: ignore[assignment]
            db.commit()
        finally:
            db.close()
        return success({"avatar": avatar_url})
    except Exception as e:
        logger.error(f"Avatar upload error: {e}")
        return error("Avatar upload failed", "500")


@router.put("/profile/password", summary="Change password")
async def change_password(
    old_password: str = Body(...),
    new_password: str = Body(...),
    user_uuid: str = Depends(require_login),
):
    """Change user password -- verifies old password before setting new one."""
    from app.database import SessionFactory2
    from app.models.user_models import User

    if len(new_password) < 6:
        return error("Password must be at least 6 characters", "400")

    db = SessionFactory2()
    try:
        user = db.query(User).filter(User.uuid == user_uuid).first()
        if not user:
            return error("User not found", "404")
        if not user.password_hash or not verify_password(old_password, user.password_hash):  # type: ignore[arg-type]
            return error("Old password is incorrect", "400")
        user.password_hash = hash_password(new_password)  # type: ignore[assignment]
        db.commit()
        return success(msg="Password changed")
    except Exception as e:
        db.rollback()
        logger.error(f"Change password error: {e}")
        return error("Password change failed", "500")
    finally:
        db.close()


@router.get("/profile", summary="Get personal profile with roles and posts")
async def get_profile(user_uuid: str = Depends(require_login)):
    """Get detailed profile including roles and posts."""
    from app.database import SessionFactory2, get_session
    from app.models.sys_models import SysRole, SysUser, SysUserRole
    from app.models.user_models import User, UserAuthInfo, UserMargin

    # Fetch center-db user info
    with get_session(factory=SessionFactory2) as db2:
        user = db2.query(User).filter(User.uuid == user_uuid).first()
        if not user:
            return error("User not found", "404")
        auth = db2.query(UserAuthInfo).filter(UserAuthInfo.user_uuid == user_uuid).first()
        margin = db2.query(UserMargin).filter(UserMargin.user_uuid == user_uuid).first()
        profile = {
            "uuid": user.uuid,
            "nickname": user.nickname,
            "avatar": user.avatar,
            "gender": user.gender,
            "birthday": str(user.birthday) if user.birthday else None,
            "is_vip": user.is_vip,
            "status": user.status,
            "phone": auth.phone if auth else None,
            "token_balance": margin.token_quantity if margin else 0,
            "created_at": str(user.created_at) if user.created_at else None,
        }

    # Fetch roles from sys db (ai project)
    with get_session() as db1:
        sys_user = db1.query(SysUser).filter(SysUser.user_uuid == user_uuid).first()
        if sys_user:
            profile["email"] = sys_user.email
            profile["sys_username"] = sys_user.user_name
            # Roles
            roles = (
                db1.query(SysRole.role_name, SysRole.role_key)
                .join(SysUserRole, SysRole.role_id == SysUserRole.role_id)
                .filter(SysUserRole.user_id == sys_user.user_id)
                .all()
            )
            profile["roles"] = [{"role_name": r.role_name, "role_key": r.role_key} for r in roles]
            # Posts -- use raw query since SysUserPost model doesn't exist
            from sqlalchemy import text

            post_rows = db1.execute(
                text(
                    "SELECT p.post_code, p.post_name FROM admin_post p "
                    "INNER JOIN admin_user_post up ON p.post_id = up.post_id "
                    "WHERE up.user_id = :uid"
                ),
                {"uid": sys_user.user_id},
            ).fetchall()
            profile["posts"] = [{"post_code": p[0], "post_name": p[1]} for p in post_rows]
        else:
            profile["roles"] = []
            profile["posts"] = []

    return success(profile)
