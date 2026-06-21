"""建议 146 测试: 抑制规则 dry-run 模式.

测试覆盖:
  - AlertInhibitor(dry_run=True) 不真抑制
  - would_suppress() 预测 (与 dry_run 无关, 总返回 surviving)
  - would_suppress_with_reason() 返回 (alert, rule_name) 列表
  - set_dry_run 动态切换
  - classify 在 dry_run 下仍正确计算 suppressed_count
  - filter_alerts 便捷函数 dry_run 参数
  - 实际抑制 vs dry-run 行为对比
  - 多次切回 dry_run=False 不影响主流程
  - dry_run=True 时日志不输出抑制信息
"""

from unittest.mock import patch

import pytest

# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------


@pytest.fixture
def sample_alert():
    def _factory(alertname: str, severity: str = "warning", service: str = "zhs-api", **extra) -> dict:
        labels = {"alertname": alertname, "severity": severity, "service": service}
        labels.update(extra)
        return {
            "status": "firing",
            "labels": labels,
            "annotations": {"summary": f"{alertname} firing"},
        }

    return _factory


@pytest.fixture
def rollback_rule():
    from app.alert_inhibition import InhibitionRule

    return InhibitionRule(
        name="zhs_rollback_inhibits_canary",
        source_matchers={"alertname": "ZHSRollbackActive", "severity": "critical"},
        target_matchers={"alertname": "ZHSCanaryStageStuck"},
        equal=["service"],
    )


# ---------------------------------------------------------------------------
# TestDryRunBasic
# ---------------------------------------------------------------------------


class TestDryRunBasic:
    """dry_run=True 基础行为."""

    def test_dry_run_returns_all(self, sample_alert, rollback_rule):
        from app.alert_inhibition import AlertInhibitor

        inh = AlertInhibitor([rollback_rule], dry_run=True)
        alerts = [
            sample_alert("ZHSRollbackActive", severity="critical", service="canary"),
            sample_alert("ZHSCanaryStageStuck", severity="warning", service="canary"),
        ]
        out = inh.apply(alerts)
        # dry-run: 全部返回
        assert len(out) == 2

    def test_normal_mode_suppresses(self, sample_alert, rollback_rule):
        from app.alert_inhibition import AlertInhibitor

        inh = AlertInhibitor([rollback_rule], dry_run=False)
        alerts = [
            sample_alert("ZHSRollbackActive", severity="critical", service="canary"),
            sample_alert("ZHSCanaryStageStuck", severity="warning", service="canary"),
        ]
        out = inh.apply(alerts)
        # 非 dry-run: 抑制
        assert len(out) == 1
        assert out[0]["labels"]["alertname"] == "ZHSRollbackActive"

    def test_default_dry_run_false(self, sample_alert, rollback_rule):
        from app.alert_inhibition import AlertInhibitor

        inh = AlertInhibitor([rollback_rule])
        assert inh.dry_run is False

    def test_dry_run_property(self):
        from app.alert_inhibition import AlertInhibitor

        inh_t = AlertInhibitor(dry_run=True)
        inh_f = AlertInhibitor(dry_run=False)
        assert inh_t.dry_run is True
        assert inh_f.dry_run is False


# ---------------------------------------------------------------------------
# TestSetDryRun
# ---------------------------------------------------------------------------


class TestSetDryRun:
    """set_dry_run 动态切换."""

    def test_set_dry_run(self, sample_alert, rollback_rule):
        from app.alert_inhibition import AlertInhibitor

        inh = AlertInhibitor([rollback_rule])
        alerts = [
            sample_alert("ZHSRollbackActive", severity="critical", service="canary"),
            sample_alert("ZHSCanaryStageStuck", severity="warning", service="canary"),
        ]
        # 正常: 抑制
        assert len(inh.apply(alerts)) == 1
        # 切到 dry-run
        inh.set_dry_run(True)
        assert inh.dry_run is True
        assert len(inh.apply(alerts)) == 2
        # 切回
        inh.set_dry_run(False)
        assert len(inh.apply(alerts)) == 1


# ---------------------------------------------------------------------------
# TestWouldSuppress
# ---------------------------------------------------------------------------


class TestWouldSuppress:
    """would_suppress / would_suppress_with_reason 预测."""

    def test_would_suppress_returns_surviving(self, sample_alert, rollback_rule):
        from app.alert_inhibition import AlertInhibitor

        inh = AlertInhibitor([rollback_rule], dry_run=True)
        alerts = [
            sample_alert("ZHSRollbackActive", severity="critical", service="canary"),
            sample_alert("ZHSCanaryStageStuck", severity="warning", service="canary"),
        ]
        surviving = inh.would_suppress(alerts)
        # surviving = 不被抑制的
        assert len(surviving) == 1
        assert surviving[0]["labels"]["alertname"] == "ZHSRollbackActive"

    def test_would_suppress_with_reason(self, sample_alert, rollback_rule):
        from app.alert_inhibition import AlertInhibitor

        inh = AlertInhibitor([rollback_rule], dry_run=True)
        alerts = [
            sample_alert("ZHSRollbackActive", severity="critical", service="canary"),
            sample_alert("ZHSCanaryStageStuck", severity="warning", service="canary"),
        ]
        suppressed = inh.would_suppress_with_reason(alerts)
        assert len(suppressed) == 1
        alert, rule_name = suppressed[0]
        assert alert["labels"]["alertname"] == "ZHSCanaryStageStuck"
        assert rule_name == "zhs_rollback_inhibits_canary"

    def test_would_suppress_independent_of_dry_run(self, sample_alert, rollback_rule):
        """无论 dry_run 与否, would_suppress 行为一致."""
        from app.alert_inhibition import AlertInhibitor

        alerts = [
            sample_alert("ZHSRollbackActive", severity="critical", service="canary"),
            sample_alert("ZHSCanaryStageStuck", severity="warning", service="canary"),
        ]
        # dry-run=True
        inh_t = AlertInhibitor([rollback_rule], dry_run=True)
        s_t = inh_t.would_suppress(alerts)
        # dry-run=False
        inh_f = AlertInhibitor([rollback_rule], dry_run=False)
        s_f = inh_f.would_suppress(alerts)
        assert len(s_t) == len(s_f) == 1
        assert s_t[0]["labels"]["alertname"] == s_f[0]["labels"]["alertname"] == "ZHSRollbackActive"

    def test_would_suppress_no_rule(self, sample_alert):
        from app.alert_inhibition import AlertInhibitor

        inh = AlertInhibitor([], dry_run=True)
        alerts = [sample_alert("A"), sample_alert("B")]
        s = inh.would_suppress(alerts)
        assert len(s) == 2

    def test_would_suppress_with_reason_multiple(self, sample_alert, rollback_rule):
        from app.alert_inhibition import AlertInhibitor, InhibitionRule

        # 多条规则
        rule2 = InhibitionRule(
            name="classic_crit",
            source_matchers={"severity": "critical"},
            target_matchers={"severity": "warning"},
            equal=["alertname", "service"],
        )
        inh = AlertInhibitor([rollback_rule, rule2], dry_run=True)
        alerts = [
            sample_alert("X", severity="critical", service="svc"),
            sample_alert("X", severity="warning", service="svc"),
            sample_alert("Y", severity="critical", service="svc"),
            sample_alert("Y", severity="warning", service="svc"),
        ]
        # X-warning 被 X-critical 抑制 (classic)
        # Y-warning 被 Y-critical 抑制 (classic)
        suppressed = inh.would_suppress_with_reason(alerts)
        assert len(suppressed) == 2
        # 全是 classic 规则
        for _, rule_name in suppressed:
            assert rule_name == "classic_crit"


# ---------------------------------------------------------------------------
# TestClassifyWithDryRun
# ---------------------------------------------------------------------------


class TestClassifyWithDryRun:
    """classify 在 dry_run 下仍正确分类."""

    def test_classify_dry_run(self, sample_alert, rollback_rule):
        from app.alert_inhibition import AlertInhibitor

        inh = AlertInhibitor([rollback_rule], dry_run=True)
        alerts = [
            sample_alert("ZHSRollbackActive", severity="critical", service="canary"),
            sample_alert("ZHSCanaryStageStuck", severity="warning", service="canary"),
        ]
        result = inh.classify(alerts)
        # classify 不受 dry_run 影响, 仍正确分类
        assert len(result["surviving"]) == 1
        assert result["suppressed_count"] == 1
        assert result["suppressed"][0]["inhibited_by_rule"] == "zhs_rollback_inhibits_canary"


# ---------------------------------------------------------------------------
# TestFilterAlertsDryRun
# ---------------------------------------------------------------------------


class TestFilterAlertsDryRun:
    """filter_alerts 便捷函数 dry_run 参数."""

    def test_filter_dry_run_true(self, sample_alert):
        from app.alert_inhibition import (
            AlertInhibitor,
            InhibitionRule,
            filter_alerts,
            reset_default_inhibitor,
            set_default_inhibitor,
        )

        rule = InhibitionRule(
            name="r",
            source_matchers={"alertname": "C"},
            target_matchers={"alertname": "W"},
            equal=["service"],
        )
        set_default_inhibitor(AlertInhibitor([rule]))
        alerts = [
            sample_alert("C", severity="critical", service="api"),
            sample_alert("W", severity="warning", service="api"),
        ]
        # dry_run=True: 全部返回
        out = filter_alerts(alerts, dry_run=True)
        assert len(out) == 2
        # dry_run=False: 抑制
        out2 = filter_alerts(alerts, dry_run=False)
        assert len(out2) == 1
        # 默认 (不传): 抑制
        out3 = filter_alerts(alerts)
        assert len(out3) == 1
        reset_default_inhibitor()

    def test_filter_dry_run_restores_state(self, sample_alert):
        """dry_run=True 调用后, inhibitor 状态应恢复."""
        from app.alert_inhibition import (
            AlertInhibitor,
            InhibitionRule,
            filter_alerts,
            reset_default_inhibitor,
            set_default_inhibitor,
        )

        rule = InhibitionRule(
            name="r",
            source_matchers={"alertname": "C"},
            target_matchers={"alertname": "W"},
        )
        inh = AlertInhibitor([rule])
        set_default_inhibitor(inh)
        # 调用前 dry_run=False
        assert inh.dry_run is False
        alerts = [
            sample_alert("C", severity="critical"),
            sample_alert("W", severity="warning"),
        ]
        filter_alerts(alerts, dry_run=True)
        # 调用后状态应恢复
        assert inh.dry_run is False
        reset_default_inhibitor()


# ---------------------------------------------------------------------------
# TestLoggingBehavior
# ---------------------------------------------------------------------------


class TestLoggingBehavior:
    """dry_run=True 时不输出抑制日志."""

    def test_dry_run_no_suppression_log(self, sample_alert, rollback_rule):
        from app.alert_inhibition import AlertInhibitor

        inh = AlertInhibitor([rollback_rule], dry_run=True)
        alerts = [
            sample_alert("ZHSRollbackActive", severity="critical", service="canary"),
            sample_alert("ZHSCanaryStageStuck", severity="warning", service="canary"),
        ]
        with patch("app.alert_inhibition.logger") as mock_logger:
            out = inh.apply(alerts)
            # dry-run: 不应调用 logger.info / logger.warning
            suppression_calls = [
                c
                for c in mock_logger.info.call_args_list + mock_logger.warning.call_args_list
                if len(c.args) > 0 and "suppress" in str(c.args[0])
            ]
            assert len(suppression_calls) == 0

    def test_normal_mode_logs_suppression(self, sample_alert, rollback_rule):
        from app.alert_inhibition import AlertInhibitor

        inh = AlertInhibitor([rollback_rule], dry_run=False)
        alerts = [
            sample_alert("ZHSRollbackActive", severity="critical", service="canary"),
            sample_alert("ZHSCanaryStageStuck", severity="warning", service="canary"),
        ]
        with patch("app.alert_inhibition.logger") as mock_logger:
            out = inh.apply(alerts)
            # 正常: 应有抑制日志
            suppression_calls = [
                c for c in mock_logger.info.call_args_list if len(c.args) > 0 and "suppress" in str(c.args[0])
            ]
            assert len(suppression_calls) >= 1


# ---------------------------------------------------------------------------
# TestComparison
# ---------------------------------------------------------------------------


class TestComparison:
    """dry_run vs 实际抑制行为对比."""

    def test_dry_run_vs_actual_returns_different(self, sample_alert, rollback_rule):
        from app.alert_inhibition import AlertInhibitor

        alerts = [
            sample_alert("ZHSRollbackActive", severity="critical", service="canary"),
            sample_alert("ZHSCanaryStageStuck", severity="warning", service="canary"),
        ]
        inh_dry = AlertInhibitor([rollback_rule], dry_run=True)
        inh_real = AlertInhibitor([rollback_rule], dry_run=False)
        out_dry = inh_dry.apply(alerts)
        out_real = inh_real.apply(alerts)
        # dry-run 多 1 条
        assert len(out_dry) == len(out_real) + 1

    def test_would_suppress_count_matches_actual_suppression(self, sample_alert, rollback_rule):
        from app.alert_inhibition import AlertInhibitor

        alerts = [
            sample_alert("ZHSRollbackActive", severity="critical", service="canary"),
            sample_alert("ZHSCanaryStageStuck", severity="warning", service="canary"),
            sample_alert("Other", severity="info", service="canary"),
        ]
        inh_real = AlertInhibitor([rollback_rule], dry_run=False)
        out_real = inh_real.apply(alerts)
        # 实际抑制掉的 = 全部 - surviving
        suppressed_count = len(alerts) - len(out_real)
        # dry-run 预测
        inh_dry = AlertInhibitor([rollback_rule], dry_run=True)
        suppressed_pairs = inh_dry.would_suppress_with_reason(alerts)
        # 应一致
        assert suppressed_count == len(suppressed_pairs)


# ---------------------------------------------------------------------------
# TestProductionIntegration
# ---------------------------------------------------------------------------


class TestProductionIntegration:
    """集成: dry-run 模式用 ZHS 预设."""

    def test_zhs_presets_dry_run(self, sample_alert):
        from app.alert_inhibition import get_default_inhibitor

        inh = get_default_inhibitor()
        inh.set_dry_run(True)
        alerts = [
            sample_alert("ZHSRollbackActive", severity="critical", service="canary"),
            sample_alert("ZHSCanaryStageStuck", severity="warning", service="canary"),
            sample_alert("ZHSCanaryRatioMismatch", severity="warning", service="canary"),
        ]
        # dry-run: 全部返回
        out = inh.apply(alerts)
        assert len(out) == 3
        # 预测有 2 条会被抑制
        suppressed = inh.would_suppress_with_reason(alerts)
        assert len(suppressed) == 2
        # 切回
        inh.set_dry_run(False)
        out2 = inh.apply(alerts)
        # 实际抑制: 1 条 (rollback)
        assert len(out2) == 1
