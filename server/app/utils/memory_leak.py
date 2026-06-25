"""Bug-153: 内存泄漏检测.

通过 sys.gettotalrefcount 近似 + tracemalloc 持续采样,
对分配/释放差分做报警.
"""

import gc
import threading
import time
import tracemalloc
from collections import deque
from dataclasses import dataclass, field


@dataclass
class MemSample:
    rss_kb: int
    py_alloc_kb: int
    py_peak_kb: int
    obj_count: int
    ts: float = field(default_factory=time.time)


@dataclass
class LeakConfig:
    sample_window: int = 30  # 采样数
    growth_threshold: float = 1.5  # 窗口内分配峰值 / 起值
    min_growth_kb: int = 1024  # 至少增长这么多才报警
    sample_interval_sec: float = 1.0


class MemoryLeakDetector:
    """内存泄漏检测器: 持续 tracemalloc 采样 + 增长率告警."""

    def __init__(self, config: LeakConfig | None = None):
        self.config = config or LeakConfig()
        self._lock = threading.Lock()
        self._samples: deque[MemSample] = deque(maxlen=self.config.sample_window)
        self._alerts: list[str] = []
        self._running = False
        self._thread: threading.Thread | None = None
        if not tracemalloc.is_tracing():
            tracemalloc.start(25)

    def _take_sample(self) -> MemSample:
        cur, peak = tracemalloc.get_traced_memory()
        gc.collect()
        obj = len(gc.get_objects())
        # 简单 RSS 估算: psutil 没有就用 0
        rss = 0
        try:
            import psutil

            rss = int(psutil.Process().memory_info().rss / 1024)
        except Exception:
            rss = int(cur / 1024)
        return MemSample(
            rss_kb=rss,
            py_alloc_kb=int(cur / 1024),
            py_peak_kb=int(peak / 1024),
            obj_count=obj,
        )

    def start(self) -> None:
        with self._lock:
            if self._running:
                return
            self._running = True
        self._thread = threading.Thread(target=self._loop, daemon=True, name="leak-detector")
        self._thread.start()

    def stop(self) -> None:
        with self._lock:
            self._running = False

    def _loop(self) -> None:
        while True:
            with self._lock:
                if not self._running:
                    return
            self.snapshot()
            time.sleep(self.config.sample_interval_sec)

    def snapshot(self) -> MemSample:
        s = self._take_sample()
        with self._lock:
            self._samples.append(s)
            self._check_alert()
        return s

    def _check_alert(self) -> None:
        if len(self._samples) < self.config.sample_window:
            return
        first = self._samples[0]
        peak = max(self._samples, key=lambda s: s.py_alloc_kb)
        growth = peak.py_alloc_kb - first.py_alloc_kb
        if growth < self.config.min_growth_kb:
            return
        ratio = peak.py_alloc_kb / max(1, first.py_alloc_kb)
        if ratio < self.config.growth_threshold:
            return
        msg = (
            f"memory leak suspected: rss={peak.rss_kb}kb "
            f"alloc={peak.py_alloc_kb}kb +{growth}kb "
            f"obj={peak.obj_count}"
        )
        self._alerts.append(msg)
        if len(self._alerts) > 50:
            self._alerts = self._alerts[-50:]

    def stats(self) -> dict[str, object]:
        with self._lock:
            return {
                "samples": len(self._samples),
                "alerts": len(self._alerts),
                "last": self._samples[-1].__dict__ if self._samples else None,
                "running": self._running,
            }
