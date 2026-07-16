"""OpenTelemetry 分布式追踪（R74 P2 补建）。

与 apps/api 的 otel.ts 对齐：
- 通过 OTLP/HTTP 导出到 otel-collector / Jaeger
- 服务名 / 端点 / 采样率从 env 读取
- 未配置 OTEL_EXPORTER_OTLP_ENDPOINT 时降级为 no-op，不阻塞启动
- FastAPI 中间件为每个请求自动创建 span

依赖：opentelemetry-sdk / opentelemetry-exporter-otlp / opentelemetry-instrumentation-fastapi
"""

from __future__ import annotations

import logging
from typing import Any

from fastapi import FastAPI, Request, Response

logger = logging.getLogger(__name__)

_initialized = False
_tracer: Any = None


def _should_enable() -> bool:
    """与 otel.ts 启用门控一致：OTEL_ENABLED=false 显式禁用；否则端点配置即启用。"""
    enabled = __import__("os").environ.get("OTEL_ENABLED", "").lower()
    if enabled == "false":
        return False
    if enabled == "true":
        return True
    return bool(__import__("os").environ.get("OTEL_EXPORTER_OTLP_ENDPOINT"))


def init_telemetry() -> Any | None:
    """初始化 OTel SDK（幂等）。未配置时返回 None（no-op，不报错）。"""
    global _initialized, _tracer

    if _initialized:
        return _tracer
    _initialized = True

    if not _should_enable():
        logger.info("[telemetry] OTel 未启用（未配置 OTEL_EXPORTER_OTLP_ENDPOINT），降级为 no-op")
        return None

    import os

    # 采样率默认 0.1（10%），与 otel.ts 保持一致
    if not os.environ.get("OTEL_TRACES_SAMPLER"):
        os.environ["OTEL_TRACES_SAMPLER"] = "traceidratio"
    if not os.environ.get("OTEL_TRACES_SAMPLER_ARG"):
        os.environ["OTEL_TRACES_SAMPLER_ARG"] = "0.1"

    from opentelemetry import trace
    from opentelemetry.exporter.otlp.proto.http.trace_exporter import OTLPSpanExporter
    from opentelemetry.sdk.resources import Resource
    from opentelemetry.sdk.trace import TracerProvider
    from opentelemetry.sdk.trace.export import BatchSpanProcessor

    endpoint = os.environ.get("OTEL_EXPORTER_OTLP_ENDPOINT", "http://localhost:4318")
    service_name = os.environ.get("OTEL_SERVICE_NAME", "@ihui/ai-service")

    resource = Resource.create(
        {
            "service.name": service_name,
            "service.version": "1.0.0",
        }
    )

    provider = TracerProvider(resource=resource)
    exporter = OTLPSpanExporter(endpoint=f"{endpoint}/v1/traces")
    provider.add_span_processor(BatchSpanProcessor(exporter))
    trace.set_tracer_provider(provider)

    _tracer = trace.get_tracer("ihui-ai-service")
    logger.info(
        "[telemetry] OTel 已启用：endpoint=%s service=%s sampler=%s/%s",
        endpoint,
        service_name,
        os.environ.get("OTEL_TRACES_SAMPLER"),
        os.environ.get("OTEL_TRACES_SAMPLER_ARG"),
    )
    return _tracer


async def telemetry_middleware(request: Request, call_next: Any) -> Response:
    """FastAPI 中间件：为每个请求创建 span，注入 user/tenant 维度。

    OTel 未启用时为 no-op（trace.get_tracer 返回 NoOpTracer）。
    """
    if _tracer is None:
        return await call_next(request)

    import opentelemetry.trace as trace_api

    route = request.url.path
    method = request.method

    with _tracer.start_as_current_span(
        f"{method} {route}",
        kind=trace_api.SpanKind.SERVER,
    ) as span:
        span.set_attribute("http.request.method", method)
        span.set_attribute("http.route", route)

        # 注入用户/租户维度（与 JWTAuthMiddleware 解析的 payload 对齐）
        user_id = getattr(request.state, "user_id", None)
        if user_id:
            span.set_attribute("enduser.id", str(user_id))
        tenant_id = request.headers.get("x-tenant-id")
        if tenant_id:
            span.set_attribute("tenant.id", tenant_id)

        try:
            response = await call_next(request)
            span.set_attribute("http.response.status_code", response.status_code)
            if response.status_code >= 500:
                span.set_status(trace_api.Status(trace_api.StatusCode.ERROR))
            return response
        except Exception as e:
            span.set_status(trace_api.Status(trace_api.StatusCode.ERROR, str(e)))
            span.record_exception(e)
            raise


def setup_telemetry(app: FastAPI) -> None:
    """注册 OTel 中间件到 FastAPI 应用。

    在 create_app() 中调用，确保所有请求都被追踪。
    """
    init_telemetry()
    app.middleware("http")(telemetry_middleware)


def shutdown_telemetry() -> None:
    """进程退出时优雅关闭 SDK，确保 span flush。"""
    global _tracer, _initialized
    if _tracer is None:
        return
    try:
        from opentelemetry import trace

        provider = trace.get_tracer_provider()
        if hasattr(provider, "shutdown"):
            provider.shutdown()
    except Exception as e:
        logger.warning("[telemetry] shutdown 异常（忽略）: %s", e)
    finally:
        _tracer = None
        _initialized = False
