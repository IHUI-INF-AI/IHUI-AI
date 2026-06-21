"""建议 119 - Grafana 告警规则 (Prometheus + Loki) 单元测试.

调用 scripts/ci/check_biz_alerts.py 的所有 check_* 函数, 每个用例独立 PASS.
"""

import sys
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))
sys.path.insert(0, str(ROOT / "scripts"))

# 导入校验脚本模块, 让 check_* 函数可被 pytest 单独调用
import importlib.util

spec = importlib.util.spec_from_file_location(
    "check_biz_alerts",
    ROOT / "scripts" / "ci" / "check_biz_alerts.py",
)
mod = importlib.util.module_from_spec(spec)
spec.loader.exec_module(mod)


# ---------------------------------------------------------------------------
# 直接跑 check_* 函数 — 每个是独立 PASS
# ---------------------------------------------------------------------------


def test_prom_yaml_loads():
    mod.check_prom_yaml_loads()


def test_prom_groups_have_interval():
    mod.check_prom_groups_have_interval()


def test_prom_rules_have_required_fields():
    mod.check_prom_rules_have_required_fields()


def test_prom_expr_references_biz_metrics():
    mod.check_prom_expr_references_biz_metrics()


def test_prom_critical_alerts_exist():
    mod.check_prom_critical_alerts_exist()


def test_prom_no_duplicate_with_existing_rules():
    mod.check_prom_no_duplicate_with_existing_rules()


def test_loki_yaml_loads():
    mod.check_loki_yaml_loads()


def test_loki_groups_have_interval():
    mod.check_loki_groups_have_interval()


def test_loki_rules_have_required_fields():
    mod.check_loki_rules_have_required_fields()


def test_loki_expr_references_zhs_jobs():
    mod.check_loki_expr_references_zhs_jobs()


def test_loki_security_alerts_exist():
    mod.check_loki_security_alerts_exist()


def test_alertmanager_has_critical_route():
    mod.check_alertmanager_has_critical_route()


def test_alertmanager_receivers_defined():
    mod.check_alertmanager_receivers_defined()


def test_prom_uses_tenant_id_label():
    mod.check_prom_uses_tenant_id_label()


def test_prom_uses_request_id_label():
    mod.check_prom_uses_request_id_label()


def test_prom_shadow_traffic_alerts():
    mod.check_prom_shadow_traffic_alerts()


def test_prom_alert_density():
    mod.check_prom_alert_density()


def test_loki_alert_density():
    mod.check_loki_alert_density()


# ---------------------------------------------------------------------------
# 额外: 文件存在性 + 内容 smoke
# ---------------------------------------------------------------------------


def test_prom_alerts_file_exists():
    assert (ROOT / "deploy" / "grafana" / "alerts" / "zhs-biz-alerts.yml").exists()


def test_loki_alerts_file_exists():
    assert (ROOT / "deploy" / "grafana" / "alerts" / "loki-biz-alerts.yml").exists()


def test_prom_alerts_has_biz_5xx():
    """Prom 规则必须含 ZHSBiz5xxHigh (业务 5xx 1% 阈值)."""
    import yaml

    data = yaml.safe_load((ROOT / "deploy" / "grafana" / "alerts" / "zhs-biz-alerts.yml").read_text(encoding="utf-8"))
    names = [r["alert"] for g in data["groups"] for r in g["rules"] if "alert" in r]
    assert "ZHSBiz5xxHigh" in names
    assert "ZHSBiz4xxHigh" in names


def test_prom_alerts_has_tenant_isolation_group():
    """必须有 zhs-biz-tenant-isolation.rules group."""
    import yaml

    data = yaml.safe_load((ROOT / "deploy" / "grafana" / "alerts" / "zhs-biz-alerts.yml").read_text(encoding="utf-8"))
    group_names = [g["name"] for g in data["groups"]]
    assert "zhs-biz-tenant-isolation.rules" in group_names


def test_prom_alerts_has_shadow_traffic_group():
    """必须有 zhs-biz-shadow-traffic.rules group (建议 120 配合)."""
    import yaml

    data = yaml.safe_load((ROOT / "deploy" / "grafana" / "alerts" / "zhs-biz-alerts.yml").read_text(encoding="utf-8"))
    group_names = [g["name"] for g in data["groups"]]
    assert "zhs-biz-shadow-traffic.rules" in group_names


def test_loki_alerts_has_cross_tenant():
    """Loki 规则必须有 ZHSCrossTenantAccessLog 跨租户告警."""
    import yaml

    data = yaml.safe_load((ROOT / "deploy" / "grafana" / "alerts" / "loki-biz-alerts.yml").read_text(encoding="utf-8"))
    names = [r["alert"] for g in data["groups"] for r in g["rules"] if "alert" in r]
    assert "ZHSCrossTenantAccessLog" in names
    assert "ZHSUnauthorizedTenantAttempt" in names


def test_loki_alerts_has_log_pipeline_group():
    """Loki 规则必须有 log-pipeline 健康度 group."""
    import yaml

    data = yaml.safe_load((ROOT / "deploy" / "grafana" / "alerts" / "loki-biz-alerts.yml").read_text(encoding="utf-8"))
    group_names = [g["name"] for g in data["groups"]]
    assert "zhs-biz-log-pipeline.rules" in group_names


# ---------------------------------------------------------------------------
# alertmanager 路由 smoke
# ---------------------------------------------------------------------------


def test_alertmanager_routes_cover_severity():
    """alertmanager 路由应同时支持 critical / warning."""
    import yaml

    p = ROOT / "deploy" / "helm" / "zhs-platform" / "prometheus" / "alertmanager.yml"
    if not p.exists():
        pytest.skip("alertmanager.yml 缺失")
    data = yaml.safe_load(p.read_text(encoding="utf-8"))
    sevs = set()
    for r in data.get("route", {}).get("routes", []):
        sev = r.get("match", {}).get("severity")
        if sev:
            sevs.add(sev)
    assert "critical" in sevs


def test_alertmanager_has_webhook_receivers():
    """receiver 必须有 webhook 配置."""
    import yaml

    p = ROOT / "deploy" / "helm" / "zhs-platform" / "prometheus" / "alertmanager.yml"
    if not p.exists():
        pytest.skip("alertmanager.yml 缺失")
    data = yaml.safe_load(p.read_text(encoding="utf-8"))
    receivers = data.get("receivers", [])
    assert receivers, "缺 receivers"
    for r in receivers:
        assert (
            "webhook_configs" in r or "wechat_configs" in r or "email_configs" in r
        ), f"receiver {r['name']} 缺通知 channel"


# ---------------------------------------------------------------------------
# 校验脚本 CLI 可执行
# ---------------------------------------------------------------------------


def test_check_biz_alerts_cli_runs():
    """check_biz_alerts.py 自身 CLI 跑通."""
    import subprocess

    result = subprocess.run(
        [sys.executable, str(ROOT / "scripts" / "ci" / "check_biz_alerts.py")],
        capture_output=True,
        text=True,
        timeout=30,
    )
    assert result.returncode == 0, f"CLI 失败: {result.stdout}\n{result.stderr}"
    assert "passed" in result.stdout


# ---------------------------------------------------------------------------
# Yaml 格式 smoke (排除 PromQL annotation 的 {{ ... }} Go template 语法)
# ---------------------------------------------------------------------------


def test_prom_alerts_yaml_no_env_var_leftover():
    """YAML 不应含未渲染的 shell 变量占位符 ${...}."""
    text = (ROOT / "deploy" / "grafana" / "alerts" / "zhs-biz-alerts.yml").read_text(encoding="utf-8")
    assert "${" not in text, "YAML 含未渲染的 shell 变量占位符 ${...}"


def test_loki_alerts_yaml_no_env_var_leftover():
    text = (ROOT / "deploy" / "grafana" / "alerts" / "loki-biz-alerts.yml").read_text(encoding="utf-8")
    assert "${" not in text, "YAML 含未渲染的 shell 变量占位符 ${...}"
