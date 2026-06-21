"""Phase 18 建议 3: 智能告警降噪 - 去重 / 聚合 / 抑制.

目的:
  - 减少告警风暴 (alert storm)
  - 同 fingerprint 告警滑动窗口去重
  - 按 label / 维度 聚合
  - 静默规则 (silence) + 事件关联 (correlation)

设计:
  AlertEvent:
    id, alertname, severity, source, labels, ts, message, fingerprint

  Fingerprint: sha1(alertname + sorted_labels)

  Deduplicator:
    滑动窗口, 同 fingerprint 在窗口内 -> suppressed (只保留首条)

  Aggregator:
    按 group_by 维度合并, 输出 (group_key, count, top_message, first_ts, last_ts)

  Silencer:
    规则: (match_labels, duration_minutes)
    命中 -> 静默该事件

  Correlator:
    (parent_alertname -> [child_alertname]) 在 parent 活跃时抑制 child

  AlertNoiseReducer:
    pipeline: dedup -> silence -> correlate -> aggregate
"""

from __future__ import annotations

import hashlib
import json
import time
from collections import defaultdict
from dataclasses import asdict, dataclass, field
from enum import Enum

# ---------------------------------------------------------------------------
# 1. 枚举 / 数据类
# ---------------------------------------------------------------------------


class Severity(str, Enum):
    INFO = "info"
    WARNING = "warning"
    ERROR = "error"
    CRITICAL = "critical"


class ActionType(str, Enum):
    PASS = "pass"  # 通过
    SUPPRESS = "suppress"  # 抑制


@dataclass
class AlertEvent:
    id: str
    alertname: str
    severity: Severity
    source: str
    labels: dict = field(default_factory=dict)
    ts: float = field(default_factory=time.time)
    message: str = ""

    def fingerprint(self) -> str:
        h = hashlib.sha1()
        h.update(self.alertname.encode())
        h.update(b"|")
        for k in sorted(self.labels):
            h.update(f"{k}={self.labels[k]}".encode())
            h.update(b"|")
        return h.hexdigest()[:12]

    def to_dict(self) -> dict:
        d = asdict(self)
        d["severity"] = self.severity.value
        d["fingerprint"] = self.fingerprint()
        return d


@dataclass
class SilenceRule:
    match_alertname: str  # "*" 表示全部
    match_labels: dict = field(default_factory=dict)  # 任意匹配即可
    duration_minutes: int = 30
    created_ts: float = field(default_factory=time.time)
    reason: str = ""

    def matches(self, event: AlertEvent) -> bool:
        if self.match_alertname != "*" and self.match_alertname != event.alertname:
            return False
        for k, v in self.match_labels.items():
            if event.labels.get(k) != v:
                return False
        return True

    def is_active(self, now: float) -> bool:
        return (now - self.created_ts) < (self.duration_minutes * 60)


@dataclass
class CorrelationRule:
    parent_alertname: str
    child_alertnames: list[str]
    description: str = ""


@dataclass
class AggregatedAlert:
    group_key: str
    count: int
    alertname: str
    severity: Severity
    first_ts: float
    last_ts: float
    top_message: str
    sources: list[str] = field(default_factory=list)

    def to_dict(self) -> dict:
        d = asdict(self)
        d["severity"] = self.severity.value
        return d


# ---------------------------------------------------------------------------
# 2. Deduplicator
# ---------------------------------------------------------------------------


class Deduplicator:
    """滑动窗口去重."""

    def __init__(self, window_seconds: float = 60.0):
        self.window = window_seconds
        # fingerprint -> 最近一条 ts
        self._seen: dict[str, float] = {}

    def should_pass(self, event: AlertEvent, now: float | None = None) -> bool:
        t = now or time.time()
        # 清理过期
        cutoff = t - self.window
        for fp in list(self._seen.keys()):
            if self._seen[fp] < cutoff:
                del self._seen[fp]
        fp = event.fingerprint()
        if fp in self._seen:
            return False
        self._seen[fp] = t
        return True

    def seen_count(self) -> int:
        return len(self._seen)

    def clear(self) -> None:
        self._seen.clear()


# ---------------------------------------------------------------------------
# 3. Aggregator
# ---------------------------------------------------------------------------


class Aggregator:
    """按 group_by 维度聚合."""

    def aggregate(
        self, events: list[AlertEvent], group_by: list[str], window_seconds: float = 300.0
    ) -> list[AggregatedAlert]:
        if not events:
            return []
        now = time.time()
        cutoff = now - window_seconds
        active = [e for e in events if e.ts >= cutoff]
        groups: dict[str, list[AlertEvent]] = defaultdict(list)
        for e in active:
            key_parts = []
            for g in group_by:
                key_parts.append(f"{g}={e.labels.get(g, e.alertname if g == 'alertname' else '*')}")
            key = "|".join(key_parts) if key_parts else e.alertname
            groups[key].append(e)
        out: list[AggregatedAlert] = []
        for key, items in groups.items():
            items.sort(key=lambda e: e.ts)
            sources = sorted({i.source for i in items})
            # 选最长 message 作为 top
            top = max(items, key=lambda e: len(e.message))
            out.append(
                AggregatedAlert(
                    group_key=key,
                    count=len(items),
                    alertname=items[0].alertname,
                    severity=max(
                        {i.severity for i in items},
                        key=lambda s: ["info", "warning", "error", "critical"].index(s.value),
                    ),
                    first_ts=items[0].ts,
                    last_ts=items[-1].ts,
                    top_message=top.message,
                    sources=sources,
                )
            )
        out.sort(key=lambda a: -a.count)
        return out


# ---------------------------------------------------------------------------
# 4. Silencer
# ---------------------------------------------------------------------------


class Silencer:
    """静默规则."""

    def __init__(self):
        self._rules: list[SilenceRule] = []

    def add(self, rule: SilenceRule) -> None:
        self._rules.append(rule)

    def is_silenced(self, event: AlertEvent, now: float | None = None) -> tuple[bool, str]:
        t = now or time.time()
        for r in self._rules:
            if r.is_active(t) and r.matches(event):
                return True, f"silenced by rule (alertname={r.match_alertname}, labels={r.match_labels})"
        return False, ""

    def cleanup(self, now: float | None = None) -> None:
        t = now or time.time()
        self._rules = [r for r in self._rules if r.is_active(t)]

    def rules(self) -> list[dict]:
        return [asdict(r) for r in self._rules]


# ---------------------------------------------------------------------------
# 5. Correlator
# ---------------------------------------------------------------------------


class Correlator:
    """事件关联 - parent 活跃时抑制 child."""

    def __init__(self, window_seconds: float = 300.0):
        self._rules: list[CorrelationRule] = []
        self._parent_active: dict[str, float] = {}  # parent_alertname -> first_ts
        self.window = window_seconds

    def add_rule(self, rule: CorrelationRule) -> None:
        self._rules.append(rule)

    def observe(self, event: AlertEvent) -> None:
        """记录 parent 活跃时间."""
        for r in self._rules:
            if r.parent_alertname == event.alertname:
                if r.parent_alertname not in self._parent_active:
                    self._parent_active[r.parent_alertname] = event.ts
                return

    def is_suppressed(self, event: AlertEvent, now: float | None = None) -> tuple[bool, str]:
        t = now or time.time()
        cutoff = t - self.window
        # 清理过期 parent
        for p in list(self._parent_active.keys()):
            if self._parent_active[p] < cutoff:
                del self._parent_active[p]
        for r in self._rules:
            if r.parent_alertname in self._parent_active:
                if event.alertname in r.child_alertnames:
                    return True, f"correlated with parent={r.parent_alertname}"
        return False, ""

    def cleanup(self, now: float | None = None) -> None:
        t = now or time.time()
        cutoff = t - self.window
        self._parent_active = {k: v for k, v in self._parent_active.items() if v >= cutoff}

    def active_parents(self) -> list[str]:
        return list(self._parent_active.keys())


# ---------------------------------------------------------------------------
# 6. AlertNoiseReducer (顶层 pipeline)
# ---------------------------------------------------------------------------


@dataclass
class PipelineResult:
    event: AlertEvent
    action: ActionType
    reason: str = ""
    aggregated: AggregatedAlert | None = None

    def to_dict(self) -> dict:
        d = {"event": self.event.to_dict(), "action": self.action.value, "reason": self.reason}
        if self.aggregated:
            d["aggregated"] = self.aggregated.to_dict()
        return d


class AlertNoiseReducer:
    """告警降噪 pipeline."""

    def __init__(
        self, dedup_window_s: float = 60.0, silence: Silencer | None = None, correlator: Correlator | None = None
    ):
        self.dedup = Deduplicator(window_seconds=dedup_window_s)
        self.silencer = silence or Silencer()
        self.correlator = correlator or Correlator()
        self.aggregator = Aggregator()
        self._passed: list[AlertEvent] = []
        self._suppressed: list[AlertEvent] = []
        self._stats: dict[str, int] = {
            "received": 0,
            "passed": 0,
            "suppressed_dedup": 0,
            "suppressed_silence": 0,
            "suppressed_correlate": 0,
        }

    def process(self, event: AlertEvent, now: float | None = None) -> PipelineResult:
        self._stats["received"] += 1
        t = now or time.time()
        # 1) dedup
        if not self.dedup.should_pass(event, t):
            self._stats["suppressed_dedup"] += 1
            self._suppressed.append(event)
            return PipelineResult(event=event, action=ActionType.SUPPRESS, reason="duplicate")
        # 2) silence
        silenced, reason = self.silencer.is_silenced(event, t)
        if silenced:
            self._stats["suppressed_silence"] += 1
            self._suppressed.append(event)
            return PipelineResult(event=event, action=ActionType.SUPPRESS, reason=reason)
        # 3) correlate
        suppressed, reason = self.correlator.is_suppressed(event, t)
        # 记录 parent (无论是否被抑制)
        self.correlator.observe(event)
        if suppressed:
            self._stats["suppressed_correlate"] += 1
            self._suppressed.append(event)
            return PipelineResult(event=event, action=ActionType.SUPPRESS, reason=reason)
        # 4) pass
        self._stats["passed"] += 1
        self._passed.append(event)
        return PipelineResult(event=event, action=ActionType.PASS, reason="")

    def aggregate_passed(self, group_by: list[str], window_s: float = 300.0) -> list[AggregatedAlert]:
        return self.aggregator.aggregate(self._passed, group_by, window_s)

    def stats(self) -> dict:
        return dict(self._stats)

    def passed(self, limit: int = 100) -> list[dict]:
        return [e.to_dict() for e in self._passed[-limit:]]

    def suppressed(self, limit: int = 100) -> list[dict]:
        return [e.to_dict() for e in self._suppressed[-limit:]]

    def reset(self) -> None:
        self._passed.clear()
        self._suppressed.clear()
        self._stats = {
            "received": 0,
            "passed": 0,
            "suppressed_dedup": 0,
            "suppressed_silence": 0,
            "suppressed_correlate": 0,
        }
        self.dedup.clear()


# ---------------------------------------------------------------------------
# 7. CLI
# ---------------------------------------------------------------------------


def _demo_events() -> list[AlertEvent]:
    return [
        AlertEvent(
            "e1", "HighCPU", Severity.WARNING, "node-1", labels={"host": "node-1", "service": "api"}, message="CPU 95%"
        ),
        AlertEvent(
            "e2", "HighCPU", Severity.WARNING, "node-1", labels={"host": "node-1", "service": "api"}, message="CPU 96%"
        ),
        AlertEvent(
            "e3", "HighCPU", Severity.WARNING, "node-1", labels={"host": "node-1", "service": "api"}, message="CPU 97%"
        ),
        AlertEvent(
            "e4", "HighCPU", Severity.WARNING, "node-2", labels={"host": "node-2", "service": "api"}, message="CPU 99%"
        ),
        AlertEvent("e5", "DiskFull", Severity.ERROR, "node-1", labels={"host": "node-1"}, message="Disk 95%"),
        AlertEvent("e6", "ServiceDown", Severity.CRITICAL, "lb-1", labels={"service": "api"}, message="LB 503"),
        AlertEvent(
            "e7",
            "HighLatency",
            Severity.WARNING,
            "node-1",
            labels={"host": "node-1", "service": "api"},
            message="P99 5s",
        ),
    ]


def main(argv: list[str] | None = None, reducer: AlertNoiseReducer | None = None) -> int:
    import argparse

    p = argparse.ArgumentParser(description="智能告警降噪")
    sub = p.add_subparsers(dest="cmd", required=True)

    p_demo = sub.add_parser("demo")
    p_demo.add_argument("--simulate", default="storm", choices=["storm", "silence", "correlate"])
    p_demo.add_argument("--format", default="json", choices=["json", "summary"])

    p_report = sub.add_parser("report")

    args = p.parse_args(argv)
    r = reducer or AlertNoiseReducer()
    if args.cmd == "demo":
        events = _demo_events()
        if args.simulate == "silence":
            r.silencer.add(
                SilenceRule(
                    match_alertname="HighCPU", match_labels={"host": "node-1"}, duration_minutes=5, reason="maintenance"
                )
            )
        elif args.simulate == "correlate":
            r.correlator.add_rule(
                CorrelationRule(
                    parent_alertname="ServiceDown",
                    child_alertnames=["HighCPU", "HighLatency"],
                    description="Service 挂时抑制延迟告警",
                )
            )
        results = [r.process(e).to_dict() for e in events]
        agg = r.aggregate_passed(group_by=["alertname", "host"], window_s=600.0)
        output = {
            "results": results,
            "aggregated": [a.to_dict() for a in agg],
            "stats": r.stats(),
        }
        print(json.dumps(output, ensure_ascii=False, indent=2, default=str))
        return 0
    if args.cmd == "report":
        events = _demo_events()
        for e in events:
            r.process(e)
        agg = r.aggregate_passed(group_by=["alertname"], window_s=600.0)
        lines = ["# 告警降噪报表", ""]
        s = r.stats()
        lines.append(f"- 收到: **{s['received']}**")
        lines.append(f"- 通过: **{s['passed']}**")
        lines.append(
            f"- 抑制: dedup={s['suppressed_dedup']}, silence={s['suppressed_silence']}, correlate={s['suppressed_correlate']}"
        )
        lines.append("")
        if agg:
            lines.append("## 聚合")
            lines.append("")
            lines.append("| 分组 | 数量 | 告警 |")
            lines.append("| --- | --- | --- |")
            for a in agg:
                lines.append(f"| {a.group_key} | {a.count} | {a.alertname} |")
        print("\n".join(lines) + "\n")
        return 0
    return 1


if __name__ == "__main__":
    import sys

    sys.exit(main())
