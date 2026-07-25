"""梦境固化调度器测试(L2-5,2026-07-25 立)。

覆盖 dream_scheduler.py:
- DreamScheduler 配置加载(_init_config / 环境变量)
- start / stop / set_enabled / get_status / get_history
- _run_once:发现用户 + 逐个梦境固化
- _discover_users_to_dream:DB 查询未固化 episodic 阈值用户
- _dream_for_user:调 dream_service.consolidate + forget
- _run_once_safe:异常捕获 + history 写入
- trigger_now:手动触发(单用户 / 全量发现)
- _append_history:LRU 上限
- 单例 dream_scheduler
"""

from __future__ import annotations

import asyncio
from datetime import datetime, timezone
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.services import dream_scheduler as ds_module
from app.services.dream_scheduler import (
    DreamScheduler,
    _HISTORY_LIMIT,
    _safe_float,
    _safe_int,
    dream_scheduler,
)


# =============================================================================
# _safe_int / _safe_float:环境变量解析
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

    def test_negative_int(self):
        assert _safe_int("-5", 42) == -5


class TestSafeFloat:
    """_safe_float:环境变量解析。"""

    def test_none_returns_default(self):
        assert _safe_float(None, 0.5) == 0.5

    def test_valid_float(self):
        assert _safe_float("0.25", 0.5) == 0.25

    def test_invalid_float_returns_default(self):
        assert _safe_float("not-a-float", 0.5) == 0.5

    def test_int_string(self):
        assert _safe_float("1", 0.5) == 1.0


# =============================================================================
# _init_config:环境变量加载
# =============================================================================


class TestInitConfig:
    """_init_config:从环境变量加载配置。"""

    def test_default_values(self, monkeypatch):
        """无环境变量时使用默认值。"""
        for key in (
            "DREAM_ENABLED",
            "DREAM_INTERVAL_SECONDS",
            "DREAM_EPISODIC_THRESHOLD",
            "DREAM_FORGET_THRESHOLD",
            "DREAM_MAX_USERS_PER_RUN",
            "DREAM_START_DELAY_SECONDS",
        ):
            monkeypatch.delenv(key, raising=False)
        sched = DreamScheduler()
        sched._init_config()
        assert sched.enabled is False
        assert sched.interval_seconds == 3600
        assert sched.episodic_threshold == 50
        assert sched.forget_threshold == 0.1
        assert sched.max_users_per_run == 10
        assert sched.start_delay_seconds == 120

    def test_env_overrides(self, monkeypatch):
        """环境变量覆盖默认值。"""
        monkeypatch.setenv("DREAM_ENABLED", "true")
        monkeypatch.setenv("DREAM_INTERVAL_SECONDS", "1800")
        monkeypatch.setenv("DREAM_EPISODIC_THRESHOLD", "20")
        monkeypatch.setenv("DREAM_FORGET_THRESHOLD", "0.05")
        monkeypatch.setenv("DREAM_MAX_USERS_PER_RUN", "5")
        monkeypatch.setenv("DREAM_START_DELAY_SECONDS", "30")
        sched = DreamScheduler()
        sched._init_config()
        assert sched.enabled is True
        assert sched.interval_seconds == 1800
        assert sched.episodic_threshold == 20
        assert sched.forget_threshold == 0.05
        assert sched.max_users_per_run == 5
        assert sched.start_delay_seconds == 30

    def test_enabled_case_insensitive(self, monkeypatch):
        """DREAM_ENABLED 大小写不敏感。"""
        monkeypatch.setenv("DREAM_ENABLED", "TRUE")
        sched = DreamScheduler()
        sched._init_config()
        assert sched.enabled is True

        monkeypatch.setenv("DREAM_ENABLED", "True")
        sched._init_config()
        assert sched.enabled is True

    def test_invalid_env_falls_back(self, monkeypatch):
        """非法环境变量回退到默认值。"""
        monkeypatch.setenv("DREAM_INTERVAL_SECONDS", "not-a-number")
        monkeypatch.setenv("DREAM_EPISODIC_THRESHOLD", "")
        monkeypatch.setenv("DREAM_FORGET_THRESHOLD", "garbage")
        sched = DreamScheduler()
        sched._init_config()
        assert sched.interval_seconds == 3600
        assert sched.episodic_threshold == 50
        assert sched.forget_threshold == 0.1


# =============================================================================
# 启停 / 状态查询
# =============================================================================


class TestStartStop:
    """start / stop:调度循环启停。"""

    @pytest.mark.asyncio
    async def test_start_creates_task(self, monkeypatch):
        """start 创建后台 task。"""
        monkeypatch.setenv("DREAM_ENABLED", "false")
        sched = DreamScheduler()
        try:
            await sched.start()
            assert sched._task is not None
            assert not sched._task.done()
        finally:
            await sched.stop()

    @pytest.mark.asyncio
    async def test_start_idempotent(self, monkeypatch):
        """重复 start 不创建第二个 task。"""
        monkeypatch.setenv("DREAM_ENABLED", "false")
        sched = DreamScheduler()
        try:
            await sched.start()
            task1 = sched._task
            await sched.start()
            assert sched._task is task1
        finally:
            await sched.stop()

    @pytest.mark.asyncio
    async def test_stop_when_not_started(self):
        """未 start 时 stop 不抛错。"""
        sched = DreamScheduler()
        await sched.stop()
        assert sched._task is None

    @pytest.mark.asyncio
    async def test_stop_cancels_task(self, monkeypatch):
        """stop 取消正在运行的 task。"""
        monkeypatch.setenv("DREAM_ENABLED", "false")
        monkeypatch.setenv("DREAM_START_DELAY_SECONDS", "0")
        monkeypatch.setenv("DREAM_INTERVAL_SECONDS", "1")
        sched = DreamScheduler()
        await sched.start()
        await sched.stop()
        assert sched._task is None

    @pytest.mark.asyncio
    async def test_set_enabled_runtime(self):
        """set_enabled 在运行时切换。"""
        sched = DreamScheduler()
        assert sched.enabled is False
        sched.set_enabled(True)
        assert sched.enabled is True
        sched.set_enabled(False)
        assert sched.enabled is False

    @pytest.mark.asyncio
    async def test_get_status(self, monkeypatch):
        """get_status 返回当前状态。"""
        monkeypatch.setenv("DREAM_ENABLED", "true")
        monkeypatch.setenv("DREAM_INTERVAL_SECONDS", "600")
        sched = DreamScheduler()
        sched._init_config()
        status = sched.get_status()
        assert status["enabled"] is True
        assert status["intervalSeconds"] == 600
        assert status["episodicThreshold"] == 50
        assert status["running"] is False
        assert status["historyCount"] == 0
        assert status["lastRun"] is None


# =============================================================================
# _discover_users_to_dream:DB 查询
# =============================================================================


class TestDiscoverUsers:
    """_discover_users_to_dream:查询未固化 episodic 阈值用户。"""

    @pytest.mark.asyncio
    async def test_returns_user_ids(self, monkeypatch):
        """DB 返回用户列表 → 转换为 str list。"""
        sched = DreamScheduler()
        sched._init_config()
        mock_conn = MagicMock()
        mock_conn.fetch = AsyncMock(return_value=[
            {"user_id": "user-001"},
            {"user_id": "user-002"},
        ])
        mock_pool = MagicMock()
        mock_pool.acquire = MagicMock(return_value=AsyncMockContextManager(mock_conn))
        monkeypatch.setattr(
            "app.services.dream_scheduler._get_pool",
            AsyncMock(return_value=mock_pool),
        )
        users = await sched._discover_users_to_dream()
        assert users == ["user-001", "user-002"]

    @pytest.mark.asyncio
    async def test_filters_null_user_id(self, monkeypatch):
        """user_id IS NULL 已被 SQL 过滤,但 Python 层防御性跳过。"""
        sched = DreamScheduler()
        mock_conn = MagicMock()
        mock_conn.fetch = AsyncMock(return_value=[
            {"user_id": "user-001"},
            {"user_id": None},  # 防御性
        ])
        mock_pool = MagicMock()
        mock_pool.acquire = MagicMock(return_value=AsyncMockContextManager(mock_conn))
        monkeypatch.setattr(
            "app.services.dream_scheduler._get_pool",
            AsyncMock(return_value=mock_pool),
        )
        users = await sched._discover_users_to_dream()
        assert users == ["user-001"]

    @pytest.mark.asyncio
    async def test_db_exception_returns_empty(self, monkeypatch):
        """DB 异常 → 返回空列表,不抛错。"""
        sched = DreamScheduler()
        mock_pool = MagicMock()
        mock_pool.acquire = MagicMock(side_effect=RuntimeError("db down"))
        monkeypatch.setattr(
            "app.services.dream_scheduler._get_pool",
            AsyncMock(return_value=mock_pool),
        )
        users = await sched._discover_users_to_dream()
        assert users == []

    @pytest.mark.asyncio
    async def test_empty_result(self, monkeypatch):
        """无符合条件的用户 → 空列表。"""
        sched = DreamScheduler()
        mock_conn = MagicMock()
        mock_conn.fetch = AsyncMock(return_value=[])
        mock_pool = MagicMock()
        mock_pool.acquire = MagicMock(return_value=AsyncMockContextManager(mock_conn))
        monkeypatch.setattr(
            "app.services.dream_scheduler._get_pool",
            AsyncMock(return_value=mock_pool),
        )
        users = await sched._discover_users_to_dream()
        assert users == []


# =============================================================================
# _dream_for_user:单用户梦境固化
# =============================================================================


class TestDreamForUser:
    """_dream_for_user:调 dream_service.consolidate + forget。"""

    @pytest.mark.asyncio
    async def test_normal_execution(self, monkeypatch):
        """正常执行 → 合并 consolidate + forget 结果。"""
        sched = DreamScheduler()
        sched._init_config()

        consolidate_result = {
            "userId": "u1",
            "consolidatedCount": 5,
            "patterns": ["search-then-read"],
            "proceduralUpdated": 2,
            "forgottenCount": 0,
            "topic": "AI 记忆系统",
            "durationMs": 1500,
        }
        forget_result = {
            "userId": "u1",
            "forgottenCount": 3,
            "decayedCount": 7,
            "threshold": 0.1,
        }
        monkeypatch.setattr(
            "app.services.dream_scheduler.dream_service",
            MagicMock(
                consolidate=AsyncMock(return_value=consolidate_result),
                forget=AsyncMock(return_value=forget_result),
            ),
        )
        result = await sched._dream_for_user("u1")
        assert result["userId"] == "u1"
        assert result["consolidatedCount"] == 5
        assert result["forgottenCount"] == 3
        assert result["topic"] == "AI 记忆系统"
        assert result["durationMs"] == 1500  # forget 无 durationMs,fallback 0

    @pytest.mark.asyncio
    async def test_consolidate_exception_propagates(self, monkeypatch):
        """consolidate 抛异常 → 向上抛(由 _run_once 的 try 捕获)。"""
        sched = DreamScheduler()
        monkeypatch.setattr(
            "app.services.dream_scheduler.dream_service",
            MagicMock(
                consolidate=AsyncMock(side_effect=RuntimeError("LLM down")),
                forget=AsyncMock(return_value={"forgottenCount": 0}),
            ),
        )
        with pytest.raises(RuntimeError, match="LLM down"):
            await sched._dream_for_user("u1")

    @pytest.mark.asyncio
    async def test_forget_exception_propagates(self, monkeypatch):
        """forget 抛异常 → 向上抛。"""
        sched = DreamScheduler()
        monkeypatch.setattr(
            "app.services.dream_scheduler.dream_service",
            MagicMock(
                consolidate=AsyncMock(return_value={"consolidatedCount": 1, "durationMs": 100}),
                forget=AsyncMock(side_effect=RuntimeError("DB down")),
            ),
        )
        with pytest.raises(RuntimeError, match="DB down"):
            await sched._dream_for_user("u1")

    @pytest.mark.asyncio
    async def test_missing_fields_use_defaults(self, monkeypatch):
        """consolidate / forget 缺字段 → 用默认值 0。"""
        sched = DreamScheduler()
        monkeypatch.setattr(
            "app.services.dream_scheduler.dream_service",
            MagicMock(
                consolidate=AsyncMock(return_value={}),  # 完全空
                forget=AsyncMock(return_value={}),
            ),
        )
        result = await sched._dream_for_user("u1")
        assert result["consolidatedCount"] == 0
        assert result["forgottenCount"] == 0
        assert result["durationMs"] == 0
        assert result["topic"] == ""


# =============================================================================
# _run_once:完整循环
# =============================================================================


class TestRunOnce:
    """_run_once:发现用户 + 逐个梦境固化。"""

    @pytest.mark.asyncio
    async def test_no_users_returns_zero(self, monkeypatch):
        """无用户 → users_processed=0。"""
        sched = DreamScheduler()
        monkeypatch.setattr(
            sched, "_discover_users_to_dream", AsyncMock(return_value=[])
        )
        result = await sched._run_once()
        assert result["users_processed"] == 0
        assert result["total_consolidated"] == 0
        assert result["total_forgotten"] == 0
        assert result["user_breakdown"] == []

    @pytest.mark.asyncio
    async def test_single_user(self, monkeypatch):
        """单个用户 → 处理并返回 breakdown。"""
        sched = DreamScheduler()
        monkeypatch.setattr(
            sched, "_discover_users_to_dream", AsyncMock(return_value=["u1"])
        )
        monkeypatch.setattr(
            sched,
            "_dream_for_user",
            AsyncMock(return_value={
                "userId": "u1",
                "consolidatedCount": 3,
                "forgottenCount": 1,
                "topic": "测试主题",
                "durationMs": 500,
            }),
        )
        result = await sched._run_once()
        assert result["users_processed"] == 1
        assert result["total_consolidated"] == 3
        assert result["total_forgotten"] == 1
        assert len(result["user_breakdown"]) == 1
        assert result["user_breakdown"][0]["userId"] == "u1"

    @pytest.mark.asyncio
    async def test_multiple_users_accumulate(self, monkeypatch):
        """多个用户 → 累加统计。"""
        sched = DreamScheduler()
        sched._init_config()  # max_users_per_run 默认 10
        monkeypatch.setattr(
            sched,
            "_discover_users_to_dream",
            AsyncMock(return_value=["u1", "u2", "u3"]),
        )

        async def fake_dream(uid: str) -> dict:
            return {
                "userId": uid,
                "consolidatedCount": 2,
                "forgottenCount": 1,
                "topic": "",
                "durationMs": 100,
            }

        monkeypatch.setattr(sched, "_dream_for_user", fake_dream)
        result = await sched._run_once()
        assert result["users_processed"] == 3
        assert result["total_consolidated"] == 6  # 3 * 2
        assert result["total_forgotten"] == 3  # 3 * 1
        assert len(result["user_breakdown"]) == 3

    @pytest.mark.asyncio
    async def test_max_users_limit(self, monkeypatch):
        """超过 max_users_per_run 的用户被截断。"""
        sched = DreamScheduler()
        sched._init_config()
        sched.max_users_per_run = 2
        users = ["u1", "u2", "u3", "u4", "u5"]
        monkeypatch.setattr(
            sched, "_discover_users_to_dream", AsyncMock(return_value=users)
        )
        monkeypatch.setattr(
            sched,
            "_dream_for_user",
            AsyncMock(return_value={
                "userId": "x",
                "consolidatedCount": 1,
                "forgottenCount": 0,
                "topic": "",
                "durationMs": 0,
            }),
        )
        result = await sched._run_once()
        assert result["users_processed"] == 2  # 截断到 2

    @pytest.mark.asyncio
    async def test_user_exception_isolated(self, monkeypatch):
        """单个用户失败不影响其他用户。"""
        sched = DreamScheduler()
        monkeypatch.setattr(
            sched,
            "_discover_users_to_dream",
            AsyncMock(return_value=["u1", "u2", "u3"]),
        )

        call_count = {"n": 0}

        async def fake_dream(uid: str) -> dict:
            call_count["n"] += 1
            if uid == "u2":
                raise RuntimeError("simulated failure")
            return {
                "userId": uid,
                "consolidatedCount": 1,
                "forgottenCount": 0,
                "topic": "",
                "durationMs": 50,
            }

        monkeypatch.setattr(sched, "_dream_for_user", fake_dream)
        result = await sched._run_once()
        assert result["users_processed"] == 3  # 失败的也算 processed
        assert result["total_consolidated"] == 2  # u2 失败不计
        # u2 在 breakdown 有 error 字段
        u2_breakdown = next(b for b in result["user_breakdown"] if b["userId"] == "u2")
        assert "error" in u2_breakdown
        assert "simulated failure" in u2_breakdown["error"]


# =============================================================================
# _run_once_safe:异常捕获 + history
# =============================================================================


class TestRunOnceSafe:
    """_run_once_safe:异常捕获 + history 写入。"""

    @pytest.mark.asyncio
    async def test_success_writes_history(self, monkeypatch):
        """成功执行 → history 追加一条 success 记录。"""
        sched = DreamScheduler()
        sched._history.clear()
        monkeypatch.setattr(
            sched,
            "_run_once",
            AsyncMock(return_value={
                "users_processed": 2,
                "total_consolidated": 5,
                "total_forgotten": 1,
                "user_breakdown": [{"userId": "u1"}, {"userId": "u2"}],
            }),
        )
        await sched._run_once_safe()
        assert len(sched._history) == 1
        entry = sched._history[0]
        assert entry["status"] == "success"
        assert entry["users_processed"] == 2
        assert entry["total_consolidated"] == 5
        assert entry["total_forgotten"] == 1
        assert entry["error"] is None
        assert entry["duration_ms"] >= 0
        assert "userBreakdown" in entry["extra"]
        # extra 仅保留前 5 个用户
        assert len(entry["extra"]["userBreakdown"]) == 2

    @pytest.mark.asyncio
    async def test_failure_writes_history_with_error(self, monkeypatch):
        """_run_once 抛异常 → history 追加一条 failed 记录。"""
        sched = DreamScheduler()
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
        assert entry["users_processed"] == 0  # 失败时默认值

    @pytest.mark.asyncio
    async def test_user_breakdown_truncated_to_5(self, monkeypatch):
        """user_breakdown 截断到前 5 个,避免 history 过大。"""
        sched = DreamScheduler()
        sched._history.clear()
        many_users = [{"userId": f"u{i}"} for i in range(10)]
        monkeypatch.setattr(
            sched,
            "_run_once",
            AsyncMock(return_value={
                "users_processed": 10,
                "total_consolidated": 0,
                "total_forgotten": 0,
                "user_breakdown": many_users,
            }),
        )
        await sched._run_once_safe()
        entry = sched._history[0]
        assert len(entry["extra"]["userBreakdown"]) == 5  # 仅前 5


# =============================================================================
# trigger_now:手动触发
# =============================================================================


class TestTriggerNow:
    """trigger_now:手动触发一次梦境固化。"""

    @pytest.mark.asyncio
    async def test_single_user(self, monkeypatch):
        """指定 user_id → 直接 _dream_for_user。"""
        sched = DreamScheduler()
        expected = {
            "userId": "u1",
            "consolidatedCount": 1,
            "forgottenCount": 0,
            "topic": "",
            "durationMs": 100,
        }
        monkeypatch.setattr(
            sched, "_dream_for_user", AsyncMock(return_value=expected)
        )
        result = await sched.trigger_now("u1")
        assert result == expected

    @pytest.mark.asyncio
    async def test_no_user_triggers_run_once(self, monkeypatch):
        """未指定 user_id → 调 _run_once 发现用户。"""
        sched = DreamScheduler()
        expected = {
            "users_processed": 1,
            "total_consolidated": 2,
            "total_forgotten": 0,
            "user_breakdown": [{"userId": "auto"}],
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
        sched = DreamScheduler()
        sched._history.clear()
        for i in range(5):
            sched._append_history({
                "triggered_at": f"2026-07-25T00:00:0{i}+00:00",
                "status": "success",
                "duration_ms": 100 * i,
                "users_processed": i,
                "total_consolidated": 0,
                "total_forgotten": 0,
                "error": None,
                "extra": {},
            })
        assert len(sched._history) == 5
        assert sched._history[0]["users_processed"] == 0
        assert sched._history[-1]["users_processed"] == 4

    def test_lru_cap(self):
        """超过 _HISTORY_LIMIT 时丢弃最旧的。"""
        sched = DreamScheduler()
        sched._history.clear()
        # 写入 _HISTORY_LIMIT + 5 条
        for i in range(_HISTORY_LIMIT + 5):
            sched._append_history({
                "triggered_at": f"2026-07-25T00:00:{i:02d}+00:00",
                "status": "success",
                "duration_ms": i,
                "users_processed": i,
                "total_consolidated": 0,
                "total_forgotten": 0,
                "error": None,
                "extra": {},
            })
        assert len(sched._history) == _HISTORY_LIMIT
        # 最旧的 5 条已被丢弃
        assert sched._history[0]["users_processed"] == 5
        # 最新的保留
        assert sched._history[-1]["users_processed"] == _HISTORY_LIMIT + 4


# =============================================================================
# get_history:历史查询
# =============================================================================


class TestGetHistory:
    """get_history:返回最近 N 条(倒序)。"""

    def test_empty_returns_empty_list(self):
        sched = DreamScheduler()
        sched._history.clear()
        assert sched.get_history() == []

    def test_returns_reversed(self):
        sched = DreamScheduler()
        sched._history.clear()
        for i in range(3):
            sched._append_history({
                "triggered_at": f"t{i}",
                "status": "success",
                "duration_ms": i,
                "users_processed": i,
                "total_consolidated": 0,
                "total_forgotten": 0,
                "error": None,
                "extra": {},
            })
        # 默认 limit=10,返回最近 3 条倒序
        history = sched.get_history()
        assert len(history) == 3
        assert history[0]["triggered_at"] == "t2"  # 最新在前
        assert history[2]["triggered_at"] == "t0"

    def test_limit_capped(self):
        sched = DreamScheduler()
        sched._history.clear()
        for i in range(5):
            sched._append_history({
                "triggered_at": f"t{i}",
                "status": "success",
                "duration_ms": i,
                "users_processed": i,
                "total_consolidated": 0,
                "total_forgotten": 0,
                "error": None,
                "extra": {},
            })
        history = sched.get_history(limit=2)
        assert len(history) == 2
        assert history[0]["triggered_at"] == "t4"
        assert history[1]["triggered_at"] == "t3"

    def test_zero_limit_returns_empty(self):
        sched = DreamScheduler()
        sched._history.clear()
        sched._append_history({
            "triggered_at": "t1",
            "status": "success",
            "duration_ms": 0,
            "users_processed": 0,
            "total_consolidated": 0,
            "total_forgotten": 0,
            "error": None,
            "extra": {},
        })
        assert sched.get_history(limit=0) == []


# =============================================================================
# 单例 dream_scheduler
# =============================================================================


class TestSingleton:
    """dream_scheduler 单例。"""

    def test_module_singleton_exists(self):
        assert dream_scheduler is not None
        assert isinstance(dream_scheduler, DreamScheduler)

    def test_singleton_identity(self):
        """重复 import 返回同一实例。"""
        from app.services.dream_scheduler import dream_scheduler as ds2
        assert dream_scheduler is ds2


# =============================================================================
# 辅助:AsyncMockContextManager(支持 async with pool.acquire())
# =============================================================================


class AsyncMockContextManager:
    """模拟 `async with pool.acquire() as conn:` 的上下文管理器。

    用法:
        mock_pool.acquire = MagicMock(return_value=AsyncMockContextManager(mock_conn))
    """

    def __init__(self, conn: MagicMock) -> None:
        self._conn = conn

    async def __aenter__(self) -> MagicMock:
        return self._conn

    async def __aexit__(self, *args: object) -> None:
        pass
