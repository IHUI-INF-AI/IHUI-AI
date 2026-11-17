# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""用户验证错误详情封闭集（UserVerificationErrorDetails，4 struct variant） —— 统一工程规范 R60（协议面封闭集·中等清单族扫尾）。

取证（codex.exe 26.1111.2228.0，365MB Rust PE，strings 逐字 + ``struct variant X::Y with N element``
机器反推，见 R58 ``families.out`` / 本轮 ``docs/engineering/round11-reverse/R60-*.md``）：逐字 variant 名与
元素数表由机器从二进制抽取，模块内表与单测双重钉死。本仓归属过滤：该族在本仓 app/core 零命中或仅异层别名。

一轴超越：4 个验证错误详情逐字表（元素数一律 1）+ 两类归责域（user_action/system）+ 可执行反查。与 R56 codex_error_info.py（服务端错误 info payload）不同层：本轴是用户验证流程错误。

诚实边界：4 variant 名与元素数逐字确证；归责域二分类是本仓语义归类非对照原生判据；各错误的文案/重试语义未确证。
"""

from __future__ import annotations

from enum import StrEnum
from typing import Final

__all__ = [
    "UserVerificationErrorDetails", "UserVerificationErrorDetailsError", "USER_VERIFICATION_ERROR_ELEMENTS", "USER_VERIFICATION_ERROR_DOMAIN", "user_verification_error_names", "expected_verification_error_element_count",
    "ensure_user_verification_error", "user_verification_error_domain", "user_verification_error_domain_members", "is_user_verification_error", "validate_user_verification_error",
]

# 逐字 variant 名 → struct 元素数（来自 ``with N element`` 声明，漂移由 pytest 钉死）。
USER_VERIFICATION_ERROR_ELEMENTS: Final[dict[str, int]] = {
    "Cancelled": 1,
    "Failed": 1,
    "InvalidRequest": 1,
    "Unavailable": 1,

}

# 本仓语义归类（非对照原生判据）：每个 variant 归入一个协议面域。
USER_VERIFICATION_ERROR_DOMAIN: Final[dict[str, str]] = {
    "Cancelled": "user_action",
    "Failed": "system",
    "InvalidRequest": "user_action",
    "Unavailable": "system",

}

_CLOSED_SET: Final[frozenset[str]] = frozenset(USER_VERIFICATION_ERROR_ELEMENTS)


class UserVerificationErrorDetails(StrEnum):
    """对照协议面 variant（逐字登记，真相源）。"""

    CANCELLED = "Cancelled"
    FAILED = "Failed"
    INVALID_REQUEST = "InvalidRequest"
    UNAVAILABLE = "Unavailable"



class UserVerificationErrorDetailsError(ValueError):
    """未登记的协议面 variant（封闭集/元素数/归类判据点名）。"""


def user_verification_error_names() -> list[str]:
    """返回逐字 variant 名列表副本（顺序稳定，调用方改不动真相源）。"""
    return list(USER_VERIFICATION_ERROR_ELEMENTS)


def expected_verification_error_element_count(name: str) -> int:
    """该 variant 的逐字元素数（未登记抛错）。"""
    if not isinstance(name, str) or name not in _CLOSED_SET:
        raise UserVerificationErrorDetailsError(f"未登记的 variant: {name!r} —— 先在 app/core/user_verification_error.py 的 USER_VERIFICATION_ERROR_ELEMENTS 登记")
    return USER_VERIFICATION_ERROR_ELEMENTS[name]


def ensure_user_verification_error(value: str) -> str:
    """值域闭合：登记过原样放行，未登记抛 :class:`UserVerificationErrorDetailsError`。"""
    if not isinstance(value, str) or value not in _CLOSED_SET:
        raise UserVerificationErrorDetailsError(f"未登记的 variant: {value!r} —— 先在 app/core/user_verification_error.py 的 UserVerificationErrorDetails 登记后再产出")
    return value


def user_verification_error_domain(value: str) -> str:
    """归类到协议面域（登记外抛错）。"""
    ensure_user_verification_error(value)
    return USER_VERIFICATION_ERROR_DOMAIN[value]


def user_verification_error_domain_members(domain: str) -> tuple[str, ...]:
    """反查某域下的全部逐字 variant 名（元组副本，调用方改不动真相源）。"""
    if domain not in set(USER_VERIFICATION_ERROR_DOMAIN.values()):
        raise UserVerificationErrorDetailsError(f"未登记的域: {domain!r} —— 合法域: {sorted(set(USER_VERIFICATION_ERROR_DOMAIN.values()))!r}")
    return tuple(nm for nm, dom in USER_VERIFICATION_ERROR_DOMAIN.items() if dom == domain)


def is_user_verification_error(value: str) -> bool:
    """封闭集成员判定（不改值、不抛错）。"""
    return isinstance(value, str) and value in _CLOSED_SET


def validate_user_verification_error(name: str, element_count: int) -> str:
    """一致性守门：variant 名与元素数须同时匹配逐字表，否则抛错点名。"""
    ensure_user_verification_error(name)
    expected = expected_verification_error_element_count(name)
    if element_count != expected:
        raise UserVerificationErrorDetailsError(f"{name!r} 的 struct 元素数应为 {expected}，实得 {element_count!r}")
    return name
