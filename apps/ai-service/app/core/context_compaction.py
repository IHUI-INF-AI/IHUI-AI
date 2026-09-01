# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""上下文压缩模块(Python 端兜底实现)。

跨端统一规则(与 TypeScript 共享包 @ihui/context-compaction 等价):
- 默认触发阈值:88%(0.88)
- 默认目标:60%(0.6)
- 默认尾部保留:6 条 non-system 消息
- 压缩策略:保留首条 system + 尾部 N 条,中段用结构化摘要替代
- 摘要格式:对话摘要(角色 + 内容前 200 字符)+ 上下文摘要(累积摘要)
- 防循环两级降级:压缩后仍超阈值时,先截断最后一条消息内容降级(trigger=truncated);
  截断到最小长度仍超阈值(典型:system 本身巨大)才返回原消息(trigger=incompressible)

设计目的:
- API 层(apps/api)在调用 ai-service 前已调用 TS 共享包压缩
- ai-service 本层是兜底:防御性压缩,避免 API 漏传 contextLimit 时仍能保护上下文
- 跨端一致性:Python 实现与 TS 共享包逻辑等价,阈值统一 0.88
"""

from __future__ import annotations

import logging
import math
from typing import Any

import tiktoken

logger = logging.getLogger(__name__)

# 跨端统一常量(与 @ihui/context-compaction 一致)
DEFAULT_TRIGGER_RATIO = 0.88
DEFAULT_TARGET_RATIO = 0.6
DEFAULT_KEEP_RECENT = 6
DEFAULT_MIN_MESSAGES = 2  # 与 TS 共享包一致(2026-08-16 起):仅 system+1 条即可压缩;旧值 7 在短对话/历史被截断时误判"消息不足"

# 截断降级(truncate-fallback)常量:常规压缩无效时对最后一条消息做内容截断
MIN_TRUNCATE_CHARS = 100  # 截断保留的最小字符数(下限)
TRUNCATE_MARKER = "…[已截断]"  # 截断标记(追加在被截断内容末尾)
MAX_TRUNCATE_ATTEMPTS = 8  # 截断迭代最大次数

# 模块级 encoder 缓存(CI 502 修复:lazy 加载避免 import 时报错)
_encoder: tiktoken.Encoding | None = None


def _get_encoder() -> tiktoken.Encoding:
    """获取 tiktoken encoder(cl100k_base,与 TS 端 gpt-tokenizer 一致)。"""
    global _encoder
    if _encoder is None:
        try:
            _encoder = tiktoken.get_encoding("cl100k_base")
        except Exception as e:
            logger.warning("Failed to load tiktoken cl100k_base: %s, fallback to p50k", e)
            _encoder = tiktoken.get_encoding("p50k_base")
    return _encoder


def estimate_tokens(text: str) -> int:
    """估算字符串的 token 数(BPE 真实分词)。

    与 TS 端 gpt-tokenizer 一致(cl100k_base 编码)。
    """
    if not text:
        return 0
    try:
        return len(_get_encoder().encode(text))
    except Exception as e:
        logger.debug("tiktoken encode failed: %s, fallback to len/4", e)
        return max(1, len(text) // 4)


def estimate_messages_tokens(messages: list[dict[str, Any]]) -> int:
    """估算消息列表的 token 数(含每条 4 token overhead,与 TS 端一致)。"""
    total = 0
    for msg in messages:
        content = msg.get("content", "")
        if isinstance(content, str):
            total += estimate_tokens(content) + 4
        elif isinstance(content, list):
            # OpenAI vision 格式:list of {type, text/image_url}
            for part in content:
                if isinstance(part, dict):
                    text = part.get("text") or str(part.get("content", ""))
                    total += estimate_tokens(text) + 4
    return total


def _summarize_message(msg: dict[str, Any], max_chars: int = 200) -> str:
    """单条消息摘要:角色 + 内容前 N 字符。"""
    role = msg.get("role", "unknown")
    content = msg.get("content", "")
    if not isinstance(content, str):
        content = str(content)
    if len(content) > max_chars:
        content = content[:max_chars] + "..."
    return f"[{role}] {content}"


def _build_structured_summary(messages: list[dict[str, Any]]) -> str:
    """结构化摘要:逐条消息摘要拼接 + 累积摘要。"""
    lines = ["# 上下文摘要(自动生成)", ""]
    for msg in messages:
        if msg.get("role") == "system":
            continue
        summary = _summarize_message(msg)
        if summary:
            lines.append(f"- {summary}")
    lines.append("")
    lines.append(f"以上为 {len([m for m in messages if m.get('role') != 'system'])} 条历史消息的摘要。")
    return "\n".join(lines)


def _truncate_fallback(
    system_msgs: list[dict[str, Any]],
    non_system: list[dict[str, Any]],
    context_limit: int,
    original_tokens: int,
    trigger_threshold: int,
    target_threshold: int,
) -> tuple[list[dict[str, Any]], dict[str, Any]] | None:
    """第一级降级:kr=1 + 最后一条消息内容截断(system 消息永不截断)。

    常规摘要压缩无法达标时(典型:超长单条消息如粘贴大文件,摘要化收益不足),
    重建 kr=1 方案(system + 摘要 + 最后一条消息),对最后一条消息做内容截断,
    按 BPE 密度估算裁剪字符量,迭代收敛到目标阈值以下。

    Returns:
        截断后 tokens < 触发阈值 → (截断后的消息列表, info dict, trigger='truncated')
        截断到最小长度仍 >= 触发阈值(典型:system 本身巨大)→ None(走 incompressible)
    """
    if not non_system:
        return None

    last_msg = non_system[-1]
    last_content = last_msg.get("content", "")
    if not isinstance(last_content, str) or not last_content:
        # 非 str content(vision 等)或空内容无法安全截断 → 交给 incompressible
        return None

    # kr=1 方案:system + 摘要(除最后一条外的全部 non-system) + 最后一条消息
    fallback_summary: dict[str, Any] = {
        "role": "user",
        "content": _build_structured_summary(non_system[:-1]),
    }
    truncated_last: dict[str, Any] = dict(last_msg)  # 拷贝,不改动原消息
    candidate = [*system_msgs, fallback_summary, truncated_last]

    keep_content = last_content
    tokens = 0
    for _attempt in range(MAX_TRUNCATE_ATTEMPTS):
        truncated_last["content"] = keep_content
        tokens = estimate_messages_tokens(candidate)
        if tokens <= target_threshold:
            break  # 截断成功
        if len(keep_content) <= MIN_TRUNCATE_CHARS:
            break  # 截到下限仍不达标
        excess_tokens = tokens - target_threshold
        # 每 char 的 token 数(BPE 密度),据此估算需裁剪的字符数,1.2 倍安全余量
        density = estimate_tokens(keep_content) / max(1, len(keep_content))
        cut_chars = math.ceil((excess_tokens / max(density, 0.01)) * 1.2)
        keep_content = keep_content[: max(MIN_TRUNCATE_CHARS, len(keep_content) - cut_chars)] + TRUNCATE_MARKER

    if tokens >= trigger_threshold:
        # 截断到最小长度仍超触发阈值 → 第二级 incompressible
        return None

    logger.warning(
        "[Compaction] truncate-fallback: %d → %d tokens (trigger_threshold=%d), "
        "last message %d → %d chars",
        original_tokens,
        tokens,
        trigger_threshold,
        len(last_content),
        len(truncated_last["content"]),
    )
    return candidate, {
        "compressed": True,
        "original_tokens": original_tokens,
        "compressed_tokens": tokens,
        "removed_count": len(non_system) - 1,
        "usage_ratio": original_tokens / context_limit,
        "trigger": "truncated",
    }


def compress_messages_if_needed(
    messages: list[dict[str, Any]],
    context_limit: int,
    trigger_ratio: float = DEFAULT_TRIGGER_RATIO,
    target_ratio: float = DEFAULT_TARGET_RATIO,
    keep_recent: int = DEFAULT_KEEP_RECENT,
) -> tuple[list[dict[str, Any]], dict[str, Any]]:
    """百分比阈值自动压缩(与 TS 共享包 compressContextIfNeeded 等价)。

    Args:
        messages: OpenAI 格式消息列表
        context_limit: 模型上下文窗口大小(tokens)
        trigger_ratio: 触发压缩的占用率(默认 0.88)
        target_ratio: 压缩后的目标占用率(默认 0.6)
        keep_recent: 尾部保留的 non-system 消息数(默认 6)

    Returns:
        (compressed_messages, info)
        - compressed_messages: 压缩后的消息列表(或原列表,若未触发)
        - info: dict {compressed: bool, original_tokens, compressed_tokens, removed_count, usage_ratio, trigger}
    """
    if context_limit <= 0:
        return messages, {
            "compressed": False,
            "original_tokens": 0,
            "compressed_tokens": 0,
            "removed_count": 0,
            "usage_ratio": 0,
            "trigger": "none",
        }

    original_tokens = estimate_messages_tokens(messages)
    trigger_threshold = int(context_limit * trigger_ratio)

    if original_tokens <= trigger_threshold:
        return messages, {
            "compressed": False,
            "original_tokens": original_tokens,
            "compressed_tokens": original_tokens,
            "removed_count": 0,
            "usage_ratio": original_tokens / context_limit,
            "trigger": "none",
        }

    # 消息数过少不压缩(minMessages = 2,与 TS 共享包一致)
    if len(messages) < DEFAULT_MIN_MESSAGES:
        return messages, {
            "compressed": False,
            "original_tokens": original_tokens,
            "compressed_tokens": original_tokens,
            "removed_count": 0,
            "usage_ratio": original_tokens / context_limit,
            "trigger": "none",
        }

    # 分割:首条 system + head(压缩) + tail(保留 keepRecent 条)
    has_system = messages and messages[0].get("role") == "system"
    system_msgs = [messages[0]] if has_system else []
    non_system = messages[1:] if has_system else messages

    if len(non_system) <= keep_recent:
        return messages, {
            "compressed": False,
            "original_tokens": original_tokens,
            "compressed_tokens": original_tokens,
            "removed_count": 0,
            "usage_ratio": original_tokens / context_limit,
            "trigger": "none",
        }

    tail = non_system[-keep_recent:]
    head = non_system[:-keep_recent]

    # 生成结构化摘要
    summary_text = _build_structured_summary(head)
    summary_msg: dict[str, Any] = {
        "role": "user",
        "content": summary_text,
    }

    # 合并:system + summary + tail
    compressed = system_msgs + [summary_msg] + tail
    compressed_tokens = estimate_messages_tokens(compressed)
    removed_count = len(head)

    # 防循环保护(与 TS 共享包对齐):压缩后仍超触发阈值 → 常规压缩无效,
    # 不再返回常规压缩结果,避免"每轮都压缩、摘要套摘要"的历史质量退化。
    # 两级降级:先截断最后一条消息内容(truncated),仍不行才判 incompressible
    if compressed_tokens >= trigger_threshold:
        # 第一级:截断降级(超长单条消息摘要化收益不足时,截到最后一条消息上)
        fallback = _truncate_fallback(
            system_msgs=system_msgs,
            non_system=non_system,
            context_limit=context_limit,
            original_tokens=original_tokens,
            trigger_threshold=trigger_threshold,
            target_threshold=int(context_limit * target_ratio),
        )
        if fallback is not None:
            return fallback

        # 第二级 incompressible:截断到最小长度仍超触发阈值
        # (典型场景:system prompt 本身巨大且 system 消息永不截断)
        logger.warning(
            "Context incompressible: compressed %d tokens still >= trigger threshold %d "
            "(system/material 占用过大), skip re-summarization loop",
            compressed_tokens,
            trigger_threshold,
        )
        return messages, {
            "compressed": False,
            "original_tokens": original_tokens,
            "compressed_tokens": compressed_tokens,
            "removed_count": 0,
            "usage_ratio": original_tokens / context_limit,
            "trigger": "incompressible",
        }

    logger.info(
        "Context compressed: %d → %d tokens (removed %d messages, ratio %.2f → %.2f)",
        original_tokens,
        compressed_tokens,
        removed_count,
        original_tokens / context_limit,
        compressed_tokens / context_limit,
    )

    return compressed, {
        "compressed": True,
        "original_tokens": original_tokens,
        "compressed_tokens": compressed_tokens,
        "removed_count": removed_count,
        "usage_ratio": original_tokens / context_limit,
        "trigger": "ratio",
    }
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
