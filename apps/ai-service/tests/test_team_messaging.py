# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""点名投递与收件箱(G-07 复现)用例。

覆盖:
1. 席位认领与隐式认领
2. send_to_agent 点名投递:成功入队 / 未注册收件人显式失败并点名 / 绝不降级成广播
3. read_agent_inbox 的会话 + 属主双维边界:拒读路径零副作用(不消费、不删除)+ 正向对照
4. 身份缺失 fail-closed(不信客户端自报)
5. 投递诚实性:总线没落队就不冒充已投递
6. to_dict 向后兼容(旧消息逐键不变)
7. Redis 出口从未被触达(测试隔离铁律)

隔离:每条用例一个全新 AgentMessageBus(经 bus= 注入),autouse 夹具清 run_ownership
登记表(模块级进程态,不清会让上一名的属主记录污染下一条用例)。
"""

from __future__ import annotations

from pathlib import Path
from typing import Any
from unittest.mock import AsyncMock

import pytest

from app.services import agent_comm
from app.services.agent_comm import (
    AgentMessage,
    AgentMessageBus,
    claim_agent_seat,
    list_agent_peers,
    read_agent_inbox,
    release_agent_seat,
    send_to_agent,
)
from app.services.run_ownership import clear_all, owner_of

S1 = "sess-1"
S2 = "sess-2"
U1 = "user-1"
U2 = "user-2"


@pytest.fixture(autouse=True)
def _isolate_run_ownership() -> None:
    """run_ownership 是进程级登记表,逐条清空才能重复跑。"""
    clear_all()
    yield
    clear_all()


@pytest.fixture()
def bus() -> AgentMessageBus:
    b = AgentMessageBus()
    # Redis 出口必须被钉死为"永不调用":本模块的点名投递/收件是纯内存路径
    b._get_redis = AsyncMock()  # type: ignore[method-assign]
    return b


async def _claim(b: AgentMessageBus, name: str, session_id: str, user_id: str) -> dict[str, Any]:
    return await claim_agent_seat(
        agent_name=name, session_id=session_id, user_id=user_id, bus=b
    )


# =============================================================================
# 1. 席位认领
# =============================================================================


class TestClaimSeat:
    async def test_claim_registers_agent_and_owner(self, bus: AgentMessageBus) -> None:
        result = await _claim(bus, "researcher", S1, U1)
        assert result["ok"] is True
        assert result["code"] == "claimed"
        assert bus.is_registered("researcher") is True
        assert owner_of("researcher") == U1
        assert owner_of(S1) == U1

    async def test_same_seat_repeat_is_idempotent(self, bus: AgentMessageBus) -> None:
        assert (await _claim(bus, "researcher", S1, U1))["code"] == "claimed"
        assert (await _claim(bus, "researcher", S1, U1))["code"] == "already_bound"

    async def test_other_session_cannot_take_the_same_name(self, bus: AgentMessageBus) -> None:
        await _claim(bus, "researcher", S1, U1)
        result = await _claim(bus, "researcher", S2, U1)
        assert result["ok"] is False
        assert result["code"] == "seat_owned_by_other_session"
        assert result["boundSessionId"] == S1

    async def test_missing_identity_fails_closed(self, bus: AgentMessageBus) -> None:
        result = await claim_agent_seat(agent_name="x", session_id=None, user_id=U1, bus=bus)
        assert result["ok"] is False
        assert result["code"] == "missing_caller_identity"
        assert result["missingKeys"] == ["__session_id"]
        assert bus.is_registered("x") is False


# =============================================================================
# 2. 点名投递
# =============================================================================


class TestSendToAgent:
    async def test_named_delivery_lands_in_recipient_queue(self, bus: AgentMessageBus) -> None:
        await _claim(bus, "lead", S1, U1)
        await _claim(bus, "worker", S1, U1)
        result = await send_to_agent(
            recipient="worker", content="先看 tests", sender="lead",
            session_id=S1, user_id=U1, bus=bus,
        )
        assert result["ok"] is True
        assert result["code"] == "queued"
        assert result["toAgent"] == "worker"
        assert bus.queue_depth("worker") == 1

    async def test_recipient_name_may_differ_from_sender_session(self, bus: AgentMessageBus) -> None:
        """同属主跨会话可点名(接力腿);边界只在读侧收得更紧。"""
        await _claim(bus, "lead", S1, U1)
        await _claim(bus, "worker", S2, U1)
        result = await send_to_agent(
            recipient="worker", content="跨会话", sender="lead",
            session_id=S1, user_id=U1, bus=bus,
        )
        assert result["ok"] is True
        assert bus.queue_depth("worker") == 1

    async def test_unregistered_recipient_is_named_and_not_dropped_silently(
        self, bus: AgentMessageBus
    ) -> None:
        await _claim(bus, "lead", S1, U1)
        result = await send_to_agent(
            recipient="ghost", content="你好", sender="lead",
            session_id=S1, user_id=U1, bus=bus,
        )
        assert result["ok"] is False
        assert result["code"] == "unregistered_recipient"
        assert result["recipient"] == "ghost"
        assert bus.queue_depth("lead") == 0

    async def test_star_recipient_is_refused_not_broadcast(self, bus: AgentMessageBus) -> None:
        await _claim(bus, "lead", S1, U1)
        await _claim(bus, "worker", S1, U1)
        await _claim(bus, "other", S1, U1)
        result = await send_to_agent(
            recipient="*", content="全员注意", sender="lead",
            session_id=S1, user_id=U1, bus=bus,
        )
        assert result["ok"] is False
        assert result["code"] == "broadcast_not_allowed"
        assert bus.queue_depth("worker") == 0
        assert bus.queue_depth("other") == 0

    async def test_empty_recipient_and_content_are_refused(self, bus: AgentMessageBus) -> None:
        await _claim(bus, "lead", S1, U1)
        await _claim(bus, "worker", S1, U1)
        empty_to = await send_to_agent(
            recipient="  ", content="x", sender="lead", session_id=S1, user_id=U1, bus=bus
        )
        assert empty_to["code"] == "missing_recipient"
        empty_body = await send_to_agent(
            recipient="worker", content="   ", sender="lead", session_id=S1, user_id=U1, bus=bus
        )
        assert empty_body["code"] == "empty_content"
        assert bus.queue_depth("worker") == 0

    async def test_response_type_is_not_a_named_delivery(self, bus: AgentMessageBus) -> None:
        await _claim(bus, "lead", S1, U1)
        await _claim(bus, "worker", S1, U1)
        result = await send_to_agent(
            recipient="worker", content="resp", sender="lead", message_type="response",
            session_id=S1, user_id=U1, bus=bus,
        )
        assert result["code"] == "unsupported_message_type"
        assert bus.queue_depth("worker") == 0

    async def test_send_to_seatless_registration_is_unbound_not_delivered(
        self, bus: AgentMessageBus
    ) -> None:
        bus.register("legacy-worker")
        await _claim(bus, "lead", S1, U1)
        result = await send_to_agent(
            recipient="legacy-worker", content="x", sender="lead",
            session_id=S1, user_id=U1, bus=bus,
        )
        assert result["ok"] is False
        assert result["code"] == "unbound_recipient"
        assert result["recipient"] == "legacy-worker"
        assert bus.queue_depth("legacy-worker") == 0

    async def test_cross_owner_send_is_refused(self, bus: AgentMessageBus) -> None:
        await _claim(bus, "lead", S1, U1)
        await _claim(bus, "victim", S2, U2)
        result = await send_to_agent(
            recipient="victim", content="私信", sender="lead",
            session_id=S1, user_id=U1, bus=bus,
        )
        assert result["ok"] is False
        assert result["code"] == "forbidden_cross_owner"
        assert bus.queue_depth("victim") == 0

    async def test_impersonating_another_sessions_seat_is_refused(
        self, bus: AgentMessageBus
    ) -> None:
        await _claim(bus, "lead", S1, U1)
        await _claim(bus, "worker", S1, U1)
        result = await send_to_agent(
            recipient="worker", content="假名", sender="lead",
            session_id=S2, user_id=U1, bus=bus,
        )
        assert result["ok"] is False
        assert result["code"] == "forbidden_sender_impersonation"
        assert bus.queue_depth("worker") == 0

    async def test_sender_seat_is_claimed_on_first_use(self, bus: AgentMessageBus) -> None:
        await _claim(bus, "worker", S1, U1)
        result = await send_to_agent(
            recipient="worker", content="首次即认领", sender="lead",
            session_id=S1, user_id=U1, bus=bus,
        )
        assert result["ok"] is True
        assert bus.seat_of("lead") is not None
        assert bus.seat_of("lead").sessionId == S1  # type: ignore[union-attr]

    async def test_missing_identity_blocks_delivery(self, bus: AgentMessageBus) -> None:
        await _claim(bus, "lead", S1, U1)
        await _claim(bus, "worker", S1, U1)
        result = await send_to_agent(
            recipient="worker", content="x", sender="lead",
            session_id=S1, user_id=None, bus=bus,
        )
        assert result["code"] == "missing_caller_identity"
        assert result["missingKeys"] == ["__user_id"]
        assert bus.queue_depth("worker") == 0

    async def test_not_claiming_delivery_when_bus_did_not_enqueue(
        self, bus: AgentMessageBus, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        await _claim(bus, "lead", S1, U1)
        await _claim(bus, "worker", S1, U1)
        monkeypatch.setattr(bus, "send", AsyncMock())
        result = await send_to_agent(
            recipient="worker", content="x", sender="lead",
            session_id=S1, user_id=U1, bus=bus,
        )
        assert result["ok"] is False
        assert result["code"] == "not_queued"
        assert "messageId" in result


# =============================================================================
# 3. 收件箱边界(会话 ∧ 属主)
# =============================================================================


class TestReadAgentInbox:
    async def test_owner_reads_own_inbox(self, bus: AgentMessageBus) -> None:
        await _claim(bus, "lead", S1, U1)
        await _claim(bus, "worker", S1, U1)
        await send_to_agent(
            recipient="worker", content="任务 A", sender="lead",
            session_id=S1, user_id=U1, bus=bus,
        )
        inbox = await read_agent_inbox(agent_name="worker", session_id=S1, user_id=U1, bus=bus)
        assert inbox["ok"] is True
        assert inbox["count"] == 1
        assert inbox["messages"][0]["content"] == "任务 A"
        assert inbox["messages"][0]["sessionId"] == S1
        assert inbox["queueDepthRemaining"] == 0

    async def test_limit_caps_consumption(self, bus: AgentMessageBus) -> None:
        await _claim(bus, "lead", S1, U1)
        await _claim(bus, "worker", S1, U1)
        for i in range(3):
            await send_to_agent(
                recipient="worker", content=f"m{i}", sender="lead",
                session_id=S1, user_id=U1, bus=bus,
            )
        inbox = await read_agent_inbox(
            agent_name="worker", session_id=S1, user_id=U1, limit=2, bus=bus
        )
        assert inbox["count"] == 2
        assert inbox["queueDepthRemaining"] == 1

    async def test_other_session_cannot_read_and_no_side_effect(
        self, bus: AgentMessageBus
    ) -> None:
        """A 席读不到 B 席:拒读路径不消费;B 席随后仍能读到(正向对照)。"""
        await _claim(bus, "worker", S1, U1)
        await _claim(bus, "lead", S1, U1)
        await send_to_agent(
            recipient="worker", content="别席私信", sender="lead",
            session_id=S1, user_id=U1, bus=bus,
        )
        denied = await read_agent_inbox(agent_name="worker", session_id=S2, user_id=U1, bus=bus)
        assert denied["ok"] is False
        assert denied["code"] == "forbidden_cross_session"
        assert denied["count"] == 0
        assert bus.queue_depth("worker") == 1  # 副作用没发生:没被消费

        control = await read_agent_inbox(agent_name="worker", session_id=S1, user_id=U1, bus=bus)
        assert control["count"] == 1
        assert control["messages"][0]["content"] == "别席私信"

    async def test_other_user_cannot_read_and_no_side_effect(
        self, bus: AgentMessageBus
    ) -> None:
        await _claim(bus, "worker", S1, U1)
        await _claim(bus, "lead", S1, U1)
        await send_to_agent(
            recipient="worker", content="属主私信", sender="lead",
            session_id=S1, user_id=U1, bus=bus,
        )
        denied = await read_agent_inbox(
            agent_name="worker", session_id=S1, user_id=U2, user_role=1, bus=bus
        )
        assert denied["ok"] is False
        assert denied["code"] == "forbidden_cross_owner"
        assert bus.queue_depth("worker") == 1

        control = await read_agent_inbox(agent_name="worker", session_id=S1, user_id=U1, bus=bus)
        assert control["count"] == 1

    async def test_seatless_agent_read_is_refused_without_consuming(
        self, bus: AgentMessageBus
    ) -> None:
        bus.register("legacy-worker")
        await bus.send(
            AgentMessage(
                id="m-1", fromAgent="x", toAgent="legacy-worker",
                type="notification", content="存量",
            )
        )
        denied = await read_agent_inbox(
            agent_name="legacy-worker", session_id=S1, user_id=U1, bus=bus
        )
        assert denied["code"] == "unbound_agent"
        assert bus.queue_depth("legacy-worker") == 1

    async def test_unregistered_agent_names_it(self, bus: AgentMessageBus) -> None:
        denied = await read_agent_inbox(agent_name="ghost", session_id=S1, user_id=U1, bus=bus)
        assert denied["code"] == "unregistered_agent"
        assert denied["agentName"] == "ghost"

    async def test_missing_identity_does_not_read(self, bus: AgentMessageBus) -> None:
        await _claim(bus, "worker", S1, U1)
        await bus.send(
            AgentMessage(
                id="m-2", fromAgent="x", toAgent="worker",
                type="notification", content="私信",
            )
        )
        denied = await read_agent_inbox(agent_name="worker", session_id=None, user_id=U1, bus=bus)
        assert denied["code"] == "missing_caller_identity"
        assert bus.queue_depth("worker") == 1

    async def test_empty_inbox_returns_zero(self, bus: AgentMessageBus) -> None:
        await _claim(bus, "worker", S1, U1)
        inbox = await read_agent_inbox(agent_name="worker", session_id=S1, user_id=U1, bus=bus)
        assert inbox["ok"] is True
        assert inbox["count"] == 0
        assert inbox["messages"] == []


# =============================================================================
# 4. 同伴清单(peer 寻址)
# =============================================================================


class TestListAgentPeers:
    async def test_only_same_owner_seats_are_listed(self, bus: AgentMessageBus) -> None:
        await _claim(bus, "lead", S1, U1)
        await _claim(bus, "worker", S2, U1)
        await _claim(bus, "someone-else", S2, U2)
        listed = await list_agent_peers(session_id=S1, user_id=U1, bus=bus)
        names = [peer["agentName"] for peer in listed["peers"]]
        assert listed["ok"] is True
        assert sorted(names) == ["lead", "worker"]
        assert "someone-else" not in names
        by_name = {peer["agentName"]: peer for peer in listed["peers"]}
        assert by_name["lead"]["isSelfSession"] is True
        assert by_name["worker"]["isSelfSession"] is False

    async def test_missing_identity_fails_closed(self, bus: AgentMessageBus) -> None:
        listed = await list_agent_peers(session_id=S1, user_id=None, bus=bus)
        assert listed["ok"] is False
        assert listed["code"] == "missing_caller_identity"


# =============================================================================
# 5. 席位释放
# =============================================================================


class TestReleaseSeat:
    async def test_holder_releases_then_inbox_is_unbound(self, bus: AgentMessageBus) -> None:
        await _claim(bus, "worker", S1, U1)
        released = await release_agent_seat(
            agent_name="worker", session_id=S1, user_id=U1, bus=bus, unregister=True
        )
        assert released["ok"] is True
        assert released["code"] == "released"
        assert bus.is_registered("worker") is False

    async def test_non_holder_cannot_release(self, bus: AgentMessageBus) -> None:
        await _claim(bus, "worker", S1, U1)
        denied = await release_agent_seat(agent_name="worker", session_id=S2, user_id=U1, bus=bus)
        assert denied["ok"] is False
        assert denied["code"] == "forbidden_not_holder"
        assert bus.seat_of("worker") is not None


# =============================================================================
# 6. 向后兼容与纪律
# =============================================================================


class TestBackwardCompatibility:
    def test_legacy_to_dict_keys_unchanged(self) -> None:
        msg = AgentMessage(
            id="m1", fromAgent="f", toAgent="t", type="request",
            content="c", subTaskId="s", timestamp="ts", requireReply=True,
        )
        assert msg.to_dict() == {
            "id": "m1",
            "fromAgent": "f",
            "toAgent": "t",
            "type": "request",
            "content": "c",
            "subTaskId": "s",
            "timestamp": "ts",
            "requireReply": True,
        }

    def test_identity_dims_appear_only_when_set(self) -> None:
        msg = AgentMessage(
            id="m2", fromAgent="f", toAgent="t", type="notification",
            content="c", ownerUserId=U1, sessionId=S1,
        )
        assert msg.to_dict()["ownerUserId"] == U1
        assert msg.to_dict()["sessionId"] == S1

    async def test_unregister_drops_the_seat_too(self, bus: AgentMessageBus) -> None:
        await _claim(bus, "worker", S1, U1)
        bus.unregister("worker")
        assert bus.seat_of("worker") is None
        assert bus.queue_depth("worker") is None


class TestRedisDiscipline:
    async def test_named_delivery_never_touches_redis(self, bus: AgentMessageBus) -> None:
        await _claim(bus, "lead", S1, U1)
        await _claim(bus, "worker", S1, U1)
        await send_to_agent(
            recipient="worker", content="x", sender="lead",
            session_id=S1, user_id=U1, bus=bus,
        )
        await read_agent_inbox(agent_name="worker", session_id=S1, user_id=U1, bus=bus)
        assert bus._get_redis.await_count == 0  # type: ignore[attr-defined]

    async def test_module_reuses_the_existing_bus_internals(self) -> None:
        """点名投递不得自带第二套队列:服务层只经总线 send/receive。"""
        src = Path(agent_comm.__file__).read_text(encoding="utf-8")
        service_part = src.split("# 点名投递服务层", 1)[1]
        assert "asyncio.Queue" not in service_part
        assert "await b.send(" in service_part
        assert "b.receive(" in service_part
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
