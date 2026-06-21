"""Grafana PostgreSQL 仪表盘验证脚本.

验证内容 (10 项):
1. zhs_postgresql.json 文件存在且 JSON 合法
2. 仪表盘必备 Grafana 字段 (title/uid/panels/tags/templating)
3. uid 唯一 (zhs-postgresql, 不与其他仪表盘冲突)
4. panel id 在仪表盘内唯一
5. panel 数量 >= 10 (覆盖连接池/慢SQL/连接数/事务/死锁/缓存命中)
6. PostgreSQL exporter 原生指标引用 (pg_up/pg_stat_activity/pg_database_size)
7. 应用 DB 连接池指标引用 (zhs_db_pool_*/zhs_slow_sql_with_trace_total)
8. 数据源变量 DS_PROMETHEUS 配置
9. Helm ConfigMap 引用 zhs_postgresql.json
10. helm chart dashboards 目录文件同步

用法:
  python scripts/test_grafana_pg_dashboard.py
"""
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DASH_DIR = ROOT / "deploy" / "grafana" / "dashboards"
HELM_DASH_DIR = ROOT / "deploy" / "helm" / "zhs-platform" / "dashboards"
HELM_CONFIGMAP = ROOT / "deploy" / "helm" / "zhs-platform" / "templates" / "grafana-dashboards-configmap.yaml"


def _load_pg_dashboard() -> dict:
    return json.loads((DASH_DIR / "zhs_postgresql.json").read_text(encoding="utf-8"))


def test_file_exists() -> bool:
    """测试 zhs_postgresql.json 文件存在且 JSON 合法."""
    try:
        f = DASH_DIR / "zhs_postgresql.json"
        assert f.exists(), f"文件不存在: {f}"
        data = json.loads(f.read_text(encoding="utf-8"))
        assert isinstance(data, dict), "JSON 顶层非 dict"
        print(f"  ✅ zhs_postgresql.json 存在且 JSON 合法")
        return True
    except Exception as e:
        print(f"  ❌ 文件存在性验证失败: {e}")
        return False


def test_grafana_schema() -> bool:
    """测试仪表盘必备 Grafana 字段."""
    try:
        d = _load_pg_dashboard()
        required = ["title", "uid", "panels", "tags", "templating", "schemaVersion", "refresh", "time"]
        for field in required:
            assert field in d, f"缺少字段: {field}"

        assert isinstance(d["panels"], list), "panels 非 list"
        assert len(d["panels"]) > 0, "panels 为空"
        assert isinstance(d["tags"], list), "tags 非 list"
        assert "postgresql" in d["tags"], f"tags 缺少 postgresql: {d['tags']}"

        print(f"  ✅ Grafana 字段完整 (title={d['title']!r}, tags={d['tags']})")
        return True
    except Exception as e:
        print(f"  ❌ Grafana 字段验证失败: {e}")
        return False


def test_uid_unique() -> bool:
    """测试 uid 唯一."""
    try:
        pg_uid = _load_pg_dashboard()["uid"]
        assert pg_uid == "zhs-postgresql", f"uid 非 zhs-postgresql: {pg_uid}"

        # 检查其他仪表盘 uid 不冲突
        for f in DASH_DIR.glob("*.json"):
            if f.name == "zhs_postgresql.json":
                continue
            other = json.loads(f.read_text(encoding="utf-8"))
            other_uid = other.get("uid", "")
            assert other_uid != pg_uid, f"uid 冲突: {f.name} 也是 {pg_uid}"

        print(f"  ✅ uid 唯一 (zhs-postgresql, 不与其他仪表盘冲突)")
        return True
    except Exception as e:
        print(f"  ❌ uid 唯一性验证失败: {e}")
        return False


def test_panel_ids_unique() -> bool:
    """测试 panel id 在仪表盘内唯一."""
    try:
        d = _load_pg_dashboard()
        ids = [p["id"] for p in d["panels"]]
        assert len(ids) == len(set(ids)), f"panel id 重复: {ids}"

        print(f"  ✅ panel id 唯一 ({len(ids)} 个 panel)")
        return True
    except Exception as e:
        print(f"  ❌ panel id 唯一性验证失败: {e}")
        return False


def test_panel_count() -> bool:
    """测试 panel 数量 >= 10."""
    try:
        d = _load_pg_dashboard()
        count = len(d["panels"])
        assert count >= 10, f"panel 数量不足 10, 实际 {count}"

        # 检查 panel 类型分布
        types = {}
        for p in d["panels"]:
            t = p.get("type", "unknown")
            types[t] = types.get(t, 0) + 1

        print(f"  ✅ panel 数量 {count} (>= 10), 类型分布: {types}")
        return True
    except Exception as e:
        print(f"  ❌ panel 数量验证失败: {e}")
        return False


def test_pg_exporter_metrics() -> bool:
    """测试 PostgreSQL exporter 原生指标引用."""
    try:
        content = (DASH_DIR / "zhs_postgresql.json").read_text(encoding="utf-8")

        # pg_up - 实例状态
        assert "pg_up" in content, "缺少 pg_up 指标"

        # pg_stat_activity_count - 活跃连接
        assert "pg_stat_activity_count" in content, "缺少 pg_stat_activity_count 指标"

        # pg_database_size_bytes - 数据库大小
        assert "pg_database_size_bytes" in content, "缺少 pg_database_size_bytes 指标"

        # pg_stat_database_deadlocks - 死锁
        assert "pg_stat_database_deadlocks" in content, "缺少 pg_stat_database_deadlocks 指标"

        # pg_stat_database_xact_commit - 事务提交
        assert "pg_stat_database_xact_commit" in content, "缺少 pg_stat_database_xact_commit 指标"

        # pg_stat_database_xact_rollback - 事务回滚
        assert "pg_stat_database_xact_rollback" in content, "缺少 pg_stat_database_xact_rollback 指标"

        # pg_settings_max_connections - 最大连接数
        assert "pg_settings_max_connections" in content, "缺少 pg_settings_max_connections 指标"

        # pg_stat_database_blks_hit / blks_read - 缓存命中
        assert "pg_stat_database_blks_hit" in content, "缺少 pg_stat_database_blks_hit 指标"
        assert "pg_stat_database_blks_read" in content, "缺少 pg_stat_database_blks_read 指标"

        print(f"  ✅ PostgreSQL exporter 原生指标引用完整 (9 个指标)")
        return True
    except Exception as e:
        print(f"  ❌ PostgreSQL exporter 指标验证失败: {e}")
        return False


def test_app_db_pool_metrics() -> bool:
    """测试应用 DB 连接池指标引用."""
    try:
        content = (DASH_DIR / "zhs_postgresql.json").read_text(encoding="utf-8")

        # 连接池使用率
        assert "zhs_db_pool_in_use" in content, "缺少 zhs_db_pool_in_use 指标"
        assert "zhs_db_pool_size" in content, "缺少 zhs_db_pool_size 指标"

        # 连接池溢出
        assert "zhs_db_pool_overflow" in content, "缺少 zhs_db_pool_overflow 指标"

        # checkout 超时
        assert "zhs_db_pool_checkout_timeouts_total" in content, \
            "缺少 zhs_db_pool_checkout_timeouts_total 指标"

        # 慢 SQL
        assert "zhs_slow_sql_with_trace_total" in content, "缺少 zhs_slow_sql_with_trace_total 指标"

        print(f"  ✅ 应用 DB 连接池指标引用完整 (5 个指标)")
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
        assert ds_var["name"] == "DS_PROMETHEUS", f"变量名非 DS_PROMETHEUS: {ds_var.get('name')}"
        assert ds_var["type"] == "datasource", f"变量类型非 datasource: {ds_var.get('type')}"
        assert ds_var["query"] == "prometheus", f"变量 query 非 prometheus: {ds_var.get('query')}"

        # 检查 panel 引用了变量
        content = (DASH_DIR / "zhs_postgresql.json").read_text(encoding="utf-8")
        assert "${DS_PROMETHEUS}" in content, "panel 未引用 ${DS_PROMETHEUS} 变量"

        print(f"  ✅ 数据源变量 DS_PROMETHEUS 配置正确")
        return True
    except Exception as e:
        print(f"  ❌ 数据源变量验证失败: {e}")
        return False


def test_helm_configmap_reference() -> bool:
    """测试 Helm ConfigMap 引用 zhs_postgresql.json."""
    try:
        content = HELM_CONFIGMAP.read_text(encoding="utf-8")
        assert "zhs_postgresql.json" in content, "ConfigMap 未引用 zhs_postgresql.json"
        assert 'dashboards/zhs_postgresql.json' in content, "ConfigMap 未引用 dashboards/zhs_postgresql.json 路径"

        print(f"  ✅ Helm ConfigMap 引用 zhs_postgresql.json")
        return True
    except Exception as e:
        print(f"  ❌ Helm ConfigMap 引用验证失败: {e}")
        return False


def test_helm_dashboards_synced() -> bool:
    """测试 helm chart dashboards 目录文件同步."""
    try:
        # helm chart 内的 dashboard 文件
        helm_pg = HELM_DASH_DIR / "zhs_postgresql.json"
        assert helm_pg.exists(), f"helm chart 内缺少 zhs_postgresql.json: {helm_pg}"

        # 内容与源一致
        src_content = (DASH_DIR / "zhs_postgresql.json").read_text(encoding="utf-8")
        helm_content = helm_pg.read_text(encoding="utf-8")
        assert src_content == helm_content, "helm chart 内 zhs_postgresql.json 与源不一致"

        # 验证 JSON 合法
        json.loads(helm_content)

        print(f"  ✅ helm chart dashboards 目录文件同步 (zhs_postgresql.json 一致)")
        return True
    except Exception as e:
        print(f"  ❌ helm chart 同步验证失败: {e}")
        return False


def main() -> int:
    print("=" * 70)
    print("Grafana PostgreSQL 仪表盘验证")
    print("=" * 70)

    results = []
    print("\n[1] 文件与结构")
    results.append(("文件存在且 JSON 合法", test_file_exists()))
    results.append(("Grafana 字段完整", test_grafana_schema()))
    results.append(("uid 唯一", test_uid_unique()))
    results.append(("panel id 唯一", test_panel_ids_unique()))
    results.append(("panel 数量 >= 10", test_panel_count()))

    print("\n[2] 指标引用")
    results.append(("PostgreSQL exporter 原生指标", test_pg_exporter_metrics()))
    results.append(("应用 DB 连接池指标", test_app_db_pool_metrics()))
    results.append(("数据源变量 DS_PROMETHEUS", test_datasource_variable()))

    print("\n[3] Helm 集成")
    results.append(("Helm ConfigMap 引用", test_helm_configmap_reference()))
    results.append(("helm chart 文件同步", test_helm_dashboards_synced()))

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
