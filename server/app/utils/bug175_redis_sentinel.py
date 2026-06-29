"""Bug-175: Redis 故障转移 (sentinel 客户端).

模拟主从 sentinel 选举 + 客户端自动重连到新主.
支持: 节点角色变更 + 客户端重路由 + 健康检查.
"""

import enum
import threading
import time
from collections import deque
from dataclasses import dataclass


class NodeState(enum.StrEnum):
    UP = "UP"
    DOWN = "DOWN"
    REPLICA = "REPLICA"


@dataclass
class RedisNode:
    id: str
    state: NodeState = NodeState.UP
    is_master: bool = False
    last_ok: float = 0.0


@dataclass
class FailoverEvent:
    ts: float
    old_master: str
    new_master: str


class RedisSentinel:
    """Redis 故障转移: 健康检查 + 选举 + 路由刷新."""

    def __init__(self):
        self._lock = threading.Lock()
        self._nodes: dict[str, RedisNode] = {}
        self._events: deque = deque(maxlen=100)
        self._routes: dict[str, str] = {}  # client_id -> node_id

    def add(self, node_id: str, is_master: bool = False) -> None:
        with self._lock:
            self._nodes[node_id] = RedisNode(
                id=node_id,
                state=NodeState.UP,
                is_master=is_master,
                last_ok=time.time(),
            )

    def report(self, node_id: str, ok: bool) -> FailoverEvent | None:
        with self._lock:
            n = self._nodes.get(node_id)
            if not n:
                return None
            if ok:
                n.state = NodeState.UP
                n.last_ok = time.time()
                return None
            n.state = NodeState.DOWN
        # 触发选举
        return self._elect()

    def _elect(self) -> FailoverEvent | None:
        with self._lock:
            old_master = next((n.id for n in self._nodes.values() if n.is_master), None)
            replicas = [n for n in self._nodes.values() if not n.is_master and n.state == NodeState.UP]
            if not replicas:
                return None
            new_master = replicas[0].id
            for n in self._nodes.values():
                if n.is_master and n.id != new_master:
                    n.is_master = False
                    n.state = NodeState.DOWN
                if n.id == new_master:
                    n.is_master = True
                    n.state = NodeState.UP
            ev = FailoverEvent(ts=time.time(), old_master=old_master or "", new_master=new_master)
            self._events.append(ev)
            # 失效 client 路由, 下次 reconnect 时会重新解析
            self._routes.clear()
        return ev

    def get_master(self) -> str | None:
        with self._lock:
            for n in self._nodes.values():
                if n.is_master and n.state == NodeState.UP:
                    return n.id
        return None

    def attach(self, client_id: str) -> str | None:
        m = self.get_master()
        if m is None:
            return None
        with self._lock:
            self._routes[client_id] = m
        return m

    def status(self) -> dict[str, dict]:
        with self._lock:
            return {n.id: {"state": n.state.value, "is_master": n.is_master} for n in self._nodes.values()}

    def events(self, limit: int = 20) -> list[FailoverEvent]:
        with self._lock:
            return list(self._events)[-limit:]
