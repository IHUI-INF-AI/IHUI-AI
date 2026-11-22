# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""插件 MCP 服务器传输封闭集（AgentPluginMcpServer，3 struct variant） —— 统一工程规范 R60（协议面封闭集·中等清单族扫尾）。

取证（codex.exe 26.1111.2228.0，365MB Rust PE，strings 逐字 + ``struct variant X::Y with N element``
机器反推，见 R58 ``families.out`` / 本轮 ``docs/engineering/round11-reverse/R60-*.md``）：逐字 variant 名与
元素数表由机器从二进制抽取，模块内表与单测双重钉死。本仓归属过滤：该族在本仓 app/core 零命中或仅异层别名。

一轴超越：3 个 MCP 服务器传输逐字表（元素数 2/4/2）+ 两类传输域（http_transport/process_transport）+ 可执行反查。``Stdio`` 元素数 4 是族内最多，差异化元素数让守门有区分力。

诚实边界：3 variant 名与元素数逐字确证；传输域二分类是本仓语义归类非对照原生判据；``StreamableHttp``/``Sse`` 协议细节未确证。
"""

from __future__ import annotations

from enum import StrEnum
from typing import Final

__all__ = [
    "AgentPluginMcpServer", "AgentPluginMcpServerError", "AGENT_PLUGIN_MCP_SERVER_ELEMENTS", "AGENT_PLUGIN_MCP_SERVER_DOMAIN", "agent_plugin_mcp_server_names", "expected_mcp_server_element_count",
    "ensure_agent_plugin_mcp_server", "agent_plugin_mcp_server_domain", "agent_plugin_mcp_server_domain_members", "is_agent_plugin_mcp_server", "validate_agent_plugin_mcp_server",
]

# 逐字 variant 名 → struct 元素数（来自 ``with N element`` 声明，漂移由 pytest 钉死）。
AGENT_PLUGIN_MCP_SERVER_ELEMENTS: Final[dict[str, int]] = {
    "Sse": 2,
    "Stdio": 4,
    "StreamableHttp": 2,

}

# 本仓语义归类（非对照原生判据）：每个 variant 归入一个协议面域。
AGENT_PLUGIN_MCP_SERVER_DOMAIN: Final[dict[str, str]] = {
    "Sse": "http_transport",
    "Stdio": "process_transport",
    "StreamableHttp": "http_transport",

}

_CLOSED_SET: Final[frozenset[str]] = frozenset(AGENT_PLUGIN_MCP_SERVER_ELEMENTS)


class AgentPluginMcpServer(StrEnum):
    """对照协议面 variant（逐字登记，真相源）。"""

    SSE = "Sse"
    STDIO = "Stdio"
    STREAMABLE_HTTP = "StreamableHttp"



class AgentPluginMcpServerError(ValueError):
    """未登记的协议面 variant（封闭集/元素数/归类判据点名）。"""


def agent_plugin_mcp_server_names() -> list[str]:
    """返回逐字 variant 名列表副本（顺序稳定，调用方改不动真相源）。"""
    return list(AGENT_PLUGIN_MCP_SERVER_ELEMENTS)


def expected_mcp_server_element_count(name: str) -> int:
    """该 variant 的逐字元素数（未登记抛错）。"""
    if not isinstance(name, str) or name not in _CLOSED_SET:
        raise AgentPluginMcpServerError(f"未登记的 variant: {name!r} —— 先在 app/core/agent_plugin_mcp_server.py 的 AGENT_PLUGIN_MCP_SERVER_ELEMENTS 登记")
    return AGENT_PLUGIN_MCP_SERVER_ELEMENTS[name]


def ensure_agent_plugin_mcp_server(value: str) -> str:
    """值域闭合：登记过原样放行，未登记抛 :class:`AgentPluginMcpServerError`。"""
    if not isinstance(value, str) or value not in _CLOSED_SET:
        raise AgentPluginMcpServerError(f"未登记的 variant: {value!r} —— 先在 app/core/agent_plugin_mcp_server.py 的 AgentPluginMcpServer 登记后再产出")
    return value


def agent_plugin_mcp_server_domain(value: str) -> str:
    """归类到协议面域（登记外抛错）。"""
    ensure_agent_plugin_mcp_server(value)
    return AGENT_PLUGIN_MCP_SERVER_DOMAIN[value]


def agent_plugin_mcp_server_domain_members(domain: str) -> tuple[str, ...]:
    """反查某域下的全部逐字 variant 名（元组副本，调用方改不动真相源）。"""
    if domain not in set(AGENT_PLUGIN_MCP_SERVER_DOMAIN.values()):
        raise AgentPluginMcpServerError(f"未登记的域: {domain!r} —— 合法域: {sorted(set(AGENT_PLUGIN_MCP_SERVER_DOMAIN.values()))!r}")
    return tuple(nm for nm, dom in AGENT_PLUGIN_MCP_SERVER_DOMAIN.items() if dom == domain)


def is_agent_plugin_mcp_server(value: str) -> bool:
    """封闭集成员判定（不改值、不抛错）。"""
    return isinstance(value, str) and value in _CLOSED_SET


def validate_agent_plugin_mcp_server(name: str, element_count: int) -> str:
    """一致性守门：variant 名与元素数须同时匹配逐字表，否则抛错点名。"""
    ensure_agent_plugin_mcp_server(name)
    expected = expected_mcp_server_element_count(name)
    if element_count != expected:
        raise AgentPluginMcpServerError(f"{name!r} 的 struct 元素数应为 {expected}，实得 {element_count!r}")
    return name
