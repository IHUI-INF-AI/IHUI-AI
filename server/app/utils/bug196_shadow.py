"""Bug-196: 影子表 + 双写校验.

写入主表 + 影子表, 异步校验两边数据一致性,
不一致进 reconciler 队列, 提示修复.
"""

import threading
import time
from collections import deque
from dataclasses import dataclass, field
from typing import Any


@dataclass
class Diff:
    pk: str
    field: str
    main: Any
    shadow: Any
    ts: float = field(default_factory=time.time)


class ShadowTable:
    """影子表: 双写 + 校验 + diff 队列."""

    def __init__(self):
        self._lock = threading.Lock()
        self._main: dict[str, dict[str, Any]] = {}
        self._shadow: dict[str, dict[str, Any]] = {}
        self._diffs: deque[Diff] = deque(maxlen=1000)
        self._stats = {"writes": 0, "matches": 0, "diffs": 0}

    def write(self, pk: str, row: dict[str, Any]) -> None:
        with self._lock:
            self._main[pk] = dict(row)
            self._shadow[pk] = dict(row)
            self._stats["writes"] += 1

    def verify(self, pk: str) -> list[Diff]:
        with self._lock:
            m = self._main.get(pk)
            s = self._shadow.get(pk)
            if m is None and s is None:
                return []
            if m is None or s is None:
                d = Diff(pk=pk, field="__exists__", main=bool(m), shadow=bool(s))
                self._diffs.append(d)
                self._stats["diffs"] += 1
                return [d]
            diffs: list[Diff] = []
            keys = set(m.keys()) | set(s.keys())
            for k in keys:
                if m.get(k) != s.get(k):
                    d = Diff(pk=pk, field=k, main=m.get(k), shadow=s.get(k))
                    self._diffs.append(d)
                    diffs.append(d)
            if diffs:
                self._stats["diffs"] += 1
            else:
                self._stats["matches"] += 1
            return diffs

    def diffs_snapshot(self, limit: int = 50) -> list[Diff]:
        with self._lock:
            return list(self._diffs)[-limit:]

    def reconcile(self, pk: str, prefer_main: bool = True) -> dict[str, Any]:
        """修复策略: prefer_main=True 用主表覆盖影子, 反之亦然."""
        with self._lock:
            m = self._main.get(pk)
            s = self._shadow.get(pk)
        if m is None and s is None:
            return {}
        truth = m if prefer_main else s
        with self._lock:
            self._main[pk] = dict(truth)
            self._shadow[pk] = dict(truth)
        return dict(truth)

    def stats(self) -> dict[str, int]:
        with self._lock:
            return dict(self._stats)
