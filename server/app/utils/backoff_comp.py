"""Bug-193: 退避补偿.

按指数退避 + 抖动调度补偿任务, 避免雪崩.
支持: 多阶段退避 (immediate / linear / exp) + jitter.
"""

import random
import threading
import time
import uuid
from collections.abc import Callable
from dataclasses import dataclass, field


@dataclass
class BackoffTask:
    task_id: str
    name: str
    payload: object
    fn: Callable[[object], None]
    attempts: int = 0
    next_run: float = field(default_factory=time.time)
    last_error: str = ""
    state: str = "PENDING"  # PENDING / DONE / DEAD


@dataclass
class BackoffConfig:
    base_ms: int = 100
    max_ms: int = 60_000
    jitter_pct: float = 0.2
    max_attempts: int = 5


class BackoffCompensator:
    """退避调度: base * 2^n + jitter, 超过 max_attempts 进 DEAD."""

    def __init__(self, config: BackoffConfig | None = None):
        self.config = config or BackoffConfig()
        self._lock = threading.Lock()
        self._tasks: dict[str, BackoffTask] = {}
        self._rand = random.Random()
        self._stats = {"scheduled": 0, "done": 0, "dead": 0}

    def schedule(self, name: str, payload: object, fn: Callable[[object], None]) -> BackoffTask:
        t = BackoffTask(task_id=uuid.uuid4().hex, name=name, payload=payload, fn=fn)
        with self._lock:
            self._tasks[t.task_id] = t
            self._stats["scheduled"] += 1
        return t

    def _delay(self, attempt: int) -> int:
        cfg = self.config
        d = min(cfg.max_ms, cfg.base_ms * (2 ** (attempt - 1)))
        delta = int(d * cfg.jitter_pct)
        return d + self._rand.randint(-delta, delta)

    def tick(self) -> int:
        ran = 0
        now = time.time()
        with self._lock:
            ready = [t for t in self._tasks.values() if t.state == "PENDING" and t.next_run <= now]
        for t in ready:
            t.attempts += 1
            try:
                t.fn(t.payload)
                t.state = "DONE"
                with self._lock:
                    self._stats["done"] += 1
                ran += 1
            except Exception as e:
                t.last_error = f"{type(e).__name__}: {e}"
                if t.attempts >= self.config.max_attempts:
                    t.state = "DEAD"
                    with self._lock:
                        self._stats["dead"] += 1
                else:
                    t.next_run = time.time() + self._delay(t.attempts) / 1000
        return ran

    def stats(self) -> dict[str, int]:
        with self._lock:
            return dict(self._stats)
