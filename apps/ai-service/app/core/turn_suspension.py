# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""回合挂起状态机（turn suspension state machine）—— 遵循统一工程规范。

设计依据（2026-11-16，下潜 外部程序 364.8MB 主引擎，strings 定向抽取）。
对照物 codex-core 的 `session/turn_suspension.rs`（逐字错误串见下方常量）。
对照在 suspension.rs:74 / :77 两处发事件（带 thread_id），把「挂起一个未完成的
root turn」做成显式状态机，而不是把未落盘的中间态直接丢掉。

管：给定「是否正在挂起一个未完成的 root turn」「是否有运行中的 task」「是否有
运行中的 turn」「挂起前后 flush 与 writer 关闭是否失败」「挂起的 task 是怎么退出的」，
判定挂起状态机这一步该怎么走 —— REJECT（前置校验拒绝，没有可挂的东西）/ ABORT
（挂起的 task 异常退出，不优雅停止就 abort）/ FAILED（挂起四段顺序里某段失败，挂起
动作本身出错，状态机停在挂起中）/ SUSPENDED（挂起成功，等 resume_metadata 触发恢复）。

不管：phase 前进（turn_phase_advance）、错误族归类（agent_failure_vocabulary）、
终态 stop_reason（turn_stop_reason）、真实磁盘 flush。

本仓三层分工（与既有模块互补，均不重叠）：
- agent_resume_semantics: 工具执行恢复档（确认 payload / 继续 / 终止），非回合级；
- turn_phase_advance: 回合进行中每一步的前进动作 + phase 前进链；
- 本模块: 回合**级挂起**的四段顺序状态机 + 两个前置校验 + abort 判据 —— 填补空白。

一轴超越：对照把挂起四段顺序散在 suspension.rs 的运行时 fallthrough（flush_before
→ suspend → flush_after → close_writer，遇到错误才判），且「没有可挂的东西」与
「挂起的 task 异常退出」是两类不同前置，对照靠运行时 panic 文案隐式区分。本仓提前为
纯函数：结论可 diff、可单测、可在编排层挂前置，每档带逐字 codex 错误锚 + 命中的
suspension.rs 行号。
"""

from __future__ import annotations

from dataclasses import dataclass
from enum import StrEnum
from typing import Any

# ── 对照物逐字锚（防篡改证据，全部来自 suspension.rs strings）────────────────
SUSPENSION_RS_EVENT_LINES: tuple[str, ...] = (
    "event core\\src\\session\\turn_suspension.rs:74",
    "event core\\src\\session\\turn_suspension.rs:77",
)
SUSPENSION_RS_EVENT_SOURCE = "codex_core::session::turn_suspension"

VERBATIM_NO_RUNNING_TASK = "accepted root turn suspension had no running task"
VERBATIM_NO_RUNNING_TURN = "accepted root turn suspension had no running turn"
VERBATIM_SUSPEND_UNFINISHED_ROOT_TURN = "suspend an unfinished root turn"
VERBATIM_FLUSH_BEFORE_FAILED_PREFIX = "flush before root turn suspension failed: "
VERBATIM_FLUSH_AFTER_FAILED_PREFIX = "flush after root turn suspension failed: "
VERBATIM_CLOSE_WRITER_FAILED_PREFIX = "close suspended root turn writer failed: "
VERBATIM_TASK_EXITED_ABNORMALLY = "suspended turn task exited abnormally"
VERBATIM_TASK_NOT_GRACEFUL = (
    "suspended turn task did not stop gracefully; aborting it"
)

# 挂起四段顺序（对照物 suspension.rs fallthrough 顺序，逐字）
SUSPENSION_STEP_ORDER: tuple[str, ...] = (
    "flush_before",
    "suspend",
    "flush_after",
    "close_writer",
)


class SuspensionDecision(StrEnum):
    """挂起状态机的四档结论。"""

    REJECT = "REJECT"  # 前置校验拒绝：没有可挂的东西
    ABORT = "ABORT"  # 挂起的 task 异常退出，不优雅停止就 abort
    FAILED = "FAILED"  # 挂起动作本身失败（四段顺序里某段抛错）
    SUSPENDED = "SUSPENDED"  # 挂起成功


@dataclass(frozen=True)
class SuspensionInput:
    """挂起状态机的输入字段（对标 suspension.rs 的入参与内部状态）。"""

    suspending_unfinished_root_turn: bool = False
    has_running_task: bool = False
    has_running_turn: bool = False
    # 挂起四段的失败描述：None = 该段成功；非 None = 该段抛错的具体信息
    flush_before_error: str | None = None
    flush_after_error: str | None = None
    close_writer_error: str | None = None
    suspend_write_error: str | None = None
    # 挂起的 task 怎么退出的（对标 suspension.rs 的 JoinHandle 结果）
    task_exit: str = "graceful"  # graceful | abnormal | not_graceful


@dataclass(frozen=True)
class SuspensionOutcome:
    """挂起状态机的输出结论（对标 suspension.rs:74/77 的 event payload）。"""

    decision: SuspensionDecision
    evidence: str  # 逐字 codex 错误锚或确认文案
    source_line: str  # suspension.rs:NN

    def to_dict(self) -> dict[str, Any]:
        return {
            "decision": self.decision.value,
            "evidence": self.evidence,
            "source_line": self.source_line,
        }


def evaluate_suspension(inp: SuspensionInput) -> SuspensionOutcome:
    """给定挂起输入，判定状态机这一步该怎么走。

    判定优先级（对标 suspension.rs 运行时 fallthrough 顺序）：
      1. 前置校验：没在挂起未完成 root turn → 不走状态机（REJECT, 无锚）。
      2. 前置校验：有运行中的 task → 否则 REJECT（`... had no running task`）。
      3. 前置校验：有运行中的 turn → 否则 REJECT（`... had no running turn`）。
      4. abort 判据：task_exit ∈ {abnormal, not_graceful} → ABORT
         （对照把这两种归一为「不优雅停止就 abort」，两条逐字锚）。
      5. 挂起四段顺序失败 → FAILED（flush_before → suspend → flush_after →
         close_writer，按顺序检查，命中即停，带该段的逐字前缀）。
      6. 全部通过 → SUSPENDED（逐字 `suspend an unfinished root turn`）。
    """
    if not inp.suspending_unfinished_root_turn:
        return SuspensionOutcome(
            decision=SuspensionDecision.REJECT,
            evidence="not suspending: no unfinished root turn to suspend",
            source_line="suspension.rs:none",
        )
    if not inp.has_running_task:
        return SuspensionOutcome(
            decision=SuspensionDecision.REJECT,
            evidence=VERBATIM_NO_RUNNING_TASK,
            source_line="suspension.rs:74",
        )
    if not inp.has_running_turn:
        return SuspensionOutcome(
            decision=SuspensionDecision.REJECT,
            evidence=VERBATIM_NO_RUNNING_TURN,
            source_line="suspension.rs:77",
        )
    if inp.task_exit == "abnormal":
        return SuspensionOutcome(
            decision=SuspensionDecision.ABORT,
            evidence=VERBATIM_TASK_EXITED_ABNORMALLY,
            source_line="suspension.rs:74",
        )
    if inp.task_exit == "not_graceful":
        return SuspensionOutcome(
            decision=SuspensionDecision.ABORT,
            evidence=VERBATIM_TASK_NOT_GRACEFUL,
            source_line="suspension.rs:77",
        )
    if inp.flush_before_error is not None:
        return SuspensionOutcome(
            decision=SuspensionDecision.FAILED,
            evidence=VERBATIM_FLUSH_BEFORE_FAILED_PREFIX + inp.flush_before_error,
            source_line="suspension.rs:74",
        )
    if inp.suspend_write_error is not None:
        return SuspensionOutcome(
            decision=SuspensionDecision.FAILED,
            evidence="suspend write to rollout failed: " + inp.suspend_write_error,
            source_line="suspension.rs:74",
        )
    if inp.flush_after_error is not None:
        return SuspensionOutcome(
            decision=SuspensionDecision.FAILED,
            evidence=VERBATIM_FLUSH_AFTER_FAILED_PREFIX + inp.flush_after_error,
            source_line="suspension.rs:77",
        )
    if inp.close_writer_error is not None:
        return SuspensionOutcome(
            decision=SuspensionDecision.FAILED,
            evidence=VERBATIM_CLOSE_WRITER_FAILED_PREFIX + inp.close_writer_error,
            source_line="suspension.rs:77",
        )
    return SuspensionOutcome(
        decision=SuspensionDecision.SUSPENDED,
        evidence=VERBATIM_SUSPEND_UNFINISHED_ROOT_TURN,
        source_line="suspension.rs:74",
    )


def suspension_step_order() -> tuple[str, ...]:
    """返回挂起四段的固定顺序，供编排层校验落盘顺序（fail-closed）。"""
    return SUSPENSION_STEP_ORDER
