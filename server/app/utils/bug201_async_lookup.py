"""Bug-201: 异步回查.

异步任务执行后, 提供"回查"接口供外部确认状态.
支持: pending / success / failed / timeout 四态.
"""

import enum
import threading
import time
import uuid
from dataclasses import dataclass
from typing import Any


class AsyncState(enum.StrEnum):
    PENDING = "PENDING"
    RUNNING = "RUNNING"
    SUCCESS = "SUCCESS"
    FAILED = "FAILED"
    TIMEOUT = "TIMEOUT"


@dataclass
class AsyncTask:
    task_id: str
    name: str
    payload: Any
    state: AsyncState = AsyncState.PENDING
    result: Any = None
    error: str = ""
    started_ts: float = 0.0
    finished_ts: float = 0.0
    timeout_sec: float = 30.0


class AsyncLookup:
    """异步任务 + 回查接口."""

    def __init__(self):
        self._lock = threading.Lock()
        self._tasks: dict[str, AsyncTask] = {}

    def create(self, name: str, payload: Any, timeout_sec: float = 30.0) -> AsyncTask:
        t = AsyncTask(task_id=uuid.uuid4().hex, name=name, payload=payload, timeout_sec=timeout_sec)
        with self._lock:
            self._tasks[t.task_id] = t
        return t

    def start(self, task_id: str) -> bool:
        with self._lock:
            t = self._tasks.get(task_id)
            if not t or t.state != AsyncState.PENDING:
                return False
            t.state = AsyncState.RUNNING
            t.started_ts = time.time()
            return True

    def complete(self, task_id: str, result: Any = None, error: str = "") -> None:
        with self._lock:
            t = self._tasks.get(task_id)
            if not t:
                return
            t.finished_ts = time.time()
            t.result = result
            if error:
                t.state = AsyncState.FAILED
                t.error = error
            else:
                t.state = AsyncState.SUCCESS

    def lookup(self, task_id: str) -> AsyncTask | None:
        with self._lock:
            t = self._tasks.get(task_id)
            if not t:
                return None
            # 检查超时
            if t.state == AsyncState.RUNNING and (time.time() - t.started_ts) > t.timeout_sec:
                t.state = AsyncState.TIMEOUT
            return t

    def expire(self) -> int:
        """扫描超时任务, 标记 TIMEOUT."""
        n = 0
        with self._lock:
            now = time.time()
            for t in self._tasks.values():
                if t.state == AsyncState.RUNNING and (now - t.started_ts) > t.timeout_sec:
                    t.state = AsyncState.TIMEOUT
                    n += 1
        return n

    def stats(self) -> dict[str, int]:
        with self._lock:
            return {
                "total": len(self._tasks),
                "running": sum(1 for t in self._tasks.values() if t.state == AsyncState.RUNNING),
                "success": sum(1 for t in self._tasks.values() if t.state == AsyncState.SUCCESS),
                "failed": sum(1 for t in self._tasks.values() if t.state == AsyncState.FAILED),
                "timeout": sum(1 for t in self._tasks.values() if t.state == AsyncState.TIMEOUT),
            }
