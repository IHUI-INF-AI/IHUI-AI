"""Bug-170: 数据库主从切换.

模拟主库故障 -> 检测 -> 提升从库为新主.
支持: 探测 + 健康分 + 选举 + 角色变更.
"""

import enum
import threading
import time
from collections import deque
from collections.abc import Callable
from dataclasses import dataclass


class DbRole(enum.StrEnum):
    MASTER = "MASTER"
    SLAVE = "SLAVE"
    OFFLINE = "OFFLINE"


@dataclass
class DbNode:
    id: str
    role: DbRole = DbRole.SLAVE
    priority: int = 100  # 选举优先级
    healthy: bool = True
    lag_sec: float = 0.0
    last_check: float = 0.0
    fail_count: int = 0


class FailoverConfig:
    check_interval_sec: float = 1.0
    fail_threshold: int = 3
    recovery_threshold: int = 2
    max_lag_sec: float = 10.0


class FailoverManager:
    """主从切换: 健康分 + 选举 + 角色."""

    def __init__(
        self,
        config: FailoverConfig | None = None,
        on_role_change: Callable[[str, DbRole, DbRole], None] | None = None,
    ):
        self.config = config or FailoverConfig()
        self._on_change = on_role_change
        self._lock = threading.Lock()
        self._nodes: dict[str, DbNode] = {}
        self._events: deque = deque(maxlen=200)

    def add(self, node_id: str, role: DbRole = DbRole.SLAVE, priority: int = 100) -> None:
        with self._lock:
            self._nodes[node_id] = DbNode(id=node_id, role=role, priority=priority)

    def heartbeat(self, node_id: str, ok: bool, lag_sec: float = 0.0) -> None:
        with self._lock:
            n = self._nodes.get(node_id)
            if not n:
                return
            n.last_check = time.time()
            n.lag_sec = lag_sec
            if ok:
                n.fail_count = max(0, n.fail_count - 1)
                if n.fail_count == 0 and not n.healthy:
                    n.healthy = True
            else:
                n.fail_count += 1
                if n.fail_count >= self.config.fail_threshold:
                    n.healthy = False
            # 同步滞后主备
            if n.role == DbRole.SLAVE and lag_sec > self.config.max_lag_sec:
                n.healthy = False
        self._maybe_elect()

    def _elect(self) -> str | None:
        """从健康的从库中选优先级最高的提升为 MASTER."""
        with self._lock:
            slaves = [n for n in self._nodes.values() if n.role == DbRole.SLAVE and n.healthy]
            if not slaves:
                return None
            winner = max(slaves, key=lambda n: (n.priority, -n.lag_sec))
            old_master = next((n.id for n in self._nodes.values() if n.role == DbRole.MASTER), None)
            if old_master == winner.id:
                return None
            # 老主降为 OFFLINE
            for n in self._nodes.values():
                if n.role == DbRole.MASTER:
                    self._set_role_unlocked(n.id, DbRole.OFFLINE)
            self._set_role_unlocked(winner.id, DbRole.MASTER)
            return winner.id

    def _set_role_unlocked(self, node_id: str, new_role: DbRole) -> None:
        n = self._nodes.get(node_id)
        if not n:
            return
        old = n.role
        n.role = new_role
        self._events.append((time.time(), node_id, old.value, new_role.value))
        if self._on_change and old != new_role:
            try:
                self._on_change(node_id, old, new_role)
            except Exception:
                pass  # intentionally ignored

    def _maybe_elect(self) -> None:
        with self._lock:
            master = next((n for n in self._nodes.values() if n.role == DbRole.MASTER), None)
        if master is None or not master.healthy:
            self._elect()

    def force_failover(self) -> str | None:
        return self._elect()

    def status(self) -> dict[str, dict]:
        with self._lock:
            return {
                n.id: {
                    "role": n.role.value,
                    "healthy": n.healthy,
                    "priority": n.priority,
                    "lag_sec": n.lag_sec,
                    "fail_count": n.fail_count,
                }
                for n in self._nodes.values()
            }

    def events(self, limit: int = 20) -> list[tuple]:
        with self._lock:
            return list(self._events)[-limit:]
