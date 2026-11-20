# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""POST_TOOL_USE 产出改写面(updatedMCPToolOutput)的接线锁。

钉住三条:
1. 命令钩子把 ``hookSpecificOutput.updatedMCPToolOutput`` 映射成运行时的
   ``updated_output``;
2. 运行时的"未提供"用哨兵区分,显式 ``null`` 是合法的"抹掉结果";
3. 循环消费端 ``_run_post_tool_hooks`` 真的替换 ``ToolResult.result`` 并注入
   ``additionalContext``,且无 POST 钩子时逐零等价。
"""

from __future__ import annotations

import asyncio
import json
import sys
from pathlib import Path
from types import SimpleNamespace

import pytest

from app.core import command_hooks
from app.core.command_hooks import install_command_hooks, trust_hooks_config
from app.core.hook_runtime import (
    NO_UPDATED_OUTPUT,
    HookKind,
    build_registered_hook_runtime,
    clear_lifecycle_hook_registry,
)
from app.services.agent_loop_v2 import AgentLoopV2, ToolCall, ToolResult

pytestmark = pytest.mark.anyio


@pytest.fixture(autouse=True)
def _isolate(monkeypatch: pytest.MonkeyPatch) -> None:
    command_hooks._INSTALLED.clear()
    clear_lifecycle_hook_registry()
    monkeypatch.delenv("IHUI_HOOKS_CONFIG", raising=False)
    yield
    command_hooks._INSTALLED.clear()
    clear_lifecycle_hook_registry()


def _write_config(path: Path, payload: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, ensure_ascii=False), encoding="utf-8")


def _script(tmp_path: Path, body: str) -> str:
    script = tmp_path / "hook_impl.py"
    script.write_text(body, encoding="utf-8")
    return f'"{sys.executable}" "{script}"'


REWRITE_BODY = """
import json, sys
json.loads(sys.stdin.read())
json.dump({"hookSpecificOutput": {"hookEventName": "PostToolUse",
           "updatedMCPToolOutput": {"rewritten": True},
           "additionalContext": "产出已脱敏"}}, sys.stdout)
"""

NULL_BODY = """
import json, sys
json.loads(sys.stdin.read())
json.dump({"hookSpecificOutput": {"hookEventName": "PostToolUse",
           "updatedMCPToolOutput": None}}, sys.stdout)
"""

SILENT_BODY = """
import json, sys
json.loads(sys.stdin.read())
sys.exit(0)
"""


def _install(tmp_path: Path, monkeypatch: pytest.MonkeyPatch, command: str) -> None:
    path = tmp_path / ".ihui" / "hooks.json"
    _write_config(path, {"hooks": {"post_tool_use": [{"matcher": "*", "hooks": [
        {"type": "command", "command": command}
    ]}]}})
    trust_hooks_config(path)
    monkeypatch.setenv("IHUI_HOOKS_CONFIG", str(path))
    install_command_hooks()


def _stub(runtime: object) -> SimpleNamespace:
    async def _pass(coro: object) -> object:
        return await coro  # type: ignore[misc]

    return SimpleNamespace(
        _hook_runtime=runtime, _messages=[], _session_id="s", _wait_interruptible=_pass
    )


def test_command_hook_maps_updated_output(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    _install(tmp_path, monkeypatch, _script(tmp_path, REWRITE_BODY))
    runtime = build_registered_hook_runtime()
    outcome = asyncio.run(runtime.run(HookKind.POST_TOOL_USE, {"tool_name": "write_file"}))
    assert outcome.updated_output == {"rewritten": True}
    assert outcome.additional_contexts == ["产出已脱敏"]


def test_explicit_null_is_a_real_replacement(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    _install(tmp_path, monkeypatch, _script(tmp_path, NULL_BODY))
    runtime = build_registered_hook_runtime()
    outcome = asyncio.run(runtime.run(HookKind.POST_TOOL_USE, {"tool_name": "read_file"}))
    assert outcome.updated_output is None
    assert outcome.updated_output is not NO_UPDATED_OUTPUT


def test_silent_hook_leaves_sentinel(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    _install(tmp_path, monkeypatch, _script(tmp_path, SILENT_BODY))
    runtime = build_registered_hook_runtime()
    outcome = asyncio.run(runtime.run(HookKind.POST_TOOL_USE, {"tool_name": "read_file"}))
    assert outcome.updated_output is NO_UPDATED_OUTPUT


def test_consumer_rewrites_result_and_injects_context(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    _install(tmp_path, monkeypatch, _script(tmp_path, REWRITE_BODY))
    runtime = build_registered_hook_runtime()
    stub = _stub(runtime)
    tc = ToolCall(id="c1", name="write_file", args={"path": "a.ts"})
    tr = ToolResult(tool_call_id="c1", name="write_file", result={"ok": True})
    out = asyncio.run(AgentLoopV2._run_post_tool_hooks(stub, tc, tr))
    assert out.result == {"rewritten": True}
    assert stub._messages[-1]["role"] == "developer"
    assert "产出已脱敏" in stub._messages[-1]["content"][0]["text"]


def test_consumer_zero_change_without_hooks() -> None:
    stub = _stub(None)
    tc = ToolCall(id="c2", name="read_file", args={})
    tr = ToolResult(tool_call_id="c2", name="read_file", result={"content": "x"})
    out = asyncio.run(AgentLoopV2._run_post_tool_hooks(stub, tc, tr))
    assert out is tr and out.result == {"content": "x"}
    assert stub._messages == []
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
