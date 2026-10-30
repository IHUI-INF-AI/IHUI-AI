# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""差距②(2026-10-30):帧水位四维(subscriptionId/logEpoch/fromSeq/toSeq)出站测试。

判据:
① 有流身份(streamSessionId)的流 ⇒ 从首帧起每帧带齐四维,首帧 snapshot(0→1)、
   其后 delta 连续推进(prev.toSeq == next.fromSeq),订阅/纪元恒定;
② 无流身份的流 ⇒ 四字段全缺席,线格式逐字节保持现状(不造值冒充事实);
③ 兼容面(Anthropic wire)不注入;灰度校验 `watermark_payload_fault` 全缺席放行、
   半有/坏型判负;
④ 流收尾摘除上下文 —— 同任务串两条流时,第二条(无 session)不得继承第一条的水位。
"""

from __future__ import annotations

import json
import uuid
from typing import Any

import pytest
from httpx import ASGITransport, AsyncClient

from app.core.sse_contract import PROCESS_LOG_EPOCH, SSE_WATERMARK_PAYLOAD_KEYS
from app.main import app

_WM_KEYS = set(SSE_WATERMARK_PAYLOAD_KEYS)


@pytest.fixture
async def client():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac


def _parse_sse_events(raw: str) -> list[dict[str, Any]]:
    events: list[dict[str, Any]] = []
    for block in raw.split("\n\n"):
        if not block.strip():
            continue
        event_type: str | None = None
        data: Any = None
        for line in block.split("\n"):
            if line.startswith("event:"):
                event_type = line[6:].strip()
            elif line.startswith("data:"):
                data_str = line[5:].strip()
                try:
                    data = json.loads(data_str)
                except (json.JSONDecodeError, ValueError):
                    data = data_str
        if event_type or data is not None:
            events.append({"event": event_type, "data": data})
    return events


async def _fake_gateway(monkeypatch):
    from app.routers import llm as llm_router

    async def fake_astream(messages, model=None, owner_uuid=None):
        yield {"type": "chunk", "content": "好的"}
        yield {"type": "done", "model": "test-model", "usage": {"total_tokens": 7}, "stub": True}

    monkeypatch.setattr(llm_router.llm_gateway, "astream", fake_astream)


class TestWatermarkOnTheWire:
    async def test_session_stream_carries_monotonic_watermark(
        self, client: AsyncClient, monkeypatch
    ):
        await _fake_gateway(monkeypatch)
        session = f"sess-{uuid.uuid4()}"
        resp = await client.post(
            "/api/llm/complete/stream",
            json={
                "messages": [{"role": "user", "content": "test"}],
                "streamSessionId": session,
            },
        )
        assert resp.status_code == 200
        events = _parse_sse_events(resp.text)
        wms: list[tuple[str, Any, Any, Any, Any]] = []
        for e in events:
            d = e["data"]
            if not isinstance(d, dict):
                continue
            present = _WM_KEYS & set(d)
            if present:
                assert present == _WM_KEYS, f"帧 {e['event']} 水位半有:缺 {sorted(_WM_KEYS - present)}"
                wms.append(
                    (e["event"], d["subscriptionId"], d["logEpoch"], d["fromSeq"], d["toSeq"])
                )
        assert wms, "带 streamSessionId 的流必须从首帧起有水位"
        # 订阅与纪元恒定
        assert all(w[1] == session and w[2] == PROCESS_LOG_EPOCH for w in wms)
        # 首帧 snapshot:fromSeq 恒 0、toSeq=1;其后 delta 连续推进
        assert wms[0][3] == 0 and wms[0][4] == 1
        for prev, nxt in zip(wms, wms[1:], strict=False):
            assert nxt[3] == prev[4], f"{nxt[0]} 帧 fromSeq 不接续(消费侧会判 gap)"
            assert nxt[4] == prev[4] + 1
        # 主流内容帧与收尾计量帧都在水位序列内
        wm_events = {w[0] for w in wms}
        assert {"chunk", "done", "usage"} <= wm_events

    async def test_stream_without_session_has_no_watermark(
        self, client: AsyncClient, monkeypatch
    ):
        await _fake_gateway(monkeypatch)
        resp = await client.post(
            "/api/llm/complete/stream",
            json={"messages": [{"role": "user", "content": "test"}]},
        )
        assert resp.status_code == 200
        for e in _parse_sse_events(resp.text):
            if isinstance(e["data"], dict):
                assert not (_WM_KEYS & set(e["data"])), "无流身份的帧不得带水位"

    async def test_watermark_context_cleared_after_stream(
        self, client: AsyncClient, monkeypatch
    ):
        """串流防泄漏:同任务先跑一条带 session 的流,再跑一条无 session 的流,
        后者必须全帧无水位(finally 摘除生效)。"""
        await _fake_gateway(monkeypatch)
        r1 = await client.post(
            "/api/llm/complete/stream",
            json={
                "messages": [{"role": "user", "content": "test"}],
                "streamSessionId": f"sess-{uuid.uuid4()}",
            },
        )
        assert r1.status_code == 200
        r2 = await client.post(
            "/api/llm/complete/stream",
            json={"messages": [{"role": "user", "content": "test"}]},
        )
        assert r2.status_code == 200
        for e in _parse_sse_events(r2.text):
            if isinstance(e["data"], dict):
                assert not (_WM_KEYS & set(e["data"])), "上一条流的水位上下文泄漏到下一条流"


class TestSSEUnitInjection:
    def test_snapshot_then_delta_and_end_clears(self):
        from app.core.sse_frames import begin_stream_watermark, end_stream_watermark
        from app.routers.llm import _sse

        begin_stream_watermark("s-unit")
        try:
            f1 = json.loads(_sse("chunk", {"content": "a"}).split("data: ", 1)[1])
            assert (f1["fromSeq"], f1["toSeq"]) == (0, 1)
            assert f1["subscriptionId"] == "s-unit"
            assert f1["logEpoch"] == PROCESS_LOG_EPOCH
            f2 = json.loads(_sse("chunk", {"content": "b"}).split("data: ", 1)[1])
            assert (f2["fromSeq"], f2["toSeq"]) == (1, 2)
        finally:
            end_stream_watermark()
        f3 = json.loads(_sse("chunk", {"content": "c"}).split("data: ", 1)[1])
        assert not (_WM_KEYS & set(f3)), "end 之后不得再注入"

    def test_compat_events_not_watermarked(self):
        from app.core.sse_contract import SSE_COMPAT_EVENTS
        from app.core.sse_frames import begin_stream_watermark, end_stream_watermark
        from app.routers.llm import _sse

        evt = sorted(SSE_COMPAT_EVENTS)[0]
        begin_stream_watermark("s-compat")
        try:
            frame = json.loads(_sse(evt, {"type": evt}).split("data: ", 1)[1])
            assert not (_WM_KEYS & set(frame)), "Anthropic 兼容 wire 不注入我方自定键"
        finally:
            end_stream_watermark()


class TestWatermarkPayloadFault:
    """灰度兼容校验:全缺席放行;出现即须齐全合法(与消费侧 readFrameWatermark 同序)。"""

    def test_all_absent_passes(self):
        from app.core.sse_contract import watermark_payload_fault

        assert watermark_payload_fault({"type": "chunk", "content": "x"}) == []

    def test_valid_full_set_passes(self):
        from app.core.sse_contract import watermark_payload_fault

        assert (
            watermark_payload_fault(
                {"subscriptionId": "s", "logEpoch": 1, "fromSeq": 0, "toSeq": 1}
            )
            == []
        )

    def test_half_present_rejected(self):
        from app.core.sse_contract import watermark_payload_fault

        assert watermark_payload_fault({"subscriptionId": "s", "fromSeq": 0})

    def test_malformed_values_rejected(self):
        from app.core.sse_contract import watermark_payload_fault

        assert watermark_payload_fault(
            {"subscriptionId": "", "logEpoch": 1, "fromSeq": 0, "toSeq": 1}
        )
        assert watermark_payload_fault(
            {"subscriptionId": "s", "logEpoch": -1, "fromSeq": 0, "toSeq": 1}
        )
        assert watermark_payload_fault(
            {"subscriptionId": "s", "logEpoch": 1, "fromSeq": 5, "toSeq": 4}
        )

    def test_non_dict_payload_passes_through(self):
        from app.core.sse_contract import watermark_payload_fault

        assert watermark_payload_fault("not-a-dict") == []
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
