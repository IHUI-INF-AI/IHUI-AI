# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""工具结果溯源枚举 + 截断元数据契约 —— 遵循统一工程规范。

设计依据（2026-11-16，下潜 外部程序 364.8MB 主引擎，strings 定向抽取）。
对照物协议层两件物（逐字锚）：
- ``tool_result_source``：溯源枚举，区分结果由谁产出 —— ``codex``（引擎内置工具
  自产，如 local_shell / apply_patch）vs ``executed_tool_call``（模型发起的工具调用
  回灌）。两者在 transcript item 上是不同变体。
- ``ToolResultMetadata``：截断元数据，字段逐字 ``truncated`` / ``original_bytes`` /
  ``max_bytes`` / ``omitted_calls`` / ``original_name_bytes``。

管：给定一次工具结果与其截断情况，产出可机检的溯源标签 + 截断元数据；
``tool_result_source`` 让消费方（审计 / 回放 / 元学习）能区分"引擎自产结果"与
"模型工具调用结果"，``truncated`` 元数据让被截断的结果带完整凭据（原始多大 /
上限多少 / 省略了多少调用）。

不管：不判定结果内容好坏（那是 executor 的职责）；不做磁盘 spill（本仓已有
artifact 机制）；不替换 executed_tool_calls.py 的记录器（那是"本轮尝试过哪些调用"
的轴，本模块是"单条结果由谁产出 + 截断凭据"的轴，二者互补）。

超越轴（一轴）：对照把截断凭据散在协议序列化各处、``truncated`` 与 ``original_bytes``
靠字段是否出现隐式区分（无 truncated ⇒ 未截断），无统一构造器；本仓让
``truncated`` 由 ``original_bytes > max_bytes`` 显式驱动，``omitted_calls`` 与
``original_name_bytes`` 在未截断时显式归零（不是缺字段），可 diff 可单测可挂审计。
"""

from __future__ import annotations

from dataclasses import dataclass
from enum import StrEnum


class ToolResultSource(StrEnum):
    """工具结果溯源封闭集（对照协议层 ``tool_result_source`` 两变体）。

    - ``CODEX``：引擎内置工具自产结果（local_shell / apply_patch / web_search 等
      Codex 自己执行并产出）。
    - ``EXECUTED_TOOL_CALL``：模型发起的工具调用经执行后回灌的结果。
    """

    CODEX = "codex"
    EXECUTED_TOOL_CALL = "executed_tool_call"


#: 截断元数据逐字字段（对照协议层 ``ToolResultMetadata``）
#: truncated / original_bytes / max_bytes / omitted_calls / original_name_bytes
_TRUNCATED_FIELD = "truncated"
_ORIGINAL_BYTES_FIELD = "original_bytes"
_MAX_BYTES_FIELD = "max_bytes"
_OMITTED_CALLS_FIELD = "omitted_calls"
_ORIGINAL_NAME_BYTES_FIELD = "original_name_bytes"


@dataclass(frozen=True)
class ToolResultMetadata:
    """工具结果截断元数据（对照协议层 ``ToolResultMetadata`` 五字段）。

    不变量：
    - ``truncated`` = ``original_bytes > max_bytes``（显式驱动，非隐式缺字段）。
    - 未截断时 ``omitted_calls == 0`` 且 ``original_name_bytes == 0``（显式归零）。
    - 截断时 ``original_bytes > max_bytes >= 0``。
    """

    truncated: bool
    original_bytes: int
    max_bytes: int
    omitted_calls: int = 0
    original_name_bytes: int = 0


def build_result_metadata(
    original_bytes: int,
    max_bytes: int,
    *,
    omitted_calls: int = 0,
    original_name_bytes: int = 0,
) -> ToolResultMetadata:
    """由原始大小与上限构造截断元数据（唯一出口）。

    ``truncated`` 由 ``original_bytes > max_bytes`` 显式判定。未截断时强制
    ``omitted_calls`` / ``original_name_bytes`` 归零（对照隐式缺字段 → 本仓显式归零，
    超越轴）。负数输入一律视为 0（防误用）。
    """
    ob = max(0, original_bytes)
    mb = max(0, max_bytes)
    truncated = ob > mb
    if not truncated:
        omitted_calls = 0
        original_name_bytes = 0
    return ToolResultMetadata(
        truncated=truncated,
        original_bytes=ob,
        max_bytes=mb,
        omitted_calls=max(0, omitted_calls),
        original_name_bytes=max(0, original_name_bytes),
    )


def classify_source(is_engine_builtin: bool) -> ToolResultSource:
    """由"是否引擎内置工具"判定溯源标签（纯函数，唯一出口）。

    ``True`` ⇒ ``CODEX``（引擎自产）；``False`` ⇒ ``EXECUTED_TOOL_CALL``（模型发起）。
    """
    return ToolResultSource.CODEX if is_engine_builtin else ToolResultSource.EXECUTED_TOOL_CALL


def metadata_to_dict(meta: ToolResultMetadata) -> dict[str, object]:
    """序列化为协议层逐字字段名的 dict（可机检，字段名逐字对照）。"""
    return {
        _TRUNCATED_FIELD: meta.truncated,
        _ORIGINAL_BYTES_FIELD: meta.original_bytes,
        _MAX_BYTES_FIELD: meta.max_bytes,
        _OMITTED_CALLS_FIELD: meta.omitted_calls,
        _ORIGINAL_NAME_BYTES_FIELD: meta.original_name_bytes,
    }
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
