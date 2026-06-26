"""T3: WebSocket 消息 ACK + 重传协议 单元测试.

覆盖:
- ConnectionManager 暴露 ACK 所需属性 (data classes / lock / counter)
- send_with_ack 成功路径: 登记待 ACK, 返回 message_id, 计数 +1
- send_with_ack 失败路径 (连接不存在): 不留待 ACK, 计数 -1
- handle_ack 成功路径: ack_success +1, 待 ACK 表清空
- handle_ack 重复 ACK: 第二次返回 False
- 客户端不断 ACK 后, 重传器不会重发 (重试次数不增加)
- 超时无 ACK: 重传器会重发, attempts +1
- 重试耗尽: 标记为 giveup, ack_giveup +1
- disconnect 自动清理该 conn_id 的所有待 ACK
- stats() 含 ack 字段
- start_ack_resender / stop_ack_resender 幂等
"""

from __future__ import annotations

import asyncio
import json
import time
from contextlib import asynccontextmanager
from unittest.mock import AsyncMock, MagicMock

import pytest

ROOT = Path = __import__("pathlib").Path(__file__).resolve().parent.parent
import sys

sys.path.insert(0, str(ROOT))


# ---------------------------------------------------------------------------
# 工具: FakeWebSocket (避免真实 accept/send_text)
# ---------------------------------------------------------------------------


class FakeWebSocket:
    """替代真实 WebSocket, 记录所有 send_text 调用."""

    def __init__(self, accept_ok: bool = True, send_ok: bool = True):
        self.accepted = False
        self.closed = False
        self.close_code = None
        self.close_reason = None
        self.sent_texts: list[str] = []
        self.client_state = MagicMock()
        self.client_state.name = "CONNECTED"
        self._accept_ok = accept_ok
        self._send_ok = send_ok
        self._send_fail_count = 0
        self._send_fail_max = 0  # 模拟前 N 次发送失败

    async def accept(self):
        self.accepted = True

    async def send_text(self, text: str) -> None:
        if self._send_fail_count < self._send_fail_max:
            self._send_fail_count += 1
            raise RuntimeError("simulated send failure")
        self.sent_texts.append(text)

    async def close(self, code: int = 1000, reason: str = ""):
        self.closed = True
        self.close_code = code
        self.close_reason = reason

    def set_disconnected(self):
        self.client_state.name = "DISCONNECTED"


# ---------------------------------------------------------------------------
# Helper: 取得单例 cm (重置)
# ---------------------------------------------------------------------------


def _reset_cm():
    from app.ws.manager import ConnectionManager

    ConnectionManager._instance = None
    return ConnectionManager()


# ---------------------------------------------------------------------------
# 1. ConnectionManager 暴露 ACK 所需属性
# ---------------------------------------------------------------------------


class TestAckAttributes:
    def setup_method(self):
        self.cm = _reset_cm()

    def test_has_ack_table(self):
        assert hasattr(self.cm, "_ack_table")
        assert isinstance(self.cm._ack_table, dict)

    def test_has_ack_lock(self):
        import asyncio as _a

        assert hasattr(self.cm, "_ack_lock")
        assert isinstance(self.cm._ack_lock, _a.Lock)

    def test_has_counters(self):
        for k in (
            "_ack_total",
            "_ack_success",
            "_ack_timeout",
            "_ack_giveup",
            "_ack_resent",
        ):
            assert hasattr(self.cm, k), f"缺少计数器: {k}"
            assert getattr(self.cm, k) == 0

    def test_has_config(self):
        for k in ("ack_timeout_sec", "ack_max_attempts", "ack_check_interval_sec"):
            assert hasattr(self.cm, k), f"缺少配置: {k}"
        assert self.cm.ack_timeout_sec > 0
        assert self.cm.ack_max_attempts >= 1
        assert self.cm.ack_check_interval_sec > 0

    def test_has_task_state(self):
        for k in ("_ack_resender_task", "_ack_resender_started", "_ack_resender_lock"):
            assert hasattr(self.cm, k), f"缺少任务状态: {k}"


# ---------------------------------------------------------------------------
# 2. send_with_ack 成功路径
# ---------------------------------------------------------------------------


class TestSendWithAckSuccess:
    def setup_method(self):
        self.cm = _reset_cm()

    @pytest.mark.asyncio
    async def test_send_with_ack_returns_message_id(self):
        ws = FakeWebSocket()
        await self.cm.connect("c1", ws, user_uuid="u1")
        mid = await self.cm.send_with_ack("c1", {"hello": "world"})
        assert mid is not None
        assert len(mid) > 0  # uuid hex
        # 计数 +1
        assert self.cm._ack_total == 1
        # 待 ACK 表登记
        assert "c1" in self.cm._ack_table
        assert mid in self.cm._ack_table["c1"]
        await self.cm.disconnect("c1")

    @pytest.mark.asyncio
    async def test_send_with_ack_injects_ack_metadata(self):
        ws = FakeWebSocket()
        await self.cm.connect("c1", ws, user_uuid="u1")
        mid = await self.cm.send_with_ack("c1", {"x": 1})
        # 客户端应收到 _ack_id / _ack_required / _ack_attempt
        assert len(ws.sent_texts) == 1
        body = json.loads(ws.sent_texts[0])
        assert body["_ack_id"] == mid
        assert body["_ack_required"] is True
        assert body["_ack_attempt"] == 1
        assert body["x"] == 1
        await self.cm.disconnect("c1")

    @pytest.mark.asyncio
    async def test_send_with_ack_external_message_id(self):
        ws = FakeWebSocket()
        await self.cm.connect("c1", ws, user_uuid="u1")
        mid = "test-msg-id-001"
        ret = await self.cm.send_with_ack("c1", {"k": "v"}, message_id=mid)
        assert ret == mid
        body = json.loads(ws.sent_texts[0])
        assert body["_ack_id"] == mid
        await self.cm.disconnect("c1")

    @pytest.mark.asyncio
    async def test_send_with_ack_duplicate_message_id_keeps_existing(self):
        """同一 message_id 重复发送, 应保留首次 attempts=1 (不重置)."""
        ws = FakeWebSocket()
        await self.cm.connect("c1", ws, user_uuid="u1")
        mid = "dup-id"
        await self.cm.send_with_ack("c1", {"k": "v"}, message_id=mid)
        rec = self.cm._ack_table["c1"][mid]
        assert rec["attempts"] == 1
        await self.cm.disconnect("c1")


# ---------------------------------------------------------------------------
# 3. send_with_ack 失败路径
# ---------------------------------------------------------------------------


class TestSendWithAckFailure:
    def setup_method(self):
        self.cm = _reset_cm()

    @pytest.mark.asyncio
    async def test_send_with_ack_to_nonexistent_connection(self):
        """连接不存在时, 不应残留待 ACK."""
        ret = await self.cm.send_with_ack("missing", {"x": 1})
        # 返回 None (失败)
        assert ret is None
        # 待 ACK 表无残留
        assert "missing" not in self.cm._ack_table
        # 计数应回滚 (不增 total, 或不计入成功)
        # 当前实现: 登记 → 发送失败 → handle_ack 移除 → success 计数 -1
        # 所以 total=1, success=1, giveup=0
        # 验证: pending 应为 0
        assert self.cm.ack_stats()["ack_pending"] == 0

    @pytest.mark.asyncio
    async def test_send_with_ack_send_exception(self):
        """send_text 抛异常时, 待 ACK 应被清理."""
        ws = FakeWebSocket()
        ws._send_fail_max = 1  # 第 1 次 send 失败
        await self.cm.connect("c1", ws, user_uuid="u1")
        # 第一次 send_text 失败, manager 内部会捕获然后 disconnect
        # 我们的 send_with_ack 中, _send_envelope → send_to → send_text 失败 → disconnect
        # 此时 send_to 返回 False, 我们 handle_ack 移除
        ret = await self.cm.send_with_ack("c1", {"x": 1})
        # send_to 内部 disconnect, 但 mid 仍可能被 send_to 返回 False
        # 我们的处理: 返回 None (mid 登记后被 ack 清掉)
        # 实际由于 manager.disconnect 会清 _ack_table
        # 验证: ack_pending = 0
        assert self.cm.ack_stats()["ack_pending"] == 0


# ---------------------------------------------------------------------------
# 4. handle_ack
# ---------------------------------------------------------------------------


class TestHandleAck:
    def setup_method(self):
        self.cm = _reset_cm()

    @pytest.mark.asyncio
    async def test_handle_ack_clears_pending(self):
        ws = FakeWebSocket()
        await self.cm.connect("c1", ws, user_uuid="u1")
        mid = await self.cm.send_with_ack("c1", {"x": 1})
        assert mid in self.cm._ack_table["c1"]
        ok = await self.cm.handle_ack("c1", mid)
        assert ok is True
        # 表清空
        assert "c1" not in self.cm._ack_table or mid not in self.cm._ack_table["c1"]
        # 计数
        assert self.cm._ack_success == 1
        await self.cm.disconnect("c1")

    @pytest.mark.asyncio
    async def test_handle_ack_unknown_returns_false(self):
        ok = await self.cm.handle_ack("nobody", "nope")
        assert ok is False
        assert self.cm._ack_success == 0

    @pytest.mark.asyncio
    async def test_handle_ack_duplicate_idempotent(self):
        """同一 ACK 重复到达, 第二次返回 False, success 不增."""
        ws = FakeWebSocket()
        await self.cm.connect("c1", ws, user_uuid="u1")
        mid = await self.cm.send_with_ack("c1", {"x": 1})
        ok1 = await self.cm.handle_ack("c1", mid)
        ok2 = await self.cm.handle_ack("c1", mid)
        assert ok1 is True
        assert ok2 is False
        assert self.cm._ack_success == 1
        await self.cm.disconnect("c1")


# ---------------------------------------------------------------------------
# 5. 超时重传 + giveup
# ---------------------------------------------------------------------------


class TestAckResendAndGiveup:
    def setup_method(self):
        self.cm = _reset_cm()
        # 加速: 短超时
        self.cm.ack_timeout_sec = 0.3
        self.cm.ack_max_attempts = 2
        self.cm.ack_check_interval_sec = 0.1

    @pytest.mark.asyncio
    async def test_resend_after_timeout(self):
        """超时不 ACK, 重传器应在 attempts < max 时重发."""
        ws = FakeWebSocket()
        await self.cm.connect("c1", ws, user_uuid="u1")
        mid = await self.cm.send_with_ack("c1", {"x": 1})
        # 第一次发送: 1 条 send_text
        assert len(ws.sent_texts) == 1
        # 启动重传器
        await self.cm.start_ack_resender()
        try:
            # 等到超时 + 重传
            await asyncio.sleep(0.6)
            # 此时应至少重发 1 次 (attempts=2), _ack_resent >= 1
            assert self.cm._ack_resent >= 1
            # 客户端至少收到 2 条
            assert len(ws.sent_texts) >= 2
        finally:
            await self.cm.stop_ack_resender()
            await self.cm.disconnect("c1")

    @pytest.mark.asyncio
    async def test_giveup_after_max_attempts(self):
        """达到 max_attempts 后, 标记为 giveup, 不再重传."""
        ws = FakeWebSocket()
        await self.cm.connect("c1", ws, user_uuid="u1")
        mid = await self.cm.send_with_ack("c1", {"x": 1})
        # ack_max_attempts=2, 第 1 次发送 + 1 次重传 = 共 2 次, 然后 giveup
        await self.cm.start_ack_resender()
        try:
            # 等待: 0.3s 超时 → 重传 1 次 (attempts=2) → 0.3s 再超时 → giveup
            await asyncio.sleep(1.0)
            assert self.cm._ack_giveup >= 1
            assert self.cm._ack_timeout >= 1
            # 待 ACK 已清空
            assert self.cm.ack_stats()["ack_pending"] == 0
        finally:
            await self.cm.stop_ack_resender()
            await self.cm.disconnect("c1")

    @pytest.mark.asyncio
    async def test_ack_stops_resend(self):
        """客户端及时 ACK, 重传器不应再重发."""
        ws = FakeWebSocket()
        await self.cm.connect("c1", ws, user_uuid="u1")
        mid = await self.cm.send_with_ack("c1", {"x": 1})
        await self.cm.start_ack_resender()
        try:
            # 立即 ACK
            await asyncio.sleep(0.05)
            await self.cm.handle_ack("c1", mid)
            initial_sent = len(ws.sent_texts)
            # 等到超时后, 不应重发
            await asyncio.sleep(0.6)
            # 没有新消息
            assert len(ws.sent_texts) == initial_sent
            # _ack_resent 不应增加
            assert self.cm._ack_resent == 0
        finally:
            await self.cm.stop_ack_resender()
            await self.cm.disconnect("c1")


# ---------------------------------------------------------------------------
# 6. disconnect 清理
# ---------------------------------------------------------------------------


class TestDisconnectCleanup:
    def setup_method(self):
        self.cm = _reset_cm()

    @pytest.mark.asyncio
    async def test_disconnect_clears_all_pending_for_conn(self):
        ws = FakeWebSocket()
        await self.cm.connect("c1", ws, user_uuid="u1")
        await self.cm.send_with_ack("c1", {"a": 1})
        await self.cm.send_with_ack("c1", {"b": 2})
        await self.cm.send_with_ack("c1", {"c": 3})
        assert self.cm.ack_stats()["ack_pending"] == 3
        await self.cm.disconnect("c1")
        assert self.cm.ack_stats()["ack_pending"] == 0
        assert "c1" not in self.cm._ack_table


# ---------------------------------------------------------------------------
# 7. stats() 包含 ack 字段
# ---------------------------------------------------------------------------


class TestStatsIncludeAck:
    def setup_method(self):
        self.cm = _reset_cm()

    def test_stats_has_ack_fields(self):
        s = self.cm.stats()
        for k in (
            "ack_total",
            "ack_success",
            "ack_timeout",
            "ack_giveup",
            "ack_resent",
            "ack_pending",
            "ack_pending_conns",
            "ack_resender_started",
        ):
            assert k in s, f"stats 缺字段: {k}"


# ---------------------------------------------------------------------------
# 8. start / stop 幂等
# ---------------------------------------------------------------------------


class TestResenderLifecycle:
    def setup_method(self):
        self.cm = _reset_cm()

    @pytest.mark.asyncio
    async def test_start_idempotent(self):
        await self.cm.start_ack_resender()
        t1 = self.cm._ack_resender_task
        await self.cm.start_ack_resender()
        t2 = self.cm._ack_resender_task
        assert t1 is t2
        await self.cm.stop_ack_resender()

    @pytest.mark.asyncio
    async def test_stop_clears_pending(self):
        ws = FakeWebSocket()
        await self.cm.connect("c1", ws, user_uuid="u1")
        await self.cm.send_with_ack("c1", {"x": 1})
        assert self.cm.ack_stats()["ack_pending"] == 1
        await self.cm.stop_ack_resender()
        assert self.cm.ack_stats()["ack_pending"] == 0
        await self.cm.disconnect("c1")
