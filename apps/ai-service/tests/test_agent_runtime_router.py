"""agent_runtime router + personas router 注册测试。

覆盖:
- POST /api/agent-runtime/execute — 200 + sessionId/mode/received
- POST /api/agent-runtime/execute — body 缺 message → 422
- POST /api/agent-runtime/execute/stream — 200 + text/event-stream + session/permission/done 三事件
- GET /api/agent-runtime/{sessionId}/status — 200 + status/messageCount
- GET /api/agent-runtime/{sessionId}/status — 不存在 → 404
- POST /api/agent-runtime/{sessionId}/cancel — 200 + status cancelled
- GET /api/agent-runtime/sessions — 200 + sessions 数组
- GET /api/agent-runtime/sessions/{sessionId} — 200 + session 对象
- POST /api/agent-runtime/sessions/{sessionId}/resume — 200 + status running
- GET /api/agent-runtime/permission/check?toolName=Read&mode=default&dangerLevel=read — allow
- GET /api/agent-runtime/permission/check?toolName=Write&mode=plan&dangerLevel=write — deny
- GET /api/personas — 200 + 5 persona(确认 personas router 已注册到 main.py)
"""

import pytest

from app.routers import agent_runtime


@pytest.fixture(autouse=True)
def _clear_sessions():
    """每个测试前清空 agent_runtime 模块级 _sessions,确保隔离。"""
    agent_runtime._sessions.clear()
    yield
    agent_runtime._sessions.clear()


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


async def test_execute_stream_returns_sse_with_three_events(client):
    """POST /api/agent-runtime/execute/stream 返回 SSE + session/permission/done 三事件。"""
    resp = await client.post(
        "/api/agent-runtime/execute/stream",
        json={"message": "stream test", "mode": "default"},
    )
    assert resp.status_code == 200
    assert "text/event-stream" in resp.headers.get("content-type", "")
    text = resp.text
    assert "event: session" in text
    assert "event: permission" in text
    assert "event: done" in text
    assert "data:" in text


async def test_execute_stream_session_event_contains_session_id(client):
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
