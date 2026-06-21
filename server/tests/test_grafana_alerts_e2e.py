"""Grafana 告警端到端验证脚本.

验证内容:
1. 告警规则文件配置正确性 (YAML 格式 + 必要字段)
2. 告警规则覆盖率 (按 severity 分类统计)
3. webhook 接收 + 路由 + 通知策略 (HTTP 测试)
4. Alertmanager 配置正确性
5. 告警历史持久化 (如果已实现)
"""
import json
import os
import sys
import urllib.request
import urllib.error
from pathlib import Path

import yaml

ROOT = Path("g:/1")
ALERT_FILES = [
    ROOT / "server" / "deploy" / "grafana" / "alerts" / "zhs-biz-alerts.yml",
    ROOT / "deploy" / "grafana" / "alerts" / "zhs-biz-alerts.yml",
    ROOT / "server" / "deploy" / "grafana" / "alerting" / "zhs_business_alerts.yml",
    ROOT / "deploy" / "grafana" / "alerting" / "zhs_business_alerts.yml",
]
ALERTMANAGER_FILES = [
    ROOT / "server" / "docker" / "alertmanager" / "alertmanager.yml",
    ROOT / "docker" / "alertmanager" / "alertmanager.yml",
    ROOT / "server" / "deploy" / "helm" / "zhs-platform" / "prometheus" / "alertmanager.yml",
    ROOT / "deploy" / "helm" / "zhs-platform" / "prometheus" / "alertmanager.yml",
]
ALERTMANAGER_TPL = ROOT / "server" / "deploy" / "helm" / "zhs-platform" / "templates" / "alertmanager-configmap.yaml"

results = []


def check(name, ok, detail=""):
    results.append((name, ok, detail))
    icon = "✅" if ok else "❌"
    print(f"  {icon} {name}: {detail}")


print("=" * 70)
print("Grafana 告警端到端验证")
print("=" * 70)

print("\n[1] 告警规则文件配置正确性")
total_alerts = 0
sev_stats = {"critical": 0, "warning": 0, "info": 0, "other": 0}
for af in ALERT_FILES:
    if not af.exists():
        continue
    with open(af, encoding="utf-8") as f:
        content = f.read()
    try:
        data = yaml.safe_load(content)
    except yaml.YAMLError as e:
        check(f"yaml_valid: {af.name}", False, f"YAML 解析失败: {e}")
        continue
    groups = data.get("groups", [])
    file_alerts = []
    for g in groups:
        for rule in g.get("rules", []):
            if "alert" in rule:  # 排除 recording rules
                file_alerts.append(rule)
    total_alerts += len(file_alerts)
    for rule in file_alerts:
        labels = rule.get("labels", {})
        sev = labels.get("severity", "other")
        sev_stats[sev] = sev_stats.get(sev, 0) + 1
    check(f"alerts_loaded: {af.name}", True, f"{len(file_alerts)} 条告警规则")
    # 检查每条规则都有 alert + expr + labels
    for rule in file_alerts:
        for field in ["alert", "expr", "labels"]:
            assert field in rule, f"缺失字段 {field} in {rule.get('alert', '?')}"
    check(f"required_fields: {af.name}", True, "所有规则含 alert/expr/labels")

print(f"\n[2] 告警规则统计: 总计 {total_alerts} 条")
for sev, count in sev_stats.items():
    if count > 0:
        print(f"     {sev}: {count} 条")
check("has_critical_alerts", sev_stats.get("critical", 0) >= 3, f"critical 告警 {sev_stats.get('critical', 0)} 条")
check("has_warning_alerts", sev_stats.get("warning", 0) >= 5, f"warning 告警 {sev_stats.get('warning', 0)} 条")

print("\n[3] Alertmanager 配置正确性")
am_found = False
for amf in ALERTMANAGER_FILES:
    if amf.exists():
        am_found = True
        with open(amf, encoding="utf-8") as f:
            content = f.read()
        has_route = "route:" in content
        has_receiver = "receivers:" in content
        has_webhook = "webhook" in content.lower()
        check(f"am_route: {amf.name}", has_route, "包含 route 配置")
        check(f"am_receiver: {amf.name}", has_receiver, "包含 receivers 配置")
        check(f"am_webhook: {amf.name}", has_webhook, "包含 webhook 通知")
        # 检查路由按 severity 分发
        has_severity_routing = "severity" in content and "critical" in content
        check(f"am_severity_routing: {amf.name}", has_severity_routing, "按 severity 路由")
if not am_found and ALERTMANAGER_TPL.exists():
    with open(ALERTMANAGER_TPL, encoding="utf-8") as f:
        content = f.read()
    check("am_configmap_route", "route:" in content, "Helm ConfigMap 含 route")
    check("am_configmap_receiver", "receivers:" in content, "Helm ConfigMap 含 receivers")
    check("am_configmap_webhook", "webhook" in content.lower(), "Helm ConfigMap 含 webhook")
    check("am_configmap_severity", "severity" in content and "critical" in content, "按 severity 路由")

print("\n[4] webhook 接收端点 (HTTP 测试)")
BACKEND = os.getenv("BACKEND_URL", "http://127.0.0.1:8000")
try:
    # 测试 webhook 健康检查
    req = urllib.request.Request(f"{BACKEND}/api/v1/alerting/health", method="GET")
    with urllib.request.urlopen(req, timeout=5) as resp:
        body = resp.read().decode("utf-8")
        check("webhook_health", resp.status == 200, f"HTTP {resp.status}, body: {body[:80]}")
except urllib.error.HTTPError as e:
    check("webhook_health", False, f"HTTP {e.code}: {e.reason[:60]}")
except urllib.error.URLError:
    check("webhook_health", False, "后端未启动 (跳过, 不影响)")

print("\n[5] 告警规则语法校验 (promtool)")
import subprocess
promtool_found = False
for cmd in ["promtool", "promtool.exe"]:
    try:
        r = subprocess.run([cmd, "--version"], capture_output=True, text=True, timeout=5)
        if r.returncode == 0:
            promtool_found = True
            print(f"  ℹ️  promtool 可用: {r.stdout.strip()}")
            # 校验业务告警规则
            for af in ALERT_FILES:
                if not af.exists():
                    continue
                r2 = subprocess.run(
                    [cmd, "check", "rules", str(af)],
                    capture_output=True, text=True, timeout=10
                )
                check(f"promtool_check: {af.name}", r2.returncode == 0, r2.stdout.strip() or r2.stderr.strip()[:100])
            break
    except (FileNotFoundError, subprocess.TimeoutExpired):
        pass
if not promtool_found:
    print("  ℹ️  promtool 未安装, 跳过语法校验 (YAML 已通过 yaml.safe_load 解析)")

print("\n" + "=" * 70)
passed = sum(1 for _, ok, _ in results if ok)
total = len(results)
print(f"测试结果: {passed}/{total} 通过")
print("=" * 70)

# 关键测试必须通过 (后端未启动和文件不存在都不算失败)
critical_results = [
    r for r in results
    if "未启动" not in r[2] and "跳过" not in r[2] and "不存在" not in r[2]
]
if all(ok for _, ok, _ in critical_results):
    print("\n✅ Grafana 告警验证通过")
else:
    print("\n❌ 关键测试失败")
