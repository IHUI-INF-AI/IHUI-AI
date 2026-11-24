# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""引导请求载荷清单封闭集（ElicitationRequest，5 struct variant） —— 统一工程规范 R60（协议面封闭集·中等清单族扫尾）。

取证（codex.exe 26.1111.2228.0，365MB Rust PE，strings 逐字 + ``struct variant X::Y with N element``
机器反推，见 R58 ``families.out`` / 本轮 ``docs/engineering/round11-reverse/R60-*.md``）：逐字 variant 名与
元素数表由机器从二进制抽取，模块内表与单测双重钉死。本仓归属过滤：该族在本仓 app/core 零命中或仅异层别名。

一轴超越：5 个引导请求载荷逐字表（元素数 3/4）+ 两类呈现域（form/external）+ 可执行反查。本仓 elicit_result_action.py 是引导结果动作（已答/拒绝），本轴是引导请求**如何呈现**的载荷，两端正交。

诚实边界：5 variant 名与元素数逐字确证；呈现域二分类是本仓语义归类非对照原生判据；``OpenAiElicitationForm``/``OpenAiForm``/``Form`` 三者语义差异未从 disasm 确证，按逐字名分档。
"""

from __future__ import annotations

from enum import StrEnum
from typing import Final

__all__ = [
    "ElicitationRequest", "ElicitationRequestError", "ELICITATION_REQUEST_ELEMENTS", "ELICITATION_REQUEST_DOMAIN", "elicitation_request_names", "expected_elicitation_element_count",
    "ensure_elicitation_request", "elicitation_request_domain", "elicitation_request_domain_members", "is_elicitation_request", "validate_elicitation_request",
]

# 逐字 variant 名 → struct 元素数（来自 ``with N element`` 声明，漂移由 pytest 钉死）。
ELICITATION_REQUEST_ELEMENTS: Final[dict[str, int]] = {
    "Form": 3,
    "OpenAiElicitationForm": 3,
    "OpenAiForm": 3,
    "Url": 4,
    "UserVerification": 4,

}

# 本仓语义归类（非对照原生判据）：每个 variant 归入一个协议面域。
ELICITATION_REQUEST_DOMAIN: Final[dict[str, str]] = {
    "Form": "form",
    "OpenAiElicitationForm": "form",
    "OpenAiForm": "form",
    "Url": "external",
    "UserVerification": "external",

}

_CLOSED_SET: Final[frozenset[str]] = frozenset(ELICITATION_REQUEST_ELEMENTS)


class ElicitationRequest(StrEnum):
    """对照协议面 variant（逐字登记，真相源）。"""

    FORM = "Form"
    OPEN_AI_ELICITATION_FORM = "OpenAiElicitationForm"
    OPEN_AI_FORM = "OpenAiForm"
    URL = "Url"
    USER_VERIFICATION = "UserVerification"



class ElicitationRequestError(ValueError):
    """未登记的协议面 variant（封闭集/元素数/归类判据点名）。"""


def elicitation_request_names() -> list[str]:
    """返回逐字 variant 名列表副本（顺序稳定，调用方改不动真相源）。"""
    return list(ELICITATION_REQUEST_ELEMENTS)


def expected_elicitation_element_count(name: str) -> int:
    """该 variant 的逐字元素数（未登记抛错）。"""
    if not isinstance(name, str) or name not in _CLOSED_SET:
        raise ElicitationRequestError(f"未登记的 variant: {name!r} —— 先在 app/core/elicitation_request.py 的 ELICITATION_REQUEST_ELEMENTS 登记")
    return ELICITATION_REQUEST_ELEMENTS[name]


def ensure_elicitation_request(value: str) -> str:
    """值域闭合：登记过原样放行，未登记抛 :class:`ElicitationRequestError`。"""
    if not isinstance(value, str) or value not in _CLOSED_SET:
        raise ElicitationRequestError(f"未登记的 variant: {value!r} —— 先在 app/core/elicitation_request.py 的 ElicitationRequest 登记后再产出")
    return value


def elicitation_request_domain(value: str) -> str:
    """归类到协议面域（登记外抛错）。"""
    ensure_elicitation_request(value)
    return ELICITATION_REQUEST_DOMAIN[value]


def elicitation_request_domain_members(domain: str) -> tuple[str, ...]:
    """反查某域下的全部逐字 variant 名（元组副本，调用方改不动真相源）。"""
    if domain not in set(ELICITATION_REQUEST_DOMAIN.values()):
        raise ElicitationRequestError(f"未登记的域: {domain!r} —— 合法域: {sorted(set(ELICITATION_REQUEST_DOMAIN.values()))!r}")
    return tuple(nm for nm, dom in ELICITATION_REQUEST_DOMAIN.items() if dom == domain)


def is_elicitation_request(value: str) -> bool:
    """封闭集成员判定（不改值、不抛错）。"""
    return isinstance(value, str) and value in _CLOSED_SET


def validate_elicitation_request(name: str, element_count: int) -> str:
    """一致性守门：variant 名与元素数须同时匹配逐字表，否则抛错点名。"""
    ensure_elicitation_request(name)
    expected = expected_elicitation_element_count(name)
    if element_count != expected:
        raise ElicitationRequestError(f"{name!r} 的 struct 元素数应为 {expected}，实得 {element_count!r}")
    return name
