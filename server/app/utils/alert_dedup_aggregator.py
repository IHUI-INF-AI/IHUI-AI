"""Bug-118: 告警去重聚合.

设计:
  - 滑动窗口: 同 fingerprint 告警在窗口内合并
  - fingerprint 注入: 自定义 hash 函数
  - 合并策略: 计数合并 / 首尾样本 / 级别升级
  - 静默抑制: silent_until 期间内不发送
  - 路由: 按 fingerprint 决定接收方
"""

import enum
import logging
import threading
import time
from collections import deque
from collections.abc import Callable
from dataclasses import dataclass, field
from typing import Any

logger = logging.getLogger(__name__)


class AlertSeverity(enum.StrEnum):
    INFO = "info"
    WARNING = "warning"
    ERROR = "error"
    CRITICAL = "critical"


class AggregationStrategy(enum.StrEnum):
    COUNT = "count"  # 计数合并
    FIRST_LAST = "first_last"  # 首尾样本
    ESCALATE = "escalate"  # 升级 (取最高级)


@dataclass
class AlertEvent:
    id: str
    fingerprint: str
    severity: str
    title: str
    message: str
    source: str
    created_at: float
    received_at: float = 0.0
    tags: dict[str, str] = field(default_factory=dict)
    count_in_window: int = 1
    first_at: float = 0.0
    last_at: float = 0.0
    routes: list[str] = field(default_factory=list)
    notified: bool = False


@dataclass
class AggregationRule:
    fingerprint_pattern: str
    window_sec: float = 60.0
    strategy: str = AggregationStrategy.COUNT.value
    max_in_window: int = 1000
    silent_until: float = 0.0
    routes: list[str] = field(default_factory=list)


@dataclass
class NotificationResult:
    delivered: int
    suppressed: int
    deduped: int
    sent_to: list[str] = field(default_factory=list)


class AlertDedupAggregator:
    """告警去重聚合器."""

    def __init__(self, default_window_sec: float = 60.0, default_strategy: str = AggregationStrategy.COUNT.value):
        self._lock = threading.RLock()
        self._default_window = default_window_sec
        self._default_strategy = default_strategy
        # 滑动窗口: fingerprint -> 历史告警
        self._windows: dict[str, deque[AlertEvent]] = {}
        # 已合并的活跃告警: fingerprint -> 最新代表
        self._active: dict[str, AlertEvent] = {}
        # 规则: 按 fingerprint 模式
        self._rules: list[AggregationRule] = []
        # 已发送通知
        self._sent_ids: set[str] = set()
        # 投递回调
        self._notifier: Callable[[AlertEvent, list[str]], None] | None = None
        # 路由表
        self._routes: dict[str, str] = {}  # route name -> target
        # 统计
        self._total_received = 0
        self._total_deduped = 0
        self._total_silenced = 0
        self._total_notified = 0
        # 事件日志
        self._audit: deque[dict[str, Any]] = deque(maxlen=2000)

    def add_rule(self, rule: AggregationRule) -> None:
        with self._lock:
            self._rules.append(rule)

    def remove_rule(self, pattern: str) -> bool:
        with self._lock:
            for i, r in enumerate(self._rules):
                if r.fingerprint_pattern == pattern:
                    self._rules.pop(i)
                    return True
        return False

    def set_notifier(self, fn: Callable[[AlertEvent, list[str]], None]) -> None:
        with self._lock:
            self._notifier = fn

    def add_route(self, name: str, target: str) -> None:
        with self._lock:
            self._routes[name] = target

    def ingest(
        self,
        fingerprint: str,
        severity: str,
        title: str,
        message: str,
        source: str = "",
        tags: dict[str, str] | None = None,
    ) -> AlertEvent:
        """接收一条告警事件. 内部做去重/合并/静默/通知."""
        now = time.time()
        with self._lock:
            self._total_received += 1
            rule = self._match_rule(fingerprint)
            window_sec = rule.window_sec if rule else self._default_window
            strategy = rule.strategy if rule else self._default_strategy
            silent_until = rule.silent_until if rule else 0.0
            routes = list(rule.routes) if rule else []
            # 静默抑制
            if silent_until > now:
                self._total_silenced += 1
                self._audit.append({"event": "silenced", "fp": fingerprint, "ts": now})
                ev = AlertEvent(
                    id=f"al-{int(now*1000000)}",
                    fingerprint=fingerprint,
                    severity=severity,
                    title=title,
                    message=message,
                    source=source,
                    created_at=now,
                    received_at=now,
                    tags=dict(tags) if tags else {},
                )
                return ev
            # 滑动窗口: 清理过期
            dq = self._windows.setdefault(fingerprint, deque())
            while dq and (now - dq[0].created_at) > window_sec:
                dq.popleft()
            existing = self._active.get(fingerprint)
            if existing is not None:
                # 合并
                self._total_deduped += 1
                self._merge(existing, severity, message, now, strategy, tags)
                dq.append(existing)
                if not existing.notified:
                    self._deliver(existing, routes)
                self._audit.append(
                    {"event": "deduped", "fp": fingerprint, "ts": now, "count": existing.count_in_window}
                )
                return existing
            # 新建
            ev = AlertEvent(
                id=f"al-{int(now*1000000)}",
                fingerprint=fingerprint,
                severity=severity,
                title=title,
                message=message,
                source=source,
                created_at=now,
                received_at=now,
                first_at=now,
                last_at=now,
                tags=dict(tags) if tags else {},
                routes=routes,
            )
            dq.append(ev)
            self._active[fingerprint] = ev
            self._deliver(ev, routes)
            self._audit.append({"event": "new", "fp": fingerprint, "ts": now, "severity": severity})
            return ev

    def _merge(
        self, ev: AlertEvent, severity: str, message: str, now: float, strategy: str, tags: dict[str, str] | None
    ) -> None:
        with self._lock:
            ev.count_in_window += 1
            ev.last_at = now
            if strategy == AggregationStrategy.ESCALATE.value:
                ev.severity = self._max_severity(ev.severity, severity)
            elif strategy == AggregationStrategy.FIRST_LAST.value:
                ev.message = f"first={ev.message} | last={message}"
            # COUNT: 仅计数
            if tags:
                ev.tags.update(tags)

    def _max_severity(self, a: str, b: str) -> str:
        order = [
            AlertSeverity.INFO.value,
            AlertSeverity.WARNING.value,
            AlertSeverity.ERROR.value,
            AlertSeverity.CRITICAL.value,
        ]
        try:
            return a if order.index(a) >= order.index(b) else b
        except ValueError:
            return a

    def _deliver(self, ev: AlertEvent, routes: list[str]) -> None:
        with self._lock:
            ev.notified = True
            self._total_notified += 1
            self._sent_ids.add(ev.id)
        if self._notifier is not None:
            try:
                self._notifier(ev, routes)
            except Exception as e:
                logger.warning("notifier failed: %s", e)
        ev.routes = routes

    def _match_rule(self, fingerprint: str) -> AggregationRule | None:
        with self._lock:
            for r in self._rules:
                if r.fingerprint_pattern == fingerprint:
                    return r
            # 简单前缀匹配
            for r in self._rules:
                if r.fingerprint_pattern.endswith("*") and fingerprint.startswith(r.fingerprint_pattern[:-1]):
                    return r
        return None

    def list_active(self) -> list[AlertEvent]:
        with self._lock:
            return list(self._active.values())

    def list_deduped(self) -> list[AlertEvent]:
        with self._lock:
            return [e for e in self._active.values() if e.count_in_window > 1]

    def get(self, fingerprint: str) -> AlertEvent | None:
        with self._lock:
            return self._active.get(fingerprint)

    def silence(self, fingerprint: str, until: float) -> bool:
        """静默某个 fingerprint, 持续到 until 时间戳."""
        with self._lock:
            for r in self._rules:
                if r.fingerprint_pattern == fingerprint or (
                    r.fingerprint_pattern.endswith("*") and fingerprint.startswith(r.fingerprint_pattern[:-1])
                ):
                    r.silent_until = max(r.silent_until, until)
                    return True
        # 隐式规则
        self.add_rule(AggregationRule(fingerprint_pattern=fingerprint, silent_until=until))
        return True

    def expire_window(self, fingerprint: str) -> bool:
        with self._lock:
            dq = self._windows.get(fingerprint)
            if dq:
                dq.clear()
                self._active.pop(fingerprint, None)
                return True
        return False

    def stats(self) -> dict:
        with self._lock:
            return {
                "default_window_sec": self._default_window,
                "default_strategy": self._default_strategy,
                "total_received": self._total_received,
                "total_deduped": self._total_deduped,
                "total_silenced": self._total_silenced,
                "total_notified": self._total_notified,
                "active_count": len(self._active),
                "rule_count": len(self._rules),
                "route_count": len(self._routes),
            }

    def reset_stats(self) -> None:
        with self._lock:
            self._total_received = 0
            self._total_deduped = 0
            self._total_silenced = 0
            self._total_notified = 0


# 全局单例
alert_aggregator = AlertDedupAggregator()
