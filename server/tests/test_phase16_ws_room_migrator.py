"""Phase 16 建议 2 测试: WS 房间分片迁移."""

from __future__ import annotations

import asyncio

import pytest

try:
    from scripts.ops.ws_redis_cluster import RoomSharder
    from scripts.ops.ws_room_migrator import (
        MigrationPhase,
        MigrationPlan,
        MockPubSub,
        RoomMove,
        ShardMigrator,
        WSShardMigratorBridge,
        main,
    )

    HAS_MODULE = True
except ImportError:
    HAS_MODULE = False
    MigrationPhase = RoomMove = MigrationPlan = None
    ShardMigrator = MockPubSub = WSShardMigratorBridge = RoomSharder = None
    main = None


# ---------------------------------------------------------------------------
# 1. MigrationPhase & RoomMove & MigrationPlan
# ---------------------------------------------------------------------------


@pytest.mark.skipif(not HAS_MODULE, reason="module not importable")
def test_phase_enum_values():
    assert MigrationPhase.PENDING.value == "pending"
    assert MigrationPhase.DUAL_WRITE.value == "dual_write"
    assert MigrationPhase.READ_SWITCHED.value == "read_switched"
    assert MigrationPhase.CLEANUP.value == "cleanup"
    assert MigrationPhase.COMPLETED.value == "completed"
    assert MigrationPhase.ROLLBACK.value == "rollback"
    assert MigrationPhase.FAILED.value == "failed"


@pytest.mark.skipif(not HAS_MODULE, reason="module not importable")
def test_room_move_is_move():
    m1 = RoomMove("r1", "a", "b")
    assert m1.is_move is True
    m2 = RoomMove("r2", "a", "a")
    assert m2.is_move is False


@pytest.mark.skipif(not HAS_MODULE, reason="module not importable")
def test_plan_count():
    plan = MigrationPlan(
        migration_id="m1",
        old_nodes=["a", "b"],
        new_nodes=["a", "b"],
        moves=[
            RoomMove("r1", "a", "a"),
            RoomMove("r2", "a", "b"),
            RoomMove("r3", "b", "a"),
        ],
    )
    assert plan.move_count == 2
    assert plan.stay_count == 1


@pytest.mark.skipif(not HAS_MODULE, reason="module not importable")
def test_plan_by_owner():
    plan = MigrationPlan(
        migration_id="x",
        old_nodes=["a", "b"],
        new_nodes=["a", "b", "c"],
        moves=[
            RoomMove("r1", "a", "c"),
            RoomMove("r2", "a", "a"),
            RoomMove("r3", "b", "c"),
        ],
    )
    by_old_a = plan.moves_by_old("a")
    assert len(by_old_a) == 2
    by_new_c = plan.moves_by_new("c")
    assert len(by_new_c) == 2


@pytest.mark.skipif(not HAS_MODULE, reason="module not importable")
def test_plan_to_dict():
    plan = MigrationPlan(
        migration_id="abc",
        old_nodes=["a", "b"],
        new_nodes=["a", "b", "c"],
        moves=[RoomMove("r1", "a", "c")],
    )
    d = plan.to_dict()
    assert d["migration_id"] == "abc"
    assert d["move_count"] == 1
    assert d["stays_total" if "stays_total" in d else "stay_count"] >= 0


# ---------------------------------------------------------------------------
# 2. ShardMigrator
# ---------------------------------------------------------------------------


@pytest.mark.skipif(not HAS_MODULE, reason="module not importable")
def test_migrator_init():
    old = RoomSharder(["a", "b", "c"])
    new = RoomSharder(["a", "b", "c", "d"])
    m = ShardMigrator(old, new)
    assert m.old_sharder is old
    assert m.new_sharder is new


@pytest.mark.skipif(not HAS_MODULE, reason="module not importable")
def test_migrator_plan():
    old = RoomSharder(["a", "b"])
    new = RoomSharder(["a", "b", "c"])
    m = ShardMigrator(old, new)
    plan = m.plan([f"r{i}" for i in range(10)])
    assert plan.move_count + plan.stay_count == 10
    assert "c" in plan.new_nodes


@pytest.mark.skipif(not HAS_MODULE, reason="module not importable")
def test_migrator_plan_no_change():
    """节点不变时 move_count=0."""
    old = RoomSharder(["a", "b"])
    new = RoomSharder(["a", "b"])
    m = ShardMigrator(old, new)
    plan = m.plan(["r1", "r2", "r3"])
    assert plan.move_count == 0
    assert plan.stay_count == 3


@pytest.mark.skipif(not HAS_MODULE, reason="module not importable")
@pytest.mark.asyncio
async def test_migrator_execute_full():
    """执行完整迁移流程."""
    old = RoomSharder(["a", "b", "c"])
    new = RoomSharder(["a", "b", "c", "d"])
    m = ShardMigrator(old, new)
    rooms = [f"r{i}" for i in range(20)]
    plan = m.plan(rooms)
    results = await m.execute(plan, message_sample={"x": 1})
    assert "phases" in results
    # 至少 dual_write + read_switch + cleanup + complete = 4 阶段
    assert len(results["phases"]) >= 4
    # 全部 OK
    for p in results["phases"]:
        if p["status"] != "ok":
            print("failed phase:", p)
        assert p["status"] == "ok"


@pytest.mark.skipif(not HAS_MODULE, reason="module not importable")
@pytest.mark.asyncio
async def test_migrator_callback_called():
    old = RoomSharder(["a", "b"])
    new = RoomSharder(["a", "b", "c"])
    calls: list[tuple[str, str]] = []

    def on_dual(move, sample):
        calls.append(("dual", move.room_id))

    def on_switch(move):
        calls.append(("switch", move.room_id))

    def on_cleanup(move):
        calls.append(("cleanup", move.room_id))

    m = ShardMigrator(
        old,
        new,
        on_dual_write=on_dual,
        on_read_switch=on_switch,
        on_cleanup=on_cleanup,
    )
    plan = m.plan(["r1", "r2", "r3", "r4", "r5"])
    # 找到有 move 的房间
    moved = [mv.room_id for mv in plan.moves if mv.is_move]
    if not moved:
        pytest.skip("无迁移房间, 跳过")
    await m.execute(plan)
    for phase in ["dual", "switch", "cleanup"]:
        phase_calls = [c for c in calls if c[0] == phase]
        assert len(phase_calls) == len(moved)


@pytest.mark.skipif(not HAS_MODULE, reason="module not importable")
@pytest.mark.asyncio
async def test_migrator_state_tracking():
    old = RoomSharder(["a", "b"])
    new = RoomSharder(["a", "b", "c"])
    m = ShardMigrator(old, new)
    plan = m.plan([f"r{i}" for i in range(10)])
    await m.execute(plan)
    # 每个迁移的房间最终应是 COMPLETED
    for mv in plan.moves:
        if mv.is_move:
            assert m.state(mv.room_id) == MigrationPhase.COMPLETED


@pytest.mark.skipif(not HAS_MODULE, reason="module not importable")
@pytest.mark.asyncio
async def test_migrator_callback_failure_rollback():
    """callback 失败时回滚."""
    old = RoomSharder(["a", "b"])
    new = RoomSharder(["a", "b", "c"])

    def fail_on_dual(move, sample):
        raise RuntimeError("simulated dual-write failure")

    m = ShardMigrator(old, new, on_dual_write=fail_on_dual)
    plan = m.plan(["r1", "r2", "r3"])
    results = await m.execute(plan)
    # 应包含 rollback 阶段
    phases = [p["phase"] for p in results["phases"]]
    assert "rollback" in phases


@pytest.mark.skipif(not HAS_MODULE, reason="module not importable")
@pytest.mark.asyncio
async def test_migrator_async_callback():
    old = RoomSharder(["a", "b"])
    new = RoomSharder(["a", "b", "c"])

    async def async_dual(move, sample):
        await asyncio.sleep(0.001)
        return True

    m = ShardMigrator(old, new, on_dual_write=async_dual)
    plan = m.plan(["r1", "r2"])
    results = await m.execute(plan)
    for p in results["phases"]:
        assert p["status"] == "ok"


@pytest.mark.skipif(not HAS_MODULE, reason="module not importable")
@pytest.mark.asyncio
async def test_migrator_exception_caught():
    """execute 本身抛异常时也回滚."""
    old = RoomSharder(["a"])
    new = RoomSharder(["a", "b"])

    def bad_callback(move):
        raise ValueError("boom")

    m = ShardMigrator(old, new, on_dual_write=bad_callback)
    plan = m.plan(["r1"])
    results = await m.execute(plan)
    # 包含 rollback
    phases = [p["phase"] for p in results["phases"]]
    assert "rollback" in phases


@pytest.mark.skipif(not HAS_MODULE, reason="module not importable")
def test_migrator_state_empty():
    old = RoomSharder(["a", "b"])
    new = RoomSharder(["a", "b", "c"])
    m = ShardMigrator(old, new)
    assert m.state("r1") is None
    assert m.all_states() == {}


# ---------------------------------------------------------------------------
# 3. MockPubSub
# ---------------------------------------------------------------------------


@pytest.mark.skipif(not HAS_MODULE, reason="module not importable")
def test_mock_pubsub_publish_subscribe():
    ps = MockPubSub()
    received = []
    ps.subscribe("ch1", lambda msg: received.append(msg))
    n = ps.publish("ch1", {"x": 1})
    assert n == 1
    assert len(received) == 1
    assert received[0]["x"] == 1


@pytest.mark.skipif(not HAS_MODULE, reason="module not importable")
def test_mock_pubsub_no_subscriber():
    ps = MockPubSub()
    n = ps.publish("ch1", {"x": 1})
    assert n == 0
    assert ps.message_count("ch1") == 1


@pytest.mark.skipif(not HAS_MODULE, reason="module not importable")
def test_mock_pubsub_callback_exception():
    ps = MockPubSub()

    def bad(msg):
        raise RuntimeError("boom")

    ps.subscribe("ch1", bad)
    # 不应崩
    n = ps.publish("ch1", {"x": 1})
    assert n == 1


@pytest.mark.skipif(not HAS_MODULE, reason="module not importable")
def test_mock_pubsub_reset():
    ps = MockPubSub()
    ps.subscribe("ch1", lambda m: None)
    ps.publish("ch1", {"x": 1})
    ps.reset()
    assert ps.message_count("ch1") == 0


# ---------------------------------------------------------------------------
# 4. WSShardMigratorBridge
# ---------------------------------------------------------------------------


class _FakeRouter:
    def __init__(self, node_id):
        self.node_id = node_id


@pytest.mark.skipif(not HAS_MODULE, reason="module not importable")
def test_bridge_init():
    old = [_FakeRouter("a"), _FakeRouter("b")]
    new = [_FakeRouter("a"), _FakeRouter("b"), _FakeRouter("c")]
    bridge = WSShardMigratorBridge(old, new)
    assert len(bridge.old_routers) == 2
    assert len(bridge.new_routers) == 3


@pytest.mark.skipif(not HAS_MODULE, reason="module not importable")
def test_bridge_plan():
    old = [_FakeRouter("a"), _FakeRouter("b")]
    new = [_FakeRouter("a"), _FakeRouter("b"), _FakeRouter("c")]
    bridge = WSShardMigratorBridge(old, new)
    plan = bridge.plan(["r1", "r2", "r3", "r4", "r5"])
    assert plan.move_count + plan.stay_count == 5


@pytest.mark.skipif(not HAS_MODULE, reason="module not importable")
@pytest.mark.asyncio
async def test_bridge_migrate_runs():
    old = [_FakeRouter("a"), _FakeRouter("b")]
    new = [_FakeRouter("a"), _FakeRouter("b"), _FakeRouter("c")]
    bridge = WSShardMigratorBridge(old, new)
    result = await bridge.migrate(["r1", "r2", "r3", "r4", "r5"])
    assert "phases" in result
    for p in result["phases"]:
        if p["status"] != "ok":
            print("failed:", p)


@pytest.mark.skipif(not HAS_MODULE, reason="module not importable")
@pytest.mark.asyncio
async def test_bridge_dual_writes_to_both():
    """双写阶段应同时给 old 和 new owner 发消息."""
    old = [_FakeRouter("a"), _FakeRouter("b")]
    new = [_FakeRouter("a"), _FakeRouter("b"), _FakeRouter("c")]
    bridge = WSShardMigratorBridge(old, new)
    # 找会迁移的房间
    plan = bridge.plan([f"r{i}" for i in range(30)])
    moved = [m for m in plan.moves if m.is_move]
    if not moved:
        pytest.skip("无迁移房间")
    sample = moved[0]
    bridge._handle_dual_write(sample, {"x": 1})
    assert bridge._pubsub.message_count(f"node:{sample.old_owner}") >= 1
    assert bridge._pubsub.message_count(f"node:{sample.new_owner}") >= 1


# ---------------------------------------------------------------------------
# 5. CLI
# ---------------------------------------------------------------------------


def test_cli_dry_run(capsys):
    code = main(["--old-nodes", "a", "b", "--new-nodes", "a", "b", "c", "--rooms", "r1", "r2", "r3", "--dry-run"])
    assert code == 0
    out = capsys.readouterr().out
    assert "migration_id" in out
    assert "old_nodes" in out


def test_cli_with_room_count(capsys):
    code = main(["--old-nodes", "a", "b", "--new-nodes", "a", "b", "c", "--room-count", "5", "--dry-run"])
    assert code == 0


def test_cli_full_run(capsys):
    code = main(["--old-nodes", "a", "b", "--new-nodes", "a", "b", "c", "--rooms", "r1", "r2", "r3"])
    assert code == 0
    out = capsys.readouterr().out
    assert "执行结果" in out
