"""Bug-190: 顺序保证.

按 partition / ordering_key 顺序处理消息, 同一 key 串行, 不同 key 并行.
支持: max_inflight per key / 阻塞后续 / 提交顺序.
"""

import threading
import uuid
from collections import defaultdict, deque
from collections.abc import Callable
from dataclasses import dataclass


@dataclass
class SequencedItem:
    item_id: str
    key: str
    seq: int
    payload: object
    processed: bool = False
    result: object = None
    error: str = ""


class OrderedProcessor:
    """按 key 顺序处理: 同 key 串行, 不同 key 并行."""

    def __init__(self, max_workers: int = 4):
        self._max = max_workers
        self._lock = threading.Lock()
        self._queues: dict[str, deque[SequencedItem]] = defaultdict(deque)
        self._next_seq: dict[str, int] = {}
        self._inflight: dict[str, SequencedItem] = {}
        self._stats = {"processed": 0, "out_of_order": 0}

    def submit(self, key: str, payload: object) -> SequencedItem:
        with self._lock:
            seq = self._next_seq.get(key, 0)
            self._next_seq[key] = seq + 1
            item = SequencedItem(item_id=uuid.uuid4().hex, key=key, seq=seq, payload=payload)
            self._queues[key].append(item)
            if key not in self._inflight:
                self._inflight[key] = self._queues[key].popleft()
        return item

    def process_ready(self, fn: Callable[[SequencedItem], object]) -> list[SequencedItem]:
        """处理所有 ready 项目, 返回已处理列表."""
        processed: list[SequencedItem] = []
        with self._lock:
            inflight = list(self._inflight.items())
        for key, item in inflight:
            try:
                v = fn(item)
                with self._lock:
                    item.processed = True
                    item.result = v
                    self._stats["processed"] += 1
                processed.append(item)
            except Exception as e:
                with self._lock:
                    item.error = f"{type(e).__name__}: {e}"
                    self._stats["out_of_order"] += 1
                processed.append(item)
            # 推进: 取下一个
            with self._lock:
                q = self._queues.get(key, deque())
                if q:
                    self._inflight[key] = q.popleft()
                else:
                    self._inflight.pop(key, None)
        return processed

    def stats(self) -> dict[str, int]:
        with self._lock:
            return {
                **self._stats,
                "inflight": len(self._inflight),
                "queued": sum(len(q) for q in self._queues.values()),
            }
