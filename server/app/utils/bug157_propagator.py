"""Bug-157: 跨服务传播.

把 trace context 注入到 HTTP/Kafka/Redis 客户端调用,
出站时生成 traceparent header, 入站时解析后作为父 span.
"""

import json
import threading
import time
from dataclasses import dataclass, field

from app.utils.bug155_trace_context import SpanContext, current_span


@dataclass
class PropagatorConfig:
    http_header: str = "traceparent"
    baggage_header: str = "baggage"
    kafka_header: str = "x-trace"


@dataclass
class InjectRecord:
    target: str  # http / kafka / redis
    key: str
    ok: bool
    ts: float = field(default_factory=time.time)


class TracePropagator:
    """跨服务传播: 出站注入 + 入站解析 + 统计."""

    def __init__(self, config: PropagatorConfig | None = None):
        self.config = config or PropagatorConfig()
        self._lock = threading.Lock()
        self._records: list[InjectRecord] = []

    def inject_http(self, headers: dict[str, str]) -> dict[str, str]:
        ctx = current_span()
        if ctx is None:
            return headers
        headers[self.config.http_header] = ctx.to_header()
        if ctx.baggage:
            headers[self.config.baggage_header] = ",".join(f"{k}={v}" for k, v in ctx.baggage.items())
        with self._lock:
            self._records.append(InjectRecord(target="http", key=ctx.trace_id, ok=True))
        return headers

    def extract_http(self, headers: dict[str, str]) -> SpanContext | None:
        h = headers.get(self.config.http_header)
        if not h:
            return None
        ctx = SpanContext.from_header(h)
        if ctx is None:
            with self._lock:
                self._records.append(InjectRecord(target="http", key="invalid", ok=False))
            return None
        bg = headers.get(self.config.baggage_header, "")
        for pair in bg.split(","):
            if "=" in pair:
                k, v = pair.split("=", 1)
                ctx.set_baggage(k.strip(), v.strip())
        return ctx

    def inject_kafka(self, headers: dict[str, str]) -> dict[str, str]:
        ctx = current_span()
        if ctx is None:
            return headers
        payload = json.dumps({"t": ctx.trace_id, "s": ctx.span_id, "f": ctx.flags})
        headers[self.config.kafka_header] = payload
        with self._lock:
            self._records.append(InjectRecord(target="kafka", key=ctx.trace_id, ok=True))
        return headers

    def extract_kafka(self, headers: dict[str, str]) -> SpanContext | None:
        raw = headers.get(self.config.kafka_header)
        if not raw:
            return None
        try:
            d = json.loads(raw)
            return SpanContext(trace_id=d["t"], span_id=d["s"], flags=d.get("f", 0))
        except Exception:
            with self._lock:
                self._records.append(InjectRecord(target="kafka", key="invalid", ok=False))
            return None

    def stats(self) -> dict[str, int]:
        with self._lock:
            return {
                "total": len(self._records),
                "ok": sum(1 for r in self._records if r.ok),
                "fail": sum(1 for r in self._records if not r.ok),
            }
