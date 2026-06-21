"""建议 136 测试: Canary 紧急回滚告警 (alertmanager 集成).

测试:
  - auto_rollback 触发时调用 _notify_auto_rollback
  - zhs_canary_rollback_active gauge 被设为 1
  - alert_service.push_alert 被调用 (mock)
  - 告警失败不影响 controller 状态
  - 仅 auto_rollback 触发, manual rollback 不触发
  - prometheus rules.yml 包含 ZHSRollbackActive 规则
  - ZHSCanaryStuckMidStage / ZHSShadowRatioMismatch 规则存在
"""

import logging
from pathlib import Path
from unittest.mock import patch

import pytest

# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------


@pytest.fixture
def tmp_state_file(tmp_path):
    return str(tmp_path / "canary_alert_state.json")


@pytest.fixture
def controller(tmp_state_file):
    from app import canary_stages as _cs
    from app.canary_stages import CanaryStageController

    # 测试隔离: 清空 _BG_THREADS 列表, 避免上轮后台线程干扰
    if hasattr(_cs, "_BG_THREADS"):
        _cs._BG_THREADS.clear()
    return CanaryStageController(
        state_file=tmp_state_file,
        cooldown_seconds=0.0,
        failure_threshold=3,
    )


# ---------------------------------------------------------------------------
# TestAutoRollbackTriggersAlert
# ---------------------------------------------------------------------------


class TestAutoRollbackTriggersAlert:
    """auto_rollback 触发时 _notify_auto_rollback 被调用."""

    def test_notify_called_on_threshold(self, controller):
        """mark_failure 达阈值时 _notify_auto_rollback 被调用."""
        with patch.object(controller, "_notify_auto_rollback") as mock_notify:
            controller.mark_failure("reason1")
            controller.mark_failure("reason2")
            assert mock_notify.call_count == 0  # 未达阈值
            controller.mark_failure("reason3")  # 触发
            assert mock_notify.call_count == 1

    def test_notify_called_with_event_and_reason(self, controller):
        """通知回调拿到 event 对象 + reason."""
        with patch.object(controller, "_notify_auto_rollback") as mock_notify:
            # 阈值=3, 调满 3 次才会触发 _notify_auto_rollback
            controller.mark_failure("v2 报错率升高")
            controller.mark_failure("v2 报错率升高")
            assert mock_notify.call_count == 0
            controller.mark_failure("v2 报错率升高")
            assert mock_notify.call_count == 1
            ev = mock_notify.call_args[0][0]
            reason = mock_notify.call_args[0][1]
            assert ev.event_type == "auto_rollback"
            assert "v2 报错率升高" in reason

    def test_below_threshold_does_not_notify(self, controller):
        """未达阈值仅记录, 不通知."""
        with patch.object(controller, "_notify_auto_rollback") as mock_notify:
            controller.mark_failure("fail 1")
            controller.mark_failure("fail 2")
            assert mock_notify.call_count == 0
            assert controller.state().failures_in_stage == 2


# ---------------------------------------------------------------------------
# TestPrometheusGaugeOnRollback
# ---------------------------------------------------------------------------


class TestPrometheusGaugeOnRollback:
    """auto_rollback 时 zhs_canary_rollback_active gauge 被设为 1."""

    def test_rollback_gauge_set_to_1(self, controller):
        from app.canary_metrics import CANARY_ROLLBACK_GAUGE

        # 初始为 0
        prev = CANARY_ROLLBACK_GAUGE._value.get() if CANARY_ROLLBACK_GAUGE else 0
        # 触发 rollback
        controller.mark_failure("a")
        controller.mark_failure("b")
        controller.mark_failure("c")
        # gauge 应为 1
        if CANARY_ROLLBACK_GAUGE is not None:
            assert CANARY_ROLLBACK_GAUGE._value.get() == 1.0

    def test_gauge_set_even_without_alert_service(self, controller, monkeypatch):
        """alert_service 不可用时 gauge 仍应被设."""
        # 临时把 alert_service 标记为不可用, 但保留 sys.modules 中的缓存以便恢复
        import sys

        from app.canary_metrics import CANARY_ROLLBACK_GAUGE

        original = sys.modules.get("app.services.alert_service")
        sys.modules["app.services.alert_service"] = None  # Python 视为导入失败
        try:
            controller.mark_failure("x")
            controller.mark_failure("y")
            controller.mark_failure("z")
            if CANARY_ROLLBACK_GAUGE is not None:
                assert CANARY_ROLLBACK_GAUGE._value.get() == 1.0
        finally:
            # 恢复原模块, 不要从 sys.modules 删除 (会让后续 import 失败)
            if original is not None:
                sys.modules["app.services.alert_service"] = original
            else:
                sys.modules.pop("app.services.alert_service", None)


# ---------------------------------------------------------------------------
# TestAlertServiceIntegration
# ---------------------------------------------------------------------------


class TestAlertServiceIntegration:
    """auto_rollback 时 push_alert 被调用."""

    def test_push_alert_called(self, controller, monkeypatch):
        """push_alert 接收 (title, message, severity='critical')."""
        called = []

        async def _fake_push(title, message, severity="warning"):
            called.append((title, message, severity))
            return {"dingtalk": False, "wechat": False, "feishu": False, "email": False}

        # patch alert_service.push_alert (避免依赖 import 路径)
        from app.services import alert_service

        monkeypatch.setattr(alert_service, "push_alert", _fake_push)
        # 同步推告警 (建议 136: 同步模式, 不用 join)
        controller.mark_failure("a")
        controller.mark_failure("b")
        controller.mark_failure("c")
        # 验证 push_alert 被调用
        assert len(called) == 1
        title, message, severity = called[0]
        assert "Canary" in title
        assert severity == "critical"

    def test_alert_failure_does_not_break_controller(self, controller, monkeypatch):
        """告警失败不影响 controller 状态."""

        async def _failing_push(*args, **kwargs):
            raise RuntimeError("alert service down")

        from app.services import alert_service

        monkeypatch.setattr(alert_service, "push_alert", _failing_push)
        # 不应抛
        controller.mark_failure("a")
        controller.mark_failure("b")
        controller.mark_failure("c")
        # controller 状态正确
        assert controller.current_stage().value == "0%"
        s = controller.state()
        assert s.failures_in_stage == 0  # 已重置


# ---------------------------------------------------------------------------
# TestManualRollbackDoesNotAlert
# ---------------------------------------------------------------------------


class TestManualRollbackDoesNotAlert:
    """人工 rollback 不触发告警 (仅 auto_rollback 触发)."""

    def test_manual_rollback_no_notify(self, controller):
        with patch.object(controller, "_notify_auto_rollback") as mock_notify:
            # 先 promote 到 1%
            controller.promote(actor="t", reason="")
            # 人工 rollback
            controller.rollback(actor="human", reason="决策变更", auto=False)
            # 不应通知
            assert mock_notify.call_count == 0

    def test_api_rollback_no_notify(self, controller):
        with patch.object(controller, "_notify_auto_rollback") as mock_notify:
            controller.promote(actor="t", reason="")
            controller.promote(actor="t", reason="")
            # 模拟 API 调用 (auto=False)
            controller.rollback(actor="api", reason="手动", auto=False)
            assert mock_notify.call_count == 0


# ---------------------------------------------------------------------------
# TestPrometheusRulesYAML
# ---------------------------------------------------------------------------


class TestPrometheusRulesYAML:
    """prometheus rules.yml 包含建议 136 告警规则."""

    @pytest.fixture
    def rules_path(self):
        return Path(__file__).resolve().parent.parent / "deploy" / "helm" / "zhs-platform" / "prometheus" / "rules.yml"

    def test_rules_file_exists(self, rules_path):
        assert rules_path.exists(), f"rules.yml 不存在: {rules_path}"

    def test_rollback_active_alert_present(self, rules_path):
        """ZHSRollbackActive 告警规则存在."""
        import yaml

        with open(rules_path, encoding="utf-8") as f:
            data = yaml.safe_load(f)
        # 找出所有 alert name
        alerts = []
        for group in data.get("groups", []):
            for rule in group.get("rules", []):
                if "alert" in rule:
                    alerts.append(rule["alert"])
        assert "ZHSRollbackActive" in alerts

    def test_canary_stuck_mid_stage_alert_present(self, rules_path):
        """ZHSCanaryStuckMidStage 告警规则存在."""
        import yaml

        with open(rules_path, encoding="utf-8") as f:
            data = yaml.safe_load(f)
        alerts = []
        for group in data.get("groups", []):
            for rule in group.get("rules", []):
                if "alert" in rule:
                    alerts.append(rule["alert"])
        assert "ZHSCanaryStuckMidStage" in alerts

    def test_shadow_ratio_mismatch_alert_present(self, rules_path):
        """ZHSShadowRatioMismatch 告警规则存在."""
        import yaml

        with open(rules_path, encoding="utf-8") as f:
            data = yaml.safe_load(f)
        alerts = []
        for group in data.get("groups", []):
            for rule in group.get("rules", []):
                if "alert" in rule:
                    alerts.append(rule["alert"])
        assert "ZHSShadowRatioMismatch" in alerts

    def test_rollback_active_severity_critical(self, rules_path):
        """ZHSRollbackActive severity=critical."""
        import yaml

        with open(rules_path, encoding="utf-8") as f:
            data = yaml.safe_load(f)
        for group in data.get("groups", []):
            for rule in group.get("rules", []):
                if rule.get("alert") == "ZHSRollbackActive":
                    assert rule["labels"]["severity"] == "critical"
                    return
        pytest.fail("ZHSRollbackActive 未找到")

    def test_rollback_active_uses_correct_metric(self, rules_path):
        """ZHSRollbackActive 表达式用 zhs_canary_rollback_active."""
        import yaml

        with open(rules_path, encoding="utf-8") as f:
            data = yaml.safe_load(f)
        for group in data.get("groups", []):
            for rule in group.get("rules", []):
                if rule.get("alert") == "ZHSRollbackActive":
                    assert "zhs_canary_rollback_active" in rule["expr"]
                    return
        pytest.fail("ZHSRollbackActive 未找到")


# ---------------------------------------------------------------------------
# TestAlertMessageContent
# ---------------------------------------------------------------------------


class TestAlertMessageContent:
    """告警消息内容完整性."""

    def test_message_contains_reason_and_stages(self, controller, monkeypatch):
        """告警 message 含 reason / from_stage / to_stage."""
        called = []

        async def _fake_push(title, message, severity="warning"):
            called.append((title, message, severity))
            return {}

        from app.services import alert_service

        monkeypatch.setattr(alert_service, "push_alert", _fake_push)
        # promote 到 10%
        controller.promote(actor="t", reason="")
        controller.promote(actor="t", reason="")
        controller.mark_failure("v2 5xx 突增")
        controller.mark_failure("v2 5xx 突增")
        controller.mark_failure("v2 5xx 突增")
        # 同步推告警, 不需要 join
        assert len(called) == 1
        title, message, _ = called[0]
        assert "10%" in title  # from_stage
        assert "0%" in title  # to_stage
        assert "v2 5xx 突增" in message  # reason
        assert "10%" in message
        assert "0%" in message


# ---------------------------------------------------------------------------
# TestLogging
# ---------------------------------------------------------------------------


class TestLogging:
    """结构化日志记录."""

    def test_log_warning_on_auto_rollback(self, controller, caplog):
        with caplog.at_level(logging.WARNING):
            controller.mark_failure("a")
            controller.mark_failure("b")
            controller.mark_failure("c")
        # 验证日志
        warning_records = [r for r in caplog.records if r.levelno >= logging.WARNING]
        assert any("canary auto_rollback" in r.message for r in warning_records)
