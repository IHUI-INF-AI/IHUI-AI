"""Authentication routes -- login, register, token refresh, SMS."""

import time

from fastapi import APIRouter, Body, Depends, File, Query, Request, UploadFile
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
from app.utils.sms_util import send_sms_code

router = APIRouter(prefix="/auth", tags=["Authentication"])


def _mask_phone(phone: str) -> str:
    """脱敏手机号: 138****5678. 用于日志输出, 避免明文 PII."""
    if not phone or len(phone) < 7:
        return "***"
    return f"{phone[:3]}****{phone[-4:]}"


async def _json_body(request: Request) -> dict:
    """从 request 解析 JSON body, 失败返回空 dict.

    用于让认证端点同时兼容 Query 参数与 JSON Body 两种传参方式
    (前端统一发 JSON Body, 后端历史签名只收 Query).
    """
    try:
        return await request.json()
    except Exception:
        return {}


@router.post("/login", summary="Password login")
async def login(request: Request, phone: str = Query(None), password: str = Query(None)):
    body = await _json_body(request)
    phone = phone or body.get("phone")
    password = password or body.get("password")
    # 兼容前端传 username 字段: 若无 phone 但有 username, 用 username 作为登录标识
    username = body.get("username") if not phone else None
    if not phone and username:
        phone = username  # login_by_password 查 phone 字段, 前端 username 可能是手机号
    if not phone:
        return error("Phone number required", "400")
    track_funnel("login", "login_submit", channel="password")
    t0 = time.perf_counter()
    try:
        result = auth_service.login_by_password(phone, password or "")
    except Exception as _exc:  # service 异常 (DB/Redis 不可用) 降级为 401
        logger.exception("login_by_password failed: phone={}", _mask_phone(phone))
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
async def login_sms(request: Request, phone: str = Query(None), code: str = Query(None)):
    body = await _json_body(request)
    phone = phone or body.get("phone")
    code = code or body.get("code")
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


@router.post("/register", summary="Register new user")
async def register(
    request: Request,
    phone: str = Query(None),
    password: str = Query(None),
    nickname: str = Query(None),
):
    body = await _json_body(request)
    phone = phone or body.get("phone")
    password = password or body.get("password")
    nickname = nickname or body.get("nickname")
    track_event("user_register_attempt", user_id=phone, channel="password")
    try:
        result = auth_service.register_user(phone, password, nickname)
    except Exception as _exc:  # service 异常降级
        logger.exception("register_user failed: phone={}", _mask_phone(phone))
        result = {"success": False, "msg": "注册失败, 请重试"}
    if not result["success"]:
        track_event("user_register_failed", user_id=phone, reason=result.get("msg", "unknown"))
        return error(result["msg"], "400")
    user_id = (result.get("data") or {}).get("user_id", phone) or phone
    track_event(EVENT_USER_REGISTER, user_id=str(user_id), channel="password")
    track_funnel("register", "register_success", user_id=str(user_id), channel="password")
    return success(result["data"])


@router.post("/refresh", summary="Refresh access token (rotate)")
async def refresh_token(request: Request, refresh_token: str = Query(None)):
    """使用 refresh token 轮转颁发新 access + refresh.

    安全机制 (Bug-53 rotate_refresh):
      - 旧 refresh 立即进入黑名单 (Redis SET, 7 天 TTL)
      - 检测同 jti 二次使用 → 整 family 失效 + 上报重放告警
      - 同 family 内的旧 jti 都失效, 用户必须重新登录

    T2 滑动续期:
      - 每次 refresh 都颁发新的 access + refresh (family_id 保持)
      - refresh 有效期 7 天, access 有效期 JWT_EXPIRE_MINUTES
      - 客户端应监控 access 剩余时间, 提前 ~5 分钟调用 refresh
    """
    body = await _json_body(request)
    refresh_token = refresh_token or body.get("refresh_token") or body.get("refreshToken")
    from app.config import settings
    from app.utils.refresh_rotation import rotate_refresh

    payload = decode_access_token(refresh_token)
    if not payload:
        return error("Invalid refresh token", "401")

    result = rotate_refresh(payload)
    if not result:
        return error("Refresh token rejected (revoked or replay)", "401")

    new_access, new_refresh, _new_jti, _new_fid = result
    return success({
        "access_token": new_access,
        "refresh_token": new_refresh,
        "token_type": "Bearer",
        "expires_in": settings.JWT_EXPIRE_MINUTES * 60,
        "refresh_expires_in": 7 * 24 * 60 * 60,
        # camelCase 别名: 前端 axios 拦截器期望 camelCase 字段名
        "accessToken": new_access,
        "refreshToken": new_refresh,
        "tokenType": "Bearer",
        "expiresIn": settings.JWT_EXPIRE_MINUTES * 60,
        "refreshExpiresIn": 7 * 24 * 60 * 60,
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
async def send_code(request: Request, phone: str = Query(None)):
    body = await _json_body(request)
    phone = phone or body.get("phone")
    logger.info(f"SMS code requested for: {_mask_phone(phone)}")
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
        user.status = 3
        # Mask phone in auth_info (save to cancel_phone, clear phone)
        auth = db.query(UserAuthInfo).filter(UserAuthInfo.user_uuid == user_uuid).first()
        if auth and auth.phone:
            auth.cancel_phone = auth.phone
            auth.phone = None
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
    from app.services.user_service import update_user

    update_data = {}
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
            user.avatar = avatar_url
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
        if not user.password_hash or not verify_password(old_password, user.password_hash):
            return error("Old password is incorrect", "400")
        user.password_hash = hash_password(new_password)
        db.commit()
        return success(msg="Password changed")
    except Exception as e:
        db.rollback()
        logger.error(f"Change password error: {e}")
        return error("Password change failed", "500")
    finally:
        db.close()


@router.put("/profile/phone", summary="Change phone number (rebind)")
async def change_phone(
    new_phone: str = Body(...),
    code: str = Body(...),
    user_uuid: str = Depends(require_login),
):
    """换绑手机号: 校验短信验证码后更新手机号."""
    from app.database import SessionFactory2
    from app.models.user_models import User, UserAuthInfo
    from app.utils.sms_util import verify_sms_code

    if not verify_sms_code(new_phone, code):
        return error("短信验证码错误或已过期", "400")

    db = SessionFactory2()
    try:
        user = db.query(User).filter(User.uuid == user_uuid).first()
        if not user:
            return error("User not found", "404")
        auth = db.query(UserAuthInfo).filter(UserAuthInfo.user_uuid == user_uuid).first()
        if auth:
            auth.phone = new_phone
        else:
            auth = UserAuthInfo(user_uuid=user_uuid, phone=new_phone)
            db.add(auth)
        db.commit()
        return success(msg="手机号已更新")
    except Exception as e:
        db.rollback()
        logger.error(f"Change phone error: {e}")
        return error("手机号更新失败", "500")
    finally:
        db.close()


@router.put("/profile/email", summary="Set or update email")
async def set_email(
    email: str = Body(...),
    user_uuid: str = Depends(require_login),
):
    """设置或更新邮箱地址."""
    from app.database import SessionFactory2
    from app.models.user_models import User

    if "@" not in email or len(email) < 5:
        return error("邮箱格式不正确", "400")

    db = SessionFactory2()
    try:
        user = db.query(User).filter(User.uuid == user_uuid).first()
        if not user:
            return error("User not found", "404")
        user.email = email
        db.commit()
        return success(msg="邮箱已更新")
    except Exception as e:
        db.rollback()
        logger.error(f"Set email error: {e}")
        return error("邮箱更新失败", "500")
    finally:
        db.close()


@router.get("/health", summary="Auth service health check")
async def auth_health():
    """认证服务健康检查端点."""
    return success({"status": "ok", "service": "auth"})


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
