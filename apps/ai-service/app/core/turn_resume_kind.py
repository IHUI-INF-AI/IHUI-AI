# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""回合恢复 kind 封闭集（turn resume kind）—— 遵循统一工程规范。

设计依据（2026-11-16，下潜 外部程序 364.8MB 主引擎，strings 定向抽取）。
对照物 codex-core 的 `session/turn_suspension.rs` + rollout 复合 payload
（resume_metadata / turn_attribution / previous_turn_settings 三个关联字段）。
恢复 kind 六值封闭集逐字来自 strings：
  new · cleared · cold_resume · warm_fork · cold_fork · supplied_history

管：给定「恢复动作从哪里来」（六值 kind 之一）、「是否有 Windows job object 挂起
句柄」、「NTSTATUS 是否非零」，判定这一步的恢复动作该怎么走 —— RESUME_PROCESS
（Windows job object 恢复，NTSTATUS 非零判 FAILED）/ MATERIALIZE（cold_resume /
cold_fork 从磁盘 rollout 物化，CompactionResumeMetadata 缺失判 FAILED）/
FORK（warm_fork / cold_fork 走 fork 语义）/ START_FRESH（new / cleared 不需要
恢复元数据）/ REJECT_SUPPLIED（supplied_history 必须带历史载荷，否则拒）。

不管：挂起侧四段顺序状态机（turn_suspension）、工具执行恢复档（agent_resume_semantics，
step 级）、phase 前进（turn_phase_advance）、真实 NTSTATUS 调用。

一轴超越：对照把 resume kind 判定散在 rollout materialize 的运行时分支（遇到哪种
历史来源才走哪条恢复路径），且「Windows job object 挂起句柄恢复失败」与「磁盘 rollout
物化失败」是两类不同错误、对照靠 panic 文案隐式区分。本仓提前为纯函数：结论可 diff、
可单测、可在编排层挂前置，每档带逐字 codex 错误锚 + 命中的 kind 值。
"""

from __future__ import annotations

from dataclasses import dataclass
from enum import StrEnum
from typing import Any

# ── 对照物逐字锚（防篡改证据，全部来自 strings）────────────────────────────
RESUME_KIND_VALUES: tuple[str, ...] = (
    "new",
    "cleared",
    "cold_resume",
    "warm_fork",
    "cold_fork",
    "supplied_history",
)

VERBATIM_RESUME_PROCESS_FAILED_PREFIX = (
    "failed to resume suspended process: NTSTATUS "
)
VERBATIM_JOB_LOCK_POISONED = "job state lock poisoned"
VERBATIM_STRUCT_COMPACTION_RESUME_METADATA = (
    "struct CompactionResumeMetadata with 6 elements"
)
VERBATIM_RECOVER_TURN = "recover_turn"
VERBATIM_SUSPEND_TURN_AND_SHUTDOWN = "suspend_turn_and_shutdown"
VERBATIM_THREAD_RESUMED_TRACE = "thread_resumed"

# cold 物化必带元数据；warm fork 走内存 fork 不需要磁盘元数据
COLD_KINDS: frozenset[str] = frozenset({"cold_resume", "cold_fork"})
FORK_KINDS: frozenset[str] = frozenset({"warm_fork", "cold_fork"})
FRESH_KINDS: frozenset[str] = frozenset({"new", "cleared"})


class ResumeAction(StrEnum):
    """恢复动作判定（状态机的输出结论）。"""

    RESUME_PROCESS = "RESUME_PROCESS"  # Windows job object 恢复
    MATERIALIZE = "MATERIALIZE"  # 从磁盘 rollout 物化历史
    FORK = "FORK"  # fork 出新 thread
    START_FRESH = "START_FRESH"  # 全新/清空，不需恢复元数据
    REJECT_SUPPLIED = "REJECT_SUPPLIED"  # supplied_history 缺历史载荷
    FAILED = "FAILED"  # 恢复动作本身失败


@dataclass(frozen=True)
class ResumeInput:
    """恢复状态机的输入字段。"""

    kind: str
    # Windows job object 挂起句柄（有则需 RESUME_PROCESS）
    has_suspended_process: bool = False
    ntstatus: int = 0  # 0 = 成功；非 0 = 恢复失败
    job_lock_poisoned: bool = False
    # cold 物化必带的 CompactionResumeMetadata
    has_resume_metadata: bool = False
    # supplied_history 必带历史载荷
    has_supplied_history_payload: bool = False


@dataclass(frozen=True)
class ResumeOutcome:
    """恢复状态机的输出结论。"""

    action: ResumeAction
    evidence: str  # 逐字 codex 错误锚或确认文案
    kind: str  # 命中的 resume kind（六值之一或 unknown）

    def to_dict(self) -> dict[str, Any]:
        return {
            "action": self.action.value,
            "evidence": self.evidence,
            "kind": self.kind,
        }


def classify_resume_kind(inp: ResumeInput) -> ResumeOutcome:
    """给定恢复输入，判定恢复动作。

    判定优先级（对标 rollout materialize 运行时分支顺序）：
      1. 非法 kind → FAILED（kind 不在六值封闭集）。
      2. Windows job object 挂起恢复：has_suspended_process=True 且 ntstatus≠0
         → FAILED（`failed to resume suspended process: NTSTATUS <n>`）。
      3. job_lock_poisoned → FAILED（`job state lock poisoned`）。
      4. has_suspended_process=True 且 ntstatus=0 → RESUME_PROCESS。
      5. cold_resume / cold_fork 且缺 resume_metadata → FAILED（结构体缺失）。
      6. cold_resume / cold_fork 且有 metadata → MATERIALIZE。
      7. warm_fork → FORK。
      8. supplied_history 且缺历史载荷 → REJECT_SUPPLIED。
      9. supplied_history 且有载荷 → MATERIALIZE。
     10. new / cleared → START_FRESH。
    """
    if inp.kind not in RESUME_KIND_VALUES:
        return ResumeOutcome(
            action=ResumeAction.FAILED,
            evidence=f"unknown resume kind: {inp.kind}",
            kind=inp.kind,
        )
    # 2. Windows job object 恢复失败（NTSTATUS 非零）
    if inp.has_suspended_process and inp.ntstatus != 0:
        return ResumeOutcome(
            action=ResumeAction.FAILED,
            evidence=VERBATIM_RESUME_PROCESS_FAILED_PREFIX + str(inp.ntstatus),
            kind=inp.kind,
        )
    # 3. job state lock poisoned
    if inp.job_lock_poisoned:
        return ResumeOutcome(
            action=ResumeAction.FAILED,
            evidence=VERBATIM_JOB_LOCK_POISONED,
            kind=inp.kind,
        )
    # 4. Windows job object 恢复成功路径
    if inp.has_suspended_process and inp.ntstatus == 0:
        return ResumeOutcome(
            action=ResumeAction.RESUME_PROCESS,
            evidence=VERBATIM_RESUME_PROCESS_FAILED_PREFIX + "0 (ok)",
            kind=inp.kind,
        )
    # 5–6. cold 物化（cold_resume / cold_fork）
    if inp.kind in COLD_KINDS:
        if not inp.has_resume_metadata:
            return ResumeOutcome(
                action=ResumeAction.FAILED,
                evidence=VERBATIM_STRUCT_COMPACTION_RESUME_METADATA,
                kind=inp.kind,
            )
        return ResumeOutcome(
            action=ResumeAction.MATERIALIZE,
            evidence=VERBATIM_STRUCT_COMPACTION_RESUME_METADATA,
            kind=inp.kind,
        )
    # 7. warm_fork
    if inp.kind == "warm_fork":
        return ResumeOutcome(
            action=ResumeAction.FORK,
            evidence=inp.kind,
            kind=inp.kind,
        )
    # 8–9. supplied_history
    if inp.kind == "supplied_history":
        if not inp.has_supplied_history_payload:
            return ResumeOutcome(
                action=ResumeAction.REJECT_SUPPLIED,
                evidence=inp.kind + " requires history payload",
                kind=inp.kind,
            )
        return ResumeOutcome(
            action=ResumeAction.MATERIALIZE,
            evidence=inp.kind,
            kind=inp.kind,
        )
    # 10. new / cleared
    return ResumeOutcome(
        action=ResumeAction.START_FRESH,
        evidence=inp.kind,
        kind=inp.kind,
    )


def is_fork_kind(kind: str) -> bool:
    """判断 kind 是否走 fork 语义（warm_fork / cold_fork）。"""
    return kind in FORK_KINDS


def is_cold_kind(kind: str) -> bool:
    """判断 kind 是否走 cold 物化语义（cold_resume / cold_fork）。"""
    return kind in COLD_KINDS


def is_fresh_kind(kind: str) -> bool:
    """判断 kind 是否走全新启动语义（new / cleared）。"""
    return kind in FRESH_KINDS
