# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""Harness 细粒度能力(2026-09-18 第六批):run_code(code-mode)单测。

覆盖(对标 Codex code-mode / V8 cell 语义):
- 代码执行 + print 捕获 + sessionId 会话化
- 全局状态跨调用持久(cell 语义)+ reset 清空
- tools.call 桥接宿主工具(tool/execute 客户端往返)+ 未知工具报错
- 代码异常不炸会话(下一调用可用)
- 超时击杀会话 + capabilities 宣告 codeMode
"""

import asyncio
from typing import Any

import pytest

from app.services.agent_engine import AgentEngine


# =============================================================================
# 夹具
# =============================================================================


class _FakeLoop:
    def __init__(self) -> None:
        self.spec: dict[str, Any] = {}

    async def run(self, messages: list[dict[str, Any]]) -> Any:
        return _SimpleResult()

    async def resume_from_checkpoint(self, checkpoint_id: str) -> Any:
        return _SimpleResult()

    async def interrupt(self, mode: str = "cancel") -> Any:
        return None


class _SimpleResult:
    success = True
    stop_reason = "end_turn"
    final_response = "done"
    iterations: list[Any] = []
    total_duration_ms = 1.0
    total_tokens_used = 123
    checkpoint_id = None
    error = None
    budget = None
    compaction_events: list[Any] = []


def _engine(**kwargs: Any):
    loops: list[_FakeLoop] = []

    async def factory(spec: dict[str, Any], host_tools: list[Any]) -> _FakeLoop:
        loop = _FakeLoop()
        loop.spec = spec
        loops.append(loop)
        return loop

    return AgentEngine(loop_factory=factory, **kwargs), loops


async def _rpc(engine: AgentEngine, method: str, params: dict[str, Any], req_id: int = 1):
    response = await engine.handle_message(
        {"jsonrpc": "2.0", "id": req_id, "method": method, "params": params}
    )
    assert response is not None and "error" not in response, response
    return response["result"]


@pytest.fixture(autouse=True)
def _mock_hook_engine(monkeypatch):
    class FakeHookEngine:
        async def emit(self, event, context):
            return []

    monkeypatch.setattr("app.services.agent_loop_v2.hook_engine", FakeHookEngine())
    monkeypatch.setattr("app.services.agent_loop_v2._approval_registry", {})
    yield {}


def _find_builtin(engine: AgentEngine, thread: Any, name: str) -> Any:
    for definition in engine._builtin_tool_definitions(thread):
        if getattr(definition, "name", "") == name:
            return definition
    raise AssertionError(f"内置工具未注入: {name}")


# =============================================================================
# run_code(code-mode)
# =============================================================================


@pytest.mark.asyncio
async def test_run_code_print_capture_and_session_persistence():
    """print 捕获返回;同 sessionId 全局状态跨调用持久(cell 语义)。"""
    engine, _ = _engine()
    started = await _rpc(engine, "thread.start", {})
    thread = engine._threads[started["threadId"]]
    tool = _find_builtin(engine, thread, "run_code")
    first = await tool.executor({"code": "x = 21\nprint('hello-code')"})
    assert first["ok"] is True
    assert "hello-code" in first["output"]
    assert first["sessionId"].startswith("cdx_")
    second = await tool.executor(
        {"code": "print(x * 2)", "sessionId": first["sessionId"]}
    )
    assert second["ok"] is True
    assert "42" in second["output"]
    assert second["sessionId"] == first["sessionId"]


@pytest.mark.asyncio
async def test_run_code_tools_bridge_host_tool_roundtrip():
    """代码内 tools.call → 宿主工具 tool/execute 往返 → 结果回传代码层。"""
    engine, _ = _engine()
    started = await _rpc(engine, "thread.start", {})
    thread = engine._threads[started["threadId"]]
    # 注入宿主工具(客户端执行语义:tool/execute → tools.result)
    await _rpc(
        engine, "tools.register",
        {"threadId": thread.thread_id, "name": "adder",
         "description": "加法器", "parameters": {"type": "object"}},
        req_id=2,
    )
    notifications: list[dict[str, Any]] = []

    async def _emit(message: dict[str, Any]) -> None:
        if message.get("method") == "tool/execute":
            notifications.append(message["params"])

    thread.emit = _emit
    tool = _find_builtin(engine, thread, "run_code")
    task = asyncio.create_task(
        tool.executor(
            {
                "code": "r = tools.call('adder', {'a': 2, 'b': 3})\n"
                "print('sum:', r['sum'])",
            }
        )
    )
    for _ in range(200):
        if notifications:
            break
        await asyncio.sleep(0.01)
    assert len(notifications) == 1
    assert notifications[0]["name"] == "adder"
    await engine.handle_message(
        {
            "jsonrpc": "2.0",
            "id": 3,
            "method": "tools.result",
            "params": {"requestId": notifications[0]["requestId"], "result": {"sum": 5}},
        }
    )
    result = await task
    assert result["ok"] is True
    assert "sum: 5" in result["output"]


@pytest.mark.asyncio
async def test_run_code_unknown_tool_and_error_recovery():
    """未知工具报错回传代码层;代码异常不炸会话(下一调用可用)。"""
    engine, _ = _engine()
    started = await _rpc(engine, "thread.start", {})
    thread = engine._threads[started["threadId"]]
    tool = _find_builtin(engine, thread, "run_code")
    bad_tool = await tool.executor(
        {"code": "try:\n    tools.call('no_such_tool')\nexcept RuntimeError as e:\n    print('caught:', e)"}
    )
    assert bad_tool["ok"] is True
    assert "caught:" in bad_tool["output"]
    # 代码异常 → ok False + 会话仍可用
    boom = await tool.executor({"code": "raise ValueError('boom-code')"})
    assert boom["ok"] is False
    assert "boom-code" in boom["error"]
    alive = await tool.executor(
        {"code": "print('still alive')", "sessionId": boom["sessionId"]}
    )
    assert alive["ok"] is True
    assert "still alive" in alive["output"]


@pytest.mark.asyncio
async def test_run_code_reset_clears_globals():
    """reset=true 清空会话全局状态。"""
    engine, _ = _engine()
    started = await _rpc(engine, "thread.start", {})
    thread = engine._threads[started["threadId"]]
    tool = _find_builtin(engine, thread, "run_code")
    first = await tool.executor({"code": "marker = 'set'"})
    reset = await tool.executor(
        {"code": "print('marker' in dir())", "sessionId": first["sessionId"], "reset": True}
    )
    assert reset.get("reset") is True
    assert "False" in reset["output"]


@pytest.mark.asyncio
async def test_run_code_timeout_kills_session():
    """长任务超时 → 会话被击杀并返回明确错误。"""
    engine, _ = _engine()
    started = await _rpc(engine, "thread.start", {})
    thread = engine._threads[started["threadId"]]
    tool = _find_builtin(engine, thread, "run_code")
    result = await tool.executor(
        {"code": "import time; time.sleep(6)", "timeoutMs": 1000}
    )
    assert "超时" in result["error"]
    # 会话已被移除,旧 sessionId 不可续用
    ghost = await tool.executor(
        {"code": "print(1)", "sessionId": result.get("sessionId", "cdx_ghost")}
    )
    assert "不存在" in ghost["error"]


@pytest.mark.asyncio
async def test_run_code_capabilities_and_empty_code():
    """capabilities 宣告 codeMode;空 code 拒绝。"""
    engine, _ = _engine()
    caps = (await _rpc(engine, "engine.initialize", {}))["capabilities"]
    assert caps["codeMode"] is True
    started = await _rpc(engine, "thread.start", {})
    thread = engine._threads[started["threadId"]]
    tool = _find_builtin(engine, thread, "run_code")
    assert "非空" in (await tool.executor({"code": "   "}))["error"]
    assert "error" in (await tool.executor({}))
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
