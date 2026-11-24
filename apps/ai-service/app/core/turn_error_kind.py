# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""回合错误语义封闭集 —— 遵循统一工程规范。

设计依据（2026-11-18，下潜 外部程序 364.8MB 主引擎，strings 定向抽取）。
对照物 `struct TurnError with 4 elements` + `codex_error_kind` 字段 + kind 枚举
（Running/Interrupted/Errored/Shutdown/NotFound/Misalignment）。

管：给定一次回合失败的原始信号（是否用户主动中断 / 是否已产生输出 / 是否资源缺失 /
是否策略对齐拒绝），判定该回合错误落进哪个语义 kind 封闭集；`Misalignment` 带
codex_error_info 明细。纯函数判据层。

不管：回合生命周期状态机（session_store.TurnStatus running/completed/interrupted/failed，
另一轴）、错误族归类（agent_failure_vocabulary retryable/terminal，另一层）、
turn aborted 片段渲染（current_time_reminder）。

本仓分工（互补不重叠）：
- session_store.TurnStatus = 回合**生命周期**状态机（running→completed/interrupted/failed）；
- agent_failure_vocabulary = 错误→恢复族（retryable/terminal/undetermined）；
- 本模块 = 回合错误的**语义 kind 封闭集**（Codex TurnError.kind，含本仓此前缺失的
  Misalignment「策略对齐拒绝」这一独有类别）。

一轴超越：对照把 kind 判定散在 codex-core 各事件分支（运行时遇到才归类），且 Misalignment
与普通 Errored 在对照里靠 codex_error_info 是否带策略明细区分、无显式判据。本仓提前为
纯函数：给定结构化输入输出唯一 kind，`Misalignment` 由 `misaligned=True` 显式驱动（不再
靠「有无明细」隐式猜），可 diff 可单测可挂回合收尾前置。
"""

from __future__ import annotations

from dataclasses import dataclass
from enum import Enum

__all__ = [
    "TurnErrorKind",
    "TurnError",
    "classify_turn_error",
    "CODEX_KIND_MISALIGNMENT",
    "CODEX_ERR_STREAM_DISCONNECTED",
    "CODEX_ERR_BUDGET_REACHED",
]


class TurnErrorKind(str, Enum):  # noqa: UP042 — 改 StrEnum 会变 str() 输出,属行为重写
    """回合错误语义封闭集（遵循统一工程规范）。"""

    RUNNING = "running"  # 回合仍在跑，未终态（占位/查询态）
    INTERRUPTED = "interrupted"  # 用户主动中断
    ERRORED = "errored"  # 一般错误（含 budget / stream 断开）
    SHUTDOWN = "shutdown"  # 会话/线程关闭导致
    NOT_FOUND = "not_found"  # thread/turn 资源不存在
    MISALIGNMENT = "misalignment"  # 策略对齐拒绝（Codex 独有类别）


CODEX_KIND_MISALIGNMENT = "misalignment"
# abort 档逐字锚（errored 的两个已知子因，取证自 turn aborted 段）
CODEX_ERR_STREAM_DISCONNECTED = "stream disconnected before completion"
CODEX_ERR_BUDGET_REACHED = "budget reached"


@dataclass(frozen=True)
class TurnError:
    """结构化回合错误：kind + 可选 codex_error_info + 明细（对齐 struct 4 元素）。"""

    kind: TurnErrorKind
    codex_error_info: str | None = None
    additional_details: str = ""


def classify_turn_error(
    *,
    interrupted: bool,
    shutdown: bool,
    not_found: bool,
    misaligned: bool,
    still_running: bool = False,
) -> TurnError:
    """按 Codex TurnError.kind 判据归kind。

    判据链（优先级从上到下，与对照 abort 档互斥优先序一致）：

    1. 用户主动中断 ⇒ INTERRUPTED（最优先：人意志凌驾一切自动恢复）。
    2. 资源不存在 ⇒ NOT_FOUND。
    3. 会话关闭 ⇒ SHUTDOWN。
    4. 策略对齐拒绝 ⇒ MISALIGNMENT（显式 misaligned 驱动，非靠「有无明细」猜）。
    5. 仍在跑 ⇒ RUNNING。
    6. 其余 ⇒ ERRORED（一般错误，budget/stream 断开归此档）。
    """
    if interrupted:
        return TurnError(kind=TurnErrorKind.INTERRUPTED)
    if not_found:
        return TurnError(kind=TurnErrorKind.NOT_FOUND)
    if shutdown:
        return TurnError(kind=TurnErrorKind.SHUTDOWN)
    if misaligned:
        return TurnError(
            kind=TurnErrorKind.MISALIGNMENT,
            codex_error_info="policy alignment rejection",
        )
    if still_running:
        return TurnError(kind=TurnErrorKind.RUNNING)
    return TurnError(kind=TurnErrorKind.ERRORED)
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
