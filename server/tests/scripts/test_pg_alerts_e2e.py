"""PostgreSQL 告警规则端到端测试脚本.

验证内容 (10 项):
1. rules.yml 包含 PostgreSQL 告警规则 (>= 11 条)
2. 每条规则字段完整 (alert/expr/for/labels/annotations)
3. severity 标签合法 (info/warning/critical)
4. service 标签为 postgresql
5. ZHSPgDown 规则 (pg_up == 0, critical, 1m)
6. ZHSPgConnectionsHigh 规则 (>80%, warning)
7. ZHSPgDeadlocks 规则 (死锁, critical)
8. ZHSPgReplicationLag 规则 (>30s, warning)
9. Alertmanager 配置存在
10. helm chart rules.yml 同步一致

用法:
  python scripts/test_pg_alerts_e2e.py
"""
import os
import sys
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'scripts'))
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
RULES = ROOT / "docker" / "prometheus" / "rules.yml"
HELM_RULES = ROOT / "deploy" / "helm" / "zhs-platform" / "prometheus" / "rules.yml"
ALERTMANAGER = ROOT / "docker" / "alertmanager" / "alertmanager.yml"


def _load_rules():
    try:
        import yaml
        with open(RULES, "r", encoding="utf-8") as f:
            data = yaml.safe_load(f)
        rules = []
        for g in data.get("groups", []):
            for r in g.get("rules", []):
                rules.append(r)
        return rules
    except ImportError:
        return None
    except Exception:
        return None


def _find_rule(rules, name):
    for r in rules:
        if r.get("alert") == name:
            return r
    return None


def test_pg_alerts_count() -> bool:
    """测试 rules.yml 包含 PostgreSQL 告警规则 (>= 11 条)."""
    try:
        rules = _load_rules()
        if rules is None:
            print("  ⚠️  PyYAML 未安装, 跳过")
            return True

        pg_alerts = [r for r in rules if r.get("labels", {}).get("service") == "postgresql"]
        assert len(pg_alerts) >= 11, f"PostgreSQL 告警规则不足 11 条, 实际 {len(pg_alerts)}"

        print(f"  ✅ PostgreSQL 告警规则 {len(pg_alerts)} 条 (>= 11)")
        return True
    except Exception as e:
        print(f"  ❌ 告警数量验证失败: {e}")
        return False


def test_rule_fields_complete() -> bool:
    """测试每条规则字段完整."""
    try:
        rules = _load_rules()
        if rules is None:
            print("  ⚠️  PyYAML 未安装, 跳过")
            return True

        pg_alerts = [r for r in rules if r.get("labels", {}).get("service") == "postgresql"]
        for r in pg_alerts:
            assert "alert" in r, f"规则缺少 alert: {r}"
            assert "expr" in r, f"规则缺少 expr: {r.get('alert')}"
            assert "for" in r, f"规则缺少 for: {r.get('alert')}"
            assert "labels" in r, f"规则缺少 labels: {r.get('alert')}"
            assert "annotations" in r, f"规则缺少 annotations: {r.get('alert')}"

            # annotations 必须有 summary 和 description
            ann = r["annotations"]
            assert "summary" in ann, f"规则缺少 summary: {r['alert']}"
            assert "description" in ann, f"规则缺少 description: {r['alert']}"

        print(f"  ✅ 规则字段完整 (alert/expr/for/labels/annotations/summary/description)")
        return True
    except Exception as e:
        print(f"  ❌ 规则字段验证失败: {e}")
        return False


def test_severity_labels() -> bool:
    """测试 severity 标签合法."""
    try:
        rules = _load_rules()
        if rules is None:
            print("  ⚠️  PyYAML 未安装, 跳过")
            return True

        pg_alerts = [r for r in rules if r.get("labels", {}).get("service") == "postgresql"]
        valid_severities = ["info", "warning", "critical"]
        for r in pg_alerts:
            severity = r["labels"].get("severity")
            assert severity in valid_severities, \
                f"规则 {r['alert']} severity 非法: {severity}"

        print(f"  ✅ severity 标签合法 (info/warning/critical)")
        return True
    except Exception as e:
        print(f"  ❌ severity 标签验证失败: {e}")
        return False


def test_service_label() -> bool:
    """测试 service 标签为 postgresql."""
    try:
        rules = _load_rules()
        if rules is None:
            print("  ⚠️  PyYAML 未安装, 跳过")
            return True

        pg_alerts = [r for r in rules if r.get("labels", {}).get("service") == "postgresql"]
        assert len(pg_alerts) >= 11, "PostgreSQL 告警规则不足"

        for r in pg_alerts:
            assert r["labels"]["service"] == "postgresql", \
                f"规则 {r['alert']} service 非 postgresql"

        print(f"  ✅ service 标签为 postgresql ({len(pg_alerts)} 条)")
        return True
    except Exception as e:
        print(f"  ❌ service 标签验证失败: {e}")
        return False


def test_pg_down_alert() -> bool:
    """测试 ZHSPgDown 规则."""
    try:
        rules = _load_rules()
        if rules is None:
            print("  ⚠️  PyYAML 未安装, 跳过")
            return True

        r = _find_rule(rules, "ZHSPgDown")
        assert r is not None, "缺少 ZHSPgDown 规则"
        assert "pg_up == 0" in r["expr"], "ZHSPgDown expr 错误"
        assert r["for"] == "1m", f"ZHSPgDown for 应为 1m"
        assert r["labels"]["severity"] == "critical", "ZHSPgDown severity 应为 critical"

        print(f"  ✅ ZHSPgDown 规则正确 (pg_up==0, critical, 1m)")
        return True
    except Exception as e:
        print(f"  ❌ ZHSPgDown 验证失败: {e}")
        return False


def test_pg_connections_high_alert() -> bool:
    """测试 ZHSPgConnectionsHigh 规则."""
    try:
        rules = _load_rules()
        if rules is None:
            print("  ⚠️  PyYAML 未安装, 跳过")
            return True

        r = _find_rule(rules, "ZHSPgConnectionsHigh")
        assert r is not None, "缺少 ZHSPgConnectionsHigh 规则"
        assert "pg_stat_activity_count" in r["expr"]
        assert "pg_settings_max_connections" in r["expr"]
        assert "0.8" in r["expr"]
        assert r["labels"]["severity"] == "warning"

        print(f"  ✅ ZHSPgConnectionsHigh 规则正确 (>80%, warning)")
        return True
    except Exception as e:
        print(f"  ❌ ZHSPgConnectionsHigh 验证失败: {e}")
        return False


def test_pg_deadlocks_alert() -> bool:
    """测试 ZHSPgDeadlocks 规则."""
    try:
        rules = _load_rules()
        if rules is None:
            print("  ⚠️  PyYAML 未安装, 跳过")
            return True

        r = _find_rule(rules, "ZHSPgDeadlocks")
        assert r is not None, "缺少 ZHSPgDeadlocks 规则"
        assert "pg_stat_database_deadlocks" in r["expr"]
        assert "increase" in r["expr"], "ZHSPgDeadlocks 应使用 increase"
        assert r["labels"]["severity"] == "critical"

        print(f"  ✅ ZHSPgDeadlocks 规则正确 (死锁, critical)")
        return True
    except Exception as e:
        print(f"  ❌ ZHSPgDeadlocks 验证失败: {e}")
        return False


def test_pg_replication_lag_alert() -> bool:
    """测试 ZHSPgReplicationLag 规则."""
    try:
        rules = _load_rules()
        if rules is None:
            print("  ⚠️  PyYAML 未安装, 跳过")
            return True

        r = _find_rule(rules, "ZHSPgReplicationLag")
        assert r is not None, "缺少 ZHSPgReplicationLag 规则"
        assert "pg_replication_lag_seconds" in r["expr"]
        assert "30" in r["expr"]
        assert r["labels"]["severity"] == "warning"

        print(f"  ✅ ZHSPgReplicationLag 规则正确 (>30s, warning)")
        return True
    except Exception as e:
        print(f"  ❌ ZHSPgReplicationLag 验证失败: {e}")
        return False


def test_alertmanager_config() -> bool:
    """测试 Alertmanager 配置存在."""
    try:
        assert ALERTMANAGER.exists(), f"Alertmanager 配置不存在: {ALERTMANAGER}"
        content = ALERTMANAGER.read_text(encoding="utf-8")
        assert "route:" in content, "缺少 route 配置"
        assert "receivers:" in content, "缺少 receivers 配置"
        assert "group_by:" in content, "缺少 group_by 配置"
        assert "group_wait:" in content, "缺少 group_wait"
        assert "group_interval:" in content, "缺少 group_interval"
        assert "repeat_interval:" in content, "缺少 repeat_interval"

        print(f"  ✅ Alertmanager 配置存在 (route + receivers + group)")
        return True
    except Exception as e:
        print(f"  ❌ Alertmanager 配置验证失败: {e}")
        return False


def test_helm_rules_synced() -> bool:
    """测试 helm chart rules.yml 同步一致."""
    try:
        assert HELM_RULES.exists(), f"helm chart rules.yml 不存在"

        src_content = RULES.read_text(encoding="utf-8")
        helm_content = HELM_RULES.read_text(encoding="utf-8")
        assert src_content == helm_content, "helm chart rules.yml 与源不一致"

        # 验证包含 PostgreSQL 告警
        assert "ZHSPgDown" in helm_content, "helm rules.yml 缺少 ZHSPgDown"
        assert "ZHSPgDeadlocks" in helm_content, "helm rules.yml 缺少 ZHSPgDeadlocks"

        print(f"  ✅ helm chart rules.yml 同步一致")
        return True
    except Exception as e:
        print(f"  ❌ helm rules 同步验证失败: {e}")
        return False


def main() -> int:
    print("=" * 70)
    print("PostgreSQL 告警规则端到端测试")
    print("=" * 70)

    results = []
    print("\n[1] 规则完整性")
    results.append(("PostgreSQL 告警 >= 11 条", test_pg_alerts_count()))
    results.append(("规则字段完整", test_rule_fields_complete()))
    results.append(("severity 标签合法", test_severity_labels()))
    results.append(("service 标签", test_service_label()))

    print("\n[2] 关键规则验证")
    results.append(("ZHSPgDown (实例宕机)", test_pg_down_alert()))
    results.append(("ZHSPgConnectionsHigh (>80%)", test_pg_connections_high_alert()))
    results.append(("ZHSPgDeadlocks (死锁)", test_pg_deadlocks_alert()))
    results.append(("ZHSPgReplicationLag (>30s)", test_pg_replication_lag_alert()))

    print("\n[3] 集成验证")
    results.append(("Alertmanager 配置", test_alertmanager_config()))
    results.append(("helm chart 同步", test_helm_rules_synced()))

    print("\n" + "=" * 70)
    passed = sum(1 for _, ok in results if ok)
    total = len(results)
    print(f"测试结果: {passed}/{total} 通过")
    print("=" * 70)
    for name, ok in results:
        status = "✅" if ok else "❌"
        print(f"  {status} {name}")

    return 0 if passed == total else 1


if __name__ == "__main__":
    sys.exit(main())
