# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""逐轮导航索引(turn outline)。

对照 DSH `dsh-session` 的 turn outline:从已持久化的 Turn + Item 事件流派生
**供 UI 跳转与诊断**的轮摘要,不另存一份真相。每个 turn 的摘要只回答:
- 这一轮用户想做什么(intent,首条 user_message 截断)
- 产生了多少条消息/工具调用/文件编辑/错误
- 这一轮占用的 seq 区间(用于按 seq 精确 jump)
- 起止时间与耗时

纯函数、零 IO、零模型调用;输入只读,不修改 Turn/Item 对象。
"""
from __future__ import annotations

from collections import Counter
from collections.abc import Sequence
from dataclasses import dataclass
from typing import Any

__all__ = [
    "TurnOutlineEntry",
    "build_turn_outline",
    "render_intent",
    "MAX_INTENT_CHARS",
]

#: 意图摘要上限(Unicode 码点,不是字节);超出保留前 N 个码点并加省略号。
MAX_INTENT_CHARS = 120


def render_intent(text: str | None, *, max_chars: int = MAX_INTENT_CHARS) -> str:
    """把首条用户消息压成单行意图摘要。

    - 空白折叠成单个空格(多行 prompt 在 outline 里占一行);
    - 超过 ``max_chars`` 个 Unicode 码点截断并追加 ``…``;
    - ``max_chars <= 0`` 返回空串,不静默使用默认值。
    """
    if not isinstance(text, str) or not text.strip() or max_chars <= 0:
        return ""
    normalized = " ".join(text.split())
    if len(normalized) <= max_chars:
        return normalized
    return normalized[:max_chars] + "…"


def _attr(obj: Any, name: str, default: Any = None) -> Any:
    if isinstance(obj, dict):
        return obj.get(name, default)
    return getattr(obj, name, default)


@dataclass(frozen=True)
class TurnOutlineEntry:
    """一轮的导航摘要(不可变)。"""

    turn_id: str
    turn_seq: int
    status: str
    intent: str
    started_at: float
    ended_at: float | None
    duration_ms: int
    user_messages: int
    agent_messages: int
    tool_calls: int
    tool_names: tuple[tuple[str, int], ...]
    file_edits: int
    errors: int
    start_seq: int | None
    end_seq: int | None
    item_count: int

    def as_dict(self) -> dict[str, Any]:
        return {
            "turnId": self.turn_id,
            "turnSeq": self.turn_seq,
            "status": self.status,
            "intent": self.intent,
            "startedAt": self.started_at,
            "endedAt": self.ended_at,
            "durationMs": self.duration_ms,
            "userMessages": self.user_messages,
            "agentMessages": self.agent_messages,
            "toolCalls": self.tool_calls,
            "toolNames": dict(self.tool_names),
            "fileEdits": self.file_edits,
            "errors": self.errors,
            "startSeq": self.start_seq,
            "endSeq": self.end_seq,
            "itemCount": self.item_count,
        }


def _duration_ms(started_at: float, ended_at: float | None) -> int:
    if not isinstance(started_at, (int, float)) or not isinstance(ended_at, (int, float)):
        return 0
    return max(0, int((float(ended_at) - float(started_at)) * 1000))


def build_turn_outline(
    turns: Sequence[Any],
    items: Sequence[Any],
    *,
    intent_max_chars: int = MAX_INTENT_CHARS,
) -> list[TurnOutlineEntry]:
    """从 Turn + Item 派生逐轮 outline(按 turn_seq 升序)。

    参数用 duck typing:支持 `Turn` / `ItemBase` 对象或同形 dict,便于纯函数测试
    与未来从 JSONL 重放复用。找不到 turn 的 item 不丢弃也不猜归属:它们不属于
    任何一轮,outline 只汇总挂在 turn 上的 item(防止把 fork/压缩边界算进错误的轮)。
    """
    grouped: dict[str, list[Any]] = {}
    for item in items:
        turn_id = _attr(item, "turn_id")
        if isinstance(turn_id, str) and turn_id:
            grouped.setdefault(turn_id, []).append(item)

    entries: list[TurnOutlineEntry] = []
    for turn in turns:
        turn_id = str(_attr(turn, "turn_id", ""))
        if not turn_id:
            continue
        turn_items = sorted(
            grouped.get(turn_id, []),
            key=lambda it: int(_attr(it, "seq", 0) or 0),
        )
        kinds = [_attr(it, "item_type", "") for it in turn_items]
        tool_names = Counter(
            str(_attr(it, "tool", "") or "")
            for it in turn_items
            if _attr(it, "item_type") == "tool_call" and _attr(it, "tool")
        )
        first_user = next(
            (
                str(_attr(it, "content", "") or "")
                for it in turn_items
                if _attr(it, "item_type") == "user_message"
            ),
            "",
        )
        seqs = [int(_attr(it, "seq", 0) or 0) for it in turn_items]
        started_at = float(_attr(turn, "started_at", 0.0) or 0.0)
        ended_at_raw = _attr(turn, "ended_at")
        ended_at = float(ended_at_raw) if isinstance(ended_at_raw, (int, float)) else None
        entries.append(
            TurnOutlineEntry(
                turn_id=turn_id,
                turn_seq=int(_attr(turn, "turn_seq", 0) or 0),
                status=str(_attr(turn, "status", "") or ""),
                intent=render_intent(first_user, max_chars=intent_max_chars),
                started_at=started_at,
                ended_at=ended_at,
                duration_ms=_duration_ms(started_at, ended_at),
                user_messages=kinds.count("user_message"),
                agent_messages=kinds.count("agent_message"),
                tool_calls=kinds.count("tool_call"),
                tool_names=tuple(sorted(tool_names.items(), key=lambda kv: (-kv[1], kv[0]))),
                file_edits=kinds.count("file_edit"),
                errors=kinds.count("error"),
                start_seq=min(seqs) if seqs else None,
                end_seq=max(seqs) if seqs else None,
                item_count=len(turn_items),
            )
        )
    entries.sort(key=lambda e: (e.turn_seq, e.turn_id))
    return entries
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
