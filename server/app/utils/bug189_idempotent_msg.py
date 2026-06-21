"""Bug-189: 幂等消息.

消息携带 idempotency_key, 消费端按 key 去重.
支持: 成功态固化 / 失败重试 / 失败态保留供人工.
"""

import enum
import threading
import time
from collections.abc import Callable
from dataclasses import dataclass, field


class MsgState(enum.StrEnum):
    PENDING = "PENDING"
    SUCCESS = "SUCCESS"
    FAILED = "FAILED"


@dataclass
class IdempotencyEntry:
    key: str
    state: MsgState
    attempts: int
    result: object = None
    last_error: str = ""
    created_ts: float = field(default_factory=time.time)
    finished_ts: float = 0.0


class IdempotentConsumer:
    """幂等消费: 同 key 只执行 1 次, 失败可重试."""

    def __init__(self, max_attempts: int = 3):
        self.max_attempts = max_attempts
        self._lock = threading.Lock()
        self._entries: dict[str, IdempotencyEntry] = {}
        self._stats = {"processed": 0, "deduped": 0, "failed": 0}

    def process(self, key: str, fn: Callable[[], object]) -> tuple[MsgState, object]:
        with self._lock:
            e = self._entries.get(key)
            if e and e.state == MsgState.SUCCESS:
                self._stats["deduped"] += 1
                return (MsgState.SUCCESS, e.result)
            if e is None:
                e = IdempotencyEntry(key=key, state=MsgState.PENDING, attempts=0)
                self._entries[key] = e
            e.attempts += 1
            if e.attempts > self.max_attempts:
                e.state = MsgState.FAILED
                e.last_error = "max attempts"
                self._stats["failed"] += 1
                return (MsgState.FAILED, e.last_error)
        try:
            v = fn()
            with self._lock:
                e.state = MsgState.SUCCESS
                e.result = v
                e.finished_ts = time.time()
                self._stats["processed"] += 1
            return (MsgState.SUCCESS, v)
        except Exception as exc:
            with self._lock:
                e.last_error = f"{type(exc).__name__}: {exc}"
            return (MsgState.PENDING, e.last_error)

    def get(self, key: str) -> IdempotencyEntry | None:
        with self._lock:
            return self._entries.get(key)

    def stats(self) -> dict[str, int]:
        with self._lock:
            return dict(self._stats)
