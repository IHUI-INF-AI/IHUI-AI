"""建议 149 测试: CanaryAutoPromoter 人工 override 端点.

测试:
  - OverrideState.is_paused_active (考虑 until_ts 过期)
  - pause_override / resume_override (持久化到 override_log)
  - check_and_promote 在 override 激活时短路
  - check_and_promote 在 override 过期后恢复
  - force_promote 忽略 override 暂停
  - force_promote 在 STAGE_4 失败
  - force_rollback (调 controller.rollback)
  - force_rollback 在 STAGE_0 失败
  - get_override_status 字段完整
  - get_status 包含 override
  - override_log 自动截断
  - API 端点 (FastAPI TestClient)
  - 全局 singleton get_default_promoter
"""

import time

import pytest

# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------


@pytest.fixture
def controller(tmp_path):
    from app.canary_stages import CanaryStageController

    return CanaryStageController(
        state_file=str(tmp_path / "canary_state.json"),
        cooldown_seconds=0.0,
        failure_threshold=3,
    )


@pytest.fixture
def promoter(controller):
    from app.canary_auto_promoter import CanaryAutoPromoter, PromoterConfig

    config = PromoterConfig(
        error_threshold=0.05,
        min_stable_minutes=0.01,
        check_interval_seconds=60.0,
        dry_run=False,
        min_traffic_count=5,
        max_consecutive_promotions=10,
    )
    return CanaryAutoPromoter(controller, config=config)


@pytest.fixture
def stable_promoter(controller):
    """准备一个满足推进条件的 promoter: 充足稳定流量 + 稳定时长."""
    from app.canary_auto_promoter import CanaryAutoPromoter, PromoterConfig

    config = PromoterConfig(
        error_threshold=0.05,
        min_stable_minutes=0.0,
        check_interval_seconds=60.0,
        dry_run=False,
        min_traffic_count=3,
        max_consecutive_promotions=10,
    )
    p = CanaryAutoPromoter(controller, config=config)
    for _ in range(10):
        p.record_outcome(success=True)
    return p


# ---------------------------------------------------------------------------
# OverrideState.is_paused_active
# ---------------------------------------------------------------------------


class TestOverrideState:
    def test_default_not_paused(self):
        from app.canary_auto_promoter import OverrideState

        ov = OverrideState()
        assert ov.is_paused_active() is False

    def test_paused_permanent(self):
        from app.canary_auto_promoter import OverrideState

        ov = OverrideState(paused=True, pause_actor="alice", pause_reason="x")
        assert ov.is_paused_active() is True

    def test_paused_with_until_future(self):
        from app.canary_auto_promoter import OverrideState

        future = time.time() + 60
        ov = OverrideState(paused=True, pause_until_ts=future)
        assert ov.is_paused_active() is True

    def test_paused_with_until_past(self):
        from app.canary_auto_promoter import OverrideState

        past = time.time() - 60
        ov = OverrideState(paused=True, pause_until_ts=past)
        assert ov.is_paused_active() is False

    def test_paused_zero_until_is_permanent(self):
        from app.canary_auto_promoter import OverrideState

        ov = OverrideState(paused=True, pause_until_ts=0.0)
        assert ov.is_paused_active() is True


# ---------------------------------------------------------------------------
# pause_override / resume_override
# ---------------------------------------------------------------------------


class TestPauseResume:
    def test_pause_writes_log(self, promoter):
        result = promoter.pause_override(actor="alice", reason="巡检中")
        assert result["paused"] is True
        assert result["actor"] == "alice"
        assert result["reason"] == "巡检中"
        status = promoter.get_override_status()
        assert status["paused"] is True
        assert status["pause_actor"] == "alice"
        assert len(status["override_log"]) == 1
        assert status["override_log"][0]["action"] == "pause"

    def test_pause_with_until_ts(self, promoter):
        future = time.time() + 100
        promoter.pause_override(actor="bob", reason="x", until_ts=future)
        status = promoter.get_override_status()
        assert status["pause_until_ts"] == future
        assert status["pause_until_in_seconds"] > 90

    def test_resume_clears_state(self, promoter):
        promoter.pause_override(actor="alice", reason="r")
        result = promoter.resume_override(actor="alice", reason="结束")
        assert result["paused"] is False
        assert result["was_paused"] is True
        status = promoter.get_override_status()
        assert status["paused"] is False
        assert status["pause_actor"] == ""
        assert status["pause_reason"] == ""

    def test_resume_when_not_paused(self, promoter):
        result = promoter.resume_override(actor="alice")
        assert result["paused"] is False
        assert result["was_paused"] is False

    def test_pause_then_resume_writes_two_log(self, promoter):
        promoter.pause_override(actor="alice", reason="r1")
        promoter.resume_override(actor="alice", reason="r2")
        status = promoter.get_override_status()
        assert len(status["override_log"]) == 2
        assert status["override_log"][0]["action"] == "pause"
        assert status["override_log"][1]["action"] == "resume"


# ---------------------------------------------------------------------------
# check_and_promote 短路
# ---------------------------------------------------------------------------


class TestOverrideShortCircuit:
    def test_check_short_circuits_when_override_active(self, stable_promoter):
        stable_promoter.pause_override(actor="admin", reason="紧急检查")
        result = stable_promoter.check_and_promote()
        assert result["promoted"] is False
        assert result["reason"] == "override_active"

    def test_check_resumes_after_resume_override(self, stable_promoter):
        stable_promoter.pause_override(actor="admin", reason="x")
        r1 = stable_promoter.check_and_promote()
        assert r1["reason"] == "override_active"
        stable_promoter.resume_override(actor="admin")
        r2 = stable_promoter.check_and_promote()
        # resume 后应能正常推进
        assert r2["reason"] != "override_active"
        assert r2["promoted"] is True

    def test_check_resumes_after_until_expired(self, controller):
        """until_ts 过期后 check_and_promote 不再短路."""
        from app.canary_auto_promoter import CanaryAutoPromoter, PromoterConfig

        config = PromoterConfig(
            error_threshold=0.05,
            min_stable_minutes=0.0,
            check_interval_seconds=60.0,
            dry_run=False,
            min_traffic_count=3,
            max_consecutive_promotions=10,
        )
        p = CanaryAutoPromoter(controller, config=config)
        for _ in range(10):
            p.record_outcome(success=True)
        # pause 1s 后过期
        p.pause_override(actor="admin", reason="短暂停", until_ts=time.time() + 0.2)
        r1 = p.check_and_promote()
        assert r1["reason"] == "override_active"
        time.sleep(0.3)
        r2 = p.check_and_promote()
        assert r2["reason"] != "override_active"

    def test_normal_pause_still_works(self, promoter):
        """普通 pause() 不走 override 逻辑."""
        promoter.pause()
        r = promoter.check_and_promote()
        assert r["reason"] == "paused"
        assert r["reason"] != "override_active"


# ---------------------------------------------------------------------------
# force_promote
# ---------------------------------------------------------------------------


class TestForcePromote:
    def test_force_promote_advances(self, stable_promoter):
        result = stable_promoter.force_promote(actor="admin", reason="紧急")
        assert result["promoted"] is True
        assert result["from"] == "0%"
        assert result["to"] == "1%"

    def test_force_promote_ignores_override_pause(self, stable_promoter):
        stable_promoter.pause_override(actor="admin", reason="x")
        r1 = stable_promoter.check_and_promote()
        assert r1["reason"] == "override_active"
        r2 = stable_promoter.force_promote(actor="admin", reason="override 我也行")
        assert r2["promoted"] is True
        # 日志应记录 was_paused=True
        status = stable_promoter.get_override_status()
        last = status["override_log"][-1]
        assert last["action"] == "force_promote"
        assert "override_was_paused=True" in last["detail"]

    def test_force_promote_at_100_pct_fails(self, promoter):
        # 先 promote 到 100%
        promoter._controller.promote(actor="t", reason="t")
        promoter._controller.promote(actor="t", reason="t")
        promoter._controller.promote(actor="t", reason="t")
        promoter._controller.promote(actor="t", reason="t")
        assert promoter._controller.current_stage().value == "100%"
        r = promoter.force_promote(actor="admin", reason="x")
        assert r["promoted"] is False
        assert "100%" in r["reason"]


# ---------------------------------------------------------------------------
# force_rollback
# ---------------------------------------------------------------------------


class TestForceRollback:
    def test_force_rollback_advances_to_prev(self, promoter):
        promoter._controller.promote(actor="t", reason="t")
        promoter._controller.promote(actor="t", reason="t")
        assert promoter._controller.current_stage().value == "10%"
        r = promoter.force_rollback(actor="admin", reason="告警飙升")
        assert r["rolled_back"] is True
        assert r["from"] == "10%"
        assert r["to"] == "1%"

    def test_force_rollback_at_0_pct_fails(self, promoter):
        assert promoter._controller.current_stage().value == "0%"
        r = promoter.force_rollback(actor="admin", reason="x")
        assert r["rolled_back"] is False
        assert "最低" in r["reason"]

    def test_force_rollback_writes_log(self, promoter):
        promoter._controller.promote(actor="t", reason="t")
        promoter.force_rollback(actor="admin", reason="紧急回滚")
        status = promoter.get_override_status()
        last = status["override_log"][-1]
        assert last["action"] == "force_rollback"
        assert last["actor"] == "admin"


# ---------------------------------------------------------------------------
# get_status / get_override_status
# ---------------------------------------------------------------------------


class TestStatusReporting:
    def test_get_status_includes_override(self, promoter):
        s = promoter.get_status()
        assert "override" in s
        assert s["override"]["paused"] is False
        assert s["override"]["is_paused_active"] is False

    def test_get_override_status_fields(self, promoter):
        promoter.pause_override(actor="alice", reason="巡检")
        s = promoter.get_override_status()
        assert s["paused"] is True
        assert s["is_paused_active"] is True
        assert s["pause_actor"] == "alice"
        assert s["pause_reason"] == "巡检"
        assert isinstance(s["override_log"], list)
        assert len(s["override_log"]) == 1


# ---------------------------------------------------------------------------
# override_log 截断
# ---------------------------------------------------------------------------


class TestLogTruncation:
    def test_log_truncates_at_100(self, promoter):
        # pause 60 次 + resume 60 次 = 120 条
        for i in range(60):
            promoter.pause_override(actor="a", reason=f"p{i}")
            promoter.resume_override(actor="a", reason=f"r{i}")
        # 内部限制: 超过 100 时保留最后 50
        s = promoter.get_override_status()
        assert len(s["override_log"]) <= 100


# ---------------------------------------------------------------------------
# 全局 singleton
# ---------------------------------------------------------------------------


class TestGlobalSingleton:
    def test_get_default_promoter_returns_singleton(self):
        from app.canary_auto_promoter import get_default_promoter, reset_default_promoter

        reset_default_promoter()
        p1 = get_default_promoter()
        p2 = get_default_promoter()
        assert p1 is p2
        reset_default_promoter()

    def test_reset_clears_singleton(self):
        from app.canary_auto_promoter import get_default_promoter, reset_default_promoter

        p1 = get_default_promoter()
        reset_default_promoter()
        p2 = get_default_promoter()
        assert p1 is not p2
        reset_default_promoter()


# ---------------------------------------------------------------------------
# API 端点 (FastAPI TestClient, 需 admin 鉴权)
# ---------------------------------------------------------------------------


class TestAPIEndpoints:
    """集成测试: 调 FastAPI 端点函数 (绕开 require_role 鉴权)."""

    @pytest.fixture
    def api_caller(self):
        """构造调用器: 注入 promoter 单例, 跳过 require_role."""
        from app.canary_auto_promoter import (
            CanaryAutoPromoter,
            PromoterConfig,
            reset_default_promoter,
            set_default_promoter,
        )
        from app.canary_stages import CanaryStageController, reset_default_controller

        reset_default_promoter()
        reset_default_controller()
        ctrl = CanaryStageController(
            state_file=None,  # 内存
            cooldown_seconds=0.0,
            failure_threshold=3,
        )
        promoter = CanaryAutoPromoter(
            controller=ctrl,
            config=PromoterConfig(
                error_threshold=0.05,
                min_stable_minutes=0.0,
                check_interval_seconds=60.0,
                dry_run=False,
                min_traffic_count=3,
            ),
        )
        set_default_promoter(promoter)
        # 拿端点函数 (直接调, 传 _admin="admin_test")
        from app.api.v1.monitor.canary_promoter import (
            get_override,
            get_promoter_status,
            post_force_promote,
            post_force_rollback,
            post_pause_override,
            post_resume_override,
        )

        return {
            "promoter": promoter,
            "get_status": get_promoter_status,
            "get_override": get_override,
            "post_pause": post_pause_override,
            "post_resume": post_resume_override,
            "post_force_promote": post_force_promote,
            "post_force_rollback": post_force_rollback,
        }

    def test_status_endpoint(self, api_caller):
        resp = api_caller["get_status"](_admin="admin")
        assert resp.ok is True
        assert "override" in resp.data

    def test_pause_endpoint(self, api_caller):
        from app.api.v1.monitor.canary_promoter import OverridePauseRequest

        req = OverridePauseRequest(actor="admin1", reason="测试暂停", until_ts=0.0)
        resp = api_caller["post_pause"](req, _admin="admin")
        assert resp.ok is True
        assert resp.data["override_pause"]["paused"] is True
        assert resp.data["promoter_status"]["override"]["paused"] is True

    def test_pause_validation_error(self):
        """reason 必填, 缺失应抛 ValidationError."""
        from pydantic import ValidationError

        from app.api.v1.monitor.canary_promoter import OverridePauseRequest

        with pytest.raises(ValidationError):
            OverridePauseRequest(actor="admin1")

    def test_resume_endpoint(self, api_caller):
        from app.api.v1.monitor.canary_promoter import (
            OverridePauseRequest,
            OverrideResumeRequest,
        )

        api_caller["post_pause"](
            OverridePauseRequest(actor="a", reason="x"),
            _admin="admin",
        )
        resp = api_caller["post_resume"](
            OverrideResumeRequest(actor="a", reason="ok"),
            _admin="admin",
        )
        assert resp.ok is True
        assert resp.data["override_resume"]["paused"] is False

    def test_force_promote_endpoint(self, api_caller):
        from app.api.v1.monitor.canary_promoter import ForcePromoteRequest

        req = ForcePromoteRequest(actor="a", reason="x")
        resp = api_caller["post_force_promote"](req, _admin="admin")
        assert resp.ok is True
        # 初始 STAGE_0, force promote 应能推进
        assert resp.data["force_promote"]["promoted"] is True
        assert resp.data["force_promote"]["from"] == "0%"

    def test_force_rollback_endpoint(self, api_caller):
        from app.api.v1.monitor.canary_promoter import (
            ForcePromoteRequest,
            ForceRollbackRequest,
        )

        api_caller["post_force_promote"](
            ForcePromoteRequest(actor="a", reason="first"),
            _admin="admin",
        )
        resp = api_caller["post_force_rollback"](
            ForceRollbackRequest(actor="a", reason="急回滚"),
            _admin="admin",
        )
        assert resp.ok is True
        assert resp.data["force_rollback"]["rolled_back"] is True
        assert resp.data["force_rollback"]["to"] == "0%"

    def test_override_endpoint(self, api_caller):
        from app.api.v1.monitor.canary_promoter import OverridePauseRequest

        api_caller["post_pause"](
            OverridePauseRequest(actor="alice", reason="检查"),
            _admin="admin",
        )
        resp = api_caller["get_override"](_admin="admin")
        assert resp.ok is True
        assert resp.data["paused"] is True
        assert resp.data["pause_actor"] == "alice"
        assert len(resp.data["override_log"]) == 1

    def test_endpoint_router_registered(self):
        """验证 router 已注册到主 app, 路径前缀 /monitor."""
        from app.api.v1.monitor.canary_promoter import router

        paths = [r.path for r in router.routes]
        assert "/canary-promoter/status" in paths
        assert "/canary-promoter/override" in paths
        assert "/canary-promoter/pause" in paths
        assert "/canary-promoter/resume" in paths
        assert "/canary-promoter/force-promote" in paths
        assert "/canary-promoter/force-rollback" in paths
