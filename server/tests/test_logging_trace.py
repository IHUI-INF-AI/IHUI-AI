"""OTel trace_id 串联日志 (建议 88) 单元测试.

覆盖:
  - _trace_id_patcher 在无 active span 时填 "-"
  - _trace_id_patcher 在有 active span 时填 32 hex
  - setup_logging 幂等 (多次调用不重复加 sink)
  - setup_logging 返回 bool
  - 日志输出能通过自定义 sink 拿到, 且 extra.trace_id 字段已注入
  - patcher 异常时不会破坏日志输出
"""

import io
import sys
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))


def _set_test_provider():
    """重置 opentelemetry 全局 TracerProvider."""
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
    provider = TracerProvider(resource=Resource.create({"service.name": "test-log"}))
    provider.add_span_processor(SimpleSpanProcessor(exporter))
    trace.set_tracer_provider(provider)
    return provider, exporter


# ---------------------------------------------------------------------------
# patcher 行为
# ---------------------------------------------------------------------------


def test_patcher_fills_dash_when_no_active_span():
    """无 active span 时 trace_id 字段应为 '-'."""
    from app import telemetry

    record = {"extra": {}}
    telemetry._trace_id_patcher(record)
    assert record["extra"]["trace_id"] == "-"


def test_patcher_fills_32hex_when_active_span():
    """有 active span 时 trace_id 字段应为 32 位 hex."""
    from app import telemetry

    telemetry._ENABLED = True
    try:
        provider, _ = _set_test_provider()
        tracer = __import__("opentelemetry.trace", fromlist=["get_tracer"]).get_tracer("test")
        with tracer.start_as_current_span("op"):
            record = {"extra": {}}
            telemetry._trace_id_patcher(record)
            tid = record["extra"]["trace_id"]
            assert len(tid) == 32
            assert all(c in "0123456789abcdef" for c in tid)
        provider.force_flush()
    finally:
        telemetry._ENABLED = False


def test_patcher_does_not_crash_on_missing_extra():
    """record 缺 extra 字段时 patcher 应能容忍 (用 setdefault)."""
    from app import telemetry

    record = {}  # 无 extra
    try:
        telemetry._trace_id_patcher(record)
        # 不抛异常即通过
    except KeyError:
        pytest.fail("patcher 不应在 record 缺 extra 时抛 KeyError")


# ---------------------------------------------------------------------------
# setup_logging 行为
# ---------------------------------------------------------------------------


def test_setup_logging_returns_bool():
    """setup_logging 应返回 bool."""
    from app import telemetry

    # 强制重置幂等标记, 模拟首次调用
    telemetry._LOGGING_INSTALLED = False
    result = telemetry.setup_logging(level="INFO")
    assert isinstance(result, bool)


def test_setup_logging_is_idempotent():
    """重复调用 setup_logging 不应抛异常, 第二次也返回 True (or 之前已装的状态)."""
    from app import telemetry

    telemetry._LOGGING_INSTALLED = False
    r1 = telemetry.setup_logging(level="INFO")
    r2 = telemetry.setup_logging(level="INFO")
    assert r1 is True
    assert r2 is True  # 幂等返回 True
    assert telemetry._LOGGING_INSTALLED is True


def test_setup_logging_emits_to_sink_with_trace_id():
    """通过 add 临时 sink 抓日志, 验证 trace_id 字段已注入."""
    from loguru import logger

    from app import telemetry

    telemetry._LOGGING_INSTALLED = False
    telemetry.setup_logging(level="INFO")

    # 临时加一个内存 sink 抓 record
    buf = io.StringIO()
    sink_id = logger.add(buf, format="{extra[trace_id]}|{message}", level="INFO")
    try:
        logger.info("hello-trace-test")
    finally:
        logger.remove(sink_id)
    output = buf.getvalue()
    # 无 active span 时填 "-"
    assert "hello-trace-test" in output
    assert "|" in output
    parts = output.strip().split("|", 1)
    assert len(parts) == 2
    assert parts[0] in ("-",) or len(parts[0]) == 32  # 占位 或 32hex


def test_setup_logging_trace_id_matches_otel_context():
    """在 OTel active span 下, 日志里的 trace_id 与 span.trace_id 一致."""
    from loguru import logger

    from app import telemetry

    telemetry._LOGGING_INSTALLED = False
    telemetry._ENABLED = True
    telemetry.setup_logging(level="INFO")
    try:
        provider, _ = _set_test_provider()
        tracer = __import__("opentelemetry.trace", fromlist=["get_tracer"]).get_tracer("test")

        with tracer.start_as_current_span("op-with-trace") as span:
            expected_tid = format(span.get_span_context().trace_id, "032x")
            buf = io.StringIO()
            sink_id = logger.add(buf, format="{extra[trace_id]}|{message}", level="INFO")
            try:
                logger.info("inside-span")
            finally:
                logger.remove(sink_id)
            output = buf.getvalue().strip()
            assert output.startswith(expected_tid + "|"), f"期望日志以 {expected_tid}| 开头, 实际: {output!r}"
            assert output.endswith("inside-span")
        provider.force_flush()
    finally:
        telemetry._ENABLED = False
        telemetry._LOGGING_INSTALLED = False


# ---------------------------------------------------------------------------
# 与现有 telemetry 模块不冲突
# ---------------------------------------------------------------------------


def test_setup_logging_does_not_break_trace_business():
    """setup_logging 装上后, trace_business 装饰器仍正常工作."""
    from app import telemetry

    telemetry._LOGGING_INSTALLED = False
    telemetry._ENABLED = False
    telemetry.setup_logging(level="INFO")
    try:

        @telemetry.trace_business("biz.after_log_setup")
        def add(a, b):
            return a + b

        assert add(2, 3) == 5
    finally:
        telemetry._LOGGING_INSTALLED = False
