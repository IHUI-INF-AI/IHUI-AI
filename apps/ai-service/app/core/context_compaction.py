"""上下文压缩模块(Python 端兜底实现)。

跨端统一规则(与 TypeScript 共享包 @ihui/context-compaction 等价):
- 默认触发阈值:88%(0.88)
- 默认目标:60%(0.6)
- 默认尾部保留:6 条 non-system 消息
- 压缩策略:保留首条 system + 尾部 N 条,中段用结构化摘要替代
- 摘要格式:对话摘要(角色 + 内容前 200 字符)+ 上下文摘要(累积摘要)

设计目的:
- API 层(apps/api)在调用 ai-service 前已调用 TS 共享包压缩
- ai-service 本层是兜底:防御性压缩,避免 API 漏传 contextLimit 时仍能保护上下文
- 跨端一致性:Python 实现与 TS 共享包逻辑等价,阈值统一 0.88
"""

from __future__ import annotations

import logging
from typing import Any

import tiktoken

logger = logging.getLogger(__name__)

# 跨端统一常量(与 @ihui/context-compaction 一致)
DEFAULT_TRIGGER_RATIO = 0.88
DEFAULT_TARGET_RATIO = 0.6
DEFAULT_KEEP_RECENT = 6
DEFAULT_MIN_MESSAGES = 7  # keepRecent + 1

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

    # 消息数过少不压缩(minMessages = keepRecent + 1)
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
