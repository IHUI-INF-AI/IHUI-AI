# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""Cursor 会话存储解析器(D28,2026-09-20 立;同日按上游实证重写)。

**为什么重写**:首版按 `composerData` 内联 `allMessages` + `role` 字段实现,而经多个独立
读库实现与真实 dump 核对证实 —— 现网 Cursor 的 `composerData:<id>` 行里**没有正文也没有
role**,只有一个有序索引 `fullConversationHeadersOnly: [{bubbleId, type}]`,正文另存在
`bubbleId:<composerId>:<bubbleId>` 行里,角色是**数字** `type`(1=user,2=assistant)。
照旧实现会让真实 Cursor 库解析出 0 会话,故按实证重做取数路径。

三张载体的分工(CONFIRMED):
- `cursorDiskKV` — 正文:`composerData:<id>` / `bubbleId:<cid>:<bid>` / `messageRequestContext:<cid>:<…>`
- `ItemTable` — 索引:`composer.composerHeaders` → `{allComposers:[{composerId,…}]}`;
  老版纯聊天 `workbench.panel.aichat.view.aichat.chatdata` → `tabs[].bubbles[]`
- `composerHeaders` 表 — Cursor 3.11.x 起把索引搬进独立表(composerId/value 两列)

部分 value 带 `buffers:` 前缀(容忍剥离)或以 BLOB 存放;会话时间戳是 epoch **毫秒**
(字段名 `createdAt` / `lastUpdatedAt`),气泡的 `createdAt`(ISO)仅新版本有。
`capabilityType` 15 = 工具调用(折成一行骨架),22/30 = 占位(跳过)。
"""

from __future__ import annotations

import json
import os
import sqlite3
from typing import Any

from .ir import (
    MAX_CONVERSATIONS,
    Conversation,
    Message,
    ParseResult,
    decode_text,
    iter_json_records,
    message,
    to_iso,
)

__all__ = ["parse"]

_SQLITE_SUFFIXES = frozenset({".vscdb", ".sqlite", ".db"})
_BLOB_PREFIX = "buffers:"
_COMPOSER_PREFIX = "composerdata"  # key 大小写不定,统一按小写前缀匹配
_BUBBLE_PREFIX = "bubbleid:"
_HEADERS_KEYS = ("fullConversationHeadersOnly", "conversation")
_BUBBLE_ROLES = {1: "user", 2: "assistant"}
_TOOL_CAPABILITY = 15
_PLACEHOLDER_CAPABILITIES = frozenset({22, 30})
_LEGACY_CHATDATA_KEY = "workbench.panel.aichat.view.aichat.chatdata"
_COMPOSER_INDEX_KEY = "composer.composerheaders"
_MESSAGE_LIST_KEYS = ("allMessages", "messages", "requests")


def parse(data: bytes, filename: str) -> ParseResult:
    """按后缀分派:SQLite 状态库 / NDJSON(cursor-agent 转写)/ JSON 导出。"""
    ext = os.path.splitext(filename)[1].lower()
    if ext in _SQLITE_SUFFIXES:
        return _parse_sqlite(data)
    if ext == ".jsonl":
        return _parse_agent_transcript(data)
    return _parse_json(data)


# ---------------------------------------------------------------------------
# SQLite 载体
# ---------------------------------------------------------------------------


def _parse_sqlite(data: bytes) -> ParseResult:
    result = ParseResult()
    conn = sqlite3.connect(":memory:")
    try:
        try:
            conn.deserialize(data)
            store = _Store(conn)
            composers = store.prefixed(_COMPOSER_PREFIX)
            bubbles = store.prefixed(_BUBBLE_PREFIX)
            index = store.json_value(_COMPOSER_INDEX_KEY)
            legacy = store.json_value(_LEGACY_CHATDATA_KEY)
        except sqlite3.Error as exc:
            result.warnings.append(f"会话库无法读取(不是有效的 SQLite 或已损坏):{exc}")
            return result
    finally:
        conn.close()

    bubble_rows = _index_bubbles(bubbles)
    for key, raw in composers:
        if len(result.conversations) >= MAX_CONVERSATIONS:
            result.warnings.append(f"会话库过大,仅解析前 {MAX_CONVERSATIONS} 个会话")
            break
        obj = _loads(raw)
        if not isinstance(obj, dict):
            continue
        conv = _composer_conversation(obj, _composer_id(key), bubble_rows)
        if conv is not None:
            result.conversations.append(conv)

    if not result.conversations and isinstance(legacy, (dict, list)):
        result.conversations = _legacy_chatdata(legacy)

    if not result.conversations:
        if composers or bubbles:
            result.warnings.append(
                f"读到 {len(composers)} 条 composer 与 {len(bubbles)} 条 bubble 记录,"
                "但未能组装出消息(正文可能已加密或字段版本不匹配)"
            )
        elif isinstance(index, dict):
            result.warnings.append("会话库里只有 composer 索引,没有 composerData 正文行")
        else:
            result.warnings.append(
                "会话库里没有 composer 记录,请确认上传的是 Cursor 的 state.vscdb"
                "(Cursor 聊天在 globalStorage 下,不在工作区 state.vscdb)"
            )
    return result


class _Store:
    """(key, value) 双列表的只读视图:兼容 ItemTable / cursorDiskKV / composerHeaders。"""

    def __init__(self, conn: sqlite3.Connection) -> None:
        self._conn = conn
        self._tables = _discover_kv_tables(conn)

    def prefixed(self, lower_prefix: str) -> list[tuple[str, Any]]:
        """取 key 小写后以指定前缀开头的行(各表合并,保持读取顺序)。"""
        out: list[tuple[str, Any]] = []
        for table, key_col, value_col in self._tables:
            try:
                rows = self._conn.execute(
                    f"SELECT {_quote(key_col)}, {_quote(value_col)} FROM {_quote(table)}"
                )
                for key, value in rows:
                    if isinstance(key, str) and key.lower().startswith(lower_prefix):
                        out.append((key, value))
            except sqlite3.Error:
                continue
        return out

    def json_value(self, lower_key: str) -> Any:
        """按小写 key 精确取一条记录并尝试解析成 JSON。"""
        for table, key_col, value_col in self._tables:
            try:
                row = self._conn.execute(
                    f"SELECT {_quote(value_col)} FROM {_quote(table)} "
                    f"WHERE LOWER({_quote(key_col)}) = ?",
                    (lower_key,),
                ).fetchone()
            except sqlite3.Error:
                continue
            if row is not None:
                return _loads(row[0])
        return None


def _discover_kv_tables(conn: sqlite3.Connection) -> list[tuple[str, str, str]]:
    """找出所有具备"键列 + 值列"的表(键列 key/k/composerId,值列 value/v)。"""
    found: list[tuple[str, str, str]] = []
    for (table,) in conn.execute("SELECT name FROM sqlite_master WHERE type='table'"):
        name = str(table)
        try:
            cols = [str(row[1]) for row in conn.execute(f"PRAGMA table_info({_quote(name)})")]
        except sqlite3.Error:
            continue
        lowered = {c.lower(): c for c in cols}
        key_col = (
            lowered.get("key") or lowered.get("k") or lowered.get("composerid")
        )
        value_col = lowered.get("value") or lowered.get("v")
        if key_col and value_col:
            found.append((name, key_col, value_col))
    return found


def _quote(identifier: str) -> str:
    """SQLite 标识符转义(表/列名来自上传文件,不得拼进裸 SQL)。"""
    return '"' + identifier.replace('"', '""') + '"'


def _composer_id(key: str) -> str:
    """composerData:<id> / composerData-<id> → <id>。"""
    tail = key.split(":", 1)[-1] if ":" in key else key.split("-", 1)[-1]
    return tail


def _index_bubbles(rows: list[tuple[str, Any]]) -> dict[str, dict[str, Any]]:
    """bubbleId:<composerId>:<bubbleId> → 该 composer 下的有序气泡字典。"""
    out: dict[str, dict[str, Any]] = {}
    for key, raw in rows:
        parts = key.split(":")
        if len(parts) < 3:
            continue
        obj = _loads(raw)
        if isinstance(obj, dict):
            out[f"{parts[1]}:{parts[2]}"] = obj
    return out


def _composer_conversation(
    obj: dict[str, Any], composer_id: str, bubble_rows: dict[str, dict[str, Any]]
) -> Conversation | None:
    """一个 composerData 对象 + 全局气泡表 → IR 会话(索引顺序即会话顺序)。"""
    conv = Conversation(
        created_at=to_iso(obj.get("createdAt") or obj.get("created_at")),
        updated_at=to_iso(obj.get("lastUpdatedAt") or obj.get("updatedAt")),
    )
    for key in ("name", "title"):
        value = obj.get(key)
        if isinstance(value, str) and value.strip():
            conv.title = value.strip()
            break

    conv.model = _composer_model(obj, composer_id, bubble_rows)

    messages: list[Message] = []
    headers = next((obj[k] for k in _HEADERS_KEYS if isinstance(obj.get(k), list)), None)
    if headers:
        # 索引数组的顺序就是会话顺序,逐条回查 bubbleId 正文
        for header in headers:
            source = _header_source(header, composer_id, bubble_rows)
            if source is None:
                continue
            entry = _bubble_message(source)
            if entry is not None:
                messages.append(entry)
    else:
        # 没有索引数组时按气泡自带时间排序兜底(孤儿气泡约占 17%,缺 createdAt 则不可靠)
        messages = _orphan_messages(composer_id, bubble_rows)

    conv.messages = messages
    return conv if conv.messages else None


def _header_source(
    header: Any, composer_id: str, bubble_rows: dict[str, dict[str, Any]]
) -> dict[str, Any] | None:
    """索引项 → 消息来源:优先取正文气泡,老版内联文本(header 自带 text)直接用。"""
    if not isinstance(header, dict):
        return None
    bubble_id = header.get("bubbleId")
    bubble: dict[str, Any] | None = None
    if isinstance(bubble_id, str):
        bubble = bubble_rows.get(f"{composer_id}:{bubble_id}")
    return {**header, **(bubble or {})}


def _composer_model(
    obj: dict[str, Any], composer_id: str, bubble_rows: dict[str, dict[str, Any]]
) -> str | None:
    """模型优先取 composer 的 modelConfig,退化时取首个带 modelInfo 的气泡。"""
    config = obj.get("modelConfig")
    if isinstance(config, dict):
        for key in ("modelModel", "modelName", "model"):
            value = config.get(key)
            if isinstance(value, str) and value.strip():
                return value.strip()
    for key, bubble in bubble_rows.items():
        if key.startswith(f"{composer_id}:"):
            value = _model_of(bubble)
            if value:
                return value
    return None


def _model_of(source: dict[str, Any]) -> str | None:
    info = source.get("modelInfo")
    if isinstance(info, dict) and isinstance(info.get("modelName"), str):
        return info["modelName"].strip() or None
    return None


def _bubble_message(source: dict[str, Any]) -> Message | None:
    """气泡对象 → 消息:数字 type 定角色,capabilityType 决定是工具/占位/正文。"""
    capability = source.get("capabilityType")
    if isinstance(capability, int) and capability in _PLACEHOLDER_CAPABILITIES:
        return None
    raw_type = source.get("type")
    role = _BUBBLE_ROLES.get(raw_type) if isinstance(raw_type, int) else None
    if role is None:
        raw_role = source.get("role")
        role = raw_role if isinstance(raw_role, str) else ""

    text: Any = source.get("text") or source.get("rawText")
    if isinstance(capability, int) and capability == _TOOL_CAPABILITY:
        text = _tool_line(source)
    if not isinstance(text, str) or not text.strip():
        return None
    return message(role, text, to_iso(source.get("createdAt")))


def _tool_line(source: dict[str, Any]) -> str:
    tool = source.get("toolFormerData")
    if not isinstance(tool, dict):
        return "[工具调用]"
    name = tool.get("name")
    return f"[工具调用] {name}" if isinstance(name, str) and name.strip() else "[工具调用]"


def _orphan_messages(composer_id: str, bubble_rows: dict[str, dict[str, Any]]) -> list[Message]:
    prefix = f"{composer_id}:"
    owned = [
        (bubble.get("createdAt"), bubble)
        for key, bubble in bubble_rows.items()
        if key.startswith(prefix)
    ]
    if any(stamp is None for stamp, _ in owned):
        return []  # 缺时间戳时顺序不可靠,宁可不导也不给错序
    owned.sort(key=lambda pair: str(pair[0]))
    out: list[Message] = []
    for _stamp, bubble in owned:
        msg = _bubble_message(bubble)
        if msg is not None:
            out.append(msg)
    return out


def _legacy_chatdata(payload: Any) -> list[Conversation]:
    """老版 aichat 载体:`{tabs:[{bubbles:[{type:"user"|"ai", rawText|text}]}]}`。"""
    tabs = payload.get("tabs") if isinstance(payload, dict) else payload
    if not isinstance(tabs, list):
        return []
    out: list[Conversation] = []
    for tab in tabs:
        bubbles = tab.get("bubbles") if isinstance(tab, dict) else None
        if not isinstance(bubbles, list):
            continue
        conv = Conversation()
        for bubble in bubbles:
            if not isinstance(bubble, dict):
                continue
            kind = bubble.get("type")
            role = "user" if kind == "user" else "assistant" if kind == "ai" else ""
            msg = _bubble_message({**bubble, "role": role})
            if msg is not None:
                conv.messages.append(msg)
        if conv.messages:
            out.append(conv)
    return out


# ---------------------------------------------------------------------------
# JSON / NDJSON 载体
# ---------------------------------------------------------------------------


def _parse_agent_transcript(data: bytes) -> ParseResult:
    """cursor-agent 的 `~/.cursor/projects/<cwd>/agent-transcripts/<id>/<id>.jsonl`。

    一行一轮:`{role:"user"|"assistant", message:{content:[{type:"text",text}|
    {type:"tool_use"}]}}`;`turn_ended` 等控制行忽略。
    """
    result = ParseResult()
    records, corrupt = iter_json_records(decode_text(data))
    if corrupt:
        result.warnings.append(f"{corrupt} 行 JSON 无法解析已跳过")
    conv = Conversation()
    for record in records:
        if not isinstance(record, dict) or not isinstance(record.get("role"), str):
            continue
        payload = record.get("message")
        body = payload.get("content") if isinstance(payload, dict) else record.get("content")
        msg = message(str(record["role"]), _text_of(body), to_iso(record.get("timestamp")))
        if msg is not None:
            conv.messages.append(msg)
    if conv.messages:
        result.conversations = [conv]
    else:
        result.warnings.append("NDJSON 中未找到 {role, message.content} 形态的轮次记录")
    return result


def _parse_json(data: bytes) -> ParseResult:
    result = ParseResult()
    try:
        payload = json.loads(decode_text(data).strip())
    except ValueError:
        result.warnings.append("JSON 无法解析,请确认导出文件完整且未超过体积上限")
        return result
    result.conversations = _collect(payload)
    if not result.conversations:
        result.warnings.append(
            "未在 JSON 中识别到会话结构;若这是 state.vscdb 请改传该文件,"
            "若只有 composerData 导出则缺少 bubbleId 正文行"
        )
    return result


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
    """内联消息列表形态的会话对象(自研导出/老版 conversation 数组)。"""
    if not isinstance(obj, dict):
        return None
    raw_messages = next(
        (obj[k] for k in _MESSAGE_LIST_KEYS if isinstance(obj.get(k), list) and obj.get(k)),
        None,
    )
    if raw_messages is None and not any(isinstance(obj.get(k), list) for k in _HEADERS_KEYS):
        return None

    conv = Conversation(
        created_at=to_iso(obj.get("createdAt") or obj.get("created_at")),
        updated_at=to_iso(obj.get("lastUpdatedAt") or obj.get("updatedAt")),
    )
    for key in ("name", "title"):
        value = obj.get(key)
        if isinstance(value, str) and value.strip():
            conv.title = value.strip()
            break
    if isinstance(obj.get("model"), str):
        conv.model = obj["model"]

    source_list: list[Any] = raw_messages if isinstance(raw_messages, list) else []
    for key in _HEADERS_KEYS:
        if isinstance(obj.get(key), list) and not source_list:
            source_list = obj[key]
    for index, item in enumerate(source_list):
        msg = _json_entry(item, index)
        if msg is not None:
            conv.messages.append(msg)
    return conv if conv.messages else None


def _json_entry(item: Any, index: int) -> Message | None:
    if isinstance(item, str):
        return message(_infer_role(index), item)
    if not isinstance(item, dict):
        return None
    if isinstance(item.get("type"), int):
        return _bubble_message(item)
    role = item.get("role")
    if not isinstance(role, str) or role not in ("user", "assistant", "system"):
        role = _infer_role(index)
    text = item.get("text")
    if not isinstance(text, str) or not text.strip():
        text = _text_of(item.get("content"))
    return message(role, text, to_iso(item.get("createdAt")))


def _infer_role(index: int) -> str:
    return "user" if index % 2 == 0 else "assistant"


def _loads(raw: Any) -> Any:
    """把 value 还原成对象:兼容 BLOB、`buffers:` 前缀与字符串化 JSON。"""
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


def _text_of(content: Any) -> str:
    if isinstance(content, str):
        return content
    if not isinstance(content, list):
        return ""
    parts: list[str] = []
    for block in content:
        if isinstance(block, dict) and block.get("type") in ("text", "input_text", "output_text"):
            text = block.get("text")
            if isinstance(text, str) and text.strip():
                parts.append(text)
    return "\n\n".join(parts)
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
