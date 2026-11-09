# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""信箱新字段的消费端单测(2026-11-08)。

上一笔只把 entersContext / triggersAgent / priority 写进信封,没有任何读者;
这一笔钉住"字段真的改变行为":

判据:
  ① priority 影响投递顺序:积压时先取高优先级,取不走的留在队列里等下次读;
     同优先级保持到达序(FIFO 不被排序打乱)。
  ② entersContext=false 的正文不交给模型(读口消费掉但 content 置空)、
     读口报 suppressedFromContext,不把"没注入"伪装成"没收到"。
  ③ triggersAgent=true 真的叫醒收件方**正在跑**的回合(steer 被调用),
     没有活跃回合时如实返回 not_running / unknown_session,不反悔已入队事实。
  ④ 唤醒与暂停同权:属主不符一律 forbidden,且 entersContext=false 不得借唤醒腿泄露正文。
"""

from __future__ import annotations

import uuid
from typing import Any

import pytest

from app.services import agent_run_control
from app.services.agent_comm import (
    AgentMessageBus,
    read_agent_inbox,
    record_ownership,
    send_to_agent,
)
from app.services.agent_run_control import (
    detach_run,
    register_run,
    wake_session,
)


class _FakeLoop:
    """只实现 steer / pause 的最小替身(与真实 AgentLoopV2 的这两个出口同形)。"""

    def __init__(self, *, accepted: bool = True, steerable: bool = True) -> None:
        self.calls: list[str] = []
        self.accepted = accepted
        if not steerable:
            # 显式删掉属性,模拟"能暂停但不能中途注入"的回合对象
            self.steer = None  # type: ignore[assignment]

    async def pause(self) -> str | None:
        return "ck-fake"

    def steer(self, text: str) -> bool:
        self.calls.append(text)
        return self.accepted


@pytest.fixture(autouse=True)
def _isolate_run_control():
    agent_run_control.clear_all()
    yield
    agent_run_control.clear_all()


def _unique(prefix: str) -> str:
    return f"{prefix}-{uuid.uuid4().hex[:8]}"


def _bus_with(*, tag: str) -> tuple[AgentMessageBus, str, str]:
    bus = AgentMessageBus()
    alice = f"alice-{tag}"
    bob = f"bob-{tag}"
    for name in (alice, bob):
        session_id = f"sess-{name}"
        bus.register(name)
        bus.claim_seat(name, session_id=session_id, owner_user_id="owner-1")
        record_ownership(session_id, "owner-1")
        record_ownership(name, "owner-1")
    return bus, alice, bob


async def _send(bus: AgentMessageBus, alice: str, bob: str, **overrides: Any):
    payload: dict[str, Any] = {
        "recipient": bob,
        "content": "请检查产物",
        "sender": alice,
        "session_id": f"sess-{alice}",
        "user_id": "owner-1",
        "bus": bus,
    }
    payload.update(overrides)
    return await send_to_agent(**payload)


async def _read(bus: AgentMessageBus, bob: str, *, limit: int = 10):
    return await read_agent_inbox(
        agent_name=bob,
        session_id=f"sess-{bob}",
        user_id="owner-1",
        limit=limit,
        bus=bus,
    )


# ---------------------------------------------------------------------------
# ① priority:投递顺序
# ---------------------------------------------------------------------------


async def test_read_prefers_higher_priority_and_keeps_rest_queued():
    tag = _unique("prio")
    bus, alice, bob = _bus_with(tag=tag)
    assert (await _send(bus, alice, bob, content="low", priority=1))["ok"] is True
    assert (await _send(bus, alice, bob, content="high", priority=9))["ok"] is True
    assert (await _send(bus, alice, bob, content="mid", priority=5))["ok"] is True

    first = await _read(bus, bob, limit=2)
    assert [item["content"] for item in first["messages"]] == ["high", "mid"]
    assert first["queueDepthRemaining"] == 1

    second = await _read(bus, bob, limit=2)
    assert [item["content"] for item in second["messages"]] == ["low"]
    assert second["queueDepthRemaining"] == 0


async def test_read_keeps_fifo_for_equal_priority():
    tag = _unique("fifo")
    bus, alice, bob = _bus_with(tag=tag)
    for content in ("first", "second", "third"):
        assert (await _send(bus, alice, bob, content=content))["ok"] is True

    inbox = await _read(bus, bob, limit=2)
    assert [item["content"] for item in inbox["messages"]] == ["first", "second"]
    assert inbox["queueDepthRemaining"] == 1


# ---------------------------------------------------------------------------
# ② entersContext:正文是否交给模型
# ---------------------------------------------------------------------------


async def test_enters_context_false_omits_content_but_consumes_message():
    tag = _unique("ectx")
    bus, alice, bob = _bus_with(tag=tag)
    body = "这段正文不应进入模型上下文"
    assert (await _send(bus, alice, bob, content=body, enters_context=False))["ok"] is True

    inbox = await _read(bus, bob)
    assert inbox["count"] == 1
    message = inbox["messages"][0]
    assert message["entersContext"] is False
    assert message["content"] == ""
    assert message["contentOmitted"] is True
    assert message["contentLength"] == len(body)
    assert inbox["contextEligible"] == 0
    assert inbox["suppressedFromContext"] == 1
    # 消息已被消费,不是"堆在队列里假装读过"
    assert inbox["queueDepthRemaining"] == 0


async def test_enters_context_true_returns_content_untouched():
    tag = _unique("ectx-on")
    bus, alice, bob = _bus_with(tag=tag)
    assert (await _send(bus, alice, bob, content="正常正文"))["ok"] is True

    inbox = await _read(bus, bob)
    message = inbox["messages"][0]
    assert message["content"] == "正常正文"
    assert "contentOmitted" not in message
    assert inbox["contextEligible"] == 1
    assert inbox["suppressedFromContext"] == 0


# ---------------------------------------------------------------------------
# ③ triggersAgent:唤醒正在跑的回合
# ---------------------------------------------------------------------------


async def test_triggers_agent_wakes_running_turn():
    tag = _unique("wake")
    bus, alice, bob = _bus_with(tag=tag)
    loop = _FakeLoop()
    await register_run(f"sess-{bob}", owner_user_id="owner-1", loop=loop)

    sent = await _send(bus, alice, bob, content="新任务到了", triggers_agent=True)
    assert sent["ok"] is True
    assert sent["wakeUp"]["ok"] is True
    assert sent["wakeUp"]["code"] == "woken"
    assert len(loop.calls) == 1
    assert "新任务到了" in loop.calls[0]
    # 入队事实不因唤醒而改变
    assert sent["queueDepth"] == 1


async def test_triggers_agent_without_running_turn_reports_not_running():
    tag = _unique("wake-idle")
    bus, alice, bob = _bus_with(tag=tag)
    loop = _FakeLoop()
    await register_run(f"sess-{bob}", owner_user_id="owner-1", loop=loop)
    # 模拟收件方回合已结束(执行作用域退出)
    assert await detach_run(f"sess-{bob}", owner_user_id="owner-1") is True

    sent = await _send(bus, alice, bob, triggers_agent=True)
    assert sent["ok"] is True
    assert sent["wakeUp"]["ok"] is False
    assert sent["wakeUp"]["code"] == "unknown_session"
    assert loop.calls == []


async def test_triggers_agent_paused_turn_is_not_running():
    tag = _unique("wake-paused")
    bus, alice, bob = _bus_with(tag=tag)
    loop = _FakeLoop()
    await register_run(f"sess-{bob}", owner_user_id="owner-1", loop=loop)
    paused = await agent_run_control.pause_session(f"sess-{bob}", "owner-1")
    assert paused.outcome == agent_run_control.PauseOutcome.PAUSED

    sent = await _send(bus, alice, bob, triggers_agent=True)
    assert sent["wakeUp"]["code"] == "not_running"
    assert loop.calls == []


async def test_triggers_agent_false_does_not_wake():
    tag = _unique("wake-off")
    bus, alice, bob = _bus_with(tag=tag)
    loop = _FakeLoop()
    await register_run(f"sess-{bob}", owner_user_id="owner-1", loop=loop)

    sent = await _send(bus, alice, bob, triggers_agent=False)
    assert "wakeUp" not in sent
    assert loop.calls == []


async def test_wake_does_not_leak_body_when_enters_context_is_false():
    tag = _unique("wake-redact")
    bus, alice, bob = _bus_with(tag=tag)
    loop = _FakeLoop()
    await register_run(f"sess-{bob}", owner_user_id="owner-1", loop=loop)
    body = "SECRET-CONTENT-不应出现在唤醒里"

    sent = await _send(
        bus, alice, bob, content=body, enters_context=False, triggers_agent=True
    )
    assert sent["wakeUp"]["code"] == "woken"
    assert body not in loop.calls[0]
    assert "entersContext=false" in loop.calls[0]


# ---------------------------------------------------------------------------
# ④ 唤醒与暂停同权
# ---------------------------------------------------------------------------


async def test_wake_session_rejects_foreign_owner():
    tag = _unique("wake-own")
    loop = _FakeLoop()
    session_id = f"sess-{tag}"
    await register_run(session_id, owner_user_id="owner-1", loop=loop)

    denied = await wake_session(session_id, owner_user_id="owner-2", text="hi")
    assert denied == {"ok": False, "code": "forbidden"}
    assert loop.calls == []


async def test_wake_session_rejects_unregistered_and_unsteerable():
    tag = _unique("wake-unreg")
    assert await wake_session(
        f"sess-{tag}", owner_user_id="owner-1", text="hi"
    ) == {"ok": False, "code": "unknown_session"}

    unsteerable = _FakeLoop(steerable=False)
    session_id = f"sess-{tag}-2"
    await register_run(session_id, owner_user_id="owner-1", loop=unsteerable)
    assert await wake_session(
        session_id, owner_user_id="owner-1", text="hi"
    ) == {"ok": False, "code": "not_steerable"}


async def test_wake_session_requires_identity_and_text():
    assert await wake_session("", owner_user_id="owner-1", text="hi") == {
        "ok": False,
        "code": "missing_identity",
    }
    assert await wake_session("sess-x", owner_user_id="", text="hi") == {
        "ok": False,
        "code": "missing_identity",
    }
    assert await wake_session("sess-x", owner_user_id="owner-1", text="   ") == {
        "ok": False,
        "code": "empty_text",
    }
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
