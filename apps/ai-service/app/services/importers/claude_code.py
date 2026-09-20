# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""Claude Code 会话导出解析器(D28,2026-09-20 立)。

输入形态:`~/.claude/projects/<项目路径转写>/<sessionId>.jsonl`(JSONL,一次会话一个
文件,也可能把多段会话拼接进同一份导出),或同结构的 `.json` 数组。

记录形态(逐条 `{type, message, uuid, parentUuid, timestamp, sessionId, isSidechain,
isMeta}`):
- `type` = user / assistant,正文在 `message.content`(字符串或 content block 数组)
- `type` = summary,`{summary, leafUuid}` 是给该会话起的标题
- sidechain(子 agent 分支)与 isMeta(本地命令输出注入)不属于主线对话,跳过

只取 text block:tool_use / tool_result / thinking 是执行过程而非会话文本,导入后
既读不出上下文也会撑爆体积,故不落地。
"""

from __future__ import annotations

from typing import Any

from .ir import Conversation, ParseResult, decode_text, iter_json_records, message, to_iso

__all__ = ["parse"]


def parse(data: bytes, filename: str) -> ParseResult:
    """解析 Claude Code 导出为 IR 会话列表。"""
    del filename  # Claude Code 只有 JSON/JSONL 一种载体,无需按后缀分支
    records, corrupt = iter_json_records(decode_text(data))
    result = ParseResult()
    if corrupt:
        result.warnings.append(f"{corrupt} 行 JSON 无法解析已跳过")

    sessions: dict[str, Conversation] = {}
    last_uuid: dict[str, str] = {}
    summaries: dict[str, str] = {}

    for record in records:
        if not isinstance(record, dict):
            continue
        rtype = record.get("type")
        if rtype == "summary":
            _collect_summary(record, summaries)
            continue
        if rtype not in ("user", "assistant") or record.get("isSidechain") or record.get("isMeta"):
            continue

        session_id = str(record.get("sessionId") or "default")
        conv = sessions.get(session_id)
        if conv is None:
            conv = Conversation()
            sessions[session_id] = conv

        payload = record.get("message")
        if not isinstance(payload, dict):
            continue
        raw_role = payload.get("role")
        role = raw_role if isinstance(raw_role, str) else str(rtype)
        text = _text_of(payload.get("content"))
        msg = message(role, text, to_iso(record.get("timestamp")))
        if msg is None:
            continue
        conv.messages.append(msg)
        if isinstance(payload.get("model"), str) and not conv.model:
            conv.model = payload["model"]
        if isinstance(record.get("uuid"), str):
            last_uuid[session_id] = record["uuid"]

    for session_id, conv in sessions.items():
        title = summaries.get(last_uuid.get(session_id, ""))
        if title:
            conv.title = title
    result.conversations = list(sessions.values())
    return result


def _collect_summary(record: dict[str, Any], summaries: dict[str, str]) -> None:
    """summary 记录挂在会话最后一个 uuid 上,先暂存待收尾时回填标题。"""
    leaf = record.get("leafUuid")
    summary = record.get("summary")
    if isinstance(leaf, str) and isinstance(summary, str) and summary.strip():
        summaries[leaf] = summary.strip()


def _text_of(content: Any) -> str:
    """把 message.content 归一成纯文本(字符串直取;数组只拼 text block)。"""
    if isinstance(content, str):
        return content
    if not isinstance(content, list):
        return ""
    parts: list[str] = []
    for block in content:
        if isinstance(block, dict) and block.get("type") == "text":
            text = block.get("text")
            if isinstance(text, str) and text.strip():
                parts.append(text)
    return "\n\n".join(parts)
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
