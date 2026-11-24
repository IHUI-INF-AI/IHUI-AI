# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""MCP Elicitation 结果动作封闭集 —— 遵循统一工程规范。

设计依据（2026-11-18，下潜 外部程序 364.8MB 主引擎，strings 定向抽取）。
对照物 strings 逐字锚::

    ElicitResult action content
    ElicitResultEmptyResult CustomResult action content jsonrpc id
    EnumItems accept decline cancel

对照物是 **MCP（Model Context Protocol）Elicitation**（`ElicitRequest`/`ElicitResult` 逐字
命中）。`ElicitResult` 结构含 `action` + `content` 两字段（``ElicitResultactioncontent``
逐字），`action` 是客户端对 elicitation 请求的响应决策，值域以 EnumItems 形态逐字确证
三档：``accept`` / ``decline`` / ``cancel``。
语义（MCP elicitation 惯例）：
- ``accept``：客户端接受请求（提交 content 中的表单/授权数据）；
- ``decline``：客户端明确拒绝（服务器应停止该 elicitation 触发的动作）；
- ``cancel``：客户端取消整个流程（区别于 decline：cancel 常表「中断上游」）。

取证纠偏（防后人踩）：
- `acceptdeclinecancel` 以 **EnumItems** 形态出现（``citationUntitledEnumItemsacceptdeclinecancel``），
  并与 `ElicitResult` 的 `action` 字段相邻确证（``ElicitResultactioncontent``）——二者**配对**
  为本封闭集，非凭空发明；
- 同样的 ``acceptdeclinecancel`` token 在**别处复用**（``acceptdeclinecancelpersistence``/
  ``acceptdeclinecancelprompts`` 属 persistence/prompts 轴）——本封闭集只认与 `ElicitResult.action`
  配对的那一处；
- `ElicitResult` 的 `content` 是表单数据（schema 由 `ElicitRequest` 的 `requestedSchema` 给出），
  **不在**本封闭集（值域开放，非枚举）；
- 三档是否同一 Rust enum 变体、serde rename 未逐字段确证，已双重标注。

本仓真空白：``app/core/elicitation_pause.py`` 是**计数暂停门控**（登记/释放并发 elicitation
数、翻 paused 标志），**不处理 elicitation 结果 action**；全仓 elicitation result 的
``accept``/``decline``/``cancel`` 决策**无封闭集**（`langgraph_checkpoint.py:437` 用自由字符串
``action == "cancel"``、`subagent_job` 的 cancel 是另一轴、`resume_confirmations` 的
``accept`` 是 resume 语义）——elicitation 客户端决策结果**零命中**封闭集。

一轴超越：对照把三档散在 MCP elicitation 各响应分支（运行时遇到才区分），且 decline 与
cancel 语义边界靠分支位置隐式决定、无统一判据。本仓提前为纯函数：``is_accept()``（提交数据）、
``stops_action()``（decline/cancel 均应停止 elicitation 触发的动作，但 cancel 还表中断上游）、
``is_terminal_response()``（三档均为 elicitation 的终局响应，区别于等待中），可 diff 可单测；
未知档位抛错点名不静默放行（对齐 ``turn_stop_reason`` 同纪律）。
"""

from __future__ import annotations

from enum import StrEnum
from typing import Final

__all__ = [
    "ElicitResultAction",
    "ElicitResultActionError",
    "ensure_elicit_result_action",
    "is_accept",
    "stops_action",
    "is_terminal_response",
]

# 供守门静态解析的字面量总表（与成员一一对应；漂移由 pytest 钉死）。
ELICIT_RESULT_ACTION_VALUES: Final[tuple[str, ...]] = (
    "accept",
    "decline",
    "cancel",
)

_CLOSED_SET: Final[frozenset[str]] = frozenset(ELICIT_RESULT_ACTION_VALUES)


class ElicitResultAction(StrEnum):
    """MCP Elicitation 结果动作封闭集（对照 EnumItems 逐字确证三档）。"""

    #: 客户端接受请求（提交 content 中的表单/授权数据）。
    ACCEPT = "accept"
    #: 客户端明确拒绝（服务器应停止该 elicitation 触发的动作）。
    DECLINE = "decline"
    #: 客户端取消整个流程（区别于 decline：常表「中断上游」）。
    CANCEL = "cancel"


class ElicitResultActionError(ValueError):
    """未登记的 elicitation 结果动作（封闭集判据点名）。"""


def ensure_elicit_result_action(value: str) -> str:
    """值域闭合判据：登记过的档位原样放行，未登记 ⇒ 抛 :class:`ElicitResultActionError`。"""
    if not isinstance(value, str) or value not in _CLOSED_SET:
        raise ElicitResultActionError(
            f"未登记的 elicitation 结果动作（ElicitResult.action 封闭集之外）: {value!r}"
            f" —— 先在 app/core/elicit_result_action.py 的 ElicitResultAction 登记后再产出"
        )
    return value


def is_accept(value: str) -> bool:
    """是否为「接受」响应（客户端提交了 content 数据）。未登记 ⇒ 抛错。"""
    return ensure_elicit_result_action(value) == ElicitResultAction.ACCEPT.value


def stops_action(value: str) -> bool:
    """该响应是否应停止 elicitation 触发的动作（decline/cancel 均停止，仅 accept 不停止）。

    语义边界：decline 与 cancel **都**让服务器停止动作；cancel 额外表「中断上游流程」
    （见 :func:`is_terminal_response` 与模块 docstring）。未登记 ⇒ 抛错（不静默判 False）。
    """
    return ensure_elicit_result_action(value) != ElicitResultAction.ACCEPT.value


def is_terminal_response(value: str) -> bool:
    """是否为 elicitation 的终局响应（accept/decline/cancel 三档均终局，区别于等待中）。"""
    ensure_elicit_result_action(value)
    return True
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
