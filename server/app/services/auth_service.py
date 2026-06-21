"""鉴权辅助服务.

P15-C2 新增: assert_user_has_role(user_uuid, required_role) -> bool
提供内部 role 校验, 用于避免 FastAPI 0.116 + Python 3.13
对 Depends(require_role(...)) 嵌套闭包签名解析报错.

2026-06-21 联调: 新增 login_by_password / login_by_sms / register_user / refresh_token
实现真实数据库查询, 替代之前的异常降级.
"""

import secrets as _secrets
import uuid as _uuid

from fastapi import HTTPException
from loguru import logger

from app.database import get_session
from app.security import (
    create_access_token,
    create_refresh_token,
    decode_access_token,
    hash_password,
    verify_password,
)


def check_phone_exists(phone: str) -> dict:
    """检查手机号是否已注册.

    Returns:
        {"exists": bool, "msg": str}
    """
    if not phone:
        return {"exists": False, "msg": "phone empty"}
    try:
        with get_session() as db:
            from sqlalchemy import select

            from app.models.user_models import User

            stmt = select(User.uuid).where(User.phone == phone).limit(1)
            row = db.execute(stmt).scalar()
            return {"exists": row is not None, "msg": "ok"}
    except Exception as e:
        return {"exists": False, "msg": str(e)[:200]}


def assert_user_has_role(user_uuid: str | None, required_role: str) -> bool:
    """断言用户拥有 required_role, 否则抛出 403.

    返回 True 表示校验通过, raise HTTPException(403) 表示失败.
    """
    if not user_uuid:
        raise HTTPException(status_code=401, detail="Not authenticated")
    if not required_role:
        return True

    with get_session() as db:
        from sqlalchemy import select

        from app.models.sys_models import SysRole, SysUser, SysUserRole

        stmt = (
            select(SysRole.role_key)
            .join(SysUserRole, SysRole.role_id == SysUserRole.role_id)
            .join(SysUser, SysUserRole.user_id == SysUser.user_id)
            .where(
                SysUser.user_uuid == user_uuid,
                SysRole.role_key == required_role,
                SysRole.status == "0",
                SysRole.del_flag == "0",
            )
            .limit(1)
        )
        row = db.execute(stmt).first()
        if row is None:
            raise HTTPException(status_code=403, detail=f"Requires role: {required_role}")
        return True


# =============================================================================
# 2026-06-21 联调: 真实数据库查询函数
# =============================================================================

def _generate_user_uuid() -> str:
    """生成用户 UUID."""
    return str(_uuid.uuid4()).replace("-", "")


def _build_token_data(user) -> dict:
    """构建登录成功后的返回数据."""
    access_token = create_access_token(subject=user.uuid)
    refresh_token, _jti, _fid = create_refresh_token(subject=user.uuid)
    return {
        "user_id": user.uuid,
        "uuid": user.uuid,
        "access_token": access_token,
        "accessToken": access_token,
        "refresh_token": refresh_token,
        "refreshToken": refresh_token,
        "token_type": "Bearer",
        "tokenType": "Bearer",
        "expires_in": 7200,
        "user": {
            "uuid": user.uuid,
            "phone": user.phone or "",
            "nickname": user.nickname or "",
            "avatar": user.avatar or "",
            "is_vip": getattr(user, "is_vip", 0),
        },
    }


def login_by_password(phone: str, password: str) -> dict:
    """密码登录: 查询 users 表, 验证密码.

    Returns:
        {"success": bool, "msg": str, "data": dict}
    """
    if not phone or not password:
        return {"success": False, "msg": "手机号和密码不能为空"}

    try:
        with get_session() as db:
            from sqlalchemy import select

            from app.models.user_models import User

            stmt = select(User).where(User.phone == phone, User.status == 1).limit(1)
            user = db.execute(stmt).scalar_one_or_none()

            if user is None:
                return {"success": False, "msg": "用户不存在或密码错误"}

            if not user.password_hash:
                return {"success": False, "msg": "用户未设置密码, 请用短信登录"}

            if not verify_password(password, user.password_hash):
                return {"success": False, "msg": "用户不存在或密码错误"}

            logger.info("login_by_password success: phone={}", phone)
            return {"success": True, "msg": "登录成功", "data": _build_token_data(user)}
    except Exception as e:
        logger.exception("login_by_password error: phone={}", phone)
        return {"success": False, "msg": "用户不存在或密码错误"}


def login_by_sms(phone: str, code: str) -> dict:
    """短信验证码登录: 验证验证码, 查询或创建用户.

    Returns:
        {"success": bool, "msg": str, "data": dict}
    """
    if not phone or not code:
        return {"success": False, "msg": "手机号和验证码不能为空"}

    try:
        from app.utils.sms_util import verify_sms_code

        if not verify_sms_code(phone, code):
            return {"success": False, "msg": "验证码错误或已过期"}
    except Exception:
        return {"success": False, "msg": "验证码验证失败"}

    try:
        with get_session() as db:
            from sqlalchemy import select

            from app.models.user_models import User

            stmt = select(User).where(User.phone == phone).limit(1)
            user = db.execute(stmt).scalar_one_or_none()

            if user is None:
                # 自动注册新用户
                user_uuid = _generate_user_uuid()
                user = User(
                    uuid=user_uuid,
                    phone=phone,
                    nickname=f"用户{phone[-4:]}",
                    status=1,
                )
                db.add(user)
                db.commit()
                db.refresh(user)
                logger.info("login_by_sms auto-registered: phone={}, uuid={}", phone, user_uuid)
            else:
                if user.status != 1:
                    return {"success": False, "msg": "账号已被禁用"}
                logger.info("login_by_sms success: phone={}", phone)

            return {"success": True, "msg": "登录成功", "data": _build_token_data(user)}
    except Exception as e:
        logger.exception("login_by_sms error: phone={}", phone)
        return {"success": False, "msg": "登录失败, 请重试"}


def register_user(phone: str, password: str, nickname: str = None) -> dict:
    """注册新用户: 检查手机号是否已注册, 创建新用户.

    Returns:
        {"success": bool, "msg": str, "data": dict}
    """
    if not phone or not password:
        return {"success": False, "msg": "手机号和密码不能为空"}

    try:
        with get_session() as db:
            from sqlalchemy import select

            from app.models.user_models import User

            # 检查手机号是否已注册
            stmt = select(User.uuid).where(User.phone == phone).limit(1)
            existing = db.execute(stmt).scalar()
            if existing:
                return {"success": False, "msg": "该手机号已注册"}

            # 创建新用户
            user_uuid = _generate_user_uuid()
            user = User(
                uuid=user_uuid,
                phone=phone,
                password_hash=hash_password(password),
                nickname=nickname or f"用户{phone[-4:]}",
                status=1,
            )
            db.add(user)
            db.commit()
            db.refresh(user)
            logger.info("register_user success: phone={}, uuid={}", phone, user_uuid)
            return {"success": True, "msg": "注册成功", "data": _build_token_data(user)}
    except Exception as e:
        logger.exception("register_user error: phone={}", phone)
        return {"success": False, "msg": "注册失败, 请重试"}


def refresh_token(refresh_token: str) -> dict:
    """刷新 access token: 验证 refresh token, 返回新的 token 对.

    Returns:
        {"success": bool, "msg": str, "data": dict}
    """
    if not refresh_token:
        return {"success": False, "msg": "refresh_token 不能为空"}

    try:
        payload = decode_access_token(refresh_token)
        if payload is None:
            return {"success": False, "msg": "Invalid refresh token"}

        if payload.get("type") != "refresh":
            return {"success": False, "msg": "Invalid refresh token"}

        user_uuid = payload.get("sub")
        if not user_uuid:
            return {"success": False, "msg": "Invalid refresh token"}

        with get_session() as db:
            from sqlalchemy import select

            from app.models.user_models import User

            stmt = select(User).where(User.uuid == user_uuid, User.status == 1).limit(1)
            user = db.execute(stmt).scalar_one_or_none()
            if user is None:
                return {"success": False, "msg": "用户不存在或已被禁用"}

            logger.info("refresh_token success: uuid={}", user_uuid)
            return {"success": True, "msg": "刷新成功", "data": _build_token_data(user)}
    except Exception as e:
        logger.exception("refresh_token error")
        return {"success": False, "msg": "Invalid refresh token"}


def get_user_info(user_uuid: str) -> dict:
    """获取用户信息.

    Returns:
        {"success": bool, "msg": str, "data": dict}
    """
    if not user_uuid:
        return {"success": False, "msg": "user_uuid 不能为空"}

    try:
        with get_session() as db:
            from sqlalchemy import select

            from app.models.user_models import User

            stmt = select(User).where(User.uuid == user_uuid).limit(1)
            user = db.execute(stmt).scalar_one_or_none()
            if user is None:
                return {"success": False, "msg": "用户不存在"}

            return {
                "success": True,
                "msg": "success",
                "data": {
                    "uuid": user.uuid,
                    "phone": user.phone or "",
                    "nickname": user.nickname or "",
                    "avatar": user.avatar or "",
                    "gender": getattr(user, "gender", 0),
                    "is_vip": getattr(user, "is_vip", 0),
                    "status": getattr(user, "status", 1),
                },
            }
    except Exception as e:
        logger.exception("get_user_info error: uuid={}", user_uuid)
        return {"success": False, "msg": "获取用户信息失败"}
