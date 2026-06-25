"""异步任务去重器(Bug-129)
同 key 任务合并 + 状态共享 + 回调通知 + TTL过期
"""

from __future__ import annotations

import hashlib
import json
import logging
import threading
import time
import uuid
from collections.abc import Callable
from dataclasses import dataclass, field
from enum import StrEnum
from typing import Any

logger = logging.getLogger(__name__)


class DedupTaskState(StrEnum):
    PENDING = "PENDING"
    RUNNING = "RUNNING"
    SUCCESS = "SUCCESS"
    FAILED = "FAILED"
    CANCELLED = "CANCELLED"
    MERGED = "MERGED"
    EXPIRED = "EXPIRED"


@dataclass
class DedupTask:
    task_id: str
    dedup_key: str
    payload: Any = None
    state: DedupTaskState = DedupTaskState.PENDING
    result: Any = None
    error: str | None = None
    created_at: float = field(default_factory=time.time)
    started_at: float = 0.0
    finished_at: float = 0.0
    expires_at: float = 0.0
    owner: str = ""
    merged_into: str | None = None
    waiters: list[str] = field(default_factory=list)
    tags: dict[str, str] = field(default_factory=dict)

    def duration_ms(self) -> float:
        if self.started_at <= 0:
            return 0.0
        end = self.finished_at if self.finished_at > 0 else time.time()
        return (end - self.started_at) * 1000.0

    def is_terminal(self) -> bool:
        return self.state in (
            DedupTaskState.SUCCESS,
            DedupTaskState.FAILED,
            DedupTaskState.CANCELLED,
            DedupTaskState.EXPIRED,
            DedupTaskState.MERGED,
        )

    def is_expired(self) -> bool:
        return self.expires_at > 0 and time.time() > self.expires_at


def compute_dedup_key(scope: str, fingerprint: Any) -> str:
    if isinstance(fingerprint, str):
        raw = fingerprint
    else:
        raw = json.dumps(fingerprint, sort_keys=True, ensure_ascii=False, default=str)
    return hashlib.sha256(f"{scope}|{raw}".encode()).hexdigest()[:32]


@dataclass
class DedupConfig:
    default_ttl: float = 600.0
    result_ttl: float = 300.0
    max_tasks: int = 10000
    auto_expire: bool = True
    expire_interval: float = 30.0


Callback = Callable[[DedupTask], None]


class TaskDeduper:
    """异步任务去重器
    用法:
        d = TaskDeduper()
        t = d.submit("order", {"oid": 1})  # 新建
        t2 = d.submit("order", {"oid": 1})  # 合并到 t
        d.start(t.task_id)
        d.complete(t.task_id, result=...)
        t3 = d.get("order", {"oid": 1})  # 拿结果
    """

    def __init__(self, config: DedupConfig | None = None) -> None:
        self.config = config or DedupConfig()
        self._tasks: dict[str, DedupTask] = {}
        self._by_key: dict[str, str] = {}
        self._lock = threading.RLock()
        self._callbacks: list[Callback] = []
        self._last_expire = time.time()

    def add_callback(self, cb: Callback) -> None:
        with self._lock:
            self._callbacks.append(cb)

    def _now(self) -> float:
        return time.time()

    def _purge_expired(self) -> None:
        if not self.config.auto_expire:
            return
        now = self._now()
        if now - self._last_expire < self.config.expire_interval:
            return
        self._last_expire = now
        with self._lock:
            expired_keys = [k for k, t in self._tasks.items() if t.is_expired()]
            for tid in expired_keys:
                t = self._tasks.pop(tid, None)
                if t is None:
                    continue
                t.state = DedupTaskState.EXPIRED
                if self._by_key.get(t.dedup_key) == tid:
                    self._by_key.pop(t.dedup_key, None)
                if len(self._tasks) > self.config.max_tasks:
                    break

    def _emit(self, task: DedupTask) -> None:
        for cb in list(self._callbacks):
            try:
                cb(task)
            except Exception as e:
                logger.debug("任务去重回调失败: %s", e)  # intentionally ignored

    def submit(
        self,
        scope: str,
        fingerprint: Any,
        payload: Any = None,
        owner: str = "",
        ttl: float | None = None,
        tags: dict[str, str] | None = None,
    ) -> DedupTask:
        self._purge_expired()
        key = compute_dedup_key(scope, fingerprint)
        with self._lock:
            existing_id = self._by_key.get(key)
            if existing_id:
                existing = self._tasks.get(existing_id)
                if existing is not None and not existing.is_expired() and not existing.is_terminal():
                    tid = f"wait-{uuid.uuid4().hex[:8]}"
                    merged = DedupTask(
                        task_id=tid,
                        dedup_key=key,
                        payload=payload,
                        state=DedupTaskState.MERGED,
                        owner=owner,
                        expires_at=self._now() + (ttl or self.config.default_ttl),
                        merged_into=existing_id,
                        tags=tags or {},
                    )
                    self._tasks[tid] = merged
                    existing.waiters.append(tid)
                    return merged
                if existing is not None and not existing.is_expired() and existing.is_terminal():
                    return existing
            tid = f"task-{uuid.uuid4().hex[:12]}"
            task = DedupTask(
                task_id=tid,
                dedup_key=key,
                payload=payload,
                state=DedupTaskState.PENDING,
                owner=owner,
                expires_at=self._now() + (ttl or self.config.default_ttl),
                tags=tags or {},
            )
            self._tasks[tid] = task
            self._by_key[key] = tid
            return task

    def get(self, scope: str, fingerprint: Any) -> DedupTask | None:
        key = compute_dedup_key(scope, fingerprint)
        with self._lock:
            tid = self._by_key.get(key)
            if not tid:
                return None
            t = self._tasks.get(tid)
            if t is None or t.is_expired():
                return None
            return t

    def get_by_id(self, task_id: str) -> DedupTask | None:
        with self._lock:
            return self._tasks.get(task_id)

    def start(self, task_id: str) -> bool:
        with self._lock:
            t = self._tasks.get(task_id)
            if t is None or t.is_terminal():
                return False
            t.state = DedupTaskState.RUNNING
            t.started_at = self._now()
            self._emit(t)
            return True

    def complete(self, task_id: str, result: Any = None) -> bool:
        with self._lock:
            t = self._tasks.get(task_id)
            if t is None or t.is_terminal():
                return False
            t.state = DedupTaskState.SUCCESS
            t.result = result
            t.finished_at = self._now()
            t.expires_at = max(t.expires_at, self._now() + self.config.result_ttl)
            self._emit(t)
            return True

    def fail(self, task_id: str, error: str) -> bool:
        with self._lock:
            t = self._tasks.get(task_id)
            if t is None or t.is_terminal():
                return False
            t.state = DedupTaskState.FAILED
            t.error = error
            t.finished_at = self._now()
            t.expires_at = max(t.expires_at, self._now() + self.config.result_ttl)
            self._emit(t)
            return True

    def cancel(self, task_id: str) -> bool:
        with self._lock:
            t = self._tasks.get(task_id)
            if t is None or t.is_terminal():
                return False
            t.state = DedupTaskState.CANCELLED
            t.finished_at = self._now()
            self._emit(t)
            return True

    def wait_for_result(self, task_id: str, timeout: float = 30.0, poll_interval: float = 0.05) -> DedupTask | None:
        start = self._now()
        while self._now() - start < timeout:
            t = self.get_by_id(task_id)
            if t is None:
                return None
            if t.is_terminal() and t.state != DedupTaskState.MERGED:
                return t
            if t.state == DedupTaskState.MERGED and t.merged_into:
                return self.wait_for_result(t.merged_into, timeout - (self._now() - start), poll_interval)
            time.sleep(poll_interval)
        return self.get_by_id(task_id)

    def list_active(self) -> list[DedupTask]:
        with self._lock:
            return [t for t in self._tasks.values() if not t.is_terminal() and not t.is_expired()]

    def list_by_state(self, state: DedupTaskState) -> list[DedupTask]:
        with self._lock:
            return [t for t in self._tasks.values() if t.state == state]

    def list_merged(self) -> list[DedupTask]:
        with self._lock:
            return [t for t in self._tasks.values() if t.state == DedupTaskState.MERGED]

    def force_expire(self, task_id: str) -> bool:
        with self._lock:
            t = self._tasks.pop(task_id, None)
            if t is None:
                return False
            t.state = DedupTaskState.EXPIRED
            if self._by_key.get(t.dedup_key) == task_id:
                self._by_key.pop(t.dedup_key, None)
            return True

    def stats(self) -> dict[str, Any]:
        with self._lock:
            return {
                "total": len(self._tasks),
                "by_state": {s.value: sum(1 for t in self._tasks.values() if t.state == s) for s in DedupTaskState},
                "merged": sum(1 for t in self._tasks.values() if t.state == DedupTaskState.MERGED),
                "active_keys": len(self._by_key),
            }
