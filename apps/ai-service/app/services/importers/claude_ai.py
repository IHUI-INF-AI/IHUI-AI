# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""Claude.ai 网页版会话导出解析器(E2,2026-10-30 立)。

输入形态:Claude「设置 → 导出数据」解包后目录内的一批 `conversation-*.json`,
每个文件形如 `{summary, conversation_uuid, chat_messages:[{sender:'human'|
'assistant', text, uuid, created_at, content}]}`,`chat_messages` 正序即对话顺序。
CLI/Web 一次上传一个文件;为兼容用户手工把多个会话拼进一个 JSON 数组的情况,
顶层是数组时逐条展开(与 aider 的 JSON 兜底路径同一处理)。

字段容错(真机导出跨版本有差异):
- 正文优先取 `text`;缺失时退 `content` —— 它既可能是字符串,也可能是
  `[{type:'text', text}]` 块数组,非文本块(工具结果/图片等)落
  `[非文本内容: 类型]` 占位,不静默丢弃。
- `sender` 只有 human/assistant 两个合法值,未知发送者跳过并计数。
- `created_at` 为 ISO 字符串,统一 `to_iso` 归一;`summary` 作标题。

健壮性对齐其余来源:逐字段 isinstance 判型,单条消息/单个会话形状异常只跳过
该条,不中断整批。
"""

from __future__ import annotations

from typing import Any

from .ir import Conversation, ParseResult, decode_text, iter_json_records, message, to_iso

__all__ = ["parse"]

_SENDER_ROLES = {"human": "user", "assistant": "assistant"}


def parse(data: bytes, filename: str) -> ParseResult:
    """解析 Claude.ai conversation-*.json 为 IR 会话列表。"""
    del filename  # 载体只有 JSON 一种(单对象或数组),后缀不影响解析路径
    result = ParseResult()
    records, corrupt = iter_json_records(decode_text(data))
    if corrupt:
        result.warnings.append(f"{corrupt} 行 JSON 无法解析已跳过")

    skipped_senders = 0
    skipped_messages = 0
    placeholders = 0
    for record in records:
        conv, sender_skips, msg_skips, ph = _conversation(record)
        skipped_senders += sender_skips
        skipped_messages += msg_skips
        placeholders += ph
        if conv is not None:
            result.conversations.append(conv)

    if skipped_senders:
        result.warnings.append(f"{skipped_senders} 条消息发送者不是 human/assistant,已跳过")
    if skipped_messages:
        result.warnings.append(f"{skipped_messages} 条消息无正文或形状异常,已跳过")
    if placeholders:
        result.warnings.append(f"{placeholders} 处非文本内容已用占位说明代替")
    if not result.conversations:
        result.warnings.append("未解析到任何会话,请确认是 Claude.ai 导出的 conversation-*.json")
    return result


def _conversation(obj: Any) -> tuple[Conversation | None, int, int, int]:
    """单个 conversation 对象 → (IR 会话 | None, 未知发送者, 跳过消息, 占位数)。"""
    if not isinstance(obj, dict):
        return None, 0, 0, 0
    raw = obj.get("chat_messages")
    if not isinstance(raw, list) or not raw:
        return None, 0, 0, 0

    summary = obj.get("summary")
    conv = Conversation(
        title=summary.strip() if isinstance(summary, str) and summary.strip() else None,
        created_at=to_iso(obj.get("created_at")),
        updated_at=to_iso(obj.get("updated_at")),
    )
    sender_skips = 0
    msg_skips = 0
    placeholders = 0
    for item in raw:
        if not isinstance(item, dict):
            msg_skips += 1
            continue
        sender = item.get("sender")
        role = _SENDER_ROLES.get(sender) if isinstance(sender, str) else None
        if role is None:
            sender_skips += 1
            continue
        text, ph = _render(item)
        placeholders += ph
        msg = message(role, text, to_iso(item.get("created_at") or item.get("timestamp")))
        if msg is None:
            msg_skips += 1
            continue
        conv.messages.append(msg)
        if conv.model is None and isinstance(item.get("model"), str) and item["model"].strip():
            conv.model = item["model"].strip()

    return (conv if conv.messages else None), sender_skips, msg_skips, placeholders


def _render(item: dict[str, Any]) -> tuple[str, int]:
    """消息正文:优先 text 字段,缺失时从 content(字符串或块数组)提取。"""
    text = item.get("text")
    if isinstance(text, str) and text.strip():
        return text, 0
    content = item.get("content")
    if isinstance(content, str):
        return content, 0
    if isinstance(content, list):
        lines: list[str] = []
        placeholders = 0
        for block in content:
            if (
                isinstance(block, dict)
                and block.get("type") == "text"
                and isinstance(block.get("text"), str)
            ):
                lines.append(block["text"])
            else:
                placeholders += 1
                kind = block.get("type") if isinstance(block, dict) else "unknown"
                lines.append(f"[非文本内容: {kind}]")
        return "\n".join(lines), placeholders
    return "", 0
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
