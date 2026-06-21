"""Phase 11 建议 2: 联邦路由指标暴露 (Prometheus gauge).

目的:
  把 tenant_to_region() 路由表 + 多 region 联邦状态
  暴露为 Prometheus 指标, 供自监控使用.

暴露的指标:
  zhs_federation_route_tenant_to_region{tenant_id, region} 1
    → 租户到 region 的路由关系 (gauge, 值为 1)

  zhs_federation_source_up{region, target} 1|0
    → 联邦来源 Prometheus 的可达性 (gauge, 由健康检查维护)

  zhs_federation_match_total{region, prefix} N
    → 各 region 联邦过来的指标前缀数 (counter, 由聚合层维护)

  zhs_federation_scrape_interval_seconds{region} N
    → 中心 Prometheus 抓取该 region 的间隔 (gauge)

用法:
  from prometheus_client import start_http_server
  from scripts.ops.federation_metrics import (
      init_route_gauges, update_source_up, inc_match, render_metrics
  )
  init_route_gauges()  # 启动时调用一次
  start_http_server(9105)  # 监听 9105
  render_metrics()  # 返回指标文本 (供 /metrics 端点)
"""

from __future__ import annotations

try:
    from prometheus_client import CollectorRegistry, Counter, Gauge, generate_latest
    from prometheus_client.exposition import CONTENT_TYPE_LATEST
except ImportError:  # 允许测试时不依赖 prometheus_client
    CollectorRegistry = None  # type: ignore
    Gauge = None  # type: ignore
    Counter = None  # type: ignore
    generate_latest = None  # type: ignore
    CONTENT_TYPE_LATEST = "text/plain; version=0.0.4"

# 复用 federation 路由表
import sys
from pathlib import Path

_ROOT = Path(__file__).resolve().parent.parent.parent
sys.path.insert(0, str(_ROOT / "scripts" / "ops"))

from verify_prometheus_federation import TENANT_REGION_MAP  # noqa: E402

# ---------------------------------------------------------------------------
# 1. 私有 registry (不污染默认全局, 便于测试隔离)
# ---------------------------------------------------------------------------

REGISTRY = CollectorRegistry() if CollectorRegistry is not None else None

_gauge_route: Gauge | None = None
_gauge_source_up: Gauge | None = None
_counter_match: Counter | None = None
_gauge_scrape_interval: Gauge | None = None

if REGISTRY is not None:
    _gauge_route = Gauge(
        "zhs_federation_route_tenant_to_region",
        "Tenant to region routing (1=active)",
        ["tenant_id", "region"],
        registry=REGISTRY,
    )
    _gauge_source_up = Gauge(
        "zhs_federation_source_up",
        "Federation source Prometheus reachability (1=up, 0=down)",
        ["region", "target"],
        registry=REGISTRY,
    )
    _counter_match = Counter(
        "zhs_federation_match_total",
        "Total metrics federated from region by prefix",
        ["region", "prefix"],
        registry=REGISTRY,
    )
    _gauge_scrape_interval = Gauge(
        "zhs_federation_scrape_interval_seconds",
        "Center Prometheus scrape interval for this region (seconds)",
        ["region"],
        registry=REGISTRY,
    )


# ---------------------------------------------------------------------------
# 2. 初始化 / 更新
# ---------------------------------------------------------------------------


def init_route_gauges() -> int:
    """启动时调用一次, 把 TENANT_REGION_MAP 全部写入 gauge.

    Returns:
        写入的路由条数
    """
    if _gauge_route is None:
        return 0
    n = 0
    for tenant, region in TENANT_REGION_MAP.items():
        _gauge_route.labels(tenant_id=tenant, region=region).set(1)
        n += 1
    return n


def update_source_up(region: str, target: str, up: bool) -> None:
    """更新联邦源可达性 (供 healthz 端点调用)."""
    if _gauge_source_up is None:
        return
    _gauge_source_up.labels(region=region, target=target).set(1 if up else 0)


def inc_match(region: str, prefix: str, n: int = 1) -> None:
    """累加 region 的前缀匹配次数."""
    if _counter_match is None:
        return
    _counter_match.labels(region=region, prefix=prefix).inc(n)


def set_scrape_interval(region: str, seconds: float) -> None:
    """设置中心 Prometheus 对该 region 的抓取间隔."""
    if _gauge_scrape_interval is None:
        return
    _gauge_scrape_interval.labels(region=region).set(float(seconds))


def render_metrics() -> bytes:
    """渲染为 Prometheus 文本格式."""
    if generate_latest is None or REGISTRY is None:
        return b""
    return generate_latest(REGISTRY)


# ---------------------------------------------------------------------------
# 3. CLI
# ---------------------------------------------------------------------------


def main() -> int:
    n = init_route_gauges()
    print(f"[ok] 初始化 {n} 条租户路由 gauge")
    for region in ("cn-east-1", "cn-north-1", "cn-south-1"):
        update_source_up(region, f"prometheus-{region}:9090", up=True)
        set_scrape_interval(region, 15.0)
        for prefix in ("zhs_biz", "zhs_canary", "zhs_monitor"):
            inc_match(region, prefix, n=10)
    out = render_metrics().decode("utf-8")
    # 输出前 30 行
    for line in out.splitlines()[:30]:
        print(line)
    return 0


if __name__ == "__main__":
    sys.exit(main())
