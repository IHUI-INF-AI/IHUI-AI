# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""协同（collab）多智能体会话生命周期事件封闭集。

设计依据（2026-11-18，下潜 外部程序 codex.exe 26.1111.2228.0 主引擎，strings 定向抽取）。
对照物 wire serde 逐字锚（连续 token 拼接形态，五组 × begin/end，各 7 次连体命中）::

    CollabAgentSpawnBeginEvent / CollabAgentSpawnEndEvent
    CollabAgentInteractionBeginEvent / CollabAgentInteractionEndEvent
    CollabWaitingBeginEvent / CollabWaitingEndEvent
    CollabCloseBeginEvent / CollabCloseEndEvent
    CollabResumeBeginEvent / CollabResumeEndEvent

对应 wire 名（serde rename 逐字，EventMsg 大块连体 + 独立出现各 7 次）::

    collab_agent_spawn_begin collab_agent_spawn_end
    collab_agent_interaction_begin collab_agent_interaction_end
    collab_waiting_begin collab_waiting_end
    collab_close_begin collab_close_end
    collab_resume_begin collab_resume_end

**载荷字段（strings 确证部分，未确证不写）**::

    SpawnEnd    : new_thread_id new_agent_nickname new_agent_role handoff_id
    InteractionBegin : started_at_ms
    WaitingBegin: receiver_thread_ids receiver_agents transparent_background
    WaitingEnd  : agent_statuses statuses
    CloseEnd    : sender_thread_id receiver_thread_id receiver_agent_nickname
                  receiver_agent_role
    ResumeEnd   : review compact            （resume kind 二档）

WaitingBegin 另有 ``failure``/``input_images``/``generation_id`` 等散字段，属相邻
图像生成语境（同块出现），**非协同生命周期核心载荷**，本模块不纳入防语义错配。

**取证纠偏（防后人踩）**——goal-runtime R48 线索记的是「collab_agent 六事件」，实为
**十事件**：`CollabWaiting`（等待层）与 `CollabResume`（恢复层）两组在前轮 grep 漏记。
本封闭集补全为五组 × begin/end。

本仓真空白：``app/core/turn_metadata.py:297`` 只有 ``thread_spawn → "collab_spawn"``
一个 header 标签，``sse_contract`` 只有单层 ``subagent_spawn/progress/end``（无 begin/end
配对、无 waiting/close/resume 阶段）。全仓 grep ``collab_interaction|collab_waiting|
collab_close|collab_resume`` ai-service **零命中**。本模块补封闭集 + 阶段序判据。

一轴超越：对照把十类事件散在各 events/*.rs 的发射点（运行时遇到才产出），
「close/resume 是否必须有前置 spawn」靠跨文件调用序隐式保证、无显式判据。本仓提前为
纯函数：``event_wire_name()``（事件→wire 名，逐字）、``event_role()``（begin/end 角色）、
``validate_sequence()``（阶段序判据，close/resume 未 spawn 即违序）、``stage_order()``
（生命周期阶段可机检）。未登记事件抛错点名不静默放行（§0 铁律 3）。

与近邻域互不顶账（边界声明）：
- ``turn_metadata.subagent_header_value`` 答「子代理 header 取什么值」，本模块答
  「协同会话生命周期事件封闭集 + 阶段序」，互补；
- ``sse_contract`` 的 ``subagent_spawn/progress/end`` 是本仓单层子代理 SSE 契约，
  无 begin/end 配对、无 waiting/close/resume 阶段，与本域五组配对不同轴。
"""

from __future__ import annotations

from enum import StrEnum
from typing import Final

__all__ = [
    "CollabLifecycleEvent",
    "CollabEventRole",
    "CollabEventError",
    "ensure_collab_event",
    "event_wire_name",
    "event_role",
    "validate_sequence",
    "stage_order",
    "COLLAB_LIFECYCLE_EVENT_VALUES",
    "CODEX_COLLAB_EVENT_TOTAL",
]

#: 供守门静态解析的字面量总表（与 StrEnum 成员逐字一一对应；漂移由 pytest 钉死）。
COLLAB_LIFECYCLE_EVENT_VALUES: Final[tuple[str, ...]] = (
    "spawn_begin",
    "spawn_end",
    "interaction_begin",
    "interaction_end",
    "waiting_begin",
    "waiting_end",
    "close_begin",
    "close_end",
    "resume_begin",
    "resume_end",
)

#: 对照物 wire 事件总数（十事件 = 五组 × begin/end；本仓缺失计数基线）。
CODEX_COLLAB_EVENT_TOTAL: Final[int] = 10

_CLOSED_SET: Final[frozenset[str]] = frozenset(COLLAB_LIFECYCLE_EVENT_VALUES)


class CollabLifecycleEvent(StrEnum):
    """协同会话生命周期事件封闭集（五组 × begin/end，wire 逐字对照）。"""

    # ---- spawn：协同 agent 派生层 ----
    #: 协同 agent 派生开始。
    SPAWN_BEGIN = "spawn_begin"
    #: 协同 agent 派生结束（携 new_thread_id/new_agent_nickname/new_agent_role/handoff_id）。
    SPAWN_END = "spawn_end"
    # ---- interaction：交互层（真实对话轮） ----
    #: 交互开始（携 started_at_ms）。
    INTERACTION_BEGIN = "interaction_begin"
    #: 交互结束。
    INTERACTION_END = "interaction_end"
    # ---- waiting：等待层（等待协同 agent 回执） ----
    #: 等待开始（携 receiver_thread_ids/receiver_agents）。
    WAITING_BEGIN = "waiting_begin"
    #: 等待结束（携 agent_statuses/statuses）。
    WAITING_END = "waiting_end"
    # ---- close：关闭层 ----
    #: 关闭开始。
    CLOSE_BEGIN = "close_begin"
    #: 关闭结束（携 sender/receiver_thread_id + receiver_agent_nickname/role）。
    CLOSE_END = "close_end"
    # ---- resume：恢复层 ----
    #: 恢复开始。
    RESUME_BEGIN = "resume_begin"
    #: 恢复结束（resume kind：review/compact 二档）。
    RESUME_END = "resume_end"


class CollabEventRole(StrEnum):
    """事件在生命周期中的角色（begin 开阶段 / end 收阶段）。"""

    BEGIN = "begin"
    END = "end"


# 每事件的 wire 名（serde rename，逐字对照 codex EventMsg）。
_WIRE_NAMES: Final[dict[str, str]] = {
    "spawn_begin": "collab_agent_spawn_begin",
    "spawn_end": "collab_agent_spawn_end",
    "interaction_begin": "collab_agent_interaction_begin",
    "interaction_end": "collab_agent_interaction_end",
    "waiting_begin": "collab_waiting_begin",
    "waiting_end": "collab_waiting_end",
    "close_begin": "collab_close_begin",
    "close_end": "collab_close_end",
    "resume_begin": "collab_resume_begin",
    "resume_end": "collab_resume_end",
}

# 生命周期阶段序（阶段推进方向；begin 在前 end 在后）。
_STAGE_ORDER: Final[tuple[str, ...]] = (
    "spawn",
    "interaction",
    "waiting",
    "close",
    "resume",
)


class CollabEventError(ValueError):
    """未登记的协同生命周期事件（封闭集判据点名）。"""


def ensure_collab_event(value: str) -> str:
    """值域闭合判据：登记过的档位原样放行，未登记 ⇒ 抛 :class:`CollabEventError`。

    防未知事件静默放行（§0 铁律 3「没判绝不写成判过」）。
    """
    if not isinstance(value, str) or value not in _CLOSED_SET:
        raise CollabEventError(
            f"未登记的协同生命周期事件（CollabLifecycleEvent 封闭集之外）: {value!r}"
            f" —— 先在 app/core/collab_lifecycle_event.py 的 CollabLifecycleEvent 登记后再产出"
        )
    return value


def event_wire_name(event: str) -> str:
    """事件 → 对照物 wire 名（serde rename，逐字）。未登记 ⇒ 抛错。"""
    key = ensure_collab_event(event)
    return _WIRE_NAMES[key]


def event_role(event: str) -> CollabEventRole:
    """事件角色：begin 开阶段 / end 收阶段。未登记 ⇒ 抛错。"""
    key = ensure_collab_event(event)
    return CollabEventRole.END if key.endswith("_end") else CollabEventRole.BEGIN


def _stage_of(event: str) -> str:
    """事件所属阶段（spawn/interaction/waiting/close/resume）。调用方保证已登记。"""
    if event.startswith("spawn_"):
        return "spawn"
    if event.startswith("interaction_"):
        return "interaction"
    if event.startswith("waiting_"):
        return "waiting"
    if event.startswith("close_"):
        return "close"
    if event.startswith("resume_"):
        return "resume"
    raise CollabEventError(f"事件 {event!r} 无对应生命周期阶段")


def validate_sequence(events: list[str]) -> dict[str, object]:
    """校验一段协同事件序列的阶段序合法性（纯函数，一次报全部违规非 fail-fast）。

    判据（对照把「是否有前置 spawn」散在各发射点隐式保证，本仓显式化）：
    1. ``UNKNOWN_EVENT``：未登记事件（优先级最高，先点名再谈序）；
    2. ``NESTED_STAGE``：同阶段 begin 后又 begin（未 end 就重入）；
    3. ``ORPHAN_END``：end 出现时同阶段无未收的 begin；
    4. ``RESUME_WITHOUT_SPAWN``：resume 阶段从未有过前置 spawn（协同会话未建立即恢复）；
    5. ``OK``：无违规。

    返回 ``{"status": <档>, "violations": [{"index","event","kind","expected"}...]}``；
    ``status`` 取最高优先级命中档；``violations`` 列出每条违规的事件名/索引/档位/期望。
    """
    violations: list[dict[str, str]] = []
    open_stages: set[str] = set()
    ever_spawned = False

    for index, raw in enumerate(events):
        if not isinstance(raw, str) or raw not in _CLOSED_SET:
            violations.append(
                {
                    "index": str(index),
                    "event": str(raw),
                    "kind": "unknown",
                    "expected": "CollabLifecycleEvent 封闭集内的事件",
                }
            )
            continue
        event = CollabLifecycleEvent(raw)
        stage = _stage_of(event.value)
        role = event_role(event.value)

        if role is CollabEventRole.BEGIN:
            if stage in open_stages:
                violations.append(
                    {
                        "index": str(index),
                        "event": event.value,
                        "kind": "nested",
                        "expected": f"阶段 {stage} 仍开启（未 end），不可重入 begin",
                    }
                )
            else:
                open_stages.add(stage)
        else:  # END
            if stage not in open_stages:
                violations.append(
                    {
                        "index": str(index),
                        "event": event.value,
                        "kind": "orphan",
                        "expected": f"阶段 {stage} 无未收的 begin，end 孤儿",
                    }
                )
            else:
                open_stages.discard(stage)

        if stage == "spawn" and role is CollabEventRole.END:
            ever_spawned = True
        if stage == "resume" and role is CollabEventRole.BEGIN and not ever_spawned:
            violations.append(
                {
                    "index": str(index),
                    "event": event.value,
                    "kind": "resume_no_spawn",
                    "expected": "resume 前必须有过 spawn（协同会话未建立即恢复）",
                }
            )

    if violations:
        kinds = {v["kind"] for v in violations}
        if "unknown" in kinds:
            status = "UNKNOWN_EVENT"
        elif "nested" in kinds:
            status = "NESTED_STAGE"
        elif "orphan" in kinds:
            status = "ORPHAN_END"
        else:
            status = "RESUME_WITHOUT_SPAWN"
        return {"status": status, "violations": violations}
    return {"status": "OK", "violations": []}


def stage_order() -> tuple[str, ...]:
    """协同会话生命周期阶段序（可机检，供 diff 与单测）。"""
    return _STAGE_ORDER
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
