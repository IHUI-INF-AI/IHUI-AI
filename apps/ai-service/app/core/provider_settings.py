# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""模型提供商设置封闭集（ProviderSettings，3 struct variant） —— 统一工程规范 R60（协议面封闭集·中等清单族扫尾）。

取证（codex.exe 26.1111.2228.0，365MB Rust PE，strings 逐字 + ``struct variant X::Y with N element``
机器反推，见 R58 ``families.out`` / 本轮 ``docs/engineering/round11-reverse/R60-*.md``）：逐字 variant 名与
元素数表由机器从二进制抽取，模块内表与单测双重钉死。本仓归属过滤：该族在本仓 app/core 零命中或仅异层别名。

一轴超越：3 个提供商设置逐字表（元素数 1/2/3）+ 两类来源域（cloud/custom）+ 可执行反查。本仓 model_provider_error.py（R58）是提供商错误，本轴是提供商**配置形态**，正交。

诚实边界：3 variant 名与元素数逐字确证；来源域二分类是本仓语义归类非对照原生判据；``CustomGateway`` 的网关配置字段未确证。
"""

from __future__ import annotations

from enum import StrEnum
from typing import Final

__all__ = [
    "ProviderSettings", "ProviderSettingsError", "PROVIDER_SETTINGS_ELEMENTS", "PROVIDER_SETTINGS_DOMAIN", "provider_settings_names", "expected_provider_element_count",
    "ensure_provider_settings", "provider_settings_domain", "provider_settings_domain_members", "is_provider_settings", "validate_provider_settings",
]

# 逐字 variant 名 → struct 元素数（来自 ``with N element`` 声明，漂移由 pytest 钉死）。
PROVIDER_SETTINGS_ELEMENTS: Final[dict[str, int]] = {
    "Bedrock": 2,
    "CustomGateway": 1,
    "Gcp": 3,

}

# 本仓语义归类（非对照原生判据）：每个 variant 归入一个协议面域。
PROVIDER_SETTINGS_DOMAIN: Final[dict[str, str]] = {
    "Bedrock": "cloud",
    "CustomGateway": "custom",
    "Gcp": "cloud",

}

_CLOSED_SET: Final[frozenset[str]] = frozenset(PROVIDER_SETTINGS_ELEMENTS)


class ProviderSettings(StrEnum):
    """对照协议面 variant（逐字登记，真相源）。"""

    BEDROCK = "Bedrock"
    CUSTOM_GATEWAY = "CustomGateway"
    GCP = "Gcp"



class ProviderSettingsError(ValueError):
    """未登记的协议面 variant（封闭集/元素数/归类判据点名）。"""


def provider_settings_names() -> list[str]:
    """返回逐字 variant 名列表副本（顺序稳定，调用方改不动真相源）。"""
    return list(PROVIDER_SETTINGS_ELEMENTS)


def expected_provider_element_count(name: str) -> int:
    """该 variant 的逐字元素数（未登记抛错）。"""
    if not isinstance(name, str) or name not in _CLOSED_SET:
        raise ProviderSettingsError(f"未登记的 variant: {name!r} —— 先在 app/core/provider_settings.py 的 PROVIDER_SETTINGS_ELEMENTS 登记")
    return PROVIDER_SETTINGS_ELEMENTS[name]


def ensure_provider_settings(value: str) -> str:
    """值域闭合：登记过原样放行，未登记抛 :class:`ProviderSettingsError`。"""
    if not isinstance(value, str) or value not in _CLOSED_SET:
        raise ProviderSettingsError(f"未登记的 variant: {value!r} —— 先在 app/core/provider_settings.py 的 ProviderSettings 登记后再产出")
    return value


def provider_settings_domain(value: str) -> str:
    """归类到协议面域（登记外抛错）。"""
    ensure_provider_settings(value)
    return PROVIDER_SETTINGS_DOMAIN[value]


def provider_settings_domain_members(domain: str) -> tuple[str, ...]:
    """反查某域下的全部逐字 variant 名（元组副本，调用方改不动真相源）。"""
    if domain not in set(PROVIDER_SETTINGS_DOMAIN.values()):
        raise ProviderSettingsError(f"未登记的域: {domain!r} —— 合法域: {sorted(set(PROVIDER_SETTINGS_DOMAIN.values()))!r}")
    return tuple(nm for nm, dom in PROVIDER_SETTINGS_DOMAIN.items() if dom == domain)


def is_provider_settings(value: str) -> bool:
    """封闭集成员判定（不改值、不抛错）。"""
    return isinstance(value, str) and value in _CLOSED_SET


def validate_provider_settings(name: str, element_count: int) -> str:
    """一致性守门：variant 名与元素数须同时匹配逐字表，否则抛错点名。"""
    ensure_provider_settings(name)
    expected = expected_provider_element_count(name)
    if element_count != expected:
        raise ProviderSettingsError(f"{name!r} 的 struct 元素数应为 {expected}，实得 {element_count!r}")
    return name
