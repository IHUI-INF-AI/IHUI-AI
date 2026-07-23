"""统一遥测服务 — 6 大超越支柱的 Prometheus metrics + 分布式 trace。

6 大支柱各有自己的 stats(rules get_rule_stats / hook get_stats / context compression_stats /
subagent dispatch_stats),但无统一导出、无分布式 tracing。本模块提供:

1. 统一 metrics 收集:MetricsRegistry(轻量自实现,不依赖 prometheus_client)
   - Counter(只增不减)/ Gauge(可增可减)/ Histogram(分布 + buckets)
   - export_prometheus() 生成 Prometheus 文本格式(/metrics 端点用)
   - get_all_metrics() JSON 格式(供 API 查询)
2. 分布式 trace:TraceContext(async with,纯 Python 自实现,不依赖 OpenTelemetry SDK)
   - span 存入 Redis list hub:traces:{trace_id}(TTL 1h),Redis 不可用降级内存 deque
3. TelemetryService:统一入口,预置 ~40 个 metrics,提供 record_llm_call /
   record_pillar_event / start_trace / get_trace / get_dashboard 等方法

模块级单例:telemetry_service(供 6 大支柱 import 后直接调用)。
"""

from __future__ import annotations

import json
import logging
import time
import uuid
from collections import deque
from dataclasses import dataclass, field
from typing import Any, Optional

logger = logging.getLogger(__name__)

# redis 包未安装时降级为纯内存模式(与 hook_engine.py / agent_checkpoint.py 一致)
try:
    import redis.asyncio as aioredis  # type: ignore[import-not-found]
except ImportError:
    aioredis = None  # type: ignore[assignment]

# ====================== 常量 ======================

# Redis trace 存储 key 前缀(2026-07-23 立)
REDIS_TRACES_KEY_PREFIX = "hub:traces:"  # + trace_id(Redis list,每个元素是一个 span JSON)
REDIS_TRACE_ROOTS_KEY = "hub:traces:_roots"  # Redis list,所有 trace 根 span 摘要(用于 get_recent_traces)
REDIS_TRACE_TTL = 3600  # 1 小时(秒)
MEMORY_SPANS_MAX = 5000  # 内存降级时保留最近 5000 个 span
MEMORY_TRACE_ROOTS_MAX = 200  # 内存降级时保留最近 200 个根 span

# Histogram 默认 buckets(单位:ms)
DEFAULT_HISTOGRAM_BUCKETS_MS = (1, 5, 10, 25, 50, 100, 250, 500, 1000, 2500, 5000, 10000)

# 支柱列表(用于 get_pillar_health / get_dashboard)
PILLARS = ("rules", "hook", "spec", "context", "subagent", "terminal")


# ====================== Metrics 数据模型 ======================


class Metric:
    """单个 metric 定义(基类)。

    Attributes:
        name: metric 名(如 llm_requests_total)
        type: counter / gauge / histogram
        help: 帮助文本
        labels: 标签名列表(如 ["pillar", "model", "status"])
        values: 标签值元组 → 数值(或 histogram 聚合结构)
    """

    def __init__(self, name: str, metric_type: str, help: str, labels: list[str]) -> None:
        self.name = name
        self.type = metric_type
        self.help = help
        self.labels = list(labels)
        self.values: dict[tuple, Any] = {}

    def _label_key(self, **labels) -> tuple:
        """把 kwargs 转成与 self.labels 顺序一致的 tuple(缺失标签默认空串)。"""
        return tuple(str(labels.get(name, "")) for name in self.labels)


class Counter(Metric):
    """Counter — 只增不减(如 request_count)。"""

    def __init__(self, name: str, help: str, labels: list[str]) -> None:
        super().__init__(name, "counter", help, labels)

    def inc(self, value: float = 1.0, **labels) -> None:
        """增加 value(默认 1)。"""
        key = self._label_key(**labels)
        self.values[key] = self.values.get(key, 0.0) + float(value)

    def get(self, **labels) -> float:
        """读取当前值。"""
        return float(self.values.get(self._label_key(**labels), 0.0))


class Gauge(Metric):
    """Gauge — 可增可减(如 active_sessions)。"""

    def __init__(self, name: str, help: str, labels: list[str]) -> None:
        super().__init__(name, "gauge", help, labels)

    def set(self, value: float, **labels) -> None:
        """设置为 value。"""
        self.values[self._label_key(**labels)] = float(value)

    def inc(self, value: float = 1.0, **labels) -> None:
        """增加 value。"""
        key = self._label_key(**labels)
        self.values[key] = float(self.values.get(key, 0.0)) + value

    def dec(self, value: float = 1.0, **labels) -> None:
        """减少 value。"""
        key = self._label_key(**labels)
        self.values[key] = float(self.values.get(key, 0.0)) - value

    def get(self, **labels) -> float:
        return float(self.values.get(self._label_key(**labels), 0.0))


class Histogram(Metric):
    """Histogram — 分布(如 latency_ms,buckets)。

    values 结构:label_tuple -> {"buckets": [counts], "sum": float, "count": int}
    """

    def __init__(self, name: str, help: str, labels: list[str],
                 buckets: Optional[tuple] = None) -> None:
        super().__init__(name, "histogram", help, labels)
        self.buckets = tuple(buckets) if buckets else DEFAULT_HISTOGRAM_BUCKETS_MS

    def observe(self, value: float, **labels) -> None:
        """观察一个值(更新 buckets / sum / count)。"""
        key = self._label_key(**labels)
        entry = self.values.get(key)
        if entry is None:
            entry = {"buckets": [0] * len(self.buckets), "sum": 0.0, "count": 0}
            self.values[key] = entry
        # 累积 bucket:每个 <= bound 的计数 +1(Prometheus histogram 语义)
        for i, bound in enumerate(self.buckets):
            if value <= bound:
                entry["buckets"][i] += 1
        entry["sum"] += float(value)
        entry["count"] += 1

    def get(self, **labels) -> dict:
        """读取当前聚合结构(无数据返回空结构)。"""
        key = self._label_key(**labels)
        return self.values.get(
            key,
            {"buckets": [0] * len(self.buckets), "sum": 0.0, "count": 0},
        )


# ====================== Prometheus 格式化辅助 ======================


def _format_value(value: float) -> str:
    """格式化数值(整数无小数点,浮点用 %g 去尾零)。"""
    if isinstance(value, int):
        return str(value)
    if isinstance(value, float) and value.is_integer():
        return str(int(value))
    return f"{value:.6g}"


def _format_labels(label_names: list[str], label_values: tuple) -> str:
    """格式化 Prometheus 标签段。无标签返回空串。"""
    if not label_names:
        return ""
    parts = []
    for name, val in zip(label_names, label_values):
        # 转义 label value 中的特殊字符(Prometheus 规范:\ -> \\, " -> \")
        escaped = str(val).replace("\\", "\\\\").replace('"', '\\"')
        parts.append(f'{name}="{escaped}"')
    return "{" + ",".join(parts) + "}"


def _merge_le_label(existing_labels: str, le_value: Any) -> str:
    """把 le="..." 标签合并到现有 labels 段。

    existing_labels 为 "" 或 '{a="x"}',返回 '{a="x",le="y"}' 或 '{le="y"}'。
    """
    le_str = str(le_value)
    if not existing_labels:
        return f'{{le="{le_str}"}}'
    # existing_labels 形如 {a="x",b="y"},在 } 前插入 ,le="..."
    return existing_labels[:-1] + f',le="{le_str}"}}'


# ====================== MetricsRegistry ======================


class MetricsRegistry:
    """Metrics 注册表 — 轻量级自实现(不依赖 prometheus_client)。"""

    def __init__(self) -> None:
        self._metrics: dict[str, Metric] = {}

    def counter(self, name: str, help: str, labels: Optional[list[str]] = None) -> Counter:
        """注册 counter。重复注册返回已有的(幂等)。"""
        existing = self._metrics.get(name)
        if existing is not None:
            return existing  # type: ignore[return-value]
        m = Counter(name, help, labels or [])
        self._metrics[name] = m
        return m

    def gauge(self, name: str, help: str, labels: Optional[list[str]] = None) -> Gauge:
        """注册 gauge。"""
        existing = self._metrics.get(name)
        if existing is not None:
            return existing  # type: ignore[return-value]
        m = Gauge(name, help, labels or [])
        self._metrics[name] = m
        return m

    def histogram(self, name: str, help: str, labels: Optional[list[str]] = None,
                  buckets: Optional[tuple] = None) -> Histogram:
        """注册 histogram。"""
        existing = self._metrics.get(name)
        if existing is not None:
            return existing  # type: ignore[return-value]
        m = Histogram(name, help, labels or [], buckets=buckets)
        self._metrics[name] = m
        return m

    def get_metric(self, name: str) -> Optional[Metric]:
        """按名取 metric,不存在返回 None。"""
        return self._metrics.get(name)

    def export_prometheus(self) -> str:
        """导出 Prometheus 文本格式。

        格式(每行):
            # HELP {name} {help}
            # TYPE {name} {type}
            {name}{labels} {value}

        histogram 额外导出 _bucket{le="..."} / _sum / _count 系列行
        (累积 bucket + +Inf bucket = 总 count,符合 Prometheus 规范)。
        """
        lines: list[str] = []
        for name in sorted(self._metrics.keys()):
            m = self._metrics[name]
            lines.append(f"# HELP {m.name} {m.help}")
            lines.append(f"# TYPE {m.name} {m.type}")
            if isinstance(m, Histogram):
                for label_values, entry in m.values.items():
                    lbl = _format_labels(m.labels, label_values)
                    for i, bound in enumerate(m.buckets):
                        bucket_le = _merge_le_label(lbl, bound)
                        lines.append(f'{m.name}_bucket{bucket_le} {entry["buckets"][i]}')
                    # +Inf bucket(总 count)
                    bucket_inf = _merge_le_label(lbl, "+Inf")
                    lines.append(f'{m.name}_bucket{bucket_inf} {entry["count"]}')
                    lines.append(f'{m.name}_sum{lbl} {_format_value(entry["sum"])}')
                    lines.append(f'{m.name}_count{lbl} {entry["count"]}')
            else:
                # counter / gauge:每个 label 组合一行
                for label_values, value in m.values.items():
                    lbl = _format_labels(m.labels, label_values)
                    lines.append(f"{m.name}{lbl} {_format_value(value)}")
        return "\n".join(lines) + ("\n" if lines else "")

    def get_all_metrics(self) -> dict:
        """JSON 格式(供 API 查询)。"""
        result: dict[str, Any] = {}
        for name, m in self._metrics.items():
            if isinstance(m, Histogram):
                result[name] = {
                    "type": "histogram",
                    "help": m.help,
                    "labels": m.labels,
                    "buckets": list(m.buckets),
                    "values": {
                        ",".join(k): v for k, v in m.values.items()
                    },
                }
            else:
                result[name] = {
                    "type": m.type,
                    "help": m.help,
                    "labels": m.labels,
                    "values": {
                        ",".join(k): v for k, v in m.values.items()
                    },
                }
        return result


# ====================== Trace:Span + TraceContext ======================


@dataclass
class Span:
    """单个 trace span。

    Attributes:
        trace_id: 全局 trace ID(同一 trace 所有 span 共享)
        span_id: 当前 span ID
        parent_span_id: 父 span ID(根 span 为 "")
        name: span 名称
        pillar: 来源支柱(如 rules/hook/context/subagent/terminal/spec/hub)
        start_time: 开始时间(time.monotonic 秒)
        end_time: 结束时间(monotonic 秒,0 表示未结束)
        duration_ms: 耗时(毫秒)
        attributes: 自定义属性
        status: ok / error
        events: 事件列表 [{"name": ..., "attributes": {...}, "timestamp": ...}]
    """

    trace_id: str
    span_id: str
    parent_span_id: str
    name: str
    pillar: str
    start_time: float
    end_time: float = 0.0
    duration_ms: float = 0.0
    attributes: dict[str, Any] = field(default_factory=dict)
    status: str = "ok"
    events: list[dict[str, Any]] = field(default_factory=list)

    def to_dict(self) -> dict[str, Any]:
        """序列化为 dict(供 Redis 存储 / API 返回)。"""
        return {
            "trace_id": self.trace_id,
            "span_id": self.span_id,
            "parent_span_id": self.parent_span_id,
            "name": self.name,
            "pillar": self.pillar,
            "start_time": self.start_time,
            "end_time": self.end_time,
            "duration_ms": self.duration_ms,
            "attributes": self.attributes,
            "status": self.status,
            "events": self.events,
        }


def _gen_trace_id() -> str:
    """生成 32 位 hex trace ID(与 W3C traceparent 兼容)。"""
    return uuid.uuid4().hex


def _gen_span_id() -> str:
    """生成 16 位 hex span ID(与 W3C traceparent 兼容)。"""
    return uuid.uuid4().hex[:16]


class TraceContext:
    """分布式 trace 上下文管理器(用 async with)。

    用法::

        async with telemetry_service.start_trace("rule.match", "rules") as ctx:
            ctx.set_attribute("rule_id", "r-001")
            # ... 业务逻辑 ...
            ctx.add_event("match_done", {"matched": 3})

    退出时自动把 span 存入 Redis list hub:traces:{trace_id}(TTL 1h);
    Redis 不可用时降级到内存 deque(最近 5000 个 span)。
    """

    def __init__(self, telemetry: "TelemetryService", name: str, pillar: str,
                 trace_id: Optional[str] = None, parent_span_id: Optional[str] = None,
                 attributes: Optional[dict] = None) -> None:
        self._telemetry = telemetry
        self.span = Span(
            trace_id=trace_id or _gen_trace_id(),
            span_id=_gen_span_id(),
            parent_span_id=parent_span_id or "",
            name=name,
            pillar=pillar,
            start_time=0.0,
            attributes=dict(attributes) if attributes else {},
        )

    async def __aenter__(self) -> "TraceContext":
        """开始 span,记录 start_time。如果 trace_id 为 None,已在外部生成新的。"""
        self.span.start_time = time.monotonic()
        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb) -> None:
        """结束 span,记录 end_time + duration_ms + status,存入 Redis/内存。"""
        self.span.end_time = time.monotonic()
        self.span.duration_ms = (self.span.end_time - self.span.start_time) * 1000.0
        if exc_type is not None:
            self.span.status = "error"
            self.span.attributes.setdefault("error", str(exc_val))
        await self._telemetry._store_span(self.span)

    def add_event(self, name: str, attributes: Optional[dict] = None) -> None:
        """添加事件到当前 span。"""
        self.span.events.append({
            "name": name,
            "attributes": dict(attributes) if attributes else {},
            "timestamp": time.monotonic(),
        })

    def set_attribute(self, key: str, value: Any) -> None:
        """设置 span 属性。"""
        self.span.attributes[key] = value


# ====================== TelemetryService ======================


class TelemetryService:
    """统一遥测服务 — metrics + trace。

    单例 telemetry_service(模块级),供 6 大支柱 import 后直接调用。
    Redis 可用时持久化 trace span(TTL 1h),降级内存 deque(最近 5000 个)。
    """

    def __init__(self) -> None:
        self.registry = MetricsRegistry()
        self._redis: Any = None
        self._use_redis = True  # 默认尝试,首次 _ensure_redis 失败置 False
        self._memory_spans: deque = deque(maxlen=MEMORY_SPANS_MAX)
        # trace_id -> 根 span 摘要(用于 get_recent_traces)
        self._memory_trace_roots: deque = deque(maxlen=MEMORY_TRACE_ROOTS_MAX)
        self._init_metrics()

    # ---------- Metrics 注册 ----------

    def _init_metrics(self) -> None:
        """注册所有预置 metrics(~40 个,6 大支柱 + 通用 LLM + Hub + Budget)。"""
        r = self.registry

        # 通用 LLM
        r.counter("llm_requests_total", "LLM 请求总数", ["pillar", "model", "status"])
        r.counter("llm_tokens_total", "LLM Token 总数", ["pillar", "model", "type"])
        r.counter("llm_cost_usd_total", "LLM 成本累计(USD)", ["pillar", "model"])
        r.histogram("llm_request_duration_ms", "LLM 请求耗时(ms)", ["pillar", "model"])

        # Rules 支柱
        r.counter("rules_matched_total", "规则匹配次数", ["scope", "match_type"])
        r.counter("rules_auto_generated_total", "自动生成规则数", ["status"])
        r.gauge("rules_conflicts_detected", "当前规则冲突数", [])
        r.gauge("rules_knowledge_graph_nodes", "知识图谱节点数", [])

        # Hook 支柱
        r.counter("hooks_emitted_total", "Hook 触发次数", ["event", "action_type", "status"])
        r.histogram("hooks_execution_duration_ms", "Hook 执行耗时(ms)", ["action_type"])
        r.gauge("hooks_dlq_size", "Hook DLQ 大小", ["hook_id"])
        r.gauge("hooks_health_status", "Hook 健康状态(1=healthy/0.5=degraded/0=unhealthy)", ["hook_id", "status"])
        r.gauge("hooks_ab_test_active", "活跃 A/B 测试数", [])

        # Spec 支柱
        r.counter("specs_generated_total", "Spec 生成次数", ["scope_type"])
        r.gauge("specs_review_pending", "Spec 待评审数", [])
        r.counter("specs_patch_applied_total", "Spec Patch 应用次数", ["status"])
        r.gauge("specs_watch_active", "Spec Watch 活跃状态", [])

        # Context 支柱
        r.counter("context_compressions_total", "上下文压缩次数", ["status"])
        r.histogram("context_compression_ratio", "上下文压缩比", [])
        r.histogram("context_compression_quality", "上下文压缩质量分", [])
        r.counter("context_rag_retrievals_total", "RAG 检索次数", ["source", "status"])
        r.gauge("context_active_sessions", "活跃会话数", [])
        r.gauge("context_behavior_records", "行为记录数", [])

        # Subagent 支柱
        r.counter("subagents_dispatched_total", "Subagent 派发次数", ["mode", "status"])
        r.gauge("subagents_active", "活跃 Subagent 数", [])
        r.histogram("subagent_dispatch_duration_ms", "Subagent 派发耗时(ms)", ["mode"])
        r.gauge("subagent_evolution_records", "Subagent 演化记录数", [])
        r.counter("subagent_collaboration_messages", "Subagent 协作消息数", ["type"])

        # Terminal 支柱
        r.gauge("terminal_sessions_active", "终端活跃会话数", ["kind"])
        r.counter("terminal_ai_suggestions_total", "终端 AI 辅助次数", ["action", "status"])
        r.counter("terminal_recordings_total", "终端录制次数", [])
        r.counter("terminal_command_failures", "终端命令失败次数", [])

        # 编排中枢 Hub
        r.counter("hub_events_published_total", "Hub 事件发布数", ["event_type", "source_pillar"])
        r.counter("hub_decisions_total", "Hub 决策数", ["playbook_id", "status"])
        r.histogram("hub_decision_duration_ms", "Hub 决策耗时(ms)", [])

        # 预算
        r.gauge("budget_usage_percent", "预算使用率(%)", ["pillar", "period"])
        r.gauge("budget_degraded_models", "降级模型数", ["pillar"])

    # ---------- Redis ----------

    async def _ensure_redis(self) -> Any:
        """确保 Redis 客户端可用,惰性从 settings.redis_url 创建(失败降级内存)。"""
        if self._redis is not None:
            return self._redis
        if not self._use_redis:
            return None
        try:
            from ..core.config import settings

            if not settings.redis_url or aioredis is None:
                self._use_redis = False
                return None
            self._redis = aioredis.from_url(settings.redis_url, decode_responses=True)
            await self._redis.ping()
            self._use_redis = True
            logger.info("[telemetry] Redis 已连接,trace span 持久化启用")
        except Exception as e:
            logger.warning("[telemetry] Redis 不可用,trace span 降级内存: %s", e)
            self._use_redis = False
            self._redis = None
            return None
        return self._redis

    def set_redis_client(self, client: Any) -> None:
        """注入 Redis 客户端(供 main.py lifespan 或测试调用)。"""
        self._redis = client
        self._use_redis = client is not None

    # ---------- Trace span 存储 ----------

    async def _store_span(self, span: Span) -> None:
        """存储 span:Redis list hub:traces:{trace_id}(TTL 1h),失败降级内存 deque。"""
        span_dict = span.to_dict()
        redis = await self._ensure_redis()
        if redis is not None:
            try:
                key = f"{REDIS_TRACES_KEY_PREFIX}{span.trace_id}"
                await redis.rpush(key, json.dumps(span_dict))
                await redis.expire(key, REDIS_TRACE_TTL)
                # 根 span 同步记录到 _roots 列表(用于 get_recent_traces)
                if not span.parent_span_id:
                    await self._record_trace_root(span_dict, redis)
                return
            except Exception as e:
                logger.warning("[telemetry] Redis 存 span 失败,降级内存: %s", e)
        # 内存降级
        self._memory_spans.append(span_dict)
        if not span.parent_span_id:
            self._memory_trace_roots.append(span_dict)

    async def _record_trace_root(self, span_dict: dict, redis: Any) -> None:
        """记录 trace 根 span 摘要到 Redis list(用于 get_recent_traces)。"""
        try:
            summary = {
                "trace_id": span_dict["trace_id"],
                "name": span_dict["name"],
                "pillar": span_dict["pillar"],
                "start_time": span_dict["start_time"],
                "duration_ms": span_dict["duration_ms"],
                "status": span_dict["status"],
            }
            await redis.lpush(REDIS_TRACE_ROOTS_KEY, json.dumps(summary))
            await redis.ltrim(REDIS_TRACE_ROOTS_KEY, 0, MEMORY_TRACE_ROOTS_MAX - 1)
            await redis.expire(REDIS_TRACE_ROOTS_KEY, REDIS_TRACE_TTL)
        except Exception as e:
            logger.warning("[telemetry] 记录 trace root 失败(忽略): %s", e)

    # ---------- 公共 API:LLM 调用 ----------

    async def record_llm_call(self, pillar: str, model: str, input_tokens: int,
                              output_tokens: int, cost_usd: float, duration_ms: float,
                              status: str = "ok") -> None:
        """记录一次 LLM 调用(更新所有 LLM 相关 metrics)。

        Args:
            pillar: 调用方支柱(如 rules/hook/context/subagent/terminal/spec/hub)
            model: 模型名(如 gpt-4o / claude-3-5-sonnet)
            input_tokens: 输入 token 数
            output_tokens: 输出 token 数
            cost_usd: 本次调用成本(USD)
            duration_ms: 耗时(毫秒)
            status: ok / error
        """
        try:
            m_req = self.registry.get_metric("llm_requests_total")
            m_tok = self.registry.get_metric("llm_tokens_total")
            m_cost = self.registry.get_metric("llm_cost_usd_total")
            m_dur = self.registry.get_metric("llm_request_duration_ms")
            if m_req is not None:
                m_req.inc(pillar=pillar, model=model, status=status)  # type: ignore[union-attr]
            if m_tok is not None:
                m_tok.inc(input_tokens, pillar=pillar, model=model, type="input")  # type: ignore[union-attr]
                m_tok.inc(output_tokens, pillar=pillar, model=model, type="output")  # type: ignore[union-attr]
            if m_cost is not None:
                m_cost.inc(cost_usd, pillar=pillar, model=model)  # type: ignore[union-attr]
            if m_dur is not None:
                m_dur.observe(duration_ms, pillar=pillar, model=model)  # type: ignore[union-attr]
        except Exception as e:
            logger.warning("[telemetry] record_llm_call 失败(忽略,不阻塞业务): %s", e)

    # ---------- 公共 API:支柱事件 ----------

    async def record_pillar_event(self, pillar: str, event_type: str, **labels) -> None:
        """记录支柱事件(更新对应 pillar 的 metrics)。

        约定:
        - counter 事件:每次 +1(如 rules.matched / hook.emitted / spec.generated)
        - gauge 事件:必须传 ``value=`` kwarg(如 rules.conflicts_changed value=3)
        - histogram 事件:必须传 ``value=`` kwarg(如 hook.execution_done value=120)

        Args:
            pillar: 支柱名(rules/hook/spec/context/subagent/terminal/hub/budget)
            event_type: 事件类型(如 matched / emitted / generated / conflicts_changed)
            **labels: 事件标签(与对应 metric 注册的 label 名匹配,gauge/histogram 需附 value=)
        """
        try:
            handler = _EVENT_HANDLERS.get((pillar, event_type))
            if handler is None:
                logger.debug("[telemetry] 未注册事件: %s/%s", pillar, event_type)
                return
            handler(self.registry, **labels)
        except Exception as e:
            logger.warning("[telemetry] record_pillar_event 失败 %s/%s: %s",
                           pillar, event_type, e)

    # ---------- 公共 API:Trace ----------

    def start_trace(self, name: str, pillar: str, trace_id: Optional[str] = None,
                    parent_span_id: Optional[str] = None,
                    attributes: Optional[dict] = None) -> TraceContext:
        """开始一个 trace span(返回 TraceContext,用 async with)。

        同步工厂方法 — 本身不做异步 IO,只构造 TraceContext;
        真正的异步 IO(start_time 记录 / Redis span 存储)发生在
        TraceContext.__aenter__ / __aexit__(均为 async)。

        用法::

            async with telemetry_service.start_trace("rule.match", "rules") as ctx:
                ctx.set_attribute("rule_id", "r-001")
                # ... 业务逻辑 ...
                ctx.add_event("match_done", {"matched": 3})

        Args:
            name: span 名称(如 "rule.match")
            pillar: 来源支柱
            trace_id: 复用已有 trace_id(子 span),None 则生成新 trace
            parent_span_id: 父 span ID,None 表示根 span
            attributes: span 初始属性
        """
        return TraceContext(self, name, pillar, trace_id=trace_id,
                            parent_span_id=parent_span_id, attributes=attributes)

    async def get_trace(self, trace_id: str) -> list[dict]:
        """获取 trace 的所有 spans(按 start_time 升序排序)。"""
        spans: list[dict] = []
        redis = await self._ensure_redis()
        if redis is not None:
            try:
                key = f"{REDIS_TRACES_KEY_PREFIX}{trace_id}"
                raw_list = await redis.lrange(key, 0, -1)
                for raw in raw_list:
                    try:
                        spans.append(json.loads(raw))
                    except Exception:
                        continue
            except Exception as e:
                logger.warning("[telemetry] 从 Redis 读 trace 失败: %s", e)
        # 内存降级(或补充 Redis 不可用期间的数据)
        for span_dict in self._memory_spans:
            if span_dict.get("trace_id") == trace_id:
                spans.append(span_dict)
        # 去重(span_id)+ 按 start_time 升序
        seen: set[str] = set()
        unique: list[dict] = []
        for s in spans:
            sid = s.get("span_id")
            if sid and sid not in seen:
                seen.add(sid)
                unique.append(s)
        unique.sort(key=lambda s: s.get("start_time", 0))
        return unique

    async def get_recent_traces(self, limit: int = 20) -> list[dict]:
        """获取最近的 trace(每个 trace 的根 span 摘要,按 start_time 倒序)。"""
        roots: list[dict] = []
        redis = await self._ensure_redis()
        if redis is not None:
            try:
                raw_list = await redis.lrange(REDIS_TRACE_ROOTS_KEY, 0, limit - 1)
                for raw in raw_list:
                    try:
                        roots.append(json.loads(raw))
                    except Exception:
                        continue
            except Exception as e:
                logger.warning("[telemetry] 从 Redis 读 trace roots 失败: %s", e)
        # 内存降级
        roots.extend(list(self._memory_trace_roots))
        # 按 trace_id 去重 + 按 start_time 倒序 + 截断
        seen: set[str] = set()
        unique: list[dict] = []
        for r in roots:
            tid = r.get("trace_id")
            if tid and tid not in seen:
                seen.add(tid)
                unique.append(r)
        unique.sort(key=lambda r: r.get("start_time", 0), reverse=True)
        return unique[:limit]

    # ---------- 公共 API:查询 ----------

    async def get_metrics(self, format: str = "json") -> dict | str:
        """获取所有 metrics。

        Args:
            format: "json" 返回 dict(供 API 查询),"prometheus" 返回文本(/metrics 端点)
        """
        if format == "prometheus":
            return self.registry.export_prometheus()
        return self.registry.get_all_metrics()

    async def get_pillar_health(self) -> dict:
        """各支柱健康状态(基于 metrics 计算)。

        Returns:
            ``{pillar: {status, key_metrics}}``
            status: healthy(无错误)/ degraded(有 LLM 错误)/ unknown(无数据)
        """
        result: dict[str, Any] = {}
        for pillar in PILLARS:
            key_metrics: dict[str, Any] = {}
            error_count = 0
            total_count = 0
            try:
                # 通用的 LLM 错误率(每支柱都可能有 LLM 调用)
                llm_total = self.registry.get_metric("llm_requests_total")
                if isinstance(llm_total, Counter):
                    for label_tuple, value in llm_total.values.items():
                        # label_tuple = (pillar, model, status)
                        if len(label_tuple) >= 3 and label_tuple[0] == pillar:
                            total_count += int(value)
                            if label_tuple[2] == "error":
                                error_count += int(value)
                # 支柱专属 gauge 值
                for gauge_name in self._pillar_status_gauges(pillar):
                    g = self.registry.get_metric(gauge_name)
                    if isinstance(g, Gauge) and g.values:
                        if not g.labels:
                            # 无标签 gauge:取单值
                            key_metrics[gauge_name] = g.values.get((), 0.0)
                        else:
                            # 带标签 gauge:取所有 label 组合
                            key_metrics[gauge_name] = {
                                ",".join(k): v for k, v in g.values.items()
                            }
            except Exception as e:
                logger.warning("[telemetry] get_pillar_health(%s) 异常: %s", pillar, e)

            if total_count == 0 and not key_metrics:
                status = "unknown"
            elif error_count > 0:
                status = "degraded"
            else:
                status = "healthy"
            result[pillar] = {"status": status, "key_metrics": key_metrics}
        return result

    def _pillar_status_gauges(self, pillar: str) -> list[str]:
        """返回支柱专属的 gauge 名列表(用于 get_pillar_health 提取关键指标)。"""
        mapping: dict[str, list[str]] = {
            "rules": ["rules_conflicts_detected", "rules_knowledge_graph_nodes"],
            "hook": ["hooks_ab_test_active"],
            "spec": ["specs_review_pending", "specs_watch_active"],
            "context": ["context_active_sessions", "context_behavior_records"],
            "subagent": ["subagents_active", "subagent_evolution_records"],
            "terminal": [],
        }
        return mapping.get(pillar, [])

    async def get_dashboard(self) -> dict:
        """遥测仪表盘(metrics 摘要 + 各支柱健康 + 最近 traces + 系统总览)。"""
        all_metrics = self.registry.get_all_metrics()
        # 系统总览:统计 metric 数 / span 数
        total_spans_stored = len(self._memory_spans)
        redis = await self._ensure_redis()
        redis_enabled = redis is not None
        if redis_enabled:
            try:
                # 估算 trace 数(根 span 数)
                root_count = await redis.llen(REDIS_TRACE_ROOTS_KEY)
                total_spans_stored = max(total_spans_stored, root_count)
            except Exception:
                pass
        return {
            "system_overview": {
                "metrics_count": len(all_metrics),
                "spans_stored": total_spans_stored,
                "redis_enabled": redis_enabled,
                "pillars": list(PILLARS),
            },
            "metrics_summary": {
                name: {
                    "type": info["type"],
                    "label_count": len(info["values"]),
                }
                for name, info in all_metrics.items()
            },
            "pillar_health": await self.get_pillar_health(),
            "recent_traces": await self.get_recent_traces(10),
        }


# ====================== 支柱事件分发表 ======================
#
# (pillar, event_type) -> handler(registry, **labels)
# 约定:
#   - counter 事件:每次 inc(1),labels 即 metric 注册的 label 名
#   - gauge 事件:必须传 value= kwarg(set 语义)
#   - histogram 事件:必须传 value= kwarg(observe 语义)


def _h_counter_inc(registry: MetricsRegistry, metric_name: str, **labels) -> None:
    """通用 counter.inc(1) 调度。"""
    m = registry.get_metric(metric_name)
    if m is not None:
        m.inc(1, **labels)  # type: ignore[union-attr]


def _h_gauge_set(registry: MetricsRegistry, metric_name: str,
                 value: Any = 0, **labels) -> None:
    """通用 gauge.set(value) 调度。"""
    m = registry.get_metric(metric_name)
    if m is not None:
        m.set(float(value), **labels)  # type: ignore[union-attr]


def _h_histogram_observe(registry: MetricsRegistry, metric_name: str,
                         value: Any = 0, **labels) -> None:
    """通用 histogram.observe(value) 调度。"""
    m = registry.get_metric(metric_name)
    if m is not None:
        m.observe(float(value), **labels)  # type: ignore[union-attr]


_EVENT_HANDLERS: dict[tuple[str, str], Any] = {
    # ---------- Rules ----------
    ("rules", "matched"): lambda r, **l: _h_counter_inc(r, "rules_matched_total", **l),
    ("rules", "auto_generated"): lambda r, **l: _h_counter_inc(r, "rules_auto_generated_total", **l),
    ("rules", "conflicts_changed"): lambda r, **l: _h_gauge_set(r, "rules_conflicts_detected", **l),
    ("rules", "kg_nodes_changed"): lambda r, **l: _h_gauge_set(r, "rules_knowledge_graph_nodes", **l),
    # ---------- Hook ----------
    ("hook", "emitted"): lambda r, **l: _h_counter_inc(r, "hooks_emitted_total", **l),
    ("hook", "execution_done"): lambda r, **l: _h_histogram_observe(r, "hooks_execution_duration_ms", **l),
    ("hook", "dlq_changed"): lambda r, **l: _h_gauge_set(r, "hooks_dlq_size", **l),
    ("hook", "health_changed"): lambda r, **l: _h_gauge_set(r, "hooks_health_status", **l),
    ("hook", "ab_test_changed"): lambda r, **l: _h_gauge_set(r, "hooks_ab_test_active", **l),
    # ---------- Spec ----------
    ("spec", "generated"): lambda r, **l: _h_counter_inc(r, "specs_generated_total", **l),
    ("spec", "review_changed"): lambda r, **l: _h_gauge_set(r, "specs_review_pending", **l),
    ("spec", "patch_applied"): lambda r, **l: _h_counter_inc(r, "specs_patch_applied_total", **l),
    ("spec", "watch_changed"): lambda r, **l: _h_gauge_set(r, "specs_watch_active", **l),
    # ---------- Context ----------
    ("context", "compressed"): lambda r, **l: _h_counter_inc(r, "context_compressions_total", **l),
    ("context", "compression_ratio"): lambda r, **l: _h_histogram_observe(r, "context_compression_ratio", **l),
    ("context", "compression_quality"): lambda r, **l: _h_histogram_observe(r, "context_compression_quality", **l),
    ("context", "rag_retrieved"): lambda r, **l: _h_counter_inc(r, "context_rag_retrievals_total", **l),
    ("context", "sessions_changed"): lambda r, **l: _h_gauge_set(r, "context_active_sessions", **l),
    ("context", "behavior_changed"): lambda r, **l: _h_gauge_set(r, "context_behavior_records", **l),
    # ---------- Subagent ----------
    ("subagent", "dispatched"): lambda r, **l: _h_counter_inc(r, "subagents_dispatched_total", **l),
    ("subagent", "active_changed"): lambda r, **l: _h_gauge_set(r, "subagents_active", **l),
    ("subagent", "dispatch_duration"): lambda r, **l: _h_histogram_observe(r, "subagent_dispatch_duration_ms", **l),
    ("subagent", "evolution_changed"): lambda r, **l: _h_gauge_set(r, "subagent_evolution_records", **l),
    ("subagent", "collaboration"): lambda r, **l: _h_counter_inc(r, "subagent_collaboration_messages", **l),
    # ---------- Terminal ----------
    ("terminal", "sessions_changed"): lambda r, **l: _h_gauge_set(r, "terminal_sessions_active", **l),
    ("terminal", "ai_suggestion"): lambda r, **l: _h_counter_inc(r, "terminal_ai_suggestions_total", **l),
    ("terminal", "recording_done"): lambda r, **l: _h_counter_inc(r, "terminal_recordings_total", **l),
    ("terminal", "command_failed"): lambda r, **l: _h_counter_inc(r, "terminal_command_failures", **l),
    # ---------- Hub ----------
    ("hub", "event_published"): lambda r, **l: _h_counter_inc(r, "hub_events_published_total", **l),
    ("hub", "decision_made"): lambda r, **l: _h_counter_inc(r, "hub_decisions_total", **l),
    ("hub", "decision_duration"): lambda r, **l: _h_histogram_observe(r, "hub_decision_duration_ms", **l),
    # ---------- Budget ----------
    ("budget", "usage_changed"): lambda r, **l: _h_gauge_set(r, "budget_usage_percent", **l),
    ("budget", "degraded_changed"): lambda r, **l: _h_gauge_set(r, "budget_degraded_models", **l),
}


# ====================== 模块级单例 ======================

telemetry_service = TelemetryService()
