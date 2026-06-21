"""Phase 20 建议 2: 事件溯源 - Event Store + 投影 + 重放.

目的:
  - 事件不可变追加存储
  - 聚合根 (aggregate) 加载 + 版本控制
  - 快照优化
  - 投影 (projection) 实时构建查询模型
  - 重放 (replay) 从某版本/某时间起
  - 乐观锁 (版本冲突检测)

设计:
  StoredEvent:
    id, type, aggregate_id, payload, version, ts, prev_version

  EventStore:
    append / load(aggregate_id) / load_all / get_by_id / count

  AggregateSnapshot:
    aggregate_id, version, state, ts

  SnapshotStore:
    save(aggregate_id, version, state) / load(aggregate_id)

  Projection:
    name, reduce(state, event) -> state
    apply(state, events) -> state

  EventBus:
    subscribe(type, handler)
    publish(event) -> 调 handlers

  ReplayEngine:
    replay(projection, from_version, from_ts) -> projection
"""

from __future__ import annotations

import json
import time
import uuid
from collections import defaultdict
from collections.abc import Callable
from dataclasses import dataclass, field
from typing import Any

# ---------------------------------------------------------------------------
# 1. 枚举 / 数据类
# ---------------------------------------------------------------------------


class ConflictError(Exception):
    pass


@dataclass
class StoredEvent:
    id: str
    type: str
    aggregate_id: str
    payload: dict = field(default_factory=dict)
    version: int = 1
    ts: float = field(default_factory=time.time)
    prev_version: int = 0  # 0 表示新 aggregate
    metadata: dict = field(default_factory=dict)

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "type": self.type,
            "aggregate_id": self.aggregate_id,
            "payload": self.payload,
            "version": self.version,
            "ts": self.ts,
            "ts_iso": time.strftime("%Y-%m-%d %H:%M:%S", time.localtime(self.ts)),
            "prev_version": self.prev_version,
            "metadata": self.metadata,
        }


@dataclass
class AggregateSnapshot:
    aggregate_id: str
    version: int
    state: dict
    ts: float = field(default_factory=time.time)

    def to_dict(self) -> dict:
        return {
            "aggregate_id": self.aggregate_id,
            "version": self.version,
            "state": self.state,
            "ts": self.ts,
        }


# ---------------------------------------------------------------------------
# 2. EventStore
# ---------------------------------------------------------------------------


class EventStore:
    """事件存储 (内存版)."""

    def __init__(self):
        self._events: list[StoredEvent] = []
        self._by_agg: dict[str, list[StoredEvent]] = defaultdict(list)
        self._by_id: dict[str, StoredEvent] = {}

    def append(self, event: StoredEvent) -> StoredEvent:
        # 乐观锁: 检查同 aggregate 的最后一个事件
        if not event.id:
            event.id = str(uuid.uuid4())
        existing = self._by_agg.get(event.aggregate_id, [])
        if existing:
            last = existing[-1]
            if event.prev_version != last.version:
                raise ConflictError(
                    f"version conflict on {event.aggregate_id}: "
                    f"expected prev_version={last.version}, got {event.prev_version}"
                )
            event.version = last.version + 1
        self._events.append(event)
        self._by_agg[event.aggregate_id].append(event)
        self._by_id[event.id] = event
        return event

    def load(self, aggregate_id: str) -> list[StoredEvent]:
        return list(self._by_agg.get(aggregate_id, []))

    def load_all(self) -> list[StoredEvent]:
        return list(self._events)

    def get(self, event_id: str) -> StoredEvent | None:
        return self._by_id.get(event_id)

    def count(self) -> int:
        return len(self._events)

    def latest_version(self, aggregate_id: str) -> int:
        events = self._by_agg.get(aggregate_id, [])
        return events[-1].version if events else 0

    def query(
        self,
        event_type: str | None = None,
        aggregate_id: str | None = None,
        from_ts: float | None = None,
        to_ts: float | None = None,
    ) -> list[StoredEvent]:
        out = []
        for e in self._events:
            if event_type and e.type != event_type:
                continue
            if aggregate_id and e.aggregate_id != aggregate_id:
                continue
            if from_ts and e.ts < from_ts:
                continue
            if to_ts and e.ts > to_ts:
                continue
            out.append(e)
        return out

    def clear(self) -> None:
        self._events.clear()
        self._by_agg.clear()
        self._by_id.clear()


# ---------------------------------------------------------------------------
# 3. SnapshotStore
# ---------------------------------------------------------------------------


class SnapshotStore:
    """聚合快照."""

    def __init__(self, every: int = 5):
        self.every = every  # 每 N 个事件保存一次
        self._snaps: dict[str, AggregateSnapshot] = {}

    def save(self, aggregate_id: str, version: int, state: dict) -> AggregateSnapshot:
        snap = AggregateSnapshot(aggregate_id=aggregate_id, version=version, state=dict(state))
        self._snaps[aggregate_id] = snap
        return snap

    def load(self, aggregate_id: str) -> AggregateSnapshot | None:
        return self._snaps.get(aggregate_id)

    def all(self) -> list[AggregateSnapshot]:
        return list(self._snaps.values())

    def clear(self) -> None:
        self._snaps.clear()


# ---------------------------------------------------------------------------
# 4. Projection
# ---------------------------------------------------------------------------

Reducer = Callable[[Any, StoredEvent], Any]


class Projection:
    """投影: 从事件流构建查询模型."""

    def __init__(self, name: str, initial: Any = None, reducer: Reducer | None = None):
        self.name = name
        self.initial = initial if initial is not None else {}
        self.reducer = reducer
        self._state: Any = self._copy(self.initial)
        self._checkpoint_version: int = 0
        self._checkpoint_ts: float = 0.0

    def _copy(self, x: Any) -> Any:
        if isinstance(x, dict):
            return {k: self._copy(v) for k, v in x.items()}
        if isinstance(x, list):
            return [self._copy(v) for v in x]
        return x

    def apply(self, event: StoredEvent) -> None:
        if self.reducer is None:
            return
        self._state = self.reducer(self._state, event)
        self._checkpoint_version = event.version
        self._checkpoint_ts = event.ts

    def apply_many(self, events: list[StoredEvent]) -> None:
        for e in events:
            self.apply(e)

    def replay(self, store: EventStore, from_version: int = 0, from_ts: float | None = None) -> None:
        self._state = self._copy(self.initial)
        self._checkpoint_version = 0
        self._checkpoint_ts = 0.0
        for e in store.load_all():
            if e.version < from_version:
                continue
            if from_ts is not None and e.ts < from_ts:
                continue
            self.apply(e)

    def state(self) -> Any:
        return self._copy(self._state)

    def checkpoint(self) -> dict:
        return {
            "name": self.name,
            "version": self._checkpoint_version,
            "ts": self._checkpoint_ts,
        }


# ---------------------------------------------------------------------------
# 5. EventBus
# ---------------------------------------------------------------------------


class EventBus:
    """事件总线."""

    def __init__(self):
        self._handlers: dict[str, list[Callable[[StoredEvent], None]]] = defaultdict(list)

    def subscribe(self, event_type: str, handler: Callable[[StoredEvent], None]) -> None:
        self._handlers[event_type].append(handler)

    def unsubscribe(self, event_type: str, handler: Callable[[StoredEvent], None]) -> None:
        if handler in self._handlers.get(event_type, []):
            self._handlers[event_type].remove(handler)

    def publish(self, event: StoredEvent) -> None:
        for h in self._handlers.get(event.type, []):
            h(event)
        for h in self._handlers.get("*", []):
            h(event)


# ---------------------------------------------------------------------------
# 6. ReplayEngine
# ---------------------------------------------------------------------------


class ReplayEngine:
    """重放引擎."""

    def __init__(self, store: EventStore, snapshots: SnapshotStore | None = None):
        self.store = store
        self.snapshots = snapshots

    def replay_projection(
        self, projection: Projection, from_version: int = 0, from_ts: float | None = None, use_snapshots: bool = True
    ) -> None:
        # 先把 projection 重置到 initial (与无快照路径行为一致)
        projection._state = projection._copy(projection.initial)
        projection._checkpoint_version = 0
        projection._checkpoint_ts = 0.0
        # 如果启用快照, 先应用最新快照 (单 aggregate 场景)
        if use_snapshots and self.snapshots is not None:
            snaps = self.snapshots.all()
            if snaps:
                # 选 version 最大且 >= from_version 的快照
                best = None
                for snap in snaps:
                    if snap.version < from_version:
                        continue
                    if best is None or snap.version > best.version:
                        best = snap
                if best is not None:
                    projection._state = self._copy(best.state)
                    projection._checkpoint_version = best.version
                    projection._checkpoint_ts = best.ts
                    from_version = best.version + 1
        # 手动迭代事件 (不调 projection.replay, 避免重置)
        for e in self.store.load_all():
            if e.version < from_version:
                continue
            if from_ts is not None and e.ts < from_ts:
                continue
            projection.apply(e)

    def _copy(self, x: Any) -> Any:
        if isinstance(x, dict):
            return {k: self._copy(v) for k, v in x.items()}
        if isinstance(x, list):
            return [self._copy(v) for v in x]
        return x


# ---------------------------------------------------------------------------
# 7. CLI
# ---------------------------------------------------------------------------


def _user_reducer(state: dict, event: StoredEvent) -> dict:
    """用户聚合 reducer."""
    if event.type == "UserCreated":
        uid = event.aggregate_id
        state[uid] = {
            "name": event.payload.get("name"),
            "email": event.payload.get("email"),
            "status": "active",
            "updated_at": event.ts,
        }
    elif event.type == "UserRenamed":
        uid = event.aggregate_id
        if uid in state:
            state[uid]["name"] = event.payload.get("name")
            state[uid]["updated_at"] = event.ts
    elif event.type == "UserDeactivated":
        uid = event.aggregate_id
        if uid in state:
            state[uid]["status"] = "inactive"
    return state


def _demo() -> dict:
    store = EventStore()
    bus = EventBus()
    snaps = SnapshotStore(every=3)
    proj = Projection("users_view", initial={}, reducer=_user_reducer)
    # 订阅: 每次事件都应用到 projection
    bus.subscribe("*", lambda e: proj.apply(e))
    # 创建用户
    u1_created = store.append(
        StoredEvent(
            id="",
            type="UserCreated",
            aggregate_id="u1",
            payload={"name": "Alice", "email": "alice@example.com"},
        )
    )
    bus.publish(u1_created)
    u1_renamed = store.append(
        StoredEvent(
            id="",
            type="UserRenamed",
            aggregate_id="u1",
            payload={"name": "Alice Smith"},
            prev_version=u1_created.version,
        )
    )
    bus.publish(u1_renamed)
    u2_created = store.append(
        StoredEvent(
            id="",
            type="UserCreated",
            aggregate_id="u2",
            payload={"name": "Bob", "email": "bob@example.com"},
        )
    )
    bus.publish(u2_created)
    u1_deact = store.append(
        StoredEvent(
            id="",
            type="UserDeactivated",
            aggregate_id="u1",
            payload={},
            prev_version=u1_renamed.version,
        )
    )
    bus.publish(u1_deact)
    # 快照
    snaps.save("u1", u1_renamed.version, {"name": "Alice Smith"})
    # 重放
    engine = ReplayEngine(store, snaps)
    proj2 = Projection("users_view", initial={}, reducer=_user_reducer)
    engine.replay_projection(proj2, use_snapshots=False)
    return {
        "events": store.count(),
        "u1_events": len(store.load("u1")),
        "u1_latest_version": store.latest_version("u1"),
        "projection": proj.state(),
        "replayed": proj2.state(),
    }


def main(argv: list[str] | None = None) -> int:
    import argparse

    p = argparse.ArgumentParser(description="事件溯源")
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
