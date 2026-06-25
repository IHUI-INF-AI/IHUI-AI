"""Bug-197: 乐观锁.

基于 version 字段的 CAS 更新, 失败重试到 max_attempts.
"""

import threading
from collections.abc import Callable
from dataclasses import dataclass
from typing import Any


@dataclass
class OptimisticRecord:
    key: str
    value: Any
    version: int = 0


class OptimisticLock:
    """乐观锁: read version -> check -> write with version+1."""

    def __init__(self, max_attempts: int = 3):
        self.max = max_attempts
        self._lock = threading.Lock()
        self._store: dict[str, OptimisticRecord] = {}
        self._stats = {"success": 0, "conflict": 0}

    def get(self, key: str) -> OptimisticRecord | None:
        with self._lock:
            return self._store.get(key)

    def put(self, key: str, value: Any) -> None:
        with self._lock:
            self._store[key] = OptimisticRecord(key=key, value=value, version=0)

    def cas(self, key: str, expected_version: int, mutator: Callable[[Any], Any]) -> tuple[bool, int]:
        for attempt in range(1, self.max + 1):
            with self._lock:
                rec = self._store.get(key)
                if rec is None:
                    self._store[key] = OptimisticRecord(key=key, value=mutator(None), version=1)
                    self._stats["success"] += 1
                    return True, 1
                if rec.version != expected_version:
                    self._stats["conflict"] += 1
                    if attempt >= self.max:
                        return False, rec.version
                    continue
                new_val = mutator(rec.value)
                rec.value = new_val
                rec.version += 1
                self._stats["success"] += 1
                return True, rec.version
        return False, -1

    def stats(self) -> dict[str, int]:
        with self._lock:
            return dict(self._stats)
