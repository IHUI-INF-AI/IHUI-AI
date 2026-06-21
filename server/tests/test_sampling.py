"""trace 采样策略优化 (建议 93) 单元测试.

覆盖:
  - _is_healthcheck_path 正确识别 /healthz /metrics /favicon.ico 等
  - _is_healthcheck_path 业务端点返回 False
  - EndpointAwareSampler 默认 (business=1.0, other=0.1) 时:
    - /healthz 必返回 DROP
    - /api/pay 必返回 RECORD_AND_SAMPLE (业务 100%)
    - 其它端点 (如 /unknown) 命中 ~10% 比例
  - 全采样配置 (1.0, 1.0) 时全部 RECORD_AND_SAMPLE
  - 全 DROP 配置 (0.0, 0.0) 时全部 DROP
  - path attribute 取自 "endpoint" attribute (TraceIdMiddleware 注入的)
  - _build_sampler 从 env 读取
"""

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))


# ---------------------------------------------------------------------------
# _is_healthcheck_path
# ---------------------------------------------------------------------------


def test_is_healthcheck_path_known_prefixes():
    from app.telemetry import _is_healthcheck_path

    for p in (
        "/healthz",
        "/health",
        "/health/check",
        "/ready",
        "/readyz",
        "/metrics",
        "/favicon.ico",
        "/static/img.png",
        "/docs",
        "/openapi.json",
        "/ws/heartbeat",
    ):
        assert _is_healthcheck_path(p), f"{p} 应识别为健康检查"


def test_is_healthcheck_path_business_endpoints():
    from app.telemetry import _is_healthcheck_path

    for p in (
        "/api/order",
        "/api/pay",
        "/api/user/123",
        "/reconcile/alipay",
        "/notice/push",
        "/ws/chat",
        "/api/v1/products",
    ):
        assert not _is_healthcheck_path(p), f"{p} 不应是健康检查"


def test_is_healthcheck_path_handles_query_string():
    from app.telemetry import _is_healthcheck_path

    assert _is_healthcheck_path("/healthz?verbose=1")
    assert _is_healthcheck_path("/metrics?format=json")


def test_is_healthcheck_path_handles_empty():
    from app.telemetry import _is_healthcheck_path

    assert not _is_healthcheck_path("")
    assert not _is_healthcheck_path(None)


# ---------------------------------------------------------------------------
# EndpointAwareSampler
# ---------------------------------------------------------------------------


def _decision(sampler, path, trace_id):
    """调 sampler, 返回 Decision 枚举值."""

    attrs = {"endpoint": f"GET {path}"}
    result = sampler.should_sample(None, trace_id, name="test", attributes=attrs)
    return result.decision


def test_sampler_drops_healthcheck_paths():
    from opentelemetry.sdk.trace.sampling import Decision

    from app.telemetry import EndpointAwareSampler

    s = EndpointAwareSampler(business_ratio=1.0, other_ratio=1.0)
    for p in ("/healthz", "/metrics", "/favicon.ico", "/ready"):
        assert _decision(s, p, 0x1234) == Decision.DROP, f"{p} 应 DROP"


def test_sampler_samples_all_business_at_full_ratio():
    from opentelemetry.sdk.trace.sampling import Decision

    from app.telemetry import EndpointAwareSampler

    s = EndpointAwareSampler(business_ratio=1.0, other_ratio=0.1)
    for p in ("/api/order", "/api/pay", "/reconcile/alipay", "/ws/chat"):
        # 业务端点 100% 采样
        for tid in range(20):
            assert _decision(s, p, tid) == Decision.RECORD_AND_SAMPLE, f"{p} 业务端点应 RECORD, 实际 trace_id={tid}"


def test_sampler_other_paths_at_partial_ratio():
    from opentelemetry.sdk.trace.sampling import Decision

    from app.telemetry import EndpointAwareSampler

    s = EndpointAwareSampler(business_ratio=1.0, other_ratio=0.1)
    # 其它端点 (非健康/非业务), 命中 ~10%
    hits = 0
    total = 1000
    for tid in range(total):
        if _decision(s, "/unknown/random/path", tid) == Decision.RECORD_AND_SAMPLE:
            hits += 1
    # 10% 期望在 5-15% 之间 (留容差)
    ratio = hits / total
    assert 0.05 <= ratio <= 0.20, f"命中率应 ~10%, 实际 {ratio*100:.1f}%"


def test_sampler_zero_ratios_drop_all():
    from opentelemetry.sdk.trace.sampling import Decision

    from app.telemetry import EndpointAwareSampler

    s = EndpointAwareSampler(business_ratio=0.0, other_ratio=0.0)
    for p in ("/healthz", "/api/pay", "/unknown"):
        for tid in range(20):
            assert _decision(s, p, tid) == Decision.DROP


def test_sampler_full_ratios_sample_all():
    from opentelemetry.sdk.trace.sampling import Decision

    from app.telemetry import EndpointAwareSampler

    s = EndpointAwareSampler(business_ratio=1.0, other_ratio=1.0)
    for p in ("/api/pay", "/unknown"):
        # 业务全采, 其它全采
        for tid in range(20):
            assert _decision(s, p, tid) == Decision.RECORD_AND_SAMPLE
    # 但健康检查仍 DROP
    for p in ("/healthz", "/metrics"):
        for tid in range(20):
            assert _decision(s, p, tid) == Decision.DROP


def test_sampler_reads_http_target_attribute():
    """兼容 FastAPI instrument 注入的 http.target attribute."""
    from opentelemetry.sdk.trace.sampling import Decision

    from app.telemetry import EndpointAwareSampler

    s = EndpointAwareSampler(business_ratio=1.0, other_ratio=1.0)
    # 用 http.target 不用 endpoint
    result = s.should_sample(None, 0x1234, attributes={"http.target": "/healthz"})
    assert result.decision == Decision.DROP
    result = s.should_sample(None, 0x1234, attributes={"http.target": "/api/pay"})
    assert result.decision == Decision.RECORD_AND_SAMPLE


def test_sampler_handles_missing_path():
    """attributes 缺 endpoint / http.target 时不应抛异常."""
    from opentelemetry.sdk.trace.sampling import Decision

    from app.telemetry import EndpointAwareSampler

    s = EndpointAwareSampler(business_ratio=1.0, other_ratio=1.0)
    # 完全无 attributes
    result = s.should_sample(None, 0x1234, attributes=None)
    # 视为其它端点, 全采应 RECORD
    assert result.decision == Decision.RECORD_AND_SAMPLE


def test_sampler_description():
    from app.telemetry import EndpointAwareSampler

    s = EndpointAwareSampler(business_ratio=1.0, other_ratio=0.1)
    desc = s.get_description()
    assert "EndpointAwareSampler" in desc
    assert "business=1.0" in desc
    assert "other=0.1" in desc


# ---------------------------------------------------------------------------
# _build_sampler 集成
# ---------------------------------------------------------------------------


def test_build_sampler_full_sample_returns_trace_id_ratio(monkeypatch):
    """业务 + 其它都 100% 时, 返回 TraceIdRatioBased(1.0)."""
    from opentelemetry.sdk.trace.sampling import TraceIdRatioBased

    from app import telemetry

    monkeypatch.setenv("ZHS_OTEL_SAMPLE_BUSINESS", "1.0")
    monkeypatch.setenv("ZHS_OTEL_SAMPLE_RATIO", "1.0")
    monkeypatch.delenv("OTEL_TRACES_SAMPLER_ARG", raising=False)
    s = telemetry._build_sampler()
    assert isinstance(s, TraceIdRatioBased)


def test_build_sampler_partial_returns_endpoint_aware(monkeypatch):
    """其它比率 < 1 时, 返回 EndpointAwareSampler."""
    from app import telemetry

    monkeypatch.setenv("ZHS_OTEL_SAMPLE_BUSINESS", "1.0")
    monkeypatch.setenv("ZHS_OTEL_SAMPLE_RATIO", "0.1")
    s = telemetry._build_sampler()
    assert isinstance(s, telemetry.EndpointAwareSampler)
    assert s.business_ratio == 1.0
    assert s.other_ratio == 0.1


def test_build_sampler_default_ratios(monkeypatch):
    """无 env 时, 默认业务 100% / 其它 10%."""
    from app import telemetry

    monkeypatch.delenv("ZHS_OTEL_SAMPLE_BUSINESS", raising=False)
    monkeypatch.delenv("ZHS_OTEL_SAMPLE_RATIO", raising=False)
    s = telemetry._build_sampler()
    # 业务默认 1.0, 其它默认 0.1 → EndpointAwareSampler
    assert isinstance(s, telemetry.EndpointAwareSampler)
    assert s.business_ratio == 1.0
    assert abs(s.other_ratio - 0.1) < 1e-9


# ---------------------------------------------------------------------------
# 集成: 业务 span 真的被 sampler 处理
# ---------------------------------------------------------------------------


def test_business_span_recorded_under_endpoint_aware_sampler(monkeypatch):
    """业务 span 在 EndpointAwareSampler 下应 RECORD."""
    from opentelemetry import trace
    from opentelemetry.sdk.resources import Resource
    from opentelemetry.sdk.trace import TracerProvider
    from opentelemetry.sdk.trace.export import SimpleSpanProcessor
    from opentelemetry.sdk.trace.export.in_memory_span_exporter import InMemorySpanExporter

    from app import telemetry

    if hasattr(trace, "_TRACER_PROVIDER_SET_ONCE"):
        trace._TRACER_PROVIDER_SET_ONCE._done = False  # type: ignore[attr-defined]
    if hasattr(trace, "_TRACER_PROVIDER"):
        trace._TRACER_PROVIDER = None  # type: ignore[attr-defined]

    monkeypatch.setenv("ZHS_OTEL_SAMPLE_BUSINESS", "1.0")
    monkeypatch.setenv("ZHS_OTEL_SAMPLE_RATIO", "1.0")

    exporter = InMemorySpanExporter()
    provider = TracerProvider(
        resource=Resource.create({"service.name": "test-sampler"}), sampler=telemetry._build_sampler()
    )
    provider.add_span_processor(SimpleSpanProcessor(exporter))
    trace.set_tracer_provider(provider)
    telemetry._ENABLED = True

    try:
        telemetry.set_request_context(user_id="u-1", endpoint="GET /api/order")

        @telemetry.trace_business("biz.order")
        def place_order():
            return "ok"

        place_order()
        provider.force_flush()
        spans = exporter.get_finished_spans()
        assert len(spans) == 1, f"业务 span 应被采样, 实际: {len(spans)}"
    finally:
        telemetry._ENABLED = False
        telemetry.set_request_context(reset=True)
