# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""连接器租户作用域解析测试(2026-11-23 多企业 SaaS)。"""

from __future__ import annotations

import pytest
from starlette.requests import Request

from app.services import tenant_scope

USER_ID = "30763d9f-a4c4-4f0c-84c3-16d6b8a67c35"
TENANT_A = "11111111-1111-1111-1111-111111111111"
TENANT_B = "22222222-2222-2222-2222-222222222222"


def _request(tenant: str = "") -> Request:
    headers = [(b"x-tenant-id", tenant.encode())] if tenant else []
    return Request({"type": "http", "headers": headers, "method": "GET", "path": "/"})


@pytest.fixture(autouse=True)
def _clear_cache():
    tenant_scope.clear_scope_cache()
    yield
    tenant_scope.clear_scope_cache()


@pytest.mark.asyncio
async def test_header_tenant_used_only_after_membership_check(monkeypatch):
    calls: list[tuple[str, str]] = []

    async def fake_lookup(user_id: str, preferred: str) -> tuple[str, str] | None:
        calls.append((user_id, preferred))
        return (TENANT_A, "admin") if preferred == TENANT_A else None

    monkeypatch.setattr(tenant_scope, "_lookup_membership", fake_lookup)
    scope = await tenant_scope.resolve_connector_scope(_request(TENANT_A), USER_ID)
    assert scope == TENANT_A
    assert calls == [(USER_ID, TENANT_A)]


@pytest.mark.asyncio
async def test_forged_tenant_header_cannot_cross_tenant(monkeypatch):
    """带了非成员租户时不得采信 header,退回服务端解析出的首个租户。"""

    async def fake_lookup(
        _user_id: str, _preferred: str
    ) -> tuple[str, str] | None:
        return (TENANT_A, "member")

    monkeypatch.setattr(tenant_scope, "_lookup_membership", fake_lookup)
    scope = await tenant_scope.resolve_connector_scope(_request(TENANT_B), USER_ID)
    assert scope == TENANT_A
    assert scope != TENANT_B


@pytest.mark.asyncio
async def test_no_tenant_membership_falls_back_to_personal_scope(monkeypatch):
    async def fake_lookup(
        _user_id: str, _preferred: str
    ) -> tuple[str, str] | None:
        return None

    monkeypatch.setattr(tenant_scope, "_lookup_membership", fake_lookup)
    scope = await tenant_scope.resolve_connector_scope(_request(), USER_ID)
    assert scope == USER_ID


@pytest.mark.asyncio
async def test_non_uuid_subject_never_queries_database(monkeypatch):
    async def fail_lookup(
        _user_id: str, _preferred: str
    ) -> tuple[str, str] | None:
        raise AssertionError("测试主体不应触发租户库查询")

    monkeypatch.setattr(tenant_scope, "_lookup_membership", fail_lookup)
    scope = await tenant_scope.resolve_connector_scope(_request(TENANT_A), "user-a")
    assert scope == "user-a"


@pytest.mark.asyncio
async def test_scope_cache_avoids_repeated_lookup(monkeypatch):
    calls = 0

    async def fake_lookup(
        _user_id: str, _preferred: str
    ) -> tuple[str, str] | None:
        nonlocal calls
        calls += 1
        return (TENANT_A, "owner")

    monkeypatch.setattr(tenant_scope, "_lookup_membership", fake_lookup)
    first = await tenant_scope.resolve_connector_scope(_request(TENANT_A), USER_ID)
    second = await tenant_scope.resolve_connector_scope(_request(TENANT_A), USER_ID)
    assert first == second == TENANT_A
    assert calls == 1


@pytest.mark.asyncio
async def test_tenant_role_gates_shared_config_changes(monkeypatch):
    async def as_member(
        _user_id: str, _preferred: str
    ) -> tuple[str, str] | None:
        return (TENANT_A, "member")

    monkeypatch.setattr(tenant_scope, "_lookup_membership", as_member)
    member_ctx = await tenant_scope.resolve_connector_context(_request(TENANT_A), USER_ID)
    assert member_ctx.tenant_mode is True
    assert member_ctx.can_manage is False

    tenant_scope.clear_scope_cache()

    async def as_admin(
        _user_id: str, _preferred: str
    ) -> tuple[str, str] | None:
        return (TENANT_A, "admin")

    monkeypatch.setattr(tenant_scope, "_lookup_membership", as_admin)
    admin_ctx = await tenant_scope.resolve_connector_context(_request(TENANT_A), USER_ID)
    assert admin_ctx.can_manage is True

    personal = await tenant_scope.resolve_connector_context(_request(), "user-a")
    assert personal.can_manage is True
    assert personal.tenant_mode is False
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
