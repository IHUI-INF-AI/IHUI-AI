"""Phase 10 建议 4: Incident 短链反向追溯面板 (Grafana dashboard) 验证.

目的:
  1. JSON 合法可被 grafana 导入
  2. 含 incident_id 文本框变量
  3. 5 个 panel 全部使用 $incident_id 变量
  4. panel 跳板含工单/status page/runbook
  5. annotation 查询用 tags=incident:${incident_id} 过滤
  6. Loki 日志查询用 incident_id 过滤

不依赖真实 Grafana 实例, 纯 JSON 静态分析.
"""

from __future__ import annotations

import json
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parent.parent
DASHBOARD_PATH = ROOT / "docker" / "grafana" / "dashboards" / "incident_trace.json"


@pytest.fixture(scope="module")
def dashboard() -> dict:
    return json.loads(DASHBOARD_PATH.read_text(encoding="utf-8"))


def test_dashboard_is_valid_json():
    """dashboard JSON 合法可解析."""
    data = json.loads(DASHBOARD_PATH.read_text(encoding="utf-8"))
    assert "panels" in data
    assert "templating" in data
    assert "title" in data


def test_dashboard_title(dashboard):
    """dashboard 标题含 Incident Trace."""
    assert "Incident Trace" in dashboard["title"]
    assert "incident_id" in dashboard["title"].lower() or "Phase 10" in dashboard["title"]


def test_dashboard_uid(dashboard):
    """dashboard uid = zhs-incident-trace."""
    assert dashboard["uid"] == "zhs-incident-trace"


def test_dashboard_has_incident_id_variable(dashboard):
    """templating.list 含 incident_id 变量 (type=textbox)."""
    variables = dashboard["templating"]["list"]
    assert len(variables) >= 1
    inc_var = variables[0]
    assert inc_var["name"] == "incident_id"
    assert inc_var["type"] == "textbox"
    # 默认值必是 INC-YYYYMMDD-XXXXXX 格式
    assert inc_var["current"]["value"].startswith("INC-")
    assert len(inc_var["current"]["value"].split("-")) == 3
    assert len(inc_var["current"]["value"].split("-")[-1]) == 6


def test_all_panels_use_incident_id(dashboard):
    """每个 panel 必含 $incident_id 变量引用 (确保 incident_id 一键过滤)."""
    for p in dashboard["panels"]:
        panel_text = json.dumps(p, ensure_ascii=False)
        # text panel + table + logs 全部应含变量
        if p.get("type") in ("text", "table", "logs", "stat"):
            # text panel 例外 (有些只是 title 提示)
            if p["type"] == "text" and p.get("id") == 1:
                # 顶部说明 panel, 必须含 $incident_id 在 content 中
                assert (
                    "$incident_id" in p["options"]["content"] or "${incident_id}" in p["options"]["content"]
                ), f"顶部 panel 缺变量引用: {p['options']['content']}"
            elif p["type"] in ("table", "logs", "stat"):
                # 数据 panel 必须含变量 (Grafana 真实语法是 ${incident_id})
                assert (
                    "$incident_id" in panel_text or "${incident_id}" in panel_text
                ), f"panel {p.get('title')} 缺 $incident_id 变量"


def test_annotation_query_filters_by_incident_id(dashboard):
    """annotation 查询用 tags=incident:${incident_id} 过滤."""
    ann_panel = next(p for p in dashboard["panels"] if p.get("id") == 2)
    target = ann_panel["targets"][0]
    assert "incident:${incident_id}" in target.get("tags", ""), f"annotation tags 缺 incident 过滤: {target}"


def test_loki_log_filter_uses_incident_id(dashboard):
    """Loki 日志查询用 |= $incident_id 过滤."""
    logs_panel = next(p for p in dashboard["panels"] if p.get("id") == 5)
    expr = logs_panel["targets"][0]["expr"]
    assert "$incident_id" in expr, f"Loki 表达式缺变量: {expr}"
    assert "|=" in expr, f"Loki 表达式缺 |= 过滤: {expr}"


def test_panel_5_has_incident_links(dashboard):
    """第 6 个 panel 跳板含工单 / status page / runbook 链接."""
    links_panel = next(p for p in dashboard["panels"] if p.get("id") == 6)
    content = links_panel["options"]["content"]
    assert "jira.zhs.top" in content
    assert "ZHS-$incident_id" in content, "工单链接缺 incident 变量"
    assert "status.zhs.top" in content
    assert "$incident_id" in content
    assert "wiki.zhs.top/runbook" in content


def test_panel_count(dashboard):
    """6 个 panel 全在 (1 标题 + 1 注释 + 1 告警 + 1 flapping + 1 日志 + 1 跳板)."""
    assert len(dashboard["panels"]) == 6


def test_dashboard_uses_phase10_tags(dashboard):
    """tags 含 phase10/incident/trace."""
    tags = dashboard.get("tags", [])
    for expected in ("phase10", "incident", "trace"):
        assert expected in tags, f"tags 缺 {expected}: {tags}"


def test_dashboard_time_range_one_week(dashboard):
    """默认时间窗 now-7d ~ now, 覆盖 1 周演练周期."""
    assert dashboard["time"]["from"] == "now-7d"
    assert dashboard["time"]["to"] == "now"


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
