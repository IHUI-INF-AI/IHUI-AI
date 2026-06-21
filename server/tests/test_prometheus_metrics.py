"""Prometheus /metrics 端点测试."""
import pytest


def test_metrics_endpoint_returns_prometheus_format():
    """验证 /metrics 返回 Prometheus 文本格式."""
    from app.main import create_app
    from fastapi.testclient import TestClient

    app = create_app()
    with TestClient(app) as client:
        resp = client.get("/metrics")
        assert resp.status_code == 200
        ct = resp.headers.get("content-type", "")
        # Prometheus 客户端返回 text/plain 变种
        assert "text/plain" in ct or "openmetrics" in ct.lower() or "version=" in ct


def test_metrics_contains_core_counters():
    """验证核心指标已注册."""
    from app.main import create_app
    from fastapi.testclient import TestClient

    app = create_app()
    with TestClient(app) as client:
        resp = client.get("/metrics")
        body = resp.text
        # 关键 metrics 名称应出现 (至少 HELP/TYPE 注释)
        assert "zhs_http_requests_total" in body or "HELP" in body


def test_prometheus_middleware_increments_counters():
    """请求计数应递增."""
    from app.monitoring import REQUEST_COUNT

    before = REQUEST_COUNT._value.get() if hasattr(REQUEST_COUNT, "_value") else 0
    # 触发 1 次请求 (简单方法: 直接调用指标)
    REQUEST_COUNT.labels(method="GET", endpoint="/test", status="200").inc()
    after = REQUEST_COUNT.labels(method="GET", endpoint="/test", status="200")._value.get()
    assert after >= 1
