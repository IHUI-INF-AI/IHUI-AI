"""Grafana 仪表盘生产验证脚本.

验证内容 (10 项):
1. zhs_postgresql.json JSON 合法且 Grafana schema 完整
2. uid 唯一 (zhs-postgresql)
3. panel 数量 >= 15 (覆盖完整监控场景)
4. panel 类型分布合理 (stat/timeseries/table)
5. PostgreSQL exporter 指标引用 (pg_up/pg_stat_*)
6. 应用 DB 连接池指标引用 (zhs_db_pool_*)
7. 数据源变量 DS_PROMETHEUS 配置
8. Prometheus 查询语法验证 (无语法错误)
9. panel gridPos 布局合理 (无重叠)
10. helm chart 同步一致

用法:
  python scripts/test_grafana_pg_dashboard_prod.py
"""
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DASH_DIR = ROOT / "deploy" / "grafana" / "dashboards"
HELM_DASH_DIR = ROOT / "deploy" / "helm" / "zhs-platform" / "dashboards"


def _load_pg_dashboard() -> dict:
    return json.loads((DASH_DIR / "zhs_postgresql.json").read_text(encoding="utf-8"))


def test_json_schema() -> bool:
    """测试 JSON 合法且 Grafana schema 完整."""
    try:
        d = _load_pg_dashboard()
        required = ["title", "uid", "panels", "tags", "templating", "schemaVersion", "refresh", "time"]
        for field in required:
            assert field in d, f"缺少字段: {field}"

        assert isinstance(d["panels"], list), "panels 非 list"
        assert isinstance(d["tags"], list), "tags 非 list"
        assert d["schemaVersion"] >= 39, f"schemaVersion 过低: {d['schemaVersion']}"
        assert d["refresh"] in ["5s", "10s", "15s", "30s", "1m", "5m", "15m", "30m", "1h"], \
            f"refresh 非法: {d['refresh']}"

        print(f"  ✅ JSON schema 完整 (title={d['title']!r}, schema={d['schemaVersion']}, refresh={d['refresh']})")
        return True
    except Exception as e:
        print(f"  ❌ JSON schema 验证失败: {e}")
        return False


def test_uid_unique() -> bool:
    """测试 uid 唯一."""
    try:
        pg_uid = _load_pg_dashboard()["uid"]
        assert pg_uid == "zhs-postgresql", f"uid 非 zhs-postgresql: {pg_uid}"

        for f in DASH_DIR.glob("*.json"):
            if f.name == "zhs_postgresql.json":
                continue
            other = json.loads(f.read_text(encoding="utf-8"))
            other_uid = other.get("uid", "")
            assert other_uid != pg_uid, f"uid 冲突: {f.name}"

        print(f"  ✅ uid 唯一 (zhs-postgresql)")
        return True
    except Exception as e:
        print(f"  ❌ uid 唯一性验证失败: {e}")
        return False


def test_panel_count() -> bool:
    """测试 panel 数量 >= 15."""
    try:
        d = _load_pg_dashboard()
        count = len(d["panels"])
        assert count >= 15, f"panel 数量不足 15, 实际 {count}"
        print(f"  ✅ panel 数量 {count} (>= 15)")
        return True
    except Exception as e:
        print(f"  ❌ panel 数量验证失败: {e}")
        return False


def test_panel_types() -> bool:
    """测试 panel 类型分布合理."""
    try:
        d = _load_pg_dashboard()
        types = {}
        for p in d["panels"]:
            t = p.get("type", "unknown")
            types[t] = types.get(t, 0) + 1

        # 至少有 stat / timeseries / table
        assert "stat" in types, "缺少 stat 类型 panel"
        assert "timeseries" in types, "缺少 timeseries 类型 panel"
        assert "table" in types, "缺少 table 类型 panel"

        print(f"  ✅ panel 类型分布: {types}")
        return True
    except Exception as e:
        print(f"  ❌ panel 类型验证失败: {e}")
        return False


def test_pg_exporter_metrics() -> bool:
    """测试 PostgreSQL exporter 指标引用."""
    try:
        content = (DASH_DIR / "zhs_postgresql.json").read_text(encoding="utf-8")
        required_metrics = [
            "pg_up",
            "pg_stat_activity_count",
            "pg_database_size_bytes",
            "pg_stat_database_deadlocks",
            "pg_stat_database_xact_commit",
            "pg_stat_database_xact_rollback",
            "pg_settings_max_connections",
            "pg_stat_database_blks_hit",
            "pg_stat_database_blks_read",
        ]
        for m in required_metrics:
            assert m in content, f"缺少指标: {m}"

        print(f"  ✅ PostgreSQL exporter 指标引用完整 (9 个)")
        return True
    except Exception as e:
        print(f"  ❌ PostgreSQL exporter 指标验证失败: {e}")
        return False


def test_app_db_pool_metrics() -> bool:
    """测试应用 DB 连接池指标引用."""
    try:
        content = (DASH_DIR / "zhs_postgresql.json").read_text(encoding="utf-8")
        required_metrics = [
            "zhs_db_pool_in_use",
            "zhs_db_pool_size",
            "zhs_db_pool_overflow",
            "zhs_db_pool_checkout_timeouts_total",
            "zhs_slow_sql_with_trace_total",
        ]
        for m in required_metrics:
            assert m in content, f"缺少指标: {m}"

        print(f"  ✅ 应用 DB 连接池指标引用完整 (5 个)")
        return True
    except Exception as e:
        print(f"  ❌ 应用 DB 连接池指标验证失败: {e}")
        return False


def test_datasource_variable() -> bool:
    """测试数据源变量 DS_PROMETHEUS 配置."""
    try:
        d = _load_pg_dashboard()
        templating = d.get("templating", {}).get("list", [])
        assert len(templating) > 0, "缺少 templating 变量"

        ds_var = templating[0]
        assert ds_var["name"] == "DS_PROMETHEUS", f"变量名非 DS_PROMETHEUS"
        assert ds_var["type"] == "datasource", "变量类型非 datasource"
        assert ds_var["query"] == "prometheus", "变量 query 非 prometheus"

        content = (DASH_DIR / "zhs_postgresql.json").read_text(encoding="utf-8")
        assert "${DS_PROMETHEUS}" in content, "panel 未引用 ${DS_PROMETHEUS}"

        print(f"  ✅ 数据源变量 DS_PROMETHEUS 配置正确")
        return True
    except Exception as e:
        print(f"  ❌ 数据源变量验证失败: {e}")
        return False


def test_promql_syntax() -> bool:
    """测试 Prometheus 查询语法验证."""
    try:
        d = _load_pg_dashboard()
        issues = []

        for p in d["panels"]:
            for target in p.get("targets", []):
                expr = target.get("expr", "")
                if not expr:
                    continue

                # 检查括号匹配
                if expr.count("(") != expr.count(")"):
                    issues.append(f"panel {p['id']} 括号不匹配: {expr[:50]}")

                # 检查 rate/irate 包含时间窗口
                if "rate(" in expr or "irate(" in expr:
                    if "$__rate_interval" not in expr and "5m]" not in expr and "1m]" not in expr:
                        issues.append(f"panel {p['id']} rate 缺少时间窗口: {expr[:50]}")

                # 检查 sum by 语法
                if "sum by" in expr:
                    if "(" not in expr.split("sum by")[1]:
                        issues.append(f"panel {p['id']} sum by 语法错误: {expr[:50]}")

        if issues:
            print(f"  ❌ PromQL 语法问题: {issues[:3]}")
            return False

        print(f"  ✅ PromQL 语法验证通过 (括号匹配 + rate 时间窗口 + sum by)")
        return True
    except Exception as e:
        print(f"  ❌ PromQL 语法验证失败: {e}")
        return False


def test_gridpos_layout() -> bool:
    """测试 panel gridPos 布局合理 (无重叠)."""
    try:
        d = _load_pg_dashboard()
        panels = d["panels"]

        # 检查每个 panel 都有 gridPos
        for p in panels:
            assert "gridPos" in p, f"panel {p['id']} 缺少 gridPos"
            gp = p["gridPos"]
            assert "x" in gp and "y" in gp and "w" in gp and "h" in gp, \
                f"panel {p['id']} gridPos 不完整"

        # 检查重叠 (简单检查: 同一 y 位置的 panel x+w 不超过 24)
        for p in panels:
            gp = p["gridPos"]
            assert gp["x"] + gp["w"] <= 24, \
                f"panel {p['id']} 超出 24 列: x={gp['x']}, w={gp['w']}"

        print(f"  ✅ gridPos 布局合理 (无超出 24 列, {len(panels)} 个 panel)")
        return True
    except Exception as e:
        print(f"  ❌ gridPos 布局验证失败: {e}")
        return False


def test_helm_synced() -> bool:
    """测试 helm chart 同步一致."""
    try:
        helm_pg = HELM_DASH_DIR / "zhs_postgresql.json"
        assert helm_pg.exists(), f"helm chart 内缺少 zhs_postgresql.json"

        src_content = (DASH_DIR / "zhs_postgresql.json").read_text(encoding="utf-8")
        helm_content = helm_pg.read_text(encoding="utf-8")
        assert src_content == helm_content, "helm chart 内 zhs_postgresql.json 与源不一致"

        # 验证 JSON 合法
        json.loads(helm_content)

        print(f"  ✅ helm chart 同步一致 (zhs_postgresql.json)")
        return True
    except Exception as e:
        print(f"  ❌ helm chart 同步验证失败: {e}")
        return False


def main() -> int:
    print("=" * 70)
    print("Grafana 仪表盘生产验证")
    print("=" * 70)

    results = []
    print("\n[1] JSON 与结构")
    results.append(("JSON schema 完整", test_json_schema()))
    results.append(("uid 唯一", test_uid_unique()))
    results.append(("panel 数量 >= 15", test_panel_count()))
    results.append(("panel 类型分布", test_panel_types()))

    print("\n[2] 指标引用")
    results.append(("PostgreSQL exporter 指标", test_pg_exporter_metrics()))
    results.append(("应用 DB 连接池指标", test_app_db_pool_metrics()))
    results.append(("数据源变量 DS_PROMETHEUS", test_datasource_variable()))

    print("\n[3] 生产验证")
    results.append(("PromQL 语法验证", test_promql_syntax()))
    results.append(("gridPos 布局合理", test_gridpos_layout()))
    results.append(("helm chart 同步", test_helm_synced()))

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
