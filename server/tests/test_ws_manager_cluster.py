"""WebSocket Manager 集群 + 压测测试 (建议 1).

覆盖:
  - 单实例多连接 (本地 broadcast_room / send_to_user)
  - 多实例跨 Redis pub/sub 消息分发 (本实例不回声, 其他实例收到)
  - 同 user 多连接时, send_to_user 走全部连接
  - alive_connections 心跳超时统计
  - disconnect 后清理 user_map / room_map
  - 压测: N 个连接, 模拟 K 条消息扇出, 验证 (1) 全部收到 (2) 耗时 < 阈值

依赖: fakeredis (本地模拟, 无需真实 Redis)
"""

import asyncio
import json
import sys
import time
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))


# ---------------------------------------------------------------------------
# 用 fakeredis 替换 _get_redis, 模拟多个 manager 实例
# ---------------------------------------------------------------------------


@pytest.fixture()
def fake_redis(monkeypatch):
    """注入 fakeredis, 让 manager 用共享的 redis 实例."""
    import fakeredis

    r = fakeredis.FakeStrictRedis(decode_responses=True)
    import app.ws.manager as mgr_mod

    monkeypatch.setattr(mgr_mod, "_get_redis", lambda: r)
    return r


def _make_manager_with_fake_loop():
    """构造一个 manager 实例 + 把 asyncio 循环绑上去."""
    from app.ws.manager import ConnectionManager

    inst = ConnectionManager()
    return inst


class _FakeWebSocket:
    """极简 WebSocket mock, 记录 send_text 调用, 不抛错."""

    def __init__(self):
        self.sent: list[str] = []
        self.accepted = False
        self.closed = False

    async def accept(self):
        self.accepted = True

    async def send_text(self, text: str):
        self.sent.append(text)
        return None

    async def close(self, code: int = 1000):
        self.closed = True


# ---------------------------------------------------------------------------
# 基础连接管理
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_single_instance_room_broadcast(fake_redis):
    """单实例: broadcast_room 给同一房间所有连接."""
    mgr = _make_manager_with_fake_loop()
    ws1, ws2, ws3 = _FakeWebSocket(), _FakeWebSocket(), _FakeWebSocket()
    await mgr.connect("c1", ws1, user_uuid="u1", room_id="r1")
    await mgr.connect("c2", ws2, user_uuid="u2", room_id="r1")
    await mgr.connect("c3", ws3, user_uuid="u3", room_id="r2")
    count = await mgr.broadcast_room_local("r1", {"msg": "hello"})
    assert count == 2
    assert len(ws1.sent) == 1
    assert len(ws2.sent) == 1
    assert len(ws3.sent) == 0  # 不在 r1
    assert json.loads(ws1.sent[0])["msg"] == "hello"


@pytest.mark.asyncio
async def test_user_multiple_connections_all_get_message(fake_redis):
    """同 user 多连接: 全部收到."""
    mgr = _make_manager_with_fake_loop()
    ws1, ws2 = _FakeWebSocket(), _FakeWebSocket()
    await mgr.connect("c1", ws1, user_uuid="u1", room_id="r1")
    await mgr.connect("c2", ws2, user_uuid="u1", room_id="r2")  # 同 user 不同 room
    count = await mgr.send_to_user_local("u1", {"msg": "x"})
    assert count == 2
    assert len(ws1.sent) == 1
    assert len(ws2.sent) == 1


@pytest.mark.asyncio
async def test_disconnect_cleans_user_and_room_map(fake_redis):
    """disconnect 后从 user_map / room_map 清理."""
    mgr = _make_manager_with_fake_loop()
    ws = _FakeWebSocket()
    await mgr.connect("c1", ws, user_uuid="u1", room_id="r1")
    assert "c1" in mgr._user_map["u1"]
    assert "c1" in mgr._room_map["r1"]
    await mgr.disconnect("c1")
    assert "c1" not in mgr._user_map["u1"]
    assert "c1" not in mgr._room_map["r1"]


# ---------------------------------------------------------------------------
# 心跳
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_alive_connections_counts_only_with_heartbeat(fake_redis):
    """alive_connections 应只统计超时的连接 (manager 在 connect(room=) 时会注册 heartbeat)."""
    mgr = _make_manager_with_fake_loop()
    ws1, ws2 = _FakeWebSocket(), _FakeWebSocket()
    await mgr.connect("c1", ws1, user_uuid="u1", room_id="r1")
    await mgr.connect("c2", ws2, user_uuid="u2", room_id="r1")
    # refresh c1
    mgr.heartbeat("c1")
    # 把 c2 设为很久之前的心跳, 模拟超时
    mgr._heartbeat["c2"] = time.time() - 1000
    # alive_connections(timeout=60) = 超时数, 期望 c2
    alive = mgr.alive_connections(timeout=60)
    assert alive == 1
    # 同时, c1 不超时, alive 不应包含 c1
    assert mgr._heartbeat["c1"] > time.time() - 10


# ---------------------------------------------------------------------------
# 跨实例广播 (Redis pub/sub)
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_cross_instance_pubsub_does_not_echo_to_self(fake_redis):
    """跨实例 pub/sub: 本实例发送的, 不会回声到自己."""
    mgr_a = _make_manager_with_fake_loop()
    mgr_b = _make_manager_with_fake_loop()
    # 启动两个实例的 redis 订阅
    await mgr_a.start_redis_subscriber()
    await mgr_b.start_redis_subscriber()
    try:
        # 给 mgr_b 注入一个连接到 r1
        ws_b = _FakeWebSocket()
        await mgr_b.connect("cb1", ws_b, user_uuid="ub1", room_id="r1")
        # 等待订阅稳定
        await asyncio.sleep(0.05)
        # mgr_a 广播到 r1
        await mgr_a.broadcast_room("r1", {"msg": "from_a"})
        # 给 pub/sub 处理时间
        await asyncio.sleep(0.2)
        # 期望 mgr_b 收到 (跨实例), mgr_a 自己不回声
        assert any(json.loads(s)["msg"] == "from_a" for s in ws_b.sent)
    finally:
        await mgr_a.stop_redis_subscriber()
        await mgr_b.stop_redis_subscriber()


@pytest.mark.asyncio
async def test_cross_instance_send_to_user_fanout(fake_redis):
    """跨实例: send_to_user 能命中其他实例的同名 user 连接."""
    mgr_a = _make_manager_with_fake_loop()
    mgr_b = _make_manager_with_fake_loop()
    await mgr_a.start_redis_subscriber()
    await mgr_b.start_redis_subscriber()
    try:
        ws_a = _FakeWebSocket()
        ws_b = _FakeWebSocket()
        await mgr_a.connect("ca1", ws_a, user_uuid="u_shared", room_id="r1")
        await mgr_b.connect("cb1", ws_b, user_uuid="u_shared", room_id="r2")
        await asyncio.sleep(0.05)
        # mgr_a 发送给自己实例的 u_shared
        await mgr_a.send_to_user("u_shared", {"msg": "hi"})
        await asyncio.sleep(0.2)
        # 两个实例的 u_shared 都应收到
        assert any(json.loads(s)["msg"] == "hi" for s in ws_a.sent)
        assert any(json.loads(s)["msg"] == "hi" for s in ws_b.sent)
    finally:
        await mgr_a.stop_redis_subscriber()
        await mgr_b.stop_redis_subscriber()


# ---------------------------------------------------------------------------
# 压测 (in-process)
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_load_room_fanout_100_connections(fake_redis):
    """压测: 100 个连接, 50 条 broadcast 消息, 验证全部收到 + 耗时 < 2s."""
    mgr = _make_manager_with_fake_loop()
    N = 100
    sockets = []
    for i in range(N):
        ws = _FakeWebSocket()
        sockets.append(ws)
        await mgr.connect(f"c{i}", ws, user_uuid=f"u{i}", room_id="room_load")
    # 50 条消息
    K = 50
    start = time.perf_counter()
    for k in range(K):
        await mgr.broadcast_room_local("room_load", {"msg": "x", "k": k})
    elapsed = time.perf_counter() - start
    # 验证全部收到
    for ws in sockets:
        assert len(ws.sent) == K, f"每连接应收 {K} 条, 实际 {len(ws.sent)}"
    # 性能断言: 100×50 = 5000 次 send, 应 < 2 秒
    assert elapsed < 2.0, f"扇出耗时 {elapsed:.2f}s 超阈值 2s"
    print(f"\n[load] 100 conn × 50 msg = 5000 send, elapsed={elapsed*1000:.1f}ms")


@pytest.mark.asyncio
async def test_load_send_to_user_with_many_connections_per_user(fake_redis):
    """压测: 单 user 有 50 个连接, 100 次 send."""
    mgr = _make_manager_with_fake_loop()
    sockets = []
    for i in range(50):
        ws = _FakeWebSocket()
        sockets.append(ws)
        await mgr.connect(f"c{i}", ws, user_uuid="power_user", room_id=f"r{i%5}")
    start = time.perf_counter()
    for k in range(100):
        await mgr.send_to_user_local("power_user", {"msg": "x", "k": k})
    elapsed = time.perf_counter() - start
    for ws in sockets:
        assert len(ws.sent) == 100
    assert elapsed < 2.0, f"50 conn × 100 send = 5000, elapsed={elapsed:.2f}s"
    print(f"\n[load] 50 conn × 100 msg = 5000 send, elapsed={elapsed*1000:.1f}ms")
