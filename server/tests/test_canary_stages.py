"""建议 126 测试: CanaryStageController 阶段门控."""

import json
import os
import threading

import pytest

# ---------------------------------------------------------------------------
# 阶段定义 / 顺序测试
# ---------------------------------------------------------------------------


class TestStageDefinition:
    """阶段定义 + 比例映射测试."""

    def test_stages_count(self):
        from app.canary_stages import STAGE_ORDER, Stage

        assert len(STAGE_ORDER) == 5
        assert STAGE_ORDER[0] == Stage.STAGE_0
        assert STAGE_ORDER[-1] == Stage.STAGE_4

    def test_stage_ratios(self):
        from app.canary_stages import Stage

        assert Stage.STAGE_0.ratio == 0.0
        assert Stage.STAGE_1.ratio == 0.01
        assert Stage.STAGE_2.ratio == 0.10
        assert Stage.STAGE_3.ratio == 0.50
        assert Stage.STAGE_4.ratio == 1.0

    def test_stage_order_increasing(self):
        from app.canary_stages import STAGE_ORDER

        ratios = [s.ratio for s in STAGE_ORDER]
        for i in range(1, len(ratios)):
            assert ratios[i] > ratios[i - 1], f"{ratios[i - 1]} >= {ratios[i]}"


# ---------------------------------------------------------------------------
# Controller 基础操作测试
# ---------------------------------------------------------------------------


class TestCanaryStageController:
    """controller 基础操作."""

    def test_initial_state(self):
        from app.canary_stages import CanaryStageController, Stage

        ctrl = CanaryStageController()
        assert ctrl.current_stage() == Stage.STAGE_0
        assert ctrl.current_ratio() == 0.0
        assert ctrl.failures_count() == 0
        assert ctrl.is_in_cooldown() is False

    def test_promote_one_stage(self):
        from app.canary_stages import CanaryStageController, Stage

        ctrl = CanaryStageController()
        ev = ctrl.promote(actor="tester", reason="手动提升")
        assert ev.event_type == "promote"
        assert ev.from_stage == "0%"
        assert ev.to_stage == "1%"
        assert ctrl.current_stage() == Stage.STAGE_1
        assert ctrl.current_ratio() == pytest.approx(0.01)

    def test_promote_max_stage(self):
        from app.canary_stages import CanaryStageController, Stage

        ctrl = CanaryStageController()
        # STAGE_0 → STAGE_1 → STAGE_2 → STAGE_3 → STAGE_4
        for i in range(4):
            ctrl._state.last_change_ts = 0  # 强制绕过 cooldown
            ev = ctrl.promote(reason=f"step {i}")
        # 第 5 次 promote 应 noop
        ctrl._state.last_change_ts = 0
        ev = ctrl.promote(reason="超出")
        assert ev.event_type == "noop"
        assert ctrl.current_stage() == Stage.STAGE_4

    def test_rollback_one_stage(self):
        from app.canary_stages import CanaryStageController, Stage

        ctrl = CanaryStageController()
        # 先到 STAGE_2
        ctrl._state.last_change_ts = 0
        ctrl.promote(reason="step 1")
        ctrl._state.last_change_ts = 0
        ctrl.promote(reason="step 2")
        assert ctrl.current_stage() == Stage.STAGE_2
        # 回滚
        ev = ctrl.rollback(reason="v2 报错")
        assert ev.event_type == "rollback"
        assert ev.to_stage == "1%"
        assert ctrl.current_stage() == Stage.STAGE_1

    def test_rollback_at_min(self):
        from app.canary_stages import CanaryStageController

        ctrl = CanaryStageController()
        # 已在 STAGE_0, rollback 应 noop
        ev = ctrl.rollback(reason="测试")
        assert ev.event_type == "noop"
        assert ev.to_stage == "0%"


# ---------------------------------------------------------------------------
# Cooldown 测试
# ---------------------------------------------------------------------------


class TestCooldown:
    """cooldown 行为测试."""

    def test_promote_within_cooldown_raises(self):
        from app.canary_stages import CanaryStageController, StageCooldownError

        ctrl = CanaryStageController(cooldown_seconds=10.0)
        ctrl.promote(reason="first")
        # 立刻 promote 应抛 StageCooldownError
        with pytest.raises(StageCooldownError):
            ctrl.promote(reason="too fast")

    def test_cooldown_remaining_decreases(self):
        from app.canary_stages import CanaryStageController

        fake_now = [1000.0]
        ctrl = CanaryStageController(
            cooldown_seconds=10.0,
            clock=lambda: fake_now[0],
        )
        ctrl.promote(reason="first")
        # 推进 3s
        fake_now[0] += 3.0
        assert ctrl.cooldown_remaining() == pytest.approx(7.0)
        # 推进 8s
        fake_now[0] += 5.0
        assert ctrl.cooldown_remaining() == pytest.approx(2.0)
        # 推进 12s
        fake_now[0] += 10.0
        assert ctrl.cooldown_remaining() == 0.0
        # 此时 promote 不抛
        ctrl.promote(reason="after cooldown")

    def test_rollback_bypasses_cooldown(self):
        from app.canary_stages import CanaryStageController, Stage

        ctrl = CanaryStageController(cooldown_seconds=10.0)
        ctrl._state.last_change_ts = 0
        ctrl.promote(reason="1")
        ctrl._state.last_change_ts = 0
        ctrl.promote(reason="2")
        # rollback 不受 cooldown 限制
        ev = ctrl.rollback(reason="紧急回滚")
        assert ev.event_type == "rollback"
        assert ctrl.current_stage() == Stage.STAGE_1


# ---------------------------------------------------------------------------
# 失败阈值 + 自动回滚
# ---------------------------------------------------------------------------


class TestAutoRollback:
    """失败累积到阈值后自动回滚."""

    def test_mark_failure_below_threshold(self):
        from app.canary_stages import CanaryStageController, Stage

        ctrl = CanaryStageController(failure_threshold=3)
        ctrl._state.last_change_ts = 0
        ctrl.promote(reason="1%")
        # 2 次失败
        for i in range(2):
            ev = ctrl.mark_failure(reason=f"fail {i}")
            assert ev.event_type == "failure"
        assert ctrl.current_stage() == Stage.STAGE_1
        assert ctrl.failures_count() == 2

    def test_mark_failure_triggers_auto_rollback(self):
        from app.canary_stages import CanaryStageController, Stage

        ctrl = CanaryStageController(failure_threshold=3)
        ctrl._state.last_change_ts = 0
        ctrl.promote(reason="1%")
        # 第 3 次失败应触发 auto_rollback
        for i in range(2):
            ctrl.mark_failure(reason=f"fail {i}")
        ev = ctrl.mark_failure(reason="trigger")
        assert ev.event_type == "auto_rollback"
        assert ev.to_stage == "0%"
        assert ctrl.current_stage() == Stage.STAGE_0
        # 回滚后 failures 应重置
        assert ctrl.failures_count() == 0

    def test_auto_rollback_recorded_in_history(self):
        from app.canary_stages import CanaryStageController

        ctrl = CanaryStageController(failure_threshold=2)
        ctrl._state.last_change_ts = 0
        ctrl.promote(reason="1%")
        ctrl._state.last_change_ts = 0
        ctrl.promote(reason="10%")
        # 2 次失败
        ctrl.mark_failure(reason="a")
        ctrl.mark_failure(reason="b")
        # history 应包含 auto_rollback
        s = ctrl.state()
        assert any(h.get("event_type") == "auto_rollback" for h in s.history)


# ---------------------------------------------------------------------------
# Reset / 状态查询
# ---------------------------------------------------------------------------


class TestResetAndState:
    """reset + 状态查询."""

    def test_reset_to_stage_0(self):
        from app.canary_stages import CanaryStageController, Stage

        ctrl = CanaryStageController()
        # 推进到 STAGE_3
        for _ in range(3):
            ctrl._state.last_change_ts = 0
            ctrl.promote(reason="step")
        assert ctrl.current_stage() == Stage.STAGE_3
        # reset
        ev = ctrl.reset(reason="新灰度周期")
        assert ev.event_type == "reset"
        assert ev.to_stage == "0%"
        assert ctrl.current_stage() == Stage.STAGE_0

    def test_state_returns_canary_state(self):
        from app.canary_stages import CanaryStageController, CanaryState

        ctrl = CanaryStageController()
        s = ctrl.state()
        assert isinstance(s, CanaryState)
        assert s.current_stage == "0%"

    def test_mark_traffic_increments(self):
        from app.canary_stages import CanaryStageController

        ctrl = CanaryStageController()
        ctrl.mark_traffic(10)
        ctrl.mark_traffic(5)
        assert ctrl.state().total_traffic_in_stage == 15


# ---------------------------------------------------------------------------
# 持久化测试
# ---------------------------------------------------------------------------


class TestPersistence:
    """状态持久化到 JSON 测试."""

    def test_save_and_load_state(self, tmp_path):
        from app.canary_stages import CanaryStageController

        state_file = str(tmp_path / "canary_state.json")
        # 创建 controller, promote 一次
        ctrl1 = CanaryStageController(state_file=state_file)
        ctrl1._state.last_change_ts = 0
        ctrl1.promote(reason="test save")
        # 验证文件存在
        assert os.path.exists(state_file)
        # 创建新 controller, 应从文件恢复
        ctrl2 = CanaryStageController(state_file=state_file)
        from app.canary_stages import Stage

        assert ctrl2.current_stage() == Stage.STAGE_1

    def test_state_file_contains_history(self, tmp_path):
        from app.canary_stages import CanaryStageController

        state_file = str(tmp_path / "canary_state.json")
        ctrl = CanaryStageController(state_file=state_file)
        ctrl._state.last_change_ts = 0
        ctrl.promote(reason="test")
        with open(state_file, encoding="utf-8") as f:
            data = json.load(f)
        assert "current_stage" in data
        assert "history" in data
        assert len(data["history"]) >= 1
        assert data["history"][0]["to_stage"] == "1%"

    def test_corrupt_state_file_ignored(self, tmp_path):
        from app.canary_stages import CanaryStageController, Stage

        state_file = str(tmp_path / "canary_state.json")
        with open(state_file, "w", encoding="utf-8") as f:
            f.write("invalid json {{{")
        # 应能 fallback 到默认状态
        ctrl = CanaryStageController(state_file=state_file)
        assert ctrl.current_stage() == Stage.STAGE_0


# ---------------------------------------------------------------------------
# 多线程安全
# ---------------------------------------------------------------------------


class TestThreadSafety:
    """并发操作不破坏状态."""

    def test_concurrent_promote_serializable(self):
        from app.canary_stages import CanaryStageController, Stage

        ctrl = CanaryStageController()
        results = []

        def worker(i):
            try:
                ctrl._state.last_change_ts = 0  # 强制绕过 cooldown
                ev = ctrl.promote(reason=f"thread {i}")
                results.append(ev)
            except Exception as e:
                results.append(e)

        threads = [threading.Thread(target=worker, args=(i,)) for i in range(10)]
        for t in threads:
            t.start()
        for t in threads:
            t.join()

        # 至少有一些 promote 成功
        assert len(results) == 10
        # 不崩是核心
        assert ctrl.current_stage() in (Stage.STAGE_1, Stage.STAGE_2, Stage.STAGE_3, Stage.STAGE_4)


# ---------------------------------------------------------------------------
# 全局默认实例
# ---------------------------------------------------------------------------


class TestGlobalController:
    """全局默认 controller 单例."""

    def test_singleton(self):
        from app.canary_stages import get_default_controller

        c1 = get_default_controller()
        c2 = get_default_controller()
        assert c1 is c2

    def test_reset_clears_singleton(self):
        from app.canary_stages import get_default_controller, reset_default_controller

        c1 = get_default_controller()
        reset_default_controller()
        c2 = get_default_controller()
        assert c1 is not c2
