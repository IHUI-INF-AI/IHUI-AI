# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

# 会话入口生命周期钩子测试(2026-11-20 第 27 项)
#
# 钉住三条事实:
# ① SESSION_START / USER_PROMPT_SUBMIT 两个 HookKind 此前只有契约没有挂载点:
#    `.ihui/hooks.json` 里配了也不会执行 —— 本批接进 run() 入口;
# ② 钩子给出的 additionalContext 真的进消息流(developer 消息,截断 4000);
# ③ 钩子抛错 / 零钩子时,会话启动与主循环行为零变化(降级不阻断)。
from __future__ import annotations

from typing import Any

import pytest

from app.core.hook_runtime import (
    HookKind,
    build_registered_hook_runtime,
    clear_lifecycle_hook_registry,
    register_lifecycle_hook,
)
from app.services.agent_loop_v2 import AgentLoopV2, ToolDefinition
from app.services.hook_engine import HookEngine

pytestmark = pytest.mark.anyio


@pytest.fixture(autouse=True)
def _clean_registry():  # noqa: ANN201 - 测试夹具
    clear_lifecycle_hook_registry()
    yield
    clear_lifecycle_hook_registry()


async def _noop_llm(messages, tools, **kwargs):  # noqa: ANN001, ANN002, ANN003, ANN202
    return {"content": "done", "tool_calls": None}


def _loop(rt: object | None) -> AgentLoopV2:
    async def _executor(args: dict) -> dict:
        return {"ok": True}

    return AgentLoopV2(
        _noop_llm,
        [
            ToolDefinition(
                name="demo",
                description="demo",
                parameters={"type": "object"},
                executor=_executor,
            )
        ],
        enable_checkpoint=False,
        approval_enabled=False,
        chain="main",
        hook_runtime=rt,  # type: ignore[arg-type]
    )


def _developer_texts(messages: list[dict[str, Any]]) -> list[str]:
    out: list[str] = []
    for m in messages:
        if m.get("role") != "developer":
            continue
        content = m.get("content")
        if isinstance(content, list):
            out.extend(c.get("text", "") for c in content if isinstance(c, dict))
        elif isinstance(content, str):
            out.append(content)
    return out


async def test_session_start_context_lands_in_messages() -> None:
    register_lifecycle_hook(
        HookKind.SESSION_START,
        lambda payload: {"additional_context": "项目规范:提交前必须跑 ruff"},
        name="entry-session",
    )
    loop = _loop(build_registered_hook_runtime())
    messages: list[dict[str, Any]] = [{"role": "user", "content": "hi"}]
    result = await loop.run(messages)

    assert result.success
    assert "项目规范:提交前必须跑 ruff" in _developer_texts(messages)


async def test_user_prompt_submit_receives_prompt_and_injects_context() -> None:
    seen: list[str] = []

    def _hook(payload: dict) -> dict:
        seen.append(str(payload.get("prompt", "")))
        assert payload["cwd"]  # 入口钩子能拿到工作目录(项目规范类钩子需要它)
        return {"additional_context": "本仓库使用 pnpm,不要用 npm"}

    register_lifecycle_hook(HookKind.USER_PROMPT_SUBMIT, _hook, name="entry-prompt")
    loop = _loop(build_registered_hook_runtime())
    messages: list[dict[str, Any]] = [{"role": "user", "content": "改一下 README"}]
    result = await loop.run(messages)

    assert result.success
    assert seen == ["改一下 README"]
    assert "本仓库使用 pnpm,不要用 npm" in _developer_texts(messages)


async def test_zero_hooks_leave_messages_untouched() -> None:
    loop = _loop(None)
    messages: list[dict[str, Any]] = [{"role": "user", "content": "hi"}]
    before = len(messages)
    result = await loop.run(messages)

    assert result.success
    assert _developer_texts(messages) == []
    assert len(messages) >= before


async def test_hook_failure_does_not_block_session() -> None:
    def _boom(payload: dict) -> dict:
        raise RuntimeError("hook down")

    register_lifecycle_hook(HookKind.SESSION_START, _boom, name="entry-boom")
    loop = _loop(build_registered_hook_runtime())
    messages: list[dict[str, Any]] = [{"role": "user", "content": "hi"}]
    result = await loop.run(messages)

    assert result.success  # 失败隔离,不阻断
    assert _developer_texts(messages) == []


async def test_entry_hook_run_is_visible_on_sse(monkeypatch: pytest.MonkeyPatch) -> None:
    seen: list[tuple[str, dict[str, Any]]] = []

    def _fake_publish(self: HookEngine, event: str, payload: dict[str, Any]) -> None:
        seen.append((event, dict(payload)))

    monkeypatch.setattr(HookEngine, "publish_observation", _fake_publish)
    register_lifecycle_hook(
        HookKind.SESSION_START,
        lambda payload: {"additional_context": "x"},
        name="entry-visible",
    )
    loop = _loop(build_registered_hook_runtime())
    result = await loop.run([{"role": "user", "content": "hi"}])

    assert result.success
    names = [h["name"] for e, p in seen if e == "hook.run" for h in p["hooks"]]
    assert "entry-visible" in names
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
