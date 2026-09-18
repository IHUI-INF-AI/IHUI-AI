# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""Agent Engine JSON-RPC 传输层端到端测试(P2-③,2026-09-18 立)。

覆盖 services/agent_engine.py 之上的两个真实承载:
    POST /api/engine/rpc   单发 / 批量 / 非法 JSON / 流式(SSE)自动升级
    WS   /api/engine/ws    握手鉴权 / 帧往返 / 长跑帧不阻塞后续帧 / 跨承载共享线程

隔离策略:每个用例挂独立最小 FastAPI app + 把路由模块的进程级单例 ENGINE
monkeypatch 成私有引擎(假主循环,不触真实 LLM,也不污染其它测试的线程状态)。
"""

from __future__ import annotations

import asyncio
import json
from typing import Any

import pytest
from fastapi import FastAPI
from httpx import ASGITransport, AsyncClient
from starlette.testclient import TestClient
from starlette.websockets import WebSocketDisconnect

from app.routers import engine as engine_router
from app.services.agent_engine import (
    INVALID_PARAMS,
    METHOD_NOT_FOUND,
    PROTOCOL_VERSION,
    THREAD_CLOSED,
    THREAD_NOT_FOUND,
    AgentEngine,
)

# =============================================================================
# 假事件总线(与 hook_engine.subscribe 签名对齐;与引擎内部订阅工厂协同)
# =============================================================================


class _Bus:
    """同步假总线:push 即入队,供承载层测试制造真实到达顺序的事件。"""

    def __init__(self) -> None:
        self.queues: dict[str, list[Any]] = {}

    def subscribe(self, event: str, queue_factory: Any | None = None) -> Any:
        queue: Any = queue_factory() if queue_factory is not None else asyncio.Queue()
        self.queues.setdefault(event, []).append(queue)
        return queue

    def unsubscribe(self, event: str, queue: Any) -> None:
        subs = self.queues.get(event)
        if subs and queue in subs:
            subs.remove(queue)

    def push(self, event: str, payload: dict[str, Any]) -> None:
        for queue in self.queues.get(event, []):
            queue.put_nowait(payload)

# =============================================================================
# 假主循环(语义与 AgentLoopV2 对齐,只保留承载层关心的字段)
# =============================================================================


class _Result:
    def __init__(self, final_response: str = "完成") -> None:
        self.success = True
        self.stop_reason = "completed"
        self.final_response = final_response
        self.iterations: list[dict[str, Any]] = [{"iteration": 1}]
        self.total_duration_ms = 3.5
        self.total_tokens_used = 7
        self.checkpoint_id = None
        self.error = None
        self.budget = None
        self.compaction_events: list[dict[str, Any]] = []


class _Loop:
    def __init__(self, *, delay: float = 0.0, bus: _Bus | None = None) -> None:
        self._delay = delay
        self._bus = bus
        self.spec: dict[str, Any] = {}

    async def run(self, messages: list[dict[str, Any]]) -> _Result:
        if self._bus is not None:
            # 模拟主循环发事件:跨两个事件名,验证承载层能复原真实到达顺序
            sid = self.spec.get("session_id")
            self._bus.push("tool.before", {"session_id": sid, "tool": "read_file"})
            self._bus.push("message.receive", {"session_id": sid, "content": "最终答复"})
            self._bus.push("tool.before", {"session_id": "other-thread", "tool": "x"})
        if self._delay:
            await asyncio.sleep(self._delay)
        messages.append({"role": "assistant", "content": "回答"})
        return _Result()

    async def cancel(self) -> str:
        return "ckpt"

    async def pause(self) -> str:
        return "ckpt"

    async def resume_from_checkpoint(self, checkpoint_id: str) -> _Result:
        return _Result("续跑")


async def _tool_pool() -> list[dict[str, Any]]:
    return [{"name": "read_file", "description": "读文件"}]


def _engine(*, delay: float = 0.0, bus: _Bus | None = None) -> AgentEngine:
    async def factory(spec: dict[str, Any], host_tools: list[Any]) -> _Loop:
        loop = _Loop(delay=delay, bus=bus)
        loop.spec = spec
        return loop

    return AgentEngine(
        loop_factory=factory,
        tool_lister=_tool_pool,
        cost_report=lambda _filt: {"aggregate": {"totalCost": 0.5}, "topTools": []},
        model_lister=lambda: [{"model": "mock/model-a", "scope": "model"}],
        hook_bus=bus,
    )


@pytest.fixture
def api(monkeypatch):
    """独立 app + 私有引擎(不共享进程级 ENGINE 的线程状态)。"""
    engine = _engine()
    monkeypatch.setattr(engine_router, "ENGINE", engine)
    app = FastAPI()
    app.include_router(engine_router.router, prefix="/api")
    return app, engine


@pytest.fixture
async def client(api):
    app, _engine_obj = api
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        yield c


def _rpc(method: str, params: dict[str, Any] | None = None, *, rid: Any = 1) -> dict:
    return {"jsonrpc": "2.0", "id": rid, "method": method, "params": params or {}}


def _sse_frames(text: str) -> list[dict[str, Any]]:
    """解析 SSE 体里的 JSON-RPC 帧(心跳注释帧与 [DONE] 已排除)。"""
    out: list[dict[str, Any]] = []
    for line in text.splitlines():
        if not line.startswith("data: "):
            continue
        raw = line[6:].strip()
        if raw and raw != "[DONE]":
            out.append(json.loads(raw))
    return out


async def _start_thread(client: AsyncClient) -> str:
    resp = await client.post("/api/engine/rpc", json=_rpc("thread.start"))
    return resp.json()["result"]["threadId"]


# =============================================================================
# POST /api/engine/rpc —— 单发
# =============================================================================


async def test_rpc_engine_initialize_round_trip(client):
    resp = await client.post("/api/engine/rpc", json=_rpc("engine.initialize"))
    assert resp.status_code == 200
    body = resp.json()
    assert body["id"] == 1
    assert body["result"]["protocolVersion"] == PROTOCOL_VERSION
    assert "thread.prompt" in body["result"]["methods"]


async def test_rpc_thread_lifecycle_over_http(client):
    """start → prompt → state → close:线程状态跨 HTTP 调用保留(进程级单例语义)。"""
    thread_id = await _start_thread(client)

    prompted = await client.post(
        "/api/engine/rpc",
        json=_rpc("thread.prompt", {"threadId": thread_id, "input": "你好"}),
    )
    assert prompted.headers["content-type"].startswith("text/event-stream")

    state = await client.post(
        "/api/engine/rpc", json=_rpc("thread.state", {"threadId": thread_id})
    )
    assert state.json()["result"]["prompts"] == 1
    assert state.json()["result"]["status"] == "idle"

    closed = await client.post(
        "/api/engine/rpc", json=_rpc("thread.close", {"threadId": thread_id})
    )
    assert closed.json()["result"]["closed"] is True

    after = await client.post(
        "/api/engine/rpc", json=_rpc("thread.state", {"threadId": thread_id})
    )
    assert after.json()["error"]["code"] == THREAD_CLOSED


async def test_rpc_unknown_method_returns_standard_error(client):
    resp = await client.post("/api/engine/rpc", json=_rpc("nope.nope"))
    body = resp.json()
    assert body["error"]["code"] == METHOD_NOT_FOUND
    assert "thread.prompt" in body["error"]["data"]["supported"]


async def test_rpc_invalid_json_returns_parse_error(client):
    resp = await client.post(
        "/api/engine/rpc",
        content=b"{not json",
        headers={"content-type": "application/json"},
    )
    body = resp.json()
    assert body["error"]["code"] == -32700
    assert body["id"] is None


async def test_rpc_notification_returns_null_envelope(client):
    """无 id 的通知:HTTP 语义需要 200 体 → 返回稳定的 null 信封而非错误。"""
    resp = await client.post(
        "/api/engine/rpc",
        json={"jsonrpc": "2.0", "method": "engine.initialize"},
    )
    body = resp.json()
    assert body["id"] is None
    assert body["result"] is None


async def test_rpc_non_object_body_returns_invalid_request(client):
    resp = await client.post("/api/engine/rpc", json="just a string")
    assert resp.json()["error"]["code"] == -32600


# =============================================================================
# POST /api/engine/rpc —— 批量
# =============================================================================


async def test_rpc_batch_processes_in_order(client):
    resp = await client.post(
        "/api/engine/rpc",
        json=[_rpc("engine.initialize", rid=1), _rpc("engine.ping", rid=2)],
    )
    body = resp.json()
    assert isinstance(body, list)
    assert [b["id"] for b in body] == [1, 2]
    assert body[1]["result"]["pong"] is True


async def test_rpc_batch_rejects_streaming_method(client):
    """批量语义无法承载 SSE → 该条按 -32600 拒绝,其余条目照常处理。"""
    resp = await client.post(
        "/api/engine/rpc",
        json=[
            _rpc("thread.prompt", {"threadId": "x", "input": "y"}, rid=1),
            _rpc("engine.ping", rid=2),
        ],
    )
    body = resp.json()
    assert body[0]["error"]["code"] == -32600
    assert body[1]["result"]["pong"] is True


async def test_rpc_batch_notifications_are_dropped_from_response(client):
    resp = await client.post(
        "/api/engine/rpc",
        json=[{"jsonrpc": "2.0", "method": "engine.initialize"}, _rpc("engine.ping", rid=9)],
    )
    body = resp.json()
    assert [b["id"] for b in body] == [9]


async def test_rpc_batch_survives_non_object_entry(client):
    """批量里混入非对象条目:不得 500,按 -32600 处理。"""
    resp = await client.post("/api/engine/rpc", json=["oops", _rpc("engine.ping", rid=3)])
    body = resp.json()
    assert body[0]["error"]["code"] == -32600
    assert body[1]["result"]["pong"] is True


# =============================================================================
# POST /api/engine/rpc —— 流式(SSE)
# =============================================================================


async def test_rpc_streaming_prompt_emits_notifications_then_final_response(monkeypatch):
    bus = _Bus()
    monkeypatch.setattr(engine_router, "ENGINE", _engine(bus=bus))
    app = FastAPI()
    app.include_router(engine_router.router, prefix="/api")
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        thread_id = await _start_thread(client)
        resp = await client.post(
            "/api/engine/rpc",
            json=_rpc("thread.prompt", {"threadId": thread_id, "input": "跑"}, rid=77),
        )

    assert resp.headers["content-type"].startswith("text/event-stream")
    assert resp.headers["cache-control"] == "no-cache"
    assert resp.headers["x-accel-buffering"] == "no"

    frames = _sse_frames(resp.text)
    events = [f for f in frames if f.get("method") == "thread/event"]
    assert events, "流式方法应推送 thread/event 通知"
    # 末帧为该方法的 JSON-RPC 响应,id 与请求一致(客户端据此判定本轮结束)
    assert frames[-1]["id"] == 77
    assert frames[-1]["result"]["success"] is True
    assert resp.text.rstrip().endswith("[DONE]")


async def test_rpc_streaming_events_keep_arrival_order_and_drop_foreign_thread(monkeypatch):
    """事件顺序即语义:跨事件名须按真实到达顺序推送;非本线程事件必须被丢弃。"""
    bus = _Bus()
    engine = _engine(bus=bus)
    monkeypatch.setattr(engine_router, "ENGINE", engine)
    app = FastAPI()
    app.include_router(engine_router.router, prefix="/api")
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        thread_id = await _start_thread(client)
        resp = await client.post(
            "/api/engine/rpc",
            json=_rpc("thread.prompt", {"threadId": thread_id, "input": "跑"}),
        )

    events = [
        f["params"]["event"]
        for f in _sse_frames(resp.text)
        if f.get("method") == "thread/event"
    ]
    # 2026-09-18 第二批:引擎自产 environment_context(prompt 前)/ turn.usage
    # (回合结束)也走 thread/event 通道。本用例假循环无等待,总线事件在轮尾
    # 补扫才出,故 turn.usage 先于 tool.before/message.receive。
    assert events == [
        "environment_context",
        "turn.usage",
        "tool.before",
        "message.receive",
    ]
    # 其它会话的事件不得泄漏到本线程的流
    payloads = [
        f["params"]["payload"]["tool"]
        for f in _sse_frames(resp.text)
        if f.get("method") == "thread/event" and f["params"]["event"] == "tool.before"
    ]
    assert payloads == ["read_file"]


async def test_rpc_streaming_drains_tail_events_emitted_at_run_end(monkeypatch):
    """主循环"跑完瞬间"才发的事件不得丢失。

    事件由总线异步入队、转发任务按固定间隔轮询;若结束时直接取消转发任务,
    尾部事件会永久丢失。本用例保证引擎在结束前补扫一次(见 _drain_events)。
    """
    bus = _Bus()
    monkeypatch.setattr(engine_router, "ENGINE", _engine(bus=bus))
    app = FastAPI()
    app.include_router(engine_router.router, prefix="/api")
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        thread_id = await _start_thread(client)
        resp = await client.post(
            "/api/engine/rpc",
            json=_rpc("thread.prompt", {"threadId": thread_id, "input": "跑"}),
        )
    assert "最终答复" in resp.text, "尾部事件(最终 message)被丢了"


async def test_rpc_streaming_unknown_thread_returns_error_frame(client):
    """流式方法内部错误:仍以 JSON-RPC 错误帧收尾(而不是连接中断)。"""
    resp = await client.post(
        "/api/engine/rpc",
        json=_rpc("thread.prompt", {"threadId": "thr_missing", "input": "x"}, rid=5),
    )
    frames = _sse_frames(resp.text)
    assert frames[-1]["error"]["code"] == THREAD_NOT_FOUND


async def test_rpc_streaming_rejects_bad_input_shape_as_error_frame(client):
    thread_id = await _start_thread(client)
    resp = await client.post(
        "/api/engine/rpc",
        json=_rpc("thread.prompt", {"threadId": thread_id, "input": 123}, rid=6),
    )
    frames = _sse_frames(resp.text)
    assert frames[-1]["error"]["code"] == INVALID_PARAMS


# =============================================================================
# WS /api/engine/ws
# =============================================================================


def test_ws_rejects_missing_token(api):
    app, _engine_obj = api
    with TestClient(app) as tc:
        with pytest.raises(WebSocketDisconnect) as exc:
            with tc.websocket_connect("/api/engine/ws") as ws:
                ws.receive_json()
    assert exc.value.code == 1008


def test_ws_rejects_invalid_token(api, monkeypatch):
    app, _engine_obj = api
    monkeypatch.setattr(engine_router, "verify_access_token", lambda _t: None)
    with TestClient(app) as tc:
        with pytest.raises(WebSocketDisconnect) as exc:
            with tc.websocket_connect("/api/engine/ws?token=broken") as ws:
                ws.receive_json()
    assert exc.value.code == 1008


def test_ws_accepts_query_token_and_round_trips(api, monkeypatch):
    app, _engine_obj = api
    monkeypatch.setattr(
        engine_router, "verify_access_token", lambda t: {"sub": "u1"} if t == "good" else None
    )
    with TestClient(app) as tc:
        with tc.websocket_connect("/api/engine/ws?token=good") as ws:
            ws.send_json(_rpc("engine.initialize", rid=1))
            body = ws.receive_json()
            assert body["id"] == 1
            assert body["result"]["protocolVersion"] == PROTOCOL_VERSION

            ws.send_json(_rpc("thread.start", rid=2))
            thread_id = ws.receive_json()["result"]["threadId"]

            ws.send_json(_rpc("engine.ping", {"threadId": thread_id}, rid=3))
            assert ws.receive_json()["result"]["pong"] is True


def test_ws_accepts_authorization_bearer_header(api, monkeypatch):
    """Authorization: Bearer 兜底(部分 WS 客户端不便用 query 传 token)。"""
    app, _engine_obj = api
    seen: list[str] = []

    def _verify(token: str) -> dict[str, Any] | None:
        seen.append(token)
        return {"sub": "u2"} if token == "hdr" else None

    monkeypatch.setattr(engine_router, "verify_access_token", _verify)
    with TestClient(app) as tc:
        with tc.websocket_connect(
            "/api/engine/ws", headers={"Authorization": "Bearer hdr"}
        ) as ws:
            ws.send_json(_rpc("engine.ping", rid=1))
            assert ws.receive_json()["result"]["pong"] is True
    assert seen == ["hdr"]


def test_ws_long_prompt_does_not_block_followup_frames(monkeypatch):
    """差异化能力:thread.prompt 长跑期间仍能应答 interrupt / ping 帧。

    每帧独立任务处理是本传输层的关键设计;若退化成串行处理,本用例会阻塞超时。
    """
    engine = _engine(delay=0.6)
    monkeypatch.setattr(engine_router, "ENGINE", engine)
    monkeypatch.setattr(engine_router, "verify_access_token", lambda _t: {"sub": "u1"})
    app = FastAPI()
    app.include_router(engine_router.router, prefix="/api")

    with TestClient(app) as tc:
        with tc.websocket_connect("/api/engine/ws?token=ok") as ws:
            ws.send_json(_rpc("thread.start", rid=1))
            thread_id = ws.receive_json()["result"]["threadId"]
            ws.send_json(_rpc("thread.prompt", {"threadId": thread_id, "input": "长跑"}, rid=2))
            # 主循环仍在跑(0.6s),立即发 ping:必须在 prompt 结束前拿到 pong
            ws.send_json(_rpc("engine.ping", rid=3))
            # 2026-09-18 第二批起 prompt 会先推 environment_context 等通知帧,
            # 跳过通知直到拿到 ping 响应(若通知先到恰好证明帧未阻塞)。
            early = ws.receive_json()
            while "id" not in early:
                early = ws.receive_json()
            assert early["id"] == 3, f"ping 被长跑帧阻塞,先收到 {early}"
            while True:
                msg = ws.receive_json()
                if msg.get("id") == 2:
                    break
            assert msg["result"]["success"] is True


def test_ws_batch_array_frame_is_rejected(api, monkeypatch):
    """WS 一帧一条报文;数组帧按 -32600 明确拒绝(而非静默丢弃)。"""
    app, _engine_obj = api
    monkeypatch.setattr(engine_router, "verify_access_token", lambda _t: {"sub": "u1"})
    with TestClient(app) as tc:
        with tc.websocket_connect("/api/engine/ws?token=ok") as ws:
            ws.send_text(json.dumps([_rpc("engine.ping", rid=1)]))
            assert ws.receive_json()["error"]["code"] == -32600


def test_ws_invalid_json_frame_returns_parse_error(api, monkeypatch):
    app, _engine_obj = api
    monkeypatch.setattr(engine_router, "verify_access_token", lambda _t: {"sub": "u1"})
    with TestClient(app) as tc:
        with tc.websocket_connect("/api/engine/ws?token=ok") as ws:
            ws.send_text("{broken")
            assert ws.receive_json()["error"]["code"] == -32700


def test_ws_thread_state_survives_connection_close(api, monkeypatch):
    """引擎为进程级单例:线程状态跨连接保留(WS 断开不销毁会话)。"""
    app, engine = api
    monkeypatch.setattr(engine_router, "verify_access_token", lambda _t: {"sub": "u1"})
    with TestClient(app) as tc:
        with tc.websocket_connect("/api/engine/ws?token=ok") as ws:
            ws.send_json(_rpc("thread.start", rid=1))
            thread_id = ws.receive_json()["result"]["threadId"]
    assert thread_id in engine._threads
    assert engine._threads[thread_id].status == "idle"


def test_ws_thread_visible_from_http_carrier(monkeypatch):
    """同一引擎跨承载共享:WS 建线程 → HTTP 能查到(不需要粘性会话)。"""
    engine = _engine()
    monkeypatch.setattr(engine_router, "ENGINE", engine)
    monkeypatch.setattr(engine_router, "verify_access_token", lambda _t: {"sub": "u1"})
    app = FastAPI()
    app.include_router(engine_router.router, prefix="/api")

    with TestClient(app) as tc:
        with tc.websocket_connect("/api/engine/ws?token=ok") as ws:
            ws.send_json(_rpc("thread.start", rid=1))
            thread_id = ws.receive_json()["result"]["threadId"]
        resp = tc.post("/api/engine/rpc", json=_rpc("thread.state", {"threadId": thread_id}))
        assert resp.json()["result"]["threadId"] == thread_id


# =============================================================================
# 差异化管理端点(经同一 RPC 通道暴露:工具池 / 成本账本 / 模型路由表)
# =============================================================================


async def test_rpc_tools_list_exposes_pool_and_host_tools(client):
    thread_id = await _start_thread(client)
    resp = await client.post("/api/engine/rpc", json=_rpc("tools.list", {"threadId": thread_id}))
    result = resp.json()["result"]
    assert result["poolAvailable"] is True
    assert result["pool"][0]["name"] == "read_file"
    assert result["hostTools"] == []
    assert result["total"] == 1


async def test_rpc_cost_report_reads_ledger(client):
    resp = await client.post("/api/engine/rpc", json=_rpc("cost.report"))
    result = resp.json()["result"]
    assert result["available"] is True
    assert result["report"]["aggregate"]["totalCost"] == 0.5


async def test_rpc_models_list_reads_pricing_table(client):
    resp = await client.post("/api/engine/rpc", json=_rpc("models.list"))
    result = resp.json()["result"]
    assert result["available"] is True
    assert result["models"][0]["model"] == "mock/model-a"
    assert result["total"] == 1
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
