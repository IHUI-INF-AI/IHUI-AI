# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""执行权限档位封闭集（ExecPermissionProfile，2 struct variant） —— 统一工程规范 R61（协议面封闭集·N≤3 族扫尾）。

取证（codex.exe 26.1111.2228.0，365MB Rust PE，strings 逐字 + ``struct variant X::Y with N element``
机器反推，见 R58 ``families.out`` / 本轮 ``docs/engineering/round11-reverse/R61-*.md``）：逐字 variant 名与
元素数表由机器从二进制抽取，模块内表与单测双重钉死。本仓归属过滤：该族在本仓 app/core 零命中或仅异层别名。

一轴超越：2 个执行权限档逐字表（元素数 1/2）+ 两类策略域（external/managed）+ 可执行反查。同构族 ``TaggedPermissionProfile``（variant 表逐字同构）按纪律只落一族。``Managed`` 双元素 vs ``External`` 单元素，差异化元素数让守门有区分力。

诚实边界：2 variant 名与元素数逐字确证；策略域二分类是本仓语义归类非对照原生判据；``TaggedPermissionProfile`` 同构已证伪重复落地价值。
"""

from __future__ import annotations

from enum import StrEnum
from typing import Final

__all__ = [
    "ExecPermissionProfile", "ExecPermissionProfileError", "EXEC_PERMISSION_PROFILE_ELEMENTS", "EXEC_PERMISSION_PROFILE_DOMAIN", "exec_permission_profile_names", "expected_exec_permission_profile_element_count",
    "ensure_exec_permission_profile", "exec_permission_profile_domain", "exec_permission_profile_domain_members", "is_exec_permission_profile", "validate_exec_permission_profile",
]

# 逐字 variant 名 → struct 元素数（来自 ``with N element`` 声明，漂移由 pytest 钉死）。
EXEC_PERMISSION_PROFILE_ELEMENTS: Final[dict[str, int]] = {
    "External": 1,
    "Managed": 2,

}

# 本仓语义归类（非对照原生判据）：每个 variant 归入一个协议面域。
EXEC_PERMISSION_PROFILE_DOMAIN: Final[dict[str, str]] = {
    "External": "external",
    "Managed": "managed",

}

_CLOSED_SET: Final[frozenset[str]] = frozenset(EXEC_PERMISSION_PROFILE_ELEMENTS)


class ExecPermissionProfile(StrEnum):
    """对照协议面 variant（逐字登记，真相源）。"""

    EXTERNAL = "External"
    MANAGED = "Managed"



class ExecPermissionProfileError(ValueError):
    """未登记的协议面 variant（封闭集/元素数/归类判据点名）。"""


def exec_permission_profile_names() -> list[str]:
    """返回逐字 variant 名列表副本（顺序稳定，调用方改不动真相源）。"""
    return list(EXEC_PERMISSION_PROFILE_ELEMENTS)


def expected_exec_permission_profile_element_count(name: str) -> int:
    """该 variant 的逐字元素数（未登记抛错）。"""
    if not isinstance(name, str) or name not in _CLOSED_SET:
        raise ExecPermissionProfileError(f"未登记的 variant: {name!r} —— 先在 app/core/exec_permission_profile.py 的 EXEC_PERMISSION_PROFILE_ELEMENTS 登记")
    return EXEC_PERMISSION_PROFILE_ELEMENTS[name]


def ensure_exec_permission_profile(value: str) -> str:
    """值域闭合：登记过原样放行，未登记抛 :class:`ExecPermissionProfileError`。"""
    if not isinstance(value, str) or value not in _CLOSED_SET:
        raise ExecPermissionProfileError(f"未登记的 variant: {value!r} —— 先在 app/core/exec_permission_profile.py 的 ExecPermissionProfile 登记后再产出")
    return value


def exec_permission_profile_domain(value: str) -> str:
    """归类到协议面域（登记外抛错）。"""
    ensure_exec_permission_profile(value)
    return EXEC_PERMISSION_PROFILE_DOMAIN[value]


def exec_permission_profile_domain_members(domain: str) -> tuple[str, ...]:
    """反查某域下的全部逐字 variant 名（元组副本，调用方改不动真相源）。"""
    if domain not in set(EXEC_PERMISSION_PROFILE_DOMAIN.values()):
        raise ExecPermissionProfileError(f"未登记的域: {domain!r} —— 合法域: {sorted(set(EXEC_PERMISSION_PROFILE_DOMAIN.values()))!r}")
    return tuple(nm for nm, dom in EXEC_PERMISSION_PROFILE_DOMAIN.items() if dom == domain)


def is_exec_permission_profile(value: str) -> bool:
    """封闭集成员判定（不改值、不抛错）。"""
    return isinstance(value, str) and value in _CLOSED_SET


def validate_exec_permission_profile(name: str, element_count: int) -> str:
    """一致性守门：variant 名与元素数须同时匹配逐字表，否则抛错点名。"""
    ensure_exec_permission_profile(name)
    expected = expected_exec_permission_profile_element_count(name)
    if element_count != expected:
        raise ExecPermissionProfileError(f"{name!r} 的 struct 元素数应为 {expected}，实得 {element_count!r}")
    return name
