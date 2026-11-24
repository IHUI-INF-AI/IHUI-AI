# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""OpenTelemetry 分布式追踪（R74 P2 补建）。

与 apps/api 的 otel.ts 对齐：
- 通过 OTLP/HTTP 导出到 otel-collector / Jaeger
- 服务名 / 端点 / 采样率从 env 读取
- 未配置 OTEL_EXPORTER_OTLP_ENDPOINT 时降级为 no-op，不阻塞启动
- FastAPI 中间件为每个请求自动创建 span

依赖：opentelemetry-sdk / opentelemetry-exporter-otlp / opentelemetry-instrumentation-fastapi
"""

from __future__ import annotations

import hashlib
import logging
from typing import Any, cast

from fastapi import FastAPI, Request, Response

logger = logging.getLogger(__name__)

_initialized = False
_tracer: Any = None
# B1-11:日志通道是**独立**一条腿(OTLP /v1/logs)。untouched 时按 disabled 报,
# 建失败按 unjudged 点名 —— "没有日志通道"不等于"日志没丢"。
_log_provider: Any = None
_logs_state: str = "disabled"


def _opaque_subject(raw: Any) -> str:
    """把身份标识折成**不可逆 subject**(G-998111)。

    为什么必须折:span 属性会随 trace 一起落到追踪端与日志里,裸 userId 等于
    把可关联到自然人的标识复制到本该只见"行为"的地方。机制约定是
    `sha256(userId)` 的十六进制串(同类实现见
    `packages/services/src/zcode-agent/agentTelemetryEnv.ts`)——
    追踪端仍能把同一主体的多次 span 关联起来,但**无法反推是谁**。

    边界:
    - 空值不入 span(调用方已判),这里不做兜底。
    - 折叠成一个固定宽度(64 位十六进制)输出,**不截断** —— 截断会降低关联精度,
      而这正是折哈希唯一还要保留的能力。
    - 落的是 `sha256` 的**十六进制文本**而非 `hexdigest()` 的同一字节,
      两者等价,选后者只是实现直白。
    """
    return hashlib.sha256(str(raw).encode("utf-8")).hexdigest()


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
        globals()["_logs_state"] = "disabled"
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

    endpoint = os.environ.get("OTEL_EXPORTER_OTLP_ENDPOINT", "http://localhost:8813")
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

    # B1-11:日志通道(独立端点 /v1/logs)。建不起来只降级点名,既不影响 trace 也不影响业务;
    # 批尺寸与字节界由 `services/otel_log_channels.py` 的常量与判据给出(SDK 侧用
    # BatchLogRecordProcessor 的默认上限,本层的"界"用作会话日志面自建批的判据)。
    global _log_provider, _logs_state
    try:
        from opentelemetry.exporter.otlp.proto.http._log_exporter import OTLPLogExporter
        from opentelemetry.sdk._logs import LoggerProvider
        from opentelemetry.sdk._logs.export import BatchLogRecordProcessor

        log_provider = LoggerProvider(resource=resource)
        log_provider.add_log_record_processor(
            BatchLogRecordProcessor(OTLPLogExporter(endpoint=f"{endpoint}/v1/logs"))
        )
        _log_provider = log_provider
        _logs_state = "enabled"
    except Exception as exc:  # noqa: BLE001 — 依赖缺失/版本不符都只降级点名,不静默假装有通道
        _logs_state = f"unjudged({type(exc).__name__})"
        logger.warning("[telemetry] 日志通道未建立（trace 通道不受影响）: %s", exc)

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

    2026-07-22 立：解析请求头 traceparent 关联 api 端 parent context，
    让 start_as_current_span 自动挂在 api 端 trace 树下（Jaeger 端到端调用链）。
    解析失败/无 traceparent 头时保持原行为（开 root span）。
    """
    if _tracer is None:
        return cast(Response, await call_next(request))

    import opentelemetry.trace as trace_api
    from opentelemetry.propagate import extract

    route = request.url.path
    method = request.method

    # 解析 W3C traceparent 头，关联 api 端 trace（parent context）。
    # extract 用注册的 propagator（默认含 tracecontext）解析 traceparent，
    # 返回包含 NonRecordingSpan(parent) 的 Context；非法/缺失时返回空 Context（开 root span）。
    # 2026-07-22 立：实现 api → ai-service 端到端 trace 关联（Jaeger 调用链）。
    traceparent_header = request.headers.get("traceparent")
    parent_context = extract({"traceparent": traceparent_header}) if traceparent_header else None

    with _tracer.start_as_current_span(
        f"{method} {route}",
        kind=trace_api.SpanKind.SERVER,
        context=parent_context,
    ) as span:
        span.set_attribute("http.request.method", method)
        span.set_attribute("http.route", route)

        # 注入用户/租户维度（与 JWTAuthMiddleware 解析的 payload 对齐）
        # G-998111(2026-10-04):身份只能以**不可读 subject**入 trace。
        # 原写法 `span.set_attribute("enduser.id", str(user_id))` 把裸 userId 直接放进 span,
        # 而机制要求的是 sha256(userId) 的十六进制 subject(同类写法见
        # packages/services/src/zcode-agent/agentTelemetryEnv.ts):Desktop 端原始账号只在
        # Host 凭据边界可见,Agent 与追踪端只能收到不可逆的 subject。
        user_id = getattr(request.state, "user_id", None)
        if user_id:
            span.set_attribute("enduser.id", _opaque_subject(user_id))
        tenant_id = request.headers.get("x-tenant-id")
        if tenant_id:
            span.set_attribute("tenant.id", tenant_id)

        # 关联 trace_id（TraceContextMiddleware 解析入 request.state，供 logger context 使用）
        trace_id = getattr(request.state, "trace_id", None)
        if trace_id:
            span.set_attribute("trace.id", trace_id)

        try:
            response = await call_next(request)
            span.set_attribute("http.response.status_code", response.status_code)
            if response.status_code >= 500:
                span.set_status(trace_api.Status(trace_api.StatusCode.ERROR))
            return cast(Response, response)
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


def telemetry_channel_states() -> dict[str, str]:
    """两条通道的现读状态(诊断用;不猜:未初始化 ⇒ disabled 明确写出来)。"""
    traces = "disabled"
    if _logs_state == "enabled" or _tracer is not None or _log_provider is not None:
        traces = "enabled"
    return {"traces": traces, "logs": _logs_state}


def _shutdown_log_provider() -> None:
    """日志通道优雅关闭(让 BatchLogRecordProcessor 把最后一批刷出去)。"""
    global _log_provider, _logs_state
    if _log_provider is None:
        return
    try:
        _log_provider.shutdown()
    except Exception as e:  # noqa: BLE001 — 关闭异常不掩盖进程退出
        logger.warning("[telemetry] 日志通道 shutdown 异常（忽略）: %s", e)
    finally:
        _log_provider = None


def shutdown_telemetry() -> None:
    """进程退出时优雅关闭 SDK，确保 span flush。"""
    global _tracer, _initialized
    _shutdown_log_provider()
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
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
