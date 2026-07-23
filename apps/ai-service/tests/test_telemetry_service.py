"""统一遥测服务测试 — 6 大支柱的 Prometheus metrics + 分布式 trace。

覆盖 telemetry_service.py:
- Metric / Counter / Gauge / Histogram 数据模型(_label_key / inc / dec / set / observe / get)
- _format_value / _format_labels / _merge_le_label 辅助函数(转义 + 拼接)
- _gen_trace_id / _gen_span_id ID 生成器(长度 + hex + 唯一性)
- Span dataclass + to_dict 序列化
- MetricsRegistry(counter / gauge / histogram 幂等注册 + get_metric +
  export_prometheus 含 HELP/TYPE/bucket/+Inf/sum/count + get_all_metrics JSON)
- TraceContext(async with,aenter/aexit,start_time/end_time/duration_ms/
  error 状态,setdefault 语义,add_event,set_attribute)
- TelemetryService(__init__ / _init_metrics 注册 ~40 个 /
  _ensure_redis 惰性 + 降级 + 缓存 / set_redis_client /
  _store_span Redis+内存+失败降级 / _record_trace_root 摘要+异常吞 /
  record_llm_call 4 metric 更新+异常吞 /
  record_pillar_event 分发表+未注册+异常吞 /
  start_trace 工厂+全流程+error 标记 /
  get_trace Redis+内存+JSON 解析失败跳过+span_id 去重+start_time 排序 /
  get_recent_traces Redis+内存+trace_id 去重+倒序+limit /
  get_metrics json/prometheus /
  get_pillar_health healthy/degraded/unknown+labeled/unlabeled gauge /
  _pillar_status_gauges mapping /
  get_dashboard system_overview+metrics_summary+pillar_health+recent_traces)
- _EVENT_HANDLERS 分发表(_h_counter_inc / _h_gauge_set / _h_histogram_observe)
- 模块级单例 telemetry_service
"""

from __future__ import annotations

import json
import time
from collections import deque
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.services import telemetry_service as ts_module
from app.services.telemetry_service import (
    DEFAULT_HISTOGRAM_BUCKETS_MS,
    MEMORY_SPANS_MAX,
    MEMORY_TRACE_ROOTS_MAX,
    PILLARS,
    REDIS_TRACE_ROOTS_KEY,
    REDIS_TRACE_TTL,
    REDIS_TRACES_KEY_PREFIX,
    Counter,
    Gauge,
    Histogram,
    Metric,
    MetricsRegistry,
    Span,
    TelemetryService,
    TraceContext,
    _EVENT_HANDLERS,
    _format_labels,
    _format_value,
    _gen_span_id,
    _gen_trace_id,
    _h_counter_inc,
    _h_gauge_set,
    _h_histogram_observe,
    _merge_le_label,
    telemetry_service,
)


# ── fixtures ─────────────────────────────────────────────────────────────


@pytest.fixture
def svc() -> TelemetryService:
    """每个测试一个全新 TelemetryService,强制内存模式(不连 Redis)。"""
    s = TelemetryService()
    s.set_redis_client(None)
    return s


def _make_redis_mock() -> AsyncMock:
    """构造一个所有方法都是 AsyncMock 的 Redis 客户端 mock。"""
    m = AsyncMock()
    m.rpush = AsyncMock()
    m.expire = AsyncMock()
    m.lpush = AsyncMock()
    m.ltrim = AsyncMock()
    m.lrange = AsyncMock(return_value=[])
    m.llen = AsyncMock(return_value=0)
    m.ping = AsyncMock()
    return m


# ════════════════════════════════════════════════════════════════════════
# 1. 常量
# ════════════════════════════════════════════════════════════════════════


class TestConstants:
    def test_pillars_count_and_members(self):
        assert len(PILLARS) == 6
        assert tuple(PILLARS) == ("rules", "hook", "spec", "context", "subagent", "terminal")

    def test_redis_constants(self):
        assert REDIS_TRACES_KEY_PREFIX == "hub:traces:"
        assert REDIS_TRACE_ROOTS_KEY == "hub:traces:_roots"
        assert REDIS_TRACE_TTL == 3600
        assert MEMORY_SPANS_MAX == 5000
        assert MEMORY_TRACE_ROOTS_MAX == 200

    def test_default_histogram_buckets(self):
        assert DEFAULT_HISTOGRAM_BUCKETS_MS == (
            1, 5, 10, 25, 50, 100, 250, 500, 1000, 2500, 5000, 10000,
        )


# ════════════════════════════════════════════════════════════════════════
# 2. Metric 基类
# ════════════════════════════════════════════════════════════════════════


class TestMetric:
    def test_init_defaults(self):
        m = Metric("foo", "counter", "help", ["a", "b"])
        assert m.name == "foo"
        assert m.type == "counter"
        assert m.help == "help"
        assert m.labels == ["a", "b"]
        assert m.values == {}

    def test_init_labels_copied(self):
        labels = ["a", "b"]
        m = Metric("foo", "counter", "h", labels)
        labels.append("c")
        assert m.labels == ["a", "b"]  # 内部 list() 复制,免外部突变

    def test_label_key_with_all_labels(self):
        m = Metric("foo", "counter", "h", ["a", "b"])
        assert m._label_key(a="1", b="2") == ("1", "2")

    def test_label_key_missing_label_defaults_empty(self):
        m = Metric("foo", "counter", "h", ["a", "b"])
        assert m._label_key(a="1") == ("1", "")

    def test_label_key_no_labels(self):
        m = Metric("foo", "counter", "h", [])
        assert m._label_key() == ()

    def test_label_key_values_stringified(self):
        m = Metric("foo", "counter", "h", ["a"])
        assert m._label_key(a=123) == ("123",)


# ════════════════════════════════════════════════════════════════════════
# 3. Counter
# ════════════════════════════════════════════════════════════════════════


class TestCounter:
    def test_inc_default_one(self):
        c = Counter("c", "h", ["a"])
        c.inc(a="x")
        assert c.get(a="x") == 1.0

    def test_inc_with_value(self):
        c = Counter("c", "h", ["a"])
        c.inc(5, a="x")
        assert c.get(a="x") == 5.0

    def test_inc_accumulates(self):
        c = Counter("c", "h", ["a"])
        c.inc(2, a="x")
        c.inc(3, a="x")
        assert c.get(a="x") == 5.0

    def test_inc_separate_label_values(self):
        c = Counter("c", "h", ["a"])
        c.inc(a="x")
        c.inc(a="y")
        assert c.get(a="x") == 1.0
        assert c.get(a="y") == 1.0

    def test_get_missing_returns_zero(self):
        c = Counter("c", "h", ["a"])
        assert c.get(a="missing") == 0.0

    def test_inc_int_value_converted_to_float(self):
        c = Counter("c", "h", [])
        c.inc(10)
        assert isinstance(c.values[()], float)
        assert c.values[()] == 10.0


# ════════════════════════════════════════════════════════════════════════
# 4. Gauge
# ════════════════════════════════════════════════════════════════════════


class TestGauge:
    def test_set(self):
        g = Gauge("g", "h", ["a"])
        g.set(42, a="x")
        assert g.get(a="x") == 42.0

    def test_set_overwrites(self):
        g = Gauge("g", "h", ["a"])
        g.set(10, a="x")
        g.set(20, a="x")
        assert g.get(a="x") == 20.0

    def test_inc(self):
        g = Gauge("g", "h", ["a"])
        g.set(10, a="x")
        g.inc(5, a="x")
        assert g.get(a="x") == 15.0

    def test_inc_default_one(self):
        g = Gauge("g", "h", ["a"])
        g.inc(a="x")
        assert g.get(a="x") == 1.0

    def test_dec(self):
        g = Gauge("g", "h", ["a"])
        g.set(10, a="x")
        g.dec(3, a="x")
        assert g.get(a="x") == 7.0

    def test_dec_default_one(self):
        g = Gauge("g", "h", ["a"])
        g.set(10, a="x")
        g.dec(a="x")
        assert g.get(a="x") == 9.0

    def test_get_missing_returns_zero(self):
        g = Gauge("g", "h", ["a"])
        assert g.get(a="missing") == 0.0


# ════════════════════════════════════════════════════════════════════════
# 5. Histogram
# ════════════════════════════════════════════════════════════════════════


class TestHistogram:
    def test_observe_creates_entry(self):
        h = Histogram("h", "h", ["a"])
        h.observe(10, a="x")
        entry = h.get(a="x")
        assert entry["count"] == 1
        assert entry["sum"] == 10.0
        assert len(entry["buckets"]) == len(DEFAULT_HISTOGRAM_BUCKETS_MS)

    def test_observe_accumulates(self):
        h = Histogram("h", "h", ["a"])
        h.observe(10, a="x")
        h.observe(20, a="x")
        entry = h.get(a="x")
        assert entry["count"] == 2
        assert entry["sum"] == 30.0

    def test_observe_bucket_cumulative(self):
        """Prometheus histogram 累积语义:<=bound 的所有 bucket 都 +1。"""
        h = Histogram("h", "h", ["a"], buckets=(5, 10, 25))
        h.observe(3, a="x")   # <=5, <=10, <=25 都 +1 → [1, 1, 1]
        h.observe(15, a="x")  # 只 <=25 → [1, 1, 2]
        entry = h.get(a="x")
        assert entry["buckets"] == [1, 1, 2]

    def test_observe_separate_labels(self):
        h = Histogram("h", "h", ["a"])
        h.observe(10, a="x")
        h.observe(20, a="y")
        assert h.get(a="x")["count"] == 1
        assert h.get(a="y")["count"] == 1

    def test_get_missing_returns_empty_structure(self):
        h = Histogram("h", "h", ["a"])
        entry = h.get(a="missing")
        assert entry["count"] == 0
        assert entry["sum"] == 0.0
        assert entry["buckets"] == [0] * len(DEFAULT_HISTOGRAM_BUCKETS_MS)

    def test_custom_buckets(self):
        h = Histogram("h", "h", ["a"], buckets=(1, 10, 100))
        assert h.buckets == (1, 10, 100)

    def test_default_buckets(self):
        h = Histogram("h", "h", ["a"])
        assert h.buckets == DEFAULT_HISTOGRAM_BUCKETS_MS

    def test_observe_int_sum_converted_to_float(self):
        h = Histogram("h", "h", [])
        h.observe(10)
        assert isinstance(h.get()["sum"], float)


# ════════════════════════════════════════════════════════════════════════
# 6. 格式化辅助函数
# ════════════════════════════════════════════════════════════════════════


class TestFormatHelpers:
    def test_format_value_int(self):
        assert _format_value(5) == "5"

    def test_format_value_float_integer(self):
        assert _format_value(5.0) == "5"

    def test_format_value_float_decimal(self):
        assert _format_value(3.14) == "3.14"

    def test_format_value_float_trailing_zeros(self):
        # %g 去尾零
        assert _format_value(3.140000) == "3.14"

    def test_format_labels_empty(self):
        assert _format_labels([], ()) == ""

    def test_format_labels_single(self):
        assert _format_labels(["a"], ("x",)) == '{a="x"}'

    def test_format_labels_multiple(self):
        assert _format_labels(["a", "b"], ("x", "y")) == '{a="x",b="y"}'

    def test_format_labels_escape_backslash(self):
        assert _format_labels(["a"], ("x\\y",)) == '{a="x\\\\y"}'

    def test_format_labels_escape_quote(self):
        assert _format_labels(["a"], ('x"y',)) == '{a="x\\"y"}'

    def test_format_labels_value_stringified(self):
        assert _format_labels(["a"], (123,)) == '{a="123"}'

    def test_merge_le_label_empty(self):
        assert _merge_le_label("", 10) == '{le="10"}'

    def test_merge_le_label_with_existing(self):
        assert _merge_le_label('{a="x"}', 10) == '{a="x",le="10"}'

    def test_merge_le_label_with_multiple_existing(self):
        assert _merge_le_label('{a="x",b="y"}', 25) == '{a="x",b="y",le="25"}'

    def test_merge_le_label_plus_inf(self):
        assert _merge_le_label("", "+Inf") == '{le="+Inf"}'


# ════════════════════════════════════════════════════════════════════════
# 7. ID 生成器
# ════════════════════════════════════════════════════════════════════════


class TestGenIds:
    def test_gen_trace_id_length(self):
        assert len(_gen_trace_id()) == 32

    def test_gen_trace_id_hex(self):
        # 不抛异常即为合法 hex
        int(_gen_trace_id(), 16)

    def test_gen_trace_id_unique(self):
        tids = {_gen_trace_id() for _ in range(100)}
        assert len(tids) == 100

    def test_gen_span_id_length(self):
        assert len(_gen_span_id()) == 16

    def test_gen_span_id_hex(self):
        int(_gen_span_id(), 16)

    def test_gen_span_id_unique(self):
        sids = {_gen_span_id() for _ in range(100)}
        assert len(sids) == 100


# ════════════════════════════════════════════════════════════════════════
# 8. Span dataclass
# ════════════════════════════════════════════════════════════════════════


class TestSpan:
    def test_init_defaults(self):
        s = Span(trace_id="t1", span_id="s1", parent_span_id="", name="n",
                 pillar="rules", start_time=1.0)
        assert s.end_time == 0.0
        assert s.duration_ms == 0.0
        assert s.attributes == {}
        assert s.status == "ok"
        assert s.events == []

    def test_init_with_attributes_and_events(self):
        s = Span(trace_id="t1", span_id="s1", parent_span_id="", name="n",
                 pillar="rules", start_time=1.0,
                 attributes={"k": "v"}, events=[{"name": "e"}])
        assert s.attributes == {"k": "v"}
        assert s.events == [{"name": "e"}]

    def test_to_dict_contains_all_fields(self):
        s = Span(trace_id="t1", span_id="s1", parent_span_id="p1", name="n",
                 pillar="rules", start_time=1.0, end_time=2.0, duration_ms=1000.0,
                 attributes={"k": "v"}, status="ok", events=[{"name": "e"}])
        d = s.to_dict()
        assert d == {
            "trace_id": "t1",
            "span_id": "s1",
            "parent_span_id": "p1",
            "name": "n",
            "pillar": "rules",
            "start_time": 1.0,
            "end_time": 2.0,
            "duration_ms": 1000.0,
            "attributes": {"k": "v"},
            "status": "ok",
            "events": [{"name": "e"}],
        }

    def test_attributes_default_independent(self):
        """field(default_factory=dict) 应保证每个实例独立的 dict。"""
        s1 = Span(trace_id="t", span_id="s", parent_span_id="", name="n",
                  pillar="p", start_time=0)
        s2 = Span(trace_id="t", span_id="s", parent_span_id="", name="n",
                  pillar="p", start_time=0)
        s1.attributes["k"] = "v"
        assert "k" not in s2.attributes

    def test_events_default_independent(self):
        s1 = Span(trace_id="t", span_id="s", parent_span_id="", name="n",
                  pillar="p", start_time=0)
        s2 = Span(trace_id="t", span_id="s", parent_span_id="", name="n",
                  pillar="p", start_time=0)
        s1.events.append({"name": "e"})
        assert len(s2.events) == 0


# ════════════════════════════════════════════════════════════════════════
# 9. MetricsRegistry
# ════════════════════════════════════════════════════════════════════════


class TestMetricsRegistry:
    def test_counter_register(self):
        r = MetricsRegistry()
        c = r.counter("c1", "h", ["a"])
        assert isinstance(c, Counter)
        assert c.labels == ["a"]
        assert r.get_metric("c1") is c

    def test_counter_register_default_labels(self):
        r = MetricsRegistry()
        c = r.counter("c1", "h")
        assert c.labels == []

    def test_counter_register_idempotent(self):
        r = MetricsRegistry()
        c1 = r.counter("c1", "h", ["a"])
        c2 = r.counter("c1", "h", ["a"])
        assert c1 is c2

    def test_gauge_register(self):
        r = MetricsRegistry()
        g = r.gauge("g1", "h", ["a"])
        assert isinstance(g, Gauge)
        assert r.get_metric("g1") is g

    def test_gauge_register_default_labels(self):
        r = MetricsRegistry()
        g = r.gauge("g1", "h")
        assert g.labels == []

    def test_gauge_register_idempotent(self):
        r = MetricsRegistry()
        g1 = r.gauge("g1", "h", ["a"])
        g2 = r.gauge("g1", "h", ["a"])
        assert g1 is g2

    def test_histogram_register(self):
        r = MetricsRegistry()
        h = r.histogram("h1", "h", ["a"])
        assert isinstance(h, Histogram)
        assert r.get_metric("h1") is h

    def test_histogram_register_default_labels(self):
        r = MetricsRegistry()
        h = r.histogram("h1", "h")
        assert h.labels == []

    def test_histogram_register_custom_buckets(self):
        r = MetricsRegistry()
        h = r.histogram("h1", "h", ["a"], buckets=(1, 10, 100))
        assert h.buckets == (1, 10, 100)

    def test_histogram_register_idempotent(self):
        r = MetricsRegistry()
        h1 = r.histogram("h1", "h", ["a"])
        h2 = r.histogram("h1", "h", ["a"])
        assert h1 is h2

    def test_get_metric_missing(self):
        r = MetricsRegistry()
        assert r.get_metric("missing") is None

    def test_export_prometheus_empty(self):
        r = MetricsRegistry()
        assert r.export_prometheus() == ""

    def test_export_prometheus_counter(self):
        r = MetricsRegistry()
        c = r.counter("c1", "help text", ["a"])
        c.inc(5, a="x")
        out = r.export_prometheus()
        assert "# HELP c1 help text" in out
        assert "# TYPE c1 counter" in out
        assert 'c1{a="x"} 5' in out

    def test_export_prometheus_gauge(self):
        r = MetricsRegistry()
        g = r.gauge("g1", "help", ["a"])
        g.set(42, a="x")
        out = r.export_prometheus()
        assert "# TYPE g1 gauge" in out
        assert 'g1{a="x"} 42' in out

    def test_export_prometheus_histogram(self):
        r = MetricsRegistry()
        h = r.histogram("h1", "help", ["a"], buckets=(10, 100))
        h.observe(5, a="x")   # buckets: [1, 1]
        h.observe(50, a="x")  # buckets: [1, 2]
        out = r.export_prometheus()
        assert "# TYPE h1 histogram" in out
        assert 'h1_bucket{a="x",le="10"} 1' in out
        assert 'h1_bucket{a="x",le="100"} 2' in out
        assert 'h1_bucket{a="x",le="+Inf"} 2' in out
        assert 'h1_sum{a="x"} 55' in out
        assert 'h1_count{a="x"} 2' in out

    def test_export_prometheus_no_labels(self):
        r = MetricsRegistry()
        c = r.counter("c1", "h", [])
        c.inc(5)
        out = r.export_prometheus()
        assert "c1 5" in out

    def test_export_prometheus_sorted_by_name(self):
        r = MetricsRegistry()
        r.counter("z_metric", "h", [])
        r.counter("a_metric", "h", [])
        out = r.export_prometheus()
        # a_metric 应该在 z_metric 之前
        assert out.index("a_metric") < out.index("z_metric")

    def test_export_prometheus_trailing_newline(self):
        r = MetricsRegistry()
        c = r.counter("c1", "h", [])
        c.inc(1)
        assert r.export_prometheus().endswith("\n")

    def test_get_all_metrics_counter(self):
        r = MetricsRegistry()
        c = r.counter("c1", "help", ["a"])
        c.inc(5, a="x")
        result = r.get_all_metrics()
        assert result["c1"] == {
            "type": "counter",
            "help": "help",
            "labels": ["a"],
            "values": {"x": 5.0},
        }

    def test_get_all_metrics_gauge(self):
        r = MetricsRegistry()
        g = r.gauge("g1", "help", ["a"])
        g.set(42, a="x")
        result = r.get_all_metrics()
        assert result["g1"]["type"] == "gauge"
        assert result["g1"]["values"] == {"x": 42.0}

    def test_get_all_metrics_histogram(self):
        r = MetricsRegistry()
        h = r.histogram("h1", "help", ["a"], buckets=(10, 100))
        h.observe(5, a="x")
        result = r.get_all_metrics()
        assert result["h1"]["type"] == "histogram"
        assert result["h1"]["buckets"] == [10, 100]
        assert "x" in result["h1"]["values"]
        assert result["h1"]["values"]["x"]["count"] == 1

    def test_get_all_metrics_multiple_label_values(self):
        r = MetricsRegistry()
        c = r.counter("c1", "help", ["a", "b"])
        c.inc(a="x", b="y")
        c.inc(a="x", b="z")
        result = r.get_all_metrics()
        assert "x,y" in result["c1"]["values"]
        assert "x,z" in result["c1"]["values"]


# ════════════════════════════════════════════════════════════════════════
# 10. TraceContext
# ════════════════════════════════════════════════════════════════════════


class TestTraceContext:
    def test_init_with_defaults(self, svc):
        ctx = TraceContext(svc, "span.name", "rules")
        assert ctx.span.name == "span.name"
        assert ctx.span.pillar == "rules"
        assert ctx.span.parent_span_id == ""
        assert ctx.span.start_time == 0.0
        assert ctx.span.end_time == 0.0
        assert ctx.span.attributes == {}
        assert len(ctx.span.trace_id) == 32
        assert len(ctx.span.span_id) == 16

    def test_init_with_explicit_trace_id(self, svc):
        ctx = TraceContext(svc, "n", "p", trace_id="my-trace-id")
        assert ctx.span.trace_id == "my-trace-id"

    def test_init_with_parent_span_id(self, svc):
        ctx = TraceContext(svc, "n", "p", parent_span_id="parent-id")
        assert ctx.span.parent_span_id == "parent-id"

    def test_init_with_attributes(self, svc):
        ctx = TraceContext(svc, "n", "p", attributes={"k1": "v1"})
        assert ctx.span.attributes == {"k1": "v1"}

    def test_init_attributes_copied(self, svc):
        attrs = {"k1": "v1"}
        ctx = TraceContext(svc, "n", "p", attributes=attrs)
        ctx.span.attributes["k2"] = "v2"
        assert "k2" not in attrs  # 内部 dict() 复制

    @pytest.mark.asyncio
    async def test_aenter_sets_start_time(self, svc):
        ctx = TraceContext(svc, "n", "p")
        before = time.monotonic()
        returned = await ctx.__aenter__()
        after = time.monotonic()
        assert returned is ctx
        assert before <= ctx.span.start_time <= after

    @pytest.mark.asyncio
    async def test_aexit_records_end_and_duration(self, svc):
        ctx = TraceContext(svc, "n", "p")
        await ctx.__aenter__()
        await ctx.__aexit__(None, None, None)
        assert ctx.span.end_time >= ctx.span.start_time
        expected = (ctx.span.end_time - ctx.span.start_time) * 1000.0
        assert ctx.span.duration_ms == pytest.approx(expected)

    @pytest.mark.asyncio
    async def test_aexit_with_exception_sets_error_status(self, svc):
        ctx = TraceContext(svc, "n", "p")
        await ctx.__aenter__()
        exc = ValueError("boom")
        await ctx.__aexit__(ValueError, exc, None)
        assert ctx.span.status == "error"
        assert ctx.span.attributes.get("error") == "boom"

    @pytest.mark.asyncio
    async def test_aexit_with_exception_does_not_overwrite_existing_error_attr(self, svc):
        """setdefault:已有 error 属性时不覆盖。"""
        ctx = TraceContext(svc, "n", "p")
        ctx.span.attributes["error"] = "preexisting"
        await ctx.__aenter__()
        await ctx.__aexit__(ValueError, ValueError("boom"), None)
        assert ctx.span.attributes["error"] == "preexisting"
        assert ctx.span.status == "error"

    @pytest.mark.asyncio
    async def test_aexit_stores_span_via_telemetry(self, svc):
        """aexit 调用 _store_span。"""
        with patch.object(svc, "_store_span", new_callable=AsyncMock) as mock_store:
            ctx = TraceContext(svc, "n", "p")
            async with ctx:
                pass
            mock_store.assert_awaited_once()
            stored_span = mock_store.call_args.args[0]
            assert stored_span.name == "n"

    def test_add_event_default_attributes(self, svc):
        ctx = TraceContext(svc, "n", "p")
        ctx.add_event("event1")
        assert len(ctx.span.events) == 1
        e = ctx.span.events[0]
        assert e["name"] == "event1"
        assert e["attributes"] == {}
        assert "timestamp" in e

    def test_add_event_with_attributes(self, svc):
        ctx = TraceContext(svc, "n", "p")
        ctx.add_event("event1", {"k": "v"})
        assert ctx.span.events[0]["attributes"] == {"k": "v"}

    def test_add_event_attributes_copied(self, svc):
        ctx = TraceContext(svc, "n", "p")
        attrs = {"k": "v"}
        ctx.add_event("event1", attrs)
        ctx.span.events[0]["attributes"]["k2"] = "v2"
        assert "k2" not in attrs

    def test_set_attribute(self, svc):
        ctx = TraceContext(svc, "n", "p")
        ctx.set_attribute("k1", "v1")
        assert ctx.span.attributes["k1"] == "v1"

    def test_set_attribute_overwrites(self, svc):
        ctx = TraceContext(svc, "n", "p")
        ctx.set_attribute("k1", "v1")
        ctx.set_attribute("k1", "v2")
        assert ctx.span.attributes["k1"] == "v2"


# ════════════════════════════════════════════════════════════════════════
# 11. TelemetryService 初始化
# ════════════════════════════════════════════════════════════════════════


class TestTelemetryInit:
    def test_init_creates_registry(self):
        svc = TelemetryService()
        assert isinstance(svc.registry, MetricsRegistry)

    def test_init_redis_none(self):
        svc = TelemetryService()
        assert svc._redis is None

    def test_init_use_redis_default_true(self):
        svc = TelemetryService()
        assert svc._use_redis is True

    def test_init_memory_spans_deque(self):
        svc = TelemetryService()
        assert isinstance(svc._memory_spans, deque)
        assert svc._memory_spans.maxlen == MEMORY_SPANS_MAX

    def test_init_memory_trace_roots_deque(self):
        svc = TelemetryService()
        assert isinstance(svc._memory_trace_roots, deque)
        assert svc._memory_trace_roots.maxlen == MEMORY_TRACE_ROOTS_MAX

    def test_init_metrics_registered(self):
        svc = TelemetryService()
        assert isinstance(svc.registry.get_metric("llm_requests_total"), Counter)
        assert isinstance(svc.registry.get_metric("rules_matched_total"), Counter)
        assert isinstance(svc.registry.get_metric("hooks_health_status"), Gauge)
        assert isinstance(svc.registry.get_metric("llm_request_duration_ms"), Histogram)
        assert isinstance(svc.registry.get_metric("context_compression_ratio"), Histogram)

    def test_init_metrics_count_at_least_30(self):
        svc = TelemetryService()
        # 数 ~40 个 metric(6 支柱 + LLM + Hub + Budget)
        assert len(svc.registry._metrics) >= 30


# ════════════════════════════════════════════════════════════════════════
# 12. Redis 客户端管理
# ════════════════════════════════════════════════════════════════════════


class TestRedis:
    @pytest.mark.asyncio
    async def test_ensure_redis_returns_injected_client(self):
        svc = TelemetryService()
        mock_client = MagicMock()
        svc.set_redis_client(mock_client)
        assert await svc._ensure_redis() is mock_client

    @pytest.mark.asyncio
    async def test_ensure_redis_memory_mode_when_use_redis_false(self):
        svc = TelemetryService()
        svc._use_redis = False
        assert await svc._ensure_redis() is None

    @pytest.mark.asyncio
    async def test_ensure_redis_attempts_connection_on_first_call_failure(self):
        """_use_redis=True 且 redis_url 设置 → 尝试连接,ping 失败 → 降级。"""
        svc = TelemetryService()
        mock_client = _make_redis_mock()
        mock_client.ping = AsyncMock(side_effect=Exception("connect failed"))
        with patch("app.services.telemetry_service.aioredis") as mock_aioredis:
            mock_aioredis.from_url.return_value = mock_client
            result = await svc._ensure_redis()
            assert result is None
            assert svc._use_redis is False
            assert svc._redis is None

    @pytest.mark.asyncio
    async def test_ensure_redis_success_path(self):
        svc = TelemetryService()
        mock_client = _make_redis_mock()
        with patch("app.services.telemetry_service.aioredis") as mock_aioredis:
            mock_aioredis.from_url.return_value = mock_client
            result = await svc._ensure_redis()
            assert result is mock_client
            assert svc._use_redis is True
            assert svc._redis is mock_client

    @pytest.mark.asyncio
    async def test_ensure_redis_caches_client(self):
        """第二次调用不重新创建 client。"""
        svc = TelemetryService()
        mock_client = _make_redis_mock()
        with patch("app.services.telemetry_service.aioredis") as mock_aioredis:
            mock_aioredis.from_url.return_value = mock_client
            await svc._ensure_redis()
            await svc._ensure_redis()
            assert mock_aioredis.from_url.call_count == 1

    @pytest.mark.asyncio
    async def test_ensure_redis_no_redis_url(self):
        svc = TelemetryService()
        from app.core.config import settings
        with patch.object(settings, "redis_url", ""):
            result = await svc._ensure_redis()
            assert result is None
            assert svc._use_redis is False

    @pytest.mark.asyncio
    async def test_ensure_redis_aioredis_none(self):
        """aioredis 模块不可用时降级。"""
        svc = TelemetryService()
        with patch("app.services.telemetry_service.aioredis", None):
            result = await svc._ensure_redis()
            assert result is None
            assert svc._use_redis is False

    def test_set_redis_client_with_none(self):
        svc = TelemetryService()
        svc._redis = "something"
        svc._use_redis = True
        svc.set_redis_client(None)
        assert svc._redis is None
        assert svc._use_redis is False

    def test_set_redis_client_with_value(self):
        svc = TelemetryService()
        mock_client = MagicMock()
        svc.set_redis_client(mock_client)
        assert svc._redis is mock_client
        assert svc._use_redis is True


# ════════════════════════════════════════════════════════════════════════
# 13. Span 存储
# ════════════════════════════════════════════════════════════════════════


class TestStoreSpan:
    @pytest.mark.asyncio
    async def test_store_span_memory_mode_root(self, svc):
        span = Span(trace_id="t1", span_id="s1", parent_span_id="", name="n",
                    pillar="rules", start_time=1.0)
        await svc._store_span(span)
        assert len(svc._memory_spans) == 1
        assert svc._memory_spans[0]["trace_id"] == "t1"
        assert len(svc._memory_trace_roots) == 1

    @pytest.mark.asyncio
    async def test_store_span_memory_mode_child(self, svc):
        """子 span 不写入 _memory_trace_roots。"""
        span = Span(trace_id="t1", span_id="s1", parent_span_id="parent",
                    name="n", pillar="rules", start_time=1.0)
        await svc._store_span(span)
        assert len(svc._memory_spans) == 1
        assert len(svc._memory_trace_roots) == 0

    @pytest.mark.asyncio
    async def test_store_span_redis_path(self):
        svc = TelemetryService()
        mock_redis = _make_redis_mock()
        svc.set_redis_client(mock_redis)
        span = Span(trace_id="t1", span_id="s1", parent_span_id="", name="n",
                    pillar="rules", start_time=1.0)
        await svc._store_span(span)
        mock_redis.rpush.assert_awaited_once()
        args = mock_redis.rpush.call_args.args
        assert args[0] == f"{REDIS_TRACES_KEY_PREFIX}t1"
        span_dict = json.loads(args[1])
        assert span_dict["trace_id"] == "t1"
        # expire 至少调用一次(span key TTL)
        mock_redis.expire.assert_awaited()
        # 根 span 触发 _record_trace_root
        mock_redis.lpush.assert_awaited_once()
        mock_redis.ltrim.assert_awaited_once()

    @pytest.mark.asyncio
    async def test_store_span_redis_child_span_no_root_record(self):
        svc = TelemetryService()
        mock_redis = _make_redis_mock()
        svc.set_redis_client(mock_redis)
        span = Span(trace_id="t1", span_id="s1", parent_span_id="parent-id",
                    name="n", pillar="rules", start_time=1.0)
        await svc._store_span(span)
        mock_redis.rpush.assert_awaited_once()
        mock_redis.lpush.assert_not_awaited()
        mock_redis.ltrim.assert_not_awaited()

    @pytest.mark.asyncio
    async def test_store_span_redis_failure_falls_back_to_memory(self):
        svc = TelemetryService()
        mock_redis = _make_redis_mock()
        mock_redis.rpush = AsyncMock(side_effect=Exception("redis down"))
        svc.set_redis_client(mock_redis)
        span = Span(trace_id="t1", span_id="s1", parent_span_id="", name="n",
                    pillar="rules", start_time=1.0)
        await svc._store_span(span)
        assert len(svc._memory_spans) == 1
        assert len(svc._memory_trace_roots) == 1

    @pytest.mark.asyncio
    async def test_record_trace_root_writes_summary(self, svc):
        mock_redis = _make_redis_mock()
        span_dict = {
            "trace_id": "t1", "name": "n", "pillar": "rules",
            "start_time": 1.0, "duration_ms": 100.0, "status": "ok",
        }
        await svc._record_trace_root(span_dict, mock_redis)
        mock_redis.lpush.assert_awaited_once()
        args = mock_redis.lpush.call_args.args
        assert args[0] == REDIS_TRACE_ROOTS_KEY
        summary = json.loads(args[1])
        assert summary == {
            "trace_id": "t1",
            "name": "n",
            "pillar": "rules",
            "start_time": 1.0,
            "duration_ms": 100.0,
            "status": "ok",
        }
        mock_redis.ltrim.assert_awaited_once_with(
            REDIS_TRACE_ROOTS_KEY, 0, MEMORY_TRACE_ROOTS_MAX - 1
        )
        mock_redis.expire.assert_awaited_once_with(REDIS_TRACE_ROOTS_KEY, REDIS_TRACE_TTL)

    @pytest.mark.asyncio
    async def test_record_trace_root_handles_redis_error(self, svc):
        """_record_trace_root 内部 try/except,不向外抛异常。"""
        mock_redis = _make_redis_mock()
        mock_redis.lpush = AsyncMock(side_effect=Exception("redis down"))
        span_dict = {
            "trace_id": "t1", "name": "n", "pillar": "rules",
            "start_time": 1.0, "duration_ms": 100.0, "status": "ok",
        }
        # 不抛异常
        await svc._record_trace_root(span_dict, mock_redis)


# ════════════════════════════════════════════════════════════════════════
# 14. record_llm_call
# ════════════════════════════════════════════════════════════════════════


class TestRecordLLMCall:
    @pytest.mark.asyncio
    async def test_record_llm_call_updates_all_metrics(self, svc):
        await svc.record_llm_call("rules", "gpt-4o", 100, 50, 0.05, 250.0)
        m_req = svc.registry.get_metric("llm_requests_total")
        m_tok = svc.registry.get_metric("llm_tokens_total")
        m_cost = svc.registry.get_metric("llm_cost_usd_total")
        m_dur = svc.registry.get_metric("llm_request_duration_ms")
        assert m_req.get(pillar="rules", model="gpt-4o", status="ok") == 1.0
        assert m_tok.get(pillar="rules", model="gpt-4o", type="input") == 100.0
        assert m_tok.get(pillar="rules", model="gpt-4o", type="output") == 50.0
        assert m_cost.get(pillar="rules", model="gpt-4o") == 0.05
        dur_entry = m_dur.get(pillar="rules", model="gpt-4o")
        assert dur_entry["count"] == 1
        assert dur_entry["sum"] == 250.0

    @pytest.mark.asyncio
    async def test_record_llm_call_default_status_ok(self, svc):
        await svc.record_llm_call("rules", "gpt-4o", 100, 50, 0.05, 250.0)
        m_req = svc.registry.get_metric("llm_requests_total")
        assert m_req.get(pillar="rules", model="gpt-4o", status="ok") == 1.0

    @pytest.mark.asyncio
    async def test_record_llm_call_with_error_status(self, svc):
        await svc.record_llm_call("rules", "gpt-4o", 0, 0, 0.0, 100.0, status="error")
        m_req = svc.registry.get_metric("llm_requests_total")
        assert m_req.get(pillar="rules", model="gpt-4o", status="error") == 1.0

    @pytest.mark.asyncio
    async def test_record_llm_call_accumulates(self, svc):
        await svc.record_llm_call("rules", "gpt-4o", 100, 50, 0.05, 250.0)
        await svc.record_llm_call("rules", "gpt-4o", 200, 100, 0.10, 500.0)
        m_req = svc.registry.get_metric("llm_requests_total")
        m_tok = svc.registry.get_metric("llm_tokens_total")
        assert m_req.get(pillar="rules", model="gpt-4o", status="ok") == 2.0
        assert m_tok.get(pillar="rules", model="gpt-4o", type="input") == 300.0
        assert m_tok.get(pillar="rules", model="gpt-4o", type="output") == 150.0

    @pytest.mark.asyncio
    async def test_record_llm_call_handles_exception(self, svc):
        """registry.get_metric 抛异常时不传播(降级,不阻塞业务)。"""
        with patch.object(svc.registry, "get_metric", side_effect=Exception("boom")):
            # 不抛异常
            await svc.record_llm_call("rules", "gpt-4o", 100, 50, 0.05, 250.0)


# ════════════════════════════════════════════════════════════════════════
# 15. record_pillar_event
# ════════════════════════════════════════════════════════════════════════


class TestRecordPillarEvent:
    @pytest.mark.asyncio
    async def test_record_pillar_event_rules_matched(self, svc):
        await svc.record_pillar_event("rules", "matched", scope="global", match_type="exact")
        m = svc.registry.get_metric("rules_matched_total")
        assert m.get(scope="global", match_type="exact") == 1.0

    @pytest.mark.asyncio
    async def test_record_pillar_event_rules_conflicts_changed(self, svc):
        await svc.record_pillar_event("rules", "conflicts_changed", value=3)
        m = svc.registry.get_metric("rules_conflicts_detected")
        assert m.get() == 3.0

    @pytest.mark.asyncio
    async def test_record_pillar_event_hook_execution_done(self, svc):
        await svc.record_pillar_event("hook", "execution_done", value=120.0, action_type="webhook")
        m = svc.registry.get_metric("hooks_execution_duration_ms")
        entry = m.get(action_type="webhook")
        assert entry["count"] == 1
        assert entry["sum"] == 120.0

    @pytest.mark.asyncio
    async def test_record_pillar_event_unregistered_event(self, svc):
        """未注册事件:无异常,无 metric 更新。"""
        await svc.record_pillar_event("rules", "nonexistent_event")
        m = svc.registry.get_metric("rules_matched_total")
        assert m.get(scope="any", match_type="any") == 0.0

    @pytest.mark.asyncio
    async def test_record_pillar_event_handles_handler_exception(self, svc):
        """handler 抛异常时不传播。"""
        def _boom(registry, **labels):
            raise ValueError("boom")

        with patch.dict(ts_module._EVENT_HANDLERS, {("rules", "matched"): _boom}):
            # 不抛异常
            await svc.record_pillar_event("rules", "matched", scope="x", match_type="y")

    @pytest.mark.asyncio
    async def test_record_pillar_event_terminal_sessions_changed(self, svc):
        await svc.record_pillar_event("terminal", "sessions_changed", value=5, kind="bash")
        m = svc.registry.get_metric("terminal_sessions_active")
        assert m.get(kind="bash") == 5.0

    @pytest.mark.asyncio
    async def test_record_pillar_event_hub_event_published_label_collision(self, svc):
        """源码限制:`record_pillar_event(pillar, event_type, **labels)` 的方法签名
        占用了 `event_type` 参数名,与 `hub_events_published_total` 的 `event_type` 标签
        冲突 → Python 在调用解析阶段抛 TypeError(在 try/except 之前,无法捕获)。
        本测试记录该实际行为(源码设计限制,不修改源码)。
        """
        with pytest.raises(TypeError, match="multiple values for argument 'event_type'"):
            await svc.record_pillar_event("hub", "event_published",
                                          event_type="rule.matched", source_pillar="rules")

    @pytest.mark.asyncio
    async def test_record_pillar_event_hub_dispatch_direct(self, svc):
        """绕过 record_pillar_event 直接调用 handler,验证分发表接线正确。"""
        handler = _EVENT_HANDLERS[("hub", "event_published")]
        handler(svc.registry, event_type="rule.matched", source_pillar="rules")
        m = svc.registry.get_metric("hub_events_published_total")
        assert m.get(event_type="rule.matched", source_pillar="rules") == 1.0

    @pytest.mark.asyncio
    async def test_record_pillar_event_budget_usage_changed_label_collision(self, svc):
        """源码限制:`record_pillar_event(pillar, ...)` 的方法签名占用了 `pillar` 参数名,
        与 `budget_usage_percent` 的 `pillar` 标签冲突 → TypeError。
        """
        with pytest.raises(TypeError, match="multiple values for argument 'pillar'"):
            await svc.record_pillar_event("budget", "usage_changed",
                                          value=75.5, pillar="rules", period="daily")

    @pytest.mark.asyncio
    async def test_record_pillar_event_budget_dispatch_direct(self, svc):
        """绕过 record_pillar_event 直接调用 handler,验证分发表接线正确。"""
        handler = _EVENT_HANDLERS[("budget", "usage_changed")]
        handler(svc.registry, value=75.5, pillar="rules", period="daily")
        m = svc.registry.get_metric("budget_usage_percent")
        assert m.get(pillar="rules", period="daily") == 75.5


# ════════════════════════════════════════════════════════════════════════
# 16. start_trace
# ════════════════════════════════════════════════════════════════════════


class TestStartTrace:
    def test_start_trace_returns_trace_context(self, svc):
        ctx = svc.start_trace("rule.match", "rules")
        assert isinstance(ctx, TraceContext)
        assert ctx.span.name == "rule.match"
        assert ctx.span.pillar == "rules"

    def test_start_trace_with_explicit_trace_id(self, svc):
        ctx = svc.start_trace("n", "p", trace_id="explicit-trace")
        assert ctx.span.trace_id == "explicit-trace"

    def test_start_trace_with_parent_span_id(self, svc):
        ctx = svc.start_trace("n", "p", parent_span_id="parent-123")
        assert ctx.span.parent_span_id == "parent-123"

    def test_start_trace_with_attributes(self, svc):
        ctx = svc.start_trace("n", "p", attributes={"k1": "v1"})
        assert ctx.span.attributes == {"k1": "v1"}

    @pytest.mark.asyncio
    async def test_start_trace_full_flow(self, svc):
        async with svc.start_trace("rule.match", "rules",
                                    attributes={"rule_id": "r-001"}) as ctx:
            ctx.add_event("match_done", {"matched": 3})
            ctx.set_attribute("result", "ok")
        assert len(svc._memory_spans) == 1
        stored = svc._memory_spans[0]
        assert stored["name"] == "rule.match"
        assert stored["attributes"]["rule_id"] == "r-001"
        assert stored["attributes"]["result"] == "ok"
        assert len(stored["events"]) == 1
        assert stored["events"][0]["name"] == "match_done"

    @pytest.mark.asyncio
    async def test_start_trace_error_propagates_and_marks_status(self, svc):
        """异常从 with 块向外抛,但 span 仍存储且 status=error。"""
        with pytest.raises(RuntimeError, match="boom"):
            async with svc.start_trace("n", "rules"):
                raise RuntimeError("boom")
        assert len(svc._memory_spans) == 1
        stored = svc._memory_spans[0]
        assert stored["status"] == "error"
        assert stored["attributes"].get("error") == "boom"


# ════════════════════════════════════════════════════════════════════════
# 17. get_trace
# ════════════════════════════════════════════════════════════════════════


class TestGetTrace:
    @pytest.mark.asyncio
    async def test_get_trace_memory_mode(self, svc):
        async with svc.start_trace("n", "rules"):
            pass
        trace_id = svc._memory_spans[0]["trace_id"]
        spans = await svc.get_trace(trace_id)
        assert len(spans) == 1
        assert spans[0]["name"] == "n"

    @pytest.mark.asyncio
    async def test_get_trace_not_found(self, svc):
        spans = await svc.get_trace("nonexistent-trace")
        assert spans == []

    @pytest.mark.asyncio
    async def test_get_trace_redis_path(self):
        svc = TelemetryService()
        mock_redis = _make_redis_mock()
        span_dict = {"trace_id": "t1", "span_id": "s1", "name": "n", "start_time": 1.0}
        mock_redis.lrange = AsyncMock(return_value=[json.dumps(span_dict)])
        svc.set_redis_client(mock_redis)
        spans = await svc.get_trace("t1")
        mock_redis.lrange.assert_awaited_once_with(f"{REDIS_TRACES_KEY_PREFIX}t1", 0, -1)
        assert len(spans) == 1
        assert spans[0]["name"] == "n"

    @pytest.mark.asyncio
    async def test_get_trace_redis_skips_invalid_json(self):
        svc = TelemetryService()
        mock_redis = _make_redis_mock()
        mock_redis.lrange = AsyncMock(return_value=[
            "not-json",
            '{"trace_id":"t1","span_id":"s1","start_time":1}',
        ])
        svc.set_redis_client(mock_redis)
        spans = await svc.get_trace("t1")
        assert len(spans) == 1  # 跳过无效 JSON

    @pytest.mark.asyncio
    async def test_get_trace_redis_failure_falls_back_to_memory(self):
        svc = TelemetryService()
        mock_redis = _make_redis_mock()
        mock_redis.lrange = AsyncMock(side_effect=Exception("redis down"))
        svc.set_redis_client(mock_redis)
        svc._memory_spans.append({"trace_id": "t1", "span_id": "s1",
                                   "name": "n", "start_time": 1.0})
        spans = await svc.get_trace("t1")
        assert len(spans) == 1

    @pytest.mark.asyncio
    async def test_get_trace_dedup_by_span_id(self, svc):
        svc._memory_spans.append({"trace_id": "t1", "span_id": "s1",
                                   "name": "n1", "start_time": 1.0})
        svc._memory_spans.append({"trace_id": "t1", "span_id": "s1",
                                   "name": "n2", "start_time": 2.0})
        spans = await svc.get_trace("t1")
        assert len(spans) == 1  # 同 span_id 去重

    @pytest.mark.asyncio
    async def test_get_trace_sorted_by_start_time(self, svc):
        svc._memory_spans.append({"trace_id": "t1", "span_id": "s2",
                                   "name": "later", "start_time": 2.0})
        svc._memory_spans.append({"trace_id": "t1", "span_id": "s1",
                                   "name": "earlier", "start_time": 1.0})
        spans = await svc.get_trace("t1")
        assert len(spans) == 2
        assert spans[0]["name"] == "earlier"
        assert spans[1]["name"] == "later"


# ════════════════════════════════════════════════════════════════════════
# 18. get_recent_traces
# ════════════════════════════════════════════════════════════════════════


class TestGetRecentTraces:
    @pytest.mark.asyncio
    async def test_get_recent_traces_empty(self, svc):
        assert await svc.get_recent_traces() == []

    @pytest.mark.asyncio
    async def test_get_recent_traces_memory_mode_descending(self, svc):
        svc._memory_trace_roots.append({"trace_id": "t1", "name": "n1", "start_time": 1.0})
        svc._memory_trace_roots.append({"trace_id": "t2", "name": "n2", "start_time": 2.0})
        result = await svc.get_recent_traces()
        assert len(result) == 2
        # 倒序:start_time 大的在前
        assert result[0]["trace_id"] == "t2"
        assert result[1]["trace_id"] == "t1"

    @pytest.mark.asyncio
    async def test_get_recent_traces_limit(self, svc):
        for i in range(5):
            svc._memory_trace_roots.append({
                "trace_id": f"t{i}", "name": f"n{i}", "start_time": float(i),
            })
        result = await svc.get_recent_traces(limit=3)
        assert len(result) == 3
        # 倒序,前 3 个:start_time = 4, 3, 2
        assert result[0]["trace_id"] == "t4"
        assert result[2]["trace_id"] == "t2"

    @pytest.mark.asyncio
    async def test_get_recent_traces_redis_path(self):
        svc = TelemetryService()
        mock_redis = _make_redis_mock()
        mock_redis.lrange = AsyncMock(return_value=[
            json.dumps({"trace_id": "t1", "name": "n1", "start_time": 1.0}),
        ])
        svc.set_redis_client(mock_redis)
        result = await svc.get_recent_traces(limit=10)
        mock_redis.lrange.assert_awaited_once_with(REDIS_TRACE_ROOTS_KEY, 0, 9)
        assert len(result) == 1

    @pytest.mark.asyncio
    async def test_get_recent_traces_redis_skips_invalid_json(self):
        svc = TelemetryService()
        mock_redis = _make_redis_mock()
        mock_redis.lrange = AsyncMock(return_value=[
            "not-json",
            json.dumps({"trace_id": "t1", "start_time": 1.0}),
        ])
        svc.set_redis_client(mock_redis)
        result = await svc.get_recent_traces()
        assert len(result) == 1

    @pytest.mark.asyncio
    async def test_get_recent_traces_redis_failure_falls_back_to_memory(self):
        svc = TelemetryService()
        mock_redis = _make_redis_mock()
        mock_redis.lrange = AsyncMock(side_effect=Exception("redis down"))
        svc.set_redis_client(mock_redis)
        svc._memory_trace_roots.append({"trace_id": "t1", "start_time": 1.0})
        result = await svc.get_recent_traces()
        assert len(result) == 1

    @pytest.mark.asyncio
    async def test_get_recent_traces_dedup_by_trace_id(self, svc):
        svc._memory_trace_roots.append({"trace_id": "t1", "name": "n1", "start_time": 1.0})
        svc._memory_trace_roots.append({"trace_id": "t1", "name": "n1", "start_time": 2.0})
        result = await svc.get_recent_traces()
        assert len(result) == 1  # 同 trace_id 去重


# ════════════════════════════════════════════════════════════════════════
# 19. get_metrics
# ════════════════════════════════════════════════════════════════════════


class TestGetMetrics:
    @pytest.mark.asyncio
    async def test_get_metrics_json_default(self, svc):
        result = await svc.get_metrics()
        assert isinstance(result, dict)
        assert "llm_requests_total" in result

    @pytest.mark.asyncio
    async def test_get_metrics_json_explicit(self, svc):
        result = await svc.get_metrics(format="json")
        assert isinstance(result, dict)

    @pytest.mark.asyncio
    async def test_get_metrics_prometheus(self, svc):
        result = await svc.get_metrics(format="prometheus")
        assert isinstance(result, str)
        assert "# TYPE llm_requests_total counter" in result


# ════════════════════════════════════════════════════════════════════════
# 20. get_pillar_health
# ════════════════════════════════════════════════════════════════════════


class TestGetPillarHealth:
    @pytest.mark.asyncio
    async def test_get_pillar_health_no_data_unknown(self, svc):
        result = await svc.get_pillar_health()
        assert set(result.keys()) == set(PILLARS)
        for pillar in PILLARS:
            assert result[pillar]["status"] == "unknown"
            assert result[pillar]["key_metrics"] == {}

    @pytest.mark.asyncio
    async def test_get_pillar_health_healthy_with_llm_success(self, svc):
        await svc.record_llm_call("rules", "gpt-4o", 100, 50, 0.05, 250.0)
        result = await svc.get_pillar_health()
        assert result["rules"]["status"] == "healthy"

    @pytest.mark.asyncio
    async def test_get_pillar_health_degraded_with_llm_error(self, svc):
        await svc.record_llm_call("rules", "gpt-4o", 0, 0, 0.0, 100.0, status="error")
        result = await svc.get_pillar_health()
        assert result["rules"]["status"] == "degraded"

    @pytest.mark.asyncio
    async def test_get_pillar_health_with_unlabeled_gauge_no_llm_healthy(self, svc):
        """gauge 有数据但无 LLM 调用 → healthy(key_metrics 非空 + 无 error)。"""
        await svc.record_pillar_event("rules", "conflicts_changed", value=3)
        result = await svc.get_pillar_health()
        assert result["rules"]["status"] == "healthy"
        assert "rules_conflicts_detected" in result["rules"]["key_metrics"]
        assert result["rules"]["key_metrics"]["rules_conflicts_detected"] == 3.0

    @pytest.mark.asyncio
    async def test_get_pillar_health_labeled_gauge_branch(self, svc):
        """带标签 gauge:取所有 label 组合为 dict(else 分支)。"""
        test_gauge = svc.registry.gauge("test_labeled_gauge", "test", ["kind"])
        test_gauge.set(5, kind="a")
        test_gauge.set(10, kind="b")
        original = svc._pillar_status_gauges

        def patched(p):
            if p == "rules":
                return ["test_labeled_gauge"]
            return original(p)

        with patch.object(svc, "_pillar_status_gauges", side_effect=patched):
            result = await svc.get_pillar_health()
        assert "test_labeled_gauge" in result["rules"]["key_metrics"]
        assert result["rules"]["key_metrics"]["test_labeled_gauge"] == {"a": 5.0, "b": 10.0}

    @pytest.mark.asyncio
    async def test_get_pillar_health_terminal_has_no_gauges(self, svc):
        result = await svc.get_pillar_health()
        assert result["terminal"]["key_metrics"] == {}


# ════════════════════════════════════════════════════════════════════════
# 21. _pillar_status_gauges
# ════════════════════════════════════════════════════════════════════════


class TestPillarStatusGauges:
    def test_rules_gauges(self, svc):
        result = svc._pillar_status_gauges("rules")
        assert "rules_conflicts_detected" in result
        assert "rules_knowledge_graph_nodes" in result

    def test_hook_gauges(self, svc):
        assert svc._pillar_status_gauges("hook") == ["hooks_ab_test_active"]

    def test_spec_gauges(self, svc):
        result = svc._pillar_status_gauges("spec")
        assert "specs_review_pending" in result
        assert "specs_watch_active" in result

    def test_context_gauges(self, svc):
        result = svc._pillar_status_gauges("context")
        assert "context_active_sessions" in result
        assert "context_behavior_records" in result

    def test_subagent_gauges(self, svc):
        result = svc._pillar_status_gauges("subagent")
        assert "subagents_active" in result
        assert "subagent_evolution_records" in result

    def test_terminal_gauges_empty(self, svc):
        assert svc._pillar_status_gauges("terminal") == []

    def test_unknown_pillar_returns_empty(self, svc):
        assert svc._pillar_status_gauges("unknown") == []


# ════════════════════════════════════════════════════════════════════════
# 22. get_dashboard
# ════════════════════════════════════════════════════════════════════════


class TestGetDashboard:
    @pytest.mark.asyncio
    async def test_get_dashboard_memory_mode(self, svc):
        result = await svc.get_dashboard()
        assert "system_overview" in result
        assert "metrics_summary" in result
        assert "pillar_health" in result
        assert "recent_traces" in result
        assert result["system_overview"]["redis_enabled"] is False
        assert result["system_overview"]["pillars"] == list(PILLARS)
        assert result["system_overview"]["metrics_count"] >= 30

    @pytest.mark.asyncio
    async def test_get_dashboard_redis_mode(self):
        svc = TelemetryService()
        mock_redis = _make_redis_mock()
        mock_redis.llen = AsyncMock(return_value=5)
        svc.set_redis_client(mock_redis)
        result = await svc.get_dashboard()
        assert result["system_overview"]["redis_enabled"] is True
        # max(memory_spans=0, root_count=5)
        assert result["system_overview"]["spans_stored"] == 5

    @pytest.mark.asyncio
    async def test_get_dashboard_metrics_summary(self, svc):
        result = await svc.get_dashboard()
        for name, info in result["metrics_summary"].items():
            assert "type" in info
            assert "label_count" in info

    @pytest.mark.asyncio
    async def test_get_dashboard_redis_llen_failure(self):
        svc = TelemetryService()
        mock_redis = _make_redis_mock()
        mock_redis.llen = AsyncMock(side_effect=Exception("redis down"))
        svc.set_redis_client(mock_redis)
        result = await svc.get_dashboard()
        # 异常被吞,spans_stored 用 memory_spans 长度
        assert result["system_overview"]["spans_stored"] == 0

    @pytest.mark.asyncio
    async def test_get_dashboard_with_spans(self, svc):
        async with svc.start_trace("n1", "rules"):
            pass
        async with svc.start_trace("n2", "hook"):
            pass
        result = await svc.get_dashboard()
        assert result["system_overview"]["spans_stored"] == 2
        assert len(result["recent_traces"]) == 2


# ════════════════════════════════════════════════════════════════════════
# 23. 事件分发表
# ════════════════════════════════════════════════════════════════════════


class TestEventHandlers:
    def test_h_counter_inc_existing_metric(self):
        r = MetricsRegistry()
        r.counter("c1", "h", ["a"])
        _h_counter_inc(r, "c1", a="x")
        assert r.get_metric("c1").get(a="x") == 1.0

    def test_h_counter_inc_missing_metric(self):
        r = MetricsRegistry()
        # metric 不存在 → 静默(不抛异常)
        _h_counter_inc(r, "missing", a="x")

    def test_h_gauge_set_existing_metric(self):
        r = MetricsRegistry()
        r.gauge("g1", "h", ["a"])
        _h_gauge_set(r, "g1", value=42, a="x")
        assert r.get_metric("g1").get(a="x") == 42.0

    def test_h_gauge_set_default_value(self):
        r = MetricsRegistry()
        r.gauge("g1", "h", [])
        _h_gauge_set(r, "g1")
        assert r.get_metric("g1").get() == 0.0

    def test_h_gauge_set_missing_metric(self):
        r = MetricsRegistry()
        _h_gauge_set(r, "missing", value=1)

    def test_h_histogram_observe_existing_metric(self):
        r = MetricsRegistry()
        r.histogram("h1", "h", ["a"])
        _h_histogram_observe(r, "h1", value=42, a="x")
        entry = r.get_metric("h1").get(a="x")
        assert entry["count"] == 1
        assert entry["sum"] == 42.0

    def test_h_histogram_observe_default_value(self):
        r = MetricsRegistry()
        r.histogram("h1", "h", [])
        _h_histogram_observe(r, "h1")
        entry = r.get_metric("h1").get()
        assert entry["count"] == 1
        assert entry["sum"] == 0.0

    def test_h_histogram_observe_missing_metric(self):
        r = MetricsRegistry()
        _h_histogram_observe(r, "missing", value=1)

    def test_event_handlers_count(self):
        # 32 个事件分发项(6 支柱 + Hub + Budget)
        assert len(_EVENT_HANDLERS) >= 30

    def test_event_handlers_cover_all_pillars(self):
        pillars = {p for p, _ in _EVENT_HANDLERS.keys()}
        for p in ("rules", "hook", "spec", "context", "subagent", "terminal", "hub", "budget"):
            assert p in pillars


# ════════════════════════════════════════════════════════════════════════
# 24. 模块级单例
# ════════════════════════════════════════════════════════════════════════


class TestModuleSingleton:
    def test_singleton_is_telemetry_service(self):
        assert isinstance(telemetry_service, TelemetryService)

    def test_singleton_has_registry(self):
        assert isinstance(telemetry_service.registry, MetricsRegistry)

    def test_singleton_has_metrics_registered(self):
        assert telemetry_service.registry.get_metric("llm_requests_total") is not None
