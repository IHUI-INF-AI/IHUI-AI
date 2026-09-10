# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE).
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍​‌‌‌​‌‌‌​‌‌‌​‌‍‍​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍​‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""跨会话接力摘要:生成(确定性抽取 + 可选 LLM 精炼)与恢复注入。

GAP-PLAN P2-7「跨会话接力闭环」的核心服务层。闭环 = 生成 → 存储 → 恢复注入 → 测试全绿。

设计要点(2026-09-07 立):
- 五段结构化摘要:任务目标 / 已完成步骤 / 关键决定 / 未完成事项 / 涉及文件。
- 默认安全路径 *不依赖* LLM:从 SessionStore 的 Item 序列做确定性抽取
  (复用 compaction_quality 的"价值分类"思想——文件路径/意图/实体正则抽取,
  但本模块自包含、零重依赖,避免拖入 context_compaction 重型链)。
- LLM 精炼 *可开关*(env `IHUI_SESSION_RELAY_LLM_REFINE`,默认关闭);
  开启且调用方注入 `llm_fn` 时才调用,任何异常 → 记录日志并降级回确定性摘要。
- 恢复注入用清晰边界标记包裹,防止污染真实对话(模型必须能区分"上一会话摘要"
  与"用户本轮输入");提供 `inject_relay_summary_into_messages` 把摘要作为 system
  消息前置到消息历史。
- 本模块不触碰 agent_loop_v2 的并发编辑区;仅作为纯函数 + 注入构建块,
  由 router / 新会话引导层在"继续上次"时调用。

mypy --strict 0 error。
"""

from __future__ import annotations

import logging
import os
import re
import time
from collections.abc import Callable
from typing import Any

from pydantic import BaseModel, ConfigDict, Field

from app.services.session_store import (
    AgentMessageItem,
    ApprovalResponseItem,
    ErrorItem,
    FileEditItem,
    ItemBase,
    LLMMessage,
    ToolCallItem,
    ToolResultItem,
    UserMessageItem,
)

logger = logging.getLogger(__name__)

# =============================================================================
# 可调常量
# =============================================================================

# LLM 精炼总开关(env 门控,默认关闭 —— 关闭时绝不触碰任何模型)
RELAY_LLM_REFINE_ENV = "IHUI_SESSION_RELAY_LLM_REFINE"

# 各段长度上限(防超大摘要撑爆 system 消息 / 存储)
OBJECTIVE_MAX = 800
STEP_MAX = 240
DECISION_MAX = 240
UNFINISHED_MAX = 240
FILE_MAX = 200
SEGMENT_LIMIT = 40  # 每段最多保留条数

# 注入边界标记(模型据此区分"自动注入的接力摘要"与"用户真实输入")
RELAY_MARKER_START = "<<<<< IHUI 跨会话接力摘要（自动注入 · 非用户输入）>>>>>"
RELAY_MARKER_END = "<<<<< 接力摘要结束（此后为用户 / 助手真实对话）>>>>>"

# =============================================================================
# 价值分类正则(思路复用 compaction_quality,此处自包含实现)
# =============================================================================

# 绝对 / 盘符 / 相对路径
_FILE_PATH_RE = re.compile(
    r"(?<![A-Za-z0-9_/\\])(?:[A-Za-z]:[\\/]|[\\/]|[A-Za-z0-9_.-]+[\\/])"
    r"[A-Za-z0-9_./\\~-]{2,60}"
)
# 大写缩写 / 驼峰实体(命名实体)
_ENTITY_RE = re.compile(r"\b[A-Z][A-Z0-9]{2,}(?:[_-][A-Z0-9]+)*\b")
# 意图模式:动词 -> 对象;对象在接力中视为"关键决定/动作"
_INTENT_PATTERNS: list[tuple[str, re.Pattern[str]]] = [
    ("创建", re.compile(r"(?<![A-Za-z])(?:create|add|make|新建|创建|新增)\s+([A-Za-z0-9_./\\:一-龥]{2,40})")),
    ("修改", re.compile(r"(?<![A-Za-z])(?:change|modify|edit|rename|set|update|修改|编辑|重命名|调整)\s+([A-Za-z0-9_./\\:一-龥]{2,40})")),
    ("删除", re.compile(r"(?<![A-Za-z])(?:delete|remove|drop|删除|移除|清理)\s+([A-Za-z0-9_./\\:一-龥]{2,40})")),
    ("调用", re.compile(r"(?<![A-Za-z])(?:call|invoke|run|execute|调用|执行|运行)\s+([A-Za-z0-9_./\\:一-龥]{2,40})")),
    ("约束", re.compile(r"(?<![A-Za-z])(?:ensure|make sure|verify|check|must not|never|确保|务必|禁止|不要|不能|必须不)\s+([\w./\\:一-龥]{2,40})")),
]

# 低价值口语(明显非任务信息,抽取时直接跳过)
_LOW_VALUE_TOKENS: frozenset[str] = frozenset(
    {"hello", "hi", "thanks", "thank you", "sure", "ok", "okay", "got it",
     "understood", "bye", "great", "yes", "no", "你好", "谢谢", "好的", "明白", "收到"}
)


# =============================================================================
# 数据模型
# =============================================================================


class RelaySummary(BaseModel):
    """跨会话接力摘要(五段结构化)。"""

    model_config = ConfigDict(extra="forbid")

    summary_id: str = ""
    thread_id: str = ""
    prev_thread_id: str | None = None
    objective: str = ""
    completed_steps: list[str] = Field(default_factory=list)
    key_decisions: list[str] = Field(default_factory=list)
    unfinished: list[str] = Field(default_factory=list)
    files: list[str] = Field(default_factory=list)
    refined: bool = False
    created_at: float = Field(default_factory=time.time)

    @classmethod
    def from_store_row(cls, row: dict[str, Any]) -> RelaySummary:
        """从 SessionStore 行(dict)重建模型(payload 已含各段列表)。"""
        payload = row.get("payload") or {}
        if isinstance(payload, str):
            import json

            payload = json.loads(payload)
        return cls(
            summary_id=str(row.get("summary_id", "")),
            thread_id=str(row.get("thread_id", "")),
            prev_thread_id=row.get("prev_thread_id"),
            objective=str(row.get("objective", "")),
            completed_steps=list(payload.get("completed_steps", []) or []),
            key_decisions=list(payload.get("key_decisions", []) or []),
            unfinished=list(payload.get("unfinished", []) or []),
            files=list(payload.get("files", []) or []),
            refined=bool(row.get("refined", False)),
            created_at=float(row.get("created_at", 0.0) or 0.0),
        )


# =============================================================================
# 开关 & LLM 精炼
# =============================================================================


def relay_llm_refine_enabled() -> bool:
    """LLM 精炼总开关(env 门控,默认关闭)。"""
    return os.getenv(RELAY_LLM_REFINE_ENV, "0").strip().lower() in ("1", "true", "yes", "on")


# LLM 精炼函数的签名:接收拼接好的 prompt 文本,返回精炼后的结构化 dict(或 str)。
_LLMRefineFn = Callable[[str], Any]


def _clip(text: str, limit: int) -> str:
    text = text.strip()
    if len(text) > limit:
        return text[:limit].rstrip() + "…"
    return text


def _dedup_keep_order(values: list[str]) -> list[str]:
    seen: set[str] = set()
    out: list[str] = []
    for v in values:
        key = v.strip().lower()
        if not key or key in seen:
            continue
        seen.add(key)
        out.append(v.strip())
    return out


# =============================================================================
# 确定性抽取(默认路径,零 LLM)
# =============================================================================


def _extract_intents(text: str) -> list[str]:
    """从文本抽取意图(关键决定/动作)。"""
    out: list[str] = []
    for verb, pat in _INTENT_PATTERNS:
        for m in pat.finditer(text):
            obj = (m.group(1) or "").strip()
            if obj:
                out.append(f"{verb}: {obj}")
    return out


def _extract_files_from_text(text: str) -> list[str]:
    """从文本抽取文件路径(排除 URL)。"""
    out: list[str] = []
    for m in _FILE_PATH_RE.finditer(text):
        tok = m.group(0).rstrip(".,;:!?)\"']")
        if "://" not in tok and len(tok) >= 2:
            out.append(tok)
    return out


def generate_relay_summary(
    items: list[ItemBase],
    *,
    thread_id: str = "",
    prev_thread_id: str | None = None,
    llm_refine: bool = False,
    llm_fn: _LLMRefineFn | None = None,
) -> RelaySummary:
    """从会话 Item 序列确定性生成接力摘要(可选 LLM 精炼)。

    Args:
        items: 该 thread 的 Item 序列(按 seq 升序)。
        thread_id: 摘要归属的 thread(由存储层回填;此处仅透传)。
        prev_thread_id: 「继续上次」时指向的来源 thread。
        llm_refine: 是否尝试 LLM 精炼(**仅当** llm_fn 也提供且全局开关开启时生效)。
        llm_fn: 可选精炼函数(prompt -> 结构化结果);缺失则跳过精炼。

    Returns:
        RelaySummary(确定性草稿;精炼成功则 refined=True 并合并精炼结果)。

    安全:默认路径不调用任何 LLM;精炼异常 → 记录日志并降级回确定性摘要。
    """
    objective_parts: list[str] = []
    completed: list[str] = []
    decisions: list[str] = []
    unfinished: list[str] = []
    files: list[str] = []

    resolved_calls: set[str] = set()
    pending_calls: dict[str, ToolCallItem] = {}
    saw_error = False

    for it in items:
        if isinstance(it, UserMessageItem):
            if not objective_parts:
                objective_parts.append(_clip(it.content, OBJECTIVE_MAX))
            decisions.extend(_extract_intents(it.content))
            files.extend(_extract_files_from_text(it.content))
        elif isinstance(it, AgentMessageItem):
            decisions.extend(_extract_intents(it.content))
            files.extend(_extract_files_from_text(it.content))
        elif isinstance(it, ToolCallItem):
            pending_calls[it.call_id] = it
            files.extend(_extract_files_from_text(it.tool))
        elif isinstance(it, ToolResultItem):
            resolved_calls.add(it.call_id)
            tc = pending_calls.get(it.call_id)
            label = tc.tool if tc is not None else it.call_id
            if it.ok:
                completed.append(_clip(f"✓ 工具 {label}({it.call_id})", STEP_MAX))
            else:
                unfinished.append(_clip(f"✗ 工具 {label} 失败({it.call_id}): {it.error or ''}", UNFINISHED_MAX))
        elif isinstance(it, FileEditItem):
            files.append(it.path)
            completed.append(_clip(f"✓ 编辑文件 {it.path} ({it.op})", STEP_MAX))
        elif isinstance(it, ApprovalResponseItem):
            verdict = "通过" if it.approved else "拒绝"
            label = it.comment or it.request_id
            decisions.append(_clip(f"审批{verdict}({it.request_id}): {label}", DECISION_MAX))
        elif isinstance(it, ErrorItem):
            saw_error = True
            unfinished.append(_clip(f"错误: {it.message}", UNFINISHED_MAX))

    # 悬挂 tool_call → 未完成
    for cid in sorted(set(pending_calls.keys()) - resolved_calls):
        tc = pending_calls[cid]
        unfinished.append(_clip(f"待完成: {tc.tool}({cid})", UNFINISHED_MAX))

    if saw_error and not unfinished:
        unfinished.append("会话曾出现错误(详见上轮日志)")

    objective = _clip(" ".join(objective_parts), OBJECTIVE_MAX)
    completed = _dedup_keep_order(completed)[:SEGMENT_LIMIT]
    decisions = _dedup_keep_order(decisions)[:SEGMENT_LIMIT]
    unfinished = _dedup_keep_order(unfinished)[:SEGMENT_LIMIT]
    files = _dedup_keep_order(files)[:SEGMENT_LIMIT]

    summary = RelaySummary(
        thread_id=thread_id,
        prev_thread_id=prev_thread_id,
        objective=objective,
        completed_steps=completed,
        key_decisions=decisions,
        unfinished=unfinished,
        files=files,
        refined=False,
    )

    if llm_refine and llm_fn is not None and relay_llm_refine_enabled():
        summary = _apply_llm_refine(summary, items, llm_fn)
    return summary


def _apply_llm_refine(
    base: RelaySummary, items: list[ItemBase], llm_fn: _LLMRefineFn
) -> RelaySummary:
    """尝试 LLM 精炼;任何异常 → 降级回 base(确定性摘要)。"""
    try:
        raw_blob = "\n".join(
            it.search_text() for it in items if getattr(it, "search_text", None)
        )
        prompt = (
            "你是会话接力摘要精炼器。基于以下上一会话内容,优化五段摘要(简洁、去重、保留关键信息)。\n"
            f"原始摘要:\n目标={base.objective}\n完成={base.completed_steps}\n"
            f"决定={base.key_decisions}\n未完成={base.unfinished}\n文件={base.files}\n"
            f"会话片段:\n{raw_blob[:4000]}\n"
            "请严格返回 JSON: {objective, completed_steps[], key_decisions[], unfinished[], files[]}"
        )
        result = llm_fn(prompt)
        refined = _parse_llm_refine_result(result, base)
        if refined is not None:
            logger.info("接力摘要 LLM 精炼成功(thread=%s)", base.thread_id)
            return refined
    except Exception as e:  # noqa: BLE001 - 精炼失败必须降级,不能污染主路径
        logger.warning("接力摘要 LLM 精炼失败(降级确定性摘要): %s", e)
    return base


def _parse_llm_refine_result(result: Any, base: RelaySummary) -> RelaySummary | None:
    """把 LLM 返回(可能是 dict / JSON str)解析成 RelaySummary;非法 → None。"""
    import json

    data: Any = result
    if isinstance(result, str):
        try:
            data = json.loads(result)
        except Exception as e:  # noqa: BLE001
            logger.warning("接力摘要精炼结果非 JSON(降级): %s", e)
            return None
    if not isinstance(data, dict):
        return None

    def _as_list(v: Any) -> list[str]:
        if isinstance(v, list):
            return [str(x) for x in v if str(x).strip()]
        return []

    return RelaySummary(
        thread_id=base.thread_id,
        prev_thread_id=base.prev_thread_id,
        objective=_clip(str(data.get("objective") or base.objective), OBJECTIVE_MAX) or base.objective,
        completed_steps=_as_list(data.get("completed_steps")) or base.completed_steps,
        key_decisions=_as_list(data.get("key_decisions")) or base.key_decisions,
        unfinished=_as_list(data.get("unfinished")) or base.unfinished,
        files=_as_list(data.get("files")) or base.files,
        refined=True,
    )


# =============================================================================
# 恢复注入(清晰边界标记,防污染)
# =============================================================================


def build_relay_injection(summary: RelaySummary) -> str:
    """把摘要渲染成带边界标记的注入文本(system 消息正文)。"""
    lines: list[str] = [
        RELAY_MARKER_START,
        "以下是上一会话的结构化接力摘要,供你延续工作(请勿将其视为用户本轮最新指令):",
        "",
        f"任务目标: {summary.objective or '(未记录)'}",
        "",
        "已完成步骤:",
    ]
    if summary.completed_steps:
        lines.extend(f"  - {s}" for s in summary.completed_steps)
    else:
        lines.append("  (无)")
    lines.append("")
    lines.append("关键决定:")
    if summary.key_decisions:
        lines.extend(f"  - {s}" for s in summary.key_decisions)
    else:
        lines.append("  (无)")
    lines.append("")
    lines.append("未完成事项:")
    if summary.unfinished:
        lines.extend(f"  - {s}" for s in summary.unfinished)
    else:
        lines.append("  (无)")
    lines.append("")
    lines.append("涉及文件:")
    if summary.files:
        lines.extend(f"  - {s}" for s in summary.files)
    else:
        lines.append("  (无)")
    lines.append("")
    lines.append(RELAY_MARKER_END)
    return "\n".join(lines)


def inject_relay_summary_into_messages(
    summary: RelaySummary, messages: list[LLMMessage]
) -> list[LLMMessage]:
    """把接力摘要作为 system 消息前置到消息历史(边界标记包裹)。"""
    injected = LLMMessage(role="system", content=build_relay_injection(summary))
    return [injected, *messages]


__all__ = [
    "RELAY_LLM_REFINE_ENV",
    "RELAY_MARKER_END",
    "RELAY_MARKER_START",
    "RelaySummary",
    "build_relay_injection",
    "generate_relay_summary",
    "inject_relay_summary_into_messages",
    "relay_llm_refine_enabled",
]
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍​‌‌‌​‌‌‌​‌‌‌​‌‍‍​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍​‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
