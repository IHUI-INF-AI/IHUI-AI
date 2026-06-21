import os

"""check_grafana_dashboards_phase6d.py 单测 (Phase 6-D).

覆盖:
  - _extract_prom_metrics: 抽 metric 名 / 嵌套 / 非字符串
  - check_panel: 缺 title / 缺 type / row 无 targets 合法 / expr 未注册 metric
  - check_gridpos_overlap: 不重叠 / 重叠 / 缺 gridPos
  - check_dashboard: 完整合法 / tags 为空 / tags 不含 zhs / schemaVersion 老 / 重复 id / 缺可视化 / expr 未注册降 warn
  - main() CLI: 真实 dashboards 跑通 / --json / 退出码
"""
import json
import subprocess
import sys
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parent.parent
SCRIPT = ROOT / "scripts" / "ci" / "check_grafana_dashboards_phase6d.py"
DASH_DIR = ROOT / "deploy" / "grafana" / "dashboards"

sys.path.insert(0, str(ROOT / "scripts" / "ci"))
import check_grafana_dashboards_phase6d as m

# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------


def _good_panel(pid=1, x=0):
    return {
        "id": pid,
        "type": "timeseries",
        "title": "P1",
        "gridPos": {"x": x, "y": 0, "w": 12, "h": 8},
        "targets": [{"refId": "A", "expr": "zhs_biz_chat_total"}],
    }


def _good_dashboard():
    return {
        "title": "t",
        "uid": "zhs-test",
        "panels": [_good_panel(1, 0), _good_panel(2, 12)],
        "schemaVersion": 39,
        "tags": ["zhs", "test"],
        "templating": {"list": [{"name": "DS_PROMETHEUS", "type": "datasource"}]},
        "time": {"from": "now-1h", "to": "now"},
        "refresh": "30s",
    }


# ---------------------------------------------------------------------------
# TestExtractPromMetrics
# ---------------------------------------------------------------------------


class TestExtractPromMetrics:

    def test_extracts_single_metric(self):
        assert m._extract_prom_metrics("zhs_biz_chat_total") == ["zhs_biz_chat_total"]

    def test_extracts_multiple_metrics(self):
        ms = m._extract_prom_metrics("zhs_biz_chat_total + zhs_biz_chat_error_total")
        assert "zhs_biz_chat_total" in ms
        assert "zhs_biz_chat_error_total" in ms

    def test_extracts_nested_rate(self):
        ms = m._extract_prom_metrics("rate(zhs_biz_chat_total[5m])")
        assert "zhs_biz_chat_total" in ms

    def test_empty_string(self):
        assert m._extract_prom_metrics("") == []

    def test_non_string(self):
        assert m._extract_prom_metrics(None) == []
        assert m._extract_prom_metrics(123) == []


# ---------------------------------------------------------------------------
# TestCheckPanel
# ---------------------------------------------------------------------------


class TestCheckPanel:

    def test_missing_title(self):
        p = _good_panel()
        p["title"] = ""
        errs = m.check_panel(p)
        assert any("缺 title" in e for e in errs)

    def test_missing_type(self):
        p = _good_panel()
        del p["type"]
        errs = m.check_panel(p)
        assert any("缺 type" in e for e in errs)

    def test_row_panel_no_targets_is_ok(self):
        p = _good_panel()
        p["type"] = "row"
        p["targets"] = []
        assert m.check_panel(p) == []

    def test_text_panel_no_targets_is_ok(self):
        p = _good_panel()
        p["type"] = "text"
        p["targets"] = []
        assert m.check_panel(p) == []

    def test_timeseries_no_targets_is_err(self):
        p = _good_panel()
        p["targets"] = []
        errs = m.check_panel(p)
        assert any("缺 targets" in e for e in errs)

    def test_expr_unregistered_metric_is_err(self):
        p = _good_panel()
        p["targets"] = [{"refId": "A", "expr": "unknown_metric_xyz_total"}]
        errs = m.check_panel(p)
        assert any("未注册 metric" in e for e in errs)

    def test_expr_known_prefix_is_ok(self):
        p = _good_panel()
        p["targets"] = [{"refId": "A", "expr": "rate(zhs_biz_chat_total[5m])"}]
        assert m.check_panel(p) == []


# ---------------------------------------------------------------------------
# TestCheckGridPosOverlap
# ---------------------------------------------------------------------------


class TestCheckGridPosOverlap:

    def test_no_overlap(self):
        panels = [
            {"id": 1, "gridPos": {"x": 0, "y": 0, "w": 12, "h": 8}},
            {"id": 2, "gridPos": {"x": 12, "y": 0, "w": 12, "h": 8}},
        ]
        assert m.check_gridpos_overlap(panels) == []

    def test_overlap(self):
        panels = [
            {"id": 1, "gridPos": {"x": 0, "y": 0, "w": 12, "h": 8}},
            {"id": 2, "gridPos": {"x": 6, "y": 4, "w": 12, "h": 8}},
        ]
        errs = m.check_gridpos_overlap(panels)
        assert len(errs) == 1
        assert "gridPos 重叠" in errs[0]

    def test_missing_gridpos_skipped(self):
        panels = [
            {"id": 1, "gridPos": {"x": 0, "y": 0, "w": 12, "h": 8}},
            {"id": 2},  # 无 gridPos
        ]
        assert m.check_gridpos_overlap(panels) == []

    def test_edge_touching_not_overlap(self):
        # 边界相接不算重叠
        panels = [
            {"id": 1, "gridPos": {"x": 0, "y": 0, "w": 12, "h": 8}},
            {"id": 2, "gridPos": {"x": 12, "y": 0, "w": 12, "h": 8}},
        ]
        assert m.check_gridpos_overlap(panels) == []


# ---------------------------------------------------------------------------
# TestCheckDashboard
# ---------------------------------------------------------------------------


class TestCheckDashboard:

    def test_good_dashboard(self):
        errs, warns = m.check_dashboard(_good_dashboard(), "good.json")
        assert errs == [], f"unexpected errs: {errs}"
        assert warns == []

    def test_tags_empty(self):
        d = _good_dashboard()
        d["tags"] = []
        errs, _ = m.check_dashboard(d, "f.json")
        assert any("tags 为空" in e for e in errs)

    def test_tags_without_zhs(self):
        d = _good_dashboard()
        d["tags"] = ["foo", "bar"]
        errs, _ = m.check_dashboard(d, "f.json")
        assert any("'zhs'" in e for e in errs)

    def test_tags_with_zhs_case_insensitive(self):
        d = _good_dashboard()
        d["tags"] = ["ZHS-test"]
        errs, _ = m.check_dashboard(d, "f.json")
        assert errs == []

    def test_schema_version_too_old(self):
        d = _good_dashboard()
        d["schemaVersion"] = 20
        errs, _ = m.check_dashboard(d, "f.json")
        assert any("schemaVersion" in e and "20" in e for e in errs)

    def test_schema_version_non_int(self):
        d = _good_dashboard()
        d["schemaVersion"] = "39"
        errs, _ = m.check_dashboard(d, "f.json")
        assert any("非整数" in e for e in errs)

    def test_duplicate_panel_id(self):
        d = _good_dashboard()
        d["panels"] = [_good_panel(1), _good_panel(1)]
        errs, _ = m.check_dashboard(d, "f.json")
        assert any("panel id 重复" in e for e in errs)

    def test_no_visualization_panel(self):
        d = _good_dashboard()
        d["panels"] = [
            {"id": 1, "type": "row", "title": "R", "gridPos": {"x": 0, "y": 0, "w": 24, "h": 1}},
        ]
        errs, _ = m.check_dashboard(d, "f.json")
        assert any("缺可视化" in e for e in errs)

    def test_unregistered_expr_downgraded_to_warn(self):
        d = _good_dashboard()
        d["panels"] = [
            {
                "id": 1,
                "type": "timeseries",
                "title": "T",
                "gridPos": {"x": 0, "y": 0, "w": 12, "h": 8},
                "targets": [{"refId": "A", "expr": "unknown_metric_xyz_total"}],
            }
        ]
        errs, warns = m.check_dashboard(d, "f.json")
        assert errs == [], f"should be warn not err: {errs}"
        assert any("未注册 metric" in w for w in warns)

    def test_gridpos_overlap_caught(self):
        d = _good_dashboard()
        d["panels"] = [
            _good_panel(1),
            {
                "id": 2,
                "type": "timeseries",
                "title": "P2",
                "gridPos": {"x": 6, "y": 4, "w": 12, "h": 8},
                "targets": [{"refId": "A", "expr": "zhs_biz_x_total"}],
            },
        ]
        errs, _ = m.check_dashboard(d, "f.json")
        assert any("gridPos 重叠" in e for e in errs)


# ---------------------------------------------------------------------------
# TestCliE2E
# ---------------------------------------------------------------------------


class TestCliE2E:

    def test_real_dashboards_pass(self):
        if not DASH_DIR.exists():
            pytest.skip("no dashboards dir")
        r = subprocess.run(
            [sys.executable, str(SCRIPT)],
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            encoding="utf-8",
            errors="replace",
            cwd=str(ROOT),
            timeout=30,
            env={**os.environ, "PYTHONIOENCODING": "utf-8"},
        )
        assert r.returncode == 0, f"stderr={r.stderr}\nstdout={r.stdout}"
        assert "PASS" in r.stdout
        assert "zhs_cache.json" in r.stdout

    def test_json_output(self):
        r = subprocess.run(
            [sys.executable, str(SCRIPT), "--json"],
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            encoding="utf-8",
            errors="replace",
            cwd=str(ROOT),
            timeout=30,
            env={**os.environ, "PYTHONIOENCODING": "utf-8"},
        )
        # 真实 dashboards 应 PASS, --json 不影响退出码
        assert r.returncode == 0
        # --json 模式下 stdout 只有 JSON, 直接解析
        data = json.loads(r.stdout)
        assert "summary" in data
        assert data["status"] == "ok"
        assert len(data["summary"]) >= 1

    def test_summary_includes_uid_and_panels(self):
        r = subprocess.run(
            [sys.executable, str(SCRIPT), "--json"],
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            encoding="utf-8",
            errors="replace",
            cwd=str(ROOT),
            timeout=30,
            env={**os.environ, "PYTHONIOENCODING": "utf-8"},
        )
        data = json.loads(r.stdout)
        for entry in data["summary"]:
            assert "file" in entry
            assert "uid" in entry
            assert "panels" in entry
            assert entry["uid"].startswith("zhs-")
