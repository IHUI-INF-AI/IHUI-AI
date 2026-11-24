# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""网关鉴权来源封闭集（GatewayAuth，2 struct variant） —— 统一工程规范 R61（协议面封闭集·N≤3 族扫尾）。

取证（codex.exe 26.1111.2228.0，365MB Rust PE，strings 逐字 + ``struct variant X::Y with N element``
机器反推，见 R58 ``families.out`` / 本轮 ``docs/engineering/round11-reverse/R61-*.md``）：逐字 variant 名与
元素数表由机器从二进制抽取，模块内表与单测双重钉死。本仓归属过滤：该族在本仓 app/core 零命中或仅异层别名。

一轴超越：2 个网关鉴权来源逐字表（元素数一律 1）+ 两类凭证域（environment/external）+ 可执行反查。元素数同为 1，靠语义域归类提供区分力；与 provider_settings.py（R61 同批）正交：本轴是网关**凭证来源**。

诚实边界：2 variant 名与元素数逐字确证；凭证域二分类是本仓语义归类非对照原生判据；环境变量名/外部配置协议未确证。
"""

from __future__ import annotations

from enum import StrEnum
from typing import Final

__all__ = [
    "GatewayAuth", "GatewayAuthError", "GATEWAY_AUTH_ELEMENTS", "GATEWAY_AUTH_DOMAIN", "gateway_auth_names", "expected_gateway_auth_element_count",
    "ensure_gateway_auth", "gateway_auth_domain", "gateway_auth_domain_members", "is_gateway_auth", "validate_gateway_auth",
]

# 逐字 variant 名 → struct 元素数（来自 ``with N element`` 声明，漂移由 pytest 钉死）。
GATEWAY_AUTH_ELEMENTS: Final[dict[str, int]] = {
    "EnvironmentVariable": 1,
    "ExternallyConfigured": 1,

}

# 本仓语义归类（非对照原生判据）：每个 variant 归入一个协议面域。
GATEWAY_AUTH_DOMAIN: Final[dict[str, str]] = {
    "EnvironmentVariable": "environment",
    "ExternallyConfigured": "external",

}

_CLOSED_SET: Final[frozenset[str]] = frozenset(GATEWAY_AUTH_ELEMENTS)


class GatewayAuth(StrEnum):
    """对照协议面 variant（逐字登记，真相源）。"""

    ENVIRONMENT_VARIABLE = "EnvironmentVariable"
    EXTERNALLY_CONFIGURED = "ExternallyConfigured"



class GatewayAuthError(ValueError):
    """未登记的协议面 variant（封闭集/元素数/归类判据点名）。"""


def gateway_auth_names() -> list[str]:
    """返回逐字 variant 名列表副本（顺序稳定，调用方改不动真相源）。"""
    return list(GATEWAY_AUTH_ELEMENTS)


def expected_gateway_auth_element_count(name: str) -> int:
    """该 variant 的逐字元素数（未登记抛错）。"""
    if not isinstance(name, str) or name not in _CLOSED_SET:
        raise GatewayAuthError(f"未登记的 variant: {name!r} —— 先在 app/core/gateway_auth.py 的 GATEWAY_AUTH_ELEMENTS 登记")
    return GATEWAY_AUTH_ELEMENTS[name]


def ensure_gateway_auth(value: str) -> str:
    """值域闭合：登记过原样放行，未登记抛 :class:`GatewayAuthError`。"""
    if not isinstance(value, str) or value not in _CLOSED_SET:
        raise GatewayAuthError(f"未登记的 variant: {value!r} —— 先在 app/core/gateway_auth.py 的 GatewayAuth 登记后再产出")
    return value


def gateway_auth_domain(value: str) -> str:
    """归类到协议面域（登记外抛错）。"""
    ensure_gateway_auth(value)
    return GATEWAY_AUTH_DOMAIN[value]


def gateway_auth_domain_members(domain: str) -> tuple[str, ...]:
    """反查某域下的全部逐字 variant 名（元组副本，调用方改不动真相源）。"""
    if domain not in set(GATEWAY_AUTH_DOMAIN.values()):
        raise GatewayAuthError(f"未登记的域: {domain!r} —— 合法域: {sorted(set(GATEWAY_AUTH_DOMAIN.values()))!r}")
    return tuple(nm for nm, dom in GATEWAY_AUTH_DOMAIN.items() if dom == domain)


def is_gateway_auth(value: str) -> bool:
    """封闭集成员判定（不改值、不抛错）。"""
    return isinstance(value, str) and value in _CLOSED_SET


def validate_gateway_auth(name: str, element_count: int) -> str:
    """一致性守门：variant 名与元素数须同时匹配逐字表，否则抛错点名。"""
    ensure_gateway_auth(name)
    expected = expected_gateway_auth_element_count(name)
    if element_count != expected:
        raise GatewayAuthError(f"{name!r} 的 struct 元素数应为 {expected}，实得 {element_count!r}")
    return name
