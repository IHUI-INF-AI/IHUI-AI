# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""差距①(2026-10-30):发送准入回执(admission)帧的生产侧测试。

判据三问:
① inputId 在场 ⇒ 首个内容帧之前产出 admission 帧,形状与
   packages/shared/src/chat/send-admission.ts L40-74 逐字对齐(camelCase);
② inputId 缺席 ⇒ 一帧不发(旧客户端零行为变化);同一 inputId 重发 ⇒ duplicate;
③ 产出异常 ⇒ 降级为不发帧,主流照常走完(附加交代帧坏了不拖主链路)。
"""

from __future__ import annotations

import json
import uuid
from typing import Any

import pytest
from httpx import ASGITransport, AsyncClient

from app.main import app


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
        yield {"type": "done", "model": "test-model", "usage": {}, "stub": True}

    monkeypatch.setattr(llm_router.llm_gateway, "astream", fake_astream)


class TestAdmissionDispositionLedger:
    """判定唯一出口的留痕语义(accepted→duplicate、无 conv 恒 accepted、FIFO 封顶)。"""

    def test_accepted_then_duplicate(self):
        from app.routers.llm import _admission_disposition, _admission_seen

        conv = f"conv-{uuid.uuid4()}"
        try:
            assert _admission_disposition(conv, "i1") == "accepted"
            assert _admission_disposition(conv, "i1") == "duplicate"
            assert _admission_disposition(conv, "i2") == "accepted"
        finally:
            _admission_seen.pop(conv, None)

    def test_no_conversation_id_never_duplicate(self):
        from app.routers.llm import _admission_disposition, _admission_seen

        assert _admission_disposition(None, "x") == "accepted"
        assert _admission_disposition("", "x") == "accepted"
        assert _admission_disposition(None, "x") == "accepted"
        assert _admission_seen == {} or all(
            "x" not in seen for seen in _admission_seen.values()
        ), "conv 缺席不得登记留痕(不冒充判过 duplicate)"

    def test_fifo_eviction_at_cap(self, monkeypatch):
        from app.routers import llm as llm_router

        conv = f"conv-{uuid.uuid4()}"
        monkeypatch.setattr(llm_router, "_ADMISSION_SEEN_LIMIT", 3)
        try:
            for i in range(4):
                assert llm_router._admission_disposition(conv, f"i{i}") == "accepted"
            # 封顶 3 ⇒ 最老的 i0 已被逐出,再来一次读作 accepted 而非 duplicate
            assert llm_router._admission_disposition(conv, "i0") == "accepted"
            assert llm_router._admission_disposition(conv, "i3") == "duplicate"
        finally:
            llm_router._admission_seen.pop(conv, None)


class TestAdmissionContractRegistration:
    """契约面:事件登记 + 形状校验(sse_frame_schema_fault 的 admission 分支)。"""

    def test_event_and_contract_registered(self):
        from app.core.sse_contract import SSE_EVENT_CONTRACTS, SSE_EVENTS

        assert "admission" in SSE_EVENTS
        fields = {c.name: c.payload_fields for c in SSE_EVENT_CONTRACTS}
        # 只有 inputId/disposition 是必需档;messageId/reason 可选不列(防恒告警)
        assert fields["admission"] == ("inputId", "disposition")

    def test_schema_fault_accepts_valid_rejects_malformed(self):
        from app.core.sse_contract import sse_frame_schema_fault

        assert (
            sse_frame_schema_fault(
                "admission", {"type": "admission", "inputId": "i1", "disposition": "accepted"}
            )
            == []
        )
        assert sse_frame_schema_fault("admission", {"inputId": "", "disposition": "accepted"})
        assert sse_frame_schema_fault("admission", {"inputId": "i1", "disposition": "bogus"})
        assert sse_frame_schema_fault("admission", {"inputId": "i1"})  # disposition 缺席也判坏


class TestAdmissionFrameOnTheWire:
    async def test_accepted_emitted_before_first_content_frame(
        self, client: AsyncClient, monkeypatch
    ):
        await _fake_gateway(monkeypatch)
        conv = f"conv-{uuid.uuid4()}"
        resp = await client.post(
            "/api/llm/complete/stream",
            json={
                "messages": [{"role": "user", "content": "test"}],
                "inputId": "inp-1",
                "metadata": {"conversationId": conv, "messageId": "msg-9"},
            },
        )
        assert resp.status_code == 200
        events = _parse_sse_events(resp.text)
        names = [e["event"] for e in events if e["event"]]
        assert "admission" in names
        adm = [e for e in events if e["event"] == "admission"][0]["data"]
        # 形状逐字(send-admission.ts L40-74,camelCase)
        assert adm["type"] == "admission"
        assert adm["inputId"] == "inp-1"
        assert adm["disposition"] == "accepted"
        assert adm["messageId"] == "msg-9"
        # 准入判定完成、首个内容帧之前
        assert names.index("admission") < names.index("chunk")
        from app.routers import llm as llm_router

        llm_router._admission_seen.pop(conv, None)

    async def test_resend_same_input_id_is_duplicate(self, client: AsyncClient, monkeypatch):
        await _fake_gateway(monkeypatch)
        conv = f"conv-{uuid.uuid4()}"
        body = {
            "messages": [{"role": "user", "content": "test"}],
            "inputId": "inp-dup",
            "metadata": {"conversationId": conv},
        }
        try:
            r1 = await client.post("/api/llm/complete/stream", json=body)
            r2 = await client.post("/api/llm/complete/stream", json=body)
            d1 = [e["data"] for e in _parse_sse_events(r1.text) if e["event"] == "admission"]
            d2 = [e["data"] for e in _parse_sse_events(r2.text) if e["event"] == "admission"]
            assert [d["disposition"] for d in d1] == ["accepted"]
            assert [d["disposition"] for d in d2] == ["duplicate"]
            assert d2[0]["inputId"] == "inp-dup"  # 回显请求值,配对锚不换位
        finally:
            from app.routers import llm as llm_router

            llm_router._admission_seen.pop(conv, None)

    async def test_no_input_id_produces_no_frame(self, client: AsyncClient, monkeypatch):
        await _fake_gateway(monkeypatch)
        resp = await client.post(
            "/api/llm/complete/stream",
            json={"messages": [{"role": "user", "content": "test"}]},
        )
        assert resp.status_code == 200
        events = _parse_sse_events(resp.text)
        assert [e for e in events if e["event"] == "admission"] == []

    async def test_emit_failure_degrades_to_no_frame_stream_survives(
        self, client: AsyncClient, monkeypatch
    ):
        from app.routers import llm as llm_router

        await _fake_gateway(monkeypatch)

        def boom(*a: Any, **k: Any) -> str:
            raise RuntimeError("准入判定炸了")

        monkeypatch.setattr(llm_router, "_admission_disposition", boom)
        resp = await client.post(
            "/api/llm/complete/stream",
            json={
                "messages": [{"role": "user", "content": "test"}],
                "inputId": f"inp-{uuid.uuid4()}",
            },
        )
        assert resp.status_code == 200
        events = _parse_sse_events(resp.text)
        names = [e["event"] for e in events if e["event"]]
        assert "admission" not in names, "产出失败必须整帧不发,不发坏帧"
        assert "chunk" in names and "done" in names, "附加交代帧坏了绝不拖主流"
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
