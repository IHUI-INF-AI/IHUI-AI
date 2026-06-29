"""Bug-154: GC 压力监控.

跟踪 Python gc 行为, 当 pause 累计/对象代数/手动 collect 频率
异常时, 提供软告警.
"""

import gc
import threading
import time
from collections import deque
from dataclasses import dataclass, field


@dataclass
class GCSample:
    gen0: int
    gen1: int
    gen2: int
    threshold: tuple
    obj_count: int
    ts: float = field(default_factory=time.time)


@dataclass
class GCPressureConfig:
    sample_window: int = 30
    obj_growth_warn: int = 50_000  # 窗口内对象增长
    collect_freq_warn_per_sec: float = 5.0


class GCPressureMonitor:
    """GC 压力监控: 统计 gen0/1/2 阈值 + 手动 collect 频率."""

    def __init__(self, config: GCPressureConfig | None = None):
        self.config = config or GCPressureConfig()
        self._lock = threading.Lock()
        self._samples: deque[GCSample] = deque(maxlen=self.config.sample_window)
        self._collect_ts: deque[float] = deque(maxlen=200)
        self._alerts: list[str] = []
        gc.callbacks.append(self._on_gc) if hasattr(gc, "callbacks") else None

    def _on_gc(self, phase, info):
        if phase == "stop":
            with self._lock:
                self._collect_ts.append(time.time())

    def snapshot(self) -> GCSample:
        s = GCSample(
            gen0=gc.get_count()[0],
            gen1=gc.get_count()[1],
            gen2=gc.get_count()[2],
            threshold=gc.get_threshold(),
            obj_count=len(gc.get_objects()),
        )
        with self._lock:
            self._samples.append(s)
            self._check()
        return s

    def _collect_freq(self) -> float:
        if len(self._collect_ts) < 2:
            return 0.0
        span = self._collect_ts[-1] - self._collect_ts[0]
        if span <= 0:
            return 0.0
        return (len(self._collect_ts) - 1) / span

    def _check(self) -> None:
        if len(self._samples) < self.config.sample_window:
            return
        first = self._samples[0]
        last = self._samples[-1]
        growth = last.obj_count - first.obj_count
        freq = self._collect_freq()
        if growth >= self.config.obj_growth_warn:
            self._alerts.append(f"obj growth +{growth} in window")
        if freq >= self.config.collect_freq_warn_per_sec:
            self._alerts.append(f"gc freq {freq:.2f}/s")
        if len(self._alerts) > 50:
            self._alerts = self._alerts[-50:]

    def force_collect(self) -> dict[str, int]:
        before = len(gc.get_objects())
        collected = gc.collect()
        after = len(gc.get_objects())
        return {"before": before, "after": after, "collected": collected}

    def stats(self) -> dict[str, object]:
        with self._lock:
            return {
                "samples": len(self._samples),
                "alerts": len(self._alerts),
                "collect_freq": self._collect_freq(),
                "last_obj": self._samples[-1].obj_count if self._samples else 0,
            }
