"""Phase 20 建议 3: 全局 ID 生成器 - 雪花 ID + 冲突检测 + 反作弊.

目的:
  - 雪花算法 (Snowflake) 生成 64-bit 全局唯一 ID
  - 时钟回拨检测 + 自动等待/拒绝策略
  - 序列号耗尽保护 (每毫秒最多 4096 个)
  - 跨机房冲突检测 (本地最近 N 个 ID 缓存)
  - 机器 ID 分配器 (可注入存储后端)

设计:
  64-bit ID 布局:
    1 bit   符号位 (0)
    41 bit  时间戳 (ms 相对于 epoch)
    10 bit  机器 ID (datacenter 5 + worker 5, 可配置)
    12 bit  序列号 (每 ms 自增)

  Clock (抽象):
    now() -> ms 时间戳

  MachineIdAssigner:
    assign() -> (datacenter_id, worker_id)
    用 storage 后端持久化已分配的 ID

  ClockSkewError / SequenceExhaustedError / DuplicateIdError
"""

from __future__ import annotations

import json
import threading
import time
from collections import deque
from typing import Protocol

# ---------------------------------------------------------------------------
# 1. 异常
# ---------------------------------------------------------------------------


class ClockSkewError(Exception):
    """时钟回拨错误."""


class SequenceExhaustedError(Exception):
    """序列号耗尽错误 (单毫秒内生成 ID 超过 4096 个)."""


class DuplicateIdError(Exception):
    """跨机房 ID 冲突."""


# ---------------------------------------------------------------------------
# 2. Clock (抽象时钟)
# ---------------------------------------------------------------------------


class Clock(Protocol):
    def now_ms(self) -> int: ...


class SystemClock:
    """系统时钟."""

    def now_ms(self) -> int:
        return int(time.time() * 1000)


class MockClock:
    """可手动调整的 mock 时钟 (用于测试)."""

    def __init__(self, start_ms: int = 0):
        self._ms = start_ms

    def now_ms(self) -> int:
        return self._ms

    def advance(self, ms: int) -> None:
        self._ms += ms

    def set(self, ms: int) -> None:
        self._ms = ms


# ---------------------------------------------------------------------------
# 3. 机器 ID 分配器
# ---------------------------------------------------------------------------


class MachineIdAssigner:
    """机器 ID 分配器.

    用 storage 后端 (dict/文件/Redis) 持久化 (datacenter_id, worker_id).
    单线程分配即可, 实际部署时由启动时一次调用.
    """

    def __init__(self, datacenter_bits: int = 5, worker_bits: int = 5, storage: dict | None = None):
        self.datacenter_bits = datacenter_bits
        self.worker_bits = worker_bits
        self.max_datacenter = (1 << datacenter_bits) - 1
        self.max_worker = (1 << worker_bits) - 1
        self.storage = storage if storage is not None else {}
        self._lock = threading.Lock()

    def assign(self, datacenter_id: int | None = None, worker_id: int | None = None) -> tuple[int, int]:
        """分配 (datacenter_id, worker_id)."""
        with self._lock:
            if datacenter_id is not None and worker_id is not None:
                if not (0 <= datacenter_id <= self.max_datacenter):
                    raise ValueError(f"datacenter_id 超出范围 0..{self.max_datacenter}")
                if not (0 <= worker_id <= self.max_worker):
                    raise ValueError(f"worker_id 超出范围 0..{self.max_worker}")
                key = f"{datacenter_id}:{worker_id}"
                if key in self.storage:
                    raise ValueError(f"机器 ID {key} 已被占用")
                self.storage[key] = True
                return (datacenter_id, worker_id)
            # 自动分配
            used = set(self.storage.keys())
            for dc in range(self.max_datacenter + 1):
                for w in range(self.max_worker + 1):
                    key = f"{dc}:{w}"
                    if key not in used:
                        self.storage[key] = True
                        return (dc, w)
            raise RuntimeError("机器 ID 已用尽")

    def release(self, datacenter_id: int, worker_id: int) -> None:
        key = f"{datacenter_id}:{worker_id}"
        self.storage.pop(key, None)


# ---------------------------------------------------------------------------
# 4. 雪花 ID 生成器
# ---------------------------------------------------------------------------


class SnowflakeGenerator:
    """雪花 ID 生成器.

    布局: 1 sign | 41 ts | 5 dc | 5 worker | 12 seq
    """

    def __init__(
        self,
        datacenter_id: int = 0,
        worker_id: int = 0,
        datacenter_bits: int = 5,
        worker_bits: int = 5,
        seq_bits: int = 12,
        epoch_ms: int = 0,
        clock: Clock | None = None,
        on_clock_skew: str = "wait",
        recent_cache_size: int = 10000,
    ):
        self.datacenter_bits = datacenter_bits
        self.worker_bits = worker_bits
        self.seq_bits = seq_bits
        self.worker_shift = seq_bits
        self.datacenter_shift = seq_bits + worker_bits
        self.timestamp_shift = seq_bits + worker_bits + datacenter_bits
        self.max_seq = (1 << seq_bits) - 1
        self.max_worker = (1 << worker_bits) - 1
        self.max_datacenter = (1 << datacenter_bits) - 1
        if not (0 <= datacenter_id <= self.max_datacenter):
            raise ValueError(f"datacenter_id 超出范围 0..{self.max_datacenter}")
        if not (0 <= worker_id <= self.max_worker):
            raise ValueError(f"worker_id 超出范围 0..{self.max_worker}")
        self.datacenter_id = datacenter_id
        self.worker_id = worker_id
        self.epoch_ms = epoch_ms
        self.clock = clock or SystemClock()
        # on_clock_skew: "wait" | "error" | "ignore"
        self.on_clock_skew = on_clock_skew
        # 内部状态
        self._last_ts = -1
        self._seq = 0
        self._lock = threading.Lock()
        # 最近 ID 缓存 (用于跨机房冲突检测)
        self._recent: deque = deque(maxlen=recent_cache_size)
        # 监控
        self.metrics = {
            "generated": 0,
            "clock_skew_rejected": 0,
            "clock_skew_waited_ms": 0,
            "seq_exhausted_waited": 0,
            "duplicate_detected": 0,
        }

    # -----------------------------------------------------------------------

    def _current_ts(self) -> int:
        return self.clock.now_ms() - self.epoch_ms

    def _wait_next_ms(self, target_ts: int) -> int:
        """等到下一个 ms."""
        # 实际部署中可用 sleep, 测试中 mock 时直接读
        while self.clock.now_ms() - self.epoch_ms <= target_ts:
            pass
        return self.clock.now_ms() - self.epoch_ms

    # -----------------------------------------------------------------------

    def next_id(self) -> int:
        """生成下一个 ID."""
        with self._lock:
            now = self._current_ts()
            # 时钟回拨检测
            if now < self._last_ts:
                self.metrics["clock_skew_rejected"] += 1
                skew = self._last_ts - now
                if self.on_clock_skew == "error":
                    raise ClockSkewError(f"时钟回拨 {skew} ms (last={self._last_ts}, now={now})")
                elif self.on_clock_skew == "wait":
                    # 等待时钟追上
                    self._last_ts = self._wait_next_ms(self._last_ts)
                    self.metrics["clock_skew_waited_ms"] += skew
                    now = self._last_ts
                # ignore: 继续用旧时间戳, 可能产生重复, 由 recent_cache 检测
            if now == self._last_ts:
                self._seq = (self._seq + 1) & self.max_seq
                if self._seq == 0:
                    # 序列号耗尽, 等到下一 ms
                    self.metrics["seq_exhausted_waited"] += 1
                    self._last_ts = self._wait_next_ms(self._last_ts)
                    now = self._last_ts
            else:
                self._seq = 0
                self._last_ts = now
            # 组装 ID
            rid = (
                (now << self.timestamp_shift)
                | (self.datacenter_id << self.datacenter_shift)
                | (self.worker_id << self.worker_shift)
                | self._seq
            )
            # 冲突检测
            if rid in self._recent:
                self.metrics["duplicate_detected"] += 1
                raise DuplicateIdError(f"生成了重复 ID: {rid}")
            self._recent.append(rid)
            self.metrics["generated"] += 1
            return rid

    # -----------------------------------------------------------------------

    def parse(self, rid: int) -> dict:
        """解析 ID 各字段."""
        seq = rid & self.max_seq
        worker = (rid >> self.worker_shift) & self.max_worker
        dc = (rid >> self.datacenter_shift) & self.max_datacenter
        ts = (rid >> self.timestamp_shift) & ((1 << 41) - 1)
        return {
            "id": rid,
            "timestamp_ms": ts,
            "datacenter_id": dc,
            "worker_id": worker,
            "sequence": seq,
        }

    def report(self) -> dict:
        return {
            "datacenter_id": self.datacenter_id,
            "worker_id": self.worker_id,
            "metrics": dict(self.metrics),
            "recent_size": len(self._recent),
        }

    def reset(self) -> None:
        with self._lock:
            self._last_ts = -1
            self._seq = 0
            self._recent.clear()
            for k in self.metrics:
                self.metrics[k] = 0


# ---------------------------------------------------------------------------
# 5. 跨机房冲突检测器 (独立组件, 用于分布式场景)
# ---------------------------------------------------------------------------


class CrossDCConflictChecker:
    """跨机房冲突检测器.

    收集多个机房上报的 ID, 检测是否有冲突.
    使用滑动窗口只保留最近 N 个 ID.
    """

    def __init__(self, window_size: int = 100000):
        self.window_size = window_size
        self._ids: deque = deque(maxlen=window_size)
        self._seen: dict = {}
        self.duplicates: list = []

    def record(self, rid: int) -> bool:
        """记录 ID, 返回 True 表示新 ID, False 表示重复."""
        if rid in self._seen:
            count = self._seen[rid]
            self._seen[rid] = count + 1
            if count == 1:  # 第一次发现重复
                self.duplicates.append(rid)
            return False
        self._seen[rid] = 1
        self._ids.append(rid)
        # 淘汰最老的
        if len(self._ids) == self.window_size:
            old = self._ids[0]
            cnt = self._seen[old]
            if cnt == 1:
                del self._seen[old]
            else:
                self._seen[old] = cnt - 1
        return True

    def report(self) -> dict:
        return {
            "window_size": self.window_size,
            "current_size": len(self._ids),
            "unique_count": len(self._seen),
            "duplicate_count": len(self.duplicates),
        }


# ---------------------------------------------------------------------------
# 6. ID 工厂 (组合 assigner + generator)
# ---------------------------------------------------------------------------


class IdFactory:
    """ID 工厂: 自动分配机器 ID + 生成 ID."""

    def __init__(self, assigner: MachineIdAssigner | None = None, clock: Clock | None = None, epoch_ms: int = 0):
        self.assigner = assigner or MachineIdAssigner()
        self.clock = clock
        self.epoch_ms = epoch_ms
        self._generator: SnowflakeGenerator | None = None
        self._dc: int = 0
        self._worker: int = 0

    def start(self, datacenter_id: int | None = None, worker_id: int | None = None) -> None:
        self._dc, self._worker = self.assigner.assign(datacenter_id, worker_id)
        self._generator = SnowflakeGenerator(
            datacenter_id=self._dc,
            worker_id=self._worker,
            epoch_ms=self.epoch_ms,
            clock=self.clock,
        )

    def next_id(self) -> int:
        if self._generator is None:
            self.start()
        return self._generator.next_id()  # type: ignore[union-attr]

    def parse(self, rid: int) -> dict:
        if self._generator is None:
            raise RuntimeError("工厂未启动")
        return self._generator.parse(rid)

    def report(self) -> dict:
        if self._generator is None:
            return {"started": False}
        return {
            "started": True,
            "machine": {"datacenter_id": self._dc, "worker_id": self._worker},
            "metrics": self._generator.report(),
        }


# ---------------------------------------------------------------------------
# 7. CLI
# ---------------------------------------------------------------------------


def _demo() -> dict:
    assigner = MachineIdAssigner()
    clock = MockClock(start_ms=1700000000000)
    factory = IdFactory(assigner=assigner, clock=clock, epoch_ms=1700000000000)
    factory.start()
    ids = [factory.next_id() for _ in range(5)]
    checker = CrossDCConflictChecker()
    for rid in ids:
        checker.record(rid)
    parsed = [factory.parse(rid) for rid in ids]
    return {
        "ids": ids,
        "parsed": parsed,
        "all_unique": len(set(ids)) == len(ids),
        "checker": checker.report(),
        "factory": factory.report(),
    }


def main(argv: list[str] | None = None) -> int:
    import argparse

    p = argparse.ArgumentParser(description="全局 ID 生成器 (雪花)")
    sub = p.add_subparsers(dest="cmd", required=True)
    sub.add_parser("demo")
    args = p.parse_args(argv)
    if args.cmd == "demo":
        out = _demo()
        print(json.dumps(out, ensure_ascii=False, indent=2, default=str))
        return 0
    return 1


if __name__ == "__main__":
    import sys

    sys.exit(main())
