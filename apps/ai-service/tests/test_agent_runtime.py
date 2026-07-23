"""agent_runtime.py 单元测试 — Agent runtime 路由。

测试覆盖:
- 数据模型:ExecuteRequest/ExecuteResponse/SessionMessage/SessionState/PermissionCheckResponse
- 权限决策矩阵 _check_permission(5 mode × 3 dangerLevel = 15 组合)
- 会话存储:_get_or_create_session / _find_session / _evict_if_needed(FIFO + TTL)
- Redis 降级:_get_redis / _save_session_redis / _load_session_redis(无 REDIS_URL → 内存)
- 8 个端点:execute / execute/stream / status / cancel / sessions / session / resume / permission/check
- 隔离:mock get_agent_graph + unified_memory_client,不调真实 LLM/Redis
"""
from __future__ import annotations

import asyncio
import json
import time
from unittest.mock import AsyncMock, MagicMock

import pytest
from httpx import ASGITransport, AsyncClient

from app.routers import agent_runtime
from app.routers.agent_runtime import (
    ExecuteRequest,
    ExecuteResponse,
    PermissionCheckResponse,
    SessionMessage,
    SessionState,
    _check_permission,
    _evict_if_needed,
    _find_session,
    _get_or_create_session,
    _get_redis,
    _sessions,
)


# =============================================================================
# 辅助:每个测试前后清空 _sessions,避免互相干扰
# =============================================================================


@pytest.fixture(autouse=True)
def _clear_sessions():
    _sessions.clear()
    # 重置 Redis 状态(强制走纯内存路径)
    agent_runtime._redis_client = None
    agent_runtime._redis_disabled = False
    yield
    _sessions.clear()


def _make_app():
    """构建挂载 agent_runtime router 的最小 FastAPI app。"""
    from fastapi import FastAPI

    app = FastAPI()
    app.include_router(agent_runtime.router)
    return app


# =============================================================================
# 数据模型
# =============================================================================


def test_execute_request_min_length_validation():
    """ExecuteRequest.message 必须非空(min_length=1)。"""
    with pytest.raises(ValueError):
        ExecuteRequest(message="")
    req = ExecuteRequest(message="hi")
    assert req.message == "hi"
    assert req.mode == "default"
    assert req.sessionId is None


def test_session_state_defaults():
    """SessionState 默认 status=running,botId=default,messages=[]。"""
    s = SessionState(id="s1")
    assert s.status == "running"
    assert s.botId == "default"
    assert s.messages == []
    assert s.last_access > 0


def test_session_message_default_timestamp():
    """SessionMessage 默认 timestamp=time.time()。"""
    before = time.time()
    m = SessionMessage(role="user", content="hello")
    after = time.time()
    assert m.role == "user"
    assert m.content == "hello"
    assert before <= m.timestamp <= after


# =============================================================================
# 权限决策矩阵 _check_permission
# =============================================================================


@pytest.mark.parametrize(
    "mode,danger,expected",
    [
        # bypassPermissions 一律 allow
        ("bypassPermissions", "read", "allow"),
        ("bypassPermissions", "write", "allow"),
        ("bypassPermissions", "dangerous", "allow"),
        # manual 一律 ask
        ("manual", "read", "ask"),
        ("manual", "write", "ask"),
        ("manual", "dangerous", "ask"),
        # plan:write/dangerous 拒绝,read 允许
        ("plan", "read", "allow"),
        ("plan", "write", "deny"),
        ("plan", "dangerous", "deny"),
        # acceptEdits:read/write 允许,dangerous 询问
        ("acceptEdits", "read", "allow"),
        ("acceptEdits", "write", "allow"),
        ("acceptEdits", "dangerous", "ask"),
        # default(其他 mode):read 允许,write/dangerous 询问
        ("default", "read", "allow"),
        ("default", "write", "ask"),
        ("default", "dangerous", "ask"),
    ],
)
def test_check_permission_matrix(mode, danger, expected):
    assert _check_permission("any_tool", mode, danger) == expected


def test_check_permission_unknown_mode_falls_back():
    """未知 mode 走默认路径(read=allow, write=ask, dangerous=ask)。"""
    assert _check_permission("t", "unknown_mode", "read") == "allow"
    assert _check_permission("t", "unknown_mode", "write") == "ask"


# =============================================================================
# 会话存储:_get_or_create_session / _find_session / _evict_if_needed
# =============================================================================


def test_get_or_create_session_new():
    """无 sessionId → 新建 session 并写入 _sessions。"""
    s = _get_or_create_session(None, "bot1")
    assert s.id in _sessions
    assert s.botId == "bot1"
    assert s.status == "running"


def test_get_or_create_session_existing_updates_last_access():
    """已有 sessionId → 命中内存,刷新 last_access。"""
    s1 = _get_or_create_session("fixed-id", "bot1")
    old_access = s1.last_access
    time.sleep(0.01)
    s2 = _get_or_create_session("fixed-id", "bot1")
    assert s2.id == s1.id
    assert s2.last_access > old_access
    assert len(_sessions) == 1


def test_get_or_create_session_with_empty_bot_id_string():
    """bot_id 必须是 str(SessionState.botId 不允许 None)。
    endpoint 层用 `req.botId or "default"` 兜底,_get_or_create_session 直接透传。"""
    s = _get_or_create_session("sid", "default")
    assert s.botId == "default"


def test_find_session_miss_returns_none():
    """_find_session 查找不存在的 session 返回 None(不新建)。"""
    assert _find_session("nonexistent") is None


def test_find_session_hit_updates_last_access():
    """_find_session 命中时刷新 last_access。"""
    s = _get_or_create_session("hit-id", "b")
    old = s.last_access
    time.sleep(0.01)
    found = _find_session("hit-id")
    assert found is not None
    assert found.last_access > old


def test_evict_if_needed_fifo_capacity():
    """超过 _MAX_SESSIONS 时按 FIFO 淘汰最早 session。"""
    # 临时调低阈值方便测试
    original_max = agent_runtime._MAX_SESSIONS
    agent_runtime._MAX_SESSIONS = 3
    try:
        for i in range(5):
            _get_or_create_session(f"s{i}", "b")
        _evict_if_needed()
        assert len(_sessions) <= 3
        # 最早两个应被淘汰
        assert "s0" not in _sessions
        assert "s1" not in _sessions
        assert "s2" in _sessions
    finally:
        agent_runtime._MAX_SESSIONS = original_max


def test_evict_if_needed_ttl_expiry():
    """超过 _SESSION_TTL_SEC 未访问的 session 被淘汰。"""
    s = _get_or_create_session("old", "b")
    # 手动把 last_access 改到 2 小时前
    s.last_access = time.time() - 7200
    _evict_if_needed()
    assert "old" not in _sessions


# =============================================================================
# Redis 降级:_get_redis / _save_session_redis / _load_session_redis
# =============================================================================


def test_get_redis_disabled_when_no_redis_url(monkeypatch):
    """无 REDIS_URL 时,_get_redis 返回 None 且 _redis_disabled=True。"""
    agent_runtime._redis_client = None
    agent_runtime._redis_disabled = False
    monkeypatch.delenv("REDIS_URL", raising=False)
    assert _get_redis() is None
    assert agent_runtime._redis_disabled is True


def test_save_session_redis_noop_when_no_redis(monkeypatch):
    """无 Redis 时,_save_session_redis 静默返回(不抛异常)。"""
    monkeypatch.delenv("REDIS_URL", raising=False)
    agent_runtime._redis_client = None
    agent_runtime._redis_disabled = False
    s = SessionState(id="r1")
    # 不应抛异常
    agent_runtime._save_session_redis(s)


def test_load_session_redis_returns_none_when_no_redis(monkeypatch):
    """无 Redis 时,_load_session_redis 返回 None。"""
    monkeypatch.delenv("REDIS_URL", raising=False)
    agent_runtime._redis_client = None
    agent_runtime._redis_disabled = False
    assert agent_runtime._load_session_redis("any") is None


def test_save_and_load_session_redis_roundtrip(monkeypatch):
    """有 Redis 时,set/get 走真实 Redis 客户端(mock)。"""
    fake_redis = MagicMock()
    store: dict[str, str] = {}

    def fake_set(k, v, ex=None):
        store[k] = v

    def fake_get(k):
        return store.get(k)

    fake_redis.set = fake_set
    fake_redis.get = fake_get
    fake_redis.ping = MagicMock()

    # 用 fake redis 替换 _get_redis
    monkeypatch.setattr(agent_runtime, "_get_redis", lambda: fake_redis)
    s = SessionState(id="redis-1", botId="bot-x")
    s.messages.append(SessionMessage(role="user", content="hi"))
    agent_runtime._save_session_redis(s)

    loaded = agent_runtime._load_session_redis("redis-1")
    assert loaded is not None
    assert loaded.id == "redis-1"
    assert loaded.botId == "bot-x"
    assert len(loaded.messages) == 1
    assert loaded.messages[0].content == "hi"


def test_load_session_redis_returns_none_when_key_missing(monkeypatch):
    """Redis 中无对应 key → 返回 None。"""
    fake_redis = MagicMock()
    fake_redis.get = MagicMock(return_value=None)
    monkeypatch.setattr(agent_runtime, "_get_redis", lambda: fake_redis)
    assert agent_runtime._load_session_redis("missing") is None


def test_load_session_redis_swallows_exception(monkeypatch):
    """Redis get 抛异常时,_load_session_redis 返回 None(不抛)。"""
    fake_redis = MagicMock()
    fake_redis.get = MagicMock(side_effect=RuntimeError("redis down"))
    monkeypatch.setattr(agent_runtime, "_get_redis", lambda: fake_redis)
    assert agent_runtime._load_session_redis("any") is None


# =============================================================================
# 端点:execute(同步)
# =============================================================================


async def test_execute_endpoint_creates_session_and_calls_graph(monkeypatch):
    """POST /agent-runtime/execute 创建 session + 调 graph.ainvoke。"""
    fake_graph = MagicMock()
    fake_graph.ainvoke = AsyncMock(return_value={"summary": "ok summary"})
    monkeypatch.setattr(agent_runtime, "get_agent_graph", lambda: fake_graph)
    monkeypatch.setattr(agent_runtime, "_save_session_redis", lambda s: None)

    app = _make_app()
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        resp = await ac.post("/agent-runtime/execute", json={"message": "hello"})

    assert resp.status_code == 200
    data = resp.json()
    assert data["mode"] == "default"
    assert data["received"] == "hello"
    assert data["summary"] == "ok summary"
    assert data["sessionId"]  # 自动生成 UUID
    fake_graph.ainvoke.assert_awaited_once()


async def test_execute_endpoint_graph_failure_returns_empty_summary(monkeypatch):
    """graph.ainvoke 抛异常时,summary 为空但不报 500。"""
    fake_graph = MagicMock()
    fake_graph.ainvoke = AsyncMock(side_effect=RuntimeError("graph boom"))
    monkeypatch.setattr(agent_runtime, "get_agent_graph", lambda: fake_graph)
    monkeypatch.setattr(agent_runtime, "_save_session_redis", lambda s: None)

    app = _make_app()
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        resp = await ac.post("/agent-runtime/execute", json={"message": "test"})

    assert resp.status_code == 200
    assert resp.json()["summary"] == ""


async def test_execute_endpoint_with_existing_session_id(monkeypatch):
    """传 sessionId 时复用现有 session。"""
    fake_graph = MagicMock()
    fake_graph.ainvoke = AsyncMock(return_value={"summary": ""})
    monkeypatch.setattr(agent_runtime, "get_agent_graph", lambda: fake_graph)
    monkeypatch.setattr(agent_runtime, "_save_session_redis", lambda s: None)

    app = _make_app()
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        resp = await ac.post(
            "/agent-runtime/execute",
            json={"message": "second", "sessionId": "reuse-id"},
        )

    assert resp.status_code == 200
    assert resp.json()["sessionId"] == "reuse-id"
    # session 内应有 1 条 user message
    assert len(_sessions["reuse-id"].messages) == 1


# =============================================================================
# 端点:execute/stream(SSE)
# =============================================================================


async def test_execute_stream_emits_session_event(monkeypatch):
    """SSE 流首条事件是 session。"""
    fake_graph = MagicMock()

    async def empty_astream(state):
        if False:
            yield {}

    fake_graph.astream = empty_astream
    monkeypatch.setattr(agent_runtime, "get_agent_graph", lambda: fake_graph)
    monkeypatch.setattr(agent_runtime, "_save_session_redis", lambda s: None)

    app = _make_app()
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        resp = await ac.post(
            "/agent-runtime/execute/stream",
            json={"message": "hi"},
        )

    assert resp.status_code == 200
    body = resp.text
    assert "event: session" in body
    assert '"sessionId"' in body


async def test_execute_stream_plan_mode_emits_permission_deny(monkeypatch):
    """plan 模式 → 第二条事件是 permission decision=deny。"""
    fake_graph = MagicMock()

    async def empty_astream(state):
        if False:
            yield {}

    fake_graph.astream = empty_astream
    monkeypatch.setattr(agent_runtime, "get_agent_graph", lambda: fake_graph)
    monkeypatch.setattr(agent_runtime, "_save_session_redis", lambda s: None)

    app = _make_app()
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        resp = await ac.post(
            "/agent-runtime/execute/stream",
            json={"message": "go", "mode": "plan"},
        )

    body = resp.text
    assert "event: permission" in body
    assert '"decision": "deny"' in body


async def test_execute_stream_emits_done_on_summarize(monkeypatch):
    """summarize 节点输出 summary → SSE done 事件。"""
    fake_graph = MagicMock()

    async def astream_with_summary(state):
        yield {"summarize": {"summary": "final answer"}}

    fake_graph.astream = astream_with_summary
    monkeypatch.setattr(agent_runtime, "get_agent_graph", lambda: fake_graph)
    monkeypatch.setattr(agent_runtime, "_save_session_redis", lambda s: None)

    app = _make_app()
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        resp = await ac.post(
            "/agent-runtime/execute/stream",
            json={"message": "go"},
        )

    body = resp.text
    assert "event: done" in body
    assert "final answer" in body
    assert '"status": "completed"' in body


async def test_execute_stream_emits_error_on_graph_exception(monkeypatch):
    """graph.astream 抛异常 → SSE error 事件。"""
    fake_graph = MagicMock()

    async def astream_boom(state):
        raise RuntimeError("stream failed")
        yield {}  # noqa: unreachable

    fake_graph.astream = astream_boom
    monkeypatch.setattr(agent_runtime, "get_agent_graph", lambda: fake_graph)
    monkeypatch.setattr(agent_runtime, "_save_session_redis", lambda s: None)

    app = _make_app()
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        resp = await ac.post(
            "/agent-runtime/execute/stream",
            json={"message": "go"},
        )

    body = resp.text
    assert "event: error" in body
    assert "stream failed" in body


# =============================================================================
# 端点:status / cancel / sessions / resume / permission/check
# =============================================================================


async def test_get_status_404_when_session_missing(monkeypatch):
    """status 端点:session 不存在 → 404。"""
    monkeypatch.setattr(agent_runtime, "_find_session", lambda sid: None)
    app = _make_app()
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        resp = await ac.get("/agent-runtime/nope/status")
    assert resp.status_code == 404


async def test_get_status_returns_message_count(monkeypatch):
    """status 端点:返回 sessionId/status/messageCount。"""
    s = SessionState(id="s1", botId="b")
    s.messages.append(SessionMessage(role="user", content="x"))
    monkeypatch.setattr(agent_runtime, "_find_session", lambda sid: s)
    app = _make_app()
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        resp = await ac.get("/agent-runtime/s1/status")
    assert resp.status_code == 200
    data = resp.json()
    assert data["sessionId"] == "s1"
    assert data["messageCount"] == 1


async def test_cancel_session_404_when_missing(monkeypatch):
    """cancel 端点:session 不存在 → 404。"""
    monkeypatch.setattr(agent_runtime, "_find_session", lambda sid: None)
    app = _make_app()
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        resp = await ac.post("/agent-runtime/nope/cancel")
    assert resp.status_code == 404


async def test_cancel_session_marks_cancelled(monkeypatch):
    """cancel 端点:把 session.status 置为 cancelled。"""
    s = SessionState(id="c1")
    monkeypatch.setattr(agent_runtime, "_find_session", lambda sid: s)
    monkeypatch.setattr(agent_runtime, "_save_session_redis", lambda x: None)
    app = _make_app()
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        resp = await ac.post("/agent-runtime/c1/cancel")
    assert resp.status_code == 200
    assert resp.json()["status"] == "cancelled"
    assert s.status == "cancelled"


async def test_list_sessions_pagination(monkeypatch):
    """list sessions 端点:支持 limit/offset 分页。"""
    for i in range(5):
        _sessions[f"s{i}"] = SessionState(id=f"s{i}")
    app = _make_app()
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        resp = await ac.get("/agent-runtime/sessions", params={"limit": 2, "offset": 1})
    assert resp.status_code == 200
    data = resp.json()
    assert data["total"] == 5
    assert len(data["sessions"]) == 2


async def test_get_session_404_when_missing(monkeypatch):
    """GET /sessions/{id}:session 不存在 → 404。"""
    monkeypatch.setattr(agent_runtime, "_find_session", lambda sid: None)
    app = _make_app()
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        resp = await ac.get("/agent-runtime/sessions/nope")
    assert resp.status_code == 404


async def test_resume_session_marks_running(monkeypatch):
    """resume 端点:把 session.status 置为 running。"""
    s = SessionState(id="r1")
    s.status = "cancelled"
    monkeypatch.setattr(agent_runtime, "_find_session", lambda sid: s)
    monkeypatch.setattr(agent_runtime, "_save_session_redis", lambda x: None)
    app = _make_app()
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        resp = await ac.post("/agent-runtime/sessions/r1/resume")
    assert resp.status_code == 200
    assert resp.json()["status"] == "running"
    assert s.status == "running"


async def test_check_permission_endpoint_returns_decision():
    """GET /permission/check 端点:返回 PermissionCheckResponse。"""
    app = _make_app()
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        resp = await ac.get(
            "/agent-runtime/permission/check",
            params={"toolName": "Write", "mode": "plan", "dangerLevel": "write"},
        )
    assert resp.status_code == 200
    data = resp.json()
    assert data["toolName"] == "Write"
    assert data["mode"] == "plan"
    assert data["dangerLevel"] == "write"
    assert data["decision"] == "deny"


async def test_check_permission_endpoint_default_params():
    """GET /permission/check 默认 mode=default, dangerLevel=read → allow。"""
    app = _make_app()
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        resp = await ac.get(
            "/agent-runtime/permission/check",
            params={"toolName": "Read"},
        )
    assert resp.status_code == 200
    assert resp.json()["decision"] == "allow"


# =============================================================================
# 端点:memory(GET / POST)
# =============================================================================


async def test_get_memory_returns_entries(monkeypatch):
    """GET /memory:转发 unified_memory_client.get_entries。"""
    fake_client = MagicMock()
    fake_client.get_entries = AsyncMock(return_value=[{"k": "v"}])
    monkeypatch.setattr(agent_runtime, "unified_memory_client", fake_client)

    app = _make_app()
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        resp = await ac.get(
            "/agent-runtime/memory",
            params={"user_id": "u1", "scope": "session"},
        )
    assert resp.status_code == 200
    data = resp.json()
    assert data["code"] == 0
    assert data["data"] == [{"k": "v"}]
    fake_client.get_entries.assert_awaited_once_with("u1", "session", None)


async def test_add_memory_forwards_body(monkeypatch):
    """POST /memory:转发 body 到 unified_memory_client.add_entry。"""
    fake_client = MagicMock()
    fake_client.add_entry = AsyncMock(return_value={"id": "m1"})
    monkeypatch.setattr(agent_runtime, "unified_memory_client", fake_client)

    app = _make_app()
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        resp = await ac.post(
            "/agent-runtime/memory",
            json={"userId": "u1", "entry": {"text": "hello"}},
        )
    assert resp.status_code == 200
    assert resp.json()["data"] == {"id": "m1"}
    fake_client.add_entry.assert_awaited_once_with("u1", {"text": "hello"})


# =============================================================================
# 辅助:async iterator 工具
# =============================================================================


async def aiter(items):
    """把同步 list 包装为 async iterator。"""
    for x in items:
        yield x
