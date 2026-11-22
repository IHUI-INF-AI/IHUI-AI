# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""文件变更类型封闭集（FileChange，3 struct variant） —— 统一工程规范 R61（协议面封闭集·N≤3 族扫尾）。

取证（codex.exe 26.1111.2228.0，365MB Rust PE，strings 逐字 + ``struct variant X::Y with N element``
机器反推，见 R58 ``families.out`` / 本轮 ``docs/engineering/round11-reverse/R61-*.md``）：逐字 variant 名与
元素数表由机器从二进制抽取，模块内表与单测双重钉死。本仓归属过滤：该族在本仓 app/core 零命中或仅异层别名。

一轴超越：3 个文件变更逐字表（元素数 1/2/1）+ 三类变更域（create/update/delete）+ 可执行反查。``Update`` 双元素 vs ``Add``/``Delete`` 单元素，差异化元素数使守门有区分力。

诚实边界：3 variant 名与元素数逐字确证；变更域三分类是本仓语义归类非对照原生判据；变更载荷字段未确证。
"""

from __future__ import annotations

from enum import StrEnum
from typing import Final

__all__ = [
    "FileChange", "FileChangeError", "FILE_CHANGE_ELEMENTS", "FILE_CHANGE_DOMAIN", "file_change_names", "expected_file_change_element_count",
    "ensure_file_change", "file_change_domain", "file_change_domain_members", "is_file_change", "validate_file_change",
]

# 逐字 variant 名 → struct 元素数（来自 ``with N element`` 声明，漂移由 pytest 钉死）。
FILE_CHANGE_ELEMENTS: Final[dict[str, int]] = {
    "Add": 1,
    "Delete": 1,
    "Update": 2,

}

# 本仓语义归类（非对照原生判据）：每个 variant 归入一个协议面域。
FILE_CHANGE_DOMAIN: Final[dict[str, str]] = {
    "Add": "create",
    "Delete": "delete",
    "Update": "update",

}

_CLOSED_SET: Final[frozenset[str]] = frozenset(FILE_CHANGE_ELEMENTS)


class FileChange(StrEnum):
    """对照协议面 variant（逐字登记，真相源）。"""

    ADD = "Add"
    DELETE = "Delete"
    UPDATE = "Update"



class FileChangeError(ValueError):
    """未登记的协议面 variant（封闭集/元素数/归类判据点名）。"""


def file_change_names() -> list[str]:
    """返回逐字 variant 名列表副本（顺序稳定，调用方改不动真相源）。"""
    return list(FILE_CHANGE_ELEMENTS)


def expected_file_change_element_count(name: str) -> int:
    """该 variant 的逐字元素数（未登记抛错）。"""
    if not isinstance(name, str) or name not in _CLOSED_SET:
        raise FileChangeError(f"未登记的 variant: {name!r} —— 先在 app/core/file_change.py 的 FILE_CHANGE_ELEMENTS 登记")
    return FILE_CHANGE_ELEMENTS[name]


def ensure_file_change(value: str) -> str:
    """值域闭合：登记过原样放行，未登记抛 :class:`FileChangeError`。"""
    if not isinstance(value, str) or value not in _CLOSED_SET:
        raise FileChangeError(f"未登记的 variant: {value!r} —— 先在 app/core/file_change.py 的 FileChange 登记后再产出")
    return value


def file_change_domain(value: str) -> str:
    """归类到协议面域（登记外抛错）。"""
    ensure_file_change(value)
    return FILE_CHANGE_DOMAIN[value]


def file_change_domain_members(domain: str) -> tuple[str, ...]:
    """反查某域下的全部逐字 variant 名（元组副本，调用方改不动真相源）。"""
    if domain not in set(FILE_CHANGE_DOMAIN.values()):
        raise FileChangeError(f"未登记的域: {domain!r} —— 合法域: {sorted(set(FILE_CHANGE_DOMAIN.values()))!r}")
    return tuple(nm for nm, dom in FILE_CHANGE_DOMAIN.items() if dom == domain)


def is_file_change(value: str) -> bool:
    """封闭集成员判定（不改值、不抛错）。"""
    return isinstance(value, str) and value in _CLOSED_SET


def validate_file_change(name: str, element_count: int) -> str:
    """一致性守门：variant 名与元素数须同时匹配逐字表，否则抛错点名。"""
    ensure_file_change(name)
    expected = expected_file_change_element_count(name)
    if element_count != expected:
        raise FileChangeError(f"{name!r} 的 struct 元素数应为 {expected}，实得 {element_count!r}")
    return name
