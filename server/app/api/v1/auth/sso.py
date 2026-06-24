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

import uuid as _uuid

from fastapi import APIRouter, Body, Depends, Query
from loguru import logger
from sqlalchemy import select

from app.database import SessionFactory2, get_session
from app.models.sys_models import SysUser
from app.models.user_models import User, UserAuthInfo
from app.schemas.common import error, success
from app.security import create_access_token, hash_password, require_login, verify_password
from app.services import auth_service

router = APIRouter(prefix="/sso", tags=["SSO"])


def _generate_uuid() -> str:
    """生成 32 位无连字符 UUID (与 User.uuid 格式一致)."""
    return str(_uuid.uuid4()).replace("-", "")


@router.post("/admin/login", summary="管理员 SSO 登录")
async def admin_login(username: str = Body(...), password: str = Body(...)):
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
                    "expires_in": 7200,
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
async def member_login(phone: str = Body(...), password: str = Body(...)):
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
        logger.info("SSO member login success: phone={}", phone)
        return success(result["data"])
    except Exception as e:
        logger.error("SSO member login error: phone={}, err={}", phone, e)
        return error("登录失败, 请稍后重试", "500000")


@router.post("/uuid/login", summary="UUID 直接登录")
async def uuid_login(uuid: str = Body(..., embed=True)):
    """UUID 直接登录.

    通过用户 UUID 直接获取用户信息并签发 token,
    适用于已认证场景下的免密登录 (如第三方系统对接).

    Args:
        uuid: 用户 UUID (对应 User.uuid)

    Returns:
        成功: {access_token, token_type, expires_in, user}
        失败: 错误信息
    """
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
            logger.info("SSO uuid login success: uuid={}", uuid)
            return success(
                {
                    "access_token": token,
                    "token_type": "Bearer",
                    "expires_in": 7200,
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
async def admin_create(
    username: str = Body(...),
    password: str = Body(...),
    nickname: str = Body(None),
    role_ids: list = Body(None),
    user_uuid: str = Depends(require_login),
):
    """创建管理员账号.

    需要登录态. 创建 SysUser 记录并可选分配角色.

    Args:
        username: 管理员用户名 (唯一)
        password: 管理员密码 (明文, 服务端 bcrypt 哈希后存储)
        nickname: 管理员昵称 (可选, 默认同 username)
        role_ids: 角色 ID 列表 (可选, 用于分配角色)
        user_uuid: 当前登录用户 UUID (由 require_login 注入)

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
async def member_create(
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
        logger.info("SSO member create success: phone={}, uuid={}", phone, new_uuid)
        return success(
            {
                "uuid": new_uuid,
                "phone": phone,
                "nickname": user.nickname,
            }
        )
    except Exception as e:
        db.rollback()
        logger.error("SSO member create error: phone={}, err={}", phone, e)
        return error("创建会员失败, 请稍后重试", "500000")
    finally:
        db.close()
