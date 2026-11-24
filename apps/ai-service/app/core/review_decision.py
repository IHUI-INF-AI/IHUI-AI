# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""审查决策封闭集（ReviewDecision，wire 十档）—— 统一工程规范 R56。

取证（codex.exe 26.1111.2228.0，365MB Rust PE，strings 逐字）：
::

    ReviewDecisionapprovedapproved_execpolicy_amendmentproposed_execpolicy_amendment
    approved_for_sessionapproved_mcp_policy_amendmentnetwork_policy_amendment
    deniedrejectiontimed_outabort

十档逐字确证（from `ReviewDecision` internally tagged enum）：
``approved`` / ``approved_execpolicy_amendment`` / ``proposed_execpolicy_amendment`` /
``approved_for_session`` / ``approved_mcp_policy_amendment`` / ``network_policy_amendment`` /
``denied`` / ``rejection`` / ``timed_out`` / ``abort``。

配套锚（同取证块）：``GuardianAssessmentStatus approved denied timed_out``（三档状态，
另一轴）；``AutoReviewDecisionSource Guardian User``（自动审查来源）。

本仓边界：``guardian_risk.py`` 的 ``GuardianApprovalReviewStatus`` 只有四档
``approved/denied/timed_out/aborted``（状态轴），**不含** 六类 execpolicy/mcp/network
amendment 决策档；``guardian_decisions_comparison.py`` 是双后端影子对照轴。三者互补，
本模块只固化 **ReviewDecision 十档 wire 值域**，不替换任何既有模块。

一轴超越：对照靠 internally tagged enum 在 wire 反序列化时才区分十档，无「哪些是
终结决策 / 哪些是带 amendment Proposal 的变体 / 是否可重试」的显式判据。本模块提供
``is_terminal`` / ``is_amendment`` / ``is_retryable`` 三个纯函数 + ``ensure_review_decision``
封闭集守门（未知档抛错点名），可 diff 可单测。

诚实边界：十档 wire 名逐字确证；各档的**运行时触发条件**（谁产出 approved_for_session）
与 serde 的 tag 字段名未从二进制确证；``is_retryable`` 是本仓语义归类非对照原生判据。
"""

from __future__ import annotations

from enum import StrEnum
from typing import Final

__all__ = [
    "ReviewDecision",
    "ReviewDecisionError",
    "REVIEW_DECISION_VALUES",
    "TERMINAL_DECISIONS",
    "AMENDMENT_DECISIONS",
    "RETRYABLE_DECISIONS",
    "ensure_review_decision",
    "is_terminal",
    "is_amendment",
    "is_retryable",
]

#: 供守门静态解析的逐字 wire 值表（与成员一一对应，漂移由 pytest 钉死）。
REVIEW_DECISION_VALUES: Final[tuple[str, ...]] = (
    "approved",
    "approved_execpolicy_amendment",
    "proposed_execpolicy_amendment",
    "approved_for_session",
    "approved_mcp_policy_amendment",
    "network_policy_amendment",
    "denied",
    "rejection",
    "timed_out",
    "abort",
)

#: 终结决策（不再等待后续裁决）。
TERMINAL_DECISIONS: Final[frozenset[str]] = frozenset(
    {
        "approved",
        "approved_execpolicy_amendment",
        "approved_for_session",
        "approved_mcp_policy_amendment",
        "denied",
        "rejection",
        "abort",
    }
)

#: 带策略修正提案（amendment）的决策档。
AMENDMENT_DECISIONS: Final[frozenset[str]] = frozenset(
    {
        "approved_execpolicy_amendment",
        "proposed_execpolicy_amendment",
        "approved_mcp_policy_amendment",
        "network_policy_amendment",
    }
)

#: 本仓语义归类：超时与"提案待决"可重试（非对照原生判据）。
RETRYABLE_DECISIONS: Final[frozenset[str]] = frozenset(
    {"timed_out", "proposed_execpolicy_amendment"}
)

_CLOSED_SET: Final[frozenset[str]] = frozenset(REVIEW_DECISION_VALUES)


class ReviewDecision(StrEnum):
    """对照 ReviewDecision 十档 wire 值域（逐字确证，真相源登记，不替换既有轴）。"""

    APPROVED = "approved"
    APPROVED_EXECPOLICY_AMENDMENT = "approved_execpolicy_amendment"
    PROPOSED_EXECPOLICY_AMENDMENT = "proposed_execpolicy_amendment"
    APPROVED_FOR_SESSION = "approved_for_session"
    APPROVED_MCP_POLICY_AMENDMENT = "approved_mcp_policy_amendment"
    NETWORK_POLICY_AMENDMENT = "network_policy_amendment"
    DENIED = "denied"
    REJECTION = "rejection"
    TIMED_OUT = "timed_out"
    ABORT = "abort"


class ReviewDecisionError(ValueError):
    """未登记的 ReviewDecision wire 值（封闭集判据点名）。"""


def ensure_review_decision(value: str) -> str:
    """值域闭合：登记过原样放行，未登记抛 :class:`ReviewDecisionError`。"""
    if not isinstance(value, str) or value not in _CLOSED_SET:
        raise ReviewDecisionError(
            f"未登记的 ReviewDecision wire 值: {value!r} —— "
            "先在 app/core/review_decision.py 的 ReviewDecision 登记后再产出"
        )
    return value


def is_terminal(value: str) -> bool:
    """是否终结决策（登记外抛错，不静默判 False）。"""
    return ensure_review_decision(value) in TERMINAL_DECISIONS


def is_amendment(value: str) -> bool:
    """是否带策略修正提案的决策档。"""
    return ensure_review_decision(value) in AMENDMENT_DECISIONS


def is_retryable(value: str) -> bool:
    """本仓语义归类：是否可重试（timed_out / 提案待决）。"""
    return ensure_review_decision(value) in RETRYABLE_DECISIONS
