"""Agent 通信机制(P3-3)。

对标 Hermes Agent 的 agent 间通信能力:
1. AgentMessageBus:消息总线(点对点 / 广播 / 请求-回复)
2. AgentBlackboard:共享黑板(agent 间共享上下文)

设计原则:
- 内存队列优先,Redis 可选(与 memory.py 同模式,降级容错)
- request_reply 用 Future + correlationId 实现异步等待
- 广播只发给已注册的 agent(排除发送者自身)
"""

from __future__ import annotations

import asyncio
import logging
import uuid
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any, Literal

from ..core.config import settings

logger = logging.getLogger(__name__)

# redis 包未安装时降级为纯内存模式(与 memory.py 同模式)
try:
    import redis.asyncio as aioredis
except ImportError:  # pragma: no cover
    aioredis = None  # type: ignore[assignment]

# 类型别名(对齐 packages/types/src/agent-runtime.ts P3-3 契约)
AgentMessageType = Literal["request", "response", "notification", "broadcast", "handoff"]


@dataclass
class AgentMessage:
    """Agent 间通信消息。"""

    id: str
    fromAgent: str
    toAgent: str  # broadcast 时为 "*"
    type: AgentMessageType
    content: str
    subTaskId: str | None = None
    timestamp: str = ""
    requireReply: bool = False

    def __post_init__(self) -> None:
        if not self.timestamp:
            self.timestamp = datetime.now(timezone.utc).isoformat()

    def to_dict(self) -> dict[str, Any]:
        return {
            "id": self.id,
            "fromAgent": self.fromAgent,
            "toAgent": self.toAgent,
            "type": self.type,
            "content": self.content,
            "subTaskId": self.subTaskId,
            "timestamp": self.timestamp,
            "requireReply": self.requireReply,
        }


@dataclass
class BlackboardEntry:
    """共享黑板条目。"""

    id: str
    key: str
    value: str
    writtenBy: str
    subTaskId: str | None = None
    timestamp: str = ""
    readBy: list[str] = field(default_factory=list)

    def __post_init__(self) -> None:
        if not self.timestamp:
            self.timestamp = datetime.now(timezone.utc).isoformat()

    def to_dict(self) -> dict[str, Any]:
        return {
            "id": self.id,
            "key": self.key,
            "value": self.value,
            "writtenBy": self.writtenBy,
            "subTaskId": self.subTaskId,
            "timestamp": self.timestamp,
            "readBy": self.readBy,
        }


class AgentMessageBus:
    """Agent 消息总线。

    内存队列优先,Redis 可选(配置 redis_url 时启用跨进程通信)。
    request_reply 约定:response 消息的 subTaskId 字段携带原 request 消息的 id,
    用于关联请求与响应。
    """

    def __init__(self) -> None:
        # 每个 agent 一个独立队列
        self._queues: dict[str, asyncio.Queue[AgentMessage]] = {}
        self._registered: set[str] = set()
        # 请求-回复 correlation:request.id -> Future
        self._pending_replies: dict[str, asyncio.Future[AgentMessage]] = {}
        # Redis(可选)
        self._redis: Any = None
        self._use_redis = bool(getattr(settings, "redis_url", None)) and aioredis is not None

    def register(self, agent_name: str) -> None:
        """注册 agent(创建专属队列)。"""
        if agent_name not in self._queues:
            self._queues[agent_name] = asyncio.Queue()
        self._registered.add(agent_name)

    def unregister(self, agent_name: str) -> None:
        """注销 agent。"""
        self._queues.pop(agent_name, None)
        self._registered.discard(agent_name)

    @property
    def registered_agents(self) -> list[str]:
        return sorted(self._registered)

    async def _get_redis(self) -> Any:
        """获取 Redis 客户端,连接失败时降级为内存模式。"""
        if self._redis is None and self._use_redis:
            try:
                self._redis = aioredis.from_url(
                    settings.redis_url, decode_responses=True
                )
                await self._redis.ping()
            except Exception as e:
                logger.warning("Redis 连接失败,降级为内存模式: %s", e)
                self._use_redis = False
                self._redis = None
        return self._redis

    # =========================================================================
    # 发送 / 接收
    # =========================================================================

    async def send(self, message: AgentMessage) -> None:
        """发送消息到目标 agent 的队列。

        - type=response 且 subTaskId 匹配待回复 request 时,解析 Future
        - type=broadcast 时 toAgent='*',发给所有已注册 agent(排除发送者)
        - 目标 agent 未注册时,记录警告并丢弃(不抛错)
        """
        # 响应消息:解析待回复的 request
        if message.type == "response" and message.subTaskId:
            future = self._pending_replies.pop(message.subTaskId, None)
            if future is not None and not future.done():
                future.set_result(message)
                return  # 响应直接交给请求方,不入队

        # 广播
        if message.toAgent == "*" or message.type == "broadcast":
            targets = [a for a in self._registered if a != message.fromAgent]
            for t in targets:
                q = self._queues.get(t)
                if q is not None:
                    await q.put(message)
            return

        # 点对点
        q = self._queues.get(message.toAgent)
        if q is None:
            logger.warning(
                "目标 agent 未注册,消息丢弃: to=%s, from=%s",
                message.toAgent, message.fromAgent,
            )
            return
        await q.put(message)

    async def receive(
        self, agent_name: str, timeout: float = 5.0
    ) -> AgentMessage | None:
        """接收消息(带超时)。无消息返回 None。"""
        q = self._queues.get(agent_name)
        if q is None:
            return None
        try:
            return await asyncio.wait_for(q.get(), timeout=timeout)
        except asyncio.TimeoutError:
            return None

    async def broadcast(
        self,
        from_agent: str,
        content: str,
        sub_task_id: str | None = None,
    ) -> None:
        """广播给所有已注册 agent(排除发送者)。"""
        msg = AgentMessage(
            id=f"msg-{uuid.uuid4().hex[:8]}",
            fromAgent=from_agent,
            toAgent="*",
            type="broadcast",
            content=content,
            subTaskId=sub_task_id,
        )
        await self.send(msg)

    async def request_reply(
        self,
        from_: str,
        to: str,
        content: str,
        timeout: float = 30.0,
    ) -> AgentMessage:
        """请求-回复:发送 request,等待 response。

        约定:响应方调用 send() 时,type=response,subTaskId=原 request.id。
        超时抛 TimeoutError。
        """
        req_id = f"req-{uuid.uuid4().hex[:8]}"
        loop = asyncio.get_running_loop()
        future: asyncio.Future[AgentMessage] = loop.create_future()
        self._pending_replies[req_id] = future

        request_msg = AgentMessage(
            id=req_id,
            fromAgent=from_,
            toAgent=to,
            type="request",
            content=content,
            requireReply=True,
        )
        await self.send(request_msg)

        try:
            return await asyncio.wait_for(future, timeout=timeout)
        except asyncio.TimeoutError:
            self._pending_replies.pop(req_id, None)
            raise TimeoutError(
                f"请求回复超时({timeout}s): from={from_}, to={to}"
            )


class AgentBlackboard:
    """共享黑板(agent 间共享上下文)。

    内存存储,key 唯一(后写覆盖前写,但保留历史 readBy)。
    """

    def __init__(self) -> None:
        self._entries: dict[str, BlackboardEntry] = {}
        self._lock = asyncio.Lock()

    async def write(self, entry: BlackboardEntry) -> None:
        """写入黑板条目(key 已存在时覆盖 value,但保留 readBy 历史)。"""
        async with self._lock:
            existing = self._entries.get(entry.key)
            if existing is not None:
                # 保留历史 reader 记录
                entry.readBy = list(set(existing.readBy + entry.readBy))
            self._entries[entry.key] = entry

    async def read(self, key: str, reader: str) -> BlackboardEntry | None:
        """读取条目并记录 reader。"""
        async with self._lock:
            entry = self._entries.get(key)
            if entry is None:
                return None
            if reader not in entry.readBy:
                entry.readBy.append(reader)
            return entry

    async def list_entries(
        self, sub_task_id: str | None = None
    ) -> list[BlackboardEntry]:
        """列出条目(sub_task_id 过滤,为 None 时返回全部)。"""
        async with self._lock:
            entries = list(self._entries.values())
        if sub_task_id is not None:
            entries = [e for e in entries if e.subTaskId == sub_task_id]
        return entries

    async def delete(self, key: str) -> bool:
        """删除条目。返回是否成功。"""
        async with self._lock:
            return self._entries.pop(key, None) is not None


# 模块级单例
agent_message_bus = AgentMessageBus()
agent_blackboard = AgentBlackboard()
