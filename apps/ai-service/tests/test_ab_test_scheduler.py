"""ABTestScheduler 测试(L5-5,2026-07-25 立)。

覆盖 ab_test_scheduler.py:
- _safe_int / _init_config 环境变量解析
- start / stop / set_enabled / get_status / get_history
- register_promote_callback / register_rollback_callback
- _loop / _run_once_safe / _run_once 主循环
- _run_once:flush + 检验 + 决策 + 清理
- 超时强制 stop
- _apply_promote / _apply_rollback 回调(无回调 / 回调成功 / 回调失败)
- _is_expired 工具方法
- trigger_now 手动触发
- _append_history LRU
- 全局单例 ab_test_scheduler
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from unittest.mock import AsyncMock, MagicMock

import pytest

from app.services.ab_test_scheduler import (
    ABTestHistoryEntry,
    ABTestScheduler,
    _HISTORY_LIMIT,
    _safe_int,
    ab_test_scheduler,
)


# =============================================================================
# _safe_int
# =============================================================================


class TestSafeInt:
    """_safe_int 环境变量解析。"""

    def test_none_returns_default(self):
        assert _safe_int(None, 42) == 42

    def test_empty_string_returns_default(self):
        assert _safe_int("", 42) == 42

    def test_valid_int(self):
        assert _safe_int("100", 42) == 100

    def test_invalid_int_returns_default(self):
        assert _safe_int("not-a-number", 42) == 42


# =============================================================================
# _init_config 环境变量加载
# =============================================================================


class TestInitConfig:
    """_init_config 从环境变量加载配置。"""

    def test_default_values(self, monkeypatch):
        for key in (
            "AB_TEST_ENABLED",
            "AB_TEST_INTERVAL_SECONDS",
            "AB_TEST_MAX_DURATION_SECONDS",
            "AB_TEST_START_DELAY_SECONDS",
        ):
            monkeypatch.delenv(key, raising=False)
        sched = ABTestScheduler()
        sched._init_config()
        assert sched.enabled is False
        assert sched.interval_seconds == 3600  # 1 小时
        assert sched.max_duration_seconds == 86400  # 24 小时
        assert sched.start_delay_seconds == 600

    def test_env_overrides(self, monkeypatch):
        monkeypatch.setenv("AB_TEST_ENABLED", "true")
        monkeypatch.setenv("AB_TEST_INTERVAL_SECONDS", "1800")
        monkeypatch.setenv("AB_TEST_MAX_DURATION_SECONDS", "7200")
        monkeypatch.setenv("AB_TEST_START_DELAY_SECONDS", "60")
        sched = ABTestScheduler()
        sched._init_config()
        assert sched.enabled is True
        assert sched.interval_seconds == 1800
        assert sched.max_duration_seconds == 7200
        assert sched.start_delay_seconds == 60

    def test_enabled_case_insensitive(self, monkeypatch):
        monkeypatch.setenv("AB_TEST_ENABLED", "TRUE")
        sched = ABTestScheduler()
        sched._init_config()
        assert sched.enabled is True


# =============================================================================
# 启停 / 状态查询
# =============================================================================


class TestStartStop:
    """start / stop 调度循环启停。"""

    @pytest.mark.asyncio
    async def test_start_creates_task(self, monkeypatch):
        monkeypatch.setenv("AB_TEST_ENABLED", "false")
        sched = ABTestScheduler()
        try:
            await sched.start()
            assert sched._task is not None
            assert not sched._task.done()
        finally:
            await sched.stop()

    @pytest.mark.asyncio
    async def test_start_idempotent(self, monkeypatch):
        monkeypatch.setenv("AB_TEST_ENABLED", "false")
        sched = ABTestScheduler()
        try:
            await sched.start()
            task1 = sched._task
            await sched.start()
            assert sched._task is task1
        finally:
            await sched.stop()

    @pytest.mark.asyncio
    async def test_stop_when_not_started(self):
        sched = ABTestScheduler()
        await sched.stop()
        assert sched._task is None

    @pytest.mark.asyncio
    async def test_set_enabled_runtime(self):
        sched = ABTestScheduler()
        assert sched.enabled is False
        sched.set_enabled(True)
        assert sched.enabled is True

    @pytest.mark.asyncio
    async def test_get_status(self, monkeypatch):
        monkeypatch.setenv("AB_TEST_ENABLED", "true")
        monkeypatch.setenv("AB_TEST_INTERVAL_SECONDS", "1800")
        # mock ab_test_tracker / shadow_runner
        mock_tracker = MagicMock()
        mock_tracker.get_status = MagicMock(return_value={"totalTests": 1})
        mock_runner = MagicMock()
        mock_runner.get_status = MagicMock(return_value={"registeredTreatments": 1})
        monkeypatch.setattr(
            "app.services.ab_test_tracker.ab_test_tracker", mock_tracker
        )
        monkeypatch.setattr(
            "app.services.shadow_runner.shadow_runner", mock_runner
        )
        sched = ABTestScheduler()
        sched._init_config()
        status = sched.get_status()
        assert status["enabled"] is True
        assert status["intervalSeconds"] == 1800
        assert status["running"] is False
        assert status["historyCount"] == 0
        assert status["lastRun"] is None
        assert status["tracker"] == {"totalTests": 1}
        assert status["shadowRunner"] == {"registeredTreatments": 1}
        assert status["hasPromoteCallback"] is False
        assert status["hasRollbackCallback"] is False


# =============================================================================
# 决策回调注册
# =============================================================================


class TestRegisterCallbacks:
    """register_promote_callback / register_rollback_callback。"""

    def test_register_promote_callback(self):
        sched = ABTestScheduler()
        async def _cb(*args):
            return True
        sched.register_promote_callback(_cb)
        assert sched._promote_callback is _cb

    def test_register_rollback_callback(self):
        sched = ABTestScheduler()
        async def _cb(*args):
            return True
        sched.register_rollback_callback(_cb)
        assert sched._rollback_callback is _cb


# =============================================================================
# _run_once:主流程
# =============================================================================


@pytest.fixture
def fresh_scheduler(monkeypatch):
    """返回一个全新 ABTestScheduler,注入 mock ab_test_tracker / shadow_runner / significance_tester。"""
    sched = ABTestScheduler()

    # 创建 mock 组件
    mock_tracker = MagicMock()
    mock_tracker.flush_all_running = AsyncMock(return_value=2)
    mock_tracker.list_tests = MagicMock(return_value=[])
    mock_tracker.get_stats = MagicMock(return_value=None)
    mock_tracker.stop_test = AsyncMock(return_value=True)
    mock_tracker.mark_decided = AsyncMock(return_value=True)
    mock_tracker.get_test = MagicMock(return_value=None)
    mock_tracker.get_status = MagicMock(return_value={"totalTests": 0})

    mock_runner = MagicMock()
    mock_runner.cleanup_inactive = AsyncMock(return_value=0)
    mock_runner.get_status = MagicMock(return_value={"registeredTreatments": 0})

    mock_tester = MagicMock()

    # monkeypatch 模块内的单例引用
    import app.services.ab_test_tracker as _ab_module
    import app.services.shadow_runner as _sr_module
    import app.services.significance_tester as _st_module
    monkeypatch.setattr(_ab_module, "ab_test_tracker", mock_tracker)
    monkeypatch.setattr(_sr_module, "shadow_runner", mock_runner)
    monkeypatch.setattr(_st_module, "significance_tester", mock_tester)

    return sched, mock_tracker, mock_runner, mock_tester


class TestRunOnce:
    """_run_once 主流程。"""

    @pytest.mark.asyncio
    async def test_no_running_tests(self, fresh_scheduler):
        """无 running 测试 → 只 flush,所有 count=0。"""
        sched, mock_tracker, mock_runner, mock_tester = fresh_scheduler
        mock_tracker.list_tests.return_value = []
        result = await sched._run_once()
        assert result["flushed_count"] == 2
        assert result["checked_count"] == 0
        assert result["promoted_count"] == 0
        assert result["rolled_back_count"] == 0
        assert result["stopped_count"] == 0

    @pytest.mark.asyncio
    async def test_expired_test_stopped(self, fresh_scheduler):
        """超时测试 → 强制 stop。"""
        sched, mock_tracker, mock_runner, mock_tester = fresh_scheduler
        # 构造一个超时的测试(started_at = 2 天前)
        old_time = (datetime.now(timezone.utc) - timedelta(days=2)).isoformat()
        mock_tracker.list_tests.return_value = [{
            "testId": "test-1",
            "skillName": "skill-a",
            "controlVersion": "1.0.0",
            "treatmentVersion": "1.1.0",
            "status": "running",
            "startedAt": old_time,
            "significanceLevel": 0.05,
            "minSampleSize": 30,
        }]
        # max_duration=86400(24h),started_at=2days ago → 超时
        sched._init_config()  # 默认 max_duration=86400

        result = await sched._run_once()
        assert result["stopped_count"] == 1
        assert result["checked_count"] == 1
        mock_tracker.stop_test.assert_called_once_with(
            "test-1", reason="max_duration_exceeded"
        )

    @pytest.mark.asyncio
    async def test_promote_decision(self, fresh_scheduler):
        """检验结果 promote → mark_decided + 调用回调。"""
        sched, mock_tracker, mock_runner, mock_tester = fresh_scheduler
        fresh_time = datetime.now(timezone.utc).isoformat()
        mock_tracker.list_tests.return_value = [{
            "testId": "test-1",
            "skillName": "skill-a",
            "controlVersion": "1.0.0",
            "treatmentVersion": "1.1.0",
            "status": "running",
            "startedAt": fresh_time,
            "significanceLevel": 0.05,
            "minSampleSize": 30,
        }]
        mock_tracker.get_stats.return_value = {
            "controlStats": {},
            "treatmentStats": {},
            "minSampleSize": 30,
            "significanceLevel": 0.05,
        }
        mock_tester.test.return_value = {
            "decision": "promote",
            "reason": "treatment 显著优于 control",
        }

        # 注册 promote 回调
        promote_callback = AsyncMock(return_value=True)
        sched.register_promote_callback(promote_callback)

        result = await sched._run_once()
        assert result["promoted_count"] == 1
        mock_tracker.mark_decided.assert_called_once_with(
            "test-1", "promote", reason="treatment 显著优于 control"
        )
        promote_callback.assert_called_once()

    @pytest.mark.asyncio
    async def test_rollback_decision(self, fresh_scheduler):
        """检验结果 rollback → mark_decided + 调用回调。"""
        sched, mock_tracker, mock_runner, mock_tester = fresh_scheduler
        fresh_time = datetime.now(timezone.utc).isoformat()
        mock_tracker.list_tests.return_value = [{
            "testId": "test-1",
            "skillName": "skill-a",
            "controlVersion": "1.0.0",
            "treatmentVersion": "1.1.0",
            "status": "running",
            "startedAt": fresh_time,
            "significanceLevel": 0.05,
            "minSampleSize": 30,
        }]
        mock_tracker.get_stats.return_value = {
            "controlStats": {},
            "treatmentStats": {},
            "minSampleSize": 30,
            "significanceLevel": 0.05,
        }
        mock_tester.test.return_value = {
            "decision": "rollback",
            "reason": "treatment 显著劣于 control",
        }

        rollback_callback = AsyncMock(return_value=True)
        sched.register_rollback_callback(rollback_callback)

        result = await sched._run_once()
        assert result["rolled_back_count"] == 1
        mock_tracker.mark_decided.assert_called_once_with(
            "test-1", "rollback", reason="treatment 显著劣于 control"
        )
        rollback_callback.assert_called_once()

    @pytest.mark.asyncio
    async def test_inconclusive_no_decision(self, fresh_scheduler):
        """检验 inconclusive → 不 mark_decided。"""
        sched, mock_tracker, mock_runner, mock_tester = fresh_scheduler
        fresh_time = datetime.now(timezone.utc).isoformat()
        mock_tracker.list_tests.return_value = [{
            "testId": "test-1",
            "skillName": "skill-a",
            "controlVersion": "1.0.0",
            "treatmentVersion": "1.1.0",
            "status": "running",
            "startedAt": fresh_time,
            "significanceLevel": 0.05,
            "minSampleSize": 30,
        }]
        mock_tracker.get_stats.return_value = {
            "controlStats": {},
            "treatmentStats": {},
        }
        mock_tester.test.return_value = {
            "decision": "inconclusive",
            "reason": "差异不显著",
        }

        result = await sched._run_once()
        assert result["promoted_count"] == 0
        assert result["rolled_back_count"] == 0
        # 不调 mark_decided
        mock_tracker.mark_decided.assert_not_called()

    @pytest.mark.asyncio
    async def test_significance_tester_exception_skipped(self, fresh_scheduler):
        """significance_tester 抛异常 → 跳过该测试,不阻塞循环。"""
        sched, mock_tracker, mock_runner, mock_tester = fresh_scheduler
        fresh_time = datetime.now(timezone.utc).isoformat()
        mock_tracker.list_tests.return_value = [{
            "testId": "test-1",
            "skillName": "skill-a",
            "controlVersion": "1.0.0",
            "treatmentVersion": "1.1.0",
            "status": "running",
            "startedAt": fresh_time,
            "significanceLevel": 0.05,
            "minSampleSize": 30,
        }]
        mock_tracker.get_stats.return_value = {
            "controlStats": {},
            "treatmentStats": {},
        }
        mock_tester.test.side_effect = RuntimeError("test failed")

        # 不抛异常
        result = await sched._run_once()
        assert result["promoted_count"] == 0
        assert result["rolled_back_count"] == 0

    @pytest.mark.asyncio
    async def test_mark_decided_failure_does_not_call_callback(self, fresh_scheduler):
        """mark_decided 返回 False → 不调用回调。"""
        sched, mock_tracker, mock_runner, mock_tester = fresh_scheduler
        fresh_time = datetime.now(timezone.utc).isoformat()
        mock_tracker.list_tests.return_value = [{
            "testId": "test-1",
            "skillName": "skill-a",
            "controlVersion": "1.0.0",
            "treatmentVersion": "1.1.0",
            "status": "running",
            "startedAt": fresh_time,
            "significanceLevel": 0.05,
            "minSampleSize": 30,
        }]
        mock_tracker.get_stats.return_value = {
            "controlStats": {},
            "treatmentStats": {},
        }
        mock_tester.test.return_value = {
            "decision": "promote",
            "reason": "x",
        }
        mock_tracker.mark_decided.return_value = False  # mark_decided 失败

        promote_callback = AsyncMock(return_value=True)
        sched.register_promote_callback(promote_callback)

        result = await sched._run_once()
        assert result["promoted_count"] == 0  # 不计入 promoted
        promote_callback.assert_not_called()

    @pytest.mark.asyncio
    async def test_promote_callback_exception_does_not_propagate(self, fresh_scheduler):
        """promote 回调抛异常 → 不向上抛(只 warning)。"""
        sched, mock_tracker, mock_runner, mock_tester = fresh_scheduler
        fresh_time = datetime.now(timezone.utc).isoformat()
        mock_tracker.list_tests.return_value = [{
            "testId": "test-1",
            "skillName": "skill-a",
            "controlVersion": "1.0.0",
            "treatmentVersion": "1.1.0",
            "status": "running",
            "startedAt": fresh_time,
            "significanceLevel": 0.05,
            "minSampleSize": 30,
        }]
        mock_tracker.get_stats.return_value = {
            "controlStats": {},
            "treatmentStats": {},
        }
        mock_tester.test.return_value = {
            "decision": "promote",
            "reason": "x",
        }

        async def _cb_fails(*args):
            raise RuntimeError("callback failed")
        sched.register_promote_callback(_cb_fails)

        # 不抛异常
        result = await sched._run_once()
        assert result["promoted_count"] == 1  # 仍计入(mark_decided 成功)

    @pytest.mark.asyncio
    async def test_cleanup_inactive_called(self, fresh_scheduler):
        """循环末尾调 shadow_runner.cleanup_inactive。"""
        sched, mock_tracker, mock_runner, mock_tester = fresh_scheduler
        await sched._run_once()
        mock_runner.cleanup_inactive.assert_called_once()

    @pytest.mark.asyncio
    async def test_no_stats_skipped(self, fresh_scheduler):
        """get_stats 返回 None → 跳过检验。"""
        sched, mock_tracker, mock_runner, mock_tester = fresh_scheduler
        fresh_time = datetime.now(timezone.utc).isoformat()
        mock_tracker.list_tests.return_value = [{
            "testId": "test-1",
            "skillName": "skill-a",
            "controlVersion": "1.0.0",
            "treatmentVersion": "1.1.0",
            "status": "running",
            "startedAt": fresh_time,
            "significanceLevel": 0.05,
            "minSampleSize": 30,
        }]
        mock_tracker.get_stats.return_value = None

        result = await sched._run_once()
        assert result["promoted_count"] == 0
        # 不调 test
        mock_tester.test.assert_not_called()


# =============================================================================
# _run_once_safe:异常处理 + 历史记录
# =============================================================================


class TestRunOnceSafe:
    """_run_once_safe 异常捕获 + 历史记录。"""

    @pytest.mark.asyncio
    async def test_success_records_history(self, fresh_scheduler):
        sched, _, _, _ = fresh_scheduler
        await sched._run_once_safe()
        assert len(sched._history) == 1
        entry = sched._history[0]
        assert entry["status"] == "success"
        assert entry["duration_ms"] >= 0

    @pytest.mark.asyncio
    async def test_failure_records_history(self, fresh_scheduler):
        sched, mock_tracker, _, _ = fresh_scheduler
        # 让 _run_once 抛异常
        mock_tracker.flush_all_running.side_effect = RuntimeError("db down")
        await sched._run_once_safe()
        assert len(sched._history) == 1
        entry = sched._history[0]
        assert entry["status"] == "failed"
        assert "db down" in entry["error"]


class TestTriggerNow:
    """trigger_now 手动触发。"""

    @pytest.mark.asyncio
    async def test_trigger_now_calls_run_once(self, fresh_scheduler):
        sched, mock_tracker, mock_runner, mock_tester = fresh_scheduler
        mock_tracker.list_tests.return_value = []
        result = await sched.trigger_now()
        assert "flushed_count" in result


# =============================================================================
# _is_expired / _append_history
# =============================================================================


class TestIsExpired:
    """_is_expired 静态方法。"""

    def test_recent_not_expired(self):
        now = datetime.now(timezone.utc).isoformat()
        assert ABTestScheduler._is_expired(now, max_duration_seconds=86400) is False

    def test_old_expired(self):
        old = (datetime.now(timezone.utc) - timedelta(days=2)).isoformat()
        assert ABTestScheduler._is_expired(old, max_duration_seconds=86400) is True

    def test_empty_string_not_expired(self):
        assert ABTestScheduler._is_expired("", max_duration_seconds=86400) is False

    def test_invalid_string_not_expired(self):
        assert ABTestScheduler._is_expired("not a date", max_duration_seconds=86400) is False

    def test_naive_datetime_assumed_utc(self):
        # naive datetime 假设 UTC
        naive_old = (datetime.utcnow() - timedelta(days=2)).isoformat()
        assert ABTestScheduler._is_expired(naive_old, max_duration_seconds=86400) is True


class TestAppendHistory:
    """_append_history LRU 上限。"""

    def test_lru_keeps_last_n(self, monkeypatch):
        monkeypatch.setenv("AB_TEST_ENABLED", "false")
        sched = ABTestScheduler()
        # 写入 _HISTORY_LIMIT + 5 条
        for i in range(_HISTORY_LIMIT + 5):
            entry: ABTestHistoryEntry = {
                "triggered_at": datetime.now(timezone.utc).isoformat(),
                "status": "success",
                "duration_ms": i,
                "flushed_count": 0,
                "checked_count": 0,
                "promoted_count": 0,
                "rolled_back_count": 0,
                "stopped_count": 0,
                "error": None,
                "extra": {},
            }
            sched._append_history(entry)
        assert len(sched._history) == _HISTORY_LIMIT
        # 保留的是最后 _HISTORY_LIMIT 条(duration_ms 4.._HISTORY_LIMIT+4)
        # 第一个 entry 的 duration_ms = 4(_HISTORY_LIMIT+5-1 - (_HISTORY_LIMIT-1) = 4)
        assert sched._history[0]["duration_ms"] == 5  # 0..29 共 30, 5..34 共 30 条,第 0 个是 5


class TestGetHistory:
    """get_history 历史查询。"""

    def test_empty(self):
        sched = ABTestScheduler()
        assert sched.get_history() == []

    def test_returns_last_n_reverse(self):
        sched = ABTestScheduler()
        for i in range(5):
            entry: ABTestHistoryEntry = {
                "triggered_at": datetime.now(timezone.utc).isoformat(),
                "status": "success",
                "duration_ms": i,
                "flushed_count": 0,
                "checked_count": 0,
                "promoted_count": 0,
                "rolled_back_count": 0,
                "stopped_count": 0,
                "error": None,
                "extra": {},
            }
            sched._append_history(entry)
        # get_history 倒序(最新在前)
        history = sched.get_history(limit=3)
        assert len(history) == 3
        # 最新的是最后 append 的(duration_ms=4)
        assert history[0]["duration_ms"] == 4

    def test_limit_zero_returns_empty(self):
        sched = ABTestScheduler()
        for i in range(5):
            entry: ABTestHistoryEntry = {
                "triggered_at": datetime.now(timezone.utc).isoformat(),
                "status": "success",
                "duration_ms": i,
                "flushed_count": 0,
                "checked_count": 0,
                "promoted_count": 0,
                "rolled_back_count": 0,
                "stopped_count": 0,
                "error": None,
                "extra": {},
            }
            sched._append_history(entry)
        assert sched.get_history(limit=0) == []


# =============================================================================
# 全局单例
# =============================================================================


class TestSingleton:
    """全局单例 ab_test_scheduler。"""

    def test_singleton_exists(self):
        assert ab_test_scheduler is not None
        assert isinstance(ab_test_scheduler, ABTestScheduler)
