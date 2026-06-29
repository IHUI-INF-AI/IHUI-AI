"""用户名 + 密码登录 (Admin系统 SysUser 表) -- 供前端 admin/ry 演示登录.

POST /api/v1/login/username
  params: username, password
  returns: { access_token, refresh_token, token_type, user_id, user_name, nick_name, ... }
"""


from fastapi import APIRouter, Body
from loguru import logger

from app.schemas.common import error, success
from app.security import create_access_token, verify_password
from app.utils.redis_util import delete_key, get_key, incr_key_with_expire

# 登录失败限制
_LOGIN_FAIL_PREFIX = "sms:login:fail:"
_LOGIN_FAIL_MAX = 5
_LOGIN_FAIL_LOCK_SECONDS = 15 * 60  # 15 分钟

router = APIRouter(prefix="/login", tags=["Username Login (Ruoyi demo)"])


def _get_db_session():
    """懒加载 SysUser/SysUserRole -- 按 admin_user 实际所在库依次尝试.

    优先级: SessionFactory1 (ai/中心) > SessionFactory2 > SessionFactory3.
    admin_user 实际位于 AI_PROJECT_TABLES (engine1), 因此首选 SessionFactory1.
    """
    for factory_name in ("SessionFactory1", "SessionFactory2", "SessionFactory3"):
        try:
            from app import database as _db

            factory = getattr(_db, factory_name, None)
            if factory is not None:
                return factory()
        except Exception:
            continue
    return None


@router.post("/username", summary="用户名密码登录 (内置 admin/ry)")
async def login_by_username(
    username: str = Body(..., embed=True, description="用户名 (admin / ry)"),
    password: str = Body(..., embed=True, description="明文密码"),
):
    """前端演示登录: 用户名 + 密码, 返回 JWT + 用户信息.

    对应 Java: AdminLoginController.login (Admin版).

    2026-06-28 联调: 改 Query→Body, 对齐前端 ADMIN_LOGIN_PATHS.login 调用方式
    (前端发送 JSON body {username, password}).
    """
    db = _get_db_session()
    if db is None:
        return error("数据库不可用", code="500000")

    fail_key = _LOGIN_FAIL_PREFIX + username

    # 检查是否已被锁定
    fail_count = get_key(fail_key)
    if fail_count and int(fail_count) >= _LOGIN_FAIL_MAX:
        return error("登录失败次数过多,账号已锁定15分钟", code="429000")

    try:
        from app.models.sys_models import SysRole, SysUser, SysUserRole

        user = db.query(SysUser).filter(SysUser.user_name == username, SysUser.del_flag == "0").first()
        if not user:
            incr_key_with_expire(fail_key, _LOGIN_FAIL_LOCK_SECONDS)
            return error(f"用户不存在: {username}", code="401001")
        if user.status == "1":
            return error("账号已停用", code="403001")
        if not verify_password(password, user.password or ""):
            incr_key_with_expire(fail_key, _LOGIN_FAIL_LOCK_SECONDS)
            return error("密码错误", code="401002")

        # 登录成功,清除失败计数
        delete_key(fail_key)
        # 拿角色
        roles = (
            db.query(SysRole)
            .join(SysUserRole, SysUserRole.role_id == SysRole.role_id)
            .filter(SysUserRole.user_id == user.user_id)
            .all()
        )
        role_keys = [r.role_key for r in roles] or ["common"]
        # 拿部门
        dept_name = None
        if user.dept_id:
            try:
                from app.models.system.dept import SysDept

                dept = db.query(SysDept).filter(SysDept.dept_id == user.dept_id).first()
                if dept:
                    dept_name = dept.dept_name
            except Exception:
                logger.warning("Unexpected error in line 94")
                pass
        # 签 JWT
        token = create_access_token(
            subject=str(user.user_id),
            extra_claims={
                "user_name": user.user_name,
                "nick_name": user.nick_name or user.user_name,
                "roles": role_keys,
                "dept": dept_name,
            },
        )
        # Bug-53: 用 create_refresh_token 颁发带 jti + family_id 的 refresh, 支持轮转 + 重放检测
        from app.config import settings
        from app.security import create_refresh_token

        refresh, _jti, _fid = create_refresh_token(subject=str(user.user_id))
        return success(
            {
                # snake_case (后端规范)
                "access_token": token,
                "refresh_token": refresh,
                "token_type": "Bearer",
                # camelCase (前端 utils/request.ts 兼容)
                "accessToken": token,
                "refreshToken": refresh,
                "tokenType": "Bearer",
                # T2 滑动续期: 告诉前端 token 剩余有效期, 便于提前 refresh
                "expires_in": settings.JWT_EXPIRE_MINUTES * 60,  # access 剩余秒数
                "refresh_expires_in": 7 * 24 * 60 * 60,  # refresh 7 天
                "user_id": user.user_id,
                "user_name": user.user_name,
                "nick_name": user.nick_name,
                "avatar": user.avatar or "",
                "roles": role_keys,
                "dept": dept_name,
                "permissions": ["*"] if "admin" in role_keys else [],
            }
        )
    except Exception as e:
        logger.error(f"username login error: {e}")
        return error(f"登录失败: {e}", code="500000")
    finally:
        try:
            db.close()
        except Exception:
            logger.warning("Unexpected error in line 129")
            pass
