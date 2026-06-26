"""ZHS WebSocket 客户端 SDK (Python) 单元测试.

覆盖:
- ReconnectPolicy 指数退避 + 抖动
- ReconnectPolicy reset 重置
- LocalBuffer 收发 / ack / 去重
- ZhsWsClient 基本流程 (mock websocket)
"""

from __future__ import annotations

import json
import sys
import time
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))
sys.path.insert(0, str(ROOT / "app" / "ws" / "sdk"))

from zhs_ws_client import LocalBuffer, ReconnectPolicy


# ---------------------------------------------------------------------------
# 1. ReconnectPolicy
# ---------------------------------------------------------------------------


class TestReconnectPolicy:
    def test_initial_attempt_zero(self):
        p = ReconnectPolicy()
        assert p.attempt == 0

    def test_exponential_backoff(self):
        p = ReconnectPolicy(base=1.0, max_delay=60.0, factor=2.0, jitter=0)
        d1 = p.next_delay()
        d2 = p.next_delay()
        d3 = p.next_delay()
        # 1, 2, 4
        assert abs(d1 - 1.0) < 0.01
        assert abs(d2 - 2.0) < 0.01
        assert abs(d3 - 4.0) < 0.01

    def test_max_cap(self):
        p = ReconnectPolicy(base=1.0, max_delay=10.0, factor=2.0, jitter=0)
        # 1, 2, 4, 8, 16→10, 32→10
        for _ in range(10):
            d = p.next_delay()
        assert d == 10.0

    def test_jitter_in_range(self):
        p = ReconnectPolicy(base=1.0, max_delay=60.0, factor=2.0, jitter=0.1)
        d1 = p.next_delay()
        # ±10% 抖动: [0.9, 1.1]
        assert 0.85 <= d1 <= 1.15

    def test_reset(self):
        p = ReconnectPolicy(base=1.0)
        p.next_delay()
        p.next_delay()
        assert p.attempt > 0
        p.reset()
        assert p.attempt == 0


# ---------------------------------------------------------------------------
# 2. LocalBuffer
# ---------------------------------------------------------------------------


class TestLocalBuffer:
    def test_record_received_updates_last_ts(self):
        buf = LocalBuffer()
        buf.record_received({"ts": 100.0, "id": "a"})
        buf.record_received({"ts": 50.0, "id": "b"})  # 较小
        buf.record_received({"ts": 200.0, "id": "c"})
        assert buf.last_ts() == 200.0

    def test_record_received_ignores_non_numeric_ts(self):
        buf = LocalBuffer()
        buf.record_received({"ts": "abc", "id": "a"})
        buf.record_received({"id": "b"})
        # last_ts 保持 0
        assert buf.last_ts() == 0.0

    def test_enqueue_and_drain(self):
        buf = LocalBuffer()
        buf.enqueue_send({"x": 1})
        buf.enqueue_send({"x": 2})
        assert len(buf.send_buffer) == 2
        items = buf.drain_send()
        assert items == [{"x": 1}, {"x": 2}]
        assert len(buf.send_buffer) == 0

    def test_buffer_max_size(self):
        buf = LocalBuffer(max_size=3)
        for i in range(5):
            buf.enqueue_send({"i": i})
        assert len(buf.send_buffer) == 3
        # 保留最后 3 条
        assert [m["i"] for m in buf.send_buffer] == [2, 3, 4]

    def test_pending_acks(self):
        buf = LocalBuffer()
        msg = {"_ack_id": "abc", "data": 1}
        buf.track_pending_ack(msg)
        assert buf.pending_count() == 1
        buf.ack_received("abc")
        assert buf.pending_count() == 0

    def test_pending_acks_unknown_id(self):
        buf = LocalBuffer()
        buf.ack_received("nonexistent")
        assert buf.pending_count() == 0


# ---------------------------------------------------------------------------
# 3. ZhsWsClient handleMessage / 去重 (mock)
# ---------------------------------------------------------------------------


class FakeWebSocket:
    def __init__(self):
        self.sent: list[str] = []
        self.recv_queue: list[str] = []
        self.closed = False
        self.connected = False

    def connect(self, url):
        self.connected = True

    def recv(self):
        if not self.recv_queue:
            raise Exception("closed")
        return self.recv_queue.pop(0)

    def send(self, data):
        self.sent.append(data)

    def close(self):
        self.closed = True
        self.connected = False


class TestZhsWsClient:
    def setup_method(self):
        # 在导入前注入 mock, 避免依赖真实 websocket-client
        import types
        import sys
        # mock websocket-client 模块
        mock_ws = types.ModuleType("websocket")
        class _MockWS:
            def __init__(self):
                self.sent: list[str] = []
                self.closed = False
            def connect(self, url): pass
            def recv(self): raise Exception("closed")
            def send(self, data): self.sent.append(data)
            def close(self): self.closed = True
        mock_ws.WebSocket = _MockWS
        sys.modules["websocket"] = mock_ws
        # mock requests
        mock_req = types.ModuleType("requests")
        mock_req.get = lambda *a, **k: None
        sys.modules["requests"] = mock_req
        # 重新 import
        if "zhs_ws_client" in sys.modules:
            del sys.modules["zhs_ws_client"]
        from zhs_ws_client import ZhsWsClient
        self.ZhsWsClient = ZhsWsClient

    def test_handle_message_dedup(self):
        """同一 message_id 重复到达只处理一次."""
        client = self.ZhsWsClient(base_url="http://x", token="t")
        received: list[dict] = []
        client.on_message = lambda m: received.append(m)
        msg = {"_ack_id": "id1", "type": "notice", "ts": 1.0, "data": "x"}
        client._handle_message(msg)
        client._handle_message(msg)  # 重复
        client._handle_message(dict(msg))  # 又是同一 id
        assert len(received) == 1

    def test_handle_message_updates_last_ts(self):
        client = self.ZhsWsClient(base_url="http://x", token="t")
        client._handle_message({"id": "a", "ts": 100.0})
        client._handle_message({"id": "b", "ts": 200.0})
        client._handle_message({"id": "c", "ts": 150.0})
        # last_ts 记录在 LocalBuffer
        assert client.buffer.last_ts() == 200.0

    def test_handle_message_skips_pong(self):
        client = self.ZhsWsClient(base_url="http://x", token="t")
        received: list[dict] = []
        client.on_message = lambda m: received.append(m)
        client._handle_message({"type": "pong", "ts": 1.0})
        assert len(received) == 0

    def test_seen_ids_bounded(self):
        client = self.ZhsWsClient(base_url="http://x", token="t")
        for i in range(6000):
            client._handle_message({"id": f"id-{i}", "ts": float(i)})
        # seen_ids 最多 5000, 触发裁剪后保留最后 2000
        assert len(client._seen_ids) <= 5000
