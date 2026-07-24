"""scheduler_service 综合测试(对标 Trae Work Builder + Codex Automations)。

覆盖维度(21 tests):
1. 单例 + 工具函数(_build_trigger / _now_iso)
2. add_task 3 种 trigger_type 成功 + 无效 trigger_type / 缺失必填字段失败
3. remove_task 成功 / 任务不存在(幂等)
4. list_tasks 默认 / 按 conversation_id 过滤
5. get_task 存在 / 不存在
6. update_task 成功 / 不存在 / 无效 trigger_config
7. _execute_callback 3 种回调类型(http_webhook httpx mock / mcp_tool monkeypatch / shell echo)
8. _execute_callback 失败记录到 Redis log
9. stub 模式(redis_url 未配置)
10. Redis 不可用降级到内存

测试用 fakeredis(FakeRedis)替代真实 Redis,_scheduler 用 MagicMock 隔离 APScheduler。
"""
from __future__ import annotations

import json
from datetime import datetime, timezone, timedelta
from typing import Any
from unittest.mock import AsyncMock, MagicMock

import fakeredis.aioredis
import pytest
from apscheduler.triggers.cron import CronTrigger
from apscheduler.triggers.date import DateTrigger
from apscheduler.triggers.interval import IntervalTrigger

from app.services import scheduler_service as ss
from app.services.scheduler_service import (
    _LOG_KEEP,
    _REDIS_LOG_PREFIX,
    TaskScheduler,
    _build_trigger,
    task_scheduler,
)


# =============================================================================
# fixtures
# =============================================================================


@pytest.fixture
async def sched(monkeypatch):
    """每个测试一个全新的 TaskScheduler,fakeredis + MagicMock scheduler。

    强制 settings.redis_url 非空(非 stub),_redis 注入 fakeredis,
    _scheduler 注入 MagicMock(隔离 APScheduler 真实启动)。
    """
    from app.core.config import settings

    monkeypatch.setattr(settings, "redis_url", "redis://localhost:8811")
    s = TaskScheduler()
    s._redis = fakeredis.aioredis.FakeRedis(decode_responses=True)
    s._scheduler = MagicMock()
    s._use_memory = False
    s._started = True
    yield s
    try:
        await s._redis.aclose()
    except Exception:
        pass


def _shell_cb(command: str = "echo hi") -> dict[str, Any]:
    return {"type": "shell", "command": command}


# =============================================================================
# 1. 单例 + 工具函数(3 tests)
# =============================================================================


class TestSingletonAndHelpers:
    def test_module_singleton(self):
        """模块级 task_scheduler 是 TaskScheduler 实例。"""
        assert isinstance(task_scheduler, TaskScheduler)

    def test_build_trigger_cron(self):
        """_build_trigger 构造 CronTrigger。"""
        trig = _build_trigger("cron", {"minute": 5, "hour": 9})
        assert isinstance(trig, CronTrigger)

    def test_build_trigger_invalid_type_raises(self):
        """_build_trigger 无效 trigger_type 抛 ValueError。"""
        with pytest.raises(ValueError, match="无效 trigger_type"):
            _build_trigger("unknown", {})


# =============================================================================
# 2. add_task(6 tests)
# =============================================================================


class TestAddTask:
    @pytest.mark.asyncio
    async def test_cron_success(self, sched):
        """cron trigger 成功:返回 ok=True,持久化到 Redis,add_job 被调用。"""
        res = await sched.add_task(
            "t-cron", "cron", {"minute": 5}, _shell_cb(), conversation_id="conv1"
        )
        assert res["ok"] is True
        assert res["task_id"] == "t-cron"
        sched._scheduler.add_job.assert_called_once()
        trigger_arg = sched._scheduler.add_job.call_args.kwargs["trigger"]
        assert isinstance(trigger_arg, CronTrigger)
        # 持久化校验
        got = await sched.get_task("t-cron")
        assert got["ok"] is True
        assert got["task"]["trigger_type"] == "cron"
        assert got["task"]["conversation_id"] == "conv1"
        assert got["task"]["enabled"] is True

    @pytest.mark.asyncio
    async def test_date_success(self, sched):
        """date trigger 成功:DateTrigger 构造,next_run_at 记录。"""
        run_at = (datetime.now(timezone.utc) + timedelta(days=1)).isoformat()
        res = await sched.add_task("t-date", "date", {"run_date": run_at}, _shell_cb())
        assert res["ok"] is True
        trigger_arg = sched._scheduler.add_job.call_args.kwargs["trigger"]
        assert isinstance(trigger_arg, DateTrigger)

    @pytest.mark.asyncio
    async def test_interval_success(self, sched):
        """interval trigger 成功:IntervalTrigger 构造。"""
        res = await sched.add_task(
            "t-int", "interval", {"seconds": 60}, _shell_cb()
        )
        assert res["ok"] is True
        trigger_arg = sched._scheduler.add_job.call_args.kwargs["trigger"]
        assert isinstance(trigger_arg, IntervalTrigger)

    @pytest.mark.asyncio
    async def test_invalid_trigger_type(self, sched):
        """无效 trigger_type 返回 INVALID_TRIGGER,不持久化。"""
        res = await sched.add_task("t-bad", "weekly", {"minute": 5}, _shell_cb())
        assert res["ok"] is False
        assert res["errorCode"] == "INVALID_TRIGGER"
        sched._scheduler.add_job.assert_not_called()

    @pytest.mark.asyncio
    async def test_cron_missing_fields(self, sched):
        """cron 缺少任意原生字段返回 INVALID_TRIGGER。"""
        res = await sched.add_task("t-empty", "cron", {}, _shell_cb())
        assert res["ok"] is False
        assert res["errorCode"] == "INVALID_TRIGGER"
        assert "cron" in res["message"]

    @pytest.mark.asyncio
    async def test_date_missing_run_date(self, sched):
        """date 缺 run_date 返回 INVALID_TRIGGER。"""
        res = await sched.add_task("t-nodate", "date", {}, _shell_cb())
        assert res["ok"] is False
        assert res["errorCode"] == "INVALID_TRIGGER"
        assert "run_date" in res["message"]


# =============================================================================
# 3. remove_task(2 tests)
# =============================================================================


class TestRemoveTask:
    @pytest.mark.asyncio
    async def test_remove_existing(self, sched):
        """删除已存在任务:Redis key 清除,返回 ok=True。"""
        await sched.add_task("rm-1", "interval", {"seconds": 30}, _shell_cb())
        res = await sched.remove_task("rm-1")
        assert res["ok"] is True
        got = await sched.get_task("rm-1")
        assert got["ok"] is False  # 已删除

    @pytest.mark.asyncio
    async def test_remove_nonexistent_idempotent(self, sched):
        """删除不存在任务幂等(不抛异常),返回 ok=True。"""
        res = await sched.remove_task("never-exists")
        assert res["ok"] is True


# =============================================================================
# 4. list_tasks(2 tests)
# =============================================================================


class TestListTasks:
    @pytest.mark.asyncio
    async def test_list_default(self, sched):
        """默认列出全部任务。"""
        await sched.add_task("l-1", "interval", {"seconds": 30}, _shell_cb(), conversation_id="c1")
        await sched.add_task("l-2", "interval", {"minutes": 1}, _shell_cb(), conversation_id="c2")
        res = await sched.list_tasks()
        assert res["ok"] is True
        assert res["count"] == 2
        ids = {t["task_id"] for t in res["tasks"]}
        assert ids == {"l-1", "l-2"}

    @pytest.mark.asyncio
    async def test_list_filter_by_conversation(self, sched):
        """按 conversation_id 过滤。"""
        await sched.add_task("f-1", "interval", {"seconds": 30}, _shell_cb(), conversation_id="convA")
        await sched.add_task("f-2", "interval", {"minutes": 1}, _shell_cb(), conversation_id="convB")
        res = await sched.list_tasks(conversation_id="convA")
        assert res["count"] == 1
        assert res["tasks"][0]["task_id"] == "f-1"


# =============================================================================
# 5. get_task(2 tests)
# =============================================================================


class TestGetTask:
    @pytest.mark.asyncio
    async def test_get_existing(self, sched):
        """获取已存在任务详情。"""
        await sched.add_task(
            "g-1", "cron", {"minute": 0, "hour": 9}, _shell_cb("echo g1")
        )
        res = await sched.get_task("g-1")
        assert res["ok"] is True
        assert res["task"]["task_id"] == "g-1"
        assert res["task"]["callback"]["command"] == "echo g1"

    @pytest.mark.asyncio
    async def test_get_not_found(self, sched):
        """获取不存在任务返回 NOT_FOUND。"""
        res = await sched.get_task("missing")
        assert res["ok"] is False
        assert res["errorCode"] == "NOT_FOUND"


# =============================================================================
# 6. update_task(3 tests)
# =============================================================================


class TestUpdateTask:
    @pytest.mark.asyncio
    async def test_update_success(self, sched):
        """更新 callback + enabled 成功,Redis 反映变更。"""
        await sched.add_task("u-1", "interval", {"seconds": 30}, _shell_cb())
        new_cb = {"type": "shell", "command": "echo updated"}
        res = await sched.update_task("u-1", callback=new_cb, enabled=False)
        assert res["ok"] is True
        got = await sched.get_task("u-1")
        assert got["task"]["callback"]["command"] == "echo updated"
        assert got["task"]["enabled"] is False

    @pytest.mark.asyncio
    async def test_update_not_found(self, sched):
        """更新不存在任务返回 NOT_FOUND。"""
        res = await sched.update_task("nope", enabled=False)
        assert res["ok"] is False
        assert res["errorCode"] == "NOT_FOUND"

    @pytest.mark.asyncio
    async def test_update_invalid_trigger_config(self, sched):
        """update 传入无效 trigger_config 返回 INVALID_TRIGGER,不改原任务。"""
        await sched.add_task("u-2", "cron", {"minute": 5}, _shell_cb())
        res = await sched.update_task("u-2", trigger_config={})  # cron 缺字段
        assert res["ok"] is False
        assert res["errorCode"] == "INVALID_TRIGGER"
        # 原任务未变
        got = await sched.get_task("u-2")
        assert got["task"]["trigger_config"] == {"minute": 5}


# =============================================================================
# 7. _execute_callback 3 种回调类型(3 tests)
# =============================================================================


class TestExecuteCallback:
    @pytest.mark.asyncio
    async def test_http_webhook(self, sched):
        """http_webhook:mock httpx.AsyncClient,验证 POST url+json。"""

        class _FakeClient:
            def __init__(self, *a, **kw):
                pass

            async def __aenter__(self):
                return self

            async def __aexit__(self, *a):
                return False

        mock_resp = MagicMock()
        mock_resp.raise_for_status = MagicMock()
        _FakeClient.post = AsyncMock(return_value=mock_resp)

        with pytest.MonkeyPatch.context() as mp:
            mp.setattr(ss.httpx, "AsyncClient", _FakeClient)
            await sched._execute_callback(
                {"type": "http_webhook", "url": "http://example.com/hook", "payload": {"a": 1}}
            )
        _FakeClient.post.assert_awaited_once_with(
            "http://example.com/hook", json={"a": 1}
        )

    @pytest.mark.asyncio
    async def test_mcp_tool(self, sched, monkeypatch):
        """mcp_tool:monkeypatch _TOOL_HANDLERS,验证 handler 被调用。"""
        handler = AsyncMock(return_value={"ok": True})
        monkeypatch.setattr(
            "app.services.mcp_server._TOOL_HANDLERS", {"fake_tool": handler}
        )
        await sched._execute_callback(
            {"type": "mcp_tool", "tool_name": "fake_tool", "args": {"x": 1}}
        )
        handler.assert_awaited_once_with({"x": 1})

    @pytest.mark.asyncio
    async def test_shell(self, sched):
        """shell:执行 echo 命令,returncode=0 视为成功(无异常)。"""
        await sched._execute_callback({"type": "shell", "command": "echo shell_ok"})
        # 无异常即成功


# =============================================================================
# 8. _execute_callback 失败记录到 log(1 test)
# =============================================================================


class TestCallbackFailureLog:
    @pytest.mark.asyncio
    async def test_failure_logged_to_redis(self, sched):
        """_job_wrapper 捕获异常并写入 Redis log list(LPUSH+LTRIM)。"""
        # http_webhook 缺 url → ValueError
        await sched._job_wrapper("fail-1", {"type": "http_webhook"})
        logs = await sched._redis.lrange(_REDIS_LOG_PREFIX + "fail-1", 0, -1)
        assert len(logs) == 1
        entry = json.loads(logs[0])
        assert "url" in entry["error"]
        assert "at" in entry


# =============================================================================
# 9. stub 模式(1 test)
# =============================================================================


class TestStubMode:
    @pytest.mark.asyncio
    async def test_stub_mode_all_methods(self, monkeypatch):
        """redis_url 未配置时所有方法返回 stub 响应。"""
        from app.core.config import settings

        monkeypatch.setattr(settings, "redis_url", "")
        s = TaskScheduler()
        res = await s.add_task(
            None, "cron", {"minute": 5}, {"type": "shell", "command": "echo hi"}
        )
        assert res["ok"] is True
        assert res["stub"] is True
        assert res["task_id"].startswith("stub-")
        assert (await s.list_tasks())["stub"] is True
        assert (await s.get_task("x"))["stub"] is True
        assert (await s.remove_task("x"))["stub"] is True
        assert (await s.update_task("x", enabled=False))["stub"] is True


# =============================================================================
# 10. Redis 不可用降级到内存(1 test)
# =============================================================================


class TestRedisUnavailableFallback:
    @pytest.mark.asyncio
    async def test_fallback_to_memory(self, monkeypatch):
        """Redis ping 抛 ConnectionError → 降级内存,add_task/get/list 正常。"""
        from app.core.config import settings

        monkeypatch.setattr(settings, "redis_url", "redis://localhost:8811")
        s = TaskScheduler()
        fake_client = MagicMock()
        fake_client.ping = AsyncMock(side_effect=ConnectionError("no redis"))
        monkeypatch.setattr(ss.aioredis, "from_url", lambda *a, **kw: fake_client)
        monkeypatch.setattr(ss, "AsyncIOScheduler", MagicMock())

        await s.start()
        try:
            assert s._use_memory is True
            assert s._redis is None
            # 内存模式 add_task
            res = await s.add_task(
                "mem-1", "interval", {"seconds": 60}, _shell_cb()
            )
            assert res["ok"] is True
            assert "mem-1" in s._memory_fallback
            # get_task
            got = await s.get_task("mem-1")
            assert got["ok"] is True
            # list_tasks
            listed = await s.list_tasks()
            assert listed["count"] == 1
            # 失败日志走内存
            await s._log_failure("mem-1", "boom")
            assert len(s._memory_logs["mem-1"]) == 1
        finally:
            await s.shutdown()
