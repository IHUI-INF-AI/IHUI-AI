"""WS pub/sub 集群验证 — 模拟 2 个 app 实例通过 Redis 互发消息.

不依赖外部 Redis, 用 fakeredis 模拟.
"""

import asyncio
import json
import os
import sys
from pathlib import Path
from unittest.mock import patch

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
os.environ.setdefault("ENV", "test")
os.environ.setdefault("DB1_URL", "sqlite:///:memory:")
os.environ.setdefault("REDIS_HOST", "localhost")


class FakeRedis:
    """最简 fake redis,只支持 pub/sub."""

    def __init__(self):
        self.channels: dict = {}
        self.pubsub_obj = FakePubSub(self)

    def get_message(self, timeout=1.0):
        return self.pubsub_obj.get_message(timeout=timeout)

    def publish(self, channel, message):
        for sub in self.channels.get(channel, []):
            sub.append({"type": "pmessage", "channel": channel, "data": message})
        return len(self.channels.get(channel, []))

    def pubsub(self):
        return self.pubsub_obj

    def setex(self, *a, **kw):
        pass

    def get(self, *a, **kw):
        return None

    def set(self, *a, **kw):
        pass

    def delete(self, *a, **kw):
        pass

    def ping(self):
        return True


class FakePubSub:
    def __init__(self, parent: FakeRedis):
        self.parent = parent
        self.subscribed_channels: list = []
        self.queue: list = []
        self.patterns: list = []
        self._closed = False

    def psubscribe(self, pattern):
        self.patterns.append(pattern)
        self.parent.channels.setdefault(pattern, []).append(self.queue)

    def get_message(self, timeout=1.0):
        if self.queue:
            return self.queue.pop(0)
        return None

    def close(self):
        self._closed = True


@pytest.mark.asyncio
async def test_pubsub_two_instances():
    """两个 ConnectionManager 实例通过 Redis pub/sub 互发消息."""
    from app.ws.manager import ConnectionManager

    fake_redis = FakeRedis()

    with patch("app.ws.manager._get_redis", return_value=fake_redis):
        # 实例 A
        manager_a = ConnectionManager()
        # 重置已初始化的单例（_init flag 保留，但需要不同 instance_id）
        manager_a._instance_id = "instance-A"
        await manager_a.start_redis_subscriber()

        # 实例 B
        manager_b = ConnectionManager()
        manager_b._instance_id = "instance-B"
        await manager_b.start_redis_subscriber()

        # 在 A 上发广播消息, B 应该收到（模拟不同 WS 连接）
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

        ws_b1 = FakeWS("B-conn-1")
        manager_b._connections["B-conn-1"] = ws_b1

        # A 发广播
        await manager_a.broadcast_all({"msg": "hello from A"})

        # 等待消息分发
        for _ in range(20):
            if ws_b1._sent:
                break
            await asyncio.sleep(0.05)

        assert len(ws_b1._sent) >= 1, f"B 应当收到 A 的广播, 实际收到 {len(ws_b1._sent)} 条"
        data = json.loads(ws_b1._sent[0])
        assert data["msg"] == "hello from A"

        # 反向也测：B 发送，A 接收（创建 ws_a）
        ws_a1 = FakeWS("A-conn-1")
        manager_a._connections["A-conn-1"] = ws_a1

        await manager_b.broadcast_all({"msg": "hello from B"})
        for _ in range(20):
            if ws_a1._sent:
                break
            await asyncio.sleep(0.05)
        assert len(ws_a1._sent) >= 1, "A 应当收到 B 的广播"
        data = json.loads(ws_a1._sent[0])
        assert data["msg"] == "hello from B"

        await manager_a.stop_redis_subscriber()
        await manager_b.stop_redis_subscriber()


@pytest.mark.asyncio
async def test_pubsub_no_echo_to_self():
    """同一实例发送的消息不会被自己重新接收（避免回声）."""
    from app.ws.manager import ConnectionManager

    fake_redis = FakeRedis()
    with patch("app.ws.manager._get_redis", return_value=fake_redis):
        m = ConnectionManager()
        m._instance_id = "self-instance"
        await m.start_redis_subscriber()

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

        ws = FakeWS("self-conn")
        m._connections["self-conn"] = ws

        # 同一实例广播
        await m.broadcast_all({"msg": "self broadcast"})
        for _ in range(10):
            if ws._sent:
                break
            await asyncio.sleep(0.05)
        # 只应当有 1 条（来自本地广播）
        assert len(ws._sent) == 1, f"自广播应只触发 1 次, 实际 {len(ws._sent)}"

        await m.stop_redis_subscriber()
