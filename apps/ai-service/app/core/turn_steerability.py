# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠


"""Turn 可操纵性（steerability）判据 —— 某类 turn 不接受用户中途引导。

设计依据（2026-11-18，下潜 外部程序 codex.exe 26.1111.2228.0 主引擎，strings 定向抽取）。
对照物 wire 逐字锚（连续 token 拼接形态）::

    CollabResumeEndEvent NonSteerableTurnKind review compact
    non_steerable_review non_steerable_compact            (wire serde rename，独立连体)
    active_turn_not_steerable turn_kind thread_rollback_failed
                                (thread/turn 生命周期错误码表，二者相邻变体)

**语义（turn 可操纵性）**——``review``（代码审查）与 ``compact``（上下文压缩）两类 turn
**不可被用户中途引导（steer）**：它们由系统在特定阶段发起，中途插入用户引导会破坏其
语义（审查未完被改向 / 压缩中途被改向）。对照在用户尝试 steer 这两类 turn 时产出
``active_turn_not_steerable``。本仓把这两类收进 ``NonSteerableTurnKind`` 封闭集，作为
「turn 可否被操纵」的唯一判据取源。

**R52 取证纠偏（防后人踩）**——``active_turn_not_steerable`` 与
``thread_rollback_failed`` 在对照错误码表中只是**相邻变体**（偏移恒差 25 字节，三处
出现皆如此），**非因果链**：后者字面义是「回滚**失败**」，且另有独立的
``thread_rolled_back``（回滚**已成功**）+ ``ThreadRolledBackEvent``。故**拒绝 steer
不等于触发回滚**——R51 首版把二者写成由 verdict 显式驱动的因果，本轮作废，见
:class:`SteerErrorCode` docstring。

**取证纠偏（防后人踩，本轮核心）**——goal-runtime R50 §5 把 collab `ResumeEnd` 的
``review/compact`` 二档记为「与 R20 ``turn_resume_kind`` 六档的映射关系待下潜」。取证否证
该预设：R20 六档（``new/cleared/cold_resume/warm_fork/cold_fork/supplied_history``）是
**恢复来源轴**（turn 从哪里恢复），而本轴 ``review/compact`` 是 **turn 类型可操纵性轴**
（这个 turn 能不能被中途引导），二者**完全不同域、无映射关系**。R50 §5 该句作废，以本轮
取证为准。另注：``review/compact`` 同时出现在 ``SubAgentSource``（子代理来源五档），
那是「来源归类轴」；本轴是「可操纵性轴」，同名不同域，见下方边界声明。

本仓真空白：全仓 grep ``non_steerable|steerable|active_turn_not_steerable``
ai-service **零命中**。本仓 steer 队列（``app/core/queue_items.py``）只做数据平面
（体积护栏 / 字段白名单 / 入队形状），**无「turn 可否被操纵」判据**——用户可对
review/compact 类 turn 无条件入队 steer，对照会拒绝。本模块补封闭集 + 拒绝判据。

一轴超越：对照把「该 turn 不可 steer」散在错误路径（运行时撞上 ``active_turn_not_steerable``
才产出），可操纵性是隐式的、无统一判据，且 steer 相关错误码混在 thread/turn 生命周期
错误族里靠相邻位置隐式关联。本仓提前为纯函数：``is_steerable()``（二值判据）、
``validate_steer()``（表驱动 verdict + 错误码）、``steer_error_codes()``（steer 错误码
分域显式登记，不含回滚成功事件）、``non_steerable_wire_names()``（wire 名可机检）。未
登记 turn 类型抛错点名不静默放行（§0 铁律 3）。

与近邻域互不顶账（边界声明）：
- ``turn_metadata.SubAgentSource``（``review/compact/thread_spawn/memory_consolidation/
  other``）答「子代理来源归类」，本模块答「turn 类型可否被操纵」，同名 ``review``/
  ``compact`` 不同域，互补不替换；
- ``turn_resume_kind.ResumeKind``（六档）答「turn 从哪里恢复」，本模块答「turn 可否被
  steer」，无映射（R50 §5 误记已纠偏）；
- ``queue_items.py`` 答「steer 队列的数据平面形状」，本模块答「这个 turn 根本可不可以
  steer」，互补——接入路径见 ``validate_steer`` docstring。
"""

from __future__ import annotations

from enum import StrEnum
from typing import Final

__all__ = [
    "NonSteerableTurnKind",
    "SteerVerdict",
    "SteerErrorCode",
    "THREAD_ROLLED_BACK_EVENT",
    "TurnSteerabilityError",
    "ensure_turn_kind",
    "is_steerable",
    "validate_steer",
    "steer_error_codes",
    "non_steerable_wire_names",
    "NON_STEERABLE_TURN_KIND_VALUES",
    "CODEX_NON_STEERABLE_TOTAL",
]

#: 供守门静态解析的字面量总表（与 StrEnum 成员逐字一一对应；漂移由 pytest 钉死）。
NON_STEERABLE_TURN_KIND_VALUES: Final[tuple[str, ...]] = (
    "review",
    "compact",
)

#: 对照物 wire 事件总数（不可 steer 的 turn 类型二档；本仓缺失计数基线）。
CODEX_NON_STEERABLE_TOTAL: Final[int] = 2

_CLOSED_SET: Final[frozenset[str]] = frozenset(NON_STEERABLE_TURN_KIND_VALUES)


class NonSteerableTurnKind(StrEnum):
    """不可被用户中途引导（steer）的 turn 类型封闭集（逐字对照，二档）。"""

    #: 代码审查 turn（审查未完被改向会破坏审查语义）。
    REVIEW = "review"
    #: 上下文压缩 turn（压缩中途被改向会破坏压缩语义）。
    COMPACT = "compact"


class SteerVerdict(StrEnum):
    """steer 请求对该 turn 的裁决（二档封闭集）。"""

    #: 接受：turn 可被引导，steer 入队。
    ACCEPT = "accept"
    #: 拒绝：turn 不可引导（review/compact），须回退给调用方。
    REJECT_NOT_STEERABLE = "reject_not_steerable"


class SteerErrorCode(StrEnum):
    """steer 相关 thread/turn 生命周期错误码（逐字对照，二档）。

    取证纠偏（R52，2026-11-18）：二档在对照错误码表中**相邻**（`not_steerable` 与
    `rollback_failed` 偏移恒差 25 字节，三处出现皆如此）⇒ 同属 thread/turn 生命周期
    错误族的两个**并列变体**，**非因果链**。

    纠偏对象：R51 首版曾把「拒绝 steer ⇒ 连带 thread 回滚」写成由 verdict 显式驱动的
    确证语义。strings 否证该过度断言：`thread_rollback_failed` 字面义是「回滚**失败**」
    （回滚这一独立过程失败了），且另有一串独立的 `thread_rolled_back`（回滚**已成功**）
    + `ThreadRolledBackEvent` 事件（距 `not_steerable` 7405 字节，不在同一错误码表）。
    即：拒绝 steer 产出 ``ACTIVE_TURN_NOT_STEERABLE``；``THREAD_ROLLBACK_FAILED`` 是
    「回滚过程本身失败」的独立错误码——**拒绝不等于触发回滚**，二者相邻仅因同族。

    未从二进制确证：拒绝 steer 后究竟是否（以及在何条件下）启动回滚流程——Ghidra
    headless 对 382MB PE 全量分析超时，交叉引用未取得，诚实留作未确证（§0 铁律 3：
    没判绝不写成判过）。
    """

    #: 当前 turn 不可被引导（steer 被拒的直接错误码）。
    ACTIVE_TURN_NOT_STEERABLE = "active_turn_not_steerable"
    #: thread 回滚过程本身失败（独立错误码，非 steer 拒绝的必然结果）。
    THREAD_ROLLBACK_FAILED = "thread_rollback_failed"


#: 成功回滚的事件名（与上表错误码不同域，独立登记防混）。
THREAD_ROLLED_BACK_EVENT: Final[str] = "thread_rolled_back"


#: 每类 non-steerable turn 被 steer 时的 wire 名（serde rename，逐字对照）。
_WIRE_NAMES: Final[dict[str, str]] = {
    "review": "non_steerable_review",
    "compact": "non_steerable_compact",
}


class TurnSteerabilityError(ValueError):
    """未登记的 turn 类型（封闭集判据点名）。"""


def ensure_turn_kind(turn_kind: str) -> str:
    """值域闭合判据：登记过的档位原样放行，未登记 ⇒ 抛 :class:`TurnSteerabilityError`。

    防未知 turn 类型静默放行（§0 铁律 3「没判绝不写成判过」）。对照侧 turn 类型封闭集
    即 ``NonSteerableTurnKind`` 二档——本判据只认这两档；其余 turn 类型（普通对话 turn）
    由调用方按「非本封闭集成员 ⇒ 可 steer」处理，不经此判据（见 :func:`is_steerable`）。
    """
    if not isinstance(turn_kind, str) or turn_kind not in _CLOSED_SET:
        raise TurnSteerabilityError(
            f"未登记的 turn 类型（NonSteerableTurnKind 封闭集之外）: {turn_kind!r}"
            f" —— 先在 app/core/turn_steerability.py 的 NonSteerableTurnKind 登记后再产出"
        )
    return turn_kind


def is_steerable(turn_kind: str) -> bool:
    """该 turn 类型是否可被用户中途引导（steer）。

    判据（唯一出口，纯函数）：命中 ``NonSteerableTurnKind``（review/compact）⇒ **不可
    steer**（返回 False）；其余（普通对话 turn 等）⇒ 可 steer（返回 True）。

    调用方约定：只有确知 turn 类型属于本封闭集时才传 ``review``/``compact``；普通对话
    turn 传任意非成员值（如 ``"chat"``）即判可 steer。传未登记的 ``review``/``compact``
    之外的**误拼**（如 ``"reviw"``）不经此函数——那是调用方笔误，本函数只对命中封闭集的
    两档判不可 steer，不猜笔误。
    """
    return not (isinstance(turn_kind, str) and turn_kind in _CLOSED_SET)


def validate_steer(turn_kind: str) -> dict[str, object]:
    """裁决一次 steer 请求对该 turn 是否放行（纯函数，表驱动）。

    返回 ``{"verdict": <SteerVerdict>, "error_code": <SteerErrorCode|None>,
    "wire_name": <str|None>}``：
    - 可 steer（非 review/compact）⇒ ``ACCEPT`` + 无错误码 + 无 wire 名；
    - 不可 steer（review/compact）⇒ ``REJECT_NOT_STEERABLE`` + 错误码
      ``ACTIVE_TURN_NOT_STEERABLE``（逐字）+ 对应 wire 名（逐字）。

    **R52 纠偏**：本函数**不**再返回「连带 thread 回滚」。strings 取证否证「拒绝 steer
    ⇒ 触发回滚」——``active_turn_not_steerable`` 与 ``thread_rollback_failed`` 在对照
    错误码表中只是相邻变体（偏移恒差 25 字节），后者字面义是「回滚**失败**」，且另有
    独立的 ``thread_rolled_back``（回滚成功）+ ``ThreadRolledBackEvent``。拒绝 steer
    不等于触发回滚，故本函数只报 steer 被拒这一个确证事实（错误码），
    **回滚是否发生、何时发生留未确证**（§0 铁律 3）。

    超越：对照把 steer 相关错误码混在 thread/turn 生命周期错误族里靠相邻位置隐式关联、
    无显式判据；本仓把「steer 被拒的错误码」与「回滚失败/成功的错误码」分域显式登记
    （见 :class:`SteerErrorCode` docstring），可 diff 可单测。
    """
    if isinstance(turn_kind, str) and turn_kind in _CLOSED_SET:
        return {
            "verdict": SteerVerdict.REJECT_NOT_STEERABLE.value,
            "error_code": SteerErrorCode.ACTIVE_TURN_NOT_STEERABLE.value,
            "wire_name": _WIRE_NAMES[turn_kind],
        }
    return {
        "verdict": SteerVerdict.ACCEPT.value,
        "error_code": None,
        "wire_name": None,
    }


def steer_error_codes() -> tuple[str, ...]:
    """steer 相关 thread/turn 生命周期错误码（逐字，供 diff 与单测）。

    只登记确证为 steer 生命周期错误族的成员（按对照码表相邻序：not_steerable 在前，
    rollback_failed 紧随）。**不含** ``thread_rolled_back``（回滚成功事件，不同域）。
    """
    return (
        SteerErrorCode.ACTIVE_TURN_NOT_STEERABLE.value,
        SteerErrorCode.THREAD_ROLLBACK_FAILED.value,
    )


def non_steerable_wire_names() -> tuple[str, ...]:
    """不可 steer turn 类型的 wire 名序（serde rename，逐字；供 diff 与单测）。"""
    return tuple(_WIRE_NAMES[k] for k in NON_STEERABLE_TURN_KIND_VALUES)
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
