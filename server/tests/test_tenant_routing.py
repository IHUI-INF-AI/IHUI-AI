"""TenantRoutingMiddleware (建议 118) 单元测试.

覆盖:
  - 多租户关闭时: middleware pass-through
  - X-Tenant-Id 合法 header: 写入 contextvar
  - X-Tenant-Id 缺失: 严格模式 → 400, 宽松模式 → 默认 1
  - X-Tenant-Id 非数字: 400
  - X-Tenant-Id 超出范围: 400
  - 未知 tenant_id: 404
  - 已停用 tenant (status=0): 403
  - 公开端点 (/health, /docs, /auth/login): 不强制 tenant, 走默认
  - JWT tid claim 备选: header 缺时用 JWT
  - 缓存命中: 第二次查不调 DB
  - 负缓存: 不存在 tenant 不再查 DB
  - X-Tenant-Schema 响应头
  - 请求结束 reset: 不污染下一个请求
  - 并发隔离: contextvar 在不同 request 间互不污染
  - get_tenant_id_dep 依赖函数
  - clear_tenant_cache 工具
  - WebSocket scope 直通
"""

import asyncio
import os
import sys
from pathlib import Path
from unittest.mock import patch

import pytest

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------


@pytest.fixture(autouse=True)
def _reset_tenant_state():
    """每个测试前后清空 contextvar + cache, 避免测试间污染."""
    from app.core import tenant as t_mod
    from app.middleware import tenant_routing as tr_mod

    t_mod.reset_current_tenant_id()
    tr_mod.clear_tenant_cache()
    yield
    t_mod.reset_current_tenant_id()
    tr_mod.clear_tenant_cache()


@pytest.fixture
def enable_multi_tenant(monkeypatch):
    """临时开启多租户模式 (mock is_multi_tenant_enabled 返回 True)."""
    monkeypatch.setattr(
        "app.middleware.tenant_routing.is_multi_tenant_enabled",
        lambda: True,
    )
    yield


@pytest.fixture
def disable_multi_tenant(monkeypatch):
    """确保多租户关闭 (mock 返回 False)."""
    monkeypatch.setattr(
        "app.middleware.tenant_routing.is_multi_tenant_enabled",
        lambda: False,
    )
    yield


@pytest.fixture
def strict_mode(monkeypatch):
    monkeypatch.setattr(
        "app.middleware.tenant_routing._is_strict",
        lambda: True,
    )
    yield


@pytest.fixture
def loose_mode(monkeypatch):
    monkeypatch.setattr(
        "app.middleware.tenant_routing._is_strict",
        lambda: False,
    )
    yield


# ---------------------------------------------------------------------------
# 公开端点判断
# ---------------------------------------------------------------------------


def test_is_public_path_health():
    from app.middleware.tenant_routing import _is_public_path

    assert _is_public_path("/health")
    assert _is_public_path("/healthz")
    assert _is_public_path("/readyz")
    assert _is_public_path("/metrics")
    assert _is_public_path("/docs")
    assert _is_public_path("/openapi.json")
    assert _is_public_path("/favicon.ico")
    assert _is_public_path("/static/agent.js")
    assert _is_public_path("/api/v1/auth/login")
    assert _is_public_path("/api/v1/auth/login/phone")


def test_is_public_path_business_routes():
    from app.middleware.tenant_routing import _is_public_path

    assert not _is_public_path("/api/v1/user/list")
    assert not _is_public_path("/api/v1/agents/buy")
    assert not _is_public_path("/api/v1/payments/alipay/create")
    assert not _is_public_path("/api/v1/finance/withdraw")


# ---------------------------------------------------------------------------
# tid 解析
# ---------------------------------------------------------------------------


def test_parse_tid_valid():
    from app.middleware.tenant_routing import _parse_tid

    assert _parse_tid("1") == 1
    assert _parse_tid("42") == 42
    assert _parse_tid("99999999") == 99_999_999


def test_parse_tid_invalid():
    from app.middleware.tenant_routing import _parse_tid

    assert _parse_tid(None) is None
    assert _parse_tid("") is None
    assert _parse_tid("   ") is None
    assert _parse_tid("abc") is None
    assert _parse_tid("1.5") is None
    assert _parse_tid("0") is None
    assert _parse_tid("-1") is None
    assert _parse_tid("100000000") is None


# ---------------------------------------------------------------------------
# 单租户模式: middleware pass-through
# ---------------------------------------------------------------------------


def test_middleware_disabled_when_multi_tenant_off(disable_multi_tenant):
    """MULTI_TENANT_ENABLED=false 时, 业务应完全不受影响."""
    from app.core.tenant import get_current_tenant_id
    from app.middleware.tenant_routing import TenantRoutingMiddleware

    captured = {}

    async def fake_app(scope, receive, send):
        captured["tid"] = get_current_tenant_id()
        await send({"type": "http.response.start", "headers": [], "status": 200})
        await send({"type": "http.response.body", "body": b"", "more_body": False})

    mw = TenantRoutingMiddleware(app=fake_app)
    scope = {
        "type": "http",
        "method": "GET",
        "path": "/api/v1/user/list",
        "headers": [(b"x-tenant-id", b"999")],
    }

    async def receive():
        return {"type": "http.request", "body": b"", "more_body": False}

    async def send(msg):
        pass

    asyncio.run(mw(scope, receive, send))
    assert captured["tid"] is None


# ---------------------------------------------------------------------------
# Header 路由: 合法 → 写入 contextvar
# ---------------------------------------------------------------------------


def test_middleware_writes_contextvar_with_valid_header(enable_multi_tenant, strict_mode, monkeypatch):
    """合法 X-Tenant-Id + admin_tenant 存在 → 写入 contextvar."""
    from app.core.tenant import get_current_tenant_id
    from app.middleware.tenant_routing import TenantRoutingMiddleware

    monkeypatch.setattr(
        "app.middleware.tenant_routing._lookup_tenant_status",
        lambda tid: 1 if tid == 42 else None,
    )

    captured = {}

    async def fake_app(scope, receive, send):
        captured["tid"] = get_current_tenant_id()
        await send({"type": "http.response.start", "headers": [], "status": 200})
        await send({"type": "http.response.body", "body": b"", "more_body": False})

    mw = TenantRoutingMiddleware(app=fake_app)
    scope = {
        "type": "http",
        "method": "GET",
        "path": "/api/v1/user/list",
        "headers": [(b"x-tenant-id", b"42")],
    }

    async def receive():
        return {"type": "http.request", "body": b""}

    async def send(msg):
        pass

    asyncio.run(mw(scope, receive, send))
    assert captured["tid"] == 42
    # 请求结束, 必清
    assert get_current_tenant_id() is None


# ---------------------------------------------------------------------------
# Header 缺失: 严格 / 宽松
# ---------------------------------------------------------------------------


def test_middleware_missing_header_strict_returns_400(enable_multi_tenant, strict_mode):
    from app.middleware.tenant_routing import TenantRoutingMiddleware

    sent = []

    async def fake_app(scope, receive, send):
        await send({"type": "http.response.start", "headers": [], "status": 200})
        await send({"type": "http.response.body", "body": b""})

    mw = TenantRoutingMiddleware(app=fake_app)

    async def send(msg):
        sent.append(msg)

    scope = {
        "type": "http",
        "method": "GET",
        "path": "/api/v1/user/list",
        "headers": [],
    }

    async def receive():
        return {"type": "http.request", "body": b""}

    asyncio.run(mw(scope, receive, send))
    start = [m for m in sent if m["type"] == "http.response.start"][0]
    assert start["status"] == 400
    body = [m for m in sent if m["type"] == "http.response.body"][0]
    import json

    payload = json.loads(body["body"].decode())
    assert payload["code"] == "TENANT_REQUIRED"


def test_middleware_missing_header_loose_uses_default(enable_multi_tenant, loose_mode, monkeypatch):
    from app.core.tenant import get_current_tenant_id
    from app.middleware.tenant_routing import TenantRoutingMiddleware

    monkeypatch.setattr(
        "app.middleware.tenant_routing._lookup_tenant_status",
        lambda tid: 1 if tid == 1 else None,
    )

    captured = {}

    async def fake_app(scope, receive, send):
        captured["tid"] = get_current_tenant_id()
        await send({"type": "http.response.start", "headers": [], "status": 200})
        await send({"type": "http.response.body", "body": b""})

    mw = TenantRoutingMiddleware(app=fake_app)
    scope = {
        "type": "http",
        "method": "GET",
        "path": "/api/v1/user/list",
        "headers": [],
    }

    async def receive():
        return {"type": "http.request", "body": b""}

    async def send(msg):
        pass

    asyncio.run(mw(scope, receive, send))
    assert captured["tid"] == 1


# ---------------------------------------------------------------------------
# 非法 header: 非数字 / 越界
# ---------------------------------------------------------------------------


def test_middleware_invalid_header_returns_400(enable_multi_tenant, strict_mode):
    from app.middleware.tenant_routing import TenantRoutingMiddleware

    sent = []

    async def fake_app(scope, receive, send):
        await send({"type": "http.response.start", "headers": [], "status": 200})
        await send({"type": "http.response.body", "body": b""})

    mw = TenantRoutingMiddleware(app=fake_app)

    async def send(msg):
        sent.append(msg)

    for bad_value in [b"abc", b"-1", b"0", b"999999999"]:
        sent.clear()
        scope = {
            "type": "http",
            "method": "GET",
            "path": "/api/v1/user/list",
            "headers": [(b"x-tenant-id", bad_value)],
        }

        async def receive():
            return {"type": "http.request", "body": b""}

        asyncio.run(mw(scope, receive, send))
        start = [m for m in sent if m["type"] == "http.response.start"][0]
        assert start["status"] == 400, f"{bad_value} 应 400, 实际 {start['status']}"


# ---------------------------------------------------------------------------
# 未知 tenant_id
# ---------------------------------------------------------------------------


def test_middleware_unknown_tenant_returns_404(enable_multi_tenant, strict_mode, monkeypatch):
    from app.middleware.tenant_routing import TenantRoutingMiddleware

    monkeypatch.setattr(
        "app.middleware.tenant_routing._lookup_tenant_status",
        lambda tid: None,
    )

    sent = []

    async def fake_app(scope, receive, send):
        await send({"type": "http.response.start", "headers": [], "status": 200})
        await send({"type": "http.response.body", "body": b""})

    mw = TenantRoutingMiddleware(app=fake_app)

    async def send(msg):
        sent.append(msg)

    scope = {
        "type": "http",
        "method": "GET",
        "path": "/api/v1/user/list",
        "headers": [(b"x-tenant-id", b"999")],
    }

    async def receive():
        return {"type": "http.request", "body": b""}

    asyncio.run(mw(scope, receive, send))
    start = [m for m in sent if m["type"] == "http.response.start"][0]
    assert start["status"] == 404


# ---------------------------------------------------------------------------
# 已停用 tenant (status=0)
# ---------------------------------------------------------------------------


def test_middleware_disabled_tenant_returns_403(enable_multi_tenant, strict_mode, monkeypatch):
    from app.middleware.tenant_routing import TenantRoutingMiddleware

    monkeypatch.setattr(
        "app.middleware.tenant_routing._lookup_tenant_status",
        lambda tid: 0,
    )

    sent = []

    async def fake_app(scope, receive, send):
        await send({"type": "http.response.start", "headers": [], "status": 200})
        await send({"type": "http.response.body", "body": b""})

    mw = TenantRoutingMiddleware(app=fake_app)

    async def send(msg):
        sent.append(msg)

    scope = {
        "type": "http",
        "method": "GET",
        "path": "/api/v1/user/list",
        "headers": [(b"x-tenant-id", b"5")],
    }

    async def receive():
        return {"type": "http.request", "body": b""}

    asyncio.run(mw(scope, receive, send))
    start = [m for m in sent if m["type"] == "http.response.start"][0]
    assert start["status"] == 403


# ---------------------------------------------------------------------------
# 公开端点: 不强制 tenant
# ---------------------------------------------------------------------------


def test_middleware_public_path_passes_through(enable_multi_tenant, strict_mode):
    from app.core.tenant import get_current_tenant_id
    from app.middleware.tenant_routing import TenantRoutingMiddleware

    captured = {}

    async def fake_app(scope, receive, send):
        captured["tid"] = get_current_tenant_id()
        await send({"type": "http.response.start", "headers": [], "status": 200})
        await send({"type": "http.response.body", "body": b""})

    mw = TenantRoutingMiddleware(app=fake_app)
    scope = {
        "type": "http",
        "method": "GET",
        "path": "/health",
        "headers": [],
    }

    async def receive():
        return {"type": "http.request", "body": b""}

    async def send(msg):
        pass

    asyncio.run(mw(scope, receive, send))
    assert captured["tid"] == 1


# ---------------------------------------------------------------------------
# JWT tid 备选
# ---------------------------------------------------------------------------


def test_middleware_jwt_tid_claim_as_fallback(enable_multi_tenant, strict_mode, monkeypatch):
    """Header 缺时, 用 scope.state.jwt_payload.tid."""
    from app.core.tenant import get_current_tenant_id
    from app.middleware.tenant_routing import TenantRoutingMiddleware

    monkeypatch.setattr(
        "app.middleware.tenant_routing._lookup_tenant_status",
        lambda tid: 1 if tid == 7 else None,
    )

    captured = {}

    async def fake_app(scope, receive, send):
        captured["tid"] = get_current_tenant_id()
        await send({"type": "http.response.start", "headers": [], "status": 200})
        await send({"type": "http.response.body", "body": b""})

    mw = TenantRoutingMiddleware(app=fake_app)
    scope = {
        "type": "http",
        "method": "GET",
        "path": "/api/v1/user/list",
        "headers": [],
        "state": {"jwt_payload": {"sub": "u-1", "tid": "7"}},
    }

    async def receive():
        return {"type": "http.request", "body": b""}

    async def send(msg):
        pass

    asyncio.run(mw(scope, receive, send))
    assert captured["tid"] == 7


def test_middleware_user_tenant_id_state_fallback(enable_multi_tenant, strict_mode, monkeypatch):
    """Header + JWT 都缺, 用 state.user_tenant_id."""
    from app.core.tenant import get_current_tenant_id
    from app.middleware.tenant_routing import TenantRoutingMiddleware

    monkeypatch.setattr(
        "app.middleware.tenant_routing._lookup_tenant_status",
        lambda tid: 1 if tid == 9 else None,
    )

    captured = {}

    async def fake_app(scope, receive, send):
        captured["tid"] = get_current_tenant_id()
        await send({"type": "http.response.start", "headers": [], "status": 200})
        await send({"type": "http.response.body", "body": b""})

    mw = TenantRoutingMiddleware(app=fake_app)
    scope = {
        "type": "http",
        "method": "GET",
        "path": "/api/v1/user/list",
        "headers": [],
        "state": {"user_tenant_id": 9},
    }

    async def receive():
        return {"type": "http.request", "body": b""}

    async def send(msg):
        pass

    asyncio.run(mw(scope, receive, send))
    assert captured["tid"] == 9


# ---------------------------------------------------------------------------
# 缓存命中: 第二次查不调 DB
# ---------------------------------------------------------------------------


def test_tenant_lookup_cache_hits(monkeypatch):
    """第二次查同一个 tenant, 不再调 DB."""
    from app.middleware import tenant_routing as tr_mod

    db_calls = []

    def fake_db_session():
        db_calls.append("called")

        class FakeSession:
            def __enter__(self):
                return self

            def __exit__(self, *a):
                pass

            def execute(self, stmt, params):
                class FakeResult:
                    def first(inner_self):
                        return (1,)

                return FakeResult()

            def commit(self):
                pass

        return FakeSession()

    monkeypatch.setattr(tr_mod, "_cache_ttl", lambda: 60)

    with patch("app.database.SessionFactory1", fake_db_session):
        s1 = tr_mod._lookup_tenant_status(123)
        assert s1 == 1
        s2 = tr_mod._lookup_tenant_status(123)
        assert s2 == 1

    assert len(db_calls) == 1, f"应只调 1 次 DB, 实际 {len(db_calls)}"


def test_tenant_lookup_negative_cache():
    """不存在的 tenant 走负缓存."""
    from app.middleware import tenant_routing as tr_mod

    db_calls = []

    def fake_db_session():
        db_calls.append("called")

        class FakeSession:
            def __enter__(self):
                return self

            def __exit__(self, *a):
                pass

            def execute(self, stmt, params):
                class FakeResult:
                    def first(inner_self):
                        return None

                return FakeResult()

        return FakeSession()

    with patch("app.database.SessionFactory1", fake_db_session):
        r1 = tr_mod._lookup_tenant_status(999)
        r2 = tr_mod._lookup_tenant_status(999)
        r3 = tr_mod._lookup_tenant_status(999)

    assert r1 is None
    assert r2 is None
    assert r3 is None
    assert len(db_calls) == 1, f"负缓存应只查 1 次, 实际 {len(db_calls)}"


# ---------------------------------------------------------------------------
# X-Tenant-Schema 响应头
# ---------------------------------------------------------------------------


def test_middleware_sets_tenant_schema_response_header(enable_multi_tenant, strict_mode, monkeypatch):
    from app.middleware.tenant_routing import TenantRoutingMiddleware

    monkeypatch.setattr(
        "app.middleware.tenant_routing._lookup_tenant_status",
        lambda tid: 1,
    )

    sent = []

    async def fake_app(scope, receive, send):
        await send({"type": "http.response.start", "headers": [], "status": 200})
        await send({"type": "http.response.body", "body": b"ok"})

    mw = TenantRoutingMiddleware(app=fake_app)

    async def send(msg):
        sent.append(msg)

    scope = {
        "type": "http",
        "method": "GET",
        "path": "/api/v1/user/list",
        "headers": [(b"x-tenant-id", b"5")],
    }

    async def receive():
        return {"type": "http.request", "body": b""}

    asyncio.run(mw(scope, receive, send))
    start = [m for m in sent if m["type"] == "http.response.start"][0]
    headers = dict(start["headers"])
    assert b"x-tenant-schema" in headers, f"应设 X-Tenant-Schema 头, 实际 {headers}"
    assert headers[b"x-tenant-schema"] == b"tenant_5"


# ---------------------------------------------------------------------------
# 并发隔离: contextvar 在不同 request 间不串
# ---------------------------------------------------------------------------


def test_middleware_concurrent_requests_isolated(enable_multi_tenant, strict_mode, monkeypatch):
    """并发请求: 每个请求的 tenant_id 互不污染."""
    from app.core.tenant import get_current_tenant_id
    from app.middleware.tenant_routing import TenantRoutingMiddleware

    monkeypatch.setattr(
        "app.middleware.tenant_routing._lookup_tenant_status",
        lambda tid: 1,
    )

    mw = TenantRoutingMiddleware

    captured = {}

    async def fake_app(scope, receive, send):
        path = scope["path"]
        expected_tid = int(path.rsplit("/", 1)[-1])
        actual = get_current_tenant_id()
        captured[expected_tid] = actual
        await asyncio.sleep(0.05)
        assert get_current_tenant_id() == expected_tid
        await send({"type": "http.response.start", "headers": [], "status": 200})
        await send({"type": "http.response.body", "body": b""})

    async def run_one(tid):
        instance = mw(app=fake_app)
        scope = {
            "type": "http",
            "method": "GET",
            "path": f"/api/v1/test/{tid}",
            "headers": [(b"x-tenant-id", str(tid).encode())],
        }

        async def receive():
            return {"type": "http.request", "body": b""}

        async def send(msg):
            pass

        await instance(scope, receive, send)

    async def _run_all():
        await asyncio.gather(*[run_one(i) for i in range(1, 6)])

    asyncio.run(_run_all())
    for i in range(1, 6):
        assert captured[i] == i, f"tid={i} 被串了, 实际 {captured[i]}"


# ---------------------------------------------------------------------------
# get_tenant_id_dep 依赖函数
# ---------------------------------------------------------------------------


def test_get_tenant_id_dep_returns_current():
    from app.core.tenant import reset_current_tenant_id, set_current_tenant_id
    from app.middleware.tenant_routing import get_tenant_id_dep

    reset_current_tenant_id()
    assert get_tenant_id_dep() == 1
    set_current_tenant_id(99)
    assert get_tenant_id_dep() == 99
    reset_current_tenant_id()
    assert get_tenant_id_dep() == 1


# ---------------------------------------------------------------------------
# clear_tenant_cache / snapshot
# ---------------------------------------------------------------------------


def test_clear_tenant_cache():
    from app.middleware import tenant_routing as tr_mod

    tr_mod._TENANT_CACHE[1] = (1, 9999999999.0)
    tr_mod._TENANT_NEGATIVE_CACHE[2] = 9999999999.0
    assert tr_mod.get_tenant_cache_snapshot()["positive_total"] == 1
    assert tr_mod.get_tenant_cache_snapshot()["negative_total"] == 1
    tr_mod.clear_tenant_cache()
    assert tr_mod.get_tenant_cache_snapshot()["positive_total"] == 0
    assert tr_mod.get_tenant_cache_snapshot()["negative_total"] == 0


def test_get_tenant_cache_snapshot_excludes_expired():
    import time

    from app.middleware import tenant_routing as tr_mod

    now = time.time()
    tr_mod._TENANT_CACHE[1] = (1, now - 1)  # 已过期
    tr_mod._TENANT_CACHE[2] = (1, now + 100)  # 未过期
    snap = tr_mod.get_tenant_cache_snapshot()
    assert 1 not in snap["positive"]
    assert 2 in snap["positive"]
    tr_mod.clear_tenant_cache()


# ---------------------------------------------------------------------------
# 切换开关: header_name / strict
# ---------------------------------------------------------------------------


def test_custom_header_name(monkeypatch):
    from app.middleware import tenant_routing as tr_mod

    monkeypatch.setenv("ZHS_TENANT_HEADER_NAME", "X-Org-Id")
    assert tr_mod._header_name() == "X-Org-Id"


def test_strict_mode_default():
    from app.middleware import tenant_routing as tr_mod

    os.environ.pop("ZHS_TENANT_STRICT", None)
    assert tr_mod._is_strict() is True


def test_loose_mode_env():
    from app.middleware import tenant_routing as tr_mod

    os.environ["ZHS_TENANT_STRICT"] = "0"
    assert tr_mod._is_strict() is False
    del os.environ["ZHS_TENANT_STRICT"]


# ---------------------------------------------------------------------------
# 真实 admin_tenant 集成 (DB 不可用降级)
# ---------------------------------------------------------------------------


def test_lookup_tenant_status_db_unavailable():
    """DB 不可用时, _lookup_tenant_status 返回 None (降级)."""
    from app.middleware import tenant_routing as tr_mod

    def broken_session():
        raise RuntimeError("DB down")

    with patch("app.database.SessionFactory1", broken_session):
        result = tr_mod._lookup_tenant_status(123)
    assert result is None


def test_lookup_tenant_status_exception_logged_silently():
    """DB 异常应静默, 不抛到业务."""
    from app.middleware import tenant_routing as tr_mod

    def broken_session():
        raise ConnectionError("connection refused")

    with patch("app.database.SessionFactory1", broken_session):
        result = tr_mod._lookup_tenant_status(456)
    assert result is None


# ---------------------------------------------------------------------------
# main.py 已注册 middleware
# ---------------------------------------------------------------------------


def test_main_registers_tenant_routing_middleware():
    """验证 TenantRoutingMiddleware 已在 main.py 中注册."""
    main_src = (ROOT / "app" / "main.py").read_text(encoding="utf-8")
    assert "TenantRoutingMiddleware" in main_src
    assert "app.middleware.tenant_routing" in main_src


# ---------------------------------------------------------------------------
# WebSocket scope 直通
# ---------------------------------------------------------------------------


def test_websocket_scope_passes_through(enable_multi_tenant, strict_mode):
    """WebSocket scope 不应被 tenant middleware 拦截."""
    from app.middleware.tenant_routing import TenantRoutingMiddleware

    called = [False]

    async def fake_app(scope, receive, send):
        called[0] = True
        await send({"type": "websocket.accept"})

    mw = TenantRoutingMiddleware(app=fake_app)
    scope = {"type": "websocket", "path": "/ws/chat", "headers": []}

    async def receive():
        return {"type": "websocket.connect"}

    async def send(msg):
        pass

    asyncio.run(mw(scope, receive, send))
    assert called[0] is True


# ---------------------------------------------------------------------------
# 公开端点 必清 contextvar (避免泄漏到下一个非公开请求)
# ---------------------------------------------------------------------------


def test_public_path_resets_context(enable_multi_tenant, strict_mode):
    from app.core.tenant import get_current_tenant_id
    from app.middleware.tenant_routing import TenantRoutingMiddleware

    async def fake_app(scope, receive, send):
        await send({"type": "http.response.start", "headers": [], "status": 200})
        await send({"type": "http.response.body", "body": b""})

    mw = TenantRoutingMiddleware(app=fake_app)
    scope = {
        "type": "http",
        "method": "GET",
        "path": "/health",
        "headers": [],
    }

    async def receive():
        return {"type": "http.request", "body": b""}

    async def send(msg):
        pass

    asyncio.run(mw(scope, receive, send))
    # 公开端点结束后 contextvar 必清
    assert get_current_tenant_id() is None
