"""canary_monitor_bridge 单元测试 (Phase 8)."""

import asyncio
import sys
from pathlib import Path
from unittest.mock import MagicMock

import pytest

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))


class FakeMonitor:
    """模拟 cached_expiration_monitor, is_running 可控."""

    def __init__(self, running: bool = True) -> None:
        self.is_running = running


class FakeCanaryController:
    """模拟 CanaryStageController, 记录 mark_failure 调用."""

    def __init__(self) -> None:
        self.calls: list[dict] = []

    def mark_failure(self, reason: str = "") -> MagicMock:
        ev = MagicMock()
        ev.event_type = "auto_rollback"
        ev.from_stage = "10%"
        ev.to_stage = "0%"
        self.calls.append({"reason": reason, "event": ev})
        return ev


@pytest.fixture
def patched_bridge(monkeypatch):
    """重置 canary_monitor_bridge 模块状态 + 注入 mock monitor/controller."""
    from app.services import canary_monitor_bridge as bridge

    # 重置模块全局
    monkeypatch.setattr(bridge, "_canary_controller", None)
    monkeypatch.setattr(bridge, "_bridge_task", None)
    monkeypatch.setattr(bridge, "_stopping", False)

    fake_monitor = FakeMonitor(running=True)
    fake_ctrl = FakeCanaryController()

    def fake_get_monitor():
        return fake_monitor

    def fake_get_canary():
        return fake_ctrl

    monkeypatch.setattr(bridge, "_get_monitor", fake_get_monitor)
    monkeypatch.setattr(bridge, "_get_canary_controller", fake_get_canary)
    return bridge, fake_monitor, fake_ctrl


def test_healthy_monitor_does_not_trigger(patched_bridge):
    """monitor 持续运行 -> fail_streak 恒为 0, 不触发 mark_failure."""
    bridge, fake_monitor, fake_ctrl = patched_bridge
    fake_monitor.is_running = True
    state = {
        "check_interval": 30,
        "fail_threshold": 4,
        "fail_streak": 0,
        "last_check_ts": 0.0,
        "last_down_ts": 0.0,
        "triggered": False,
        "last_trigger_ts": 0.0,
    }

    for _ in range(10):
        bridge._check_monitor_and_maybe_rollback(state)

    assert state["fail_streak"] == 0
    assert state["triggered"] is False
    assert len(fake_ctrl.calls) == 0


def test_single_drop_does_not_trigger(patched_bridge):
    """单次掉线 (fail_streak=1) 未达阈值 -> 不触发."""
    bridge, fake_monitor, fake_ctrl = patched_bridge
    fake_monitor.is_running = False
    state = {
        "check_interval": 30,
        "fail_threshold": 4,
        "fail_streak": 0,
        "last_check_ts": 0.0,
        "last_down_ts": 0.0,
        "triggered": False,
        "last_trigger_ts": 0.0,
    }

    bridge._check_monitor_and_maybe_rollback(state)
    assert state["fail_streak"] == 1
    assert state["triggered"] is False
    assert len(fake_ctrl.calls) == 0


def test_continuous_drop_triggers_at_threshold(patched_bridge):
    """连续 4 次掉线 -> 触发 mark_failure, 之后恢复运行不再触发."""
    bridge, fake_monitor, fake_ctrl = patched_bridge
    fake_monitor.is_running = False
    state = {
        "check_interval": 30,
        "fail_threshold": 4,
        "fail_streak": 0,
        "last_check_ts": 0.0,
        "last_down_ts": 0.0,
        "triggered": False,
        "last_trigger_ts": 0.0,
    }

    # 连续 5 次掉线
    for i in range(5):
        bridge._check_monitor_and_maybe_rollback(state)
        print(f"  iter {i+1}: fail_streak={state['fail_streak']}, triggered={state['triggered']}")

    assert state["fail_streak"] == 5
    assert state["triggered"] is True
    # mark_failure 恰好调一次 (第 4 次时触发, 之后 triggered=True 阻止重复)
    assert len(fake_ctrl.calls) == 1
    assert "cached_expiration_monitor" in fake_ctrl.calls[0]["reason"]
    assert "agent_buy" in fake_ctrl.calls[0]["reason"]


def test_recovery_resets_fail_streak(patched_bridge):
    """掉线 2 次后恢复, fail_streak 应清零."""
    bridge, fake_monitor, fake_ctrl = patched_bridge
    state = {
        "check_interval": 30,
        "fail_threshold": 4,
        "fail_streak": 0,
        "last_check_ts": 0.0,
        "last_down_ts": 0.0,
        "triggered": False,
        "last_trigger_ts": 0.0,
    }

    # 2 次掉线
    fake_monitor.is_running = False
    bridge._check_monitor_and_maybe_rollback(state)
    bridge._check_monitor_and_maybe_rollback(state)
    assert state["fail_streak"] == 2

    # 恢复
    fake_monitor.is_running = True
    bridge._check_monitor_and_maybe_rollback(state)
    assert state["fail_streak"] == 0


def test_disabled_via_env(monkeypatch):
    """ZHS_CANARY_MONITOR_BRIDGE_DISABLED=1 -> 启动后 task 为 None."""
    monkeypatch.setenv("ZHS_CANARY_MONITOR_BRIDGE_DISABLED", "1")
    from app.services import canary_monitor_bridge as bridge

    monkeypatch.setattr(bridge, "_canary_controller", None)
    monkeypatch.setattr(bridge, "_bridge_task", None)
    monkeypatch.setattr(bridge, "_stopping", False)

    asyncio.run(bridge.start_canary_monitor_bridge())
    assert bridge._bridge_task is None


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
