"""scripts/ci/drill_alert_routing.py 单测 (Phase 5-C)."""

import os
import subprocess
import sys
from pathlib import Path

import yaml

ROOT = Path(__file__).resolve().parent.parent
SCRIPTS = ROOT / "scripts" / "ci" / "drill_alert_routing.py"
ALERTMANAGER = ROOT / "deploy" / "helm" / "zhs-platform" / "prometheus" / "alertmanager.yml"


# ---------------------------------------------------------------------------
# TestMatchHelpers
# ---------------------------------------------------------------------------


class TestMatchHelpers:
    def test_match_label_match(self):
        from scripts.ci.drill_alert_routing import _match_label_match

        assert _match_label_match({"severity": "critical"}, {"severity": "critical", "x": 1}) is True
        assert _match_label_match({"severity": "critical"}, {"severity": "warning"}) is False
        assert _match_label_match({}, {"x": 1}) is True
        assert _match_label_match(None, {"x": 1}) is True

    def test_match_label_re(self):
        from scripts.ci.drill_alert_routing import _match_label_re

        assert _match_label_re({"alertname": "ZHS_.*"}, {"alertname": "ZHS_CI_DRILL_FAILURE"}) is True
        assert _match_label_re({"alertname": "ZHS_.*"}, {"alertname": "OtherApp"}) is False
        # 缺 label → False
        assert _match_label_re({"alertname": "X"}, {}) is False
        assert _match_label_re({}, {}) is True


# ---------------------------------------------------------------------------
# TestResolveReceiver
# ---------------------------------------------------------------------------


class TestResolveReceiver:
    def test_default_route(self):
        from scripts.ci.drill_alert_routing import resolve_receiver

        route = {"receiver": "zhs-default", "routes": []}
        assert resolve_receiver(route, {"severity": "warning"}) == "zhs-default"

    def test_critical_match(self):
        from scripts.ci.drill_alert_routing import resolve_receiver

        route = {
            "receiver": "zhs-default",
            "routes": [
                {"match": {"severity": "critical"}, "receiver": "zhs-critical"},
            ],
        }
        assert resolve_receiver(route, {"severity": "critical"}) == "zhs-critical"
        assert resolve_receiver(route, {"severity": "warning"}) == "zhs-default"

    def test_match_re(self):
        from scripts.ci.drill_alert_routing import resolve_receiver

        route = {
            "receiver": "zhs-default",
            "routes": [
                {"match_re": {"alertname": "ZHS_CI_DRILL_.*"}, "receiver": "zhs-ci-drill"},
            ],
        }
        assert resolve_receiver(route, {"alertname": "ZHS_CI_DRILL_FAILURE"}) == "zhs-ci-drill"
        assert resolve_receiver(route, {"alertname": "ZHSAppDown"}) == "zhs-default"

    def test_nested_routes(self):
        from scripts.ci.drill_alert_routing import resolve_receiver

        route = {
            "receiver": "zhs-default",
            "routes": [
                {
                    "match": {"service": "zhs-platform"},
                    "routes": [
                        {"match": {"severity": "critical"}, "receiver": "zhs-critical"},
                    ],
                },
            ],
        }
        assert resolve_receiver(route, {"service": "zhs-platform", "severity": "critical"}) == "zhs-critical"
        assert resolve_receiver(route, {"service": "zhs-platform", "severity": "warning"}) == "zhs-default"
        assert resolve_receiver(route, {"service": "other", "severity": "critical"}) == "zhs-default"

    def test_first_match_wins(self):
        from scripts.ci.drill_alert_routing import resolve_receiver

        route = {
            "receiver": "zhs-default",
            "routes": [
                {"match": {"severity": "critical"}, "receiver": "first"},
                {"match": {"severity": "critical"}, "receiver": "second"},
            ],
        }
        # 第一个命中, 不继续
        assert resolve_receiver(route, {"severity": "critical"}) == "first"


# ---------------------------------------------------------------------------
# TestApplyInhibitRules
# ---------------------------------------------------------------------------


class TestApplyInhibitRules:
    def _rule(self, source_match, target_match, equal=None):
        return {
            "source_match": source_match,
            "target_match": target_match,
            "equal": equal or ["alertname", "service"],
        }

    def test_basic_inhibition(self):
        from scripts.ci.drill_alert_routing import apply_inhibit_rules

        alerts = [
            {"alertname": "A", "severity": "critical", "status": "firing", "service": "x"},
            {"alertname": "B", "severity": "warning", "status": "firing", "service": "x"},
        ]
        # source_match / target_match 各自约束, equal=['service'] 要求 service 相等
        rules = [
            {
                "source_match": {"alertname": "A", "severity": "critical"},
                "target_match": {"alertname": "B", "severity": "warning"},
                "equal": ["service"],
            }
        ]
        active, supp = apply_inhibit_rules(alerts, rules)
        assert len(active) == 1
        assert active[0]["alertname"] == "A"
        assert len(supp) == 1
        assert supp[0]["alert"]["alertname"] == "B"

    def test_no_inhibit_when_source_not_firing(self):
        from scripts.ci.drill_alert_routing import apply_inhibit_rules

        alerts = [
            {"alertname": "A", "severity": "critical", "status": "resolved", "service": "x"},
            {"alertname": "B", "severity": "warning", "status": "firing", "service": "x"},
        ]
        rules = [self._rule({"alertname": "A", "severity": "critical"}, {"alertname": "B"})]
        active, supp = apply_inhibit_rules(alerts, rules)
        # source resolved → 不抑制
        assert len(active) == 2
        assert len(supp) == 0

    def test_equal_field_mismatch_does_not_inhibit(self):
        from scripts.ci.drill_alert_routing import apply_inhibit_rules

        alerts = [
            {"alertname": "A", "severity": "critical", "status": "firing", "service": "x"},
            {"alertname": "B", "severity": "warning", "status": "firing", "service": "y"},
        ]
        rules = [self._rule({"alertname": "A", "severity": "critical"}, {"alertname": "B"})]
        active, supp = apply_inhibit_rules(alerts, rules)
        # service 不等 → 不抑制
        assert len(active) == 2

    def test_no_rules_no_inhibition(self):
        from scripts.ci.drill_alert_routing import apply_inhibit_rules

        alerts = [
            {"alertname": "A", "severity": "critical", "status": "firing"},
            {"alertname": "B", "severity": "warning", "status": "firing"},
        ]
        active, supp = apply_inhibit_rules(alerts, [])
        assert len(active) == 2
        assert len(supp) == 0


# ---------------------------------------------------------------------------
# TestRealConfig
# ---------------------------------------------------------------------------


class TestRealConfig:
    def test_real_alertmanager_loads(self):
        from scripts.ci.drill_alert_routing import resolve_receiver

        cfg = yaml.safe_load(ALERTMANAGER.read_text(encoding="utf-8"))
        root = cfg["route"]
        # 真实告警: critical 应路由到 zhs-critical
        rcv = resolve_receiver(root, {"alertname": "ZHSAppDown", "severity": "critical", "service": "zhs-platform"})
        assert rcv == "zhs-critical", f"ZHSAppDown critical 路由错误: {rcv}"

    def test_real_drill_alert_to_ci_drill(self):
        from scripts.ci.drill_alert_routing import resolve_receiver

        cfg = yaml.safe_load(ALERTMANAGER.read_text(encoding="utf-8"))
        root = cfg["route"]
        rcv = resolve_receiver(root, {"alertname": "ZHS_CI_DRILL_LATENCY", "severity": "warning", "service": "ci"})
        assert rcv == "zhs-ci-drill", f"ZHS_CI_DRILL_LATENCY 路由错误: {rcv}"


# ---------------------------------------------------------------------------
# TestCliE2E
# ---------------------------------------------------------------------------


class TestCliE2E:
    def test_script_runs_pass(self):
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
        assert r.stdout is not None, f"subprocess stdout=None, stderr={r.stderr}"
        assert r.returncode == 0, f"stderr: {r.stderr}\nstdout: {r.stdout}"
        assert "PASS" in r.stdout

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
        assert r.stdout is not None, f"subprocess stdout=None, stderr={r.stderr}"
        assert r.returncode == 0
        assert '"routing"' in r.stdout
        assert '"status"' in r.stdout

    def test_missing_config_fails(self, tmp_path):
        r = subprocess.run(
            [sys.executable, str(SCRIPTS), "--config", str(tmp_path / "missing.yml")],
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            encoding="utf-8",
            errors="replace",
            cwd=str(ROOT),
            timeout=30,
            env={**os.environ, "PYTHONIOENCODING": "utf-8"},
        )
        assert r.stdout is not None, f"subprocess stdout=None, stderr={r.stderr}"
        assert r.returncode == 1
        assert "不存在" in r.stdout
