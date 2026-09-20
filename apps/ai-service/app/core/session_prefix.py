# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
"""Session 前缀片段(对标 codex session_prefix.rs / inter_agent_message.rs / inter_agent_completion_message.rs)。

- COMPLETION_MESSAGE_MAX_TOKENS / COMPLETION_MESSAGE_ENVELOPE_TOKEN_RESERVE / ERROR_MAX_TOKENS / ERROR_NEXT_ACTION
- truncate_utf8_bytes:按 UTF-8 字节边界安全截断(不切坏多字节字符)
- format_subagent_context_line:子代理上下文行 "- {ref}: {nick}" / "- {ref}"
- format_inter_agent_completion_message:按 AgentStatus 产出等价格式化文本(逐字对齐 codex render)
- is_inter_agent_completion_fragment:按开标记判定
- build_inter_agent_completion_fragment:返回 OpenAI 消息 dict(风格对齐 rollout_budget.build_rollout_budget_fragment)

设计取舍:codex 用 ContextualUserFragment::render 渲染;InterAgentCompletionMessage 的
markers 为空("","")，故 render() 只返回 body()。body 模板逐字为:
    Message Type: FINAL_ANSWER
    Task name: {task_name}
    Sender: {sender}
    Payload:
    {payload}
role = assistant。Python 端口直接复刻该 body 模板，并以开首行
"Message Type: FINAL_ANSWER" 作为片段识别开标记(markers 为空时无法用 XML 标记识别)。

token 近似用 4 字节/token(对齐 context_fragments.approx_bytes_for_tokens 与 codex
approx_token_count / _truncate_text_to_tokens 的语义)。
"""

from __future__ import annotations

from typing import Any, Optional

__all__ = [
    "COMPLETION_MESSAGE_MAX_TOKENS",
    "COMPLETION_MESSAGE_ENVELOPE_TOKEN_RESERVE",
    "ERROR_MAX_TOKENS",
    "ERROR_NEXT_ACTION",
    "TOOL_MENTION_SIGIL",
    "PLUGIN_TEXT_MENTION_SIGIL",
    "truncate_utf8_bytes",
    "format_subagent_context_line",
    "format_inter_agent_completion_message",
    "is_inter_agent_completion_fragment",
    "build_inter_agent_completion_fragment",
]

# 对标 session_prefix.rs 常量(逐字)
COMPLETION_MESSAGE_MAX_TOKENS: int = 1_000
COMPLETION_MESSAGE_ENVELOPE_TOKEN_RESERVE: int = 100
ERROR_MAX_TOKENS: int = COMPLETION_MESSAGE_MAX_TOKENS - COMPLETION_MESSAGE_ENVELOPE_TOKEN_RESERVE
ERROR_NEXT_ACTION: str = (
    "This agent's turn failed. If you still need this agent, use the available collaboration tools to give it another task."
)

# 对标 mention_syntax.rs(逐字)
TOOL_MENTION_SIGIL: str = "$"
PLUGIN_TEXT_MENTION_SIGIL: str = "@"

# codex InterAgentCompletionMessage 渲染模板的常量(逐字)
_INTER_AGENT_COMPLETION_TYPE: str = "FINAL_ANSWER"
_INTER_AGENT_COMPLETION_OPEN_MARKER: str = "Message Type: FINAL_ANSWER"


def truncate_utf8_bytes(text: str, max_bytes: int) -> str:
    """按 UTF-8 字节边界安全截断(不切坏多字节字符)。

    等价于 codex truncate_text 的字节边界语义:超过 max_bytes 时按字节前缀截断，
    再回退到最后一个完整字符边界(去掉可能横跨边界的尾字节)。max_bytes<=0 返回空串。
    """
    if max_bytes <= 0:
        return ""
    encoded = text.encode("utf-8")
    if len(encoded) <= max_bytes:
        return text
    truncated = encoded[:max_bytes]
    while truncated:
        try:
            return truncated.decode("utf-8")
        except UnicodeDecodeError:
            truncated = truncated[:-1]
    return ""


def format_subagent_context_line(agent_reference: str, agent_nickname: Optional[str] = None) -> str:
    """子代理上下文行:有昵称 "- {ref}: {nick}",否则 "- {ref}"(空昵称视同 None)。"""
    if agent_nickname:
        return f"- {agent_reference}: {agent_nickname}"
    return f"- {agent_reference}"


def _render_inter_agent_completion(task_name: str, sender: str, payload: str) -> str:
    """逐字复刻 codex InterAgentCompletionMessage::body()(markers 为空,render 即 body)。"""
    return (
        f"Message Type: {_INTER_AGENT_COMPLETION_TYPE}\n"
        f"Task name: {task_name}\n"
        f"Sender: {sender}\n"
        f"Payload:\n"
        f"{payload}"
    )


def format_inter_agent_completion_message(
    task_name: str,
    sender: str,
    status: str,
    message: Optional[str] = None,
) -> Optional[str]:
    """按 AgentStatus 产出 inter-agent 完成消息文本(逐字对齐 codex session_prefix.rs)。

    status ∈ completed/errored/shutdown/not_found/pending_init/running/interrupted。
    completed → message or "";errored → "Agent errored: {trunc(900t)}\\n\\n{ERROR_NEXT_ACTION}";
    shutdown → "Agent shut down.";not_found → "Agent was not found.";
    其余三态 → None(不发)。产出经 InterAgentMessage 等价格式化(body 模板逐字对齐)。
    """
    if status == "completed":
        payload = message if message is not None else ""
    elif status == "errored":
        err = message if message is not None else ""
        err = truncate_utf8_bytes(err, ERROR_MAX_TOKENS * 4)
        payload = f"Agent errored: {err}\n\n{ERROR_NEXT_ACTION}"
    elif status == "shutdown":
        payload = "Agent shut down."
    elif status == "not_found":
        payload = "Agent was not found."
    else:
        return None
    return _render_inter_agent_completion(task_name, sender, payload)


def is_inter_agent_completion_fragment(text: str) -> bool:
    """按 render 的开标记判定是否为 inter-agent 完成片段。

    codex 该片段 markers 为空，无法用 XML 标记识别，改用 body 开首行
    "Message Type: FINAL_ANSWER" 作为开标记(trim 后前缀匹配)。
    """
    if not text:
        return False
    return text.lstrip().startswith(_INTER_AGENT_COMPLETION_OPEN_MARKER)


def build_inter_agent_completion_fragment(
    task_name: str,
    sender: str,
    status: str,
    message: Optional[str] = None,
) -> dict[str, Any]:
    """返回 OpenAI 消息 dict(风格对齐 rollout_budget.build_rollout_budget_fragment)。

    type=message,role=assistant(逐字对齐 codex InterAgentCompletionMessage::role)，
    content 为单 input_text,text = format_inter_agent_completion_message(...)。
    对于不发消息的状态(pending_init/running/interrupted)返回空 dict
    (对齐 rollout_budget.build_rollout_budget_fragment 返回 {} 的约定)。
    """
    rendered = format_inter_agent_completion_message(task_name, sender, status, message)
    if rendered is None:
        return {}
    return {
        "type": "message",
        "role": "assistant",
        "content": [
            {
                "type": "input_text",
                "text": rendered,
            }
        ],
    }
