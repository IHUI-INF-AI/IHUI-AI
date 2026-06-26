"""T6: 客户端 WS SDK 断线重连补偿 单元测试.

覆盖:
- ConnectionManager 暴露 reconnect 缓冲属性
- _record_reconnect_message 写入缓冲
- 缓冲容量限制 (deque maxlen 自动驱逐)
- sync_since 全量拉取 (since=0)
- sync_since 时间过滤
- sync_since user_uuid 过滤
- sync_since topic 过滤
- sync_since limit 限制
- sync_since 统计计数
- send_to 触发 _record_reconnect_message
- 系统消息 (pong/welcome/ack_error) 不入缓冲
- HTTP /ws/notice/sync 端点存在
- stats() 包含 reconnect 字段
"""

from __future__ import annotations

import asyncio
import json
import time
from collections import deque
from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest
from fastapi.testclient import TestClient

ROOT = Path(__file__).resolve().parent.parent
import sys

sys.path.insert(0, str(ROOT))


# ---------------------------------------------------------------------------
# Helper
# ---------------------------------------------------------------------------


class FakeWebSocket:
    def __init__(self):
        self.accepted = False
        self.closed = False
        self.sent_texts: list[str] = []
        self.client_state = MagicMock()
        self.client_state.name = "CONNECTED"

    async def accept(self):
        self.accepted = True

    async def send_text(self, text: str) -> None:
        self.sent_texts.append(text)

    async def close(self, code: int = 1000, reason: str = ""):
        self.closed = True


def _reset_cm():
    from app.ws.manager import ConnectionManager

    ConnectionManager._instance = None
    return ConnectionManager()


# ---------------------------------------------------------------------------
# 1. ConnectionManager 暴露 reconnect 属性
# ---------------------------------------------------------------------------


class TestReconnectAttributes:
    def setup_method(self):
        self.cm = _reset_cm()

    def test_has_buffer(self):
        assert hasattr(self.cm, "reconnect_buffer")
        assert isinstance(self.cm.reconnect_buffer, deque)

    def test_has_lock(self):
        import asyncio as _a

        assert hasattr(self.cm, "_reconnect_lock")
        assert isinstance(self.cm._reconnect_lock, _a.Lock)

    def test_has_counters(self):
        for k in (
            "_reconnect_sync_total",
            "_reconnect_sync_messages",
            "_reconnect_evicted",
        ):
            assert hasattr(self.cm, k)
            assert getattr(self.cm, k) == 0

    def test_has_methods(self):
        for m in (
            "_record_reconnect_message",
            "sync_since",
            "reconnect_stats",
        ):
            assert hasattr(self.cm, m)
            assert callable(getattr(self.cm, m))


# ---------------------------------------------------------------------------
# 2. _record_reconnect_message
# ---------------------------------------------------------------------------


class TestRecordReconnect:
    def setup_method(self):
        self.cm = _reset_cm()

    def test_record_basic(self):
        self.cm._record_reconnect_message(
            {"type": "notice", "topic": "announcement", "title": "hi"},
            conn_id="c1",
            user_uuid="u1",
            rooms=["notice"],
        )
        assert len(self.cm.reconnect_buffer) == 1
        rec = self.cm.reconnect_buffer[0]
        assert rec["type"] == "notice"
        assert rec["topic"] == "announcement"
        assert rec["user_uuid"] == "u1"
        assert rec["conn_id"] == "c1"
        assert "notice" in rec["rooms"]
        # ts 必须是 float
        assert isinstance(rec["ts"], float)
        # id 存在
        assert "id" in rec
        # payload 浅拷贝
        assert rec["payload"]["title"] == "hi"

    def test_record_buffer_eviction(self):
        """超过 maxlen 时, 旧消息自动驱逐."""
        self.cm.reconnect_buffer_size = 3
        self.cm.reconnect_buffer = deque(maxlen=3)
        for i in range(5):
            self.cm._record_reconnect_message({"i": i, "type": "x"})
        assert len(self.cm.reconnect_buffer) == 3
        # 最早的 2 条被驱逐
        assert self.cm._reconnect_evicted == 2
        # 剩下的是 i=2, 3, 4
        assert [r["payload"]["i"] for r in self.cm.reconnect_buffer] == [2, 3, 4]


# ---------------------------------------------------------------------------
# 3. sync_since 时间过滤
# ---------------------------------------------------------------------------


class TestSyncSinceTimeFilter:
    def setup_method(self):
        self.cm = _reset_cm()

    @pytest.mark.asyncio
    async def test_sync_since_0_returns_all(self):
        for i in range(5):
            self.cm._record_reconnect_message({"i": i, "type": "x"})
        msgs = await self.cm.sync_since(since_ts=0.0)
        assert len(msgs) == 5
        # ts 升序
        ts_list = [m["ts"] for m in msgs]
        assert ts_list == sorted(ts_list)

    @pytest.mark.asyncio
    async def test_sync_since_filters_old(self):
        # 第 1 批: ts=100.0
        for i in range(3):
            self.cm._record_reconnect_message({"i": i, "type": "x"})
            self.cm.reconnect_buffer[-1]["ts"] = 100.0 + i * 0.001
        # 第 2 批: ts=200.0
        for i in range(3):
            self.cm._record_reconnect_message({"i": i, "type": "x"})
            self.cm.reconnect_buffer[-1]["ts"] = 200.0 + i * 0.001
        # since=150 应只返回第 2 批
        msgs = await self.cm.sync_since(since_ts=150.0)
        assert len(msgs) == 3
        for m in msgs:
            assert m["ts"] > 150.0

    @pytest.mark.asyncio
    async def test_sync_since_inclusive_boundary(self):
        """since_ts=150 应排除 ts=150 (即 since_ts <= rec.ts)."""
        self.cm._record_reconnect_message({"type": "x"})
        self.cm.reconnect_buffer[-1]["ts"] = 150.0
        msgs = await self.cm.sync_since(since_ts=150.0)
        # since_ts 不包含 (代码用 <= 过滤)
        assert len(msgs) == 0


# ---------------------------------------------------------------------------
# 4. sync_since user_uuid / topic 过滤
# ---------------------------------------------------------------------------


class TestSyncSinceFilters:
    def setup_method(self):
        self.cm = _reset_cm()

    @pytest.mark.asyncio
    async def test_user_filter(self):
        self.cm._record_reconnect_message(
            {"type": "x"}, conn_id="c1", user_uuid="alice"
        )
        self.cm._record_reconnect_message(
            {"type": "x"}, conn_id="c2", user_uuid="bob"
        )
        self.cm._record_reconnect_message(
            {"type": "x"}, conn_id="c3", user_uuid="alice"
        )
        # 广播 (user_uuid=空) 也会被返回
        self.cm._record_reconnect_message(
            {"type": "x"}, conn_id="c4", user_uuid=""
        )
        msgs = await self.cm.sync_since(since_ts=0.0, user_uuid="alice")
        # 应返回 3 条 (2 条 alice + 1 条广播)
        assert len(msgs) == 3

    @pytest.mark.asyncio
    async def test_user_filter_excludes_other_users(self):
        self.cm._record_reconnect_message(
            {"type": "x"}, conn_id="c1", user_uuid="alice"
        )
        self.cm._record_reconnect_message(
            {"type": "x"}, conn_id="c2", user_uuid="bob"
        )
        msgs = await self.cm.sync_since(since_ts=0.0, user_uuid="alice")
        assert len(msgs) == 1
        assert msgs[0]["user_uuid"] == "alice"

    @pytest.mark.asyncio
    async def test_topic_filter(self):
        self.cm._record_reconnect_message({"type": "x", "topic": "announcement"})
        self.cm._record_reconnect_message({"type": "x", "topic": "job"})
        self.cm._record_reconnect_message({"type": "x", "topic": "announcement"})
        msgs = await self.cm.sync_since(since_ts=0.0, topic="announcement")
        assert len(msgs) == 2

    @pytest.mark.asyncio
    async def test_combined_filter(self):
        self.cm._record_reconnect_message(
            {"type": "x", "topic": "a"}, user_uuid="alice"
        )
        self.cm._record_reconnect_message(
            {"type": "x", "topic": "a"}, user_uuid="bob"
        )
        self.cm._record_reconnect_message(
            {"type": "x", "topic": "b"}, user_uuid="alice"
        )
        msgs = await self.cm.sync_since(
            since_ts=0.0, user_uuid="alice", topic="a"
        )
        assert len(msgs) == 1


# ---------------------------------------------------------------------------
# 5. sync_since limit
# ---------------------------------------------------------------------------


class TestSyncSinceLimit:
    def setup_method(self):
        self.cm = _reset_cm()

    @pytest.mark.asyncio
    async def test_limit_default_200(self):
        for i in range(250):
            self.cm._record_reconnect_message({"i": i, "type": "x"})
        msgs = await self.cm.sync_since(since_ts=0.0)
        assert len(msgs) == 200  # 默认限制

    @pytest.mark.asyncio
    async def test_limit_custom(self):
        for i in range(50):
            self.cm._record_reconnect_message({"i": i, "type": "x"})
        msgs = await self.cm.sync_since(since_ts=0.0, limit=10)
        assert len(msgs) == 10


# ---------------------------------------------------------------------------
# 6. 统计
# ---------------------------------------------------------------------------


class TestReconnectStats:
    def setup_method(self):
        self.cm = _reset_cm()

    def test_initial(self):
        s = self.cm.reconnect_stats()
        assert s["buffer_size"] == 0
        assert s["buffer_capacity"] > 0
        assert s["buffer_evicted"] == 0
        assert s["sync_calls_total"] == 0

    @pytest.mark.asyncio
    async def test_sync_increments(self):
        for i in range(5):
            self.cm._record_reconnect_message({"i": i, "type": "x"})
        await self.cm.sync_since(since_ts=0.0)
        await self.cm.sync_since(since_ts=0.0, limit=2)
        s = self.cm.reconnect_stats()
        assert s["sync_calls_total"] == 2
        # 第一次: 5 条, 第二次: 2 条
        assert s["sync_messages_total"] == 7


# ---------------------------------------------------------------------------
# 7. send_to 自动记录业务消息
# ---------------------------------------------------------------------------


class TestSendToRecordsReconnect:
    def setup_method(self):
        self.cm = _reset_cm()

    @pytest.mark.asyncio
    async def test_business_message_recorded(self):
        ws = FakeWebSocket()
        await self.cm.connect("c1", ws, user_uuid="u1")
        with patch("app.telemetry.get_current_trace_id", return_value=""):
            await self.cm.send_to("c1", {"type": "notice", "topic": "announcement"})
        # 业务消息应入缓冲
        assert len(self.cm.reconnect_buffer) == 1
        assert self.cm.reconnect_buffer[0]["type"] == "notice"
        await self.cm.disconnect("c1")

    @pytest.mark.asyncio
    async def test_system_message_not_recorded(self):
        ws = FakeWebSocket()
        await self.cm.connect("c1", ws, user_uuid="u1")
        with patch("app.telemetry.get_current_trace_id", return_value=""):
            await self.cm.send_to("c1", {"type": "pong", "ts": 123})
            await self.cm.send_to("c1", {"type": "welcome", "ts": 456})
            await self.cm.send_to("c1", {"type": "ack_error", "message_id": "x"})
        # 系统消息不入缓冲
        assert len(self.cm.reconnect_buffer) == 0
        await self.cm.disconnect("c1")

    @pytest.mark.asyncio
    async def test_record_includes_user_and_rooms(self):
        ws = FakeWebSocket()
        await self.cm.connect("c1", ws, user_uuid="alice", room_id="notice")
        with patch("app.telemetry.get_current_trace_id", return_value=""):
            await self.cm.send_to("c1", {"type": "chat", "msg": "hi"})
        rec = self.cm.reconnect_buffer[0]
        assert rec["user_uuid"] == "alice"
        assert "notice" in rec["rooms"]
        await self.cm.disconnect("c1")


# ---------------------------------------------------------------------------
# 8. HTTP 端点 /ws/notice/sync 存在
# ---------------------------------------------------------------------------


class TestHttpSyncEndpoint:
    def setup_method(self):
        self.cm = _reset_cm()

    def test_sync_route_exists(self):
        """通过扫描 app.routes 验证 /ws/notice/sync 已注册."""
        from app.ws.notice import router as notice_router

        paths = [r.path for r in notice_router.routes]
        sync_path = next((p for p in paths if "sync" in p), None)
        assert sync_path is not None, "应注册 /ws/notice/sync 端点"
        assert "/ws/notice/sync" in sync_path


# ---------------------------------------------------------------------------
# 9. stats() 包含 reconnect 字段
# ---------------------------------------------------------------------------


class TestStatsIncludeReconnect:
    def setup_method(self):
        self.cm = _reset_cm()

    def test_stats_has_reconnect(self):
        s = self.cm.stats()
        for k in (
            "buffer_size",
            "buffer_capacity",
            "buffer_evicted",
            "sync_calls_total",
            "sync_messages_total",
        ):
            assert k in s, f"stats 缺字段: {k}"
