"""建议 150 测试: 抑制规则 playground 端点.

测试覆盖:
  - 端点 /inhibition/dry-run 基础: 自定义规则 + 自定义告警
  - 命中规则名正确返回
  - use_default_presets=true 叠加预设
  - 空规则 / 空告警 / 边界
  - 端点 /inhibition/presets 返回 ZHS 预设
  - 端点不会修改全局默认 inhibitor (隔离)
  - 端点路由已注册
  - pydantic 模型验证
"""

import pytest

# ---------------------------------------------------------------------------
# 端点路由注册
# ---------------------------------------------------------------------------


class TestRouterRegistration:
    def test_dry_run_route_registered(self):
        from app.api.v1.monitor.inhibition_playground import router

        paths = [r.path for r in router.routes]
        assert "/inhibition/dry-run" in paths

    def test_presets_route_registered(self):
        from app.api.v1.monitor.inhibition_playground import router

        paths = [r.path for r in router.routes]
        assert "/inhibition/presets" in paths


# ---------------------------------------------------------------------------
# Pydantic 模型
# ---------------------------------------------------------------------------


class TestModels:
    def test_alert_in_default(self):
        from app.api.v1.monitor.inhibition_playground import AlertIn

        a = AlertIn()
        assert a.status == "firing"
        assert a.labels == {}

    def test_alert_in_with_labels(self):
        from app.api.v1.monitor.inhibition_playground import AlertIn

        a = AlertIn(labels={"alertname": "X"})
        assert a.labels == {"alertname": "X"}

    def test_rule_spec_default(self):
        from app.api.v1.monitor.inhibition_playground import RuleSpec

        r = RuleSpec()
        assert r.source_match == {}
        assert r.target_match == {}
        assert r.equal is None
        assert r.name == ""

    def test_playground_request_requires_alerts(self):
        from pydantic import ValidationError

        from app.api.v1.monitor.inhibition_playground import PlaygroundRequest

        with pytest.raises(ValidationError):
            PlaygroundRequest()


# ---------------------------------------------------------------------------
# 辅助函数
# ---------------------------------------------------------------------------


class TestBuildInhibitor:
    def test_empty(self):
        from app.api.v1.monitor.inhibition_playground import (
            PlaygroundRequest,
            _build_inhibitor,
        )

        req = PlaygroundRequest(alerts=[])
        inh, source = _build_inhibitor(req)
        assert source == "none"
        assert inh.rules == []

    def test_only_custom(self):
        from app.api.v1.monitor.inhibition_playground import (
            PlaygroundRequest,
            RuleSpec,
            _build_inhibitor,
        )

        req = PlaygroundRequest(
            alerts=[],
            rules=[RuleSpec(name="r1", source_match={"a": "1"})],
        )
        inh, source = _build_inhibitor(req)
        assert source == "custom"
        assert len(inh.rules) == 1
        assert inh.rules[0].name == "r1"

    def test_only_presets(self):
        from app.api.v1.monitor.inhibition_playground import (
            PlaygroundRequest,
            _build_inhibitor,
        )

        req = PlaygroundRequest(alerts=[], use_default_presets=True)
        inh, source = _build_inhibitor(req)
        assert source == "presets"
        # 6 个 ZHS 预设
        assert len(inh.rules) == 6

    def test_custom_plus_presets(self):
        from app.api.v1.monitor.inhibition_playground import (
            PlaygroundRequest,
            RuleSpec,
            _build_inhibitor,
        )

        req = PlaygroundRequest(
            alerts=[],
            rules=[RuleSpec(name="c1")],
            use_default_presets=True,
        )
        inh, source = _build_inhibitor(req)
        assert source == "presets+custom"
        assert len(inh.rules) == 7


# ---------------------------------------------------------------------------
# 端点函数
# ---------------------------------------------------------------------------


class TestDryRunEndpoint:
    @pytest.fixture(autouse=True)
    def _imports(self):
        from app.api.v1.monitor.inhibition_playground import (
            AlertIn,
            PlaygroundRequest,
            RuleSpec,
            inhibition_dry_run,
        )

        self.inhibition_dry_run = inhibition_dry_run
        self.PlaygroundRequest = PlaygroundRequest
        self.AlertIn = AlertIn
        self.RuleSpec = RuleSpec
        yield

    def _call(self, **kwargs):
        req = self.PlaygroundRequest(**kwargs)
        return self.inhibition_dry_run(req, _user="tester")

    def test_basic_no_match(self):
        resp = self._call(
            alerts=[
                self.AlertIn(labels={"alertname": "A", "severity": "warning"}),
            ]
        )
        assert resp.ok is True
        data = resp.data
        assert data["total_alerts"] == 1
        assert data["surviving_count"] == 1
        assert data["suppressed_count"] == 0

    def test_basic_with_match(self):
        """critical→warning 自定义规则: critical 抑制同 alertname warning."""
        resp = self._call(
            alerts=[
                self.AlertIn(labels={"alertname": "X", "severity": "critical"}),
                self.AlertIn(labels={"alertname": "X", "severity": "warning"}),
            ],
            rules=[
                self.RuleSpec(
                    name="crit-inhibits-warn",
                    source_match={"severity": "critical"},
                    target_match={"severity": "warning"},
                    equal=["alertname"],
                ),
            ],
        )
        data = resp.data
        assert data["total_alerts"] == 2
        assert data["surviving_count"] == 1
        assert data["suppressed_count"] == 1
        assert data["suppressed"][0]["inhibited_by_rule"] == "crit-inhibits-warn"
        assert data["rules_source"] == "custom"

    def test_with_default_presets(self):
        """ZHS 预设规则: ZHSRollbackActive 抑制 ZHSCanaryStageStuck."""
        resp = self._call(
            alerts=[
                self.AlertIn(labels={"alertname": "ZHSRollbackActive", "severity": "critical", "service": "api"}),
                self.AlertIn(labels={"alertname": "ZHSCanaryStageStuck", "severity": "warning", "service": "api"}),
            ],
            use_default_presets=True,
        )
        data = resp.data
        assert data["surviving_count"] == 1
        assert data["suppressed_count"] == 1
        assert data["suppressed"][0]["inhibited_by_rule"] == "zhs_rollback_inhibits_canary"

    def test_empty_alerts(self):
        resp = self._call(alerts=[])
        assert resp.ok is True
        assert resp.data["total_alerts"] == 0
        assert resp.data["surviving_count"] == 0
        assert resp.data["suppressed_count"] == 0

    def test_no_rules_no_suppression(self):
        """无规则 + 不叠加预设: 全部 surviving."""
        resp = self._call(
            alerts=[
                self.AlertIn(labels={"alertname": "A", "severity": "critical"}),
                self.AlertIn(labels={"alertname": "A", "severity": "warning"}),
            ],
        )
        data = resp.data
        assert data["surviving_count"] == 2
        assert data["suppressed_count"] == 0

    def test_equal_mismatch_does_not_inhibit(self):
        """alertname 不同时不抑制."""
        resp = self._call(
            alerts=[
                self.AlertIn(labels={"alertname": "A", "severity": "critical"}),
                self.AlertIn(labels={"alertname": "B", "severity": "warning"}),
            ],
            rules=[
                self.RuleSpec(
                    name="crit-warn",
                    source_match={"severity": "critical"},
                    target_match={"severity": "warning"},
                    equal=["alertname"],
                ),
            ],
        )
        data = resp.data
        assert data["surviving_count"] == 2
        assert data["suppressed_count"] == 0

    def test_rules_used_count(self):
        resp = self._call(
            alerts=[],
            rules=[
                self.RuleSpec(name="r1"),
                self.RuleSpec(name="r2"),
            ],
        )
        assert resp.data["rules_used"] == 2

    def test_does_not_modify_default_inhibitor(self):
        """端点调完不应影响全局默认 inhibitor 的 rules 数量."""
        from app.alert_inhibition import get_default_inhibitor

        before_count = len(get_default_inhibitor().rules)
        self._call(
            alerts=[self.AlertIn(labels={"a": "b"})],
            rules=[self.RuleSpec(name="x", source_match={"a": "b"}, target_match={"c": "d"})],
        )
        after_count = len(get_default_inhibitor().rules)
        assert before_count == after_count


class TestPresetsEndpoint:
    def test_list_presets(self):
        from app.api.v1.monitor.inhibition_playground import list_presets

        resp = list_presets(_user="tester")
        assert resp.ok is True
        data = resp.data
        # ZHS 平台 6 条预设
        assert data["count"] == 6
        names = [p["name"] for p in data["presets"]]
        assert "zhs_rollback_inhibits_canary" in names
        assert "zhs_classic_critical_inhibits_warning" in names
        # 每条都应有 source_match / target_match
        for p in data["presets"]:
            assert "source_match" in p
            assert "target_match" in p
