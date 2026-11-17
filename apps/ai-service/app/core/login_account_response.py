# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""登录账号响应封闭集（LoginAccountResponse，2 struct variant） —— 统一工程规范 R61（协议面封闭集·N≤3 族扫尾）。

取证（codex.exe 26.1111.2228.0，365MB Rust PE，strings 逐字 + ``struct variant X::Y with N element``
机器反推，见 R58 ``families.out`` / 本轮 ``docs/engineering/round11-reverse/R61-*.md``）：逐字 variant 名与
元素数表由机器从二进制抽取，模块内表与单测双重钉死。本仓归属过滤：该族在本仓 app/core 零命中或仅异层别名。

一轴超越：2 个登录账号响应逐字表（元素数 2/3）+ 两类登录域（interactive/device）+ 可执行反查。``ChatgptDeviceCode`` 三元素 vs ``Chatgpt`` 双元素，差异化元素数使守门有区分力。

诚实边界：2 variant 名与元素数逐字确证；登录域二分类是本仓语义归类非对照原生判据；设备码流程字段未确证。
"""

from __future__ import annotations

from enum import StrEnum
from typing import Final

__all__ = [
    "LoginAccountResponse", "LoginAccountResponseError", "LOGIN_ACCOUNT_RESPONSE_ELEMENTS", "LOGIN_ACCOUNT_RESPONSE_DOMAIN", "login_account_response_names", "expected_login_account_response_element_count",
    "ensure_login_account_response", "login_account_response_domain", "login_account_response_domain_members", "is_login_account_response", "validate_login_account_response",
]

# 逐字 variant 名 → struct 元素数（来自 ``with N element`` 声明，漂移由 pytest 钉死）。
LOGIN_ACCOUNT_RESPONSE_ELEMENTS: Final[dict[str, int]] = {
    "Chatgpt": 2,
    "ChatgptDeviceCode": 3,

}

# 本仓语义归类（非对照原生判据）：每个 variant 归入一个协议面域。
LOGIN_ACCOUNT_RESPONSE_DOMAIN: Final[dict[str, str]] = {
    "Chatgpt": "interactive",
    "ChatgptDeviceCode": "device",

}

_CLOSED_SET: Final[frozenset[str]] = frozenset(LOGIN_ACCOUNT_RESPONSE_ELEMENTS)


class LoginAccountResponse(StrEnum):
    """对照协议面 variant（逐字登记，真相源）。"""

    CHATGPT = "Chatgpt"
    CHATGPT_DEVICE_CODE = "ChatgptDeviceCode"



class LoginAccountResponseError(ValueError):
    """未登记的协议面 variant（封闭集/元素数/归类判据点名）。"""


def login_account_response_names() -> list[str]:
    """返回逐字 variant 名列表副本（顺序稳定，调用方改不动真相源）。"""
    return list(LOGIN_ACCOUNT_RESPONSE_ELEMENTS)


def expected_login_account_response_element_count(name: str) -> int:
    """该 variant 的逐字元素数（未登记抛错）。"""
    if not isinstance(name, str) or name not in _CLOSED_SET:
        raise LoginAccountResponseError(f"未登记的 variant: {name!r} —— 先在 app/core/login_account_response.py 的 LOGIN_ACCOUNT_RESPONSE_ELEMENTS 登记")
    return LOGIN_ACCOUNT_RESPONSE_ELEMENTS[name]


def ensure_login_account_response(value: str) -> str:
    """值域闭合：登记过原样放行，未登记抛 :class:`LoginAccountResponseError`。"""
    if not isinstance(value, str) or value not in _CLOSED_SET:
        raise LoginAccountResponseError(f"未登记的 variant: {value!r} —— 先在 app/core/login_account_response.py 的 LoginAccountResponse 登记后再产出")
    return value


def login_account_response_domain(value: str) -> str:
    """归类到协议面域（登记外抛错）。"""
    ensure_login_account_response(value)
    return LOGIN_ACCOUNT_RESPONSE_DOMAIN[value]


def login_account_response_domain_members(domain: str) -> tuple[str, ...]:
    """反查某域下的全部逐字 variant 名（元组副本，调用方改不动真相源）。"""
    if domain not in set(LOGIN_ACCOUNT_RESPONSE_DOMAIN.values()):
        raise LoginAccountResponseError(f"未登记的域: {domain!r} —— 合法域: {sorted(set(LOGIN_ACCOUNT_RESPONSE_DOMAIN.values()))!r}")
    return tuple(nm for nm, dom in LOGIN_ACCOUNT_RESPONSE_DOMAIN.items() if dom == domain)


def is_login_account_response(value: str) -> bool:
    """封闭集成员判定（不改值、不抛错）。"""
    return isinstance(value, str) and value in _CLOSED_SET


def validate_login_account_response(name: str, element_count: int) -> str:
    """一致性守门：variant 名与元素数须同时匹配逐字表，否则抛错点名。"""
    ensure_login_account_response(name)
    expected = expected_login_account_response_element_count(name)
    if element_count != expected:
        raise LoginAccountResponseError(f"{name!r} 的 struct 元素数应为 {expected}，实得 {element_count!r}")
    return name
