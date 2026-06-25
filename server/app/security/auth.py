"""
JWT authentication and password hashing.

Replaces Spring Security / Admin token system with:
- JWT token generation / validation / refresh
- Password hashing with bcrypt
- RBAC decorators (@require_login, @require_role, @require_permission)
- DataScope data permission filtering
"""

import datetime as dt
import os

import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer
from jwt.exceptions import PyJWTError
from passlib.context import CryptContext
from sqlalchemy import func, select
from starlette.concurrency import run_in_threadpool

from app.config import settings
from app.database import get_session


def _validate_jwt_secret() -> str:
    """启动时强制校验 JWT_SECRET_KEY, 防止弱密钥/默认值上线."""
    secret = settings.JWT_SECRET_KEY
    weak_values = {
        "",
        "change-me-to-a-random-256-bit-key",
        "secret",
        "changeme",
    }
    if secret in weak_values or len(secret) < 32:
        raise RuntimeError(
            "JWT_SECRET_KEY 未设置或强度不足 (>=32 字符, 不可为默认值), " "请在 .env.production 中配置强随机密钥后重启."
        )
    return secret


JWT_SECRET_KEY = _validate_jwt_secret()


def _validate_session_secret() -> str:
    """启动时校验 SESSION_SECRET_KEY, 防止默认值上线."""
    secret = settings.SESSION_SECRET_KEY
    weak_values = {
        "",
        "zhs_platform_session_secret_key_2026",
        "secret",
        "changeme",
    }
    if secret in weak_values or len(secret) < 32:
        env_name = os.environ.get("ENV", settings.ENV)
        if env_name in ("production", "prod", "staging"):
            raise RuntimeError(
                "SESSION_SECRET_KEY 未设置或强度不足 (>=32 字符, 不可为默认值), "
                "请在 .env.production 中配置强随机密钥后重启."
            )
    return secret


_validate_session_secret()


def _validate_db_config() -> None:
    """启动时校验数据库 URL 已配置, 生产环境缺失则 fast-fail."""
    env_name = os.environ.get("ENV", settings.ENV)
    if env_name in ("production", "prod", "staging"):
        missing = []
        for name in ("DB1_URL", "DB2_URL", "DB3_URL"):
            if not getattr(settings, name, "").strip():
                missing.append(name)
        if missing:
            raise RuntimeError(
                f"数据库配置缺失: {', '.join(missing)}."
                " 请在 .env.production 中配置 postgresql 连接串后重启."
            )


_validate_db_config()

# ---------------------------------------------------------------------------
# Password hashing
# ---------------------------------------------------------------------------

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def hash_password(password: str) -> str:
    """Hash a password with bcrypt.

    bcrypt 仅支持前 72 字节, 超过部分会直接抛 ValueError (passlib 1.7+).
    统一在入口截断, 避免不同 passlib 版本行为不一致.
    """
    if not isinstance(password, str):
        raise TypeError("password must be str")
    encoded = password.encode("utf-8")
    if len(encoded) > 72:
        encoded = encoded[:72]
    return pwd_context.hash(encoded.decode("utf-8", errors="ignore"))


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify a plain password against a bcrypt hash."""
    if not plain_password or not hashed_password:
        return False
    try:
        encoded = plain_password.encode("utf-8")
        if len(encoded) > 72:
            encoded = encoded[:72]
        return pwd_context.verify(encoded.decode("utf-8", errors="ignore"), hashed_password)
    except Exception:
        return False


# ---------------------------------------------------------------------------
# JWT
# ---------------------------------------------------------------------------

ALGORITHM = "HS256"


def create_access_token(
    subject: str,
    expires_delta: dt.timedelta | None = None,
    extra_claims: dict | None = None,
    token_type: str = "access",
    jti: str | None = None,
) -> str:
    """Create a JWT access token.

    Bug-53 修复: 支持 token_type + jti 字段, 用于 refresh token 轮转追踪.
    """
    expire = dt.datetime.now(dt.UTC) + (expires_delta or dt.timedelta(minutes=settings.JWT_EXPIRE_MINUTES))
    import secrets as _secrets

    claims = {
        "sub": subject,
        "exp": expire,
        "iat": dt.datetime.now(dt.UTC),
        "type": token_type,
        "jti": jti or _secrets.token_urlsafe(16),
    }
    if extra_claims:
        claims.update(extra_claims)
    return jwt.encode(claims, JWT_SECRET_KEY, algorithm=ALGORITHM)


def create_refresh_token(subject: str, family_id: str | None = None) -> tuple[str, str, str]:
    """Create a refresh token (Bug-53).

    Returns:
        (token, jti, family_id) - jti 用于追踪, family_id 用于检测 token 重放.
    """
    import secrets as _secrets

    jti = _secrets.token_urlsafe(16)
    fid = family_id or _secrets.token_urlsafe(12)
    token = create_access_token(
        subject,
        expires_delta=dt.timedelta(days=7),
        token_type="refresh",
        jti=jti,
        extra_claims={"family_id": fid},
    )
    return token, jti, fid


def decode_access_token(token: str, allow_refresh: bool = False) -> dict | None:
    """Decode and validate a JWT token. Returns payload or None.

    Bug-26: 同时检查 JWT 黑名单, 已吊销的 token 返回 None.
    设计: 默认拒绝 refresh token (防止被当作 access token 滥用),
         refresh token 轮转场景传 allow_refresh=True.
    """
    try:
        payload = jwt.decode(token, JWT_SECRET_KEY, algorithms=[ALGORITHM])
        # 拒绝 refresh token 被当作 access token 使用 (除非显式允许)
        if payload.get("type") == "refresh" and not allow_refresh:
            return None
        # 检查黑名单 (fail-open: Redis 异常时不阻塞)
        from app.core.jwt_blacklist import is_jwt_revoked
        if is_jwt_revoked(token):
            return None
        return payload
    except PyJWTError:
        return None


# ---------------------------------------------------------------------------
# RBAC decorators (FastAPI Depends)
# ---------------------------------------------------------------------------

security_scheme = HTTPBearer(auto_error=False)


def get_current_user_uuid(
    credentials=Depends(security_scheme),
):
    """Extract and validate user UUID from JWT token.
    Returns user UUID string or None (for public endpoints).

    建议 102: 解 JWT 时同时把 tenant_id 注入 ContextVar,
    后续所有 ORM query 会自动走 tenant_{tid} schema (多租户模式).
    """
    if credentials is None:
        return None

    payload = decode_access_token(credentials.credentials)
    if payload is None:
        return None

    # 注入 tenant_id 到 contextvar (建议 102 阶段 1)
    # 多租户模式下拒绝无 tenant_id 的 token (防止老 token 默认到 tenant_1 越权)
    from app.core.tenant import set_current_tenant_id

    tenant_id = payload.get("tenant_id")
    if tenant_id is None:
        if getattr(settings, "MULTI_TENANT_ENABLED", False):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Token missing tenant_id",
            )
        # 单租户模式: 向后兼容, 老 token 无 tenant_id 字段时默认 tenant_1
        tenant_id = 1
    try:
        set_current_tenant_id(int(tenant_id))
    except (ValueError, TypeError):
        set_current_tenant_id(1)

    return payload.get("sub")


def require_login(
    user_uuid=Depends(get_current_user_uuid),
):
    """Require a valid login. Returns user UUID or raises 401."""
    if not user_uuid:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required",
            headers={"WWW-Authenticate": "Bearer"},
        )
    # 建议 99: 注入 user_id 到 telemetry contextvar, BizTimer(with_user=True) 才能拿到
    # 注意: 必须是 async def, 否则 FastAPI 会把 sync 依赖扔到 threadpool, ContextVar 跨线程读不到
    # tenant_id 留 None (建议 87 多租户改造未实施, BizTimer 拿不到时会退化为 "anonymous")
    from app.telemetry import set_request_context

    set_request_context(user_id=user_uuid, reset=True)
    return user_uuid


def require_role(required_role: str):
    """Return a dependency that checks if user has the required role.

    Args:
        required_role: The role_key to check (e.g., 'admin', 'agent')

    Returns:
        Dependency that yields user_uuid if authorized, raises 403 otherwise.
    """

    async def _check_role(user_uuid=Depends(require_login)):
        from app.models.sys_models import SysRole, SysUser, SysUserRole

        def _query():
            # 同步 session 在 async 上下文中会阻塞事件循环, 用 run_in_threadpool 卸载到线程池
            with get_session() as db:
                # Query: admin_user -> admin_user_role -> admin_role
                stmt = (
                    select(SysUser.user_id)
                    .join(SysUserRole, SysUser.user_id == SysUserRole.user_id)
                    .join(SysRole, SysUserRole.role_id == SysRole.role_id)
                    .where(
                        SysUser.user_uuid == user_uuid,
                        SysRole.role_key == required_role,
                        SysRole.status == "0",  # 0 = active
                        SysRole.del_flag == "0",  # 0 = not deleted
                    )
                    .limit(1)
                )
                return db.execute(stmt).scalar()

        result = await run_in_threadpool(_query)
        if result is None:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Role '{required_role}' required",
            )
        return user_uuid

    return _check_role


def require_permission(permission_key: str):
    """Return a dependency that checks if user has the required permission.

    Args:
        permission_key: The permission string (e.g., 'system:user:list')

    Returns:
        Dependency that yields user_uuid if authorized, raises 403 otherwise.
    """

    async def _check_perm(user_uuid: str = Depends(require_login)):
        from app.models.sys_models import SysMenu, SysRoleMenu, SysUser, SysUserRole

        def _query():
            # 同步 session 在 async 上下文中会阻塞事件循环, 用 run_in_threadpool 卸载到线程池
            with get_session() as db:
                # Query: admin_user -> admin_user_role -> admin_role_menu -> admin_menu
                stmt = (
                    select(SysUser.user_id)
                    .join(SysUserRole, SysUser.user_id == SysUserRole.user_id)
                    .join(SysRoleMenu, SysUserRole.role_id == SysRoleMenu.role_id)
                    .join(SysMenu, SysRoleMenu.menu_id == SysMenu.menu_id)
                    .where(
                        SysUser.user_uuid == user_uuid,
                        SysMenu.perms == permission_key,
                        SysMenu.status == "0",  # 0 = active
                    )
                    .limit(1)
                )
                return db.execute(stmt).scalar()

        result = await run_in_threadpool(_query)
        if result is None:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Permission '{permission_key}' required",
            )
        return user_uuid

    return _check_perm


# ---------------------------------------------------------------------------
# DataScope -- data-level permission filtering
# ---------------------------------------------------------------------------
# Admin data_scope values:
#   1 = 全部数据权限
#   2 = 自定义数据权限
#   3 = 本部门数据权限
#   4 = 本部门及以下数据权限
#   5 = 仅本人数据权限
DATASCOPE_ALL = "1"
DATASCOPE_CUSTOM = "2"
DATASCOPE_DEPT = "3"
DATASCOPE_DEPT_AND_CHILDREN = "4"
DATASCOPE_SELF = "5"


def _get_user_dept_id(db, user_uuid: str):
    """Return the dept_id for a user, or None."""
    from app.models.sys_models import SysUser

    stmt = select(SysUser.dept_id).where(SysUser.user_uuid == user_uuid).limit(1)
    return db.execute(stmt).scalar()


def _get_user_id(db, user_uuid: str):
    """Return the user_id for a user, or None."""
    from app.models.sys_models import SysUser

    stmt = select(SysUser.user_id).where(SysUser.user_uuid == user_uuid).limit(1)
    return db.execute(stmt).scalar()


def _get_dept_ids_with_children(db, dept_id: int) -> list:
    """Return dept_id and all descendant dept_ids using the ancestors path.

    SysDept.ancestors stores the full path like '0,100,101'.
    A child whose ancestors contains str(dept_id) is a descendant.
    """
    from app.models.sys_models import SysDept

    stmt = select(SysDept.dept_id).where(
        func.concat(",", SysDept.ancestors, ",").like(f"%,{dept_id},%"),
        SysDept.status == "0",
        SysDept.del_flag == "0",
    )
    rows = db.execute(stmt).scalars().all()
    ids = set(rows)
    ids.add(dept_id)
    return list(ids)


def _get_custom_dept_ids(db, role_ids: list) -> list:
    """Return dept_ids assigned to the given roles via SysRoleDept (data_scope=2)."""
    from app.models.sys_models import SysRoleDept

    stmt = select(SysRoleDept.dept_id).where(SysRoleDept.role_id.in_(role_ids))
    return list(db.execute(stmt).scalars().all())


def build_data_scope_query(db, user_uuid: str, dept_field):
    """构建数据权限 SQLAlchemy WHERE 子句 (Bug-12 重写: 单次查询完成).

    策略:
      - 用一个 SQL JOIN 同时拿 user.dept_id + 所有 role.data_scope + role_id
      - 不再二次 round-trip 重新查 scopes
      - 对 scope=5 (self) 改返回特定标记, 由 get_data_scope_filter 收尾

    Args:
        db: SQLAlchemy Session (调用方管理生命周期)
        user_uuid: 当前用户 UUID
        dept_field: 目标表的 dept_id 列 (如 SomeModel.dept_id, None 表示无该列)

    Returns:
        - None: 无需过滤 (全量访问)
        - SQLAlchemy 表达式: 应当 .where() 应用
        - 特殊 sentinel: ("SCOPE_SELF", user_dept_id, role_ids) 表示需调用方
          配合 create_by 字段处理
    """
    from sqlalchemy import literal, select

    from app.models.sys_models import SysRole, SysUser, SysUserRole

    # 单次 SQL JOIN 拿到所有必要字段
    stmt = (
        select(SysUser.dept_id, SysRole.data_scope, SysRole.role_id)
        .join(SysUserRole, SysUserRole.user_id == SysUser.user_id, isouter=True)
        .join(SysRole, SysRole.role_id == SysUserRole.role_id, isouter=True)
        .where(
            SysUser.user_uuid == user_uuid,
            SysUser.del_flag == "0",
        )
    )
    rows = db.execute(stmt).all()
    if not rows:
        return literal(False)

    # 取 user.dept_id (去重, 第一行有)
    user_dept_id = rows[0][0]

    # 收集所有 (data_scope, role_id), 过滤掉 role=None 的行
    scopes = [(r[1] or DATASCOPE_ALL, r[2]) for r in rows if r[1] is not None and r[2] is not None]
    if not scopes:
        return literal(False)

    # data_scope 按数值比较取最小 (避免字符串字典序问题), 结果转回字符串与常量比较
    valid_scopes = [s[0] for s in scopes if str(s[0]).isdigit()]
    if not valid_scopes:
        return literal(False)
    best_scope = str(min(int(s) for s in valid_scopes))

    # Scope 1: 全量
    if best_scope == DATASCOPE_ALL:
        return None

    # Scope 2: 自定义部门
    if best_scope == DATASCOPE_CUSTOM:
        role_ids_with_custom = [s[1] for s in scopes if s[0] == DATASCOPE_CUSTOM]
        allowed_dept_ids = _get_custom_dept_ids(db, role_ids_with_custom)
        if not allowed_dept_ids:
            return literal(False)
        if dept_field is not None:
            return dept_field.in_(allowed_dept_ids)
        return None

    # Scope 3: 本部门
    if best_scope == DATASCOPE_DEPT:
        if user_dept_id is None:
            return literal(False)
        if dept_field is not None:
            return dept_field == user_dept_id
        return None

    # Scope 4: 本部门及子部门
    if best_scope == DATASCOPE_DEPT_AND_CHILDREN:
        if user_dept_id is None:
            return literal(False)
        dept_ids = _get_dept_ids_with_children(db, user_dept_id)
        if dept_field is not None:
            return dept_field.in_(dept_ids)
        return None

    # Scope 5: 仅本人
    if best_scope == DATASCOPE_SELF:
        if dept_field is not None:
            return dept_field == user_dept_id
        return None  # 由 get_data_scope_filter 配合 create_by 字段收尾

    return None


def get_data_scope_filter(db, user_uuid: str, dept_field, create_by_field=None):
    """High-level helper: returns a usable SQLAlchemy WHERE clause (Bug-12 重写).

    与 build_data_scope_query 区别:
      - 接收 create_by_field, scope=5 时自动拼接 create_by == user_uuid
      - 不再二次 round-trip
      - 失败时返回 None (无 filter), 由调用方决定是否 403

    Args:
        db: SQLAlchemy Session
        user_uuid: 当前用户 UUID
        dept_field: 目标表的 dept_id 列 (or None)
        create_by_field: 目标表的 create_by 列 (可选, scope=5 时需要)

    Returns:
        - None: 无需过滤 (全量访问)
        - SQLAlchemy 表达式
    """

    clause = build_data_scope_query(db, user_uuid, dept_field)

    # scope=5 且无 create_by_field 时返回 None, 由调用方在 result 0 行时打 403
    if clause is None and create_by_field is not None:
        # 业务上想强制仅本人可见, 但没传 create_by 字段 → 返回 literal(False)
        # 仅当 dept_field 也为 None 时才走到这里
        from app.models.sys_models import SysRole, SysUser, SysUserRole

        stmt = (
            select(SysRole.data_scope)
            .join(SysUserRole, SysRole.role_id == SysUserRole.role_id)
            .join(SysUser, SysUser.user_id == SysUserRole.user_id)
            .where(
                SysUser.user_uuid == user_uuid,
                SysUser.del_flag == "0",
                SysRole.status == "0",
                SysRole.del_flag == "0",
            )
        )
        scopes = [r[0] or DATASCOPE_ALL for r in db.execute(stmt).all()]
        if scopes and min(scopes) == DATASCOPE_SELF:
            return create_by_field == user_uuid

    return clause
