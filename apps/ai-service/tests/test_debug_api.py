"""debug.py HTTP API 层测试(app/api/v1/debug.py)。

测试覆盖 10 个端点(前缀 /api/v1/debug):
1. POST /launch — 启动调试会话
2. POST /attach — 附加到已运行进程
3. POST /sessions/{id}/breakpoints — 设置断点
4. POST /sessions/{id}/continue — 继续执行
5. POST /sessions/{id}/step — 单步执行
6. GET /sessions/{id}/stack — 获取调用栈
7. GET /sessions/{id}/variables — 获取变量
8. POST /sessions/{id}/eval — 表达式求值
9. DELETE /sessions/{id} — 断开会话
10. GET /sessions — 列出所有会话

设计:
- mock app.api.v1.debug.get_debug_manager 返回 MagicMock + AsyncMock 方法,不启动真实 DAP adapter。
- 覆盖 conftest 中 broken 的 _isolate_vector_memory fixture(引用已移除的 _store / _next_id)。
- 清空 jwt_secret,让 JWT 中间件在 development 模式跳过认证(HTTP 测试需要)。
"""

from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock

import pytest


# =============================================================================
# 覆盖 conftest.py 中 broken 的 _isolate_vector_memory fixture + 关闭 JWT 认证
# (参考 test_publish.py / test_message_bus.py 的做法)
# =============================================================================


@pytest.fixture(autouse=True)
def _isolate_vector_memory(monkeypatch: pytest.MonkeyPatch):
    """覆盖 conftest 中 broken 的同名 fixture(引用了已移除的 _store / _next_id)。
    同时清空 jwt_secret,让 JWT 中间件在 development 模式跳过认证(HTTP 测试需要)。
    """
    from app.core.config import settings
    from app.services.vector_memory import vector_memory

    monkeypatch.setattr(settings, "jwt_secret", "")
    vector_memory._use_redis = False
    vector_memory._redis = None
    vector_memory._entries.clear()
    vector_memory._vectors.clear()
    yield
    vector_memory._use_redis = False
    vector_memory._redis = None
    vector_memory._entries.clear()
    vector_memory._vectors.clear()


# =============================================================================
# Mock 基础设施:mock get_debug_manager 返回可控的 MagicMock
# =============================================================================


def _make_mock_manager() -> MagicMock:
    """构造一个 Mock DebugSessionManager,所有异步方法为 AsyncMock 并预设合理返回值。"""
    mgr = MagicMock()
    mgr.launch = AsyncMock(return_value="session-abc-123")
    mgr.attach = AsyncMock(return_value="session-attach-1")
    mgr.set_breakpoints = AsyncMock(
        return_value=[
            {"id": 1, "verified": True, "line": 10},
            {"id": 2, "verified": True, "line": 20},
        ]
    )
    mgr.continue_execution = AsyncMock(
        return_value={"reason": "breakpoint", "threadId": 1, "allThreadsStopped": True}
    )
    mgr.step = AsyncMock(
        return_value={"reason": "step", "threadId": 1, "allThreadsStopped": True}
    )
    mgr.get_stack_trace = AsyncMock(
        return_value=[
            {"id": 100, "name": "main", "source": {"path": "/tmp/script.py"}, "line": 15, "column": 1},
            {"id": 101, "name": "helper", "source": {"path": "/tmp/script.py"}, "line": 30, "column": 5},
        ]
    )
    mgr.get_variables = AsyncMock(
        return_value=[
            {"name": "x", "value": "42", "type": "int", "variablesReference": 0},
            {"name": "msg", "value": '"hello"', "type": "str", "variablesReference": 0},
        ]
    )
    mgr.evaluate = AsyncMock(
        return_value={"result": "42", "type": "int", "variablesReference": 0}
    )
    mgr.disconnect = AsyncMock(return_value=True)
    mgr.list_sessions = AsyncMock(
        return_value=[
            {"sessionId": "session-abc-123", "language": "python", "status": "running"},
        ]
    )
    return mgr


@pytest.fixture
def mock_manager(monkeypatch: pytest.MonkeyPatch) -> MagicMock:
    """注入 mock DebugSessionManager 到 app.api.v1.debug 模块。"""
    mgr = _make_mock_manager()
    monkeypatch.setattr("app.api.v1.debug.get_debug_manager", lambda: mgr)
    return mgr


# =============================================================================
# 1. POST /api/v1/debug/launch
# =============================================================================


async def test_launch_ok(client, mock_manager) -> None:
    """正常启动调试会话,响应 200 且 sessionId 非空。"""
    resp = await client.post(
        "/api/v1/debug/launch",
        json={
            "language": "python",
            "program": "/tmp/script.py",
            "args": ["--flag"],
            "cwd": "/tmp",
            "env": {"FOO": "bar"},
        },
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["code"] == 200
    assert body["data"]["sessionId"] == "session-abc-123"
    # 验证 manager.launch 被正确调用(program 映射到 command 参数)
    mock_manager.launch.assert_awaited_once()
    call_kwargs = mock_manager.launch.await_args.kwargs
    assert call_kwargs["language"] == "python"
    assert call_kwargs["command"] == "/tmp/script.py"
    assert call_kwargs["args"] == ["--flag"]
    assert call_kwargs["cwd"] == "/tmp"
    assert call_kwargs["env"] == {"FOO": "bar"}


async def test_launch_missing_language_returns_422(client, mock_manager) -> None:
    """缺少 language 参数返回 422(Pydantic 校验失败)。"""
    resp = await client.post(
        "/api/v1/debug/launch",
        json={"program": "/tmp/script.py"},
    )
    assert resp.status_code == 422
    # manager 不应被调用
    mock_manager.launch.assert_not_awaited()


async def test_launch_internal_error_returns_500(client, mock_manager) -> None:
    """debugger 内部错误返回 500。"""
    mock_manager.launch.side_effect = RuntimeError("adapter 进程崩溃")
    resp = await client.post(
        "/api/v1/debug/launch",
        json={"language": "python", "program": "/tmp/script.py"},
    )
    assert resp.status_code == 500


# =============================================================================
# 2. POST /api/v1/debug/attach
# =============================================================================


async def test_attach_ok(client, mock_manager) -> None:
    """正常附加到已运行进程,响应 200。"""
    resp = await client.post(
        "/api/v1/debug/attach",
        json={"language": "node", "port": 9229, "host": "localhost"},
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["code"] == 200
    assert body["data"]["sessionId"] == "session-attach-1"
    mock_manager.attach.assert_awaited_once()
    call_kwargs = mock_manager.attach.await_args.kwargs
    assert call_kwargs["language"] == "node"
    assert call_kwargs["port"] == 9229
    assert call_kwargs["host"] == "localhost"


async def test_attach_missing_port_returns_422(client, mock_manager) -> None:
    """缺少 port 参数返回 422。"""
    resp = await client.post(
        "/api/v1/debug/attach",
        json={"language": "node"},
    )
    assert resp.status_code == 422
    mock_manager.attach.assert_not_awaited()


async def test_attach_invalid_port_returns_422(client, mock_manager) -> None:
    """port 超出合法范围(0 / 70000)返回 422(ge=1, le=65535)。"""
    resp = await client.post(
        "/api/v1/debug/attach",
        json={"language": "node", "port": 0},
    )
    assert resp.status_code == 422
    mock_manager.attach.assert_not_awaited()


# =============================================================================
# 3. POST /api/v1/debug/sessions/{id}/breakpoints
# =============================================================================


async def test_set_breakpoints_ok(client, mock_manager) -> None:
    """正常设置断点,响应 200 且返回 breakpoints 列表。"""
    resp = await client.post(
        "/api/v1/debug/sessions/session-abc-123/breakpoints",
        json={
            "file": "/tmp/script.py",
            "lines": [{"line": 10}, {"line": 20, "condition": "x > 5"}],
        },
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["code"] == 200
    breakpoints = body["data"]["breakpoints"]
    assert len(breakpoints) == 2
    assert breakpoints[0]["verified"] is True
    mock_manager.set_breakpoints.assert_awaited_once()
    call_kwargs = mock_manager.set_breakpoints.await_args.kwargs
    assert call_kwargs["session_id"] == "session-abc-123"
    assert call_kwargs["file"] == "/tmp/script.py"


async def test_set_breakpoints_session_not_found_returns_404(client, mock_manager) -> None:
    """session 不存在返回 404(manager 抛 RuntimeError 含 '不存在')。"""
    mock_manager.set_breakpoints.side_effect = RuntimeError("debug session 不存在: ghost-id")
    resp = await client.post(
        "/api/v1/debug/sessions/ghost-id/breakpoints",
        json={"file": "/tmp/script.py", "lines": [{"line": 1}]},
    )
    assert resp.status_code == 404


# =============================================================================
# 4. POST /api/v1/debug/sessions/{id}/continue
# =============================================================================


async def test_continue_ok(client, mock_manager) -> None:
    """正常继续执行,响应 200 且返回 stopped 信息。"""
    resp = await client.post("/api/v1/debug/sessions/session-abc-123/continue")
    assert resp.status_code == 200
    body = resp.json()
    assert body["code"] == 200
    assert body["data"]["stopped"]["reason"] == "breakpoint"
    mock_manager.continue_execution.assert_awaited_once_with("session-abc-123")


async def test_continue_session_not_found_returns_404(client, mock_manager) -> None:
    """session 不存在返回 404。"""
    mock_manager.continue_execution.side_effect = RuntimeError("debug session 不存在: ghost-id")
    resp = await client.post("/api/v1/debug/sessions/ghost-id/continue")
    assert resp.status_code == 404


# =============================================================================
# 5. POST /api/v1/debug/sessions/{id}/step
# =============================================================================


async def test_step_ok(client, mock_manager) -> None:
    """正常单步执行,响应 200 且返回 stopped 信息。"""
    resp = await client.post(
        "/api/v1/debug/sessions/session-abc-123/step",
        json={"stepType": "next"},
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["code"] == 200
    assert body["data"]["stopped"]["reason"] == "step"
    mock_manager.step.assert_awaited_once()
    # manager.step(session_id, step_type=...) — session_id 是位置参数
    call_args = mock_manager.step.await_args
    assert call_args.args[0] == "session-abc-123"
    assert call_args.kwargs["step_type"] == "next"


async def test_step_continue_type_forwards_to_continue(client, mock_manager) -> None:
    """stepType=continue 时内部转发到 continue_execution(语义等价)。"""
    resp = await client.post(
        "/api/v1/debug/sessions/session-abc-123/step",
        json={"stepType": "continue"},
    )
    assert resp.status_code == 200
    mock_manager.continue_execution.assert_awaited_once_with("session-abc-123")
    mock_manager.step.assert_not_awaited()


async def test_step_session_not_found_returns_404(client, mock_manager) -> None:
    """session 不存在返回 404。"""
    mock_manager.step.side_effect = RuntimeError("debug session 不存在: ghost-id")
    resp = await client.post(
        "/api/v1/debug/sessions/ghost-id/step",
        json={"stepType": "next"},
    )
    assert resp.status_code == 404


# =============================================================================
# 6. GET /api/v1/debug/sessions/{id}/stack
# =============================================================================


async def test_get_stack_ok(client, mock_manager) -> None:
    """正常获取调用栈,响应 200。"""
    resp = await client.get("/api/v1/debug/sessions/session-abc-123/stack")
    assert resp.status_code == 200
    body = resp.json()
    assert body["code"] == 200
    frames = body["data"]["stackFrames"]
    assert len(frames) == 2
    assert frames[0]["name"] == "main"
    assert frames[0]["line"] == 15
    mock_manager.get_stack_trace.assert_awaited_once_with("session-abc-123")


async def test_get_stack_session_not_found_returns_404(client, mock_manager) -> None:
    """session 不存在返回 404。"""
    mock_manager.get_stack_trace.side_effect = RuntimeError("debug session 不存在: ghost-id")
    resp = await client.get("/api/v1/debug/sessions/ghost-id/stack")
    assert resp.status_code == 404


# =============================================================================
# 7. GET /api/v1/debug/sessions/{id}/variables
# =============================================================================


async def test_get_variables_ok(client, mock_manager) -> None:
    """正常获取变量,响应 200。"""
    resp = await client.get(
        "/api/v1/debug/sessions/session-abc-123/variables",
        params={"frameId": 100, "scope": "local"},
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["code"] == 200
    variables = body["data"]["variables"]
    assert len(variables) == 2
    assert variables[0]["name"] == "x"
    assert variables[0]["value"] == "42"
    mock_manager.get_variables.assert_awaited_once()
    call_kwargs = mock_manager.get_variables.await_args.kwargs
    assert call_kwargs["session_id"] == "session-abc-123"
    assert call_kwargs["frame_id"] == 100
    assert call_kwargs["scope"] == "local"


async def test_get_variables_missing_frame_id_returns_422(client, mock_manager) -> None:
    """缺少 frameId 参数返回 422(Query 必填)。"""
    resp = await client.get("/api/v1/debug/sessions/session-abc-123/variables")
    assert resp.status_code == 422
    mock_manager.get_variables.assert_not_awaited()


# =============================================================================
# 8. POST /api/v1/debug/sessions/{id}/eval
# =============================================================================


async def test_eval_ok(client, mock_manager) -> None:
    """正常表达式求值,响应 200 且返回 result + type。"""
    resp = await client.post(
        "/api/v1/debug/sessions/session-abc-123/eval",
        json={"expression": "6 * 7", "frameId": 100},
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["code"] == 200
    data = body["data"]
    assert data["result"] == "42"
    assert data["type"] == "int"
    mock_manager.evaluate.assert_awaited_once()
    call_kwargs = mock_manager.evaluate.await_args.kwargs
    assert call_kwargs["session_id"] == "session-abc-123"
    assert call_kwargs["expression"] == "6 * 7"
    assert call_kwargs["frame_id"] == 100


async def test_eval_without_frame_id_ok(client, mock_manager) -> None:
    """不传 frameId 时仍可求值(frameId 可选,默认 None)。"""
    resp = await client.post(
        "/api/v1/debug/sessions/session-abc-123/eval",
        json={"expression": "1 + 1"},
    )
    assert resp.status_code == 200
    call_kwargs = mock_manager.evaluate.await_args.kwargs
    assert call_kwargs["frame_id"] is None


# =============================================================================
# 9. DELETE /api/v1/debug/sessions/{id}
# =============================================================================


async def test_disconnect_ok(client, mock_manager) -> None:
    """正常断开会话,响应 200。"""
    resp = await client.delete("/api/v1/debug/sessions/session-abc-123")
    assert resp.status_code == 200
    body = resp.json()
    assert body["code"] == 200
    assert body["data"]["disconnected"] is True
    mock_manager.disconnect.assert_awaited_once_with("session-abc-123")


async def test_disconnect_session_not_found_returns_404(client, mock_manager) -> None:
    """session 不存在(disconnect 返回 False)返回 404。"""
    mock_manager.disconnect.return_value = False
    resp = await client.delete("/api/v1/debug/sessions/ghost-id")
    assert resp.status_code == 404


# =============================================================================
# 10. GET /api/v1/debug/sessions
# =============================================================================


async def test_list_sessions_ok(client, mock_manager) -> None:
    """列出所有会话,响应 200 且返回会话列表。"""
    resp = await client.get("/api/v1/debug/sessions")
    assert resp.status_code == 200
    body = resp.json()
    assert body["code"] == 200
    sessions = body["data"]["sessions"]
    assert isinstance(sessions, list)
    assert len(sessions) == 1
    assert sessions[0]["sessionId"] == "session-abc-123"
    assert sessions[0]["language"] == "python"
    mock_manager.list_sessions.assert_awaited_once()
