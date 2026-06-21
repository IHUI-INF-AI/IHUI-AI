"""Bug-149: N+1 查询检测.

监控一批查询的"扇出比", 当 1 次主查询触发子查询次数过多时报警.
支持: 查询指纹, 阈值, 滑动窗口, 触发回调.
"""

import hashlib
import threading
import time
from collections import defaultdict, deque
from collections.abc import Callable
from dataclasses import dataclass, field


@dataclass
class N1Alert:
    fp: str
    fanout: int
    parents: int
    ratio: float
    ts: float = field(default_factory=time.time)


@dataclass
class N1Config:
    max_parents: int = 1  # 触发检测的最小父查询数
    max_fanout_ratio: float = 5.0  # 父/子比例阈值
    window_sec: int = 60  # 滑动窗口
    cooldown_sec: int = 30  # 同一指纹冷却


class N1Detector:
    """N+1 检测器: 用主查询 + 子查询配对记录."""

    def __init__(self, config: N1Config | None = None, on_alert: Callable[[N1Alert], None] | None = None):
        self.config = config or N1Config()
        self._lock = threading.Lock()
        self._parents: dict[str, deque[float]] = defaultdict(deque)
        self._children: dict[str, deque[float]] = defaultdict(deque)
        self._alerts: list[N1Alert] = []
        self._last_alert_ts: dict[str, float] = {}
        self._on_alert = on_alert

    @staticmethod
    def fingerprint(sql: str) -> str:
        # 归一化: 小写 + 标点周围加空格 + 多空白压成单空格
        import re as _re

        s = _re.sub(r"\s*([=,()?<>'\"`!])\s*", r" \1 ", sql.lower())
        s = _re.sub(r"\s+", " ", s).strip()
        return hashlib.md5(s.encode("utf-8")).hexdigest()[:12]

    def record_parent(self, fp: str, ts: float | None = None) -> None:
        ts = ts or time.time()
        with self._lock:
            self._trim(self._parents[fp], ts)
            self._parents[fp].append(ts)

    def record_child(self, fp: str, ts: float | None = None) -> None:
        ts = ts or time.time()
        with self._lock:
            self._trim(self._children[fp], ts)
            self._children[fp].append(ts)
        self._maybe_alert(fp, ts)

    def _trim(self, q: deque[float], now: float) -> None:
        limit = now - self.config.window_sec
        while q and q[0] < limit:
            q.popleft()

    def _maybe_alert(self, fp: str, ts: float) -> None:
        cfg = self.config
        with self._lock:
            if fp in self._last_alert_ts and ts - self._last_alert_ts[fp] < cfg.cooldown_sec:
                return
            parents = len(self._parents.get(fp, []))
            children = len(self._children.get(fp, []))
            if parents < cfg.max_parents or children < 1:
                return
            ratio = children / parents
            if ratio < cfg.max_fanout_ratio:
                return
            alert = N1Alert(fp=fp, fanout=children, parents=parents, ratio=ratio, ts=ts)
            self._alerts.append(alert)
            self._last_alert_ts[fp] = ts
        if self._on_alert:
            try:
                self._on_alert(alert)
            except Exception:
                pass  # intentionally ignored

    def stats(self) -> dict[str, int]:
        with self._lock:
            return {
                "tracked_parents": sum(len(v) for v in self._parents.values()),
                "tracked_children": sum(len(v) for v in self._children.values()),
                "alerts": len(self._alerts),
            }

    def recent_alerts(self, limit: int = 10) -> list[N1Alert]:
        with self._lock:
            return list(self._alerts[-limit:])
