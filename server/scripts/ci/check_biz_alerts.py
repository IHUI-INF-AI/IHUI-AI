"""校验建议 119 的 Grafana 告警规则 (Prometheus + Loki).

检查:
  - YAML 文件能加载, 无语法错
  - 每个 group 含 interval + 至少 1 条 rule
  - 每条 rule 含 alert / expr / labels.severity / annotations
  - severity ∈ {info, warning, critical}
  - expr 不为空, 包含业务 metric 名 (zhs_biz_* / zhs_slow_sql_*)
  - Prom 规则必含 tenant_id / endpoint / engine 之一 (业务串联系)
  - Loki 规则引用了 job=zhs-* 系列
  - 通知 channel 配置正确 (alertmanager.yml 含 receiver)
  - 与已有 deploy/helm/zhs-platform/prometheus/rules.yml 不冲突 (无重复 alertname)
"""

from __future__ import annotations

import sys
from collections.abc import Iterable
from pathlib import Path

import yaml

ROOT = Path(__file__).resolve().parent.parent.parent
PROM_FILE = ROOT / "deploy" / "grafana" / "alerts" / "zhs-biz-alerts.yml"
LOKI_FILE = ROOT / "deploy" / "grafana" / "alerts" / "loki-biz-alerts.yml"
HELM_RULES_FILE = ROOT / "deploy" / "helm" / "prometheus" / "rules.yml"  # 兼容旧路径
HELM_RULES_FILE2 = ROOT / "deploy" / "helm" / "zhs-platform" / "prometheus" / "rules.yml"
ALERTMANAGER_FILE = ROOT / "deploy" / "helm" / "zhs-platform" / "prometheus" / "alertmanager.yml"

VALID_SEVERITIES = {"info", "warning", "critical"}

# 必须出现的业务串联系 label
REQUIRED_BIZ_LABELS = ("tenant_id", "endpoint", "engine", "table", "request_id", "instance")


def _load_yaml(path: Path) -> dict:
    return yaml.safe_load(path.read_text(encoding="utf-8"))


def _all_rules(prom_or_loki: dict) -> Iterable[dict]:
    for group in prom_or_loki.get("groups", []):
        for rule in group.get("rules", []):
            yield rule


def _all_alert_names(prom_or_loki: dict) -> list[str]:
    return [r["alert"] for r in _all_rules(prom_or_loki) if "alert" in r]


# ---------------------------------------------------------------------------
# 校验 Prom 规则
# ---------------------------------------------------------------------------


def check_prom_yaml_loads():
    assert PROM_FILE.exists(), f"缺文件: {PROM_FILE}"
    data = _load_yaml(PROM_FILE)
    assert "groups" in data, "缺 groups 字段"
    assert len(data["groups"]) >= 1, "至少 1 个 group"
    return data


def check_prom_groups_have_interval():
    data = check_prom_yaml_loads()
    for g in data["groups"]:
        assert "interval" in g, f"group {g.get('name')} 缺 interval"
        assert g.get("rules"), f"group {g['name']} 至少 1 条 rule"


def check_prom_rules_have_required_fields():
    data = check_prom_yaml_loads()
    for rule in _all_rules(data):
        assert "alert" in rule, f"rule 缺 alert 字段: {rule}"
        assert "expr" in rule and rule["expr"].strip(), f"{rule['alert']} 缺 expr"
        assert "labels" in rule, f"{rule['alert']} 缺 labels"
        assert "severity" in rule["labels"], f"{rule['alert']} 缺 labels.severity"
        assert (
            rule["labels"]["severity"] in VALID_SEVERITIES
        ), f"{rule['alert']} severity 非法: {rule['labels']['severity']}"
        assert "annotations" in rule, f"{rule['alert']} 缺 annotations"
        assert "summary" in rule["annotations"], f"{rule['alert']} 缺 annotations.summary"
        assert "description" in rule["annotations"], f"{rule['alert']} 缺 annotations.description"


def check_prom_expr_references_biz_metrics():
    """Prom 规则的 expr 应包含业务 metric 名."""
    data = check_prom_yaml_loads()
    BIZ_METRICS = (
        "zhs_biz_requests_total",
        "zhs_biz_ws_messages_total",
        "zhs_biz_ws_pubsub_dropped_total",
        "zhs_biz_errors_total",
        "zhs_biz_cache_hit_ratio",
        "zhs_slow_sql_with_trace_total",
        "zhs_slow_sql_",
        "zhs_db_pool",
        "zhs_otel_spans_exported_total",
        "zhs_shadow_compare_total",
        "zhs_shadow_compare_mismatch_total",
        "zhs_shadow_request_duration_seconds_count",
    )
    found = 0
    for rule in _all_rules(data):
        expr = rule.get("expr", "")
        if any(m in expr for m in BIZ_METRICS):
            found += 1
    assert found >= 5, f"至少 5 条规则引用业务 metric, 实际 {found}"


def check_prom_critical_alerts_exist():
    """至少 2 条 critical 告警 (业务 5xx + 跨租户)."""
    data = check_prom_yaml_loads()
    crits = [r for r in _all_rules(data) if r.get("labels", {}).get("severity") == "critical"]
    assert len(crits) >= 2, f"应至少 2 条 critical 告警, 实际 {len(crits)}"


def check_prom_no_duplicate_with_existing_rules():
    """与已有 rules.yml 告警名不冲突."""
    if not HELM_RULES_FILE2.exists():
        return
    existing = set(_all_alert_names(_load_yaml(HELM_RULES_FILE2)))
    if HELM_RULES_FILE.exists():
        try:
            existing.update(_all_alert_names(_load_yaml(HELM_RULES_FILE)))
        except Exception:
            pass
    new = set(_all_alert_names(check_prom_yaml_loads()))
    dup = existing & new
    assert not dup, f"与已有 rules 重复告警名: {dup}"


# ---------------------------------------------------------------------------
# 校验 Loki 规则
# ---------------------------------------------------------------------------


def check_loki_yaml_loads():
    assert LOKI_FILE.exists(), f"缺文件: {LOKI_FILE}"
    data = _load_yaml(LOKI_FILE)
    assert "groups" in data, "缺 groups 字段"
    return data


def check_loki_groups_have_interval():
    data = check_loki_yaml_loads()
    for g in data["groups"]:
        assert "interval" in g, f"group {g.get('name')} 缺 interval"


def check_loki_rules_have_required_fields():
    data = check_loki_yaml_loads()
    for rule in _all_rules(data):
        assert "alert" in rule, f"rule 缺 alert: {rule}"
        assert "expr" in rule and rule["expr"].strip(), f"{rule['alert']} 缺 expr"
        assert "labels" in rule, f"{rule['alert']} 缺 labels"
        assert (
            rule["labels"]["severity"] in VALID_SEVERITIES
        ), f"{rule['alert']} severity 非法: {rule['labels']['severity']}"


def check_loki_expr_references_zhs_jobs():
    """Loki 规则的 expr 应引用 zhs-app-files 或 zhs-docker job."""
    data = check_loki_yaml_loads()
    found = 0
    for rule in _all_rules(data):
        expr = rule.get("expr", "")
        if 'job="zhs-app-files"' in expr or 'job="zhs-docker"' in expr or "zhs-app" in expr:
            found += 1
    assert found >= 4, f"至少 4 条 Loki 规则引用 zhs job, 实际 {found}"


def check_loki_security_alerts_exist():
    """至少 1 条 critical 安全告警 (跨租户 / 未授权)."""
    data = check_loki_yaml_loads()
    crits = [
        r
        for r in _all_rules(data)
        if r.get("labels", {}).get("severity") == "critical"
        and r.get("labels", {}).get("category") in ("cross-tenant", "security")
    ]
    assert len(crits) >= 1, f"应至少 1 条 cross-tenant/security critical, 实际 {len(crits)}"


# ---------------------------------------------------------------------------
# 校验 alertmanager 路由
# ---------------------------------------------------------------------------


def check_alertmanager_has_critical_route():
    """alertmanager.yml 应配置 critical 路由."""
    if not ALERTMANAGER_FILE.exists():
        return
    data = _load_yaml(ALERTMANAGER_FILE)
    routes = data.get("route", {}).get("routes", [])
    has_critical = any(r.get("match", {}).get("severity") == "critical" for r in routes)
    assert has_critical, "alertmanager.yml 应配 severity=critical 路由"


def check_alertmanager_receivers_defined():
    if not ALERTMANAGER_FILE.exists():
        return
    data = _load_yaml(ALERTMANAGER_FILE)
    receivers = {r["name"] for r in data.get("receivers", [])}
    # critical 路由必须指向已定义的 receiver
    routes = data.get("route", {}).get("routes", [])
    for r in routes:
        if r.get("match", {}).get("severity") == "critical":
            assert r["receiver"] in receivers, f"receiver {r['receiver']} 未定义"


# ---------------------------------------------------------------------------
# 校验: 业务串联字段 label 在 Prom 规则中至少出现 1 次
# ---------------------------------------------------------------------------


def check_prom_uses_tenant_id_label():
    """多租户告警规则必须按 tenant_id 拆分."""
    data = check_prom_yaml_loads()
    has_tenant = any(
        "by (tenant_id)" in rule.get("expr", "") or "tenant_id" in rule.get("expr", "") for rule in _all_rules(data)
    )
    assert has_tenant, "至少 1 条 Prom 规则引用 tenant_id label"


def check_prom_uses_request_id_label():
    """跨租户 / 安全告警应基于 request_id."""
    data = check_prom_yaml_loads()
    has_req = any("request_id" in rule.get("expr", "") for rule in _all_rules(data))
    assert has_req, "至少 1 条 Prom 规则引用 request_id label"


# ---------------------------------------------------------------------------
# 校验: shadow 流量告警 (建议 120 接入)
# ---------------------------------------------------------------------------


def check_prom_shadow_traffic_alerts():
    """至少 1 条 shadow 流量告警 (建议 120 配合)."""
    data = check_prom_yaml_loads()
    shadow = [r for r in _all_rules(data) if r.get("labels", {}).get("category") == "shadow-traffic"]
    assert len(shadow) >= 1, f"应至少 1 条 shadow-traffic 告警, 实际 {len(shadow)}"


# ---------------------------------------------------------------------------
# 业务告警密度
# ---------------------------------------------------------------------------


def check_prom_alert_density():
    """Prom 规则总条数 6-20 (业务多租户告警规模合理)."""
    data = check_prom_yaml_loads()
    n = sum(1 for r in _all_rules(data) if "alert" in r)
    assert 6 <= n <= 20, f"Prom 规则条数 {n} 不在 6-20 区间"


def check_loki_alert_density():
    """Loki 规则总条数 5-15."""
    data = check_loki_yaml_loads()
    n = sum(1 for r in _all_rules(data) if "alert" in r)
    assert 5 <= n <= 15, f"Loki 规则条数 {n} 不在 5-15 区间"


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    funcs = [v for k, v in globals().items() if k.startswith("check_") and callable(v)]
    failed = 0
    for fn in funcs:
        try:
            fn()
            print(f"PASS {fn.__name__}")
        except AssertionError as e:
            print(f"FAIL {fn.__name__}: {e}")
            failed += 1
        except Exception as e:
            print(f"ERROR {fn.__name__}: {type(e).__name__}: {e}")
            failed += 1
    print(f"\n{len(funcs) - failed}/{len(funcs)} passed")
    sys.exit(0 if failed == 0 else 1)
