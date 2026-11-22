# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""服务端请求方法清单封闭集（ServerRequest，11 struct variant） —— 统一工程规范 R59（协议面封闭集轴型）。

取证（codex.exe 26.1111.2228.0，365MB Rust PE，strings 逐字 + ``struct variant X::Y with N element`` 机器反推，
见 R58 ``families.out`` / 本轮 ``docs/engineering/round11-reverse/R59-*.md``）：逐字 variant 名与元素数表由
机器从二进制抽取，模块内表与单测双重钉死。本仓归属过滤：该族名在本仓 app/core 零命中（或仅为异层别名，
见下），是干净的协议面空白——与 R56-R58 的语义 enum 不同，本轴登记的是**RPC 方法/事件载荷名清单**。

一轴超越：11 个服务端→客户端请求方法逐字表（元素数一律 2）+ 五类请求域（审批/认证/读态/引导/工具）归类 + 可执行反查。本仓 turn_steerability.py 是 turn 可控性，非协议方法面。

诚实边界：11 方法名与元素数逐字确证；请求域五分类是本仓语义归类非对照原生判据；各方法触发条件与载荷字段未确证。
"""

from __future__ import annotations

from enum import StrEnum
from typing import Final

__all__ = [
    "ServerRequestMethod",
    "ServerRequestMethodError",
    "SERVER_REQUEST_ELEMENTS",
    "SERVER_REQUEST_DOMAIN",
    "server_request_names",
    "expected_server_element_count",
    "ensure_server_request_method",
    "server_request_domain",
    "server_request_domain_members",
    "is_server_request",
    "validate_server_request",

]

# 逐字 variant 名 → struct 元素数（来自 ``with N element`` 声明，漂移由 pytest 钉死）。
SERVER_REQUEST_ELEMENTS: Final[dict[str, int]] = {
    "ApplyPatchApproval": 2,
    "AttestationGenerate": 2,
    "ChatgptAuthTokensRefresh": 2,
    "CommandExecutionRequestApproval": 2,
    "CurrentTimeRead": 2,
    "DynamicToolCall": 2,
    "ExecCommandApproval": 2,
    "FileChangeRequestApproval": 2,
    "McpServerElicitationRequest": 2,
    "PermissionsRequestApproval": 2,
    "ToolRequestUserInput": 2,

}

# 本仓语义归类（非对照原生判据）：每个方法/载荷归入一个协议面域。
SERVER_REQUEST_DOMAIN: Final[dict[str, str]] = {
    "ApplyPatchApproval": "approval",
    "AttestationGenerate": "auth",
    "ChatgptAuthTokensRefresh": "auth",
    "CommandExecutionRequestApproval": "approval",
    "CurrentTimeRead": "query",
    "DynamicToolCall": "tool",
    "ExecCommandApproval": "approval",
    "FileChangeRequestApproval": "approval",
    "McpServerElicitationRequest": "elicitation",
    "PermissionsRequestApproval": "approval",
    "ToolRequestUserInput": "elicitation",

}

_CLOSED_SET: Final[frozenset[str]] = frozenset(SERVER_REQUEST_ELEMENTS)


class ServerRequestMethod(StrEnum):
    """对照协议面 variant（逐字登记，真相源）。"""

    APPLY_PATCH_APPROVAL = "ApplyPatchApproval"
    ATTESTATION_GENERATE = "AttestationGenerate"
    CHATGPT_AUTH_TOKENS_REFRESH = "ChatgptAuthTokensRefresh"
    COMMAND_EXECUTION_REQUEST_APPROVAL = "CommandExecutionRequestApproval"
    CURRENT_TIME_READ = "CurrentTimeRead"
    DYNAMIC_TOOL_CALL = "DynamicToolCall"
    EXEC_COMMAND_APPROVAL = "ExecCommandApproval"
    FILE_CHANGE_REQUEST_APPROVAL = "FileChangeRequestApproval"
    MCP_SERVER_ELICITATION_REQUEST = "McpServerElicitationRequest"
    PERMISSIONS_REQUEST_APPROVAL = "PermissionsRequestApproval"
    TOOL_REQUEST_USER_INPUT = "ToolRequestUserInput"



class ServerRequestMethodError(ValueError):
    """未登记的协议面 variant（封闭集/元素数/归类判据点名）。"""


def server_request_names() -> list[str]:
    """返回逐字 variant 名列表副本（顺序稳定，调用方改不动真相源）。"""
    return list(SERVER_REQUEST_ELEMENTS)


def expected_server_element_count(name: str) -> int:
    """该 variant 的逐字元素数（未登记抛错）。"""
    if not isinstance(name, str) or name not in _CLOSED_SET:
        raise ServerRequestMethodError(
            f"未登记的协议面 variant: {name!r} —— 先在 app/core/server_request_method.py 的 SERVER_REQUEST_ELEMENTS 登记"
        )
    return SERVER_REQUEST_ELEMENTS[name]


def ensure_server_request_method(value: str) -> str:
    """值域闭合：登记过原样放行，未登记抛 :class:`ServerRequestMethodError`。"""
    if not isinstance(value, str) or value not in _CLOSED_SET:
        raise ServerRequestMethodError(
            f"未登记的协议面 variant: {value!r} —— 先在 app/core/server_request_method.py 的 ServerRequestMethod 登记后再产出"
        )
    return value


def server_request_domain(value: str) -> str:
    """归类到协议面域（登记外抛错）。"""
    ensure_server_request_method(value)
    return SERVER_REQUEST_DOMAIN[value]


def server_request_domain_members(domain: str) -> tuple[str, ...]:
    """反查某域下的全部逐字 variant 名（元组副本，调用方改不动真相源）。"""
    if domain not in set(SERVER_REQUEST_DOMAIN.values()):
        raise ServerRequestMethodError(
            f"未登记的协议面域: {domain!r} —— 合法域: {sorted(set(SERVER_REQUEST_DOMAIN.values()))!r}"
        )
    return tuple(nm for nm, dom in SERVER_REQUEST_DOMAIN.items() if dom == domain)


def is_server_request(value: str) -> bool:
    """封闭集成员判定（不改值、不抛错）。"""
    return isinstance(value, str) and value in _CLOSED_SET


def validate_server_request(name: str, element_count: int) -> str:
    """一致性守门：variant 名与元素数须同时匹配逐字表，否则抛错点名。"""
    ensure_server_request_method(name)
    expected = expected_server_element_count(name)
    if element_count != expected:
        raise ServerRequestMethodError(
            f"{name!r} 的 struct 元素数应为 {expected}，实得 {element_count!r}"
        )
    return name
