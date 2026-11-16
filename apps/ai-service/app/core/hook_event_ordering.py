# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠


"""Hook event 触发时序拓扑（对标 Codex 26.1111 lifecycle.rs 发射顺序）。

设计依据（2026-11-16，下潜 外部程序 364.8MB 主引擎，strings 定向抽取）。
对照物 codex-core 的 hook_runtime + lifecycle：
- 14 项 hook event 封闭集（R16 已交付 CodexHookEvent）。
- 多处重复字符串的声明顺序逐字锚（见 HOOK_DECLARATION_ORDER）。
- transcript flush **先于** Interrupt / SessionEnd / SubagentStop 三个 hook 的
  逐字约束：`failed to flush transcript before Interrupt hook: ` /
  `failed to flush transcript before SessionEnd hook: `。

管：给定一次 turn 生命周期内的事件发射序列（列表），判定序列是否合法——
  OK（无违规），
  PRE_BEFORE_POST_VIOLATION（Pre* 未先于对应 Post*），
  FLUSH_BEFORE_HOOK_VIOLATION（Interrupt/SessionEnd/SubagentStop 前未 flush transcript），
  SESSION_BOUNDARY_VIOLATION（SessionEnd 在 SessionStart 之前 / SessionStart 重复），
  UNKNOWN_EVENT（序列里出现非封闭集事件）。

不管：hook event 封闭集定义（hook_exit_contract.CodexHookEvent）、
exit-code-2 stderr 契约（hook_exit_contract）、真实 hook 执行。

一轴超越：对照把发射顺序散在 lifecycle.rs 各处 fallthrough（遇到事件才调 emit），
本仓提前为纯函数：给序列一次校验完所有违规，便于编排层挂前置 + 回归测试钉住。
"""

from __future__ import annotations

from dataclasses import dataclass
from enum import StrEnum
from typing import Any

# ── 对照物逐字锚（防篡改证据，全部来自 strings）────────────────────────────
# 14 项 hook event 声明顺序（strings 多处重复，此处取最完整一处）
HOOK_DECLARATION_ORDER: tuple[str, ...] = (
    "PreToolUse",
    "PermissionRequest",
    "PostToolUse",
    "PreCompact",
    "PostCompact",
    "SessionStart",
    "SessionEnd",
    "UserPromptSubmit",
    "SubagentStart",
    "SubagentStop",
    "Stop",
    "Interrupt",
    "PreModelRequest",
    "PostModelRequest",
)

HOOK_EVENT_TOTAL = len(HOOK_DECLARATION_ORDER)  # 14

# transcript flush 必须先于这三类 hook（逐字）
FLUSH_BEFORE_HOOKS: frozenset[str] = frozenset(
    {"Interrupt", "SessionEnd", "SubagentStop"}
)
VERBATIM_FLUSH_BEFORE_INTERRUPT = (
    "failed to flush transcript before Interrupt hook: "
)
VERBATIM_FLUSH_BEFORE_SESSION_END = (
    "failed to flush transcript before SessionEnd hook: "
)

# Pre/Post 配对（生命周期对称）
PRE_POST_PAIRS: dict[str, str] = {
    "PreToolUse": "PostToolUse",
    "PreCompact": "PostCompact",
    "PreModelRequest": "PostModelRequest",
}
POST_PRE_PAIRS: dict[str, str] = {v: k for k, v in PRE_POST_PAIRS.items()}

# 合法事件集合（与 hook_exit_contract.CodexHookEvent 同源，不替换）
VALID_EVENTS: frozenset[str] = frozenset(HOOK_DECLARATION_ORDER)


class OrderingViolation(StrEnum):
    """时序违规类型。"""

    OK = "OK"
    PRE_BEFORE_POST_VIOLATION = "PRE_BEFORE_POST_VIOLATION"
    FLUSH_BEFORE_HOOK_VIOLATION = "FLUSH_BEFORE_HOOK_VIOLATION"
    SESSION_BOUNDARY_VIOLATION = "SESSION_BOUNDARY_VIOLATION"
    UNKNOWN_EVENT = "UNKNOWN_EVENT"


@dataclass(frozen=True)
class SequenceCheck:
    """序列校验结果。"""

    verdict: OrderingViolation
    violations: tuple[str, ...]  # 每条带具体事件名/位置

    @property
    def ok(self) -> bool:
        return self.verdict is OrderingViolation.OK

    def to_dict(self) -> dict[str, Any]:
        return {
            "verdict": self.verdict.value,
            "violations": list(self.violations),
        }


def validate_hook_sequence(
    sequence: list[str],
    *,
    flush_positions: list[int] | None = None,
) -> SequenceCheck:
    """给定一次 turn 的 hook event 发射序列，判定是否合法。

    参数
      sequence       : 事件名列表（按发射顺序）。
      flush_positions: transcript flush 发生的 sequence 索引（0-based）。
                       缺省 None = 未 flush（任何 FLUSH_BEFORE_HOOKS 事件都会违规）。

    判定优先级（对标 lifecycle.rs fallthrough 顺序）：
      1. 序列里出现非封闭集事件 → UNKNOWN_EVENT（fail-closed）。
      2. SessionEnd 早于 SessionStart / SessionStart 重复 → SESSION_BOUNDARY_VIOLATION。
      3. Post* 早于对应 Pre* → PRE_BEFORE_POST_VIOLATION。
      4. FLUSH_BEFORE_HOOKS 事件前未 flush transcript → FLUSH_BEFORE_HOOK_VIOLATION。
      5. 全部通过 → OK。
    """
    violations: list[str] = []

    # 1. 未知事件
    for idx, ev in enumerate(sequence):
        if ev not in VALID_EVENTS:
            violations.append(f"unknown hook event '{ev}' at index {idx}")

    # 2. Session 边界：SessionStart 必须先于 SessionEnd；SessionStart 不重复
    session_start_idx: int | None = None
    session_end_idx: int | None = None
    for idx, ev in enumerate(sequence):
        if ev == "SessionStart":
            if session_start_idx is not None:
                violations.append(
                    f"SessionStart emitted twice (indices {session_start_idx} and {idx})"
                )
            else:
                session_start_idx = idx
        elif ev == "SessionEnd":
            if session_end_idx is not None:
                violations.append(
                    f"SessionEnd emitted twice (indices {session_end_idx} and {idx})"
                )
            else:
                session_end_idx = idx
    if session_end_idx is not None and (
        session_start_idx is None or session_start_idx > session_end_idx
    ):
        violations.append(
            f"SessionEnd at index {session_end_idx} precedes SessionStart"
            f"{' at index ' + str(session_start_idx) if session_start_idx is not None else ' (never emitted)'}"
        )

    # 3. Pre/Post 配对：Post* 必须晚于对应 Pre*
    pre_seen: dict[str, int] = {}
    for idx, ev in enumerate(sequence):
        if ev in PRE_POST_PAIRS:
            pre_seen.setdefault(ev, idx)
        elif ev in POST_PRE_PAIRS:
            pre_ev = POST_PRE_PAIRS[ev]
            if pre_ev not in pre_seen:
                violations.append(
                    f"{ev} at index {idx} precedes {pre_ev}"
                )

    # 4. transcript flush 先于 FLUSH_BEFORE_HOOKS 事件
    flush_positions_set: set[int] = set(flush_positions or ())
    last_flush_idx: int | None = (
        max(flush_positions_set) if flush_positions_set else None
    )
    for idx, ev in enumerate(sequence):
        if ev in FLUSH_BEFORE_HOOKS:
            if last_flush_idx is None or last_flush_idx > idx:
                violations.append(
                    f"{ev} at index {idx} requires transcript flush before it "
                    f"(last flush at {last_flush_idx})"
                )

    if violations:
        # 优先级：UNKNOWN > SESSION > PRE_POST > FLUSH
        # 精确关键字区分各类违规（避免 FLUSH violation 含 SessionEnd 误判为 SESSION）
        for v in violations:
            if "unknown hook event" in v:
                return SequenceCheck(
                    verdict=OrderingViolation.UNKNOWN_EVENT,
                    violations=tuple(violations),
                )
        for v in violations:
            if "precedes SessionStart" in v or "emitted twice" in v:
                return SequenceCheck(
                    verdict=OrderingViolation.SESSION_BOUNDARY_VIOLATION,
                    violations=tuple(violations),
                )
        for v in violations:
            if "precedes" in v:
                return SequenceCheck(
                    verdict=OrderingViolation.PRE_BEFORE_POST_VIOLATION,
                    violations=tuple(violations),
                )
        return SequenceCheck(
            verdict=OrderingViolation.FLUSH_BEFORE_HOOK_VIOLATION,
            violations=tuple(violations),
        )

    return SequenceCheck(
        verdict=OrderingViolation.OK,
        violations=(),
    )


def hook_declaration_order() -> tuple[str, ...]:
    """返回 14 项 hook event 声明顺序，供编排层校验（fail-closed）。"""
    return HOOK_DECLARATION_ORDER


def flush_before_hooks() -> frozenset[str]:
    """返回「transcript flush 必须先于」的 hook 集合。"""
    return FLUSH_BEFORE_HOOKS
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
