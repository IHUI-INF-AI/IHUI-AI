# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""回放条目线格式清单封闭集（RolloutItemWire，13 struct variant） —— 统一工程规范 R59（协议面封闭集轴型）。

取证（codex.exe 26.1111.2228.0，365MB Rust PE，strings 逐字 + ``struct variant X::Y with N element`` 机器反推，
见 R58 ``families.out`` / 本轮 ``docs/engineering/round11-reverse/R59-*.md``）：逐字 variant 名与元素数表由
机器从二进制抽取，模块内表与单测双重钉死。本仓归属过滤：该族名在本仓 app/core 零命中（或仅为异层别名，
见下），是干净的协议面空白——与 R56-R58 的语义 enum 不同，本轴登记的是**RPC 方法/事件载荷名清单**。

一轴超越：13 个 rollout item 线格式载荷逐字表（元素数 1~2）+ 八类回放域（meta/context/event/realtime/security/usage/inter_agent/item）归类 + 可执行反查。

诚实边界：13 载荷名与元素数逐字确证；回放域八分类是本仓语义归类非对照原生判据；各载荷字段语义未确证。
"""

from __future__ import annotations

from enum import StrEnum
from typing import Final

__all__ = [
    "RolloutItemWire",
    "RolloutItemWireError",
    "ROLLOUT_ITEM_ELEMENTS",
    "ROLLOUT_ITEM_DOMAIN",
    "rollout_item_names",
    "expected_rollout_item_element_count",
    "ensure_rollout_item_wire",
    "rollout_item_domain",
    "rollout_item_domain_members",
    "is_rollout_item",
    "validate_rollout_item",

]

# 逐字 variant 名 → struct 元素数（来自 ``with N element`` 声明，漂移由 pytest 钉死）。
ROLLOUT_ITEM_ELEMENTS: Final[dict[str, int]] = {
    "Compacted": 1,
    "DynamicToolsUpdated": 1,
    "EventMsg": 1,
    "InterAgentCommunication": 1,
    "InterAgentCommunicationMetadata": 1,
    "RealtimeItem": 1,
    "ResponseItem": 2,
    "RetainedContext": 1,
    "SecurityRiskScore": 1,
    "SessionMeta": 1,
    "TokenUsageRecord": 1,
    "TurnContext": 1,
    "WorldState": 1,

}

# 本仓语义归类（非对照原生判据）：每个方法/载荷归入一个协议面域。
ROLLOUT_ITEM_DOMAIN: Final[dict[str, str]] = {
    "Compacted": "context",
    "DynamicToolsUpdated": "context",
    "EventMsg": "event",
    "InterAgentCommunication": "inter_agent",
    "InterAgentCommunicationMetadata": "inter_agent",
    "RealtimeItem": "realtime",
    "ResponseItem": "item",
    "RetainedContext": "context",
    "SecurityRiskScore": "security",
    "SessionMeta": "meta",
    "TokenUsageRecord": "usage",
    "TurnContext": "meta",
    "WorldState": "context",

}

_CLOSED_SET: Final[frozenset[str]] = frozenset(ROLLOUT_ITEM_ELEMENTS)


class RolloutItemWire(StrEnum):
    """对照协议面 variant（逐字登记，真相源）。"""

    COMPACTED = "Compacted"
    DYNAMIC_TOOLS_UPDATED = "DynamicToolsUpdated"
    EVENT_MSG = "EventMsg"
    INTER_AGENT_COMMUNICATION = "InterAgentCommunication"
    INTER_AGENT_COMMUNICATION_METADATA = "InterAgentCommunicationMetadata"
    REALTIME_ITEM = "RealtimeItem"
    RESPONSE_ITEM = "ResponseItem"
    RETAINED_CONTEXT = "RetainedContext"
    SECURITY_RISK_SCORE = "SecurityRiskScore"
    SESSION_META = "SessionMeta"
    TOKEN_USAGE_RECORD = "TokenUsageRecord"
    TURN_CONTEXT = "TurnContext"
    WORLD_STATE = "WorldState"



class RolloutItemWireError(ValueError):
    """未登记的协议面 variant（封闭集/元素数/归类判据点名）。"""


def rollout_item_names() -> list[str]:
    """返回逐字 variant 名列表副本（顺序稳定，调用方改不动真相源）。"""
    return list(ROLLOUT_ITEM_ELEMENTS)


def expected_rollout_item_element_count(name: str) -> int:
    """该 variant 的逐字元素数（未登记抛错）。"""
    if not isinstance(name, str) or name not in _CLOSED_SET:
        raise RolloutItemWireError(
            f"未登记的协议面 variant: {name!r} —— 先在 app/core/rollout_item_wire.py 的 ROLLOUT_ITEM_ELEMENTS 登记"
        )
    return ROLLOUT_ITEM_ELEMENTS[name]


def ensure_rollout_item_wire(value: str) -> str:
    """值域闭合：登记过原样放行，未登记抛 :class:`RolloutItemWireError`。"""
    if not isinstance(value, str) or value not in _CLOSED_SET:
        raise RolloutItemWireError(
            f"未登记的协议面 variant: {value!r} —— 先在 app/core/rollout_item_wire.py 的 RolloutItemWire 登记后再产出"
        )
    return value


def rollout_item_domain(value: str) -> str:
    """归类到协议面域（登记外抛错）。"""
    ensure_rollout_item_wire(value)
    return ROLLOUT_ITEM_DOMAIN[value]


def rollout_item_domain_members(domain: str) -> tuple[str, ...]:
    """反查某域下的全部逐字 variant 名（元组副本，调用方改不动真相源）。"""
    if domain not in set(ROLLOUT_ITEM_DOMAIN.values()):
        raise RolloutItemWireError(
            f"未登记的协议面域: {domain!r} —— 合法域: {sorted(set(ROLLOUT_ITEM_DOMAIN.values()))!r}"
        )
    return tuple(nm for nm, dom in ROLLOUT_ITEM_DOMAIN.items() if dom == domain)


def is_rollout_item(value: str) -> bool:
    """封闭集成员判定（不改值、不抛错）。"""
    return isinstance(value, str) and value in _CLOSED_SET


def validate_rollout_item(name: str, element_count: int) -> str:
    """一致性守门：variant 名与元素数须同时匹配逐字表，否则抛错点名。"""
    ensure_rollout_item_wire(name)
    expected = expected_rollout_item_element_count(name)
    if element_count != expected:
        raise RolloutItemWireError(
            f"{name!r} 的 struct 元素数应为 {expected}，实得 {element_count!r}"
        )
    return name
