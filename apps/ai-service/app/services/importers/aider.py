# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""Aider 会话导出解析器(D28,2026-09-20 立;同日按 aider 上游源码 + 真实历史文件重写)。

**为什么重写**:首版把 `> ` 当用户输入、把 `####` 当 aider 状态行 —— 恰好反了。
aider 的写出端(`io.user_input()` 以 `prefix="####"` 落用户消息;blockquote 形态的 `> `
只用于 tool 消息/报错/offer/版本横幅)与它自己的参考切分器(`aider/utils.py`:
`"# "` 跳过、`"> "` 归 tool、`"#### "` 归 user、其余归 assistant)一致证实:
`####` 才是用户,`> ` 是 aider 自说自话。照旧实现的后果是「导入结果里一条真实用户提问
都没有,全是报错和版本横幅」。

真实历史文件另证实:模型名在 `> Main model: <name> with …` 这种 **blockquote 行**上
(不在 `####` 行),且行尾带 markdown 硬换行(两个空格),必须清掉。

载体:
- `.aider.chat.history.md`:一次会话以 `# aider chat started at YYYY-MM-DD HH:MM:SS`
  (本地时间、无时区)开头,单个文件可含多段会话。
- `.json` / `.jsonl`:aider 上游**不产**这种文件(全局代码搜索 0 命中)。此处只作为通用
  `{messages:[{role,content}]}` 数组的兜底入口,给自研导出/手工整理的 JSON 留路。

代码围栏(```)内的行一律不参与前缀判定 —— aider 自己不做这件事,会把模型输出里的引用块
误切成用户提问,我们保留这个改进。
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
_USER_PREFIX = "####"
_ECHO_PREFIX = ">"
_FENCE = "```"
# 模型名优先取 Main model,退化才认 Editor/Weak/通用 Model:
_MAIN_MODEL = re.compile(r"^\s*>\s*main\s+model\s*[:：]\s*([\w.:/@+-]+)", re.IGNORECASE)
_ANY_MODEL = re.compile(r"^\s*>\s*(?:editor|weak)?\s*model\s*[:：]\s*([\w.:/@+-]+)", re.IGNORECASE)
_TIMESTAMP_FORMATS = ("%Y-%m-%d %H:%M:%S", "%Y-%m-%d_%H-%M-%S", "%Y-%m-%d")


def parse(data: bytes, filename: str) -> ParseResult:
    """按后缀分派:Markdown 主路径与通用 JSON 兜底路径。"""
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
    echoes = 0
    in_fence = False

    def close() -> None:
        conv = _build(blocks, created_at, model)
        if conv is not None:
            conversations.append(conv)

    for line in text.splitlines():
        header = None if in_fence else _CHAT_HEADER.match(line)
        if header is not None:
            close()
            blocks = []
            created_at = _header_stamp(header.group("stamp"))
            model = None
            in_fence = False
            continue

        if line.strip().startswith(_FENCE):
            in_fence = not in_fence
        elif not in_fence and line.startswith("#") and not line.startswith("##"):
            continue  # 非会话头的单井号分节符,aider 不用它承载正文

        if not in_fence and line.startswith(_ECHO_PREFIX):
            # aider 自身回显(报错/版本/模型横幅):不进会话,只从里面捞模型名
            echoes += 1
            if model is None:
                model = _model_of(line)
            continue

        if not in_fence and line.startswith(_USER_PREFIX):
            role = "user"
            body = line[len(_USER_PREFIX) :].strip()
        else:
            role = "assistant"
            body = line
        if blocks and blocks[-1][0] == role:
            blocks[-1][1].append(body)
        else:
            blocks.append((role, [body]))

    close()
    result.conversations = conversations
    if echoes:
        result.warnings.append(f"{echoes} 行 aider 自身回显(报错/版本/模型横幅)未纳入会话")
    if not conversations:
        result.warnings.append("Markdown 中未识别到 aider 会话段落(#### 前缀的用户输入)")
    return result


def _model_of(line: str) -> str | None:
    for pattern in (_MAIN_MODEL, _ANY_MODEL):
        found = pattern.match(line)
        if found:
            return str(found.group(1)).strip() or None
    return None


def _build(
    blocks: list[tuple[str, list[str]]], created_at: str | None, model: str | None
) -> Conversation | None:
    conv = Conversation(created_at=created_at, model=model)
    for role, lines in blocks:
        # aider 的 markdown 硬换行是行尾两个空格,逐行清掉;连续同角色行属同一条消息
        body = "\n".join(line.rstrip() for line in lines).strip()
        msg = message(role, body, created_at if role == "user" else None)
        if msg is not None:
            conv.messages.append(msg)
    return conv if conv.messages else None


def _header_stamp(raw: str) -> str | None:
    """aider 会话头是本地时间无时区,按 UTC 定性(仅影响展示与排序,不参与校验)。"""
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
