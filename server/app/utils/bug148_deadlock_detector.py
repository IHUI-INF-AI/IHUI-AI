"""Bug-148: 死锁检测与自动重试.
设计:
  - 资源等待图 (wait-for graph) 检测环路
  - 模拟事务: 申请锁 -> 操作 -> 释放 / 等待 / 超时
  - 锁顺序: 全局排序, 防止 AB-BA 死锁
  - 自动重试: 检测到死锁或锁等待超时
  - 优先级 + 抢占 (高级事务可抢低级)
"""

from __future__ import annotations

import threading
import time
import uuid
from dataclasses import dataclass, field
from enum import StrEnum
from typing import Any


class TxState(StrEnum):
    PENDING = "PENDING"
    RUNNING = "RUNNING"
    WAITING = "WAITING"
    COMMITTED = "COMMITTED"
    ABORTED = "ABORTED"
    DEADLOCKED = "DEADLOCKED"


class LockMode(StrEnum):
    SHARED = "SHARED"
    EXCLUSIVE = "EXCLUSIVE"


class TxResult(StrEnum):
    OK = "OK"
    DEADLOCK = "DEADLOCK"
    TIMEOUT = "TIMEOUT"
    ABORTED = "ABORTED"


@dataclass
class Lock:
    resource: str
    mode: LockMode
    holder_tx: str
    priority: int = 0
    acquired_at: float = 0.0


@dataclass
class Transaction:
    tx_id: str
    state: TxState = TxState.PENDING
    priority: int = 0
    locks: list[Lock] = field(default_factory=list)
    waiting_for: str | None = None
    wait_since: float = 0.0
    started_at: float = 0.0
    finished_at: float = 0.0
    retry_count: int = 0
    error: str = ""


@dataclass
class DeadlockConfig:
    detect_interval: float = 0.1
    wait_timeout: float = 5.0
    max_retries: int = 3
    enable_preempt: bool = True
    lock_order_enforce: bool = True


class DeadlockDetector:
    """死锁检测与重试器."""

    def __init__(self, config: DeadlockConfig | None = None) -> None:
        self.config = config or DeadlockConfig()
        self._lock = threading.RLock()
        self._resource_owners: dict[str, list[Lock]] = {}  # resource -> locks
        self._txs: dict[str, Transaction] = {}
        self._wait_graph: dict[str, str] = {}  # tx -> tx (waiting for)
        self._stats = {
            "started": 0,
            "committed": 0,
            "aborted": 0,
            "deadlocks": 0,
            "timeouts": 0,
            "retries": 0,
            "detections": 0,
        }

    def _now(self) -> float:
        return time.time()

    def begin(self, priority: int = 0) -> Transaction:
        with self._lock:
            tid = uuid.uuid4().hex
            tx = Transaction(tx_id=tid, state=TxState.RUNNING, priority=priority, started_at=self._now())
            self._txs[tid] = tx
            self._stats["started"] += 1
            return tx

    def _acquire_lock(self, tx: Transaction, resource: str, mode: LockMode) -> bool:
        with self._lock:
            owners = self._resource_owners.setdefault(resource, [])
            if not owners:
                # 直接获取
                lock = Lock(
                    resource=resource, mode=mode, holder_tx=tx.tx_id, priority=tx.priority, acquired_at=self._now()
                )
                owners.append(lock)
                tx.locks.append(lock)
                return True
            # 已有锁
            if mode == LockMode.SHARED and all(o.mode == LockMode.SHARED for o in owners):
                lock = Lock(
                    resource=resource, mode=mode, holder_tx=tx.tx_id, priority=tx.priority, acquired_at=self._now()
                )
                owners.append(lock)
                tx.locks.append(lock)
                return True
            # 冲突
            return False

    def _release_locks(self, tx: Transaction) -> None:
        with self._lock:
            for lock in tx.locks:
                owners = self._resource_owners.get(lock.resource, [])
                self._resource_owners[lock.resource] = [o for o in owners if o.holder_tx != tx.tx_id]
                if not self._resource_owners[lock.resource]:
                    self._resource_owners.pop(lock.resource, None)
            tx.locks.clear()

    def _detect_cycle(self) -> list[str]:
        """检测等待图环路, 返回环路节点列表."""
        with self._lock:
            visited: set[str] = set()
            stack: set[str] = set()
            path: list[str] = []

            def dfs(node: str) -> list[str] | None:
                visited.add(node)
                stack.add(node)
                path.append(node)
                nxt = self._wait_graph.get(node)
                if nxt is not None:
                    if nxt in stack:
                        # 找到环
                        idx = path.index(nxt)
                        return [*path[idx:], nxt]
                    if nxt not in visited:
                        r = dfs(nxt)
                        if r is not None:
                            return r
                path.pop()
                stack.discard(node)
                return None

            for n in list(self._wait_graph.keys()):
                if n not in visited:
                    r = dfs(n)
                    if r is not None:
                        return r
            return []

    def _abort_tx(self, tx: Transaction, reason: str) -> None:
        with self._lock:
            self._release_locks(tx)
            tx.state = TxState.ABORTED
            tx.error = reason
            tx.finished_at = self._now()
            self._wait_graph.pop(tx.tx_id, None)
            self._stats["aborted"] += 1

    def acquire(self, tx_id: str, resources: list[str], mode: LockMode = LockMode.EXCLUSIVE) -> TxResult:
        with self._lock:
            tx = self._txs.get(tx_id)
            if tx is None or tx.state != TxState.RUNNING:
                return TxResult.ABORTED
            # 锁顺序校验
            res_sorted = sorted(resources) if self.config.lock_order_enforce else list(resources)
            tx.state = TxState.WAITING
            tx.wait_since = self._now()
            for res in res_sorted:
                if self._acquire_lock(tx, res, mode):
                    continue
                # 等待
                owners = self._resource_owners.get(res, [])
                if owners:
                    holder = owners[0].holder_tx
                    tx.waiting_for = holder
                    self._wait_graph[tx_id] = holder
                    # 检测死锁
                    cycle = self._detect_cycle()
                    if cycle:
                        self._stats["detections"] += 1
                        # 选优先级最低的事务中止
                        victim = min(
                            [self._txs[n] for n in cycle if n in self._txs and self._txs[n] != tx],
                            key=lambda t: (t.priority, t.tx_id),
                            default=tx,
                        )
                        if victim.tx_id == tx.tx_id:
                            # 自己成环, 牺牲自己
                            tx.waiting_for = None
                            self._wait_graph.pop(tx.tx_id, None)
                            self._stats["deadlocks"] += 1
                            return TxResult.DEADLOCK
                        self._abort_tx(victim, "deadlock_victim")
                        self._stats["deadlocks"] += 1
                        tx.retry_count += 1
                        if tx.retry_count > self.config.max_retries:
                            return TxResult.ABORTED
                        self._stats["retries"] += 1
                        tx.waiting_for = None
                        return TxResult.DEADLOCK
                    # 检查超时
                    if self._now() - tx.wait_since > self.config.wait_timeout:
                        self._stats["timeouts"] += 1
                        self._wait_graph.pop(tx.tx_id, None)
                        return TxResult.TIMEOUT
            tx.state = TxState.RUNNING
            tx.waiting_for = None
            self._wait_graph.pop(tx.tx_id, None)
            return TxResult.OK

    def commit(self, tx_id: str) -> bool:
        with self._lock:
            tx = self._txs.get(tx_id)
            if tx is None or tx.state != TxState.RUNNING:
                return False
            self._release_locks(tx)
            tx.state = TxState.COMMITTED
            tx.finished_at = self._now()
            self._stats["committed"] += 1
            return True

    def rollback(self, tx_id: str) -> bool:
        with self._lock:
            tx = self._txs.get(tx_id)
            if tx is None:
                return False
            self._release_locks(tx)
            tx.state = TxState.ABORTED
            tx.finished_at = self._now()
            self._wait_graph.pop(tx.tx_id, None)
            self._stats["aborted"] += 1
            return True

    def get(self, tx_id: str) -> Transaction | None:
        with self._lock:
            return self._txs.get(tx_id)

    def run_with_retry(self, op: callable, max_retries: int | None = None) -> TxResult:
        """带自动重试的事务包装."""
        retries = max_retries if max_retries is not None else self.config.max_retries
        tx = self.begin()
        try:
            for attempt in range(retries + 1):
                tx.retry_count = attempt
                result = op(tx)
                if result == TxResult.OK:
                    self.commit(tx.tx_id)
                    return result
                if result in (TxResult.DEADLOCK, TxResult.TIMEOUT):
                    self.rollback(tx.tx_id)
                    if attempt < retries:
                        tx = self.begin()
                        continue
                    return result
                self.rollback(tx.tx_id)
                return result
            return TxResult.OK
        except Exception:
            self.rollback(tx.tx_id)
            return TxResult.ABORTED

    def stats(self) -> dict[str, Any]:
        with self._lock:
            return {**self._stats, "active_txs": sum(1 for t in self._txs.values() if t.state == TxState.RUNNING)}
