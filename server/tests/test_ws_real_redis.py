"""WS pub/sub 真实 Redis 跨实例测试 (CI 中跑).

依赖 CI 启动 redis:7-alpine service, 本地若有 redis 也可跑.
Redis 不可达时自动跳过, 不影响其它测试.
"""

import asyncio
import json
import os
import sys
from pathlib import Path

import pytest
import redis as _redis_mod

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))


def _redis_available() -> bool:
    host = os.environ.get("REDIS_HOST", "localhost")
    port = int(os.environ.get("REDIS_PORT", "6379"))
    try:
        r = _redis_mod.Redis(host=host, port=port, socket_connect_timeout=1, socket_timeout=1)
        r.ping()
        return True
    except Exception:
        return False


pytestmark = pytest.mark.skipif(
    not _redis_available(),
    reason=f"Redis not available at {os.environ.get('REDIS_HOST', 'localhost')}:{os.environ.get('REDIS_PORT', '6379')}",
)


# 用一个独立 key 前缀避免污染其他数据
TEST_KEY_PREFIX = "zhs_ws_test:"


@pytest.fixture
def clean_redis():
    """测试前清理测试频道."""
    from app.utils.redis_util import get_redis

    r = get_redis()
    # 清理
    try:
        keys = r.keys(f"{TEST_KEY_PREFIX}*")
        if keys:
            r.delete(*keys)
    except Exception:
        pass
    yield r
    try:
        keys = r.keys(f"{TEST_KEY_PREFIX}*")
        if keys:
            r.delete(*keys)
    except Exception:
        pass


@pytest.mark.asyncio
async def test_real_redis_pubsub_two_instances(clean_redis):
    """用真实 Redis 验证两个 ConnectionManager 实例通过 pub/sub 互发消息."""
    from app.ws.manager import ConnectionManager

    # 单例, 先 reset
    ConnectionManager._instance = None

    # 实例 A
    mgr_a = ConnectionManager()
    mgr_a._instance_id = "real-A"
    await mgr_a.start_redis_subscriber()

    # 实例 B
    mgr_b = ConnectionManager()
    mgr_b._instance_id = "real-B"
    await mgr_b.start_redis_subscriber()

    try:
        from starlette.websockets import WebSocketState

        class FakeWS:
            def __init__(self, wid):
                self.id = wid
                self._sent: list = []
                self.client_state = WebSocketState.CONNECTED

            async def accept(self):
                pass

            async def send_text(self, data):
                self._sent.append(data)

            async def close(self):
                self.client_state = WebSocketState.DISCONNECTED

        # B 上有 1 个连接
        ws_b = FakeWS("B-conn-real")
        mgr_b._connections["B-conn-real"] = ws_b

        # A 广播
        await mgr_a.broadcast_all({"msg": "real-redis-from-A", "ts": "now"})

        # 等 B 收到
        received = False
        for _ in range(30):
            if ws_b._sent:
                received = True
                break
            await asyncio.sleep(0.1)

        assert received, "B 应当通过真实 Redis pub/sub 收到 A 的广播"
        data = json.loads(ws_b._sent[0])
        assert data["msg"] == "real-redis-from-A"

    finally:
        await mgr_a.stop_redis_subscriber()
        await mgr_b.stop_redis_subscriber()
        ConnectionManager._instance = None


@pytest.mark.asyncio
async def test_real_redis_no_echo(clean_redis):
    """真实 Redis 下, 同一实例不应回声自己."""
    from app.ws.manager import ConnectionManager

    ConnectionManager._instance = None
    mgr = ConnectionManager()
    mgr._instance_id = "self-real"
    await mgr.start_redis_subscriber()

    try:
        from starlette.websockets import WebSocketState

        class FakeWS:
            def __init__(self, wid):
                self.id = wid
                self._sent: list = []
                self.client_state = WebSocketState.CONNECTED

            async def accept(self):
                pass

            async def send_text(self, data):
                self._sent.append(data)

            async def close(self):
                self.client_state = WebSocketState.DISCONNECTED

        ws = FakeWS("self-real-conn")
        mgr._connections["self-real-conn"] = ws

        await mgr.broadcast_all({"msg": "self-real"})
        await asyncio.sleep(0.5)

        # 应当只有 1 条（本地广播）, 没有来自 Redis 的回声
        assert len(ws._sent) == 1, f"自广播只触发本地 1 次, 实际 {len(ws._sent)}"

    finally:
        await mgr.stop_redis_subscriber()
        ConnectionManager._instance = None


@pytest.mark.asyncio
async def test_real_redis_user_targeted(clean_redis):
    """真实 Redis 下, send_to_user 跨实例能命中目标用户."""
    from app.ws.manager import ConnectionManager

    ConnectionManager._instance = None
    mgr_a = ConnectionManager()
    mgr_a._instance_id = "ut-A"
    await mgr_a.start_redis_subscriber()

    mgr_b = ConnectionManager()
    mgr_b._instance_id = "ut-B"
    await mgr_b.start_redis_subscriber()

    try:
        from starlette.websockets import WebSocketState

        class FakeWS:
            def __init__(self, wid):
                self.id = wid
                self._sent: list = []
                self.client_state = WebSocketState.CONNECTED

            async def accept(self):
                pass

            async def send_text(self, data):
                self._sent.append(data)

            async def close(self):
                self.client_state = WebSocketState.DISCONNECTED

        # B 上有 user_uuid=u1 的连接
        ws_b1 = FakeWS("B-conn-u1")
        mgr_b._connections["B-conn-u1"] = ws_b1
        mgr_b._user_map["u1"].add("B-conn-u1")

        # A 给 u1 发消息
        await mgr_a.send_to_user("u1", {"msg": "to-u1-from-A"})

        received = False
        for _ in range(30):
            if ws_b1._sent:
                received = True
                break
            await asyncio.sleep(0.1)

        assert received, "B 上 u1 的连接应收到 A 的定向消息"
        data = json.loads(ws_b1._sent[0])
        assert data["msg"] == "to-u1-from-A"

    finally:
        await mgr_a.stop_redis_subscriber()
        await mgr_b.stop_redis_subscriber()
        ConnectionManager._instance = None
