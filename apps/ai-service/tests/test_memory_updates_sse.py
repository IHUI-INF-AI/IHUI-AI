# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

"""P1 #27 记忆更新可视化 —— done 前同步提炼 memoryUpdates 测试(2026-09-16 立)。

覆盖 app/routers/llm.py 的 _extract_memory_updates:
- 入参守卫(无 owner_uuid / 无 user_messages → [])
- stub 模式短路(零成本,不发起任何 LLM 调用)
- 用户隐私开关 autoMemory=false 短路(不记忆)
- LLM 提炼成功 → 写 semantic 层 + 返回条目摘要
- LLM 返回「无」等否定语义 → [](不产生噪音提示条)
- LLM 超时 → 降级为空数组(不阻塞 done 下发)
- semantic 写入失败 → 仍回传条目(提示条可用)
- 异常 → 降级为空数组
"""

from __future__ import annotations

from unittest.mock import AsyncMock, patch

import pytest

from app.routers import llm as llm_module
from app.routers.llm import (
    MEMORY_EXTRACT_TIMEOUT_S,
    MEMORY_ITEM_MAX_CHARS,
    _extract_memory_updates,
)

USER_MESSAGES = [
    {"role": "user", "content": "我在长春做 AI 应用开发"},
    {"role": "assistant", "content": "了解"},
]


def _patch_deps(
    *,
    stub: bool = False,
    auto_memory: bool = True,
    complete_result: dict | None = None,
    complete_side_effect: Exception | None = None,
    semantic_side_effect: Exception | None = None,
):
    """构造 memory_service / LLMGateway 的 mock 上下文。"""
    fake_svc = AsyncMock()
    fake_svc._is_auto_memory_enabled = AsyncMock(return_value=auto_memory)
    if complete_side_effect is not None:
        fake_svc._gateway.complete = AsyncMock(side_effect=complete_side_effect)
    else:
        fake_svc._gateway.complete = AsyncMock(
            return_value=complete_result if complete_result is not None else {"content": "摘要"}
        )
    if semantic_side_effect is not None:
        fake_svc.add_semantic = AsyncMock(side_effect=semantic_side_effect)
    else:
        fake_svc.add_semantic = AsyncMock(return_value={"id": "sem-1"})

    return fake_svc


@pytest.mark.asyncio
async def test_no_owner_returns_empty() -> None:
    """无 owner_uuid → 空数组(不发起任何调用)。"""
    assert await _extract_memory_updates(
        owner_uuid=None, conversation_id="c1", user_messages=USER_MESSAGES, assistant_content="x"
    ) == []


@pytest.mark.asyncio
async def test_no_messages_returns_empty() -> None:
    """无消息 → 空数组。"""
    assert await _extract_memory_updates(
        owner_uuid="u1", conversation_id="c1", user_messages=[], assistant_content="x"
    ) == []


@pytest.mark.asyncio
async def test_stub_mode_short_circuits() -> None:
    """stub 模式短路:零成本,不调 complete(与 consolidate 一致)。"""
    fake_svc = _patch_deps()
    with (
        patch("app.services.memory_service.memory_service", fake_svc),
        patch("app.core.llm_gateway.LLMGateway._is_stub_mode", return_value=True),
    ):
        out = await _extract_memory_updates(
            owner_uuid="u1",
            conversation_id="c1",
            user_messages=USER_MESSAGES,
            assistant_content="reply",
        )
    assert out == []
    fake_svc._gateway.complete.assert_not_awaited()


@pytest.mark.asyncio
async def test_auto_memory_disabled_short_circuits() -> None:
    """用户隐私开关 autoMemory=false → 不记忆(respect 用户选择)。"""
    fake_svc = _patch_deps(auto_memory=False)
    with (
        patch("app.services.memory_service.memory_service", fake_svc),
        patch("app.core.llm_gateway.LLMGateway._is_stub_mode", return_value=False),
    ):
        out = await _extract_memory_updates(
            owner_uuid="u1",
            conversation_id="c1",
            user_messages=USER_MESSAGES,
            assistant_content="reply",
        )
    assert out == []
    fake_svc._gateway.complete.assert_not_awaited()
    fake_svc.add_semantic.assert_not_awaited()


@pytest.mark.asyncio
async def test_success_returns_item_and_writes_semantic() -> None:
    """提炼成功 → 写入 semantic 层 + 返回条目摘要。"""
    fake_svc = _patch_deps(complete_result={"content": "  用户在长春做 AI 应用开发  "})
    with (
        patch("app.services.memory_service.memory_service", fake_svc),
        patch("app.core.llm_gateway.LLMGateway._is_stub_mode", return_value=False),
    ):
        out = await _extract_memory_updates(
            owner_uuid="u1",
            conversation_id="c1",
            user_messages=USER_MESSAGES,
            assistant_content="reply",
        )
    assert out == ["用户在长春做 AI 应用开发"]
    fake_svc.add_semantic.assert_awaited_once()
    args = fake_svc.add_semantic.await_args
    assert args.args[0] == "u1"
    assert args.args[1] == "用户在长春做 AI 应用开发"


@pytest.mark.asyncio
async def test_negative_summary_returns_empty() -> None:
    """LLM 明确表示无可记忆信息 → [](不产生噪音提示条)。"""
    fake_svc = _patch_deps(complete_result={"content": "无"})
    with (
        patch("app.services.memory_service.memory_service", fake_svc),
        patch("app.core.llm_gateway.LLMGateway._is_stub_mode", return_value=False),
    ):
        out = await _extract_memory_updates(
            owner_uuid="u1",
            conversation_id="c1",
            user_messages=USER_MESSAGES,
            assistant_content="reply",
        )
    assert out == []
    fake_svc.add_semantic.assert_not_awaited()


@pytest.mark.asyncio
async def test_timeout_degrades_to_empty() -> None:
    """LLM 超时 → 降级空数组(绝不拖住 done 下发)。"""
    fake_svc = _patch_deps(complete_side_effect=TimeoutError())
    with (
        patch("app.services.memory_service.memory_service", fake_svc),
        patch("app.core.llm_gateway.LLMGateway._is_stub_mode", return_value=False),
    ):
        out = await _extract_memory_updates(
            owner_uuid="u1",
            conversation_id="c1",
            user_messages=USER_MESSAGES,
            assistant_content="reply",
        )
    assert out == []


@pytest.mark.asyncio
async def test_semantic_write_failure_still_returns_item() -> None:
    """semantic 写入失败 → 仍回传条目(提示条可用,写入降级不阻塞)。"""
    fake_svc = _patch_deps(
        complete_result={"content": "用户偏好 TypeScript"},
        semantic_side_effect=RuntimeError("db down"),
    )
    with (
        patch("app.services.memory_service.memory_service", fake_svc),
        patch("app.core.llm_gateway.LLMGateway._is_stub_mode", return_value=False),
    ):
        out = await _extract_memory_updates(
            owner_uuid="u1",
            conversation_id="c1",
            user_messages=USER_MESSAGES,
            assistant_content="reply",
        )
    assert out == ["用户偏好 TypeScript"]


@pytest.mark.asyncio
async def test_generic_exception_degrades_to_empty() -> None:
    """任意异常 → 降级空数组。"""
    fake_svc = _patch_deps(complete_side_effect=RuntimeError("boom"))
    with (
        patch("app.services.memory_service.memory_service", fake_svc),
        patch("app.core.llm_gateway.LLMGateway._is_stub_mode", return_value=False),
    ):
        out = await _extract_memory_updates(
            owner_uuid="u1",
            conversation_id="c1",
            user_messages=USER_MESSAGES,
            assistant_content="reply",
        )
    assert out == []


@pytest.mark.asyncio
async def test_item_truncation() -> None:
    """超长摘要按 MEMORY_ITEM_MAX_CHARS 截断(避免 SSE 事件体积膨胀)。"""
    long_text = "很" * (MEMORY_ITEM_MAX_CHARS + 500)
    fake_svc = _patch_deps(complete_result={"content": long_text})
    with (
        patch("app.services.memory_service.memory_service", fake_svc),
        patch("app.core.llm_gateway.LLMGateway._is_stub_mode", return_value=False),
    ):
        out = await _extract_memory_updates(
            owner_uuid="u1",
            conversation_id="c1",
            user_messages=USER_MESSAGES,
            assistant_content="reply",
        )
    assert len(out) == 1
    assert len(out[0]) == MEMORY_ITEM_MAX_CHARS


def test_constants_sane() -> None:
    """常量合理性:超时为正且不过大(避免 done 下发明显延迟)。"""
    assert 0 < MEMORY_EXTRACT_TIMEOUT_S <= 15
    assert MEMORY_ITEM_MAX_CHARS > 0


def test_done_event_carries_memory_updates_field() -> None:
    """静态守门:llm.py 三处 done 事件均由 _extract_memory_updates 回填。

    防止后续重构把接线改回硬编码 [] (此前三处均为占位空数组)。
    """
    import pathlib

    src = pathlib.Path(llm_module.__file__).read_text(encoding="utf-8")
    assert src.count('"memoryUpdates": _mem_updates') == 3
    assert src.count('"memoryUpdates": []') == 0
    assert src.count("_extract_memory_updates(") == 4  # 1 定义 + 3 调用
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
