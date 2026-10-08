# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""G-815974:per-thread 单调 branch_generation 栅栏(ai-service 侧)。

对齐 cli 半边已落地的 `apps/cli/src/commands/branch-generation.ts`(G-632)契约:
bump(分支装配出口)/ capture(任务入队盖章)/ isCurrent(落地前复校)/
recordSuperseded(作废留痕,不许静默丢)。上游参照
`core/src/runtime/methods/runtime-command-generation.ts:17-29`:rewind 与后台
completion 存在竞态 —— 命令即使已入队,也必须在持久化与 provider 注入前再次
校验 generation,旧分支结果只留诊断日志。

落点分工:
- bump:`routers/checkpoint_rewind.py::restore_checkpoint`(reason=checkpoint-restore)
  与 `services/session_store.py::SessionStore.fork`(reason=fork,盖**来源**线程;
  fork 出的新线程 key 独立,自己的任务不被父分支 generation 误杀);
- capture:`services/background_tasks.py` 提交/续跑时按 task.session_id 盖章;
- 复校:`services/background_tasks.py::_notify` 通知寄出前(查注册表**当前值**,
  不信任务自带的那一份)。栅栏 key 与后台任务的 session_id 同命名空间。

本模块零依赖(纯内存 + 纯函数),保证无外部解析面(与 G-632 同律)。
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import UTC, datetime
from typing import Any, Final

EVENT_LOG_LIMIT: Final[int] = 100


@dataclass(frozen=True)
class BranchGenerationEvent:
    """单条代数事件(bump 与 superseded 共用一表;形状对齐 G-632)。"""

    seq: int
    kind: str  # 'bump' | 'superseded'
    generation: int  # bump 后的新代数 / 作废判定时的当前代数
    thread_id: str  # bump/复校的栅栏 key(线程或 agent 会话 id)
    reason: str | None = None  # bump:装配出口名;superseded:缺省 'branch-switched'
    stale_generation: int | None = None  # superseded 专用:结果携带的陈旧代数
    detail: dict[str, Any] | None = None  # superseded 专用:taskId 等对账信息
    at: str = ""


@dataclass(frozen=True)
class BranchGenerationStats:
    """只读快照(供观测口与测试断言;字段名对齐 G-632 BranchGenerationStats)。"""

    bumps: int
    captures: int
    superseded: int


# per-thread 计数器与事件流水(进程内存态;key 不存在视为代数 0)
_generations: dict[str, int] = {}
_events: list[BranchGenerationEvent] = []
_bumps = 0
_captures = 0
_superseded = 0
_seq = 0


def _push_event(event: BranchGenerationEvent) -> None:
    _events.append(event)
    if len(_events) > EVENT_LOG_LIMIT:
        del _events[: len(_events) - EVENT_LOG_LIMIT]


def current_branch_generation(thread_id: str) -> int:
    """某线程当下代数(只读;未登记过视为 0)。"""
    return _generations.get(thread_id, 0)


def bump_branch_generation(thread_id: str, reason: str) -> int:
    """分支装配出口专用:一次恢复/fork 成功 ⇒ 该线程代数 +1(返回新代数)。"""
    global _bumps, _seq
    _bumps += 1
    _seq += 1
    _generations[thread_id] = _generations.get(thread_id, 0) + 1
    event = BranchGenerationEvent(
        seq=_seq,
        kind="bump",
        generation=_generations[thread_id],
        thread_id=thread_id,
        reason=reason,
        at=datetime.now(UTC).isoformat(),
    )
    _push_event(event)
    return event.generation


def capture_branch_generation(thread_id: str) -> int:
    """任务入队盖章:返回当下代数,作为结果携带的代际令牌。"""
    global _captures, _seq
    _captures += 1
    _seq += 1
    generation = _generations.get(thread_id, 0)
    _push_event(
        BranchGenerationEvent(
            seq=_seq,
            kind="capture",
            generation=generation,
            thread_id=thread_id,
            reason="task-submit",
            at=datetime.now(UTC).isoformat(),
        )
    )
    return generation


def is_branch_generation_current(thread_id: str, token: int) -> bool:
    """落地前复校:结果携带的代数仍等于该线程当下代数 ⇒ 可落地。

    上游纪律:消费点查注册表**当前值**,不信结果自带的那一份 —— 本函数即
    "查当前值"的唯一出口,token 只是结果携带的令牌。
    """
    return token == _generations.get(thread_id, 0)


def record_superseded_branch_result(
    thread_id: str,
    stale_token: int,
    detail: dict[str, Any] | None = None,
) -> str:
    """结果代数过期 ⇒ 记一次作废(计数 + 事件流水),返回人读日志行。

    调用方必须把该行打出去(可观测红线:不许静默丢),同时**不得**把该结果
    写进会话/通知 —— 作废的语义是"整轮丢弃",不是"换个地方存"。
    """
    global _superseded, _seq
    _superseded += 1
    _seq += 1
    generation = _generations.get(thread_id, 0)
    event = BranchGenerationEvent(
        seq=_seq,
        kind="superseded",
        generation=generation,
        thread_id=thread_id,
        reason="branch-switched",
        stale_generation=stale_token,
        detail=detail,
        at=datetime.now(UTC).isoformat(),
    )
    _push_event(event)
    detail_tail = f" detail={detail}" if detail else ""
    return (
        f"[branch-generation] 线程 {thread_id} 的在飞结果已作废"
        f"(代际 {stale_token} ≠ 当前 {generation},分支在任务在飞期间被恢复/fork);"
        f"不寄通知、不写会话{detail_tail}"
    )


def branch_generation_stats() -> BranchGenerationStats:
    """只读快照(观测口与测试断言)。"""
    return BranchGenerationStats(bumps=_bumps, captures=_captures, superseded=_superseded)


def recent_branch_generation_events() -> list[BranchGenerationEvent]:
    """最近的事件流水(有界,新的在后)。"""
    return list(_events)


def __reset_branch_generation_for_test() -> None:
    """测试专用:进程级计数器、per-thread 代数与流水整体归零。"""
    global _bumps, _captures, _superseded, _seq
    _generations.clear()
    _events.clear()
    _bumps = 0
    _captures = 0
    _superseded = 0
    _seq = 0
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
