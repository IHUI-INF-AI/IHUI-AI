# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""RBAC 权限体系测试(纯离线,无 DB/网络)。

覆盖:roleId→角色映射、角色×权限点判定矩阵、require_permission 依赖工厂
(401/403/放行)、audit router 的 audit:read 权限门(admin 可读 / member 403)。
"""

from __future__ import annotations

import pytest
from fastapi import Depends, FastAPI
from httpx import ASGITransport, AsyncClient
from starlette.requests import Request

from app.core.jwt_auth import get_current_user_id
from app.core.rbac import (
    Permission,
    Role,
    require_permission,
    resolve_role,
    role_from_jwt,
    role_has_permission,
)

# ---------------- 纯函数层 ----------------


@pytest.mark.parametrize(
    ("role_id", "expected"),
    [
        (None, Role.MEMBER),  # 缺省 → member(兼容现有 role_id=0 语义)
        (0, Role.MEMBER),
        (1, Role.ADMIN),
        (2, Role.OWNER),
        (99, Role.OWNER),
        (-1, Role.VIEWER),
    ],
)
def test_role_from_jwt_mapping(role_id, expected):
    assert role_from_jwt(role_id) == expected


def test_role_from_jwt_no_user_is_viewer():
    assert role_from_jwt(5, has_user=False) == Role.VIEWER


@pytest.mark.parametrize(
    ("role", "perm", "allowed"),
    [
        # owner 全量
        (Role.OWNER, Permission.WORKSPACE_TRANSFER, True),
        (Role.OWNER, Permission.AUDIT_READ, True),
        # admin 除转让外全量
        (Role.ADMIN, Permission.WORKSPACE_TRANSFER, False),
        (Role.ADMIN, Permission.AUDIT_READ, True),
        (Role.ADMIN, Permission.MEMBER_MANAGE, True),
        (Role.ADMIN, Permission.SESSION_LIST_ALL, True),
        # member 运行/内容类
        (Role.MEMBER, Permission.RUN_EXECUTE, True),
        (Role.MEMBER, Permission.RUN_CANCEL, True),
        (Role.MEMBER, Permission.CONTENT_WRITE, True),
        (Role.MEMBER, Permission.AUDIT_READ, False),
        (Role.MEMBER, Permission.MEMBER_MANAGE, False),
        (Role.MEMBER, Permission.SESSION_LIST_ALL, False),
        # viewer 只读
        (Role.VIEWER, Permission.CONTENT_READ, True),
        (Role.VIEWER, Permission.CONTENT_WRITE, False),
        (Role.VIEWER, Permission.RUN_EXECUTE, False),
        (Role.VIEWER, Permission.AUDIT_READ, False),
    ],
)
def test_permission_matrix(role, perm, allowed):
    assert role_has_permission(role, perm) is allowed


def test_unknown_permission_denied():
    assert role_has_permission(Role.OWNER, "not:a:perm") is False


# ---------------- resolve_role(request.state) ----------------


def _fake_request(user_id=None, role_id=None) -> Request:
    scope = {
        "type": "http",
        "method": "GET",
        "path": "/x",
        "headers": [],
        "query_string": b"",
        "state": {},
    }
    req = Request(scope)
    if user_id is not None:
        req.state.user_id = user_id
    if role_id is not None:
        req.state.role_id = role_id
    return req


def test_resolve_role_from_state():
    assert resolve_role(_fake_request("u1", 1)) == Role.ADMIN
    assert resolve_role(_fake_request("u1")) == Role.MEMBER  # role_id 缺省
    assert resolve_role(_fake_request()) == Role.VIEWER  # 匿名


# ---------------- require_permission 依赖工厂 ----------------


def _probe_app(permission: Permission) -> FastAPI:
    """构造最小 app:一个受保护端点 + 模拟 JWT 注入的 middleware。"""
    from starlette.middleware.base import BaseHTTPMiddleware

    app = FastAPI()

    class FakeJWT(BaseHTTPMiddleware):
        async def dispatch(self, request, call_next):
            uid = request.headers.get("x-test-user")
            rid = request.headers.get("x-test-role")
            if uid:
                request.state.user_id = uid
                request.state.role_id = int(rid) if rid else 0
            return await call_next(request)

    app.add_middleware(FakeJWT)

    @app.get("/probe")
    async def probe(p=Depends(require_permission(permission))):
        return {"user": p.user_id, "role": p.role.value}

    return app


@pytest.mark.parametrize(
    ("headers", "status", "body_ok"),
    [
        ({}, 401, False),  # 匿名 → get_current_user_id 抛 401
        ({"x-test-user": "m", "x-test-role": "0"}, 403, False),  # member 无 audit:read
        ({"x-test-user": "a", "x-test-role": "1"}, 200, True),  # admin 放行
        ({"x-test-user": "o", "x-test-role": "2"}, 200, True),  # owner 放行
    ],
)
async def test_require_permission_audit_read(headers, status, body_ok):
    probe = _probe_app(Permission.AUDIT_READ)
    async with AsyncClient(transport=ASGITransport(app=probe), base_url="http://t") as ac:
        resp = await ac.get("/probe", headers=headers)
    assert resp.status_code == status
    if body_ok:
        assert resp.json()["user"] in {"a", "o"}


async def test_require_permission_member_allows_run_cancel():
    probe = _probe_app(Permission.RUN_CANCEL)
    async with AsyncClient(transport=ASGITransport(app=probe), base_url="http://t") as ac:
        resp = await ac.get("/probe", headers={"x-test-user": "m", "x-test-role": "0"})
    assert resp.status_code == 200
    assert resp.json()["role"] == "member"


# ---------------- audit router 集成(经完整 app + dependency_overrides) ----------------


async def test_audit_router_requires_admin(client):
    """GET /api/audit/logs:匿名 → 401;member(无 role_id 注入)→ 403。"""
    from app.main import fastapi_app

    # conftest 清 jwt_secret → middleware 跳过 → state 无 user_id → 401
    resp = await client.get("/api/audit/logs")
    assert resp.status_code == 401

    # member 视角:override get_current_user_id;state 无 role_id → resolve_role=member
    fastapi_app.dependency_overrides[get_current_user_id] = lambda: "member-1"
    try:
        resp = await client.get("/api/audit/logs")
        assert resp.status_code == 403
    finally:
        fastapi_app.dependency_overrides.pop(get_current_user_id, None)
