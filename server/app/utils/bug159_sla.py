"""Bug-159: SLA 计算.

可用性 / 错误预算 / burn-rate:
- 滑动窗口 (1h / 24h / 7d)
- 多窗口多阈值 (Google SRE multi-window)
"""

import threading
import time
from collections import deque
from dataclasses import dataclass, field


@dataclass
class SLATarget:
    name: str
    slo: float = 0.999  # 99.9%
    window_sec: int = 30 * 24 * 3600  # 30 天


@dataclass
class CallRecord:
    ok: bool
    ts: float = field(default_factory=time.time)


class SLACalculator:
    """SLA 计算器: 多窗口 + 错误预算 + burn-rate."""

    def __init__(self, target: SLATarget | None = None):
        self.target = target or SLATarget(name="default")
        self._lock = threading.Lock()
        self._records: deque[CallRecord] = deque(maxlen=200_000)
        # 多窗口 1h / 6h / 24h / 3d
        self._short: deque[CallRecord] = deque()
        self._mid: deque[CallRecord] = deque()
        self._long: deque[CallRecord] = deque()

    def record(self, ok: bool, ts: float | None = None) -> None:
        ts = ts or time.time()
        rec = CallRecord(ok=ok, ts=ts)
        with self._lock:
            self._records.append(rec)
            self._trim(self._short, ts, 3600)
            self._trim(self._mid, ts, 6 * 3600)
            self._trim(self._long, ts, 24 * 3600)
            self._short.append(rec)
            self._mid.append(rec)
            self._long.append(rec)

    @staticmethod
    def _trim(q: deque[CallRecord], now: float, window: int) -> None:
        limit = now - window
        while q and q[0].ts < limit:
            q.popleft()

    @staticmethod
    def _rate(q: deque[CallRecord]) -> tuple[int, int]:
        total = len(q)
        err = sum(1 for r in q if not r.ok)
        return total, err

    def availability(self, window: str = "24h") -> float:
        with self._lock:
            if window == "1h":
                q = list(self._short)
            elif window == "6h":
                q = list(self._mid)
            elif window == "24h":
                q = list(self._long)
            else:
                q = list(self._records)
        if not q:
            return 1.0
        err = sum(1 for r in q if not r.ok)
        return 1.0 - err / len(q)

    def error_budget_remaining(self, window: str = "30d") -> float:
        slo = self.target.slo
        avail = self.availability("24h")
        # 错误预算 = 1 - SLO, 已消耗 = 1 - 当前可用率
        budget_total = 1.0 - slo
        used = max(0.0, slo - avail)
        return max(0.0, 1.0 - used / budget_total) if budget_total > 0 else 0.0

    def burn_rate(self, window: str = "1h") -> float:
        slo = self.target.slo
        avail = self.availability(window)
        if slo >= 1.0:
            return 0.0
        err_rate = 1.0 - avail
        budget_rate = 1.0 - slo
        return err_rate / budget_rate if budget_rate > 0 else 0.0

    def stats(self) -> dict[str, object]:
        with self._lock:
            total = len(self._records)
            err = sum(1 for r in self._records if not r.ok)
        return {
            "total": total,
            "errors": err,
            "slo": self.target.slo,
            "avail_1h": self.availability("1h"),
            "avail_24h": self.availability("24h"),
            "burn_rate_1h": self.burn_rate("1h"),
            "burn_rate_24h": self.burn_rate("24h"),
        }
