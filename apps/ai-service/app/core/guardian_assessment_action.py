# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""Guardian 审查动作封闭集（GuardianAssessmentAction，七类）—— 统一工程规范 R56。

取证（codex.exe 26.1111.2228.0，strings 逐字，struct variant + 元素数）：
::

    struct variant GuardianAssessmentAction::Execve with 4 elements
    struct variant GuardianAssessmentAction::Command with 3 elements
    struct variant GuardianAssessmentAction::WriteStdin with 4 elements
    struct variant GuardianAssessmentAction::ApplyPatch with 2 elements
    struct variant GuardianAssessmentAction::McpToolCall with 5 elements
    struct variant GuardianAssessmentAction::NetworkAccess with 4 elements
    struct variant GuardianAssessmentAction::RequestPermissions with 2 elements
    internally tagged enum GuardianAssessmentAction

七类 action 变体逐字确证，各自元素数逐字给出。配套载荷锚（同取证块）：
``permissions tool_name connector_name tool_title files program argv port``；
配套状态轴 ``GuardianAssessmentStatus approved denied timed_out``（另一轴，本仓
guardian_risk 已四档覆盖，不复现）。

本仓边界：``guardian_risk.py`` 在 docstring 提及 ``GuardianAssessmentAction::
RequestPermissions``，但无七类封闭集、无按 action 分派审查的判据；
``guardian_decisions_comparison.py`` 是双后端对照轴、``mcp_tool_approval.py`` 是
工具审批轴。本模块补齐 action 种类 + 元素数可机检，不替换任何既有模块。

一轴超越：对照靠七处 struct variant 在 wire 反序列化区分，元素数隐含在各 variant
声明里、无集中登记。本模块把七类 + 逐字元素数固化为 ``ASSET_ACTION_ELEMENTS``
可机检表 + ``ensure_guardian_action`` 守门 + ``is_privileged``（按 action 敏感度归类，
本仓语义非对照原生）+ ``expected_element_count``，可 diff 可单测。

诚实边界：七类变体名 + 元素数逐字确证；各元素的**字段名**只在长连体串里部分可辨
（program/argv/files/port/tool_name 等），未逐 variant 精确绑定；``is_privileged``
是本仓风险归类非对照判据；wire tag 字符串（serde rename）未确证，用变体名登记。
"""

from __future__ import annotations

from enum import StrEnum
from typing import Final

__all__ = [
    "GuardianAssessmentAction",
    "GuardianAssessmentActionError",
    "GUARDIAN_ACTION_ELEMENTS",
    "PRIVILEGED_ACTIONS",
    "ensure_guardian_action",
    "expected_element_count",
    "is_privileged",
    "guardian_action_names",
]

#: 七类 action → 逐字确证的元素数（struct variant ... with N elements）。
GUARDIAN_ACTION_ELEMENTS: Final[dict[str, int]] = {
    "Execve": 4,
    "Command": 3,
    "WriteStdin": 4,
    "ApplyPatch": 2,
    "McpToolCall": 5,
    "NetworkAccess": 4,
    "RequestPermissions": 2,
}

#: 本仓风险归类：涉执行/网络/权限的动作视为需重点审查（非对照原生判据）。
PRIVILEGED_ACTIONS: Final[frozenset[str]] = frozenset(
    {"Execve", "Command", "NetworkAccess", "RequestPermissions", "McpToolCall"}
)

_CLOSED_SET: Final[frozenset[str]] = frozenset(GUARDIAN_ACTION_ELEMENTS)


class GuardianAssessmentAction(StrEnum):
    """对照 GuardianAssessmentAction 七类（逐字变体名），真相源登记。"""

    EXECVE = "Execve"
    COMMAND = "Command"
    WRITE_STDIN = "WriteStdin"
    APPLY_PATCH = "ApplyPatch"
    MCP_TOOL_CALL = "McpToolCall"
    NETWORK_ACCESS = "NetworkAccess"
    REQUEST_PERMISSIONS = "RequestPermissions"


class GuardianAssessmentActionError(ValueError):
    """未登记的 Guardian 审查动作（封闭集判据点名）。"""


def ensure_guardian_action(value: str) -> str:
    """值域闭合：登记过原样放行，未登记抛 :class:`GuardianAssessmentActionError`。"""
    if not isinstance(value, str) or value not in _CLOSED_SET:
        raise GuardianAssessmentActionError(
            f"未登记的 Guardian 审查动作: {value!r} —— "
            "先在 app/core/guardian_assessment_action.py 的 "
            "GuardianAssessmentAction 登记后再产出"
        )
    return value


def expected_element_count(value: str) -> int:
    """返回该 action 逐字确证的载荷元素数（登记外抛错）。"""
    return GUARDIAN_ACTION_ELEMENTS[ensure_guardian_action(value)]


def is_privileged(value: str) -> bool:
    """本仓风险归类：是否需重点审查的高敏感动作。"""
    return ensure_guardian_action(value) in PRIVILEGED_ACTIONS


def guardian_action_names() -> tuple[str, ...]:
    """返回七类 action 名（副本，供守门/UI 枚举）。"""
    return tuple(GUARDIAN_ACTION_ELEMENTS)
