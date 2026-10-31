# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""Agent 通信机制(P3-3)。

对标 Hermes Agent 的 agent 间通信能力:
1. AgentMessageBus:消息总线(点对点 / 广播 / 请求-回复)
2. AgentBlackboard:共享黑板(agent 间共享上下文)
3. 点名投递服务层(send_to_agent / read_agent_inbox / list_agent_peers):
   把"向指定同伴投递"与"按自己的名字读自己的收件箱"做成可注册成模型工具的服务出口,
   权限边界收在**会话 + 属主**两维(属主真值单源 = run_ownership)。

设计原则:
- 内存队列优先,Redis 可选(与 memory.py 同模式,降级容错)
- request_reply 用 Future + correlationId 实现异步等待
- 广播只发给已注册的 agent(排除发送者自身)
- 点名投递绝不降级成广播:收件人必须是具体名字,取不到席位就显式失败并点名
"""

from __future__ import annotations

import asyncio
import logging
import uuid
from dataclasses import dataclass, field
from datetime import UTC, datetime
from typing import Any, Literal, cast

from ..core.config import settings
from .run_ownership import owner_of, record_ownership

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
    ownerUserId: str | None = None
    sessionId: str | None = None

    def __post_init__(self) -> None:
        if not self.timestamp:
            self.timestamp = datetime.now(UTC).isoformat()

    def to_dict(self) -> dict[str, Any]:
        data: dict[str, Any] = {
            "id": self.id,
            "fromAgent": self.fromAgent,
            "toAgent": self.toAgent,
            "type": self.type,
            "content": self.content,
            "subTaskId": self.subTaskId,
            "timestamp": self.timestamp,
            "requireReply": self.requireReply,
        }
        # 身份两维只在写入时进载荷:一次改名/一次投递才带,旧消息逐键不变
        if self.ownerUserId is not None:
            data["ownerUserId"] = self.ownerUserId
        if self.sessionId is not None:
            data["sessionId"] = self.sessionId
        return data


@dataclass(frozen=True)
class AgentSeat:
    """一条"席位绑定":某个 agent 名由哪个会话、在哪个属主下认领。

    席位只记"名字 ↔ 会话"的认领关系;属主登记面仍是 run_ownership(单一真源)。
    """

    agentName: str
    sessionId: str
    ownerUserId: str
    claimedAt: str

    def to_dict(self) -> dict[str, Any]:
        return {
            "agentName": self.agentName,
            "sessionId": self.sessionId,
            "ownerUserId": self.ownerUserId,
            "claimedAt": self.claimedAt,
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
            self.timestamp = datetime.now(UTC).isoformat()

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
        # 席位绑定:agent 名 -> (会话, 属主);属主真值仍以 run_ownership 为准
        self._seats: dict[str, AgentSeat] = {}
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
        """注销 agent(连同其席位绑定一起回收,不留悬席)。"""
        self._queues.pop(agent_name, None)
        self._registered.discard(agent_name)
        self._seats.pop(agent_name, None)

    @property
    def registered_agents(self) -> list[str]:
        return sorted(self._registered)

    def is_registered(self, agent_name: str) -> bool:
        return agent_name in self._registered

    def queue_depth(self, agent_name: str) -> int | None:
        """当前队列长度;agent 未注册返回 None(与"空队列"分得开)。"""
        q = self._queues.get(agent_name)
        return None if q is None else q.qsize()

    # =========================================================================
    # 席位(点名投递与收件箱的身份边界)
    # =========================================================================

    def seat_of(self, agent_name: str) -> AgentSeat | None:
        return self._seats.get(agent_name)

    def seats(self) -> list[AgentSeat]:
        return [self._seats[name] for name in sorted(self._seats)]

    def claim_seat(
        self,
        agent_name: str,
        *,
        session_id: str,
        owner_user_id: str,
    ) -> tuple[str, AgentSeat | None]:
        """TOFU 认领席位:名字首次被哪个会话认领就归哪个会话。

        返回 (code, seat)。code: claimed / already_bound / conflict / invalid。
        conflict 时绝不覆盖既有绑定 —— 名字顶替正是"一席读别席私信"的入口。
        """
        if not agent_name or not session_id or not owner_user_id:
            return "invalid", None
        existing = self._seats.get(agent_name)
        if existing is not None:
            if existing.sessionId == session_id and existing.ownerUserId == owner_user_id:
                return "already_bound", existing
            return "conflict", existing
        seat = AgentSeat(
            agentName=agent_name,
            sessionId=session_id,
            ownerUserId=owner_user_id,
            claimedAt=datetime.now(UTC).isoformat(),
        )
        self.register(agent_name)
        self._seats[agent_name] = seat
        return "claimed", seat

    def release_seat(self, agent_name: str, *, session_id: str) -> str:
        """释放席位(仅持有者可释放)。返回 released / not_holder / unbound。"""
        seat = self._seats.get(agent_name)
        if seat is None:
            return "unbound"
        if seat.sessionId != session_id:
            return "not_holder"
        self._seats.pop(agent_name, None)
        return "released"

    async def _get_redis(self) -> Any:
        """获取 Redis 客户端,连接失败时降级为内存模式。"""
        if self._redis is None and self._use_redis:
            try:
                self._redis = aioredis.from_url(
                    settings.redis_url, decode_responses=True,
                    # protocol=2 强制 RESP2:redis-py 8.x 默认 RESP3(HELLO 3 协商),
                    # 老 Redis/Memurai 4.x 不支持会 unknown command HELLO(同 im_bridge)
                    protocol=2,
                    socket_connect_timeout=2,
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
        except TimeoutError:
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
        except TimeoutError:
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

# =============================================================================
# 点名投递服务层(可被承载层直接注册成模型工具)
# =============================================================================

# 广播别名:点名 ≠ 广播,这些收件人一律显式拒绝(降级成广播会绕过属主边界)
_BROADCAST_ALIASES = frozenset({"*", "all", "anyone", "broadcast"})
# 点名投递允许的消息类型:response 走总线 correlation 通道,不是"给某个名字投递"
_NAMABLE_MESSAGE_TYPES = frozenset({"notification", "request", "handoff"})
# 收件箱排空时单次 receive 的最短等待(0 会退化成语义未定的立即返回)
_INBOX_DRAIN_TIMEOUT_SECONDS = 0.05


def _text(value: object) -> str:
    """把承载层注入的身份值收成长字符串(空/纯空白一律归零,不做"空即公共"的假设)。"""
    if value is None:
        return ""
    return str(value).strip()


def _identity_or_error(
    session_id: str | None, user_id: str | None
) -> tuple[str, str, dict[str, Any] | None]:
    """身份只能来自承载层注入的 __session_id/__user_id;缺任一即 fail-closed。"""
    sid = _text(session_id)
    uid = _text(user_id)
    missing: list[str] = []
    if not sid:
        missing.append("__session_id")
    if not uid:
        missing.append("__user_id")
    if missing:
        return sid, uid, {
            "ok": False,
            "code": "missing_caller_identity",
            "missingKeys": missing,
            "detail": "身份必须由承载层注入,缺失时不判定投递/收件资格",
        }
    return sid, uid, None


def _bus_or_default(bus: AgentMessageBus | None) -> AgentMessageBus:
    return agent_message_bus if bus is None else bus


def _session_owner_conflict(session_id: str, user_id: str) -> bool:
    """会话在 run_ownership 里已登记为他人属主 ⇒ True(不得据此认领席位/发私信)。"""
    session_owner = owner_of(session_id)
    return session_owner is not None and session_owner != user_id


async def send_to_agent(
    *,
    recipient: str,
    content: str,
    sender: str,
    session_id: str | None = None,
    user_id: str | None = None,
    user_role: str | int | None = None,
    message_type: str = "notification",
    require_reply: bool = False,
    sub_task_id: str | None = None,
    bus: AgentMessageBus | None = None,
) -> dict[str, Any]:
    """向指定同伴代理点名投递一条消息;身份取自承载层注入的 __session_id/__user_id。

    契约:sender 必须是调用方会话自己认领(或首次认领)的席位名,recipient 必须是
    已注册且有席位的具名 agent。返回 ok=False 时消息一定没进任何队列。
    `user_role` 只作契约对齐:任何角色都不构成越席读/投他人私信的资格。
    """
    b = _bus_or_default(bus)
    sid, uid, err = _identity_or_error(session_id, user_id)
    if err is not None:
        return err

    to = _text(recipient)
    if not to:
        return {"ok": False, "code": "missing_recipient", "detail": "收件人必须是具体名字"}
    if to.lower() in _BROADCAST_ALIASES:
        return {
            "ok": False,
            "code": "broadcast_not_allowed",
            "recipient": to,
            "detail": "本出口只作点名投递;广播请走总线 broadcast",
        }
    if message_type not in _NAMABLE_MESSAGE_TYPES:
        return {"ok": False, "code": "unsupported_message_type", "messageType": message_type}
    body = _text(content)
    if not body:
        return {"ok": False, "code": "empty_content", "recipient": to}

    frm = _text(sender)
    if not frm:
        return {"ok": False, "code": "missing_sender", "detail": "发件席位名不可为空"}
    sender_seat = b.seat_of(frm)
    if sender_seat is None:
        if _session_owner_conflict(sid, uid):
            return {
                "ok": False,
                "code": "forbidden_session_owner_mismatch",
                "sender": frm,
                "sessionId": sid,
            }
        code, claimed = b.claim_seat(frm, session_id=sid, owner_user_id=uid)
        if code == "conflict" and claimed is not None:
            return {
                "ok": False,
                "code": "forbidden_sender_impersonation",
                "sender": frm,
                "boundSessionId": claimed.sessionId,
            }
        if claimed is not None:
            record_ownership(sid, uid)
            record_ownership(frm, uid)
        sender_seat = claimed
    elif sender_seat.sessionId != sid or sender_seat.ownerUserId != uid:
        return {
            "ok": False,
            "code": "forbidden_sender_impersonation",
            "sender": frm,
            "boundSessionId": sender_seat.sessionId,
        }
    if sender_seat is None:
        return {"ok": False, "code": "invalid_sender_seat", "sender": frm}

    if not b.is_registered(to):
        return {"ok": False, "code": "unregistered_recipient", "recipient": to}
    recipient_seat = b.seat_of(to)
    if recipient_seat is None:
        return {
            "ok": False,
            "code": "unbound_recipient",
            "recipient": to,
            "detail": "该名字已注册但无席位绑定,点名投递按未在场处理",
        }
    recipient_owner = owner_of(to) or recipient_seat.ownerUserId
    if recipient_owner != uid:
        return {
            "ok": False,
            "code": "forbidden_cross_owner",
            "recipient": to,
            "detail": "收件席位属他人,不得投私信",
        }

    message = AgentMessage(
        id=f"msg-{uuid.uuid4().hex[:8]}",
        fromAgent=frm,
        toAgent=to,
        type=cast("AgentMessageType", message_type),
        content=body,
        subTaskId=_text(sub_task_id) or None,
        requireReply=bool(require_reply),
        ownerUserId=uid,
        sessionId=sid,
    )
    depth_before = b.queue_depth(to)
    await b.send(message)
    depth_after = b.queue_depth(to)
    if depth_before is None or depth_after is None or depth_after <= depth_before:
        return {
            "ok": False,
            "code": "not_queued",
            "recipient": to,
            "messageId": message.id,
            "detail": "总线未把消息落进该席队列,不冒充已投递",
        }
    return {
        "ok": True,
        "code": "queued",
        "messageId": message.id,
        "fromAgent": frm,
        "toAgent": to,
        "timestamp": message.timestamp,
        "queueDepth": depth_after,
    }


async def read_agent_inbox(
    *,
    agent_name: str,
    session_id: str | None = None,
    user_id: str | None = None,
    user_role: str | int | None = None,
    limit: int = 10,
    wait_seconds: float = 0.0,
    bus: AgentMessageBus | None = None,
) -> dict[str, Any]:
    """按自己的名字读自己的收件箱(消费式读取)。

    边界 = 会话 ∧ 属主:席位绑定的会话必须等于注入的 __session_id,且
    run_ownership 查到的属主必须等于注入的 __user_id;任一不过 ⇒ 一条也不消费。
    """
    b = _bus_or_default(bus)
    sid, uid, err = _identity_or_error(session_id, user_id)
    if err is not None:
        return err
    name = _text(agent_name)
    if not name:
        return {"ok": False, "code": "missing_agent_name", "detail": "收件席位名不可为空"}
    if not b.is_registered(name):
        return {"ok": False, "code": "unregistered_agent", "agentName": name, "count": 0}

    seat = b.seat_of(name)
    if seat is None:
        return {
            "ok": False,
            "code": "unbound_agent",
            "agentName": name,
            "count": 0,
            "detail": "该名字无席位绑定,读不到属主,按未授权处理",
        }
    if seat.sessionId != sid:
        return {
            "ok": False,
            "code": "forbidden_cross_session",
            "agentName": name,
            "count": 0,
            "detail": "收件箱按会话隔离,非持有会话不得读",
        }
    owner = owner_of(name) or seat.ownerUserId
    if owner != uid:
        return {
            "ok": False,
            "code": "forbidden_cross_owner",
            "agentName": name,
            "count": 0,
            "detail": "属主不符,不得读他人私信(角色不构成豁免)",
        }

    cap = max(1, int(limit))
    first_timeout = max(wait_seconds, _INBOX_DRAIN_TIMEOUT_SECONDS)
    collected: list[dict[str, Any]] = []
    for index in range(cap):
        got = await b.receive(name, timeout=first_timeout if index == 0 else _INBOX_DRAIN_TIMEOUT_SECONDS)
        if got is None:
            break
        collected.append(got.to_dict())
    return {
        "ok": True,
        "code": "read",
        "agentName": name,
        "count": len(collected),
        "messages": collected,
        "queueDepthRemaining": b.queue_depth(name),
    }


async def list_agent_peers(
    *,
    session_id: str | None = None,
    user_id: str | None = None,
    user_role: str | int | None = None,
    bus: AgentMessageBus | None = None,
) -> dict[str, Any]:
    """列出"点名"可用的同伴席位(只列同一属主名下的席位,别人的席名不外泄)。"""
    b = _bus_or_default(bus)
    sid, uid, err = _identity_or_error(session_id, user_id)
    if err is not None:
        return err
    peers = [
        {
            "agentName": seat.agentName,
            "sessionId": seat.sessionId,
            "isSelfSession": seat.sessionId == sid,
            "queueDepth": b.queue_depth(seat.agentName),
        }
        for seat in b.seats()
        if (owner_of(seat.agentName) or seat.ownerUserId) == uid
    ]
    return {"ok": True, "code": "listed", "count": len(peers), "peers": peers}


async def claim_agent_seat(
    *,
    agent_name: str,
    session_id: str | None = None,
    user_id: str | None = None,
    user_role: str | int | None = None,
    bus: AgentMessageBus | None = None,
) -> dict[str, Any]:
    """显式认领席位(send_to_agent 会首次隐式认领;广播式协作前建议先显式认领)。

    认领时同步把 session_id → user_id 写进 run_ownership(属主唯一真源),
    若该会话已登记为他人属主则拒绝,避免把别人的会话认领成自己的席位。
    """
    b = _bus_or_default(bus)
    sid, uid, err = _identity_or_error(session_id, user_id)
    if err is not None:
        return err
    name = _text(agent_name)
    if not name:
        return {"ok": False, "code": "missing_agent_name"}

    if _session_owner_conflict(sid, uid):
        return {
            "ok": False,
            "code": "forbidden_session_owner_mismatch",
            "agentName": name,
            "detail": "该会话已登记为他人属主,不得据此认领席位",
        }
    code, seat = b.claim_seat(name, session_id=sid, owner_user_id=uid)
    if code == "conflict" and seat is not None:
        return {
            "ok": False,
            "code": "seat_owned_by_other_session",
            "agentName": name,
            "boundSessionId": seat.sessionId,
        }
    if seat is None:
        return {"ok": False, "code": "invalid_seat", "agentName": name}
    record_ownership(sid, uid)
    record_ownership(name, uid)
    return {
        "ok": True,
        "code": code,
        "agentName": name,
        "sessionId": sid,
        "ownerUserId": uid,
        "claimedAt": seat.claimedAt,
    }


async def release_agent_seat(
    *,
    agent_name: str,
    session_id: str | None = None,
    user_id: str | None = None,
    user_role: str | int | None = None,
    bus: AgentMessageBus | None = None,
    unregister: bool = False,
) -> dict[str, Any]:
    """释放席位;unregister=True 时连队列一起摘(会话收尾用)。"""
    b = _bus_or_default(bus)
    sid, uid, err = _identity_or_error(session_id, user_id)
    if err is not None:
        return err
    name = _text(agent_name)
    seat = b.seat_of(name)
    if seat is None:
        return {"ok": True, "code": "unbound", "agentName": name}
    if seat.sessionId != sid or (owner_of(name) or seat.ownerUserId) != uid:
        return {"ok": False, "code": "forbidden_not_holder", "agentName": name}
    code = b.release_seat(name, session_id=sid)
    if unregister:
        b.unregister(name)
    return {"ok": code == "released", "code": code, "agentName": name}

# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
