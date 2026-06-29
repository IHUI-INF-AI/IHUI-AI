"""Bug-166: 异步任务幂等.

任务执行前注册 (idempotency_key), 执行完成后固化结果;
重放相同 key 时直接返回原结果.
"""

import enum
import threading
import time
from collections.abc import Callable
from dataclasses import dataclass


class TaskState(enum.StrEnum):
    PENDING = "PENDING"
    RUNNING = "RUNNING"
    SUCCESS = "SUCCESS"
    FAILED = "FAILED"
    DUPLICATE = "DUPLICATE"


@dataclass
class TaskResult:
    state: TaskState
    value: object = None
    error: str = ""
    started_ts: float = 0.0
    finished_ts: float = 0.0
    attempts: int = 0


@dataclass
class TaskConfig:
    ttl_sec: int = 24 * 3600
    max_concurrent: int = 1000
    fail_open_on_error: bool = True


class IdempotentTaskRunner:
    """幂等任务执行器: key 去重 + 结果固化 + 过期."""

    def __init__(self, config: TaskConfig | None = None):
        self.config = config or TaskConfig()
        self._lock = threading.Lock()
        self._results: dict[str, tuple[TaskResult, float]] = {}
        self._inflight: dict[str, float] = {}

    def _evict(self, now: float) -> None:
        with self._lock:
            limit = now - self.config.ttl_sec
            dead = [k for k, (_, ts) in self._results.items() if ts < limit]
            for k in dead:
                del self._results[k]

    def run(self, key: str, fn: Callable[[], object], reentrant: bool = False) -> TaskResult:
        now = time.time()
        self._evict(now)
        with self._lock:
            if key in self._results and not reentrant:
                res, _ = self._results[key]
                if res.state in (TaskState.SUCCESS, TaskState.FAILED):
                    res.state = TaskState.DUPLICATE
                    return res
            if key in self._inflight:
                return TaskResult(state=TaskState.RUNNING, error="inflight")
            self._inflight[key] = now
        started = time.time()
        _attempts = 0
        value = None
        err = ""
        try:
            value = fn()
            res = TaskResult(
                state=TaskState.SUCCESS,
                value=value,
                started_ts=started,
                finished_ts=time.time(),
                attempts=1,
            )
        except Exception as e:
            err = str(e)
            res = TaskResult(
                state=TaskState.FAILED,
                error=err,
                started_ts=started,
                finished_ts=time.time(),
                attempts=1,
            )
        with self._lock:
            self._inflight.pop(key, None)
            self._results[key] = (res, time.time())
        return res

    def get(self, key: str) -> TaskResult | None:
        with self._lock:
            v = self._results.get(key)
            return v[0] if v else None

    def stats(self) -> dict[str, int]:
        with self._lock:
            return {
                "cached": len(self._results),
                "inflight": len(self._inflight),
            }
