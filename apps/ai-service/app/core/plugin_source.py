# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""插件来源封闭集（PluginSource，3 struct variant） —— 统一工程规范 R61（协议面封闭集·N≤3 族扫尾）。

取证（codex.exe 26.1111.2228.0，365MB Rust PE，strings 逐字 + ``struct variant X::Y with N element``
机器反推，见 R58 ``families.out`` / 本轮 ``docs/engineering/round11-reverse/R61-*.md``）：逐字 variant 名与
元素数表由机器从二进制抽取，模块内表与单测双重钉死。本仓归属过滤：该族在本仓 app/core 零命中或仅异层别名。

一轴超越：3 个插件来源逐字表（元素数 4/1/3）+ 两类分发域（remote/local）+ 可执行反查。``Git`` 元素数 4 与 ``Npm`` 3 让 validate 守门有区分力；本仓 agent_plugin_mcp_server.py 是 MCP 传输层，本轴是插件**安装来源**，正交。

诚实边界：3 variant 名与元素数逐字确证；分发域二分类是本仓语义归类非对照原生判据；各来源的配置字段未确证。
"""

from __future__ import annotations

from enum import StrEnum
from typing import Final

__all__ = [
    "PluginSource", "PluginSourceError", "PLUGIN_SOURCE_ELEMENTS", "PLUGIN_SOURCE_DOMAIN", "plugin_source_names", "expected_plugin_source_element_count",
    "ensure_plugin_source", "plugin_source_domain", "plugin_source_domain_members", "is_plugin_source", "validate_plugin_source",
]

# 逐字 variant 名 → struct 元素数（来自 ``with N element`` 声明，漂移由 pytest 钉死）。
PLUGIN_SOURCE_ELEMENTS: Final[dict[str, int]] = {
    "Git": 4,
    "Local": 1,
    "Npm": 3,

}

# 本仓语义归类（非对照原生判据）：每个 variant 归入一个协议面域。
PLUGIN_SOURCE_DOMAIN: Final[dict[str, str]] = {
    "Git": "remote",
    "Local": "local",
    "Npm": "remote",

}

_CLOSED_SET: Final[frozenset[str]] = frozenset(PLUGIN_SOURCE_ELEMENTS)


class PluginSource(StrEnum):
    """对照协议面 variant（逐字登记，真相源）。"""

    GIT = "Git"
    LOCAL = "Local"
    NPM = "Npm"



class PluginSourceError(ValueError):
    """未登记的协议面 variant（封闭集/元素数/归类判据点名）。"""


def plugin_source_names() -> list[str]:
    """返回逐字 variant 名列表副本（顺序稳定，调用方改不动真相源）。"""
    return list(PLUGIN_SOURCE_ELEMENTS)


def expected_plugin_source_element_count(name: str) -> int:
    """该 variant 的逐字元素数（未登记抛错）。"""
    if not isinstance(name, str) or name not in _CLOSED_SET:
        raise PluginSourceError(f"未登记的 variant: {name!r} —— 先在 app/core/plugin_source.py 的 PLUGIN_SOURCE_ELEMENTS 登记")
    return PLUGIN_SOURCE_ELEMENTS[name]


def ensure_plugin_source(value: str) -> str:
    """值域闭合：登记过原样放行，未登记抛 :class:`PluginSourceError`。"""
    if not isinstance(value, str) or value not in _CLOSED_SET:
        raise PluginSourceError(f"未登记的 variant: {value!r} —— 先在 app/core/plugin_source.py 的 PluginSource 登记后再产出")
    return value


def plugin_source_domain(value: str) -> str:
    """归类到协议面域（登记外抛错）。"""
    ensure_plugin_source(value)
    return PLUGIN_SOURCE_DOMAIN[value]


def plugin_source_domain_members(domain: str) -> tuple[str, ...]:
    """反查某域下的全部逐字 variant 名（元组副本，调用方改不动真相源）。"""
    if domain not in set(PLUGIN_SOURCE_DOMAIN.values()):
        raise PluginSourceError(f"未登记的域: {domain!r} —— 合法域: {sorted(set(PLUGIN_SOURCE_DOMAIN.values()))!r}")
    return tuple(nm for nm, dom in PLUGIN_SOURCE_DOMAIN.items() if dom == domain)


def is_plugin_source(value: str) -> bool:
    """封闭集成员判定（不改值、不抛错）。"""
    return isinstance(value, str) and value in _CLOSED_SET


def validate_plugin_source(name: str, element_count: int) -> str:
    """一致性守门：variant 名与元素数须同时匹配逐字表，否则抛错点名。"""
    ensure_plugin_source(name)
    expected = expected_plugin_source_element_count(name)
    if element_count != expected:
        raise PluginSourceError(f"{name!r} 的 struct 元素数应为 {expected}，实得 {element_count!r}")
    return name
