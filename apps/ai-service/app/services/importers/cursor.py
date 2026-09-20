# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""Cursor 会话导出解析器(D28,2026-09-20 立)。

两种载体:
- `.json`:Cursor 导出/整理的 composer 数据 —— 可能是 `{conversations|chats: [...]}`、
  单个 composer 对象,或 key→JSON 字符串的扁平映射
- `.vscdb` / `.sqlite` / `.db`:`state.vscdb`(SQLite)。会话存在具备 key/value 两列的
  表里(`ItemTable`、`cursorDiskKV`),key 形如 `composerData-<id>`;部分版本 value 带
  `buffers:` 前缀且以 BLOB 存储

composer 对象:`{name|title, createdAt, updatedAt, allMessages|messages}`,时间戳为
epoch 毫秒;消息缺 role 时按 user/assistant 交替推断(Cursor 严格成对存储)。

只读反序列化到内存库,不落临时文件、绝不写回上传内容。
"""

from __future__ import annotations

import json
import os
import sqlite3
from typing import Any

from .ir import (
    MAX_CONVERSATIONS,
    VALID_ROLES,
    Conversation,
    Message,
    ParseResult,
    decode_text,
    message,
    to_iso,
)

__all__ = ["parse"]

_SQLITE_SUFFIXES = frozenset({".vscdb", ".sqlite", ".db"})
_COMPOSER_HINT = "composer"
_BLOB_PREFIX = "buffers:"
_MESSAGE_LIST_KEYS = ("allMessages", "messages", "requests")


def parse(data: bytes, filename: str) -> ParseResult:
    """按文件后缀分派 JSON 导出与 SQLite 会话库两条解析路径。"""
    ext = os.path.splitext(filename)[1].lower()
    if ext in _SQLITE_SUFFIXES:
        return _parse_sqlite(data)
    return _parse_json(data)


def _parse_json(data: bytes) -> ParseResult:
    result = ParseResult()
    try:
        payload = json.loads(decode_text(data).strip())
    except ValueError:
        result.warnings.append("JSON 无法解析,请确认导出文件完整且未超过体积上限")
        return result
    result.conversations = _collect(payload)
    if not result.conversations:
        result.warnings.append("未在 JSON 中识别到 composer 会话结构(allMessages/messages)")
    return result


def _parse_sqlite(data: bytes) -> ParseResult:
    result = ParseResult()
    conn = sqlite3.connect(":memory:")
    try:
        try:
            conn.deserialize(data)
            rows = _read_composer_rows(conn)
        except sqlite3.Error as exc:
            result.warnings.append(f"会话库无法读取(不是有效的 SQLite 或已损坏):{exc}")
            return result
    finally:
        conn.close()

    for _key, raw in rows:
        obj = _loads(raw)
        if obj is None:
            continue
        result.conversations.extend(_collect(obj))
        if len(result.conversations) >= MAX_CONVERSATIONS:
            result.warnings.append(f"会话库过大,仅解析前 {MAX_CONVERSATIONS} 个会话")
            break
    if not result.conversations:
        result.warnings.append("会话库中没有 key 含 composer 的记录")
    return result


def _read_composer_rows(conn: sqlite3.Connection) -> list[tuple[str, Any]]:
    """枚举具备 key/value 两列的表,取出 composer 记录(上限 MAX_CONVERSATIONS 条)。"""
    rows: list[tuple[str, Any]] = []
    for (table,) in conn.execute("SELECT name FROM sqlite_master WHERE type='table'"):
        columns = _columns(conn, str(table))
        lowered = {name.lower(): name for name in columns}
        key_col = lowered.get("key") or lowered.get("k")
        value_col = lowered.get("value") or lowered.get("v")
        if not key_col or not value_col:
            continue
        try:
            fetched = conn.execute(
                f"SELECT {_quote(key_col)}, {_quote(value_col)} FROM {_quote(str(table))}"
            )
            for key, value in fetched:
                if isinstance(key, str) and _COMPOSER_HINT in key.lower():
                    rows.append((key, value))
                    if len(rows) >= MAX_CONVERSATIONS:
                        return rows
        except sqlite3.Error:
            continue
    return rows


def _columns(conn: sqlite3.Connection, table: str) -> list[str]:
    return [str(row[1]) for row in conn.execute(f"PRAGMA table_info({_quote(table)})")]


def _quote(identifier: str) -> str:
    """SQLite 标识符转义(表/列名来自上传文件,不得拼进裸 SQL)。"""
    return '"' + identifier.replace('"', '""') + '"'


def _loads(raw: Any) -> Any:
    """把 value 列还原成对象:兼容 BLOB、`buffers:` 前缀与纯字符串。"""
    if isinstance(raw, memoryview):
        raw = bytes(raw)
    if isinstance(raw, bytes):
        raw = raw.decode("utf-8", errors="replace")
    if not isinstance(raw, str) or not raw.strip():
        return None
    text = raw.strip()
    if text.startswith(_BLOB_PREFIX):
        text = text[len(_BLOB_PREFIX) :]
    if text[0] not in "[{":
        return None
    try:
        return json.loads(text)
    except ValueError:
        return None


def _collect(payload: Any) -> list[Conversation]:
    """从任意嵌套形态里收出会话对象(对象/数组/字符串化 JSON 都支持)。"""
    if isinstance(payload, str):
        return _collect(_loads(payload))
    if isinstance(payload, list):
        out: list[Conversation] = []
        for item in payload:
            conv = _conversation(item)
            if conv is not None:
                out.append(conv)
            else:
                out.extend(_collect(item))
        return out
    if isinstance(payload, dict):
        conv = _conversation(payload)
        if conv is not None:
            return [conv]
        out = []
        for value in payload.values():
            if isinstance(value, (dict, list, str)):
                out.extend(_collect(value))
        return out
    return []


def _conversation(obj: Any) -> Conversation | None:
    """把单个 composer 对象转成 IR;不含消息列表时返回 None 交给上层继续下探。"""
    if not isinstance(obj, dict):
        return None
    raw_messages = next(
        (obj[k] for k in _MESSAGE_LIST_KEYS if isinstance(obj.get(k), list) and obj.get(k)),
        None,
    )
    if raw_messages is None:
        return None

    conv = Conversation(
        created_at=to_iso(obj.get("createdAt") or obj.get("created_at")),
        updated_at=to_iso(obj.get("updatedAt") or obj.get("updated_at")),
    )
    for key in ("name", "title"):
        value = obj.get(key)
        if isinstance(value, str) and value.strip():
            conv.title = value.strip()
            break
    if isinstance(obj.get("model"), str):
        conv.model = obj["model"]

    for index, item in enumerate(raw_messages):
        msg = _entry(item, index)
        if msg is not None:
            conv.messages.append(msg)
    return conv if conv.messages else None


def _entry(item: Any, index: int) -> Message | None:
    """单条 composer 消息 → IR 消息;缺 role 时按下标奇偶推断。"""
    if isinstance(item, str):
        return message(_infer_role(index), item)
    if not isinstance(item, dict):
        return None
    role = item.get("role")
    if not isinstance(role, str) or role not in VALID_ROLES:
        role = _infer_role(index)
    text = item.get("text")
    if not isinstance(text, str) or not text.strip():
        text = _text_of(item.get("content"))
    return message(role, text, to_iso(item.get("createdAt")))


def _infer_role(index: int) -> str:
    return "user" if index % 2 == 0 else "assistant"


def _text_of(content: Any) -> str:
    if isinstance(content, str):
        return content
    if not isinstance(content, list):
        return ""
    parts: list[str] = []
    for block in content:
        if isinstance(block, dict):
            text = block.get("text")
            if isinstance(text, str) and text.strip():
                parts.append(text)
    return "\n\n".join(parts)
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
