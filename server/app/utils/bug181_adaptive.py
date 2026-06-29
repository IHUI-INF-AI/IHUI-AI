"""Bug-181: 自适应限流.

根据 P99 延迟 / 错误率 / CPU 估算自适应收紧或放松.
支持: 健康分 + 步进调整.
"""

import threading
import time
from collections import deque
from dataclasses import dataclass


@dataclass
class AdaptiveConfig:
    initial_qps: int = 100
    min_qps: int = 1
    max_qps: int = 10_000
    p99_target_ms: float = 200.0
    err_target: float = 0.01
    step_up: float = 1.1
    step_down: float = 0.7
    cooldown_sec: float = 1.0


@dataclass
class Sample:
    ts: float
    p99_ms: float
    err_rate: float


class AdaptiveLimiter:
    """自适应限流: 按 P99/错误率调整 qps 限制."""

    def __init__(self, config: AdaptiveConfig | None = None):
        self.config = config or AdaptiveConfig()
        self._lock = threading.Lock()
        self._qps = float(self.config.initial_qps)
        self._last_adjust: float = 0
        self._samples: deque[Sample] = deque(maxlen=120)
        self._allowed = 0
        self._denied = 0
        self._window_start = time.time()
        self._window_count = 0

    def report(self, p99_ms: float, err_rate: float) -> None:
        cfg = self.config
        with self._lock:
            self._samples.append(Sample(ts=time.time(), p99_ms=p99_ms, err_rate=err_rate))
            if time.time() - self._last_adjust < cfg.cooldown_sec:
                return
            if not self._samples:
                return
            recent = list(self._samples)[-10:]
            avg_p99 = sum(s.p99_ms for s in recent) / len(recent)
            avg_err = sum(s.err_rate for s in recent) / len(recent)
            if avg_p99 > cfg.p99_target_ms or avg_err > cfg.err_target:
                self._qps = max(cfg.min_qps, self._qps * cfg.step_down)
            else:
                self._qps = min(cfg.max_qps, self._qps * cfg.step_up)
            self._last_adjust = time.time()

    def acquire(self) -> bool:
        now = time.time()
        with self._lock:
            if now - self._window_start >= 1.0:
                self._window_start = now
                self._window_count = 0
            if self._window_count < self._qps:
                self._window_count += 1
                self._allowed += 1
                return True
            self._denied += 1
            return False

    def stats(self) -> dict[str, object]:
        with self._lock:
            return {"qps": self._qps, "allowed": self._allowed, "denied": self._denied, "samples": len(self._samples)}
