"""Phase 11 建议 2: 联邦路由指标暴露 (Prometheus gauge) 验证."""

from __future__ import annotations

import sys
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "scripts" / "ops"))


def _has_prometheus_client() -> bool:
    try:
        import prometheus_client  # noqa: F401

        return True
    except ImportError:
        return False


pytestmark = pytest.mark.skipif(
    not _has_prometheus_client(),
    reason="prometheus_client 未安装, 跳过",
)


@pytest.fixture()
def fm():
    """导入 federation_metrics 模块."""
    import federation_metrics

    # 重置 counter 状态避免测试间污染
    if federation_metrics._counter_match is not None:
        federation_metrics._counter_match._metrics.clear()
    return federation_metrics


@pytest.fixture(autouse=True)
def _reset_gauges():
    """每个测试前清空 gauge 状态."""
    import federation_metrics

    if federation_metrics._gauge_route is not None:
        federation_metrics._gauge_route.clear()
    if federation_metrics._gauge_source_up is not None:
        federation_metrics._gauge_source_up.clear()
    if federation_metrics._gauge_scrape_interval is not None:
        federation_metrics._gauge_scrape_interval.clear()
    if federation_metrics._counter_match is not None:
        federation_metrics._counter_match._metrics.clear()
    yield


def test_init_route_gauges_writes_all_tenants(fm):
    """init_route_gauges 必写入所有 5 个 tenant."""
    n = fm.init_route_gauges()
    assert n == 5
    out = fm.render_metrics().decode("utf-8")
    # 5 个 tenant × 1 行
    assert out.count("zhs_federation_route_tenant_to_region{") == 5


def test_route_gauge_labels_contain_tenant_and_region(fm):
    """gauge labels 必含 tenant_id + region."""
    fm.init_route_gauges()
    out = fm.render_metrics().decode("utf-8")
    assert 'tenant_id="default"' in out
    assert 'tenant_id="tenant_premium"' in out
    assert 'region="cn-east-1"' in out
    assert 'region="cn-south-1"' in out


def test_route_gauge_value_is_one(fm):
    """活跃路由值 = 1."""
    fm.init_route_gauges()
    out = fm.render_metrics().decode("utf-8")
    assert 'zhs_federation_route_tenant_to_region{region="cn-east-1",tenant_id="default"} 1.0' in out


def test_source_up_gauge(fm):
    """source_up gauge 必能标记 up/down."""
    fm.update_source_up("cn-east-1", "prometheus-cn-east-1:9090", up=True)
    fm.update_source_up("cn-north-1", "prometheus-cn-north-1:9090", up=False)
    out = fm.render_metrics().decode("utf-8")
    assert 'region="cn-east-1",target="prometheus-cn-east-1:9090"} 1.0' in out
    assert 'region="cn-north-1",target="prometheus-cn-north-1:9090"} 0.0' in out


def test_source_up_can_be_toggled(fm):
    """source_up 状态可切换."""
    fm.update_source_up("cn-east-1", "prometheus:9090", up=True)
    out1 = fm.render_metrics().decode("utf-8")
    assert "} 1.0" in out1
    fm.update_source_up("cn-east-1", "prometheus:9090", up=False)
    out2 = fm.render_metrics().decode("utf-8")
    assert "} 0.0" in out2


def test_match_counter_accumulates(fm):
    """match counter 必能累加."""
    fm.inc_match("cn-east-1", "zhs_biz", n=5)
    fm.inc_match("cn-east-1", "zhs_biz", n=3)
    out = fm.render_metrics().decode("utf-8")
    assert 'prefix="zhs_biz",region="cn-east-1"} 8.0' in out


def test_match_counter_per_prefix(fm):
    """不同 prefix 各自独立计数."""
    fm.inc_match("cn-east-1", "zhs_biz", n=10)
    fm.inc_match("cn-east-1", "zhs_canary", n=2)
    out = fm.render_metrics().decode("utf-8")
    assert 'prefix="zhs_biz",region="cn-east-1"} 10.0' in out
    assert 'prefix="zhs_canary",region="cn-east-1"} 2.0' in out


def test_scrape_interval_gauge(fm):
    """scrape interval 必能设置."""
    fm.set_scrape_interval("cn-east-1", 15.0)
    fm.set_scrape_interval("cn-north-1", 30.0)
    out = fm.render_metrics().decode("utf-8")
    assert 'region="cn-east-1"} 15.0' in out
    assert 'region="cn-north-1"} 30.0' in out


def test_metrics_format_is_prometheus_text(fm):
    """输出格式必为 Prometheus 文本格式."""
    fm.init_route_gauges()
    fm.update_source_up("cn-east-1", "prom:9090", up=True)
    out = fm.render_metrics().decode("utf-8")
    # HELP / TYPE 必含
    assert "# HELP zhs_federation_route_tenant_to_region" in out
    assert "# TYPE zhs_federation_route_tenant_to_region gauge" in out
    assert "# HELP zhs_federation_source_up" in out
    assert "# TYPE zhs_federation_source_up gauge" in out
    assert "# TYPE zhs_federation_match_total counter" in out


def test_render_returns_bytes(fm):
    """render 必返回 bytes."""
    out = fm.render_metrics()
    assert isinstance(out, bytes)
    assert len(out) > 0


def test_e2e_3_regions_all_exposed(fm):
    """3 个 region 全部暴露路由+source_up+scrape_interval+match."""
    fm.init_route_gauges()
    for region in ("cn-east-1", "cn-north-1", "cn-south-1"):
        fm.update_source_up(region, f"prometheus-{region}:9090", up=True)
        fm.set_scrape_interval(region, 15.0)
        for prefix in ("zhs_biz", "zhs_canary", "zhs_monitor"):
            fm.inc_match(region, prefix, n=10)
    out = fm.render_metrics().decode("utf-8")
    for region in ("cn-east-1", "cn-north-1", "cn-south-1"):
        assert f'region="{region}"' in out
        assert f"prometheus-{region}:9090" in out
    # 3 region × 3 prefix = 9 条 match
    assert out.count("zhs_federation_match_total{") == 9


def test_uses_private_registry_not_global(fm):
    """必用私有 registry, 不污染默认."""
    from prometheus_client import REGISTRY as GLOBAL_REGISTRY

    metrics_global = list(GLOBAL_REGISTRY._collector_to_names.keys())
    out = fm.render_metrics().decode("utf-8")
    # 我们的指标在私有 registry, 不在 global
    assert "zhs_federation_route_tenant_to_region" in out
    assert "zhs_federation_route_tenant_to_region" not in str(metrics_global)


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
