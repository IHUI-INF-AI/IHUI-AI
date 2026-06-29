"""Bug-191: 补偿任务调度.

失败/超时的业务操作挂到补偿队列, 调度器按策略重试或人工介入.
"""

import enum
import threading
import time
import uuid
from collections.abc import Callable
from dataclasses import dataclass, field


class CompState(enum.StrEnum):
    PENDING = "PENDING"
    RUNNING = "RUNNING"
    SUCCESS = "SUCCESS"
    FAILED = "FAILED"
    DEAD = "DEAD"


@dataclass
class CompTask:
    task_id: str
    name: str
    payload: object
    state: CompState = CompState.PENDING
    attempts: int = 0
    max_attempts: int = 5
    next_run_ts: float = field(default_factory=time.time)
    last_error: str = ""
    created_ts: float = field(default_factory=time.time)


class CompensationScheduler:
    """补偿调度: 队列 + 退避 + 死信."""

    def __init__(self, base_delay_sec: float = 1.0, max_delay_sec: float = 60.0):
        self.base = base_delay_sec
        self.max = max_delay_sec
        self._lock = threading.Lock()
        self._tasks: dict[str, CompTask] = {}
        self._stats = {"enqueued": 0, "success": 0, "dead": 0, "running": 0}

    def enqueue(self, name: str, payload: object, max_attempts: int = 5) -> CompTask:
        t = CompTask(task_id=uuid.uuid4().hex, name=name, payload=payload, max_attempts=max_attempts)
        with self._lock:
            self._tasks[t.task_id] = t
            self._stats["enqueued"] += 1
        return t

    def _backoff(self, attempt: int) -> float:
        return min(self.max, self.base * (2 ** (attempt - 1)))

    def run_ready(self, fn: Callable[[CompTask], None]) -> int:
        now = time.time()
        ran = 0
        with self._lock:
            ready = [t for t in self._tasks.values() if t.state == CompState.PENDING and t.next_run_ts <= now]
        for t in ready:
            with self._lock:
                t.state = CompState.RUNNING
                t.attempts += 1
                self._stats["running"] += 1
            try:
                fn(t)
                with self._lock:
                    t.state = CompState.SUCCESS
                    self._stats["success"] += 1
                    self._stats["running"] -= 1
                ran += 1
            except Exception as e:
                with self._lock:
                    t.last_error = f"{type(e).__name__}: {e}"
                    self._stats["running"] -= 1
                    if t.attempts >= t.max_attempts:
                        t.state = CompState.DEAD
                        self._stats["dead"] += 1
                    else:
                        t.state = CompState.PENDING
                        t.next_run_ts = time.time() + self._backoff(t.attempts)
        return ran

    def dead(self) -> list[CompTask]:
        with self._lock:
            return [t for t in self._tasks.values() if t.state == CompState.DEAD]

    def stats(self) -> dict[str, int]:
        with self._lock:
            return dict(self._stats)
