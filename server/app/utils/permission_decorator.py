"""Role-based access control (RBAC) decorators for API endpoints.

Provides declarative permission checking for FastAPI routes.

Usage:
    @router.post("/banner/create")
    @require_role("admin")
    def create_banner(...):
        ...

    @router.delete("/banner/{id}")
    @require_permission("content:banner:delete")
    def delete_banner(...):
        ...
"""

import functools
import logging
from collections.abc import Callable

from fastapi import HTTPException, status

from app.database import get_session
from app.security import decode_access_token

logger = logging.getLogger(__name__)


# Role hierarchy constants
class Role:
    """Standard system roles."""

    SUPER_ADMIN = "super_admin"
    ADMIN = "admin"
    USER = "user"
    GUEST = "guest"


# Permission constants
class Permission:
    """System permissions."""

    # Content management
    CONTENT_BANNER_CREATE = "content:banner:create"
    CONTENT_BANNER_UPDATE = "content:banner:update"
    CONTENT_BANNER_DELETE = "content:banner:delete"
    CONTENT_BANNER_READ = "content:banner:read"

    CONTENT_NEWS_CREATE = "content:news:create"
    CONTENT_NEWS_UPDATE = "content:news:update"
    CONTENT_NEWS_DELETE = "content:news:delete"
    CONTENT_NEWS_READ = "content:news:read"

    CONTENT_NOTICE_CREATE = "content:notice:create"
    CONTENT_NOTICE_UPDATE = "content:notice:update"
    CONTENT_NOTICE_DELETE = "content:notice:delete"
    CONTENT_NOTICE_READ = "content:notice:read"

    # User management
    USER_READ = "system:user:read"
    USER_CREATE = "system:user:create"
    USER_UPDATE = "system:user:update"
    USER_DELETE = "system:user:delete"

    # Agent management
    AGENT_CREATE = "agent:create"
    AGENT_UPDATE = "agent:update"
    AGENT_DELETE = "agent:delete"
    AGENT_PUBLISH = "agent:publish"

    # Order management
    ORDER_READ = "order:read"
    ORDER_REFUND = "order:refund"
    ORDER_CLOSE = "order:close"


# Role permissions mapping
ROLE_PERMISSIONS = {
    Role.SUPER_ADMIN: {
        "*",  # All permissions
    },
    Role.ADMIN: {
        # Content
        Permission.CONTENT_BANNER_CREATE,
        Permission.CONTENT_BANNER_UPDATE,
        Permission.CONTENT_BANNER_DELETE,
        Permission.CONTENT_BANNER_READ,
        Permission.CONTENT_NEWS_CREATE,
        Permission.CONTENT_NEWS_UPDATE,
        Permission.CONTENT_NEWS_DELETE,
        Permission.CONTENT_NEWS_READ,
        Permission.CONTENT_NOTICE_CREATE,
        Permission.CONTENT_NOTICE_UPDATE,
        Permission.CONTENT_NOTICE_DELETE,
        Permission.CONTENT_NOTICE_READ,
        # User (read only)
        Permission.USER_READ,
        # Agent
        Permission.AGENT_CREATE,
        Permission.AGENT_UPDATE,
        Permission.AGENT_DELETE,
        Permission.AGENT_PUBLISH,
        # Order
        Permission.ORDER_READ,
        Permission.ORDER_REFUND,
        Permission.ORDER_CLOSE,
    },
    Role.USER: {
        Permission.CONTENT_BANNER_READ,
        Permission.CONTENT_NEWS_READ,
        Permission.CONTENT_NOTICE_READ,
        Permission.USER_READ,
    },
    Role.GUEST: set(),
}


def _get_user_roles(user_uuid: str) -> set[str]:
    """Get roles for a user from the database."""
    from app.models.sys_models import SysRole, SysUser, SysUserRole

    with get_session() as db:
        # Get user
        sys_user = (
            db.query(SysUser)
            .filter(
                SysUser.user_uuid == user_uuid,
                SysUser.del_flag == "0",
            )
            .first()
        )

        if not sys_user:
            return set()

        # Get roles
        roles = (
            db.query(SysRole.role_key)
            .join(SysUserRole, SysRole.role_id == SysUserRole.role_id)
            .filter(SysUserRole.user_id == sys_user.user_id)
            .all()
        )

        return {r.role_key for r in roles}


def _get_user_permissions(user_uuid: str) -> set[str]:
    """Get all permissions for a user based on their roles."""
    roles = _get_user_roles(user_uuid)
    permissions: set[str] = set()

    for role in roles:
        if role in ROLE_PERMISSIONS:
            perms = ROLE_PERMISSIONS[role]
            if "*" in perms:
                # Wildcard means all permissions
                return {"*"}
            permissions.update(perms)

    return permissions


def _check_auth_header(authorization: str) -> str | None:
    """Extract and validate user UUID from Authorization header."""
    if not authorization:
        return None

    token = authorization[7:] if authorization.startswith("Bearer ") else authorization

    payload = decode_access_token(token)
    if payload is None:
        return None

    return payload.get("sub")


class require_login:
    """Dependency that requires a valid authentication token."""

    def __call__(self, authorization: str | None = None) -> str:
        user_uuid = _check_auth_header(authorization)
        if not user_uuid:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Not authenticated",
                headers={"WWW-Authenticate": "Bearer"},
            )
        return user_uuid


class require_role:
    """Dependency that requires specific role(s).

    Args:
        roles: Single role or list of roles (user must have at least one)
    """

    def __init__(self, roles):
        if isinstance(roles, str):
            self.roles = [roles]
        else:
            self.roles = list(roles)

    def __call__(self, authorization: str | None = None) -> str:
        user_uuid = _check_auth_header(authorization)
        if not user_uuid:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Not authenticated",
                headers={"WWW-Authenticate": "Bearer"},
            )

        user_roles = _get_user_roles(user_uuid)

        # Check if user has any of the required roles
        has_role = any(role in user_roles for role in self.roles)

        # Super admin always has access
        if Role.SUPER_ADMIN in user_roles:
            has_role = True

        if not has_role:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Requires role: {', '.join(self.roles)}",
            )

        return user_uuid


class require_permission:
    """Dependency that requires specific permission(s).

    Args:
        permissions: Single permission or list of permissions
        require_all: If True, user must have ALL permissions. Default False (any).
    """

    def __init__(self, permissions, require_all: bool = False):
        if isinstance(permissions, str):
            self.permissions = [permissions]
        else:
            self.permissions = list(permissions)
        self.require_all = require_all

    def __call__(self, authorization: str | None = None) -> str:
        user_uuid = _check_auth_header(authorization)
        if not user_uuid:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Not authenticated",
                headers={"WWW-Authenticate": "Bearer"},
            )

        user_perms = _get_user_permissions(user_uuid)

        # Wildcard permission grants all
        if "*" in user_perms:
            return user_uuid

        if self.require_all:
            has_perms = all(perm in user_perms for perm in self.permissions)
        else:
            has_perms = any(perm in user_perms for perm in self.permissions)

        if not has_perms:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Requires permission: {', '.join(self.permissions)}",
            )

        return user_uuid


def require_login_sync(authorization: str | None = None) -> str:
    """Synchronous version of require_login."""
    user_uuid = _check_auth_header(authorization)
    if not user_uuid:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return user_uuid


def require_role_sync(roles, authorization: str | None = None) -> str:
    """Synchronous version of require_role."""
    if isinstance(roles, str):
        roles = [roles]

    user_uuid = _check_auth_header(authorization)
    if not user_uuid:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
            headers={"WWW-Authenticate": "Bearer"},
        )

    user_roles = _get_user_roles(user_uuid)

    if Role.SUPER_ADMIN in user_roles:
        return user_uuid

    if not any(role in user_roles for role in roles):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Requires role: {', '.join(roles)}",
        )

    return user_uuid


def require_permission_sync(permissions, authorization: str | None = None, require_all: bool = False) -> str:
    """Synchronous version of require_permission."""
    if isinstance(permissions, str):
        permissions = [permissions]

    user_uuid = _check_auth_header(authorization)
    if not user_uuid:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
            headers={"WWW-Authenticate": "Bearer"},
        )

    user_perms = _get_user_permissions(user_uuid)

    if "*" in user_perms:
        return user_uuid

    if require_all:
        has_perms = all(perm in user_perms for perm in permissions)
    else:
        has_perms = any(perm in user_perms for perm in permissions)

    if not has_perms:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Requires permission: {', '.join(permissions)}",
        )

    return user_uuid


# Decorator versions for use with @decorator syntax
def require_login_decorator(func: Callable) -> Callable:
    """Decorator for requiring login."""

    @functools.wraps(func)
    async def wrapper(*args, **kwargs):
        # Get authorization from kwargs or first positional arg
        authorization = kwargs.get("authorization")
        if authorization is None and args:
            # Try to get from request object
            pass

        user_uuid = require_login_sync(authorization)
        kwargs["user_uuid"] = user_uuid
        return await func(*args, **kwargs)

    return wrapper
