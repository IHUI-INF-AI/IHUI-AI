"""agent_runtime router + personas router 注册测试。

覆盖:
- POST /api/agent-runtime/execute — 200 + sessionId/mode/received
- POST /api/agent-runtime/execute — body 缺 message → 422
- POST /api/agent-runtime/execute/stream — 200 + text/event-stream + session/plan/delta/done 事件(LangGraph 真实驱动)
- GET /api/agent-runtime/{sessionId}/status — 200 + status/messageCount
- GET /api/agent-runtime/{sessionId}/status — 不存在 → 404
- POST /api/agent-runtime/{sessionId}/cancel — 200 + status cancelled
- GET /api/agent-runtime/sessions — 200 + sessions 数组
- GET /api/agent-runtime/sessions/{sessionId} — 200 + session 对象
- POST /api/agent-runtime/sessions/{sessionId}/resume — 200 + status running
- GET /api/agent-runtime/permission/check?toolName=Read&mode=default&dangerLevel=read — allow
- GET /api/agent-runtime/permission/check?toolName=Write&mode=plan&dangerLevel=write — deny
- GET /api/personas — 200 + 5 persona(确认 personas router 已注册到 main.py)
- /execute/stream 多场景:default mode / plan mode / graph 失败 / Redis 不可用降级 / Redis 可用持久化
"""

from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.routers import agent_runtime


@pytest.fixture(autouse=True)
def _clear_sessions():
    """每个测试前清空 agent_runtime 模块级 _sessions,确保隔离。"""
    agent_runtime._sessions.clear()
    yield
    agent_runtime._sessions.clear()


@pytest.fixture(autouse=True)
def _reset_redis_state():
    """每个测试前重置 Redis 全局状态,避免跨测试污染。"""
    agent_runtime._redis_client = None
    agent_runtime._redis_disabled = False
    yield
    agent_runtime._redis_client = None
    agent_runtime._redis_disabled = False


@pytest.fixture
def mock_llm_gateway():
    """Mock agent_graph 模块的 llm_gateway,返回固定 content 字符串。"""
    with patch("app.services.agent_graph.llm_gateway") as mock:
        mock.complete = AsyncMock(
            return_value={"content": "mock LLM response", "model": "mock", "stub": False}
        )
        yield mock


# =============================================================================
# POST /api/agent-runtime/execute
# =============================================================================


async def test_execute_returns_session_id_mode_received(client):
    """POST /api/agent-runtime/execute 返回 200 + sessionId/mode/received。"""
    resp = await client.post(
        "/api/agent-runtime/execute",
        json={"message": "hello world", "mode": "default"},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert "sessionId" in data
    assert data["mode"] == "default"
    assert data["received"] == "hello world"
    assert isinstance(data["sessionId"], str)
    assert len(data["sessionId"]) > 0


async def test_execute_missing_message_returns_422(client):
    """POST /api/agent-runtime/execute body 缺 message → 422。"""
    resp = await client.post(
        "/api/agent-runtime/execute",
        json={"mode": "default"},
    )
    assert resp.status_code == 422


async def test_execute_empty_message_returns_422(client):
    """POST /api/agent-runtime/execute message 空字符串 → 422(min_length=1)。"""
    resp = await client.post(
        "/api/agent-runtime/execute",
        json={"message": ""},
    )
    assert resp.status_code == 422


async def test_execute_with_explicit_session_id_reuses_session(client):
    """POST /api/agent-runtime/execute 携带 sessionId 时复用现有 session。"""
    resp1 = await client.post(
        "/api/agent-runtime/execute",
        json={"message": "first", "sessionId": "sess-fixed-001"},
    )
    assert resp1.status_code == 200
    assert resp1.json()["sessionId"] == "sess-fixed-001"
    resp2 = await client.post(
        "/api/agent-runtime/execute",
        json={"message": "second", "sessionId": "sess-fixed-001"},
    )
    assert resp2.status_code == 200
    assert resp2.json()["sessionId"] == "sess-fixed-001"
    status = await client.get("/api/agent-runtime/sess-fixed-001/status")
    assert status.json()["messageCount"] == 2


# =============================================================================
# POST /api/agent-runtime/execute/stream
# =============================================================================


async def test_execute_stream_default_mode_emits_session_plan_delta_done(
    client, mock_llm_gateway
):
    """default mode → session + plan + delta + done 事件,无 permission 事件。"""
    resp = await client.post(
        "/api/agent-runtime/execute/stream",
        json={"message": "stream test", "mode": "default"},
    )
    assert resp.status_code == 200
    assert "text/event-stream" in resp.headers.get("content-type", "")
    text = resp.text
    assert "event: session" in text
    assert "event: plan" in text
    assert "event: delta" in text
    assert "event: done" in text
    assert "event: permission" not in text
    assert "data:" in text
    assert mock_llm_gateway.complete.await_count >= 2


async def test_execute_stream_session_event_contains_session_id(client, mock_llm_gateway):
    """SSE session 事件 data 含 sessionId。"""
    resp = await client.post(
        "/api/agent-runtime/execute/stream",
        json={"message": "hi"},
    )
    text = resp.text
    session_line = [ln for ln in text.split("\n") if ln.startswith("event: session")][0]
    assert session_line is not None
    data_line = text.split("\n")[text.split("\n").index(session_line) + 1]
    assert "sessionId" in data_line


async def test_execute_stream_plan_mode_emits_permission_deny(client, mock_llm_gateway):
    """mode=plan → session + permission(deny) + plan + delta + done 事件。"""
    resp = await client.post(
        "/api/agent-runtime/execute/stream",
        json={"message": "plan mode task", "mode": "plan"},
    )
    assert resp.status_code == 200
    text = resp.text
    assert "event: session" in text
    assert "event: permission" in text
    assert '"decision": "deny"' in text
    assert "event: plan" in text
    assert "event: delta" in text
    assert "event: done" in text


async def test_execute_stream_bypass_mode_skips_planning(client, mock_llm_gateway):
    """mode=bypassPermissions → 跳过规划,plan 事件含 skip-planning 或仍走 execute。"""
    resp = await client.post(
        "/api/agent-runtime/execute/stream",
        json={"message": "bypass task", "mode": "bypassPermissions"},
    )
    assert resp.status_code == 200
    text = resp.text
    assert "event: session" in text
    assert "event: delta" in text
    assert "event: done" in text
    assert "event: permission" not in text


async def test_execute_stream_graph_failure_emits_error(client, mock_llm_gateway):
    """graph 节点抛异常 → 收到 session + error 事件。"""
    mock_llm_gateway.complete = AsyncMock(side_effect=RuntimeError("boom"))
    resp = await client.post(
        "/api/agent-runtime/execute/stream",
        json={"message": "will fail", "mode": "default"},
    )
    assert resp.status_code == 200
    text = resp.text
    assert "event: session" in text
    assert "event: error" in text
    assert "event: done" not in text


async def test_execute_stream_redis_unavailable_degrades_to_memory(
    client, mock_llm_gateway, monkeypatch
):
    """无 REDIS_URL → 内存降级,execute/stream 仍正常工作。"""
    monkeypatch.delenv("REDIS_URL", raising=False)
    agent_runtime._redis_client = None
    agent_runtime._redis_disabled = False

    resp = await client.post(
        "/api/agent-runtime/execute/stream",
        json={"message": "no redis", "mode": "default"},
    )
    assert resp.status_code == 200
    text = resp.text
    assert "event: session" in text
    assert "event: done" in text
    assert agent_runtime._redis_disabled is True
    assert agent_runtime._redis_client is None


async def test_execute_stream_redis_available_persists_session(
    client, mock_llm_gateway, monkeypatch
):
    """REDIS_URL 可用(mock redis client)→ session 持久化到 Redis。"""
    monkeypatch.setenv("REDIS_URL", "redis://localhost:8811/0")
    agent_runtime._redis_client = None
    agent_runtime._redis_disabled = False

    fake_redis = MagicMock()
    fake_redis.ping = MagicMock(return_value=True)
    fake_redis.set = MagicMock(return_value=True)
    fake_redis.get = MagicMock(return_value=None)

    with patch("redis.from_url", return_value=fake_redis):
        resp = await client.post(
            "/api/agent-runtime/execute/stream",
            json={"message": "with redis", "mode": "default"},
        )

    assert resp.status_code == 200
    text = resp.text
    assert "event: session" in text
    assert "event: done" in text
    assert fake_redis.set.called
    set_args = fake_redis.set.call_args
    assert set_args.args[0].startswith("agent_session:")
    assert "completed" in set_args.args[1] or "running" in set_args.args[1]


async def test_execute_stream_done_event_contains_summary(client, mock_llm_gateway):
    """done 事件 data 含 summary 字段,值与 mock LLM 响应一致。"""
    import json as _json

    resp = await client.post(
        "/api/agent-runtime/execute/stream",
        json={"message": "summary test", "mode": "default"},
    )
    text = resp.text
    done_lines = [
        ln for ln in text.split("\n") if ln.startswith("data: ") and "summary" in ln
    ]
    assert done_lines, "应至少有一条 data 行包含 summary"
    payload = _json.loads(done_lines[-1][len("data: "):])
    assert payload["status"] == "completed"
    assert payload["summary"] == "mock LLM response"


# =============================================================================
# GET /api/agent-runtime/{sessionId}/status
# =============================================================================


async def test_get_status_returns_status_and_message_count(client):
    """GET /api/agent-runtime/{sessionId}/status 返回 200 + status/messageCount。"""
    exec_resp = await client.post(
        "/api/agent-runtime/execute",
        json={"message": "status test", "sessionId": "sess-status-001"},
    )
    session_id = exec_resp.json()["sessionId"]
    resp = await client.get(f"/api/agent-runtime/{session_id}/status")
    assert resp.status_code == 200
    data = resp.json()
    assert data["sessionId"] == session_id
    assert data["status"] == "running"
    assert data["messageCount"] == 1


async def test_get_status_unknown_session_returns_404(client):
    """GET /api/agent-runtime/{unknown}/status 返回 404。"""
    resp = await client.get("/api/agent-runtime/nonexistent-session/status")
    assert resp.status_code == 404


# =============================================================================
# POST /api/agent-runtime/{sessionId}/cancel
# =============================================================================


async def test_cancel_session_returns_cancelled(client):
    """POST /api/agent-runtime/{sessionId}/cancel 返回 200 + status cancelled。"""
    exec_resp = await client.post(
        "/api/agent-runtime/execute",
        json={"message": "cancel me", "sessionId": "sess-cancel-001"},
    )
    session_id = exec_resp.json()["sessionId"]
    resp = await client.post(f"/api/agent-runtime/{session_id}/cancel")
    assert resp.status_code == 200
    data = resp.json()
    assert data["sessionId"] == session_id
    assert data["status"] == "cancelled"
    status = await client.get(f"/api/agent-runtime/{session_id}/status")
    assert status.json()["status"] == "cancelled"


async def test_cancel_unknown_session_returns_404(client):
    """POST /api/agent-runtime/{unknown}/cancel 返回 404。"""
    resp = await client.post("/api/agent-runtime/nonexistent-session/cancel")
    assert resp.status_code == 404


# =============================================================================
# GET /api/agent-runtime/sessions
# =============================================================================


async def test_list_sessions_returns_sessions_array(client):
    """GET /api/agent-runtime/sessions 返回 200 + sessions 数组。"""
    await client.post(
        "/api/agent-runtime/execute",
        json={"message": "s1", "sessionId": "sess-list-001"},
    )
    await client.post(
        "/api/agent-runtime/execute",
        json={"message": "s2", "sessionId": "sess-list-002"},
    )
    resp = await client.get("/api/agent-runtime/sessions")
    assert resp.status_code == 200
    data = resp.json()
    assert "sessions" in data
    assert isinstance(data["sessions"], list)
    assert data["total"] >= 2
    session_ids = [s["id"] for s in data["sessions"]]
    assert "sess-list-001" in session_ids
    assert "sess-list-002" in session_ids


async def test_list_sessions_empty_when_no_sessions(client):
    """GET /api/agent-runtime/sessions 无 session 时返回空数组。"""
    resp = await client.get("/api/agent-runtime/sessions")
    assert resp.status_code == 200
    data = resp.json()
    assert data["sessions"] == []
    assert data["total"] == 0


# =============================================================================
# GET /api/agent-runtime/sessions/{sessionId}
# =============================================================================


async def test_get_session_returns_session_object(client):
    """GET /api/agent-runtime/sessions/{sessionId} 返回 200 + session 对象。"""
    await client.post(
        "/api/agent-runtime/execute",
        json={"message": "get me", "sessionId": "sess-get-001"},
    )
    resp = await client.get("/api/agent-runtime/sessions/sess-get-001")
    assert resp.status_code == 200
    data = resp.json()
    assert data["id"] == "sess-get-001"
    assert data["status"] == "running"
    assert data["botId"] == "default"
    assert len(data["messages"]) == 1
    assert data["messages"][0]["role"] == "user"
    assert data["messages"][0]["content"] == "get me"


async def test_get_session_unknown_returns_404(client):
    """GET /api/agent-runtime/sessions/unknown 返回 404。"""
    resp = await client.get("/api/agent-runtime/sessions/nonexistent")
    assert resp.status_code == 404


# =============================================================================
# POST /api/agent-runtime/sessions/{sessionId}/resume
# =============================================================================


async def test_resume_session_returns_running(client):
    """POST /api/agent-runtime/sessions/{sessionId}/resume 返回 200 + status running。"""
    await client.post(
        "/api/agent-runtime/execute",
        json={"message": "resume me", "sessionId": "sess-resume-001"},
    )
    await client.post("/api/agent-runtime/sess-resume-001/cancel")
    cancel_status = await client.get("/api/agent-runtime/sess-resume-001/status")
    assert cancel_status.json()["status"] == "cancelled"
    resp = await client.post("/api/agent-runtime/sessions/sess-resume-001/resume")
    assert resp.status_code == 200
    data = resp.json()
    assert data["sessionId"] == "sess-resume-001"
    assert data["status"] == "running"
    status = await client.get("/api/agent-runtime/sess-resume-001/status")
    assert status.json()["status"] == "running"


async def test_resume_unknown_session_returns_404(client):
    """POST /api/agent-runtime/sessions/unknown/resume 返回 404。"""
    resp = await client.post("/api/agent-runtime/sessions/nonexistent/resume")
    assert resp.status_code == 404


# =============================================================================
# GET /api/agent-runtime/permission/check
# =============================================================================


async def test_permission_check_default_read_returns_allow(client):
    """GET /permission/check?toolName=Read&mode=default&dangerLevel=read → allow。"""
    resp = await client.get(
        "/api/agent-runtime/permission/check",
        params={"toolName": "Read", "mode": "default", "dangerLevel": "read"},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["toolName"] == "Read"
    assert data["mode"] == "default"
    assert data["dangerLevel"] == "read"
    assert data["decision"] == "allow"


async def test_permission_check_plan_write_returns_deny(client):
    """GET /permission/check?toolName=Write&mode=plan&dangerLevel=write → deny。"""
    resp = await client.get(
        "/api/agent-runtime/permission/check",
        params={"toolName": "Write", "mode": "plan", "dangerLevel": "write"},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["decision"] == "deny"


async def test_permission_check_bypass_allows_dangerous(client):
    """bypassPermissions 模式即使 dangerous 也 allow。"""
    resp = await client.get(
        "/api/agent-runtime/permission/check",
        params={
            "toolName": "RmDir",
            "mode": "bypassPermissions",
            "dangerLevel": "dangerous",
        },
    )
    assert resp.json()["decision"] == "allow"


async def test_permission_check_manual_always_asks(client):
    """manual 模式始终 ask。"""
    resp = await client.get(
        "/api/agent-runtime/permission/check",
        params={"toolName": "Read", "mode": "manual", "dangerLevel": "read"},
    )
    assert resp.json()["decision"] == "ask"


async def test_permission_check_default_write_asks(client):
    """default 模式 + write → ask。"""
    resp = await client.get(
        "/api/agent-runtime/permission/check",
        params={"toolName": "Write", "mode": "default", "dangerLevel": "write"},
    )
    assert resp.json()["decision"] == "ask"


async def test_permission_check_acceptEdits_write_allows(client):
    """acceptEdits 模式 + write → allow。"""
    resp = await client.get(
        "/api/agent-runtime/permission/check",
        params={"toolName": "Edit", "mode": "acceptEdits", "dangerLevel": "write"},
    )
    assert resp.json()["decision"] == "allow"


# =============================================================================
# GET /api/personas — 确认 personas router 已注册到 main.py
# =============================================================================


async def test_personas_router_registered_returns_5(client):
    """GET /api/personas 返回 200 + 5 个 persona(确认 personas router 已注册)。"""
    resp = await client.get("/api/personas")
    assert resp.status_code == 200
    data = resp.json()
    assert data["count"] == 5
    assert len(data["personas"]) == 5
    expected = {"researcher", "coder", "reviewer", "architect", "debugger"}
    assert {p["name"] for p in data["personas"]} == expected
