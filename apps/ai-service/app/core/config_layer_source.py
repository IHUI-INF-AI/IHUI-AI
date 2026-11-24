# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""配置层来源封闭集（ConfigLayerSource，7 struct variant）—— 统一工程规范 R57。

取证（codex.exe 26.1111.2228.0，365MB Rust PE，strings 逐字）：
::

    struct variant ConfigLayerSource::EnterpriseManaged with 2 element
    struct variant ConfigLayerSource::LegacyManagedConfigTomlFromFile with 1 element
    struct variant ConfigLayerSource::Mdm with 2 element
    struct variant ConfigLayerSource::PackagedDefaults with 1 element
    struct variant ConfigLayerSource::Project with 1 element
    struct variant ConfigLayerSource::System with 1 element
    struct variant ConfigLayerSource::User with 2 element
    internally tagged enum ConfigLayerSource

七档逐字确证（`struct variant ... with N element` 声明正则全反推，和 1600 字节长连体串
``...ConfigLayerSourceSessionFlagsLegacyManagedConfigTomlFromMdmAllowDeny...`` 交叉印证）。
注意 ``Mdm/Project/System`` 各在二进制里出现两次声明（serde tag 与字段投递各一份），
去重后为七档。

本仓边界：全仓 app 层 grep ``ConfigLayerSource/EnterpriseManaged/LegacyManagedConfigTomlFromFile``
零命中。本仓 ``config.py/config_profiles.py/provider_config.py`` 管配置**内容**与 profile，
``guardian_managed_policy.py`` 管托管策略语义——都不固化「配置来自哪一层」的七档来源封闭集。
本模块只固化来源 variant + 元素数 + 作用域归类，互补不替换。

一轴超越：对照把七档散在 serde gate 处、靠 enum 匹配隐式区分层级，无「哪些是托管层/用户层/
系统层」的显式归类与优先级。本模块提供 ``layer_scope`` 三分类、``is_managed_layer``、
``LAYER_PRIORITY`` 优先级表 + ``expected_element_count`` / ``validate_config_layer`` 一致性守门，
可 diff 可单测。

诚实边界：七档 variant 名与元素数逐字确证；serde tag rename 未确证（按 Rust variant 名逐字登记）；
``layer_scope``/``LAYER_PRIORITY`` 是本仓语义归类（Mdm/Enterprise/Legacy 视为 managed 且优先级
高于 User/Project > System/Packaged），**非对照原生优先级**，对照真实合并序未从二进制确证。
"""

from __future__ import annotations

from enum import StrEnum
from typing import Final

__all__ = [
    "ConfigLayerSource",
    "ConfigLayerSourceError",
    "CONFIG_LAYER_ELEMENTS",
    "LAYER_SCOPE",
    "LAYER_PRIORITY",
    "config_layer_names",
    "expected_element_count",
    "ensure_config_layer_source",
    "layer_scope",
    "is_managed_layer",
    "validate_config_layer",
]

#: 逐字 variant 名 → struct 元素数。
CONFIG_LAYER_ELEMENTS: Final[dict[str, int]] = {
    "EnterpriseManaged": 2,
    "LegacyManagedConfigTomlFromFile": 1,
    "Mdm": 2,
    "PackagedDefaults": 1,
    "Project": 1,
    "System": 1,
    "User": 2,
}

#: 本仓语义归类：托管层 / 用户层 / 系统层。
LAYER_SCOPE: Final[dict[str, str]] = {
    "EnterpriseManaged": "managed",
    "Mdm": "managed",
    "LegacyManagedConfigTomlFromFile": "managed",
    "User": "user",
    "Project": "user",
    "System": "system",
    "PackagedDefaults": "system",
}

#: 本仓语义优先级（数值大者覆盖小者）——非对照原生合并序，见诚实边界。
LAYER_PRIORITY: Final[dict[str, int]] = {
    "PackagedDefaults": 0,
    "System": 1,
    "User": 2,
    "Project": 3,
    "EnterpriseManaged": 4,
    "LegacyManagedConfigTomlFromFile": 4,
    "Mdm": 5,
}

_CLOSED_SET: Final[frozenset[str]] = frozenset(CONFIG_LAYER_ELEMENTS)


class ConfigLayerSource(StrEnum):
    """对照 ConfigLayerSource 七档 variant（逐字登记，真相源）。"""

    ENTERPRISE_MANAGED = "EnterpriseManaged"
    LEGACY_MANAGED_CONFIG_TOML_FROM_FILE = "LegacyManagedConfigTomlFromFile"
    MDM = "Mdm"
    PACKAGED_DEFAULTS = "PackagedDefaults"
    PROJECT = "Project"
    SYSTEM = "System"
    USER = "User"


class ConfigLayerSourceError(ValueError):
    """未登记的配置层来源 variant（封闭集/元素数判据点名）。"""


def config_layer_names() -> list[str]:
    """返回逐字 variant 名列表副本。"""
    return list(CONFIG_LAYER_ELEMENTS)


def expected_element_count(name: str) -> int:
    """该来源 struct variant 的逐字元素数（未登记抛错）。"""
    if name not in _CLOSED_SET:
        raise ConfigLayerSourceError(
            f"未登记的配置层来源 variant: {name!r} —— "
            "先在 app/core/config_layer_source.py 的 CONFIG_LAYER_ELEMENTS 登记"
        )
    return CONFIG_LAYER_ELEMENTS[name]


def ensure_config_layer_source(value: str) -> str:
    """值域闭合：登记过原样放行，未登记抛 :class:`ConfigLayerSourceError`。"""
    if not isinstance(value, str) or value not in _CLOSED_SET:
        raise ConfigLayerSourceError(
            f"未登记的配置层来源: {value!r} —— "
            "先在 app/core/config_layer_source.py 的 ConfigLayerSource 登记后再产出"
        )
    return value


def layer_scope(value: str) -> str:
    """归类：managed / user / system（登记外抛错）。"""
    ensure_config_layer_source(value)
    return LAYER_SCOPE[value]


def is_managed_layer(value: str) -> bool:
    """是否托管来源（EnterpriseManaged/Mdm/Legacy）。"""
    return layer_scope(value) == "managed"


def validate_config_layer(name: str, element_count: int) -> str:
    """一致性守门：variant 名与元素数须同时匹配逐字表。"""
    ensure_config_layer_source(name)
    expected = expected_element_count(name)
    if element_count != expected:
        raise ConfigLayerSourceError(
            f"{name!r} 的 struct 元素数应为 {expected}，实得 {element_count!r}"
        )
    return name
