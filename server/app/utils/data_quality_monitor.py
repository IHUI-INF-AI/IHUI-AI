"""数据质量监控(Bug-130)
完整性/准确性/一致性/及时性/唯一性规则 + 异常告警 + 统计面板
"""

from __future__ import annotations

import re
import threading
import time
from collections import deque
from dataclasses import dataclass, field
from datetime import datetime
from enum import StrEnum
from typing import Any


class DQDimension(StrEnum):
    COMPLETENESS = "COMPLETENESS"  # 完整性
    ACCURACY = "ACCURACY"  # 准确性
    CONSISTENCY = "CONSISTENCY"  # 一致性
    TIMELINESS = "TIMELINESS"  # 及时性
    UNIQUENESS = "UNIQUENESS"  # 唯一性
    VALIDITY = "VALIDITY"  # 有效性


class AlertLevel(StrEnum):
    OK = "OK"
    INFO = "INFO"
    WARN = "WARN"
    ERROR = "ERROR"
    CRITICAL = "CRITICAL"


@dataclass
class DQRule:
    rule_id: str
    name: str
    dimension: DQDimension
    dataset: str
    target_field: str = ""
    threshold: float = 0.0
    comparison: str = "lt"  # lt/le/gt/ge/eq
    params: dict[str, Any] = field(default_factory=dict)
    enabled: bool = True
    description: str = ""
    created_at: float = field(default_factory=time.time)


@dataclass
class DQSample:
    sample_id: str
    dataset: str
    data: dict[str, Any]
    received_at: float = field(default_factory=time.time)
    source: str = ""


@dataclass
class DQViolation:
    rule_id: str
    dataset: str
    field: str
    dimension: DQDimension
    level: AlertLevel
    actual_value: float
    threshold: float
    sample_id: str = ""
    message: str = ""
    detected_at: float = field(default_factory=time.time)  # type: ignore[operator]


@dataclass
class DQMetric:
    rule_id: str
    dataset: str
    dimension: DQDimension
    total: int
    failed: int
    rate: float
    window_start: float
    window_end: float

    def status(self, threshold: float, comparison: str) -> AlertLevel:
        if comparison == "lt":
            if self.rate < threshold:
                return AlertLevel.CRITICAL
        elif comparison == "le":
            if self.rate <= threshold:
                return AlertLevel.CRITICAL
        elif comparison == "gt":
            if self.rate > threshold:
                return AlertLevel.CRITICAL
        elif comparison == "ge" and self.rate >= threshold:
            return AlertLevel.CRITICAL
        return AlertLevel.OK if self.failed == 0 else AlertLevel.WARN


class _Status:
    OK = "OK"


@dataclass
class DQConfig:
    window_sec: float = 300.0
    max_samples: int = 10000
    max_violations: int = 5000
    max_alerts_per_rule: int = 50


def _compare(value: float, threshold: float, comparison: str) -> bool:
    if comparison == "lt":
        return value < threshold
    if comparison == "le":
        return value <= threshold
    if comparison == "gt":
        return value > threshold
    if comparison == "ge":
        return value >= threshold
    if comparison == "eq":
        return value == threshold
    return False


class DataQualityMonitor:
    """数据质量监控"""

    def __init__(self, config: DQConfig | None = None) -> None:
        self.config = config or DQConfig()
        self._rules: dict[str, DQRule] = {}
        self._samples: deque[DQSample] = deque(maxlen=self.config.max_samples)
        self._violations: deque[DQViolation] = deque(maxlen=self.config.max_violations)
        self._alerts_by_rule: dict[str, int] = {}
        self._seen_keys: dict[str, float] = {}  # 唯一性
        self._lock = threading.RLock()

    def add_rule(self, rule: DQRule) -> None:
        with self._lock:
            self._rules[rule.rule_id] = rule

    def remove_rule(self, rule_id: str) -> bool:
        with self._lock:
            return self._rules.pop(rule_id, None) is not None

    def enable_rule(self, rule_id: str, enabled: bool = True) -> bool:
        with self._lock:
            r = self._rules.get(rule_id)
            if r is None:
                return False
            r.enabled = enabled
            return True

    def get_rule(self, rule_id: str) -> DQRule | None:
        return self._rules.get(rule_id)

    def list_rules(self, dataset: str | None = None) -> list[DQRule]:
        with self._lock:
            rs = list(self._rules.values())
        if dataset:
            rs = [r for r in rs if r.dataset == dataset]
        return rs

    def _generate_sample_id(self) -> str:
        return f"s-{int(time.time() * 1000)}-{len(self._samples)}"

    def _check_completeness(self, rule: DQRule, data: dict[str, Any]) -> bool:
        field = rule.target_field
        if field not in data:
            return False
        v = data[field]
        if v is None:
            return False
        if isinstance(v, str) and v.strip() == "":
            return False
        return not (isinstance(v, (list, dict)) and len(v) == 0)

    def _check_accuracy(self, rule: DQRule, data: dict[str, Any]) -> bool:
        field = rule.target_field
        if field not in data:
            return False
        v = data[field]
        if v is None:
            return False
        allowed = rule.params.get("allowed_values")
        if allowed is not None and v not in allowed:
            return False
        pattern = rule.params.get("pattern")
        if pattern is not None and isinstance(v, str):
            import re

            if not re.match(pattern, v):
                return False
        lo = rule.params.get("min_value")
        hi = rule.params.get("max_value")
        if isinstance(v, (int, float)) and not isinstance(v, bool):
            if lo is not None and v < lo:
                return False
            if hi is not None and v > hi:
                return False
        return True

    def _check_consistency(self, rule: DQRule, data: dict[str, Any]) -> bool:
        pairs = rule.params.get("field_pairs", [])
        for pair in pairs:
            a, b = pair.get("a"), pair.get("b")
            if a not in data or b not in data:
                return False
            if data[a] != data[b]:
                return False
        formula = rule.params.get("formula")
        if formula is not None:
            # 支持 sum_greater_than(a,b,c) > value
            try:
                fname, rest = formula.split("(", 1)
                args_str, comp = rest.rsplit(")", 1)
                args = [a.strip() for a in args_str.split(",")]
                _, val = comp[0], comp[1:].strip()
                vals = [data.get(a) for a in args]
                if any(v is None for v in vals):
                    return False
                target = float(val)
                if fname == "sum_greater_than":
                    if not (sum(vals) > target):  # type: ignore[arg-type]
                        return False
                elif fname == "sum_less_than":
                    if not (sum(vals) < target):  # type: ignore[arg-type]
                        return False
                elif fname == "diff_equals" and abs(vals[0] - vals[1]) != target:  # type: ignore[operator]
                    return False
            except Exception:
                return False
        return True

    def _check_timeliness(self, rule: DQRule, data: dict[str, Any], received_at: float) -> bool:
        field = rule.target_field
        if field not in data:
            return False
        ts = data[field]
        if not isinstance(ts, (int, float)):
            try:
                from datetime import datetime

                ts = datetime.fromisoformat(str(ts).replace("Z", "")).timestamp()
            except Exception:
                return False
        max_delay = float(rule.params.get("max_delay_sec", 0))
        return (received_at - float(ts)) <= max_delay

    def _check_uniqueness(self, rule: DQRule, data: dict[str, Any], sample_id: str) -> bool:
        field = rule.target_field
        if field not in data:
            return False
        v = data[field]
        if v is None or v == "":
            return True  # 唯一性只对非空值有意义
        fingerprint = f"{rule.dataset}:{field}:{v}"
        with self._lock:
            if fingerprint in self._seen_keys:
                return False
            self._seen_keys[fingerprint] = time.time()
        return True

    def _check_validity(self, rule: DQRule, data: dict[str, Any]) -> bool:
        field = rule.target_field
        if field not in data:
            return False
        v = data[field]
        if v is None:
            return False
        validator = rule.params.get("validator")
        if validator == "email":
            return bool(re.match(r"^[^@\s]+@[^@\s]+\.[^@\s]+$", str(v)))
        if validator == "phone":
            return bool(re.match(r"^1[3-9]\d{9}$", str(v)))
        if validator == "uuid":
            return bool(
                re.match(r"^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$", str(v))
            )
        if validator == "non_negative":
            return isinstance(v, (int, float)) and not isinstance(v, bool) and v >= 0
        if validator == "non_empty":
            if isinstance(v, str):
                return v.strip() != ""
            if isinstance(v, (list, dict)):
                return len(v) > 0
            return True
        return True

    def _dispatch_check(self, rule: DQRule, data: dict[str, Any], sample_id: str, received_at: float) -> bool:
        if rule.dimension == DQDimension.COMPLETENESS:
            return self._check_completeness(rule, data)
        if rule.dimension == DQDimension.ACCURACY:
            return self._check_accuracy(rule, data)
        if rule.dimension == DQDimension.CONSISTENCY:
            return self._check_consistency(rule, data)
        if rule.dimension == DQDimension.TIMELINESS:
            return self._check_timeliness(rule, data, received_at)
        if rule.dimension == DQDimension.UNIQUENESS:
            return self._check_uniqueness(rule, data, sample_id)
        if rule.dimension == DQDimension.VALIDITY:
            return self._check_validity(rule, data)
        return True

    def feed(self, dataset: str, data: dict[str, Any], source: str = "") -> DQSample:
        sample = DQSample(
            sample_id=self._generate_sample_id(),
            dataset=dataset,
            data=dict(data),
            source=source,
            received_at=time.time(),
        )
        with self._lock:
            self._samples.append(sample)
            for rule in self._rules.values():
                if not rule.enabled or rule.dataset != dataset:
                    continue
                passed = self._dispatch_check(rule, data, sample.sample_id, sample.received_at)
                if not passed:
                    self._record_violation(rule, sample.sample_id, data)
        return sample

    def _record_violation(self, rule: DQRule, sample_id: str, data: dict[str, Any]) -> None:
        actual = 0.0
        if rule.dimension in (
            DQDimension.COMPLETENESS,
            DQDimension.ACCURACY,
            DQDimension.CONSISTENCY,
            DQDimension.VALIDITY,
        ):
            actual = 0.0
        elif rule.dimension == DQDimension.TIMELINESS:
            field = rule.target_field
            ts = data.get(field)
            max_delay = float(rule.params.get("max_delay_sec", 0))
            try:
                if isinstance(ts, str):
                    ts = datetime.fromisoformat(ts.replace("Z", "")).timestamp()
                actual = time.time() - float(ts) - max_delay  # type: ignore[arg-type]
            except Exception:
                actual = 0.0
        elif rule.dimension == DQDimension.UNIQUENESS:
            actual = 1.0
        level = AlertLevel.ERROR
        if rule.dimension == DQDimension.TIMELINESS:
            level = AlertLevel.CRITICAL if actual > 0 else AlertLevel.WARN
        violation = DQViolation(
            rule_id=rule.rule_id,
            dataset=rule.dataset,
            field=rule.target_field,
            dimension=rule.dimension,
            level=level,
            actual_value=actual,
            threshold=rule.threshold,
            sample_id=sample_id,
            message=f"{rule.name} 检测到违规",
        )
        with self._lock:
            self._violations.append(violation)
            cnt = self._alerts_by_rule.get(rule.rule_id, 0)
            if cnt < self.config.max_alerts_per_rule:
                self._alerts_by_rule[rule.rule_id] = cnt + 1

    def get_violations(
        self, dataset: str | None = None, rule_id: str | None = None, limit: int = 100
    ) -> list[DQViolation]:
        with self._lock:
            vs = list(self._violations)
        if dataset:
            vs = [v for v in vs if v.dataset == dataset]
        if rule_id:
            vs = [v for v in vs if v.rule_id == rule_id]
        return vs[-limit:]

    def get_metrics(self, dataset: str | None = None, window_sec: float | None = None) -> list[DQMetric]:
        window = window_sec or self.config.window_sec
        now = time.time()
        start = now - window
        with self._lock:
            samples = [s for s in self._samples if s.received_at >= start and (dataset is None or s.dataset == dataset)]
        metrics: list[DQMetric] = []
        for rule in self._rules.values():
            if dataset and rule.dataset != dataset:
                continue
            if not rule.enabled:
                continue
            total = 0
            failed = 0
            for s in samples:
                if s.dataset != rule.dataset:
                    continue
                total += 1
                if not self._dispatch_check(rule, s.data, s.sample_id, s.received_at):
                    failed += 1
            rate = (total - failed) / total if total > 0 else 1.0
            metrics.append(
                DQMetric(
                    rule_id=rule.rule_id,
                    dataset=rule.dataset,
                    dimension=rule.dimension,
                    total=total,
                    failed=failed,
                    rate=rate,
                    window_start=start,
                    window_end=now,
                )
            )
        return metrics

    def health(self, dataset: str | None = None) -> dict[str, Any]:
        metrics = self.get_metrics(dataset=dataset)
        bad = []
        for m in metrics:
            rule = next((r for r in self._rules.values() if r.rule_id == m.rule_id), None)
            threshold = rule.threshold if rule is not None else 0
            comparison = rule.comparison if rule is not None else "lt"
            if _compare(m.rate, threshold, comparison):
                bad.append(m)
        return {
            "ok": len(bad) == 0,
            "bad_metrics": [{"rule_id": m.rule_id, "rate": m.rate, "total": m.total, "failed": m.failed} for m in bad],
            "metric_count": len(metrics),
        }

    def stats(self) -> dict[str, Any]:
        with self._lock:
            return {
                "rules_total": len(self._rules),
                "rules_enabled": sum(1 for r in self._rules.values() if r.enabled),
                "samples_total": len(self._samples),
                "violations_total": len(self._violations),
                "unique_keys_tracked": len(self._seen_keys),
            }

    def clear(self) -> None:
        with self._lock:
            self._samples.clear()
            self._violations.clear()
            self._alerts_by_rule.clear()
            self._seen_keys.clear()
