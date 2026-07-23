"""Agent 通信机制(P3-3)综合测试(2026-07-23 立,补齐零覆盖)。

覆盖维度(75+ cases):
1. AgentMessage dataclass:构造 / 默认值 / __post_init__ / to_dict(10 tests)
2. AgentMessageType Literal 类型(1 test)
3. BlackboardEntry dataclass:构造 / 默认值 / __post_init__ / to_dict(7 tests)
4. AgentMessageBus 初始化:queues / registered / pending / _use_redis(5 tests)
5. register:注册 / 重复 / 多个 / 排序 / 队列创建(5 tests)
6. unregister:注销 / 未注册 / 再注册 / 收不到消息(4 tests)
7. send 点对点:已注册 / 未注册丢弃 / 自身 / 返回值 / 顺序 / 非法目标(6 tests)
8. send response:解析 Future / 无 subTaskId / 未知 ID / 已 done / 不入队(5 tests)
9. broadcast:排除发送者 / 全员收到 / 无他人 / 辅助方法 / type=broadcast 触发 / toAgent=* 触发(7 tests)
10. receive:顺序 / 超时 / 未注册 / 默认超时(4 tests)
11. request_reply:成功 / 超时 / 唯一 ID / requireReply / 清理 / 并发 / 未注册目标(7 tests)
12. _get_redis:降级 / 缓存 / 连接失败 / ping 失败 / use_redis=False / 已有客户端(6 tests)
13. AgentBlackboard:write/read/list/delete/readBy 合并/不同 key 隔离(12 tests)
14. 模块级单例:存在 / 类型(4 tests)
15. 边界:空 content / 空 fromAgent / 无效 type / 并发发送 / 广播顺序(5 tests)

源码发现(非 bug,设计观察):
- AgentBlackboard 无 Redis 集成(纯内存 + asyncio.Lock),与设计文档"Redis 降级"描述不符
- AgentBlackboard 无 update 方法,实际 API 为 write/read/delete/list_entries
- _get_redis 定义但 send/receive/broadcast/request_reply 均未调用,Redis 为预留路径
- send 点对点不排除 toAgent==fromAgent(可发给自己),仅 broadcast 排除发送者
- type="broadcast" 或 toAgent="*" 任一满足即走广播分支(toAgent 字段被忽略)
"""

from __future__ import annotations

import asyncio
from typing import get_args
from unittest.mock import AsyncMock, patch

import pytest

from app.core.config import settings
from app.services.agent_comm import (
    AgentBlackboard,
    AgentMessage,
    AgentMessageBus,
    AgentMessageType,
    BlackboardEntry,
    agent_blackboard,
    agent_message_bus,
)


# =============================================================================
# 工厂函数
# =============================================================================


def make_message(
    id: str = "msg-001",
    fromAgent: str = "a1",
    toAgent: str = "a2",
    type: str = "notification",
    content: str = "hello",
    subTaskId: str | None = None,
    timestamp: str = "",
    requireReply: bool = False,
) -> AgentMessage:
    """构造 AgentMessage 测试实例。"""
    return AgentMessage(
        id=id,
        fromAgent=fromAgent,
        toAgent=toAgent,
        type=type,  # type: ignore[arg-type]
        content=content,
        subTaskId=subTaskId,
        timestamp=timestamp,
        requireReply=requireReply,
    )


def make_blackboard_entry(
    id: str = "bb-001",
    key: str = "key1",
    value: str = "value1",
    writtenBy: str = "a1",
    subTaskId: str | None = None,
    timestamp: str = "",
    readBy: list[str] | None = None,
) -> BlackboardEntry:
    """构造 BlackboardEntry 测试实例。"""
    return BlackboardEntry(
        id=id,
        key=key,
        value=value,
        writtenBy=writtenBy,
        subTaskId=subTaskId,
        timestamp=timestamp,
        readBy=readBy if readBy is not None else [],
    )


# =============================================================================
# 1. AgentMessage dataclass(10 tests)
# =============================================================================


class TestAgentMessage:
    """AgentMessage 字段构造、默认值、__post_init__、to_dict。"""

    def test_construct_with_all_fields(self):
        """显式传入所有字段时完整保留。"""
        msg = AgentMessage(
            id="m1",
            fromAgent="a1",
            toAgent="a2",
            type="request",
            content="hello",
            subTaskId="st1",
            timestamp="2026-01-01T00:00:00+00:00",
            requireReply=True,
        )
        assert msg.id == "m1"
        assert msg.fromAgent == "a1"
        assert msg.toAgent == "a2"
        assert msg.type == "request"
        assert msg.content == "hello"
        assert msg.subTaskId == "st1"
        assert msg.timestamp == "2026-01-01T00:00:00+00:00"
        assert msg.requireReply is True

    def test_default_subTaskId_is_none(self):
        """subTaskId 默认 None。"""
        msg = make_message()
        assert msg.subTaskId is None

    def test_default_timestamp_generated_in_post_init(self):
        """timestamp 为空串时 __post_init__ 生成 UTC ISO 时间。"""
        msg = make_message(timestamp="")
        assert msg.timestamp != ""
        # 验证可被 datetime.fromisoformat 解析
        from datetime import datetime
        parsed = datetime.fromisoformat(msg.timestamp)
        assert parsed.tzinfo is not None

    def test_default_requireReply_is_false(self):
        """requireReply 默认 False。"""
        msg = make_message()
        assert msg.requireReply is False

    def test_explicit_timestamp_preserved(self):
        """显式 timestamp 被保留,__post_init__ 不覆盖。"""
        msg = make_message(timestamp="2025-12-31T23:59:59+00:00")
        assert msg.timestamp == "2025-12-31T23:59:59+00:00"

    def test_empty_string_timestamp_is_falsy_and_generates_new(self):
        """空串 timestamp 为 falsy,触发 __post_init__ 生成。"""
        msg = make_message(timestamp="")
        assert msg.timestamp != ""
        assert len(msg.timestamp) > 10

    def test_to_dict_returns_all_fields(self):
        """to_dict 返回全部 8 个字段。"""
        msg = make_message(
            id="m1", fromAgent="f", toAgent="t", type="request",
            content="c", subTaskId="s", timestamp="ts", requireReply=True,
        )
        d = msg.to_dict()
        assert d == {
            "id": "m1",
            "fromAgent": "f",
            "toAgent": "t",
            "type": "request",
            "content": "c",
            "subTaskId": "s",
            "timestamp": "ts",
            "requireReply": True,
        }

    def test_to_dict_subTaskId_none(self):
        """subTaskId 为 None 时 to_dict 保留 None。"""
        msg = make_message(subTaskId=None)
        assert msg.to_dict()["subTaskId"] is None

    def test_broadcast_toAgent_star(self):
        """广播消息 toAgent 为 '*'。"""
        msg = make_message(toAgent="*", type="broadcast")
        assert msg.toAgent == "*"
        assert msg.to_dict()["toAgent"] == "*"

    def test_requireReply_can_be_true(self):
        """requireReply 可设为 True。"""
        msg = make_message(requireReply=True)
        assert msg.requireReply is True
        assert msg.to_dict()["requireReply"] is True


# =============================================================================
# 2. AgentMessageType Literal(1 test)
# =============================================================================


class TestAgentMessageType:
    """AgentMessageType Literal 类型别名。"""

    def test_literal_values(self):
        """Literal 包含 5 种消息类型。"""
        args = get_args(AgentMessageType)
        assert set(args) == {"request", "response", "notification", "broadcast", "handoff"}


# =============================================================================
# 3. BlackboardEntry dataclass(7 tests)
# =============================================================================


class TestBlackboardEntry:
    """BlackboardEntry 字段构造、默认值、__post_init__、to_dict。"""

    def test_construct_with_all_fields(self):
        """显式传入所有字段时完整保留。"""
        entry = BlackboardEntry(
            id="b1",
            key="k1",
            value="v1",
            writtenBy="a1",
            subTaskId="st1",
            timestamp="2026-01-01T00:00:00+00:00",
            readBy=["r1", "r2"],
        )
        assert entry.id == "b1"
        assert entry.key == "k1"
        assert entry.value == "v1"
        assert entry.writtenBy == "a1"
        assert entry.subTaskId == "st1"
        assert entry.timestamp == "2026-01-01T00:00:00+00:00"
        assert entry.readBy == ["r1", "r2"]

    def test_default_subTaskId_is_none(self):
        """subTaskId 默认 None。"""
        entry = make_blackboard_entry()
        assert entry.subTaskId is None

    def test_default_timestamp_generated_in_post_init(self):
        """timestamp 为空串时 __post_init__ 生成 UTC ISO。"""
        entry = make_blackboard_entry(timestamp="")
        assert entry.timestamp != ""
        from datetime import datetime
        parsed = datetime.fromisoformat(entry.timestamp)
        assert parsed.tzinfo is not None

    def test_default_readBy_is_empty_list(self):
        """readBy 默认空列表。"""
        entry = make_blackboard_entry()
        assert entry.readBy == []

    def test_readB_list_independent_across_instances(self):
        """default_factory=list 确保每个实例 readBy 独立。"""
        e1 = make_blackboard_entry(id="e1")
        e2 = make_blackboard_entry(id="e2")
        e1.readBy.append("reader1")
        assert e2.readBy == []

    def test_explicit_timestamp_preserved(self):
        """显式 timestamp 被保留。"""
        entry = make_blackboard_entry(timestamp="2025-06-15T12:00:00+00:00")
        assert entry.timestamp == "2025-06-15T12:00:00+00:00"

    def test_to_dict_returns_all_fields(self):
        """to_dict 返回全部 7 个字段。"""
        entry = make_blackboard_entry(
            id="b1", key="k", value="v", writtenBy="w",
            subTaskId="s", timestamp="ts", readBy=["r1"],
        )
        d = entry.to_dict()
        assert d == {
            "id": "b1",
            "key": "k",
            "value": "v",
            "writtenBy": "w",
            "subTaskId": "s",
            "timestamp": "ts",
            "readBy": ["r1"],
        }


# =============================================================================
# 4. AgentMessageBus 初始化(5 tests)
# =============================================================================


class TestAgentMessageBusInit:
    """AgentMessageBus __init__ 状态初始化。"""

    def test_init_empty_queues(self):
        """初始化时 _queues 为空。"""
        bus = AgentMessageBus()
        assert bus._queues == {}

    def test_init_empty_registered(self):
        """初始化时 _registered 为空。"""
        bus = AgentMessageBus()
        assert bus._registered == set()

    def test_init_empty_pending_replies(self):
        """初始化时 _pending_replies 为空。"""
        bus = AgentMessageBus()
        assert bus._pending_replies == {}

    def test_init_use_redis_true_by_default(self):
        """默认 redis_url 非空且 redis 包已安装 → _use_redis=True。"""
        bus = AgentMessageBus()
        # settings.redis_url 默认 "redis://localhost:8811",redis 包已安装
        assert bus._use_redis is True

    def test_init_use_redis_false_when_redis_url_empty(self, monkeypatch):
        """redis_url 为空 → _use_redis=False。"""
        monkeypatch.setattr(settings, "redis_url", "")
        bus = AgentMessageBus()
        assert bus._use_redis is False

    @patch("app.services.agent_comm.aioredis", None)
    def test_init_use_redis_false_when_aioredis_none(self):
        """aioredis 为 None(ImportError 降级)→ _use_redis=False。"""
        bus = AgentMessageBus()
        assert bus._use_redis is False


# =============================================================================
# 5. register(5 tests)
# =============================================================================


class TestRegister:
    """AgentMessageBus.register 方法。"""

    def test_register_creates_queue_and_adds_to_registered(self):
        """注册 agent:创建专属队列 + 加入 registered 集合。"""
        bus = AgentMessageBus()
        bus.register("a1")
        assert "a1" in bus._queues
        assert "a1" in bus._registered
        assert isinstance(bus._queues["a1"], asyncio.Queue)

    def test_register_idempotent(self):
        """重复注册同一 agent:不报错,不创建新队列。"""
        bus = AgentMessageBus()
        bus.register("a1")
        q1 = bus._queues["a1"]
        bus.register("a1")
        q2 = bus._queues["a1"]
        assert q1 is q2  # 同一队列对象
        assert len(bus._registered) == 1

    def test_register_multiple_agents(self):
        """注册多个 agent:各自独立队列。"""
        bus = AgentMessageBus()
        bus.register("a1")
        bus.register("a2")
        bus.register("a3")
        assert len(bus._queues) == 3
        assert len(bus._registered) == 3
        assert bus._queues["a1"] is not bus._queues["a2"]

    def test_registered_agents_returns_sorted_list(self):
        """registered_agents 返回排序后的列表。"""
        bus = AgentMessageBus()
        bus.register("c")
        bus.register("a")
        bus.register("b")
        assert bus.registered_agents == ["a", "b", "c"]

    def test_registered_agents_empty(self):
        """无注册 agent 时返回空列表。"""
        bus = AgentMessageBus()
        assert bus.registered_agents == []


# =============================================================================
# 6. unregister(4 tests)
# =============================================================================


class TestUnregister:
    """AgentMessageBus.unregister 方法。"""

    def test_unregister_removes_queue_and_registered(self):
        """注销 agent:移除队列 + 从 registered 移除。"""
        bus = AgentMessageBus()
        bus.register("a1")
        bus.unregister("a1")
        assert "a1" not in bus._queues
        assert "a1" not in bus._registered

    def test_unregister_unknown_agent_no_error(self):
        """注销未注册 agent:不报错。"""
        bus = AgentMessageBus()
        bus.unregister("nonexistent")  # 不应抛异常

    def test_unregister_then_reregister(self):
        """注销后重新注册:新队列。"""
        bus = AgentMessageBus()
        bus.register("a1")
        q1 = bus._queues["a1"]
        bus.unregister("a1")
        bus.register("a1")
        q2 = bus._queues["a1"]
        assert q1 is not q2  # 新队列

    @pytest.mark.asyncio
    async def test_unregistered_agent_no_longer_receives(self):
        """注销后 send 到该 agent → 丢弃。"""
        bus = AgentMessageBus()
        bus.register("a1")
        bus.register("a2")
        bus.unregister("a2")
        await bus.send(make_message(fromAgent="a1", toAgent="a2"))
        # a2 已注销,receive 返回 None
        assert await bus.receive("a2", timeout=0.1) is None


# =============================================================================
# 7. send 点对点(6 tests)
# =============================================================================


class TestSendPointToPoint:
    """AgentMessageBus.send 点对点发送。"""

    @pytest.mark.asyncio
    async def test_send_to_registered_agent_enqueues(self):
        """目标已注册 → 消息入队。"""
        bus = AgentMessageBus()
        bus.register("a1")
        bus.register("a2")
        msg = make_message(fromAgent="a1", toAgent="a2")
        await bus.send(msg)
        received = await bus.receive("a2", timeout=1.0)
        assert received is not None
        assert received.id == msg.id
        assert received.fromAgent == "a1"

    @pytest.mark.asyncio
    async def test_send_to_unregistered_agent_drops(self):
        """目标未注册 → 消息丢弃,不抛错。"""
        bus = AgentMessageBus()
        bus.register("a1")
        # a2 未注册
        await bus.send(make_message(fromAgent="a1", toAgent="a2"))
        # 无异常即通过

    @pytest.mark.asyncio
    async def test_send_to_self_enqueues(self):
        """点对点发送给自身(toAgent==fromAgent)→ 消息入队(源码不排除自身)。

        注:broadcast 排除发送者,但点对点 send 不排除。
        """
        bus = AgentMessageBus()
        bus.register("a1")
        await bus.send(make_message(fromAgent="a1", toAgent="a1"))
        received = await bus.receive("a1", timeout=1.0)
        assert received is not None
        assert received.fromAgent == "a1"
        assert received.toAgent == "a1"

    @pytest.mark.asyncio
    async def test_send_returns_none(self):
        """send 无返回值。"""
        bus = AgentMessageBus()
        bus.register("a1")
        bus.register("a2")
        result = await bus.send(make_message(fromAgent="a1", toAgent="a2"))
        assert result is None

    @pytest.mark.asyncio
    async def test_send_multiple_messages_preserve_order(self):
        """多条消息按发送顺序入队(FIFO)。"""
        bus = AgentMessageBus()
        bus.register("a1")
        bus.register("a2")
        for i in range(5):
            await bus.send(make_message(id=f"m{i}", fromAgent="a1", toAgent="a2"))
        for i in range(5):
            msg = await bus.receive("a2", timeout=1.0)
            assert msg is not None
            assert msg.id == f"m{i}"

    @pytest.mark.asyncio
    async def test_send_to_unregistered_does_not_block(self):
        """目标未注册 → send 立即返回,不阻塞。"""
        bus = AgentMessageBus()
        bus.register("a1")
        # a2 未注册,send 应立即完成
        await asyncio.wait_for(
            bus.send(make_message(fromAgent="a1", toAgent="a2")),
            timeout=1.0,
        )


# =============================================================================
# 8. send response(5 tests)
# =============================================================================


class TestSendResponse:
    """send 处理 response 类型消息(Future 解析)。"""

    @pytest.mark.asyncio
    async def test_send_response_resolves_future(self):
        """type=response 且 subTaskId 匹配 → 解析 Future,不入队。"""
        bus = AgentMessageBus()
        bus.register("a1")
        bus.register("a2")
        loop = asyncio.get_running_loop()
        future: asyncio.Future[AgentMessage] = loop.create_future()
        bus._pending_replies["req-001"] = future

        response = make_message(
            fromAgent="a2", toAgent="a1", type="response",
            content="reply", subTaskId="req-001",
        )
        await bus.send(response)

        assert future.done()
        assert future.result().content == "reply"
        # response 不入队
        assert await bus.receive("a1", timeout=0.1) is None

    @pytest.mark.asyncio
    async def test_send_response_without_subTaskId_falls_through(self):
        """type=response 但 subTaskId=None → 走正常入队(不匹配 Future)。"""
        bus = AgentMessageBus()
        bus.register("a1")
        bus.register("a2")
        response = make_message(
            fromAgent="a2", toAgent="a1", type="response",
            content="reply", subTaskId=None,
        )
        await bus.send(response)
        # subTaskId 为 None(falsy),不进入 Future 解析分支 → 入队
        received = await bus.receive("a1", timeout=1.0)
        assert received is not None
        assert received.content == "reply"

    @pytest.mark.asyncio
    async def test_send_response_with_unknown_subTaskId_falls_through(self):
        """subTaskId 不匹配任何 pending → 走正常入队。"""
        bus = AgentMessageBus()
        bus.register("a1")
        bus.register("a2")
        response = make_message(
            fromAgent="a2", toAgent="a1", type="response",
            content="reply", subTaskId="nonexistent",
        )
        await bus.send(response)
        # 无匹配 future → 入队
        received = await bus.receive("a1", timeout=1.0)
        assert received is not None
        assert received.content == "reply"

    @pytest.mark.asyncio
    async def test_send_response_with_done_future_falls_through(self):
        """future 已 done → response 走正常入队逻辑。"""
        bus = AgentMessageBus()
        bus.register("a1")
        bus.register("a2")
        loop = asyncio.get_running_loop()
        future: asyncio.Future[AgentMessage] = loop.create_future()
        future.set_result(make_message(content="old"))
        bus._pending_replies["req-done"] = future

        response = make_message(
            fromAgent="a2", toAgent="a1", type="response",
            content="new", subTaskId="req-done",
        )
        await bus.send(response)
        # future 已 done → 不 set_result → 入队
        received = await bus.receive("a1", timeout=1.0)
        assert received is not None
        assert received.content == "new"

    @pytest.mark.asyncio
    async def test_send_response_pops_pending_entry(self):
        """response 匹配后从 _pending_replies 移除(即使 future 已 done)。"""
        bus = AgentMessageBus()
        bus.register("a1")
        bus.register("a2")
        loop = asyncio.get_running_loop()
        future: asyncio.Future[AgentMessage] = loop.create_future()
        future.set_result(make_message())
        bus._pending_replies["req-x"] = future

        await bus.send(make_message(
            fromAgent="a2", toAgent="a1", type="response",
            subTaskId="req-x",
        ))
        # pop 后 _pending_replies 不再含该 key
        assert "req-x" not in bus._pending_replies


# =============================================================================
# 9. broadcast(7 tests)
# =============================================================================


class TestBroadcast:
    """send 广播分支 + broadcast 辅助方法。"""

    @pytest.mark.asyncio
    async def test_broadcast_excludes_sender(self):
        """广播排除发送者自身。"""
        bus = AgentMessageBus()
        bus.register("a1")
        bus.register("a2")
        bus.register("a3")
        await bus.send(make_message(
            fromAgent="a1", toAgent="*", type="broadcast", content="hi",
        ))
        # a1(发送者)不收到
        assert await bus.receive("a1", timeout=0.1) is None
        # a2, a3 收到
        assert await bus.receive("a2", timeout=1.0) is not None
        assert await bus.receive("a3", timeout=1.0) is not None

    @pytest.mark.asyncio
    async def test_broadcast_reaches_all_registered(self):
        """广播发给所有已注册 agent(排除发送者)。"""
        bus = AgentMessageBus()
        for name in ("a1", "a2", "a3", "a4"):
            bus.register(name)
        await bus.send(make_message(
            fromAgent="a1", toAgent="*", type="broadcast", content="hi",
        ))
        for name in ("a2", "a3", "a4"):
            msg = await bus.receive(name, timeout=1.0)
            assert msg is not None
            assert msg.content == "hi"

    @pytest.mark.asyncio
    async def test_broadcast_no_other_agents_no_error(self):
        """无其他 agent 时广播不报错。"""
        bus = AgentMessageBus()
        bus.register("a1")
        await bus.send(make_message(
            fromAgent="a1", toAgent="*", type="broadcast",
        ))
        # 无异常即通过

    @pytest.mark.asyncio
    async def test_broadcast_helper_creates_star_toAgent(self):
        """broadcast 辅助方法构造 toAgent='*' 的 broadcast 消息。"""
        bus = AgentMessageBus()
        bus.register("a1")
        bus.register("a2")
        await bus.broadcast("a1", "hello")
        msg = await bus.receive("a2", timeout=1.0)
        assert msg is not None
        assert msg.toAgent == "*"
        assert msg.type == "broadcast"
        assert msg.fromAgent == "a1"
        assert msg.content == "hello"
        assert msg.requireReply is False

    @pytest.mark.asyncio
    async def test_broadcast_helper_passes_subTaskId(self):
        """broadcast 辅助方法传递 subTaskId。"""
        bus = AgentMessageBus()
        bus.register("a1")
        bus.register("a2")
        await bus.broadcast("a1", "hello", sub_task_id="st-99")
        msg = await bus.receive("a2", timeout=1.0)
        assert msg is not None
        assert msg.subTaskId == "st-99"

    @pytest.mark.asyncio
    async def test_send_type_broadcast_triggers_broadcast_even_without_star(self):
        """type='broadcast' 但 toAgent 非 '*' → 仍走广播分支(忽略 toAgent)。

        源码条件:toAgent == "*" or type == "broadcast" → 广播。
        即 type='broadcast' 时 toAgent 字段被忽略。
        """
        bus = AgentMessageBus()
        bus.register("a1")
        bus.register("a2")
        bus.register("a3")
        await bus.send(make_message(
            fromAgent="a1", toAgent="a2",  # 非 '*'
            type="broadcast", content="hi",
        ))
        # a2 和 a3 都收到(广播),a1 排除
        assert await bus.receive("a2", timeout=1.0) is not None
        assert await bus.receive("a3", timeout=1.0) is not None
        assert await bus.receive("a1", timeout=0.1) is None

    @pytest.mark.asyncio
    async def test_send_toAgent_star_triggers_broadcast_even_without_broadcast_type(self):
        """toAgent='*' 但 type 非 'broadcast' → 仍走广播分支。

        源码条件:toAgent == "*" or type == "broadcast" → 广播。
        即 toAgent='*' 时 type 字段不影响广播行为。
        """
        bus = AgentMessageBus()
        bus.register("a1")
        bus.register("a2")
        await bus.send(make_message(
            fromAgent="a1", toAgent="*",
            type="notification",  # 非 broadcast
        ))
        # a2 收到(广播排除 a1)
        msg = await bus.receive("a2", timeout=1.0)
        assert msg is not None
        assert msg.type == "notification"


# =============================================================================
# 10. receive(4 tests)
# =============================================================================


class TestReceive:
    """AgentMessageBus.receive 方法。"""

    @pytest.mark.asyncio
    async def test_receive_returns_message_in_order(self):
        """receive 按 FIFO 返回消息。"""
        bus = AgentMessageBus()
        bus.register("a1")
        bus.register("a2")
        await bus.send(make_message(id="m1", fromAgent="a1", toAgent="a2"))
        await bus.send(make_message(id="m2", fromAgent="a1", toAgent="a2"))
        r1 = await bus.receive("a2", timeout=1.0)
        r2 = await bus.receive("a2", timeout=1.0)
        assert r1 is not None and r1.id == "m1"
        assert r2 is not None and r2.id == "m2"

    @pytest.mark.asyncio
    async def test_receive_timeout_returns_none(self):
        """队列空 + 超时 → 返回 None。"""
        bus = AgentMessageBus()
        bus.register("a1")
        result = await bus.receive("a1", timeout=0.05)
        assert result is None

    @pytest.mark.asyncio
    async def test_receive_unregistered_returns_none(self):
        """未注册 agent → 返回 None。"""
        bus = AgentMessageBus()
        result = await bus.receive("nonexistent", timeout=0.05)
        assert result is None

    def test_receive_default_timeout_is_5_seconds(self):
        """receive 默认 timeout=5.0(签名验证,不实际等待)。"""
        import inspect
        sig = inspect.signature(AgentMessageBus.receive)
        assert sig.parameters["timeout"].default == 5.0


# =============================================================================
# 11. request_reply(7 tests)
# =============================================================================


class TestRequestReply:
    """AgentMessageBus.request_reply 异步请求-回复。"""

    @pytest.mark.asyncio
    async def test_request_reply_success(self):
        """正常请求-回复:responder 收到 request 后返回 response。"""
        bus = AgentMessageBus()
        bus.register("a1")
        bus.register("a2")

        async def responder():
            msg = await bus.receive("a2", timeout=2.0)
            assert msg is not None
            await bus.send(make_message(
                id=f"resp-{msg.id}",
                fromAgent="a2", toAgent="a1",
                type="response", content="reply",
                subTaskId=msg.id,
            ))

        task = asyncio.create_task(responder())
        result = await bus.request_reply("a1", "a2", "hello", timeout=2.0)
        await task

        assert result.type == "response"
        assert result.content == "reply"
        assert result.fromAgent == "a2"

    @pytest.mark.asyncio
    async def test_request_reply_timeout_raises_timeout_error(self):
        """超时 → 抛 TimeoutError,消息含 from/to 信息。"""
        bus = AgentMessageBus()
        bus.register("a1")
        bus.register("a2")
        with pytest.raises(TimeoutError, match="请求回复超时"):
            await bus.request_reply("a1", "a2", "hello", timeout=0.05)

    @pytest.mark.asyncio
    async def test_request_reply_generates_unique_ids(self):
        """多次 request_reply 生成不同 req_id。"""
        bus = AgentMessageBus()
        bus.register("a1")
        bus.register("a2")
        ids: set[str] = set()

        async def responder(n: int):
            msg = await bus.receive("a2", timeout=2.0)
            assert msg is not None
            ids.add(msg.id)
            await bus.send(make_message(
                fromAgent="a2", toAgent="a1",
                type="response", content=f"r{n}",
                subTaskId=msg.id,
            ))

        for i in range(3):
            task = asyncio.create_task(responder(i))
            await bus.request_reply("a1", "a2", f"req{i}", timeout=2.0)
            await task

        assert len(ids) == 3  # 3 个不同的 req_id

    @pytest.mark.asyncio
    async def test_request_reply_sets_requireReply_true(self):
        """request_reply 发送的 request 消息 requireReply=True。"""
        bus = AgentMessageBus()
        bus.register("a1")
        bus.register("a2")

        async def responder():
            msg = await bus.receive("a2", timeout=2.0)
            assert msg is not None
            assert msg.requireReply is True
            await bus.send(make_message(
                fromAgent="a2", toAgent="a1",
                type="response", content="ok",
                subTaskId=msg.id,
            ))

        task = asyncio.create_task(responder())
        await bus.request_reply("a1", "a2", "hello", timeout=2.0)
        await task

    @pytest.mark.asyncio
    async def test_request_reply_cleans_up_pending_on_timeout(self):
        """超时后从 _pending_replies 清理。"""
        bus = AgentMessageBus()
        bus.register("a1")
        bus.register("a2")
        with pytest.raises(TimeoutError):
            await bus.request_reply("a1", "a2", "hello", timeout=0.05)
        assert len(bus._pending_replies) == 0

    @pytest.mark.asyncio
    async def test_request_reply_concurrent(self):
        """并发 request_reply:每个回复匹配正确的请求。"""
        bus = AgentMessageBus()
        bus.register("a1")
        bus.register("a2")

        async def responder():
            for _ in range(3):
                msg = await bus.receive("a2", timeout=2.0)
                assert msg is not None
                await bus.send(make_message(
                    fromAgent="a2", toAgent="a1",
                    type="response", content=f"reply-{msg.id}",
                    subTaskId=msg.id,
                ))

        task = asyncio.create_task(responder())
        results = await asyncio.gather(
            bus.request_reply("a1", "a2", "r1", timeout=2.0),
            bus.request_reply("a1", "a2", "r2", timeout=2.0),
            bus.request_reply("a1", "a2", "r3", timeout=2.0),
        )
        await task

        assert len(results) == 3
        # 每个 response 的 subTaskId 唯一
        sub_task_ids = {r.subTaskId for r in results}
        assert len(sub_task_ids) == 3

    @pytest.mark.asyncio
    async def test_request_reply_to_unregistered_target_times_out(self):
        """目标未注册 → request 消息丢弃 → 超时。"""
        bus = AgentMessageBus()
        bus.register("a1")
        # a2 未注册
        with pytest.raises(TimeoutError):
            await bus.request_reply("a1", "a2", "hello", timeout=0.05)


# =============================================================================
# 12. _get_redis(6 tests)
# =============================================================================


class TestGetRedis:
    """AgentMessageBus._get_redis Redis 客户端懒加载 + 降级。"""

    @pytest.mark.asyncio
    async def test_get_redis_returns_none_when_use_redis_false(self):
        """_use_redis=False → 返回 None,不尝试连接。"""
        bus = AgentMessageBus()
        bus._use_redis = False
        bus._redis = None
        result = await bus._get_redis()
        assert result is None

    @pytest.mark.asyncio
    async def test_get_redis_returns_existing_client(self):
        """_redis 已存在 → 直接返回,不重新创建。"""
        bus = AgentMessageBus()
        existing = AsyncMock()
        bus._use_redis = True
        bus._redis = existing
        result = await bus._get_redis()
        assert result is existing

    @patch("app.services.agent_comm.aioredis")
    @pytest.mark.asyncio
    async def test_get_redis_creates_client_on_first_call(self, mock_aioredis):
        """首次调用:from_url + ping 创建客户端。"""
        mock_client = AsyncMock()
        mock_client.ping = AsyncMock()
        mock_aioredis.from_url.return_value = mock_client

        bus = AgentMessageBus()
        bus._use_redis = True
        bus._redis = None

        result = await bus._get_redis()
        assert result is mock_client
        mock_aioredis.from_url.assert_called_once_with(
            settings.redis_url, decode_responses=True,
        )
        mock_client.ping.assert_called_once()

    @patch("app.services.agent_comm.aioredis")
    @pytest.mark.asyncio
    async def test_get_redis_caches_client(self, mock_aioredis):
        """二次调用:返回缓存的客户端,不重复 from_url。"""
        mock_client = AsyncMock()
        mock_client.ping = AsyncMock()
        mock_aioredis.from_url.return_value = mock_client

        bus = AgentMessageBus()
        bus._use_redis = True
        bus._redis = None

        r1 = await bus._get_redis()
        r2 = await bus._get_redis()
        assert r1 is r2 is mock_client
        assert mock_aioredis.from_url.call_count == 1

    @patch("app.services.agent_comm.aioredis")
    @pytest.mark.asyncio
    async def test_get_redis_degrades_on_from_url_failure(self, mock_aioredis):
        """from_url 抛异常 → 降级:_use_redis=False, 返回 None。"""
        mock_aioredis.from_url.side_effect = ConnectionError("Redis down")

        bus = AgentMessageBus()
        bus._use_redis = True
        bus._redis = None

        result = await bus._get_redis()
        assert result is None
        assert bus._use_redis is False
        assert bus._redis is None

    @patch("app.services.agent_comm.aioredis")
    @pytest.mark.asyncio
    async def test_get_redis_degrades_on_ping_failure(self, mock_aioredis):
        """ping 抛异常 → 降级:_use_redis=False, 返回 None。"""
        mock_client = AsyncMock()
        mock_client.ping = AsyncMock(side_effect=ConnectionError("ping failed"))
        mock_aioredis.from_url.return_value = mock_client

        bus = AgentMessageBus()
        bus._use_redis = True
        bus._redis = None

        result = await bus._get_redis()
        assert result is None
        assert bus._use_redis is False


# =============================================================================
# 13. AgentBlackboard(12 tests)
# =============================================================================


class TestAgentBlackboard:
    """AgentBlackboard write/read/list_entries/delete + readBy 合并。"""

    @pytest.mark.asyncio
    async def test_write_and_read_basic(self):
        """写入后读取:返回条目 + 记录 reader。"""
        bb = AgentBlackboard()
        await bb.write(make_blackboard_entry(key="foo", value="bar", writtenBy="a1"))
        result = await bb.read("foo", "a2")
        assert result is not None
        assert result.value == "bar"
        assert result.writtenBy == "a1"
        assert "a2" in result.readBy

    @pytest.mark.asyncio
    async def test_read_nonexistent_returns_none(self):
        """读取不存在的 key → None。"""
        bb = AgentBlackboard()
        assert await bb.read("missing", "a1") is None

    @pytest.mark.asyncio
    async def test_write_overwrites_existing_value(self):
        """同 key 覆盖写:value/writtenBy 更新为新值。"""
        bb = AgentBlackboard()
        await bb.write(make_blackboard_entry(key="k", value="v1", writtenBy="a1"))
        await bb.write(make_blackboard_entry(key="k", value="v2", writtenBy="a2"))
        result = await bb.read("k", "a3")
        assert result.value == "v2"
        assert result.writtenBy == "a2"

    @pytest.mark.asyncio
    async def test_write_preserves_readBy_history(self):
        """覆盖写时保留已有 readBy 历史。"""
        bb = AgentBlackboard()
        await bb.write(make_blackboard_entry(key="k", value="v1", writtenBy="a1"))
        await bb.read("k", "reader1")
        await bb.write(make_blackboard_entry(key="k", value="v2", writtenBy="a2"))
        result = await bb.read("k", "reader2")
        assert "reader1" in result.readBy
        assert "reader2" in result.readBy

    @pytest.mark.asyncio
    async def test_write_merges_readBy_from_entry_and_history(self):
        """新 entry 自带 readBy + 历史 readBy 合并(去重)。"""
        bb = AgentBlackboard()
        await bb.write(make_blackboard_entry(key="k", value="v1", writtenBy="a1", readBy=["r1"]))
        await bb.read("k", "r2")  # 历史 readBy = ["r1", "r2"]
        await bb.write(make_blackboard_entry(key="k", value="v2", writtenBy="a2", readBy=["r3"]))
        result = await bb.read("k", "r4")
        assert {"r1", "r2", "r3", "r4"}.issubset(set(result.readBy))

    @pytest.mark.asyncio
    async def test_read_records_reader(self):
        """read 记录 reader 到 readBy。"""
        bb = AgentBlackboard()
        await bb.write(make_blackboard_entry(key="k", value="v", writtenBy="a1"))
        await bb.read("k", "reader1")
        result = await bb.read("k", "reader2")
        assert "reader1" in result.readBy
        assert "reader2" in result.readBy

    @pytest.mark.asyncio
    async def test_read_does_not_duplicate_reader(self):
        """同一 reader 多次读 → readBy 不重复。"""
        bb = AgentBlackboard()
        await bb.write(make_blackboard_entry(key="k", value="v", writtenBy="a1"))
        await bb.read("k", "reader1")
        await bb.read("k", "reader1")
        result = await bb.read("k", "reader1")
        assert result.readBy.count("reader1") == 1

    @pytest.mark.asyncio
    async def test_list_entries_all(self):
        """list_entries 无过滤 → 返回全部。"""
        bb = AgentBlackboard()
        await bb.write(make_blackboard_entry(id="e1", key="k1", value="v1", writtenBy="a1"))
        await bb.write(make_blackboard_entry(id="e2", key="k2", value="v2", writtenBy="a1"))
        entries = await bb.list_entries()
        assert len(entries) == 2
        assert {e.key for e in entries} == {"k1", "k2"}

    @pytest.mark.asyncio
    async def test_list_entries_filter_by_subTaskId(self):
        """list_entries 按 subTaskId 过滤。"""
        bb = AgentBlackboard()
        await bb.write(make_blackboard_entry(id="e1", key="k1", value="v1", writtenBy="a1", subTaskId="st1"))
        await bb.write(make_blackboard_entry(id="e2", key="k2", value="v2", writtenBy="a1", subTaskId="st2"))
        entries = await bb.list_entries(sub_task_id="st1")
        assert len(entries) == 1
        assert entries[0].key == "k1"

    @pytest.mark.asyncio
    async def test_list_entries_empty(self):
        """空黑板 → list_entries 返回空列表。"""
        bb = AgentBlackboard()
        assert await bb.list_entries() == []

    @pytest.mark.asyncio
    async def test_delete_existing_returns_true_and_removes(self):
        """删除已有 key → True,之后读不到。"""
        bb = AgentBlackboard()
        await bb.write(make_blackboard_entry(key="k", value="v", writtenBy="a1"))
        assert await bb.delete("k") is True
        assert await bb.read("k", "a1") is None

    @pytest.mark.asyncio
    async def test_delete_nonexistent_returns_false(self):
        """删除不存在的 key → False。"""
        bb = AgentBlackboard()
        assert await bb.delete("missing") is False

    @pytest.mark.asyncio
    async def test_different_keys_independent(self):
        """不同 key 互不干扰(命名空间隔离通过 key 区分)。"""
        bb = AgentBlackboard()
        await bb.write(make_blackboard_entry(key="a1:foo", value="v1", writtenBy="a1"))
        await bb.write(make_blackboard_entry(key="a2:foo", value="v2", writtenBy="a2"))
        r1 = await bb.read("a1:foo", "a1")
        r2 = await bb.read("a2:foo", "a1")
        assert r1.value == "v1"
        assert r2.value == "v2"
        assert r1.writtenBy == "a1"
        assert r2.writtenBy == "a2"


# =============================================================================
# 14. 模块级单例(4 tests)
# =============================================================================


class TestSingletons:
    """模块级单例 agent_message_bus / agent_blackboard。"""

    def test_agent_message_bus_exists(self):
        """agent_message_bus 单例存在。"""
        assert agent_message_bus is not None

    def test_agent_message_bus_is_instance(self):
        """agent_message_bus 是 AgentMessageBus 实例。"""
        assert isinstance(agent_message_bus, AgentMessageBus)

    def test_agent_blackboard_exists(self):
        """agent_blackboard 单例存在。"""
        assert agent_blackboard is not None

    def test_agent_blackboard_is_instance(self):
        """agent_blackboard 是 AgentBlackboard 实例。"""
        assert isinstance(agent_blackboard, AgentBlackboard)


# =============================================================================
# 15. 边界(5 tests)
# =============================================================================


class TestEdgeCases:
    """边界条件:空值 / 无效类型 / 并发。"""

    @pytest.mark.asyncio
    async def test_empty_content_message(self):
        """空 content 消息可正常发送和接收。"""
        bus = AgentMessageBus()
        bus.register("a1")
        bus.register("a2")
        await bus.send(make_message(fromAgent="a1", toAgent="a2", content=""))
        received = await bus.receive("a2", timeout=1.0)
        assert received is not None
        assert received.content == ""

    @pytest.mark.asyncio
    async def test_empty_fromAgent_message(self):
        """空 fromAgent 消息可正常发送(源码不校验 fromAgent)。"""
        bus = AgentMessageBus()
        bus.register("a1")
        bus.register("a2")
        await bus.send(make_message(fromAgent="", toAgent="a2"))
        received = await bus.receive("a2", timeout=1.0)
        assert received is not None
        assert received.fromAgent == ""

    def test_invalid_type_message_runtime_not_enforced(self):
        """Literal 类型不在运行时强制,任意字符串可构造。"""
        msg = AgentMessage(
            id="m1",
            fromAgent="a1",
            toAgent="a2",
            type="invalid_type",  # type: ignore[arg-type]
            content="hello",
        )
        assert msg.type == "invalid_type"
        assert msg.to_dict()["type"] == "invalid_type"

    @pytest.mark.asyncio
    async def test_concurrent_send_to_same_agent(self):
        """并发发送多条消息到同一 agent → 全部入队。"""
        bus = AgentMessageBus()
        bus.register("a1")
        bus.register("a2")

        await asyncio.gather(*[
            bus.send(make_message(id=f"m{i}", fromAgent="a1", toAgent="a2", content=f"c{i}"))
            for i in range(5)
        ])

        received_ids: set[str] = set()
        for _ in range(5):
            msg = await bus.receive("a2", timeout=1.0)
            assert msg is not None
            received_ids.add(msg.id)
        assert received_ids == {f"m{i}" for i in range(5)}

    @pytest.mark.asyncio
    async def test_broadcast_delivers_same_message_to_all(self):
        """广播:所有目标 agent 收到同一条消息对象(内容一致)。"""
        bus = AgentMessageBus()
        for name in ("a1", "a2", "a3"):
            bus.register(name)
        await bus.broadcast("a1", "broadcast content", sub_task_id="st-bc")

        for name in ("a2", "a3"):
            msg = await bus.receive(name, timeout=1.0)
            assert msg is not None
            assert msg.content == "broadcast content"
            assert msg.subTaskId == "st-bc"
            assert msg.fromAgent == "a1"
            assert msg.toAgent == "*"
            assert msg.type == "broadcast"
