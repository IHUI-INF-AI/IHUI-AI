"""Bug-113: 故障切换编排 (主备探测 + 自动切流 + 一致性校验 + 回切).

设计:
  - 服务组: name + 多个节点 (primary + replicas)
  - 健康探测: 注入 probe_fn, 周期评估
  - 自动切流: 连续 N 次失败则将 primary 降级, replica 提升
  - 一致性校验: 切流前同步 lag / 复制状态
  - 回切: primary 恢复后, 手动或自动回切
  - 审计: 每次切流/回切记录
"""

import logging
import threading
import time
import uuid
from collections import deque
from collections.abc import Callable
from dataclasses import dataclass, field
from enum import StrEnum

logger = logging.getLogger(__name__)


class NodeRole(StrEnum):
    PRIMARY = "primary"
    REPLICA = "replica"
    CANDIDATE = "candidate"


class NodeState(StrEnum):
    HEALTHY = "healthy"
    DEGRADED = "degraded"
    DEAD = "dead"
    DRAINING = "draining"


class GroupPhase(StrEnum):
    STEADY = "steady"
    FAILING_OVER = "failing_over"
    FAILED_OVER = "failed_over"
    FAILING_BACK = "failing_back"
    STEADY_BACK = "steady_back"


@dataclass
class Node:
    id: str
    role: str = NodeRole.REPLICA.value
    state: str = NodeState.HEALTHY.value
    last_check_ts: float = 0.0
    last_check_ok: bool = True
    consecutive_failures: int = 0
    lag_sec: float = 0.0
    weight: int = 100

    def to_dict(self) -> dict:
        return self.__dict__.copy()


@dataclass
class ServiceGroup:
    name: str
    nodes: dict[str, Node] = field(default_factory=dict)
    phase: str = GroupPhase.STEADY.value
    current_primary: str = ""
    failure_threshold: int = 3
    probe_interval_sec: float = 5.0
    last_failover_at: float = 0.0
    last_failback_at: float = 0.0
    fail_count: int = 0
    failback_count: int = 0
    auto_failback: bool = False
    auto_failback_delay_sec: float = 30.0
    primary_recovery_ts: float = 0.0

    def to_dict(self) -> dict:
        return {
            "name": self.name,
            "nodes": {k: v.to_dict() for k, v in self.nodes.items()},
            "phase": self.phase,
            "current_primary": self.current_primary,
            "failure_threshold": self.failure_threshold,
            "probe_interval_sec": self.probe_interval_sec,
            "last_failover_at": self.last_failover_at,
            "last_failback_at": self.last_failback_at,
            "fail_count": self.fail_count,
            "failback_count": self.failback_count,
            "auto_failback": self.auto_failback,
        }


@dataclass
class FailoverAudit:
    id: str
    group: str
    action: str
    detail: str
    ts: float
    actor: str = "system"


class FailoverOrchestrator:
    """故障切换编排器."""

    def __init__(self, max_audit: int = 1000):
        self._lock = threading.Lock()
        self._groups: dict[str, ServiceGroup] = {}
        self._probes: dict[str, Callable[[str], bool]] = {}
        self._lag_probes: dict[str, Callable[[str], float]] = {}
        self._audit: deque[FailoverAudit] = deque(maxlen=max_audit)

    def _audit_log(self, group: str, action: str, detail: str, actor: str = "system") -> None:
        with self._lock:
            self._audit.append(FailoverAudit(uuid.uuid4().hex[:10], group, action, detail, time.time(), actor))

    def _append_audit_locked(self, group: str, action: str, detail: str, actor: str = "system") -> None:
        """持锁状态下追加审计, 避免在持锁时调用 _audit_log 产生死锁."""
        self._audit.append(FailoverAudit(uuid.uuid4().hex[:10], group, action, detail, time.time(), actor))

    def create_group(
        self,
        name: str,
        primary: str,
        replicas: list[str] | None = None,
        failure_threshold: int = 3,
        probe_interval_sec: float = 5.0,
        auto_failback: bool = False,
    ) -> ServiceGroup:
        with self._lock:
            if name in self._groups:
                raise ValueError(f"group {name} already exists")
            g = ServiceGroup(
                name=name,
                current_primary=primary,
                failure_threshold=failure_threshold,
                probe_interval_sec=probe_interval_sec,
                auto_failback=auto_failback,
                phase=GroupPhase.STEADY.value,
            )
            g.nodes[primary] = Node(id=primary, role=NodeRole.PRIMARY.value, state=NodeState.HEALTHY.value)
            for r in replicas or []:
                g.nodes[r] = Node(id=r, role=NodeRole.REPLICA.value, state=NodeState.HEALTHY.value)
            self._groups[name] = g
            self._append_audit_locked(name, "create_group", f"primary={primary} replicas={replicas}")
            return g

    def delete_group(self, name: str) -> bool:
        with self._lock:
            g = self._groups.pop(name, None)
            self._probes.pop(name, None)
            self._lag_probes.pop(name, None)
        if g is None:
            return False
        self._append_audit_locked(name, "delete_group", "ok")
        return True

    def get_group(self, name: str) -> ServiceGroup | None:
        with self._lock:
            return self._groups.get(name)

    def list_groups(self) -> list[ServiceGroup]:
        with self._lock:
            return list(self._groups.values())

    def set_probe(self, group: str, probe: Callable[[str], bool]) -> None:
        with self._lock:
            self._probes[group] = probe

    def set_lag_probe(self, group: str, lag_probe: Callable[[str], float]) -> None:
        with self._lock:
            self._lag_probes[group] = lag_probe

    def add_node(self, group: str, node_id: str, role: str = NodeRole.REPLICA.value) -> bool:
        with self._lock:
            g = self._groups.get(group)
            if g is None or node_id in g.nodes:
                return False
            g.nodes[node_id] = Node(id=node_id, role=role, state=NodeState.HEALTHY.value)
            return True

    def remove_node(self, group: str, node_id: str) -> bool:
        with self._lock:
            g = self._groups.get(group)
            if g is None or node_id not in g.nodes:
                return False
            del g.nodes[node_id]
            if g.current_primary == node_id:
                g.current_primary = ""
        return True

    def report_health(self, group: str, node_id: str, ok: bool, lag_sec: float = 0.0) -> None:
        with self._lock:
            g = self._groups.get(group)
            if g is None or node_id not in g.nodes:
                return
            n = g.nodes[node_id]
            n.last_check_ts = time.time()
            n.last_check_ok = ok
            n.lag_sec = lag_sec
            if ok:
                n.consecutive_failures = 0
                if n.state == NodeState.DEAD.value:
                    n.state = NodeState.HEALTHY.value
                    # 任何 DEAD 节点恢复都记录 primary_recovery_ts, 用于 failback 延迟判断
                    if g.phase == GroupPhase.FAILED_OVER.value and g.primary_recovery_ts == 0.0:
                        g.primary_recovery_ts = time.time()
            else:
                n.consecutive_failures += 1
                if n.consecutive_failures >= g.failure_threshold:
                    n.state = NodeState.DEAD.value

    def tick(self) -> list[FailoverAudit]:
        """周期调用, 执行探测 + 切流判断. 返回本轮触发的动作审计."""
        actions: list[FailoverAudit] = []
        with self._lock:
            group_names = list(self._groups.keys())
            probes = dict(self._probes)
            lag_probes = dict(self._lag_probes)
        for name in group_names:
            self._probe_once(name, probes.get(name), lag_probes.get(name))
            a = self._maybe_failover(name)
            if a:
                actions.append(a)
            a2 = self._maybe_failback(name)
            if a2:
                actions.append(a2)
        return actions

    def _probe_once(
        self,
        group: str,
        probe: Callable[[str], bool] | None,
        lag_probe: Callable[[str], float] | None,
    ) -> None:
        with self._lock:
            g = self._groups.get(group)
            if g is None:
                return
            node_ids = list(g.nodes.keys())
        for nid in node_ids:
            # 已 DEAD 节点不重置: 避免 probe 干扰 failover 状态判断
            with self._lock:
                cur = g.nodes.get(nid)
                if cur is None or cur.state == NodeState.DEAD.value:
                    continue
            ok = True
            lag = 0.0
            if probe is not None:
                try:
                    ok = bool(probe(nid))
                except Exception:
                    ok = False
            if lag_probe is not None:
                try:
                    lag = float(lag_probe(nid))
                except Exception:
                    lag = 0.0
            self.report_health(group, nid, ok, lag_sec=lag)

    def _maybe_failover(self, group: str) -> FailoverAudit | None:
        with self._lock:
            g = self._groups.get(group)
            if g is None or g.phase != GroupPhase.STEADY.value:
                return None
            primary = g.current_primary
            if not primary:
                return None
            p_node = g.nodes.get(primary)
            if p_node is None:
                return None
            # 同时判断 state 和 consecutive_failures: tick 中 _probe_once 会重置
            # consecutive_failures = 0 + state = HEALTHY, 因此需要看真实失败计数
            if p_node.state != NodeState.DEAD.value and p_node.consecutive_failures < g.failure_threshold:
                return None
            # 选 lag 最小 + 健康的 replica
            candidates = [
                n for n in g.nodes.values() if n.role == NodeRole.REPLICA.value and n.state == NodeState.HEALTHY.value
            ]
            if not candidates:
                return None
            candidates.sort(key=lambda n: (n.lag_sec, -n.weight))
            new_primary = candidates[0].id
            # 一致性校验: lag 阈值
            if candidates[0].lag_sec > 60.0:
                # 同步延迟过大, 不允许切流
                self._append_audit_locked(group, "failover_blocked", f"lag={candidates[0].lag_sec} too high")
                return None
            g.current_primary = new_primary
            p_node.role = NodeRole.REPLICA.value
            new_node = g.nodes[new_primary]
            new_node.role = NodeRole.PRIMARY.value
            g.phase = GroupPhase.FAILED_OVER.value
            g.last_failover_at = time.time()
            g.fail_count += 1
            self._append_audit_locked(group, "failover", f"{primary} -> {new_primary}")
        return self._audit[-1] if self._audit else None

    def _maybe_failback(self, group: str) -> FailoverAudit | None:
        with self._lock:
            g = self._groups.get(group)
            if g is None:
                return None
            if g.phase != GroupPhase.FAILED_OVER.value:
                return None
            if not g.auto_failback:
                return None
            # 找第一个状态好且 lag 低 + role=REPLICA 的, 不等于 current
            original_primary = None
            for n in g.nodes.values():
                if n.id == g.current_primary:
                    continue
                if (
                    n.role == NodeRole.REPLICA.value
                    and n.state == NodeState.HEALTHY.value
                    and n.lag_sec <= 5.0
                    and n.consecutive_failures == 0
                ):
                    original_primary = n.id
                    break
            if original_primary is None:
                return None
            if g.primary_recovery_ts and (time.time() - g.primary_recovery_ts) < g.auto_failback_delay_sec:
                return None
            old_primary = g.current_primary
            g.current_primary = original_primary
            g.nodes[original_primary].role = NodeRole.PRIMARY.value
            g.nodes[old_primary].role = NodeRole.REPLICA.value
            g.phase = GroupPhase.STEADY.value
            g.last_failback_at = time.time()
            g.failback_count += 1
            g.primary_recovery_ts = 0.0
            self._append_audit_locked(group, "failback", f"{old_primary} -> {original_primary}")
        return self._audit[-1] if self._audit else None

    def manual_failover(self, group: str, target: str, actor: str = "operator") -> bool:
        with self._lock:
            g = self._groups.get(group)
            if g is None or target not in g.nodes:
                return False
            old = g.current_primary
            g.current_primary = target
            for nid, n in g.nodes.items():
                if nid == target:
                    n.role = NodeRole.PRIMARY.value
                elif nid == old:
                    n.role = NodeRole.REPLICA.value
            g.phase = GroupPhase.FAILED_OVER.value if old != target else GroupPhase.STEADY.value
            g.last_failover_at = time.time()
            g.fail_count += 1
            self._append_audit_locked(group, "manual_failover", f"{old} -> {target}", actor)
        return True

    def manual_failback(self, group: str, target: str, actor: str = "operator") -> bool:
        with self._lock:
            g = self._groups.get(group)
            if g is None or target not in g.nodes:
                return False
            old = g.current_primary
            g.current_primary = target
            for nid, n in g.nodes.items():
                if nid == target:
                    n.role = NodeRole.PRIMARY.value
                else:
                    n.role = NodeRole.REPLICA.value
            g.phase = GroupPhase.STEADY.value
            g.last_failback_at = time.time()
            g.failback_count += 1
            self._append_audit_locked(group, "manual_failback", f"{old} -> {target}", actor)
        return True

    def get_audit(self, group: str | None = None, limit: int = 100) -> list[FailoverAudit]:
        with self._lock:
            arr = list(self._audit)
        if group:
            arr = [a for a in arr if a.group == group]
        return arr[-limit:]

    def set_auto_failback(self, group: str, enabled: bool, delay_sec: float = 30.0) -> bool:
        with self._lock:
            g = self._groups.get(group)
            if g is None:
                return False
            g.auto_failback = enabled
            g.auto_failback_delay_sec = max(0.0, delay_sec)
            return True

    def stats(self) -> dict:
        with self._lock:
            return {
                "group_count": len(self._groups),
                "audit_count": len(self._audit),
                "groups": {
                    n: {"phase": g.phase, "primary": g.current_primary, "fail_count": g.fail_count}
                    for n, g in self._groups.items()
                },
            }

    def clear(self) -> None:
        with self._lock:
            self._groups.clear()
            self._probes.clear()
            self._lag_probes.clear()
            self._audit.clear()


# 全局单例
failover_orch = FailoverOrchestrator()
