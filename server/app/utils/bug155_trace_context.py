"""Bug-155: Trace 上下文传播.

W3C traceparent 风格的 trace context:
- trace_id (16 字节 hex)
- span_id  (8 字节 hex)
- flags / baggage
支持父子 span, 注入到日志/HTTP/异步任务.
"""

import contextvars
import re
import secrets
import threading
import time
from contextlib import contextmanager
from dataclasses import dataclass, field
from typing import Optional

_TRACEPARENT = re.compile(r"^([0-9a-f]{2})-([0-9a-f]{32})-([0-9a-f]{16})-([0-9a-f]{2})$")
_current_ctx: contextvars.ContextVar[Optional["SpanContext"]] = contextvars.ContextVar("trace_ctx", default=None)


@dataclass
class SpanContext:
    trace_id: str
    span_id: str
    parent_span_id: str | None = None
    flags: int = 0
    baggage: dict[str, str] = field(default_factory=dict)
    start_ts: float = field(default_factory=time.time)

    @staticmethod
    def new_root() -> "SpanContext":
        return SpanContext(
            trace_id=secrets.token_hex(16),
            span_id=secrets.token_hex(8),
        )

    @staticmethod
    def new_child(parent: "SpanContext") -> "SpanContext":
        return SpanContext(
            trace_id=parent.trace_id,
            span_id=secrets.token_hex(8),
            parent_span_id=parent.span_id,
            flags=parent.flags,
            baggage=dict(parent.baggage),
        )

    def to_header(self) -> str:
        return f"00-{self.trace_id}-{self.span_id}-{self.flags:02x}"

    @staticmethod
    def from_header(h: str) -> Optional["SpanContext"]:
        m = _TRACEPARENT.match(h.strip().lower())
        if not m:
            return None
        return SpanContext(
            trace_id=m.group(2),
            span_id=m.group(3),
            flags=int(m.group(4), 16),
        )

    def set_baggage(self, k: str, v: str) -> None:
        self.baggage[k] = v

    def elapsed_ms(self) -> float:
        return (time.time() - self.start_ts) * 1000


def current_span() -> SpanContext | None:
    return _current_ctx.get()


@contextmanager
def span_scope(ctx: SpanContext):
    token = _current_ctx.set(ctx)
    try:
        yield ctx
    finally:
        _current_ctx.reset(token)


def start_root_span() -> SpanContext:
    return SpanContext.new_root()


def start_child_span() -> SpanContext | None:
    parent = current_span()
    if parent is None:
        return None
    return SpanContext.new_child(parent)


@dataclass
class TraceStats:
    starts: int = 0
    ends: int = 0
    samples_ms: list[float] = field(default_factory=list)


class TraceRecorder:
    """链路统计 + 最近 span 采样."""

    def __init__(self, max_samples: int = 200):
        self._lock = threading.Lock()
        self.stats = TraceStats()
        self._max = max_samples
        self._trace_ids: list[str] = []

    def on_start(self, ctx: SpanContext) -> None:
        with self._lock:
            self.stats.starts += 1
            self._trace_ids.append(ctx.trace_id)
            if len(self._trace_ids) > 2000:
                self._trace_ids = self._trace_ids[-2000:]

    def on_end(self, ctx: SpanContext) -> None:
        ms = ctx.elapsed_ms()
        with self._lock:
            self.stats.ends += 1
            self.stats.samples_ms.append(ms)
            if len(self.stats.samples_ms) > self._max:
                self.stats.samples_ms = self.stats.samples_ms[-self._max :]

    def snapshot(self) -> dict[str, object]:
        with self._lock:
            samples = list(self.stats.samples_ms)
            return {
                "starts": self.stats.starts,
                "ends": self.stats.ends,
                "active_traces": self.stats.starts - self.stats.ends,
                "p50_ms": _pct(samples, 0.5),
                "p95_ms": _pct(samples, 0.95),
                "p99_ms": _pct(samples, 0.99),
            }


def _pct(samples: list[float], q: float) -> float:
    if not samples:
        return 0.0
    s = sorted(samples)
    import math

    idx = max(0, min(len(s) - 1, math.ceil(q * len(s)) - 1))
    return round(s[idx], 3)
