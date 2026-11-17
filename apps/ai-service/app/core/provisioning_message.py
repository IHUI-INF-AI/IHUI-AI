# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""供给消息封闭集（ProvisioningMessage，3 struct variant） —— 统一工程规范 R61（协议面封闭集·N≤3 族扫尾）。

取证（codex.exe 26.1111.2228.0，365MB Rust PE，strings 逐字 + ``struct variant X::Y with N element``
机器反推，见 R58 ``families.out`` / 本轮 ``docs/engineering/round11-reverse/R61-*.md``）：逐字 variant 名与
元素数表由机器从二进制抽取，模块内表与单测双重钉死。本仓归属过滤：该族在本仓 app/core 零命中或仅异层别名。

一轴超越：3 个供给消息逐字表（元素数一律 1）+ 两类供给域（sandbox/installation）+ 可执行反查。元素数同为 1，靠语义域归类提供区分力；与 sandbox_provisioning 单档族不同层：本轴是消息名清单。

诚实边界：3 variant 名与元素数逐字确证；供给域二分类是本仓语义归类非对照原生判据；各消息载荷字段未确证。
"""

from __future__ import annotations

from enum import StrEnum
from typing import Final

__all__ = [
    "ProvisioningMessage", "ProvisioningMessageError", "PROVISIONING_MESSAGE_ELEMENTS", "PROVISIONING_MESSAGE_DOMAIN", "provisioning_message_names", "expected_provisioning_message_element_count",
    "ensure_provisioning_message", "provisioning_message_domain", "provisioning_message_domain_members", "is_provisioning_message", "validate_provisioning_message",
]

# 逐字 variant 名 → struct 元素数（来自 ``with N element`` 声明，漂移由 pytest 钉死）。
PROVISIONING_MESSAGE_ELEMENTS: Final[dict[str, int]] = {
    "ProvisionSandboxRequest": 1,
    "ProvisionSandboxResponse": 1,
    "RegisterInstallationRequest": 1,

}

# 本仓语义归类（非对照原生判据）：每个 variant 归入一个协议面域。
PROVISIONING_MESSAGE_DOMAIN: Final[dict[str, str]] = {
    "ProvisionSandboxRequest": "sandbox",
    "ProvisionSandboxResponse": "sandbox",
    "RegisterInstallationRequest": "installation",

}

_CLOSED_SET: Final[frozenset[str]] = frozenset(PROVISIONING_MESSAGE_ELEMENTS)


class ProvisioningMessage(StrEnum):
    """对照协议面 variant（逐字登记，真相源）。"""

    PROVISION_SANDBOX_REQUEST = "ProvisionSandboxRequest"
    PROVISION_SANDBOX_RESPONSE = "ProvisionSandboxResponse"
    REGISTER_INSTALLATION_REQUEST = "RegisterInstallationRequest"



class ProvisioningMessageError(ValueError):
    """未登记的协议面 variant（封闭集/元素数/归类判据点名）。"""


def provisioning_message_names() -> list[str]:
    """返回逐字 variant 名列表副本（顺序稳定，调用方改不动真相源）。"""
    return list(PROVISIONING_MESSAGE_ELEMENTS)


def expected_provisioning_message_element_count(name: str) -> int:
    """该 variant 的逐字元素数（未登记抛错）。"""
    if not isinstance(name, str) or name not in _CLOSED_SET:
        raise ProvisioningMessageError(f"未登记的 variant: {name!r} —— 先在 app/core/provisioning_message.py 的 PROVISIONING_MESSAGE_ELEMENTS 登记")
    return PROVISIONING_MESSAGE_ELEMENTS[name]


def ensure_provisioning_message(value: str) -> str:
    """值域闭合：登记过原样放行，未登记抛 :class:`ProvisioningMessageError`。"""
    if not isinstance(value, str) or value not in _CLOSED_SET:
        raise ProvisioningMessageError(f"未登记的 variant: {value!r} —— 先在 app/core/provisioning_message.py 的 ProvisioningMessage 登记后再产出")
    return value


def provisioning_message_domain(value: str) -> str:
    """归类到协议面域（登记外抛错）。"""
    ensure_provisioning_message(value)
    return PROVISIONING_MESSAGE_DOMAIN[value]


def provisioning_message_domain_members(domain: str) -> tuple[str, ...]:
    """反查某域下的全部逐字 variant 名（元组副本，调用方改不动真相源）。"""
    if domain not in set(PROVISIONING_MESSAGE_DOMAIN.values()):
        raise ProvisioningMessageError(f"未登记的域: {domain!r} —— 合法域: {sorted(set(PROVISIONING_MESSAGE_DOMAIN.values()))!r}")
    return tuple(nm for nm, dom in PROVISIONING_MESSAGE_DOMAIN.items() if dom == domain)


def is_provisioning_message(value: str) -> bool:
    """封闭集成员判定（不改值、不抛错）。"""
    return isinstance(value, str) and value in _CLOSED_SET


def validate_provisioning_message(name: str, element_count: int) -> str:
    """一致性守门：variant 名与元素数须同时匹配逐字表，否则抛错点名。"""
    ensure_provisioning_message(name)
    expected = expected_provisioning_message_element_count(name)
    if element_count != expected:
        raise ProvisioningMessageError(f"{name!r} 的 struct 元素数应为 {expected}，实得 {element_count!r}")
    return name
