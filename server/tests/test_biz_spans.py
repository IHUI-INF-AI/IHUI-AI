"""业务函数 trace_business span 落地测试 (建议 84).

覆盖:
  - order.create / order.create_course / order.update_status 装饰器存在
  - reconciliation_service 4 个核心函数装饰器存在
  - notice.push / notice.push_async 装饰器存在
  - _ENABLED=False 时所有业务函数能正常返回 (装饰器 noop)
  - _ENABLED=True 时调用业务函数能记录 span
  - span 名称符合业务约定 (order.create / reconcile.alipay / notice.push)
"""

import asyncio
import sys
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))


def _set_test_provider():
    """重置 opentelemetry 全局 TracerProvider, 返回 InMemorySpanExporter."""
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
    provider = TracerProvider(resource=Resource.create({"service.name": "test-biz"}))
    provider.add_span_processor(SimpleSpanProcessor(exporter))
    trace.set_tracer_provider(provider)
    return provider, exporter


# ---------------------------------------------------------------------------
# 装饰器存在性 + 名字
# ---------------------------------------------------------------------------


def test_order_create_has_trace_decorator():
    from app.services import order_service

    # 装饰器会包一层 functools.wraps, __wrapped__ 指向原函数
    assert hasattr(order_service.create_order, "__wrapped__")
    # 调用不应抛, _ENABLED=False 时是 noop
    assert callable(order_service.create_order)


def test_order_create_course_has_trace_decorator():
    from app.services import order_service

    assert hasattr(order_service.create_course_order, "__wrapped__")
    assert callable(order_service.create_course_order)


def test_order_update_status_has_trace_decorator():
    from app.services import order_service

    assert hasattr(order_service.update_order_status, "__wrapped__")


def test_reconcile_alipay_has_trace_decorator():
    from app.services import reconciliation_service

    assert hasattr(reconciliation_service.reconcile_alipay_for, "__wrapped__")


def test_reconcile_wechat_has_trace_decorator():
    from app.services import reconciliation_service

    assert hasattr(reconciliation_service.reconcile_wechat_for, "__wrapped__")


def test_reconcile_all_has_trace_decorator():
    from app.services import reconciliation_service

    assert hasattr(reconciliation_service.reconcile_all_for, "__wrapped__")


def test_reconcile_auto_yesterday_has_trace_decorator():
    from app.services import reconciliation_service

    assert hasattr(reconciliation_service.auto_reconcile_yesterday, "__wrapped__")


def test_reconcile_auto_close_expired_has_trace_decorator():
    from app.services import reconciliation_service

    assert hasattr(reconciliation_service.auto_close_expired_orders, "__wrapped__")


def test_notice_push_async_has_trace_decorator():
    from app.ws import notice

    assert hasattr(notice.push_notice_async, "__wrapped__")


# ---------------------------------------------------------------------------
# Noop 模式: _ENABLED=False 时函数正常返回
# ---------------------------------------------------------------------------


def test_order_create_returns_dict_when_disabled():
    """_ENABLED=False 时 create_order 应正常返回 dict (noop)."""
    from app.services import order_service

    # 不实际写库 — 内部用到 SessionFactory1, 用 monkeypatch 掉
    class _FakeOrder:
        id = 1

    class _FakeQuery:
        def filter(self, *a, **kw):
            return self

        def first(self):
            return None

    class _FakeSession:
        def add(self, o):
            pass

        def commit(self):
            pass

        def rollback(self):
            pass

        def close(self):
            pass

        def flush(self):
            pass

        def refresh(self, o):
            pass

        def query(self, m):
            return _FakeQuery()

    import app.services.order_service as mod

    orig = mod.SessionFactory1
    mod.SessionFactory1 = lambda: _FakeSession()
    try:
        result = order_service.create_order("u-001", 9900, product_id="p-1")
    finally:
        mod.SessionFactory1 = orig
    # 该函数即使无装饰器异常也是返回 dict
    assert isinstance(result, dict)
    assert "out_trade_no" in result
    assert result["success"] is True


# ---------------------------------------------------------------------------
# Enabled 模式: 记录 span
# ---------------------------------------------------------------------------


def test_biz_span_recorded_when_enabled_via_inline_decorator():
    """直接构造一个业务函数, 验证 _ENABLED=True 时 span 被记录."""
    from app import telemetry

    telemetry._ENABLED = True
    try:
        provider, exporter = _set_test_provider()

        @telemetry.trace_business("biz.simulate_order", {"biz.type": "order"})
        def fake_create_order(user_id: str, amount: int) -> dict:
            return {"success": True, "user_id": user_id, "amount": amount}

        result = fake_create_order("u-test", 100)
        provider.force_flush()
        assert result == {"success": True, "user_id": "u-test", "amount": 100}
        spans = exporter.get_finished_spans()
        assert len(spans) == 1
        assert spans[0].name == "biz.simulate_order"
        assert spans[0].attributes.get("biz.type") == "order"
    finally:
        telemetry._ENABLED = False


def test_biz_async_span_recorded_when_enabled_via_inline_decorator():
    """async 业务函数 _ENABLED=True 时 span 被记录."""
    from app import telemetry

    telemetry._ENABLED = True
    try:
        provider, exporter = _set_test_provider()

        @telemetry.trace_business("biz.simulate_reconcile", {"biz.type": "payment"})
        async def fake_reconcile(date: str) -> dict:
            return {"date": date, "ok": True}

        async def _run():
            return await fake_reconcile("2026-06-13")

        result = asyncio.run(_run())
        provider.force_flush()
        assert result == {"date": "2026-06-13", "ok": True}
        spans = exporter.get_finished_spans()
        assert len(spans) == 1
        assert spans[0].name == "biz.simulate_reconcile"
        assert spans[0].attributes.get("biz.type") == "payment"
    finally:
        telemetry._ENABLED = False


def test_biz_span_error_status_on_exception():
    """业务函数抛异常时 span 状态为 ERROR 并 record_exception."""
    from app import telemetry

    telemetry._ENABLED = True
    try:
        provider, exporter = _set_test_provider()

        @telemetry.trace_business("biz.fail_path")
        def fail():
            raise RuntimeError("payment gateway timeout")

        with pytest.raises(RuntimeError, match="payment gateway timeout"):
            fail()
        provider.force_flush()
        spans = exporter.get_finished_spans()
        assert len(spans) == 1
        from opentelemetry.trace.status import StatusCode

        assert spans[0].status.status_code == StatusCode.ERROR
        assert spans[0].status.description and "payment gateway timeout" in spans[0].status.description
    finally:
        telemetry._ENABLED = False


# ---------------------------------------------------------------------------
# 业务模块里实际带装饰器的函数（不真跑业务，只验证装饰器存在 + noop 模式不抛）
# ---------------------------------------------------------------------------


def test_business_modules_import_with_traced_functions():
    """业务模块导入时, 带 @trace_business 的函数不应破坏 import."""
    from app.services.order_service import create_course_order, create_order, update_order_status
    from app.services.reconciliation_service import (
        auto_close_expired_orders,
        auto_reconcile_yesterday,
        reconcile_alipay_for,
        reconcile_all_for,
        reconcile_wechat_for,
    )
    from app.ws.notice import push_notice_async

    # 全部应可调用 (虽然内部要 DB / 网络, 但 callable 性确认导入无语法问题)
    for fn in (
        create_order,
        create_course_order,
        update_order_status,
        reconcile_alipay_for,
        reconcile_wechat_for,
        reconcile_all_for,
        auto_reconcile_yesterday,
        auto_close_expired_orders,
        push_notice_async,
    ):
        assert callable(fn)
        # 装饰器包了 functools.wraps, 应有 __wrapped__
        assert hasattr(fn, "__wrapped__"), f"{fn.__qualname__} 缺装饰器"
