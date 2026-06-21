"""Prometheus 告警规则 & Alertmanager 配置测试 (建议 86).

覆盖:
  - rules.yml 是合法 YAML, 能被 prometheus 加载
  - 每个 alert 都包含 expr / for / labels.severity / annotations
  - 关键告警 (DB pool / WS leak / Notice / Cache / Alembic / Job / Biz error) 全部存在
  - alertmanager.yml 是合法 YAML
  - alertmanager 路由含 critical / default receiver
  - sync 脚本能把 docker/ 的配置同步到 helm chart 内部 prometheus/ 目录
  - helm template 渲染 prometheus-rules-configmap.yaml 和 alertmanager-configmap.yaml
"""

import shutil
import subprocess
import sys
from pathlib import Path

import pytest
import yaml

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

REPO = ROOT
RULES_PATH = REPO / "docker" / "prometheus" / "rules.yml"
ALERTMANAGER_PATH = REPO / "docker" / "alertmanager" / "alertmanager.yml"
HELM_RULES = REPO / "deploy" / "helm" / "zhs-platform" / "prometheus" / "rules.yml"
HELM_ALERTMANAGER = REPO / "deploy" / "helm" / "zhs-platform" / "prometheus" / "alertmanager.yml"


# ---------------------------------------------------------------------------
# 基础 Yaml 解析
# ---------------------------------------------------------------------------


def test_rules_yaml_is_valid():
    with open(RULES_PATH, encoding="utf-8") as f:
        data = yaml.safe_load(f)
    assert "groups" in data
    assert len(data["groups"]) >= 1
    grp = data["groups"][0]
    assert "name" in grp
    assert "rules" in grp
    assert len(grp["rules"]) >= 1


def test_alertmanager_yaml_is_valid():
    with open(ALERTMANAGER_PATH, encoding="utf-8") as f:
        data = yaml.safe_load(f)
    assert "route" in data
    assert "receivers" in data
    assert isinstance(data["receivers"], list)
    assert len(data["receivers"]) >= 2  # 至少 default + critical


# ---------------------------------------------------------------------------
# 告警完整性
# ---------------------------------------------------------------------------


def _all_alerts():
    with open(RULES_PATH, encoding="utf-8") as f:
        data = yaml.safe_load(f)
    alerts = []
    for grp in data.get("groups", []):
        for rule in grp.get("rules", []):
            if "alert" in rule:
                alerts.append(rule)
    return alerts


def test_every_alert_has_required_fields():
    """每个告警必须包含 expr / for / labels.severity / annotations.summary."""
    alerts = _all_alerts()
    assert len(alerts) >= 10, f"告警数量过少 ({len(alerts)}), 预期 >= 10"
    bad = []
    for a in alerts:
        name = a.get("alert", "?")
        if "expr" not in a or not a["expr"]:
            bad.append((name, "missing expr"))
        if "for" not in a:
            bad.append((name, "missing for"))
        labels = a.get("labels", {})
        if "severity" not in labels:
            bad.append((name, "missing labels.severity"))
        ann = a.get("annotations", {})
        if "summary" not in ann:
            bad.append((name, "missing annotations.summary"))
    assert not bad, f"告警字段不完整: {bad}"


def test_severity_levels_in_use():
    """告警应使用多个 severity 级别 (critical / warning / info)."""
    alerts = _all_alerts()
    severities = {a.get("labels", {}).get("severity") for a in alerts}
    assert "critical" in severities, "应至少有一个 critical 告警"
    assert "warning" in severities, "应至少有一个 warning 告警"


# ---------------------------------------------------------------------------
# 关键告警存在性 (建议 86 新增)
# ---------------------------------------------------------------------------

REQUIRED_ALERTS_86 = {
    # DB 连接池 (建议 78)
    "ZHSDBPoolExhausted",
    "ZHSDBPoolCheckoutTimeouts",
    "ZHSDBPoolOverflowHigh",
    # WS 漏报 / 容量
    "ZHSWSLeak",
    "ZHSWSCapacityWarning",
    # Notice 推送
    "ZHSNoticePushFailure",
    # 缓存命中率
    "ZHSCacheHitRatioLow",
    # Alembic 迁移 (建议 79)
    "ZHSAlembicMigrationFailed",
    # 任务执行
    "ZHSJobFailed",
    # 业务异常
    "ZHSBizErrorSpike",
    # 审计缺失
    "ZHSAlembicAuditMissing",
}

REQUIRED_ALERTS_90 = {
    # 慢 SQL 串联 trace (建议 89 + 90)
    "ZHSSlowSQLWithTrace",
    "ZHSSlowSQLBurst",
    # DB pool 细粒度
    "ZHSDBPoolMultiEngineSaturated",
    "ZHSDBPoolInUseHighSingle",
    # WS 多实例
    "ZHSWSMultiInstanceLeak",
    # OTel 健康度 (建议 93)
    "ZHSOtelSampleRateZero",
    # 多租户预演 (建议 87)
    "ZHSTenantDominantTraffic",
}


def test_required_alerts_present():
    """建议 86 + 90 新增的关键告警必须存在."""
    alerts = _all_alerts()
    names = {a["alert"] for a in alerts}
    missing_86 = REQUIRED_ALERTS_86 - names
    assert not missing_86, f"建议 86 缺告警: {missing_86}"
    missing_90 = REQUIRED_ALERTS_90 - names
    assert not missing_90, f"建议 90 缺告警: {missing_90}"


def test_legacy_alerts_preserved():
    """原有告警 (建议 1-77) 应保留不被破坏."""
    legacy = {
        "ZHSHighErrorRate",
        "ZHSClientErrorSpike",
        "ZHSHighLatency",
        "ZHSVeryHighLatency",
        "ZHSSlowSQLSpike",
        "ZHSWebSocketOverload",
        "ZHSHighMemoryUsage",
        "ZHSHighCPU",
        "ZHSAppDown",
        "ZHSRedisDown",
    }
    names = {a["alert"] for a in _all_alerts()}
    missing = legacy - names
    assert not missing, f"原建议的告警被破坏: {missing}"


# ---------------------------------------------------------------------------
# PromQL 表达式合法性 (粗检: 包含指标名, 不空)
# ---------------------------------------------------------------------------


def test_alert_exprs_reference_business_metrics():
    """业务告警应引用 zhs_biz_* 指标 (建议 81 引入的)."""
    alerts = _all_alerts()
    biz_alerts = [a for a in alerts if "zhs_biz_" in a.get("expr", "")]
    assert len(biz_alerts) >= 4, f"业务告警过少 ({len(biz_alerts)}), 应至少 4 个"


def test_db_pool_alerts_use_new_gauges():
    """DB pool 告警应引用建议 78 新增的 5 个 gauge (zhs_db_pool_*)."""
    alerts = _all_alerts()
    pool_alerts = [
        a for a in alerts if a.get("alert", "").startswith("ZHSDBPool") and "zhs_db_pool_" in a.get("expr", "")
    ]
    assert len(pool_alerts) >= 3, f"DB pool 告警应至少 3 个, 实际 {len(pool_alerts)}"


# ---------------------------------------------------------------------------
# Alertmanager 路由
# ---------------------------------------------------------------------------


def test_alertmanager_routes_critical_separately():
    """critical 严重告警应有独立路由, 短 group_wait / repeat_interval."""
    with open(ALERTMANAGER_PATH, encoding="utf-8") as f:
        cfg = yaml.safe_load(f)
    routes = cfg.get("route", {}).get("routes", [])
    critical = [r for r in routes if r.get("match", {}).get("severity") == "critical"]
    assert critical, "应有 critical 级别独立路由"
    assert critical[0].get("group_wait", "30s") in ("10s",), "critical 告警应短 group_wait"


def test_alertmanager_has_webhook_receivers():
    """应配置至少一个 webhook 接收器."""
    with open(ALERTMANAGER_PATH, encoding="utf-8") as f:
        cfg = yaml.safe_load(f)
    receivers = cfg.get("receivers", [])
    webhook_rcv = [r for r in receivers if "webhook_configs" in r]
    assert webhook_rcv, "应至少一个 receiver 配置 webhook"


# ---------------------------------------------------------------------------
# 同步脚本
# ---------------------------------------------------------------------------


def test_sync_observability_copies_files():
    """sync_observability_config.py 应能成功把 docker/ 文件复制到 helm/prometheus/."""
    # 先清理目标, 模拟首次运行
    if HELM_RULES.exists():
        HELM_RULES.unlink()
    if HELM_ALERTMANAGER.exists():
        HELM_ALERTMANAGER.unlink()
    # 调用 sync 脚本
    r = subprocess.run(
        [sys.executable, str(ROOT / "scripts" / "ci" / "sync_observability_config.py")],
        capture_output=True,
        text=True,
        timeout=30,
    )
    assert r.returncode == 0, f"sync 失败: {r.stderr}"
    assert HELM_RULES.exists(), "rules.yml 未同步到 helm/prometheus/"
    assert HELM_ALERTMANAGER.exists(), "alertmanager.yml 未同步到 helm/prometheus/"
    # 内容应一致
    assert HELM_RULES.read_bytes() == RULES_PATH.read_bytes()
    assert HELM_ALERTMANAGER.read_bytes() == ALERTMANAGER_PATH.read_bytes()


# ---------------------------------------------------------------------------
# Helm 模板渲染 (使用 helm CLI; 缺失则 skip)
# ---------------------------------------------------------------------------


def test_helm_template_renders_prometheus_rules():
    """helm template 渲染 prometheus-rules-configmap.yaml 不应失败, 且应包含告警."""
    if not shutil.which("helm"):
        pytest.skip("helm CLI 未安装, 跳过渲染测试")
    r = subprocess.run(
        [
            "helm",
            "template",
            "zhs",
            str(REPO / "deploy" / "helm" / "zhs-platform"),
            "--show-only",
            "templates/prometheus-rules-configmap.yaml",
            "--namespace",
            "zhs",
        ],
        capture_output=True,
        text=True,
        timeout=60,
    )
    assert r.returncode == 0, f"helm template 失败: {r.stderr}"
    # 输出应包含 prometheus rules 内容
    assert "kind: ConfigMap" in r.stdout
    assert "zhs-platform.rules.yml" in r.stdout
    assert "ZHSDBPoolExhausted" in r.stdout, "DB pool 告警应被 helm 渲染出来"


def test_helm_template_renders_alertmanager():
    """helm template 渲染 alertmanager-configmap.yaml 不应失败."""
    if not shutil.which("helm"):
        pytest.skip("helm CLI 未安装, 跳过渲染测试")
    r = subprocess.run(
        [
            "helm",
            "template",
            "zhs",
            str(REPO / "deploy" / "helm" / "zhs-platform"),
            "--show-only",
            "templates/alertmanager-configmap.yaml",
            "--namespace",
            "zhs",
        ],
        capture_output=True,
        text=True,
        timeout=60,
    )
    assert r.returncode == 0, f"helm template 失败: {r.stderr}"
    assert "zhs-critical" in r.stdout, "alertmanager 路由应被 helm 渲染出来"
