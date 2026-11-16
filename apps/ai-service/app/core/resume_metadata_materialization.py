# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""CompactionResumeMetadata 物化算法（对标 Codex 26.1111 cold 物化）。

设计依据（2026-11-16，下潜 外部程序 364.8MB 主引擎，strings 定向抽取）。
对照物 codex-core 的 rollout 复合 payload：`struct CompactionResumeMetadata with 6
elements`（结构体声明逐字，字段组成非逐字——见下方诚实边界）+ SQL schema 暴露的两个
summary 时间锚：
  summary_first_user_*  8 项（turn_id / item_id / rollout_ordinal / updated_at_ordinal
                              / created_at_ms / started_at_ms / completed_at_ms / item_json）
  summary_final_agent_* 同上 8 项
cold_resume / cold_fork 物化 thread 历史时，这两个 summary 锚是重建「首条用户消息」
与「最近一条 agent 消息」的时间定位。

管：给定 CompactionResumeMetadata 的 6 元素（first_user 锚 + final_agent 锚 + 顺序锚 +
压缩响应锚）、以及当前 rollout 磁盘上是否可读到这两个 summary 视图，判定 cold 物化这一步
该怎么走 —— MATERIALIZE_FULL（两个锚齐全）/ DEGRADE_TO_PARTIAL（缺 final_agent 锚，用
first_user 起点重建）/ FAIL_NO_ANCHOR（两个锚都缺，拒绝物化）/ FAIL_ORDER_MISMATCH
（next_order 与磁盘 summary 的 rollout_ordinal 冲突）。

不管：resume kind 分类（turn_resume_kind）、Windows job object 挂起恢复（同上）、
挂起侧四段顺序（turn_suspension）、真实磁盘 IO。

一轴超越：对照把「两个 summary 锚缺失/冲突」散在 SQL 查询的运行时分支（查不到就降级或
panic），且 next_order 与 rollout_ordinal 的冲突判据没有显式化。本仓提前为纯函数：结论
可 diff、可单测、可在编排层挂前置，每档带命中的锚字段名 + 冲突的具体 ordinal。
"""

from __future__ import annotations

from dataclasses import dataclass
from enum import StrEnum
from typing import Any

# ── 对照物逐字锚（防篡改证据，全部来自 strings）────────────────────────────
VERBATIM_STRUCT_COMPACTION_RESUME_METADATA = (
    "struct CompactionResumeMetadata with 6 elements"
)

# SQL schema 暴露的两个 summary 视图字段（cold 物化时用到的时间锚）
SUMMARY_FIRST_USER_FIELDS: tuple[str, ...] = (
    "turn_id",
    "item_id",
    "rollout_ordinal",
    "updated_at_ordinal",
    "created_at_ms",
    "started_at_ms",
    "completed_at_ms",
    "item_json",
)
SUMMARY_FINAL_AGENT_FIELDS: tuple[str, ...] = SUMMARY_FIRST_USER_FIELDS

# 6 元素推定组成（结构体声明逐字，字段组成是推定——见诚实边界）
COMPACTION_RESUME_METADATA_ELEMENTS: tuple[str, ...] = (
    "first_user_turn_id",
    "first_user_item_json",
    "final_agent_turn_id",
    "final_agent_item_json",
    "next_order",
    "compaction_response_id",
)


class MaterializationDecision(StrEnum):
    """cold 物化状态机的四档结论。"""

    MATERIALIZE_FULL = "MATERIALIZE_FULL"  # 两个锚齐全
    DEGRADE_TO_PARTIAL = "DEGRADE_TO_PARTIAL"  # 缺 final_agent 锚
    FAIL_NO_ANCHOR = "FAIL_NO_ANCHOR"  # 两个锚都缺
    FAIL_ORDER_MISMATCH = "FAIL_ORDER_MISMATCH"  # next_order 冲突


@dataclass(frozen=True)
class ResumeMetadata:
    """CompactionResumeMetadata 的 6 元素（对标结构体声明）。"""

    first_user_turn_id: str | None = None
    first_user_item_json: str | None = None
    final_agent_turn_id: str | None = None
    final_agent_item_json: str | None = None
    next_order: int | None = None
    compaction_response_id: str | None = None

    def has_first_user_anchor(self) -> bool:
        return self.first_user_turn_id is not None and self.first_user_item_json is not None

    def has_final_agent_anchor(self) -> bool:
        return self.final_agent_turn_id is not None and self.final_agent_item_json is not None


@dataclass(frozen=True)
class DiskSummaryView:
    """磁盘 rollout summary 视图（对标 SQL schema 查询结果）。"""

    readable: bool = False
    # first_user / final_agent 视图的 rollout_ordinal（用于与 next_order 对账）
    first_user_rollout_ordinal: int | None = None
    final_agent_rollout_ordinal: int | None = None


@dataclass(frozen=True)
class MaterializationOutcome:
    """cold 物化状态机的输出结论。"""

    decision: MaterializationDecision
    evidence: str  # 命中的锚字段名 + 冲突的具体 ordinal
    materialized_anchors: tuple[str, ...]  # 实际物化了的锚（first_user / final_agent）

    def to_dict(self) -> dict[str, Any]:
        return {
            "decision": self.decision.value,
            "evidence": self.evidence,
            "materialized_anchors": list(self.materialized_anchors),
        }


def classify_materialization(
    meta: ResumeMetadata, disk: DiskSummaryView
) -> MaterializationOutcome:
    """给定 resume metadata 与磁盘 summary 视图，判定 cold 物化这一步怎么走。

    判定优先级（对标 SQL 查询 fallthrough 顺序）：
      1. 两个锚都缺 → FAIL_NO_ANCHOR（拒绝物化，磁盘 summary 不可读也归此档）。
      2. next_order 与磁盘 final_agent_rollout_ordinal 冲突 → FAIL_ORDER_MISMATCH
         （rollout 已推进到 next_order 之后，summary 视图过期）。
      3. first_user 锚有 + final_agent 锚缺 → DEGRADE_TO_PARTIAL（用 first_user 起点
         重建，放弃 final_agent 锚）。
      4. 两个锚齐全 → MATERIALIZE_FULL。
    """
    has_first = meta.has_first_user_anchor()
    has_final = meta.has_final_agent_anchor()

    # 1. 两个锚都缺 / 磁盘 summary 不可读
    if not has_first and not has_final:
        return MaterializationOutcome(
            decision=MaterializationDecision.FAIL_NO_ANCHOR,
            evidence=(
                "no anchors: first_user_turn_id/first_user_item_json "
                "and final_agent_turn_id/final_agent_item_json both missing"
            ),
            materialized_anchors=(),
        )
    if not disk.readable:
        return MaterializationOutcome(
            decision=MaterializationDecision.FAIL_NO_ANCHOR,
            evidence="disk summary view not readable",
            materialized_anchors=(),
        )

    # 2. next_order 与磁盘 final_agent_rollout_ordinal 冲突
    if (
        meta.next_order is not None
        and disk.final_agent_rollout_ordinal is not None
        and meta.next_order <= disk.final_agent_rollout_ordinal
    ):
        return MaterializationOutcome(
            decision=MaterializationDecision.FAIL_ORDER_MISMATCH,
            evidence=(
                f"next_order={meta.next_order} <= "
                f"final_agent_rollout_ordinal={disk.final_agent_rollout_ordinal}"
            ),
            materialized_anchors=(),
        )

    # 3. first_user 锚有 + final_agent 锚缺 → DEGRADE_TO_PARTIAL
    if has_first and not has_final:
        return MaterializationOutcome(
            decision=MaterializationDecision.DEGRADE_TO_PARTIAL,
            evidence="first_user anchor present; final_agent anchor missing",
            materialized_anchors=("first_user",),
        )

    # 4. 两个锚齐全
    return MaterializationOutcome(
        decision=MaterializationDecision.MATERIALIZE_FULL,
        evidence=VERBATIM_STRUCT_COMPACTION_RESUME_METADATA,
        materialized_anchors=("first_user", "final_agent"),
    )


def materialization_elements() -> tuple[str, ...]:
    """返回 6 元素推定组成，供编排层校验元数据完整性（fail-closed）。"""
    return COMPACTION_RESUME_METADATA_ELEMENTS
