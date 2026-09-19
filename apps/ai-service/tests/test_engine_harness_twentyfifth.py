# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠


"""第二十五批测试:压缩摘要交接语义(对标 Codex compact prompt + SUMMARY_PREFIX)。

聚焦:
- DEFAULT_COMPACT_INSTRUCTION 覆盖 codex 交接摘要四要素与 handoff 框架
- custom_summary 通道确实把该指令作为 system prompt 发给摘要 LLM(prompt 构造)
- 摘要消息标记行格式不被引擎本地语义改动(TS 共享格式零触碰)
"""

from __future__ import annotations

import inspect
from typing import Any

import pytest

from app.services.compact_with_llm import (
    DEFAULT_COMPACT_INSTRUCTION,
    _summarize_head,
    _truncate_to_budget,
)

# codex 交接摘要四要素(handoff framing / 决策 / 约束与偏好 / 下一步 / 关键数据)
_REQUIRED_SEMANTICS = ("交接", "进度", "决策", "偏好", "下一步", "数据")
_HANDOFF_FRAME = ("前一个模型", "继续", "避免重复")


def test_compact_instruction_covers_handoff_semantics():
    for keyword in _REQUIRED_SEMANTICS:
        assert keyword in DEFAULT_COMPACT_INSTRUCTION, keyword


def test_compact_instruction_opens_with_handoff_frame():
    for keyword in _HANDOFF_FRAME:
        assert keyword in DEFAULT_COMPACT_INSTRUCTION, keyword


@pytest.mark.asyncio
async def test_summarize_head_sends_instruction_as_system():
    """摘要指令以 system 角色进入 prompt 首条(与 head 消息拼接)。"""
    captured: dict[str, Any] = {}

    async def fake_llm(messages: list[dict[str, Any]], tools: Any = None) -> dict:
        captured["prompt"] = messages
        return {"content": "摘要正文"}

    head = [
        {"role": "user", "content": "任务请求"},
        {"role": "assistant", "content": "已完成"},
    ]
    summary = await _summarize_head(head, fake_llm, DEFAULT_COMPACT_INSTRUCTION, 10_000)
    assert summary == "摘要正文"
    prompt = captured["prompt"]
    assert prompt[0]["role"] == "system"
    assert prompt[0]["content"] == DEFAULT_COMPACT_INSTRUCTION
    assert prompt[1:] == head


@pytest.mark.asyncio
async def test_summarize_head_single_param_signature_compat():
    """兼容单参 (messages)->str 的 llm_complete_fn(不传 tools)。"""

    async def single_param_llm(messages: list[dict[str, Any]]) -> str:
        assert messages[0]["role"] == "system"
        return "ok"

    summary = await _summarize_head(
        [{"role": "user", "content": "x"}],
        single_param_llm,
        DEFAULT_COMPACT_INSTRUCTION,
        10_000,
    )
    assert summary == "ok"


def test_truncate_budget_keeps_min_chars():
    text = "x" * 500
    out = _truncate_to_budget(text, budget_tokens=1)
    assert 0 < len(out) <= 500
    # 预算充足时原样返回
    assert _truncate_to_budget(text, budget_tokens=10_000) == text


def test_instruction_is_engine_local_not_shared_format():
    """共享标记行格式零触碰:指令只进 LLM 通道,不改 SUMMARY_MARKER 语义。"""
    from app.core.context_compaction import SUMMARY_MARKER

    assert SUMMARY_MARKER == "[上下文摘要"
