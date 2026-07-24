"""schedule_task MCP 工具综合测试(对标 Codex Automations)。

覆盖维度:
1. _build_scheduler_params: once→date / recurring+cron→cron / recurring+interval→interval + webhook/mcp_tool callback
2. _serialize_task_field / _deserialize_task: 字段序列化往返
3. _persist_task_to_redis / _load_task_from_redis / _load_pending_tasks_from_redis: Redis 持久化往返
4. _tool_schedule_task: cron/date/interval 三种 trigger 成功 + webhook 回调 + 参数校验 + 降级容错
"""
from __future__ import annotations

from datetime import datetime, timezone, timedelta
from unittest.mock import AsyncMock, MagicMock

import pytest

from app.services import mcp_server
from app.services.mcp_server import (
    _build_scheduler_params,
    _deserialize_task,
    _load_pending_tasks_from_redis,
    _load_task_from_redis,
    _persist_task_to_redis,
    _serialize_task_field,
    _tool_schedule_task,
)


# =============================================================================
# FakeSyncRedis:dict-backed 同步 Redis 模拟(fakeredis 未安装,用轻量 fake)
# =============================================================================


class FakeSyncRedis:
    """模拟同步 redis.Redis,支持 hset/hgetall/scan_iter/expire/ping。"""

    def __init__(self) -> None:
        self._store: dict[str, dict[str, str]] = {}

    def ping(self) -> bool:
        return True

    def hset(self, key: str, mapping: dict[str, str] | None = None) -> int:
        if mapping:
            self._store.setdefault(key, {}).update(mapping)
            return len(mapping)
        return 0

    def hgetall(self, key: str) -> dict[str, str]:
        return dict(self._store.get(key, {}))

    def scan_iter(self, pattern: str):
        prefix = pattern.rstrip("*")
        return iter(k for k in self._store if k.startswith(prefix))

    def expire(self, key: str, ttl: int) -> bool:
        return key in self._store


# =============================================================================
# fixtures
# =============================================================================


@pytest.fixture(autouse=True)
def _reset_schedule_globals(monkeypatch):
    """每个测试前重置 mcp_server 调度全局状态(Redis 客户端缓存 + 任务列表)。"""
    monkeypatch.setattr(mcp_server, "_SCHEDULE_REDIS", None)
    monkeypatch.setattr(mcp_server, "_SCHEDULE_REDIS_CHECKED", False)
    monkeypatch.setattr(mcp_server, "_SCHEDULED_TASKS", [])
    yield


@pytest.fixture
def fake_redis(monkeypatch):
    """注入 FakeSyncRedis 到 _get_schedule_redis 缓存,返回实例供断言。"""
    fake = FakeSyncRedis()
    monkeypatch.setattr(mcp_server, "_SCHEDULE_REDIS", fake)
    monkeypatch.setattr(mcp_server, "_SCHEDULE_REDIS_CHECKED", True)
    return fake


@pytest.fixture
def no_redis(monkeypatch):
    """模拟 Redis 不可用:_get_schedule_redis 返回 None(降级内存模式)。"""
    monkeypatch.setattr(mcp_server, "_SCHEDULE_REDIS", None)
    monkeypatch.setattr(mcp_server, "_SCHEDULE_REDIS_CHECKED", True)


@pytest.fixture
def mock_task_scheduler(monkeypatch):
    """mock task_scheduler.add_task,返回含 next_run_at 的模拟调度结果。"""
    mock_add = AsyncMock(
        return_value={"ok": True, "task_id": "mock-tid", "next_run_at": "2026-12-31T09:30:00+00:00"}
    )
    from app.services import scheduler_service
    monkeypatch.setattr(scheduler_service, "task_scheduler", MagicMock(add_task=mock_add))
    return mock_add


# =============================================================================
# 1. _build_scheduler_params(5 tests)
# =============================================================================


class TestBuildSchedulerParams:
    def test_once_to_date_trigger(self):
        """schedule=once → date trigger,run_date=run_at,callback=mcp_tool。"""
        task = {"schedule": "once", "run_at": "2026-12-31T00:00:00+00:00",
                "prompt": "p", "task_id": "t1", "webhook_url": ""}
        tt, tc, cb = _build_scheduler_params(task)
        assert tt == "date"
        assert tc == {"run_date": "2026-12-31T00:00:00+00:00"}
        assert cb["type"] == "mcp_tool"
        assert cb["tool_name"] == "dispatch_subagent"
        assert cb["args"]["task"] == "p"

    def test_recurring_cron_to_cron_trigger(self):
        """schedule=recurring + cron → cron trigger,5 字段映射。"""
        task = {"schedule": "recurring", "cron": "5 9 * * *",
                "prompt": "p", "task_id": "t2", "webhook_url": ""}
        tt, tc, cb = _build_scheduler_params(task)
        assert tt == "cron"
        assert tc == {"minute": "5", "hour": "9", "day": "*", "month": "*", "day_of_week": "*"}

    def test_recurring_interval_to_interval_trigger(self):
        """schedule=recurring + interval_seconds → interval trigger。"""
        task = {"schedule": "recurring", "interval_seconds": 120,
                "prompt": "p", "task_id": "t3", "webhook_url": ""}
        tt, tc, _ = _build_scheduler_params(task)
        assert tt == "interval"
        assert tc == {"seconds": 120}

    def test_webhook_url_produces_http_webhook_callback(self):
        """webhook_url 存在 → callback type=http_webhook,url+payload 正确。"""
        task = {"schedule": "once", "run_at": "2026-12-31T00:00:00+00:00",
                "prompt": "do work", "task_id": "t4", "webhook_url": "http://example.com/hook"}
        _, _, cb = _build_scheduler_params(task)
        assert cb["type"] == "http_webhook"
        assert cb["url"] == "http://example.com/hook"
        assert cb["payload"]["prompt"] == "do work"
        assert cb["payload"]["task_id"] == "t4"

    def test_cron_invalid_fields_raises(self):
        """cron 非 5 字段 → ValueError。"""
        task = {"schedule": "recurring", "cron": "5 9 *",
                "prompt": "p", "task_id": "t5", "webhook_url": ""}
        with pytest.raises(ValueError, match="5 字段"):
            _build_scheduler_params(task)


# =============================================================================
# 2. _serialize_task_field / _deserialize_task(2 tests)
# =============================================================================


class TestSerializeDeserialize:
    def test_serialize_list_and_scalar(self):
        """agent_tools(list)→JSON,字符串原样,interval_seconds→JSON 数字。"""
        assert _serialize_task_field("agent_tools", ["a", "b"]) == '["a", "b"]'
        assert _serialize_task_field("interval_seconds", 60) == "60"
        assert _serialize_task_field("name", "hello") == "hello"
        assert _serialize_task_field("status", "") == ""

    def test_deserialize_round_trip(self):
        """序列化 → 反序列化往返:agent_tools 还原 list,interval_seconds 还原 int。"""
        raw = {
            "task_id": "rt-1", "name": "test", "prompt": "do x",
            "schedule": "recurring", "run_at": "", "cron": "0 9 * * *",
            "interval_seconds": "3600",
            "agent_tools": '["search_codebase", "read_file"]',
            "next_run_at": "2026-12-31T09:00:00+00:00", "status": "scheduled",
            "created_at": "2026-07-24T00:00:00+00:00", "webhook_url": "",
        }
        task = _deserialize_task(dict(raw))
        assert task["agent_tools"] == ["search_codebase", "read_file"]
        assert task["interval_seconds"] == 3600
        assert task["name"] == "test"


# =============================================================================
# 3. Redis 持久化往返(3 tests)
# =============================================================================


class TestRedisPersistence:
    def test_persist_and_load_round_trip(self, fake_redis):
        """_persist_task_to_redis → _load_task_from_redis 往返:字段完整还原。"""
        task = {
            "task_id": "p-1", "name": "持久化测试", "prompt": "run analysis",
            "schedule": "recurring", "run_at": "", "cron": "30 8 * * *",
            "interval_seconds": None, "agent_tools": ["search_codebase", "web_search"],
            "next_run_at": "2026-12-31T08:30:00+00:00", "status": "scheduled",
            "created_at": "2026-07-24T00:00:00+00:00", "webhook_url": "",
        }
        assert _persist_task_to_redis(task) is True
        loaded = _load_task_from_redis("p-1")
        assert loaded is not None
        assert loaded["name"] == "持久化测试"
        assert loaded["agent_tools"] == ["search_codebase", "web_search"]
        assert loaded["cron"] == "30 8 * * *"

    def test_load_pending_scans_all(self, fake_redis):
        """_load_pending_tasks_from_redis 扫描所有 mcp:schedule:* key。"""
        for i in range(3):
            _persist_task_to_redis({
                "task_id": f"scan-{i}", "name": f"task{i}", "prompt": "p",
                "schedule": "once", "run_at": "2026-12-31T00:00:00+00:00",
                "cron": "", "interval_seconds": None, "agent_tools": [],
                "next_run_at": "", "status": "scheduled",
                "created_at": "2026-07-24T00:00:00+00:00", "webhook_url": "",
            })
        tasks = _load_pending_tasks_from_redis()
        assert len(tasks) == 3
        assert {t["task_id"] for t in tasks} == {"scan-0", "scan-1", "scan-2"}

    def test_persist_no_redis_returns_false(self, no_redis):
        """Redis 不可用时 _persist_task_to_redis 返回 False,load 返回 None/[]。"""
        ok = _persist_task_to_redis({
            "task_id": "no-redis", "name": "x", "prompt": "p",
            "schedule": "once", "run_at": "2026-12-31T00:00:00+00:00",
            "cron": "", "interval_seconds": None, "agent_tools": [],
            "next_run_at": "", "status": "scheduled",
            "created_at": "2026-07-24T00:00:00+00:00", "webhook_url": "",
        })
        assert ok is False
        assert _load_task_from_redis("no-redis") is None
        assert _load_pending_tasks_from_redis() == []


# =============================================================================
# 4. _tool_schedule_task 成功路径(3 tests: cron/date/interval)
# =============================================================================


class TestScheduleTaskSuccess:
    @pytest.mark.asyncio
    async def test_once_date_trigger(self, fake_redis, mock_task_scheduler):
        """schedule=once + run_at → 成功,date trigger 注册到 task_scheduler。"""
        run_at = (datetime.now(timezone.utc) + timedelta(hours=2)).isoformat()
        result = await _tool_schedule_task({
            "name": "一次性任务", "prompt": "生成报告",
            "schedule": "once", "run_at": run_at,
        })
        assert result["ok"] is True
        assert result["schedule"] == "once"
        assert result["status"] == "scheduled"
        mock_task_scheduler.assert_awaited_once()
        assert mock_task_scheduler.call_args.args[1] == "date"  # trigger_type
        # 持久化到 Redis
        assert _load_task_from_redis(result["task_id"]) is not None

    @pytest.mark.asyncio
    async def test_recurring_cron_trigger(self, fake_redis, mock_task_scheduler):
        """schedule=recurring + cron → 成功,task_scheduler 收到 cron trigger。"""
        result = await _tool_schedule_task({
            "name": "每日报告", "prompt": "生成日报",
            "schedule": "recurring", "cron": "30 9 * * *",
        })
        assert result["ok"] is True
        assert mock_task_scheduler.call_args.args[1] == "cron"
        tc = mock_task_scheduler.call_args.args[2]
        assert tc["minute"] == "30"
        assert tc["hour"] == "9"

    @pytest.mark.asyncio
    async def test_recurring_interval_trigger(self, fake_redis, mock_task_scheduler):
        """schedule=recurring + interval_seconds → 成功,task_scheduler 收到 interval。"""
        result = await _tool_schedule_task({
            "name": "心跳检测", "prompt": "check health",
            "schedule": "recurring", "interval_seconds": 300,
        })
        assert result["ok"] is True
        assert mock_task_scheduler.call_args.args[1] == "interval"
        assert mock_task_scheduler.call_args.args[2] == {"seconds": 300}


# =============================================================================
# 5. webhook 回调 + 参数校验 + 降级容错(8 tests)
# =============================================================================


class TestScheduleTaskWebhookAndValidation:
    @pytest.mark.asyncio
    async def test_webhook_url_produces_http_callback(self, fake_redis, mock_task_scheduler):
        """webhook_url 存在 → callback type=http_webhook 传给 task_scheduler。"""
        run_at = (datetime.now(timezone.utc) + timedelta(hours=1)).isoformat()
        await _tool_schedule_task({
            "name": "webhook 任务", "prompt": "notify",
            "schedule": "once", "run_at": run_at,
            "webhook_url": "http://example.com/hook",
        })
        callback = mock_task_scheduler.call_args.args[3]
        assert callback["type"] == "http_webhook"
        assert callback["url"] == "http://example.com/hook"

    @pytest.mark.asyncio
    async def test_missing_name(self, fake_redis, mock_task_scheduler):
        result = await _tool_schedule_task({"prompt": "p", "schedule": "once", "run_at": "2026-12-31T00:00:00+00:00"})
        assert result["ok"] is False
        assert result["errorCode"] == "MISSING_PARAMS"
        mock_task_scheduler.assert_not_awaited()

    @pytest.mark.asyncio
    async def test_missing_prompt(self, fake_redis, mock_task_scheduler):
        result = await _tool_schedule_task({"name": "n", "schedule": "once", "run_at": "2026-12-31T00:00:00+00:00"})
        assert result["ok"] is False
        assert result["errorCode"] == "MISSING_PARAMS"

    @pytest.mark.asyncio
    async def test_invalid_schedule(self, fake_redis, mock_task_scheduler):
        result = await _tool_schedule_task({"name": "n", "prompt": "p", "schedule": "weekly"})
        assert result["ok"] is False
        assert result["errorCode"] == "INVALID_PARAMS"

    @pytest.mark.asyncio
    async def test_once_missing_run_at(self, fake_redis, mock_task_scheduler):
        result = await _tool_schedule_task({"name": "n", "prompt": "p", "schedule": "once"})
        assert result["ok"] is False
        assert result["errorCode"] == "MISSING_PARAMS"

    @pytest.mark.asyncio
    async def test_recurring_missing_cron_and_interval(self, fake_redis, mock_task_scheduler):
        result = await _tool_schedule_task({"name": "n", "prompt": "p", "schedule": "recurring"})
        assert result["ok"] is False
        assert result["errorCode"] == "MISSING_PARAMS"

    @pytest.mark.asyncio
    async def test_no_redis_still_succeeds(self, no_redis, mock_task_scheduler):
        """Redis 不可用时 _tool_schedule_task 仍成功(降级内存,不崩溃)。"""
        run_at = (datetime.now(timezone.utc) + timedelta(hours=1)).isoformat()
        result = await _tool_schedule_task({
            "name": "内存模式", "prompt": "p",
            "schedule": "once", "run_at": run_at,
        })
        assert result["ok"] is True
        assert result["status"] == "scheduled"

    @pytest.mark.asyncio
    async def test_scheduler_add_task_failure_does_not_crash(self, fake_redis, monkeypatch):
        """task_scheduler.add_task 抛异常时 _tool_schedule_task 不崩溃(仅 warning,仍返回 ok)。"""
        from app.services import scheduler_service
        failing = AsyncMock(side_effect=RuntimeError("scheduler down"))
        monkeypatch.setattr(scheduler_service, "task_scheduler", MagicMock(add_task=failing))
        run_at = (datetime.now(timezone.utc) + timedelta(hours=1)).isoformat()
        result = await _tool_schedule_task({
            "name": "容错任务", "prompt": "p",
            "schedule": "once", "run_at": run_at,
        })
        assert result["ok"] is True  # 仅持久化,调度器失败降级
