# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""scheduler_service 综合测试(自研任务调度)。

覆盖维度:
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

import contextlib
import json
from datetime import UTC, datetime, timedelta
from typing import Any
from unittest.mock import AsyncMock, MagicMock

import fakeredis.aioredis
import pytest
from apscheduler.triggers.cron import CronTrigger
from apscheduler.triggers.date import DateTrigger
from apscheduler.triggers.interval import IntervalTrigger

from app.services import scheduler_service as ss
from app.services.scheduler_service import (
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

    monkeypatch.setattr(settings, "redis_url", "redis://127.0.0.1:6399")
    s = TaskScheduler()
    s._redis = fakeredis.aioredis.FakeRedis(decode_responses=True)
    s._scheduler = MagicMock()
    s._use_memory = False
    s._started = True
    yield s
    with contextlib.suppress(Exception):
        await s._redis.aclose()


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
            "t-cron", "cron", {"minute": 5}, _shell_cb(), is_admin=True, conversation_id="conv1"
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
        run_at = (datetime.now(UTC) + timedelta(days=1)).isoformat()
        res = await sched.add_task("t-date", "date", {"run_date": run_at}, _shell_cb(), is_admin=True)
        assert res["ok"] is True
        trigger_arg = sched._scheduler.add_job.call_args.kwargs["trigger"]
        assert isinstance(trigger_arg, DateTrigger)

    @pytest.mark.asyncio
    async def test_interval_success(self, sched):
        """interval trigger 成功:IntervalTrigger 构造。"""
        res = await sched.add_task(
            "t-int", "interval", {"seconds": 60}, _shell_cb(), is_admin=True
        )
        assert res["ok"] is True
        trigger_arg = sched._scheduler.add_job.call_args.kwargs["trigger"]
        assert isinstance(trigger_arg, IntervalTrigger)

    @pytest.mark.asyncio
    async def test_invalid_trigger_type(self, sched):
        """无效 trigger_type 返回 INVALID_TRIGGER,不持久化。"""
        res = await sched.add_task("t-bad", "weekly", {"minute": 5}, _shell_cb(), is_admin=True)
        assert res["ok"] is False
        assert res["errorCode"] == "INVALID_TRIGGER"
        sched._scheduler.add_job.assert_not_called()

    @pytest.mark.asyncio
    async def test_cron_missing_fields(self, sched):
        """cron 缺少任意原生字段返回 INVALID_TRIGGER。"""
        res = await sched.add_task("t-empty", "cron", {}, _shell_cb(), is_admin=True)
        assert res["ok"] is False
        assert res["errorCode"] == "INVALID_TRIGGER"
        assert "cron" in res["message"]

    @pytest.mark.asyncio
    async def test_date_missing_run_date(self, sched):
        """date 缺 run_date 返回 INVALID_TRIGGER。"""
        res = await sched.add_task("t-nodate", "date", {}, _shell_cb(), is_admin=True)
        assert res["ok"] is False
        assert res["errorCode"] == "INVALID_TRIGGER"
        assert "run_date" in res["message"]


    @pytest.mark.asyncio
    async def test_shell_requires_admin(self, sched):
        """BUG-1 根治:shell 回调非管理员被拒(INVALID_CALLBACK),杜绝任意登录用户 RCE。"""
        res = await sched.add_task("t-shell", "interval", {"seconds": 30}, _shell_cb())
        assert res["ok"] is False
        assert res["errorCode"] == "INVALID_CALLBACK"
        sched._scheduler.add_job.assert_not_called()
        # 管理员通道可创建
        ok = await sched.add_task(
            "t-shell-ok", "interval", {"seconds": 30}, _shell_cb(), is_admin=True
        )
        assert ok["ok"] is True


# =============================================================================
# 3. remove_task(2 tests)
# =============================================================================


class TestRemoveTask:
    @pytest.mark.asyncio
    async def test_remove_existing(self, sched):
        """删除已存在任务:Redis key 清除,返回 ok=True。"""
        await sched.add_task("rm-1", "interval", {"seconds": 30}, _shell_cb(), is_admin=True)
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
        await sched.add_task("l-1", "interval", {"seconds": 30}, _shell_cb(), is_admin=True, conversation_id="c1")
        await sched.add_task("l-2", "interval", {"minutes": 1}, _shell_cb(), is_admin=True, conversation_id="c2")
        res = await sched.list_tasks()
        assert res["ok"] is True
        assert res["count"] == 2
        ids = {t["task_id"] for t in res["tasks"]}
        assert ids == {"l-1", "l-2"}

    @pytest.mark.asyncio
    async def test_list_filter_by_conversation(self, sched):
        """按 conversation_id 过滤。"""
        await sched.add_task("f-1", "interval", {"seconds": 30}, _shell_cb(), is_admin=True, conversation_id="convA")
        await sched.add_task("f-2", "interval", {"minutes": 1}, _shell_cb(), is_admin=True, conversation_id="convB")
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
            "g-1", "cron", {"minute": 0, "hour": 9}, _shell_cb("echo g1"), is_admin=True
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
        await sched.add_task("u-1", "interval", {"seconds": 30}, _shell_cb(), is_admin=True)
        new_cb = {"type": "shell", "command": "echo updated"}
        res = await sched.update_task("u-1", callback=new_cb, enabled=False, is_admin=True)
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
        await sched.add_task("u-2", "cron", {"minute": 5}, _shell_cb(), is_admin=True)
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
        """http_webhook:POST 必须打到**判定过并钉住**的目标上。

        原断言写的是 `post("http://example.com/hook", json=...)` —— 那是 2026-10-31 R12
        之前的形态。现在生产侧先过 `_validate_url_ssrf`,再把域名解析结果钉进 URL 并按
        Host/SNI 保原域名(防 DNS rebinding:判定用一个 IP、建连用另一个)。测试若继续
        断言裸域名,等于把加固判成回归;而它当时还**真的在做 DNS 解析**(本机解析到的 IP
        直接进断言),既违反 §5 测试隔离,也让结论随网络漂。现改成把解析桩成定值。
        """

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

        import app.services.screenshot_service as shot

        with pytest.MonkeyPatch.context() as mp:
            mp.setattr(ss.httpx, "AsyncClient", _FakeClient)
            mp.setattr(
                shot,
                "resolve_pinned_target",
                lambda _url: ("http://93.184.216.34/hook", "example.com"),
            )
            await sched._execute_callback(
                {"type": "http_webhook", "url": "http://example.com/hook", "payload": {"a": 1}}
            )

        _FakeClient.post.assert_awaited_once()
        args, kwargs = _FakeClient.post.await_args
        assert args[0] == "http://93.184.216.34/hook", "必须走钉住的 IP,不是再解析一次的域名"
        assert args[0] != "http://example.com/hook", "反向牙口:裸域名回来=加固被绕过"
        assert kwargs["json"] == {"a": 1}
        assert kwargs["headers"] == {"Host": "example.com"}, "钉 IP 不能丢掉原域名(虚拟主机分流)"
        assert kwargs["extensions"] == {"sni_hostname": "example.com"}

    async def test_http_webhook_internal_target_never_reaches_the_socket(self, sched):
        """成对正向对照:守卫拒掉时**一次请求都不许发出**(不是"发了再报错")。"""
        post = AsyncMock()

        class _NeverClient:
            def __init__(self, *a, **kw):
                pass

            async def __aenter__(self):
                self.post = post
                return self

            async def __aexit__(self, *a):
                return False

        with pytest.MonkeyPatch.context() as mp:
            mp.setattr(ss.httpx, "AsyncClient", _NeverClient)
            with pytest.raises(ValueError):
                await sched._execute_callback(
                    {"type": "http_webhook", "url": "http://169.254.169.254/latest/meta-data", "payload": {}}
                )
        assert post.await_count == 0, "云元数据地址不得产生任何出连"

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

        monkeypatch.setattr(settings, "redis_url", "redis://127.0.0.1:6399")
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
                "mem-1", "interval", {"seconds": 60}, _shell_cb(), is_admin=True
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


# =============================================================================
# 11. 未带时区的本地时刻 = Asia/Shanghai(DBG-13)
# =============================================================================


class TestShanghaiLocalTime:
    def test_naive_cron_is_9am_shanghai_not_5pm_beijing(self):
        """用户填 9 点且不带时区:下一拍是上海 09:00,不是 UTC 09:00(北京 17:00)。"""
        trig = _build_trigger("cron", {"hour": 9, "minute": 0})
        assert trig.timezone == ss._CN_TZ
        before = datetime(2026, 11, 10, 8, 30, tzinfo=ss._CN_TZ)
        nxt = trig.get_next_fire_time(None, before)
        assert nxt is not None
        local = nxt.astimezone(ss._CN_TZ)
        assert (local.hour, local.minute, local.date()) == (9, 0, before.date())

    def test_naive_date_is_shanghai(self):
        """date 的朴素 ISO 时刻按东八区钉住,不是主机本地时区。"""
        trig = _build_trigger("date", {"run_date": "2026-11-10T09:00:00"})
        assert trig.run_date.hour == 9
        assert trig.run_date.minute == 0
        assert trig.run_date.utcoffset() == timedelta(hours=8)

    def test_aware_date_keeps_the_instant(self):
        """已经带偏移的时刻保持那一个瞬间,不被再解释成上海 9 点。"""
        trig = _build_trigger("date", {"run_date": "2026-11-10T09:00:00+00:00"})
        assert trig.run_date.astimezone(UTC).hour == 9
        assert trig.run_date.utcoffset() == timedelta(0)

    def test_explicit_utc_cron_stays_utc(self):
        """调用方写了 timezone=UTC 时尊重它:上海看到的是 17 点。"""
        trig = _build_trigger("cron", {"hour": 9, "minute": 0, "timezone": "UTC"})
        before = datetime(2026, 11, 10, 8, 30, tzinfo=UTC)
        nxt = trig.get_next_fire_time(None, before)
        assert nxt is not None
        assert nxt.astimezone(UTC).hour == 9
        assert nxt.astimezone(ss._CN_TZ).hour == 17

    def test_invalid_timezone_is_value_error(self):
        with pytest.raises(ValueError, match="timezone"):
            _build_trigger("cron", {"hour": 9, "timezone": "Not/AZone"})

    @pytest.mark.asyncio
    async def test_add_task_rejects_invalid_timezone(self, sched):
        res = await sched.add_task(
            "tz-bad",
            "cron",
            {"hour": 9, "timezone": "Not/AZone"},
            _shell_cb(),
            is_admin=True,
        )
        assert res["ok"] is False
        assert res["errorCode"] == "INVALID_TRIGGER"
        sched._scheduler.add_job.assert_not_called()

    @pytest.mark.asyncio
    async def test_scheduler_uses_shanghai(self, monkeypatch):
        """AsyncIOScheduler 的 timezone 与签到侧同为 Asia/Shanghai。"""
        from app.core.config import settings

        monkeypatch.setattr(settings, "redis_url", "")
        captured: dict[str, Any] = {}

        class _Cap:
            def __init__(self, *args: Any, **kwargs: Any) -> None:
                captured["timezone"] = kwargs.get("timezone")

            def start(self) -> None:
                return None

            def shutdown(self, wait: bool = True) -> None:
                return None

        monkeypatch.setattr(ss, "AsyncIOScheduler", _Cap)
        s = TaskScheduler()
        await s.start()
        try:
            assert captured["timezone"] == ss._CN_TZ
            assert s._started is True
        finally:
            await s.shutdown()


# =============================================================================
# 12. 调度器建不起来时不得假装已排程(DBG-17)
# =============================================================================


async def _redis_task_keys(fake: Any) -> list[Any]:
    keys: list[Any] = []
    async for key in fake.scan_iter(match=ss._REDIS_KEY_PREFIX + "*"):
        keys.append(key)
    return keys


class TestSchedulerBuildFailure:
    @pytest.mark.asyncio
    async def test_constructor_failure_is_visible_and_does_not_persist(self, monkeypatch):
        """start() 建调度器失败必须把异常交给调用方;之后 add/update 不写 Redis、不回 ok。"""
        from app.core.config import settings

        fake = fakeredis.aioredis.FakeRedis(decode_responses=True)
        monkeypatch.setattr(settings, "redis_url", "redis://127.0.0.1:6399")
        monkeypatch.setattr(ss.aioredis, "from_url", lambda *a, **kw: fake)

        class _Boom:
            def __init__(self, *args: Any, **kwargs: Any) -> None:
                raise RuntimeError("scheduler boom")

        monkeypatch.setattr(ss, "AsyncIOScheduler", _Boom)
        s = TaskScheduler()
        with pytest.raises(RuntimeError, match="scheduler boom"):
            await s.start()
        assert s._is_stub() is False
        assert s._started is False
        assert s._scheduler is None

        added = await s.add_task(
            "t-down",
            "cron",
            {"hour": 9, "minute": 0},
            {"type": "http_webhook", "url": "http://example.com/hook"},
        )
        assert added["ok"] is False
        assert added["errorCode"] == "SCHEDULER_UNAVAILABLE"
        assert added.get("stub") is not True
        assert await _redis_task_keys(fake) == []

        await fake.hset(
            ss._REDIS_KEY_PREFIX + "keep",
            mapping={
                "task_id": "keep",
                "trigger_type": "cron",
                "trigger_config": json.dumps({"hour": 9, "minute": 0}),
                "callback": json.dumps(
                    {"type": "http_webhook", "url": "http://example.com/hook"}
                ),
                "conversation_id": "",
                "enabled": "true",
                "created_at": "",
                "next_run_at": "",
            },
        )
        updated = await s.update_task("keep", trigger_config={"hour": 18, "minute": 0})
        assert updated["ok"] is False
        assert updated["errorCode"] == "SCHEDULER_UNAVAILABLE"
        raw = await fake.hgetall(ss._REDIS_KEY_PREFIX + "keep")
        assert json.loads(raw["trigger_config"]) == {"hour": 9, "minute": 0}

        disabled = await s.update_task("keep", enabled=False)
        assert disabled["ok"] is True
        raw = await fake.hgetall(ss._REDIS_KEY_PREFIX + "keep")
        assert raw["enabled"] == "false"
        await fake.aclose()

    @pytest.mark.asyncio
    async def test_start_method_failure_same_contract(self, monkeypatch):
        """构造成功但 start() 抛错:同样上抛,并且不把任务写成已排程。"""
        from app.core.config import settings

        fake = fakeredis.aioredis.FakeRedis(decode_responses=True)
        monkeypatch.setattr(settings, "redis_url", "redis://127.0.0.1:6399")
        monkeypatch.setattr(ss.aioredis, "from_url", lambda *a, **kw: fake)

        class _BadStart:
            def __init__(self, *args: Any, **kwargs: Any) -> None:
                return None

            def start(self) -> None:
                raise RuntimeError("start boom")

            def shutdown(self, wait: bool = True) -> None:
                return None

        monkeypatch.setattr(ss, "AsyncIOScheduler", _BadStart)
        s = TaskScheduler()
        with pytest.raises(RuntimeError, match="start boom"):
            await s.start()
        assert s._is_stub() is False
        assert s._scheduler is None
        added = await s.add_task(
            "t-start",
            "interval",
            {"seconds": 30},
            {"type": "http_webhook", "url": "http://example.com/hook"},
        )
        assert added == {
            "ok": False,
            "errorCode": "SCHEDULER_UNAVAILABLE",
            "message": "调度器未启动,任务不会被触发",
        }
        assert await _redis_task_keys(fake) == []
        await fake.aclose()


# =============================================================================
# 13. 同一触发点多进程只跑一次(DBG-18)
# =============================================================================


class TestSingleFire:
    def test_cron_slot_matches_across_clock_skew(self):
        """整点两侧差 2 秒仍是上海 09:00 这一拍,不是 UTC 09:00。"""
        cfg = {"hour": 9, "minute": 0}
        early = datetime(2026, 11, 10, 8, 59, 58, tzinfo=ss._CN_TZ)
        late = datetime(2026, 11, 10, 9, 0, 2, tzinfo=ss._CN_TZ)
        expect = ss._slot_token(datetime(2026, 11, 10, 9, 0, tzinfo=ss._CN_TZ))
        utc_nine = ss._slot_token(datetime(2026, 11, 10, 9, 0, tzinfo=UTC))
        assert ss._fire_slot("cron", cfg, early) == expect
        assert ss._fire_slot("cron", cfg, late) == expect
        assert expect != utc_nine

    def test_interval_slot_is_shared_phase(self):
        cfg = {"seconds": 60}
        boundary = datetime(2026, 11, 10, 9, 0, 0, tzinfo=ss._CN_TZ)
        early = boundary - timedelta(seconds=2)
        late = boundary + timedelta(seconds=2)
        nxt = boundary + timedelta(seconds=70)
        assert ss._fire_slot("interval", cfg, early) == ss._fire_slot("interval", cfg, late)
        assert ss._fire_slot("interval", cfg, late) != ss._fire_slot("interval", cfg, nxt)

    def test_naive_date_slot_is_shanghai_instant(self):
        slot = ss._fire_slot(
            "date",
            {"run_date": "2026-11-10T09:00:00"},
            datetime(2026, 11, 10, 12, 0, tzinfo=ss._CN_TZ),
        )
        expect = ss._slot_token(datetime(2026, 11, 10, 9, 0, tzinfo=ss._CN_TZ))
        assert slot == expect

    @pytest.mark.asyncio
    async def test_two_processes_execute_once(self, monkeypatch):
        """两个调度器共享 Redis,同一任务同一触发点只执行一次;另一个任务不受影响。"""
        frozen = datetime(2026, 11, 10, 9, 0, 3, tzinfo=ss._CN_TZ)

        def _frozen_now(tz: Any = None) -> datetime:
            if tz is None:
                return frozen.astimezone(UTC)
            return frozen.astimezone(tz)

        monkeypatch.setattr(ss, "_now", _frozen_now)
        redis = fakeredis.aioredis.FakeRedis(decode_responses=True)
        calls: list[str] = []

        async def _exec(callback: dict[str, Any]) -> None:
            calls.append(str(callback.get("tag")))

        async def _run(task_id: str, tag: str) -> None:
            s = TaskScheduler()
            s._redis = redis
            s._started = True
            s._execute_callback = _exec  # type: ignore[method-assign]
            await s._job_wrapper(
                task_id,
                {"type": "mcp_tool", "tool_name": "x", "tag": tag},
                "cron",
                {"hour": 9, "minute": 0},
            )

        await _run("same", "a")
        await _run("same", "b")
        await _run("other", "c")
        assert calls == ["a", "c"]

        lone = TaskScheduler()
        lone._redis = None
        lone._execute_callback = _exec  # type: ignore[method-assign]
        await lone._job_wrapper(
            "same",
            {"type": "mcp_tool", "tool_name": "x", "tag": "mem"},
            "cron",
            {"hour": 9, "minute": 0},
        )
        assert calls == ["a", "c", "mem"]
        await redis.aclose()

    @pytest.mark.asyncio
    async def test_lock_outage_does_not_drop_the_run(self):
        """抢锁的 Redis 调用失败时这一拍仍然执行(锁层抖动不把任务静默丢掉)。"""
        calls: list[str] = []

        class _BoomRedis:
            async def set(self, *args: Any, **kwargs: Any) -> bool:
                raise ConnectionError("redis down")

        async def _exec(callback: dict[str, Any]) -> None:
            calls.append("ran")

        s = TaskScheduler()
        s._redis = _BoomRedis()  # type: ignore[assignment]
        s._execute_callback = _exec  # type: ignore[method-assign]
        await s._job_wrapper(
            "t",
            {"type": "mcp_tool", "tool_name": "x"},
            "interval",
            {"seconds": 60},
        )
        assert calls == ["ran"]
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
