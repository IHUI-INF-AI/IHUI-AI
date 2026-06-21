"""Bug-172: 慢查询 follower 保护.

当从库延迟过大或堆积查询时, 暂时停止路由读流量到该 follower,
避免雪崩; 恢复后再放回轮询.
"""

import threading
import time
from collections import deque
from dataclasses import dataclass


@dataclass
class FollowerGuardConfig:
    max_lag_sec: float = 5.0
    max_inflight: int = 100
    recovery_sec: float = 10.0
    cooldown_sec: float = 30.0


class FollowerGuard:
    """从库过载保护: 拉黑延迟过大的 follower."""

    def __init__(self, config: FollowerGuardConfig | None = None):
        self.config = config or FollowerGuardConfig()
        self._lock = threading.Lock()
        self._blocked: dict[str, float] = {}  # id -> unblock_ts
        self._inflight: dict[str, int] = {}
        self._lag: dict[str, float] = {}
        self._blocked_events: deque = deque(maxlen=100)
        self._check_count: dict[str, int] = {}

    def report_lag(self, node_id: str, lag_sec: float) -> bool:
        """上报从库延迟, 返回 True 表示仍然可用."""
        cfg = self.config
        with self._lock:
            self._lag[node_id] = lag_sec
            self._check_count[node_id] = self._check_count.get(node_id, 0) + 1
            if lag_sec > cfg.max_lag_sec:
                self._blocked[node_id] = time.time() + cfg.cooldown_sec
                self._blocked_events.append((time.time(), node_id, "lag"))
                return False
        return True

    def acquire(self, node_id: str) -> bool:
        """尝试获取从库, 不可用时返回 False."""
        cfg = self.config
        now = time.time()
        with self._lock:
            unblock_ts = self._blocked.get(node_id, 0)
            if unblock_ts > now:
                return False
            cur = self._inflight.get(node_id, 0)
            if cur >= cfg.max_inflight:
                return False
            self._inflight[node_id] = cur + 1
        return True

    def release(self, node_id: str) -> None:
        with self._lock:
            cur = self._inflight.get(node_id, 0)
            if cur > 0:
                self._inflight[node_id] = cur - 1

    def tick(self) -> None:
        """恢复检测: 距上次阻断超过 recovery_sec 后重新放回."""
        cfg = self.config
        with self._lock:
            now = time.time()
            recovered = []
            for n, ts in list(self._blocked.items()):
                if now >= ts + cfg.recovery_sec:
                    recovered.append(n)
            for n in recovered:
                del self._blocked[n]
                self._blocked_events.append((now, n, "recovered"))

    def status(self) -> dict[str, dict]:
        with self._lock:
            return {
                n: {
                    "blocked": ts > time.time(),
                    "inflight": self._inflight.get(n, 0),
                    "lag_sec": self._lag.get(n, 0.0),
                }
                for n, ts in self._blocked.items()
            }
