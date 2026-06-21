"""Phase 15 建议 1: OpenTelemetry 全链路追踪.

目的:
  把 ZHS Platform 所有 HTTP 请求/数据库查询/外部 API 调用纳入 OTel tracing,
  输出到 OTLP collector (Jaeger/Tempo/Honeycomb) 或 console (开发模式).

设计:
  1. setup_tracing()  一站式初始化 (幂等, 多次调用只生效一次)
  2. TracingMiddleware  FastAPI 中间件, 自动 span 每个请求
  3. instrument_sqlalchemy()  自动追踪所有 SQL 查询
  4. instrument_requests()  自动追踪 httpx/requests 调用
  5. traced() decorator  业务函数打点
  6. 优雅降级  opentelemetry 未安装时所有函数 no-op

用法:
  from otel_tracing import setup_tracing, instrument_sqlalchemy, traced

  setup_tracing(
      service_name="zhs-platform",
      version="0.15.0",
      env="prod",
      otlp_endpoint="http://otel-collector:4317",
      sample_ratio=0.1,
  )

  app.add_middleware(TracingMiddleware)

  engine = create_engine(url)
  instrument_sqlalchemy(engine)

  @traced("process_payment")
  def process_payment(order_id: str):
      ...
"""

from __future__ import annotations

import functools
import os
import sys
import time
from collections.abc import Callable
from typing import Any

# 优雅降级: 无 OTel 时所有函数 no-op
try:
    from opentelemetry import trace
    from opentelemetry.sdk.resources import Resource
    from opentelemetry.sdk.trace import TracerProvider
    from opentelemetry.sdk.trace.export import (
        BatchSpanProcessor,
        ConsoleSpanExporter,
        SimpleSpanProcessor,
    )
    from opentelemetry.sdk.trace.sampling import (
        ALWAYS_OFF,
        ALWAYS_ON,
        TraceIdRatioBased,
    )

    OTEL_SDK_AVAILABLE = True
except ImportError:
    OTEL_SDK_AVAILABLE = False
    trace = None  # type: ignore

try:
    from opentelemetry.exporter.otlp.proto.grpc.trace_exporter import OTLPSpanExporter

    OTLP_AVAILABLE = True
except ImportError:
    OTLP_AVAILABLE = False

try:
    from opentelemetry.instrumentation.fastapi import FastAPIInstrumentor

    FASTAPI_INSTR_AVAILABLE = True
except ImportError:
    FASTAPI_INSTR_AVAILABLE = False

try:
    from opentelemetry.instrumentation.sqlalchemy import SQLAlchemyInstrumentor

    SQLA_INSTR_AVAILABLE = True
except ImportError:
    SQLA_INSTR_AVAILABLE = False

try:
    from opentelemetry.instrumentation.requests import RequestsInstrumentor

    REQ_INSTR_AVAILABLE = True
except ImportError:
    REQ_INSTR_AVAILABLE = False

try:
    from opentelemetry.instrumentation.httpx import HTTPXClientInstrumentor

    HTTPX_INSTR_AVAILABLE = True
except ImportError:
    HTTPX_INSTR_AVAILABLE = False


# ---------------------------------------------------------------------------
# 1. 状态
# ---------------------------------------------------------------------------

_initialized = False
_setup_config: dict = {}


def is_available() -> bool:
    """OTel SDK 是否可用."""
    return OTEL_SDK_AVAILABLE


def is_initialized() -> bool:
    return _initialized


def get_setup_config() -> dict:
    return dict(_setup_config)


# ---------------------------------------------------------------------------
# 2. setup_tracing
# ---------------------------------------------------------------------------


def setup_tracing(
    service_name: str = "zhs-platform",
    version: str = "0.0.0",
    env: str = "dev",
    otlp_endpoint: str = "",
    sample_ratio: float = 1.0,
    console_export: bool = False,
) -> bool:
    """初始化 OTel tracing.

    Args:
        service_name:  服务名 (会写入 resource attributes)
        version:       服务版本
        env:           部署环境 (dev/staging/prod)
        otlp_endpoint: OTLP gRPC endpoint, 空=不导出
        sample_ratio:  采样率 (0.0~1.0)
        console_export: 是否同时 console 输出 (开发用)

    Returns:
        True 初始化成功, False 失败 (如 OTel SDK 未安装)
    """
    global _initialized, _setup_config
    if _initialized:
        return True
    if not OTEL_SDK_AVAILABLE:
        return False

    # 采样器
    if sample_ratio <= 0:
        sampler = ALWAYS_OFF
    elif sample_ratio >= 1.0:
        sampler = ALWAYS_ON
    else:
        sampler = TraceIdRatioBased(sample_ratio)

    # 资源
    resource = Resource.create(
        {
            "service.name": service_name,
            "service.version": version,
            "deployment.environment": env,
        }
    )

    # Provider
    provider = TracerProvider(resource=resource, sampler=sampler)

    # Exporter
    if otlp_endpoint and OTLP_AVAILABLE:
        try:
            exporter = OTLPSpanExporter(endpoint=otlp_endpoint, insecure=True)
            provider.add_span_processor(BatchSpanProcessor(exporter))
        except Exception as e:
            print(f"[otel] OTLP exporter 初始化失败: {e}", file=sys.stderr)
    if console_export:
        provider.add_span_processor(SimpleSpanProcessor(ConsoleSpanExporter()))

    trace.set_tracer_provider(provider)
    _initialized = True
    _setup_config = {
        "service_name": service_name,
        "version": version,
        "env": env,
        "otlp_endpoint": otlp_endpoint,
        "sample_ratio": sample_ratio,
        "console_export": console_export,
    }
    return True


# ---------------------------------------------------------------------------
# 3. instrument_*
# ---------------------------------------------------------------------------

_instrumented_engines: set[int] = set()
_instrumented_requests = False
_instrumented_httpx = False
_instrumented_fastapi_apps: set[int] = set()


def instrument_sqlalchemy(engine: Any) -> bool:
    """追踪 SQLAlchemy 引擎. 重复调用幂等."""
    if not SQLA_INSTR_AVAILABLE:
        return False
    if id(engine) in _instrumented_engines:
        return True
    try:
        SQLAlchemyInstrumentor().instrument(engine=engine)
        _instrumented_engines.add(id(engine))
        return True
    except Exception as e:
        print(f"[otel] SQLAlchemy instrumentation 失败: {e}", file=sys.stderr)
        return False


def instrument_requests() -> bool:
    """追踪 requests 库."""
    global _instrumented_requests
    if not REQ_INSTR_AVAILABLE:
        return False
    if _instrumented_requests:
        return True
    try:
        RequestsInstrumentor().instrument()
        _instrumented_requests = True
        return True
    except Exception as e:
        print(f"[otel] requests instrumentation 失败: {e}", file=sys.stderr)
        return False


def instrument_httpx() -> bool:
    """追踪 httpx 库."""
    global _instrumented_httpx
    if not HTTPX_INSTR_AVAILABLE:
        return False
    if _instrumented_httpx:
        return True
    try:
        HTTPXClientInstrumentor().instrument()
        _instrumented_httpx = True
        return True
    except Exception as e:
        print(f"[otel] httpx instrumentation 失败: {e}", file=sys.stderr)
        return False


def instrument_fastapi(app: Any) -> bool:
    """追踪 FastAPI app. 重复调用幂等."""
    if not FASTAPI_INSTR_AVAILABLE:
        return False
    if id(app) in _instrumented_fastapi_apps:
        return True
    try:
        FastAPIInstrumentor.instrument_app(app)
        _instrumented_fastapi_apps.add(id(app))
        return True
    except Exception as e:
        print(f"[otel] fastapi instrumentation 失败: {e}", file=sys.stderr)
        return False


# ---------------------------------------------------------------------------
# 4. get_tracer / traced
# ---------------------------------------------------------------------------


def get_tracer(name: str = "zhs-platform"):
    """获取 tracer. SDK 未安装时返回 NoOp tracer."""
    if not OTEL_SDK_AVAILABLE:
        return _NoOpTracer()
    return trace.get_tracer(name)


def traced(name: str | None = None, attributes: dict | None = None):
    """decorator: 把函数包装为 OTel span.

    用法:
        @traced()
        def my_func(): ...

        @traced("custom_name", {"key": "value"})
        def my_func(): ...
    """

    def decorator(fn: Callable) -> Callable:
        span_name = name or f"{fn.__module__}.{fn.__qualname__}"
        if not OTEL_SDK_AVAILABLE:
            return fn

        @functools.wraps(fn)
        def sync_wrapper(*args, **kwargs):
            tracer = trace.get_tracer("zhs-platform")
            with tracer.start_as_current_span(span_name) as span:
                if attributes:
                    for k, v in attributes.items():
                        span.set_attribute(k, v)
                return fn(*args, **kwargs)

        @functools.wraps(fn)
        async def async_wrapper(*args, **kwargs):
            tracer = trace.get_tracer("zhs-platform")
            with tracer.start_as_current_span(span_name) as span:
                if attributes:
                    for k, v in attributes.items():
                        span.set_attribute(k, v)
                return await fn(*args, **kwargs)

        import inspect

        if inspect.iscoroutinefunction(fn):
            return async_wrapper
        return sync_wrapper

    return decorator


# ---------------------------------------------------------------------------
# 5. TracingMiddleware (不依赖 opentelemetry-instrumentation)
# ---------------------------------------------------------------------------


class TracingMiddleware:
    """FastAPI 中间件: 自动为每个请求创建 span.

    当 FastAPIInstrumentor 不可用时作为降级方案.
    与 FastAPIInstrumentor 同时存在不会重复 (按 _instrumented_fastapi_apps 集合).
    """

    def __init__(self, app):
        self.app = app

    async def __call__(self, scope, receive, send):
        if scope["type"] != "http" or not OTEL_SDK_AVAILABLE:
            return await self.app(scope, receive, send)

        # 避免与 instrument_fastapi 重复
        app_id = id(self.app)
        if app_id in _instrumented_fastapi_apps:
            return await self.app(scope, receive, send)

        start = time.time()
        method = scope.get("method", "GET")
        path = scope.get("path", "")
        span = trace.get_tracer("zhs-platform").start_span(
            f"HTTP {method} {path}",
            attributes={
                "http.method": method,
                "http.target": path,
                "http.scheme": scope.get("scheme", "http"),
            },
        )
        status_holder = {"code": 500}

        async def send_wrapper(message):
            if message["type"] == "http.response.start":
                status_holder["code"] = message.get("status", 500)
            await send(message)

        try:
            await self.app(scope, receive, send_wrapper)
        finally:
            duration = time.time() - start
            span.set_attribute("http.status_code", status_holder["code"])
            span.set_attribute("http.duration_ms", int(duration * 1000))
            if status_holder["code"] >= 500:
                span.set_attribute("error", True)
            span.end()


# ---------------------------------------------------------------------------
# 6. NoOp
# ---------------------------------------------------------------------------


class _NoOpSpan:
    def __enter__(self):
        return self

    def __exit__(self, *a):
        pass

    def set_attribute(self, k, v):
        pass

    def set_status(self, *a, **kw):
        pass

    def end(self):
        pass

    def record_exception(self, *a, **kw):
        pass


class _NoOpTracer:
    def start_as_current_span(self, name, **kw):
        return _NoOpSpan()

    def start_span(self, name, **kw):
        return _NoOpSpan()


# ---------------------------------------------------------------------------
# 7. reset (测试用)
# ---------------------------------------------------------------------------


def reset() -> None:
    """重置所有状态 (测试用)."""
    global _initialized, _setup_config, _instrumented_requests, _instrumented_httpx
    _initialized = False
    _setup_config = {}
    _instrumented_requests = False
    _instrumented_httpx = False
    _instrumented_engines.clear()
    _instrumented_fastapi_apps.clear()
    if OTEL_SDK_AVAILABLE:
        try:
            # 清理当前 provider
            provider = trace.get_tracer_provider()
            if hasattr(provider, "shutdown"):
                provider.shutdown()
            from opentelemetry.trace import NoOpTracerProvider

            trace.set_tracer_provider(NoOpTracerProvider())
        except Exception:
            pass


# ---------------------------------------------------------------------------
# 8. CLI
# ---------------------------------------------------------------------------


def main(argv: list[str] | None = None) -> int:
    """演示: 输出 setup 状态."""
    import argparse

    p = argparse.ArgumentParser(description="OTel tracing 状态")
    p.add_argument("--service-name", default=os.environ.get("ZHS_SERVICE_NAME", "zhs-platform"))
    p.add_argument("--version", default=os.environ.get("ZHS_VERSION", "0.0.0"))
    p.add_argument("--env", default=os.environ.get("ZHS_ENV", "dev"))
    p.add_argument("--otlp-endpoint", default=os.environ.get("OTEL_EXPORTER_OTLP_ENDPOINT", ""))
    p.add_argument("--sample-ratio", type=float, default=float(os.environ.get("OTEL_SAMPLE_RATIO", "1.0")))
    p.add_argument("--console", action="store_true", help="console exporter")
    args = p.parse_args(argv)

    ok = setup_tracing(
        service_name=args.service_name,
        version=args.version,
        env=args.env,
        otlp_endpoint=args.otlp_endpoint,
        sample_ratio=args.sample_ratio,
        console_export=args.console,
    )
    if not ok:
        print("[error] OTel SDK 未安装 (pip install opentelemetry-sdk)", file=sys.stderr)
        return 1
    print(f"[ok] OTel 已初始化: {get_setup_config()}")
    print(
        f"[info] OTLP_AVAILABLE={OTLP_AVAILABLE}, FastAPIInstr={FASTAPI_INSTR_AVAILABLE}, "
        f"SQLAInstr={SQLA_INSTR_AVAILABLE}, ReqInstr={REQ_INSTR_AVAILABLE}, "
        f"HTTPXInstr={HTTPX_INSTR_AVAILABLE}"
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
