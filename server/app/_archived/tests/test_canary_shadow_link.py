"""建议 130 测试: Canary + Shadow 流量录制联动."""


import pytest

# ---------------------------------------------------------------------------
# 基本联动行为
# ---------------------------------------------------------------------------


class TestCanaryShadowLink:
    """Canary → Shadow 联动测试."""

    def test_initial_at_stage_0_shadow_off(self):
        from app.canary_shadow_link import CanaryShadowLink
        from app.shadow_traffic import ShadowRouter

        from app.canary_stages import CanaryStageController

        ctrl = CanaryStageController(cooldown_seconds=0)
        shadow = ShadowRouter(ratio=0.0)
        link = CanaryShadowLink(ctrl, shadow)
        # 初始在 STAGE_0, 联动 stage {1, 2}, shadow 应关闭
        assert link.is_shadow_active() is False
        assert shadow.ratio == 0.0

    def test_promote_to_stage_1_enables_shadow(self):
        from app.canary_shadow_link import CanaryShadowLink
        from app.shadow_traffic import ShadowRouter

        from app.canary_stages import CanaryStageController

        ctrl = CanaryStageController(cooldown_seconds=0)
        shadow = ShadowRouter(ratio=0.0)
        link = CanaryShadowLink(ctrl, shadow)
        # 提升到 STAGE_1
        ctrl.promote(reason="test")
        link.sync(actor="test", reason="after promote")
        # shadow 应启用, ratio = 0.01
        assert link.is_shadow_active() is True
        assert shadow.ratio == pytest.approx(0.01)

    def test_promote_to_stage_2_increases_shadow(self):
        from app.canary_shadow_link import CanaryShadowLink
        from app.shadow_traffic import ShadowRouter

        from app.canary_stages import CanaryStageController

        ctrl = CanaryStageController(cooldown_seconds=0)
        shadow = ShadowRouter(ratio=0.0)
        link = CanaryShadowLink(ctrl, shadow)
        # 提升到 STAGE_2
        ctrl.promote(reason="t1")
        ctrl.promote(reason="t2")
        link.sync()
        # ratio = 0.10
        assert shadow.ratio == pytest.approx(0.10)

    def test_promote_to_stage_3_disables_shadow(self):
        from app.canary_shadow_link import CanaryShadowLink
        from app.shadow_traffic import ShadowRouter

        from app.canary_stages import CanaryStageController

        ctrl = CanaryStageController(cooldown_seconds=0)
        shadow = ShadowRouter(ratio=0.0)
        link = CanaryShadowLink(ctrl, shadow)
        # 提升到 STAGE_3 (50%)
        for _ in range(3):
            ctrl.promote(reason="t")
        link.sync()
        # 50%+ 关闭 shadow
        assert link.is_shadow_active() is False
        assert shadow.ratio == 0.0

    def test_promote_to_stage_4_disables_shadow(self):
        from app.canary_shadow_link import CanaryShadowLink
        from app.shadow_traffic import ShadowRouter

        from app.canary_stages import CanaryStageController

        ctrl = CanaryStageController(cooldown_seconds=0)
        shadow = ShadowRouter(ratio=0.0)
        link = CanaryShadowLink(ctrl, shadow)
        for _ in range(4):
            ctrl.promote(reason="t")
        link.sync()
        assert shadow.ratio == 0.0

    def test_rollback_to_stage_1_re_enables_shadow(self):
        from app.canary_shadow_link import CanaryShadowLink
        from app.shadow_traffic import ShadowRouter

        from app.canary_stages import CanaryStageController

        ctrl = CanaryStageController(cooldown_seconds=0)
        shadow = ShadowRouter(ratio=0.0)
        link = CanaryShadowLink(ctrl, shadow)
        # 提升到 STAGE_3 然后回滚到 STAGE_1
        for _ in range(3):
            ctrl.promote(reason="t")
        link.sync()  # shadow off
        assert shadow.ratio == 0.0
        ctrl.rollback(reason="v2 报错")
        ctrl.rollback(reason="再回滚")
        link.sync()
        # 现在在 STAGE_1, shadow 应重新启用
        assert shadow.ratio == pytest.approx(0.01)


# ---------------------------------------------------------------------------
# 联动事件审计
# ---------------------------------------------------------------------------


class TestLinkEvents:
    """联动事件记录测试."""

    def test_event_recorded_on_init(self):
        from app.canary_shadow_link import CanaryShadowLink
        from app.shadow_traffic import ShadowRouter

        from app.canary_stages import CanaryStageController

        ctrl = CanaryStageController(cooldown_seconds=0)
        shadow = ShadowRouter(ratio=0.0)
        link = CanaryShadowLink(ctrl, shadow)
        events = link.events()
        # 初始化时至少 1 个事件
        assert len(events) >= 1
        last = events[-1]
        assert last["actor"] == "init"
        assert last["new_shadow_ratio"] == 0.0

    def test_event_recorded_on_sync(self):
        from app.canary_shadow_link import CanaryShadowLink
        from app.shadow_traffic import ShadowRouter

        from app.canary_stages import CanaryStageController

        ctrl = CanaryStageController(cooldown_seconds=0)
        shadow = ShadowRouter(ratio=0.0)
        link = CanaryShadowLink(ctrl, shadow)
        ctrl.promote(reason="t")
        link.sync(actor="op", reason="测试")
        events = link.events()
        last = events[-1]
        assert last["actor"] == "op"
        assert last["reason"] == "测试"
        assert last["new_shadow_ratio"] == 0.01

    def test_events_bounded(self):
        from app.canary_shadow_link import CanaryShadowLink
        from app.shadow_traffic import ShadowRouter

        from app.canary_stages import CanaryStageController

        ctrl = CanaryStageController(cooldown_seconds=0)
        shadow = ShadowRouter(ratio=0.0)
        link = CanaryShadowLink(ctrl, shadow)
        for _ in range(300):
            link.sync()
        events = link.events()
        # 事件数应 <= 200 (限制)
        assert len(events) <= 200


# ---------------------------------------------------------------------------
# 自定义 link stages
# ---------------------------------------------------------------------------


class TestCustomLinkStages:
    """自定义联动 stage 集合."""

    def test_only_stage_1(self):
        from app.canary_shadow_link import CanaryShadowLink
        from app.shadow_traffic import ShadowRouter

        from app.canary_stages import CanaryStageController, Stage

        ctrl = CanaryStageController(cooldown_seconds=0)
        shadow = ShadowRouter(ratio=0.0)
        link = CanaryShadowLink(ctrl, shadow, link_stages=[Stage.STAGE_1])
        # STAGE_2 时不联动
        ctrl.promote(reason="t1")
        ctrl.promote(reason="t2")
        link.sync()
        assert shadow.ratio == 0.0

    def test_no_stages(self):
        from app.canary_shadow_link import CanaryShadowLink
        from app.shadow_traffic import ShadowRouter

        from app.canary_stages import CanaryStageController

        ctrl = CanaryStageController(cooldown_seconds=0)
        shadow = ShadowRouter(ratio=0.0)
        link = CanaryShadowLink(ctrl, shadow, link_stages=[])
        ctrl.promote(reason="t1")
        link.sync()
        # 空集合 → 永远不联动
        assert shadow.ratio == 0.0

    def test_all_stages(self):
        from app.canary_shadow_link import CanaryShadowLink
        from app.shadow_traffic import ShadowRouter

        from app.canary_stages import CanaryStageController, Stage

        ctrl = CanaryStageController(cooldown_seconds=0)
        shadow = ShadowRouter(ratio=0.0)
        # 联动所有非 STAGE_0
        link = CanaryShadowLink(
            ctrl,
            shadow,
            link_stages=[Stage.STAGE_1, Stage.STAGE_2, Stage.STAGE_3, Stage.STAGE_4],
        )
        for _ in range(3):
            ctrl.promote(reason="t")
        link.sync()
        # STAGE_3 仍联动
        assert shadow.ratio == pytest.approx(0.50)


# ---------------------------------------------------------------------------
# 全局单例
# ---------------------------------------------------------------------------


class TestGlobalLink:
    """全局 link 单例测试."""

    def test_singleton(self):
        from app.canary_shadow_link import get_linked_router, reset_linked_router

        reset_linked_router()
        l1 = get_linked_router()
        l2 = get_linked_router()
        assert l1 is l2
        reset_linked_router()

    def test_reset_clears_singleton(self):
        from app.canary_shadow_link import get_linked_router, reset_linked_router

        reset_linked_router()
        l1 = get_linked_router()
        reset_linked_router()
        l2 = get_linked_router()
        assert l1 is not l2
        reset_linked_router()


# ---------------------------------------------------------------------------
# 端到端: 阶段化放量联动 shadow
# ---------------------------------------------------------------------------


class TestEndToEndLinking:
    """端到端: 阶段化放量 + shadow 联动."""

    def test_full_journey_1pct_10pct_50pct_100pct(self):
        from app.canary_shadow_link import CanaryShadowLink
        from app.shadow_traffic import ShadowRouter

        from app.canary_stages import CanaryStageController, Stage

        ctrl = CanaryStageController(cooldown_seconds=0)
        shadow = ShadowRouter(ratio=0.0)
        link = CanaryShadowLink(ctrl, shadow)

        # 阶段 0: 0%, shadow off
        assert shadow.ratio == 0.0
        # 阶段 1: 1%, shadow on @ 1%
        ctrl.promote(reason="go 1%")
        link.sync()
        assert shadow.ratio == pytest.approx(0.01)
        # 阶段 2: 10%, shadow on @ 10%
        ctrl.promote(reason="go 10%")
        link.sync()
        assert shadow.ratio == pytest.approx(0.10)
        # 阶段 3: 50%, shadow off
        ctrl.promote(reason="go 50%")
        link.sync()
        assert shadow.ratio == 0.0
        # 阶段 4: 100%, shadow off
        ctrl.promote(reason="go 100%")
        link.sync()
        assert shadow.ratio == 0.0
        assert ctrl.current_stage() == Stage.STAGE_4

    def test_auto_rollback_disables_shadow(self):
        from app.canary_shadow_link import CanaryShadowLink
        from app.shadow_traffic import ShadowRouter

        from app.canary_stages import CanaryStageController

        ctrl = CanaryStageController(cooldown_seconds=0, failure_threshold=2)
        shadow = ShadowRouter(ratio=0.0)
        link = CanaryShadowLink(ctrl, shadow)
        # 提升到 STAGE_2 + sync
        ctrl.promote(reason="t1")
        ctrl.promote(reason="t2")
        link.sync()
        assert shadow.ratio == pytest.approx(0.10)
        # 2 次失败触发 auto_rollback 到 STAGE_0
        ctrl.mark_failure(reason="f1")
        ctrl.mark_failure(reason="f2")
        # sync 后 shadow 应关闭
        link.sync()
        assert shadow.ratio == 0.0
