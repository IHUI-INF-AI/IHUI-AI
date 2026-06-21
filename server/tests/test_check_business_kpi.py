import os

"""scripts/ci/check_business_kpi.py 单测 (Phase 6-A)."""
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SCRIPTS = ROOT / "scripts" / "ci" / "check_business_kpi.py"
BASELINE = ROOT / "tests" / "fixtures" / "kpi_sla_baseline.json"


# ---------------------------------------------------------------------------
# TestLoadBaseline
# ---------------------------------------------------------------------------


class TestLoadBaseline:
    def test_real_baseline_loads(self):
        from scripts.ci.check_business_kpi import load_baseline

        data = load_baseline(BASELINE)
        assert data["version"] == 1
        assert len(data["kpis"]) == 6
        kpi_ids = {k["id"] for k in data["kpis"]}
        assert "chat_ai_p99_latency" in kpi_ids
        assert "payment_callback_success_rate" in kpi_ids

    def test_missing_baseline_returns_empty(self, tmp_path):
        from scripts.ci.check_business_kpi import load_baseline

        assert load_baseline(tmp_path / "missing.json") == {"kpis": []}


# ---------------------------------------------------------------------------
# TestScanBizMetrics
# ---------------------------------------------------------------------------


class TestScanBizMetrics:
    def test_finds_real_metrics(self):
        from scripts.ci.check_business_kpi import scan_biz_metrics

        names = scan_biz_metrics()
        assert "zhs_biz_requests_total" in names
        assert "zhs_biz_request_duration_seconds" in names
        assert "zhs_biz_payment_count_total" in names
        assert "zhs_biz_cache_hit_ratio" in names
        assert "zhs_biz_ws_connections" in names

    def test_returns_only_biz_namespace(self):
        from scripts.ci.check_business_kpi import scan_biz_metrics

        for n in scan_biz_metrics():
            assert n.startswith("zhs_biz_"), n


# ---------------------------------------------------------------------------
# TestLoadRuleExprs
# ---------------------------------------------------------------------------


class TestLoadRuleExprs:
    def test_real_rules(self):
        from scripts.ci.check_business_kpi import _load_rule_exprs

        names, _ = _load_rule_exprs(ROOT / "deploy" / "helm" / "zhs-platform" / "prometheus" / "rules.yml")
        # Phase 5-A + 6-A 关键 alert 都在
        assert "ZHSBackfillPersisterDegraded" in names
        assert "ZHSCanaryAuditDegraded" in names
        # Phase 6-A 新增
        assert "ZHSBizChatAIP99High" in names
        assert "ZHSBizPayCallbackLowSuccess" in names
        assert "ZHSBizErrorRateHigh" in names

    def test_missing_file(self, tmp_path):
        from scripts.ci.check_business_kpi import _load_rule_exprs

        names, _ = _load_rule_exprs(tmp_path / "missing.yml")
        assert names == set()


# ---------------------------------------------------------------------------
# TestCheckKpiCoverage
# ---------------------------------------------------------------------------


class TestCheckKpiCoverage:
    def test_full_coverage_passes(self):
        from scripts.ci.check_business_kpi import check_kpi_coverage

        baseline = {
            "kpis": [
                {"id": "x", "metric": "zhs_biz_test", "alert": "ZHSTest"},
            ]
        }
        biz = ["zhs_biz_test", "zhs_biz_other"]
        alerts = {"ZHSTest"}
        errs = check_kpi_coverage(baseline, biz, alerts)
        assert errs == []

    def test_missing_metric_reported(self):
        from scripts.ci.check_business_kpi import check_kpi_coverage

        baseline = {"kpis": [{"id": "x", "metric": "zhs_biz_ghost", "alert": "X"}]}
        biz = ["zhs_biz_real"]
        alerts = {"X"}
        errs = check_kpi_coverage(baseline, biz, alerts)
        assert any("ghost" in e for e in errs)

    def test_missing_alert_reported(self):
        from scripts.ci.check_business_kpi import check_kpi_coverage

        baseline = {"kpis": [{"id": "x", "metric": "zhs_biz_real", "alert": "X"}]}
        biz = ["zhs_biz_real"]
        alerts = set()
        errs = check_kpi_coverage(baseline, biz, alerts)
        assert any("X" in e and "alert" in e for e in errs)


# ---------------------------------------------------------------------------
# TestCheckThresholdLogic
# ---------------------------------------------------------------------------


class TestCheckThresholdLogic:
    def test_valid_thresholds(self):
        from scripts.ci.check_business_kpi import check_threshold_logic

        baseline = {
            "kpis": [
                {"id": "a", "threshold_value": 1.0, "threshold_op": "lt"},
                {"id": "b", "threshold_value": 0.5, "threshold_op": "gt"},
            ]
        }
        errs = check_threshold_logic(baseline)
        assert errs == []

    def test_missing_threshold(self):
        from scripts.ci.check_business_kpi import check_threshold_logic

        baseline = {"kpis": [{"id": "a"}]}
        errs = check_threshold_logic(baseline)
        assert any("threshold_value" in e for e in errs)

    def test_invalid_op(self):
        from scripts.ci.check_business_kpi import check_threshold_logic

        baseline = {"kpis": [{"id": "a", "threshold_value": 1, "threshold_op": "eq"}]}
        errs = check_threshold_logic(baseline)
        assert any("threshold_op" in e for e in errs)

    def test_negative_lt_threshold(self):
        from scripts.ci.check_business_kpi import check_threshold_logic

        baseline = {
            "kpis": [
                {"id": "a", "threshold_value": -1, "threshold_op": "lt"},
            ]
        }
        errs = check_threshold_logic(baseline)
        assert any("< 0" in e for e in errs)


# ---------------------------------------------------------------------------
# TestCliE2E
# ---------------------------------------------------------------------------


class TestCliE2E:
    def test_warning_mode_passes(self):
        r = subprocess.run(
            [sys.executable, str(SCRIPTS)],
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            encoding="utf-8",
            errors="replace",
            cwd=str(ROOT),
            timeout=30,
            env={**os.environ, "PYTHONIOENCODING": "utf-8"},
        )
        assert r.returncode == 0, f"stderr: {r.stderr}\nstdout: {r.stdout}"
        assert "PASS" in r.stdout

    def test_strict_mode_passes(self):
        r = subprocess.run(
            [sys.executable, str(SCRIPTS), "--strict"],
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            encoding="utf-8",
            errors="replace",
            cwd=str(ROOT),
            timeout=30,
            env={**os.environ, "PYTHONIOENCODING": "utf-8"},
        )
        assert r.returncode == 0, f"strict stderr: {r.stderr}\nstdout: {r.stdout}"

    def test_json_output(self):
        r = subprocess.run(
            [sys.executable, str(SCRIPTS), "--json"],
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            encoding="utf-8",
            errors="replace",
            cwd=str(ROOT),
            timeout=30,
            env={**os.environ, "PYTHONIOENCODING": "utf-8"},
        )
        assert r.returncode == 0
        assert '"kpis"' in r.stdout
        assert '"biz_metrics"' in r.stdout

    def test_missing_baseline_returns_zero(self, tmp_path):
        r = subprocess.run(
            [sys.executable, str(SCRIPTS), "--baseline", str(tmp_path / "missing.json")],
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            encoding="utf-8",
            errors="replace",
            cwd=str(ROOT),
            timeout=30,
            env={**os.environ, "PYTHONIOENCODING": "utf-8"},
        )
        # baseline 不存在时仍 PASS (走默认 0 KPIs 路径)
        assert r.returncode == 0

    def test_invalid_baseline_fails(self, tmp_path):
        bad = tmp_path / "bad.json"
        bad.write_text("not json {", encoding="utf-8")
        r = subprocess.run(
            [sys.executable, str(SCRIPTS), "--baseline", str(bad)],
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            encoding="utf-8",
            errors="replace",
            cwd=str(ROOT),
            timeout=30,
            env={**os.environ, "PYTHONIOENCODING": "utf-8"},
        )
        # JSON 解析失败 → 非零退出
        assert r.returncode != 0
