# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

"""跨 AI 实例取消位：Redis 写 key + 执行侧 watcher 真取消本地任务。"""

from __future__ import annotations

import asyncio
import json

import fakeredis.aioredis
import pytest

from app.services import agent_run_cancel_bus as bus
from app.services.agent_task_registry import (
    register_run_control,
    register_task,
    run_task_key,
    unregister_run_control,
    unregister_task,
)


@pytest.fixture()
def fake_redis(monkeypatch: pytest.MonkeyPatch) -> fakeredis.aioredis.FakeRedis:
    client = fakeredis.aioredis.FakeRedis(decode_responses=True)
    monkeypatch.setattr(bus, "_client", client)
    return client


@pytest.mark.asyncio
async def test_request_remote_cancel_writes_payload_and_ttl(
    fake_redis: fakeredis.aioredis.FakeRedis,
) -> None:
    ok = await bus.request_remote_cancel(
        "run-1", session_id="session-1", action="run_stop", ttl_seconds=120
    )

    assert ok is True
    raw = await fake_redis.get(bus.cancel_key("run-1"))
    assert raw is not None
    payload = json.loads(raw)
    assert payload == {"runId": "run-1", "sessionId": "session-1", "action": "run_stop"}
    ttl = await fake_redis.ttl(bus.cancel_key("run-1"))
    assert 0 < ttl <= 120


@pytest.mark.asyncio
async def test_watcher_cancels_registered_task_and_removes_key(
    fake_redis: fakeredis.aioredis.FakeRedis,
) -> None:
    started = asyncio.Event()

    async def sleeper() -> None:
        started.set()
        await asyncio.Event().wait()

    task = asyncio.create_task(sleeper())
    await started.wait()
    register_task(run_task_key("run-2"), task)
    watcher = asyncio.create_task(bus.watch_remote_cancel("run-2", "session-2", interval=0.01))
    try:
        await fake_redis.set(bus.cancel_key("run-2"), "{}")
        await asyncio.wait_for(watcher, timeout=1.5)
        assert task.cancelled()
        assert await fake_redis.get(bus.cancel_key("run-2")) is None
    finally:
        await bus.stop_remote_cancel_watch(watcher)
        if not task.done():
            task.cancel()
            with pytest.raises(asyncio.CancelledError):
                await task
        unregister_task(run_task_key("run-2"), task)


@pytest.mark.asyncio
async def test_watcher_run_stop_requests_control_without_cancelling_task(
    fake_redis: fakeredis.aioredis.FakeRedis,
) -> None:
    started = asyncio.Event()

    async def sleeper() -> None:
        started.set()
        await asyncio.Event().wait()

    class Control:
        def __init__(self) -> None:
            self.stop_requested = False

        def request_stop(self) -> None:
            self.stop_requested = True

    control = Control()
    register_run_control("run-stop", control)
    task = asyncio.create_task(sleeper())
    await started.wait()
    register_task(run_task_key("run-stop"), task)
    watcher = asyncio.create_task(
        bus.watch_remote_cancel("run-stop", "session-stop", interval=0.01)
    )
    try:
        await fake_redis.set(
            bus.cancel_key("run-stop"),
            json.dumps({"runId": "run-stop", "action": "run_stop"}),
        )
        await asyncio.wait_for(watcher, timeout=1.5)
        assert control.stop_requested is True
        assert not task.cancelled()
        assert await fake_redis.get(bus.cancel_key("run-stop")) is None
    finally:
        await bus.stop_remote_cancel_watch(watcher)
        if not task.done():
            task.cancel()
            with pytest.raises(asyncio.CancelledError):
                await task
        unregister_run_control("run-stop", control)
        unregister_task(run_task_key("run-stop"), task)
