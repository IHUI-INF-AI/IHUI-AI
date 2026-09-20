# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

# app/core/local_compact.py
"""本地语义压缩的历史装配纯算法 — 2026-09-19 第三十四批,对标 Codex core/src/compact.rs
纯函数群(content_items_to_text / collect_annotated_user_messages / is_summary_message /
insert_initial_context_before_last_real_user_or_summary / build_compacted_history)与
context/compaction_summary.rs、prompts/src/compact.rs(SUMMARY_PREFIX 模板)。

移植范围:
- content_items_to_text:文本项拼接(跳过图像/音频与空串),\\n 连接;全空返 None;
- is_summary_message:SUMMARY_PREFIX + "\\n" 前缀判定(压缩摘要以用户消息形态回注);
- collect_annotated_user_messages:经 parse_turn_item 取真实用户消息(上下文片段/摘要
  排除),Preserve 保留源 id 供 rollback 关联,Regenerate 置空重建;
- insert_initial_context_before_last_real_user_or_summary 四级插入点规则:
  最后真实用户消息 > 最后用户形态项(摘要) > 最后 compaction 项 > 追加末尾;
  AgentMessage 以 FINAL_ANSWER 开头视为完成消息,不作为插入点;
- build_compacted_history:20_000 token 预算从最新往旧选取,超预算截断后停止,
  逆序还原时间线;摘要空则落 "(no summary available)";摘要项为 user 角色
  contextual fragment,内容种类 compaction.summary。

判定跳过(耦合证据):
- drain_to_completed / compact 会话驱动:async 流消费与 ModelClientSession;
- compaction_status_from_result:Session 状态机回调;
- ContentItemKind 标注系统完整面:以 content_item_kinds 字段等价记录。
"""
from __future__ import annotations

from dataclasses import dataclass

from app.core.stream_events import parse_turn_item

COMPACT_USER_MESSAGE_MAX_TOKENS = 20_000
SUMMARY_PREFIX = (
    "Another language model started to solve this problem and produced a summary of its "
    "thinking process. You also have access to the state of the tools that were used by "
    "that language model. Use this to build on the work that has already been done and "
    "avoid duplicating work. Here is the summary produced by the other language model, "
    "use the information in this summary to assist with your own analysis:"
)
SUMMARY_PLACEHOLDER = "(no summary available)"
COMPACTION_SUMMARY_CONTENT_KIND = "compaction.summary"
FINAL_ANSWER_PREFIX = "Message Type: FINAL_ANSWER\n"


def content_items_to_text(content: list[dict[str, object]]) -> str | None:
    """文本项拼接(\\n 连接,跳过图像/音频与空串);无文本项返 None。"""
    pieces = [
        str(item["text"])
        for item in content
        if item.get("type") in ("input_text", "output_text")
        and isinstance(item.get("text"), str)
        and item["text"] != ""
    ]
    return "\n".join(pieces) if pieces else None


def is_summary_message(message: str) -> bool:
    return message.startswith(SUMMARY_PREFIX + "\n")


@dataclass
class CompactedUserMessage:
    """保留源身份(rollback 关联用);Regenerate 身份时置空 id。"""

    id: str | None
    message: str
    internal_chat_message_metadata_passthrough: dict[str, object] | None = None
    harness_metadata: dict[str, object] | None = None


def _user_message_text(turn: dict[str, object]) -> str:
    """UserMessage::message() 等价:拼接 content 中 text 项(\\n 连接)。"""
    content = turn.get("content")
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        pieces = [
            str(part.get("text", ""))
            for part in content
            if isinstance(part, dict) and part.get("type") == "text"
        ]
        return "\n".join(pieces)
    return ""


def _compacted_user_message(
    item: dict[str, object], harness_metadata: dict[str, object] | None
) -> CompactedUserMessage | None:
    turn = parse_turn_item(item)
    if turn is None or turn.get("type") != "user_message":
        return None
    message = _user_message_text(turn)
    if is_summary_message(message):
        return None
    item_id = item.get("id")
    passthrough = item.get("internal_chat_message_metadata_passthrough")
    return CompactedUserMessage(
        id=item_id if isinstance(item_id, str) else None,
        message=message,
        internal_chat_message_metadata_passthrough=(
            passthrough if isinstance(passthrough, dict) else None
        ),
        harness_metadata=harness_metadata,
    )


def collect_annotated_user_messages(
    envelopes: list[dict[str, object]], regenerate_identity: bool = False
) -> list[CompactedUserMessage]:
    """从信封列表收集真实用户消息;regenerate_identity=True 时全部置空 id。"""
    messages: list[CompactedUserMessage] = []
    for envelope in envelopes:
        item = envelope.get("item")
        if not isinstance(item, dict):
            continue
        metadata = envelope.get("metadata")
        message = _compacted_user_message(item, metadata if isinstance(metadata, dict) else None)
        if message is None:
            continue
        if regenerate_identity:
            message.id = None
        messages.append(message)
    return messages


def insert_initial_context_before_last_real_user_or_summary(
    compacted_history: list[dict[str, object]],
    initial_context: list[dict[str, object]],
) -> list[dict[str, object]]:
    """四级插入点规则(Codex 原注释):最后真实用户消息 > 最后用户形态项(摘要)>
    最后 compaction 项 > 追加末尾;FINAL_ANSWER 完成消息不算插入点。返回新列表。"""
    last_user_or_summary_index: int | None = None
    last_real_user_index: int | None = None
    for i in range(len(compacted_history) - 1, -1, -1):
        envelope = compacted_history[i]
        item = envelope.get("item")
        if not isinstance(item, dict):
            continue
        if item.get("type") == "agent_message":
            content = item.get("content")
            first_text = ""
            if isinstance(content, list) and content and isinstance(content[0], dict):
                first_text = str(content[0].get("text", ""))
            if not first_text.startswith(FINAL_ANSWER_PREFIX):
                last_real_user_index = i
                break
            continue
        turn = parse_turn_item(item)
        if turn is None or turn.get("type") != "user_message":
            continue
        message = _user_message_text(turn)
        if last_user_or_summary_index is None:
            last_user_or_summary_index = i
        if not is_summary_message(message):
            last_real_user_index = i
            break
    last_compaction_index: int | None = None
    for i in range(len(compacted_history) - 1, -1, -1):
        item = compacted_history[i].get("item")
        if isinstance(item, dict) and item.get("type") in ("compaction", "context_compaction"):
            last_compaction_index = i
            break
    insertion_index = (
        last_real_user_index
        if last_real_user_index is not None
        else (last_user_or_summary_index if last_user_or_summary_index is not None else last_compaction_index)
    )
    result = list(compacted_history)
    if insertion_index is not None:
        result[insertion_index:insertion_index] = initial_context
    else:
        result.extend(initial_context)
    return result


def _approx_token_count(text: str) -> int:
    """Codex approx_token_count:4 字节/token 启发式向上取整(UTF-8 字节)。"""
    return (len(text.encode("utf-8")) + 3) // 4


def _truncate_text_to_tokens(text: str, max_tokens: int) -> str:
    """按 token 预算截断文本(近似:保留前 max_tokens*4 字节,不截断到半个字符中间)。"""
    budget = max_tokens * 4
    encoded = text.encode("utf-8")
    if len(encoded) <= budget:
        return text
    truncated = encoded[:budget]
    while truncated:
        try:
            return truncated.decode("utf-8")
        except UnicodeDecodeError:
            truncated = truncated[:-1]
    return ""


def build_compacted_history(
    initial_context: list[dict[str, object]],
    user_messages: list[CompactedUserMessage],
    summary_text: str,
    max_tokens: int = COMPACT_USER_MESSAGE_MAX_TOKENS,
) -> list[dict[str, object]]:
    """从最新往旧按 token 预算选取用户消息(超预算截断后停止),逆序还原时间线;
    追加压缩摘要项(user 角色 contextual fragment,种类 compaction.summary);
    摘要为空落 "(no summary available)"。"""
    history: list[dict[str, object]] = list(initial_context)
    selected: list[CompactedUserMessage] = []
    if max_tokens > 0:
        remaining = max_tokens
        for message in reversed(user_messages):
            if remaining == 0:
                break
            tokens = _approx_token_count(message.message)
            if tokens <= remaining:
                selected.append(message)
                remaining -= tokens
            else:
                selected.append(
                    CompactedUserMessage(
                        id=message.id,
                        message=_truncate_text_to_tokens(message.message, remaining),
                        internal_chat_message_metadata_passthrough=message.internal_chat_message_metadata_passthrough,
                        harness_metadata=message.harness_metadata,
                    )
                )
                break
        selected.reverse()

    for message in selected:
        history.append(
            {
                "type": "message",
                "id": message.id,
                "role": "user",
                "content": [{"type": "input_text", "text": message.message}],
                "internal_chat_message_metadata_passthrough": message.internal_chat_message_metadata_passthrough,
            }
        )

    summary = summary_text if summary_text else SUMMARY_PLACEHOLDER
    history.append(
        {
            "type": "message",
            "role": "user",
            "content": [{"type": "input_text", "text": summary}],
            "content_item_kinds": [COMPACTION_SUMMARY_CONTENT_KIND],
        }
    )
    return history
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
