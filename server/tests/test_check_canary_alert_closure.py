"""scripts/ci/check_canary_alert_closure.py 单测 (Phase 4-C).

覆盖:
  - 提取 metric 名称 (canary_metrics 模块 + app 目录扫描)
  - 关键 metric 强制覆盖检查
  - metric-alert 覆盖矩阵构建
  - ZHSRollbackActive 抑制规则检查 (有 / 无 / 缺文件)
  - helm/docker 副本一致性
  - 端到端: 跑脚本 main() 退出码 0
"""

import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SCRIPTS = ROOT / "scripts" / "ci" / "check_canary_alert_closure.py"


# ---------------------------------------------------------------------------
# TestExtractMetrics
# ---------------------------------------------------------------------------


class TestExtractMetrics:
    def test_canary_module_has_core_metrics(self):
        from scripts.ci.check_canary_alert_closure import (
            extract_metrics_from_canary_module,
        )

        names = extract_metrics_from_canary_module()
        assert "zhs_canary_decisions_total" in names
        assert "zhs_canary_errors_total" in names
        assert "zhs_canary_rollback_active" in names
        assert "zhs_canary_stage_ratio" in names
        assert "zhs_shadow_ratio" in names

    def test_app_scan_finds_shadow_compare(self):
        from scripts.ci.check_canary_alert_closure import extract_metrics_from_app

        names = extract_metrics_from_app()
        # 这些 metric 在 app/_archived/shadow_compare.py / shadow_ratio_controller.py 等模块声明 (已归档)
        assert "zhs_shadow_compare_total" in names
        assert "zhs_shadow_compare_mismatch_total" in names
        assert "zhs_canary_rollback_active" in names
        assert "zhs_shadow_ratio" in names

    def test_app_scan_dedup(self):
        from scripts.ci.check_canary_alert_closure import extract_metrics_from_app

        names = extract_metrics_from_app()
        # 去重
        assert len(names) == len(set(names))

    def test_app_scan_only_canary_shadow_backfill(self):
        from scripts.ci.check_canary_alert_closure import extract_metrics_from_app

        names = extract_metrics_from_app()
        for n in names:
            assert n.startswith(("zhs_canary_", "zhs_shadow_", "zhs_backfill_")), n


# ---------------------------------------------------------------------------
# TestLoadRules
# ---------------------------------------------------------------------------


class TestLoadRules:
    def test_loads_real_rules(self):
        from scripts.ci.check_canary_alert_closure import RULES_PATH, _load_rules

        assert RULES_PATH.exists(), f"rules.yml 不存在: {RULES_PATH}"
        rules = _load_rules(RULES_PATH)
        assert len(rules) >= 10
        # 至少包含 canary 关键 alert
        names = {r["name"] for r in rules}
        assert "ZHSRollbackActive" in names
        assert "ZHSCanaryStuckMidStage" in names
        assert "ZHSShadowRatioMismatch" in names

    def test_each_rule_has_name_expr(self):
        from scripts.ci.check_canary_alert_closure import RULES_PATH, _load_rules

        rules = _load_rules(RULES_PATH)
        for r in rules:
            assert r["name"]
            assert isinstance(r["expr"], str)
            assert r["labels"] is not None


# ---------------------------------------------------------------------------
# TestKeyMetricCoverage
# ---------------------------------------------------------------------------


class TestKeyMetricCoverage:
    def test_key_metrics_covered_by_real_rules(self):
        from scripts.ci.check_canary_alert_closure import (
            KEY_METRICS,
            RULES_PATH,
            _load_rules,
            check_key_metric_coverage,
        )

        rules = _load_rules(RULES_PATH)
        errs = check_key_metric_coverage(rules, [])
        assert errs == [], f"关键 metric 缺失: {errs}"
        # 全部 KEY_METRICS 都应被 expr 引用
        exprs = "\n".join(r["expr"] for r in rules)
        for km in KEY_METRICS:
            assert km in exprs

    def test_missing_metric_reported(self):
        from scripts.ci.check_canary_alert_closure import KEY_METRICS, check_key_metric_coverage

        fake_rules = [{"name": "X", "expr": "sum(other_metric)", "labels": {}}]
        errs = check_key_metric_coverage(fake_rules, [])
        # 全部 KEY_METRICS 都应报告缺失 (Phase 5-A 之后 6 个)
        assert len(errs) == len(KEY_METRICS)
        # 报告的 metric 名应全部在 KEY_METRICS 集合内
        reported = {e for err in errs for e in [err.split("'")[1]]}
        assert reported == set(KEY_METRICS)


# ---------------------------------------------------------------------------
# TestMetricAlertClosure
# ---------------------------------------------------------------------------


class TestMetricAlertClosure:
    def test_closure_matrix_built(self):
        from scripts.ci.check_canary_alert_closure import (
            RULES_PATH,
            _load_rules,
            check_metric_alert_closure,
            extract_metrics_from_app,
        )

        rules = _load_rules(RULES_PATH)
        metrics = extract_metrics_from_app()
        closure = check_metric_alert_closure(metrics, rules)
        assert len(closure) == len(metrics)
        # 至少 3 条 covered (key metrics)
        covered = [c for c in closure if c["covered"]]
        assert len(covered) >= 3


# ---------------------------------------------------------------------------
# TestRollbackInhibited
# ---------------------------------------------------------------------------


class TestRollbackInhibited:
    def test_rollback_inhibited_in_real_yml(self):
        from scripts.ci.check_canary_alert_closure import (
            ALERTMANAGER_PATH,
            check_rollback_inhibited,
        )

        errs = check_rollback_inhibited(ALERTMANAGER_PATH)
        assert errs == [], f"应能找到 ZHSRollbackActive 抑制规则, 实际: {errs}"

    def test_missing_file_returns_error(self, tmp_path):
        from scripts.ci.check_canary_alert_closure import check_rollback_inhibited

        errs = check_rollback_inhibited(tmp_path / "missing.yml")
        assert errs
        assert "不存在" in errs[0]

    def test_no_inhibit_rules_returns_error(self, tmp_path):
        from scripts.ci.check_canary_alert_closure import check_rollback_inhibited

        f = tmp_path / "am.yml"
        f.write_text("route:\n  receiver: x\n", encoding="utf-8")
        errs = check_rollback_inhibited(f)
        assert errs
        assert "ZHSRollbackActive" in errs[0]


# ---------------------------------------------------------------------------
# TestHelmConsistency
# ---------------------------------------------------------------------------


class TestHelmConsistency:
    def test_real_files_consistent(self):
        from scripts.ci.check_canary_alert_closure import check_helm_consistency

        errs = check_helm_consistency()
        # 当前 helm 与 docker 副本应一致
        assert errs == [], f"helm/docker 不一致: {errs}"


# ---------------------------------------------------------------------------
# TestCliE2E
# ---------------------------------------------------------------------------


class TestCliE2E:
    def _run_script(self, *args):
        import os

        env = os.environ.copy()
        env["PYTHONIOENCODING"] = "utf-8"
        r = subprocess.run(
            [sys.executable, str(SCRIPTS)] + list(args),
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            timeout=30,
            cwd=str(ROOT),
            env=env,
        )
        # Decode with utf-8 fallback (script outputs Chinese which may be GBK on Windows)
        r.stdout = r.stdout.decode("utf-8", errors="replace")
        r.stderr = r.stderr.decode("gbk", errors="replace")
        return r

    def test_script_runs_pass(self):
        """跑脚本 main() 退出码 0."""
        r = self._run_script()
        assert r.returncode == 0, f"stderr: {r.stderr}\nstdout: {r.stdout}"
        assert "PASS" in r.stdout

    def test_script_json_output(self):
        r = self._run_script("--json")
        assert r.returncode == 0
        # 至少含 "metrics" 键
        assert '"metrics"' in r.stdout

    def test_no_helm_check_flag(self):
        r = self._run_script("--no-helm-check", "--json")
        assert r.returncode == 0
