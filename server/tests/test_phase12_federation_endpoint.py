"""Phase 12 建议 2: 联邦指标 Federation Endpoint 验证."""

from __future__ import annotations

import sys
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "scripts" / "ops"))


def _has_fastapi() -> bool:
    try:
        import fastapi  # noqa: F401

        return True
    except ImportError:
        return False


@pytest.fixture()
def ep():
    """import federation_endpoint 模块 (干净状态)."""
    for m in ("federation_endpoint", "federation_metrics"):
        if m in sys.modules:
            del sys.modules[m]
    import federation_endpoint
    import federation_metrics

    # 重置 metrics
    federation_metrics._gauge_route.clear()
    federation_metrics._gauge_source_up.clear()
    federation_metrics._gauge_scrape_interval.clear()
    federation_metrics._counter_match._metrics.clear()
    return federation_endpoint


# ---------------------------------------------------------------------------
# parse_matchers
# ---------------------------------------------------------------------------


def test_parse_single_matcher(ep):
    """单个 matcher 解析."""
    result = ep.parse_matchers(['{__name__="zhs_federation_route"}'])
    assert result == [{"__name__": "zhs_federation_route"}]


def test_parse_multiple_matchers(ep):
    """多个 match[] 解析."""
    result = ep.parse_matchers(
        [
            '{__name__="zhs_federation_route"}',
            '{region="cn-east-1"}',
        ]
    )
    assert len(result) == 2


def test_parse_matcher_with_wildcard(ep):
    """通配符解析."""
    result = ep.parse_matchers(['{__name__="zhs_federation_*"}'])
    assert result == [{"__name__": "zhs_federation_*"}]


def test_parse_matcher_with_multiple_labels(ep):
    """多 label 解析."""
    result = ep.parse_matchers(['{__name__="x",region="cn-east-1",tenant="default"}'])
    assert result == [{"__name__": "x", "region": "cn-east-1", "tenant": "default"}]


def test_parse_matcher_invalid_brackets(ep):
    """无花括号必跳过."""
    result = ep.parse_matchers(['__name__="x"'])
    assert result == []


# ---------------------------------------------------------------------------
# _match_label_value
# ---------------------------------------------------------------------------


def test_match_label_exact(ep):
    """完全等值匹配."""
    assert ep._match_label_value(
        {"__name__": "zhs_route", "region": "cn-east-1"},
        {"__name__": "zhs_route"},
    )


def test_match_label_prefix_wildcard(ep):
    """尾部通配符匹配."""
    assert ep._match_label_value(
        {"__name__": "zhs_federation_route"},
        {"__name__": "zhs_federation_*"},
    )
    assert not ep._match_label_value(
        {"__name__": "other_metric"},
        {"__name__": "zhs_federation_*"},
    )


def test_match_label_suffix_wildcard(ep):
    """首部通配符匹配."""
    assert ep._match_label_value(
        {"region": "cn-east-1"},
        {"region": "*east-1"},
    )


def test_match_label_no_match(ep):
    """不匹配返回 False."""
    assert not ep._match_label_value(
        {"__name__": "x"},
        {"__name__": "y"},
    )


# ---------------------------------------------------------------------------
# _filter_series
# ---------------------------------------------------------------------------


def test_filter_series_empty_matchers_returns_all(ep):
    """无 matcher 必返回全部."""
    series = [{"name": "a", "labels": {}, "value": 1, "metric_type": "gauge"}]
    assert ep._filter_series(series, []) == series


def test_filter_series_by_name(ep):
    """按 name 过滤."""
    series = [
        {"name": "keep_me", "labels": {}, "value": 1, "metric_type": "gauge"},
        {"name": "skip_me", "labels": {}, "value": 2, "metric_type": "gauge"},
    ]
    out = ep._filter_series(series, [{"__name__": "keep_me"}])
    assert len(out) == 1
    assert out[0]["name"] == "keep_me"


def test_filter_series_or_logic(ep):
    """任一 matcher 匹配即保留 (or)."""
    series = [
        {"name": "a", "labels": {"region": "r1"}, "value": 1, "metric_type": "gauge"},
        {"name": "b", "labels": {"region": "r2"}, "value": 2, "metric_type": "gauge"},
        {"name": "c", "labels": {"region": "r3"}, "value": 3, "metric_type": "gauge"},
    ]
    out = ep._filter_series(series, [{"region": "r1"}, {"region": "r3"}])
    assert len(out) == 2
    names = {s["name"] for s in out}
    assert names == {"a", "c"}


# ---------------------------------------------------------------------------
# federate_filter
# ---------------------------------------------------------------------------


def test_federate_filter_returns_prometheus_text(ep):
    """federate_filter 必返回 Prometheus 文本格式."""
    import federation_metrics

    federation_metrics.init_route_gauges()
    out = ep.federate_filter(['{__name__="zhs_federation_route_tenant_to_region"}'])
    assert "# TYPE" in out
    assert "zhs_federation_route_tenant_to_region" in out


def test_federate_filter_with_wildcard(ep):
    """通配符过滤."""
    import federation_metrics

    federation_metrics.init_route_gauges()
    federation_metrics.update_source_up("cn-east-1", "prom:9090", up=True)
    out = ep.federate_filter(['{__name__="zhs_federation_*"}'])
    assert "zhs_federation_route_tenant_to_region" in out
    assert "zhs_federation_source_up" in out


def test_federate_filter_with_region_match(ep):
    """按 region 过滤."""
    import federation_metrics

    federation_metrics.init_route_gauges()
    out = ep.federate_filter(['{region="cn-east-1"}'])
    assert 'region="cn-east-1"' in out
    assert 'region="cn-north-1"' not in out


def test_federate_filter_empty_match(ep):
    """无匹配系列时返回注释."""
    out = ep.federate_filter(['{__name__="nonexistent_metric"}'])
    assert "无匹配 series" in out


# ---------------------------------------------------------------------------
# /federate 端点 (FastAPI)
# ---------------------------------------------------------------------------


def _has_fastapi_testclient() -> bool:
    try:
        from fastapi.testclient import TestClient  # noqa: F401

        return True
    except ImportError:
        return False


@pytest.mark.skipif(not _has_fastapi_testclient(), reason="fastapi.testclient 不可用")
def test_federate_endpoint_basic(ep):
    """/federate 端点 GET 必返回 200 + Prometheus 文本."""
    import federation_metrics
    from fastapi.testclient import TestClient

    if "federation_endpoint" in sys.modules:
        del sys.modules["federation_endpoint"]
    import federation_endpoint

    federation_metrics._gauge_route.clear()
    federation_metrics._gauge_source_up.clear()
    federation_metrics._gauge_scrape_interval.clear()
    federation_metrics._counter_match._metrics.clear()
    federation_metrics.init_route_gauges()

    client = TestClient(federation_endpoint.app)
    r = client.get("/federate", params={"match[]": '{__name__="zhs_federation_route_tenant_to_region"}'})
    assert r.status_code == 200
    assert "zhs_federation_route_tenant_to_region" in r.text


@pytest.mark.skipif(not _has_fastapi_testclient(), reason="fastapi.testclient 不可用")
def test_federate_endpoint_no_match_400(ep):
    """无 match[] 必 400."""
    from fastapi.testclient import TestClient

    client = TestClient(ep.app)
    r = client.get("/federate")
    assert r.status_code == 400


@pytest.mark.skipif(not _has_fastapi_testclient(), reason="fastapi.testclient 不可用")
def test_federate_endpoint_multiple_matches(ep):
    """多个 match[] 必按 or 逻辑合并."""
    import federation_metrics
    from fastapi.testclient import TestClient

    federation_metrics._gauge_route.clear()
    federation_metrics._gauge_source_up.clear()
    federation_metrics._gauge_scrape_interval.clear()
    federation_metrics._counter_match._metrics.clear()
    federation_metrics.init_route_gauges()
    federation_metrics.update_source_up("cn-east-1", "prom:9090", up=True)

    client = TestClient(ep.app)
    r = client.get(
        "/federate",
        params=[
            ("match[]", '{__name__="zhs_federation_route_tenant_to_region"}'),
            ("match[]", '{__name__="zhs_federation_source_up"}'),
        ],
    )
    assert r.status_code == 200
    assert "zhs_federation_route_tenant_to_region" in r.text
    assert "zhs_federation_source_up" in r.text


@pytest.mark.skipif(not _has_fastapi_testclient(), reason="fastapi.testclient 不可用")
def test_healthz_endpoint(ep):
    """/healthz 必返回 200 + status=ok."""
    from fastapi.testclient import TestClient

    client = TestClient(ep.app)
    r = client.get("/healthz")
    assert r.status_code == 200
    assert r.json()["status"] == "ok"


@pytest.mark.skipif(not _has_fastapi_testclient(), reason="fastapi.testclient 不可用")
def test_federate_endpoint_404_metric(ep):
    """不存在的 metric 必返回空 + 注释."""
    import federation_metrics
    from fastapi.testclient import TestClient

    federation_metrics._gauge_route.clear()
    federation_metrics._gauge_source_up.clear()
    federation_metrics._gauge_scrape_interval.clear()
    federation_metrics._counter_match._metrics.clear()

    client = TestClient(ep.app)
    r = client.get("/federate", params={"match[]": '{__name__="nonexistent"}'})
    assert r.status_code == 200
    assert "无匹配 series" in r.text


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
