# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠


"""SSE 帧投递档位与 ack 背压 —— 遵循统一工程规范。

## 设计依据（2026-11-15，Round 10）

对照物：`Codex` 桌面端 `app.asar`（`openai-codex-electron` 26.1106.51428）
主进程 chunk `.vite/build/early-bootstrap-620-*.js`（观察）：

```js
class ChunkedMessageSender {
  send(wc, channel, payload)         { ... this.sender.send(...); }          // 普通
  sendInline(wc, channel, payload)   { ... this.sender.sendInline(...); }    // 内联（不排队）
  sendCritical(wc, channel, payload) { ... this.sender.sendCritical(...); }  // 关键（必达）
  acknowledge(wc, id, ok)            { ... this.sender.acknowledge(...); }   // 接收侧回执
}
// 构造参数：retryDelayMs: 1000、isAvailable（销毁守）、isLoading（加载态守）
```

对侧要点：
1. **三档投递**：普通 / 内联 / 关键；
2. **加载态守**：`isLoading()` 为真时不投递（避免丢帧）；
3. **销毁守**：入口先判 `isDestroyed()`；
4. **ack 回执**：接收侧显式确认，发端据此判「已送达」而非「已写出」。

## 本仓落点：为什么在 Python 侧

本仓 SSE 主链是 `ai-service`（Python）→ `apps/api`（网关）→ 前端。帧水位
（`sse_frames.py` 的 `seq` / `watermark`，以及 `api-client/src/frame-watermark.ts`
的 gap 三条件）已经解决了**「有没有漏」**；本模块补的是**「该不该现在写」与
「写出去算不算送达」**——这两件事目前全链路都没有。

## 本仓超越轴

- **轴一 · 档位语义可判定**：对侧三档是三个方法名，档位差异只体现在底层 sender 的
  内部行为。本仓把档位做成**显式策略对象** `DeliveryTier`（缓冲区上限、是否允许丢、
  是否要求 ack），因此「这一帧能不能丢」是可以被断言的事实，而不是命名约定。
- **轴二 · 背压可量化**：`DeliveryQueue.enqueue()` 返回 `EnqueueOutcome`，明确是
  `ACCEPTED` / `DEFERRED`（缓冲区满，暂不写）/ `REJECTED`（该档不允许暂存 ⇒ 必须失败）。
  对侧只有「写或不写」，调用方无法区分「等会儿」与「失败」。
- **轴三 · ack 超时可判未判定**：`pending_acks()` 交回「已写出但未确认」的帧 id 集，
  由调用方决定重发或判未判定 —— 与仓规 §0.3 同源：没确认不等于已送达，
  也不等于已丢，绝不把两者混成一个布尔。

## 显式不做

- 不做分块（chunking）：对侧 `ChunkedSender` 解决的是 Electron IPC 单消息大小上限，
  SSE 无此限制，照搬会引入无谓复杂度。
- 不接管重连：断线重连靠 `Last-Event-ID` + 帧水位 gap 判定，已在既有链路
  （`packages/api-client/src/frame-watermark.ts` 的 `isFrameGap`）实现，本模块不重写。
- 不做实际 IO：`DeliveryQueue` 只判「该不该投」，写入由调用方的 emitter 执行。
"""
from __future__ import annotations

from collections.abc import Callable
from dataclasses import dataclass, field
from enum import StrEnum
from typing import Final


class DeliveryTier(StrEnum):
    """投递档位（对侧三方法的语义化）。"""

    # 普通：允许在缓冲区满时暂缓，甚至按策略丢弃（进度类帧）
    NORMAL = "normal"
    # 内联：不排队，立即写；但可靠性与普通档同级（控制类帧）
    INLINE = "inline"
    # 关键：不允许丢，必须 ack（终态 / 错误 / 权限变更类帧）
    CRITICAL = "critical"


@dataclass(frozen=True)
class TierPolicy:
    """一个档位的策略（本仓超越轴一：档位差异是数据，不是方法名）。"""

    tier: DeliveryTier
    max_buffered: int
    droppable: bool
    requires_ack: bool
    description: str


# 三档策略表（单一真相源）
TIER_POLICIES: Final[dict[DeliveryTier, TierPolicy]] = {
    DeliveryTier.NORMAL: TierPolicy(
        tier=DeliveryTier.NORMAL,
        max_buffered=256,
        droppable=True,
        requires_ack=False,
        description="进度/增量帧：可暂存、可丢、无需确认",
    ),
    DeliveryTier.INLINE: TierPolicy(
        tier=DeliveryTier.INLINE,
        max_buffered=0,          # 不排队
        droppable=False,
        requires_ack=False,
        description="控制帧：立即写、不暂存；失败即失败（不静默）",
    ),
    DeliveryTier.CRITICAL: TierPolicy(
        tier=DeliveryTier.CRITICAL,
        max_buffered=64,
        droppable=False,
        requires_ack=True,
        description="终态/错误/权限帧：必达、必须 ack",
    ),
}


class EnqueueOutcome(StrEnum):
    """入队结论（本仓超越轴二：区分「等会儿」与「失败」）。"""

    ACCEPTED = "accepted"
    # 缓冲区满但该档允许暂缓/丢弃 ⇒ 未入队也不算错，调用方不应重试
    DROPPED = "dropped"
    # 缓冲区满且该档不允许暂缓 ⇒ 必须失败（INLINE/CRITICAL）
    REJECTED = "rejected"


@dataclass(frozen=True)
class DeliveryFrame:
    """一帧待投递内容。`seq` 与既有帧水位同源（来自 sse_frames 的 seq）。"""

    frame_id: str
    seq: int
    event: str
    tier: DeliveryTier
    payload: object = None


@dataclass
class DeliveryQueue:
    """按档位判「该不该现在投」的纯逻辑队列（不做 IO）。

    Args:
        flush: 实际写入回调；返回 True 表示「已写出」（不等于已送达）。
                仅当档位要求 ack 时，写出后仍须 `acknowledge()` 才算送达。
    """

    flush: Callable[[DeliveryFrame], bool]
    _buffered: list[DeliveryFrame] = field(default_factory=list)
    _pending_ack: dict[str, DeliveryFrame] = field(default_factory=dict)
    _stats: dict[str, int] = field(default_factory=dict)

    # ---------- 入队 ----------

    def enqueue(self, frame: DeliveryFrame) -> EnqueueOutcome:
        """按档位判定是否投递。返回结论，绝不把丢弃当成功。"""
        policy = TIER_POLICIES[frame.tier]
        self._bump(f"enqueue.{frame.tier.value}")

        if policy.max_buffered == 0:
            # INLINE：不排队，直接写
            ok = self.flush(frame)
            if not ok:
                self._bump("flush_failed")
                return EnqueueOutcome.REJECTED
            if policy.requires_ack:
                self._pending_ack[frame.frame_id] = frame
            return EnqueueOutcome.ACCEPTED

        if len(self._buffered) >= policy.max_buffered:
            if policy.droppable:
                self._bump("dropped.buffer_full")
                return EnqueueOutcome.DROPPED
            # 不可丢档位缓冲满 ⇒ 必须失败，不静默降级
            self._bump("rejected.buffer_full")
            return EnqueueOutcome.REJECTED

        ok = self.flush(frame)
        if not ok:
            self._bump("flush_failed")
            return EnqueueOutcome.REJECTED
        if policy.requires_ack:
            self._pending_ack[frame.frame_id] = frame
        self._buffered.append(frame)
        return EnqueueOutcome.ACCEPTED

    # ---------- ack ----------

    def acknowledge(self, frame_id: str, ok: bool = True) -> bool:
        """接收侧回执。返回该 id 是否本来就在待确认集里。

        对侧 `acknowledge(wc, id, ok)` 同义；本仓额外把 `ok=False` 单独计数，
        因为「确认失败」与「确认成功」在排障时是完全不同的信号。
        """
        existed = self._pending_ack.pop(frame_id, None) is not None
        if existed:
            self._bump("ack.ok" if ok else "ack.failed")
            if not ok:
                self._bump("ack.negative")
        return existed

    def pending_acks(self) -> tuple[str, ...]:
        """已写出但未确认的帧 id（本仓超越轴三：可判未判定）。"""
        return tuple(self._pending_ack.keys())

    def has_unacked_critical(self) -> bool:
        return any(
            TIER_POLICIES[f.tier].requires_ack for f in self._pending_ack.values()
        )

    # ---------- 观测 ----------

    def stats(self) -> dict[str, int]:
        """计数器快照（副本，防外部改写）。"""
        return dict(self._stats)

    def buffered_count(self) -> int:
        return len(self._buffered)

    def _bump(self, key: str) -> None:
        self._stats[key] = self._stats.get(key, 0) + 1


def tier_for_event(event: str) -> DeliveryTier:
    """把既有 SSE 事件名映射到投递档位（单一真相源）。

    映射依据是 `app/core/sse_contract.py` 的 39 个已登记事件（按行为规格，不猜）：

    - **CRITICAL**（终态/安全/需人答，丢了流程卡死或前端永远转圈）：
      `done` / `partial_done` / `error` / `plan_updated` / `goal_updated` /
      `admission` / `question` / `form_request` / `review-finding` /
      `tool-approval` / `budget` / `hook-failed`
    - **INLINE**（控制类，须与相邻增量严格对齐，不暂存）：
      `tool-call-start` / `tool-result` / `tool-summary` / `tool-delegate` /
      `subagent_spawn` / `subagent_end` / `terminal_start` / `terminal_end` /
      `terminal_interaction` / `start` / `steer`
    - **NORMAL**（高频增量/进度，可暂存可按策略丢）：
      `chunk` / `reasoning` / `thinking` / `citations` / `compaction` /
      `subagent_progress` / `plan-step` / `tool-delta` / `tool-call-args-delta` /
      `terminal_delta` / `usage` / `retry_scheduled` / `fallback` /
      `injection_applied` / `question-resolved`
    - **未登记事件 ⇒ CRITICAL**（fail-closed：宁可多要一次 ack，
      不把不认识的终态帧当进度丢掉）
    """
    if event in _CRITICAL_EVENTS:
        return DeliveryTier.CRITICAL
    if event in _INLINE_EVENTS:
        return DeliveryTier.INLINE
    if event in _NORMAL_EVENTS:
        return DeliveryTier.NORMAL
    return DeliveryTier.CRITICAL


# 事件分档表（与 sse_contract.py 的 39 个已登记事件按行为规格；新增事件须在此登记）
_CRITICAL_EVENTS: Final[frozenset[str]] = frozenset(
    {
        "done",
        "partial_done",
        "error",
        "plan_updated",
        "goal_updated",
        "admission",
        "question",
        "form_request",
        "review-finding",
        "tool-approval",
        "budget",
        "hook-failed",
    }
)

_INLINE_EVENTS: Final[frozenset[str]] = frozenset(
    {
        "tool-call-start",
        "tool-result",
        "tool-summary",
        "tool-delegate",
        "subagent_spawn",
        "subagent_end",
        "terminal_start",
        "terminal_end",
        "terminal_interaction",
        "start",
        "steer",
    }
)

_NORMAL_EVENTS: Final[frozenset[str]] = frozenset(
    {
        "chunk",
        "reasoning",
        "thinking",
        "citations",
        "compaction",
        "subagent_progress",
        "plan-step",
        "tool-delta",
        "tool-call-args-delta",
        "terminal_delta",
        "usage",
        "retry_scheduled",
        "fallback",
        "injection_applied",
        "question-resolved",
    }
)


__all__ = [
    "DeliveryFrame",
    "DeliveryQueue",
    "DeliveryTier",
    "EnqueueOutcome",
    "TIER_POLICIES",
    "TierPolicy",
    "tier_for_event",
]
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
