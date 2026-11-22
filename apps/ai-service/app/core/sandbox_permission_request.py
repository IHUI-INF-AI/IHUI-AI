# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""沙箱权限请求档位封闭集 —— 遵循统一工程规范。

设计依据（2026-11-18，下潜 外部程序 364.8MB 主引擎，strings 定向抽取）。
对照物 strings 逐字锚（连续 token 拼接形态）::

    sandbox_permissions additional_permissions justification prefix_rule workdir
    use_default require_escalated with_additional_permissions

三档值域逐字确证：``use_default`` / ``require_escalated`` /
``with_additional_permissions``。语义（对照 `permissions_instructions.md` 上游）：
- ``use_default``：用默认沙箱策略放行；
- ``require_escalated``：请求越权到沙箱外执行（需用户审批 + justification）；
- ``with_additional_permissions``：在既有授权上追加权限（不整体越权）。

取证纠偏（防后人踩）：strings 中 ``none`` 紧邻 ``terminal_statusnone`` 出现，
是否属 ``sandbox_permissions`` 值域**未确证**——故本封闭集**只收三档**（对照逐字
确证的），``none`` 作为本仓既有默认单列（见 ``NONE_DEFAULT``），不计入封闭集成员。
三档确切是否同一 Rust enum 变体、serde rename 为何未从二进制确证，已双重标注。

本仓真空白：``app/core/exec_params.py:223`` ``sandbox_permissions: str = "none"`` 是
**自由字符串**，无封闭集、无校验——消费面可凭空写任意档位而静默放行。本模块补齐
封闭集 + 校验判据（对齐 ``turn_stop_reason.ensure_turn_stop_reason`` 同纪律）。

一轴超越：对照把三档散在 exec 参数序列化与各审批分支（运行时遇到才区分），且
「该请求是否需用户审批」靠分支位置隐式决定、无统一判据。本仓提前为纯函数：
给定档位输出「是否需审批 + 是否整体越权」二维，可 diff 可单测可挂审计；未登记档位
抛 :class:`SandboxPermissionError` 点名（不静默放行）。
"""

from __future__ import annotations

from enum import StrEnum
from typing import Final

__all__ = [
    "SandboxPermissionRequest",
    "SandboxPermissionError",
    "ensure_sandbox_permission_request",
    "requires_user_approval",
    "is_full_escalation",
    "NONE_DEFAULT",
]

# 本仓既有默认（exec_params.sandbox_permissions 默认值），不计入封闭集成员
# （对照物 ``none`` 归属未确证，见模块 docstring 取证纠偏）。
NONE_DEFAULT = "none"


class SandboxPermissionRequest(StrEnum):
    """沙箱权限请求档位封闭集（wire 值 = 成员值；对照逐字确证三档）。"""

    #: 用默认沙箱策略放行（不额外请求权限）。
    USE_DEFAULT = "use_default"
    #: 请求越权到沙箱外执行（需用户审批 + justification）。
    REQUIRE_ESCALATED = "require_escalated"
    #: 在既有授权上追加权限（不整体越权）。
    WITH_ADDITIONAL_PERMISSIONS = "with_additional_permissions"


#: 供守门静态解析的字面量总表（与成员一一对应；漂移由 pytest 钉死）。
SANDBOX_PERMISSION_REQUEST_VALUES: Final[tuple[str, ...]] = (
    "use_default",
    "require_escalated",
    "with_additional_permissions",
)

_CLOSED_SET: Final[frozenset[str]] = frozenset(m.value for m in SandboxPermissionRequest)


class SandboxPermissionError(ValueError):
    """未登记的沙箱权限请求档位（封闭集判据点名）。"""


def ensure_sandbox_permission_request(value: str) -> str:
    """值域闭合判据：登记过的档位原样放行，未登记 ⇒ 抛 :class:`SandboxPermissionError`。

    ``none``（本仓既有默认）原样放行但不计入封闭集成员——它是「未发起权限请求」的
    既有语义，与三档「发起请求」的档位互补。未来任何一处直接写裸字面量而不先登记
    ⇒ 在收口处炸出来点名，而不是静默放行一个新档位。
    """
    if value == NONE_DEFAULT:
        return value
    if not isinstance(value, str) or value not in _CLOSED_SET:
        raise SandboxPermissionError(
            f"未登记的沙箱权限请求档位（sandbox_permissions 封闭集之外）: {value!r}"
            f" —— 先在 app/core/sandbox_permission_request.py 的 SandboxPermissionRequest 登记后再产出"
        )
    return value


def requires_user_approval(value: str) -> bool:
    """该档位是否需用户审批。

    - ``require_escalated`` ⇒ True（整体越权到沙箱外，必须审批）；
    - ``with_additional_permissions`` ⇒ True（追加权限需授权）；
    - ``use_default`` / ``none`` ⇒ False（默认策略内放行，不需审批）；
    - 未登记档位 ⇒ 抛错（不静默判 False，遵循 §0 铁律 3「没判绝不写成判过」）。
    """
    normalized = ensure_sandbox_permission_request(value)
    return normalized in (
        SandboxPermissionRequest.REQUIRE_ESCALATED.value,
        SandboxPermissionRequest.WITH_ADDITIONAL_PERMISSIONS.value,
    )


def is_full_escalation(value: str) -> bool:
    """该档位是否为「整体越权」（区别于追加权限）。

    仅 ``require_escalated`` 是整体越权；``with_additional_permissions`` 是既有授权上
    追加、非整体越权。未登记档位 ⇒ 抛错。
    """
    normalized = ensure_sandbox_permission_request(value)
    return normalized == SandboxPermissionRequest.REQUIRE_ESCALATED.value
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
