"""Bug-141: Kafka 消费位移管理.
设计:
  - 模拟 Kafka offset 管理
  - 提交策略: 自动 (每 N 条) / 手动
  - 重平衡 (rebalance): partition -> consumer 分配
  - 位移回放 (seek_to)
  - 消费位点恢复 (committed_offset 持久化)
  - 重复消费检测 (idempotency 跟踪)
"""

from __future__ import annotations

import threading
import time
from dataclasses import dataclass, field
from enum import StrEnum
from typing import Any


class CommitMode(StrEnum):
    AUTO_EACH = "AUTO_EACH"  # 每条都提交
    AUTO_BATCH = "AUTO_BATCH"  # 批量提交
    MANUAL = "MANUAL"


class RebalanceState(StrEnum):
    STABLE = "STABLE"
    REBALANCING = "REBALANCING"


@dataclass
class Partition:
    topic: str
    partition: int
    high_watermark: int = 0
    committed_offset: int = 0
    in_flight: set[int] = field(default_factory=set)
    consumed: set[int] = field(default_factory=set)


@dataclass
class ConsumerGroupMember:
    member_id: str
    partitions: set[tuple[str, int]] = field(default_factory=set)
    last_heartbeat: float = 0.0


@dataclass
class KafkaConfig:
    commit_mode: CommitMode = CommitMode.AUTO_BATCH
    commit_batch_size: int = 100
    commit_interval_sec: float = 5.0
    session_timeout_sec: float = 30.0
    enable_idempotency_check: bool = True


class KafkaOffsetManager:
    """Kafka 消费位移管理 (内存模拟)."""

    def __init__(self, config: KafkaConfig | None = None) -> None:
        self.config = config or KafkaConfig()
        self._lock = threading.RLock()
        self._partitions: dict[tuple[str, int], Partition] = {}
        self._members: dict[str, ConsumerGroupMember] = {}
        self._state = RebalanceState.STABLE
        self._pending_commits: dict[tuple[str, int], int] = {}
        self._last_auto_commit = time.time()
        self._stats = {"consumed": 0, "committed": 0, "rebalanced": 0, "duplicates": 0}

    def _now(self) -> float:
        return time.time()

    def add_partition(self, topic: str, partition: int, high_watermark: int = 1000) -> Partition:
        with self._lock:
            key = (topic, partition)
            p = self._partitions.get(key)
            if p is None:
                p = Partition(topic=topic, partition=partition, high_watermark=high_watermark)
                self._partitions[key] = p
            else:
                if high_watermark > p.high_watermark:
                    p.high_watermark = high_watermark
            return p

    def join_group(self, member_id: str, subscribed: list[tuple[str, int]]) -> ConsumerGroupMember:
        """消费者加入, 触发 rebalance."""
        with self._lock:
            self._state = RebalanceState.REBALANCING
            self._stats["rebalanced"] += 1
            # 清空旧分配
            for m in self._members.values():
                m.partitions.clear()
            member = self._members.get(member_id) or ConsumerGroupMember(member_id=member_id)
            self._members[member_id] = member
            # 简单分配: 每个 member 拿一个 partition, 数量对等
            members = list(self._members.keys())
            for i, p in enumerate(subscribed):
                owner = members[i % len(members)]
                self._members[owner].partitions.add(p)
            member.last_heartbeat = self._now()
            self._state = RebalanceState.STABLE
            return member

    def leave_group(self, member_id: str) -> bool:
        with self._lock:
            member = self._members.pop(member_id, None)
            if member is None:
                return False
            for _p in member.partitions:
                # 释放, 待其他人认领
                pass
            return True

    def heartbeat(self, member_id: str) -> bool:
        with self._lock:
            member = self._members.get(member_id)
            if member is None:
                return False
            if self._now() - member.last_heartbeat > self.config.session_timeout_sec:
                return False
            member.last_heartbeat = self._now()
            return True

    def get_assigned(self, member_id: str) -> list[Partition]:
        with self._lock:
            m = self._members.get(member_id)
            if m is None:
                return []
            return [self._partitions[k] for k in m.partitions if k in self._partitions]

    def consume(self, topic: str, partition: int, member_id: str, count: int = 1) -> list[int]:
        """拉取消息, 返回 offset 列表."""
        with self._lock:
            key = (topic, partition)
            p = self._partitions.get(key)
            if p is None or p.high_watermark <= p.committed_offset:
                return []
            member = self._members.get(member_id)
            if member is None or key not in member.partitions:
                return []
            available = p.high_watermark - p.committed_offset
            n = min(count, available)
            offsets = list(range(p.committed_offset, p.committed_offset + n))
            p.in_flight.update(offsets)
            self._stats["consumed"] += n
            return offsets

    def complete(self, topic: str, partition: int, offset: int, member_id: str) -> bool:
        """处理完一条消息."""
        with self._lock:
            key = (topic, partition)
            p = self._partitions.get(key)
            if p is None:
                return False
            if offset in p.in_flight:
                p.in_flight.discard(offset)
                p.consumed.add(offset)
            if self.config.enable_idempotency_check and offset in p.consumed:
                self._stats["duplicates"] += 1
            # 推进提交位
            if self.config.commit_mode == CommitMode.AUTO_EACH:
                self._commit(key, offset + 1)
            elif self.config.commit_mode == CommitMode.AUTO_BATCH:
                self._pending_commits[key] = offset + 1
                pending_count = sum(1 for v in self._pending_commits.values())
                if pending_count >= self.config.commit_batch_size or self._now() - self._last_auto_commit > self.config.commit_interval_sec:
                    self._flush()
            return True

    def commit(self, topic: str, partition: int, offset: int) -> bool:
        with self._lock:
            return self._commit((topic, partition), offset)

    def _commit(self, key: tuple[str, int], offset: int) -> bool:
        p = self._partitions.get(key)
        if p is None:
            return False
        if offset > p.committed_offset:
            p.committed_offset = offset
            self._stats["committed"] += 1
        return True

    def _flush(self) -> int:
        n = 0
        for key, offset in self._pending_commits.items():
            if self._commit(key, offset):
                n += 1
        self._pending_commits.clear()
        self._last_auto_commit = self._now()
        return n

    def seek_to(self, topic: str, partition: int, offset: int) -> bool:
        with self._lock:
            p = self._partitions.get((topic, partition))
            if p is None or offset < 0:
                return False
            p.committed_offset = offset
            return True

    def lag(self, topic: str, partition: int) -> int:
        with self._lock:
            p = self._partitions.get((topic, partition))
            if p is None:
                return 0
            return p.high_watermark - p.committed_offset

    def stats(self) -> dict[str, Any]:
        with self._lock:
            return {
                **self._stats,
                "partitions": len(self._partitions),
                "members": len(self._members),
                "state": self._state.value,
                "pending_commits": len(self._pending_commits),
            }
