# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""compact_with_llm.py 单元测试:主循环超阈值自动 LLM 语义压缩。

覆盖:
- 未超阈值:原样返回 + trigger='none',LLM 不被调用
- 超阈值 + LLM 成功:结果含 custom_summary 语义摘要,info 标记 llm_summary=True
- LLM 抛异常:降级为规则压缩,仍返回合法消息,不向外抛异常
- 配对组保护:assistant(tool_calls) 与其 tool 结果不被拆散
- 摘要 token 预算控制:超预算自动截断,摘要不至于过大导致压缩失效
"""

from __future__ import annotations

from typing import Any

import pytest

from app.core.context_compaction import SUMMARY_MARKER
from app.services.compact_with_llm import compact_with_llm

# 固定的语义摘要文本(校验 LLM 成功路径透传用)
_SEMANTIC_SUMMARY = "【语义摘要】用户的目标是完成X任务,已调用工具Y并得到结果Z。"


def _make_long_messages(n: int = 40) -> list[dict[str, Any]]:
    """生成 n 条足够长的 user 消息,把 token 数推过触发阈值(默认 context_limit=4000)。"""
    return [
        {
            "role": "user",
            "content": f"第{i}条消息讨论长期对话上下文治理方案。{chr(10)}" + "补充说明" * 40,
        }
        for i in range(n)
    ]


def _find_summary(msg: dict[str, Any] | None) -> bool:
    content = msg.get("content", "") if isinstance(msg, dict) else None
    return isinstance(content, str) and content.startswith(SUMMARY_MARKER)


@pytest.mark.asyncio
async def test_not_over_threshold_returns_original_and_skips_llm():
    """未超阈值:不改消息,LLM 不被调用,info trigger='none'。"""
    messages = [{"role": "user", "content": "你好"}, {"role": "user", "content": "继续"}]
    calls: list[list[dict[str, Any]]] = []

    async def fake_llm(msgs: list[dict[str, Any]]) -> dict[str, Any]:
        calls.append(msgs)
        return {"content": _SEMANTIC_SUMMARY}

    out, info = await compact_with_llm(messages, context_limit=10000, llm_complete_fn=fake_llm)

    assert out is messages  # 原对象,未改动
    assert info["compressed"] is False
    assert info["trigger"] == "none"
    assert calls == []  # 未超阈值,不发起 LLM 摘要调用


@pytest.mark.asyncio
async def test_over_threshold_llm_success_injects_custom_summary():
    """超阈值 + LLM 成功:产物含 LLM 语义摘要,info 标记 llm_summary=True。"""
    messages = _make_long_messages()
    calls: list[list[dict[str, Any]]] = []

    async def fake_llm(msgs: list[dict[str, Any]]) -> dict[str, Any]:
        calls.append(msgs)
        return {"content": _SEMANTIC_SUMMARY}

    out, info = await compact_with_llm(messages, context_limit=4000, llm_complete_fn=fake_llm)

    assert info["compressed"] is True
    assert info.get("llm_summary") is True  # 走 LLM 语义摘要路径
    assert len(calls) == 1  # LLM 恰好被调用一次
    summaries = [m for m in out if _find_summary(m)]
    assert summaries, "压缩产物应包含摘要消息"
    assert _SEMANTIC_SUMMARY in summaries[0]["content"]
    # LLM 接收的 prompt:system 摘要指令 + 应被压缩的 head 段
    prompt = calls[0]
    assert prompt and prompt[0]["role"] == "system"


@pytest.mark.asyncio
async def test_llm_failure_falls_back_to_rule_compaction():
    """LLM 摘要抛异常:降级为规则压缩,仍返回合法消息,不向外抛异常。"""
    # 用纯规则压缩可成功收敛的消息集(30 条长 ASCII 填充,ctx=1600 时 trigger='ratio')
    messages = [
        {"role": "user", "content": f"第{i}条对话目标记录与进展。" + "A" * 250}
        for i in range(30)
    ]

    async def failing_llm(msgs: list[dict[str, Any]]) -> dict[str, Any]:
        raise RuntimeError("LLM 不可用")

    out, info = await compact_with_llm(messages, context_limit=1600, llm_complete_fn=failing_llm)

    assert info["compressed"] is True
    assert "llm_summary" not in info  # 走规则压缩兜底
    summaries = [m for m in out if _find_summary(m)]
    assert summaries, "降级后仍应产出合法摘要消息"
    assert _SEMANTIC_SUMMARY not in summaries[0]["content"]  # 未混入 LLM 摘要
    # 产物结构合法:压缩产物至少含 [摘要 + 尾部保留] 两段
    assert out and len(out) >= 2


@pytest.mark.asyncio
async def test_pair_groups_preserved():
    """配对组保护:超阈值压缩时 assistant(tool_calls) 与其 tool 结果不被拆散。"""
    messages = _make_long_messages(n=40)
    # 在尾部追加一个 tool_calls 配对组(应落入 keep_recent 尾部完整保留)
    messages.append({
        "role": "assistant",
        "content": "",
        "tool_calls": [
            {
                "id": "t1",
                "type": "function",
                "function": {"name": "tool_a", "arguments": "{}"},
            }
        ],
    })
    messages.append({"role": "tool", "tool_call_id": "t1", "content": "工具结果:done"})
    calls: list[Any] = []

    async def fake_llm(msgs: list[Any]) -> dict[str, Any]:
        calls.append(msgs)
        return {"content": _SEMANTIC_SUMMARY}

    out, info = await compact_with_llm(messages, context_limit=4000, llm_complete_fn=fake_llm)

    assert info["compressed"] is True
    # 配对组应完整保留在尾部末尾(assistant(tool_calls) 紧邻其后 tool 结果)
    assert out[-2]["role"] == "assistant"
    assert out[-2].get("tool_calls", [])[0]["id"] == "t1"
    assert out[-1]["role"] == "tool"
    assert out[-1].get("tool_call_id") == "t1"

    # 全局校验:产物中任何 tool 消息都必有匹配的 assistant tool_call(无孤 tool 消息)
    pending: set[str] = set()
    for m in out:
        tcs = m.get("tool_calls") if m.get("role") == "assistant" else None
        if tcs:
            pending.update(tc.get("id") for tc in tcs if isinstance(tc, dict))
        if m.get("role") == "tool":
            assert m.get("tool_call_id") in pending, "发现孤 tool 消息"
            pending.discard(m.get("tool_call_id"))


@pytest.mark.asyncio
async def test_over_budget_summary_is_truncated():
    """摘要 token 预算控制:LLM 返回超预算摘要时被截断,仍产生合法压缩产物。"""
    messages = _make_long_messages()
    # 构造一个远超预算的"摘要"(大量中文,按字符密度截断)
    huge_summary = "冗余信息。" * 20000
    calls: list[Any] = []

    async def fake_llm(msgs: list[Any]) -> dict[str, Any]:
        calls.append(msgs)
        return {"content": huge_summary}

    out, info = await compact_with_llm(
        messages, context_limit=4000, llm_complete_fn=fake_llm, target_ratio=0.6
    )

    assert info["compressed"] is True
    summaries = [m for m in out if _find_summary(m)]
    assert summaries, "应仍产出合法摘要产物"
    # 截断后的摘要不应保留原始巨串全文(仅保留预算内的前缀)
    assert len(summaries[0]["content"]) < len("冗余信息。" * 20000)
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
