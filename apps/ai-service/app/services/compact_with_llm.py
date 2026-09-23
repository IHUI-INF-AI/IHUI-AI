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

import asyncio
import inspect
import logging
from collections.abc import Callable
from typing import Any

from ..core.context_compaction import (
    SUMMARY_MARKER,
    compress_messages_if_needed,
    estimate_messages_tokens,
    estimate_tokens,
)
from ..core.local_compact import (
    SUMMARY_PREFIX as CODEX_SUMMARY_PREFIX,
)
from ..core.local_compact import (
    is_summary_message as codex_is_summary_message,
)
from ..core.tunables import (
    AGENT_COMPACTION_QUALITY_ENABLED,
    AGENT_COMPACTION_QUALITY_KEEP_RECENT_BONUS,
    AGENT_COMPACTION_QUALITY_THRESHOLD,
    DEFAULT_KEEP_RECENT,
    DEFAULT_TARGET_RATIO,
    DEFAULT_TRIGGER_RATIO,
)
from .compaction_quality import assess_compaction
from .decision_chain import extract_head_messages

logger = logging.getLogger(__name__)

# 摘要消息识别桥(2026-09-19 第三十七批接线,对标 Codex is_summary_message):
# ① 本仓历史摘要消息以 SUMMARY_MARKER("[上下文摘要")开头(context_compaction 体系);
# ② Codex 语义摘要以 SUMMARY_PREFIX + "\n" 开头(local_compact 规范源)。
# 两体系并列判定,供摘要防嵌套与下游检测使用。
def is_compaction_summary(message: str) -> bool:
    """判定一条文本是否为压缩摘要消息(本仓 SUMMARY_MARKER 或 Codex SUMMARY_PREFIX)。"""
    if not message:
        return False
    return message.startswith(SUMMARY_MARKER) or codex_is_summary_message(message)


def _message_plain_text(msg: dict[str, Any]) -> str:
    """提取 OpenAI 消息的纯文本内容(str 内容原样;list 内容拼接 text 项)。"""
    content = msg.get("content")
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        parts = [
            str(item.get("text", ""))
            for item in content
            if isinstance(item, dict) and item.get("type") in ("input_text", "output_text", "text")
        ]
        return "\n".join(p for p in parts if p)
    return ""

# 摘要 token 预算:占总目标上下文(target_ratio*context_limit)的份额,
# 防止 LLM 生成的摘要过大导致"压缩后仍超阈值 → 循环压缩失败"
SUMMARY_BUDGET_RATIO = 0.25
# 摘要预算下限(tokens):极小上下文/目标时也要保留一定说明空间
MIN_SUMMARY_BUDGET_TOKENS = 256
# 极端预算下保底保留字符数(避免预算过小截成无信息空串)
MIN_SUMMARY_CHARS = 8

# 默认摘要压缩指令(中文,保留任务目标与工具结果要点)
# 2026-09-19 第二十五批对标 Codex prompts/templates/compact/prompt.md:
# - 交接定位:摘要是给"接续任务的另一个 LLM"的 handoff(而非给人读的纪要)
# - 四要素清单:进度与关键决策 / 上下文·约束·用户偏好 / 待办与下一步 /
#   继续任务所需的关键数据·示例·引用
# - 首行交接框架(对标 Codex SUMMARY_PREFIX):告知新模型这是前一模型的工作,
#   在其基础上继续、避免重复劳动
DEFAULT_COMPACT_INSTRUCTION = (
    "你正在执行一次上下文检查点压缩:请把以下历史对话压缩为一份「交接摘要」"
    "（中文），它将交给另一个 LLM 无缝续做本任务。摘要须包含：\n"
    "1. 当前进度与已做出的关键决策；\n"
    "2. 重要的上下文、约束条件与用户偏好；\n"
    "3. 尚未完成的事项（给出明确的下一步）；\n"
    "4. 继续任务所必需的关键数据、示例或引用。\n"
    "首行用一句话说明「以下是前一个模型对本任务的工作摘要，请在其基础上继续，"
    "避免重复已完成的工作」。整体保持简洁、结构化、以无缝续做为唯一目标，"
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
    """复用配对组切分逻辑取出应被压缩的 head 段(实现见 decision_chain)。

    P1-②(2026-09-18):head 切分被两处复用 —— 本模块的 LLM 语义摘要选段,以及
    decision_chain 的决策链蒸馏选段。切分规则必须逐语义一致(否则摘要覆盖的消息
    与蒸馏覆盖的消息错位,决策链会出现"摘要里没有、推理里也没有"的空洞),
    故下沉为 decision_chain.extract_head_messages 单一实现,此处仅保留薄包装。
    """
    return extract_head_messages(messages, keep_recent)


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
    防嵌套(2026-09-19 第三十七批接线,判定=is_compaction_summary):head 段中
    已是压缩摘要的消息不重复送入 LLM(其正文已收敛,重复送入浪费预算且污染交接)。
    """
    filtered_head = [
        m for m in head if not is_compaction_summary(_message_plain_text(m))
    ]
    prompt = [
        {"role": "system", "content": compact_instruction},
        *filtered_head,
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
        prepend_codex_prefix: bool = False,
        fallback_reason: str = "context_limit",
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
        prepend_codex_prefix: True 时在 LLM 摘要正文前加 Codex 规范交接前缀
            (app.core.local_compact.SUMMARY_PREFIX,英文),使下游可用
            is_compaction_summary/codex_is_summary_message 识别摘要消息;
            默认 False 保持既有纯中文行为(前缀 tokens 计入摘要预算)
        fallback_reason: 摘要失败重试事件的原因标签(批58十七,对标 codex
            CompactionReason 词表:user_requested | context_limit |
            model_downshift | comp_hash_changed);默认 context_limit(本函数
            的默认触发源即上下文超限)。仅在摘要异常且触发重试时透出。

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
    # 批58(十七):模型回退标签(仅在摘要异常且触发重试时非空;未触发 → None)
    info_model_fallback: dict[str, Any] | None = None
    if context_limit > 0 and original_tokens > trigger_threshold:
        head = _extract_head(messages, keep_recent)
        if head:
            summary_budget_tokens = max(
                MIN_SUMMARY_BUDGET_TOKENS,
                int(context_limit * target_ratio * SUMMARY_BUDGET_RATIO),
            )
            if prepend_codex_prefix:
                # Codex 语义前缀占用预算,先扣减再生成(2026-09-19 第三十七批)
                prefix_cost = estimate_tokens(CODEX_SUMMARY_PREFIX)
                summary_budget_tokens = max(
                    MIN_SUMMARY_BUDGET_TOKENS, summary_budget_tokens - prefix_cost
                )
            try:
                custom_summary = await _summarize_head(
                    head,
                    llm_complete_fn=llm_complete_fn,
                    compact_instruction=compact_instruction,
                    summary_budget_tokens=summary_budget_tokens,
                )
            except Exception as e:
                # 批58(十七):摘要失败先判"是否值得用当前模型重试"(对标 codex
                # compact_model_fallback.rs should_retry_with_current_model)——
                # 中止/取消/预算耗尽类错误不重试(既不尊重用户意图也不经济),
                # 网络抖动/上游 5xx/超时类错误重试一次,避免直接退回质量更低的
                # 规则压缩。标签走 compact_model_fallback_tags(codex 词表)。
                custom_summary = ""
                if should_retry_compact_with_current_model(e):
                    logger.warning(
                        "[Compact/LLM] 摘要生成异常,用当前模型重试一次: %s", e
                    )
                    try:
                        custom_summary = await _summarize_head(
                            head,
                            llm_complete_fn=llm_complete_fn,
                            compact_instruction=compact_instruction,
                            summary_budget_tokens=summary_budget_tokens,
                        )
                        fallback_outcome = "succeeded"
                    except Exception as e2:  # noqa: BLE001 - 重试失败仍降级,不抛出
                        logger.warning(
                            "[Compact/LLM] 当前模型重试摘要仍失败,回退规则压缩: %s", e2
                        )
                        custom_summary = ""
                        fallback_outcome = "failed"
                    info_model_fallback = compact_model_fallback_tags(
                        fallback_reason, "responses_compaction_v2", fallback_outcome
                    )
                else:
                    logger.warning(
                        "[Compact/LLM] 摘要生成异常(中止/预算类,不重试),回退规则压缩: %s",
                        e,
                    )
                    info_model_fallback = None

        # 3) LLM 摘要成功 → 带 custom_summary 调规则压缩(最高优先级摘要正文)
        if custom_summary:
            if prepend_codex_prefix and not codex_is_summary_message(custom_summary):
                # Codex 规范交接前缀(可选):下游以 is_summary_message 识别摘要消息
                custom_summary = CODEX_SUMMARY_PREFIX + "\n" + custom_summary
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
                # 压缩质量自证(GAP-PLAN P1-3 提交通道接线,2026-09-06):
                # 保留率评估 → 低于阈值 auto_degrade(改用更保守 keep_recent 重压一次,
                # 复评不重复计数)→ gate EMA 记录连续低质,info 增量携带 quality 字段。
                if AGENT_COMPACTION_QUALITY_ENABLED:
                    quality = assess_compaction(
                        messages,
                        compressed,
                        threshold=AGENT_COMPACTION_QUALITY_THRESHOLD,
                    )
                    if quality["degraded"]:
                        compressed_b, info_b = compress_messages_if_needed(
                            messages,
                            context_limit,
                            trigger_ratio=trigger_ratio,
                            target_ratio=target_ratio,
                            keep_recent=keep_recent + AGENT_COMPACTION_QUALITY_KEEP_RECENT_BONUS,
                            custom_summary=custom_summary,
                        )
                        if info_b.get("compressed"):
                            quality_b = assess_compaction(
                                messages, compressed_b, record_to_gate=False
                            )
                            if (
                                quality_b["report"]["retention_ratio"]
                                >= quality["report"]["retention_ratio"]
                            ):
                                info_b["llm_summary"] = True  # 保守重压仍是语义压缩,标记不丢
                                compressed, info = compressed_b, info_b
                                quality = quality_b
                    info["quality"] = quality
                logger.info(
                    "[Compact/LLM] 语义压缩: %d → %d tokens (llm_summary, removed %d)",
                    info.get("original_tokens", 0),
                    info.get("compressed_tokens", 0),
                    info.get("removed_count", 0),
                )
                if info_model_fallback:
                    # 批58(十七):重试成功也留标签(观测"首次失败→当前模型重试成功"占比)
                    info["model_fallback"] = info_model_fallback
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
        # 规则压缩本身即保守降级路径:只评估并增量携带 quality,不再二次降级。
        if AGENT_COMPACTION_QUALITY_ENABLED:
            info["quality"] = assess_compaction(messages, compressed)
        logger.info(
            "[Compact/LLM] 规则压缩(降级): %d → %d tokens, removed %d",
            info.get("original_tokens", 0),
            info.get("compressed_tokens", 0),
            info.get("removed_count", 0),
        )
    # 批58(十七):模型回退标签随 info 透出(降级路径也保留,便于观测回退频率)
    if info_model_fallback:
        info["model_fallback"] = info_model_fallback
    return compressed, info


# ----------------------------------------------------------------------
# 模型回退判定(2026-09-19 第二十六批,对标 Codex compact_model_fallback.rs)
# ----------------------------------------------------------------------
# 不可回退的错误类别(Codex:TurnAborted/Interrupted/SessionBudgetExceeded):
# 用户中断/回合作废/预算耗尽时,换当前模型重试摘要既不尊重用户意图也不经济。
_NON_RETRYABLE_COMPACT_ERROR_MARKERS = (
    "turnaborted",
    "interrupted",
    "cancelled",
    "canceled",
    "budgetexceeded",
    "budget_exhausted",
)


def should_retry_compact_with_current_model(error: BaseException | str | None) -> bool:
    """摘要压缩失败后,是否值得用当前模型重试(而非直接放弃语义压缩)。

    对标 Codex ``should_retry_with_current_model``:中止类错误返回 False,
    其余(网络抖动、上游 5xx、超时等)返回 True。

    批58(十七)修正:标记匹配前把文本的 ``_``/``-``/空白一并归一——真实异常
    消息多为 ``TurnAborted``/``turn aborted``/``session budget exceeded`` 等混合
    形态,只去下划线会漏判带空格的中止/预算类错误(误判为可重试,白烧一次调用)。
    """
    if error is None:
        return True
    if isinstance(error, BaseException):
        if isinstance(error, (KeyboardInterrupt, asyncio.CancelledError)):
            return False
        text = f"{type(error).__name__} {error}"
    else:
        text = str(error)
    lowered = (
        text.replace("_", "").replace("-", "").replace(" ", "").replace("\t", "").lower()
    )
    return not any(marker in lowered for marker in _NON_RETRYABLE_COMPACT_ERROR_MARKERS)


def compact_model_fallback_tags(
    reason: str,
    implementation: str,
    outcome: str,
) -> dict[str, str]:
    """构造回退事件的结构化标签(Codex record_model_fallback 的 counter 维度)。

    Args:
        reason: user_requested | context_limit | model_downshift | comp_hash_changed
        implementation: responses | responses_compaction_v2(保留 Codex 原值便于跨系统对账)
        outcome: succeeded | failed
    """
    return {
        "reason": reason,
        "implementation": implementation,
        "outcome": outcome,
    }
# ⁠​‌​
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
