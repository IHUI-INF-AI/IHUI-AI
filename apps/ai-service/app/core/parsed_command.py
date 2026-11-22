# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""解析命令封闭集（ParsedCommand，4 struct variant） —— 统一工程规范 R61（协议面封闭集·N≤3 族扫尾）。

取证（codex.exe 26.1111.2228.0，365MB Rust PE，strings 逐字 + ``struct variant X::Y with N element``
机器反推，见 R58 ``families.out`` / 本轮 ``docs/engineering/round11-reverse/R61-*.md``）：逐字 variant 名与
元素数表由机器从二进制抽取，模块内表与单测双重钉死。本仓归属过滤：该族在本仓 app/core 零命中或仅异层别名。

一轴超越：4 个解析命令逐字表（元素数 2/3/3/1）+ 三类命令域（filesystem/discovery/fallback）+ 可执行反查。同构族 ``CommandAction``（本仓零命中、variant 表逐字同构）按纪律只落一族，避免重复。``Read``/``Search`` 三元素 vs ``Unknown`` 单元素，差异化元素数使守门有区分力。

诚实边界：4 variant 名与元素数逐字确证；命令域三分类是本仓语义归类非对照原生判据；``CommandAction`` 与 ``ParsedCommand`` 逐字同构已证伪重复落地价值。
"""

from __future__ import annotations

from enum import StrEnum
from typing import Final

__all__ = [
    "ParsedCommand", "ParsedCommandError", "PARSED_COMMAND_ELEMENTS", "PARSED_COMMAND_DOMAIN", "parsed_command_names", "expected_parsed_command_element_count",
    "ensure_parsed_command", "parsed_command_domain", "parsed_command_domain_members", "is_parsed_command", "validate_parsed_command",
]

# 逐字 variant 名 → struct 元素数（来自 ``with N element`` 声明，漂移由 pytest 钉死）。
PARSED_COMMAND_ELEMENTS: Final[dict[str, int]] = {
    "ListFiles": 2,
    "Read": 3,
    "Search": 3,
    "Unknown": 1,

}

# 本仓语义归类（非对照原生判据）：每个 variant 归入一个协议面域。
PARSED_COMMAND_DOMAIN: Final[dict[str, str]] = {
    "ListFiles": "filesystem",
    "Read": "filesystem",
    "Search": "discovery",
    "Unknown": "fallback",

}

_CLOSED_SET: Final[frozenset[str]] = frozenset(PARSED_COMMAND_ELEMENTS)


class ParsedCommand(StrEnum):
    """对照协议面 variant（逐字登记，真相源）。"""

    LIST_FILES = "ListFiles"
    READ = "Read"
    SEARCH = "Search"
    UNKNOWN = "Unknown"



class ParsedCommandError(ValueError):
    """未登记的协议面 variant（封闭集/元素数/归类判据点名）。"""


def parsed_command_names() -> list[str]:
    """返回逐字 variant 名列表副本（顺序稳定，调用方改不动真相源）。"""
    return list(PARSED_COMMAND_ELEMENTS)


def expected_parsed_command_element_count(name: str) -> int:
    """该 variant 的逐字元素数（未登记抛错）。"""
    if not isinstance(name, str) or name not in _CLOSED_SET:
        raise ParsedCommandError(f"未登记的 variant: {name!r} —— 先在 app/core/parsed_command.py 的 PARSED_COMMAND_ELEMENTS 登记")
    return PARSED_COMMAND_ELEMENTS[name]


def ensure_parsed_command(value: str) -> str:
    """值域闭合：登记过原样放行，未登记抛 :class:`ParsedCommandError`。"""
    if not isinstance(value, str) or value not in _CLOSED_SET:
        raise ParsedCommandError(f"未登记的 variant: {value!r} —— 先在 app/core/parsed_command.py 的 ParsedCommand 登记后再产出")
    return value


def parsed_command_domain(value: str) -> str:
    """归类到协议面域（登记外抛错）。"""
    ensure_parsed_command(value)
    return PARSED_COMMAND_DOMAIN[value]


def parsed_command_domain_members(domain: str) -> tuple[str, ...]:
    """反查某域下的全部逐字 variant 名（元组副本，调用方改不动真相源）。"""
    if domain not in set(PARSED_COMMAND_DOMAIN.values()):
        raise ParsedCommandError(f"未登记的域: {domain!r} —— 合法域: {sorted(set(PARSED_COMMAND_DOMAIN.values()))!r}")
    return tuple(nm for nm, dom in PARSED_COMMAND_DOMAIN.items() if dom == domain)


def is_parsed_command(value: str) -> bool:
    """封闭集成员判定（不改值、不抛错）。"""
    return isinstance(value, str) and value in _CLOSED_SET


def validate_parsed_command(name: str, element_count: int) -> str:
    """一致性守门：variant 名与元素数须同时匹配逐字表，否则抛错点名。"""
    ensure_parsed_command(name)
    expected = expected_parsed_command_element_count(name)
    if element_count != expected:
        raise ParsedCommandError(f"{name!r} 的 struct 元素数应为 {expected}，实得 {element_count!r}")
    return name
