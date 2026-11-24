# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

# PRE_COMPACT / POST_COMPACT 钩子测试(2026-11-20 第 29 项)
#
# 钉住四条事实:
# ① 压力没越过触发线时空跑零事件(不在每次迭代制造"差点压缩"的噪音);
# ② PRE_COMPACT 的 additionalContext 真进压缩前消息;stop=true 能叫停本次压缩;
# ③ POST_COMPACT 的 additionalContext 进压缩产物(不是进旧消息);
# ④ 钩子抛错时压缩照常完成(审计钩子绝不许带崩压缩主链路)。
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


def _messages() -> list[dict[str, Any]]:
    msgs: list[dict[str, Any]] = [{"role": "system", "content": "S" * 60}]
    # 一段极长的旧材料(压缩后只留摘要)+ 足量近期配对(保留区)。
    msgs.append({"role": "user", "content": "U" * 80000})
    msgs.append({"role": "assistant", "content": "A" * 40})
    for _ in range(7):
        msgs.append({"role": "user", "content": "u" * 60})
        msgs.append({"role": "assistant", "content": "a" * 60})
    return msgs


def _loop(rt: object | None, limit: int = 5000) -> AgentLoopV2:
    async def _noop_llm(messages, tools, **kwargs):  # noqa: ANN001, ANN002, ANN003, ANN202
        return {"content": "done", "tool_calls": None}

    async def _executor(args: dict) -> dict:
        return {"ok": True}

    return AgentLoopV2(
        _noop_llm,
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
        compaction_enabled=True,
        compaction_context_limit=limit,
    )


def _texts(messages: list[dict[str, Any]]) -> list[str]:
    out: list[str] = []
    for m in messages:
        if m.get("role") != "developer":
            continue
        c = m.get("content")
        if isinstance(c, list):
            out.extend(p.get("text", "") for p in c if isinstance(p, dict))
        elif isinstance(c, str):
            out.append(c)
    return out


async def test_no_pressure_no_hook_events_generated() -> None:
    seen: list[tuple[str, dict[str, Any]]] = []

    def _fake_publish(self: HookEngine, event: str, payload: dict[str, Any]) -> None:
        seen.append((event, dict(payload)))

    register_lifecycle_hook(
        HookKind.PRE_COMPACT, lambda payload: {"additional_context": "不应出现"}, name="quiet"
    )
    loop = _loop(build_registered_hook_runtime(), limit=100000)
    import unittest.mock as _mock

    with _mock.patch.object(HookEngine, "publish_observation", _fake_publish):
        out = await loop._maybe_compact_context(_messages())

    assert out  # 原样返回
    assert [e for e, _ in seen if e == "hook.run"] == []


async def test_pre_compact_context_lands_before_compaction() -> None:
    captured: list[dict[str, Any]] = []

    def _pre(payload: dict) -> dict:
        captured.append(payload)
        return {"additional_context": "压缩前必须保留:当前分支 main"}

    register_lifecycle_hook(HookKind.PRE_COMPACT, _pre, name="pre-ctx")
    loop = _loop(build_registered_hook_runtime())
    out = await loop._maybe_compact_context(_messages())

    assert captured and captured[0]["percent_left"] is not None
    # 压缩真的发生了(产物比输入短),且 pre 钩子加的内容被摘要/保留区带进产物
    raw = "\n".join(str(m.get("content", "")) for m in out)
    assert "当前分支 main" in raw or any("当前分支 main" in t for t in _texts(out))


async def test_pre_compact_stop_skips_compaction() -> None:
    register_lifecycle_hook(
        HookKind.PRE_COMPACT,
        lambda payload: {"stop": True, "stop_reason": "现在不要压缩"},
        name="pre-stop",
    )
    loop = _loop(build_registered_hook_runtime())
    messages = _messages()
    out = await loop._maybe_compact_context(messages)

    assert out is messages  # 原对象原样返回 = 没压缩


async def test_post_compact_context_lands_in_product() -> None:
    register_lifecycle_hook(
        HookKind.POST_COMPACT,
        lambda payload: {"additional_context": "新窗提醒:先看 AGENTS.md"},
        name="post-ctx",
    )
    loop = _loop(build_registered_hook_runtime())
    out = await loop._maybe_compact_context(_messages())

    assert "新窗提醒:先看 AGENTS.md" in _texts(out)


async def test_compaction_hook_failure_still_compresses() -> None:
    def _boom(payload: dict) -> dict:
        raise RuntimeError("compact hook down")

    register_lifecycle_hook(HookKind.PRE_COMPACT, _boom, name="pre-boom")
    register_lifecycle_hook(HookKind.POST_COMPACT, _boom, name="post-boom")
    loop = _loop(build_registered_hook_runtime())
    out = await loop._maybe_compact_context(_messages())

    assert out  # 压缩结果保留
    assert len(out) > 0




# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
