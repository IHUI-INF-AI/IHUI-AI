# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠


"""子代理级联中断 —— 遵循统一工程规范。

## 设计依据（2026-11-15，Round 10）

对照物：`Codex` 桌面端 `app.asar`（`openai-codex-electron` 26.1106.51428）
主进程 chunk `.vite/build/early-bootstrap-620-*.js`。对侧实现要点（观察）：

```js
async interruptConversation(convId, reason = "system", expected) {
  this.streamRecovery.cancelTurnContinuation(convId, expected);
  let result = null;
  try {
    result = await this.interruptConversationSelf(convId, reason, expected);
  } finally {
    if ((expected == null || result != null) && reason !== "descendant-cleanup"
        && this.getStreamRole(convId)?.role !== "follower") {
      if (reason === "user-stop") this.interruptSubagentDescendantsInBackground(convId);
      else await this.interruptSubagentDescendants(convId);
    }
  }
}
```

子代理级联本体（观察，`interruptSubagentDescendants`）：
1. 取「已知道」的后代快照 `getDescendantSnapshot().descendantThreads`；
2. 对每个「可能还活跃」的后代调用 `interruptConversationSelf`，成功的收进 `interrupted` 集合；
3. **重新发现**后代快照 `discoverDescendantSnapshot()`（第二步期间父级可能又派生了新的）；
4. 对「新出现的、仍活跃的、尚未中断的」再中断一轮。

`reason` 值域（观察）：`user-stop` / `system` / `user` / `descendant-cleanup` /
`shutdown` / `timeout`。

## 三个例外各有明确理由（观察 → 推断）

| 条件 | 行为 | 理由（推断） |
|---|---|---|
| `reason === "descendant-cleanup"` | **不**级联 | 本级已是被级联调用的子代理；再级联会递归风暴 |
| `role === "follower"` | **不**级联 | follower 是旁路观察者，不拥有子代理 |
| `reason === "user-stop"` | 后台（fire-and-forget） | 用户点了停止要立刻看到反馈，收尾可异步 |

## 本仓超越轴

- **轴一 · 可注入的发现器**：对侧把「发现后代」写死在 manager 上。本仓把
  `list_descendants` / `interrupt_one` 做成注入的回调，因此可用**纯内存假实现**
  钉住两阶段行为（对侧只能靠集成测试碰运气）。
- **轴二 · 阶段可观测**：返回 `CascadeReport`，逐阶段记录「发现几个 / 试图中断几个 /
  实际中断几个 / 二次补中断几个 / 哪些失败及原因」。对侧只在 logger.warning 里
  留一句，失败集合不可查询。
- **轴三 · 收敛上限**：对侧只有固定两轮（已知 + 重发现）。本仓显式给
  `max_rounds`（默认 2，与对侧等价），并在达到上限仍未收敛时判
  `converged=False`，而不是假装已经干净。这堵住「派生生派生的长链在第二轮后才出现」
  被误报为已清空。

## 显式不做

- 不做实际的进程/线程终止：本仓 `AgentLoop.cancel()` / `BackgroundTasks.cancel()`
  已是既有实现（§0.6 单一真相源），本模块只负责**级联编排**。
- 不接管 `reason` 的语义解释：`reason` 只用作「是否应级联」的判据，其余影响由调用方
  决定（与对侧一致）。
"""
from __future__ import annotations

from collections.abc import Awaitable, Callable, Sequence
from dataclasses import dataclass, field
from enum import StrEnum
from typing import Final

# 中断原因值域（与对侧按行为规格）
INTERRUPT_REASONS: Final[tuple[str, ...]] = (
    "user-stop",
    "system",
    "user",
    "descendant-cleanup",
    "shutdown",
    "timeout",
)

# 不触发级联的原因
NON_CASCADING_REASONS: Final[frozenset[str]] = frozenset({"descendant-cleanup"})


class CascadeSkip(StrEnum):
    """未尝试级联的原因（可解释性用）。"""

    NON_CASCADING_REASON = "non_cascading_reason"
    FOLLOWER_ROLE = "follower_role"
    NO_DESCENDANTS = "no_descendants"
    ROUND_LIMIT_REACHED = "round_limit_reached"


@dataclass(frozen=True)
class DescendantInfo:
    """一个后代代理的最小描述。`active` 由调用方判定（本模块不猜活跃态）。"""

    id: str
    active: bool = True


@dataclass(frozen=True)
class CascadeAttempt:
    """单次中断尝试的留痕。"""

    descendant_id: str
    round_index: int
    succeeded: bool
    error: str | None = None

    def to_explanation(self) -> str:
        state = "已中断" if self.succeeded else f"失败({self.error or '未知'})"
        return f"round{self.round_index} descendant={self.descendant_id} {state}"


@dataclass(frozen=True)
class CascadeReport:
    """级联中断的完整结论（本仓超越轴二）。"""

    attempted: bool
    skip_reason: CascadeSkip | None
    rounds_run: int
    discovered_total: int
    interrupted: tuple[str, ...]
    attempts: tuple[CascadeAttempt, ...]
    converged: bool
    notes: tuple[str, ...] = field(default=())

    def explain(self) -> str:
        lines = [
            f"attempted={self.attempted} rounds={self.rounds_run} "
            f"discovered={self.discovered_total} interrupted={len(self.interrupted)} "
            f"converged={self.converged}"
        ]
        if self.skip_reason is not None:
            lines.append(f"skip_reason={self.skip_reason}")
        lines.extend(self.notes)
        lines.extend(a.to_explanation() for a in self.attempts)
        return "\n".join(lines)


# 注入回调类型
ListDescendants = Callable[[], Awaitable[Sequence[DescendantInfo]]]
InterruptOne = Callable[[str], Awaitable[bool]]


async def cascade_interrupt_descendants(
    *,
    reason: str,
    role: str = "owner",
    list_descendants: ListDescendants,
    interrupt_one: InterruptOne,
    max_rounds: int = 2,
) -> CascadeReport:
    """按 Codex 的两阶段配方级联中断后代代理。

    Args:
        reason: 中断原因，须在 `INTERRUPT_REASONS` 内。
        role: 本代理角色；`follower` 不级联（对侧同）。
        list_descendants: 发现后代；每轮调用一次（第二轮即「重新发现」语义）。
        interrupt_one: 中断单个后代；返回 True 表示确实中断成功。
        max_rounds: 轮数上限，默认 2（= 对侧「已知 + 重发现」）。

    Returns:
        CascadeReport。**未尝试级联时 `attempted=False` 且 skip_reason 点名原因**，
        绝不把「没跑」写成「已清空」。
    """
    # ---- 0. 输入校验：认不出的 reason 不猜（§0.3）----
    if reason not in INTERRUPT_REASONS:
        return CascadeReport(
            attempted=False,
            skip_reason=None,
            rounds_run=0,
            discovered_total=0,
            interrupted=(),
            attempts=(),
            converged=False,
            notes=(
                f"reason={reason!r} 不在值域 {INTERRUPT_REASONS} 内 ⇒ 未判定，未尝试级联",
            ),
        )

    # ---- 1. 两个不级联的例外 ----
    if reason in NON_CASCADING_REASONS:
        return CascadeReport(
            attempted=False,
            skip_reason=CascadeSkip.NON_CASCADING_REASON,
            rounds_run=0,
            discovered_total=0,
            interrupted=(),
            attempts=(),
            # 不级联 ≠ 未收敛：本级由上级负责，这里的「干净」是平凡成立
            converged=True,
            notes=(
                "reason=descendant-cleanup：本级已是被级联的子代理，"
                "再级联会递归风暴（对侧同）",
            ),
        )
    if role == "follower":
        return CascadeReport(
            attempted=False,
            skip_reason=CascadeSkip.FOLLOWER_ROLE,
            rounds_run=0,
            discovered_total=0,
            interrupted=(),
            attempts=(),
            converged=True,
            notes=("role=follower：旁路观察者不拥有子代理（对侧同）",),
        )

    # ---- 2. 两阶段循环 ----
    interrupted: list[str] = []
    # 两个集合语义必须分开（否则「试过」会被读成「已清」）：
    #   handled_set   —— 本轮已处理过的目标，下一轮不再重复尝试（防预算耗尽）
    #   confirmed_set —— 确认中断成功的 id，只有它才能用于「终态是否干净」的判定
    # 把失败者塞进 confirmed_set 会让终态复查把仍活跃的后代误判为已清
    # （= 假绿），把成功者排除在 handled_set 外会让它被重复中断（= 重复 RPC）。
    handled_set: set[str] = set()
    confirmed_set: set[str] = set()
    attempts: list[CascadeAttempt] = []
    discovered_total = 0
    rounds_run = 0
    notes: list[str] = []

    for round_index in range(max(1, max_rounds)):
        try:
            snapshot = await list_descendants()
        except Exception as exc:  # 发现失败：立即停止，判未收敛，不猜
            notes.append(
                f"round{round_index} 发现后代失败，停止级联: {type(exc).__name__}: {exc}"
            )
            return CascadeReport(
                attempted=True,
                skip_reason=None,
                rounds_run=rounds_run,
                discovered_total=discovered_total,
                interrupted=tuple(interrupted),
                attempts=tuple(attempts),
                converged=False,
                notes=tuple(notes),
            )

        rounds_run += 1
        discovered_total += len(snapshot)
        targets = [
            d for d in snapshot if d.active and d.id not in handled_set
        ]
        if not targets:
            notes.append(f"round{round_index} 无待中断后代")
            break

        for d in targets:
            try:
                ok = await interrupt_one(d.id)
            except Exception as exc:
                # 抛错的后代也计入「已处理」：第二轮不再重复尝试同一目标。
                # 否则一个持续抛错的后代会在每轮被重试，把轮数预算耗尽在同一个
                # 目标上，反而漏掉第二轮该补抓的新派生后代。
                attempts.append(
                    CascadeAttempt(
                        descendant_id=d.id,
                        round_index=round_index,
                        succeeded=False,
                        error=f"{type(exc).__name__}: {exc}",
                    )
                )
                handled_set.add(d.id)
                continue
            attempts.append(
                CascadeAttempt(
                    descendant_id=d.id, round_index=round_index, succeeded=bool(ok)
                )
            )
            # 无论成功与否都记入 handled（不占下一轮预算）；
            # 但只有成功者进 confirmed（终态判干净的唯一依据）。
            handled_set.add(d.id)
            if ok:
                interrupted.append(d.id)
                confirmed_set.add(d.id)

    # ---- 3. 收敛判定：最后一轮是否还有「未中断的活跃后代」----
    converged = True
    try:
        final_snapshot = await list_descendants()
        leftover = [
            d.id for d in final_snapshot if d.active and d.id not in confirmed_set
        ]
        if leftover:
            converged = False
            notes.append(
                f"终态仍有 {len(leftover)} 个活跃后代未中断"
                f"（max_rounds={max_rounds} 已达上限）: {sorted(leftover)}"
            )
            if rounds_run >= max_rounds:
                notes.append(CascadeSkip.ROUND_LIMIT_REACHED.value)
    except Exception as exc:
        converged = False
        notes.append(
            f"终态复查失败，判未收敛（不猜）: {type(exc).__name__}: {exc}"
        )

    return CascadeReport(
        attempted=True,
        skip_reason=None,
        rounds_run=rounds_run,
        discovered_total=discovered_total,
        interrupted=tuple(interrupted),
        attempts=tuple(attempts),
        converged=converged,
        notes=tuple(notes),
    )


__all__ = [
    "CascadeAttempt",
    "CascadeReport",
    "CascadeSkip",
    "DescendantInfo",
    "INTERRUPT_REASONS",
    "NON_CASCADING_REASONS",
    "cascade_interrupt_descendants",
]
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
