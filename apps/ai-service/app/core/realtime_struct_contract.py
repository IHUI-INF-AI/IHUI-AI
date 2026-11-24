# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""结构元数契约（RealtimeStructContract，10 struct / 3 角色域） —— 统一工程规范 R62（结构元数契约·serde with-N-elements）。

取证（codex.exe 26.1111.2228.0，365MB Rust PE，strings 逐字 + ``struct variant X::Y with N element``
机器反推，见 R58 ``families.out`` / 本轮 ``docs/engineering/round11-reverse/R61-*.md``）：逐字 struct 名与
元素数表由机器从二进制抽取，模块内表与单测双重钉死。本仓归属过滤：该族在本仓 app/core 零命中或仅异层别名。

一轴超越：10 个 codex struct 的逐字元素数（serde `with N elements` 硬断言）+ 3 类结构角色域（Params/Response/Notification/Toml/…）+ 可执行反查。元素数取自身 serde 生成元信息，非人工推断；角色域由结构名后缀确定性归类，与元素数正交。本仓归属过滤：本域结构名在 app/core 零命中；22 个多元素数冲突结构已排除。

诚实边界：10 个 struct 名与元素数逐字确证（单值一致）；角色域分类是本仓后缀归类非对照原生判据；各 struct 的具体字段名因 camelCase 连体串不可可靠切分，已另立 disasm 开放轴。
"""

from __future__ import annotations

from enum import StrEnum
from typing import Final

__all__ = [
    "RealtimeStructContract", "RealtimeStructContractError", "REALTIME_STRUCT_CONTRACT_ELEMENTS", "REALTIME_STRUCT_CONTRACT_DOMAIN", "realtime_struct_contract_names", "expected_realtime_struct_contract_element_count",
    "ensure_realtime_struct_contract", "realtime_struct_contract_domain", "realtime_struct_contract_domain_members", "is_realtime_struct_contract", "validate_realtime_struct_contract",
]

# 逐字 struct 名 → 元素数（serde 硬断言）（来自 ``with N element`` 声明，漂移由 pytest 钉死）。
REALTIME_STRUCT_CONTRACT_ELEMENTS: Final[dict[str, int]] = {
    "AudioContent": 4,
    "AudioControls": 2,
    "AudioDevice": 3,
    "AudioDeviceSelection": 3,
    "AudioState": 2,
    "ImageContent": 4,
    "ImageGenerationItem": 5,
    "ImageViewItem": 2,
    "RealtimeAudioFrame": 5,
    "RealtimeVoicesList": 5,

}

# 本仓语义归类（非对照原生判据）：每个 variant 归入一个协议面域。
REALTIME_STRUCT_CONTRACT_DOMAIN: Final[dict[str, str]] = {
    "AudioContent": "content",
    "AudioControls": "domain_object",
    "AudioDevice": "domain_object",
    "AudioDeviceSelection": "domain_object",
    "AudioState": "descriptor",
    "ImageContent": "content",
    "ImageGenerationItem": "content",
    "ImageViewItem": "content",
    "RealtimeAudioFrame": "domain_object",
    "RealtimeVoicesList": "domain_object",

}

_CLOSED_SET: Final[frozenset[str]] = frozenset(REALTIME_STRUCT_CONTRACT_ELEMENTS)


class RealtimeStructContract(StrEnum):
    """对照协议面 variant（逐字登记，真相源）。"""

    AUDIO_CONTENT = "AudioContent"
    AUDIO_CONTROLS = "AudioControls"
    AUDIO_DEVICE = "AudioDevice"
    AUDIO_DEVICE_SELECTION = "AudioDeviceSelection"
    AUDIO_STATE = "AudioState"
    IMAGE_CONTENT = "ImageContent"
    IMAGE_GENERATION_ITEM = "ImageGenerationItem"
    IMAGE_VIEW_ITEM = "ImageViewItem"
    REALTIME_AUDIO_FRAME = "RealtimeAudioFrame"
    REALTIME_VOICES_LIST = "RealtimeVoicesList"



class RealtimeStructContractError(ValueError):
    """未登记的协议面 variant（封闭集/元素数/归类判据点名）。"""


def realtime_struct_contract_names() -> list[str]:
    """返回逐字 variant 名列表副本（顺序稳定，调用方改不动真相源）。"""
    return list(REALTIME_STRUCT_CONTRACT_ELEMENTS)


def expected_realtime_struct_contract_element_count(name: str) -> int:
    """该 variant 的逐字元素数（未登记抛错）。"""
    if not isinstance(name, str) or name not in _CLOSED_SET:
        raise RealtimeStructContractError(f"未登记的 variant: {name!r} —— 先在 app/core/realtime_struct_contract.py 的 REALTIME_STRUCT_CONTRACT_ELEMENTS 登记")
    return REALTIME_STRUCT_CONTRACT_ELEMENTS[name]


def ensure_realtime_struct_contract(value: str) -> str:
    """值域闭合：登记过原样放行，未登记抛 :class:`RealtimeStructContractError`。"""
    if not isinstance(value, str) or value not in _CLOSED_SET:
        raise RealtimeStructContractError(f"未登记的 variant: {value!r} —— 先在 app/core/realtime_struct_contract.py 的 RealtimeStructContract 登记后再产出")
    return value


def realtime_struct_contract_domain(value: str) -> str:
    """归类到协议面域（登记外抛错）。"""
    ensure_realtime_struct_contract(value)
    return REALTIME_STRUCT_CONTRACT_DOMAIN[value]


def realtime_struct_contract_domain_members(domain: str) -> tuple[str, ...]:
    """反查某域下的全部逐字 variant 名（元组副本，调用方改不动真相源）。"""
    if domain not in set(REALTIME_STRUCT_CONTRACT_DOMAIN.values()):
        raise RealtimeStructContractError(f"未登记的域: {domain!r} —— 合法域: {sorted(set(REALTIME_STRUCT_CONTRACT_DOMAIN.values()))!r}")
    return tuple(nm for nm, dom in REALTIME_STRUCT_CONTRACT_DOMAIN.items() if dom == domain)


def is_realtime_struct_contract(value: str) -> bool:
    """封闭集成员判定（不改值、不抛错）。"""
    return isinstance(value, str) and value in _CLOSED_SET


def validate_realtime_struct_contract(name: str, element_count: int) -> str:
    """一致性守门：variant 名与元素数须同时匹配逐字表，否则抛错点名。"""
    ensure_realtime_struct_contract(name)
    expected = expected_realtime_struct_contract_element_count(name)
    if element_count != expected:
        raise RealtimeStructContractError(f"{name!r} 的 struct 元素数应为 {expected}，实得 {element_count!r}")
    return name
