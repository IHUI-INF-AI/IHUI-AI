"""Phase 10 建议 1: Prometheus Federation 多实例指标聚合验证.

目的:
  1. 验证 prometheus-federate.yml 含必要的 region/cluster external_labels
  2. 验证 prometheus-center.yml 含 3 个 region 的 federation 抓取
  3. 验证 honor_labels: true 保留子标签, 防止覆盖
  4. 验证 match[] 过滤规则覆盖 zhs_biz/zhs_canary/zhs_monitor
  5. 模拟 tenant 路由: 按 tenant_id 标签决定目标 region
  6. 模拟指标聚合: 多个 region 拉到的指标按 region 合并

不依赖真 Prometheus 进程, 纯 YAML 静态分析 + 内存模拟.
"""

from __future__ import annotations

import sys
from pathlib import Path
from urllib.parse import parse_qs, urlparse

import yaml

ROOT = Path(__file__).resolve().parent.parent.parent
FED_PATH = ROOT / "docker" / "prometheus" / "prometheus-federate.yml"
CENTER_PATH = ROOT / "docker" / "prometheus" / "prometheus-center.yml"

# Phase 10 建议 1: 租户区域路由表
# tenant_id → region (高 SLO 客户就近分配, 跨 region 容灾)
TENANT_REGION_MAP = {
    "default": "cn-east-1",
    "tenant_alpha": "cn-east-1",
    "tenant_beta": "cn-north-1",
    "tenant_premium": "cn-east-1",
    "tenant_oversea": "cn-south-1",
}


# ---------------------------------------------------------------------------
# 1. 配置静态校验
# ---------------------------------------------------------------------------


def _load(path: Path) -> dict:
    return yaml.safe_load(path.read_text(encoding="utf-8"))


def check_federate_source_config() -> list[str]:
    """校验子 Prometheus 配置 (federate 来源)."""
    errs = []
    cfg = _load(FED_PATH)
    ext = cfg.get("global", {}).get("external_labels", {})
    for k in ("region", "cluster", "role"):
        if k not in ext:
            errs.append(f"federate.yml global.external_labels 缺 {k}")
    if ext.get("role") != "federate-source":
        errs.append(f"federate.yml role 应为 federate-source, 实际 {ext.get('role')}")
    scrape_jobs = [j["job_name"] for j in cfg.get("scrape_configs", [])]
    if "zhs-platform" not in scrape_jobs:
        errs.append("federate.yml 缺 zhs-platform 抓取任务")
    return errs


def check_center_config() -> list[str]:
    """校验中心 Prometheus 配置 (federate 目标)."""
    errs = []
    cfg = _load(CENTER_PATH)
    ext = cfg.get("global", {}).get("external_labels", {})
    if ext.get("role") != "federate-target":
        errs.append(f"center.yml role 应为 federate-target, 实际 {ext.get('role')}")
    if ext.get("cluster") != "zhs-center":
        errs.append(f"center.yml cluster 应为 zhs-center, 实际 {ext.get('cluster')}")
    # 中心 Prometheus 不评估告警, rule_files 必空
    if cfg.get("rule_files"):
        errs.append(f"center.yml rule_files 必为空, 实际 {cfg.get('rule_files')}")
    # 验证 3 个 region federation 抓取
    jobs = cfg.get("scrape_configs", [])
    region_jobs = [j for j in jobs if j.get("job_name", "").startswith("federate-")]
    regions = {j["job_name"].replace("federate-", "") for j in region_jobs}
    expected = {"cn-east-1", "cn-north-1", "cn-south-1"}
    if regions != expected:
        errs.append(f"center.yml 缺少 region 抓取任务: 期望 {expected}, 实际 {regions}")
    # 验证 honor_labels: true
    for j in region_jobs:
        if not j.get("honor_labels"):
            errs.append(f"federate job {j['job_name']} 缺 honor_labels: true")
    # 验证 match[] 覆盖 zhs_biz / zhs_canary / zhs_monitor
    for j in region_jobs:
        matches = j.get("params", {}).get("match[]", [])
        joined = " ".join(matches)
        for prefix in ("zhs_biz", "zhs_canary", "zhs_monitor"):
            if prefix not in joined:
                errs.append(f"federate job {j['job_name']} match[] 缺 {prefix} 过滤")
    return errs


# ---------------------------------------------------------------------------
# 2. 内存模拟 federation 抓取 + tenant 路由
# ---------------------------------------------------------------------------


def build_federate_url(target: str, match_exprs: list[str]) -> str:
    """构造子 Prometheus /federate URL.

    实际调用:
      GET /federate?match[]={expr1}&match[]={expr2}
    """
    from urllib.parse import urlencode

    q = urlencode([("match[]", e) for e in match_exprs])
    return f"http://{target}/federate?{q}"


def parse_federate_url(url: str) -> list[str]:
    """从 URL 提取 match[] 参数."""
    parsed = urlparse(url)
    qs = parse_qs(parsed.query)
    return qs.get("match[]", [])


def tenant_to_region(tenant_id: str) -> str:
    """tenant_id → region 路由."""
    return TENANT_REGION_MAP.get(tenant_id, "cn-east-1")


def aggregate_by_region(metrics: dict[str, list[dict]]) -> dict[str, dict]:
    """把多个 region 拉到的指标按 region 聚合.

    Args:
        metrics: {region: [{name, value, labels}, ...]}

    Returns:
        {metric_name: {region: [values]}}
    """
    out: dict[str, dict[str, list]] = {}
    for region, samples in metrics.items():
        for s in samples:
            out.setdefault(s["name"], {}).setdefault(region, []).append(s["value"])
    return out


# ---------------------------------------------------------------------------
# 3. 主验证
# ---------------------------------------------------------------------------


def main() -> int:
    print("=" * 60)
    print("Phase 10 建议 1: Prometheus Federation 多实例聚合验证")
    print("=" * 60)
    errs = []
    errs += check_federate_source_config()
    errs += check_center_config()

    # 1. federate URL 构造 + 解析 round-trip
    url = build_federate_url(
        "prometheus-cn-east-1:9090",
        [
            '{__name__=~"zhs_biz_.*"}',
            '{__name__=~"zhs_canary_.*"}',
        ],
    )
    match_exprs = parse_federate_url(url)
    if len(match_exprs) != 2:
        errs.append(f"federate URL match[] 解析数量不对: {len(match_exprs)}")
    if "zhs_biz" not in match_exprs[0]:
        errs.append("federate URL match[0] 缺 zhs_biz 过滤")

    # 2. tenant 路由
    if tenant_to_region("default") != "cn-east-1":
        errs.append("default 租户路由错误")
    if tenant_to_region("tenant_oversea") != "cn-south-1":
        errs.append("tenant_oversea 路由错误")
    if tenant_to_region("unknown_tenant") != "cn-east-1":  # 缺省兜底
        errs.append("未知 tenant 缺省路由应回退 cn-east-1")

    # 3. 多 region 指标聚合
    metrics = {
        "cn-east-1": [
            {"name": "zhs_biz_app_clock_tz_offset_seconds", "value": 28800, "labels": {}},
            {"name": "zhs_canary_rollback_active_by_phase", "value": 0, "labels": {"phase": "canary"}},
        ],
        "cn-north-1": [
            {"name": "zhs_biz_app_clock_tz_offset_seconds", "value": 28800, "labels": {}},
        ],
        "cn-south-1": [
            {"name": "zhs_biz_app_clock_tz_offset_seconds", "value": 28800, "labels": {}},
            {"name": "zhs_canary_rollback_active_by_phase", "value": 1, "labels": {"phase": "feature_flag"}},
        ],
    }
    agg = aggregate_by_region(metrics)
    # tz_offset 在 3 个 region 都有, 应被聚合
    if len(agg["zhs_biz_app_clock_tz_offset_seconds"]) != 3:
        errs.append("tz_offset 应跨 3 region 聚合")
    # rollback_active_by_phase 在 2 个 region, 应被聚合
    if len(agg["zhs_canary_rollback_active_by_phase"]) != 2:
        errs.append("rollback_active_by_phase 应跨 2 region 聚合")

    if errs:
        print("[FAIL] Phase 10 建议 1 验证失败:")
        for e in errs:
            print(f"  - {e}")
        return 1
    print("[OK] Phase 10 建议 1 全部通过")
    print(f"  federate URL: {url[:80]}...")
    print(f"  match[] 解析: {len(match_exprs)} 条")
    print(f"  tenant 路由表: {len(TENANT_REGION_MAP)} 条")
    print(f"  聚合指标: {len(agg)} 个 metric, 跨 3 region")
    return 0


if __name__ == "__main__":
    sys.exit(main())
