"""Phase 15 建议 4 测试: WS Redis 集群化 (房间分片 + 跨节点 pub/sub + 断线重连)."""

from __future__ import annotations

import pytest

try:
    from scripts.ops.ws_redis_cluster import (
        REDIS_AVAILABLE,
        ReconnectPolicy,
        RedisPubSub,
        RoomSharder,
        WSShardRouter,
        main,
    )

    HAS_MODULE = True
except ImportError:
    HAS_MODULE = False
    RoomSharder = RedisPubSub = WSShardRouter = ReconnectPolicy = None
    REDIS_AVAILABLE = False
    main = None


# ---------------------------------------------------------------------------
# 1. RoomSharder
# ---------------------------------------------------------------------------


@pytest.mark.skipif(not HAS_MODULE, reason="module not importable")
def test_sharder_init_empty():
    s = RoomSharder()
    assert s.nodes == []
    assert s.get_node("any") is None


@pytest.mark.skipif(not HAS_MODULE, reason="module not importable")
def test_sharder_add_remove():
    s = RoomSharder()
    s.add_node("a")
    s.add_node("b")
    s.add_node("c")
    assert len(s.nodes) == 3
    s.remove_node("b")
    assert "b" not in s.nodes
    assert len(s.nodes) == 2


@pytest.mark.skipif(not HAS_MODULE, reason="module not importable")
def test_sharder_add_idempotent():
    s = RoomSharder()
    s.add_node("a")
    s.add_node("a")
    assert s.nodes == ["a"]


@pytest.mark.skipif(not HAS_MODULE, reason="module not importable")
def test_sharder_get_node_deterministic():
    s1 = RoomSharder(["a", "b", "c"])
    s2 = RoomSharder(["a", "b", "c"])
    for k in ["x", "y", "z", "room-42", "user:1"]:
        assert s1.get_node(k) == s2.get_node(k)


@pytest.mark.skipif(not HAS_MODULE, reason="module not importable")
def test_sharder_get_node_returns_known():
    s = RoomSharder(["a", "b", "c"])
    node = s.get_node("test-key")
    assert node in ["a", "b", "c"]


@pytest.mark.skipif(not HAS_MODULE, reason="module not importable")
def test_sharder_replicas_count():
    s = RoomSharder(["a", "b", "c", "d"])
    reps = s.get_replicas("key", 2)
    assert len(reps) == 2
    assert len(set(reps)) == 2  # 不重复


@pytest.mark.skipif(not HAS_MODULE, reason="module not importable")
def test_sharder_replicas_zero_count():
    s = RoomSharder(["a"])
    assert s.get_replicas("key", 0) == []


@pytest.mark.skipif(not HAS_MODULE, reason="module not importable")
def test_sharder_replicas_more_than_nodes():
    s = RoomSharder(["a"])
    reps = s.get_replicas("key", 5)
    # 节点不足时返回所有
    assert len(reps) == 1


@pytest.mark.skipif(not HAS_MODULE, reason="module not importable")
def test_sharder_distribution_reasonable():
    """1000 个 key 应大致均匀分布."""
    s = RoomSharder(["a", "b", "c", "d"])
    counts = dict.fromkeys(s.nodes, 0)
    for i in range(1000):
        n = s.get_node(f"key-{i}")
        counts[n] += 1
    # 没有任何节点应承担 80% 以上
    for n, c in counts.items():
        assert c < 800, f"node {n} has too much: {c}"


@pytest.mark.skipif(not HAS_MODULE, reason="module not importable")
def test_sharder_minimal_disruption():
    """增减节点应只影响少量 key."""
    s = RoomSharder(["a", "b", "c"])
    before = {f"k{i}": s.get_node(f"k{i}") for i in range(100)}
    s.add_node("d")
    after = {f"k{i}": s.get_node(f"k{i}") for i in range(100)}
    moved = sum(1 for k in before if before[k] != after[k])
    # 一致性哈希: 移动应 < 50%
    assert moved < 50


# ---------------------------------------------------------------------------
# 2. ReconnectPolicy
# ---------------------------------------------------------------------------


@pytest.mark.skipif(not HAS_MODULE, reason="module not importable")
def test_reconnect_init():
    rp = ReconnectPolicy()
    assert rp.attempts == 0
    assert rp.should_retry() is True


@pytest.mark.skipif(not HAS_MODULE, reason="module not importable")
def test_reconnect_delay_grows():
    rp = ReconnectPolicy(base_delay_s=0.1, max_delay_s=10.0, multiplier=2.0, jitter=0.0)
    d1 = rp.delay()
    d2 = rp.delay()
    assert d2 > d1


@pytest.mark.skipif(not HAS_MODULE, reason="module not importable")
def test_reconnect_max_retries():
    rp = ReconnectPolicy(max_retries=3, base_delay_s=0.1, max_delay_s=10.0, jitter=0.0)
    delays = [rp.delay() for _ in range(5)]
    # 第 4 次起应返回 -1
    assert delays[3] == -1.0


@pytest.mark.skipif(not HAS_MODULE, reason="module not importable")
def test_reconnect_reset():
    rp = ReconnectPolicy(max_retries=3, base_delay_s=0.1, max_delay_s=10.0, jitter=0.0)
    rp.delay()
    rp.delay()
    rp.reset()
    assert rp.attempts == 0
    assert rp.should_retry() is True


@pytest.mark.skipif(not HAS_MODULE, reason="module not importable")
def test_reconnect_should_retry():
    rp = ReconnectPolicy(max_retries=2)
    rp.delay()
    rp.delay()
    assert rp.should_retry() is False


# ---------------------------------------------------------------------------
# 3. RedisPubSub
# ---------------------------------------------------------------------------


@pytest.mark.skipif(not HAS_MODULE, reason="module not importable")
def test_redis_pubsub_init():
    p = RedisPubSub("redis://localhost:6379/0")
    assert p.url == "redis://localhost:6379/0"
    assert p._client is None


@pytest.mark.skipif(not HAS_MODULE, reason="module not importable")
@pytest.mark.asyncio
async def test_redis_pubsub_connect_unavailable(monkeypatch):
    """无 redis 时 connect 返回 False."""
    monkeypatch.setattr("scripts.ops.ws_redis_cluster.REDIS_AVAILABLE", False)
    p = RedisPubSub("redis://nope:6379/0")
    ok = await p.connect()
    assert ok is False


@pytest.mark.skipif(not HAS_MODULE, reason="module not importable")
@pytest.mark.asyncio
async def test_redis_pubsub_publish_no_connection(monkeypatch):
    """无连接时 publish 返回 0."""
    monkeypatch.setattr("scripts.ops.ws_redis_cluster.REDIS_AVAILABLE", False)
    p = RedisPubSub("redis://nope:6379/0")
    n = await p.publish("ch", {"a": 1})
    assert n == 0


@pytest.mark.skipif(not HAS_MODULE, reason="module not importable")
@pytest.mark.asyncio
async def test_redis_pubsub_close_safe():
    """close 在无连接时不崩."""
    p = RedisPubSub("redis://nope:6379/0")
    await p.close()
    assert p._client is None


# ---------------------------------------------------------------------------
# 4. WSShardRouter
# ---------------------------------------------------------------------------


@pytest.mark.skipif(not HAS_MODULE, reason="module not importable")
@pytest.mark.asyncio
async def test_router_init():
    s = RoomSharder(["a", "b", "c"])
    p = RedisPubSub("redis://nope:6379/0")
    r = WSShardRouter("a", s, p)
    assert r.node_id == "a"
    assert r.stats()["running"] is False


@pytest.mark.skipif(not HAS_MODULE, reason="module not importable")
@pytest.mark.asyncio
async def test_router_start_stop(monkeypatch):
    """无 redis 时 start 仍返回 True (本地模式)."""
    monkeypatch.setattr("scripts.ops.ws_redis_cluster.REDIS_AVAILABLE", False)
    s = RoomSharder(["a", "b"])
    p = RedisPubSub("redis://nope:6379/0")
    r = WSShardRouter("a", s, p)
    ok = await r.start()
    assert ok is True
    assert r.stats()["running"] is True
    await r.stop()
    assert r.stats()["running"] is False


@pytest.mark.skipif(not HAS_MODULE, reason="module not importable")
@pytest.mark.asyncio
async def test_router_subscribe_unsubscribe():
    s = RoomSharder(["a", "b"])
    p = RedisPubSub("redis://nope:6379/0")
    r = WSShardRouter("a", s, p)
    received = []

    async def cb(msg):
        received.append(msg)

    await r.subscribe("room1", cb)
    assert "room1" in r._local_subs
    await r.unsubscribe("room1", cb)
    assert "room1" not in r._local_subs


@pytest.mark.skipif(not HAS_MODULE, reason="module not importable")
@pytest.mark.asyncio
async def test_router_publish_local_owner(monkeypatch):
    """本节点负责房间时, 消息广播到本节点订阅者."""
    monkeypatch.setattr("scripts.ops.ws_redis_cluster.REDIS_AVAILABLE", False)
    s = RoomSharder(["a", "b"])
    p = RedisPubSub("redis://nope:6379/0")
    r = WSShardRouter("a", s, p)
    received = []

    async def cb(msg):
        received.append(msg)

    # 找一个属于 a 的房间
    target_room = None
    for k in ["r1", "r2", "r3", "r4", "r5", "r6", "r7", "r8", "r9", "r10"]:
        if s.get_node(k) == "a":
            target_room = k
            break
    if target_room is None:
        target_room = "r1"
        # 强制把 r1 放到 a
        s._nodes = ["a"]
        s._rebuild()
    await r.subscribe(target_room, cb)
    result = await r.publish(target_room, {"hello": "world"})
    assert result["local"] >= 1
    assert result["node"] == "a"
    assert len(received) == 1


@pytest.mark.skipif(not HAS_MODULE, reason="module not importable")
@pytest.mark.asyncio
async def test_router_publish_remote_owner(monkeypatch):
    """本节点不负责时, 走 Redis pub (无 redis 时 remote=0)."""
    monkeypatch.setattr("scripts.ops.ws_redis_cluster.REDIS_AVAILABLE", False)
    s = RoomSharder(["a", "b"])
    p = RedisPubSub("redis://nope:6379/0")
    r = WSShardRouter("a", s, p)
    # 找一个属于 b 的房间
    target_room = None
    for k in ["r1", "r2", "r3", "r4", "r5", "r6", "r7", "r8", "r9", "r10"]:
        if s.get_node(k) == "b":
            target_room = k
            break
    if target_room is None:
        # 强制让 "rb" 落在 b
        s._nodes = ["b"]
        s._rebuild()
        target_room = "rb"
    result = await r.publish(target_room, {"hello": "world"})
    assert result["node"] == "b"
    assert result["local"] == 0
    assert result["remote"] == 0  # 无 redis


@pytest.mark.skipif(not HAS_MODULE, reason="module not importable")
@pytest.mark.asyncio
async def test_router_publish_no_owner():
    """无节点时 publish 不崩."""
    s = RoomSharder([])
    p = RedisPubSub("redis://nope:6379/0")
    r = WSShardRouter("a", s, p)
    result = await r.publish("r1", {"x": 1})
    assert result["node"] == ""
    assert result["local"] == 0


@pytest.mark.skipif(not HAS_MODULE, reason="module not importable")
@pytest.mark.asyncio
async def test_router_callback_exception_doesnt_break():
    """单个 callback 抛异常不影响其他 callback."""
    s = RoomSharder(["a"])
    p = RedisPubSub("redis://nope:6379/0")
    r = WSShardRouter("a", s, p)
    received = []

    async def bad_cb(msg):
        raise RuntimeError("boom")

    async def good_cb(msg):
        received.append(msg)

    await r.subscribe("r1", bad_cb)
    await r.subscribe("r1", good_cb)
    n = await r._broadcast_local("r1", {"x": 1})
    # bad_cb 失败但 good_cb 成功
    assert n == 1
    assert len(received) == 1


@pytest.mark.skipif(not HAS_MODULE, reason="module not importable")
@pytest.mark.asyncio
async def test_router_stats():
    s = RoomSharder(["a", "b"])
    p = RedisPubSub("redis://nope:6379/0")
    r = WSShardRouter("a", s, p)
    stats = r.stats()
    assert stats["node_id"] == "a"
    assert stats["running"] is False
    assert stats["local_rooms"] == 0
    assert "a" in stats["shard_nodes"]


# ---------------------------------------------------------------------------
# 5. CLI
# ---------------------------------------------------------------------------


def test_cli_dry_run(capsys):
    """CLI dry-run 模式."""
    code = main(["--nodes", "n1", "n2", "n3", "--self", "n1", "--room", "test", "--dry-run"])
    assert code == 0
    out = capsys.readouterr().out
    assert "WS Redis 集群化演示" in out
    assert "test" in out
    assert "重连策略" in out


def test_cli_no_redis(capsys):
    """无 redis 时 CLI 优雅降级."""
    code = main(["--nodes", "n1", "n2", "--self", "n1", "--room", "test"])
    assert code == 0
    out = capsys.readouterr().out
    # 至少一致性哈希部分应输出
    assert "WS Redis 集群化演示" in out
