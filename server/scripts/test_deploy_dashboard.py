#!/usr/bin/env python3
"""PostgreSQL 部署监控仪表盘验证测试"""
import json
import sys
from pathlib import Path

SERVER_DIR = Path(__file__).resolve().parent.parent
DASHBOARD = SERVER_DIR / "deploy" / "grafana" / "dashboards" / "zhs_pg_deploy.json"


def test_dashboard_exists():
    """测试 1: 仪表盘文件存在"""
    assert DASHBOARD.exists(), f"缺少仪表盘: {DASHBOARD}"
    print("✅ 测试 1 通过: 仪表盘文件存在")


def test_json_valid():
    """测试 2: JSON 语法有效"""
    content = DASHBOARD.read_text(encoding="utf-8")
    try:
        data = json.loads(content)
    except json.JSONDecodeError as e:
        raise AssertionError(f"JSON 语法错误: {e}")
    print("✅ 测试 2 通过: JSON 语法有效")


def test_dashboard_title():
    """测试 3: 仪表盘标题"""
    data = json.loads(DASHBOARD.read_text(encoding="utf-8"))
    title = data.get("title", "")
    assert "PostgreSQL" in title, f"仪表盘标题不规范: {title}"
    assert "部署" in title or "deploy" in title.lower(), f"仪表盘标题不规范: {title}"
    print("✅ 测试 3 通过: 仪表盘标题")


def test_dashboard_uid():
    """测试 4: 仪表盘 UID 唯一"""
    data = json.loads(DASHBOARD.read_text(encoding="utf-8"))
    uid = data.get("uid", "")
    assert uid == "zhs-pg-deploy", f"仪表盘 UID 不规范: {uid}"
    print("✅ 测试 4 通过: 仪表盘 UID")


def test_panel_count():
    """测试 5: panel 数量"""
    data = json.loads(DASHBOARD.read_text(encoding="utf-8"))
    panels = data.get("panels", [])
    assert len(panels) >= 10, f"panel 数量不足: {len(panels)}"
    print(f"✅ 测试 5 通过: panel 数量 ({len(panels)})")


def test_panel_types():
    """测试 6: panel 类型分布"""
    data = json.loads(DASHBOARD.read_text(encoding="utf-8"))
    types = [p.get("type") for p in data.get("panels", [])]
    assert "stat" in types, "缺少 stat 类型"
    assert "timeseries" in types, "缺少 timeseries 类型"
    print("✅ 测试 6 通过: panel 类型分布")


def test_deploy_metrics():
    """测试 7: 部署指标"""
    data = json.loads(DASHBOARD.read_text(encoding="utf-8"))
    panel_titles = [p.get("title", "") for p in data.get("panels", [])]
    metrics_found = []
    for metric in ["PG16", "Patroni", "Vault", "PITR", "跨 AZ", "RTO", "RPO"]:
        if any(metric in title for title in panel_titles):
            metrics_found.append(metric)
    assert len(metrics_found) >= 4, f"部署指标不足: {metrics_found}"
    print(f"✅ 测试 7 通过: 部署指标 ({metrics_found})")


def test_datasource():
    """测试 8: 数据源配置"""
    data = json.loads(DASHBOARD.read_text(encoding="utf-8"))
    panels = data.get("panels", [])
    for panel in panels:
        ds = panel.get("datasource", "")
        assert ds == "Prometheus", f"数据源非 Prometheus: {ds}"
    print("✅ 测试 8 通过: 数据源配置")


def test_promql_syntax():
    """测试 9: PromQL 语法"""
    data = json.loads(DASHBOARD.read_text(encoding="utf-8"))
    panel_count = 0
    for panel in data.get("panels", []):
        for target in panel.get("targets", []):
            expr = target.get("expr", "")
            if expr:
                panel_count += 1
                assert "pg_" in expr or "patroni_" in expr, f"非部署指标: {expr}"
    assert panel_count >= 10, f"PromQL 查询不足: {panel_count}"
    print(f"✅ 测试 9 通过: PromQL 语法 ({panel_count} 个查询)")


def test_grid_layout():
    """测试 10: gridPos 布局"""
    data = json.loads(DASHBOARD.read_text(encoding="utf-8"))
    for panel in data.get("panels", []):
        grid = panel.get("gridPos", {})
        assert "h" in grid and "w" in grid and "x" in grid and "y" in grid, "gridPos 字段不全"
        assert grid["w"] > 0 and grid["h"] > 0, "gridPos 尺寸无效"
    print("✅ 测试 10 通过: gridPos 布局")


def main():
    print("=" * 60)
    print("PostgreSQL 部署监控仪表盘验证")
    print("=" * 60)
    tests = [
        test_dashboard_exists, test_json_valid, test_dashboard_title,
        test_dashboard_uid, test_panel_count, test_panel_types,
        test_deploy_metrics, test_datasource, test_promql_syntax,
        test_grid_layout,
    ]
    for t in tests:
        t()
    print("=" * 60)
    print(f"✅ 全部 {len(tests)} 项测试通过")
    print("=" * 60)
    return 0


if __name__ == "__main__":
    sys.exit(main())
