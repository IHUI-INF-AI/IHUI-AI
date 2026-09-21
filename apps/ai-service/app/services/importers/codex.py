# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""OpenAI Codex CLI 会话导出解析器(D28,2026-09-20 立;同日按上游 Rust 源码二次修订)。

输入形态:`~/.codex/sessions/YYYY/MM/DD/rollout-<UTC时间>-<thread_id>.jsonl`,或同结构的
`.json` 数组。逐行 `{timestamp, ordinal?, type, payload}`;顶层 `type` 的权威枚举取自
`codex-rs/history`(session_meta / response_item / event_msg / turn_context / compacted /
inter_agent_communication / token_usage_record / world_state / retained_context /
security_risk_score / realtime_item 等),承载**可见会话文本**的只有三条:

- `response_item` 且 `payload.type` ∈ {`message`, `agent_message`} —— 权威通道
- `event_msg` —— UI 事件流:新版 `item_completed{item:{type:"UserMessage"|"AgentMessage",
  content:[{type:"Text",text}]}}`,旧版 `user_message`/`agent_message`{message:str},
  另有 `task_complete.last_agent_message`
- `compacted{message:str}` —— 上下文压缩摘要,按 system 落地

不承载正文的(reasoning / function_call / function_call_output / token_count /
thread_settings_applied / turn_aborted / world_state …)忽略;`role:"developer"` 是注入
指令(upstream 的持久化策略也显式过滤它),`inter_agent_communication` 是多智能体内部
通信 —— 两者各自聚合成一条告警,不静默吞掉。

三条设计决定(每条都有踩坑理由):
1. **一个文件一条会话**:上游 `recorder.rs` 明确"文件中途再出现的 session_meta 是 fork
   带进来的父线程历史,取首条即可,后续条目原样保留"。按 session_meta 切分会把一条线程
   炸成 N 条,故只认首条的时间戳。
2. **单条有序流水 + 通道标记**:`response_item` 与 `event_msg` 描述同一批文本(Legacy 与
   Paginated 两种落盘形态都会双写),因此以 `response_item` 为权威、仅在它一条都没有时
   回退 `event_msg`;而 `compacted` 归入 `note` 通道**永远保留**。早先"两条流水各自收集、
   最后二选一"的写法会让所有带 response_item 的 rollout 丢掉全部压缩摘要。
3. 内容块类型用闭集白名单(text / input_text / output_text,大小写归一后比较),不用
   "类型名含 text" 的开放匹配 —— 后者会静默吸收未来任何 *_text 块。
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

_CHANNEL_ITEM = "item"  # response_item(权威通道)
_CHANNEL_EVENT = "event"  # event_msg(回退通道)
_CHANNEL_NOTE = "note"  # compacted(始终保留)

# 旧版 event_msg 的直白命名(新版是 item_completed + payload.item)
_LEGACY_EVENT_ROLES = {"user_message": "user", "agent_message": "assistant"}

# item_completed.payload.item.type → 角色(CamelCase 标签,归一后比较)
_ITEM_ROLES = {"usermessage": "user", "agentmessage": "assistant"}

# 可见文本块类型闭集:response_item 用 snake_case,AgentMessageContent 用 `Text`
_TEXT_BLOCK_TYPES = frozenset({"text", "input_text", "output_text"})

# Codex 以 user 角色注入的环境/指令上下文,不属于用户输入
_INJECTED_PREFIXES = (
    "<environment_context>",
    "<user_instructions>",
    "<permissions instructions>",
    "<turn_aborted>",
    "<system-reminder>",
)


@dataclass(slots=True)
class _Entry:
    """一条消息 + 它来自哪个通道,用于事后按通道择优且保持原始顺序。"""

    channel: str
    message: Message


@dataclass(slots=True)
class _Draft:
    """单条 rollout 的中间态。"""

    created_at: str | None = None
    model: str | None = None
    entries: list[_Entry] = field(default_factory=list)


def parse(data: bytes, filename: str) -> ParseResult:
    """解析 Codex rollout 为 IR 会话列表(一个文件一条会话)。"""
    del filename  # rollout 恒为 JSON/JSONL 载体,后缀不影响解析路径
    records, corrupt = iter_json_records(decode_text(data))
    result = ParseResult()
    if corrupt:
        result.warnings.append(f"{corrupt} 行 JSON 无法解析已跳过")

    draft = _Draft()
    developer_skipped = 0
    inter_agent_skipped = 0

    for record in records:
        if not isinstance(record, dict):
            continue
        rtype = record.get("type")
        stamp = to_iso(record.get("timestamp"))
        payload = record.get("payload") if isinstance(record.get("payload"), dict) else None

        if rtype == "session_meta":
            # 中途再出现的是 fork 复制来的父线程 meta:只认首条,绝不另起会话
            if draft.created_at is None:
                draft.created_at = stamp or _meta_timestamp(payload)
            continue

        if rtype == "turn_context" and payload is not None and draft.model is None:
            model = payload.get("model")
            if isinstance(model, str) and model.strip():
                draft.model = model.strip()
            continue

        if rtype == "event_msg" and payload is not None:
            _collect_event(draft, payload, stamp)
            continue

        if rtype == "compacted":
            summary = payload.get("message") if payload else record.get("message")
            _push(draft, _CHANNEL_NOTE, "system", summary, stamp)
            continue

        if rtype in ("inter_agent_communication", "inter_agent_communication_metadata"):
            inter_agent_skipped += 1
            continue

        if rtype == "response_item" and payload is not None:
            ptype = payload.get("type")
            if ptype == "message":
                role = str(payload.get("role") or "")
                if role == "developer":
                    developer_skipped += 1
                    continue
                _push(draft, _CHANNEL_ITEM, role, payload.get("content"), stamp)
            elif ptype == "agent_message":
                _push(draft, _CHANNEL_ITEM, "assistant", payload.get("content"), stamp)
            continue

        if isinstance(record.get("role"), str):
            # 旧版/裸 item 导出:记录本身就是一条 message
            _push(draft, _CHANNEL_ITEM, str(record["role"]), record.get("content"), stamp)

    if developer_skipped:
        result.warnings.append(f"{developer_skipped} 条 developer 注入指令未纳入导入")
    if inter_agent_skipped:
        result.warnings.append(f"{inter_agent_skipped} 条 agent 间通信未纳入导入(多智能体线程)")

    conv = _to_conversation(draft)
    if conv is not None:
        result.conversations = [conv]
    elif records:
        result.warnings.append("rollout 里没有可见会话文本(可能只有工具执行与遥测事件)")
    return result


def _collect_event(draft: _Draft, payload: dict[str, Any], stamp: str | None) -> None:
    """event_msg 通道取文本(新版 item_completed / 旧版 *_message / task_complete)。"""
    kind = payload.get("type")
    if kind == "task_complete":
        _push(draft, _CHANNEL_EVENT, "assistant", payload.get("last_agent_message"), stamp)
        return

    item = payload.get("item")
    if kind == "item_completed" and isinstance(item, dict):
        role = _ITEM_ROLES.get(str(item.get("type") or "").lower())
        if role:
            body = item.get("content") or item.get("text") or item.get("message")
            _push(draft, _CHANNEL_EVENT, role, body, stamp)
        return

    body = payload.get("message")
    if isinstance(body, str):
        role = _LEGACY_EVENT_ROLES.get(str(kind), "")
        _push(draft, _CHANNEL_EVENT, role, body, stamp)


def _push(draft: _Draft, channel: str, role: str, text: Any, stamp: str | None) -> None:
    """角色白名单 + 注入上下文过滤 + 空正文丢弃后,按通道追加进有序流水。"""
    if role not in VALID_ROLES:
        return
    body = text if isinstance(text, str) else _text_of(text)
    if role == "user" and body.lstrip().startswith(_INJECTED_PREFIXES):
        return
    msg = message(role, body, stamp)
    if msg is not None:
        draft.entries.append(_Entry(channel=channel, message=msg))


def _text_of(content: Any) -> str:
    """Codex content block 数组 → 纯文本(闭集白名单,大小写归一后比较)。"""
    if isinstance(content, str):
        return content
    if not isinstance(content, list):
        return ""
    parts: list[str] = []
    for block in content:
        if not isinstance(block, dict):
            continue
        if str(block.get("type") or "").lower() not in _TEXT_BLOCK_TYPES:
            continue
        text = block.get("text")
        if isinstance(text, str) and text.strip():
            parts.append(text)
    return "\n\n".join(parts)


def _meta_timestamp(payload: dict[str, Any] | None) -> str | None:
    if payload is None:
        return None
    return to_iso(payload.get("timestamp"))


def _to_conversation(draft: _Draft) -> Conversation | None:
    """通道择优:item 有内容就用 item,否则退到 event;note(压缩摘要)恒保留且保序。"""
    if not draft.entries:
        return None
    wanted = _CHANNEL_ITEM if any(e.channel == _CHANNEL_ITEM for e in draft.entries) else (
        _CHANNEL_EVENT
    )
    messages = [e.message for e in draft.entries if e.channel in (wanted, _CHANNEL_NOTE)]
    if not messages:
        return None
    return Conversation(messages=messages, model=draft.model, created_at=draft.created_at)
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
