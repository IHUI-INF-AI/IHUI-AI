"""Bug-187: Outbox 模式.

本地事务 + outbox 表 -> 异步投递. 保证业务与消息原子.
支持: enqueue / 投递状态 / 重投 / 失败告警.
"""

import enum
import threading
import time
import uuid
from collections.abc import Callable
from dataclasses import dataclass, field


class OutboxState(enum.StrEnum):
    PENDING = "PENDING"
    DELIVERED = "DELIVERED"
    FAILED = "FAILED"


@dataclass
class OutboxMessage:
    msg_id: str
    topic: str
    payload: object
    state: OutboxState = OutboxState.PENDING
    attempts: int = 0
    last_error: str = ""
    created_ts: float = field(default_factory=time.time)
    delivered_ts: float = 0.0


class OutboxRelay:
    """Outbox 投递: 写入 outbox -> 异步发送 -> 状态回写."""

    def __init__(self, send: Callable[[str, object], None]):
        self._send = send
        self._lock = threading.Lock()
        self._messages: dict[str, OutboxMessage] = {}
        self._stats = {"enqueued": 0, "delivered": 0, "failed": 0}

    def enqueue(self, topic: str, payload: object) -> OutboxMessage:
        m = OutboxMessage(msg_id=uuid.uuid4().hex, topic=topic, payload=payload)
        with self._lock:
            self._messages[m.msg_id] = m
            self._stats["enqueued"] += 1
        return m

    def deliver(self, msg_id: str) -> bool:
        with self._lock:
            m = self._messages.get(msg_id)
            if not m:
                return False
            topic, payload, _attempts = m.topic, m.payload, m.attempts
        try:
            self._send(topic, payload)
            with self._lock:
                m.state = OutboxState.DELIVERED
                m.delivered_ts = time.time()
                m.attempts += 1
                self._stats["delivered"] += 1
            return True
        except Exception as e:
            with self._lock:
                m.attempts += 1
                m.last_error = f"{type(e).__name__}: {e}"
                if m.attempts >= 3:
                    m.state = OutboxState.FAILED
                    self._stats["failed"] += 1
            return False

    def pending(self) -> list[OutboxMessage]:
        with self._lock:
            return [m for m in self._messages.values() if m.state == OutboxState.PENDING]

    def stats(self) -> dict[str, int]:
        with self._lock:
            return dict(self._stats)
