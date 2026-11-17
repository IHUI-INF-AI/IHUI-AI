# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""评审目标定位封闭集（ReviewTarget，3 struct variant）—— 统一工程规范 R58。

取证（codex.exe 26.1111.2228.0，365MB Rust PE，strings 逐字 + 元素数机器反推）：
::

    struct variant ReviewTarget::BaseBranch with 1 element
    struct variant ReviewTarget::Commit with 2 element
    struct variant ReviewTarget::Custom with 1 element

三档逐字确证（元素数 1/2/1；长连体串 1252 字节含 ``ReviewTarget::Commit/Custom/BaseBranch``
三声明双证）。本仓边界：全仓 app 层 ``BaseBranch`` 零命中；``ReviewTarget`` 本身零命中。
本仓 ``review_decision.py``（R56，评审结论）/ ``review_findings.py`` 是评审结果与发现，
不是「评审哪一段」的目标定位，本模块不替换。

一轴超越：对照把三档散在 review 启动路径，靠 enum 匹配隐式区分「对比基线分支 / 指定
commit / 自定义范围」，无显式归类，也无元素数一致性判据。本模块提供 ``review_target_kind``
三分类 + ``expected_element_count`` 逐字元素数表 + ``validate_review_target`` 一致性守门。

诚实边界：三档 variant 名与元素数逐字确证；serde tag/rename 未确证（按 Rust variant 名
逐字登记）；``Custom`` 携带的自定义范围字段语义未确证；``review_target_kind`` 三分类是
本仓语义归类非对照原生判据；未接评审发射点。
"""

from __future__ import annotations

from enum import StrEnum
from typing import Final

__all__ = [
    "ReviewTarget",
    "ReviewTargetError",
    "REVIEW_TARGET_ELEMENTS",
    "REVIEW_TARGET_KIND",
    "review_target_names",
    "expected_element_count",
    "ensure_review_target",
    "review_target_kind",
    "validate_review_target",
]

#: 逐字 variant 名 → struct 元素数（来自 ``with N element`` 声明，漂移由 pytest 钉死）。
REVIEW_TARGET_ELEMENTS: Final[dict[str, int]] = {
    "BaseBranch": 1,
    "Commit": 2,
    "Custom": 1,
}

#: 本仓语义归类：基线分支 / 指定提交 / 自定义范围。
REVIEW_TARGET_KIND: Final[dict[str, str]] = {
    "BaseBranch": "base_branch",
    "Commit": "commit",
    "Custom": "custom",
}

_CLOSED_SET: Final[frozenset[str]] = frozenset(REVIEW_TARGET_ELEMENTS)


class ReviewTarget(StrEnum):
    """对照 ReviewTarget 三档 variant（逐字登记，真相源）。"""

    BASE_BRANCH = "BaseBranch"
    COMMIT = "Commit"
    CUSTOM = "Custom"


class ReviewTargetError(ValueError):
    """未登记的评审目标 variant（封闭集/元素数判据点名）。"""


def review_target_names() -> list[str]:
    """返回逐字 variant 名列表副本（顺序稳定，调用方改不动真相源）。"""
    return list(REVIEW_TARGET_ELEMENTS)


def expected_element_count(name: str) -> int:
    """该评审目标 struct variant 的逐字元素数（未登记抛错）。"""
    if name not in _CLOSED_SET:
        raise ReviewTargetError(
            f"未登记的评审目标 variant: {name!r} —— "
            "先在 app/core/review_target.py 的 REVIEW_TARGET_ELEMENTS 登记"
        )
    return REVIEW_TARGET_ELEMENTS[name]


def ensure_review_target(value: str) -> str:
    """值域闭合：登记过原样放行，未登记抛 :class:`ReviewTargetError`。"""
    if not isinstance(value, str) or value not in _CLOSED_SET:
        raise ReviewTargetError(
            f"未登记的评审目标: {value!r} —— "
            "先在 app/core/review_target.py 的 ReviewTarget 登记后再产出"
        )
    return value


def review_target_kind(value: str) -> str:
    """归类：base_branch / commit / custom（登记外抛错）。"""
    ensure_review_target(value)
    return REVIEW_TARGET_KIND[value]


def validate_review_target(name: str, element_count: int) -> str:
    """一致性守门：variant 名与元素数须同时匹配逐字表，否则抛错点名。"""
    ensure_review_target(name)
    expected = expected_element_count(name)
    if element_count != expected:
        raise ReviewTargetError(
            f"{name!r} 的 struct 元素数应为 {expected}，实得 {element_count!r}"
        )
    return name
