# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""Agent/Operation 生命周期状态封闭集 —— 遵循统一工程规范。

设计依据（2026-11-18，下潜 外部程序 364.8MB 主引擎，strings 定向抽取）。
对照物 strings 逐字锚（连续 token 拼接形态）::

    PendingInit Running Interrupted Completed Errored Shutdown        (Rust 变体名，6 档)
    pending_init running interrupted errored shutdown not_found        (wire serde，7 档)

**取证纠偏（防后人踩，本轴核心）**——Rust enum 变体名（6 档）与 wire serde rename（7 档）
**档数不同**：Rust 侧无 ``not_found`` 变体，但 wire 值域在 ``shutdown`` 后紧跟
``not_found``。二者配对证据：``AgentStatusEntry``/``AgentStatusHistoryCell`` 结构名逐字
命中（agent 状态轴）。本封闭集取 **wire 七档**（对外契约更全，含 ``not_found``「Agent 不存在」），
``not_found`` 标注为「wire 独有、Rust 变体名未现」。七档是否同一 enum、serde rename 确切
为何未逐字段确证，已双重标注。

语义（agent 生命周期）：
- ``pending_init``：已创建未初始化完成（不对外发消息）；
- ``running``：正在运行（不对外发消息）；
- ``interrupted``：被中断（不对外发消息）；
- ``completed``：成功终态（对外发完成消息）；
- ``errored``：失败终态（对外发错误消息）；
- ``shutdown``：被关闭（对外发关闭消息）；
- ``not_found``：Agent 不存在（对外发未找到消息）。

本仓真空白：``app/core/session_prefix.py`` 的 ``format_inter_agent_completion_message`` /
``build_inter_agent_completion_fragment`` 用**七档自由字符串** + ``if/elif`` 链
（``status == "completed"``/``"errored"``/``"shutdown"``/``"not_found"``），**无封闭集、
无值域校验**——未知 status 走 ``else: return None`` **静默吞掉**（不抛错、不点名），
消费面可凭空写错档位而不被发现。本模块补封闭集 + 校验判据（对齐 ``turn_stop_reason``
/``a2a_task_state`` 同纪律）。

一轴超越：对照把七档散在 agent 状态分支（运行时遇到才产出），且「该状态是否对外发消息、
发什么」靠分支位置隐式决定、无统一判据。本仓提前为纯函数：``is_terminal_state()``（三终态）、
``emits_message()``（四态对外发消息 vs 三态静默）、``is_in_flight()``（三在飞态），可 diff
可单测；未登记档位抛错点名不静默放行（对齐 §0 铁律 3「没判绝不写成判过」）。
"""

from __future__ import annotations

from enum import StrEnum
from typing import Final

__all__ = [
    "AgentOperationStatus",
    "AgentOperationStatusError",
    "ensure_agent_operation_status",
    "is_terminal_state",
    "emits_message",
    "is_in_flight",
    "MESSAGE_EMITTING_STATES",
    "IN_FLIGHT_STATES",
]

#: 对外发完成/错误/关闭/未找到消息的四态（其余三态在飞不发）。
MESSAGE_EMITTING_STATES: Final[frozenset[str]] = frozenset(
    {"completed", "errored", "shutdown", "not_found"}
)

#: 在飞三态（pending_init/running/interrupted，不对外发消息）。
IN_FLIGHT_STATES: Final[frozenset[str]] = frozenset(
    {"pending_init", "running", "interrupted"}
)

# 供守门静态解析的字面量总表（与成员一一对应；漂移由 pytest 钉死）。
AGENT_OPERATION_STATUS_VALUES: Final[tuple[str, ...]] = (
    "pending_init",
    "running",
    "interrupted",
    "completed",
    "errored",
    "shutdown",
    "not_found",
)

_CLOSED_SET: Final[frozenset[str]] = frozenset(AGENT_OPERATION_STATUS_VALUES)


class AgentOperationStatus(StrEnum):
    """Agent/Operation 生命周期状态封闭集（wire 七档，逐字对照）。"""

    #: 已创建未初始化完成（在飞，不发消息）。
    PENDING_INIT = "pending_init"
    #: 正在运行（在飞，不发消息）。
    RUNNING = "running"
    #: 被中断（在飞，不发消息）。
    INTERRUPTED = "interrupted"
    #: 成功终态（对外发完成消息）。
    COMPLETED = "completed"
    #: 失败终态（对外发错误消息）。
    ERRORED = "errored"
    #: 被关闭（对外发关闭消息）。
    SHUTDOWN = "shutdown"
    #: Agent 不存在（对外发未找到消息；wire 独有，Rust 变体名未现）。
    NOT_FOUND = "not_found"


class AgentOperationStatusError(ValueError):
    """未登记的 agent 生命周期状态（封闭集判据点名）。"""


def ensure_agent_operation_status(value: str) -> str:
    """值域闭合判据：登记过的档位原样放行，未登记 ⇒ 抛 :class:`AgentOperationStatusError`。

    对照 ``session_prefix.format_inter_agent_completion_message`` 的 ``else: return None``
    静默吞档位——本判据改为抛错点名，防未知档位静默放行。
    """
    if not isinstance(value, str) or value not in _CLOSED_SET:
        raise AgentOperationStatusError(
            f"未登记的 agent 生命周期状态（AgentOperationStatus 封闭集之外）: {value!r}"
            f" —— 先在 app/core/agent_operation_status.py 的 AgentOperationStatus 登记后再产出"
        )
    return value


def is_terminal_state(value: str) -> bool:
    """是否终态（completed/errored/shutdown/not_found 四态皆已脱离在飞）。未登记 ⇒ 抛错。

    语义：这四态不再变化（终局）；在飞三态仍会迁移。区别于「是否对外发消息」（见
    :func:`emits_message`）——not_found 既终态也发消息，pending_init 既在飞也不发。
    """
    return ensure_agent_operation_status(value) not in IN_FLIGHT_STATES


def emits_message(value: str) -> bool:
    """该状态是否对外发 inter-agent 消息（completed/errored/shutdown/not_found ⇒ True）。

    对齐 ``format_inter_agent_completion_message``：四态发消息，三在飞态返 None（不发）。
    未登记 ⇒ 抛错。
    """
    return ensure_agent_operation_status(value) in MESSAGE_EMITTING_STATES


def is_in_flight(value: str) -> bool:
    """是否在飞态（pending_init/running/interrupted，仍会迁移、不发消息）。未登记 ⇒ 抛错。"""
    return ensure_agent_operation_status(value) in IN_FLIGHT_STATES
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
