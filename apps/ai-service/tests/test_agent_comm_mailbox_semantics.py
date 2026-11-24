# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""会话信箱语义单测(2026-11-08)。

对齐 Trae inbox 信封的四枚开关(entersContext / triggersAgent / artifactRefs /
priority)与两道防回环闸(hopDepth 上限、sourceEventId 幂等)。

判据:
  ① 新字段能落信封、能读回;默认值不写进载荷(老消费者逐键不变);
  ② artifactRefs 去重 + 封顶(20);
  ③ hopDepth 超上限 ⇒ `hop_depth_exceeded`,且零入队;
  ④ 同一 sourceEventId 窗口内重复 ⇒ `duplicate_source_event`,只入队一次;
  ⑤ read_agent_inbox 给出 contextEligible / triggersAgentCount,不在读口替调用方决定。
"""

from __future__ import annotations

import uuid

from app.services.agent_comm import (
    AgentMessage,
    AgentMessageBus,
    read_agent_inbox,
    record_ownership,
    send_to_agent,
)


def _unique(prefix: str) -> str:
    return f"{prefix}-{uuid.uuid4().hex[:8]}"


def _bus_with(*, tag: str, names: tuple[str, str] = ("alice", "bob")) -> tuple[AgentMessageBus, str, str]:
    """注册两个具名席位并登记属主;名字带随机后缀,避免跨用例串味。"""
    bus = AgentMessageBus()
    alice = f"{names[0]}-{tag}"
    bob = f"{names[1]}-{tag}"
    for name in (alice, bob):
        session_id = f"sess-{name}"
        bus.register(name)
        bus.claim_seat(name, session_id=session_id, owner_user_id="owner-1")
        record_ownership(session_id, "owner-1")
        record_ownership(name, "owner-1")
    return bus, alice, bob


async def _send(bus: AgentMessageBus, alice: str, bob: str, **overrides):
    payload = {
        "recipient": bob,
        "content": "请检查产物",
        "sender": alice,
        "session_id": f"sess-{alice}",
        "user_id": "owner-1",
        "bus": bus,
    }
    payload.update(overrides)
    return await send_to_agent(**payload)


# ---------------------------------------------------------------------------
# ① 字段落信封 + 默认值不改载荷
# ---------------------------------------------------------------------------


async def test_mailbox_fields_round_trip():
    tag = _unique("rt")
    bus, alice, bob = _bus_with(tag=tag)

    sent = await _send(
        bus,
        alice,
        bob,
        enters_context=False,
        triggers_agent=True,
        artifact_refs=["a.txt", "a.txt", "b.txt"],
        priority=5,
        hop_depth=2,
        source_event_id="evt-1",
    )
    assert sent["ok"] is True
    assert sent["entersContext"] is False
    assert sent["triggersAgent"] is True
    assert sent["hopDepth"] == 2

    inbox = await read_agent_inbox(
        agent_name=bob, session_id=f"sess-{bob}", user_id="owner-1", bus=bus
    )
    assert inbox["count"] == 1
    message = inbox["messages"][0]
    assert message["entersContext"] is False
    assert message["triggersAgent"] is True
    assert message["artifactRefs"] == ["a.txt", "b.txt"]
    assert message["priority"] == 5
    assert message["hopDepth"] == 2
    assert message["sourceEventId"] == "evt-1"
    assert inbox["contextEligible"] == 0
    assert inbox["triggersAgentCount"] == 1


async def test_defaults_are_not_written_to_payload():
    tag = _unique("dflt")
    bus, alice, bob = _bus_with(tag=tag)
    assert (await _send(bus, alice, bob))["ok"] is True

    inbox = await read_agent_inbox(
        agent_name=bob, session_id=f"sess-{bob}", user_id="owner-1", bus=bus
    )
    message = inbox["messages"][0]
    for key in ("entersContext", "triggersAgent", "artifactRefs", "priority", "hopDepth",
                "sourceEventId"):
        assert key not in message
    assert inbox["contextEligible"] == 1
    assert inbox["triggersAgentCount"] == 0


def test_agent_message_normalizes_untrusted_fields():
    message = AgentMessage(
        id="m-1",
        fromAgent="a",
        toAgent="b",
        type="notification",
        content="x",
        artifactRefs=["a", "a", " b ", ""],
        priority="7",  # type: ignore[arg-type]
        hopDepth=-5,  # type: ignore[arg-type]
        sourceEventId="  evt-9  ",
    )
    assert message.artifactRefs == ["a", "b"]
    assert message.priority == 7
    assert message.hopDepth == 0
    assert message.sourceEventId == "evt-9"


async def test_artifact_refs_are_capped():
    tag = _unique("cap")
    bus, alice, bob = _bus_with(tag=tag)
    refs = [f"file-{index}.txt" for index in range(30)]
    assert (await _send(bus, alice, bob, artifact_refs=refs))["ok"] is True

    inbox = await read_agent_inbox(
        agent_name=bob, session_id=f"sess-{bob}", user_id="owner-1", bus=bus
    )
    assert len(inbox["messages"][0]["artifactRefs"]) == 20


# ---------------------------------------------------------------------------
# ② 防回环闸
# ---------------------------------------------------------------------------


async def test_hop_depth_over_limit_is_rejected_and_not_queued():
    tag = _unique("hop")
    bus, alice, bob = _bus_with(tag=tag)

    rejected = await _send(bus, alice, bob, hop_depth=4)
    assert rejected["ok"] is False
    assert rejected["code"] == "hop_depth_exceeded"
    assert rejected["maxHopDepth"] == 3
    assert bus.queue_depth(bob) == 0

    accepted = await _send(bus, alice, bob, hop_depth=3)
    assert accepted["ok"] is True
    assert bus.queue_depth(bob) == 1


async def test_duplicate_source_event_is_dropped():
    tag = _unique("dup")
    bus, alice, bob = _bus_with(tag=tag)

    first = await _send(bus, alice, bob, source_event_id="evt-dup")
    second = await _send(bus, alice, bob, source_event_id="evt-dup")
    assert first["ok"] is True
    assert second["ok"] is False
    assert second["code"] == "duplicate_source_event"
    assert bus.queue_depth(bob) == 1

    # 空 id 不去重:旧调用方不传 sourceEventId 时行为不变
    assert bus.mark_source_event(None) is True
    assert bus.mark_source_event("evt-other") is True
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
