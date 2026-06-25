"""Bug-161: 告警去重聚合.

对相同 fingerprint + 维度的告警在窗口内合并,
发出 N 条原始告警, 接收方看到 1 条聚合告警 + 计数.
"""

import hashlib
import logging
import threading
import time
from collections import deque
from collections.abc import Callable
from dataclasses import dataclass, field

logger = logging.getLogger(__name__)


@dataclass
class AlertItem:
    fp: str
    severity: str
    labels: dict[str, str]
    msg: str
    ts: float = field(default_factory=time.time)


@dataclass
class AggregatedAlert:
    fp: str
    severity: str
    count: int
    first_ts: float
    last_ts: float
    sample_msg: str
    labels: dict[str, str]


class AlertConfig:
    window_sec: int = 60
    max_count: int = 1000
    same_severity_only: bool = True


class AlertDeduplicator:
    """告警去重聚合器: 相同 fp+labels 在窗口内合并."""

    def __init__(
        self, config: AlertConfig | None = None, on_emit: Callable[[AggregatedAlert], None] | None = None
    ):
        self.config = config or AlertConfig()
        self._lock = threading.Lock()
        self._buckets: dict[str, AggregatedAlert] = {}
        self._emitted: deque[AggregatedAlert] = deque(maxlen=self.config.max_count)
        self._on_emit = on_emit

    @staticmethod
    def fingerprint(severity: str, labels: dict[str, str], msg: str) -> str:
        key = f"{severity}|{sorted(labels.items())}|{msg[:64]}"
        return hashlib.md5(key.encode("utf-8")).hexdigest()[:16]

    def push(self, severity: str, labels: dict[str, str], msg: str) -> AggregatedAlert:
        fp = self.fingerprint(severity, labels, msg)
        now = time.time()
        with self._lock:
            self._cleanup_locked(now)
            a = self._buckets.get(fp)
            if a is None:
                a = AggregatedAlert(
                    fp=fp,
                    severity=severity,
                    count=0,
                    first_ts=now,
                    last_ts=now,
                    sample_msg=msg,
                    labels=dict(labels),
                )
                self._buckets[fp] = a
            else:
                if self.config.same_severity_only and a.severity != severity:
                    a.severity = severity
                a.last_ts = now
            a.count += 1
            self._emitted.append(a)
            cb = self._on_emit or None
        if cb:
            try:
                cb(a)
            except Exception as e:
                logger.debug("告警去重 emit 回调失败: %s", e)  # intentionally ignored
        return a

    def _cleanup_locked(self, now: float) -> None:
        limit = now - self.config.window_sec
        dead = [k for k, v in self._buckets.items() if v.last_ts < limit]
        for k in dead:
            del self._buckets[k]

    def force_flush(self) -> list[AggregatedAlert]:
        with self._lock:
            out = list(self._buckets.values())
            self._buckets.clear()
        return out

    def stats(self) -> dict[str, int]:
        with self._lock:
            return {
                "active_buckets": len(self._buckets),
                "total_emitted": len(self._emitted),
            }
