"""langgraph 路由单元测试(2026-08-13 立,补齐 0 覆盖)。

覆盖策略:
- 纯函数:_ok / register_langgraph_graph / get_registered_graph / _sse_format
- 端点分支:mock checkpoint manager + trigger/resume 函数,直接调用 async 端点函数
- SSE 流:mini ASGI app + mock stream_agent_execution 验证输入解析与校验分支
"""

from __future__ import annotations

import builtins
import json
import types

import pytest
from fastapi import FastAPI, HTTPException
from httpx import ASGITransport, AsyncClient

from app.routers import langgraph as lg
from app.routers.langgraph import (
    InterruptRequest,
    ResumeRequest,
    _ok,
    _sse_format,
    get_history,
    get_registered_graph,
    get_state,
    post_interrupt,
    post_resume,
    register_langgraph_graph,
)
from app.services.langgraph_stream import SSEEvent


def _async_ret(value):
    async def _f(*a, **k):
        return value

    return _f


def _async_raise(exc):
    async def _f(*a, **k):
        raise exc

    return _f


class _FakeManager:
    """假的 LangGraphCheckpointManager(内存实现)。"""

    def __init__(self):
        self.latest = {"checkpoint_id": "cp-1", "state": {"v": 1}}
        self.history = [{"checkpoint_id": "cp-1"}]
        self.graph_state = {"values": {"x": 1}}
        self.saved_writes = []
        self.latest_error = None
        self.graph_state_error = None

    async def get_latest_checkpoint(self, thread_id):
        if self.latest_error:
            raise RuntimeError(self.latest_error)
        return self.latest

    async def get_state_history(self, thread_id, limit=100):
        return self.history[:limit]

    async def save_write(self, **kw):
        self.saved_writes.append(kw)

    async def get_graph_state(self, graph, thread_id):
        if self.graph_state_error:
            raise self.graph_state_error
        return self.graph_state


class _FakeGraph:
    """假的已编译 LangGraph。"""

    def __init__(self):
        self.calls = []

    async def ainvoke(self, *args, **kwargs):
        self.calls.append((args, kwargs))
        return {"values": {}}


@pytest.fixture(autouse=True)
def _reset_graph_and_services(monkeypatch):
    """重置注册表 + mock checkpoint manager 与 trigger/resume 函数。"""
    monkeypatch.setattr(lg, "_registered_graph", None)
    manager = _FakeManager()
    monkeypatch.setattr(lg, "_manager", lambda: manager)

    async def _fake_trigger_interrupt(**kw):
        return {
            "interruptId": "int-1",
            "thread_id": kw["thread_id"],
            "node_id": kw["node_id"],
            "reason": kw["reason"],
            "payload": kw["payload"],
        }

    async def _fake_resume_from_interrupt(**kw):
        return {"command": "resume", "thread_id": kw["thread_id"]}

    monkeypatch.setattr(lg, "trigger_interrupt", _fake_trigger_interrupt)
    monkeypatch.setattr(lg, "resume_from_interrupt", _fake_resume_from_interrupt)
    return manager


# =============================================================================
# 纯函数
# =============================================================================


def test_ok_helper():
    assert _ok({"a": 1}) == {"code": 0, "message": "ok", "data": {"a": 1}}
    assert _ok(None, "custom msg")["message"] == "custom msg"
    assert _ok(None)["data"] is None


def test_register_and_get_graph(monkeypatch):
    """register_langgraph_graph 写入全局;get_registered_graph 读取;可重复注册。"""
    g1, g2 = object(), object()
    register_langgraph_graph(g1)
    assert get_registered_graph() is g1
    register_langgraph_graph(g2)
    assert get_registered_graph() is g2
    # 清理,避免影响后续测试
    monkeypatch.setattr(lg, "_registered_graph", None)
    assert get_registered_graph() is None


def test_sse_format_basic():
    """SSEEvent → 标准 SSE 文本帧(event:/data:/空行)。"""
    evt = SSEEvent(
        type="messages",
        thread_id="t1",
        node_id="n1",
        data={"content": "hi"},
        timestamp="2026-01-01T00:00:00Z",
    )
    s = _sse_format(evt)
    assert s == (
        'event: messages\n'
        'data: {"type": "messages", "threadId": "t1", "nodeId": "n1", '
        '"data": {"content": "hi"}, "timestamp": "2026-01-01T00:00:00Z"}\n\n'
    )


def test_sse_format_non_ascii_kept():
    """非 ASCII 内容保留可读性(ensure_ascii=False)。"""
    evt = SSEEvent(
        type="updates",
        thread_id="t1",
        node_id=None,
        data={"text": "你好世界"},
        timestamp="2026-01-01T00:00:00Z",
    )
    s = _sse_format(evt)
    assert "你好世界" in s
    assert "\\u4f60" not in s  # 未被转义成 \uXXXX


def test_sse_format_default_str_for_non_serializable():
    """data 含不可 JSON 化对象 → default=str 兜底。"""
    evt = SSEEvent(
        type="done",
        thread_id="t1",
        node_id=None,
        data={"obj": object()},
        timestamp="2026-01-01T00:00:00Z",
    )
    s = _sse_format(evt)
    assert s.startswith("event: done\n")
    assert "object" in s


# =============================================================================
# POST /{thread_id}/interrupt
# =============================================================================


async def test_post_interrupt_success(_reset_graph_and_services):
    manager = _reset_graph_and_services
    req = InterruptRequest(node_id="node-a", reason="需要用户确认", payload={"q": "?"})
    resp = await post_interrupt("t1", req)
    assert resp["code"] == 0
    assert resp["data"]["interruptId"] == "int-1"
    # 事件被持久化到 writes 表(channel=interrupt)
    assert len(manager.saved_writes) == 1
    w = manager.saved_writes[0]
    assert w["thread_id"] == "t1"
    assert w["channel"] == "interrupt"
    assert w["value"]["interruptId"] == "int-1"


async def test_post_interrupt_persist_failure_not_blocking(_reset_graph_and_services, monkeypatch):
    """save_write 失败只记 warning,不阻塞响应。"""
    manager = _reset_graph_and_services
    manager.save_write = _async_raise(Exception("db down"))
    resp = await post_interrupt("t1", InterruptRequest(node_id="n", reason="r"))
    assert resp["code"] == 0
    assert resp["data"]["interruptId"] == "int-1"


async def test_post_interrupt_runtime_error_503(_reset_graph_and_services, monkeypatch):
    monkeypatch.setattr(lg, "trigger_interrupt", _async_raise(RuntimeError("graph not ready")))
    with pytest.raises(HTTPException) as ei:
        await post_interrupt("t1", InterruptRequest(node_id="n", reason="r"))
    assert ei.value.status_code == 503


async def test_post_interrupt_value_error_400(_reset_graph_and_services, monkeypatch):
    monkeypatch.setattr(lg, "trigger_interrupt", _async_raise(ValueError("节点不存在")))
    with pytest.raises(HTTPException) as ei:
        await post_interrupt("t1", InterruptRequest(node_id="n", reason="r"))
    assert ei.value.status_code == 400


# =============================================================================
# POST /resume
# =============================================================================


async def test_post_resume_no_graph(_reset_graph_and_services):
    """未注册 graph → invoked=False + 跳过原因。"""
    resp = await post_resume(ResumeRequest(thread_id="t1", interrupt_id="int-1"))
    assert resp["code"] == 0
    cmd = resp["data"]
    assert cmd["invoked"] is False
    assert cmd["invoke_skipped_reason"] == "未注册编译图"


async def test_post_resume_with_graph_action_resume(_reset_graph_and_services, monkeypatch):
    """已注册 graph + action=resume → ainvoke(Command(resume=...)) 被调用。"""
    graph = _FakeGraph()
    monkeypatch.setattr(lg, "_registered_graph", graph)
    req = ResumeRequest(thread_id="t1", interrupt_id="int-1", resume_value={"ok": True})
    resp = await post_resume(req)
    cmd = resp["data"]
    assert cmd["invoked"] is True
    assert len(graph.calls) == 1
    args, kwargs = graph.calls[0]
    assert kwargs["config"] == {"configurable": {"thread_id": "t1"}}
    from langgraph.types import Command

    assert isinstance(args[0], Command)
    assert args[0].resume == {"ok": True}


async def test_post_resume_action_rollback_and_cancel(_reset_graph_and_services, monkeypatch):
    """rollback/cancel → 不调用 ainvoke,invoked=False。"""
    graph = _FakeGraph()
    monkeypatch.setattr(lg, "_registered_graph", graph)
    resp = await post_resume(ResumeRequest(thread_id="t1", interrupt_id="i1", action="rollback"))
    assert resp["data"]["invoked"] is False
    assert graph.calls == []
    resp = await post_resume(ResumeRequest(thread_id="t1", interrupt_id="i1", action="cancel"))
    assert resp["data"]["invoked"] is False
    assert graph.calls == []


async def test_post_resume_ainvoke_error(_reset_graph_and_services, monkeypatch):
    """ainvoke 抛异常 → invoked=False + invoke_error。"""
    graph = _FakeGraph()

    async def _broken_ainvoke(*a, **k):
        raise RuntimeError("graph crash")

    graph.ainvoke = _broken_ainvoke
    monkeypatch.setattr(lg, "_registered_graph", graph)
    resp = await post_resume(ResumeRequest(thread_id="t1", interrupt_id="i1"))
    cmd = resp["data"]
    assert cmd["invoked"] is False
    assert "graph crash" in cmd["invoke_error"]


async def test_post_resume_langgraph_not_installed(_reset_graph_and_services, monkeypatch):
    """langgraph.types 不可导入 → invoked=False + invoke_skipped_reason。"""
    graph = _FakeGraph()
    monkeypatch.setattr(lg, "_registered_graph", graph)
    real_import = builtins.__import__

    def _no_langgraph(name, *a, **k):
        if name == "langgraph.types":
            raise ImportError("no langgraph")
        return real_import(name, *a, **k)

    monkeypatch.setattr(builtins, "__import__", _no_langgraph)
    resp = await post_resume(ResumeRequest(thread_id="t1", interrupt_id="i1"))
    cmd = resp["data"]
    assert cmd["invoked"] is False
    assert cmd["invoke_skipped_reason"] == "langgraph 未安装"


async def test_post_resume_runtime_error_503(_reset_graph_and_services, monkeypatch):
    monkeypatch.setattr(lg, "resume_from_interrupt", _async_raise(RuntimeError("ckpt missing")))
    with pytest.raises(HTTPException) as ei:
        await post_resume(ResumeRequest(thread_id="t1", interrupt_id="i1"))
    assert ei.value.status_code == 503


async def test_post_resume_value_error_400(_reset_graph_and_services, monkeypatch):
    monkeypatch.setattr(lg, "resume_from_interrupt", _async_raise(ValueError("非法 action")))
    with pytest.raises(HTTPException) as ei:
        await post_resume(ResumeRequest(thread_id="t1", interrupt_id="i1", action="evil"))
    assert ei.value.status_code == 400


# =============================================================================
# GET /{thread_id}/state
# =============================================================================


async def test_get_state_no_graph(_reset_graph_and_services):
    """未注册 graph → graphState=None。"""
    resp = await get_state("t1")
    assert resp["code"] == 0
    assert resp["data"]["threadId"] == "t1"
    assert resp["data"]["latestCheckpoint"] == {"checkpoint_id": "cp-1", "state": {"v": 1}}
    assert resp["data"]["graphState"] is None


async def test_get_state_with_graph(_reset_graph_and_services, monkeypatch):
    monkeypatch.setattr(lg, "_registered_graph", _FakeGraph())
    resp = await get_state("t1")
    assert resp["data"]["graphState"] == {"values": {"x": 1}}


async def test_get_state_graph_state_failure_degrades(_reset_graph_and_services, monkeypatch):
    """get_graph_state 抛异常 → graphState=None(降级),不报错。"""
    manager = _reset_graph_and_services
    manager.graph_state_error = RuntimeError("graph state fail")
    monkeypatch.setattr(lg, "_registered_graph", _FakeGraph())
    resp = await get_state("t1")
    assert resp["code"] == 0
    assert resp["data"]["graphState"] is None
    # 普通 Exception 也降级
    manager.graph_state_error = ValueError("boom")
    resp = await get_state("t1")
    assert resp["data"]["graphState"] is None


async def test_get_state_latest_checkpoint_runtime_error_503(_reset_graph_and_services):
    manager = _reset_graph_and_services
    manager.latest_error = "db down"
    with pytest.raises(HTTPException) as ei:
        await get_state("t1")
    assert ei.value.status_code == 503


# =============================================================================
# GET /{thread_id}/history
# =============================================================================


async def test_get_history_success(_reset_graph_and_services):
    resp = await get_history("t1", limit=5)
    assert resp["code"] == 0
    assert resp["data"]["threadId"] == "t1"
    assert resp["data"]["history"] == [{"checkpoint_id": "cp-1"}]
    assert resp["data"]["count"] == 1


async def test_get_history_runtime_error_503(_reset_graph_and_services, monkeypatch):
    async def _broken_history(thread_id, limit=100):
        raise RuntimeError("history db down")

    monkeypatch.setattr(lg, "_manager", lambda: types.SimpleNamespace(get_state_history=_broken_history))
    with pytest.raises(HTTPException) as ei:
        await get_history("t1")
    assert ei.value.status_code == 503


# =============================================================================
# GET /{thread_id}/stream — SSE 流
# =============================================================================


@pytest.fixture
def _stream_client(monkeypatch):
    """mini ASGI app + 默认 mock stream_agent_execution。

    返回 client 工厂(每次调用生成新 client,可多次请求),捕获参数挂在新 client 上。
    """
    captured = {}

    async def _fake_stream(**kw):
        captured.update(kw)
        yield SSEEvent(type="messages", thread_id=kw["thread_id"], node_id="n1", data={"c": "hi"})
        yield SSEEvent(type="done", thread_id=kw["thread_id"], node_id=None, data={"ok": True})

    monkeypatch.setattr(lg, "stream_agent_execution", _fake_stream)
    app = FastAPI()
    app.include_router(lg.router)
    transport = ASGITransport(app=app)

    def _make():
        client = AsyncClient(transport=transport, base_url="http://test")
        client._captured = captured  # type: ignore[attr-defined]
        return client

    return _make


async def test_stream_no_graph_503(monkeypatch):
    app = FastAPI()
    app.include_router(lg.router)
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        resp = await ac.get("/api/langgraph/t1/stream")
    assert resp.status_code == 503
    assert "未注册编译图" in resp.json()["detail"]


async def test_stream_success_sse_body(_stream_client, monkeypatch):
    """已注册 graph + 合法参数 → SSE 文本流。"""
    monkeypatch.setattr(lg, "_registered_graph", _FakeGraph())
    async with _stream_client() as ac:
        resp = await ac.get("/api/langgraph/t1/stream", params={"input": '{"query": "hi"}'})
    assert resp.status_code == 200
    assert resp.headers["content-type"].startswith("text/event-stream")
    assert resp.headers["cache-control"] == "no-cache"
    body = resp.text
    assert "event: messages\n" in body
    assert "event: done\n" in body
    assert '"c": "hi"' in body
    # input JSON 被解析为 dict 传给执行引擎
    assert ac._captured["graph_input"] == {"query": "hi"}
    assert ac._captured["thread_id"] == "t1"


async def test_stream_invalid_input_json_400(_stream_client, monkeypatch):
    monkeypatch.setattr(lg, "_registered_graph", _FakeGraph())
    async with _stream_client() as ac:
        resp = await ac.get("/api/langgraph/t1/stream", params={"input": "{not json"})
    assert resp.status_code == 400
    assert "input JSON 解析失败" in resp.json()["detail"]


async def test_stream_input_not_object_400(_stream_client, monkeypatch):
    monkeypatch.setattr(lg, "_registered_graph", _FakeGraph())
    async with _stream_client() as ac:
        resp = await ac.get("/api/langgraph/t1/stream", params={"input": json.dumps([1, 2])})
    assert resp.status_code == 400
    assert "必须是 JSON 对象" in resp.json()["detail"]


async def test_stream_invalid_stream_modes_400(_stream_client, monkeypatch):
    monkeypatch.setattr(lg, "_registered_graph", _FakeGraph())
    async with _stream_client() as ac:
        resp = await ac.get(
            "/api/langgraph/t1/stream", params={"stream_modes": "updates,hackermode"}
        )
    assert resp.status_code == 400
    assert "非法 stream_mode" in resp.json()["detail"]


async def test_stream_stream_modes_parsed_and_default(_stream_client, monkeypatch):
    """合法 modes 被解析为列表;省略时用 DEFAULT_STREAM_MODES。"""
    monkeypatch.setattr(lg, "_registered_graph", _FakeGraph())
    async with _stream_client() as ac:
        resp = await ac.get("/api/langgraph/t1/stream", params={"stream_modes": "updates, messages"})
    assert resp.status_code == 200
    assert ac._captured["stream_modes"] == ["updates", "messages"]
    # 省略 stream_modes → 默认
    async with _stream_client() as ac2:
        resp = await ac2.get("/api/langgraph/t1/stream")
    assert resp.status_code == 200
    assert ac2._captured["stream_modes"] == ["updates", "messages", "events"]
