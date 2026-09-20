# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""OpenAI Codex CLI 会话导出解析器(D28,2026-09-20 立)。

输入形态:`~/.codex/sessions/<Y/M/D>/rollout-<时间>-<uuid>.jsonl`,或同结构的
`.json` 数组。逐行 `{timestamp, type, payload}`,关键类型:

- `session_meta` → 一次 rollout 的起点(payload 带 id/timestamp/cwd/cli_version)
- `turn_context` → 当轮模型(payload.model)
- `response_item` → 送给模型的真实上下文条目(`message` 是可见对话,`reasoning`
  / `function_call` / `function_call_output` 是执行过程,不落地)
- `event_msg` → UI 事件流(`user_message` / `agent_message`)

`response_item.message` 与 `event_msg` 描述同一批文本但形态不同,旧版 rollout 只有
其中一种。因此以 `response_item` 为权威源,该会话一条都没解析出来时才回退
`event_msg` —— 不做去重,避免把真实的重复提问吃掉。
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any

from .ir import (
    VALID_ROLES,
    Conversation,
    Message,
    ParseResult,
    decode_text,
    iter_json_records,
    message,
    to_iso,
)

__all__ = ["parse"]

# Codex 以 user 角色注入的环境/指令上下文,不属于用户输入
_INJECTED_PREFIXES = (
    "<environment_context>",
    "<user_instructions>",
    "<permissions instructions>",
    "<turn_aborted>",
    "<system-reminder>",
)


@dataclass(slots=True)
class _Draft:
    """单条 rollout 的中间态:权威通道与回退通道各收一份。"""

    created_at: str | None = None
    model: str | None = None
    transcript: list[Message] = field(default_factory=list)
    events: list[Message] = field(default_factory=list)


def parse(data: bytes, filename: str) -> ParseResult:
    """解析 Codex rollout 为 IR 会话列表。"""
    del filename  # rollout 恒为 JSON/JSONL 载体,后缀不影响解析路径
    records, corrupt = iter_json_records(decode_text(data))
    result = ParseResult()
    if corrupt:
        result.warnings.append(f"{corrupt} 行 JSON 无法解析已跳过")

    drafts: list[_Draft] = []
    current = _Draft()
    for record in records:
        if not isinstance(record, dict):
            continue
        rtype = record.get("type")
        stamp = to_iso(record.get("timestamp"))
        payload = record.get("payload") if isinstance(record.get("payload"), dict) else None

        if rtype == "session_meta":
            if current.created_at is not None or current.transcript or current.events:
                drafts.append(current)
            current = _Draft()
            current.created_at = stamp or _meta_timestamp(payload)
            continue

        if rtype == "turn_context" and payload is not None:
            model = payload.get("model")
            if isinstance(model, str) and model and not current.model:
                current.model = model
            continue

        if rtype == "event_msg" and payload is not None:
            _append(current.events, payload.get("type"), payload.get("message"), stamp)
            continue

        if rtype == "response_item" and payload is not None:
            if payload.get("type") == "message":
                text = _text_of(payload.get("content"))
                _append(current.transcript, str(payload.get("role")), text, stamp)
            continue

        if isinstance(record.get("role"), str):
            # 旧版/裸 item 导出:记录本身就是一条 message
            _append(current.transcript, str(record["role"]), _text_of(record.get("content")), stamp)

    drafts.append(current)
    result.conversations = [
        _to_conversation(draft) for draft in drafts if draft.transcript or draft.events
    ]
    return result


def _append(sink: list[Message], kind: Any, text: Any, stamp: str | None) -> None:
    """按 event/type 名称映射角色并追加(注入上下文与空正文直接丢弃)。"""
    if not isinstance(kind, str):
        return
    role = {"user_message": "user", "agent_message": "assistant", "response": "assistant"}.get(
        kind, kind.lower()
    )
    if role not in VALID_ROLES:
        return
    body = text if isinstance(text, str) else _text_of(text)
    if role == "user" and body.lstrip().startswith(_INJECTED_PREFIXES):
        return
    msg = message(role, body, stamp)
    if msg is not None:
        sink.append(msg)


def _text_of(content: Any) -> str:
    """Codex content block 数组 → 纯文本(input_text/output_text/text 三种命名)。"""
    if isinstance(content, str):
        return content
    if not isinstance(content, list):
        return ""
    parts: list[str] = []
    for block in content:
        if isinstance(block, dict) and block.get("type") in ("input_text", "output_text", "text"):
            text = block.get("text")
            if isinstance(text, str) and text.strip():
                parts.append(text)
    return "\n\n".join(parts)


def _meta_timestamp(payload: dict[str, Any] | None) -> str | None:
    if payload is None:
        return None
    return to_iso(payload.get("timestamp"))


def _to_conversation(draft: _Draft) -> Conversation:
    return Conversation(
        messages=list(draft.transcript) or list(draft.events),
        model=draft.model,
        created_at=draft.created_at,
    )
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
