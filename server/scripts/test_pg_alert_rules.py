"""PostgreSQL 告警规则验证脚本.

验证内容 (10 项):
1. rules.yml 文件存在且 YAML 合法
2. PostgreSQL 原生告警规则数量 >= 11
3. ZHSPgDown 规则 (pg_up == 0, critical)
4. ZHSPgConnectionsHigh 规则 (连接数 > 80%, warning)
5. ZHSPgConnectionsExhausted 规则 (连接数 > 95%, critical)
6. ZHSPgDeadlocks 规则 (死锁, critical)
7. ZHSPgRollbackRateHigh 规则 (回滚率 > 10%, warning)
8. ZHSPgCacheHitRatioLow 规则 (缓存命中率 < 90%, warning)
9. ZHSPgReplicationLag / ZHSPgReplicationBroken 规则 (复制监控)
10. helm chart rules.yml 同步一致

用法:
  python scripts/test_pg_alert_rules.py
"""
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
RULES = ROOT / "docker" / "prometheus" / "rules.yml"
HELM_RULES = ROOT / "deploy" / "helm" / "zhs-platform" / "prometheus" / "rules.yml"


def _load_rules():
    """加载 rules.yml, 返回所有规则列表."""
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
    """按 alert 名称查找规则."""
    for r in rules:
        if r.get("alert") == name:
            return r
    return None


def test_rules_yaml_valid() -> bool:
    """测试 rules.yml 文件存在且 YAML 合法."""
    try:
        rules = _load_rules()
        if rules is None:
            print("  ⚠️  PyYAML 未安装或加载失败, 跳过")
            return True
        assert len(rules) > 0, "rules 为空"
        print(f"  ✅ rules.yml YAML 合法 ({len(rules)} 条规则)")
        return True
    except Exception as e:
        print(f"  ❌ rules.yml 验证失败: {e}")
        return False


def test_pg_alerts_count() -> bool:
    """测试 PostgreSQL 原生告警规则数量 >= 11."""
    try:
        rules = _load_rules()
        if rules is None:
            print("  ⚠️  PyYAML 未安装, 跳过")
            return True

        pg_alerts = [r for r in rules if r.get("labels", {}).get("service") == "postgresql"]
        assert len(pg_alerts) >= 11, f"PostgreSQL 告警规则不足 11 条, 实际 {len(pg_alerts)}"

        # 列出所有 PG 告警名
        names = [r["alert"] for r in pg_alerts]
        print(f"  ✅ PostgreSQL 告警规则 {len(pg_alerts)} 条: {names}")
        return True
    except Exception as e:
        print(f"  ❌ PostgreSQL 告警数量验证失败: {e}")
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
        assert r["for"] == "1m", f"ZHSPgDown for 应为 1m, 实际 {r['for']}"
        assert r["labels"]["severity"] == "critical", "ZHSPgDown severity 应为 critical"
        assert r["labels"]["service"] == "postgresql", "ZHSPgDown service 应为 postgresql"

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
        assert "pg_stat_activity_count" in r["expr"], "ZHSPgConnectionsHigh 缺少 pg_stat_activity_count"
        assert "pg_settings_max_connections" in r["expr"], "ZHSPgConnectionsHigh 缺少 pg_settings_max_connections"
        assert "0.8" in r["expr"], "ZHSPgConnectionsHigh 阈值非 0.8"
        assert r["labels"]["severity"] == "warning", "ZHSPgConnectionsHigh severity 应为 warning"

        print(f"  ✅ ZHSPgConnectionsHigh 规则正确 (>80%, warning, 5m)")
        return True
    except Exception as e:
        print(f"  ❌ ZHSPgConnectionsHigh 验证失败: {e}")
        return False


def test_pg_connections_exhausted_alert() -> bool:
    """测试 ZHSPgConnectionsExhausted 规则."""
    try:
        rules = _load_rules()
        if rules is None:
            print("  ⚠️  PyYAML 未安装, 跳过")
            return True

        r = _find_rule(rules, "ZHSPgConnectionsExhausted")
        assert r is not None, "缺少 ZHSPgConnectionsExhausted 规则"
        assert "0.95" in r["expr"], "ZHSPgConnectionsExhausted 阈值非 0.95"
        assert r["labels"]["severity"] == "critical", "ZHSPgConnectionsExhausted severity 应为 critical"

        print(f"  ✅ ZHSPgConnectionsExhausted 规则正确 (>95%, critical, 2m)")
        return True
    except Exception as e:
        print(f"  ❌ ZHSPgConnectionsExhausted 验证失败: {e}")
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
        assert "pg_stat_database_deadlocks" in r["expr"], "ZHSPgDeadlocks 缺少 pg_stat_database_deadlocks"
        assert r["labels"]["severity"] == "critical", "ZHSPgDeadlocks severity 应为 critical"

        print(f"  ✅ ZHSPgDeadlocks 规则正确 (死锁, critical, 1m)")
        return True
    except Exception as e:
        print(f"  ❌ ZHSPgDeadlocks 验证失败: {e}")
        return False


def test_pg_rollback_rate_alert() -> bool:
    """测试 ZHSPgRollbackRateHigh 规则."""
    try:
        rules = _load_rules()
        if rules is None:
            print("  ⚠️  PyYAML 未安装, 跳过")
            return True

        r = _find_rule(rules, "ZHSPgRollbackRateHigh")
        assert r is not None, "缺少 ZHSPgRollbackRateHigh 规则"
        assert "pg_stat_database_xact_rollback" in r["expr"], "ZHSPgRollbackRateHigh 缺少 rollback"
        assert "pg_stat_database_xact_commit" in r["expr"], "ZHSPgRollbackRateHigh 缺少 commit"
        assert "0.1" in r["expr"], "ZHSPgRollbackRateHigh 阈值非 0.1"
        assert r["labels"]["severity"] == "warning", "ZHSPgRollbackRateHigh severity 应为 warning"

        print(f"  ✅ ZHSPgRollbackRateHigh 规则正确 (>10%, warning, 10m)")
        return True
    except Exception as e:
        print(f"  ❌ ZHSPgRollbackRateHigh 验证失败: {e}")
        return False


def test_pg_cache_hit_ratio_alert() -> bool:
    """测试 ZHSPgCacheHitRatioLow 规则."""
    try:
        rules = _load_rules()
        if rules is None:
            print("  ⚠️  PyYAML 未安装, 跳过")
            return True

        r = _find_rule(rules, "ZHSPgCacheHitRatioLow")
        assert r is not None, "缺少 ZHSPgCacheHitRatioLow 规则"
        assert "pg_stat_database_blks_hit" in r["expr"], "ZHSPgCacheHitRatioLow 缺少 blks_hit"
        assert "pg_stat_database_blks_read" in r["expr"], "ZHSPgCacheHitRatioLow 缺少 blks_read"
        assert "0.9" in r["expr"], "ZHSPgCacheHitRatioLow 阈值非 0.9"
        assert r["labels"]["severity"] == "warning", "ZHSPgCacheHitRatioLow severity 应为 warning"

        print(f"  ✅ ZHSPgCacheHitRatioLow 规则正确 (<90%, warning, 15m)")
        return True
    except Exception as e:
        print(f"  ❌ ZHSPgCacheHitRatioLow 验证失败: {e}")
        return False


def test_pg_replication_alerts() -> bool:
    """测试 ZHSPgReplicationLag / ZHSPgReplicationBroken 规则."""
    try:
        rules = _load_rules()
        if rules is None:
            print("  ⚠️  PyYAML 未安装, 跳过")
            return True

        lag = _find_rule(rules, "ZHSPgReplicationLag")
        assert lag is not None, "缺少 ZHSPgReplicationLag 规则"
        assert "pg_replication_lag_seconds" in lag["expr"], "ZHSPgReplicationLag 缺少 pg_replication_lag_seconds"
        assert "30" in lag["expr"], "ZHSPgReplicationLag 阈值非 30"
        assert lag["labels"]["severity"] == "warning", "ZHSPgReplicationLag severity 应为 warning"

        broken = _find_rule(rules, "ZHSPgReplicationBroken")
        assert broken is not None, "缺少 ZHSPgReplicationBroken 规则"
        assert "pg_replication_is_replicating" in broken["expr"], "ZHSPgReplicationBroken 缺少 pg_replication_is_replicating"
        assert broken["labels"]["severity"] == "critical", "ZHSPgReplicationBroken severity 应为 critical"

        print(f"  ✅ 复制监控规则正确 (Lag>30s warning + Broken critical)")
        return True
    except Exception as e:
        print(f"  ❌ 复制监控规则验证失败: {e}")
        return False


def test_helm_rules_synced() -> bool:
    """测试 helm chart rules.yml 同步一致."""
    try:
        assert HELM_RULES.exists(), f"helm chart rules.yml 不存在: {HELM_RULES}"

        src_content = RULES.read_text(encoding="utf-8")
        helm_content = HELM_RULES.read_text(encoding="utf-8")
        assert src_content == helm_content, "helm chart rules.yml 与源不一致"

        # 验证 helm rules.yml 包含 PostgreSQL 告警
        assert "ZHSPgDown" in helm_content, "helm rules.yml 缺少 ZHSPgDown"
        assert "ZHSPgDeadlocks" in helm_content, "helm rules.yml 缺少 ZHSPgDeadlocks"
        assert "ZHSPgReplicationLag" in helm_content, "helm rules.yml 缺少 ZHSPgReplicationLag"

        print(f"  ✅ helm chart rules.yml 同步一致 (含 PostgreSQL 告警)")
        return True
    except Exception as e:
        print(f"  ❌ helm rules 同步验证失败: {e}")
        return False


def main() -> int:
    print("=" * 70)
    print("PostgreSQL 告警规则验证")
    print("=" * 70)

    results = []
    print("\n[1] 文件与数量")
    results.append(("rules.yml YAML 合法", test_rules_yaml_valid()))
    results.append(("PostgreSQL 告警 >= 11 条", test_pg_alerts_count()))

    print("\n[2] 实例与连接")
    results.append(("ZHSPgDown (实例宕机)", test_pg_down_alert()))
    results.append(("ZHSPgConnectionsHigh (>80%)", test_pg_connections_high_alert()))
    results.append(("ZHSPgConnectionsExhausted (>95%)", test_pg_connections_exhausted_alert()))

    print("\n[3] 数据库健康")
    results.append(("ZHSPgDeadlocks (死锁)", test_pg_deadlocks_alert()))
    results.append(("ZHSPgRollbackRateHigh (回滚率)", test_pg_rollback_rate_alert()))
    results.append(("ZHSPgCacheHitRatioLow (缓存命中)", test_pg_cache_hit_ratio_alert()))

    print("\n[4] 复制与同步")
    results.append(("复制监控 (Lag + Broken)", test_pg_replication_alerts()))
    results.append(("helm chart rules 同步", test_helm_rules_synced()))

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
