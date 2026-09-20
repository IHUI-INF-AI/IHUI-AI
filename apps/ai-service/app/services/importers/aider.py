# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""Aider 会话导出解析器(D28,2026-09-20 立)。

载体:
- `.md`(`.aider.chat.history.md`):一次会话以 `# aider chat started at
  YYYY-MM-DD HH:MM:SS` 开头;`>` 前缀行是用户输入(aider 把自己的回显命令也写成
  `>`,一并作为用户内容),`#### ` 前缀是 aider 的状态行(从中提取模型名),
  其余正文归 assistant。
- `.json` / `.jsonl`(`.aider.chat.record.json`):标准 messages 数组,或带
  `messages` 字段的对象。

Markdown 路径必须跳过代码围栏内的 `>` 行 —— 模型输出里的引用块否则会被误判成
用户提问,把一条消息劈成两条。
"""

from __future__ import annotations

import json
import os
import re
from datetime import UTC, datetime
from typing import Any

from .ir import Conversation, Message, ParseResult, decode_text, message, to_iso

__all__ = ["parse"]

_CHAT_HEADER = re.compile(r"^#\s*aider chat started at\s+(?P<stamp>.+?)\s*$", re.IGNORECASE)
_MODEL_HINT = re.compile(r"models?\s*[:：]\s*([A-Za-z0-9._/:@+-]+)", re.IGNORECASE)
_TIMESTAMP_FORMATS = ("%Y-%m-%d %H:%M:%S", "%Y-%m-%d_%H-%M-%S", "%Y-%m-%d")
_FENCE = "```"


def parse(data: bytes, filename: str) -> ParseResult:
    """按后缀分派 Markdown 与 JSON 两种 aider 导出格式。"""
    ext = os.path.splitext(filename)[1].lower()
    if ext in (".json", ".jsonl"):
        return _parse_json(data)
    return _parse_markdown(decode_text(data))


def _parse_markdown(text: str) -> ParseResult:
    result = ParseResult()
    blocks: list[tuple[str, list[str]]] = []
    conversations: list[Conversation] = []
    created_at: str | None = None
    model: str | None = None
    in_fence = False

    def close_conversation() -> None:
        conv = _build(blocks, created_at, model)
        if conv is not None:
            conversations.append(conv)

    for line in text.splitlines():
        header = None if in_fence else _CHAT_HEADER.match(line)
        if header is not None:
            close_conversation()
            blocks = []
            created_at = _header_stamp(header.group("stamp"))
            model = None
            in_fence = False
            continue

        if line.strip().startswith(_FENCE):
            in_fence = not in_fence
        elif not in_fence and line.startswith("#") and not line.startswith("##"):
            # 单井号是会话标题外的分节符,aider 未用它承载正文
            continue

        if not in_fence and line.startswith("####"):
            found = _MODEL_HINT.search(line)
            if found and model is None:
                model = found.group(1)
            continue

        role = "user" if (not in_fence and line.startswith(">")) else "assistant"
        body = line[1:].lstrip() if role == "user" else line
        if blocks and blocks[-1][0] == role:
            blocks[-1][1].append(body)
        else:
            blocks.append((role, [body]))

    close_conversation()
    result.conversations = conversations
    if not conversations:
        result.warnings.append("Markdown 中未识别到 aider 会话段落(> 前缀的用户输入)")
    return result


def _build(
    blocks: list[tuple[str, list[str]]], created_at: str | None, model: str | None
) -> Conversation | None:
    conv = Conversation(created_at=created_at, model=model)
    for role, lines in blocks:
        msg = message(role, "\n".join(lines), created_at if role == "user" else None)
        if msg is not None:
            conv.messages.append(msg)
    return conv if conv.messages else None


def _header_stamp(raw: str) -> str | None:
    """aider 的会话头时间无时区,按 UTC 定性(仅作展示与排序,不参与校验)。"""
    for fmt in _TIMESTAMP_FORMATS:
        try:
            parsed = datetime.strptime(raw, fmt).replace(tzinfo=UTC)
        except ValueError:
            continue
        return parsed.isoformat().replace("+00:00", "Z")
    return to_iso(raw)


def _parse_json(data: bytes) -> ParseResult:
    result = ParseResult()
    try:
        payload: Any = json.loads(decode_text(data).strip())
    except ValueError:
        result.warnings.append("JSON 无法解析,请确认导出文件完整")
        return result

    payloads = payload if isinstance(payload, list) else [payload]
    for item in payloads:
        conv = _conversation(item)
        if conv is not None:
            result.conversations.append(conv)
    if not result.conversations:
        result.warnings.append("JSON 中未找到 messages 数组(role/content)")
    return result


def _conversation(obj: Any) -> Conversation | None:
    if not isinstance(obj, dict):
        return None
    raw = obj.get("messages")
    if isinstance(raw, dict):
        raw = raw.get("messages")
    if not isinstance(raw, list) or not raw:
        return None

    conv = Conversation(
        created_at=to_iso(obj.get("created") or obj.get("createdAt")),
        updated_at=to_iso(obj.get("updated") or obj.get("updatedAt")),
    )
    for key in ("title", "chat_history_title", "filename"):
        value = obj.get(key)
        if isinstance(value, str) and value.strip():
            conv.title = value.strip()
            break
    if isinstance(obj.get("model"), str):
        conv.model = obj["model"]
    for item in raw:
        msg = _entry(item)
        if msg is not None:
            conv.messages.append(msg)
    return conv if conv.messages else None


def _entry(item: Any) -> Message | None:
    if not isinstance(item, dict):
        return None
    role = item.get("role")
    if not isinstance(role, str):
        return None
    raw_content = item.get("content")
    if not isinstance(raw_content, str):
        fallback = item.get("message")
        raw_content = fallback if isinstance(fallback, str) else ""
    return message(role, raw_content, to_iso(item.get("timestamp") or item.get("createdAt")))
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
