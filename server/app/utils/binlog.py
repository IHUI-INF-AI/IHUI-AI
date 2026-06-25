"""Bug-195: binlog 订阅.

模拟 binlog 位置 + 位点回溯 + checkpoint.
支持: position 推进 / 重放 / 过滤表.
"""

import threading
import time
from collections import deque
from dataclasses import dataclass, field


@dataclass
class BinlogEvent:
    pos: int
    table: str
    action: str  # INSERT / UPDATE / DELETE
    pk: str
    data: dict
    ts: float = field(default_factory=time.time)


class BinlogSubscriber:
    """binlog 订阅器: 位置推进 + 过滤 + checkpoint."""

    def __init__(self):
        self._lock = threading.Lock()
        self._events: deque[BinlogEvent] = deque()
        self._pos = 0
        self._checkpoint = 0
        self._tables_filter: set = set()
        self._stats = {"produced": 0, "consumed": 0, "filtered": 0}

    def filter(self, tables: list[str]) -> None:
        with self._lock:
            self._tables_filter = set(tables)

    def produce(self, table: str, action: str, pk: str, data: dict) -> BinlogEvent:
        with self._lock:
            self._pos += 1
            ev = BinlogEvent(pos=self._pos, table=table, action=action, pk=pk, data=data)
            if self._tables_filter and table not in self._tables_filter:
                self._stats["filtered"] += 1
                return ev
            self._events.append(ev)
            self._stats["produced"] += 1
        return ev

    def consume(self, from_pos: int = 0) -> list[BinlogEvent]:
        with self._lock:
            evs = [e for e in self._events if e.pos > from_pos]
            self._stats["consumed"] += len(evs)
        return evs

    def checkpoint(self) -> int:
        with self._lock:
            self._checkpoint = self._pos
            return self._checkpoint

    def replay_from(self, pos: int) -> list[BinlogEvent]:
        with self._lock:
            return [e for e in self._events if e.pos > pos]

    def stats(self) -> dict[str, int]:
        with self._lock:
            return {**self._stats, "pos": self._pos, "checkpoint": self._checkpoint}
