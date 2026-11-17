# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""运行时线响应封闭集（WireRuntimeResponse，3 struct variant） —— 统一工程规范 R61（协议面封闭集·N≤3 族扫尾）。

取证（codex.exe 26.1111.2228.0，365MB Rust PE，strings 逐字 + ``struct variant X::Y with N element``
机器反推，见 R58 ``families.out`` / 本轮 ``docs/engineering/round11-reverse/R61-*.md``）：逐字 variant 名与
元素数表由机器从二进制抽取，模块内表与单测双重钉死。本仓归属过滤：该族在本仓 app/core 零命中或仅异层别名。

一轴超越：3 个运行时响应逐字表（元素数 5/3/3）+ 两类终态域（complete/yield）+ 可执行反查。``Result`` 五元素是族内最多，差异化元素数让守门有强区分力。

诚实边界：3 variant 名与元素数逐字确证；终态域二分类是本仓语义归类非对照原生判据；各响应载荷字段未确证。
"""

from __future__ import annotations

from enum import StrEnum
from typing import Final

__all__ = [
    "WireRuntimeResponse", "WireRuntimeResponseError", "WIRE_RUNTIME_RESPONSE_ELEMENTS", "WIRE_RUNTIME_RESPONSE_DOMAIN", "wire_runtime_response_names", "expected_wire_runtime_response_element_count",
    "ensure_wire_runtime_response", "wire_runtime_response_domain", "wire_runtime_response_domain_members", "is_wire_runtime_response", "validate_wire_runtime_response",
]

# 逐字 variant 名 → struct 元素数（来自 ``with N element`` 声明，漂移由 pytest 钉死）。
WIRE_RUNTIME_RESPONSE_ELEMENTS: Final[dict[str, int]] = {
    "Result": 5,
    "Terminated": 3,
    "Yielded": 3,

}

# 本仓语义归类（非对照原生判据）：每个 variant 归入一个协议面域。
WIRE_RUNTIME_RESPONSE_DOMAIN: Final[dict[str, str]] = {
    "Result": "complete",
    "Terminated": "complete",
    "Yielded": "yield",

}

_CLOSED_SET: Final[frozenset[str]] = frozenset(WIRE_RUNTIME_RESPONSE_ELEMENTS)


class WireRuntimeResponse(StrEnum):
    """对照协议面 variant（逐字登记，真相源）。"""

    RESULT = "Result"
    TERMINATED = "Terminated"
    YIELDED = "Yielded"



class WireRuntimeResponseError(ValueError):
    """未登记的协议面 variant（封闭集/元素数/归类判据点名）。"""


def wire_runtime_response_names() -> list[str]:
    """返回逐字 variant 名列表副本（顺序稳定，调用方改不动真相源）。"""
    return list(WIRE_RUNTIME_RESPONSE_ELEMENTS)


def expected_wire_runtime_response_element_count(name: str) -> int:
    """该 variant 的逐字元素数（未登记抛错）。"""
    if not isinstance(name, str) or name not in _CLOSED_SET:
        raise WireRuntimeResponseError(f"未登记的 variant: {name!r} —— 先在 app/core/wire_runtime_response.py 的 WIRE_RUNTIME_RESPONSE_ELEMENTS 登记")
    return WIRE_RUNTIME_RESPONSE_ELEMENTS[name]


def ensure_wire_runtime_response(value: str) -> str:
    """值域闭合：登记过原样放行，未登记抛 :class:`WireRuntimeResponseError`。"""
    if not isinstance(value, str) or value not in _CLOSED_SET:
        raise WireRuntimeResponseError(f"未登记的 variant: {value!r} —— 先在 app/core/wire_runtime_response.py 的 WireRuntimeResponse 登记后再产出")
    return value


def wire_runtime_response_domain(value: str) -> str:
    """归类到协议面域（登记外抛错）。"""
    ensure_wire_runtime_response(value)
    return WIRE_RUNTIME_RESPONSE_DOMAIN[value]


def wire_runtime_response_domain_members(domain: str) -> tuple[str, ...]:
    """反查某域下的全部逐字 variant 名（元组副本，调用方改不动真相源）。"""
    if domain not in set(WIRE_RUNTIME_RESPONSE_DOMAIN.values()):
        raise WireRuntimeResponseError(f"未登记的域: {domain!r} —— 合法域: {sorted(set(WIRE_RUNTIME_RESPONSE_DOMAIN.values()))!r}")
    return tuple(nm for nm, dom in WIRE_RUNTIME_RESPONSE_DOMAIN.items() if dom == domain)


def is_wire_runtime_response(value: str) -> bool:
    """封闭集成员判定（不改值、不抛错）。"""
    return isinstance(value, str) and value in _CLOSED_SET


def validate_wire_runtime_response(name: str, element_count: int) -> str:
    """一致性守门：variant 名与元素数须同时匹配逐字表，否则抛错点名。"""
    ensure_wire_runtime_response(name)
    expected = expected_wire_runtime_response_element_count(name)
    if element_count != expected:
        raise WireRuntimeResponseError(f"{name!r} 的 struct 元素数应为 {expected}，实得 {element_count!r}")
    return name
