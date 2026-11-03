# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""差距⑦「执行体与授权面分离」补齐回归(2026-10-30)。

参照 Qoder 逆向纪律(补完报告 §2.3/§3.2,对比报告 §3-7):
  ① node-repl moduleRoots 白名单 → IHUI 对位:unified_exec 的 cwd 工具参数
     必须落在执行根白名单内(与 mcp_server run_command 的 cwd 校验同一把尺子);
  ② 宿主注入上下文不可被工具参数覆盖 → IHUI 对位:run_command 子进程 env
     出口剥离 NON_INHERITABLE_ENV_VARS 与注入型前缀(LD_PRELOAD/LD_AUDIT/DYLD_*),
     继承值与用户 override 同判;user_env 缺省不再裸继承 os.environ。

纯判据 + 受控临时目录,不起服务、不碰 DB/Redis(§5 测试隔离铁律)。
"""

from __future__ import annotations

import os
from pathlib import Path
from typing import Any

import pytest

from app.core.exec_env import (
    INJECTION_ENV_PREFIXES,
    is_injection_env_var,
    scrub_injection_env_vars,
    scrub_non_inheritable_env_vars,
)
from app.services.agent_engine import AgentEngine, _sanitized_child_env
from app.services.mcp_server import _build_subprocess_env

# ============================================================================
# ①执行根白名单:unified_exec 的 cwd 参数
# ============================================================================


class _FakeLoopG7:
    success = True
    stop_reason = "end_turn"
    final_response = "done"
    iterations: list[Any] = []
    total_duration_ms = 1.0
    total_tokens_used = 1
    checkpoint_id = None
    error = None
    budget = None
    compaction_events: list[Any] = []

    async def run(self, messages):
        return self

    async def resume_from_checkpoint(self, checkpoint_id):
        return self

    async def interrupt(self, mode="cancel"):
        return None


def _engine_g7() -> AgentEngine:
    async def factory(spec, host_tools):
        return _FakeLoopG7()

    return AgentEngine(loop_factory=factory)


async def _rpc_g7(engine: AgentEngine, method: str, params: dict[str, Any]) -> dict[str, Any]:
    response = await engine.handle_message(
        {"jsonrpc": "2.0", "id": 1, "method": method, "params": params}
    )
    assert response is not None and "error" not in response, response
    return response["result"]


def _find_builtin_g7(engine: AgentEngine, thread: Any, name: str) -> Any:
    for definition in engine._builtin_tool_definitions(thread):
        if getattr(definition, "name", "") == name:
            return definition
    raise AssertionError(f"内置工具未注入: {name}")


async def _cleanup_exec_sessions(engine: AgentEngine) -> None:
    for sid in list(engine._exec_sessions):
        session = engine._exec_sessions.pop(sid, None)
        if session is None:
            continue
        proc = session["proc"]
        if proc.returncode is None:
            with __import__("contextlib").suppress(Exception):
                proc.kill()
                await proc.wait()


@pytest.fixture()
def _workspace_roots(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> tuple[Path, Path]:
    """受控执行根:ws 在白名单内,outside 刻意不在。"""
    ws = tmp_path / "ws"
    ws.mkdir()
    outside = tmp_path / "outside"
    outside.mkdir()
    monkeypatch.setenv("MCP_WORKSPACE_ROOTS", str(ws))
    return ws, outside


@pytest.mark.asyncio
async def test_g7_1_unified_exec_拒绝白名单外cwd_不产生会话(_workspace_roots) -> None:
    _ws, outside = _workspace_roots
    engine = _engine_g7()
    started = await _rpc_g7(engine, "thread.start", {})
    thread = engine._threads[started["threadId"]]
    tool = _find_builtin_g7(engine, thread, "unified_exec")
    result = await tool.executor({"command": "echo hi", "cwd": str(outside)})
    assert isinstance(result, dict) and "error" in result
    assert result.get("errorCode") == "PATH_NOT_ALLOWED"
    # 反向对照:被拒的调用不得留下常驻 shell 会话(执行面零逃逸)
    assert engine._exec_sessions == {}


@pytest.mark.asyncio
async def test_g7_2_unified_exec_白名单内cwd放行且归一(_workspace_roots) -> None:
    ws, _outside = _workspace_roots
    engine = _engine_g7()
    started = await _rpc_g7(engine, "thread.start", {})
    thread = engine._threads[started["threadId"]]
    tool = _find_builtin_g7(engine, thread, "unified_exec")
    sub = ws / "sub"  # 白名单根内的子目录
    sub.mkdir()
    try:
        result = await tool.executor({"command": "echo gap7", "cwd": str(sub), "timeoutMs": 1500})
        assert isinstance(result, dict)
        assert result.get("errorCode") != "PATH_NOT_ALLOWED"
        assert "error" not in result or "白名单" not in str(result.get("error"))
        # 会话记录的 cwd 是解析归一后的绝对路径,而非模型原文
        assert len(engine._exec_sessions) == 1
        session = next(iter(engine._exec_sessions.values()))
        assert Path(session["cwd"]).resolve() == sub.resolve()
    finally:
        await _cleanup_exec_sessions(engine)


@pytest.mark.asyncio
async def test_g7_3_线程工作区是宿主注入根_模型cwd只能收窄不能逃逸(
    _workspace_roots, tmp_path: Path
) -> None:
    _ws, _outside = _workspace_roots
    host_ws = tmp_path / "host-ws"
    host_ws.mkdir()
    engine = _engine_g7()
    started = await _rpc_g7(engine, "thread.start", {"workspace": str(host_ws)})
    thread = engine._threads[started["threadId"]]
    tool = _find_builtin_g7(engine, thread, "unified_exec")
    try:
        # 宿主侧线程工作区内:放行(即便不在进程级 MCP_WORKSPACE_ROOTS 里)
        inside = await tool.executor({"command": "echo gap7", "cwd": str(host_ws), "timeoutMs": 1500})
        assert inside.get("errorCode") != "PATH_NOT_ALLOWED"
        assert "error" not in inside or "白名单" not in str(inside.get("error"))
        # 借 .. 逃逸到工作区外:拒绝(归一在包含性判定之前完成)
        escape = await tool.executor(
            {"command": "echo gap7", "cwd": str(host_ws / ".." / "..")}
        )
        assert escape.get("errorCode") == "PATH_NOT_ALLOWED"
    finally:
        await _cleanup_exec_sessions(engine)


# ============================================================================
# ②宿主注入上下文不可被工具参数覆盖:子进程 env 消毒
# ============================================================================


def test_g7_4_exec_env_注入型前缀判据() -> None:
    assert INJECTION_ENV_PREFIXES == ("LD_PRELOAD", "LD_AUDIT", "DYLD_")
    assert is_injection_env_var("LD_PRELOAD")
    assert is_injection_env_var("ld_audit")  # 大小写不敏感
    assert is_injection_env_var("DYLD_INSERT_LIBRARIES")
    assert not is_injection_env_var("PATH")
    assert not is_injection_env_var("PYTHONPATH")
    scrubbed = scrub_injection_env_vars(
        {"LD_PRELOAD": "/evil.so", "DYLD_FOO": "x", "PATH": "/bin"}
    )
    assert set(scrubbed) == {"PATH"}


def test_g7_5_build_subprocess_env_剥继承的管理凭据与注入变量(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("IHUI_ADMIN_PASSWORD", "s3cret")
    monkeypatch.setenv("LD_PRELOAD", "/evil.so")
    env = _build_subprocess_env(None)
    assert "IHUI_ADMIN_PASSWORD" not in env
    assert "LD_PRELOAD" not in env
    # 反向对照:普通变量原样保留
    assert env.get("PATH") == os.environ.get("PATH")


def test_g7_6_build_subprocess_env_工具参数盖不回被剥的键() -> None:
    env = _build_subprocess_env(
        {
            "IHUI_ADMIN_PASSWORD": "override",
            "NODE_REPL_AUTH_TOKEN": "override",
            "LD_PRELOAD": "/evil.so",
            "DYLD_INSERT_LIBRARIES": "/evil.dylib",
            "MY_OK": "1",
        }
    )
    for banned in (
        "IHUI_ADMIN_PASSWORD",
        "NODE_REPL_AUTH_TOKEN",
        "LD_PRELOAD",
        "DYLD_INSERT_LIBRARIES",
    ):
        assert banned not in env, f"工具参数不得把 {banned} 塞回子进程"
    assert env["MY_OK"] == "1"


def test_g7_7_sanitized_child_env_与_mcp_出口同尺(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """agent_engine 与 mcp_server 两个执行面必须落在同一判据源上(不造第二套)。"""
    monkeypatch.setenv("IHUI_ADMIN_PASSWORD", "s3cret")
    monkeypatch.setenv("LD_AUDIT", "/evil.so")
    child = _sanitized_child_env()
    assert "IHUI_ADMIN_PASSWORD" not in child
    assert "LD_AUDIT" not in child
    mcp = _build_subprocess_env(None)
    assert set(child) == set(mcp)  # 同一把尺子:两个出口的键集一致


def test_g7_8_scrub_non_inheritable_大小写不敏感全剥() -> None:
    env = scrub_non_inheritable_env_vars(
        {"IHUI_ADMIN_PASSWORD": "x", "ihui_admin_password": "y", "SAFE": "1"}
    )
    assert set(env) == {"SAFE"}
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
