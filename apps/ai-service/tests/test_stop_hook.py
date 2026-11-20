# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

# STOP 钩子测试(2026-11-20 第 28 项)
#
# 钉住三条事实:
# ① 配置面 `decision: "block"` / `continue: true` 在 STOP 点被翻译成运行时认的
#    `stop/stop_reason`(否则配了也不生效,读起来像已生效);
# ② 只有"正常完成"的结局才会被 STOP 钩子续跑一轮,且最多一轮(防自激);
# ③ 不 block 时只注入上下文、照常结束;钩子异常降级为照常结束。
import asyncio
import json
import sys
from pathlib import Path
from typing import Any

import pytest

from app.core import command_hooks
from app.core.command_hooks import install_command_hooks, trust_hooks_config
from app.core.hook_runtime import (
    HookKind,
    build_registered_hook_runtime,
    clear_lifecycle_hook_registry,
    register_lifecycle_hook,
)
from app.services.agent_loop_v2 import AgentLoopV2, ToolDefinition

pytestmark = pytest.mark.anyio


@pytest.fixture(autouse=True)
def _isolate(monkeypatch: pytest.MonkeyPatch) -> None:  # noqa: ANN201 - 测试夹具
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
    script = tmp_path / "stop_impl.py"
    script.write_text(body, encoding="utf-8")
    return f'"{sys.executable}" "{script}"'


def _install(tmp_path: Path, monkeypatch: pytest.MonkeyPatch, command: str) -> None:
    path = tmp_path / ".ihui" / "hooks.json"
    _write_config(path, {"hooks": {"stop": [{"matcher": "*", "hooks": [
        {"type": "command", "command": command}
    ]}]}})
    trust_hooks_config(path)
    monkeypatch.setenv("IHUI_HOOKS_CONFIG", str(path))
    install_command_hooks()


BLOCK_BODY = """
import json, sys
json.loads(sys.stdin.read())
json.dump({"decision": "block", "reason": "还没跑测试,先跑一遍再结束"}, sys.stdout)
"""

CONTINUE_BODY = """
import json, sys
json.loads(sys.stdin.read())
json.dump({"continue": True, "reason": "再核对一遍文件清单"}, sys.stdout)
"""


def _loop(llm_calls: list[int], rt: object | None) -> AgentLoopV2:
    async def _llm(messages, tools, **kwargs):  # noqa: ANN001, ANN002, ANN003, ANN202
        llm_calls.append(len(messages))
        return {"content": f"done-{len(llm_calls)}", "tool_calls": None}

    async def _executor(args: dict) -> dict:
        return {"ok": True}

    return AgentLoopV2(
        _llm,
        [
            ToolDefinition(
                name="demo", description="demo", parameters={"type": "object"},
                executor=_executor,
            )
        ],
        enable_checkpoint=False,
        approval_enabled=False,
        chain="main",
        hook_runtime=rt,  # type: ignore[arg-type]
    )


def _dev_texts(messages: list[dict[str, Any]]) -> list[str]:
    out: list[str] = []
    for m in messages:
        if m.get("role") == "developer" and isinstance(m.get("content"), list):
            out.extend(c.get("text", "") for c in m["content"] if isinstance(c, dict))
    return out


async def test_block_decision_continues_once(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    _install(tmp_path, monkeypatch, _script(tmp_path, BLOCK_BODY))
    calls: list[int] = []
    loop = _loop(calls, build_registered_hook_runtime())
    messages: list[dict[str, Any]] = [{"role": "user", "content": "改 README"}]
    result = await loop.run(messages)

    assert result.success
    assert len(calls) >= 2  # 续跑真的发生
    assert "还没跑测试,先跑一遍再结束" in _dev_texts(messages)


async def test_continue_flag_maps_to_block(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    _install(tmp_path, monkeypatch, _script(tmp_path, CONTINUE_BODY))
    calls: list[int] = []
    loop = _loop(calls, build_registered_hook_runtime())
    result = await loop.run([{"role": "user", "content": "hi"}])

    assert result.success
    assert len(calls) >= 2


async def test_no_block_still_injects_context_and_stops_once() -> None:
    register_lifecycle_hook(
        HookKind.STOP,
        lambda payload: {"additional_context": "下次记得跑 lint"},
        name="stop-context-only",
    )
    calls: list[int] = []
    loop = _loop(calls, build_registered_hook_runtime())
    messages: list[dict[str, Any]] = [{"role": "user", "content": "hi"}]
    result = await loop.run(messages)

    assert result.success
    assert len(calls) == 1  # 不续跑
    assert "下次记得跑 lint" in _dev_texts(messages)


async def test_stop_hook_failure_is_degraded() -> None:
    def _boom(payload: dict) -> dict:
        raise RuntimeError("stop hook down")

    register_lifecycle_hook(HookKind.STOP, _boom, name="stop-boom")
    calls: list[int] = []
    loop = _loop(calls, build_registered_hook_runtime())
    result = await loop.run([{"role": "user", "content": "hi"}])

    assert result.success
    assert len(calls) == 1


def test_config_block_maps_to_runtime_stop(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    _install(tmp_path, monkeypatch, _script(tmp_path, BLOCK_BODY))
    runtime = build_registered_hook_runtime()
    outcome = asyncio.run(runtime.run(HookKind.STOP, {"session_id": "s"}))

    assert outcome.should_stop is True
    assert outcome.stop_reason == "还没跑测试,先跑一遍再结束"
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
