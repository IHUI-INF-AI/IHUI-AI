"""Bug-102: 熔断器指标集成.

设计:
  - 状态机: CLOSED -> OPEN -> HALF_OPEN -> CLOSED/OPEN
  - 滑动窗口统计: 错误率 / 慢调用率
  - 集成 prometheus_client (可选) 输出 metric
  - 历史轨迹 (最近 N 次状态切换) 用于排障
  - 支持手动 force_open / force_close
"""

import logging
import threading
import time
from collections import deque
from dataclasses import dataclass
from enum import StrEnum

logger = logging.getLogger(__name__)


class CbState(StrEnum):
    CLOSED = "closed"
    OPEN = "open"
    HALF_OPEN = "half_open"


@dataclass
class StateTransition:
    frm: str
    to: str
    ts: float
    reason: str


@dataclass
class CbConfig:
    window_size: int = 20  # 滑动窗口大小 (最近 N 次调用)
    error_rate_threshold: float = 0.5  # 错误率阈值
    min_calls: int = 5  # 最少调用次数才评估
    open_duration_sec: float = 5.0  # open 状态保持时间
    half_open_max_calls: int = 3  # half_open 探测次数
    slow_threshold_sec: float = 2.0  # 慢调用阈值


class CbMetrics:
    """带指标的熔断器."""

    def __init__(self, name: str = "default", config: CbConfig | None = None):
        self.name = name
        self._cfg = config or CbConfig()
        self._lock = threading.Lock()
        self._state: CbState = CbState.CLOSED
        self._window: deque[tuple[bool, float]] = deque(maxlen=self._cfg.window_size)
        self._open_since: float = 0.0
        self._half_open_calls: int = 0
        self._history: deque[StateTransition] = deque(maxlen=100)
        # 统计
        self._total_calls = 0
        self._total_success = 0
        self._total_failed = 0
        self._total_rejected = 0
        self._total_slow = 0
        self._state_entered_at = time.time()

    def _transition(self, to: CbState, reason: str) -> None:
        if self._state == to:
            return
        self._history.append(StateTransition(self._state.value, to.value, time.time(), reason))
        self._state = to
        self._state_entered_at = time.time()
        logger.info("cb[%s] state %s -> %s reason=%s", self.name, self._state.value, to.value, reason)

    def allow(self) -> bool:
        """询问是否允许调用."""
        with self._lock:
            now = time.time()
            if self._state == CbState.CLOSED:
                return True
            if self._state == CbState.OPEN:
                if now - self._open_since >= self._cfg.open_duration_sec:
                    self._half_open_calls = 0
                    self._transition(CbState.HALF_OPEN, "open_timeout")
                    return True
                return False
            # HALF_OPEN
            return not self._half_open_calls >= self._cfg.half_open_max_calls

    def record(self, success: bool, duration_sec: float) -> None:
        with self._lock:
            self._total_calls += 1
            if success:
                self._total_success += 1
            else:
                self._total_failed += 1
            if duration_sec >= self._cfg.slow_threshold_sec:
                self._total_slow += 1
            self._window.append((success, duration_sec))
            if self._state == CbState.HALF_OPEN:
                self._half_open_calls += 1
                if not success:
                    self._open_since = time.time()
                    self._transition(CbState.OPEN, "half_open_failed")
                    return
                if self._half_open_calls >= self._cfg.half_open_max_calls:
                    self._transition(CbState.CLOSED, "half_open_recovered")
                return
            # CLOSED -> OPEN 评估
            if self._state == CbState.CLOSED and len(self._window) >= self._cfg.min_calls:
                err_rate = sum(1 for s, _ in self._window if not s) / len(self._window)
                if err_rate >= self._cfg.error_rate_threshold:
                    self._open_since = time.time()
                    self._transition(CbState.OPEN, f"err_rate={err_rate:.2f}")

    def force_open(self, reason: str = "manual") -> None:
        with self._lock:
            self._open_since = time.time()
            self._transition(CbState.OPEN, reason)

    def force_close(self, reason: str = "manual") -> None:
        with self._lock:
            self._window.clear()
            self._half_open_calls = 0
            self._transition(CbState.CLOSED, reason)

    def get_state(self) -> str:
        with self._lock:
            return self._state.value

    def get_history(self) -> list[StateTransition]:
        with self._lock:
            return list(self._history)

    def get_window_stats(self) -> dict[str, float]:
        with self._lock:
            total = len(self._window)
            if total == 0:
                return {"count": 0, "err_rate": 0.0, "slow_rate": 0.0, "avg_dur": 0.0}
            fails = sum(1 for s, _ in self._window if not s)
            slow = sum(1 for _, d in self._window if d >= self._cfg.slow_threshold_sec)
            avg = sum(d for _, d in self._window) / total
            return {
                "count": total,
                "err_rate": round(fails / total, 4),
                "slow_rate": round(slow / total, 4),
                "avg_dur": round(avg, 4),
            }

    def stats(self) -> dict:
        # 复用 get_window_stats (自己内部持锁), 不在持锁内调用避免重入
        return {
            "name": self.name,
            "state": self.get_state(),
            "state_entered_at": self._state_entered_at,  # 读单字段, 容忍微小不一致
            "total_calls": self._safe_read("total_calls"),
            "total_success": self._safe_read("total_success"),
            "total_failed": self._safe_read("total_failed"),
            "total_rejected": self._safe_read("total_rejected"),
            "total_slow": self._safe_read("total_slow"),
            "window": self.get_window_stats(),
            "open_since": self._safe_read("open_since"),
        }

    def _safe_read(self, field_name: str):
        with self._lock:
            return {
                "total_calls": self._total_calls,
                "total_success": self._total_success,
                "total_failed": self._total_failed,
                "total_rejected": self._total_rejected,
                "total_slow": self._total_slow,
                "open_since": self._open_since,
            }[field_name]

    def set_threshold(self, err_rate: float | None = None, slow_sec: float | None = None) -> None:
        with self._lock:
            if err_rate is not None:
                self._cfg.error_rate_threshold = max(0.0, min(1.0, err_rate))
            if slow_sec is not None:
                self._cfg.slow_threshold_sec = max(0.0, slow_sec)

    def set_open_duration(self, sec: float) -> None:
        with self._lock:
            self._cfg.open_duration_sec = max(0.0, sec)

    def reset(self) -> None:
        with self._lock:
            self._window.clear()
            self._half_open_calls = 0
            self._open_since = 0.0
            self._total_calls = 0
            self._total_success = 0
            self._total_failed = 0
            self._total_rejected = 0
            self._total_slow = 0
            self._history.clear()
            self._transition(CbState.CLOSED, "reset")

    # prometheus_client 集成 (可选)
    def prometheus_metrics(self) -> str:
        s = self.stats()
        lines = [
            "# HELP cb_state Circuit breaker state (0=closed,1=half_open,2=open)",
            "# TYPE cb_state gauge",
            f'cb_state{{name="{self.name}"}} {s["state_entered_at"]}',
            "# HELP cb_calls_total Total calls",
            "# TYPE cb_calls_total counter",
            f'cb_calls_total{{name="{self.name}",result="success"}} {s["total_success"]}',
            f'cb_calls_total{{name="{self.name}",result="failed"}} {s["total_failed"]}',
            f'cb_calls_total{{name="{self.name}",result="rejected"}} {s["total_rejected"]}',
        ]
        return "\n".join(lines)


class CbRegistry:
    """熔断器注册中心 (按 name)."""

    def __init__(self):
        self._lock = threading.Lock()
        self._breakers: dict[str, CbMetrics] = {}

    def get_or_create(self, name: str, config: CbConfig | None = None) -> CbMetrics:
        with self._lock:
            cb = self._breakers.get(name)
            if cb is None:
                cb = CbMetrics(name=name, config=config)
                self._breakers[name] = cb
            return cb

    def get(self, name: str) -> CbMetrics | None:
        with self._lock:
            return self._breakers.get(name)

    def remove(self, name: str) -> bool:
        with self._lock:
            return self._breakers.pop(name, None) is not None

    def list_all(self) -> list[str]:
        with self._lock:
            return list(self._breakers.keys())

    def stats(self) -> dict:
        with self._lock:
            return {n: cb.stats() for n, cb in self._breakers.items()}


# 全局单例
cb_registry = CbRegistry()
