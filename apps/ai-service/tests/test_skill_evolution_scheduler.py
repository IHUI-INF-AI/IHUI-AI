"""Skill 自进化调度器测试(L3,2026-07-25 立)。

覆盖 skill_evolution_scheduler.py:
- SkillEvolutionScheduler 配置加载(_init_config / 环境变量)
- start / stop / set_enabled / get_status / get_history
- _run_once:发现 skill + 逐个迭代优化
- _discover_skills_to_evolve:扫描失败反馈达阈值的 skill
- _evolve_skill:调 skill_evolution_loop.iterate_on_feedback
- _run_once_safe:异常捕获 + history 写入
- trigger_now:手动触发(单 skill / 全量发现)
- _append_history:LRU 上限
- 单例 skill_evolution_scheduler
"""

from __future__ import annotations

import asyncio
from datetime import datetime, timezone
from unittest.mock import AsyncMock, MagicMock

import pytest

from app.services.skill_evolution_scheduler import (
    SkillEvolutionScheduler,
    _HISTORY_LIMIT,
    _safe_int,
    skill_evolution_scheduler,
)


# =============================================================================
# _safe_int:环境变量解析
# =============================================================================


class TestSafeInt:
    """_safe_int:环境变量解析。"""

    def test_none_returns_default(self):
        assert _safe_int(None, 42) == 42

    def test_empty_string_returns_default(self):
        assert _safe_int("", 42) == 42

    def test_valid_int(self):
        assert _safe_int("100", 42) == 100

    def test_invalid_int_returns_default(self):
        assert _safe_int("not-a-number", 42) == 42


# =============================================================================
# _init_config:环境变量加载
# =============================================================================


class TestInitConfig:
    """_init_config:从环境变量加载配置。"""

    def test_default_values(self, monkeypatch):
        """无环境变量时使用默认值。"""
        for key in (
            "SKILL_EVOLUTION_ENABLED",
            "SKILL_EVOLUTION_INTERVAL_SECONDS",
            "SKILL_EVOLUTION_MIN_FAILURES",
            "SKILL_EVOLUTION_MAX_SKILLS_PER_RUN",
            "SKILL_EVOLUTION_START_DELAY_SECONDS",
        ):
            monkeypatch.delenv(key, raising=False)
        sched = SkillEvolutionScheduler()
        sched._init_config()
        assert sched.enabled is False
        assert sched.interval_seconds == 21600  # 6 小时
        assert sched.min_failures == 3
        assert sched.max_skills_per_run == 5
        assert sched.start_delay_seconds == 300

    def test_env_overrides(self, monkeypatch):
        """环境变量覆盖默认值。"""
        monkeypatch.setenv("SKILL_EVOLUTION_ENABLED", "true")
        monkeypatch.setenv("SKILL_EVOLUTION_INTERVAL_SECONDS", "3600")
        monkeypatch.setenv("SKILL_EVOLUTION_MIN_FAILURES", "5")
        monkeypatch.setenv("SKILL_EVOLUTION_MAX_SKILLS_PER_RUN", "2")
        monkeypatch.setenv("SKILL_EVOLUTION_START_DELAY_SECONDS", "60")
        sched = SkillEvolutionScheduler()
        sched._init_config()
        assert sched.enabled is True
        assert sched.interval_seconds == 3600
        assert sched.min_failures == 5
        assert sched.max_skills_per_run == 2
        assert sched.start_delay_seconds == 60

    def test_enabled_case_insensitive(self, monkeypatch):
        """SKILL_EVOLUTION_ENABLED 大小写不敏感。"""
        monkeypatch.setenv("SKILL_EVOLUTION_ENABLED", "TRUE")
        sched = SkillEvolutionScheduler()
        sched._init_config()
        assert sched.enabled is True


# =============================================================================
# 启停 / 状态查询
# =============================================================================


class TestStartStop:
    """start / stop:调度循环启停。"""

    @pytest.mark.asyncio
    async def test_start_creates_task(self, monkeypatch):
        monkeypatch.setenv("SKILL_EVOLUTION_ENABLED", "false")
        sched = SkillEvolutionScheduler()
        try:
            await sched.start()
            assert sched._task is not None
            assert not sched._task.done()
        finally:
            await sched.stop()

    @pytest.mark.asyncio
    async def test_start_idempotent(self, monkeypatch):
        monkeypatch.setenv("SKILL_EVOLUTION_ENABLED", "false")
        sched = SkillEvolutionScheduler()
        try:
            await sched.start()
            task1 = sched._task
            await sched.start()
            assert sched._task is task1
        finally:
            await sched.stop()

    @pytest.mark.asyncio
    async def test_stop_when_not_started(self):
        sched = SkillEvolutionScheduler()
        await sched.stop()
        assert sched._task is None

    @pytest.mark.asyncio
    async def test_set_enabled_runtime(self):
        sched = SkillEvolutionScheduler()
        assert sched.enabled is False
        sched.set_enabled(True)
        assert sched.enabled is True

    @pytest.mark.asyncio
    async def test_get_status(self, monkeypatch):
        monkeypatch.setenv("SKILL_EVOLUTION_ENABLED", "true")
        monkeypatch.setenv("SKILL_EVOLUTION_INTERVAL_SECONDS", "1800")
        sched = SkillEvolutionScheduler()
        sched._init_config()
        status = sched.get_status()
        assert status["enabled"] is True
        assert status["intervalSeconds"] == 1800
        assert status["minFailures"] == 3
        assert status["running"] is False
        assert status["historyCount"] == 0
        assert status["lastRun"] is None


# =============================================================================
# _discover_skills_to_evolve:扫描失败反馈达阈值的 skill
# =============================================================================


class TestDiscoverSkills:
    """_discover_skills_to_evolve:扫描所有 skill 找出需要迭代的。"""

    @pytest.mark.asyncio
    async def test_returns_skills_above_threshold(self, monkeypatch):
        """失败案例 ≥ min_failures 的 skill 加入候选列表。"""
        sched = SkillEvolutionScheduler()
        sched._init_config()
        sched.min_failures = 3

        # mock skill_registry.list
        mock_skill_a = MagicMock()
        mock_skill_a.name = "skill-a"
        mock_skill_b = MagicMock()
        mock_skill_b.name = "skill-b"
        mock_skill_c = MagicMock()
        mock_skill_c.name = "skill-c"

        mock_registry = MagicMock()
        mock_registry.list = MagicMock(return_value=[mock_skill_a, mock_skill_b, mock_skill_c])
        monkeypatch.setattr(
            "app.services.skills.skill_registry", mock_registry
        )

        # mock skill_feedback_tracker.get_failure_cases
        async def fake_get_failures(skill_name: str):
            if skill_name == "skill-a":
                return [{"id": "f1"}, {"id": "f2"}, {"id": "f3"}, {"id": "f4"}]  # 4 个
            elif skill_name == "skill-b":
                return [{"id": "f1"}, {"id": "f2"}]  # 2 个,< 3 阈值
            elif skill_name == "skill-c":
                return [{"id": "f1"}, {"id": "f2"}, {"id": "f3"}]  # 3 个,刚好达标
            return []

        mock_tracker = MagicMock()
        mock_tracker.get_failure_cases = fake_get_failures
        monkeypatch.setattr(
            "app.services.skill_feedback.skill_feedback_tracker", mock_tracker
        )

        skills = await sched._discover_skills_to_evolve()
        # skill-a(4)+ skill-c(3)达标,按失败数倒序
        assert skills == ["skill-a", "skill-c"]

    @pytest.mark.asyncio
    async def test_no_skills_above_threshold(self, monkeypatch):
        """所有 skill 失败案例都未达阈值 → 空列表。"""
        sched = SkillEvolutionScheduler()
        sched._init_config()

        mock_skill = MagicMock()
        mock_skill.name = "skill-a"
        mock_registry = MagicMock()
        mock_registry.list = MagicMock(return_value=[mock_skill])
        monkeypatch.setattr("app.services.skills.skill_registry", mock_registry)

        async def fake_get_failures(skill_name: str):
            return [{"id": "f1"}]  # 1 个,< 3 阈值

        mock_tracker = MagicMock()
        mock_tracker.get_failure_cases = fake_get_failures
        monkeypatch.setattr(
            "app.services.skill_feedback.skill_feedback_tracker", mock_tracker
        )

        skills = await sched._discover_skills_to_evolve()
        assert skills == []

    @pytest.mark.asyncio
    async def test_registry_exception_returns_empty(self, monkeypatch):
        """skill_registry.list 抛异常 → 返回空列表。"""
        sched = SkillEvolutionScheduler()
        mock_registry = MagicMock()
        mock_registry.list = MagicMock(side_effect=RuntimeError("registry down"))
        monkeypatch.setattr("app.services.skills.skill_registry", mock_registry)
        skills = await sched._discover_skills_to_evolve()
        assert skills == []

    @pytest.mark.asyncio
    async def test_skill_without_name_skipped(self, monkeypatch):
        """无 name 属性的 skill 跳过。"""
        sched = SkillEvolutionScheduler()
        sched._init_config()
        mock_skill_no_name = MagicMock()
        mock_skill_no_name.name = ""
        mock_skill_valid = MagicMock()
        mock_skill_valid.name = "valid-skill"
        mock_registry = MagicMock()
        mock_registry.list = MagicMock(return_value=[mock_skill_no_name, mock_skill_valid])
        monkeypatch.setattr("app.services.skills.skill_registry", mock_registry)

        async def fake_get_failures(skill_name: str):
            if skill_name == "valid-skill":
                return [{"id": f"f{i}"} for i in range(5)]  # 5 个,达标
            return []

        mock_tracker = MagicMock()
        mock_tracker.get_failure_cases = fake_get_failures
        monkeypatch.setattr(
            "app.services.skill_feedback.skill_feedback_tracker", mock_tracker
        )
        skills = await sched._discover_skills_to_evolve()
        assert skills == ["valid-skill"]

    @pytest.mark.asyncio
    async def test_failure_cases_exception_skipped(self, monkeypatch):
        """单个 skill 的 get_failure_cases 异常 → 跳过该 skill。"""
        sched = SkillEvolutionScheduler()
        sched._init_config()

        mock_skill_a = MagicMock()
        mock_skill_a.name = "skill-a"
        mock_skill_b = MagicMock()
        mock_skill_b.name = "skill-b"

        mock_registry = MagicMock()
        mock_registry.list = MagicMock(return_value=[mock_skill_a, mock_skill_b])
        monkeypatch.setattr("app.services.skills.skill_registry", mock_registry)

        async def fake_get_failures(skill_name: str):
            if skill_name == "skill-a":
                raise RuntimeError("db down")
            elif skill_name == "skill-b":
                return [{"id": f"f{i}"} for i in range(5)]
            return []

        mock_tracker = MagicMock()
        mock_tracker.get_failure_cases = fake_get_failures
        monkeypatch.setattr(
            "app.services.skill_feedback.skill_feedback_tracker", mock_tracker
        )
        skills = await sched._discover_skills_to_evolve()
        # skill-a 异常被跳过,skill-b 正常返回
        assert skills == ["skill-b"]


# =============================================================================
# _evolve_skill:单 skill 迭代优化
# =============================================================================


class TestEvolveSkill:
    """_evolve_skill:调 skill_evolution_loop.iterate_on_feedback。"""

    @pytest.mark.asyncio
    async def test_normal_iteration(self, monkeypatch):
        """正常迭代 → 返回 shouldIterate=True + 新版本信息。"""
        sched = SkillEvolutionScheduler()
        iteration_result = {
            "shouldIterate": True,
            "newVersion": "1.1.0",
            "newContent": "improved skill content",
            "reason": "added error handling",
            "expectedImprovements": ["better error handling", "clearer steps"],
        }
        mock_loop = MagicMock()
        mock_loop.iterate_on_feedback = AsyncMock(return_value=iteration_result)
        monkeypatch.setattr(
            "app.services.skills.skill_evolution_loop", mock_loop
        )
        result = await sched._evolve_skill("my-skill")
        assert result["skillName"] == "my-skill"
        assert result["shouldIterate"] is True
        assert result["newVersion"] == "1.1.0"
        assert result["reason"] == "added error handling"
        assert len(result["expectedImprovements"]) == 2

    @pytest.mark.asyncio
    async def test_no_iteration_needed(self, monkeypatch):
        """skill_evolution_loop 返回 shouldIterate=False → 不迭代。"""
        sched = SkillEvolutionScheduler()
        iteration_result = {
            "shouldIterate": False,
            "reason": "skill 不存在",
            "expectedImprovements": [],
        }
        mock_loop = MagicMock()
        mock_loop.iterate_on_feedback = AsyncMock(return_value=iteration_result)
        monkeypatch.setattr(
            "app.services.skills.skill_evolution_loop", mock_loop
        )
        result = await sched._evolve_skill("nonexistent")
        assert result["shouldIterate"] is False
        assert result["newVersion"] is None

    @pytest.mark.asyncio
    async def test_exception_propagates(self, monkeypatch):
        """skill_evolution_loop 抛异常 → 向上抛(由 _run_once 捕获)。"""
        sched = SkillEvolutionScheduler()
        mock_loop = MagicMock()
        mock_loop.iterate_on_feedback = AsyncMock(side_effect=RuntimeError("LLM down"))
        monkeypatch.setattr(
            "app.services.skills.skill_evolution_loop", mock_loop
        )
        with pytest.raises(RuntimeError, match="LLM down"):
            await sched._evolve_skill("my-skill")

    @pytest.mark.asyncio
    async def test_missing_fields_use_defaults(self, monkeypatch):
        """skill_evolution_loop 返回空 dict → 用默认值。"""
        sched = SkillEvolutionScheduler()
        mock_loop = MagicMock()
        mock_loop.iterate_on_feedback = AsyncMock(return_value={})
        monkeypatch.setattr(
            "app.services.skills.skill_evolution_loop", mock_loop
        )
        result = await sched._evolve_skill("my-skill")
        assert result["shouldIterate"] is False
        assert result["newVersion"] is None
        assert result["reason"] == ""
        assert result["expectedImprovements"] == []


# =============================================================================
# _run_once:完整循环
# =============================================================================


class TestRunOnce:
    """_run_once:发现 skill + 逐个迭代优化。"""

    @pytest.mark.asyncio
    async def test_no_skills_returns_zero(self, monkeypatch):
        sched = SkillEvolutionScheduler()
        monkeypatch.setattr(
            sched, "_discover_skills_to_evolve", AsyncMock(return_value=[])
        )
        result = await sched._run_once()
        assert result["skills_processed"] == 0
        assert result["total_iterated"] == 0
        assert result["total_rolled_back"] == 0
        assert result["skill_breakdown"] == []

    @pytest.mark.asyncio
    async def test_single_skill_iterated(self, monkeypatch):
        sched = SkillEvolutionScheduler()
        monkeypatch.setattr(
            sched, "_discover_skills_to_evolve", AsyncMock(return_value=["skill-a"])
        )
        monkeypatch.setattr(
            sched,
            "_evolve_skill",
            AsyncMock(return_value={
                "skillName": "skill-a",
                "shouldIterate": True,
                "newVersion": "1.1.0",
                "reason": "improved",
                "expectedImprovements": [],
            }),
        )
        result = await sched._run_once()
        assert result["skills_processed"] == 1
        assert result["total_iterated"] == 1
        assert result["total_rolled_back"] == 0  # newVersion 存在,不算回滚
        assert len(result["skill_breakdown"]) == 1

    @pytest.mark.asyncio
    async def test_rolled_back_counted(self, monkeypatch):
        """shouldIterate=True 但 newVersion=None → 视为回滚。"""
        sched = SkillEvolutionScheduler()
        monkeypatch.setattr(
            sched, "_discover_skills_to_evolve", AsyncMock(return_value=["skill-a"])
        )
        monkeypatch.setattr(
            sched,
            "_evolve_skill",
            AsyncMock(return_value={
                "skillName": "skill-a",
                "shouldIterate": True,
                "newVersion": None,  # 没有新版本 = 回滚
                "reason": "测试通过率未提升,已回滚",
                "expectedImprovements": [],
            }),
        )
        result = await sched._run_once()
        assert result["total_iterated"] == 1
        assert result["total_rolled_back"] == 1  # 回滚计数

    @pytest.mark.asyncio
    async def test_multiple_skills_accumulate(self, monkeypatch):
        sched = SkillEvolutionScheduler()
        sched._init_config()
        monkeypatch.setattr(
            sched,
            "_discover_skills_to_evolve",
            AsyncMock(return_value=["s1", "s2", "s3"]),
        )
        monkeypatch.setattr(
            sched,
            "_evolve_skill",
            AsyncMock(return_value={
                "skillName": "x",
                "shouldIterate": True,
                "newVersion": "2.0.0",
                "reason": "",
                "expectedImprovements": [],
            }),
        )
        result = await sched._run_once()
        assert result["skills_processed"] == 3
        assert result["total_iterated"] == 3
        assert result["total_rolled_back"] == 0

    @pytest.mark.asyncio
    async def test_max_skills_limit(self, monkeypatch):
        """超过 max_skills_per_run 的 skill 被截断。"""
        sched = SkillEvolutionScheduler()
        sched._init_config()
        sched.max_skills_per_run = 2
        monkeypatch.setattr(
            sched,
            "_discover_skills_to_evolve",
            AsyncMock(return_value=["s1", "s2", "s3", "s4"]),
        )
        monkeypatch.setattr(
            sched,
            "_evolve_skill",
            AsyncMock(return_value={
                "skillName": "x",
                "shouldIterate": False,
                "newVersion": None,
                "reason": "",
                "expectedImprovements": [],
            }),
        )
        result = await sched._run_once()
        assert result["skills_processed"] == 2  # 截断到 2

    @pytest.mark.asyncio
    async def test_skill_exception_isolated(self, monkeypatch):
        """单个 skill 失败不影响其他 skill。"""
        sched = SkillEvolutionScheduler()
        monkeypatch.setattr(
            sched,
            "_discover_skills_to_evolve",
            AsyncMock(return_value=["s1", "s2", "s3"]),
        )

        async def fake_evolve(name: str) -> dict:
            if name == "s2":
                raise RuntimeError("LLM failed for s2")
            return {
                "skillName": name,
                "shouldIterate": True,
                "newVersion": "1.1.0",
                "reason": "",
                "expectedImprovements": [],
            }

        monkeypatch.setattr(sched, "_evolve_skill", fake_evolve)
        result = await sched._run_once()
        assert result["skills_processed"] == 3  # 失败的也算 processed
        assert result["total_iterated"] == 2  # s2 失败不计
        # s2 在 breakdown 有 error 字段
        s2_breakdown = next(b for b in result["skill_breakdown"] if b["skillName"] == "s2")
        assert "error" in s2_breakdown
        assert "LLM failed for s2" in s2_breakdown["error"]


# =============================================================================
# _run_once_safe:异常捕获 + history
# =============================================================================


class TestRunOnceSafe:
    """_run_once_safe:异常捕获 + history 写入。"""

    @pytest.mark.asyncio
    async def test_success_writes_history(self, monkeypatch):
        sched = SkillEvolutionScheduler()
        sched._history.clear()
        monkeypatch.setattr(
            sched,
            "_run_once",
            AsyncMock(return_value={
                "skills_processed": 2,
                "total_iterated": 1,
                "total_rolled_back": 0,
                "skill_breakdown": [{"skillName": "s1"}, {"skillName": "s2"}],
            }),
        )
        await sched._run_once_safe()
        assert len(sched._history) == 1
        entry = sched._history[0]
        assert entry["status"] == "success"
        assert entry["skills_processed"] == 2
        assert entry["total_iterated"] == 1
        assert entry["total_rolled_back"] == 0
        assert entry["error"] is None
        assert "skillBreakdown" in entry["extra"]
        assert len(entry["extra"]["skillBreakdown"]) == 2

    @pytest.mark.asyncio
    async def test_failure_writes_history_with_error(self, monkeypatch):
        sched = SkillEvolutionScheduler()
        sched._history.clear()
        monkeypatch.setattr(
            sched,
            "_run_once",
            AsyncMock(side_effect=RuntimeError("test failure")),
        )
        await sched._run_once_safe()
        assert len(sched._history) == 1
        entry = sched._history[0]
        assert entry["status"] == "failed"
        assert "RuntimeError: test failure" in entry["error"]
        assert entry["skills_processed"] == 0

    @pytest.mark.asyncio
    async def test_skill_breakdown_truncated_to_5(self, monkeypatch):
        """skill_breakdown 截断到前 5 个,避免 history 过大。"""
        sched = SkillEvolutionScheduler()
        sched._history.clear()
        many_skills = [{"skillName": f"s{i}"} for i in range(10)]
        monkeypatch.setattr(
            sched,
            "_run_once",
            AsyncMock(return_value={
                "skills_processed": 10,
                "total_iterated": 0,
                "total_rolled_back": 0,
                "skill_breakdown": many_skills,
            }),
        )
        await sched._run_once_safe()
        entry = sched._history[0]
        assert len(entry["extra"]["skillBreakdown"]) == 5


# =============================================================================
# trigger_now:手动触发
# =============================================================================


class TestTriggerNow:
    """trigger_now:手动触发一次 skill 自进化。"""

    @pytest.mark.asyncio
    async def test_single_skill(self, monkeypatch):
        sched = SkillEvolutionScheduler()
        expected = {
            "skillName": "my-skill",
            "shouldIterate": True,
            "newVersion": "1.1.0",
            "reason": "improved",
            "expectedImprovements": [],
        }
        monkeypatch.setattr(
            sched, "_evolve_skill", AsyncMock(return_value=expected)
        )
        result = await sched.trigger_now("my-skill")
        assert result == expected

    @pytest.mark.asyncio
    async def test_no_skill_triggers_run_once(self, monkeypatch):
        sched = SkillEvolutionScheduler()
        expected = {
            "skills_processed": 1,
            "total_iterated": 1,
            "total_rolled_back": 0,
            "skill_breakdown": [{"skillName": "auto"}],
        }
        monkeypatch.setattr(
            sched, "_run_once", AsyncMock(return_value=expected)
        )
        result = await sched.trigger_now(None)
        assert result == expected


# =============================================================================
# _append_history:LRU 上限
# =============================================================================


class TestAppendHistory:
    """_append_history:LRU 保留最近 N 条。"""

    def test_appends_entries(self):
        sched = SkillEvolutionScheduler()
        sched._history.clear()
        for i in range(5):
            sched._append_history({
                "triggered_at": f"t{i}",
                "status": "success",
                "duration_ms": i * 100,
                "skills_processed": i,
                "total_iterated": 0,
                "total_rolled_back": 0,
                "error": None,
                "extra": {},
            })
        assert len(sched._history) == 5
        assert sched._history[-1]["skills_processed"] == 4

    def test_lru_cap(self):
        sched = SkillEvolutionScheduler()
        sched._history.clear()
        for i in range(_HISTORY_LIMIT + 5):
            sched._append_history({
                "triggered_at": f"t{i}",
                "status": "success",
                "duration_ms": i,
                "skills_processed": i,
                "total_iterated": 0,
                "total_rolled_back": 0,
                "error": None,
                "extra": {},
            })
        assert len(sched._history) == _HISTORY_LIMIT
        assert sched._history[0]["skills_processed"] == 5  # 最旧 5 条丢弃
        assert sched._history[-1]["skills_processed"] == _HISTORY_LIMIT + 4


# =============================================================================
# get_history:历史查询
# =============================================================================


class TestGetHistory:
    """get_history:返回最近 N 条(倒序)。"""

    def test_empty_returns_empty_list(self):
        sched = SkillEvolutionScheduler()
        sched._history.clear()
        assert sched.get_history() == []

    def test_returns_reversed(self):
        sched = SkillEvolutionScheduler()
        sched._history.clear()
        for i in range(3):
            sched._append_history({
                "triggered_at": f"t{i}",
                "status": "success",
                "duration_ms": i,
                "skills_processed": i,
                "total_iterated": 0,
                "total_rolled_back": 0,
                "error": None,
                "extra": {},
            })
        history = sched.get_history()
        assert len(history) == 3
        assert history[0]["triggered_at"] == "t2"  # 最新在前
        assert history[2]["triggered_at"] == "t0"

    def test_limit_capped(self):
        sched = SkillEvolutionScheduler()
        sched._history.clear()
        for i in range(5):
            sched._append_history({
                "triggered_at": f"t{i}",
                "status": "success",
                "duration_ms": i,
                "skills_processed": i,
                "total_iterated": 0,
                "total_rolled_back": 0,
                "error": None,
                "extra": {},
            })
        history = sched.get_history(limit=2)
        assert len(history) == 2
        assert history[0]["triggered_at"] == "t4"

    def test_zero_limit_returns_empty(self):
        sched = SkillEvolutionScheduler()
        sched._history.clear()
        sched._append_history({
            "triggered_at": "t1",
            "status": "success",
            "duration_ms": 0,
            "skills_processed": 0,
            "total_iterated": 0,
            "total_rolled_back": 0,
            "error": None,
            "extra": {},
        })
        assert sched.get_history(limit=0) == []


# =============================================================================
# 单例 skill_evolution_scheduler
# =============================================================================


class TestSingleton:
    """skill_evolution_scheduler 单例。"""

    def test_module_singleton_exists(self):
        assert skill_evolution_scheduler is not None
        assert isinstance(skill_evolution_scheduler, SkillEvolutionScheduler)

    def test_singleton_identity(self):
        from app.services.skill_evolution_scheduler import (
            skill_evolution_scheduler as ses2,
        )
        assert skill_evolution_scheduler is ses2
