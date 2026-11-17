# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""命令执行审批决策封闭集（CommandExecutionApprovalDecision，2 struct variant）—— 统一工程规范 R57。

取证（codex.exe 26.1111.2228.0，365MB Rust PE，strings 逐字）：
::

    struct variant CommandExecutionApprovalDecision::AcceptWithExecpolicyAmendment with 1 element
    struct variant CommandExecutionApprovalDecision::ApplyNetworkPolicyAmendment with 1 element
    CommandExecutionApprovalDecision internally tagged enum

两档逐字确证（`struct variant ... with N element` 声明 + 585 字节长连体串
``execpolicy_amendmentnetwork_policy_amendmentstruct variant CommandExecutionApprovalDecision...``
交叉印证）。配套 wire 名锚 ``execpolicy_amendment`` / ``network_policy_amendment``。

本仓边界：全仓 app 层 grep 零命中。本仓 ``exec_policy_decision.py`` 的 ``Decision`` 是
``allow/prompt/forbidden`` 命令裁决轴，``exec_policy_amendments.py`` / ``network_rule_amendments.py``
管修正条款**内容**——都不固化「审批决策携带哪类 amendment」的二档封闭集。互补不替换。

一轴超越：对照把两档散在 serde 反序列化处，无「这是 execpolicy 还是 network policy 修正」
的显式归类与元素数判据。本模块提供 ``decision_amendment_kind`` 归类、
``expected_element_count`` 逐字表 + ``validate_approval_decision`` 一致性守门，可 diff 可单测。

诚实边界：两档 variant 名与元素数逐字确证；serde tag rename 未确证（按 Rust variant 名逐字登记）；
是否存在别的 unit variant（如裸 Accept/Deny）未从 ``struct variant`` 声明确证——本模块仅覆盖
**带 amendment 的两档 struct variant**，不含可能存在的 unit 决策档（诚实不全集声明）。
"""

from __future__ import annotations

from enum import StrEnum
from typing import Final

__all__ = [
    "CommandExecutionApprovalDecision",
    "CommandExecutionApprovalDecisionError",
    "APPROVAL_DECISION_ELEMENTS",
    "DECISION_AMENDMENT_KIND",
    "approval_decision_names",
    "expected_element_count",
    "ensure_approval_decision",
    "decision_amendment_kind",
    "is_network_amendment",
    "validate_approval_decision",
]

#: 逐字 variant 名 → struct 元素数。
APPROVAL_DECISION_ELEMENTS: Final[dict[str, int]] = {
    "AcceptWithExecpolicyAmendment": 1,
    "ApplyNetworkPolicyAmendment": 1,
}

#: 归类：携带的 amendment 类型（wire 锚 execpolicy_amendment / network_policy_amendment）。
DECISION_AMENDMENT_KIND: Final[dict[str, str]] = {
    "AcceptWithExecpolicyAmendment": "execpolicy_amendment",
    "ApplyNetworkPolicyAmendment": "network_policy_amendment",
}

_CLOSED_SET: Final[frozenset[str]] = frozenset(APPROVAL_DECISION_ELEMENTS)


class CommandExecutionApprovalDecision(StrEnum):
    """对照 CommandExecutionApprovalDecision 两档 struct variant（逐字登记）。"""

    ACCEPT_WITH_EXECPOLICY_AMENDMENT = "AcceptWithExecpolicyAmendment"
    APPLY_NETWORK_POLICY_AMENDMENT = "ApplyNetworkPolicyAmendment"


class CommandExecutionApprovalDecisionError(ValueError):
    """未登记的审批决策 variant（封闭集/元素数判据点名）。"""


def approval_decision_names() -> list[str]:
    """返回逐字 variant 名列表副本。"""
    return list(APPROVAL_DECISION_ELEMENTS)


def expected_element_count(name: str) -> int:
    """该决策 struct variant 的逐字元素数（未登记抛错）。"""
    if name not in _CLOSED_SET:
        raise CommandExecutionApprovalDecisionError(
            f"未登记的审批决策 variant: {name!r} —— "
            "先在 app/core/command_execution_approval_decision.py 的 "
            "APPROVAL_DECISION_ELEMENTS 登记"
        )
    return APPROVAL_DECISION_ELEMENTS[name]


def ensure_approval_decision(value: str) -> str:
    """值域闭合：登记过原样放行，未登记抛错。"""
    if not isinstance(value, str) or value not in _CLOSED_SET:
        raise CommandExecutionApprovalDecisionError(
            f"未登记的审批决策: {value!r} —— "
            "先在 app/core/command_execution_approval_decision.py 的 "
            "CommandExecutionApprovalDecision 登记后再产出"
        )
    return value


def decision_amendment_kind(value: str) -> str:
    """归类：execpolicy_amendment / network_policy_amendment（登记外抛错）。"""
    ensure_approval_decision(value)
    return DECISION_AMENDMENT_KIND[value]


def is_network_amendment(value: str) -> bool:
    """是否携带 network policy 修正。"""
    return decision_amendment_kind(value) == "network_policy_amendment"


def validate_approval_decision(name: str, element_count: int) -> str:
    """一致性守门：variant 名与元素数须同时匹配逐字表。"""
    ensure_approval_decision(name)
    expected = expected_element_count(name)
    if element_count != expected:
        raise CommandExecutionApprovalDecisionError(
            f"{name!r} 的 struct 元素数应为 {expected}，实得 {element_count!r}"
        )
    return name
