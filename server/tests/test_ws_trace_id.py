"""T5: 链路追踪串联 (trace_id 注入 / 提取) 单元测试.

覆盖:
- ConnectionManager 暴露 trace 属性 (enabled / 计数器)
- _extract_trace_id 兼容 OTel 未启用 (返回空串)
- extract_trace_from_payload 从 _trace_id / trace_id / X-Trace-Id 提取
- extract_trace_from_payload 非 dict / 空字段处理
- send_to 自动注入 _trace_id (OTel 启用时)
- send_to 不覆盖已有的 _trace_id
- trace_enabled = False 时不注入
- stats() 包含 trace 字段
- trace 注入 / 提取计数正确
"""

from __future__ import annotations

import json
from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest

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
# 1. ConnectionManager 暴露 trace 属性
# ---------------------------------------------------------------------------


class TestTraceAttributes:
    def setup_method(self):
        self.cm = _reset_cm()

    def test_has_trace_enabled(self):
        assert hasattr(self.cm, "trace_enabled")
        assert self.cm.trace_enabled is True

    def test_has_counters(self):
        for k in (
            "_trace_total_injected",
            "_trace_total_extracted",
            "_trace_missing_count",
        ):
            assert hasattr(self.cm, k)
            assert getattr(self.cm, k) == 0

    def test_has_methods(self):
        for m in ("_extract_trace_id", "extract_trace_from_payload", "trace_stats"):
            assert hasattr(self.cm, m), f"缺少方法: {m}"
            assert callable(getattr(self.cm, m))


# ---------------------------------------------------------------------------
# 2. _extract_trace_id (OTel 集成)
# ---------------------------------------------------------------------------


class TestExtractTraceId:
    def setup_method(self):
        self.cm = _reset_cm()

    def test_returns_empty_when_disabled(self):
        self.cm.trace_enabled = False
        assert self.cm._extract_trace_id() == ""

    def test_returns_empty_when_otel_unavailable(self):
        """OTel 未启用 / 没有 active span 时, 返回空串."""
        # 模拟 telemetry.get_current_trace_id 抛异常或返回空
        with patch("app.telemetry.get_current_trace_id", return_value=""):
            tid = self.cm._extract_trace_id()
        # 返回空, 计数 +1
        assert tid == ""
        assert self.cm._trace_missing_count == 1

    def test_returns_trace_id_from_otel(self):
        fake_tid = "0123456789abcdef0123456789abcdef"
        with patch("app.telemetry.get_current_trace_id", return_value=fake_tid):
            tid = self.cm._extract_trace_id()
        assert tid == fake_tid
        # 成功时不增 missing
        assert self.cm._trace_missing_count == 0

    def test_handles_import_error(self):
        """telemetry 模块导入失败时, 不应抛异常."""
        with patch.dict("sys.modules", {"app.telemetry": None}):
            with patch("builtins.__import__", side_effect=ImportError("test")):
                tid = self.cm._extract_trace_id()
        # 失败时返回空, 计数 +1
        assert tid == ""
        assert self.cm._trace_missing_count == 1


# ---------------------------------------------------------------------------
# 3. extract_trace_from_payload
# ---------------------------------------------------------------------------


class TestExtractFromPayload:
    def setup_method(self):
        self.cm = _reset_cm()

    def test_underscore_trace_id(self):
        tid = self.cm.extract_trace_from_payload({"_trace_id": "abc123"})
        assert tid == "abc123"
        assert self.cm._trace_total_extracted == 1

    def test_trace_id_field(self):
        tid = self.cm.extract_trace_from_payload({"trace_id": "xyz789"})
        assert tid == "xyz789"
        assert self.cm._trace_total_extracted == 1

    def test_x_trace_id_header(self):
        tid = self.cm.extract_trace_from_payload({"X-Trace-Id": "header_trace"})
        assert tid == "header_trace"
        assert self.cm._trace_total_extracted == 1

    def test_priority_underscore_first(self):
        """多个字段时, 优先 _trace_id."""
        tid = self.cm.extract_trace_from_payload(
            {
                "_trace_id": "a",
                "trace_id": "b",
                "X-Trace-Id": "c",
            }
        )
        assert tid == "a"

    def test_non_dict(self):
        tid = self.cm.extract_trace_from_payload("not a dict")  # type: ignore
        assert tid == ""

    def test_empty(self):
        tid = self.cm.extract_trace_from_payload({})
        assert tid == ""
        # 空时不增计数
        assert self.cm._trace_total_extracted == 0

    def test_non_string(self):
        tid = self.cm.extract_trace_from_payload({"_trace_id": 12345})  # type: ignore
        assert tid == ""


# ---------------------------------------------------------------------------
# 4. send_to 自动注入
# ---------------------------------------------------------------------------


class TestSendToInjectTrace:
    def setup_method(self):
        self.cm = _reset_cm()

    @pytest.mark.asyncio
    async def test_injects_trace_id_when_otel_active(self):
        fake_tid = "aabbccddeeff00112233445566778899"
        ws = FakeWebSocket()
        await self.cm.connect("c1", ws, user_uuid="u1")
        with patch("app.telemetry.get_current_trace_id", return_value=fake_tid):
            await self.cm.send_to("c1", {"type": "hello"})
        body = json.loads(ws.sent_texts[0])
        assert body["_trace_id"] == fake_tid
        assert self.cm._trace_total_injected == 1
        await self.cm.disconnect("c1")

    @pytest.mark.asyncio
    async def test_does_not_overwrite_existing_trace_id(self):
        ws = FakeWebSocket()
        await self.cm.connect("c1", ws, user_uuid="u1")
        custom_tid = "client_provided_trace_001"
        with patch("app.telemetry.get_current_trace_id", return_value="server_trace"):
            await self.cm.send_to("c1", {"_trace_id": custom_tid, "type": "data"})
        body = json.loads(ws.sent_texts[0])
        # 客户端已提供, 不覆盖
        assert body["_trace_id"] == custom_tid
        # 注入计数不增
        assert self.cm._trace_total_injected == 0
        await self.cm.disconnect("c1")

    @pytest.mark.asyncio
    async def test_no_inject_when_disabled(self):
        self.cm.trace_enabled = False
        ws = FakeWebSocket()
        await self.cm.connect("c1", ws, user_uuid="u1")
        with patch("app.telemetry.get_current_trace_id", return_value="some_tid"):
            await self.cm.send_to("c1", {"type": "data"})
        body = json.loads(ws.sent_texts[0])
        assert "_trace_id" not in body
        assert self.cm._trace_total_injected == 0
        await self.cm.disconnect("c1")

    @pytest.mark.asyncio
    async def test_no_inject_when_otel_empty(self):
        """OTel 无 active span 时, 不注入 _trace_id 字段 (保持 payload 干净)."""
        ws = FakeWebSocket()
        await self.cm.connect("c1", ws, user_uuid="u1")
        with patch("app.telemetry.get_current_trace_id", return_value=""):
            await self.cm.send_to("c1", {"type": "data"})
        body = json.loads(ws.sent_texts[0])
        # 没有 _trace_id 字段
        assert "_trace_id" not in body
        # 不算注入
        assert self.cm._trace_total_injected == 0
        # missing_count 增
        assert self.cm._trace_missing_count == 1
        await self.cm.disconnect("c1")

    @pytest.mark.asyncio
    async def test_non_dict_payload_not_injected(self):
        """非 dict payload 跳过注入 (不应崩)."""
        ws = FakeWebSocket()
        await self.cm.connect("c1", ws, user_uuid="u1")
        with patch("app.telemetry.get_current_trace_id", return_value="tid"):
            # send_to 期望 dict, 但我们测试容错
            try:
                await self.cm.send_to("c1", "raw string")  # type: ignore
            except Exception:
                pass
        # 计数不增
        assert self.cm._trace_total_injected == 0
        await self.cm.disconnect("c1")


# ---------------------------------------------------------------------------
# 5. trace_stats
# ---------------------------------------------------------------------------


class TestTraceStats:
    def setup_method(self):
        self.cm = _reset_cm()

    def test_initial(self):
        s = self.cm.trace_stats()
        assert s["trace_enabled"] is True
        assert s["trace_injected_total"] == 0
        assert s["trace_extracted_total"] == 0
        assert s["trace_missing_total"] == 0

    def test_after_extractions(self):
        self.cm.extract_trace_from_payload({"_trace_id": "a"})
        self.cm.extract_trace_from_payload({"_trace_id": "b"})
        s = self.cm.trace_stats()
        assert s["trace_extracted_total"] == 2

    def test_after_missing(self):
        with patch("app.telemetry.get_current_trace_id", return_value=""):
            self.cm._extract_trace_id()
        s = self.cm.trace_stats()
        assert s["trace_missing_total"] == 1


# ---------------------------------------------------------------------------
# 6. stats() 包含 trace 字段
# ---------------------------------------------------------------------------


class TestStatsIncludeTrace:
    def setup_method(self):
        self.cm = _reset_cm()

    def test_stats_has_trace(self):
        s = self.cm.stats()
        for k in (
            "trace_enabled",
            "trace_injected_total",
            "trace_extracted_total",
            "trace_missing_total",
        ):
            assert k in s, f"stats 缺字段: {k}"
