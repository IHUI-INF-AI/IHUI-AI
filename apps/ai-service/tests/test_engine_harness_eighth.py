# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""Harness 安全与工具剩余面(2026-09-18 第八批)单测。

覆盖(对标 Codex execpolicy 内核沙箱 + web_search 内置工具):
- proc_sandbox:Windows Job Object 应用成功 / 非 Windows 与句柄缺失降级
- run_code / unified_exec 会话创建后带 sandbox 字段
- web_search 内置工具:注入/空参拒绝/真实搜索降级
- capabilities 宣告 procSandbox
"""

import asyncio
import os
import sys
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
    monkeypatch.setenv("AGENT_ENGINE_PERSIST", "off")

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
# proc_sandbox(Job Object)
# =============================================================================


def _spawn_dummy():
    async def _go():
        return await asyncio.create_subprocess_exec(
            sys.executable,
            "-I",
            "-c",
            "import time; time.sleep(3); print('done')",
            stdout=asyncio.subprocess.PIPE,
        )

    loop = asyncio.new_event_loop()
    try:
        return loop.run_until_complete(_go())
    finally:
        loop.close()


@pytest.mark.asyncio
async def test_sandbox_applies_to_real_subprocess():
    """真实子进程应用 Job Object 沙箱:Windows 上 active=True;失败有 reason。"""
    from app.core.proc_sandbox import apply_job_sandbox

    proc = await asyncio.create_subprocess_exec(
        sys.executable,
        "-I",
        "-c",
        "print('alive')",
        stdout=asyncio.subprocess.PIPE,
    )
    try:
        info = apply_job_sandbox(proc)
        if os.name == "nt":
            assert info["active"] is True, info
            assert info["killOnClose"] is True
            assert info["memoryLimit"] > 0
            assert info["activeProcessLimit"] >= 1
        else:
            assert info["active"] is False and "non-windows" in info["reason"]
        # 子进程本身不受沙箱影响,照常退出
        out, _ = await asyncio.wait_for(proc.communicate(), timeout=10)
        assert b"alive" in out
    finally:
        if proc.returncode is None:
            proc.kill()


@pytest.mark.asyncio
async def test_sandbox_degrades_without_handle():
    """句柄不可用时静默降级(active=False + reason),绝不抛异常。"""
    from app.core.proc_sandbox import apply_job_sandbox

    class _FakeProc:
        _handle = None

    info = apply_job_sandbox(_FakeProc())
    assert info["active"] is False
    assert "reason" in info


# =============================================================================
# run_code / unified_exec 沙箱接线
# =============================================================================


@pytest.mark.asyncio
async def test_run_code_session_carries_sandbox():
    """run_code 新会话携带 sandbox 字段,执行结果正常。"""
    engine, _ = _engine()
    started = await _rpc(engine, "thread.start", {})
    thread = engine._threads[started["threadId"]]
    tool = _find_builtin(engine, thread, "run_code")
    result = await tool.executor({"code": "print('sbx')"})
    assert result["ok"] is True
    assert "sbx" in result["output"]
    session = engine._code_sessions[result["sessionId"]]
    assert "sandbox" in session
    if os.name == "nt":
        assert session["sandbox"]["active"] is True
    # 会话仍可用
    second = await tool.executor(
        {"code": "print(1+1)", "sessionId": result["sessionId"]}
    )
    assert second["ok"] is True and "2" in second["output"]


@pytest.mark.asyncio
async def test_unified_exec_session_carries_sandbox():
    """unified_exec 新 shell 会话携带 sandbox 字段。"""
    engine, _ = _engine()
    started = await _rpc(engine, "thread.start", {})
    thread = engine._threads[started["threadId"]]
    tool = _find_builtin(engine, thread, "unified_exec")
    result = await tool.executor({"command": "echo sandbox-probe"})
    assert "error" not in result, result
    sid = result.get("sessionId")
    assert sid, result
    session = engine._exec_sessions[sid]
    assert "sandbox" in session
    if os.name == "nt":
        assert session["sandbox"]["active"] is True


# =============================================================================
# web_search 内置工具
# =============================================================================


@pytest.mark.asyncio
async def test_web_search_builtin_registered_and_gated():
    """web_search 进内置工具表;denyTools 可剔除。"""
    engine, _ = _engine()
    started = await _rpc(engine, "thread.start", {})
    thread = engine._threads[started["threadId"]]
    names = {
        getattr(d, "name", "")
        for d in engine._builtin_tool_definitions(thread)
    }
    assert "web_search" in names
    started2 = await _rpc(
        engine, "thread.start", {"denyTools": ["web_search"]}, req_id=2
    )
    thread2 = engine._threads[started2["threadId"]]
    names2 = {
        getattr(d, "name", "")
        for d in engine._builtin_tool_definitions(thread2)
    }
    assert "web_search" not in names2


@pytest.mark.asyncio
async def test_web_search_rejects_empty_query():
    """空 query 直接拒绝。"""
    engine, _ = _engine()
    started = await _rpc(engine, "thread.start", {})
    thread = engine._threads[started["threadId"]]
    tool = _find_builtin(engine, thread, "web_search")
    result = await tool.executor({"query": "  "})
    assert "error" in result


@pytest.mark.asyncio
async def test_web_search_degrades_on_network_failure(monkeypatch):
    """底层搜索抛错 → 返回 error + 空 results,不炸会话。"""
    async def _boom(args):
        raise RuntimeError("network down")

    monkeypatch.setattr("app.services.mcp_server._tool_web_search", _boom)
    engine, _ = _engine()
    started = await _rpc(engine, "thread.start", {})
    thread = engine._threads[started["threadId"]]
    tool = _find_builtin(engine, thread, "web_search")
    result = await tool.executor({"query": "test"})
    assert "network down" in result["error"]
    assert result["results"] == []


@pytest.mark.asyncio
async def test_web_search_real_query_returns_results():
    """真实搜索冒烟:无网络/被限流时降级为空结果(不断言必有结果)。"""
    engine, _ = _engine()
    started = await _rpc(engine, "thread.start", {})
    thread = engine._threads[started["threadId"]]
    tool = _find_builtin(engine, thread, "web_search")
    result = await tool.executor({"query": "python asyncio", "maxResults": 3})
    assert "error" not in result or "results" in result
    assert isinstance(result.get("results", []), list)


# =============================================================================
# capabilities
# =============================================================================


@pytest.mark.asyncio
async def test_capabilities_declare_proc_sandbox():
    """initialize 握手宣告 procSandbox。"""
    engine, _ = _engine()
    caps = await _rpc(engine, "engine.initialize", {}, req_id=1)
    assert caps["capabilities"]["procSandbox"] is True
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
