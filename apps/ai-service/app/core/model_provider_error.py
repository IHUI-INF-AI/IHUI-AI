# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""模型供应商错误封闭集（ModelProviderError，3 struct variant）—— 统一工程规范 R58。

取证（codex.exe 26.1111.2228.0，365MB Rust PE，strings 逐字 + 元素数机器反推）：
::

    struct variant ModelProviderError::ModelProviderMismatch with 2 element
    struct variant ModelProviderError::ModelProviderNotConfigured with 1 element
    struct variant ModelProviderError::ModelProviderPolicyConflict with 2 element

三档逐字确证（元素数 2/1/2）。本仓边界：全仓 app 层 grep
``ModelProviderMismatch/ModelProviderNotConfigured/ModelProviderPolicyConflict`` 零命中。
本仓 ``model_reroute_reason.py`` 是**重路由原因**（servererror/provider/agent/sync/async），
``provider_config.py`` 是供应商配置——都不是「供应商错误三分类」，本模块不替换。

一轴超越：对照把三档散在供应商解析路径，靠 enum 匹配隐式区分，无「未配置/不匹配/
策略冲突」显式归类，也无元素数一致性判据。本模块提供 ``provider_error_kind`` 三分类
+ ``expected_element_count`` 逐字元素数表 + ``validate_provider_error`` 一致性守门。

诚实边界：三档 variant 名与元素数逐字确证；serde tag/rename 未确证（按 Rust variant 名
逐字登记）；运行时触发条件未确证；``provider_error_kind`` 三分类是本仓语义归类非对照原生。
"""

from __future__ import annotations

from enum import StrEnum
from typing import Final

__all__ = [
    "ModelProviderError",
    "ModelProviderErrorError",
    "MODEL_PROVIDER_ERROR_ELEMENTS",
    "PROVIDER_ERROR_KIND",
    "provider_error_names",
    "expected_element_count",
    "ensure_model_provider_error",
    "provider_error_kind",
    "validate_provider_error",
]

#: 逐字 variant 名 → struct 元素数（来自 ``with N element`` 声明，漂移由 pytest 钉死）。
MODEL_PROVIDER_ERROR_ELEMENTS: Final[dict[str, int]] = {
    "ModelProviderMismatch": 2,
    "ModelProviderNotConfigured": 1,
    "ModelProviderPolicyConflict": 2,
}

#: 本仓语义归类：未配置 / 模型不匹配 / 策略冲突。
PROVIDER_ERROR_KIND: Final[dict[str, str]] = {
    "ModelProviderMismatch": "mismatch",
    "ModelProviderNotConfigured": "not_configured",
    "ModelProviderPolicyConflict": "policy_conflict",
}

_CLOSED_SET: Final[frozenset[str]] = frozenset(MODEL_PROVIDER_ERROR_ELEMENTS)


class ModelProviderError(StrEnum):
    """对照 ModelProviderError 三档 variant（逐字登记，真相源）。"""

    MODEL_PROVIDER_MISMATCH = "ModelProviderMismatch"
    MODEL_PROVIDER_NOT_CONFIGURED = "ModelProviderNotConfigured"
    MODEL_PROVIDER_POLICY_CONFLICT = "ModelProviderPolicyConflict"


class ModelProviderErrorError(ValueError):
    """未登记的模型供应商错误 variant（封闭集/元素数判据点名）。"""


def provider_error_names() -> list[str]:
    """返回逐字 variant 名列表副本（顺序稳定，调用方改不动真相源）。"""
    return list(MODEL_PROVIDER_ERROR_ELEMENTS)


def expected_element_count(name: str) -> int:
    """该供应商错误 struct variant 的逐字元素数（未登记抛错）。"""
    if name not in _CLOSED_SET:
        raise ModelProviderErrorError(
            f"未登记的模型供应商错误 variant: {name!r} —— "
            "先在 app/core/model_provider_error.py 的 MODEL_PROVIDER_ERROR_ELEMENTS 登记"
        )
    return MODEL_PROVIDER_ERROR_ELEMENTS[name]


def ensure_model_provider_error(value: str) -> str:
    """值域闭合：登记过原样放行，未登记抛 :class:`ModelProviderErrorError`。"""
    if not isinstance(value, str) or value not in _CLOSED_SET:
        raise ModelProviderErrorError(
            f"未登记的模型供应商错误: {value!r} —— "
            "先在 app/core/model_provider_error.py 的 ModelProviderError 登记后再产出"
        )
    return value


def provider_error_kind(value: str) -> str:
    """归类：mismatch / not_configured / policy_conflict（登记外抛错）。"""
    ensure_model_provider_error(value)
    return PROVIDER_ERROR_KIND[value]


def validate_provider_error(name: str, element_count: int) -> str:
    """一致性守门：variant 名与元素数须同时匹配逐字表，否则抛错点名。"""
    ensure_model_provider_error(name)
    expected = expected_element_count(name)
    if element_count != expected:
        raise ModelProviderErrorError(
            f"{name!r} 的 struct 元素数应为 {expected}，实得 {element_count!r}"
        )
    return name
