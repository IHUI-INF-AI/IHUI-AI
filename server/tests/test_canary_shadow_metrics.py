"""建议 134 测试: Canary + Shadow Prometheus metric.

测试:
  - zhs_canary_stage_ratio gauge 反映 CanaryStageController 当前阶段
  - zhs_shadow_ratio gauge 反映 CanaryShadowLink 当前 shadow 比例
  - 阶段切换时 gauge 同步更新
  - link 联动时 shadow 比例跟着 canary 阶段变化
  - 关闭 prometheus_client 时不报错 (降级)
"""

import pytest

# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------


@pytest.fixture
def tmp_state_file(tmp_path):
    return str(tmp_path / "canary_metric_state.json")


@pytest.fixture
def controller(tmp_state_file):
    from app.canary_stages import CanaryStageController

    return CanaryStageController(state_file=tmp_state_file, cooldown_seconds=0.0)


@pytest.fixture
def link(controller):
    from app.canary_shadow_link import DEFAULT_SHADOW_LINK_STAGES, CanaryShadowLink

    return CanaryShadowLink(
        canary=controller,
        shadow=None,  # 用默认 ShadowRouter(ratio=0.0)
        link_stages=DEFAULT_SHADOW_LINK_STAGES,
    )


# ---------------------------------------------------------------------------
# TestGaugesDeclared
# ---------------------------------------------------------------------------


class TestGaugesDeclared:
    """两个 gauge 已被 prometheus_client 正确声明."""

    def test_canary_stage_ratio_gauge_exists(self):
        from app.canary_metrics import CANARY_STAGE_RATIO_GAUGE

        assert CANARY_STAGE_RATIO_GAUGE is not None
        # 验证 metric name
        assert CANARY_STAGE_RATIO_GAUGE._name == "zhs_canary_stage_ratio"

    def test_shadow_ratio_gauge_exists(self):
        from app.canary_metrics import SHADOW_RATIO_GAUGE

        assert SHADOW_RATIO_GAUGE is not None
        assert SHADOW_RATIO_GAUGE._name == "zhs_shadow_ratio"


# ---------------------------------------------------------------------------
# TestStageRatioSync
# ---------------------------------------------------------------------------


class TestStageRatioSync:
    """sync_canary_stage_gauges 把 controller 状态写到 zhs_canary_stage_ratio."""

    def test_initial_stage_0(self, controller):
        from app.canary_metrics import CANARY_STAGE_RATIO_GAUGE, sync_canary_stage_gauges

        sync_canary_stage_gauges(controller)
        # 当前 stage=0%, ratio=0
        assert CANARY_STAGE_RATIO_GAUGE.labels(stage="0%")._value.get() == 0.0
        assert CANARY_STAGE_RATIO_GAUGE.labels(stage="1%")._value.get() == 0.0

    def test_stage_1_promotion(self, controller):
        from app.canary_metrics import CANARY_STAGE_RATIO_GAUGE, sync_canary_stage_gauges

        controller.promote(actor="test", reason="升 1%")
        sync_canary_stage_gauges(controller)
        assert CANARY_STAGE_RATIO_GAUGE.labels(stage="1%")._value.get() == 0.01
        assert CANARY_STAGE_RATIO_GAUGE.labels(stage="0%")._value.get() == 0.0
        assert CANARY_STAGE_RATIO_GAUGE.labels(stage="10%")._value.get() == 0.0

    def test_stage_3_promotion_chain(self, controller):
        from app.canary_metrics import CANARY_STAGE_RATIO_GAUGE, sync_canary_stage_gauges

        controller.promote(actor="t", reason="")
        controller.promote(actor="t", reason="")
        controller.promote(actor="t", reason="")
        sync_canary_stage_gauges(controller)
        assert CANARY_STAGE_RATIO_GAUGE.labels(stage="50%")._value.get() == 0.5
        assert CANARY_STAGE_RATIO_GAUGE.labels(stage="1%")._value.get() == 0.0
        assert CANARY_STAGE_RATIO_GAUGE.labels(stage="10%")._value.get() == 0.0

    def test_stage_4_full_release(self, controller):
        from app.canary_metrics import CANARY_STAGE_RATIO_GAUGE, sync_canary_stage_gauges

        for _ in range(4):
            controller.promote(actor="t", reason="")
        sync_canary_stage_gauges(controller)
        assert CANARY_STAGE_RATIO_GAUGE.labels(stage="100%")._value.get() == 1.0

    def test_rollback_updates_gauge(self, controller):
        from app.canary_metrics import CANARY_STAGE_RATIO_GAUGE, sync_canary_stage_gauges

        controller.promote(actor="t", reason="")
        controller.promote(actor="t", reason="")
        sync_canary_stage_gauges(controller)
        assert CANARY_STAGE_RATIO_GAUGE.labels(stage="10%")._value.get() == 0.10
        # 回滚
        controller.rollback(actor="t", reason="v2 fail")
        sync_canary_stage_gauges(controller)
        assert CANARY_STAGE_RATIO_GAUGE.labels(stage="1%")._value.get() == 0.01
        assert CANARY_STAGE_RATIO_GAUGE.labels(stage="10%")._value.get() == 0.0


# ---------------------------------------------------------------------------
# TestShadowRatioSync
# ---------------------------------------------------------------------------


class TestShadowRatioSync:
    """sync_shadow_gauges 把 CanaryShadowLink / ShadowRouter 状态写到 zhs_shadow_ratio."""

    def test_initial_shadow_zero(self, link):
        from app.canary_metrics import SHADOW_RATIO_GAUGE, sync_shadow_gauges

        # 初始: STAGE_0, shadow.ratio=0
        sync_shadow_gauges(link)
        assert SHADOW_RATIO_GAUGE._value.get() == 0.0

    def test_promote_to_1pct_activates_shadow(self, controller, link):
        from app.canary_metrics import SHADOW_RATIO_GAUGE, sync_shadow_gauges

        controller.promote(actor="t", reason="")
        link.sync(actor="t", reason="")
        sync_shadow_gauges(link)
        # 1% 阶段在 link_stages 中, shadow.ratio = 0.01
        assert SHADOW_RATIO_GAUGE._value.get() == 0.01

    def test_promote_to_10pct_keeps_shadow_active(self, controller, link):
        from app.canary_metrics import SHADOW_RATIO_GAUGE, sync_shadow_gauges

        controller.promote(actor="t", reason="")
        controller.promote(actor="t", reason="")
        link.sync(actor="t", reason="")
        sync_shadow_gauges(link)
        assert SHADOW_RATIO_GAUGE._value.get() == 0.10

    def test_promote_to_50pct_disables_shadow(self, controller, link):
        from app.canary_metrics import SHADOW_RATIO_GAUGE, sync_shadow_gauges

        for _ in range(3):
            controller.promote(actor="t", reason="")
        link.sync(actor="t", reason="")
        sync_shadow_gauges(link)
        # 50% 不在 DEFAULT_SHADOW_LINK_STAGES 中, shadow 关
        assert SHADOW_RATIO_GAUGE._value.get() == 0.0

    def test_sync_with_shadow_router_directly(self):
        from app.canary_metrics import SHADOW_RATIO_GAUGE, sync_shadow_gauges
        from app.shadow_traffic import ShadowRouter

        router = ShadowRouter(ratio=0.15)
        sync_shadow_gauges(router)
        assert SHADOW_RATIO_GAUGE._value.get() == 0.15


# ---------------------------------------------------------------------------
# TestSyncAll
# ---------------------------------------------------------------------------


class TestSyncAll:
    """sync_canary_shadow_all 一站式 helper."""

    def test_sync_all_with_link(self, controller, link):
        from app.canary_metrics import (
            CANARY_STAGE_RATIO_GAUGE,
            SHADOW_RATIO_GAUGE,
            sync_canary_shadow_all,
        )

        controller.promote(actor="t", reason="")
        link.sync(actor="t", reason="")
        sync_canary_shadow_all(controller, link=link)
        assert CANARY_STAGE_RATIO_GAUGE.labels(stage="1%")._value.get() == 0.01
        assert SHADOW_RATIO_GAUGE._value.get() == 0.01

    def test_sync_all_without_link(self, controller):
        from app.canary_metrics import (
            CANARY_STAGE_RATIO_GAUGE,
            SHADOW_RATIO_GAUGE,
            sync_canary_shadow_all,
        )

        # 建议 134: 测试间隔离 - shadow gauge 是全局单例, 前面测试可能改了
        # 这里不传 link, 验证 shadow gauge 不会被 sync_all_with_None 改动
        controller.promote(actor="t", reason="")
        controller.promote(actor="t", reason="")
        prev_shadow = SHADOW_RATIO_GAUGE._value.get()
        sync_canary_shadow_all(controller)
        # canary stage 同步
        assert CANARY_STAGE_RATIO_GAUGE.labels(stage="10%")._value.get() == 0.10
        # shadow gauge 没被动 (link=None 时不调 sync_shadow_gauges)
        assert SHADOW_RATIO_GAUGE._value.get() == prev_shadow


# ---------------------------------------------------------------------------
# TestSnapshot
# ---------------------------------------------------------------------------


class TestSnapshot:
    """get_*_ratio_snapshot 调试快照."""

    def test_canary_snapshot(self, controller):
        from app.canary_metrics import get_canary_stage_ratio_snapshot

        controller.promote(actor="t", reason="")
        snap = get_canary_stage_ratio_snapshot(controller)
        assert snap["current_stage"] == "1%"
        assert snap["current_ratio"] == 0.01

    def test_shadow_snapshot_from_link(self, link):
        from app.canary_metrics import get_shadow_ratio_snapshot

        link.canary.promote(actor="t", reason="")
        link.sync(actor="t", reason="")
        snap = get_shadow_ratio_snapshot(link)
        assert snap["shadow_ratio"] == 0.01
        assert snap["shadow_active"] is True
        assert snap["source"] == "CanaryShadowLink"

    def test_shadow_snapshot_from_router(self):
        from app.canary_metrics import get_shadow_ratio_snapshot
        from app.shadow_traffic import ShadowRouter

        router = ShadowRouter(ratio=0.0)
        snap = get_shadow_ratio_snapshot(router)
        assert snap["shadow_ratio"] == 0.0
        assert snap["shadow_active"] is False
        assert snap["source"] == "ShadowRouter"


# ---------------------------------------------------------------------------
# TestPrometheusExposed
# ---------------------------------------------------------------------------


class TestPrometheusExposed:
    """验证 /metrics 端点能拿到这两个 metric (如果有 prometheus_client)."""

    def test_metrics_endpoint_exposes_stage_ratio(self, controller):
        from app.canary_metrics import sync_canary_stage_gauges

        controller.promote(actor="t", reason="")
        sync_canary_stage_gauges(controller)
        # prometheus_client 自带 generate_latest
        try:
            from prometheus_client import REGISTRY, generate_latest

            data = generate_latest(REGISTRY).decode("utf-8")
        except ImportError:
            pytest.skip("prometheus_client 未安装")
        assert "zhs_canary_stage_ratio" in data
        assert 'stage="1%"' in data

    def test_metrics_endpoint_exposes_shadow_ratio(self, link):
        from app.canary_metrics import sync_shadow_gauges

        link.canary.promote(actor="t", reason="")
        link.sync(actor="t", reason="")
        sync_shadow_gauges(link)
        try:
            from prometheus_client import REGISTRY, generate_latest

            data = generate_latest(REGISTRY).decode("utf-8")
        except ImportError:
            pytest.skip("prometheus_client 未安装")
        assert "zhs_shadow_ratio" in data
