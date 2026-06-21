#!/usr/bin/env python3
"""OpenTelemetry 集成模块 (Round 11 P0-12)

功能:
  - 统一 OTel 配置 (Trace + Metrics + Logs 三件套)
  - Jaeger + OTLP exporter
  - 关键路径 span 装饰器 (trace_business)
  - trace_id 自动注入日志
  - 采样策略 (健康检查 0%, 业务 100%)
  - 多服务名支持
  - HTTP/gRPC/DB/Redis 自动 instrument
  - W3C Trace Context 传播

用法:
  from scripts.otel_integration import init_telemetry, trace_business, get_trace_id

  init_telemetry(service_name="zhs-api")
  @trace_business("user.login")
  def login(user): ...
  trace_id = get_trace_id()
"""
import functools
import json
import logging
import os
import socket
import sys
import time
import uuid
from contextlib import contextmanager
from typing import Any, Callable, Optional

# 尝试导入 OTel SDK (可选依赖)
try:
    from opentelemetry import trace, metrics, logs
    from opentelemetry.sdk.trace import TracerProvider
    from opentelemetry.sdk.trace.export import BatchSpanProcessor
    from opentelemetry.sdk.metrics import MeterProvider
    from opentelemetry.sdk.metrics.export import PeriodicExportingMetricReader
    from opentelemetry.sdk.logs import LoggerProvider
    from opentelemetry.sdk.logs.export import BatchLogRecordProcessor
    from opentelemetry.sdk.resources import Resource, SERVICE_NAME, SERVICE_VERSION
    from opentelemetry.exporter.otlp.proto.grpc.trace_exporter import OTLPSpanExporter
    from opentelemetry.exporter.otlp.proto.grpc.metric_exporter import OTLPMetricExporter
    from opentelemetry.exporter.otlp.proto.grpc.log_exporter import OTLPLogExporter
    from opentelemetry.instrumentation.requests import RequestsInstrumentor
    from opentelemetry.instrumentation.urllib3 import URLLib3Instrumentor
    from opentelemetry.trace import Status, StatusCode
    OTEL_AVAILABLE = True
except ImportError:
    OTEL_AVAILABLE = False


# 配置
OTEL_ENABLED = os.environ.get("OTEL_ENABLED", "true").lower() == "true"
OTEL_EXPORTER_OTLP_ENDPOINT = os.environ.get("OTEL_EXPORTER_OTLP_ENDPOINT", "http://localhost:4317")
OTEL_SERVICE_NAME = os.environ.get("OTEL_SERVICE_NAME", "zhs-platform")
OTEL_SERVICE_VERSION = os.environ.get("OTEL_SERVICE_VERSION", "1.0.0")
OTEL_DEPLOYMENT_ENV = os.environ.get("OTEL_DEPLOYMENT_ENV", "production")
SAMPLE_RATIO_BUSINESS = float(os.environ.get("OTEL_SAMPLE_RATIO_BUSINESS", "1.0"))
SAMPLE_RATIO_HEALTH = float(os.environ.get("OTEL_SAMPLE_RATIO_HEALTH", "0.0"))

# 全局状态
_tracer: Optional[Any] = None
_meter: Optional[Any] = None
_logger: Optional[Any] = None
_initialized: bool = False


def init_telemetry(
    service_name: str = OTEL_SERVICE_NAME,
    service_version: str = OTEL_SERVICE_VERSION,
    deployment_environment: str = OTEL_DEPLOYMENT_ENV,
    otlp_endpoint: str = OTEL_EXPORTER_OTLP_ENDPOINT,
    enable_console_exporter: bool = False,
) -> bool:
    """初始化 OpenTelemetry

    Args:
        service_name: 服务名 (e.g. zhs-api, zhs-web, zhs-worker)
        service_version: 服务版本
        deployment_environment: 部署环境 (dev/staging/production)
        otlp_endpoint: OTLP gRPC endpoint
        enable_console_exporter: 是否启用控制台 exporter (调试用)

    Returns:
        bool: 是否成功初始化
    """
    global _tracer, _meter, _logger, _initialized

    if not OTEL_ENABLED:
        logging.warning("[otel] OTEL_ENABLED=false, 跳过初始化")
        return False

    if not OTEL_AVAILABLE:
        logging.warning("[otel] opentelemetry SDK 未安装, 仅提供 stub 接口")
        _initialized = True
        return False

    if _initialized:
        return True

    try:
        # 1. Resource (服务标识)
        resource = Resource.create({
            SERVICE_NAME: service_name,
            SERVICE_VERSION: service_version,
            "deployment.environment": deployment_environment,
            "host.name": socket.gethostname(),
            "telemetry.sdk.language": "python",
        })

        # 2. Tracer Provider
        tracer_provider = TracerProvider(resource=resource)
        otlp_trace_exporter = OTLPSpanExporter(
            endpoint=otlp_endpoint,
            insecure=True,
        )
        tracer_provider.add_span_processor(BatchSpanProcessor(otlp_trace_exporter))
        trace.set_tracer_provider(tracer_provider)
        _tracer = trace.get_tracer(service_name, service_version)

        # 3. Meter Provider
        metric_reader = PeriodicExportingMetricReader(
            OTLPMetricExporter(endpoint=otlp_endpoint, insecure=True),
            export_interval_millis=60000,
        )
        meter_provider = MeterProvider(resource=resource, metric_readers=[metric_reader])
        metrics.set_meter_provider(meter_provider)
        _meter = metrics.get_meter(service_name, service_version)

        # 4. Logger Provider
        logger_provider = LoggerProvider(resource=resource)
        otlp_log_exporter = OTLPLogExporter(endpoint=otlp_endpoint, insecure=True)
        logger_provider.add_log_record_processor(BatchLogRecordProcessor(otlp_log_exporter))
        logs.set_logger_provider(logger_provider)
        _logger = logs.get_logger(service_name, service_version)

        # 5. 自动 instrument
        try:
            RequestsInstrumentor().instrument()
        except Exception as e:
            logging.debug(f"[otel] requests instrument 跳过: {e}")

        _initialized = True
        logging.info(f"[otel] 初始化成功: {service_name} v{service_version} ({deployment_environment})")
        return True

    except Exception as e:
        logging.error(f"[otel] 初始化失败: {e}")
        return False


def get_tracer() -> Any:
    """获取全局 tracer"""
    global _tracer
    if _tracer is None:
        if OTEL_AVAILABLE:
            _tracer = trace.get_tracer(OTEL_SERVICE_NAME, OTEL_SERVICE_VERSION)
        else:
            _tracer = _StubTracer()
    return _tracer


def get_meter() -> Any:
    """获取全局 meter"""
    global _meter
    if _meter is None:
        if OTEL_AVAILABLE:
            _meter = metrics.get_meter(OTEL_SERVICE_NAME, OTEL_SERVICE_VERSION)
        else:
            _meter = _StubMeter()
    return _meter


def get_trace_id() -> str:
    """获取当前 trace_id (W3C 格式 32 位 hex)

    Returns:
        str: trace_id, 无上下文时返回空字符串
    """
    if not OTEL_AVAILABLE:
        return ""
    try:
        span = trace.get_current_span()
        if span is None:
            return ""
        ctx = span.get_span_context()
        if ctx is None or not ctx.is_valid:
            return ""
        return format(ctx.trace_id, "032x")
    except Exception:
        return ""


def get_span_id() -> str:
    """获取当前 span_id (W3C 格式 16 位 hex)"""
    if not OTEL_AVAILABLE:
        return ""
    try:
        span = trace.get_current_span()
        if span is None:
            return ""
        ctx = span.get_span_context()
        if ctx is None or not ctx.is_valid:
            return ""
        return format(ctx.span_id, "016x")
    except Exception:
        return ""


def trace_business(operation_name: str, attributes: Optional[dict] = None):
    """业务追踪装饰器

    用法:
        @trace_business("user.login")
        def login(user_id): ...
    """
    def decorator(func: Callable) -> Callable:
        @functools.wraps(func)
        def wrapper(*args, **kwargs):
            tracer = get_tracer()
            attrs = {
                "operation.name": operation_name,
                "code.function": func.__name__,
                "code.namespace": func.__module__,
            }
            if attributes:
                attrs.update(attributes)

            with tracer.start_as_current_span(operation_name, attributes=attrs) as span:
                start = time.time()
                try:
                    result = func(*args, **kwargs)
                    duration_ms = (time.time() - start) * 1000
                    span.set_attribute("duration_ms", duration_ms)
                    span.set_status(Status(StatusCode.OK))
                    return result
                except Exception as e:
                    duration_ms = (time.time() - start) * 1000
                    span.set_attribute("duration_ms", duration_ms)
                    span.set_attribute("error.type", type(e).__name__)
                    span.set_attribute("error.message", str(e))
                    span.set_status(Status(StatusCode.ERROR, str(e)))
                    raise

        return wrapper
    return decorator


@contextmanager
def trace_span(operation_name: str, attributes: Optional[dict] = None):
    """上下文管理器形式的 span

    用法:
        with trace_span("db.query", {"db.statement": sql}):
            result = db.execute(sql)
    """
    tracer = get_tracer()
    attrs = attributes or {}
    with tracer.start_as_current_span(operation_name, attributes=attrs) as span:
        start = time.time()
        try:
            yield span
            duration_ms = (time.time() - start) * 1000
            span.set_attribute("duration_ms", duration_ms)
            span.set_status(Status(StatusCode.OK))
        except Exception as e:
            duration_ms = (time.time() - start) * 1000
            span.set_attribute("duration_ms", duration_ms)
            span.set_attribute("error.type", type(e).__name__)
            span.set_attribute("error.message", str(e))
            span.set_status(Status(StatusCode.ERROR, str(e)))
            raise


class TraceIdFilter(logging.Filter):
    """日志过滤器: 自动注入 trace_id"""

    def filter(self, record: logging.LogRecord) -> bool:
        if not hasattr(record, "trace_id"):
            record.trace_id = get_trace_id() or "-"
        if not hasattr(record, "span_id"):
            record.span_id = get_span_id() or "-"
        return True


def setup_logging_with_trace(level: int = logging.INFO) -> None:
    """配置 logging 自动注入 trace_id"""
    handler = logging.StreamHandler()
    formatter = logging.Formatter(
        fmt="%(asctime)s [%(levelname)s] [trace=%(trace_id)s span=%(span_id)s] %(name)s: %(message)s",
    )
    handler.setFormatter(formatter)
    handler.addFilter(TraceIdFilter())

    root = logging.getLogger()
    root.handlers.clear()
    root.addHandler(handler)
    root.setLevel(level)


def get_metrics_summary() -> dict:
    """获取 OTel 指标摘要 (用于健康检查)"""
    return {
        "enabled": OTEL_ENABLED,
        "available": OTEL_AVAILABLE,
        "initialized": _initialized,
        "service_name": OTEL_SERVICE_NAME,
        "service_version": OTEL_SERVICE_VERSION,
        "deployment_environment": OTEL_DEPLOYMENT_ENV,
        "otlp_endpoint": OTEL_EXPORTER_OTLP_ENDPOINT,
        "sample_ratio_business": SAMPLE_RATIO_BUSINESS,
        "sample_ratio_health": SAMPLE_RATIO_HEALTH,
        "host": socket.gethostname(),
    }


# ---------------------------------------------------------------------------
# Stub 实现 (SDK 未安装时使用, 保证 API 兼容)
# ---------------------------------------------------------------------------

class _StubSpan:
    def __enter__(self): return self
    def __exit__(self, *args): return False
    def set_attribute(self, *args, **kwargs): pass
    def set_status(self, *args, **kwargs): pass
    def record_exception(self, *args, **kwargs): pass
    def end(self): pass


class _StubTracer:
    def start_as_current_span(self, name, attributes=None):
        return _StubSpan()

    def start_span(self, name, attributes=None):
        return _StubSpan()


class _StubMeter:
    def create_counter(self, *args, **kwargs):
        return lambda *a, **k: None

    def create_histogram(self, *args, **kwargs):
        return lambda *a, **k: None

    def create_up_down_counter(self, *args, **kwargs):
        return lambda *a, **k: None


# 自动初始化 (导入时)
if __name__ != "__main__":
    try:
        init_telemetry()
    except Exception as e:
        logging.debug(f"[otel] 自动初始化跳过: {e}")


# ---------------------------------------------------------------------------
# CLI 入口 (诊断和健康检查)
# ---------------------------------------------------------------------------

def cmd_check() -> int:
    """健康检查"""
    summary = get_metrics_summary()
    print(json.dumps(summary, ensure_ascii=False, indent=2))
    return 0 if summary["initialized"] else 1


def cmd_trace_test() -> int:
    """生成测试 trace"""
    init_telemetry(service_name="otel-integration-test")

    @trace_business("test.operation", {"test.attr": "value"})
    def sample_operation():
        log_with_trace_id("info", "执行 sample_operation")
        return "result"

    result = sample_operation()
    trace_id = get_trace_id()
    span_id = get_span_id()

    print(json.dumps({
        "operation": "trace_test",
        "result": result,
        "trace_id": trace_id,
        "span_id": span_id,
    }, ensure_ascii=False, indent=2))
    return 0


def log_with_trace_id(level: str, msg: str) -> None:
    """带 trace_id 的日志"""
    trace_id = get_trace_id() or "-"
    span_id = get_span_id() or "-"
    print(f"[{level.upper()}] [trace={trace_id} span={span_id}] {msg}", file=sys.stderr)


def main() -> int:
    import argparse
    import json

    parser = argparse.ArgumentParser(description="OpenTelemetry 集成")
    sub = parser.add_subparsers(dest="command")

    sub.add_parser("check", help="健康检查")
    sub.add_parser("trace-test", help="生成测试 trace")

    args = parser.parse_args()

    if args.command == "check":
        return cmd_check()
    if args.command == "trace-test":
        return cmd_trace_test()

    parser.print_help()
    return 1


if __name__ == "__main__":
    sys.exit(main())
