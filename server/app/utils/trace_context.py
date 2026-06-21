"""Bug-83: 分布式追踪上下文透传 (W3C traceparent).

设计:
  - 兼容 W3C Trace Context (https://www.w3.org/TR/trace-context/)
  - traceparent 格式: 00-{32hex trace_id}-{16hex span_id}-{2hex flags}
  - tracestate 格式: key=value,key=value (透传)
  - 全局 contextvars 持有当前 trace_id/span_id/parent_span_id
  - extract_from_headers / inject_to_headers 跨服务透传
  - new_span() 创建子 span, finish() 还原 parent

使用:
    from app.utils.trace_context import (
        new_trace, extract_from_headers, inject_to_headers, get_current
    )

    ctx = extract_from_headers(request.headers)
    new_span(ctx, name="llm.chat")
    out_headers = inject_to_headers()
"""

import contextvars
import logging
import re
import threading
import time
import uuid
from dataclasses import dataclass, field
from typing import Optional

logger = logging.getLogger(__name__)

DEFAULT_TRACE_VERSION = "00"
TRACE_ID_LEN = 32
SPAN_ID_LEN = 16
FLAGS_LEN = 2

# traceparent 解析正则
_TRACEPARENT_RE = re.compile(r"^([0-9a-f]{2})-([0-9a-f]{32})-([0-9a-f]{16})-([0-9a-f]{2})$")
_TRACESTATE_RE = re.compile(r"^[a-z][a-z0-9_\-*/]{0,255}=(?:[\x20-\x2b\x2d-\x3c\x3e-\x7e]{0,255})$")

# 全局 contextvar (异步安全)
_current_ctx: contextvars.ContextVar[Optional["TraceContext"]] = contextvars.ContextVar("trace_context", default=None)


@dataclass
class TraceContext:
    """一个追踪上下文 (trace_id + span_id + parent)."""

    trace_id: str
    span_id: str
    parent_span_id: str | None = None
    flags: str = "01"  # 01=sampled, 00=not sampled
    tracestate: str = ""
    started_at: float = field(default_factory=time.time)
    name: str = ""
    attrs: dict[str, str] = field(default_factory=dict)
    finished: bool = False
    finished_at: float = 0.0

    def to_traceparent(self) -> str:
        return f"{DEFAULT_TRACE_VERSION}-{self.trace_id}-{self.span_id}-{self.flags}"

    def to_dict(self) -> dict:
        return {
            "trace_id": self.trace_id,
            "span_id": self.span_id,
            "parent_span_id": self.parent_span_id or "",
            "flags": self.flags,
            "tracestate": self.tracestate,
            "name": self.name,
            "duration_ms": round((self.finished_at or time.time()) - self.started_at, 3),
            "sampled": self.flags == "01",
            "attrs": dict(self.attrs),
        }


def _gen_trace_id() -> str:
    return uuid.uuid4().hex + uuid.uuid4().hex[:0]  # 32 hex
    # 上式等价于 uuid.uuid4().hex.ljust(32,'0')[:32], 但更稳


def _gen_trace_id_safe() -> str:
    return uuid.uuid4().hex.ljust(TRACE_ID_LEN, "0")[:TRACE_ID_LEN]


def _gen_span_id_safe() -> str:
    return uuid.uuid4().hex.ljust(SPAN_ID_LEN, "0")[:SPAN_ID_LEN]


def new_trace(name: str = "root", sampled: bool = True) -> TraceContext:
    """创建全新 trace (无 parent)."""
    ctx = TraceContext(
        trace_id=_gen_trace_id_safe(),
        span_id=_gen_span_id_safe(),
        parent_span_id=None,
        flags="01" if sampled else "00",
        name=name,
    )
    _current_ctx.set(ctx)
    with _stats._lock:
        _stats.total_traces += 1
    return ctx


def new_span(parent: TraceContext | None = None, name: str = "span") -> TraceContext:
    """在 parent 之下创建子 span, 并设为 current."""
    if parent is None:
        parent = _current_ctx.get()
    if parent is None:
        return new_trace(name=name)
    ctx = TraceContext(
        trace_id=parent.trace_id,
        span_id=_gen_span_id_safe(),
        parent_span_id=parent.span_id,
        flags=parent.flags,
        tracestate=parent.tracestate,
        name=name,
    )
    _current_ctx.set(ctx)
    with _stats._lock:
        _stats.total_spans += 1
    return ctx


def finish(ctx: TraceContext | None = None) -> None:
    """标记 span 结束. 还原 parent 为 current."""
    if ctx is None:
        ctx = _current_ctx.get()
    if ctx is None:
        return
    if not ctx.finished:
        ctx.finished = True
        ctx.finished_at = time.time()
    # 还原: 如果有 parent_span_id, 重新构造一个 parent 占位并设为 current
    if ctx.parent_span_id:
        parent = TraceContext(
            trace_id=ctx.trace_id,
            span_id=ctx.parent_span_id,
            parent_span_id=None,
            flags=ctx.flags,
            tracestate=ctx.tracestate,
            name="parent",
        )
        _current_ctx.set(parent)


def get_current() -> TraceContext | None:
    return _current_ctx.get()


def set_current(ctx: TraceContext | None) -> None:
    _current_ctx.set(ctx)


def extract_from_headers(headers: dict[str, str] | None) -> TraceContext:
    """从 HTTP headers 提取 trace context (W3C). 不存在则新建."""
    if headers is None:
        headers = {}
    # 兼容大小写
    norm = {k.lower().strip(): v.strip() for k, v in headers.items() if isinstance(v, str)}
    tp = norm.get("traceparent", "")
    m = _TRACEPARENT_RE.match(tp)
    if m:
        _version, trace_id, span_id, flags = m.groups()
        # trace_id 和 span_id 不可全 0
        if trace_id == "0" * TRACE_ID_LEN or span_id == "0" * SPAN_ID_LEN:
            with _stats._lock:
                _stats.recovered_count += 1
            return new_trace(name="recovered")
        ts = norm.get("tracestate", "")
        with _stats._lock:
            _stats.total_extracted += 1
        return TraceContext(
            trace_id=trace_id,
            span_id=span_id,
            parent_span_id=None,
            flags=flags,
            tracestate=ts,
        )
    return new_trace(name="fresh")


def inject_to_headers(ctx: TraceContext | None = None) -> dict[str, str]:
    """把当前 (或指定) context 注入到 headers."""
    if ctx is None:
        ctx = _current_ctx.get()
    if ctx is None:
        return {}
    out = {"traceparent": ctx.to_traceparent()}
    if ctx.tracestate:
        out["tracestate"] = ctx.tracestate
    with _stats._lock:
        _stats.total_injected += 1
        if ctx.flags == "01":
            _stats.sampled_count += 1
    return out


def parse_tracestate(value: str) -> list[tuple[str, str]]:
    """解析 tracestate 为 [(key, value), ...]."""
    if not value:
        return []
    out = []
    for part in value.split(","):
        part = part.strip()
        if "=" not in part:
            continue
        k, v = part.split("=", 1)
        k = k.strip()
        v = v.strip()
        if k and v and _TRACESTATE_RE.match(f"{k}={v}"):
            out.append((k, v))
    return out


def format_tracestate(items: list[tuple[str, str]]) -> str:
    return ",".join(f"{k}={v}" for k, v in items)


def add_attr(key: str, value: str) -> None:
    """在当前 ctx 上加 attribute."""
    ctx = _current_ctx.get()
    if ctx is not None:
        ctx.attrs[key] = str(value)


# ----- 简易 span 上下文管理器 -----


class span:
    """with trace_context.span("llm.chat") as ctx: ..."""

    def __init__(self, name: str, parent: TraceContext | None = None):
        self._name = name
        self._parent = parent
        self._ctx: TraceContext | None = None
        self._prev: TraceContext | None = None

    def __enter__(self) -> TraceContext:
        self._prev = _current_ctx.get()
        self._ctx = new_span(self._parent, self._name)
        return self._ctx

    def __exit__(self, exc_type, exc, tb) -> bool:
        if self._ctx is not None:
            if exc_type is not None:
                self._ctx.attrs["error"] = "1"
                self._ctx.attrs["error_type"] = exc_type.__name__
            finish(self._ctx)
        # 显式还原回 enter 之前的 current
        if self._prev is not None:
            _current_ctx.set(self._prev)
        return False


# ----- 全局统计 -----


class _Stats:
    def __init__(self):
        self._lock = threading.Lock()
        self.total_traces = 0
        self.total_spans = 0
        self.total_extracted = 0
        self.total_injected = 0
        self.sampled_count = 0
        self.recovered_count = 0  # traceparent 非法/全 0


_stats = _Stats()


def stats() -> dict:
    with _stats._lock:
        return {
            "total_traces": _stats.total_traces,
            "total_spans": _stats.total_spans,
            "total_extracted": _stats.total_extracted,
            "total_injected": _stats.total_injected,
            "sampled_count": _stats.sampled_count,
            "recovered_count": _stats.recovered_count,
        }


# 在关键路径上做一次自检 (模块导入即触发)
def _selftest() -> None:
    c = new_trace(name="selftest")
    assert len(c.trace_id) == TRACE_ID_LEN
    assert len(c.span_id) == SPAN_ID_LEN
    out = inject_to_headers(c)
    assert "traceparent" in out


_selftest()
