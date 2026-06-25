#!/usr/bin/env python3
import os
import sys
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'scripts'))
"""告警历史查询面板测试 - zhs_alert_history.json

验证项:
1. 文件存在
2. JSON 语法正确
3. 8 个 panel
4. 4 种 panel 类型: stat / timeseries / bargauge / piechart / table
5. 4 个 stat panel (总告警/critical/warning/info)
6. 1 个 timeseries panel
7. 1 个 bargauge panel (top 10 告警源)
8. 1 个 piechart panel (级别分布)
9. 1 个 table panel (发送状态)
10. 2 个模板变量 (level / source)
11. Prometheus 数据源
12. UID 唯一
"""
import os
import sys
import json
from pathlib import Path

SERVER_DIR = Path(__file__).resolve().parent.parent
SCRIPT = SERVER_DIR / "deploy" / "grafana" / "dashboards" / "zhs_alert_history.json"

passed = 0
failed = 0


def test_case(name: str, ok: bool, detail: str = "") -> None:
    global passed, failed
    if ok:
        passed += 1
        print(f"  ✅ {name}")
    else:
        failed += 1
        print(f"  ❌ {name} -- {detail}")


def main() -> int:
    print("=" * 60)
    print("P1-5 告警历史查询面板测试")
    print("=" * 60)

    test_case("文件存在", SCRIPT.exists(), str(SCRIPT))
    if not SCRIPT.exists():
        return 1

    # JSON 解析
    try:
        data = json.loads(SCRIPT.read_text(encoding="utf-8"))
    except json.JSONDecodeError as e:
        test_case("JSON 可解析", False, str(e))
        return 1
    test_case("JSON 可解析", True, "")

    # 标题
    test_case("标题", data.get("title") == "ZHS 告警历史查询", f"实际: {data.get('title')}")
    test_case("UID 唯一", data.get("uid") == "zhs-alert-history", "")
    test_case("tags", "zhs" in data.get("tags", []), "")
    test_case("schemaVersion", "schemaVersion" in data, "")

    # 8 个 panel
    panels = data.get("panels", [])
    test_case(f"包含 {len(panels)} 个 panel", len(panels) >= 8, f"实际: {len(panels)}")

    # 4 种类型
    types = [p.get("type") for p in panels]
    test_case("stat panel", "stat" in types, "")
    test_case("timeseries panel", "timeseries" in types, "")
    test_case("bargauge panel", "bargauge" in types, "")
    test_case("piechart panel", "piechart" in types, "")
    test_case("table panel", "table" in types, "")

    # 4 个 stat (总告警/critical/warning/info)
    stat_panels = [p for p in panels if p.get("type") == "stat"]
    test_case(f"{len(stat_panels)} 个 stat panel", len(stat_panels) >= 4, f"实际: {len(stat_panels)}")

    # 标题
    titles = [p.get("title", "") for p in panels]
    expected_titles = [
        "总告警数",
        "Critical",
        "Warning",
        "Info",
        "告警趋势",
        "告警源",
        "级别分布",
        "发送状态",
    ]
    for et in expected_titles:
        test_case(f"标题含 {et}", any(et in t for t in titles), f"未找到 {et}")

    # Prometheus 数据源
    for p in panels:
        test_case(f"panel {p.get('title')[:10]} Prometheus",
                  p.get("datasource") == "Prometheus", f"实际: {p.get('datasource')}")

    # 2 个模板变量
    templating = data.get("templating", {}).get("list", [])
    test_case(f"包含 {len(templating)} 个模板变量", len(templating) >= 2, f"实际: {len(templating)}")
    var_names = [v.get("name") for v in templating]
    test_case("模板变量 level", "level" in var_names, "")
    test_case("模板变量 source", "source" in var_names, "")

    # gridPos
    for p in panels:
        test_case(f"panel {p.get('title')[:10]} 含 gridPos", "gridPos" in p, "")

    # time range
    test_case("时间范围", "time" in data, "")

    # 关键 PromQL
    content = SCRIPT.read_text(encoding="utf-8")
    test_case("PromQL: alert_history_total", "alert_history_total" in content, "")
    test_case("PromQL: alert_history_by_level", "alert_history_by_level" in content, "")
    test_case("PromQL: alert_history_by_source", "alert_history_by_source" in content, "")
    test_case("PromQL: alert_history_by_day", "alert_history_by_day" in content, "")
    test_case("PromQL: alert_history_by_status", "alert_history_by_status" in content, "")
    test_case("topk 函数", "topk(" in content, "")

    # refresh
    test_case("refresh 配置", "refresh" in data, "")

    # 注释
    test_case("annotations 配置", "annotations" in data, "")

    print("=" * 60)
    print(f"通过: {passed} / 失败: {failed}")
    print("=" * 60)
    return 0 if failed == 0 else 1


if __name__ == "__main__":
    sys.exit(main())
