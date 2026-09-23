# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""压缩保留区逐组预算与图片预算(批 54,对标 codex compact_remote_v2.rs)。

对标关系(codex-rs core/src/compact_remote_v2.rs):
- ``RETAINED_MESSAGE_TOKEN_BUDGET``:保留区 token 总预算(64_000);
- ``MAX_RETAINED_AGENT_MESSAGE_TOKENS``:保留区单条 agent 消息上限(10_000),
  超限文本截断;
- ``truncate_retained_messages``:从**最新组向旧组**逐组纳入保留区,整组不 fit
  则该组及更旧全部淘汰(不拆组,assistant 与其 tool 回复同进同退);
- ``RetainedImageBudget``:Disabled(默认)时保留区判定**忽略图片内容**——
  含 base64 图的消息按 0 图片成本计入,使其更容易被整体淘汰,节省上下文;
  Enabled 时图片按占位成本(IMAGE_TOKEN_PLACEHOLDER)计入。

与 codex 的差异(有意为之):
- codex 的组是 ResponseItem 组,ihui 是 OpenAI 风格消息组(复用
  ``context_compaction._split_pair_groups`` 的配对分组语义);
- token 估算复用 ``context_compaction.estimate_messages_tokens``(tiktoken,
  跨端对齐),图片成本开关通过预处理将 base64 段剥除实现。

本模块为纯函数库,不改动既有压缩链(compact_with_llm/context_compaction),
接线由调用方(主循环)按需组合。
"""

from __future__ import annotations

import re
from collections.abc import Sequence
from typing import Any

from .context_compaction import (
    _split_pair_groups,
    estimate_messages_tokens,
)

__all__ = [
    "RETAINED_MESSAGE_TOKEN_BUDGET",
    "MAX_RETAINED_AGENT_MESSAGE_TOKENS",
    "group_messages",
    "estimate_group_tokens",
    "truncate_retained_messages",
    "select_retained_history",
]

# 对标 codex RETAINED_MESSAGE_TOKEN_BUDGET
RETAINED_MESSAGE_TOKEN_BUDGET = 64_000
# 对标 codex MAX_RETAINED_AGENT_MESSAGE_TOKENS
MAX_RETAINED_AGENT_MESSAGE_TOKENS = 10_000

# base64 图片段(与 context_compaction 同源正则语义,独立实例避免耦合其私有状态)
_DATA_IMAGE_RE = re.compile(r"data:image/[a-zA-Z0-9+.-]+;base64,[A-Za-z0-9+/=]+")

# 截断时用于按预算比例收缩文本的安全下限(字符数)
_MIN_TRUNCATE_CHARS = 200


def _strip_images(text: str) -> str:
    """剥除文本中的 base64 图片段(Disabled 图片预算语义:图片计 0 token)。"""
    return _DATA_IMAGE_RE.sub("", text)


def _massage_for_budget(msg: dict[str, Any], *, charge_images: bool) -> dict[str, Any]:
    """按图片预算开关生成用于估算的消息副本(不修改原消息)。"""
    if charge_images:
        return msg
    content = msg.get("content")
    stripped: Any = content
    if isinstance(content, str):
        stripped = _strip_images(content)
    elif isinstance(content, list):
        new_parts: list[Any] = []
        for part in content:
            if isinstance(part, dict):
                image_url = part.get("image_url")
                text_part = part.get("text")
                if image_url is not None or (
                    isinstance(text_part, str) and _DATA_IMAGE_RE.search(text_part)
                ):
                    # vision part:图片 part 按空文本计(保留 part 结构,计 overhead)
                    new_parts.append({**part, "text": "", "image_url": None})
                    continue
            new_parts.append(part)
        stripped = new_parts
    out = dict(msg)
    out["content"] = stripped
    return out


def group_messages(messages: Sequence[dict[str, Any]]) -> list[list[dict[str, Any]]]:
    """把 OpenAI 风格消息按"轮组"分组(assistant 与其 tool 回复不可拆散)。

    复用 context_compaction._split_pair_groups 的配对语义;类型标注放宽为
    dict[str, Any] 视角。畸形项(非 dict)按单元素组落组,不崩。
    """
    safe = [m if isinstance(m, dict) else {"role": "unknown", "content": str(m)} for m in messages]
    groups: list[list[dict[str, Any]]] = [
        list(g) for g in _split_pair_groups(safe)
    ]
    return groups


def estimate_group_tokens(
    group: Sequence[dict[str, Any]], *, charge_images: bool = True
) -> int:
    """估算一组消息的 token;charge_images=False 时 base64 图片按 0 计。"""
    if charge_images:
        return estimate_messages_tokens(list(group))
    massaged = [_massage_for_budget(m, charge_images=False) for m in group]
    return estimate_messages_tokens(massaged)


def _truncate_text_to_tokens(text: str, budget_tokens: int) -> str:
    """按 token 预算近似截断文本(estimate_tokens≈BPE,按 1 token≈3 字符比例收缩)。"""
    if budget_tokens <= 0:
        return ""
    # 先按预算估一次,未超直接返回
    from .context_compaction import estimate_tokens

    if estimate_tokens(text) <= budget_tokens:
        return text
    # 字符→token 近似比例按 3:1 起步,迭代收缩到预算内(最多 5 轮)
    chars = max(_MIN_TRUNCATE_CHARS, budget_tokens * 3)
    for _ in range(5):
        candidate = text[:chars]
        if estimate_tokens(candidate) <= budget_tokens:
            return candidate
        chars = max(_MIN_TRUNCATE_CHARS, int(chars * 0.8))
    return text[:chars]


def truncate_retained_messages(
    messages: list[dict[str, Any]],
    max_tokens: int = RETAINED_MESSAGE_TOKEN_BUDGET,
    *,
    image_budget: bool = False,
    max_agent_message_tokens: int = MAX_RETAINED_AGENT_MESSAGE_TOKENS,
) -> tuple[list[dict[str, Any]], dict[str, int]]:
    """压缩保留区:从最新组向旧组逐组纳入预算,整组不 fit 即淘汰该组及更旧。

    返回 ``(保留区消息(原顺序), stats)``;stats 含组统计/估算 token/截断计数。
    image_budget=False(默认,对标 RetainedImageBudget::Disabled):图片不计入
    保留判定。畸形输入(非 dict/缺 role)跳过不崩。
    """
    groups = group_messages(messages)
    stats: dict[str, int] = {
        "groups_total": len(groups),
        "groups_retained": 0,
        "estimated_tokens": 0,
        "truncated_messages": 0,
        "images_charged": 1 if image_budget else 0,
    }
    if not groups:
        return [], stats

    # 从最新组向旧累加预算;整组 fit 则保留,否则该组及更旧全部淘汰
    retained_group_indices: list[int] = []
    remaining = max_tokens
    for group in reversed(groups):
        if remaining <= 0:
            break
        cost = estimate_group_tokens(group, charge_images=image_budget)
        if cost > remaining:
            break
        remaining -= cost
        retained_group_indices.append(len(groups) - 1 - len(retained_group_indices))
    retained_group_indices.reverse()

    retained: list[dict[str, Any]] = []
    truncated = 0
    estimated = 0
    for gi in retained_group_indices:
        group = groups[gi]
        for msg in group:
            if (
                msg.get("role") == "assistant"
                and max_agent_message_tokens > 0
            ):
                content = msg.get("content")
                if isinstance(content, str):
                    from .context_compaction import estimate_tokens

                    if estimate_tokens(content) > max_agent_message_tokens:
                        new_msg = dict(msg)
                        new_msg["content"] = _truncate_text_to_tokens(
                            content, max_agent_message_tokens
                        )
                        retained.append(new_msg)
                        truncated += 1
                        estimated += estimate_tokens(str(new_msg["content"]))
                        continue
            retained.append(msg)
        estimated += estimate_group_tokens(group, charge_images=True)

    stats["groups_retained"] = len(retained_group_indices)
    stats["truncated_messages"] = truncated
    stats["estimated_tokens"] = estimated
    return retained, stats


def select_retained_history(
    messages: list[dict[str, Any]],
    *,
    summary: dict[str, Any] | str | None = None,
    image_budget: bool = False,
) -> list[dict[str, Any]]:
    """便捷入口:摘要消息 + 保留区。

    summary 为 dict 时取其 "text"/"summary" 键;str 直接用;None 则纯保留区。
    """
    retained, _stats = truncate_retained_messages(messages, image_budget=image_budget)
    if summary is None:
        return retained
    if isinstance(summary, dict):
        summary_text = str(summary.get("text") or summary.get("summary") or "")
    else:
        summary_text = str(summary)
    header = {
        "role": "user",
        "content": f"[历史已压缩摘要]\n{summary_text}",
    }
    return [header, *retained]
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
