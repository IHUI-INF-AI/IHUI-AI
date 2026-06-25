"""Bug-165: 死信队列.

任务反复失败超过阈值后进入死信, 不再消耗重试资源;
提供重投 / 丢弃 / 导出接口.
"""

import enum
import json
import threading
import time
from collections.abc import Callable
from dataclasses import dataclass, field


class DLQAction(enum.StrEnum):
    REPLAY = "REPLAY"
    DROP = "DROP"
    QUARANTINE = "QUARANTINE"


@dataclass
class DeadLetter:
    task_id: str
    name: str
    payload: object
    last_error: str
    attempts: int
    first_ts: float
    last_ts: float
    history: list[str] = field(default_factory=list)


@dataclass
class DLQConfig:
    max_attempts: int = 5
    max_size: int = 10_000
    retention_sec: int = 7 * 24 * 3600


class DeadLetterQueue:
    """死信队列: 阈值进入, 增删查, 重投."""

    def __init__(self, config: DLQConfig | None = None, replay: Callable[[DeadLetter], bool] | None = None):
        self.config = config or DLQConfig()
        self._replay = replay
        self._lock = threading.Lock()
        self._items: dict[str, DeadLetter] = {}

    def push(self, task_id: str, name: str, payload: object, err: str, attempts: int) -> DeadLetter | None:
        if attempts < self.config.max_attempts:
            return None
        with self._lock:
            item = self._items.get(task_id)
            now = time.time()
            if item is None:
                item = DeadLetter(
                    task_id=task_id,
                    name=name,
                    payload=payload,
                    last_error=err,
                    attempts=attempts,
                    first_ts=now,
                    last_ts=now,
                    history=[err],
                )
                self._items[task_id] = item
            else:
                item.attempts = attempts
                item.last_error = err
                item.last_ts = now
                item.history.append(err)
                if len(item.history) > 50:
                    item.history = item.history[-50:]
            self._evict_locked(now)
            return item

    def _evict_locked(self, now: float) -> None:
        limit = now - self.config.retention_sec
        dead = [k for k, v in self._items.items() if v.last_ts < limit]
        for k in dead:
            del self._items[k]
        if len(self._items) <= self.config.max_size:
            return
        oldest = sorted(self._items.items(), key=lambda kv: kv[1].first_ts)
        for k, _ in oldest[: len(self._items) - self.config.max_size]:
            del self._items[k]

    def get(self, task_id: str) -> DeadLetter | None:
        with self._lock:
            return self._items.get(task_id)

    def list(self, limit: int = 100) -> list[DeadLetter]:
        with self._lock:
            return list(self._items.values())[:limit]

    def remove(self, task_id: str) -> bool:
        with self._lock:
            return self._items.pop(task_id, None) is not None

    def replay(self, task_id: str) -> DLQAction:
        with self._lock:
            item = self._items.get(task_id)
            if item is None:
                return DLQAction.DROP
            if not self._replay:
                return DLQAction.QUARANTINE
        try:
            ok = self._replay(item)
        except Exception:
            ok = False
        if ok:
            with self._lock:
                self._items.pop(task_id, None)
            return DLQAction.REPLAY
        return DLQAction.QUARANTINE

    def export_json(self) -> str:
        with self._lock:
            return json.dumps(
                [
                    {
                        "task_id": i.task_id,
                        "name": i.name,
                        "attempts": i.attempts,
                        "first_ts": i.first_ts,
                        "last_ts": i.last_ts,
                        "last_error": i.last_error,
                    }
                    for i in self._items.values()
                ],
                ensure_ascii=False,
            )

    def stats(self) -> dict[str, int]:
        with self._lock:
            return {"size": len(self._items)}
