"""Bug-117: 指标标签基数控制.

设计:
  - 高基数标签检测: 跟踪每 metric+label 的 distinct value 数
  - 动态降级: 超过阈值后只保留 TopN, 其它归为 __other__
  - 内存优化: LRU 缓存最近值
  - Prometheus 兼容: 命名规范校验
  - 报告: 返回各标签的基数统计
"""

import enum
import logging
import re
import threading
import time
from collections import Counter, deque
from dataclasses import dataclass, field

logger = logging.getLogger(__name__)


class CardinalityAction(enum.StrEnum):
    ALLOW = "allow"
    TOPN = "topn"  # 只保留高频 TopN
    DROP = "drop"  # 整体丢弃
    BUCKET = "bucket"  # 归为 bucket


_PROM_NAME_RE = re.compile(r"^[a-zA-Z_:][a-zA-Z0-9_:]*$")
_PROM_LABEL_RE = re.compile(r"^[a-zA-Z_][a-zA-Z0-9_]*$")


@dataclass
class CardinalityStat:
    metric: str
    label: str
    distinct: int = 0
    samples: int = 0
    first_seen: float = 0.0
    last_seen: float = 0.0
    top_values: list[tuple[str, int]] = field(default_factory=list)


@dataclass
class SampleEvent:
    metric: str
    labels: dict[str, str]
    value: float
    ts: float = 0.0
    dropped: bool = False
    action: str = CardinalityAction.ALLOW.value


@dataclass
class CardinalityConfig:
    metric: str
    max_cardinality: int = 1000
    topn: int = 50
    action: str = CardinalityAction.TOPN.value


class MetricCardinalityController:
    """指标标签基数控制器."""

    def __init__(self, default_max: int = 1000, default_topn: int = 50):
        self._lock = threading.RLock()
        self._default_max = default_max
        self._default_topn = default_topn
        # per (metric, label) -> 出现过的 value 集合
        self._values: dict[tuple[str, str], Counter] = {}
        self._totals: dict[tuple[str, str], CardinalityStat] = {}
        # metric 维度配置
        self._configs: dict[str, CardinalityConfig] = {}
        # TopN 缓存: (metric, label) -> set(top_values)
        self._topn_cache: dict[tuple[str, str], set] = {}
        # 事件日志 (最近 N 条)
        self._events: deque[SampleEvent] = deque(maxlen=5000)
        # 统计
        self._total_samples = 0
        self._total_dropped = 0
        self._total_bucketed = 0
        self._total_topn = 0

    def configure(
        self,
        metric: str,
        max_cardinality: int | None = None,
        topn: int | None = None,
        action: str | None = None,
    ) -> None:
        with self._lock:
            c = self._configs.get(metric) or CardinalityConfig(metric=metric)
            if max_cardinality is not None:
                c.max_cardinality = max_cardinality
            if topn is not None:
                c.topn = topn
            if action is not None:
                c.action = action
            self._configs[metric] = c

    def validate_metric_name(self, name: str) -> bool:
        return bool(_PROM_NAME_RE.match(name))

    def validate_label_name(self, name: str) -> bool:
        return bool(_PROM_LABEL_RE.match(name))

    def observe(self, metric: str, labels: dict[str, str], value: float = 1.0) -> SampleEvent:
        """记录一次指标样本. 返回事件 (含是否被降级/丢弃)."""
        with self._lock:
            self._total_samples += 1
            ev = SampleEvent(metric=metric, labels=dict(labels), value=value, ts=time.time())
            cfg = self._configs.get(metric) or CardinalityConfig(
                metric=metric, max_cardinality=self._default_max, topn=self._default_topn
            )
            # 校验 label name
            for k in labels:
                if not self.validate_label_name(k):
                    ev.action = CardinalityAction.DROP.value
                    ev.dropped = True
                    self._total_dropped += 1
                    self._events.append(ev)
                    return ev
            # 计算是否超基数
            bucket_actions: list[tuple[str, str, str]] = []  # (label, original, replaced)
            drop_metric = False
            for k, v in labels.items():
                key = (metric, k)
                cnt = self._values.setdefault(key, Counter())
                is_new = v not in cnt
                # 不同 action 不同处理
                if is_new and cfg.action == CardinalityAction.DROP.value:
                    # DROP: 总 distinct 超过 max_cardinality 就丢弃
                    if len(cnt) >= cfg.max_cardinality:
                        drop_metric = True
                        # 不累加
                    else:
                        cnt[v] += 1
                elif is_new and cfg.action in (CardinalityAction.TOPN.value, CardinalityAction.BUCKET.value):
                    real_distinct = sum(1 for x in cnt if x != "__other__")
                    if real_distinct >= cfg.topn:
                        # 超过 topn, 归到 __other__
                        cnt["__other__"] = cnt.get("__other__", 0) + 1
                        bucket_actions.append((k, v, "__other__"))
                        ev.action = cfg.action
                        if cfg.action == CardinalityAction.TOPN.value:
                            self._total_topn += 1
                        else:
                            self._total_bucketed += 1
                    else:
                        cnt[v] += 1
                else:
                    # ALLOW / 已有 value, 直接累加
                    cnt[v] += 1
                # 更新 stat
                st = self._totals.get(key) or CardinalityStat(metric=metric, label=k)
                st.distinct = len([x for x in cnt if x != "__other__"]) + (1 if "__other__" in cnt else 0)
                st.samples += 1
                st.last_seen = time.time()
                if st.first_seen == 0.0:
                    st.first_seen = st.last_seen
                st.top_values = cnt.most_common(5)
                self._totals[key] = st
            if drop_metric:
                ev.dropped = True
                ev.action = CardinalityAction.DROP.value
                self._total_dropped += 1
            else:
                for k, _original, replaced in bucket_actions:
                    ev.labels[k] = replaced
            self._events.append(ev)
            return ev

    def _decide_action(self, metric: str, label: str, value: str, cfg: CardinalityConfig) -> tuple[str, str]:
        key = (metric, label)
        with self._lock:
            cnt = self._values.get(key)
            if cnt is None:
                return "__other__", cfg.action
            # TopN: 保留前 N 个高频值. 严格限制 distinct = topn + 1 (含 __other__).
            # 排除 __other__ 后, 真实的 topn 原值
            other_count = cnt.get("__other__", 0)
            real = {k: v for k, v in cnt.items() if k != "__other__"}
            top = sorted(real.items(), key=lambda x: (-x[1], x[0]))[: cfg.topn]
            top_set = {k for k, _ in top}
            self._topn_cache[key] = top_set
        if value in top_set:
            cnt[value] += 1
            return value, CardinalityAction.ALLOW.value
        # 不在 TopN, 累加到 __other__
        cnt["__other__"] = other_count + 1
        # 还要把不在 top_set 的原值"虚拟归并"到 __other__ - 但它们已存在, 累计独立
        return "__other__", cfg.action

    def stat(self, metric: str, label: str) -> CardinalityStat | None:
        with self._lock:
            return self._totals.get((metric, label))

    def list_metrics(self) -> list[str]:
        with self._lock:
            return sorted({m for m, _ in self._values})

    def list_overlimit(self, max_card: int | None = None) -> list[CardinalityStat]:
        with self._lock:
            out = []
            for key, st in self._totals.items():
                cfg = self._configs.get(key[0]) or CardinalityConfig(
                    metric=key[0], max_cardinality=self._default_max, topn=self._default_topn
                )
                threshold = max_card or cfg.max_cardinality
                if st.distinct > threshold:
                    out.append(st)
        out.sort(key=lambda s: s.distinct, reverse=True)
        return out

    def cardinality(self, metric: str) -> dict[str, int]:
        with self._lock:
            return {k[1]: len(v) for k, v in self._values.items() if k[0] == metric}

    def reset_metric(self, metric: str) -> int:
        with self._lock:
            keys = [k for k in self._values if k[0] == metric]
            for k in keys:
                self._values.pop(k, None)
                self._totals.pop(k, None)
                self._topn_cache.pop(k, None)
            return len(keys)

    def stats(self) -> dict:
        with self._lock:
            return {
                "default_max": self._default_max,
                "default_topn": self._default_topn,
                "metric_count": len({k[0] for k in self._values}),
                "label_count": len(self._values),
                "config_count": len(self._configs),
                "total_samples": self._total_samples,
                "total_dropped": self._total_dropped,
                "total_bucketed": self._total_bucketed,
                "total_topn": self._total_topn,
            }

    def reset_stats(self) -> None:
        with self._lock:
            self._total_samples = 0
            self._total_dropped = 0
            self._total_bucketed = 0
            self._total_topn = 0


# 全局单例
metric_cardinality = MetricCardinalityController()
