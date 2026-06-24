"""OpenTelemetry APM 配置 + 业务级 helper (建议 3).

提供:
  - setup_telemetry: 初始化 OTLP/HTTP exporter, 埋点 FastAPI/SQLAlchemy/Redis/httpx
  - trace_business: 装饰器, 业务级手动 span (自动注入 user/endpoint/tenant attributes)
  - get_current_trace_id: 32 hex 字符串
  - TraceIdMiddleware: HTTP response header X-Trace-Id (与日志串联)
  - setup_console_exporter: 本地调试模式 (无 OTLP endpoint 也可看 span)
  - is_telemetry_enabled: 运行时探测, 供 /health 端点显示
  - setup_logging: loguru 注入 trace_id 字段, 日志与 trace 串联 (建议 88)
  - set_request_context: 注入 user_id/endpoint/tenant_id (建议 92), span 自动继承

服务名: ZHS_PLATFORM_SERVICE_NAME (默认 zhs-platform)
OTLP endpoint: OTEL_EXPORTER_OTLP_ENDPOINT (默认空 → 走 console)
采样率: ZHS_OTEL_SAMPLE_RATIO / ZHS_OTEL_SAMPLE_BUSINESS (由 _build_sampler 读取)
"""

import asyncio
import contextlib
import functools
import os
import sys
from collections.abc import Callable
from contextvars import ContextVar

from loguru import logger

_ENABLED = False
_TRACER = None
_LOGGING_INSTALLED = False

# 建议 92: 请求级 context, 业务 span / SQL span / 日志自动继承
_current_user_id: ContextVar[str | None] = ContextVar("zhs_user_id", default=None)
_current_endpoint: ContextVar[str | None] = ContextVar("zhs_endpoint", default=None)
_current_tenant_id: ContextVar[str | None] = ContextVar("zhs_tenant_id", default=None)
# 建议 116: 请求级 request_id (与 trace_id 串联, 用于 Loki / Grafana 日志串联)
_current_request_id: ContextVar[str | None] = ContextVar("zhs_request_id", default=None)


def _is_otlp_set() -> bool:
    return bool(os.getenv("OTEL_EXPORTER_OTLP_ENDPOINT", "")) or bool(
        os.getenv("OTEL_EXPORTER_OTLP_TRACES_ENDPOINT", "")
    )


def is_telemetry_enabled() -> bool:
    """运行时探测 telemetry 是否已初始化."""
    return _ENABLED


def set_request_id(request_id: str | None = None) -> None:
    """建议 116: 把 request_id 写入 contextvar, 日志自动继承."""
    if request_id is not None:
        _current_request_id.set(str(request_id))


def get_request_id() -> str:
    """返回当前 request_id, 无则返回空串."""
    return _current_request_id.get() or ""


# ---------------------------------------------------------------------------
# 建议 92: 请求级 context (user/endpoint/tenant) -- span 与日志自动继承
# ---------------------------------------------------------------------------


def set_request_context(
    user_id: str | None = None,
    endpoint: str | None = None,
    tenant_id: str | None = None,
    request_id: str | None = None,
    reset: bool = False,
) -> None:
    """在 FastAPI 依赖 / middleware / 业务函数中调用, 把请求级 context 写入 contextvar.

    下游所有 OTel span (包括 trace_business / SQLAlchemy / Redis) 会自动继承
    user.id / endpoint / tenant.id 三个 attribute (若 telemetry 已启用).

    reset=True 时先清空所有 4 个 contextvar, 再 apply 后续参数 (建议 99 改进).
    request_id 参数为建议 116 新增 (用于 Loki 日志串联).
    """
    if reset:
        _current_user_id.set(None)
        _current_endpoint.set(None)
        _current_tenant_id.set(None)
        _current_request_id.set(None)
    if user_id is not None:
        _current_user_id.set(str(user_id))
    if endpoint is not None:
        _current_endpoint.set(str(endpoint))
    if tenant_id is not None:
        _current_tenant_id.set(str(tenant_id))
    if request_id is not None:
        _current_request_id.set(str(request_id))


def get_request_context() -> dict:
    """返回当前请求 context 快照 (调试 / 日志用)."""
    return {
        "user_id": _current_user_id.get(),
        "endpoint": _current_endpoint.get(),
        "tenant_id": _current_tenant_id.get(),
        "request_id": _current_request_id.get(),
    }


def _request_context_attributes() -> dict:
    """把 context 转为 OTel attributes dict (空值丢弃)."""
    attrs = {}
    uid = _current_user_id.get()
    if uid:
        attrs["user.id"] = uid
    ep = _current_endpoint.get()
    if ep:
        attrs["endpoint"] = ep
    tid = _current_tenant_id.get()
    if tid:
        attrs["tenant.id"] = tid
    return attrs


def get_current_trace_id() -> str:
    """返回当前 trace_id (32 位 hex), 无则返回空串."""
    try:
        from opentelemetry import trace

        span = trace.get_current_span()
        if span and span.get_span_context().is_valid:
            return format(span.get_span_context().trace_id, "032x")
    except Exception:
        pass
    return ""


def _trace_id_patcher(record) -> None:
    """loguru patcher: 在每条日志 record 上注入 trace_id 字段 (建议 88).

    排障时按 trace_id grep 即可串联该请求的所有日志, 与 OTel trace 对齐.
    建议 116: 同时注入 request_id / tenant_id / user_id, 日志可按租户/请求 ID 过滤.
    """
    try:
        extra = record.setdefault("extra", {})
        extra["trace_id"] = get_current_trace_id() or "-"
        rid = _current_request_id.get()
        extra["request_id"] = rid if rid else "-"
        tid = _current_tenant_id.get()
        extra["tenant_id"] = tid if tid else "-"
        uid = _current_user_id.get()
        extra["user_id"] = uid if uid else "-"
    except Exception:
        with contextlib.suppress(Exception):
            record["extra"] = {"trace_id": "-", "request_id": "-", "tenant_id": "-", "user_id": "-"}


def _json_sink(message) -> None:
    """建议 116: loguru JSON sink, 写 stderr (Loki Promtail 直接收集).

    message 是 loguru 包装的 record-like, 含 .record 属性.
    """
    import json as _json
    import sys as _sys

    try:
        record = message.record
        # level 可能是 RecordLevel 对象, 需用 .name 属性
        level_obj = record.get("level")
        level_name = level_obj.name if hasattr(level_obj, "name") else str(level_obj) if level_obj else "INFO"
        payload = {
            "time": record["time"].isoformat() if record.get("time") else "",
            "level": level_name,
            "module": record.get("name", ""),
            "func": record.get("function", ""),
            "line": record.get("line", 0),
            "message": record.get("message", ""),
        }
        # 业务串联字段 (从 _trace_id_patcher 注入的 extra)
        extra = record.get("extra", {}) or {}
        for k in ("trace_id", "request_id", "tenant_id", "user_id"):
            v = extra.get(k)
            if v and v != "-":
                payload[k] = v
        # 业务 bind 字段 (loguru logger.bind(engine=..., table=...))
        for k, v in extra.items():
            if k not in ("trace_id", "request_id", "tenant_id", "user_id"):
                payload[k] = v
        # 异常堆栈
        exc = record.get("exception")
        if exc and exc.get("type"):
            etype = exc.get("type")
            payload["exception_type"] = etype.__name__ if hasattr(etype, "__name__") else str(etype)
            payload["exception_value"] = str(exc.get("value", ""))
        _sys.stderr.write(_json.dumps(payload, ensure_ascii=False, default=str) + "\n")
        _sys.stderr.flush()
    except Exception as e:
        # 静默回退
        with contextlib.suppress(Exception):
            _sys.stderr.write(f'{{"level":"ERROR","message":"json sink failed: {e}"}}\n')


def setup_logging(level: str = "INFO", fmt: str = "") -> bool:
    """配置 loguru 输出, 自动注入 trace_id (建议 88) + request_id/tenant_id/user_id (建议 116).

    幂等: 重复调用不会重复加 sink.
    格式 (默认 text):
        <时间> | <级别> | <模块>:<行> | trace=<id> req=<id> tenant=<id> - <消息>
    格式 (ZHS_LOG_FORMAT=json):
        {"time":"...","level":"INFO","message":"...","trace_id":"...","request_id":"...","tenant_id":"...","user_id":"..."}
    """
    global _LOGGING_INSTALLED
    if _LOGGING_INSTALLED:
        return True
    if not fmt:
        fmt = os.getenv("ZHS_LOG_FORMAT", "text").lower()
    try:
        logger.remove()
        if fmt == "json":
            # 建议 116: Loki / Grafana JSON 格式 (用 sink 函数避免 format 模板报错)
            logger.add(
                _json_sink,
                level=level,
                backtrace=False,
                diagnose=False,
                colorize=False,
                serialize=False,
            )
        else:
            # 人类可读 (本地调试用)
            logger.add(
                sys.stderr,
                level=level,
                format=(
                    "<green>{time:HH:mm:ss.SSS}</green> | "
                    "<level>{level: <7}</level> | "
                    "<cyan>{name}</cyan>:<cyan>{function}</cyan>:<cyan>{line}</cyan> | "
                    "trace=<magenta>{extra[trace_id]}</magenta> | "
                    "req=<cyan>{extra[request_id]}</cyan> | "
                    "tenant=<yellow>{extra[tenant_id]}</yellow> | "
                    "<level>{message}</level>"
                ),
                backtrace=False,
                diagnose=False,
                colorize=True,
            )
        # loguru 0.7.x 必须用 configure(patcher=...) 才会全局生效
        logger.configure(
            extra={"trace_id": "-", "request_id": "-", "tenant_id": "-", "user_id": "-"},
            patcher=_trace_id_patcher,
        )
        _LOGGING_INSTALLED = True
        return True
    except Exception as e:
        # 静默回退: 至少不阻塞业务
        with contextlib.suppress(Exception):
            sys.stderr.write(f"[telemetry] setup_logging failed: {e}\n")
        return False


def trace_business(name: str | None = None, attributes: dict | None = None) -> Callable:
    """装饰器: 为同步/异步业务函数打 span.

    用法:
        @trace_business("payment.process", {"biz.type": "payment"})
        async def process_payment(order_id: str):
            ...
    """

    def _decorator(func: Callable) -> Callable:
        span_name = name or f"biz.{func.__module__}.{func.__qualname__}"

        @functools.wraps(func)
        async def _async_wrapper(*args, **kwargs):
            if not _ENABLED:
                return await func(*args, **kwargs)
            from opentelemetry import trace

            tracer = trace.get_tracer("zhs-platform.biz")
            # 建议 92: 自动注入 user.id / endpoint / tenant.id (业务 attributes 优先于 context)
            merged_attrs = {**_request_context_attributes(), **(attributes or {})}
            with tracer.start_as_current_span(span_name, attributes=merged_attrs) as span:
                try:
                    result = await func(*args, **kwargs)
                    span.set_status(trace.Status(trace.StatusCode.OK))
                    return result
                except Exception as e:
                    span.record_exception(e)
                    span.set_status(trace.Status(trace.StatusCode.ERROR, str(e)))
                    raise

        @functools.wraps(func)
        def _sync_wrapper(*args, **kwargs):
            if not _ENABLED:
                return func(*args, **kwargs)
            from opentelemetry import trace

            tracer = trace.get_tracer("zhs-platform.biz")
            merged_attrs = {**_request_context_attributes(), **(attributes or {})}
            with tracer.start_as_current_span(span_name, attributes=merged_attrs) as span:
                try:
                    result = func(*args, **kwargs)
                    span.set_status(trace.Status(trace.StatusCode.OK))
                    return result
                except Exception as e:
                    span.record_exception(e)
                    span.set_status(trace.Status(trace.StatusCode.ERROR, str(e)))
                    raise

        if asyncio.iscoroutinefunction(func):
            return _async_wrapper
        return _sync_wrapper

    return _decorator


def setup_console_exporter() -> bool:
    """本地调试模式: 启用 console exporter, span 打印到 stdout (无 OTLP 也能看)."""
    global _ENABLED, _TRACER
    try:
        from opentelemetry import trace
        from opentelemetry.sdk.resources import Resource
        from opentelemetry.sdk.trace import TracerProvider
        from opentelemetry.sdk.trace.export import BatchSpanProcessor, ConsoleSpanExporter

        service_name = os.getenv("ZHS_PLATFORM_SERVICE_NAME", "zhs-platform")
        resource = Resource.create({"service.name": service_name, "service.version": "1.0.0"})
        sampler = _build_sampler()
        provider = TracerProvider(resource=resource, sampler=sampler)
        provider.add_span_processor(BatchSpanProcessor(ConsoleSpanExporter()))
        trace.set_tracer_provider(provider)
        _TRACER = trace.get_tracer("zhs-platform")
        _ENABLED = True
        logger.info(f"OpenTelemetry CONSOLE exporter enabled (service={service_name})")
        return True
    except Exception as e:
        logger.warning(f"console exporter init failed: {e}")
        return False


# ---------------------------------------------------------------------------
# 建议 93: 端点感知采样器 -- 健康检查不采样, 业务全采样
# ---------------------------------------------------------------------------

# 健康检查类端点 -- 命中即不采样
_HEALTHCHECK_PREFIXES = (
    "/health",
    "/healthz",
    "/ready",
    "/readyz",
    "/live",
    "/livez",
    "/metrics",
    "/favicon.ico",
    "/static/",
    "/docs",
    "/openapi.json",
    "/ws/heartbeat",
)
# 始终 100% 采样的端点 -- 含业务关键字
_BUSINESS_KEYWORDS = ("/api/", "/pay", "/order", "/reconcile", "/notice", "/ws/")


def _is_healthcheck_path(path: str) -> bool:
    p = (path or "").lower().split("?", 1)[0]
    return any(p.startswith(prefix) for prefix in _HEALTHCHECK_PREFIXES)


class EndpointAwareSampler:
    """端点感知采样器 (建议 93):
    - 健康检查端点 → 0 采样 (DROP, 不消耗 exporter 配额)
    - 业务端点 → 100% 采样 (RECORD_AND_SAMPLE)
    - 其它端点 → 按 ZHS_OTEL_SAMPLE_RATIO 比率采样
    """

    def __init__(self, business_ratio: float = 1.0, other_ratio: float = 0.1):
        self.business_ratio = max(0.0, min(1.0, business_ratio))
        self.other_ratio = max(0.0, min(1.0, other_ratio))

    def should_sample(self, parent_context, trace_id, name=None, attributes=None, links=None):
        from opentelemetry.sdk.trace.sampling import (
            Decision,
            SamplingResult,
        )

        # 拿 endpoint attribute (TraceIdMiddleware / FastAPI instrument 会注入)
        path = ""
        if attributes and "endpoint" in attributes:
            endpoint_str = str(attributes.get("endpoint", ""))
            # endpoint 格式: "METHOD /path"
            parts = endpoint_str.split(" ", 1)
            if len(parts) == 2:
                path = parts[1]
        elif attributes and "http.target" in attributes:
            path = str(attributes["http.target"])

        if path and _is_healthcheck_path(path):
            return SamplingResult(Decision.DROP)

        # 业务端点 100% 采样
        if path and any(kw in path.lower() for kw in _BUSINESS_KEYWORDS):
            ratio = self.business_ratio
        else:
            ratio = self.other_ratio

        if ratio >= 1.0:
            return SamplingResult(Decision.RECORD_AND_SAMPLE)
        if ratio <= 0.0:
            return SamplingResult(Decision.DROP)

        # ratio-based: 末位字节小于 ratio*256 视为采样
        if (trace_id & 0xFF) < int(ratio * 256):
            return SamplingResult(Decision.RECORD_AND_SAMPLE)
        return SamplingResult(Decision.DROP)

    def get_description(self) -> str:
        return f"EndpointAwareSampler(business={self.business_ratio}, " f"other={self.other_ratio})"


def _build_sampler():
    """从 env 构建采样器. 默认: 业务 100%, 其它 10%."""
    from opentelemetry.sdk.trace.sampling import TraceIdRatioBased

    business = float(os.getenv("ZHS_OTEL_SAMPLE_BUSINESS", "1.0"))
    other = float(os.getenv("ZHS_OTEL_SAMPLE_RATIO", "0.1"))
    if business >= 1.0 and other >= 1.0:
        # 全采样时退化为默认 ratio=1, 减少代码路径
        return TraceIdRatioBased(1.0)
    return EndpointAwareSampler(business_ratio=business, other_ratio=other)


class TraceIdMiddleware:
    """ASGI middleware: 注入 X-Trace-Id response header.

    用法:
        app.add_middleware(TraceIdMiddleware)

    即使 telemetry 未启用, header 也会用 uuid4 填充, 便于联调.
    """

    def __init__(self, app):
        self.app = app

    async def __call__(self, scope, receive, send):
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        # 建议 92: 把 endpoint 写入 contextvar, 下游 span 自动继承
        try:
            path = scope.get("path", "")
            method = scope.get("method", "")
            if path:
                set_request_context(endpoint=f"{method} {path}")
        except Exception:
            pass

        # 拿 trace_id (优先 OTel, 否则 uuid4)
        trace_id = get_current_trace_id()
        if not trace_id:
            import uuid

            trace_id = uuid.uuid4().hex

        async def send_with_header(message):
            if message["type"] == "http.response.start":
                headers = list(message.get("headers", []))
                headers.append((b"x-trace-id", trace_id.encode("latin-1")))
                message["headers"] = headers
            await send(message)

        await self.app(scope, receive, send_with_header)


def setup_telemetry(app=None, engines=None):
    """初始化 OpenTelemetry SDK, 自动埋点 FastAPI/SQLAlchemy/Redis/httpx.

    - 服务名: ZHS_PLATFORM_SERVICE_NAME (默认 zhs-platform)
    - OTLP endpoint: OTEL_EXPORTER_OTLP_ENDPOINT (默认空 → console exporter 调试)
    - 采样率: ZHS_OTEL_SAMPLE_RATIO / ZHS_OTEL_SAMPLE_BUSINESS (由 _build_sampler 读取)

    失败时静默回退 (APM 是可观测性增强, 不应阻塞业务).
    """
    global _ENABLED, _TRACER

    service_name = os.getenv("ZHS_PLATFORM_SERVICE_NAME", "zhs-platform")
    use_console = os.getenv("OTEL_CONSOLE_EXPORTER", "0") == "1"

    # 三种模式: 显式 console / 显式 OTLP / 都没设 → console
    if not _is_otlp_set() and not use_console:
        logger.info("OTLP endpoint not set, telemetry disabled (设 OTEL_CONSOLE_EXPORTER=1 启用 console)")
        return None

    try:
        from opentelemetry import trace
        from opentelemetry.sdk.resources import Resource
        from opentelemetry.sdk.trace import TracerProvider
        from opentelemetry.sdk.trace.export import BatchSpanProcessor

        resource = Resource.create({"service.name": service_name, "service.version": "1.0.0"})
        # 建议 93: 端点感知采样器 (健康检查 0, 业务 100%, 其它 10%)
        provider = TracerProvider(
            resource=resource,
            sampler=_build_sampler(),
        )

        if _is_otlp_set():
            try:
                from opentelemetry.exporter.otlp.proto.grpc.trace_exporter import OTLPSpanExporter

                endpoint = os.getenv("OTEL_EXPORTER_OTLP_ENDPOINT")
                insecure = os.getenv("OTEL_EXPORTER_OTLP_INSECURE", "1") == "1"
                exporter = OTLPSpanExporter(endpoint=endpoint, insecure=insecure)
                provider.add_span_processor(BatchSpanProcessor(exporter))
                logger.info(f"OTLP exporter enabled: endpoint={endpoint}")
            except Exception as e:
                logger.warning(f"OTLP exporter init failed, fallback to console: {e}")
                from opentelemetry.sdk.trace.export import ConsoleSpanExporter

                provider.add_span_processor(BatchSpanProcessor(ConsoleSpanExporter()))
        else:
            from opentelemetry.sdk.trace.export import ConsoleSpanExporter

            provider.add_span_processor(BatchSpanProcessor(ConsoleSpanExporter()))
            logger.info("CONSOLE exporter enabled (debug mode)")

        trace.set_tracer_provider(provider)
        _TRACER = trace.get_tracer("zhs-platform")

        # 自动埋点
        if app is not None:
            try:
                from opentelemetry.instrumentation.fastapi import FastAPIInstrumentor

                FastAPIInstrumentor.instrument_app(app)
            except Exception as e:
                logger.debug(f"FastAPI instrument skipped: {e}")
            # 注入 X-Trace-Id header middleware
            try:
                app.add_middleware(TraceIdMiddleware)
            except Exception as e:
                logger.debug(f"TraceIdMiddleware install failed: {e}")

        if engines:
            try:
                from opentelemetry.instrumentation.sqlalchemy import SQLAlchemyInstrumentor

                for eng in engines.values():
                    with contextlib.suppress(Exception):
                        SQLAlchemyInstrumentor().instrument(engine=eng)
            except Exception as e:
                logger.debug(f"SQLAlchemy instrument skipped: {e}")

        # Redis
        try:
            from opentelemetry.instrumentation.redis import RedisInstrumentor

            RedisInstrumentor().instrument()
        except Exception:
            pass
        # httpx (调用外部 API 时)
        try:
            from opentelemetry.instrumentation.httpx import HTTPXClientInstrumentor

            HTTPXClientInstrumentor().instrument()
        except Exception:
            pass
        # 日志关联 trace_id
        try:
            from opentelemetry.instrumentation.logging import LoggingInstrumentor

            LoggingInstrumentor().instrument(set_logging_format=True)
        except Exception:
            pass

        _ENABLED = True
        logger.info(f"OpenTelemetry enabled: service={service_name}")
        return _TRACER
    except Exception as e:
        logger.warning(f"OpenTelemetry init failed: {e}")
        return None
