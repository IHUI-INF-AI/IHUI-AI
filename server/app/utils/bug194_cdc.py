"""Bug-194: CDC (Change Data Capture).

跟踪表数据变更, 推送给订阅者.
支持: insert / update / delete 三种事件 + 订阅者注册.
"""

import enum
import threading
import time
import uuid
from collections import deque
from collections.abc import Callable
from dataclasses import dataclass, field
from typing import Any


class CDCEventType(enum.StrEnum):
    INSERT = "INSERT"
    UPDATE = "UPDATE"
    DELETE = "DELETE"


@dataclass
class CDCEvent:
    event_id: str
    table: str
    pk: str
    type: CDCEventType
    before: dict[str, Any] | None = None
    after: dict[str, Any] | None = None
    ts: float = field(default_factory=time.time)


class CDCBus:
    """CDC 总线: 事件发布 + 订阅者消费 + 投递确认."""

    def __init__(self, max_buffer: int = 1000):
        self._max = max_buffer
        self._lock = threading.Lock()
        self._buffer: deque[CDCEvent] = deque(maxlen=max_buffer)
        self._subscribers: dict[str, list[Callable[[CDCEvent], None]]] = {}
        self._stats = {"published": 0, "delivered": 0, "dropped": 0}

    def publish(
        self,
        table: str,
        pk: str,
        type: CDCEventType,
        before: dict[str, Any] | None = None,
        after: dict[str, Any] | None = None,
    ) -> CDCEvent:
        ev = CDCEvent(event_id=uuid.uuid4().hex, table=table, pk=pk, type=type, before=before, after=after)
        with self._lock:
            self._buffer.append(ev)
            self._stats["published"] += 1
            subs = list(self._subscribers.get(table, [])) + list(self._subscribers.get("*", []))
        for fn in subs:
            try:
                fn(ev)
                with self._lock:
                    self._stats["delivered"] += 1
            except Exception:
                with self._lock:
                    self._stats["dropped"] += 1
        return ev

    def subscribe(self, table: str, fn: Callable[[CDCEvent], None]) -> None:
        with self._lock:
            self._subscribers.setdefault(table, []).append(fn)

    def events(self, limit: int = 50) -> list[CDCEvent]:
        with self._lock:
            return list(self._buffer)[-limit:]

    def stats(self) -> dict[str, int]:
        with self._lock:
            return dict(self._stats)
