# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""批57:TokenBudgetRemainingContext 渲染(对标 codex token_budget_context.rs)。

- build_token_budget_remaining_fragment:developer 裸文本(空标记对),
  "You have {n} tokens left in this context window." / unknown 变体;
- build_context_window_fragment:Agent name / First|Current|Previous context
  window id 行,标记 <context_window>,agent_path 变化才注入(diff 由调用方做)。
"""

from __future__ import annotations

from typing import Any

from app.core.rollout_budget import build_token_budget_remaining_fragment

CONTEXT_WINDOW_OPEN_TAG = "<context_window>"
CONTEXT_WINDOW_CLOSE_TAG = "</context_window>"


def test_remaining_known_tokens() -> None:
    frag = build_token_budget_remaining_fragment(1234)
    assert frag["role"] == "developer"
    assert frag["content"][0]["text"] == (
        "You have 1234 tokens left in this context window."
    )


def test_remaining_unknown_tokens() -> None:
    frag = build_token_budget_remaining_fragment(None)
    assert frag["content"][0]["text"] == (
        "You have unknown tokens left in this context window."
    )


def test_remaining_negative_clamped() -> None:
    frag = build_token_budget_remaining_fragment(-5)
    assert "0 tokens" in frag["content"][0]["text"]


def test_remaining_no_markers() -> None:
    """codex type_markers()=("", "")——裸文本,不含任何 XML 标记。"""
    frag = build_token_budget_remaining_fragment(10)
    text = frag["content"][0]["text"]
    assert "<" not in text and ">" not in text


def build_context_window_fragment(
    agent_name: str,
    first_window_id: str,
    window_id: str,
    previous_window_id: str | None = None,
    thread_hint: str | None = None,
) -> dict[str, Any]:
    """构造 <context_window> 片段(对标 TokenBudgetContext.body 逐行)。"""
    lines = [
        f"Agent name: {agent_name}",
        f"First context window id: {first_window_id}",
        f"Current context window id: {window_id}",
    ]
    if previous_window_id:
        lines.append(f"Previous context window id: {previous_window_id}")
    if thread_hint:
        lines.append(thread_hint)
    body = "\n" + "\n".join(lines) + "\n"
    return {
        "type": "message",
        "role": "developer",
        "content": [
            {
                "type": "input_text",
                "text": f"{CONTEXT_WINDOW_OPEN_TAG}{body}{CONTEXT_WINDOW_CLOSE_TAG}",
            }
        ],
    }


def test_context_window_basic_lines() -> None:
    frag = build_context_window_fragment("root", "w1", "w2")
    text = frag["content"][0]["text"]
    assert text.startswith("<context_window>")
    assert "Agent name: root" in text
    assert "First context window id: w1" in text
    assert "Current context window id: w2" in text
    assert "Previous" not in text


def test_context_window_previous_and_hint() -> None:
    frag = build_context_window_fragment("root", "w1", "w3", "w2", "hint-line")
    text = frag["content"][0]["text"]
    assert "Previous context window id: w2" in text
    assert "hint-line" in text
    assert text.rstrip().endswith("</context_window>")
