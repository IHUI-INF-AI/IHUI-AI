# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""ChatGPT 网页版会话导出解析器(E2,2026-10-30 立)。

输入形态:ChatGPT「设置 → 全部导出」得到的 conversations.json —— 顶层数组,每项形如
`{title, create_time, update_time, mapping:{nodeId:{message:{...}, parent, children}}}`。

消息树在 mapping 里平铺,必须从 root(parent 为 null 的节点)沿 children 深度优先
展开成线性消息序列;重新生成产生的兄弟分支按 children 原顺序全部展开 —— 未走通的
分支同样有正文,保留比丢弃更符合"迁入即用"。visited 集合兜住导出损坏时的环引用。

message 的两代形态都要容忍:
- 旧:`{role, content:{content_type:'text'|'code'|'multi_content', text|parts}}`
- 新:`{author:{role, metadata:{model}}, content:{...}}`(模型名只在新形态出现)

无 message 节点(root 占位)与 system 角色跳过;非文本块(slider/visual/文件等)
落 `[非文本内容: 类型]` 占位说明,不静默丢弃。create_time/update_time 为 epoch 秒,
统一 `to_iso` 归一。健壮性对齐其余来源的写法:逐字段 isinstance 判型容忍坏数据,
单条会话/单条消息形状不对只跳过该条,不中断整批。
"""

from __future__ import annotations

import json
from typing import Any

from .ir import Conversation, ParseResult, decode_text, message, to_iso

__all__ = ["parse"]


def parse(data: bytes, filename: str) -> ParseResult:
    """解析 ChatGPT conversations.json 为 IR 会话列表。"""
    del filename  # ChatGPT 导出只有 conversations.json 一种载体
    result = ParseResult()
    try:
        payload: Any = json.loads(decode_text(data).strip())
    except ValueError:
        result.warnings.append("JSON 无法解析,请确认 ChatGPT 导出文件完整")
        return result
    if not isinstance(payload, list):
        result.warnings.append("顶层不是会话数组,请确认是 ChatGPT 官方导出 conversations.json")
        return result

    skipped_nodes = 0
    placeholders = 0
    for item in payload:
        conv, node_skips, ph = _conversation(item)
        skipped_nodes += node_skips
        placeholders += ph
        if conv is not None:
            result.conversations.append(conv)
    if skipped_nodes:
        result.warnings.append(f"{skipped_nodes} 个节点(system/无正文/形状异常)已跳过")
    if placeholders:
        result.warnings.append(f"{placeholders} 处非文本内容已用占位说明代替")
    if not result.conversations:
        result.warnings.append("未解析到任何会话,请确认导出文件来自 ChatGPT「导出数据」")
    return result


def _conversation(obj: Any) -> tuple[Conversation | None, int, int]:
    """单条会话 → (IR 会话 | None, 跳过节点数, 非文本占位数)。"""
    if not isinstance(obj, dict):
        return None, 0, 0
    mapping = obj.get("mapping")
    if not isinstance(mapping, dict) or not mapping:
        return None, 0, 0

    conv = Conversation(
        title=_title(obj.get("title")),
        created_at=to_iso(obj.get("create_time")),
        updated_at=to_iso(obj.get("update_time")),
    )
    skipped = 0
    placeholders = 0
    visited: set[str] = set()
    # root 判据:parent 为 null;全树无 root(导出损坏)时整条会话放弃,不猜顺序
    stack = [
        node_id
        for node_id in reversed(list(mapping))
        if isinstance(mapping.get(node_id), dict) and mapping[node_id].get("parent") is None
    ]
    if not stack:
        return None, 0, 0

    while stack:
        node_id = stack.pop()
        if node_id in visited:
            continue
        visited.add(node_id)
        node = mapping.get(node_id)
        if not isinstance(node, dict):
            skipped += 1
            continue
        children = node.get("children")
        if isinstance(children, list):
            stack.extend(reversed([c for c in children if isinstance(c, str)]))

        payload = node.get("message")
        if not isinstance(payload, dict):
            continue  # root 占位节点没有 message,属正常树形,不计异常
        role = _role(payload)
        if role is None:
            skipped += 1
            continue
        content = payload.get("content")
        text, ph = _render(content)
        placeholders += ph
        msg = message(role, text, to_iso(node.get("create_time")))
        if msg is None:
            skipped += 1
            continue
        conv.messages.append(msg)
        if conv.model is None:
            conv.model = _model(payload, content)

    return (conv if conv.messages else None), skipped, placeholders


def _title(value: Any) -> str | None:
    return value.strip() if isinstance(value, str) and value.strip() else None


def _role(payload: dict[str, Any]) -> str | None:
    """两代形态取角色;system 与未知角色一律跳过(与任务口径一致,不进会话)。"""
    author = payload.get("author")
    role = author.get("role") if isinstance(author, dict) else payload.get("role")
    return role if isinstance(role, str) and role in ("user", "assistant") else None


def _model(payload: dict[str, Any], content: Any) -> str | None:
    """新形态模型名在 author.metadata.model,部分版本落在 content.model。"""
    author = payload.get("author")
    if isinstance(author, dict):
        meta = author.get("metadata")
        if isinstance(meta, dict) and isinstance(meta.get("model"), str) and meta["model"].strip():
            return meta["model"].strip()
    if isinstance(content, dict) and isinstance(content.get("model"), str) and content["model"].strip():
        return content["model"].strip()
    return None


def _render(content: Any) -> tuple[str, int]:
    """content 对象 → (文本, 非文本占位数);未知 content_type 整体占位。"""
    if not isinstance(content, dict):
        return "", 0
    ctype = content.get("content_type")
    if ctype in ("text", "code"):
        text = content.get("text")
        return (text if isinstance(text, str) else ""), 0
    if ctype == "multi_content":
        parts = content.get("parts")
        if not isinstance(parts, list):
            return "", 0
        lines: list[str] = []
        placeholders = 0
        for part in parts:
            if (
                isinstance(part, dict)
                and part.get("content_type") == "text"
                and isinstance(part.get("text"), str)
            ):
                lines.append(part["text"])
            else:
                placeholders += 1
                kind = part.get("content_type") if isinstance(part, dict) else "unknown"
                lines.append(f"[非文本内容: {kind}]")
        return "\n".join(lines), placeholders
    if ctype is None:
        # 无 content_type 的旧变体:退而取顶层 text
        text = content.get("text")
        return (text if isinstance(text, str) else ""), 0
    return f"[非文本内容: {ctype}]", 1
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
