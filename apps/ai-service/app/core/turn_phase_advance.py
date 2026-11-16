# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""回合前进决策（turn phase advance）—— 对标 Codex 26.1111 turn_timing。

取证来源（2026-11-16，下潜 codex.exe 364.8MB 主引擎，strings 定向抽取）。
对照物 codex-core 的 `turn_timing.rs` + `session::retained_context.rs`：
任务级 phase 枚举与 orchestrator 错误前进决策（逐字文案见下方常量）。

管：给定回合当前所处任务级 phase、是否已注册任务、是否到达 stop point、本轮遇到的
错误档，判定编排器这一步该怎么走 —— CONTINUING（吞错续跑）/ HALTING（整回合停）/
ENDING_EARLY（未 transmit 即提前收束）。纯函数判据层。

不管：错误族归类（agent_failure_vocabulary 已做 retryable/terminal/undetermined）、
终态 stop_reason 封闭集（turn_stop_reason）、工具执行恢复档（agent_resume_semantics）、
真实网络传输。

本仓三层分工（与既有模块互补，均不重叠）：
- agent_failure_vocabulary: 错误 → 族（retryable/terminal）；
- turn_stop_reason: 回合终态档位封闭集（done 帧）；
- 本模块: 回合**进行中**每一步的前进动作 + 任务级 phase 前进链 —— 填补空白。

一轴超越：对照把这三档散在 codex-core orchestrator 的运行时分支（遇到错误才判），且
「非致命错误在 transmit 前后走不同档」这一关键分野没有显式化。本仓提前为纯函数：结论
可 diff、可单测、可在编排层挂前置，`END_EARLY` 显式带命中的 stop point。
"""

from __future__ import annotations

from dataclasses import dataclass
from enum import Enum

__all__ = [
    "TurnPhase",
    "OrchestratorStopPoint",
    "OrchestratorActionKind",
    "OrchestratorAction",
    "CODEX_ERR_CONTINUING",
    "CODEX_ERR_HALTING",
    "CODEX_ERR_ENDING_EARLY",
    "advance_orchestrator",
    "task_phase_order",
]

# 逐字错误锚（测试按常量断言，不手抄字符串）
CODEX_ERR_CONTINUING = "encountered orchestrator error; continuing"
CODEX_ERR_HALTING = "encountered orchestrator error; halting"
CODEX_ERR_ENDING_EARLY = (
    "ending orchestration early because the stop point is `BeforeTransmit`"
)


class TurnPhase(str, Enum):  # noqa: UP042 — 改 StrEnum 会变 str() 输出,属行为重写
    """任务级 phase（对标 retained_context.rs 的 phase 枚举，非 http transmit 层）。

    TASK_START → TASK_REGISTERED → REGULAR_TASK_START 是正常启动链；
    CUSTOM_CA / EXPLICIT_TLS 是 TLS/CA 配置 phase（在发起请求前可降级配置）。
    """

    TASK_START = "task_start"
    TASK_REGISTERED = "task_registered"
    REGULAR_TASK_START = "regular_task_start"
    CUSTOM_CA = "custom_ca"
    EXPLICIT_TLS = "explicit_tls"
    TRANSMIT = "transmit"  # 已进入传输（对应 BeforeTransmit 之后）


class OrchestratorStopPoint(str, Enum):  # noqa: UP042 — 同上
    """orchestrator stop point。取证确认 Codex 目前唯一具名 stop point = BeforeTransmit。"""

    BEFORE_TRANSMIT = "before_transmit"
    NONE = "none"


class OrchestratorActionKind(str, Enum):  # noqa: UP042 — 同上
    """orchestrator 遇错前进三档（逐字对齐 codex-core orchestrator）。"""

    CONTINUING = "continuing"  # 吞非致命错误续跑
    HALTING = "halting"  # 致命错误整回合停
    ENDING_EARLY = "ending_early"  # stop point 命中，未 transmit 即收束


@dataclass(frozen=True)
class OrchestratorAction:
    """前进决策：动作档 + 命中的 codex 错误锚 + 原因（可审计）。"""

    kind: OrchestratorActionKind
    codex_error: str | None = None
    reason: str = ""


def task_phase_order() -> tuple[TurnPhase, ...]:
    """正常启动链 phase 顺序（CUSTOM_CA/EXPLICIT_TLS 属旁支配置 phase，不入主链）。"""
    return (
        TurnPhase.TASK_START,
        TurnPhase.TASK_REGISTERED,
        TurnPhase.REGULAR_TASK_START,
        TurnPhase.TRANSMIT,
    )


def advance_orchestrator(
    *,
    phase: TurnPhase,
    task_registered: bool,
    stop_point: OrchestratorStopPoint,
    fatal_error: bool,
) -> OrchestratorAction:
    """按 codex orchestrator 前进判据决定这一步动作。

    判据链（优先级从上到下）：

    1. 致命错误：已 transmit(phase==TRANSMIT) ⇒ HALTING；未 transmit ⇒ ENDING_EARLY。
    2. 无致命错误但到达 BeforeTransmit stop point ⇒ ENDING_EARLY（未发请求即收束）。
    3. 非致命错误（task_registered=True）⇒ CONTINUING（吞错续跑）。
    4. 非 fatal、未到 stop point、无错误 ⇒ CONTINUING（正常推进）。
    """
    at_or_past_transmit = phase is TurnPhase.TRANSMIT
    if fatal_error:
        if at_or_past_transmit:
            return OrchestratorAction(
                kind=OrchestratorActionKind.HALTING,
                codex_error=CODEX_ERR_HALTING,
                reason="fatal orchestrator error at/after transmit; halting the turn",
            )
        return OrchestratorAction(
            kind=OrchestratorActionKind.ENDING_EARLY,
            codex_error=CODEX_ERR_ENDING_EARLY,
            reason="fatal orchestrator error before transmit; stop point is BeforeTransmit",
        )
    if stop_point is OrchestratorStopPoint.BEFORE_TRANSMIT:
        return OrchestratorAction(
            kind=OrchestratorActionKind.ENDING_EARLY,
            codex_error=CODEX_ERR_ENDING_EARLY,
            reason="stop point BeforeTransmit reached before request transmitted",
        )
    if not fatal_error and task_registered:
        return OrchestratorAction(
            kind=OrchestratorActionKind.CONTINUING,
            codex_error=CODEX_ERR_CONTINUING,
            reason="non-fatal orchestrator error after task registration; continuing",
        )
    return OrchestratorAction(
        kind=OrchestratorActionKind.CONTINUING,
        codex_error=CODEX_ERR_CONTINUING,
        reason="no fatal error and no stop point; advancing to next phase",
    )
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
