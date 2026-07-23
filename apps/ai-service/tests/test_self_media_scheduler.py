"""self_media_scheduler 综合测试(2026-07-23 立,补齐自媒体调度器零覆盖)。

覆盖维度(92 cases):
1. TypedDict 定义:TaskConfig / TaskDef / HistoryEntry 字段(3 tests)
2. 模块级常量:_CN_TZ / _HISTORY_LIMIT / TASK_DEFS 注册表(4 tests)
3. _safe_int 辅助函数:有效值 / None / 无效值 / 空串 / TypeError(5 tests)
4. 调度器初始化:默认配置 / 环境变量覆盖 / 任务注册表加载(11 tests)
5. set_task_enabled:启用 / 禁用 / 未知 task_id(3 tests)
6. set_task_config:修改各字段 / 边界值 / 未知 task_id / BUG 锁定(13 tests)
7. list_tasks / get_task:查询 / 结构 / 未知 / 配置变更反映(5 tests)
8. trigger_task:未知 / 成功 / 已运行 / 执行验证 / 不影响定时(6 tests)
9. _run_task:成功 / 失败 / 缺 title / 未知 task / duration / running 跟踪(8 tests)
10. _run_koubo:成功 / dry_run 传递 / 异常传播(3 tests)
11. _run_wechat:成功 / LLM 失败 / 空 content / {date} 替换(4 tests)
12. 历史记录 LRU:空 / 追加 / 超限丢弃 / 顺序 / 过滤 / limit 边界(9 tests)
13. start / stop:启动 / 幂等 / 停止 / 未启动停止 / 清理(5 tests)
14. _loop:匹配触发 / 同日不重复 / 未匹配 / 禁用 / 跨日重置 / 异常不崩(6 tests)
15. _run_task_safe:正常执行 / 异常吞没(2 tests)
16. _spawn_task:持有引用 / 完成后移除(2 tests)
17. 单例:存在 / 类型 / 状态(3 tests)

发现的源码 BUG(测试锁定当前行为,未修改源码):
- BUG-1: set_task_config(task, hour="abc") 抛 ValueError 而非返回 False(int 转换未 try/except)
- BUG-2: set_task_config(hour=10, minute=60) 部分应用不回滚(hour 已写入但返回 False)
- BUG-3: env SELF_MEDIA_CRON_MINUTE>=30 时 wechat 分钟回退到默认 30(而非 wrap 取模)
"""

from __future__ import annotations

import asyncio
import os
from datetime import datetime, timezone, timedelta
from pathlib import Path
from typing import Any
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.services.self_media_scheduler import (
    _CN_TZ,
    _HISTORY_LIMIT,
    _safe_int,
    HistoryEntry,
    SelfMediaScheduler,
    TASK_DEFS,
    TaskConfig,
    TaskDef,
    self_media_scheduler,
)


# =============================================================================
# 工厂函数
# =============================================================================


def make_history_entry(
    task_id: str = "koubo_daily",
    triggered_at: str = "2026-07-23T00:00:00+00:00",
    status: str = "success",
    duration_ms: int = 100,
    error: str | None = None,
    extra: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """构造历史记录条目(返回普通 dict,兼容 TypedDict)。"""
    return {
        "task_id": task_id,
        "triggered_at": triggered_at,
        "status": status,
        "duration_ms": duration_ms,
        "error": error,
        "extra": extra or {},
    }


class _FrozenDateTime(datetime):
    """测试用 datetime 替身,固定 now() 返回值,保留所有 datetime 方法。"""

    _frozen: datetime | None = None

    @classmethod
    def now(cls, tz=None):
        if cls._frozen is None:
            return super().now(tz)
        if tz is None:
            return cls._frozen.replace(tzinfo=None)
        return cls._frozen.astimezone(tz)

    @classmethod
    def freeze(cls, dt: datetime) -> None:
        cls._frozen = dt

    @classmethod
    def unfreeze(cls) -> None:
        cls._frozen = None


# =============================================================================
# fixtures
# =============================================================================


@pytest.fixture
def scheduler(monkeypatch):
    """每个测试一个全新的 SelfMediaScheduler 实例(隔离模块单例 + 环境变量)。"""
    for key in (
        "SELF_MEDIA_CRON_ENABLED",
        "SELF_MEDIA_CRON_HOUR",
        "SELF_MEDIA_CRON_MINUTE",
        "SELF_MEDIA_CRON_WECHAT_TITLE",
    ):
        monkeypatch.delenv(key, raising=False)
    return SelfMediaScheduler()


@pytest.fixture
def frozen_dt():
    """冻结 datetime,测试结束后自动解冻。"""
    _FrozenDateTime.freeze(datetime(2026, 7, 23, 8, 0, tzinfo=_CN_TZ))
    yield _FrozenDateTime
    _FrozenDateTime.unfreeze()


async def _run_loop_one_iteration(sched: SelfMediaScheduler) -> None:
    """运行 _loop 一次迭代后通过 CancelledError 退出。

    mock asyncio.sleep:第一次调用(60s 初始延迟)立即返回,
    第二次调用(迭代末尾)抛 CancelledError 中断循环。
    """
    sleep_calls = 0

    async def fake_sleep(seconds):
        nonlocal sleep_calls
        sleep_calls += 1
        if sleep_calls >= 2:
            raise asyncio.CancelledError()

    with patch("app.services.self_media_scheduler.asyncio.sleep", fake_sleep):
        with pytest.raises(asyncio.CancelledError):
            await sched._loop()

    # 等待所有 spawned tasks 完成 + 处理 done callback
    if sched._pending_tasks:
        await asyncio.gather(*sched._pending_tasks, return_exceptions=True)
        await asyncio.sleep(0)


# =============================================================================
# 1. TypedDict 定义(3 tests)
# =============================================================================


class TestTypedDicts:
    """TypedDict 字段定义验证。"""

    def test_task_config_has_expected_fields(self):
        """TaskConfig 应包含 hour/minute/dry_run/enabled/title_template 字段。"""
        cfg: TaskConfig = {
            "hour": 8,
            "minute": 30,
            "dry_run": True,
            "enabled": False,
            "title_template": "tpl",
        }
        assert cfg["hour"] == 8
        assert cfg["minute"] == 30
        assert cfg["dry_run"] is True
        assert cfg["enabled"] is False
        assert cfg["title_template"] == "tpl"

    def test_task_def_has_expected_fields(self):
        """TaskDef 应包含 id/name/description/category/default_hour/default_minute。"""
        tdef: TaskDef = {
            "id": "test",
            "name": "测试任务",
            "description": "desc",
            "category": "wechat",
            "default_hour": 9,
            "default_minute": 15,
        }
        assert tdef["id"] == "test"
        assert tdef["name"] == "测试任务"
        assert tdef["category"] == "wechat"
        assert tdef["default_hour"] == 9
        assert tdef["default_minute"] == 15

    def test_history_entry_has_expected_fields(self):
        """HistoryEntry 应包含 task_id/triggered_at/status/duration_ms/error/extra。"""
        entry: HistoryEntry = {
            "task_id": "koubo_daily",
            "triggered_at": "2026-07-23T00:00:00+00:00",
            "status": "success",
            "duration_ms": 500,
            "error": None,
            "extra": {"date": "0723"},
        }
        assert entry["task_id"] == "koubo_daily"
        assert entry["status"] == "success"
        assert entry["duration_ms"] == 500
        assert entry["error"] is None
        assert entry["extra"]["date"] == "0723"


# =============================================================================
# 2. 模块级常量(4 tests)
# =============================================================================


class TestModuleConstants:
    """模块级常量验证。"""

    def test_cn_tz_is_utc_plus_8(self):
        """_CN_TZ 应为东八区(UTC+8)。"""
        assert _CN_TZ == timezone(timedelta(hours=8))
        assert _CN_TZ.utcoffset(None) == timedelta(hours=8)

    def test_history_limit_is_30(self):
        """_HISTORY_LIMIT 应为 30。"""
        assert _HISTORY_LIMIT == 30

    def test_task_defs_has_two_entries(self):
        """TASK_DEFS 应包含 2 个任务(koubo_daily + wechat_daily)。"""
        assert len(TASK_DEFS) == 2
        ids = {t["id"] for t in TASK_DEFS}
        assert ids == {"koubo_daily", "wechat_daily"}

    def test_task_defs_fields_complete(self):
        """每个 TaskDef 应包含完整字段。"""
        for tdef in TASK_DEFS:
            assert "id" in tdef
            assert "name" in tdef
            assert "description" in tdef
            assert "category" in tdef
            assert tdef["category"] in ("wechat", "koubo")
            assert "default_hour" in tdef
            assert 0 <= tdef["default_hour"] <= 23
            assert "default_minute" in tdef
            assert 0 <= tdef["default_minute"] <= 59
        # 验证具体默认值
        koubo = next(t for t in TASK_DEFS if t["id"] == "koubo_daily")
        assert koubo["default_hour"] == 8
        assert koubo["default_minute"] == 0
        wechat = next(t for t in TASK_DEFS if t["id"] == "wechat_daily")
        assert wechat["default_hour"] == 8
        assert wechat["default_minute"] == 30


# =============================================================================
# 3. _safe_int 辅助函数(5 tests)
# =============================================================================


class TestSafeInt:
    """_safe_int 辅助函数边界测试。"""

    def test_valid_string(self):
        """有效数字字符串正常解析。"""
        assert _safe_int("10", 8) == 10
        assert _safe_int("0", 8) == 0
        assert _safe_int("-5", 8) == -5

    def test_none_returns_default(self):
        """None 返回默认值。"""
        assert _safe_int(None, 8) == 8
        assert _safe_int(None, 0) == 0

    def test_invalid_string_returns_default(self):
        """无效字符串返回默认值。"""
        assert _safe_int("abc", 8) == 8
        assert _safe_int("10.5", 8) == 8

    def test_empty_string_returns_default(self):
        """空字符串返回默认值。"""
        assert _safe_int("", 8) == 8

    def test_type_error_returns_default(self):
        """TypeError(如传入 list)返回默认值。"""
        assert _safe_int([1, 2], 8) == 8  # type: ignore[arg-type]


# =============================================================================
# 4. 调度器初始化与 env 加载(10 tests)
# =============================================================================


class TestSchedulerInit:
    """调度器初始化:默认配置 / 环境变量覆盖 / 任务注册表。"""

    def test_default_config_disabled(self, scheduler):
        """无环境变量时,所有任务 enabled=False,dry_run=True。"""
        for tdef in TASK_DEFS:
            cfg = scheduler._configs[tdef["id"]]
            assert cfg["enabled"] is False
            assert cfg["dry_run"] is True

    def test_default_hour_minute(self, scheduler):
        """无环境变量时,koubo=(8,0),wechat=(8,30)。"""
        assert scheduler._configs["koubo_daily"]["hour"] == 8
        assert scheduler._configs["koubo_daily"]["minute"] == 0
        assert scheduler._configs["wechat_daily"]["hour"] == 8
        assert scheduler._configs["wechat_daily"]["minute"] == 30

    def test_env_enabled_true(self, monkeypatch):
        """SELF_MEDIA_CRON_ENABLED=true → enabled=True。"""
        monkeypatch.setenv("SELF_MEDIA_CRON_ENABLED", "true")
        s = SelfMediaScheduler()
        assert s._configs["koubo_daily"]["enabled"] is True
        assert s._configs["wechat_daily"]["enabled"] is True

    def test_env_enabled_case_insensitive(self, monkeypatch):
        """SELF_MEDIA_CRON_ENABLED=True(大写)→ enabled=True。"""
        monkeypatch.setenv("SELF_MEDIA_CRON_ENABLED", "True")
        s = SelfMediaScheduler()
        assert s._configs["koubo_daily"]["enabled"] is True

    def test_env_enabled_false(self, monkeypatch):
        """SELF_MEDIA_CRON_ENABLED=false → enabled=False。"""
        monkeypatch.setenv("SELF_MEDIA_CRON_ENABLED", "false")
        s = SelfMediaScheduler()
        assert s._configs["koubo_daily"]["enabled"] is False

    def test_env_enabled_non_true_value(self, monkeypatch):
        """SELF_MEDIA_CRON_ENABLED=1(非 "true")→ enabled=False。"""
        monkeypatch.setenv("SELF_MEDIA_CRON_ENABLED", "1")
        s = SelfMediaScheduler()
        assert s._configs["koubo_daily"]["enabled"] is False

    def test_env_hour_override(self, monkeypatch):
        """SELF_MEDIA_CRON_HOUR=10 → 两任务 hour=10。"""
        monkeypatch.setenv("SELF_MEDIA_CRON_HOUR", "10")
        s = SelfMediaScheduler()
        assert s._configs["koubo_daily"]["hour"] == 10
        assert s._configs["wechat_daily"]["hour"] == 10

    def test_env_minute_offset_wechat(self, monkeypatch):
        """SELF_MEDIA_CRON_MINUTE=15 → koubo=15,wechat=45(15+30)。"""
        monkeypatch.setenv("SELF_MEDIA_CRON_MINUTE", "15")
        s = SelfMediaScheduler()
        assert s._configs["koubo_daily"]["minute"] == 15
        assert s._configs["wechat_daily"]["minute"] == 45

    def test_env_minute_overflow_wechat_fallback_bug(self, monkeypatch):
        """BUG: SELF_MEDIA_CRON_MINUTE=40 时 wechat 回退到默认 30(非 40+30=70 取模)。

        源码逻辑: `default_minute + 30 if default_minute + 30 < 60 else default_minute`。
        40+30=70 >= 60 → 回退到 tdef["default_minute"]=30,而非 wrap 到 10。
        导致 wechat 在 koubo 之前触发(8:30 < 8:40),与"wechat 晚 30 分钟"的设计意图矛盾。
        """
        monkeypatch.setenv("SELF_MEDIA_CRON_MINUTE", "40")
        s = SelfMediaScheduler()
        assert s._configs["koubo_daily"]["minute"] == 40
        # BUG: wechat 回退到默认 30 而非 70%60=10
        assert s._configs["wechat_daily"]["minute"] == 30

    def test_env_wechat_title(self, monkeypatch):
        """SELF_MEDIA_CRON_WECHAT_TITLE 设置后,wechat 配置含 title_template。"""
        monkeypatch.setenv("SELF_MEDIA_CRON_WECHAT_TITLE", "公众号 {date}")
        s = SelfMediaScheduler()
        assert s._configs["wechat_daily"]["title_template"] == "公众号 {date}"
        # koubo 不应有 title_template
        assert "title_template" not in s._configs["koubo_daily"]

    def test_env_invalid_hour_falls_back(self, monkeypatch):
        """SELF_MEDIA_CRON_HOUR=abc → _safe_int 回退到默认 8。"""
        monkeypatch.setenv("SELF_MEDIA_CRON_HOUR", "abc")
        s = SelfMediaScheduler()
        assert s._configs["koubo_daily"]["hour"] == 8


# =============================================================================
# 5. set_task_enabled(3 tests)
# =============================================================================


class TestSetTaskEnabled:
    """set_task_enabled:启用/禁用/未知。"""

    def test_enable_known_task(self, scheduler):
        """启用已知任务返回 True,配置生效。"""
        assert scheduler.set_task_enabled("koubo_daily", True) is True
        assert scheduler._configs["koubo_daily"]["enabled"] is True

    def test_disable_known_task(self, scheduler):
        """禁用已知任务返回 True,配置生效。"""
        scheduler.set_task_enabled("koubo_daily", True)
        assert scheduler.set_task_enabled("koubo_daily", False) is True
        assert scheduler._configs["koubo_daily"]["enabled"] is False

    def test_unknown_task_returns_false(self, scheduler):
        """未知 task_id 返回 False。"""
        assert scheduler.set_task_enabled("unknown_task", True) is False


# =============================================================================
# 6. set_task_config(12 tests)
# =============================================================================


class TestSetTaskConfig:
    """set_task_config:修改 hour/minute/dry_run/title_template/enabled + 边界 + BUG。"""

    def test_set_hour(self, scheduler):
        """设置 hour 生效。"""
        assert scheduler.set_task_config("koubo_daily", hour=10) is True
        assert scheduler._configs["koubo_daily"]["hour"] == 10

    def test_set_minute(self, scheduler):
        """设置 minute 生效。"""
        assert scheduler.set_task_config("koubo_daily", minute=45) is True
        assert scheduler._configs["koubo_daily"]["minute"] == 45

    def test_set_dry_run(self, scheduler):
        """设置 dry_run 生效。"""
        assert scheduler.set_task_config("koubo_daily", dry_run=False) is True
        assert scheduler._configs["koubo_daily"]["dry_run"] is False

    def test_set_title_template(self, scheduler):
        """设置 title_template 生效。"""
        assert scheduler.set_task_config(
            "wechat_daily", title_template="公众号 {date}"
        ) is True
        assert scheduler._configs["wechat_daily"]["title_template"] == "公众号 {date}"

    def test_set_enabled_via_kwargs(self, scheduler):
        """通过 set_task_config 设置 enabled。"""
        assert scheduler.set_task_config("koubo_daily", enabled=True) is True
        assert scheduler._configs["koubo_daily"]["enabled"] is True

    def test_invalid_hour_returns_false(self, scheduler):
        """hour=24 超出 0-23 返回 False,不修改。"""
        original = scheduler._configs["koubo_daily"]["hour"]
        assert scheduler.set_task_config("koubo_daily", hour=24) is False
        assert scheduler._configs["koubo_daily"]["hour"] == original

    def test_invalid_minute_returns_false(self, scheduler):
        """minute=60 超出 0-59 返回 False,不修改。"""
        original = scheduler._configs["koubo_daily"]["minute"]
        assert scheduler.set_task_config("koubo_daily", minute=60) is False
        assert scheduler._configs["koubo_daily"]["minute"] == original

    def test_boundary_hour_valid(self, scheduler):
        """hour=0 和 hour=23 均有效。"""
        assert scheduler.set_task_config("koubo_daily", hour=0) is True
        assert scheduler._configs["koubo_daily"]["hour"] == 0
        assert scheduler.set_task_config("koubo_daily", hour=23) is True
        assert scheduler._configs["koubo_daily"]["hour"] == 23

    def test_boundary_minute_valid(self, scheduler):
        """minute=0 和 minute=59 均有效。"""
        assert scheduler.set_task_config("koubo_daily", minute=0) is True
        assert scheduler._configs["koubo_daily"]["minute"] == 0
        assert scheduler.set_task_config("koubo_daily", minute=59) is True
        assert scheduler._configs["koubo_daily"]["minute"] == 59

    def test_unknown_task_returns_false(self, scheduler):
        """未知 task_id 返回 False。"""
        assert scheduler.set_task_config("unknown", hour=10) is False

    def test_none_values_ignored(self, scheduler):
        """kwargs 中 None 值被忽略,返回 True,不影响已有配置。"""
        original_hour = scheduler._configs["koubo_daily"]["hour"]
        assert scheduler.set_task_config("koubo_daily", hour=None) is True
        assert scheduler._configs["koubo_daily"]["hour"] == original_hour

    def test_bug_hour_string_raises_value_error(self, scheduler):
        """BUG: set_task_config(task, hour="abc") 抛 ValueError 而非返回 False。

        源码 `int(kwargs[k])` 在 kwargs[k]="abc" 时抛 ValueError,
        未被 try/except 包裹,异常直接传播。
        正确行为应返回 False(校验失败),而非崩溃。
        """
        with pytest.raises(ValueError):
            scheduler.set_task_config("koubo_daily", hour="abc")

    def test_bug_partial_application_on_invalid_minute(self, scheduler):
        """BUG: hour 有效但 minute 无效时,hour 已应用但函数返回 False(不回滚)。

        源码 for 循环按顺序处理 (hour, minute, dry_run, title_template),
        hour 先应用再检查 minute。minute 无效返回 False 时,hour 修改不回滚。
        """
        original_hour = scheduler._configs["koubo_daily"]["hour"]
        result = scheduler.set_task_config("koubo_daily", hour=10, minute=60)
        assert result is False  # minute=60 无效
        # BUG: hour=10 已被应用,未回滚到 original_hour
        assert scheduler._configs["koubo_daily"]["hour"] == 10
        assert scheduler._configs["koubo_daily"]["hour"] != original_hour


# =============================================================================
# 7. list_tasks / get_task(5 tests)
# =============================================================================


class TestListTasksGetTask:
    """list_tasks / get_task 查询。"""

    def test_list_tasks_returns_two(self, scheduler):
        """list_tasks 返回 2 个任务。"""
        tasks = scheduler.list_tasks()
        assert len(tasks) == 2

    def test_list_tasks_structure(self, scheduler):
        """每个任务包含完整字段(id/name/config/running/last_run)。"""
        tasks = scheduler.list_tasks()
        for t in tasks:
            assert "id" in t
            assert "name" in t
            assert "description" in t
            assert "category" in t
            assert "default_hour" in t
            assert "default_minute" in t
            assert "config" in t
            assert "hour" in t["config"]
            assert "minute" in t["config"]
            assert "dry_run" in t["config"]
            assert "enabled" in t["config"]
            assert "title_template" in t["config"]
            assert "running" in t
            assert "last_run" in t

    def test_get_task_known(self, scheduler):
        """get_task 已知 task_id 返回详情。"""
        t = scheduler.get_task("koubo_daily")
        assert t is not None
        assert t["id"] == "koubo_daily"
        assert t["name"] == "每日口播稿生成"
        assert t["category"] == "koubo"

    def test_get_task_unknown_returns_none(self, scheduler):
        """get_task 未知 task_id 返回 None。"""
        assert scheduler.get_task("unknown") is None

    def test_list_tasks_reflects_config_change(self, scheduler):
        """set_task_config 修改后,list_tasks 反映变更。"""
        scheduler.set_task_config("koubo_daily", hour=15, minute=30)
        scheduler.set_task_enabled("koubo_daily", True)
        t = scheduler.get_task("koubo_daily")
        assert t["config"]["hour"] == 15
        assert t["config"]["minute"] == 30
        assert t["config"]["enabled"] is True


# =============================================================================
# 8. trigger_task(6 tests)
# =============================================================================


class TestTriggerTask:
    """trigger_task 手动触发。"""

    @pytest.mark.asyncio
    async def test_unknown_task(self, scheduler):
        """未知 task_id → ok=False。"""
        result = await scheduler.trigger_task("unknown")
        assert result["ok"] is False
        assert "not found" in result["error"]

    @pytest.mark.asyncio
    async def test_trigger_success(self, scheduler):
        """成功触发 → ok=True。"""
        scheduler._run_koubo = AsyncMock(return_value={"status": "ok"})
        result = await scheduler.trigger_task("koubo_daily")
        assert result["ok"] is True
        assert "triggered" in result["message"]
        # 等待 spawned task 完成
        await asyncio.gather(*scheduler._pending_tasks, return_exceptions=True)
        await asyncio.sleep(0)
        scheduler._run_koubo.assert_called_once()

    @pytest.mark.asyncio
    async def test_trigger_already_running(self, scheduler):
        """已在运行 → ok=False。"""
        scheduler._running_tasks.add("koubo_daily")
        result = await scheduler.trigger_task("koubo_daily")
        assert result["ok"] is False
        assert "already running" in result["error"]

    @pytest.mark.asyncio
    async def test_trigger_executes_task(self, scheduler):
        """触发后任务实际执行并写入历史。"""
        scheduler._run_koubo = AsyncMock(return_value={"status": "completed"})
        await scheduler.trigger_task("koubo_daily")
        await asyncio.gather(*scheduler._pending_tasks, return_exceptions=True)
        await asyncio.sleep(0)
        assert len(scheduler._history) == 1
        assert scheduler._history[0]["task_id"] == "koubo_daily"
        assert scheduler._history[0]["status"] == "success"

    @pytest.mark.asyncio
    async def test_trigger_does_not_affect_last_run_date(self, scheduler):
        """手动触发不影响 _last_run_date(不影响下次定时触发)。"""
        scheduler._run_koubo = AsyncMock(return_value={"status": "ok"})
        await scheduler.trigger_task("koubo_daily")
        await asyncio.gather(*scheduler._pending_tasks, return_exceptions=True)
        await asyncio.sleep(0)
        # _last_run_date 不应被 trigger_task 修改
        assert "koubo_daily" not in scheduler._last_run_date

    @pytest.mark.asyncio
    async def test_trigger_dry_run_passed(self, scheduler):
        """触发时 dry_run 配置传递给 _run_koubo。"""
        scheduler.set_task_config("koubo_daily", dry_run=False)
        scheduler._run_koubo = AsyncMock(return_value={"status": "ok"})
        await scheduler.trigger_task("koubo_daily")
        await asyncio.gather(*scheduler._pending_tasks, return_exceptions=True)
        await asyncio.sleep(0)
        # _run_koubo 被调用时 dry_run=False
        call_args = scheduler._run_koubo.call_args
        assert call_args.args[0] is False  # dry_run=False


# =============================================================================
# 9. _run_task(8 tests)
# =============================================================================


class TestRunTask:
    """_run_task 实际执行单个任务。"""

    @pytest.mark.asyncio
    async def test_koubo_success(self, scheduler):
        """koubo 成功路径:status=success,extra 填充。"""
        scheduler._run_koubo = AsyncMock(return_value={"status": "completed", "articles": ["a1"]})
        await scheduler._run_task("koubo_daily")
        assert len(scheduler._history) == 1
        entry = scheduler._history[0]
        assert entry["task_id"] == "koubo_daily"
        assert entry["status"] == "success"
        assert entry["extra"]["status"] == "completed"
        assert entry["error"] is None
        assert entry["duration_ms"] >= 0

    @pytest.mark.asyncio
    async def test_koubo_failure(self, scheduler):
        """koubo 失败路径:_run_koubo 抛异常,status=failed。"""
        scheduler._run_koubo = AsyncMock(side_effect=RuntimeError("boom"))
        await scheduler._run_task("koubo_daily")
        assert len(scheduler._history) == 1
        entry = scheduler._history[0]
        assert entry["status"] == "failed"
        assert "RuntimeError" in entry["error"]
        assert "boom" in entry["error"]

    @pytest.mark.asyncio
    async def test_wechat_without_title_template_fails(self, scheduler):
        """wechat 缺 title_template → status=failed。"""
        # 确保 wechat 没有 title_template
        scheduler._configs["wechat_daily"].pop("title_template", None)
        await scheduler._run_task("wechat_daily")
        assert len(scheduler._history) == 1
        entry = scheduler._history[0]
        assert entry["status"] == "failed"
        assert "title_template" in entry["error"]

    @pytest.mark.asyncio
    async def test_wechat_success(self, scheduler):
        """wechat 成功路径(需 mock _run_wechat)。"""
        scheduler._run_wechat = AsyncMock(return_value={"title": "t", "md_path": "/p", "md_length": 10})
        scheduler.set_task_config("wechat_daily", title_template="tpl")
        await scheduler._run_task("wechat_daily")
        assert len(scheduler._history) == 1
        entry = scheduler._history[0]
        assert entry["status"] == "success"
        assert entry["extra"]["title"] == "t"

    @pytest.mark.asyncio
    async def test_unknown_task_fails(self, scheduler):
        """未知 task_id → ValueError 被捕获,status=failed。"""
        await scheduler._run_task("unknown_task")
        assert len(scheduler._history) == 1
        entry = scheduler._history[0]
        assert entry["status"] == "failed"
        assert "ValueError" in entry["error"]
        assert "unknown_task" in entry["error"]

    @pytest.mark.asyncio
    async def test_duration_ms_recorded(self, scheduler):
        """duration_ms 被记录(非负)。"""
        scheduler._run_koubo = AsyncMock(return_value={"status": "ok"})
        await scheduler._run_task("koubo_daily")
        assert scheduler._history[0]["duration_ms"] >= 0

    @pytest.mark.asyncio
    async def test_running_tasks_tracking(self, scheduler):
        """任务执行期间 _running_tasks 包含 task_id,完成后移除。"""
        assert "koubo_daily" not in scheduler._running_tasks
        scheduler._run_koubo = AsyncMock(return_value={"status": "ok"})
        await scheduler._run_task("koubo_daily")
        assert "koubo_daily" not in scheduler._running_tasks

    @pytest.mark.asyncio
    async def test_skip_if_already_running(self, scheduler):
        """已在运行时 _run_task 直接返回,不执行不写历史。"""
        scheduler._running_tasks.add("koubo_daily")
        scheduler._run_koubo = AsyncMock(return_value={"status": "ok"})
        await scheduler._run_task("koubo_daily")
        scheduler._run_koubo.assert_not_called()
        assert len(scheduler._history) == 0


# =============================================================================
# 10. _run_koubo(3 tests)
# =============================================================================


class TestRunKoubo:
    """_run_koubo:实际口播稿生成(需 mock koubo_workflow_service)。"""

    @pytest.mark.asyncio
    async def test_success(self, scheduler):
        """成功返回正确字典(date/status/articles_count/output_path/error)。"""
        mock_service = MagicMock()
        mock_service.run = AsyncMock(return_value={
            "status": "completed",
            "articles": ["a1", "a2"],
            "output_path": "/tmp/out.txt",
            "error": None,
        })
        with patch("app.services.koubo_workflow.koubo_workflow_service", mock_service):
            result = await scheduler._run_koubo(dry_run=True)
        assert result["status"] == "completed"
        assert result["articles_count"] == 2
        assert result["output_path"] == "/tmp/out.txt"
        assert result["error"] is None
        assert len(result["date"]) == 4  # MMDD 格式

    @pytest.mark.asyncio
    async def test_dry_run_passed(self, scheduler):
        """dry_run 参数传递给 koubo_workflow_service.run。"""
        mock_service = MagicMock()
        mock_service.run = AsyncMock(return_value={"status": "ok", "articles": []})
        with patch("app.services.koubo_workflow.koubo_workflow_service", mock_service):
            await scheduler._run_koubo(dry_run=False)
        call_kwargs = mock_service.run.call_args.kwargs
        assert call_kwargs["dry_run"] is False

    @pytest.mark.asyncio
    async def test_exception_propagates(self, scheduler):
        """koubo_workflow_service.run 抛异常 → 向上传播(由 _run_task 捕获)。"""
        mock_service = MagicMock()
        mock_service.run = AsyncMock(side_effect=RuntimeError("workflow down"))
        with patch("app.services.koubo_workflow.koubo_workflow_service", mock_service):
            with pytest.raises(RuntimeError, match="workflow down"):
                await scheduler._run_koubo(dry_run=True)


# =============================================================================
# 11. _run_wechat(4 tests)
# =============================================================================


class TestRunWechat:
    """_run_wechat:公众号文章生成(需 mock _generate_md_with_llm)。"""

    @pytest.mark.asyncio
    async def test_success(self, scheduler):
        """成功路径:LLM 生成 md,写入文件,返回正确字典。"""
        mock_gen = AsyncMock(return_value=(True, "# 公众号文章\n\n正文", None))
        mock_safe = MagicMock(return_value="safe_title")
        with patch("app.routers.self_media._generate_md_with_llm", mock_gen), \
             patch("app.routers.self_media._safe_filename", mock_safe), \
             patch.object(Path, "mkdir"), \
             patch.object(Path, "write_text"):
            result = await scheduler._run_wechat("公众号 {date}", dry_run=True)
        assert result["dry_run"] is True
        assert "公众号" in result["title"]
        assert result["md_length"] > 0
        assert "safe_title" in result["md_path"]

    @pytest.mark.asyncio
    async def test_llm_failure_raises(self, scheduler):
        """LLM 返回 ok=False → 抛 RuntimeError。"""
        mock_gen = AsyncMock(return_value=(False, "", "LLM 调用失败"))
        with patch("app.routers.self_media._generate_md_with_llm", mock_gen):
            with pytest.raises(RuntimeError, match="LLM 生成失败"):
                await scheduler._run_wechat("tpl", dry_run=True)

    @pytest.mark.asyncio
    async def test_empty_content_raises(self, scheduler):
        """LLM 返回空 content → 抛 RuntimeError。"""
        mock_gen = AsyncMock(return_value=(True, "", None))
        with patch("app.routers.self_media._generate_md_with_llm", mock_gen):
            with pytest.raises(RuntimeError, match="LLM 生成失败"):
                await scheduler._run_wechat("tpl", dry_run=True)

    @pytest.mark.asyncio
    async def test_date_placeholder_replaced(self, scheduler):
        """title_template 中 {date} 被替换为当前 MMDD。"""
        captured_title = []

        async def fake_gen(title, digest, topic, model, owner_uuid):
            captured_title.append(title)
            return (True, "# content", None)

        with patch("app.routers.self_media._generate_md_with_llm", side_effect=fake_gen), \
             patch("app.routers.self_media._safe_filename", return_value="safe"), \
             patch.object(Path, "mkdir"), \
             patch.object(Path, "write_text"):
            await scheduler._run_wechat("标题 {date}", dry_run=True)
        # title 应包含 4 位 MMDD 日期
        assert len(captured_title) == 1
        assert "{date}" not in captured_title[0]
        # 提取 MMDD(标题最后 4 字符)
        date_part = captured_title[0][-4:]
        assert date_part.isdigit()


# =============================================================================
# 12. 历史记录 LRU(9 tests)
# =============================================================================


class TestHistory:
    """_append_history / list_history:LRU + 过滤 + limit。"""

    def test_empty_history(self, scheduler):
        """空历史返回空列表。"""
        assert scheduler.list_history() == []

    def test_append_one(self, scheduler):
        """追加一条后 list_history 返回。"""
        scheduler._append_history(make_history_entry(task_id="koubo_daily"))
        history = scheduler.list_history()
        assert len(history) == 1
        assert history[0]["task_id"] == "koubo_daily"

    def test_lru_over_limit_drops_oldest(self, scheduler):
        """超过 _HISTORY_LIMIT(30)丢弃最旧。"""
        for i in range(_HISTORY_LIMIT + 5):
            scheduler._append_history(
                make_history_entry(task_id="koubo_daily", duration_ms=i)
            )
        assert len(scheduler._history) == _HISTORY_LIMIT
        # 最旧的应该是第 5 条(duration_ms=5),因为前 5 条被丢弃
        # list_history 倒序返回,最后一条是最旧的
        history = scheduler.list_history()
        assert len(history) == _HISTORY_LIMIT
        # 最新在前:第一条应是最后追加的(duration_ms=34)
        assert history[0]["duration_ms"] == _HISTORY_LIMIT + 4
        # 最旧在最后:应是 duration_ms=5
        assert history[-1]["duration_ms"] == 5

    def test_order_newest_first(self, scheduler):
        """list_history 返回最新在前。"""
        scheduler._append_history(make_history_entry(task_id="t1", duration_ms=1))
        scheduler._append_history(make_history_entry(task_id="t2", duration_ms=2))
        scheduler._append_history(make_history_entry(task_id="t3", duration_ms=3))
        history = scheduler.list_history()
        assert history[0]["duration_ms"] == 3
        assert history[1]["duration_ms"] == 2
        assert history[2]["duration_ms"] == 1

    def test_filter_by_task_id(self, scheduler):
        """list_history 按 task_id 过滤。"""
        scheduler._append_history(make_history_entry(task_id="koubo_daily"))
        scheduler._append_history(make_history_entry(task_id="wechat_daily"))
        scheduler._append_history(make_history_entry(task_id="koubo_daily"))
        history = scheduler.list_history(task_id="koubo_daily")
        assert len(history) == 2
        assert all(h["task_id"] == "koubo_daily" for h in history)

    def test_limit_truncates(self, scheduler):
        """limit 截断返回条数。"""
        for i in range(10):
            scheduler._append_history(make_history_entry(duration_ms=i))
        history = scheduler.list_history(limit=3)
        assert len(history) == 3

    def test_limit_over_30_clamped(self, scheduler):
        """limit > 30 被截断到 _HISTORY_LIMIT(30)。"""
        for i in range(35):
            scheduler._append_history(make_history_entry(duration_ms=i))
        # LRU 只保留 30 条
        history = scheduler.list_history(limit=100)
        assert len(history) == _HISTORY_LIMIT

    def test_limit_zero_returns_one(self, scheduler):
        """limit=0 被 max(1, ...) 截断为 1(返回 1 条)。"""
        scheduler._append_history(make_history_entry(duration_ms=1))
        scheduler._append_history(make_history_entry(duration_ms=2))
        history = scheduler.list_history(limit=0)
        assert len(history) == 1
        # 最新在前,返回的是最后追加的
        assert history[0]["duration_ms"] == 2

    def test_limit_negative_returns_one(self, scheduler):
        """limit=-5 被 max(1, min(-5, 30))=1 截断为 1。"""
        scheduler._append_history(make_history_entry(duration_ms=1))
        scheduler._append_history(make_history_entry(duration_ms=2))
        history = scheduler.list_history(limit=-5)
        assert len(history) == 1


# =============================================================================
# 13. start / stop(5 tests)
# =============================================================================


class TestStartStop:
    """start / stop:启动 / 幂等 / 停止 / 未启动停止 / 清理。"""

    @pytest.mark.asyncio
    async def test_start_creates_task(self, scheduler):
        """start 创建 _loop task。"""
        scheduler.start()
        assert scheduler._task is not None
        assert not scheduler._task.done()
        await scheduler.stop()

    @pytest.mark.asyncio
    async def test_start_idempotent(self, scheduler):
        """重复 start 不创建新 task。"""
        scheduler.start()
        first_task = scheduler._task
        scheduler.start()
        assert scheduler._task is first_task
        await scheduler.stop()

    @pytest.mark.asyncio
    async def test_stop_cancels_task(self, scheduler):
        """stop 取消 _task。"""
        scheduler.start()
        task = scheduler._task
        await scheduler.stop()
        assert task.done()
        assert scheduler._task is None

    @pytest.mark.asyncio
    async def test_stop_without_start_noop(self, scheduler):
        """未 start 时 stop 无操作。"""
        await scheduler.stop()
        assert scheduler._task is None

    @pytest.mark.asyncio
    async def test_stop_clears_task_reference(self, scheduler):
        """stop 后 _task 设为 None。"""
        scheduler.start()
        assert scheduler._task is not None
        await scheduler.stop()
        assert scheduler._task is None


# =============================================================================
# 14. _loop(6 tests)
# =============================================================================


class TestLoop:
    """_loop:定时轮询 / 匹配 / 同日不重复 / 跨日重置 / 异常不崩。"""

    @pytest.mark.asyncio
    async def test_matching_triggers_task(self, scheduler, frozen_dt):
        """匹配 hour:minute 时触发任务。"""
        scheduler._configs["koubo_daily"]["enabled"] = True
        scheduler._configs["koubo_daily"]["hour"] = 8
        scheduler._configs["koubo_daily"]["minute"] = 0
        scheduler._run_koubo = AsyncMock(return_value={"status": "ok"})

        with patch("app.services.self_media_scheduler.datetime", _FrozenDateTime):
            await _run_loop_one_iteration(scheduler)

        scheduler._run_koubo.assert_called_once()
        # _last_run_date 应记录今天
        assert scheduler._last_run_date.get("koubo_daily") == "2026-07-23"

    @pytest.mark.asyncio
    async def test_same_day_no_retrigger(self, scheduler, frozen_dt):
        """同日已触发不重复触发。"""
        scheduler._configs["koubo_daily"]["enabled"] = True
        scheduler._configs["koubo_daily"]["hour"] = 8
        scheduler._configs["koubo_daily"]["minute"] = 0
        scheduler._last_run_date["koubo_daily"] = "2026-07-23"  # 已触发
        scheduler._run_koubo = AsyncMock(return_value={"status": "ok"})

        with patch("app.services.self_media_scheduler.datetime", _FrozenDateTime):
            await _run_loop_one_iteration(scheduler)

        scheduler._run_koubo.assert_not_called()

    @pytest.mark.asyncio
    async def test_mismatch_no_trigger(self, scheduler, frozen_dt):
        """hour:minute 不匹配时不触发。"""
        scheduler._configs["koubo_daily"]["enabled"] = True
        scheduler._configs["koubo_daily"]["hour"] = 23
        scheduler._configs["koubo_daily"]["minute"] = 59
        scheduler._run_koubo = AsyncMock(return_value={"status": "ok"})

        with patch("app.services.self_media_scheduler.datetime", _FrozenDateTime):
            await _run_loop_one_iteration(scheduler)

        scheduler._run_koubo.assert_not_called()
        assert "koubo_daily" not in scheduler._last_run_date

    @pytest.mark.asyncio
    async def test_disabled_no_trigger(self, scheduler, frozen_dt):
        """enabled=False 时不触发。"""
        scheduler._configs["koubo_daily"]["enabled"] = False
        scheduler._configs["koubo_daily"]["hour"] = 8
        scheduler._configs["koubo_daily"]["minute"] = 0
        scheduler._run_koubo = AsyncMock(return_value={"status": "ok"})

        with patch("app.services.self_media_scheduler.datetime", _FrozenDateTime):
            await _run_loop_one_iteration(scheduler)

        scheduler._run_koubo.assert_not_called()

    @pytest.mark.asyncio
    async def test_cross_day_reset_triggers(self, scheduler):
        """跨日重置:_last_run_date 为昨天时,今天重新触发。"""
        # 冻结到次日 8:00
        _FrozenDateTime.freeze(datetime(2026, 7, 24, 8, 0, tzinfo=_CN_TZ))
        try:
            scheduler._configs["koubo_daily"]["enabled"] = True
            scheduler._configs["koubo_daily"]["hour"] = 8
            scheduler._configs["koubo_daily"]["minute"] = 0
            scheduler._last_run_date["koubo_daily"] = "2026-07-23"  # 昨天
            scheduler._run_koubo = AsyncMock(return_value={"status": "ok"})

            with patch("app.services.self_media_scheduler.datetime", _FrozenDateTime):
                await _run_loop_one_iteration(scheduler)

            scheduler._run_koubo.assert_called_once()
            assert scheduler._last_run_date["koubo_daily"] == "2026-07-24"
        finally:
            _FrozenDateTime.unfreeze()

    @pytest.mark.asyncio
    async def test_loop_exception_does_not_crash(self, scheduler, frozen_dt):
        """_loop 内部异常被捕获,循环不崩溃。"""
        # 让 _configs.get 抛异常触发 loop body exception
        scheduler._configs = MagicMock()
        scheduler._configs.get.side_effect = RuntimeError("boom")
        scheduler._configs.values.return_value = []

        with patch("app.services.self_media_scheduler.datetime", _FrozenDateTime):
            await _run_loop_one_iteration(scheduler)

        # 如果 loop 崩溃,_run_loop_one_iteration 的 CancelledError 不会被 raise
        # 能到达这里说明 loop 正常运行了一轮后被 CancelledError 中断


# =============================================================================
# 15. _run_task_safe(2 tests)
# =============================================================================


class TestRunTaskSafe:
    """_run_task_safe:安全执行(异常只记录不抛)。"""

    @pytest.mark.asyncio
    async def test_normal_execution(self, scheduler):
        """正常执行无异常。"""
        scheduler._run_task = AsyncMock()
        await scheduler._run_task_safe("koubo_daily")
        scheduler._run_task.assert_called_once_with("koubo_daily")

    @pytest.mark.asyncio
    async def test_exception_swallowed(self, scheduler):
        """_run_task 抛异常时,_run_task_safe 不向上抛。"""
        scheduler._run_task = AsyncMock(side_effect=RuntimeError("boom"))
        # 不应抛异常
        await scheduler._run_task_safe("koubo_daily")
        scheduler._run_task.assert_called_once()


# =============================================================================
# 16. _spawn_task(2 tests)
# =============================================================================


class TestSpawnTask:
    """_spawn_task:创建 task + 持有引用 + 完成后移除。"""

    @pytest.mark.asyncio
    async def test_holds_reference(self, scheduler):
        """创建的 task 被加入 _pending_tasks。"""
        executed = False

        async def dummy():
            nonlocal executed
            executed = True

        task = scheduler._spawn_task(dummy())
        assert task in scheduler._pending_tasks
        await task
        assert executed

    @pytest.mark.asyncio
    async def test_removed_after_done(self, scheduler):
        """task 完成后从 _pending_tasks 移除。"""

        async def dummy():
            pass

        task = scheduler._spawn_task(dummy())
        assert task in scheduler._pending_tasks
        await task
        await asyncio.sleep(0)  # 处理 done callback
        assert task not in scheduler._pending_tasks


# =============================================================================
# 17. 单例(3 tests)
# =============================================================================


class TestSingleton:
    """模块级单例 self_media_scheduler。"""

    def test_singleton_exists(self):
        """单例存在。"""
        assert self_media_scheduler is not None

    def test_singleton_is_instance(self):
        """单例是 SelfMediaScheduler 实例。"""
        assert isinstance(self_media_scheduler, SelfMediaScheduler)

    def test_singleton_has_configs(self):
        """单例有 _configs 字典且包含 2 个任务。"""
        assert hasattr(self_media_scheduler, "_configs")
        assert isinstance(self_media_scheduler._configs, dict)
        assert "koubo_daily" in self_media_scheduler._configs
        assert "wechat_daily" in self_media_scheduler._configs
