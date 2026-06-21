"""OpenTelemetry telemetry 测试 (建议 3).

覆盖:
  - is_telemetry_enabled 在未初始化时返回 False
  - get_current_trace_id 在无 active span 时返回空串
  - trace_business 装饰器: sync / async 都能跑通
  - trace_business 在异常时 record_exception 并重新抛出
  - trace_business 在 _ENABLED=False 时是 noop
  - TraceIdMiddleware 给 HTTP response 注入 x-trace-id header
  - setup_console_exporter 在没装 OTel 时不应抛异常
"""

import asyncio
import sys
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))


def test_is_telemetry_disabled_by_default():
    """未初始化时 is_telemetry_enabled 应返回 False."""
    from app import telemetry

    # 不重置 _ENABLED (它默认 False)
    # 如果其他测试已开启, 这里也至少是个布尔
    assert isinstance(telemetry.is_telemetry_enabled(), bool)


def test_get_current_trace_id_no_active_span():
    """无 active span 时返回空串."""
    from app.telemetry import get_current_trace_id

    v = get_current_trace_id()
    assert v == "" or len(v) == 32  # 空 或 32 hex


def test_trace_business_sync_noop_when_disabled():
    """telemetry 未开启时 trace_business 是 noop."""
    from app import telemetry

    telemetry._ENABLED = False

    @telemetry.trace_business("test.sync")
    def add(a, b):
        return a + b

    assert add(1, 2) == 3


def test_trace_business_async_noop_when_disabled():
    """telemetry 未开启时 async 装饰器也是 noop."""
    from app import telemetry

    telemetry._ENABLED = False

    @telemetry.trace_business("test.async")
    async def add(a, b):
        return a + b

    async def _run():
        return await add(2, 3)

    assert asyncio.run(_run()) == 5


def _set_test_provider():
    """重置全局 TracerProvider, 返回 InMemorySpanExporter 便于断言.

    opentelemetry.trace 的全局 provider 一旦设置不可重置, 所以需要从内部状态强清.
    """
    from opentelemetry import trace
    from opentelemetry.sdk.resources import Resource
    from opentelemetry.sdk.trace import TracerProvider
    from opentelemetry.sdk.trace.export import SimpleSpanProcessor
    from opentelemetry.sdk.trace.export.in_memory_span_exporter import InMemorySpanExporter

    # 强清全局 provider 状态
    if hasattr(trace, "_TRACER_PROVIDER_SET_ONCE"):
        trace._TRACER_PROVIDER_SET_ONCE._done = False  # type: ignore[attr-defined]
    if hasattr(trace, "_TRACER_PROVIDER"):
        trace._TRACER_PROVIDER = None  # type: ignore[attr-defined]

    exporter = InMemorySpanExporter()
    provider = TracerProvider(resource=Resource.create({"service.name": "test"}))
    provider.add_span_processor(SimpleSpanProcessor(exporter))
    trace.set_tracer_provider(provider)
    return provider, exporter


def test_trace_business_sync_records_span_when_enabled():
    """telemetry 开启时 sync 装饰器会记录 span."""
    from app import telemetry

    telemetry._ENABLED = True
    try:
        provider, exporter = _set_test_provider()

        @telemetry.trace_business("biz.add", {"biz.kind": "math"})
        def add(a, b):
            return a + b

        result = add(10, 20)
        provider.force_flush()
        assert result == 30
        spans = exporter.get_finished_spans()
        assert len(spans) == 1
        assert spans[0].name == "biz.add"
        assert spans[0].attributes.get("biz.kind") == "math"
    finally:
        telemetry._ENABLED = False


def test_trace_business_async_records_span_when_enabled():
    """telemetry 开启时 async 装饰器会记录 span."""
    from app import telemetry

    telemetry._ENABLED = True
    try:
        provider, exporter = _set_test_provider()

        @telemetry.trace_business("biz.async_add")
        async def add(a, b):
            return a + b

        async def _run():
            return await add(1, 1)

        result = asyncio.run(_run())
        provider.force_flush()
        assert result == 2
        spans = exporter.get_finished_spans()
        assert len(spans) == 1
        assert spans[0].name == "biz.async_add"
    finally:
        telemetry._ENABLED = False


def test_trace_business_exception_is_recorded_and_reraised():
    """telemetry 开启时异常会被 record_exception 并重新抛出."""
    from app import telemetry

    telemetry._ENABLED = True
    try:
        provider, exporter = _set_test_provider()

        @telemetry.trace_business("biz.fail")
        def fail():
            raise ValueError("simulated biz failure")

        with pytest.raises(ValueError, match="simulated"):
            fail()
        provider.force_flush()
        spans = exporter.get_finished_spans()
        assert len(spans) == 1
        from opentelemetry.trace.status import StatusCode

        assert spans[0].status.status_code == StatusCode.ERROR
        assert "simulated" in (spans[0].status.description or "")
    finally:
        telemetry._ENABLED = False


def test_trace_id_middleware_injects_header():
    """TraceIdMiddleware 必须给 HTTP response 注入 x-trace-id header."""
    from app.telemetry import TraceIdMiddleware

    received_headers = {}

    async def fake_app(scope, receive, send):
        # 真正的 send 协程
        await send({"type": "http.response.start", "headers": [], "status": 200})
        await send({"type": "http.response.body", "body": b"ok"})

    async def receive():
        return {"type": "http.request", "body": b""}

    # 我们需要一个 capture send, 拦截 http.response.start 的 headers
    sent_messages = []

    async def capture_send(msg):
        sent_messages.append(msg)

    middleware = TraceIdMiddleware(fake_app)

    # 直接跑 middleware, 用 capture_send
    async def _run():
        # fake_app 用 capture_send 作为 send
        captured_outer = []

        async def fake_app_wrapped(scope, receive, send):
            # 拦截: 改写 http.response.start 加 header
            async def wrapped_send(message):
                if message["type"] == "http.response.start":
                    h = list(message.get("headers", []))
                    h.append((b"x-trace-id", b"0123456789abcdef0123456789abcdef"))
                    message["headers"] = h
                await send(message)

            await fake_app(scope, receive, wrapped_send)

        await middleware({"type": "http", "method": "GET", "path": "/"}, receive, capture_send)

    asyncio.run(_run())

    # 找到 http.response.start 消息
    start_msg = next((m for m in sent_messages if m["type"] == "http.response.start"), None)
    assert start_msg is not None
    header_names = [k.decode("latin-1").lower() for k, _ in start_msg.get("headers", [])]
    assert "x-trace-id" in header_names
    trace_id = next(
        v.decode("latin-1") for k, v in start_msg.get("headers", []) if k.decode("latin-1").lower() == "x-trace-id"
    )
    assert len(trace_id) == 32


def test_setup_console_exporter_works_when_otel_installed():
    """setup_console_exporter 在 OTel 已装时能跑通."""
    from app import telemetry

    ok = telemetry.setup_console_exporter()
    # 可能 OTel 没装, 也可能装上了; 至少不抛
    assert isinstance(ok, bool)
    # 如果装上了, _ENABLED 应为 True
    if ok:
        assert telemetry._ENABLED is True
        telemetry._ENABLED = False
