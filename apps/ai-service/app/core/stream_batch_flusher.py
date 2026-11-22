# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""流式增量累积 + 定时批量 flush —— 统一实现 26.1111 分块缓冲范式。

来源：Codex Desktop 26.1111.2228.0，`app/resources/app.asar` 主包
`early-bootstrap-331-*.js` 的缓冲类 `xO`（观察取证，2026-11-15）。对侧原文语义：

```js
xM = 1e3 / 60                                    // ≈16.67ms，贴 60fps 帧节
class xO {
  buffers = new Map                              // key → 累积 delta
  enqueue(e) {
    let r = cap(prevDelta + e.delta, options.maxBufferedChars)  // 字符上限累积
    buffers.set(key, { ...e, delta: r })
    if (cancelScheduledFlush == null)
      cancelScheduledFlush = schedule(flushNow, options.flushIntervalMs)  // 定时触发
  }
  flushNow() {
    let frames = Array.from(buffers.values()); buffers.clear();
    onFlush(frames)                              // 一次性吐本批全部 delta
  }
  flushIfHidden = () => { canUseAnimationFrame() || flushNow() }  // 页面隐藏即强制 flush
}
```

对侧要点：
1. **按 key 累积**：同一 conversation/message 的 token 增量并成一条，避免每 token 一次写；
2. **双触发 flush**：字符数到 `maxBufferedChars` **或** 到 `flushIntervalMs` 定时点，先到先触发；
3. **批量吐帧**：一次 flush 吐出本批全部累积帧，调用方按批渲染；
4. **页面隐藏强制 flush**：隐藏时不能靠渲染帧驱动，必须立刻 flush 不丢增量。

## 本仓为何要这套（sse_delivery.py 为何不够）

`sse_delivery.py` 解决的是"该不该现在写 + 写出算不算送达"（三档投递 + ack 背压），
但它**不合并增量**：每来一个 token 就是一帧。Codex 这套解决的是"攒一批再写"，是
**写频率的节流**，与本仓三档投递正交 —— 本模块补这一维。

## 本仓超越轴

- **轴一 · 触发条件可判定**：对侧 flush 触发散在 schedule 回调与 enqueue 里；本仓把
  "该不该 flush"做成纯函数 `should_flush()`，返回结构化原因（上限到 / 定时到 / 强制），
  「为什么这一刻 flush」可断言。
- **轴二 · 节奏与时钟解耦**：不依赖真实 timer，flush 时机由调用方喂 `now_ms` 推进，
  纯逻辑可测（不睡真实时间）。
- **轴三 · 显式不做**：不做真实 IO / 不做 ack（ack 在 sse_delivery）/ 不做重连。

纯逻辑层：只累积 + 判定 + 出批，**不做任何实际写入**。定时由调用方喂时钟推进。
"""

from __future__ import annotations

import time
from collections.abc import Callable
from dataclasses import dataclass, field
from enum import StrEnum
from typing import Any, Final

# 对侧 xM = 1e3/60：贴 60fps 的默认 flush 间隔（ms）
DEFAULT_FLUSH_INTERVAL_MS: Final[int] = 1000 // 60
# 默认字符累积上限：到这个量不等定时也立刻 flush（防单批过大）
DEFAULT_MAX_BUFFERED_CHARS: Final[int] = 4096


class FlushReason(StrEnum):
    """一次 flush 的触发原因（本仓超越轴一：为什么 flush 可判定）。"""

    # 累积字符数到上限
    CHAR_LIMIT = "char-limit"
    # 到达定时点（距上次 flush ≥ flush_interval_ms）
    INTERVAL = "interval"
    # 页面隐藏等强制场景
    FORCED = "forced"
    # 调用方显式要求（如终态帧前的收尾）
    EXPLICIT = "explicit"


@dataclass
class BufferedDelta:
    """一个累积槽：同一 key 的增量并成一条。"""

    key: str
    delta: str = ""
    # 首个增量的附加元数据（如 conversation_id / message_id），flush 时随批带出
    meta: dict[str, Any] = field(default_factory=dict)

    def char_count(self) -> int:
        return len(self.delta)


@dataclass
class FlushBatch:
    """一次 flush 吐出的整批。"""

    reason: FlushReason
    frames: list[BufferedDelta]
    total_chars: int

    def __len__(self) -> int:
        return len(self.frames)


@dataclass
class StreamBatchFlusher:
    """流式增量累积器 —— 对侧 `xO` 的纯逻辑复现。

    用法（调用方驱动时钟，不依赖真实 timer）：
        fl = StreamBatchFlusher(max_buffered_chars=4096, flush_interval_ms=16)
        fl.enqueue("msg-1", "Hel")            # 累积，通常不 flush
        fl.enqueue("msg-1", "lo")
        if fl.should_flush(now_ms=20).is_flush:     # 调用方每帧问一次
            batch = fl.flush(reason=...)
            emit(batch)                       # 调用方实际写出
        # 页面隐藏时：
        batch = fl.flush(reason=FlushReason.FORCED)
    """

    max_buffered_chars: int = DEFAULT_MAX_BUFFERED_CHARS
    flush_interval_ms: int = DEFAULT_FLUSH_INTERVAL_MS
    _buffers: dict[str, BufferedDelta] = field(default_factory=dict)
    # 上次 flush 的时钟戳；None = 尚未 flush 过（首个 enqueue 起算定时）
    _last_flush_ms: int | None = None
    _pending_since_ms: int | None = None
    # 时钟源注入：默认用 time.monotonic()*1000，测试可注入固定时钟。
    _now_ms_fn: Callable[[], int] = field(
        default_factory=lambda: lambda: int(time.monotonic() * 1000)
    )

    # ---- 累积 ----
    def enqueue(
        self, key: str, delta: str, meta: dict[str, Any] | None = None
    ) -> bool:
        """累积一个增量到 key 槽。返回是否因字符上限立即触发了 flush 判定（本身不 flush）。

        与对侧一致：enqueue 只累积 + 安排定时，**不主动 flush**；是否 flush 由
        should_flush() 判定、由调用方调 flush() 执行。
        """
        if not delta:
            return False
        slot = self._buffers.get(key)
        if slot is None:
            slot = BufferedDelta(key=key, meta=dict(meta or {}))
            self._buffers[key] = slot
            # 本 key 首个增量：若是全 buffer 首个，记 pending 起点（定时从这算）
            if self._pending_since_ms is None and len(self._buffers) == 1:
                pass  # pending_since 由首个 enqueue 的 now 决定，见 mark_pending
        slot.delta += delta
        if meta:
            slot.meta.update(meta)
        # 记录 pending 起点（惰性：首次有数据时由调用方喂 now）
        return self.total_chars() >= self.max_buffered_chars

    def mark_pending(self, now_ms: int) -> None:
        """登记"这批数据从现在开始计时"。调用方在首个 enqueue 后喂一次 now。"""
        if self._pending_since_ms is None and self._buffers:
            self._pending_since_ms = now_ms

    def total_chars(self) -> int:
        return sum(s.char_count() for s in self._buffers.values())

    def pending_count(self) -> int:
        return len(self._buffers)

    # ---- flush 判定（纯函数，超越轴一）----
    def should_flush(self, now_ms: int) -> FlushDecision:
        """判定此刻是否该 flush，给出结构化原因。不修改状态。"""
        if not self._buffers:
            return FlushDecision(is_flush=False, reason=None, chars=0)
        chars = self.total_chars()
        if chars >= self.max_buffered_chars:
            return FlushDecision(is_flush=True, reason=FlushReason.CHAR_LIMIT, chars=chars)
        if (
            self._pending_since_ms is not None
            and now_ms - self._pending_since_ms >= self.flush_interval_ms
        ):
            return FlushDecision(is_flush=True, reason=FlushReason.INTERVAL, chars=chars)
        return FlushDecision(is_flush=False, reason=None, chars=chars)

    # ---- 执行 flush ----
    def flush(self, reason: FlushReason) -> FlushBatch | None:
        """吐出本批全部累积帧并清空。无数据返回 None（不产空批）。

        2026-11-15 服务端接线修：flush 后把 `_pending_since_ms` 锚到当前时钟、
        `_last_flush_ms` 同步复位，避免下一批的首个 enqueue 因 `_pending_since_ms=None`
        而被 `should_flush` 的 INTERVAL 分支误判为"早已超时"→退化成逐 token 单发。
        调用方在 flush 后用同一时钟源喂 `now_ms`（服务端用 time.monotonic()*1000）。
        """
        if not self._buffers:
            return None
        frames = list(self._buffers.values())
        total = sum(f.char_count() for f in frames)
        self._buffers.clear()
        # 定时锚点对齐 flush 时刻：下一批从现在起算满 flush_interval_ms 才再判 INTERVAL。
        now_ms = self._now_ms_fn()
        self._pending_since_ms = now_ms
        self._last_flush_ms = now_ms
        return FlushBatch(reason=reason, frames=frames, total_chars=total)

    # ---- 页面隐藏强制 flush（对侧 flushIfHidden）----
    def flush_if_hidden(self) -> FlushBatch | None:
        """页面隐藏时不能靠渲染帧驱动，立刻吐批不丢增量。"""
        return self.flush(FlushReason.FORCED)

    def dispose(self) -> None:
        """丢弃全部未 flush 数据（对侧 dispose 清 buffers）。"""
        self._buffers.clear()
        self._pending_since_ms = None


@dataclass(frozen=True)
class FlushDecision:
    """should_flush 的结论。"""

    is_flush: bool
    reason: FlushReason | None
    chars: int


def frame_pace_interval_ms() -> int:
    """对侧 xM = 1e3/60 —— 贴 60fps 的帧节间隔，供调用方设渲染/flush 节奏。"""
    return DEFAULT_FLUSH_INTERVAL_MS
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
