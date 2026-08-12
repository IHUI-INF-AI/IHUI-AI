"""元学习调度器测试(L4-5,2026-07-25 立)。

覆盖 meta_learner_scheduler.py:
- MetaLearnerScheduler 配置加载(_init_config / 环境变量)
- start / stop / set_enabled / get_status / get_history
- _run_once:收集失败案例 + 触发元学习
- _collect_all_failure_cases:扫描所有 skill
- _run_once_safe:异常捕获 + history 写入
- trigger_now:手动触发
- _append_history:LRU 上限
- 单例 meta_learner_scheduler
"""

from __future__ import annotations

import asyncio
from datetime import datetime, timedelta, timezone
from unittest.mock import AsyncMock, MagicMock

import pytest

from app.services.meta_learner_scheduler import (
    MetaLearnerScheduler,
    _HISTORY_LIMIT,
    _safe_int,
    meta_learner_scheduler,
)


# =============================================================================
# _safe_int:环境变量解析
# =============================================================================


class TestSafeInt:
    """_safe_int:环境变量解析。"""

    def test_none_returns_default(self):
        assert _safe_int(None, 42) == 42

    def test_empty_returns_default(self):
        assert _safe_int("", 42) == 42

    def test_valid_int(self):
        assert _safe_int("100", 42) == 100

    def test_invalid_returns_default(self):
        assert _safe_int("abc", 42) == 42


# =============================================================================
# _init_config:环境变量加载
# =============================================================================


class TestInitConfig:
    """_init_config:从环境变量加载配置。"""

    def test_default_values(self, monkeypatch):
        for key in (
            "META_LEARNER_ENABLED",
            "META_LEARNER_INTERVAL_SECONDS",
            "META_LEARNER_MIN_FAILURES",
            "META_LEARNER_START_DELAY_SECONDS",
        ):
            monkeypatch.delenv(key, raising=False)
        sched = MetaLearnerScheduler()
        sched._init_config()
        assert sched.enabled is False
        assert sched.interval_seconds == 43200  # 12 小时
        assert sched.min_failures == 10
        assert sched.start_delay_seconds == 600

    def test_env_overrides(self, monkeypatch):
        monkeypatch.setenv("META_LEARNER_ENABLED", "true")
        monkeypatch.setenv("META_LEARNER_INTERVAL_SECONDS", "3600")
        monkeypatch.setenv("META_LEARNER_MIN_FAILURES", "5")
        monkeypatch.setenv("META_LEARNER_START_DELAY_SECONDS", "60")
        sched = MetaLearnerScheduler()
        sched._init_config()
        assert sched.enabled is True
        assert sched.interval_seconds == 3600
        assert sched.min_failures == 5
        assert sched.start_delay_seconds == 60

    def test_enabled_case_insensitive(self, monkeypatch):
        monkeypatch.setenv("META_LEARNER_ENABLED", "TRUE")
        sched = MetaLearnerScheduler()
        sched._init_config()
        assert sched.enabled is True


# =============================================================================
# 启停 / 状态查询
# =============================================================================


class TestStartStop:
    """start / stop:调度循环启停。"""

    @pytest.mark.asyncio
    async def test_start_creates_task(self, monkeypatch):
        monkeypatch.setenv("META_LEARNER_ENABLED", "false")
        sched = MetaLearnerScheduler()
        try:
            await sched.start()
            assert sched._task is not None
            assert not sched._task.done()
        finally:
            await sched.stop()

    @pytest.mark.asyncio
    async def test_start_idempotent(self):
        """重复 start 不会创建多个 task。"""
        sched = MetaLearnerScheduler()
        try:
            await sched.start()
            task1 = sched._task
            await sched.start()
            assert sched._task is task1
        finally:
            await sched.stop()

    @pytest.mark.asyncio
    async def test_stop_clears_task(self):
        sched = MetaLearnerScheduler()
        await sched.start()
        await sched.stop()
        assert sched._task is None

    @pytest.mark.asyncio
    async def test_stop_without_start_no_error(self):
        sched = MetaLearnerScheduler()
        await sched.stop()  # 不应抛异常

    def test_set_enabled(self):
        sched = MetaLearnerScheduler()
        sched.set_enabled(True)
        assert sched.enabled is True
        sched.set_enabled(False)
        assert sched.enabled is False

    def test_get_status(self):
        sched = MetaLearnerScheduler()
        sched._init_config()
        status = sched.get_status()
        assert "enabled" in status
        assert "intervalSeconds" in status
        assert "minFailures" in status
        assert "running" in status
        assert "historyCount" in status
        assert "metaLearnerStatus" in status

    def test_get_history_empty(self):
        sched = MetaLearnerScheduler()
        assert sched.get_history() == []

    def test_get_history_limit(self):
        sched = MetaLearnerScheduler()
        # 模拟历史
        for i in range(5):
            sched._history.append({
                "triggered_at": f"2026-07-25T10:0{i}:00Z",
                "status": "success",
                "duration_ms": 100,
                "total_failures_collected": 10,
                "patterns_count": 2,
                "lessons_extracted": 2,
                "lessons_persisted": 2,
                "error": None,
                "extra": {},
            })
        history = sched.get_history(limit=3)
        assert len(history) == 3
        # 倒序(最新在前)
        assert history[0]["triggered_at"] == "2026-07-25T10:04:00Z"

    def test_get_history_zero_returns_empty(self):
        sched = MetaLearnerScheduler()
        assert sched.get_history(limit=0) == []


# =============================================================================
# _run_once:主流程
# =============================================================================


class TestRunOnce:
    """_run_once:收集失败案例 + 触发元学习。"""

    @pytest.mark.asyncio
    async def test_below_threshold_returns_zero(self, monkeypatch):
        """失败案例 < min_failures → 返回 0 patterns / 0 lessons。"""
        sched = MetaLearnerScheduler()
        sched._init_config()
        sched.min_failures = 100  # 高阈值
        monkeypatch.setattr(
            sched, "_collect_all_failure_cases",
            AsyncMock(return_value=[{"skillName": "s1"}]),
        )
        result = await sched._run_once()
        assert result["total_failures_collected"] == 1
        assert result["patterns_count"] == 0
        assert result["lessons_extracted"] == 0

    @pytest.mark.asyncio
    async def test_triggers_learn_from_failures(self, monkeypatch):
        """失败案例 >= min_failures → 调 meta_learner.learn_from_failures。"""
        sched = MetaLearnerScheduler()
        sched._init_config()
        sched.min_failures = 5

        # mock _collect_all_failure_cases 返回 10 条
        failures = [{"skillName": f"s{i}"} for i in range(10)]
        monkeypatch.setattr(
            sched, "_collect_all_failure_cases",
            AsyncMock(return_value=failures),
        )

        # mock meta_learner.learn_from_failures
        async def fake_learn(cases):
            return {
                "patternsCount": 2,
                "lessonsExtracted": 3,
                "lessonsPersisted": 3,
                "patterns": [{"patternId": "fp_1"}],
                "lessons": [{"lessonId": "l1"}],
            }
        mock_learner = MagicMock()
        mock_learner.learn_from_failures = fake_learn
        monkeypatch.setattr(
            "app.services.meta_learner.meta_learner", mock_learner
        )

        result = await sched._run_once()
        assert result["total_failures_collected"] == 10
        assert result["patterns_count"] == 2
        assert result["lessons_extracted"] == 3
        assert result["lessons_persisted"] == 3


# =============================================================================
# _collect_all_failure_cases
# =============================================================================


class TestCollectFailureCases:
    """_collect_all_failure_cases:扫描所有 skill 收集失败案例。

    autouse fixture 隔离全局 checkpoint manager(L5-1 新增 Agent 失败收集段后):
    agent_loop_v2 等其他测试会在全局 manager 残留 failed checkpoint,
    若不 mock 为空,收集结果会被污染导致断言失败(实测 3 → 6)。
    """

    @pytest.fixture(autouse=True)
    def _isolate_checkpoint_manager(self, monkeypatch):
        """mock get_agent_checkpoint_manager 返回空 checkpoint 列表。"""

        class _EmptyManager:
            async def list_checkpoints(self):
                return []

        monkeypatch.setattr(
            "app.services.agent_checkpoint.get_agent_checkpoint_manager",
            lambda: _EmptyManager(),
        )

    @pytest.mark.asyncio
    async def test_collects_agent_checkpoint_failures(self, monkeypatch):
        """L5-1:Agent 任务失败案例(checkpoint status=failed)被收集进元学习闭环。

        failed checkpoint → 收集为 agent_loop 失败案例;completed 不收集。
        """
        sched = MetaLearnerScheduler()
        mock_registry = MagicMock()
        mock_registry.list_skills = MagicMock(return_value=[])
        monkeypatch.setattr(
            "app.services.skills.skill_registry", mock_registry
        )

        class _FakeCP:
            status = "failed"
            checkpoint_id = "cp-failed-1"
            session_id = "sess-1"
            iteration = 2
            created_at = 1234567890.0
            metadata = {"error": "LLM 网关超时", "error_type": "timeout"}

        class _FakeOKCP:
            status = "completed"
            checkpoint_id = "cp-ok-1"
            session_id = "sess-2"
            iteration = 3
            created_at = 1234567891.0
            metadata = {}

        class _FakeManager:
            async def list_checkpoints(self):
                return [_FakeCP(), _FakeOKCP()]

        monkeypatch.setattr(
            "app.services.agent_checkpoint.get_agent_checkpoint_manager",
            lambda: _FakeManager(),
        )

        result = await sched._collect_all_failure_cases()

        # 只收集 failed,completed 被过滤
        assert len(result) == 1
        assert result[0]["skillName"] == "agent_loop"
        assert result[0]["failureReason"] == "LLM 网关超时"
        assert result[0]["extra"]["errorType"] == "timeout"
        assert result[0]["extra"]["checkpointId"] == "cp-failed-1"

    @pytest.mark.asyncio
    async def test_no_skills_returns_empty(self, monkeypatch):
        sched = MetaLearnerScheduler()
        mock_registry = MagicMock()
        mock_registry.list_skills = MagicMock(return_value=[])
        monkeypatch.setattr(
            "app.services.skills.skill_registry", mock_registry
        )
        result = await sched._collect_all_failure_cases()
        assert result == []

    @pytest.mark.asyncio
    async def test_collects_from_all_skills(self, monkeypatch):
        sched = MetaLearnerScheduler()

        # mock skill_registry.list
        mock_skill_a = MagicMock()
        mock_skill_a.name = "skill-a"
        mock_skill_b = MagicMock()
        mock_skill_b.name = "skill-b"
        mock_registry = MagicMock()
        mock_registry.list_skills = MagicMock(
            return_value=[mock_skill_a, mock_skill_b]
        )
        monkeypatch.setattr(
            "app.services.skills.skill_registry", mock_registry
        )

        # mock skill_feedback_tracker.get_failure_cases
        async def fake_get_failures(skill_name, limit=-1):
            if skill_name == "skill-a":
                return [{"skillName": "skill-a", "failureReason": "r1"}]
            elif skill_name == "skill-b":
                return [
                    {"skillName": "skill-b", "failureReason": "r2"},
                    {"skillName": "skill-b", "failureReason": "r3"},
                ]
            return []
        mock_tracker = MagicMock()
        mock_tracker.get_failure_cases = fake_get_failures
        monkeypatch.setattr(
            "app.services.skill_feedback.skill_feedback_tracker", mock_tracker
        )

        result = await sched._collect_all_failure_cases()
        assert len(result) == 3  # 1 + 2

    @pytest.mark.asyncio
    async def test_skill_without_name_skipped(self, monkeypatch):
        """name 为空的 skill 跳过。"""
        sched = MetaLearnerScheduler()
        mock_skill_no_name = MagicMock()
        mock_skill_no_name.name = ""
        mock_registry = MagicMock()
        mock_registry.list_skills = MagicMock(return_value=[mock_skill_no_name])
        monkeypatch.setattr(
            "app.services.skills.skill_registry", mock_registry
        )
        result = await sched._collect_all_failure_cases()
        assert result == []

    @pytest.mark.asyncio
    async def test_list_skills_exception_returns_empty(self, monkeypatch):
        """skill_registry.list 异常 → 返回 []。"""
        sched = MetaLearnerScheduler()
        mock_registry = MagicMock()
        mock_registry.list_skills = MagicMock(side_effect=RuntimeError("boom"))
        monkeypatch.setattr(
            "app.services.skills.skill_registry", mock_registry
        )
        result = await sched._collect_all_failure_cases()
        assert result == []

    @pytest.mark.asyncio
    async def test_get_failure_cases_exception_skipped(self, monkeypatch):
        """单个 skill get_failure_cases 异常 → 跳过该 skill,不阻塞其他。"""
        sched = MetaLearnerScheduler()
        mock_skill_a = MagicMock()
        mock_skill_a.name = "skill-a"
        mock_skill_b = MagicMock()
        mock_skill_b.name = "skill-b"
        mock_registry = MagicMock()
        mock_registry.list_skills = MagicMock(return_value=[mock_skill_a, mock_skill_b])
        monkeypatch.setattr(
            "app.services.skills.skill_registry", mock_registry
        )

        async def fake_get_failures(skill_name, limit=-1):
            if skill_name == "skill-a":
                raise RuntimeError("db down")
            return [{"skillName": "skill-b"}]
        mock_tracker = MagicMock()
        mock_tracker.get_failure_cases = fake_get_failures
        monkeypatch.setattr(
            "app.services.skill_feedback.skill_feedback_tracker", mock_tracker
        )

        result = await sched._collect_all_failure_cases()
        # skill-a 异常跳过,skill-b 正常返回 1 条
        assert len(result) == 1


# =============================================================================
# _run_once_safe:异常捕获
# =============================================================================


class TestRunOnceSafe:
    """_run_once_safe:异常捕获 + history 写入。"""

    @pytest.mark.asyncio
    async def test_success_appends_history(self, monkeypatch):
        sched = MetaLearnerScheduler()
        sched._init_config()

        async def fake_run_once():
            return {
                "total_failures_collected": 10,
                "patterns_count": 2,
                "lessons_extracted": 3,
                "lessons_persisted": 3,
                "patterns": [],
                "lessons": [],
            }
        monkeypatch.setattr(sched, "_run_once", fake_run_once)

        await sched._run_once_safe()
        assert len(sched._history) == 1
        entry = sched._history[0]
        assert entry["status"] == "success"
        assert entry["total_failures_collected"] == 10
        assert entry["patterns_count"] == 2

    @pytest.mark.asyncio
    async def test_exception_appends_failed_history(self, monkeypatch):
        sched = MetaLearnerScheduler()
        async def boom():
            raise RuntimeError("test error")
        monkeypatch.setattr(sched, "_run_once", boom)

        await sched._run_once_safe()
        assert len(sched._history) == 1
        entry = sched._history[0]
        assert entry["status"] == "failed"
        assert "RuntimeError" in entry["error"]


# =============================================================================
# trigger_now
# =============================================================================


class TestTriggerNow:
    """trigger_now:手动触发。"""

    @pytest.mark.asyncio
    async def test_trigger_now_calls_run_once(self, monkeypatch):
        sched = MetaLearnerScheduler()
        called = {"called": False}

        async def fake_run_once():
            called["called"] = True
            return {
                "total_failures_collected": 0,
                "patterns_count": 0,
                "lessons_extracted": 0,
                "lessons_persisted": 0,
                "patterns": [],
                "lessons": [],
            }
        monkeypatch.setattr(sched, "_run_once", fake_run_once)

        result = await sched.trigger_now()
        assert called["called"] is True
        assert result["total_failures_collected"] == 0


# =============================================================================
# _append_history:LRU 上限
# =============================================================================


class TestAppendHistory:
    """_append_history:LRU 保留最近 N 条。"""

    def test_appends_to_history(self):
        sched = MetaLearnerScheduler()
        entry = {
            "triggered_at": "2026-07-25T10:00:00Z",
            "status": "success",
            "duration_ms": 100,
            "total_failures_collected": 0,
            "patterns_count": 0,
            "lessons_extracted": 0,
            "lessons_persisted": 0,
            "error": None,
            "extra": {},
        }
        sched._append_history(entry)  # type: ignore[arg-type]
        assert len(sched._history) == 1

    def test_lru_keeps_last_n(self):
        sched = MetaLearnerScheduler()
        base_time = datetime(2026, 7, 25, 10, 0, 0, tzinfo=timezone.utc)
        for i in range(_HISTORY_LIMIT + 10):
            # 用 timedelta 累加,避免字符串拼接歧义
            ts = (base_time + timedelta(minutes=i)).isoformat()
            entry = {
                "triggered_at": ts,
                "status": "success",
                "duration_ms": 100,
                "total_failures_collected": 0,
                "patterns_count": 0,
                "lessons_extracted": 0,
                "lessons_persisted": 0,
                "error": None,
                "extra": {},
            }
            sched._append_history(entry)  # type: ignore[arg-type]
        # 不超过上限
        assert len(sched._history) == _HISTORY_LIMIT
        # 最新一条在最末尾(第 _HISTORY_LIMIT + 10 - 1 分钟)
        last_ts = (base_time + timedelta(minutes=_HISTORY_LIMIT + 9)).isoformat()
        assert sched._history[-1]["triggered_at"] == last_ts


# =============================================================================
# 单例
# =============================================================================


class TestSingleton:
    """meta_learner_scheduler 单例。"""

    def test_singleton_exists(self):
        assert meta_learner_scheduler is not None
        assert isinstance(meta_learner_scheduler, MetaLearnerScheduler)
