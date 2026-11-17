# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""auto-compact token 上限作用域封闭集 —— 遵循统一工程规范。

设计依据（2026-11-18，下潜 外部程序 364.8MB 主引擎，strings 定向抽取）。
对照物 strings 逐字锚（连续 token 拼接形态）::

    LimitScope total body

``LimitScope`` 是 auto-compact ``token_limit`` 的**作用域**枚举，两档值域逐字确证：
- ``total``：上限约束**全窗口**（prefix + body 全算）；
- ``body``：上限只约束**响应体**（body，prefix 不计入）。

语义（对照 config 字段 ``auto_compact_token_limit_scope``/``auto_compact_limit_scope``）：
auto-compact 的 token 上限可以「按全窗口用量」或「按 body 用量」两种口径计——
选 ``total`` 则 prefix（系统提示+工具定义+历史）挤占 body 预算；选 ``body`` 则
prefix 不挤占，body 独享 token_limit。这决定「离 compact 还剩多少」的分母口径。

取证纠偏（防后人踩）：``LimitScopetotalbody`` 是 strings 把 enum 名 + 两变体拼成
连续块；两档是否就是 ``LimitScope`` 的**全部**变体（有无第三档如 ``prefix``）未从
二进制确证，本封闭集**只收逐字确证的两档**。两档确切 serde rename、是否同一 enum
未逐字段确证，已双重标注。

本仓真空白：``app/core/auto_compact_window.py`` / ``context_compaction.py`` 有
auto-compact **窗口账本**与**触发阈值**（trigger_ratio=0.88），但 token 上限的
**作用域口径**（total vs body）**零命中**——消费面无法声明/校验「上限按全窗口还是
按 body 计」。本模块补封闭集 + 分母口径判据。

一轴超越：对照把 scope 散在 config 序列化与 compact 预算分支（运行时遇到才区分），
无统一封闭集与「分母口径」判据。本仓提前为纯函数：给定 scope 输出「prefix 是否计入
分母」+「body 独享还是共享」，可 diff 可单测可挂预算前置；未知档位抛错点名不静默放行。
"""

from __future__ import annotations

from enum import StrEnum
from typing import Final

__all__ = [
    "AutoCompactLimitScope",
    "AutoCompactLimitScopeError",
    "ensure_auto_compact_limit_scope",
    "prefix_counts_toward_limit",
    "body_shares_limit_with_prefix",
]

# 供守门静态解析的字面量总表（与成员一一对应；漂移由 pytest 钉死）。
AUTO_COMPACT_LIMIT_SCOPE_VALUES: Final[tuple[str, ...]] = ("total", "body")

_CLOSED_SET: Final[frozenset[str]] = frozenset(AUTO_COMPACT_LIMIT_SCOPE_VALUES)


class AutoCompactLimitScope(StrEnum):
    """auto-compact token 上限作用域封闭集（对照逐字确证两档）。"""

    #: 上限约束全窗口（prefix + body 全算）——prefix 挤占 body 预算。
    TOTAL = "total"
    #: 上限只约束响应体（body）——prefix 不挤占，body 独享 token_limit。
    BODY = "body"


class AutoCompactLimitScopeError(ValueError):
    """未登记的 auto-compact 上限作用域档位（封闭集判据点名）。"""


def ensure_auto_compact_limit_scope(value: str) -> str:
    """值域闭合判据：登记过的档位原样放行，未登记 ⇒ 抛 :class:`AutoCompactLimitScopeError`。"""
    if not isinstance(value, str) or value not in _CLOSED_SET:
        raise AutoCompactLimitScopeError(
            f"未登记的 auto-compact 上限作用域档位（LimitScope 封闭集之外）: {value!r}"
            f" —— 先在 app/core/auto_compact_limit_scope.py 的 AutoCompactLimitScope 登记后再产出"
        )
    return value


def prefix_counts_toward_limit(value: str) -> bool:
    """该作用域下 prefix 是否计入 token 上限分母。

    - ``total`` ⇒ True（全窗口口径，prefix 挤占 body 预算）；
    - ``body`` ⇒ False（body 口径，prefix 不计入）；
    - 未登记档位 ⇒ 抛错（遵循 §0 铁律 3「没判绝不写成判过」）。
    """
    normalized = ensure_auto_compact_limit_scope(value)
    return normalized == AutoCompactLimitScope.TOTAL.value


def body_shares_limit_with_prefix(value: str) -> bool:
    """该作用域下 body 是否与 prefix 共享 token 上限（= prefix 挤占 body 预算）。

    语义与 :func:`prefix_counts_toward_limit` 同源（total 共享/挤占，body 独享）；
    未登记档位 ⇒ 抛错。
    """
    return prefix_counts_toward_limit(value)
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
