"""Bug-171: 读写分离路由.

读流量路由到从库, 写流量强制主库, 失败时回退主库.
支持: 强制主读 (如一致性要求), 走 follower, 走 leader.
"""

import enum
import threading
import time
from collections import deque
from dataclasses import dataclass


class QueryType(enum.StrEnum):
    READ = "READ"
    WRITE = "WRITE"


@dataclass
class RouteDecision:
    target: str  # 节点 id
    is_master: bool
    reason: str = ""


class ReplicaRouter:
    """读写路由: 默认 read->follower, write->leader."""

    def __init__(self, force_master_for_read: bool = False):
        self._lock = threading.Lock()
        self._nodes: dict[str, str] = {}  # id -> role
        self._healthy: dict[str, bool] = {}
        self._lag: dict[str, float] = {}
        self._weights: dict[str, float] = {}
        self._round_robin: dict[str, int] = {"follower": -1}
        self.force_master_for_read = force_master_for_read
        self._stats: dict[str, int] = {qt.value: 0 for qt in QueryType}
        self._recent: deque = deque(maxlen=100)

    def set_nodes(self, master: str, followers: list[str]) -> None:
        with self._lock:
            self._nodes.clear()
            self._healthy.clear()
            self._lag.clear()
            self._weights.clear()
            self._nodes[master] = "MASTER"
            self._healthy[master] = True
            self._lag[master] = 0.0
            for f in followers:
                self._nodes[f] = "FOLLOWER"
                self._healthy[f] = True
                self._lag[f] = 0.0
                self._weights[f] = 1.0

    def update_health(self, node_id: str, healthy: bool, lag_sec: float = 0.0) -> None:
        with self._lock:
            if node_id in self._nodes:
                self._healthy[node_id] = healthy
                self._lag[node_id] = lag_sec

    def _pick_follower(self) -> str | None:
        with self._lock:
            candidates = [
                n
                for n, role in self._nodes.items()
                if role == "FOLLOWER" and self._healthy.get(n, False) and self._lag.get(n, 0.0) < 5.0
            ]
        if not candidates:
            return None
        with self._lock:
            self._round_robin["follower"] += 1
            return candidates[self._round_robin["follower"] % len(candidates)]

    def route(self, qt: QueryType, consistency: bool = False) -> RouteDecision:
        with self._lock:
            self._stats[qt.value] += 1
        if qt == QueryType.WRITE:
            with self._lock:
                master = next((n for n, role in self._nodes.items() if role == "MASTER"), None)
            if not master or not self._healthy.get(master, False):
                raise RuntimeError("no master available")
            d = RouteDecision(target=master, is_master=True, reason="write")
        else:
            # READ
            if self.force_master_for_read or consistency:
                with self._lock:
                    master = next((n for n, role in self._nodes.items() if role == "MASTER"), None)
                if master and self._healthy.get(master, False):
                    d = RouteDecision(target=master, is_master=True, reason="force-master")
                else:
                    raise RuntimeError("no master and not allowed to read follower")
            else:
                f = self._pick_follower()
                if f is not None:
                    d = RouteDecision(target=f, is_master=False, reason="read-follower")
                else:
                    with self._lock:
                        master = next((n for n, role in self._nodes.items() if role == "MASTER"), None)
                    if master and self._healthy.get(master, False):
                        d = RouteDecision(target=master, is_master=True, reason="follower-fallback")
                    else:
                        raise RuntimeError("no node available")
        with self._lock:
            self._recent.append((time.time(), qt.value, d.target, d.reason))
        return d

    def stats(self) -> dict[str, int]:
        with self._lock:
            return dict(self._stats)
