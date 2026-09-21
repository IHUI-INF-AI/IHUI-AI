# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""RBAC 权限体系(企业级补齐最小可用版,2026-09-06 立)。

角色模型贴合项目既有概念:JWT payload 携带 roleId(JWTAuthMiddleware 注入
request.state.role_id),agent_runtime._get_current_user 以 role_id >= 1 判管理员。
本模块在其上抽象出四档组织角色 + 权限点矩阵:

- owner  : 空间所有者(role_id >= 2),拥有全部权限
- admin  : 系统管理员(role_id == 1),管理成员/审计日志/成本,不可转让空间
- member : 普通登录用户(role_id == 0 且有 user_id),使用运行类能力
- viewer : 只读访客(预留:role_id < 0 或未来显式降级),仅读取自身资源

无成员记录时的默认策略(与项目现状一致):
- 有 JWT(user_id 存在)但 role_id 缺省 → member(即现有 role_id=0 语义)
- 无 user_id → 401(由 get_current_user / require_permission 统一拒绝)

纯函数层(``resolve_role`` / ``role_has_permission`` / ``require_permission``)
不依赖 DB / Redis,可离线单测;FastAPI 依赖工厂基于 request.state 判定。
"""

from __future__ import annotations

import logging
from collections.abc import Callable
from enum import StrEnum
from typing import Any, Protocol, cast

from fastapi import Depends, HTTPException, Request

from app.core.jwt_auth import get_current_user_id

logger = logging.getLogger(__name__)


class Role(StrEnum):
    """组织角色(与 JWT roleId 数值对应)。"""

    OWNER = "owner"
    ADMIN = "admin"
    MEMBER = "member"
    VIEWER = "viewer"


class Permission(StrEnum):
    """权限点(细粒度动作)。"""

    # 运行类
    RUN_EXECUTE = "run:execute"
    RUN_CANCEL = "run:cancel"
    SESSION_READ = "session:read"
    SESSION_LIST_ALL = "session:list_all"
    # 内容类
    CONTENT_READ = "content:read"
    CONTENT_WRITE = "content:write"
    # 管理类
    AUDIT_READ = "audit:read"
    MEMBER_MANAGE = "member:manage"
    COST_READ = "cost:read"
    WORKSPACE_TRANSFER = "workspace:transfer"


# 角色 → 权限点映射(单一权威表;新增权限点只需在此登记)
ROLE_PERMISSIONS: dict[Role, frozenset[Permission]] = {
    Role.OWNER: frozenset(Permission),  # 全量
    Role.ADMIN: frozenset(Permission) - {Permission.WORKSPACE_TRANSFER},
    Role.MEMBER: frozenset({
        Permission.RUN_EXECUTE,
        Permission.RUN_CANCEL,
        Permission.SESSION_READ,
        Permission.CONTENT_READ,
        Permission.CONTENT_WRITE,
    }),
    Role.VIEWER: frozenset({
        Permission.SESSION_READ,
        Permission.CONTENT_READ,
    }),
}


def role_from_jwt(role_id: int | None, *, has_user: bool = True) -> Role:
    """把 JWT roleId 数值映射为 RBAC 角色。

    - role_id >= 2 → owner;== 1 → admin;== 0 / None → member
      (与 agent_runtime._get_current_user 的 role_id>=1 判管理员语义兼容)
    - role_id < 0 或无用户身份 → viewer(最低档,只读)
    """
    if not has_user:
        return Role.VIEWER
    if role_id is None:
        return Role.MEMBER
    if role_id >= 2:
        return Role.OWNER
    if role_id == 1:
        return Role.ADMIN
    if role_id == 0:
        return Role.MEMBER
    return Role.VIEWER


def resolve_role(request: Request) -> Role:
    """从 request.state(JWTAuthMiddleware 注入)解析当前用户角色。"""
    user_id = getattr(request.state, "user_id", None)
    raw = getattr(request.state, "role_id", None)
    role_id = int(raw) if raw is not None else None
    return role_from_jwt(role_id, has_user=bool(user_id))


def role_has_permission(role: Role, permission: Permission | str) -> bool:
    """判定矩阵:角色是否持有权限点。"""
    try:
        perm = Permission(permission)
    except ValueError:
        return False
    return perm in ROLE_PERMISSIONS[role]


class Principal(Protocol):
    """当前调用主体(router 端点可依赖的结构)。"""

    user_id: str
    role: Role


async def get_current_principal(
    request: Request,
    user_id: str = Depends(get_current_user_id),
) -> Principal:
    """FastAPI 依赖:组合认证(Depends get_current_user_id)+ 角色解析。

    返回带 user_id / role 的对象,供端点同时用于鉴权与审计埋点。
    - 认证走 sub-dependency `get_current_user_id`:生产由 JWT middleware 注入
      request.state.user_id;测试可通过 fastapi_app.dependency_overrides 覆盖
    - 角色解析读 request.state.role_id;middleware 跳过但 override 注入身份时
      (state 无 user_id/role_id)按 member 处理(与 role_id 缺省语义一致)
    """
    if not getattr(request.state, "user_id", None):
        # 依赖被 override 注入(如测试):补写 state 使 resolve_role 判定 has_user
        request.state.user_id = user_id
    role = resolve_role(request)

    principal = _Principal(user_id=str(user_id), role=role)
    return cast(Principal, principal)


class _Principal:
    """Principal 协议的最小实现。"""

    __slots__ = ("user_id", "role")

    def __init__(self, *, user_id: str, role: Role) -> None:
        self.user_id = user_id
        self.role = role

    def __repr__(self) -> str:  # pragma: no cover - 调试辅助
        return f"Principal(user_id={self.user_id!r}, role={self.role.value!r})"


def require_permission(
    permission: Permission | str,
) -> Callable[..., Any]:
    """FastAPI 依赖工厂:要求当前用户角色持有指定权限点。

    用法::

        @router.post("/runs/{id}/cancel")
        async def cancel(p=Depends(require_permission(Permission.RUN_CANCEL))): ...

    - 未认证(user_id 缺失)→ 401
    - 已认证但角色无权限 → 403
    - 通过 → 返回 Principal(可继续用 p.user_id / p.role)
    """
    perm = Permission(permission)

    async def _dependency(
        request: Request,
        user_id: str = Depends(get_current_user_id),
    ) -> Principal:
        # get_current_user_id 作为 sub-dependency:测试 override 生效
        if not getattr(request.state, "user_id", None):
            request.state.user_id = user_id
        principal = cast(Principal, _Principal(user_id=str(user_id), role=resolve_role(request)))
        if not role_has_permission(principal.role, perm):
            logger.warning(
                "[rbac] deny user=%s role=%s perm=%s path=%s",
                principal.user_id, principal.role.value, perm.value, request.url.path,
            )
            raise HTTPException(
                status_code=403,
                detail=f"角色 {principal.role.value} 缺少权限 {perm.value}",
            )
        return principal

    return _dependency
