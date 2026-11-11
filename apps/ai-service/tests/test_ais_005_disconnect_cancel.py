# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

"""AIS-005 回归:Agent 流断线必须取消后台 run,终态在短窗口内仍可重放。

票面病灶(``docs/tickets/2026-11/findings-ai-service.md`` 的 AIS-005):
``run_task = asyncio.create_task(loop.run(...))`` 之后,SSE 断线只关生成器,后台 run
继续改文件/耗额度;收尾又立刻 ``sse_buffer.clear(task_id)``,于是重连带旧
Last-Event-ID 只能判 ``UNKNOWN_TASK``,客户端拿不到 done/usage/error 终态,再起一轮
即同会话双跑;``register_run`` 对同 session 无在途判定且是覆盖写。

本文件四条断言(全部零 DB / 零 Redis / 零网络):

1. 断线(消费者取消 = aclose 生成器)⇒ 后台 ``loop.run`` 收到取消并退出;
2. 正常结束的终态帧在收尾后**仍可重放**(不立即 ``UNKNOWN_TASK``);
3. 同 session 第二个 ``register_run`` 被拒/复用,**不覆盖**原登记;
4. 正常完成路径行为不变:仍 detach 控制面记录、仍释放属主登记。

外加一条接线锁:同会话在途时,第二条流收到 ``SESSION_BUSY`` 错误帧且不启动第二轮。
"""

from __future__ import annotations

import asyncio
import contextlib
import json
from types import SimpleNamespace
from typing import Any

import pytest

from app.core.sse_buffer import REPLAY_HIT, SSEEventBuffer
from app.services import agent_run_control as run_control
from app.services.run_ownership import clear_all as clear_ownership
from app.services.run_ownership import owner_of

SESSION = "sess-ais005"
USER = "user-ais005"


# ---------------------------------------------------------------------------
# 替身
# ---------------------------------------------------------------------------


class _FakeHookEngine:
    """hook_engine 最小替身:订阅返回空队列,不退订真实总线。"""

    def subscribe(self, event: str) -> asyncio.Queue[Any]:
        return asyncio.Queue()

    def unsubscribe(self, event: str, queue: asyncio.Queue[Any]) -> None:
        return None


class _StuckLoop:
    """永不返回的 run:取消时置事件,用于断言"断线真的把后台 run 收敛了"。"""

    def __init__(self) -> None:
        self.started = asyncio.Event()
        self.cancelled = asyncio.Event()

    async def run(self, messages: list[dict[str, Any]]) -> Any:
        self.started.set()
        try:
            await asyncio.sleep(3600)
        except asyncio.CancelledError:
            self.cancelled.set()
            raise


class _OkLoop:
    """一次即完成的 run:产出 done 终态帧,验证正常完成路径零变化。"""

    def __init__(self) -> None:
        self.runs = 0

    async def run(self, messages: list[dict[str, Any]]) -> Any:
        self.runs += 1
        return SimpleNamespace(
            success=True,
            stop_reason="completed",
            final_response="ok",
            iterations=[],
            checkpoint_id=None,
            budget=None,
            error=None,
        )


class _ExplodingLoop:
    """被调用即失败:证明被拒的那条流根本没起第二轮。"""

    async def run(self, messages: list[dict[str, Any]]) -> Any:
        raise AssertionError("同会话在途冲突时不得再起一轮 run(AIS-005 双跑)")


class _PausableStub:
    """满足 PausableLoop 契约:记录 pause 次数并回报各自的 checkpoint id。"""

    def __init__(self, checkpoint_id: str) -> None:
        self.checkpoint_id = checkpoint_id
        self.pause_calls = 0

    async def pause(self) -> str:
        self.pause_calls += 1
        return self.checkpoint_id


def _fake_request() -> Any:
    return SimpleNamespace(headers={}, state=SimpleNamespace(role_id=0))


def _install_stream_env(monkeypatch: pytest.MonkeyPatch, loop_obj: Any) -> SSEEventBuffer:
    """把流式端点收成一枚可控 loop + 独立缓冲区(不碰全局单例与真实总线)。"""
    from app.routers import agents as agents_router

    buf = SSEEventBuffer()
    monkeypatch.setenv("AGENT_EXECUTOR", "loop_v2")
    monkeypatch.setattr(agents_router, "sse_buffer", buf)
    monkeypatch.setattr(agents_router, "AGENT_SUBSCRIBE_EVENTS", ())
    monkeypatch.setattr(agents_router, "_resolved_permission_mode", lambda value: value)
    monkeypatch.setattr(
        agents_router, "_resolved_axis_resolution", lambda *args, **kwargs: None
    )
    monkeypatch.setattr("app.services.hook_engine.hook_engine", _FakeHookEngine())

    async def _factory(**kwargs: Any) -> Any:
        return loop_obj

    monkeypatch.setattr(agents_router, "_new_v2_loop", _factory)
    return buf


def _parse_frame(raw: str) -> tuple[str, dict[str, Any]]:
    eid = ""
    data = ""
    for line in raw.splitlines():
        if line.startswith("id: "):
            eid = line[4:].strip()
        elif line.startswith("data: "):
            data = line[6:]
    assert eid and data, f"SSE 帧缺 id/data: {raw!r}"
    return eid, json.loads(data)


async def _open_stream(session_id: str, user: str) -> Any:
    from app.routers.agents import AgentExecuteRequest, execute_agent_stream

    return await execute_agent_stream(
        AgentExecuteRequest(goal="AIS-005 回归", session_id=session_id),
        _fake_request(),
        current_user=user,
    )


@pytest.fixture(autouse=True)
def _clean_state() -> Any:
    """控制面/属主登记表在用例前后清空(纯内存,无外部依赖)。"""
    run_control.clear_all()
    clear_ownership()
    yield
    run_control.clear_all()
    clear_ownership()


# ---------------------------------------------------------------------------
# 1. 断线 ⇒ 后台 run_task 被取消
# ---------------------------------------------------------------------------


async def test_disconnect_cancels_background_run_task(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """客户端断线(流消费者取消)⇒ ``loop.run`` 收到 CancelledError 并退出。

    旧实现 finally 只做 clear/detach/release,run_task 继续在后台改文件、耗额度。
    """
    loop = _StuckLoop()
    buf = _install_stream_env(monkeypatch, loop)

    resp = await _open_stream(SESSION, USER)
    iterator = resp.body_iterator
    _, start_event = _parse_frame(await iterator.__anext__())
    task_id = start_event["task_id"]

    async def _drain() -> None:
        async for _ in iterator:
            pass

    consumer = asyncio.create_task(_drain())
    await asyncio.wait_for(loop.started.wait(), timeout=5)
    consumer.cancel()  # 客户端断开:框架取消流式任务
    with contextlib.suppress(asyncio.CancelledError):
        await consumer
    await asyncio.wait_for(loop.cancelled.wait(), timeout=5)

    assert loop.cancelled.is_set(), "断线后后台 run 未被取消 ⇒ AIS-005 未修"
    # 收尾不立刻 clear:断线后的短窗口内仍应能重放已下发的事件
    assert buf.get_all(task_id), "收尾把缓冲清了 ⇒ 重连只能判 UNKNOWN_TASK"


# ---------------------------------------------------------------------------
# 2. 终态在短窗口内仍可重放(不立即 UNKNOWN_TASK)
# ---------------------------------------------------------------------------


async def test_terminal_frame_stays_replayable_after_stream_ends(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """正常跑完后带旧 Last-Event-ID 重连:必须命中并能拿到 done 终态帧。"""
    buf = _install_stream_env(monkeypatch, _OkLoop())

    resp = await _open_stream(SESSION, USER)
    frames = [_parse_frame(item) async for item in resp.body_iterator]
    assert frames, "流一帧都没产出 ⇒ 用例没走到被测路径"

    anchor_id, start_event = frames[0]
    assert start_event["type"] == "start"
    task_id = start_event["task_id"]
    assert any(event["type"] == "done" for _, event in frames)

    outcome = buf.replay_outcome(task_id, anchor_id)
    assert outcome.status == REPLAY_HIT, (
        f"收尾后立即判 {outcome.status} ⇒ 断线重连窗口被 clear 关死(AIS-005)"
    )
    assert outcome.events, "锚点之后应能重放 done 及其他终态帧"
    assert outcome.events[-1]["event"]["type"] == "done", "重放必须能拿到终态"


# ---------------------------------------------------------------------------
# 3. 同 session 第二个 register_run 被拒/复用,不覆盖
# ---------------------------------------------------------------------------


async def test_second_register_run_does_not_overwrite_in_flight_run() -> None:
    """在途冲突:同属主 ⇒ REUSED,异属主 ⇒ CONFLICT;登记面仍是第一个 loop。"""
    session_id = f"{SESSION}-conflict"
    first = _PausableStub("ck-first")
    second = _PausableStub("ck-second")

    assert (
        await run_control.register_run(session_id, owner_user_id=USER, loop=first)
        is run_control.RunRegistration.REGISTERED
    )
    assert (
        await run_control.register_run(session_id, owner_user_id=USER, loop=second)
        is run_control.RunRegistration.REUSED
    )
    assert (
        await run_control.register_run(session_id, owner_user_id="other", loop=second)
        is run_control.RunRegistration.CONFLICT
    )

    # 覆盖写会让第二条 loop 顶掉第一条;登记面必须仍指向第一个 run
    assert run_control.entry_count() == 1
    snap = await run_control.snapshot_records(session_id)
    assert snap["has_loop"] is True and snap["owner_user_id"] == USER
    verdict = await run_control.pause_session(session_id, USER)
    assert verdict.outcome is run_control.PauseOutcome.PAUSED
    assert verdict.checkpoint_id == "ck-first", "登记面被第二个 loop 顶掉了"
    assert (first.pause_calls, second.pause_calls) == (1, 0)

    # 终态(paused + detach)之后允许新一轮登记
    await run_control.detach_run(session_id, owner_user_id=USER)
    assert (
        await run_control.register_run(session_id, owner_user_id=USER, loop=_PausableStub("ck-3"))
        is run_control.RunRegistration.REGISTERED
    )


async def test_stream_refuses_second_run_for_same_session(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """接线锁:同会话在途时,第二条流收到 SESSION_BUSY 且不启动第二轮。"""
    session_id = f"{SESSION}-busy"
    _install_stream_env(monkeypatch, _ExplodingLoop())
    in_flight = _PausableStub("ck-busy")
    await run_control.register_run(session_id, owner_user_id=USER, loop=in_flight)

    resp = await _open_stream(session_id, USER)
    frames = [_parse_frame(item) async for item in resp.body_iterator]

    assert any(
        event.get("errorCode") == "SESSION_BUSY" for _, event in frames
    ), f"同会话第二条流未被拒: {[e.get('type') for _, e in frames]}"
    snap = await run_control.snapshot_records(session_id)
    assert snap["has_loop"] is True, "被拒的连接覆盖/删除了在飞 run 的登记"
    assert in_flight.pause_calls == 0


# ---------------------------------------------------------------------------
# 4. 正常完成路径行为不变:仍 detach / release
# ---------------------------------------------------------------------------


async def test_normal_completion_still_detaches_and_releases(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """正常跑完:控制面登记被 detach 移除,属主登记被释放(与改动前逐字一致)。"""
    session_id = f"{SESSION}-normal"
    loop = _OkLoop()
    _install_stream_env(monkeypatch, loop)

    resp = await _open_stream(session_id, USER)
    frames = [_parse_frame(item) async for item in resp.body_iterator]

    assert loop.runs == 1
    assert any(event["type"] == "done" for _, event in frames)
    assert await run_control.snapshot_records(session_id) == {}, (
        "正常完成没有 detach 控制面记录"
    )
    assert run_control.entry_count() == 0
    assert owner_of(session_id) is None, "正常完成没有释放属主登记"
