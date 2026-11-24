# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""结构元数契约（AgentStructContract，29 struct / 6 角色域） —— 统一工程规范 R62（结构元数契约·serde with-N-elements）。

取证（codex.exe 26.1111.2228.0，365MB Rust PE，strings 逐字 + ``struct variant X::Y with N element``
机器反推，见 R58 ``families.out`` / 本轮 ``docs/engineering/round11-reverse/R61-*.md``）：逐字 struct 名与
元素数表由机器从二进制抽取，模块内表与单测双重钉死。本仓归属过滤：该族在本仓 app/core 零命中或仅异层别名。

一轴超越：29 个 codex struct 的逐字元素数（serde `with N elements` 硬断言）+ 6 类结构角色域（Params/Response/Notification/Toml/…）+ 可执行反查。元素数取自身 serde 生成元信息，非人工推断；角色域由结构名后缀确定性归类，与元素数正交。本仓归属过滤：本域结构名在 app/core 零命中；22 个多元素数冲突结构已排除。

诚实边界：29 个 struct 名与元素数逐字确证（单值一致）；角色域分类是本仓后缀归类非对照原生判据；各 struct 的具体字段名因 camelCase 连体串不可可靠切分，已另立 disasm 开放轴。
"""

from __future__ import annotations

from enum import StrEnum
from typing import Final

__all__ = [
    "AgentStructContract", "AgentStructContractError", "AGENT_STRUCT_CONTRACT_ELEMENTS", "AGENT_STRUCT_CONTRACT_DOMAIN", "agent_struct_contract_names", "expected_agent_struct_contract_element_count",
    "ensure_agent_struct_contract", "agent_struct_contract_domain", "agent_struct_contract_domain_members", "is_agent_struct_contract", "validate_agent_struct_contract",
]

# 逐字 struct 名 → 元素数（serde 硬断言）（来自 ``with N element`` 声明，漂移由 pytest 钉死）。
AGENT_STRUCT_CONTRACT_ELEMENTS: Final[dict[str, int]] = {
    "AdditionalContextEntry": 3,
    "BedrockAwsProfile": 2,
    "ChannelSummary": 7,
    "CollabAgentRef": 3,
    "CollabAgentState": 2,
    "CollabAgentStatusEntry": 4,
    "CollaborationMode": 2,
    "CollaborationModeMask": 4,
    "ConnectorMetadata": 9,
    "Context": 7,
    "ContextId": 2,
    "CreateChannel": 3,
    "DetectedExternalAgentSessionConnectorRecord": 2,
    "ExternalAgentDetectedConnectorCandidate": 3,
    "ExternalPullRequestResponse": 4,
    "GetChannels": 4,
    "IdeContext": 2,
    "ImportedExternalAgentSessionLedger": 2,
    "ImportedExternalAgentSessionRecord": 7,
    "MultiAgentModeState": 2,
    "NoiseChannelPublicKey": 3,
    "ProcessSpawnParams": 10,
    "ProfileIdentity": 2,
    "ProfileInvocation": 4,
    "ProfileMetadata": 2,
    "SpawnRequest": 13,
    "SubAgentActivityItem": 6,
    "TuiAgentsKeymap": 12,
    "UpsertChannelRequest": 2,

}

# 本仓语义归类（非对照原生判据）：每个 variant 归入一个协议面域。
AGENT_STRUCT_CONTRACT_DOMAIN: Final[dict[str, str]] = {
    "AdditionalContextEntry": "descriptor",
    "BedrockAwsProfile": "descriptor",
    "ChannelSummary": "descriptor",
    "CollabAgentRef": "domain_object",
    "CollabAgentState": "descriptor",
    "CollabAgentStatusEntry": "descriptor",
    "CollaborationMode": "domain_object",
    "CollaborationModeMask": "domain_object",
    "ConnectorMetadata": "descriptor",
    "Context": "domain_object",
    "ContextId": "domain_object",
    "CreateChannel": "domain_object",
    "DetectedExternalAgentSessionConnectorRecord": "descriptor",
    "ExternalAgentDetectedConnectorCandidate": "domain_object",
    "ExternalPullRequestResponse": "response",
    "GetChannels": "domain_object",
    "IdeContext": "domain_object",
    "ImportedExternalAgentSessionLedger": "domain_object",
    "ImportedExternalAgentSessionRecord": "descriptor",
    "MultiAgentModeState": "descriptor",
    "NoiseChannelPublicKey": "domain_object",
    "ProcessSpawnParams": "request_params",
    "ProfileIdentity": "domain_object",
    "ProfileInvocation": "domain_object",
    "ProfileMetadata": "descriptor",
    "SpawnRequest": "request",
    "SubAgentActivityItem": "content",
    "TuiAgentsKeymap": "domain_object",
    "UpsertChannelRequest": "request",

}

_CLOSED_SET: Final[frozenset[str]] = frozenset(AGENT_STRUCT_CONTRACT_ELEMENTS)


class AgentStructContract(StrEnum):
    """对照协议面 variant（逐字登记，真相源）。"""

    ADDITIONAL_CONTEXT_ENTRY = "AdditionalContextEntry"
    BEDROCK_AWS_PROFILE = "BedrockAwsProfile"
    CHANNEL_SUMMARY = "ChannelSummary"
    COLLAB_AGENT_REF = "CollabAgentRef"
    COLLAB_AGENT_STATE = "CollabAgentState"
    COLLAB_AGENT_STATUS_ENTRY = "CollabAgentStatusEntry"
    COLLABORATION_MODE = "CollaborationMode"
    COLLABORATION_MODE_MASK = "CollaborationModeMask"
    CONNECTOR_METADATA = "ConnectorMetadata"
    CONTEXT = "Context"
    CONTEXT_ID = "ContextId"
    CREATE_CHANNEL = "CreateChannel"
    DETECTED_EXTERNAL_AGENT_SESSION_CONNECTOR_RECORD = "DetectedExternalAgentSessionConnectorRecord"
    EXTERNAL_AGENT_DETECTED_CONNECTOR_CANDIDATE = "ExternalAgentDetectedConnectorCandidate"
    EXTERNAL_PULL_REQUEST_RESPONSE = "ExternalPullRequestResponse"
    GET_CHANNELS = "GetChannels"
    IDE_CONTEXT = "IdeContext"
    IMPORTED_EXTERNAL_AGENT_SESSION_LEDGER = "ImportedExternalAgentSessionLedger"
    IMPORTED_EXTERNAL_AGENT_SESSION_RECORD = "ImportedExternalAgentSessionRecord"
    MULTI_AGENT_MODE_STATE = "MultiAgentModeState"
    NOISE_CHANNEL_PUBLIC_KEY = "NoiseChannelPublicKey"
    PROCESS_SPAWN_PARAMS = "ProcessSpawnParams"
    PROFILE_IDENTITY = "ProfileIdentity"
    PROFILE_INVOCATION = "ProfileInvocation"
    PROFILE_METADATA = "ProfileMetadata"
    SPAWN_REQUEST = "SpawnRequest"
    SUB_AGENT_ACTIVITY_ITEM = "SubAgentActivityItem"
    TUI_AGENTS_KEYMAP = "TuiAgentsKeymap"
    UPSERT_CHANNEL_REQUEST = "UpsertChannelRequest"



class AgentStructContractError(ValueError):
    """未登记的协议面 variant（封闭集/元素数/归类判据点名）。"""


def agent_struct_contract_names() -> list[str]:
    """返回逐字 variant 名列表副本（顺序稳定，调用方改不动真相源）。"""
    return list(AGENT_STRUCT_CONTRACT_ELEMENTS)


def expected_agent_struct_contract_element_count(name: str) -> int:
    """该 variant 的逐字元素数（未登记抛错）。"""
    if not isinstance(name, str) or name not in _CLOSED_SET:
        raise AgentStructContractError(f"未登记的 variant: {name!r} —— 先在 app/core/agent_struct_contract.py 的 AGENT_STRUCT_CONTRACT_ELEMENTS 登记")
    return AGENT_STRUCT_CONTRACT_ELEMENTS[name]


def ensure_agent_struct_contract(value: str) -> str:
    """值域闭合：登记过原样放行，未登记抛 :class:`AgentStructContractError`。"""
    if not isinstance(value, str) or value not in _CLOSED_SET:
        raise AgentStructContractError(f"未登记的 variant: {value!r} —— 先在 app/core/agent_struct_contract.py 的 AgentStructContract 登记后再产出")
    return value


def agent_struct_contract_domain(value: str) -> str:
    """归类到协议面域（登记外抛错）。"""
    ensure_agent_struct_contract(value)
    return AGENT_STRUCT_CONTRACT_DOMAIN[value]


def agent_struct_contract_domain_members(domain: str) -> tuple[str, ...]:
    """反查某域下的全部逐字 variant 名（元组副本，调用方改不动真相源）。"""
    if domain not in set(AGENT_STRUCT_CONTRACT_DOMAIN.values()):
        raise AgentStructContractError(f"未登记的域: {domain!r} —— 合法域: {sorted(set(AGENT_STRUCT_CONTRACT_DOMAIN.values()))!r}")
    return tuple(nm for nm, dom in AGENT_STRUCT_CONTRACT_DOMAIN.items() if dom == domain)


def is_agent_struct_contract(value: str) -> bool:
    """封闭集成员判定（不改值、不抛错）。"""
    return isinstance(value, str) and value in _CLOSED_SET


def validate_agent_struct_contract(name: str, element_count: int) -> str:
    """一致性守门：variant 名与元素数须同时匹配逐字表，否则抛错点名。"""
    ensure_agent_struct_contract(name)
    expected = expected_agent_struct_contract_element_count(name)
    if element_count != expected:
        raise AgentStructContractError(f"{name!r} 的 struct 元素数应为 {expected}，实得 {element_count!r}")
    return name
