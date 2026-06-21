"""多租户 schema 路由集成测试 (无需 PG 连接, 全部用 mock 模拟).

覆盖:
1. ContextVar: set/get/reset 行为
2. tenant_id 校验: 合法范围、白名单防注入
3. get_tenant_schema_name: tid -> schema 名映射
4. 单租户模式: is_multi_tenant_enabled=False 时强制 1
5. multi_tenant_enabled 时: 真实返回 ContextVar 值
6. _set_search_path hook 行为:
   - 单租户模式 → 不执行 SET
   - 多租户 + tid=None → 不执行 SET
   - 多租户 + tid=1 → SET LOCAL search_path TO "tenant_1", public
   - 多租户 + tid=999 → SET LOCAL search_path TO "tenant_999", public
7. register_tenant_routing 重复注册保护
8. ASGI middleware:
   - 公开端点 (/healthz) → 直通, 走默认 1
   - 受保护端点 + 无 X-Tenant-Id header + 严格模式 → 400
   - 受保护端点 + X-Tenant-Id=1 + tenant 存在 → 通过, 响应头含 x-tenant-schema
   - 受保护端点 + X-Tenant-Id=999 + tenant 不存在 → 404
   - 业务结束后 reset contextvar
9. SQL 注入防护: tid 含特殊字符被拒绝
"""
from __future__ import annotations

import asyncio
import os
import sys
from unittest import mock

import pytest

# 在导入 app 之前先设环境变量 (确保单租户/多租户测试互不污染)
os.environ.setdefault("MULTI_TENANT_ENABLED", "false")


# ---------------------------------------------------------------------------
# 1. ContextVar
# ---------------------------------------------------------------------------

def test_contextvar_initial_value_is_none():
    """未设置时, get_current_tenant_id() 返回 None (表示后台任务)."""
    from app.core.tenant import get_current_tenant_id
    assert get_current_tenant_id() is None


def test_contextvar_set_and_get():
    from app.core.tenant import (
        get_current_tenant_id,
        reset_current_tenant_id,
        set_current_tenant_id,
    )
    set_current_tenant_id(42)
    assert get_current_tenant_id() == 42
    reset_current_tenant_id()
    assert get_current_tenant_id() is None


def test_contextvar_rejects_invalid_tid():
    from app.core.tenant import set_current_tenant_id
    for bad in (0, -1, 100_000_000, "1", 1.5, True):
        with pytest.raises((ValueError, TypeError)):
            set_current_tenant_id(bad)


def test_contextvar_accepts_none_for_reset():
    """set_current_tenant_id(None) 用于后台任务入口清理状态."""
    from app.core.tenant import (
        get_current_tenant_id,
        set_current_tenant_id,
    )
    set_current_tenant_id(5)
    assert get_current_tenant_id() == 5
    set_current_tenant_id(None)
    assert get_current_tenant_id() is None


# ---------------------------------------------------------------------------
# 2. get_tenant_schema_name 白名单
# ---------------------------------------------------------------------------

def test_tenant_schema_name_default():
    """tid=1 -> tenant_1."""
    from app.core.tenant import get_tenant_schema_name
    assert get_tenant_schema_name(1) == "tenant_1"


def test_tenant_schema_name_explicit():
    from app.core.tenant import get_tenant_schema_name
    assert get_tenant_schema_name(999) == "tenant_999"
    assert get_tenant_schema_name(12345) == "tenant_12345"


def test_tenant_schema_name_rejects_sql_injection():
    from app.core.tenant import get_tenant_schema_name
    for bad in (0, -1, 100_000_000, "1; DROP TABLE users;--", 1.5, True):
        with pytest.raises((ValueError, TypeError)):
            get_tenant_schema_name(bad)


def test_tenant_schema_name_uses_contextvar_when_none():
    """多租户开启时, get_tenant_schema_name() 无参应取 contextvar."""
    with mock.patch("app.core.tenant.is_multi_tenant_enabled", return_value=True):
        from app.core.tenant import (
            get_tenant_schema_name,
            set_current_tenant_id,
            reset_current_tenant_id,
        )
        set_current_tenant_id(7)
        try:
            assert get_tenant_schema_name() == "tenant_7"
        finally:
            reset_current_tenant_id()


# ---------------------------------------------------------------------------
# 3. 单租户 / 多租户模式开关
# ---------------------------------------------------------------------------

def test_single_tenant_mode_forces_tid_1(monkeypatch):
    """单租户模式 (is_multi_tenant_enabled=False) 强制返回 _DEFAULT_TENANT_ID (1)."""
    with mock.patch("app.core.tenant.is_multi_tenant_enabled", return_value=False):
        from app.core.tenant import (
            get_effective_tenant_id,
            set_current_tenant_id,
            reset_current_tenant_id,
        )
        set_current_tenant_id(999)  # 即使设了也不生效
        try:
            assert get_effective_tenant_id() == 1
        finally:
            reset_current_tenant_id()


def test_multi_tenant_mode_returns_contextvar(monkeypatch):
    """多租户模式 (is_multi_tenant_enabled=True) 返回 ContextVar 值."""
    with mock.patch("app.core.tenant.is_multi_tenant_enabled", return_value=True):
        from app.core.tenant import (
            get_effective_tenant_id,
            is_multi_tenant_enabled,
            set_current_tenant_id,
            reset_current_tenant_id,
        )
        assert is_multi_tenant_enabled() is True
        set_current_tenant_id(42)
        try:
            assert get_effective_tenant_id() == 42
        finally:
            reset_current_tenant_id()


# ---------------------------------------------------------------------------
# 4. _set_search_path hook 行为
# ---------------------------------------------------------------------------

class _FakeCursor:
    def __init__(self):
        self.executed: list[str] = []
    def execute(self, sql: str) -> None:
        self.executed.append(sql)


class _FakeConn:
    def __init__(self):
        self.cursor = _FakeCursor()


def test_search_path_hook_skipped_in_single_tenant_mode(monkeypatch):
    """单租户模式: hook 静默 return, 不 SET."""
    from app.core.tenant_filter import _set_search_path
    conn = _FakeConn()
    cursor = _FakeCursor()
    _set_search_path(conn, cursor, "SELECT 1", None, None, False)
    assert cursor.executed == []


def test_search_path_hook_skipped_when_no_tid(monkeypatch):
    """多租户 + tid=None: hook 静默 return."""
    from app.core.tenant import reset_current_tenant_id
    reset_current_tenant_id()
    with mock.patch("app.core.tenant_filter.is_multi_tenant_enabled", return_value=True):
        from app.core.tenant_filter import _set_search_path
        cursor = _FakeCursor()
        _set_search_path(_FakeConn(), cursor, "SELECT 1", None, None, False)
        assert cursor.executed == []


def test_search_path_hook_sets_correct_schema():
    """多租户 + tid=1: SET LOCAL search_path TO "tenant_1", public."""
    from app.core.tenant import (
        reset_current_tenant_id,
        set_current_tenant_id,
    )
    set_current_tenant_id(1)
    try:
        with mock.patch("app.core.tenant_filter.is_multi_tenant_enabled", return_value=True):
            from app.core.tenant_filter import _set_search_path
            cursor = _FakeCursor()
            _set_search_path(_FakeConn(), cursor, "SELECT 1", None, None, False)
            assert len(cursor.executed) == 1
            assert 'SET LOCAL search_path TO "tenant_1", public' in cursor.executed[0]
    finally:
        reset_current_tenant_id()


def test_search_path_hook_with_large_tid():
    """tid=99999999: 白名单边界 OK."""
    from app.core.tenant import (
        reset_current_tenant_id,
        set_current_tenant_id,
    )
    set_current_tenant_id(99999999)
    try:
        with mock.patch("app.core.tenant_filter.is_multi_tenant_enabled", return_value=True):
            from app.core.tenant_filter import _set_search_path
            cursor = _FakeCursor()
            _set_search_path(_FakeConn(), cursor, "SELECT 1", None, None, False)
            assert '"tenant_99999999"' in cursor.executed[0]
    finally:
        reset_current_tenant_id()


# ---------------------------------------------------------------------------
# 5. register_tenant_routing 重复注册保护
# ---------------------------------------------------------------------------

def test_register_tenant_routing_returns_false_single_tenant(monkeypatch):
    """单租户模式: register_tenant_routing 直接返回 False (不挂 hook)."""
    fake_engine = mock.MagicMock()
    with mock.patch("app.core.tenant_filter.is_multi_tenant_enabled", return_value=False):
        from app.core.tenant_filter import register_tenant_routing
        result = register_tenant_routing(fake_engine)
    assert result is False


def test_register_tenant_routing_idempotent(monkeypatch):
    """同一 engine 多次注册只挂一次 hook (避免重复 SET LOCAL)."""
    fake_engine = mock.MagicMock()
    with mock.patch("app.core.tenant_filter.is_multi_tenant_enabled", return_value=True):
        with mock.patch("app.core.tenant_filter.event") as mock_event:
            from app.core.tenant_filter import (
                register_tenant_routing,
                reset_registration_state,
            )
            reset_registration_state()
            r1 = register_tenant_routing(fake_engine)
            r2 = register_tenant_routing(fake_engine)
            assert r1 is True
            assert r2 is False
            assert mock_event.listen.call_count == 1
            reset_registration_state()


# ---------------------------------------------------------------------------
# 6. ASGI Middleware
# ---------------------------------------------------------------------------

def _make_scope(path: str = "/api/v1/users/me",
                headers: list[tuple[bytes, bytes]] | None = None,
                tid_header_value: str | None = None) -> dict:
    if headers is None and tid_header_value is not None:
        headers = [(b"x-tenant-id", tid_header_value.encode("latin-1"))]
    elif headers is None:
        headers = []
    return {
        "type": "http",
        "path": path,
        "method": "GET",
        "headers": headers,
        "query_string": b"",
    }


def _collect_send() -> tuple[list, callable]:
    """ASGI send 是一个 async callable, 测试 mock 也要是 coroutine."""
    messages: list = []

    async def send(msg):
        messages.append(msg)
    return messages, send


def test_middleware_public_path_passes_through(monkeypatch):
    """/healthz 是公开路径, 直通不强制 tenant."""
    with mock.patch("app.middleware.tenant_routing.is_multi_tenant_enabled", return_value=True):
        from app.core.tenant import (
            get_current_tenant_id,
            reset_current_tenant_id,
        )
        from app.middleware.tenant_routing import TenantRoutingMiddleware
        reset_current_tenant_id()

        async def downstream(scope, receive, send):
            # 在下游读 contextvar, 应为默认 1
            await send({"type": "http.response.start", "status": 200, "headers": []})
            await send({"type": "http.response.body", "body": b"", "more_body": False})
            # 抓取 contextvar 检查
            downstream.tid = get_current_tenant_id()

        middleware = TenantRoutingMiddleware(downstream)
        scope = _make_scope(path="/healthz")
        _, send = _collect_send()
        asyncio.run(middleware(scope, None, send))
        # 公开路径 reset 前会设默认 1
        assert get_current_tenant_id() is None  # 已被 reset


def test_middleware_strict_rejects_missing_tenant_header(monkeypatch):
    """严格模式 + 无 header → 400 TENANT_REQUIRED."""
    monkeypatch.setenv("ZHS_TENANT_STRICT", "1")
    with mock.patch("app.middleware.tenant_routing.is_multi_tenant_enabled", return_value=True):
        from app.middleware.tenant_routing import TenantRoutingMiddleware

        async def downstream(scope, receive, send):
            pytest.fail("downstream 不应被调用")

        middleware = TenantRoutingMiddleware(downstream)
        scope = _make_scope(path="/api/v1/users/me", headers=[])
        messages, send = _collect_send()
        asyncio.run(middleware(scope, None, send))
        # 找到 start 消息
        start = next(m for m in messages if m["type"] == "http.response.start")
        assert start["status"] == 400


def test_middleware_strict_rejects_invalid_tenant_header(monkeypatch):
    """严格模式 + 无效 header (非整数) → 400."""
    monkeypatch.setenv("ZHS_TENANT_STRICT", "1")
    with mock.patch("app.middleware.tenant_routing.is_multi_tenant_enabled", return_value=True):
        from app.middleware.tenant_routing import TenantRoutingMiddleware

        async def downstream(scope, receive, send):
            pytest.fail("downstream 不应被调用")

        middleware = TenantRoutingMiddleware(downstream)
        scope = _make_scope(path="/api/v1/users/me", tid_header_value="abc")
        messages, send = _collect_send()
        asyncio.run(middleware(scope, None, send))
        start = next(m for m in messages if m["type"] == "http.response.start")
        assert start["status"] == 400


def test_middleware_404_when_tenant_not_found(monkeypatch):
    """严格模式 + tid 不存在 → 404 TENANT_NOT_FOUND."""
    monkeypatch.setenv("ZHS_TENANT_STRICT", "1")
    with mock.patch("app.middleware.tenant_routing.is_multi_tenant_enabled", return_value=True):
        with mock.patch("app.middleware.tenant_routing._lookup_tenant_status", return_value=None):
            from app.middleware.tenant_routing import TenantRoutingMiddleware

            async def downstream(scope, receive, send):
                pytest.fail("downstream 不应被调用")

            middleware = TenantRoutingMiddleware(downstream)
            scope = _make_scope(path="/api/v1/users/me", tid_header_value="999")
            messages, send = _collect_send()
            asyncio.run(middleware(scope, None, send))
            start = next(m for m in messages if m["type"] == "http.response.start")
            assert start["status"] == 404


def test_middleware_403_when_tenant_disabled(monkeypatch):
    """严格模式 + tid 已停用 → 403 TENANT_DISABLED."""
    monkeypatch.setenv("ZHS_TENANT_STRICT", "1")
    with mock.patch("app.middleware.tenant_routing.is_multi_tenant_enabled", return_value=True):
        with mock.patch("app.middleware.tenant_routing._lookup_tenant_status", return_value=0):
            from app.middleware.tenant_routing import TenantRoutingMiddleware

            async def downstream(scope, receive, send):
                pytest.fail("downstream 不应被调用")

            middleware = TenantRoutingMiddleware(downstream)
            scope = _make_scope(path="/api/v1/users/me", tid_header_value="5")
            messages, send = _collect_send()
            asyncio.run(middleware(scope, None, send))
            start = next(m for m in messages if m["type"] == "http.response.start")
            assert start["status"] == 403


def test_middleware_passes_valid_tenant(monkeypatch):
    """严格模式 + tid=1 + tenant 存在 → 通过, 响应头含 x-tenant-schema."""
    monkeypatch.setenv("ZHS_TENANT_STRICT", "1")
    with mock.patch("app.middleware.tenant_routing.is_multi_tenant_enabled", return_value=True):
        with mock.patch("app.middleware.tenant_routing._lookup_tenant_status", return_value=1):
            from app.core.tenant import (
                get_current_tenant_id,
                reset_current_tenant_id,
            )
            from app.middleware.tenant_routing import TenantRoutingMiddleware

            async def downstream(scope, receive, send):
                # 在下游读 contextvar, 应为 1
                tid_during = get_current_tenant_id()
                await send({"type": "http.response.start", "status": 200, "headers": []})
                await send({"type": "http.response.body", "body": b"ok", "more_body": False})
                downstream.tid_during = tid_during

            middleware = TenantRoutingMiddleware(downstream)
            scope = _make_scope(path="/api/v1/users/me", tid_header_value="1")
            messages, send = _collect_send()
            reset_current_tenant_id()
            asyncio.run(middleware(scope, None, send))
            # 1) downstream 拿到 tid=1
            assert downstream.tid_during == 1
            # 2) 响应头含 x-tenant-schema=tenant_1
            start = next(m for m in messages if m["type"] == "http.response.start")
            schema_header = next(
                (v for k, v in start["headers"] if k == b"x-tenant-schema"),
                None,
            )
            assert schema_header == b"tenant_1"
            # 3) 请求结束后 reset
            assert get_current_tenant_id() is None


def test_middleware_single_tenant_mode_passthrough():
    """单租户模式: middleware 直通, 不挂 header 检查."""
    with mock.patch("app.middleware.tenant_routing.is_multi_tenant_enabled", return_value=False):
        from app.middleware.tenant_routing import TenantRoutingMiddleware

        async def downstream(scope, receive, send):
            await send({"type": "http.response.start", "status": 200, "headers": []})
            await send({"type": "http.response.body", "body": b"ok", "more_body": False})
            downstream.called = True

        middleware = TenantRoutingMiddleware(downstream)
        scope = _make_scope(path="/api/v1/users/me")  # 无 header
        _, send = _collect_send()
        asyncio.run(middleware(scope, None, send))
        assert downstream.called is True


# ---------------------------------------------------------------------------
# 7. SQL 注入防护
# ---------------------------------------------------------------------------

def test_sql_injection_via_tenant_id_rejected(monkeypatch):
    """X-Tenant-Id: 1; DROP TABLE users;-- 必须被拒绝."""
    monkeypatch.setenv("ZHS_TENANT_STRICT", "1")
    with mock.patch("app.middleware.tenant_routing.is_multi_tenant_enabled", return_value=True):
        from app.middleware.tenant_routing import TenantRoutingMiddleware

        async def downstream(scope, receive, send):
            pytest.fail("downstream 不应被调用 (注入必须被拒)")

        middleware = TenantRoutingMiddleware(downstream)
        scope = _make_scope(path="/api/v1/users/me",
                            tid_header_value="1; DROP TABLE users;--")
        messages, send = _collect_send()
        asyncio.run(middleware(scope, None, send))
        start = next(m for m in messages if m["type"] == "http.response.start")
        # 400 (header 解析失败) 或 400 (schema 名白名单失败)
        assert start["status"] == 400
