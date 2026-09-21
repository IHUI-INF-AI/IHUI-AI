# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
"""world_state_sections(2026-09-20 第五十六批, 对标 codex model.rs /
context_window_guidance.rs / token_budget_context.rs)。

世界状态片段渲染: 模型切换指令(ModelInstructionsState)、上下文窗口指引
(ContextWindowGuidanceState)、剩余 token 预算(TokenBudgetRemainingContext)、
上下文窗口元数据(ContextWindowSection)。正文与标记逐字对齐 codex。
"""

from __future__ import annotations

from typing import Any

from app.core.world_state_tools import PreviousSectionState

__all__ = [
    "MODEL_SWITCH_OPEN_TAG",
    "MODEL_SWITCH_CLOSE_TAG",
    "CONTEXT_WINDOW_OPEN_TAG",
    "CONTEXT_WINDOW_CLOSE_TAG",
    "CONTEXT_WINDOW_GUIDANCE_OPEN_TAG",
    "CONTEXT_WINDOW_GUIDANCE_CLOSE_TAG",
    "REPLACEMENT_NOTICE",
    "REMOVAL_NOTICE",
    "ModelInstructionsState",
    "ContextWindowGuidanceState",
    "TokenBudgetRemainingContext",
    "ContextWindowSection",
    "build_model_switch_fragment",
    "build_context_window_guidance_fragment",
    "build_remaining_tokens_fragment",
    "build_context_window_fragment",
]

MODEL_SWITCH_OPEN_TAG = "<model_switch>"
MODEL_SWITCH_CLOSE_TAG = "</model_switch>"

CONTEXT_WINDOW_OPEN_TAG = "<context_window>"
CONTEXT_WINDOW_CLOSE_TAG = "</context_window>"

CONTEXT_WINDOW_GUIDANCE_OPEN_TAG = "<context_window_guidance>"
CONTEXT_WINDOW_GUIDANCE_CLOSE_TAG = "</context_window_guidance>"

REPLACEMENT_NOTICE = (
    "This context-window guidance replaces all previously provided context-window guidance."
)
REMOVAL_NOTICE = "The previously provided context-window guidance no longer applies."


class ModelInstructionsState:
    """模型身份与切换指令(ModelInstructionsState), 对标 codex model.rs。"""

    def __init__(self, model: str, previous_model: str | None, instructions: str) -> None:
        self.model = model
        self.previous_model = previous_model
        self.instructions = instructions

    def render_diff(self, previous: PreviousSectionState[str]) -> dict[str, Any] | None:
        if previous.is_known():
            prev_snapshot = previous.snapshot
            assert prev_snapshot is not None
            model_changed = prev_snapshot != self.model
        else:
            model_changed = (
                self.previous_model is not None and self.previous_model != self.model
            )

        if model_changed and self.instructions:
            return build_model_switch_fragment(self.instructions)
        return None


class ContextWindowGuidanceState:
    """上下文窗口指引(ContextWindowGuidanceState), 对标 codex context_window_guidance.rs。"""

    def __init__(self, message: str | None) -> None:
        if message is not None and not message.strip():
            message = None
        self.message = message if message is not None else ""

    def render_diff(self, previous: PreviousSectionState[str]) -> dict[str, Any] | None:
        if previous.is_known():
            prev_snapshot = previous.snapshot
            assert prev_snapshot is not None
            if prev_snapshot == self.message:
                return None
            previous_may_contain_guidance = bool(prev_snapshot)
        elif previous.is_unknown():
            previous_may_contain_guidance = True
        else:
            previous_may_contain_guidance = False

        if not self.message:
            if not previous_may_contain_guidance:
                return None
            rendered_message = REMOVAL_NOTICE
        elif previous_may_contain_guidance:
            rendered_message = f"{REPLACEMENT_NOTICE}\n\n{self.message}"
        else:
            rendered_message = self.message

        return build_context_window_guidance_fragment(rendered_message)


class TokenBudgetRemainingContext:
    """剩余 token 预算(TokenBudgetRemainingContext), 对标 codex token_budget_context.rs。"""

    def __init__(self, tokens_left: int | None) -> None:
        self.tokens_left = tokens_left

    def render(self) -> dict[str, Any]:
        return build_remaining_tokens_fragment(self.tokens_left)


class ContextWindowSection:
    """上下文窗口元数据(ContextWindowSection), 对标 codex token_budget_context.rs。"""

    def __init__(
        self,
        agent_name: str,
        first_window_id: str,
        previous_window_id: str | None,
        window_id: str,
        thread_hint: str | None,
    ) -> None:
        self.agent_name = agent_name
        self.first_window_id = first_window_id
        self.previous_window_id = previous_window_id
        self.window_id = window_id
        self.thread_hint = thread_hint

    def snapshot(self) -> str:
        return self.agent_name

    def render_diff(self, previous: PreviousSectionState[str]) -> dict[str, Any] | None:
        if previous.is_known():
            prev_snapshot = previous.snapshot
            assert prev_snapshot is not None
            if prev_snapshot != self.agent_name:
                return build_context_window_fragment(
                    self.agent_name,
                    self.first_window_id,
                    self.previous_window_id,
                    self.window_id,
                    self.thread_hint,
                )
        return None


def build_model_switch_fragment(instructions: str) -> dict[str, Any]:
    """构造模型切换指令片段(developer 角色, 带 <model_switch> 标记)。"""
    body = (
        "\nThe user was previously using a different model. "
        "Please continue the conversation according to the following instructions:\n\n"
        f"{instructions}\n"
    )
    return {
        "type": "message",
        "role": "developer",
        "content": [
            {
                "type": "input_text",
                "text": f"{MODEL_SWITCH_OPEN_TAG}{body}{MODEL_SWITCH_CLOSE_TAG}",
            }
        ],
    }


def build_context_window_guidance_fragment(message: str) -> dict[str, Any]:
    """构造上下文窗口指引片段(developer 角色, 带 <context_window_guidance> 标记)。"""
    body = f"\n{message}\n"
    return {
        "type": "message",
        "role": "developer",
        "content": [
            {
                "type": "input_text",
                "text": f"{CONTEXT_WINDOW_GUIDANCE_OPEN_TAG}{body}{CONTEXT_WINDOW_GUIDANCE_CLOSE_TAG}",
            }
        ],
    }


def build_remaining_tokens_fragment(tokens_left: int | None) -> dict[str, Any]:
    """构造剩余 token 预算片段(developer 角色, 无标记)。"""
    if tokens_left is None:
        body = "You have unknown tokens left in this context window."
    else:
        body = f"You have {tokens_left} tokens left in this context window."
    return {
        "type": "message",
        "role": "developer",
        "content": [{"type": "input_text", "text": body}],
    }


def build_context_window_fragment(
    agent_name: str,
    first_window_id: str,
    previous_window_id: str | None,
    window_id: str,
    thread_hint: str | None,
) -> dict[str, Any]:
    """构造上下文窗口元数据片段(developer 角色, 带 <context_window> 标记)。"""
    lines = [
        f"Agent name: {agent_name}",
        f"First context window id: {first_window_id}",
        f"Current context window id: {window_id}",
    ]
    if previous_window_id is not None:
        lines.append(f"Previous context window id: {previous_window_id}")
    if thread_hint is not None:
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
