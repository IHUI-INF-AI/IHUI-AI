# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""流事件工具与回合项映射(对标 Codex Rust)。

2026-09-19 第三十一批,对标 Codex stream_events_utils.rs/event_mapping.rs

本模块为 codex-rs → Python 移植的纯函数切片,覆盖两件事:
1. stream_events_utils.rs 中可移植的纯逻辑:
   - 助手正文抽取(raw_assistant_output_text_from_item / last_assistant_message_from_item)
   - 隐藏标记去噪(strip_citations / strip_proposed_plan_blocks /
     strip_hidden_assistant_markup)
   - 外部上下文判定(response_item_may_include_external_context /
     completed_item_defers_mailbox_delivery_to_next_turn)
   - 输入项→响应项转换(response_input_to_response_item)
   - 流文本增量聚合 / delta 合并 / 去噪(StreamTextBuffer 及配套函数)
2. event_mapping.rs 中可移植的纯逻辑:
   - 上下文片段判定(is_contextual_* / has_non_contextual_dev_message_content)
   - 用户/助手消息解析(parse_user_message / parse_agent_message)
   - 事件→回合项映射(parse_turn_item:用户消息 / 助手消息 / 工具调用判定)

设计约束:
- 全部为函数式纯实现(无 IO、无全局可变状态、无 asyncio),仅依赖标准库。
- 我们侧 ResponseItem / TurnItem 一律用 dict 形态(对齐 OpenAI 消息/事件格式),
  不触碰 session_store.py 的 Pydantic 模型。
- 与 app/core/sse_buffer.py 的 SSEEventBuffer(事件级断线重连重放)互补而非重复:
  本模块的 StreamTextBuffer 面向单条助手正文的增量文本 delta 合并。
- 以下内容因强依赖 Session / DB / 工具路由 / 扩展机制而显式跳过(证据见模块尾注释):
  record_completed_response_item*、mark_thread_memory_mode_polluted_*、
  handle_output_item_done、apply_turn_item_contributors、finalize_turn_item(异步/IO 侧)、
  HandleOutputCtx/OutputItemResult 结构体、parse_visible_hook_prompt_message(来自 context.rs)、
  web_search_action_detail 仅作精简实现。
"""

from __future__ import annotations

import re
import uuid
from typing import Any, Iterable, Optional

# ---------------------------------------------------------------------------
# 类型别名:我们侧统一以 dict 表达 Rust 的枚举/结构体
# ---------------------------------------------------------------------------
ContentItem = dict[str, Any]
ResponseItem = dict[str, Any]
UserInput = dict[str, Any]
TurnItem = dict[str, Any]
ResponseInputItem = dict[str, Any]
MemoryCitation = dict[str, Any]


# ===========================================================================
# 一、隐藏标记去噪(对标 stream_events_utils.rs: strip_citations 等)
# ===========================================================================

# 引用标签(精简自 codex_utils_stream_parser::strip_citations)
_CITE_TAG_RE = re.compile(r"<cite\b[^>]*>.*?</cite>", re.DOTALL)
# 计划模式下 proposed plan 块(精简自 strip_proposed_plan_blocks)
_PLAN_BLOCK_RE = re.compile(r"<proposed_plan\b[^>]*>.*?</proposed_plan>", re.DOTALL)
# 记忆引用(精简自 codex_memories_read::citations::parse_memory_citation)
_MEMORY_CITATION_RE = re.compile(r"\[memory:([\w-]+)\]")


def strip_citations(text: str) -> tuple[str, list[str]]:
    """去除引用标签,返回(可见文本, 被移除的引用片段列表)。

    对应 Rust `strip_citations(text) -> (String, Vec<...>)` 的可见文本侧。
    """
    citations: list[str] = []

    def _repl(match: re.Match[str]) -> str:
        citations.append(match.group(0))
        return ""

    stripped = _CITE_TAG_RE.sub(_repl, text)
    return stripped, citations


def strip_proposed_plan_blocks(text: str) -> str:
    """去除计划模式下的 proposed plan 块(对应 Rust 同名函数)。"""
    return _PLAN_BLOCK_RE.sub("", text)


def strip_hidden_assistant_markup(text: str, plan_mode: bool) -> str:
    """去除助手文本中隐藏的标记(引用 + 可选的计划块)。

    对应 Rust `strip_hidden_assistant_markup(text, plan_mode)`。
    """
    without_citations, _ = strip_citations(text)
    if plan_mode:
        return strip_proposed_plan_blocks(without_citations)
    return without_citations


def parse_memory_citation(citations: list[str]) -> Optional[MemoryCitation]:
    """从引用片段中解析记忆引用(精简自 codex_memories_read::citations)。"""
    for citation in citations:
        match = _MEMORY_CITATION_RE.search(citation)
        if match is not None:
            return {"id": match.group(1)}
    return None


def strip_hidden_assistant_markup_and_parse_memory_citation(
    text: str, plan_mode: bool
) -> tuple[str, Optional[MemoryCitation]]:
    """去噪并解析记忆引用(对应 Rust 同名函数)。

    Returns:
        (可见文本, 记忆引用或 None)
    """
    without_citations, citations = strip_citations(text)
    visible_text = (
        strip_proposed_plan_blocks(without_citations) if plan_mode else without_citations
    )
    return visible_text, parse_memory_citation(citations)


# ===========================================================================
# 二、助手正文抽取(对标 stream_events_utils.rs: raw_assistant_output_text_from_item)
# ===========================================================================


def raw_assistant_output_text_from_item(item: ResponseItem) -> Optional[str]:
    """从 ResponseItem 抽取助手正文。

    仅当 item 为 role=assistant 的 message 时,拼接其 content 中类型为
    `output_text` 的片段文本;否则返回 None(对应 Rust 同名函数)。
    """
    if item.get("type") == "message" and item.get("role") == "assistant":
        content = item.get("content", []) or []
        parts: list[str] = [
            str(ci.get("text", "") or "")
            for ci in content
            if ci.get("type") == "output_text"
        ]
        return "".join(parts)
    return None


def last_assistant_message_from_item(item: ResponseItem, plan_mode: bool) -> Optional[str]:
    """返回经去噪后的最后一条助手可见文本(空文本归约为 None)。

    对应 Rust `last_assistant_message_from_item(item, plan_mode)`:
    抽取原始正文→去噪→trim 为空则视为无。
    """
    combined = raw_assistant_output_text_from_item(item)
    if combined is None or combined == "":
        return None
    stripped = strip_hidden_assistant_markup(combined, plan_mode)
    if stripped.strip() == "":
        return None
    return stripped


# ===========================================================================
# 三、外部上下文 / 邮件箱延迟判定(对标 stream_events_utils.rs)
# ===========================================================================

_EXTERNAL_CONTEXT_TYPES: frozenset[str] = frozenset(
    {"tool_search_call", "tool_search_output", "web_search_call"}
)


def response_item_may_include_external_context(item: ResponseItem) -> bool:
    """判断响应项是否可能携带外部上下文(对应 Rust 同名函数)。

    包括工具搜索调用/输出、网络搜索调用,以及 call_id 为空的 function_call_output。
    """
    item_type = item.get("type")
    if item_type in _EXTERNAL_CONTEXT_TYPES:
        return True
    if item_type == "function_call_output" and item.get("call_id") is None:
        return True
    return False


def completed_item_defers_mailbox_delivery_to_next_turn(
    item: ResponseItem, plan_mode: bool
) -> bool:
    """判断已完成响应项是否应将邮件箱投递推迟到下一轮(对应 Rust 同名函数)。

    仅对 role=assistant 且 phase != commentary 的 message 生效;
    `None` phase 视为最终答案文本,按更安全的「推迟」处理。
    """
    if item.get("type") == "message":
        if item.get("role") != "assistant" or item.get("phase") == "commentary":
            return False
        return last_assistant_message_from_item(item, plan_mode) is not None
    return False


# ===========================================================================
# 四、输入项 → 响应项转换(对标 stream_events_utils.rs: response_input_to_response_item)
# ===========================================================================


def response_input_to_response_item(input_item: ResponseInputItem) -> Optional[ResponseItem]:
    """将 ResponseInputItem 转换为等价 ResponseItem(对应 Rust 同名函数)。"""
    item_type = input_item.get("type")
    if item_type == "function_call_output":
        return {
            "type": "function_call_output",
            "id": None,
            "call_id": input_item.get("call_id"),
            "name": None,
            "namespace": None,
            "output": input_item.get("output"),
            "internal_chat_message_metadata_passthrough": None,
        }
    if item_type == "custom_tool_call_output":
        return {
            "type": "custom_tool_call_output",
            "id": None,
            "call_id": input_item.get("call_id"),
            "name": input_item.get("name"),
            "output": input_item.get("output"),
            "internal_chat_message_metadata_passthrough": None,
        }
    if item_type == "mcp_tool_call_output":
        return {
            "type": "function_call_output",
            "id": None,
            "call_id": input_item.get("call_id"),
            "name": None,
            "namespace": None,
            "output": input_item.get("output"),
            "internal_chat_message_metadata_passthrough": None,
        }
    if item_type == "tool_search_output":
        return {
            "type": "tool_search_output",
            "id": None,
            "call_id": input_item.get("call_id"),
            "status": input_item.get("status"),
            "execution": input_item.get("execution"),
            "tools": input_item.get("tools"),
            "internal_chat_message_metadata_passthrough": None,
        }
    return None


# ===========================================================================
# 五、上下文片段判定(对标 event_mapping.rs: is_contextual_* 系列)
# ===========================================================================

# 开发者消息中可回滚裁剪的上下文前缀集(精简自 CONTEXTUAL_DEVELOPER_PREFIXES)
CONTEXTUAL_DEVELOPER_PREFIXES: frozenset[str] = frozenset(
    {
        "<permissions instructions>",
        "<model_switch>",
        "<managed_developer_instructions>",
        "<persistent_mode>",
        "<multi_agent_role>",
        "<git_attribution>",
        "<personality_spec>",
        "<token_budget>",
        "<rollout_budget>",
        "<context_window>",
        "<context_window_guidance>",
        "<apps_instructions>",
        "<collaboration_mode>",
        "<environments_instructions>",
        "<plugins_instructions>",
        "<realtime_conversation>",
        "<skills_instructions>",
        "<tools>",
    }
)

# 用户消息中可识别为上下文片段的前缀集(对标 codex CONTEXTUAL_USER_FRAGMENT_MATCHERS
# 中带文本标记的片段;2026-09-19 第四十批补齐 current_time_reminder/turn_aborted)
USER_CONTEXTUAL_PREFIXES: frozenset[str] = frozenset(
    {
        "<permissions instructions>",
        "<model_switch>",
        "<managed_developer_instructions>",
        "<persistent_mode>",
        "<context_window>",
        "<context_window_guidance>",
        "<current_time_reminder>",
        "<turn_aborted>",
        "<subagent_notification>",
        "<user_verification_notice>",
        "<environment_context>",
    }
)


def is_contextual_dev_fragment(content_item: ContentItem) -> bool:
    """判断单条 content item 是否为开发者上下文片段(对应 Rust 同名私有函数)。"""
    if content_item.get("type") != "input_text":
        return False
    text = str(content_item.get("text", "") or "").lstrip()
    return any(
        text[: len(prefix)].casefold() == prefix.casefold()
        for prefix in CONTEXTUAL_DEVELOPER_PREFIXES
    )


def is_contextual_dev_message_content(message: list[ContentItem]) -> bool:
    """开发者消息是否整体为可回滚裁剪的上下文内容。"""
    return any(is_contextual_dev_fragment(ci) for ci in message)


def has_non_contextual_dev_message_content(message: list[ContentItem]) -> bool:
    """开发者消息是否含有非上下文片段(用于基准失效判定)。"""
    return any(not is_contextual_dev_fragment(ci) for ci in message)


def is_contextual_user_fragment(content_item: ContentItem) -> bool:
    """判断单条 content item 是否为用户上下文片段(本地化精简实现)。"""
    if content_item.get("type") != "input_text":
        return False
    text = str(content_item.get("text", "") or "").lstrip()
    return any(
        text[: len(prefix)].casefold() == prefix.casefold()
        for prefix in USER_CONTEXTUAL_PREFIXES
    )


def is_contextual_user_message_content(message: list[ContentItem]) -> bool:
    """用户消息是否整体为上下文片段。"""
    return any(is_contextual_user_fragment(ci) for ci in message)


# ===========================================================================
# 六、图像/音频标签判定(对标 event_mapping.rs 中的 is_*_tag_text 辅助函数)
# ===========================================================================

_IMAGE_OPEN_TAGS: frozenset[str] = frozenset({"<image>", "<local_image>"})
_IMAGE_CLOSE_TAGS: frozenset[str] = frozenset({"</image>", "</local_image>"})
_AUDIO_OPEN_TAGS: frozenset[str] = frozenset({"<audio>", "<local_audio>"})
_AUDIO_CLOSE_TAGS: frozenset[str] = frozenset({"</audio>", "</local_audio>"})


def is_image_open_tag_text(text: str) -> bool:
    return text.strip() in _IMAGE_OPEN_TAGS


def is_image_close_tag_text(text: str) -> bool:
    return text.strip() in _IMAGE_CLOSE_TAGS


def is_local_image_open_tag_text(text: str) -> bool:
    return text.strip() == "<local_image>"


def is_local_image_close_tag_text(text: str) -> bool:
    return text.strip() == "</local_image>"


def is_audio_open_tag_text(text: str) -> bool:
    return text.strip() in _AUDIO_OPEN_TAGS


def is_audio_close_tag_text(text: str) -> bool:
    return text.strip() in _AUDIO_CLOSE_TAGS


def is_local_audio_open_tag_text(text: str) -> bool:
    return text.strip() == "<local_audio>"


def is_local_audio_close_tag_text(text: str) -> bool:
    return text.strip() == "</local_audio>"


# ===========================================================================
# 七、消息解析(对标 event_mapping.rs: parse_user_message / parse_agent_message)
# ===========================================================================


def _new_id() -> str:
    """生成新的回合项 id(对应 Rust `Uuid::new_v4()`)。"""
    return uuid.uuid4().hex


def parse_user_message(message: list[ContentItem]) -> Optional[UserInput]:
    """解析用户消息 content(对应 Rust `parse_user_message`)。

    若消息整体为上下文片段则返回 None;否则将各 content item 映射为 UserInput 列表。
    图像/音频的开放/闭合标签作为标签被跳过(不进入正文)。
    """
    if is_contextual_user_message_content(message):
        return None

    content: list[dict[str, Any]] = []
    for idx, ci in enumerate(message):
        item_type = ci.get("type")
        if item_type == "input_text":
            text = str(ci.get("text", "") or "")
            is_image_label = (
                (
                    (is_local_image_open_tag_text(text) or is_image_open_tag_text(text))
                    and idx + 1 < len(message)
                    and message[idx + 1].get("type") == "input_image"
                )
                or (
                    idx > 0
                    and (is_local_image_close_tag_text(text) or is_image_close_tag_text(text))
                    and message[idx - 1].get("type") == "input_image"
                )
            )
            is_audio_label = (
                (
                    (is_local_audio_open_tag_text(text) or is_audio_open_tag_text(text))
                    and idx + 1 < len(message)
                    and message[idx + 1].get("type") == "input_audio"
                )
                or (
                    idx > 0
                    and (is_local_audio_close_tag_text(text) or is_audio_close_tag_text(text))
                    and message[idx - 1].get("type") == "input_audio"
                )
            )
            if is_image_label or is_audio_label:
                continue
            content.append({"type": "text", "text": text, "text_elements": []})
        elif item_type == "input_image":
            content.append(
                {"type": "image", "image": ci.get("image"), "detail": ci.get("detail")}
            )
        elif item_type == "input_audio":
            content.append({"type": "audio", "audio_url": ci.get("audio_url")})
        elif item_type == "output_text":
            # 用户消息中出现 output_text 为异常,按 Rust 行为跳过(warn)
            continue
    return {"type": "user_message", "content": content}


def parse_agent_message(
    item_id: Optional[str], message: list[ContentItem], phase: Optional[str]
) -> TurnItem:
    """解析助手消息 content 为 AgentMessage 回合项(对应 Rust `parse_agent_message`)。"""
    content: list[dict[str, Any]] = []
    for ci in message:
        item_type = ci.get("type")
        if item_type in ("input_text", "output_text"):
            content.append({"type": "text", "text": str(ci.get("text", "") or "")})
    return {
        "type": "agent_message",
        "id": item_id or _new_id(),
        "content": content,
        "phase": phase,
        "memory_citation": None,
        "delivery": None,
        "questions": None,
    }


def web_search_action_detail(action: Optional[dict[str, Any]]) -> str:
    """返回 web 搜索查询(精简自 codex web_search::web_search_action_detail)。

    原实现依据 WebSearchAction 枚举推导,此处仅取 action 中的 query/type 作为可读摘要。
    """
    if not isinstance(action, dict):
        return ""
    query = action.get("query")
    if isinstance(query, str) and query:
        return query
    action_type = action.get("type")
    if isinstance(action_type, str):
        return action_type
    return ""


# ===========================================================================
# 八、事件 → 回合项映射(对标 event_mapping.rs: parse_turn_item)
# ===========================================================================


def parse_turn_item(item: ResponseItem) -> Optional[TurnItem]:
    """将 ResponseItem 映射为回合项(用户/助手/推理/工具调用判定)。

    对应 Rust `parse_turn_item`:
    - message(role=user)  → UserMessage(上下文片段时归约为 None)
    - message(role=assistant) → AgentMessage
    - message(role=system) → None
    - reasoning → Reasoning
    - web_search_call → WebSearch
    - image_generation_call → ImageGeneration(无 id 时归约为 None)
    - 其余 → None
    """
    item_type = item.get("type")
    if item_type == "message":
        role = item.get("role")
        content = item.get("content", []) or []
        if role == "user":
            return parse_user_message(content)
        if role == "assistant":
            return parse_agent_message(item.get("id"), content, item.get("phase"))
        return None
    if item_type == "reasoning":
        summary = item.get("summary", []) or []
        summary_text = [
            str(e.get("text", "") or "")
            for e in summary
            if e.get("type") == "summary_text"
        ]
        raw = item.get("content") or []
        raw_content = [
            str(e.get("text", "") or "")
            for e in raw
            if e.get("type") in ("reasoning_text", "text")
        ]
        return {
            "type": "reasoning",
            "id": item.get("id") or "",
            "summary_text": summary_text,
            "raw_content": raw_content,
        }
    if item_type == "web_search_call":
        action = item.get("action") if isinstance(item.get("action"), dict) else None
        return {
            "type": "web_search",
            "id": item.get("id") or "",
            "query": web_search_action_detail(action),
            "action": (action.get("type") if action else None) or "other",
            "results": None,
        }
    if item_type == "image_generation_call":
        item_id = item.get("id")
        if item_id is None:
            return None
        return {
            "type": "image_generation",
            "id": item_id,
            "status": item.get("status"),
            "revised_prompt": item.get("revised_prompt"),
            "result": item.get("result"),
            "saved_path": None,
        }
    return None


# ===========================================================================
# 九、流文本增量聚合 / delta 合并 / 去噪(对标 stream_events_utils.rs 的文本聚合语义)
# ===========================================================================


def aggregate_content_text(content_items: Iterable[ContentItem]) -> str:
    """聚合 content item 列表中的 output_text 文本(对应 raw_assistant_output_text_from_item 的核心语义)。"""
    return "".join(
        str(ci.get("text", "") or "")
        for ci in content_items
        if ci.get("type") == "output_text"
    )


def merge_text_deltas(deltas: Iterable[str]) -> str:
    """合并连续文本 delta(对应流事件中累积助手正文)。"""
    return "".join(deltas)


def denoise_assistant_text(text: str, plan_mode: bool) -> str:
    """对助手文本去噪(对应 strip_hidden_assistant_markup 的对外便捷封装)。"""
    return strip_hidden_assistant_markup(text, plan_mode)


class StreamTextBuffer:
    """流文本缓冲器:累积文本 delta,支持去噪合并与原始快照。

    与 app/core/sse_buffer.py 的 SSEEventBuffer 互补:
    后者面向事件级断线重连重放,本类面向单条助手正文的增量 delta 合并。
    """

    def __init__(self) -> None:
        self._parts: list[str] = []

    def append(self, delta: str) -> None:
        """追加一个文本 delta。"""
        self._parts.append(delta)

    def raw(self) -> str:
        """返回未经去噪的原始累积文本。"""
        return "".join(self._parts)

    def snapshot(self, plan_mode: bool = False) -> str:
        """返回去噪后的当前快照(对应 last_assistant_message_from_item 的去噪路径)。"""
        return denoise_assistant_text(self.raw(), plan_mode)


# ===========================================================================
# 十、跳过清单(显式声明,作为移植审计证据)
# ===========================================================================
# 以下 Rust 符号因强依赖 Session / DB / 工具路由 / 扩展机制 / 跨模块私有函数,
# 在本纯函数切片中显式跳过:
#   - record_completed_response_item*
#       依赖 Session.record_conversation_items / input_queue / state_db(IO)
#   - mark_thread_memory_mode_polluted_if_external_context
#       依赖 state_db::mark_thread_memory_mode_polluted(IO)
#   - record_stage1_output_usage_* / parse_memory_citation 的 DB 侧
#       依赖 codex_state::MemoryStore(IO)
#   - InFlightFuture / OutputItemResult / HandleOutputCtx / TurnItemContributorPolicy
#       异步工具执行上下文结构(IO)
#   - handle_output_item_done / apply_turn_item_contributors / finalize_turn_item(异步/IO 侧)
#       依赖 Session / ToolRuntime / ExtensionData(IO)
#   - parse_visible_hook_prompt_message
#       来自 crate::context(非本批移植的源文件)
#   - web_search_action_detail
#       来自 crate::web_search,此处仅作精简实现(见 web_search_action_detail)
#   - completed_item_defers_mailbox_delivery_to_next_turn 引用的 ModeKind::Plan
#       以布尔 plan_mode 参数等价替代
