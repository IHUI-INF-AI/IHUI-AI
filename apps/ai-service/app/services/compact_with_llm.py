# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""LLM 语义压缩服务(对标 Claude Code /compact / Codex /compact)。

主循环上下文超阈值时,默认自动调用 LLM 生成语义摘要(custom_summary),
再把 custom_summary 交给 context_compaction.compress_messages_if_needed 分层规则
压缩(该函数支持 custom_summary 作为最高优先级摘要正文),得到最终压缩产物。

设计要点:
- 未超阈值:完全复用 context_compaction 的 early-return 语义(原样返回 + trigger='none')
- 超阈值:复用 _split_pair_groups 配对组保护取出应压缩的 head 段,构造摘要 prompt
  调 LLM 生成语义摘要;LLM 成功且非空 → 带 custom_summary 调规则压缩;
  LLM 失败/空摘要 → 降级为不传 custom_summary 的纯规则压缩,保证可用性
- 摘要 token 预算控制:摘要本身不可超预算(预算 = target_ratio*context_limit 的 1/4,
  且不小于下限),超了按字符密度截断;仍无法有效压缩则整体回退规则压缩,防循环
- llm_complete_fn 兼容两种形态:
    async (messages: list) -> str | dict                    (单参数)
    async (messages: list, tools: list) -> dict             (agent_loop_v2 签名)
  返回 str 或 dict{content: str} 均兼容;stream 返回值不被支持(需要完整摘要,
  非流式)。摘要生成在调用前先原样接收,再统一提取 content。
"""

from __future__ import annotations

import inspect
import logging
from collections.abc import Callable
from typing import Any

from ..core.context_compaction import (
    _split_pair_groups,
    compress_messages_if_needed,
    estimate_messages_tokens,
    estimate_tokens,
)
from ..core.tunables import (
    DEFAULT_KEEP_RECENT,
    DEFAULT_MIN_MESSAGES,
    DEFAULT_TARGET_RATIO,
    DEFAULT_TRIGGER_RATIO,
)

logger = logging.getLogger(__name__)

# 摘要 token 预算:占总目标上下文(target_ratio*context_limit)的份额,
# 防止 LLM 生成的摘要过大导致"压缩后仍超阈值 → 循环压缩失败"
SUMMARY_BUDGET_RATIO = 0.25
# 摘要预算下限(tokens):极小上下文/目标时也要保留一定说明空间
MIN_SUMMARY_BUDGET_TOKENS = 256
# 极端预算下保底保留字符数(避免预算过小截成无信息空串)
MIN_SUMMARY_CHARS = 8

# 默认摘要压缩指令(中文,保留任务目标与工具结果要点)
DEFAULT_COMPACT_INSTRUCTION = (
    "请将以下历史对话压缩为保留关键信息与决策的语义摘要（中文），"
    "不要遗漏本轮任务目标与已完成的工具结果要点。"
)


def _extract_text(result: Any) -> str:
    """从 llm_complete_fn 返回值提取摘要正文。

    兼容 str 与 dict{content: ...} 两种返回格式;dict 带 error 字段视为失败(返回空串),
    空 result/非 str or dict 一律返回空串(由调用方降级为规则压缩)。
    """
    if result is None:
        return ""
    if isinstance(result, str):
        return result
    if isinstance(result, dict):
        if result.get("error"):
            # 错误响应(content 通常为空/不可信),视为失败降级
            return ""
        content = result.get("content")
        if isinstance(content, str):
            return content
        if content is not None:
            return str(content)
    return ""


def _truncate_to_budget(text: str, budget_tokens: int) -> str:
    """按字符密度把摘要截断到指定 token 预算内(保留尾部完整,无信息仍可读)。

    预算过小极端场景用保底字符数兜底,避免截成空串导致语义信息全丢。
    """
    if budget_tokens <= 0:
        return ""
    tokens = estimate_tokens(text)
    if tokens <= budget_tokens:
        return text
    density = estimate_tokens(text) / max(1, len(text))
    keep_chars = int(budget_tokens / density * 0.8) if density > 0 else len(text)
    keep_chars = max(MIN_SUMMARY_CHARS, min(keep_chars, len(text)))
    return text[:keep_chars].rstrip()


def _extract_head(
    messages: list[dict[str, Any]], keep_recent: int
) -> list[dict[str, Any]] | None:
    """复用 context_compaction 的配对组切分逻辑,取出应被压缩的 head 段。

    与 compress_messages_if_needed 内部切分逐语义一致(首条 system + 尾部 keepRecent
    条按组对齐保留,其余为 head)。返回 None 表示无 head 可压缩(消息过少 / 全部落入尾部),
    此时不应发起无谓的 LLM 摘要调用。
    """
    if len(messages) < DEFAULT_MIN_MESSAGES:
        return None
    non_system = messages[1:] if messages and messages[0].get("role") == "system" else messages
    if len(non_system) <= keep_recent:
        return None
    groups = _split_pair_groups(non_system)
    tail_groups: list[list[dict[str, object]]] = []
    tail_count = 0
    for group in reversed(groups):
        tail_groups.insert(0, group)
        tail_count += len(group)
        if tail_count >= keep_recent:
            break
    head_groups = groups[: len(groups) - len(tail_groups)]
    if not head_groups:
        return None
    return [msg for group in head_groups for msg in group]


async def _summarize_head(
    head: list[dict[str, Any]],
    llm_complete_fn: Callable[..., Any],
    compact_instruction: str,
    summary_budget_tokens: int,
) -> str:
    """调用 LLM 把 head 段压缩为语义摘要正文。

    兼容单参数 async (messages)->str|dict 与 agent_loop_v2 双参数
    (messages, tools)->dict 两种 llm_complete_fn;返回 str 或 dict 均提取 content。
    失败(异常/空/超预算截断后为空)一律返回空串,由调用方降级为规则压缩。
    """
    prompt = [
        {"role": "system", "content": compact_instruction},
        *head,
    ]
    try:
        maybe_await = llm_complete_fn(prompt)
    except TypeError:
        # 兼容 agent_loop_v2 的 (messages, tools) 双参签名(摘要不需要 tools,补 None)
        maybe_await = llm_complete_fn(prompt, None)
    if inspect.isawaitable(maybe_await):
        result: Any = await maybe_await
    else:
        result = maybe_await
    summary = _extract_text(result)
    if not summary or not summary.strip():
        logger.warning("[Compact/LLM] 摘要为空,回退规则压缩")
        return ""
    # 摘要 token 预算控制:超预算按字符密度截断(防止摘要自身过大导致压缩循环失败)
    summary = _truncate_to_budget(summary, summary_budget_tokens)
    if not summary.strip():
        logger.warning("[Compact/LLM] 摘要截断后为空,回退规则压缩")
        return ""
    return summary


async def compact_with_llm(
    messages: list[dict[str, Any]],
    context_limit: int,
    llm_complete_fn: Callable[..., Any],
    *,
    trigger_ratio: float = DEFAULT_TRIGGER_RATIO,
    target_ratio: float = DEFAULT_TARGET_RATIO,
    keep_recent: int = DEFAULT_KEEP_RECENT,
    compact_instruction: str = DEFAULT_COMPACT_INSTRUCTION,
) -> tuple[list[dict[str, Any]], dict[str, Any]]:
    """上下文超阈值时自动调 LLM 生成语义摘要再压缩。

    Args:
        messages: OpenAI 格式消息列表(不改动原列表)
        context_limit: 模型上下文窗口大小(tokens)
        llm_complete_fn: LLM 调用入口,兼容两种形态:
            async (messages)->str | dict、async (messages, tools)->dict;
            返回 dict 时取其 content 字段(带 error 视为失败)
        trigger_ratio / target_ratio / keep_recent: 与 context_compaction 阈值参数一致
        compact_instruction: 摘要压缩指令(中文)

    Returns:
        (compressed_messages, info),与 compress_messages_if_needed 契约一致:
        - 未超阈值:原样返回 + trigger='none'
        - LLM 摘要成功且压缩有效:带 custom_summary 的压缩结果,info 追加 llm_summary=True
        - LLM 摘要失败/无效:降级为不传 custom_summary 的规则压缩(仍返回合法消息)
    """
    # 1) 超阈值判定:未超阈值直接复用规则压缩的 early-return 语义(原样返回)
    original_tokens = estimate_messages_tokens(messages)
    trigger_threshold = int(context_limit * trigger_ratio)

    # 2) 超阈值且存在可压缩 head 时,才尝试 LLM 语义摘要
    custom_summary: str = ""
    if context_limit > 0 and original_tokens > trigger_threshold:
        head = _extract_head(messages, keep_recent)
        if head:
            summary_budget_tokens = max(
                MIN_SUMMARY_BUDGET_TOKENS,
                int(context_limit * target_ratio * SUMMARY_BUDGET_RATIO),
            )
            try:
                custom_summary = await _summarize_head(
                    head,
                    llm_complete_fn=llm_complete_fn,
                    compact_instruction=compact_instruction,
                    summary_budget_tokens=summary_budget_tokens,
                )
            except Exception as e:
                # LLM 摘要任何异常都不影响主流程 → 降级规则压缩
                logger.warning("[Compact/LLM] 摘要生成异常,回退规则压缩: %s", e)
                custom_summary = ""

        # 3) LLM 摘要成功 → 带 custom_summary 调规则压缩(最高优先级摘要正文)
        if custom_summary:
            compressed, info = compress_messages_if_needed(
                messages,
                context_limit,
                trigger_ratio=trigger_ratio,
                target_ratio=target_ratio,
                keep_recent=keep_recent,
                custom_summary=custom_summary,
            )
            if info.get("compressed"):
                info["llm_summary"] = True
                logger.info(
                    "[Compact/LLM] 语义压缩: %d → %d tokens (llm_summary, removed %d)",
                    info.get("original_tokens", 0),
                    info.get("compressed_tokens", 0),
                    info.get("removed_count", 0),
                )
                return compressed, info
            # custom_summary 条件下仍无法有效压缩(incompressible 等) →
            # 回退为不传 custom_summary 的规则压缩
            logger.info(
                "custom_summary 压缩无效(%d tokens),回退规则压缩",
                info.get("compressed_tokens", 0),
            )

    # 4) 未超阈值 / 无 head / LLM 摘要缺失或无效 → 规则压缩路径(不传 custom_summary)
    compressed, info = compress_messages_if_needed(
        messages,
        context_limit,
        trigger_ratio=trigger_ratio,
        target_ratio=target_ratio,
        keep_recent=keep_recent,
    )
    if info.get("compressed"):
        logger.info(
            "[Compact/LLM] 规则压缩(降级): %d → %d tokens, removed %d",
            info.get("original_tokens", 0),
            info.get("compressed_tokens", 0),
            info.get("removed_count", 0),
        )
    return compressed, info
# ⁠​‌​
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
