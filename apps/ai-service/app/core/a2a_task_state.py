# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""A2A（Agent-to-Agent）Task 状态封闭集 —— 遵循统一工程规范。

设计依据（2026-11-18，下潜 外部程序 364.8MB 主引擎，strings 定向抽取）。
对照物 strings 逐字锚（连续 token 拼接形态）::

    working input_required completed failed cancelled
    submitted
    GetTaskRequest UpdateTaskRequest CancelTaskRequest SendMessage
    TaskStatusNotification

对照物是 **A2A 协议**（`SendMessage`/`GetTask`/`CancelTask`/`TaskStatusNotification`
方法名逐字命中）。Task 生命周期状态逐字确证成员：``submitted`` / ``working`` /
``input_required`` / ``completed`` / ``failed`` / ``cancelled``。
语义（A2A 协议惯例）：
- ``submitted``：任务已受理，尚未开始执行；
- ``working``：正在执行；
- ``input_required``：执行暂停，等待客户端补充输入/授权；
- ``completed``：成功终态；
- ``failed``：失败终态；
- ``cancelled``：被取消（客户端/服务端）终态。

取证纠偏（防后人踩）：
- ``submitted`` 在 strings 中**另起**（未与 ``workinginput_required...`` 拼同一连续块），
  故登记为**逐字确证成员**但标注「单独出现」；
- ``blocked`` / ``auth_required`` / ``rejected`` 等出现在**相邻但不同上下文**
  （``auth_required`` 属 remote_catalog 插件市场轴），**不属** TaskState，已排除；
- 成员是否同一 Rust enum 变体、serde rename、是否还有 ``blocked`` 档未从二进制确证，
  本封闭集**只收逐字确证的六档**，已双重标注。

本仓真空白：``app/services/a2a_service.py`` 的 A2A task 用**自由字符串**
（``self.status = "pending"`` / ``"running"`` / ``"completed"`` / ``"failed"``，注释列
``pending/running/completed/failed/canceled``），**无封闭集**，且与协议标准值域
**语义错位**——本仓 ``pending``/``running`` 对应协议 ``submitted``/``working``，
``canceled``（单 l）对应协议 ``cancelled``（双 l），且**缺 ``input_required`` 档**
（等待客户端输入是 A2A 核心交互态）。

一轴超越：对照把六档散在 A2A 协议栈各状态分支（运行时遇到才产出），无统一封闭集与
「终态判定」判据。本仓提前为纯函数：``is_terminal_state()``（completed/failed/cancelled
三终态）、``requires_client_input()``（input_required 暂停态），可 diff 可单测可挂轮询
前置；未知档位抛错点名不静默放行（对齐 ``turn_stop_reason`` 同纪律）。
"""

from __future__ import annotations

from enum import StrEnum
from typing import Final

__all__ = [
    "A2ATaskState",
    "A2ATaskStateError",
    "ensure_a2a_task_state",
    "is_terminal_state",
    "requires_client_input",
    "TERMINAL_STATES",
]

#: 终态集合（completed/failed/cancelled）——供守门静态解析与判据共用。
TERMINAL_STATES: Final[frozenset[str]] = frozenset(
    {"completed", "failed", "cancelled"}
)

# 供守门静态解析的字面量总表（与成员一一对应；漂移由 pytest 钉死）。
A2A_TASK_STATE_VALUES: Final[tuple[str, ...]] = (
    "submitted",
    "working",
    "input_required",
    "completed",
    "failed",
    "cancelled",
)

_CLOSED_SET: Final[frozenset[str]] = frozenset(A2A_TASK_STATE_VALUES)


class A2ATaskState(StrEnum):
    """A2A Task 生命周期状态封闭集（对照逐字确证六档，协议标准值域）。"""

    #: 任务已受理，尚未开始执行（本仓旧用 ``pending``）。
    SUBMITTED = "submitted"
    #: 正在执行（本仓旧用 ``running``）。
    WORKING = "working"
    #: 执行暂停，等待客户端补充输入/授权（本仓此前缺失档）。
    INPUT_REQUIRED = "input_required"
    #: 成功终态。
    COMPLETED = "completed"
    #: 失败终态。
    FAILED = "failed"
    #: 被取消终态（协议双 l ``cancelled``；本仓旧用单 l ``canceled``）。
    CANCELLED = "cancelled"


class A2ATaskStateError(ValueError):
    """未登记的 A2A Task 状态（封闭集判据点名）。"""


def ensure_a2a_task_state(value: str) -> str:
    """值域闭合判据：登记过的档位原样放行，未登记 ⇒ 抛 :class:`A2ATaskStateError`。"""
    if not isinstance(value, str) or value not in _CLOSED_SET:
        raise A2ATaskStateError(
            f"未登记的 A2A Task 状态（TaskState 封闭集之外）: {value!r}"
            f" —— 先在 app/core/a2a_task_state.py 的 A2ATaskState 登记后再产出"
        )
    return value


def is_terminal_state(value: str) -> bool:
    """是否终态（completed/failed/cancelled）。未登记档位 ⇒ 抛错。"""
    return ensure_a2a_task_state(value) in TERMINAL_STATES


def requires_client_input(value: str) -> bool:
    """是否为「等待客户端输入/授权」的暂停态（仅 ``input_required``）。未登记 ⇒ 抛错。"""
    return ensure_a2a_task_state(value) == A2ATaskState.INPUT_REQUIRED.value
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
