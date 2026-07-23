"""debug.py 单元测试 — DAP 调试路由(10 个端点)。

测试覆盖:
- 数据模型:DebugLaunchRequest / DebugAttachRequest / DebugBreakpointsRequest
  / DebugStepRequest / DebugEvalRequest
- 辅助函数:_ok / _session_not_found / _internal_error / _handle_debug_error
- 端点 10 个:launch / attach / set_breakpoints / continue / step / stack
  / variables / eval / disconnect / list_sessions
- 错误处理:RuntimeError("不存在/已终止") → 404,其他 → 500
- 隔离:mock get_debug_manager(),不调真实 DAP adapter 子进程
"""
from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock

import pytest
from fastapi import HTTPException
from httpx import ASGITransport, AsyncClient

from app.api.v1 import debug as debug_module
from app.api.v1.debug import (
    DebugAttachRequest,
    DebugBreakpointsRequest,
    DebugEvalRequest,
    DebugLaunchRequest,
    DebugStepRequest,
    _handle_debug_error,
    _internal_error,
    _ok,
    _session_not_found,
)


# =============================================================================
# 辅助
# =============================================================================


def _make_app():
    from fastapi import FastAPI

    app = FastAPI()
    app.include_router(debug_module.router, prefix="/api/v1")
    return app


# =============================================================================
# 数据模型
# =============================================================================


def test_launch_request_required_fields():
    """DebugLaunchRequest:language + program 必填。"""
    with pytest.raises(ValueError):
        DebugLaunchRequest(language="python")  # 缺 program
    with pytest.raises(ValueError):
        DebugLaunchRequest(program="x.py")  # 缺 language
    req = DebugLaunchRequest(language="python", program="x.py")
    assert req.language == "python"
    assert req.program == "x.py"
    assert req.args is None
    assert req.cwd is None
    assert req.env is None


def test_attach_request_port_bounds():
    """DebugAttachRequest:port 1-65535,host 默认 localhost。"""
    req = DebugAttachRequest(language="node", port=9229)
    assert req.host == "localhost"
    with pytest.raises(ValueError):
        DebugAttachRequest(language="node", port=0)
    with pytest.raises(ValueError):
        DebugAttachRequest(language="node", port=70000)


def test_breakpoints_request_required_fields():
    """DebugBreakpointsRequest:file + lines 必填。"""
    with pytest.raises(ValueError):
        DebugBreakpointsRequest(file="x.py")  # 缺 lines
    with pytest.raises(ValueError):
        DebugBreakpointsRequest(lines=[{"line": 1}])  # 缺 file
    req = DebugBreakpointsRequest(file="x.py", lines=[{"line": 10}, {"line": 20}])
    assert req.file == "x.py"
    assert len(req.lines) == 2


def test_step_request_default():
    """DebugStepRequest 默认 stepType='next'。"""
    req = DebugStepRequest()
    assert req.stepType == "next"


def test_eval_request_required_expression():
    """DebugEvalRequest:expression 必填,frameId 可选。"""
    with pytest.raises(ValueError):
        DebugEvalRequest()
    req = DebugEvalRequest(expression="1+1")
    assert req.expression == "1+1"
    assert req.frameId is None


# =============================================================================
# 辅助函数:_ok / _session_not_found / _internal_error / _handle_debug_error
# =============================================================================


def test_ok_format():
    """_ok 返回 {code:200, message:'ok', data:...}。"""
    result = _ok({"k": "v"})
    assert result == {"code": 200, "message": "ok", "data": {"k": "v"}}


def test_session_not_found_returns_404():
    """_session_not_found:HTTPException 404 + code 404。"""
    exc = _session_not_found("s1")
    assert isinstance(exc, HTTPException)
    assert exc.status_code == 404
    assert exc.detail["code"] == 404
    assert "s1" in exc.detail["message"]


def test_internal_error_returns_500():
    """_internal_error:HTTPException 500 + code 500。"""
    exc = _internal_error(RuntimeError("boom"))
    assert isinstance(exc, HTTPException)
    assert exc.status_code == 500
    assert exc.detail["code"] == 500
    assert "boom" in exc.detail["message"]


def test_handle_debug_error_session_missing_raises_404():
    """_handle_debug_error:msg 含 '不存在' → raise 404。"""
    with pytest.raises(HTTPException) as exc_info:
        _handle_debug_error("s1", RuntimeError("debug session 不存在: s1"))
    assert exc_info.value.status_code == 404


def test_handle_debug_error_session_terminated_raises_404():
    """_handle_debug_error:msg 含 '已终止' → raise 404。"""
    with pytest.raises(HTTPException) as exc_info:
        _handle_debug_error("s1", RuntimeError("debug session 已终止: s1"))
    assert exc_info.value.status_code == 404


def test_handle_debug_error_other_raises_500():
    """_handle_debug_error:其他 RuntimeError → raise 500。"""
    with pytest.raises(HTTPException) as exc_info:
        _handle_debug_error("s1", RuntimeError("adapter crashed"))
    assert exc_info.value.status_code == 500


# =============================================================================
# 端点:launch
# =============================================================================


async def test_launch_endpoint_success(monkeypatch):
    """POST /api/v1/debug/launch 成功 → code=200 + sessionId。"""
    fake_manager = MagicMock()
    fake_manager.launch = AsyncMock(return_value="sess-1")
    monkeypatch.setattr(debug_module, "get_debug_manager", lambda: fake_manager)

    app = _make_app()
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        resp = await ac.post(
            "/api/v1/debug/launch",
            json={"language": "python", "program": "x.py", "args": ["--debug"]},
        )
    assert resp.status_code == 200
    data = resp.json()
    assert data["code"] == 200
    assert data["data"]["sessionId"] == "sess-1"
    fake_manager.launch.assert_awaited_once()


async def test_launch_endpoint_failure_returns_500(monkeypatch):
    """POST /api/v1/debug/launch 异常 → 500。"""
    fake_manager = MagicMock()
    fake_manager.launch = AsyncMock(side_effect=RuntimeError("spawn failed"))
    monkeypatch.setattr(debug_module, "get_debug_manager", lambda: fake_manager)

    app = _make_app()
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        resp = await ac.post(
            "/api/v1/debug/launch",
            json={"language": "python", "program": "x.py"},
        )
    assert resp.status_code == 500
    assert resp.json()["detail"]["code"] == 500


# =============================================================================
# 端点:attach
# =============================================================================


async def test_attach_endpoint_success(monkeypatch):
    """POST /api/v1/debug/attach 成功 → code=200 + sessionId。"""
    fake_manager = MagicMock()
    fake_manager.attach = AsyncMock(return_value="sess-2")
    monkeypatch.setattr(debug_module, "get_debug_manager", lambda: fake_manager)

    app = _make_app()
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        resp = await ac.post(
            "/api/v1/debug/attach",
            json={"language": "node", "port": 9229, "host": "localhost"},
        )
    assert resp.status_code == 200
    assert resp.json()["data"]["sessionId"] == "sess-2"
    fake_manager.attach.assert_awaited_once_with(
        language="node", port=9229, host="localhost"
    )


async def test_attach_endpoint_failure_returns_500(monkeypatch):
    """POST /api/v1/debug/attach 异常 → 500。"""
    fake_manager = MagicMock()
    fake_manager.attach = AsyncMock(side_effect=RuntimeError("port in use"))
    monkeypatch.setattr(debug_module, "get_debug_manager", lambda: fake_manager)

    app = _make_app()
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        resp = await ac.post(
            "/api/v1/debug/attach",
            json={"language": "node", "port": 9229},
        )
    assert resp.status_code == 500


# =============================================================================
# 端点:set_breakpoints
# =============================================================================


async def test_set_breakpoints_success(monkeypatch):
    """POST /api/v1/debug/sessions/{id}/breakpoints 成功。"""
    fake_manager = MagicMock()
    fake_manager.set_breakpoints = AsyncMock(
        return_value=[{"line": 10, "verified": True}]
    )
    monkeypatch.setattr(debug_module, "get_debug_manager", lambda: fake_manager)

    app = _make_app()
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        resp = await ac.post(
            "/api/v1/debug/sessions/s1/breakpoints",
            json={"file": "/x.py", "lines": [{"line": 10}]},
        )
    assert resp.status_code == 200
    data = resp.json()
    assert data["data"]["breakpoints"] == [{"line": 10, "verified": True}]


async def test_set_breakpoints_session_missing_404(monkeypatch):
    """set_breakpoints:session 不存在 → 404。"""
    fake_manager = MagicMock()
    fake_manager.set_breakpoints = AsyncMock(
        side_effect=RuntimeError("debug session 不存在: s1")
    )
    monkeypatch.setattr(debug_module, "get_debug_manager", lambda: fake_manager)

    app = _make_app()
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        resp = await ac.post(
            "/api/v1/debug/sessions/s1/breakpoints",
            json={"file": "/x.py", "lines": [{"line": 1}]},
        )
    assert resp.status_code == 404


# =============================================================================
# 端点:continue
# =============================================================================


async def test_continue_success(monkeypatch):
    """POST /api/v1/debug/sessions/{id}/continue 成功。"""
    fake_manager = MagicMock()
    fake_manager.continue_execution = AsyncMock(
        return_value={"reason": "breakpoint", "threadId": 1}
    )
    monkeypatch.setattr(debug_module, "get_debug_manager", lambda: fake_manager)

    app = _make_app()
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        resp = await ac.post("/api/v1/debug/sessions/s1/continue")
    assert resp.status_code == 200
    assert resp.json()["data"]["stopped"]["reason"] == "breakpoint"


async def test_continue_terminated_session_404(monkeypatch):
    """continue:已终止 session → 404。"""
    fake_manager = MagicMock()
    fake_manager.continue_execution = AsyncMock(
        side_effect=RuntimeError("debug session 已终止: s1")
    )
    monkeypatch.setattr(debug_module, "get_debug_manager", lambda: fake_manager)

    app = _make_app()
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        resp = await ac.post("/api/v1/debug/sessions/s1/continue")
    assert resp.status_code == 404


# =============================================================================
# 端点:step
# =============================================================================


async def test_step_next_success(monkeypatch):
    """POST step stepType=next → 调 manager.step。"""
    fake_manager = MagicMock()
    fake_manager.step = AsyncMock(return_value={"reason": "step", "threadId": 1})
    monkeypatch.setattr(debug_module, "get_debug_manager", lambda: fake_manager)

    app = _make_app()
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        resp = await ac.post(
            "/api/v1/debug/sessions/s1/step",
            json={"stepType": "next"},
        )
    assert resp.status_code == 200
    fake_manager.step.assert_awaited_once_with("s1", step_type="next")


async def test_step_continue_type_routes_to_continue(monkeypatch):
    """step stepType=continue → 转发到 manager.continue_execution。"""
    fake_manager = MagicMock()
    fake_manager.continue_execution = AsyncMock(
        return_value={"reason": "breakpoint", "threadId": 1}
    )
    monkeypatch.setattr(debug_module, "get_debug_manager", lambda: fake_manager)

    app = _make_app()
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        resp = await ac.post(
            "/api/v1/debug/sessions/s1/step",
            json={"stepType": "continue"},
        )
    assert resp.status_code == 200
    fake_manager.continue_execution.assert_awaited_once_with("s1")
    fake_manager.step.assert_not_called()


# =============================================================================
# 端点:stack
# =============================================================================


async def test_get_stack_success(monkeypatch):
    """GET stack → 返回 stackFrames。"""
    frames = [{"id": 0, "name": "main", "line": 10}]
    fake_manager = MagicMock()
    fake_manager.get_stack_trace = AsyncMock(return_value=frames)
    monkeypatch.setattr(debug_module, "get_debug_manager", lambda: fake_manager)

    app = _make_app()
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        resp = await ac.get("/api/v1/debug/sessions/s1/stack")
    assert resp.status_code == 200
    assert resp.json()["data"]["stackFrames"] == frames


# =============================================================================
# 端点:variables
# =============================================================================


async def test_get_variables_success(monkeypatch):
    """GET variables → 返回 variables 列表。"""
    variables = [{"name": "x", "value": "10", "type": "int"}]
    fake_manager = MagicMock()
    fake_manager.get_variables = AsyncMock(return_value=variables)
    monkeypatch.setattr(debug_module, "get_debug_manager", lambda: fake_manager)

    app = _make_app()
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        resp = await ac.get(
            "/api/v1/debug/sessions/s1/variables",
            params={"frameId": 0, "scope": "local"},
        )
    assert resp.status_code == 200
    assert resp.json()["data"]["variables"] == variables
    fake_manager.get_variables.assert_awaited_once_with(
        session_id="s1", frame_id=0, scope="local"
    )


async def test_get_variables_default_scope(monkeypatch):
    """GET variables 不传 scope → 默认 'local'。"""
    fake_manager = MagicMock()
    fake_manager.get_variables = AsyncMock(return_value=[])
    monkeypatch.setattr(debug_module, "get_debug_manager", lambda: fake_manager)

    app = _make_app()
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        resp = await ac.get(
            "/api/v1/debug/sessions/s1/variables",
            params={"frameId": 0},
        )
    assert resp.status_code == 200
    fake_manager.get_variables.assert_awaited_once_with(
        session_id="s1", frame_id=0, scope="local"
    )


# =============================================================================
# 端点:eval
# =============================================================================


async def test_eval_success_with_type(monkeypatch):
    """POST eval:result 含 type 字段 → data 含 type。"""
    fake_manager = MagicMock()
    fake_manager.evaluate = AsyncMock(
        return_value={"result": "42", "type": "int", "variablesReference": 0}
    )
    monkeypatch.setattr(debug_module, "get_debug_manager", lambda: fake_manager)

    app = _make_app()
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        resp = await ac.post(
            "/api/v1/debug/sessions/s1/eval",
            json={"expression": "1+1", "frameId": 0},
        )
    assert resp.status_code == 200
    data = resp.json()["data"]
    assert data["result"] == "42"
    assert data["type"] == "int"


async def test_eval_success_without_type(monkeypatch):
    """POST eval:result 无 type 字段 → data 不含 type 键。"""
    fake_manager = MagicMock()
    fake_manager.evaluate = AsyncMock(return_value={"result": "ok"})
    monkeypatch.setattr(debug_module, "get_debug_manager", lambda: fake_manager)

    app = _make_app()
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        resp = await ac.post(
            "/api/v1/debug/sessions/s1/eval",
            json={"expression": "x"},
        )
    assert resp.status_code == 200
    data = resp.json()["data"]
    assert data["result"] == "ok"
    assert "type" not in data


async def test_eval_session_missing_404(monkeypatch):
    """eval:session 不存在 → 404。"""
    fake_manager = MagicMock()
    fake_manager.evaluate = AsyncMock(
        side_effect=RuntimeError("debug session 不存在: s1")
    )
    monkeypatch.setattr(debug_module, "get_debug_manager", lambda: fake_manager)

    app = _make_app()
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        resp = await ac.post(
            "/api/v1/debug/sessions/s1/eval",
            json={"expression": "x"},
        )
    assert resp.status_code == 404


# =============================================================================
# 端点:disconnect
# =============================================================================


async def test_disconnect_success(monkeypatch):
    """DELETE session:成功 → disconnected=True。"""
    fake_manager = MagicMock()
    fake_manager.disconnect = AsyncMock(return_value=True)
    monkeypatch.setattr(debug_module, "get_debug_manager", lambda: fake_manager)

    app = _make_app()
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        resp = await ac.delete("/api/v1/debug/sessions/s1")
    assert resp.status_code == 200
    assert resp.json()["data"]["disconnected"] is True


async def test_disconnect_returns_404_when_already_gone(monkeypatch):
    """DELETE session:disconnect 返回 False → 404(找不到)。"""
    fake_manager = MagicMock()
    fake_manager.disconnect = AsyncMock(return_value=False)
    monkeypatch.setattr(debug_module, "get_debug_manager", lambda: fake_manager)

    app = _make_app()
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        resp = await ac.delete("/api/v1/debug/sessions/s1")
    assert resp.status_code == 404


async def test_disconnect_internal_error(monkeypatch):
    """DELETE session:disconnect 抛异常 → 500。"""
    fake_manager = MagicMock()
    fake_manager.disconnect = AsyncMock(side_effect=RuntimeError("kill failed"))
    monkeypatch.setattr(debug_module, "get_debug_manager", lambda: fake_manager)

    app = _make_app()
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        resp = await ac.delete("/api/v1/debug/sessions/s1")
    assert resp.status_code == 500


# =============================================================================
# 端点:list_sessions
# =============================================================================


async def test_list_sessions(monkeypatch):
    """GET /api/v1/debug/sessions → 返回所有会话。"""
    sessions = [{"sessionId": "s1", "status": "running"}, {"sessionId": "s2", "status": "stopped"}]
    fake_manager = MagicMock()
    fake_manager.list_sessions = AsyncMock(return_value=sessions)
    monkeypatch.setattr(debug_module, "get_debug_manager", lambda: fake_manager)

    app = _make_app()
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        resp = await ac.get("/api/v1/debug/sessions")
    assert resp.status_code == 200
    data = resp.json()
    assert data["data"]["sessions"] == sessions
    assert len(data["data"]["sessions"]) == 2
