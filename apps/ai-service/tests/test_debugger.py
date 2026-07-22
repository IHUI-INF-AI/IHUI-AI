"""DAP(Debug Adapter Protocol)DebugSessionManager 单元测试。

测试覆盖(12 个用例):
1. test_launch_session — launch 返回 session_id
2. test_attach_session — attach 返回 session_id
3. test_set_breakpoints — 返回 verified breakpoint 列表
4. test_continue_stopped — continue 后收到 stopped 事件
5. test_step_next — step next 后收到 stopped 事件
6. test_get_stack_trace — 返回 frame 列表
7. test_get_variables — 返回 variable 列表
8. test_evaluate_expression — 返回求值结果
9. test_disconnect — 断开后 session 移除
10. test_list_sessions — 列出活跃 session
11. test_cleanup_expired — 清理超时 session
12. test_concurrent_sessions — 多 session 并发
13. test_launch_adapter_unavailable — adapter 不可用时优雅降级
14. test_get_session_not_found — 不存在的 session 报错

设计:用 MockDapClient 模拟 DAP 协议响应,不真实启动 debug adapter。
"""

from __future__ import annotations

import asyncio
import time
from typing import Any, Optional
from unittest.mock import MagicMock

import pytest

from app.services.debugger import (
    DebugSession,
    DebugSessionManager,
    encode_dap_message,
)


# =============================================================================
# Mock 基础设施
# =============================================================================


class MockDapClient:
    """模拟 DapClient — 不启动真实子进程,按预设响应表返回 DAP 响应。

    responses: dict[command, body | list[body]]
    - 单个 body:每次 send_request 返回同一 body
    - list[body]:按顺序返回(用于 step 等多次调用场景)

    emit_event(event, body):触发 DAP event(stopped/terminated/continued 等)。
    """

    def __init__(self, responses: Optional[dict[str, Any]] = None) -> None:
        self._responses = responses or {}
        self._event_handlers: dict[str, list] = {}
        self._call_log: list[tuple[str, Any]] = []
        self._response_index: dict[str, int] = {}
        self.terminated = False
        self._start_called = False

    async def start(self) -> None:
        self._start_called = True
        # 模拟 DapClient.start() 内部的 _do_initialize() 调用
        self._call_log.append(("initialize", None))

    async def send_request(
        self,
        command: str,
        arguments: Optional[dict[str, Any]] = None,
        timeout: float = 10.0,
    ) -> Any:
        self._call_log.append((command, arguments))
        if command not in self._responses:
            return {}
        resp = self._responses[command]
        if isinstance(resp, list):
            idx = self._response_index.get(command, 0)
            self._response_index[command] = idx + 1
            return resp[min(idx, len(resp) - 1)]
        return resp

    def on_event(self, event: str, handler) -> None:
        self._event_handlers.setdefault(event, []).append(handler)

    def emit_event(self, event: str, body: Optional[dict[str, Any]] = None) -> None:
        """测试辅助:触发 DAP event。"""
        for h in self._event_handlers.get(event, []):
            h(body or {})

    async def disconnect(self) -> None:
        self.terminated = True

    @property
    def call_log(self) -> list[tuple[str, Any]]:
        return self._call_log


class MockDebugSessionManager(DebugSessionManager):
    """重写 _spawn_adapter + _create_client,用 MockDapClient 替代真实子进程。"""

    def __init__(self, mock_client: Optional[MockDapClient] = None, **kwargs: Any) -> None:
        super().__init__(**kwargs)
        self._mock_client = mock_client or MockDapClient()
        self._spawn_called = False
        self._spawn_should_fail = False

    async def _spawn_adapter(self, language: str, cwd: Optional[str] = None) -> Any:
        self._spawn_called = True
        if self._spawn_should_fail:
            raise RuntimeError("debug adapter 启动失败(可能未安装): js-debug-adapter")
        return MagicMock()  # dummy process

    def _create_client(self, process: Any) -> Any:
        return self._mock_client


def _make_manager_with_responses(
    responses: Optional[dict[str, Any]] = None,
) -> tuple[MockDebugSessionManager, MockDapClient]:
    """构造带预设响应的 MockDebugSessionManager + MockDapClient。"""
    client = MockDapClient(responses=responses)
    mgr = MockDebugSessionManager(mock_client=client)
    return mgr, client


# =============================================================================
# 1. test_launch_session
# =============================================================================


@pytest.mark.asyncio
async def test_launch_session() -> None:
    """launch 启动 debug session,返回非空 session_id。"""
    mgr, client = _make_manager_with_responses(
        responses={"launch": {"__flag": True}}
    )
    session_id = await mgr.launch(
        language="python",
        command="script.py",
        cwd="/tmp",
        stop_on_entry=True,
    )
    assert session_id is not None
    assert len(session_id) > 0
    assert session_id in mgr._sessions
    session = mgr._sessions[session_id]
    assert session.language == "python"
    assert session.status == "running"
    assert session.initialized.is_set()
    # 验证 send_request 调用了 initialize + launch
    commands = [c for c, _ in client.call_log]
    assert "initialize" in commands
    assert "launch" in commands


# =============================================================================
# 2. test_attach_session
# =============================================================================


@pytest.mark.asyncio
async def test_attach_session() -> None:
    """attach 连接到已运行的 debug adapter,返回 session_id。"""
    mgr, client = _make_manager_with_responses(
        responses={"attach": {"__flag": True}}
    )
    session_id = await mgr.attach(language="node", port=9229, host="localhost")
    assert session_id is not None
    assert session_id in mgr._sessions
    session = mgr._sessions[session_id]
    assert session.language == "node"
    assert session.status == "running"
    commands = [c for c, _ in client.call_log]
    assert "attach" in commands
    # 验证 attach 参数包含 port
    attach_call = next((a for c, a in client.call_log if c == "attach"), None)
    assert attach_call is not None
    assert attach_call["port"] == 9229
    assert attach_call["host"] == "localhost"


# =============================================================================
# 3. test_set_breakpoints
# =============================================================================


@pytest.mark.asyncio
async def test_set_breakpoints() -> None:
    """set_breakpoints 返回已验证的 breakpoint 列表。"""
    bp_response = {
        "breakpoints": [
            {"id": 1, "verified": True, "line": 10},
            {"id": 2, "verified": True, "line": 20},
            {"id": 3, "verified": False, "line": 30, "message": "unreachable"},
        ]
    }
    mgr, client = _make_manager_with_responses(
        responses={"launch": {}, "setBreakpoints": bp_response}
    )
    session_id = await mgr.launch(language="python", command="script.py")
    verified = await mgr.set_breakpoints(
        session_id,
        file="/tmp/script.py",
        lines=[
            {"line": 10},
            {"line": 20, "condition": "x > 5"},
            {"line": 30},
        ],
    )
    assert len(verified) == 3
    assert verified[0]["verified"] is True
    assert verified[0]["line"] == 10
    assert verified[1]["verified"] is True
    assert verified[2]["verified"] is False
    # 验证 session.breakpoints 已更新
    session = mgr._sessions[session_id]
    assert "/tmp/script.py" in session.breakpoints


# =============================================================================
# 4. test_continue_stopped
# =============================================================================


@pytest.mark.asyncio
async def test_continue_stopped() -> None:
    """continue 后程序暂停,收到 stopped 事件。"""
    mgr, client = _make_manager_with_responses(
        responses={"launch": {}, "continue": {}}
    )
    session_id = await mgr.launch(language="python", command="script.py")
    session = mgr._sessions[session_id]
    # 模拟已 stopped 状态(有当前线程)
    session.current_thread_id = 1
    session.status = "stopped"

    # 延迟触发 stopped 事件(让 continue_execution 先创建 waiter)
    async def emit_stopped() -> None:
        await asyncio.sleep(0.05)
        client.emit_event("stopped", {"reason": "breakpoint", "threadId": 1})

    asyncio.create_task(emit_stopped())
    result = await mgr.continue_execution(session_id)
    assert result["reason"] == "breakpoint"
    assert result["threadId"] == 1
    assert session.status == "stopped"


# =============================================================================
# 5. test_step_next
# =============================================================================


@pytest.mark.asyncio
async def test_step_next() -> None:
    """step next 后程序暂停在下一行。"""
    mgr, client = _make_manager_with_responses(
        responses={"launch": {}, "next": {}}
    )
    session_id = await mgr.launch(language="python", command="script.py")
    session = mgr._sessions[session_id]
    session.current_thread_id = 1
    session.status = "stopped"

    async def emit_stopped() -> None:
        await asyncio.sleep(0.05)
        client.emit_event("stopped", {"reason": "step", "threadId": 1})

    asyncio.create_task(emit_stopped())
    result = await mgr.step(session_id, step_type="next")
    assert result["reason"] == "step"
    assert result["threadId"] == 1
    # 验证发送了 next 请求
    commands = [c for c, _ in client.call_log]
    assert "next" in commands


# =============================================================================
# 6. test_get_stack_trace
# =============================================================================


@pytest.mark.asyncio
async def test_get_stack_trace() -> None:
    """get_stack_trace 返回 frame 列表。"""
    stack_response = {
        "stackFrames": [
            {
                "id": 100,
                "name": "main",
                "source": {"path": "/tmp/script.py"},
                "line": 15,
                "column": 1,
            },
            {
                "id": 101,
                "name": "helper",
                "source": {"path": "/tmp/script.py"},
                "line": 30,
                "column": 5,
            },
        ],
        "totalFrames": 2,
    }
    mgr, client = _make_manager_with_responses(
        responses={"launch": {}, "stackTrace": stack_response}
    )
    session_id = await mgr.launch(language="python", command="script.py")
    session = mgr._sessions[session_id]
    session.current_thread_id = 1
    session.status = "stopped"

    frames = await mgr.get_stack_trace(session_id)
    assert len(frames) == 2
    assert frames[0]["name"] == "main"
    assert frames[0]["line"] == 15
    assert frames[1]["name"] == "helper"


# =============================================================================
# 7. test_get_variables
# =============================================================================


@pytest.mark.asyncio
async def test_get_variables() -> None:
    """get_variables 返回 local scope 的变量列表。"""
    scopes_response = {
        "scopes": [
            {"name": "Locals", "variablesReference": 1000, "expensive": False},
            {"name": "Globals", "variablesReference": 1001, "expensive": True},
        ]
    }
    variables_response = {
        "variables": [
            {"name": "x", "value": "42", "type": "int", "variablesReference": 0},
            {"name": "msg", "value": '"hello"', "type": "str", "variablesReference": 0},
        ]
    }
    mgr, client = _make_manager_with_responses(
        responses={
            "launch": {},
            "scopes": scopes_response,
            "variables": variables_response,
        }
    )
    session_id = await mgr.launch(language="python", command="script.py")
    session = mgr._sessions[session_id]
    session.current_thread_id = 1
    session.status = "stopped"

    variables = await mgr.get_variables(session_id, frame_id=100, scope="local")
    assert len(variables) == 2
    assert variables[0]["name"] == "x"
    assert variables[0]["value"] == "42"
    assert variables[1]["name"] == "msg"
    # 验证调用了 scopes + variables
    commands = [c for c, _ in client.call_log]
    assert "scopes" in commands
    assert "variables" in commands


# =============================================================================
# 8. test_evaluate_expression
# =============================================================================


@pytest.mark.asyncio
async def test_evaluate_expression() -> None:
    """evaluate 返回表达式求值结果。"""
    eval_response = {
        "result": "42",
        "type": "int",
        "variablesReference": 0,
    }
    mgr, client = _make_manager_with_responses(
        responses={"launch": {}, "evaluate": eval_response}
    )
    session_id = await mgr.launch(language="python", command="script.py")
    session = mgr._sessions[session_id]
    session.current_thread_id = 1
    session.status = "stopped"

    result = await mgr.evaluate(session_id, expression="6 * 7", frame_id=100)
    assert result["result"] == "42"
    assert result["type"] == "int"
    # 验证 evaluate 参数
    eval_call = next((a for c, a in client.call_log if c == "evaluate"), None)
    assert eval_call is not None
    assert eval_call["expression"] == "6 * 7"
    assert eval_call["frameId"] == 100


# =============================================================================
# 9. test_disconnect
# =============================================================================


@pytest.mark.asyncio
async def test_disconnect() -> None:
    """disconnect 后 session 从管理器移除。"""
    mgr, _ = _make_manager_with_responses(responses={"launch": {}})
    session_id = await mgr.launch(language="python", command="script.py")
    assert session_id in mgr._sessions

    ok = await mgr.disconnect(session_id)
    assert ok is True
    assert session_id not in mgr._sessions

    # 再次 disconnect 返回 False
    ok2 = await mgr.disconnect(session_id)
    assert ok2 is False


# =============================================================================
# 10. test_list_sessions
# =============================================================================


@pytest.mark.asyncio
async def test_list_sessions() -> None:
    """list_sessions 返回所有活跃 session 摘要。"""
    mgr, _ = _make_manager_with_responses(responses={"launch": {}, "attach": {}})
    sid1 = await mgr.launch(language="python", command="a.py")
    sid2 = await mgr.attach(language="node", port=9229)

    sessions = await mgr.list_sessions()
    assert len(sessions) == 2
    ids = {s["sessionId"] for s in sessions}
    assert sid1 in ids
    assert sid2 in ids
    # 验证摘要字段
    for s in sessions:
        assert "language" in s
        assert "status" in s
        assert "startedAt" in s
        assert "lastActivityAt" in s


# =============================================================================
# 11. test_cleanup_expired
# =============================================================================


@pytest.mark.asyncio
async def test_cleanup_expired() -> None:
    """cleanup_expired 清理超时 session(无活动超过 timeout)。"""
    # 用 1 秒超时(测试用)
    mgr, _ = _make_manager_with_responses(responses={"launch": {}})
    mgr._timeout = 0  # 立即超时

    sid = await mgr.launch(language="python", command="script.py")
    assert sid in mgr._sessions

    # 手动设置 last_activity 为很久以前
    session = mgr._sessions[sid]
    session.last_activity = time.time() - 9999

    cleaned = await mgr.cleanup_expired()
    assert cleaned == 1
    assert sid not in mgr._sessions


# =============================================================================
# 12. test_concurrent_sessions
# =============================================================================


@pytest.mark.asyncio
async def test_concurrent_sessions() -> None:
    """多 session 并发 launch + list。"""
    # 每个 launch 创建独立的 mock client;这里用共享 client 测试并发性
    mgr, _ = _make_manager_with_responses(responses={"launch": {}})

    # 并发启动 5 个 session
    session_ids = await asyncio.gather(
        *[mgr.launch(language="python", command=f"script{i}.py") for i in range(5)]
    )

    assert len(session_ids) == 5
    assert len(set(session_ids)) == 5  # 全部唯一

    sessions = await mgr.list_sessions()
    assert len(sessions) == 5

    # 并发 disconnect 全部
    await asyncio.gather(*[mgr.disconnect(sid) for sid in session_ids])
    sessions = await mgr.list_sessions()
    assert len(sessions) == 0


# =============================================================================
# 13. test_launch_adapter_unavailable
# =============================================================================


@pytest.mark.asyncio
async def test_launch_adapter_unavailable() -> None:
    """adapter 不可用时 launch 抛 RuntimeError 且 session 不残留。"""
    mgr, _ = _make_manager_with_responses(responses={})
    mgr._spawn_should_fail = True

    with pytest.raises(RuntimeError, match="启动失败"):
        await mgr.launch(language="python", command="script.py")

    # session 应被清理(不残留)
    assert len(mgr._sessions) == 0


# =============================================================================
# 14. test_get_session_not_found
# =============================================================================


@pytest.mark.asyncio
async def test_get_session_not_found() -> None:
    """操作不存在的 session 报错。"""
    mgr, _ = _make_manager_with_responses(responses={})

    with pytest.raises(RuntimeError, match="不存在"):
        await mgr.set_breakpoints("nonexistent-id", "/tmp/x.py", [{"line": 1}])

    with pytest.raises(RuntimeError, match="不存在"):
        await mgr.continue_execution("nonexistent-id")


# =============================================================================
# 15. test_encode_dap_message(协议编解码)
# =============================================================================


def test_encode_dap_message() -> None:
    """encode_dap_message 生成正确的 Content-Length framing。"""
    msg = {"seq": 1, "type": "request", "command": "initialize", "arguments": {}}
    encoded = encode_dap_message(msg)
    assert b"Content-Length:" in encoded
    assert b"\r\n\r\n" in encoded
    # header 和 body 分离
    header, _, body = encoded.partition(b"\r\n\r\n")
    assert b"Content-Length:" in header
    import json as _json

    parsed = _json.loads(body.decode("utf-8"))
    assert parsed["command"] == "initialize"


# =============================================================================
# 16. test_get_variables_no_matching_scope(无匹配 scope 时返回所有)
# =============================================================================


@pytest.mark.asyncio
async def test_get_variables_no_matching_scope() -> None:
    """scope 无匹配时,返回所有 scopes 的变量合并。"""
    scopes_response = {
        "scopes": [
            {"name": "Registers", "variablesReference": 2000, "expensive": False},
        ]
    }
    variables_response = {
        "variables": [
            {"name": "rax", "value": "0x0", "type": "register"},
        ]
    }
    mgr, client = _make_manager_with_responses(
        responses={
            "launch": {},
            "scopes": scopes_response,
            "variables": variables_response,
        }
    )
    session_id = await mgr.launch(language="python", command="script.py")
    session = mgr._sessions[session_id]
    session.current_thread_id = 1
    session.status = "stopped"

    # scope='closure' 不匹配任何 scope name → 返回所有 scopes 的变量
    variables = await mgr.get_variables(
        session_id, frame_id=100, scope="closure"
    )
    assert len(variables) == 1
    assert variables[0]["name"] == "rax"


# =============================================================================
# 17. test_debug_session_to_info(DebugSession.to_info)
# =============================================================================


def test_debug_session_to_info() -> None:
    """DebugSession.to_info 返回正确的摘要字典。"""
    session = DebugSession(session_id="test-123", language="node")
    info = session.to_info()
    assert info["sessionId"] == "test-123"
    assert info["language"] == "node"
    assert info["status"] == "initializing"
    assert "startedAt" in info
    assert "lastActivityAt" in info


# =============================================================================
# 18. test_step_invalid_type(无效 stepType 报错)
# =============================================================================


@pytest.mark.asyncio
async def test_step_invalid_type() -> None:
    """无效 stepType 报错。"""
    mgr, _ = _make_manager_with_responses(responses={"launch": {}})
    session_id = await mgr.launch(language="python", command="script.py")
    session = mgr._sessions[session_id]
    session.current_thread_id = 1
    session.status = "stopped"

    with pytest.raises(RuntimeError, match="无效 stepType"):
        await mgr.step(session_id, step_type="invalidStep")
