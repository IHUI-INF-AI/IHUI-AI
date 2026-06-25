"""
SSO (单点登录) 路由.

迁移自 edu Java 微服务 ihui-ai-edu-auth-service 的 SsoController.
原始 Java 类: com.ihui.edu.auth.controller.SsoController

包含 5 个单点登录端点:
  - POST /sso/admin/login   管理员 SSO 登录 (验证 SysUser)
  - POST /sso/member/login  会员 SSO 登录 (验证 User)
  - POST /sso/uuid/login    UUID 直接登录 (通过 uuid 获取用户并签发 token)
  - POST /sso/admin/create  创建管理员 (需登录)
  - POST /sso/member/create 创建会员 (创建 User + UserAuthInfo)
"""

import ipaddress
import uuid as _uuid

from fastapi import APIRouter, Body, Depends, Query, Request
from loguru import logger
from sqlalchemy import select

from app.config import settings
from app.database import SessionFactory2, get_session
from app.models.sys_models import SysUser
from app.models.user_models import User, UserAuthInfo
from app.schemas.common import error, success
from app.security import create_access_token, hash_password, require_role, verify_password
from app.services import auth_service

router = APIRouter(prefix="/sso", tags=["SSO"])


def _mask_phone(phone: str) -> str:
    """脱敏手机号: 138****5678. 用于日志输出, 避免明文 PII."""
    if not phone or len(phone) < 7:
        return "***"
    return f"{phone[:3]}****{phone[-4:]}"


def _generate_uuid() -> str:
    """生成 32 位无连字符 UUID (与 User.uuid 格式一致)."""
    return str(_uuid.uuid4()).replace("-", "")


def _is_internal_ip(ip: str) -> bool:
    """判断 IP 是否为内网地址 (loopback / private)."""
    try:
        addr = ipaddress.ip_address(ip)
        return addr.is_private or addr.is_loopback
    except ValueError:
        return False


def _token_expires_in_seconds() -> int:
    """返回 access token 实际过期秒数 (与 settings.JWT_EXPIRE_MINUTES 一致)."""
    return settings.JWT_EXPIRE_MINUTES * 60


@router.post("/admin/login", summary="管理员 SSO 登录")
def admin_login(username: str = Body(...), password: str = Body(...)):
    """管理员单点登录.

    通过用户名和密码验证 SysUser (admin_user 表),
    验证成功后签发 JWT access token.

    Args:
        username: 管理员用户名 (对应 SysUser.user_name)
        password: 管理员密码 (明文, 服务端与 bcrypt 哈希比对)

    Returns:
        成功: {access_token, token_type, expires_in, user}
        失败: 错误信息
    """
    if not username or not password:
        return error("用户名和密码不能为空", "400000")
    try:
        with get_session() as db:
            stmt = (
                select(SysUser)
                .where(
                    SysUser.user_name == username,
                    SysUser.status == "0",
                    SysUser.del_flag == "0",
                )
                .limit(1)
            )
            sys_user = db.execute(stmt).scalar_one_or_none()

            if sys_user is None:
                return error("用户不存在或已禁用", "401000")

            if not sys_user.password or not verify_password(password, sys_user.password):
                return error("用户名或密码错误", "401000")

            if not sys_user.user_uuid:
                return error("管理员账号未绑定 UUID, 请联系系统管理员", "401000")

            token = create_access_token(subject=sys_user.user_uuid)
            logger.info("SSO admin login success: username={}", username)
            return success(
                {
                    "access_token": token,
                    "token_type": "Bearer",
                    "expires_in": _token_expires_in_seconds(),
                    "user": {
                        "user_id": sys_user.user_id,
                        "uuid": sys_user.user_uuid,
                        "username": sys_user.user_name,
                        "nickname": sys_user.nick_name,
                    },
                }
            )
    except Exception as e:
        logger.error("SSO admin login error: username={}, err={}", username, e)
        return error("登录失败, 请稍后重试", "500000")


@router.post("/member/login", summary="会员 SSO 登录")
def member_login(phone: str = Body(...), password: str = Body(...)):
    """会员单点登录.

    通过手机号和密码验证 User (users 表),
    验证成功后签发 JWT access token.

    Args:
        phone: 会员手机号 (对应 User.phone)
        password: 会员密码 (明文, 服务端与 bcrypt 哈希比对)

    Returns:
        成功: {access_token, token_type, expires_in, user}
        失败: 错误信息
    """
    if not phone or not password:
        return error("手机号和密码不能为空", "400000")
    try:
        result = auth_service.login_by_password(phone, password)
        if not result["success"]:
            return error(result["msg"], "401000")
        logger.info("SSO member login success: phone={}", _mask_phone(phone))
        return success(result["data"])
    except Exception as e:
        logger.error("SSO member login error: phone={}, err={}", _mask_phone(phone), e)
        return error("登录失败, 请稍后重试", "500000")


@router.post("/uuid/login", summary="UUID 直接登录")
def uuid_login(request: Request, uuid: str = Body(..., embed=True)):
    """UUID 直接登录.

    通过用户 UUID 直接获取用户信息并签发 token,
    适用于已认证场景下的免密登录 (如第三方系统对接).

    安全限制:
      - 仅允许内网 IP 调用 (loopback / private)
      - 必须携带 X-Internal-Auth 头, 且与 settings.INTERNAL_AUTH_KEY 匹配

    Args:
        request: FastAPI Request (用于读取 client host / header)
        uuid: 用户 UUID (对应 User.uuid)

    Returns:
        成功: {access_token, token_type, expires_in, user}
        失败: 错误信息
    """
    # 安全校验: 仅允许内网调用 + 内部签名密钥
    client_ip = request.client.host if request.client else ""
    if not _is_internal_ip(client_ip):
        logger.warning("SSO uuid login rejected: non-internal ip={}, uuid={}", client_ip, uuid)
        return error("UUID 登录仅允许从内网调用", "403000")

    internal_auth_key = settings.INTERNAL_AUTH_KEY
    if not internal_auth_key:
        logger.warning("SSO uuid login rejected: INTERNAL_AUTH_KEY not configured")
        return error("UUID 登录内部密钥未配置, 已禁用", "403000")

    provided_key = request.headers.get("X-Internal-Auth", "")
    if not provided_key or provided_key != internal_auth_key:
        logger.warning("SSO uuid login rejected: invalid X-Internal-Auth, ip={}, uuid={}", client_ip, uuid)
        return error("UUID 登录内部密钥校验失败", "403000")

    if not uuid:
        return error("uuid 不能为空", "400000")
    try:
        db = SessionFactory2()
        try:
            stmt = select(User).where(User.uuid == uuid, User.status == 1).limit(1)
            user = db.execute(stmt).scalar_one_or_none()

            if user is None:
                return error("用户不存在或已被禁用", "401000")

            token = create_access_token(subject=user.uuid)
            logger.info("SSO uuid login success: uuid={}, ip={}", uuid, client_ip)
            return success(
                {
                    "access_token": token,
                    "token_type": "Bearer",
                    "expires_in": _token_expires_in_seconds(),
                    "user": {
                        "uuid": user.uuid,
                        "phone": user.phone or "",
                        "nickname": user.nickname or "",
                        "avatar": user.avatar or "",
                        "is_vip": getattr(user, "is_vip", 0),
                    },
                }
            )
        finally:
            db.close()
    except Exception as e:
        logger.error("SSO uuid login error: uuid={}, err={}", uuid, e)
        return error("登录失败, 请稍后重试", "500000")


@router.post("/admin/create", summary="创建管理员")
def admin_create(
    username: str = Body(...),
    password: str = Body(...),
    nickname: str = Body(None),
    role_ids: list = Body(None),
    user_uuid: str = Depends(require_role("admin")),
):
    """创建管理员账号.

    需要 admin 角色权限. 创建 SysUser 记录并可选分配角色.

    Args:
        username: 管理员用户名 (唯一)
        password: 管理员密码 (明文, 服务端 bcrypt 哈希后存储)
        nickname: 管理员昵称 (可选, 默认同 username)
        role_ids: 角色 ID 列表 (可选, 用于分配角色)
        user_uuid: 当前登录用户 UUID (由 require_role("admin") 注入, 已校验 admin 角色)

    Returns:
        成功: {user_id, uuid, username, nickname}
        失败: 错误信息
    """
    if not username or not password:
        return error("用户名和密码不能为空", "400000")
    try:
        with get_session() as db:
            # 检查用户名是否已存在
            stmt = (
                select(SysUser.user_id)
                .where(SysUser.user_name == username, SysUser.del_flag == "0")
                .limit(1)
            )
            existing = db.execute(stmt).scalar()
            if existing:
                return error("用户名已存在", "400000")

            # 创建管理员
            new_uuid = str(_uuid.uuid4())
            sys_user = SysUser(
                user_uuid=new_uuid,
                user_name=username,
                nick_name=nickname or username,
                password=hash_password(password),
                status="0",
                del_flag="0",
                create_by=user_uuid,
            )
            db.add(sys_user)
            db.flush()

            # 分配角色
            if role_ids:
                from app.models.sys_models import SysUserRole

                for role_id in role_ids:
                    db.add(SysUserRole(user_id=sys_user.user_id, role_id=role_id))

            logger.info(
                "SSO admin create success: username={}, uuid={}, roles={}",
                username,
                new_uuid,
                role_ids or [],
            )
            return success(
                {
                    "user_id": sys_user.user_id,
                    "uuid": new_uuid,
                    "username": sys_user.user_name,
                    "nickname": sys_user.nick_name,
                }
            )
    except Exception as e:
        logger.error("SSO admin create error: username={}, err={}", username, e)
        return error("创建管理员失败, 请稍后重试", "500000")


@router.post("/member/create", summary="创建会员")
def member_create(
    phone: str = Body(...),
    password: str = Body(...),
    nickname: str = Body(None),
):
    """创建会员账号.

    创建 User 记录 (users 表) 和 UserAuthInfo 记录 (user_auth_info 表),
    密码使用 bcrypt 哈希后存储.

    Args:
        phone: 会员手机号 (唯一)
        password: 会员密码 (明文, 服务端 bcrypt 哈希后存储)
        nickname: 会员昵称 (可选, 默认 "用户" + 手机号后四位)

    Returns:
        成功: {uuid, phone, nickname}
        失败: 错误信息
    """
    if not phone or not password:
        return error("手机号和密码不能为空", "400000")
    db = SessionFactory2()
    try:
        # 检查手机号是否已注册
        stmt = select(User.uuid).where(User.phone == phone).limit(1)
        existing = db.execute(stmt).scalar()
        if existing:
            return error("该手机号已注册", "400000")

        # 创建用户
        new_uuid = _generate_uuid()
        user = User(
            uuid=new_uuid,
            phone=phone,
            password_hash=hash_password(password),
            nickname=nickname or f"用户{phone[-4:]}",
            status=1,
        )
        db.add(user)

        # 创建用户认证信息
        auth_info = UserAuthInfo(
            user_uuid=new_uuid,
            phone=phone,
        )
        db.add(auth_info)

        db.commit()
        logger.info("SSO member create success: phone={}, uuid={}", _mask_phone(phone), new_uuid)
        return success(
            {
                "uuid": new_uuid,
                "phone": phone,
                "nickname": user.nickname,
            }
        )
    except Exception as e:
        db.rollback()
        logger.error("SSO member create error: phone={}, err={}", _mask_phone(phone), e)
        return error("创建会员失败, 请稍后重试", "500000")
    finally:
        db.close()
