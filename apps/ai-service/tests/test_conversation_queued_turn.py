# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""差距③(2026-10-30):queued 上 wire —— 会话级流道(lane)的服务端排队测试。

判据:
① 同会话有活跃流 ⇒ 新流产出 admission{disposition:'queued', inputId 回显,
   queuedTurnId 服务端生成},不并行执行;
② 当前流收口 ⇒ 排队流在同一条 HTTP 流上自动执行(开始执行帧 accepted + 同
   queuedTurnId,随后 chunk/done 照常);
③ 无活跃流(前流已收口)⇒ 直接 accepted,lane 收干净;
④ 防刷闸门(抄 steer):队列满 ⇒ admission{rejected, conversation_queue_full},
   不执行、撤痕(重试不误判 duplicate);
⑤ lane 释放的 FIFO 语义:晋升队首 / 排队中被掐只摘自己不越位晋升。
"""

from __future__ import annotations

import asyncio
import json
import uuid
from collections.abc import AsyncIterator
from typing import Any

import pytest
from httpx import ASGITransport, AsyncClient
from starlette.requests import Request
from starlette.responses import StreamingResponse

from app.main import app

_STREAM_URL = "/api/llm/complete/stream"


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


def _admissions(events: list[dict[str, Any]]) -> list[dict[str, Any]]:
    return [e["data"] for e in events if e["event"] == "admission"]


async def _fake_gateway_holding(monkeypatch, hold: asyncio.Event) -> None:
    """假网关:吐 A1 后卡在 hold 上(模拟前流长时间执行),放行后吐 A2 + done。"""
    from app.routers import llm as llm_router

    async def fake_astream(messages, model=None, owner_uuid=None):
        yield {"type": "chunk", "content": "A1"}
        await hold.wait()
        yield {"type": "chunk", "content": "A2"}
        yield {"type": "done", "model": "test-model", "usage": {}, "stub": True}

    monkeypatch.setattr(llm_router.llm_gateway, "astream", fake_astream)


async def _fake_gateway_simple(monkeypatch) -> None:
    from app.routers import llm as llm_router

    async def fake_astream(messages, model=None, owner_uuid=None):
        yield {"type": "chunk", "content": "好的"}
        yield {"type": "done", "model": "test-model", "usage": {}, "stub": True}

    monkeypatch.setattr(llm_router.llm_gateway, "astream", fake_astream)


def _body(input_id: str, conv: str, message_id: str) -> dict[str, Any]:
    return {
        "messages": [{"role": "user", "content": "test"}],
        "inputId": input_id,
        "metadata": {"conversationId": conv, "messageId": message_id},
    }


def _bare_request(body: dict[str, Any]) -> Request:
    """裸 ASGI 请求(不经中间件链):端点内身份类辅助全走 getattr 兜底,匿名可用。"""
    payload = json.dumps(body).encode()
    scope: dict[str, Any] = {
        "type": "http",
        "asgi": {"version": "3.0", "spec_version": "2.3"},
        "http_version": "1.1",
        "method": "POST",
        "scheme": "http",
        "path": _STREAM_URL,
        "raw_path": _STREAM_URL.encode(),
        "query_string": b"",
        "root_path": "",
        "headers": [
            (b"host", b"test"),
            (b"content-type", b"application/json"),
            (b"content-length", str(len(payload)).encode()),
        ],
        "client": ("127.0.0.1", 123),
        "server": ("test", 80),
        "state": {},
    }

    async def receive() -> dict[str, Any]:
        return {"type": "http.request", "body": payload, "more_body": False}

    return Request(scope, receive)


async def _stream_pieces(body: dict[str, Any]) -> AsyncIterator[str]:
    """直取端点 StreamingResponse 的 body_iterator,逐帧增量消费。

    本环境 httpx ASGITransport 会把响应体**整段缓冲**后一次性交读
    (httpx._transports.asgi.ASGIResponseStream 以 b"".join 收尾),并发双流
    走它必然死锁:前流卡在 hold 上永不收口,后流永远读不到 queued 帧。
    """
    from app.routers.llm import LLMCompleteRequest, complete_stream

    resp = await complete_stream(LLMCompleteRequest(**body), _bare_request(body))
    assert isinstance(resp, StreamingResponse), "preflight 不应拦掉本流的 SSE 响应"
    async for piece in resp.body_iterator:
        yield piece.decode("utf-8") if isinstance(piece, bytes) else piece


class TestQueuedOnTheWire:
    async def test_active_stream_makes_second_queued_then_auto_executes(
        self, monkeypatch
    ):
        hold = asyncio.Event()
        await _fake_gateway_holding(monkeypatch, hold)
        conv = f"conv-{uuid.uuid4()}"
        text_a: list[str] = []
        text_b: list[str] = []
        a1_seen = asyncio.Event()
        queued_seen = asyncio.Event()

        async def _collect(gen: AsyncIterator[str], sink: list[str], seen: asyncio.Event, marker: str) -> None:
            async for piece in gen:
                sink.append(piece)
                if not seen.is_set() and marker in "".join(sink):
                    seen.set()

        task_a = asyncio.create_task(
            _collect(_stream_pieces(_body("i-a", conv, "m-a")), text_a, a1_seen, '"A1"')
        )
        task_b: asyncio.Task[None] | None = None
        try:
            # 前流确实在跑(首 chunk 已出,lane active 已登记)
            await asyncio.wait_for(a1_seen.wait(), timeout=10)

            task_b = asyncio.create_task(
                _collect(_stream_pieces(_body("i-b", conv, "m-b")), text_b, queued_seen, '"queued"')
            )
            # ① 排队回执:首个 admission 是 queued,带服务端 queuedTurnId
            await asyncio.wait_for(queued_seen.wait(), timeout=10)
            adm_early = _admissions(_parse_sse_events("".join(text_b)))
            assert len(adm_early) == 1, "queued 档在晋升前只发一帧"
            queued_data = adm_early[0]
            assert queued_data["type"] == "admission"
            assert queued_data["inputId"] == "i-b"  # 回显,不换位
            assert queued_data["disposition"] == "queued"
            queued_turn_id = queued_data["queuedTurnId"]
            assert isinstance(queued_turn_id, str) and queued_turn_id

            # ② 前流收口 ⇒ 排队流在同一条流上自动执行
            hold.set()
            await asyncio.wait_for(task_a, timeout=10)
            await asyncio.wait_for(task_b, timeout=10)

            events_b = _parse_sse_events("".join(text_b))
            adm_b = _admissions(events_b)
            assert [d["disposition"] for d in adm_b] == ["queued", "accepted"]
            # 开始执行帧携带同 queuedTurnId(关联凭据)与 messageId
            assert adm_b[1]["queuedTurnId"] == queued_turn_id
            assert adm_b[1]["messageId"] == "m-b"
            names_b = [e["event"] for e in events_b if e["event"]]
            assert "chunk" in names_b and "done" in names_b, "晋升后正文照常产出"
            assert names_b.index("admission") == 0
            # 双流都收口 ⇒ lane 整体回收
            from app.routers import llm as llm_router

            assert conv not in llm_router._conv_lanes
        finally:
            hold.set()
            for t in (task_a, task_b):
                if t is not None and not t.done():
                    t.cancel()
            from app.routers import llm as llm_router

            llm_router._admission_seen.pop(conv, None)
            llm_router._conv_lanes.pop(conv, None)

    async def test_second_stream_after_close_is_accepted(self, client: AsyncClient, monkeypatch):
        await _fake_gateway_simple(monkeypatch)
        conv = f"conv-{uuid.uuid4()}"
        try:
            r1 = await client.post(_STREAM_URL, json=_body("i-1", conv, "m-1"))
            assert r1.status_code == 200
            r2 = await client.post(_STREAM_URL, json=_body("i-2", conv, "m-2"))
            events = _parse_sse_events(r2.text)
            adm = _admissions(events)
            assert [d["disposition"] for d in adm] == ["accepted"]
            from app.routers import llm as llm_router

            # 前流收口 ⇒ lane 整体回收(不留残桶)
            assert conv not in llm_router._conv_lanes
        finally:
            from app.routers import llm as llm_router

            llm_router._admission_seen.pop(conv, None)
            llm_router._conv_lanes.pop(conv, None)

    async def test_queue_full_rejects_without_executing(self, client: AsyncClient, monkeypatch):
        await _fake_gateway_simple(monkeypatch)
        from app.routers import llm as llm_router

        conv = f"conv-{uuid.uuid4()}"
        lane = llm_router._conv_lane(conv)
        lane["active"] = "tok-ghost"  # 伪造活跃流(不真开流,专测闸门)
        lane["waiting"] = [
            {"turn": f"tok-w{i}", "queuedTurnId": f"q{i}", "event": asyncio.Event()}
            for i in range(llm_router._CONV_QUEUE_LIMIT)
        ]
        input_id = f"i-{uuid.uuid4()}"
        try:
            resp = await client.post(_STREAM_URL, json=_body(input_id, conv, "m-x"))
            assert resp.status_code == 200
            events = _parse_sse_events(resp.text)
            adm = _admissions(events)
            assert len(adm) == 1
            assert adm[0]["disposition"] == "rejected"
            assert adm[0]["reason"] == "conversation_queue_full"
            names = [e["event"] for e in events if e["event"]]
            assert "chunk" not in names and "done" not in names, "拒收档不执行本轮"
            # 撤痕:拒收不是准入,同 inputId 重试不得被读成 duplicate
            assert input_id not in llm_router._admission_seen.get(conv, {})
            # 伪造 lane 不受拒收流扰动
            assert lane["active"] == "tok-ghost"
            assert len(lane["waiting"]) == llm_router._CONV_QUEUE_LIMIT
        finally:
            llm_router._admission_seen.pop(conv, None)
            llm_router._conv_lanes.pop(conv, None)


class TestLaneReleaseSemantics:
    """_conv_lane_release 的 FIFO 语义(纯同步单元测,不依赖事件循环调度)。"""

    def test_release_promotes_head_in_fifo_order(self):
        from app.routers import llm as llm_router

        conv = f"conv-{uuid.uuid4()}"
        try:
            lane = llm_router._conv_lane(conv)
            ev_b, ev_c = asyncio.Event(), asyncio.Event()
            entry_b = {"turn": "tok-b", "queuedTurnId": "q-b", "event": ev_b}
            entry_c = {"turn": "tok-c", "queuedTurnId": "q-c", "event": ev_c}
            lane["active"] = "tok-a"
            lane["waiting"] = [entry_b, entry_c]

            llm_router._conv_lane_release(conv, "tok-a", None)
            assert ev_b.is_set() and not ev_c.is_set()
            assert lane["active"] == "tok-b"
            assert lane["waiting"] == [entry_c]

            # 晋升者收口:其排队条目已被晋升摘除,重复 remove 静默无害
            llm_router._conv_lane_release(conv, "tok-b", entry_b)
            assert ev_c.is_set()
            assert lane["active"] == "tok-c"

            llm_router._conv_lane_release(conv, "tok-c", None)
            assert conv not in llm_router._conv_lanes, "空 lane 必须整体回收"
        finally:
            llm_router._conv_lanes.pop(conv, None)

    def test_release_of_cancelled_waiter_only_removes_itself(self):
        from app.routers import llm as llm_router

        conv = f"conv-{uuid.uuid4()}"
        try:
            lane = llm_router._conv_lane(conv)
            entry = {"turn": "tok-b", "queuedTurnId": "q-b", "event": asyncio.Event()}
            lane["active"] = "tok-a"
            lane["waiting"] = [entry]

            # 排队中被掐(客户端断开):摘自己,不越位晋升,不动别人的 active
            llm_router._conv_lane_release(conv, "tok-b", entry)
            assert lane["waiting"] == []
            assert lane["active"] == "tok-a"
            assert conv in llm_router._conv_lanes
        finally:
            llm_router._conv_lanes.pop(conv, None)
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
