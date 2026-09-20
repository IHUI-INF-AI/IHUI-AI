# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
"""批58:realtime 系上下文片段 — 对标 codex realtime_delegation.rs +
realtime_start_instructions.rs + realtime_end_instructions.rs +
realtime_start_with_instructions.rs + world_state/realtime.rs。

片段形态:role/markers/正文逐字对齐 codex;RealtimeState 提供
active 翻转 diff(render_transition 四分支 + Absent/Unknown 三态语义)。
"""

from __future__ import annotations

from typing import Any

# 对标 codex_protocol::protocol::REALTIME_CONVERSATION_{OPEN,CLOSE}_TAG
REALTIME_CONVERSATION_OPEN_TAG = "<realtime_conversation>"
REALTIME_CONVERSATION_CLOSE_TAG = "</realtime_conversation>"

# 对标 realtime_delegation.rs 常量
MAX_REALTIME_DELEGATION_FIELD_BYTES = 4 * 1024
TRUNCATION_MARKER = "…"

# content kinds(对标 ContentItemKind 字面量)
CONTENT_KIND_START = "realtime_conversation.start_instructions"
CONTENT_KIND_END = "realtime_conversation.end_instructions"
CONTENT_KIND_CUSTOM_START = "realtime_conversation.custom_start_instructions"
CONTENT_KIND_DELEGATION = "realtime_conversation.delegation"

# 对标 RealtimeDelegationSource
SOURCE_HANDOFF = "handoff"
SOURCE_TRANSCRIPT_TAIL_FLUSH = "transcript_tail_flush"

# 对标 codex_prompts realtime 模板(include_str! 原文,trim 后进 body)
START_INSTRUCTIONS = """Realtime conversation started.

You are operating as a backend executor behind an intermediary. The user does not talk to you directly. Any response you produce will be consumed by the intermediary and may be summarized before the user sees it.

When invoked, you receive the latest conversation transcript and any relevant mode or metadata. The intermediary may invoke you even when backend help is not actually needed. Use the transcript to decide whether you should do work. If backend help is unnecessary, avoid verbose responses that add user-visible latency.

When user text is routed from realtime, treat it as a transcript. It may be unpunctuated or contain recognition errors.

- Keep responses concise and action-oriented. Your updates should help the intermediary respond to the user."""

END_INSTRUCTIONS = """Realtime conversation ended.

Subsequent user input will return to typed text rather than transcript-style text. Do not assume recognition errors or missing punctuation once realtime has ended. Resume normal chat behavior."""


def _fragment(
    role: str, body: str, content_kind: str
) -> dict[str, Any]:
    """OpenAI 消息 dict 形态对齐 ihui rollout_budget.build_rollout_budget_fragment。"""
    return {
        "type": "message",
        "role": role,
        "content": [{"type": "input_text", "text": body}],
        # content kind 仅供 host 侧识别/归约(对标 ContentItemKind)
        "content_kind": content_kind,
    }


def _escape_xml_text(text: str) -> str:
    """对标 escape_xml_text:仅 & < > 三字符(逐字对齐,不含引号)。"""
    return text.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")


def _char_boundary_ok(text: str, index: int) -> bool:
    """UTF-8 字符边界判定(Rust is_char_boundary 等价)。"""
    if index <= 0 or index >= len(text):
        return True
    return (ord(text[index]) & 0xC0) != 0x80


def escape_xml_text_bounded(text: str, retain: str) -> str:
    """对标 escape_xml_text_bounded:4KB 字段预算 + 首尾保留截断。

    retain="start" 保留开头(用于 input),retain="end" 保留结尾
    (用于 transcript_delta)。超限保留 4KB-marker 字节,按字符边界截。
    """
    escaped = _escape_xml_text(text)
    if len(escaped.encode("utf-8")) <= MAX_REALTIME_DELEGATION_FIELD_BYTES:
        return escaped
    retained_bytes = MAX_REALTIME_DELEGATION_FIELD_BYTES - len(
        TRUNCATION_MARKER.encode("utf-8")
    )
    # Rust String 切片按字节;Python str 按字符——统一以字节预算转字符索引,
    # 保证输出总字节 <= retained_bytes + marker。
    if retain == "start":
        end = _byte_limit_to_char_index(escaped, retained_bytes)
        return escaped[:end] + TRUNCATION_MARKER
    # from_end 分支返回的 idx 本身就是"保留后缀的起始字符索引"
    start_char = _byte_limit_to_char_index(escaped, retained_bytes, from_end=True)
    return TRUNCATION_MARKER + escaped[start_char:]


def _byte_limit_to_char_index(
    text: str, byte_limit: int, *, from_end: bool = False
) -> int:
    """把字节预算转为字符索引(对齐 Rust is_char_boundary 语义)。"""
    if from_end:
        byte_count = 0
        idx = len(text)
        while idx > 0:
            b = len(text[idx - 1].encode("utf-8"))
            if byte_count + b > byte_limit:
                break
            idx -= 1
            byte_count += b
        return idx
    byte_count = 0
    idx = 0
    while idx < len(text):
        b = len(text[idx].encode("utf-8"))
        if byte_count + b > byte_limit:
            break
        byte_count += b
        idx += 1
    return idx


def build_realtime_start_instructions_fragment() -> dict[str, Any]:
    """对标 RealtimeStartInstructions:body = "\\n{START_INSTRUCTIONS.trim()}\\n"。"""
    return _fragment(
        "developer", f"\n{START_INSTRUCTIONS.strip()}\n", CONTENT_KIND_START
    )


def build_realtime_end_instructions_fragment(
    instructions: str | None = None,
) -> dict[str, Any]:
    """对标 RealtimeEndInstructions:无自定义则用 END_INSTRUCTIONS.trim()。"""
    text = instructions if instructions is not None else END_INSTRUCTIONS.strip()
    return _fragment("developer", f"\n{text}\n", CONTENT_KIND_END)


def build_realtime_start_with_instructions_fragment(
    instructions: str,
) -> dict[str, Any]:
    """对标 RealtimeStartWithInstructions:body = "\\n{instructions}\\n"。"""
    return _fragment(
        "developer", f"\n{instructions}\n", CONTENT_KIND_CUSTOM_START
    )


def build_realtime_delegation_fragment(
    input_text: str,
    transcript_delta: str | None = None,
    *,
    source: str = SOURCE_HANDOFF,
) -> dict[str, Any]:
    """对标 RealtimeDelegation::body():user 角色,<realtime_delegation> 标记。

    source=handoff 时省略 <source> 行;transcript_tail_flush 时渲染
    "  <source>transcript_tail_flush</source>\\n"。transcript_delta 非空才渲染。
    """
    input_escaped = escape_xml_text_bounded(input_text, "start")
    source_line = (
        "  <source>transcript_tail_flush</source>\n"
        if source == SOURCE_TRANSCRIPT_TAIL_FLUSH
        else ""
    )
    if transcript_delta:
        delta_escaped = escape_xml_text_bounded(transcript_delta, "end")
        body = (
            f"\n{source_line}  <input>{input_escaped}</input>\n"
            f"  <transcript_delta>{delta_escaped}</transcript_delta>\n"
        )
    else:
        body = f"\n{source_line}  <input>{input_escaped}</input>\n"
    return _fragment("user", body, CONTENT_KIND_DELEGATION)


def is_realtime_delegation_fragment(text: str) -> bool:
    """开标记判定(供 stream_events 归约集参照)。"""
    return text.startswith(REALTIME_DELEGATION_OPEN := "<realtime_delegation>")  # noqa: F841


class RealtimeState:
    """对标 world_state/realtime.rs RealtimeState:active 翻转 diff。"""

    ID = "realtime"

    def __init__(
        self,
        active: bool,
        *,
        start_instructions: str | None = None,
        end_instructions: str | None = None,
    ) -> None:
        self._active = active
        self._start_instructions = start_instructions
        self._end_instructions = end_instructions

    @property
    def active(self) -> bool:
        return self._active

    def snapshot(self) -> bool:
        return self._active

    def _render_start(self) -> dict[str, Any]:
        if self._start_instructions is not None:
            return build_realtime_start_with_instructions_fragment(
                self._start_instructions
            )
        return build_realtime_start_instructions_fragment()

    def _render_end(self) -> dict[str, Any]:
        return build_realtime_end_instructions_fragment(self._end_instructions)

    def render_diff(self, previous: bool | None) -> dict[str, Any] | None:
        """previous:True/False=Known,None=Absent/Unknown(codex 三态归并)。

        Known 相同→None;Known 翻转→start/end;Absent/Unknown 且 active→start;
        Absent/Unknown 且非 active→None。
        """
        if previous is not None:
            if previous == self._active:
                return None
            return self._render_start() if self._active else self._render_end()
        return self._render_start() if self._active else None
