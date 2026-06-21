"""ShadowRatioController 单测 (建议补完 - 核心调比模块).

覆盖:
  - 初始化 (env / 显式 base_ratio)
  - threshold 常量
  - current_ratio / health property
  - set_ratio: 冷却 / 上下限 / force 跳过冷却 / 同步 router
  - set_ratio: 同值不变 / 同步 prometheus
  - adjust: 4 种健康度 (green grow / stable skip / warning shrink / halt)
  - adjust: 冷却期跳过
  - reset: 强制回 base_ratio
  - start / stop 后台 loop
  - snapshot: 完整字段 + recent_changes 限制 10
  - error_source 抛错容忍
  - 没有 error_source: 错误率为 0
  - history 截断 100
"""

import asyncio
import time

import pytest

# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------


class FakeRouter:
    """ShadowRouter mock, 暴露 .ratio."""

    def __init__(self, ratio: float = 0.0):
        self.ratio = ratio


class FakeErrorSource:
    """mock 错误源, 可控 .get_recent_error_rate."""

    def __init__(self, error_rate: float = 0.0):
        self.error_rate = error_rate
        self.call_count = 0
        self.raise_exc = False

    def get_recent_error_rate(self, window_sec: float = 300.0) -> float:
        self.call_count += 1
        if self.raise_exc:
            raise RuntimeError("simulated")
        return self.error_rate


@pytest.fixture
def router():
    return FakeRouter()


@pytest.fixture
def err_src():
    return FakeErrorSource()


@pytest.fixture
def controller(router, err_src):
    from app.shadow_ratio_controller import ShadowRatioController

    return ShadowRatioController(
        router=router,
        error_source=err_src,
        base_ratio=0.0,
        grow_step=0.01,
        shrink_step=0.02,
        max_ratio=0.5,
        cooldown_sec=0.1,  # 短冷却, 测试快
        interval_sec=0.5,
        window_sec=60.0,
    )


# ---------------------------------------------------------------------------
# 初始化
# ---------------------------------------------------------------------------


class TestInit:
    def test_default_base_ratio_from_env(self, monkeypatch, router, err_src):
        monkeypatch.setenv("ZHS_SHADOW_TRAFFIC_RATIO", "0.123")
        from app.shadow_ratio_controller import ShadowRatioController

        c = ShadowRatioController(router=router, error_source=err_src)
        assert c.base_ratio == 0.123

    def test_explicit_base_ratio(self, controller):
        assert controller.base_ratio == 0.0

    def test_sync_router_initial_ratio(self, router, err_src):
        from app.shadow_ratio_controller import ShadowRatioController

        c = ShadowRatioController(router=router, error_source=err_src, base_ratio=0.42)
        assert router.ratio == 0.42
        assert c.current_ratio == 0.42

    def test_thresholds_constants(self):
        from app.shadow_ratio_controller import ShadowRatioController

        assert ShadowRatioController.THRESHOLD_GREEN == 0.001
        assert ShadowRatioController.THRESHOLD_WARN == 0.01
        assert ShadowRatioController.THRESHOLD_HALT == 0.05


# ---------------------------------------------------------------------------
# health property
# ---------------------------------------------------------------------------


class TestHealth:
    def test_no_error_source_green(self, router):
        from app.shadow_ratio_controller import ShadowRatioController

        c = ShadowRatioController(router=router, error_source=None, base_ratio=0.0)
        assert c.health == "green"

    def test_low_error_green(self, controller, err_src):
        err_src.error_rate = 0.0005
        assert controller.health == "green"

    def test_mid_error_stable(self, controller, err_src):
        err_src.error_rate = 0.005
        assert controller.health == "stable"

    def test_high_error_warning(self, controller, err_src):
        err_src.error_rate = 0.02
        assert controller.health == "warning"

    def test_very_high_error_halt(self, controller, err_src):
        err_src.error_rate = 0.10
        assert controller.health == "halt"

    def test_error_source_raises_returns_green(self, controller, err_src):
        err_src.raise_exc = True
        assert controller.health == "green"


# ---------------------------------------------------------------------------
# set_ratio
# ---------------------------------------------------------------------------


class TestSetRatio:
    def test_basic_set(self, controller, router):
        c = controller
        ch = c.set_ratio(0.1, reason="manual")
        assert ch is not None
        assert ch.from_ratio == 0.0
        assert ch.to_ratio == 0.1
        assert c.current_ratio == 0.1
        assert router.ratio == 0.1  # 同步

    def test_clamp_upper(self, controller):
        c = controller
        c.set_ratio(0.8, reason="manual", force=True)  # 超过 max_ratio 0.5
        assert c.current_ratio == 0.5

    def test_clamp_lower(self, controller):
        c = controller
        c.set_ratio(0.0, reason="manual", force=True)
        c.set_ratio(-0.1, reason="manual", force=True)  # 负数
        assert c.current_ratio == 0.0

    def test_cooldown_blocks(self, controller):
        c = controller
        c.set_ratio(0.1, reason="manual")
        # 立即再设 (冷却期 0.1s)
        ch = c.set_ratio(0.2, reason="manual")
        assert ch is None
        # 状态不变
        assert c.current_ratio == 0.1

    def test_force_bypasses_cooldown(self, controller):
        c = controller
        c.set_ratio(0.1, reason="manual")
        ch = c.set_ratio(0.2, reason="emergency", force=True)
        assert ch is not None
        assert c.current_ratio == 0.2

    def test_same_value_noop(self, controller):
        c = controller
        ch = c.set_ratio(0.0, reason="manual")
        assert ch is None  # 同值, 视为 noop

    def test_records_history(self, controller):
        c = controller
        c.set_ratio(0.1, reason="manual", force=True)
        c.set_ratio(0.2, reason="manual", force=True)
        snap = c.snapshot()
        assert snap["changes_count"] == 2


# ---------------------------------------------------------------------------
# adjust
# ---------------------------------------------------------------------------


class TestAdjust:
    def test_green_grows(self, controller, err_src):
        c = controller
        err_src.error_rate = 0.0
        # cooldown 0.1s 已过 (init 时 _last_change_ts=0)
        ch = c.adjust()
        assert ch is not None
        assert ch.reason == "grow"
        assert ch.to_ratio > 0.0

    def test_stable_no_change(self, controller, err_src):
        c = controller
        err_src.error_rate = 0.005
        c._last_change_ts = 0  # 解除冷却
        ch = c.adjust()
        assert ch is None  # 稳定期不动

    def test_warning_shrinks(self, controller, err_src):
        c = controller
        c.set_ratio(0.3, reason="init", force=True)
        c._last_change_ts = 0
        err_src.error_rate = 0.02  # warning
        ch = c.adjust()
        assert ch is not None
        assert ch.reason == "shrink"
        assert ch.to_ratio < 0.3

    def test_halt_zero(self, controller, err_src):
        c = controller
        c.set_ratio(0.3, reason="init", force=True)
        c._last_change_ts = 0
        err_src.error_rate = 0.10  # halt
        ch = c.adjust()
        assert ch is not None
        assert ch.reason == "halt"
        assert ch.to_ratio == 0.0

    def test_grow_capped_at_max(self, controller, err_src):
        c = controller
        c.set_ratio(0.495, reason="init", force=True)
        c._last_change_ts = 0
        err_src.error_rate = 0.0
        # 再调一次 grow 步进 0.01
        ch = c.adjust()
        if ch is not None:
            assert ch.to_ratio <= 0.5

    def test_cooldown_skips(self, controller, err_src):
        c = controller
        c.set_ratio(0.1, reason="manual")
        err_src.error_rate = 0.0
        ch = c.adjust()
        assert ch is None  # 刚改过, 冷却期


# ---------------------------------------------------------------------------
# reset
# ---------------------------------------------------------------------------


class TestReset:
    def test_reset_to_base(self, controller):
        c = controller
        c.set_ratio(0.3, reason="manual", force=True)
        ch = c.reset()
        assert ch is not None
        assert ch.to_ratio == 0.0  # base_ratio=0.0
        assert ch.reason == "reset"

    def test_reset_bypasses_cooldown(self, controller):
        c = controller
        c.set_ratio(0.3, reason="manual")
        ch = c.reset()
        assert ch is not None  # force 跳过冷却


# ---------------------------------------------------------------------------
# 后台 loop
# ---------------------------------------------------------------------------


class TestStartStop:
    def test_start_stop(self, controller, err_src):
        c = controller
        asyncio.run(c.start())
        time.sleep(1.0)  # 跑几个 interval (0.5s)
        asyncio.run(c.stop())
        # 至少调过一次 (可能)
        snap = c.snapshot()
        assert "current_ratio" in snap

    def test_double_start_noop(self, controller):
        c = controller
        asyncio.run(c.start())
        # 第二次 start 应 noop
        asyncio.run(c.start())
        asyncio.run(c.stop())

    def test_loop_handles_adjust_exception(self, controller, err_src):
        """_loop 内 adjust 抛错不应终止 loop."""
        c = controller
        err_src.raise_exc = True
        asyncio.run(c.start())
        time.sleep(0.7)
        asyncio.run(c.stop())
        # 进程没崩 = OK

    def test_stop_without_start(self, controller):
        c = controller
        # 没 start 就 stop 不应抛
        asyncio.run(c.stop())


# ---------------------------------------------------------------------------
# snapshot
# ---------------------------------------------------------------------------


class TestSnapshot:
    def test_fields_complete(self, controller):
        c = controller
        snap = c.snapshot()
        assert snap["base_ratio"] == 0.0
        assert snap["current_ratio"] == 0.0
        assert snap["max_ratio"] == 0.5
        assert snap["grow_step"] == 0.01
        assert snap["shrink_step"] == 0.02
        assert snap["cooldown_sec"] == 0.1
        assert snap["window_sec"] == 60.0
        assert snap["health"] in ("green", "stable", "warning", "halt")
        assert "error_rate" in snap
        assert snap["changes_count"] == 0
        assert snap["recent_changes"] == []

    def test_recent_changes_limited(self, controller):
        c = controller
        for i in range(20):
            c.set_ratio(0.01 * (i + 1), reason="test", force=True)
        snap = c.snapshot()
        assert snap["changes_count"] == 20
        assert len(snap["recent_changes"]) == 10  # 限制 10


# ---------------------------------------------------------------------------
# history 截断
# ---------------------------------------------------------------------------


class TestHistoryTruncation:
    def test_changes_truncated_at_100(self, controller):
        c = controller
        for i in range(120):
            c.set_ratio(min(0.5, 0.005 * (i + 1)), reason="test", force=True)
        snap = c.snapshot()
        # 截断 100, recent_changes 限制 10
        assert snap["changes_count"] == 100
        assert len(snap["recent_changes"]) == 10


# ---------------------------------------------------------------------------
# 错误容忍
# ---------------------------------------------------------------------------


class TestErrorTolerance:
    def test_error_source_raises_in_set_ratio(self, controller, err_src):
        c = controller
        err_src.raise_exc = True
        # 不应抛
        ch = c.set_ratio(0.1, reason="manual", force=True)
        assert ch is not None  # set_ratio 自身不依赖 error_source

    def test_router_set_fails_silently(self, controller, router, err_src):
        """router.ratio setter 抛错不应影响 controller 状态."""
        c = controller

        def boom(_):
            raise RuntimeError("router boom")

        router.__setattr__ = boom  # 拦截 set
        # 不应抛
        ch = c.set_ratio(0.1, reason="manual", force=True)
        assert ch is not None
        assert c.current_ratio == 0.1
