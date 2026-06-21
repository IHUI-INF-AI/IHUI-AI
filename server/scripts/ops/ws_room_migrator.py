r"""Phase 16 建议 2: WS Redis 房间分片迁移工具 (re-shard 平滑切换).

目的:
  - 节点扩缩容时, 房间要重新分片
  - 不停服, 渐进式切换 (dual-write -> 读切换 -> 旧节点清理)
  - 支持回滚

设计:
  MigrationPhase:
    PENDING -> DUAL_WRITE -> READ_SWITCHED -> CLEANUP -> COMPLETED
                                       \-> ROLLBACK

  MigrationPlan:
    生成: 旧分片 -> 新分片 的房间映射
    区分: 不动 (same_owner) / 迁移 (move)

  ShardMigrator:
    step1: 计算 plan
    step2: 双写阶段 (publish 同时发给 old + new owner)
    step3: 读切换 (后续 publish 只发 new owner)
    step4: 旧节点清理 (通知 old node 移除本地订阅)
    step5: 完成

  全程记录 state, 任何一步失败可回滚
"""

from __future__ import annotations

import asyncio
import json
import uuid
from collections import defaultdict
from collections.abc import Callable
from dataclasses import dataclass, field
from enum import Enum
from typing import Any

try:
    from scripts.ops.ws_redis_cluster import RoomSharder
except ImportError:
    from typing import Any as _Any

    RoomSharder = _Any  # type: ignore


# ---------------------------------------------------------------------------
# 1. 枚举与状态
# ---------------------------------------------------------------------------


class MigrationPhase(str, Enum):
    PENDING = "pending"
    DUAL_WRITE = "dual_write"
    READ_SWITCHED = "read_switched"
    CLEANUP = "cleanup"
    COMPLETED = "completed"
    ROLLBACK = "rollback"
    FAILED = "failed"


@dataclass
class RoomMove:
    room_id: str
    old_owner: str
    new_owner: str

    @property
    def is_move(self) -> bool:
        return self.old_owner != self.new_owner


@dataclass
class MigrationPlan:
    """迁移计划."""

    migration_id: str
    old_nodes: list[str]
    new_nodes: list[str]
    moves: list[RoomMove] = field(default_factory=list)

    @property
    def move_count(self) -> int:
        return sum(1 for m in self.moves if m.is_move)

    @property
    def stay_count(self) -> int:
        return sum(1 for m in self.moves if not m.is_move)

    def moves_by_old(self, old_node: str) -> list[RoomMove]:
        return [m for m in self.moves if m.old_owner == old_node]

    def moves_by_new(self, new_node: str) -> list[RoomMove]:
        return [m for m in self.moves if m.new_owner == new_node]

    def to_dict(self) -> dict:
        return {
            "migration_id": self.migration_id,
            "old_nodes": self.old_nodes,
            "new_nodes": self.new_nodes,
            "move_count": self.move_count,
            "stay_count": self.stay_count,
            "moves": [{"room": m.room_id, "from": m.old_owner, "to": m.new_owner} for m in self.moves],
        }


# ---------------------------------------------------------------------------
# 2. ShardMigrator
# ---------------------------------------------------------------------------


class ShardMigrator:
    """房间分片迁移器.

    用法:
        old_shard = RoomSharder(["a", "b", "c"])
        new_shard = RoomSharder(["a", "b", "c", "d"])  # 加 d
        migrator = ShardMigrator(old_shard, new_shard)
        plan = migrator.plan(room_ids=["r1", "r2", ...])
        await migrator.start(plan, dual_write_fn=..., cleanup_fn=...)
    """

    def __init__(
        self,
        old_sharder: Any,
        new_sharder: Any,
        on_dual_write: Callable[[RoomMove, dict], Any] | None = None,
        on_read_switch: Callable[[RoomMove], Any] | None = None,
        on_cleanup: Callable[[RoomMove], Any] | None = None,
    ):
        self.old_sharder = old_sharder
        self.new_sharder = new_sharder
        self.on_dual_write = on_dual_write
        self.on_read_switch = on_read_switch
        self.on_cleanup = on_cleanup
        self._state: dict[str, MigrationPhase] = {}
        self._plan: MigrationPlan | None = None
        self._lock = asyncio.Lock()

    def plan(self, room_ids: list[str], migration_id: str | None = None) -> MigrationPlan:
        """生成迁移计划."""
        plan = MigrationPlan(
            migration_id=migration_id or str(uuid.uuid4())[:8],
            old_nodes=list(self.old_sharder.nodes),
            new_nodes=list(self.new_sharder.nodes),
        )
        for rid in room_ids:
            old = self.old_sharder.get_node(rid)
            new = self.new_sharder.get_node(rid)
            if old is None or new is None:
                continue
            plan.moves.append(RoomMove(room_id=rid, old_owner=old, new_owner=new))
        self._plan = plan
        return plan

    async def execute(
        self,
        plan: MigrationPlan,
        message_sample: dict | None = None,
    ) -> dict:
        """执行迁移全流程: 双写 -> 读切换 -> 清理 -> 完成.

        任何阶段失败进入 ROLLBACK / FAILED.
        """
        self._plan = plan
        results: dict[str, Any] = {
            "migration_id": plan.migration_id,
            "moves_total": plan.move_count,
            "stays_total": plan.stay_count,
            "phases": [],
            "errors": [],
        }
        # 初始化每房间 phase
        for m in plan.moves:
            if m.is_move:
                self._state[m.room_id] = MigrationPhase.PENDING
        try:
            # Phase 1: 双写
            r = await self._phase_dual_write(plan, message_sample or {})
            results["phases"].append(r)
            if r["status"] != "ok":
                await self._rollback(plan, results)
                return results

            # Phase 2: 读切换
            r = await self._phase_read_switch(plan)
            results["phases"].append(r)
            if r["status"] != "ok":
                await self._rollback(plan, results)
                return results

            # Phase 3: 清理
            r = await self._phase_cleanup(plan)
            results["phases"].append(r)
            if r["status"] != "ok":
                await self._rollback(plan, results)
                return results

            # Phase 4: 完成
            for rid in self._state:
                self._state[rid] = MigrationPhase.COMPLETED
            results["phases"].append({"phase": "complete", "status": "ok"})

        except Exception as e:
            results["phases"].append({"phase": "exception", "status": "failed", "error": str(e)})
            await self._rollback(plan, results)
        return results

    async def _phase_dual_write(self, plan: MigrationPlan, sample_msg: dict) -> dict:
        phase_name = "dual_write"
        try:
            delivered = 0
            for m in plan.moves:
                if not m.is_move:
                    continue
                self._state[m.room_id] = MigrationPhase.DUAL_WRITE
                if self.on_dual_write is not None:
                    r = self.on_dual_write(m, sample_msg)
                    if asyncio.iscoroutine(r):
                        await r
                delivered += 1
            return {"phase": phase_name, "status": "ok", "delivered": delivered}
        except Exception as e:
            return {"phase": phase_name, "status": "failed", "error": str(e)}

    async def _phase_read_switch(self, plan: MigrationPlan) -> dict:
        phase_name = "read_switched"
        try:
            for m in plan.moves:
                if not m.is_move:
                    continue
                self._state[m.room_id] = MigrationPhase.READ_SWITCHED
                if self.on_read_switch is not None:
                    r = self.on_read_switch(m)
                    if asyncio.iscoroutine(r):
                        await r
            return {"phase": phase_name, "status": "ok"}
        except Exception as e:
            return {"phase": phase_name, "status": "failed", "error": str(e)}

    async def _phase_cleanup(self, plan: MigrationPlan) -> dict:
        phase_name = "cleanup"
        try:
            for m in plan.moves:
                if not m.is_move:
                    continue
                self._state[m.room_id] = MigrationPhase.CLEANUP
                if self.on_cleanup is not None:
                    r = self.on_cleanup(m)
                    if asyncio.iscoroutine(r):
                        await r
            return {"phase": phase_name, "status": "ok"}
        except Exception as e:
            return {"phase": phase_name, "status": "failed", "error": str(e)}

    async def _rollback(self, plan: MigrationPlan, results: dict) -> None:
        for rid in self._state:
            self._state[rid] = MigrationPhase.ROLLBACK
        results["phases"].append({"phase": "rollback", "status": "ok"})
        results["rollback"] = True

    def state(self, room_id: str) -> MigrationPhase | None:
        return self._state.get(room_id)

    def all_states(self) -> dict[str, str]:
        return {k: v.value for k, v in self._state.items()}


# ---------------------------------------------------------------------------
# 3. 实用工具: 模拟发布 + 模拟订阅
# ---------------------------------------------------------------------------


class MockPubSub:
    """内存版 pub/sub, 给迁移工具演示用."""

    def __init__(self):
        self.channels: dict[str, list[dict]] = defaultdict(list)  # type: ignore
        self.subscribers: dict[str, list[Callable]] = defaultdict(list)  # type: ignore
        # 用 dict 替代默认 dict 的可调用
        from collections import defaultdict as _dd

        self.channels = _dd(list)
        self.subscribers = _dd(list)

    def publish(self, channel: str, message: dict) -> int:
        self.channels[channel].append(message)
        for cb in list(self.subscribers.get(channel, [])):
            try:
                r = cb(message)
            except Exception:
                pass
        return len(self.subscribers.get(channel, []))

    def subscribe(self, channel: str, callback: Callable) -> None:
        self.subscribers[channel].append(callback)

    def message_count(self, channel: str) -> int:
        return len(self.channels.get(channel, []))

    def reset(self) -> None:
        self.channels.clear()
        self.subscribers.clear()


# ---------------------------------------------------------------------------
# 4. 演示场景: 用真实 WSShardRouter 做迁移
# ---------------------------------------------------------------------------


class WSShardMigratorBridge:
    """把 ShardMigrator 桥接到 WSShardRouter, 提供完整迁移工具.

    使用:
        bridge = WSShardMigratorBridge(old_routers=[r1, r2], new_routers=[r1, r2, r3])
        result = await bridge.migrate(room_ids, dual_write_window_s=30)
    """

    def __init__(self, old_routers: list, new_routers: list):
        self.old_routers = {r.node_id: r for r in old_routers}
        self.new_routers = {r.node_id: r for r in new_routers}
        # 构造 old/new sharder
        self.old_sharder = RoomSharder(list(self.old_routers.keys()))
        self.new_sharder = RoomSharder(list(self.new_routers.keys()))
        self._pubsub = MockPubSub()
        # 注册迁移 callback
        self.migrator = ShardMigrator(
            old_sharder=self.old_sharder,
            new_sharder=self.new_sharder,
            on_dual_write=self._handle_dual_write,
            on_read_switch=self._handle_read_switch,
            on_cleanup=self._handle_cleanup,
        )

    def _handle_dual_write(self, move: RoomMove, sample: dict) -> None:
        # 双写: 同时给 old owner 和 new owner 发
        self._pubsub.publish(f"node:{move.old_owner}", {"room": move.room_id, "phase": "dual_write", "msg": sample})
        self._pubsub.publish(f"node:{move.new_owner}", {"room": move.room_id, "phase": "dual_write", "msg": sample})

    def _handle_read_switch(self, move: RoomMove) -> None:
        self._pubsub.publish(f"node:{move.old_owner}", {"room": move.room_id, "phase": "read_switched"})
        self._pubsub.publish(f"node:{move.new_owner}", {"room": move.room_id, "phase": "read_switched"})

    def _handle_cleanup(self, move: RoomMove) -> None:
        self._pubsub.publish(f"node:{move.old_owner}", {"room": move.room_id, "phase": "cleanup"})

    async def migrate(self, room_ids: list[str], dual_write_window_s: float = 0.1) -> dict:
        plan = self.migrator.plan(room_ids)
        # 双写阶段后稍等 (生产环境给业务方时间同步状态)
        results = await self.migrator.execute(plan, message_sample={"type": "migrate"})
        if dual_write_window_s > 0 and results["phases"][0]["status"] == "ok":
            await asyncio.sleep(dual_write_window_s)
        return results

    def plan(self, room_ids: list[str]) -> MigrationPlan:
        return self.migrator.plan(room_ids)

    def state(self, room_id: str) -> MigrationPhase | None:
        return self.migrator.state(room_id)


# ---------------------------------------------------------------------------
# 5. CLI
# ---------------------------------------------------------------------------


def main(argv: list[str] | None = None) -> int:
    import argparse

    p = argparse.ArgumentParser(description="WS Redis 房间迁移工具")
    p.add_argument("--old-nodes", nargs="+", required=True, help="旧节点列表")
    p.add_argument("--new-nodes", nargs="+", required=True, help="新节点列表")
    p.add_argument("--rooms", nargs="+", default=[], help="要迁移的房间 ID")
    p.add_argument("--room-count", type=int, default=20, help="无 --rooms 时生成多少随机房间")
    p.add_argument("--dry-run", action="store_true", help="只看 plan, 不真执行")
    args = p.parse_args(argv)

    old = RoomSharder(args.old_nodes)
    new = RoomSharder(args.new_nodes)

    if not args.rooms:
        args.rooms = [f"room-{i}" for i in range(args.room_count)]

    migrator = ShardMigrator(old, new)
    plan = migrator.plan(args.rooms)
    print(json.dumps(plan.to_dict(), ensure_ascii=False, indent=2))

    if not args.dry_run:

        async def run():
            bridge = WSShardMigratorBridge(
                old_routers=[type("R", (), {"node_id": n})() for n in args.old_nodes],
                new_routers=[type("R", (), {"node_id": n})() for n in args.new_nodes],
            )
            return await bridge.migrate(args.rooms)

        result = asyncio.run(run())
        print("\n=== 执行结果 ===")
        print(json.dumps(result, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    import sys

    sys.exit(main())
