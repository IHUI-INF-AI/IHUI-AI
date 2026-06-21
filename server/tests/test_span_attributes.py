"""OTel span attributes 注入 (建议 92) 单元测试.

覆盖:
  - set_request_context 写入 contextvar, get_request_context 读出
  - _request_context_attributes 转 OTel attributes 格式 (空值丢弃)
  - trace_business 同步函数在 set_request_context 后, span 包含 user.id / endpoint / tenant.id
  - trace_business 异步函数同样
  - 业务 attributes 与 context attributes 合并 (不覆盖)
  - 未设置 context 时, span 不含空 attributes
  - TraceIdMiddleware 自动从 ASGI scope 提取 endpoint
  - TraceIdMiddleware 注入 x-trace-id header 不变 (回归)
  - contextvar 隔离: 不同协程的 context 不串
"""

import asyncio
import sys
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))


@pytest.fixture(autouse=True)
def _clear_request_context():
    """每个测试前清空 contextvar, 避免测试间污染."""
    from app import telemetry

    telemetry.set_request_context(reset=True)
    yield
    telemetry.set_request_context(reset=True)


def _set_test_provider():
    from opentelemetry import trace
    from opentelemetry.sdk.resources import Resource
    from opentelemetry.sdk.trace import TracerProvider
    from opentelemetry.sdk.trace.export import SimpleSpanProcessor
    from opentelemetry.sdk.trace.export.in_memory_span_exporter import InMemorySpanExporter

    if hasattr(trace, "_TRACER_PROVIDER_SET_ONCE"):
        trace._TRACER_PROVIDER_SET_ONCE._done = False  # type: ignore[attr-defined]
    if hasattr(trace, "_TRACER_PROVIDER"):
        trace._TRACER_PROVIDER = None  # type: ignore[attr-defined]

    exporter = InMemorySpanExporter()
    provider = TracerProvider(resource=Resource.create({"service.name": "test-ctx"}))
    provider.add_span_processor(SimpleSpanProcessor(exporter))
    trace.set_tracer_provider(provider)
    return provider, exporter


# ---------------------------------------------------------------------------
# set_request_context / get_request_context
# ---------------------------------------------------------------------------


def test_set_request_context_writes_contextvars():
    from app import telemetry

    telemetry.set_request_context(user_id="u-1", endpoint="GET /api/x", tenant_id="t-1")
    ctx = telemetry.get_request_context()
    # 建议 116 升级: 4 contextvar (user/endpoint/tenant/request)
    assert ctx["user_id"] == "u-1"
    assert ctx["endpoint"] == "GET /api/x"
    assert ctx["tenant_id"] == "t-1"
    assert ctx["request_id"] is None  # 未设时为 None


def test_set_request_context_partial_update():
    from app import telemetry

    telemetry.set_request_context(user_id="u-1", endpoint="GET /a", tenant_id="t-1")
    # 只更新 user_id
    telemetry.set_request_context(user_id="u-2")
    ctx = telemetry.get_request_context()
    assert ctx["user_id"] == "u-2"
    assert ctx["endpoint"] == "GET /a"  # 保留
    assert ctx["tenant_id"] == "t-1"  # 保留


def test_request_context_attributes_drops_empty():
    from app import telemetry

    telemetry.set_request_context()  # 不设任何
    attrs = telemetry._request_context_attributes()
    assert attrs == {}, f"未设 context 时应空, 实际: {attrs}"


def test_request_context_attributes_skips_empty_values():
    from app import telemetry

    telemetry.set_request_context(user_id="", endpoint=None, tenant_id="t-1")
    attrs = telemetry._request_context_attributes()
    # user_id 空串被丢, endpoint None 被丢, tenant_id="t-1" 保留
    assert "user.id" not in attrs
    assert "endpoint" not in attrs
    assert attrs.get("tenant.id") == "t-1"


# ---------------------------------------------------------------------------
# trace_business 自动注入 attributes
# ---------------------------------------------------------------------------


def test_sync_trace_business_inherits_context():
    from app import telemetry

    telemetry._ENABLED = True
    try:
        provider, exporter = _set_test_provider()
        telemetry.set_request_context(user_id="u-99", endpoint="POST /pay", tenant_id="acme")

        @telemetry.trace_business("biz.pay")
        def pay(amount: int) -> int:
            return amount * 2

        result = pay(100)
        provider.force_flush()
        assert result == 200
        spans = exporter.get_finished_spans()
        assert len(spans) == 1
        a = spans[0].attributes
        assert a.get("user.id") == "u-99"
        assert a.get("endpoint") == "POST /pay"
        assert a.get("tenant.id") == "acme"
    finally:
        telemetry._ENABLED = False


def test_async_trace_business_inherits_context():
    from app import telemetry

    telemetry._ENABLED = True
    try:
        provider, exporter = _set_test_provider()
        telemetry.set_request_context(user_id="u-100", endpoint="GET /list", tenant_id="t-2")

        @telemetry.trace_business("biz.list")
        async def fetch_list() -> list:
            return [1, 2, 3]

        async def _run():
            return await fetch_list()

        result = asyncio.run(_run())
        provider.force_flush()
        assert result == [1, 2, 3]
        spans = exporter.get_finished_spans()
        a = spans[0].attributes
        assert a.get("user.id") == "u-100"
        assert a.get("endpoint") == "GET /list"
        assert a.get("tenant.id") == "t-2"
    finally:
        telemetry._ENABLED = False


def test_trace_business_merges_business_and_context_attrs():
    """装饰器自带的 attributes + context attributes 应合并 (context 不覆盖显式)."""
    from app import telemetry

    telemetry._ENABLED = True
    try:
        provider, exporter = _set_test_provider()
        telemetry.set_request_context(user_id="u-1", endpoint="GET /x")

        @telemetry.trace_business("biz.test", {"biz.type": "payment", "user.id": "override"})
        def op():
            return "ok"

        op()
        provider.force_flush()
        spans = exporter.get_finished_spans()
        a = spans[0].attributes
        assert a.get("biz.type") == "payment"
        # 显式 attributes 优先于 context
        assert a.get("user.id") == "override"
        # endpoint 来自 context
        assert a.get("endpoint") == "GET /x"
    finally:
        telemetry._ENABLED = False


def test_trace_business_no_context_omits_empty_attrs():
    """未设 context 时, span 不应含空 user.id/endpoint/tenant.id."""
    from app import telemetry

    telemetry._ENABLED = True
    try:
        provider, exporter = _set_test_provider()

        # 不调用 set_request_context
        @telemetry.trace_business("biz.test")
        def op():
            return 1

        op()
        provider.force_flush()
        spans = exporter.get_finished_spans()
        a = spans[0].attributes
        assert "user.id" not in a
        assert "endpoint" not in a
        assert "tenant.id" not in a
    finally:
        telemetry._ENABLED = False


def test_trace_business_disabled_returns_normally():
    """telemetry 未启用时, set_request_context 不影响函数行为."""
    from app import telemetry

    telemetry._ENABLED = False
    telemetry.set_request_context(user_id="u-x")

    @telemetry.trace_business("biz.off")
    def op():
        return "still works"

    assert op() == "still works"


# ---------------------------------------------------------------------------
# TraceIdMiddleware 注入 endpoint context
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_trace_id_middleware_sets_endpoint_context():
    from app import telemetry

    # 清空之前测试可能残留的 context
    telemetry.set_request_context()
    middleware = telemetry.TraceIdMiddleware(app=None)  # type: ignore[arg-type]

    captured_endpoint = {}

    async def fake_app(scope, receive, send):
        captured_endpoint["endpoint"] = telemetry.get_request_context()["endpoint"]
        # 模拟发响应
        await send({"type": "http.response.start", "headers": [], "status": 200})
        await send({"type": "http.response.body", "body": b"", "more_body": False})

    middleware.app = fake_app
    scope = {"type": "http", "method": "POST", "path": "/api/payment", "headers": []}

    async def receive():
        return {"type": "http.request", "body": b"", "more_body": False}

    async def send(msg):
        pass

    await middleware(scope, receive, send)
    assert captured_endpoint["endpoint"] == "POST /api/payment"


@pytest.mark.asyncio
async def test_trace_id_middleware_injects_header():
    """回归: TraceIdMiddleware 仍注入 x-trace-id header."""
    from app import telemetry

    middleware = telemetry.TraceIdMiddleware(app=None)  # type: ignore[arg-type]

    sent_messages = []

    async def fake_app(scope, receive, send):
        await send({"type": "http.response.start", "headers": [], "status": 200})
        await send({"type": "http.response.body", "body": b"", "more_body": False})

    middleware.app = fake_app
    scope = {"type": "http", "method": "GET", "path": "/", "headers": []}

    async def receive():
        return {"type": "http.request", "body": b""}

    async def send(msg):
        sent_messages.append(msg)

    await middleware(scope, receive, send)
    start = [m for m in sent_messages if m["type"] == "http.response.start"][0]
    headers = dict(start["headers"])
    assert b"x-trace-id" in headers, f"缺 x-trace-id header, 实际: {headers}"


@pytest.mark.asyncio
async def test_trace_id_middleware_skips_non_http():
    """非 http 类型的 scope (如 websocket) 应直通, 不设 context."""
    from app import telemetry

    telemetry.set_request_context()  # 清空
    middleware = telemetry.TraceIdMiddleware(app=None)  # type: ignore[arg-type]

    called = [False]

    async def fake_app(scope, receive, send):
        called[0] = True
        # 此时 context 应仍未设 endpoint
        ctx = telemetry.get_request_context()
        assert ctx["endpoint"] is None

    middleware.app = fake_app
    scope = {"type": "websocket", "path": "/ws", "headers": []}

    async def receive():
        return {"type": "websocket.connect"}

    async def send(msg):
        pass

    await middleware(scope, receive, send)
    assert called[0]


# ---------------------------------------------------------------------------
# ContextVar 协程隔离
# ---------------------------------------------------------------------------


def test_contextvars_isolated_between_threads():
    """contextvar 在并发请求间应自动隔离, 不会串值."""
    import threading

    from app import telemetry

    results = {}

    def worker(name, user_id):
        telemetry.set_request_context(user_id=user_id, endpoint=f"GET /{name}")
        # 模拟处理
        import time

        time.sleep(0.01)
        results[name] = telemetry.get_request_context()["user_id"]

    threads = [threading.Thread(target=worker, args=(str(n), f"u-{n}")) for n in range(5)]
    for t in threads:
        t.start()
    for t in threads:
        t.join()

    for n in range(5):
        assert results[str(n)] == f"u-{n}", f"线程 {n} context 串了: {results}"


def test_contextvars_isolated_in_asyncio():
    """contextvar 在不同 asyncio.Task 间应自动隔离."""
    from app import telemetry

    async def task(name, user_id):
        telemetry.set_request_context(user_id=user_id)
        await asyncio.sleep(0.01)
        return telemetry.get_request_context()["user_id"]

    async def _run():
        results = await asyncio.gather(
            task("a", "u-a"),
            task("b", "u-b"),
            task("c", "u-c"),
        )
        return results

    results = asyncio.run(_run())
    assert results == ["u-a", "u-b", "u-c"], f"contextvar 串了: {results}"
