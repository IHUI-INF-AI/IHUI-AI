"""Bug-162: 告警抑制 (silence / inhibit rules).

匹配规则后让告警不发, 类似 Alertmanager silence:
- silence: 显式指定时间内不发送
- inhibit: 高级别告警抑制低级别
"""

import threading
import time
from dataclasses import dataclass, field


@dataclass
class SilenceRule:
    id: str
    match_labels: dict[str, str]
    start_ts: float
    end_ts: float
    reason: str = ""


@dataclass
class InhibitRule:
    id: str
    source_labels: dict[str, str]  # 触发方
    target_labels: dict[str, str]  # 被抑制方
    equal: list[str] = field(default_factory=list)  # 必须相等的 label


@dataclass
class InhibitDecision:
    silenced: bool
    inhibited: bool
    reason: str = ""


class AlertSuppressor:
    """告警抑制: silence + inhibit."""

    def __init__(self):
        self._lock = threading.Lock()
        self._silences: dict[str, SilenceRule] = {}
        self._inhibits: dict[str, InhibitRule] = {}
        self._stats = {"silenced": 0, "inhibited": 0, "passed": 0}

    def add_silence(self, rule: SilenceRule) -> None:
        with self._lock:
            self._silences[rule.id] = rule

    def remove_silence(self, rule_id: str) -> bool:
        with self._lock:
            return self._silences.pop(rule_id, None) is not None

    def add_inhibit(self, rule: InhibitRule) -> None:
        with self._lock:
            self._inhibits[rule.id] = rule

    def evaluate(
        self, labels: dict[str, str], severity: str, active_alerts: list[dict[str, object]] | None = None
    ) -> InhibitDecision:
        now = time.time()
        with self._lock:
            for s in self._silences.values():
                if s.start_ts <= now <= s.end_ts and self._match(s.match_labels, labels):
                    self._stats["silenced"] += 1
                    return InhibitDecision(silenced=True, inhibited=False, reason=f"silence:{s.id}")
            for inh in self._inhibits.values():
                if self._match(inh.target_labels, labels):
                    for a in active_alerts or []:
                        a_labels = a.get("labels", {}) if isinstance(a, dict) else {}
                        a_severity = a.get("severity") or a_labels.get("severity")  # type: ignore[attr-defined]
                        if a_severity in ("CRITICAL", "HIGH") and self._match(inh.source_labels, a_labels):  # type: ignore[arg-type]
                            ok = True
                            for k in inh.equal:
                                if labels.get(k) != a_labels.get(k):  # type: ignore[attr-defined]
                                    ok = False
                                    break
                            if ok:
                                self._stats["inhibited"] += 1
                                return InhibitDecision(silenced=False, inhibited=True, reason=f"inhibit:{inh.id}")
            self._stats["passed"] += 1
        return InhibitDecision(silenced=False, inhibited=False)

    @staticmethod
    def _match(rule: dict[str, str], labels: dict[str, str]) -> bool:
        return all(labels.get(k) == v for k, v in rule.items())

    def stats(self) -> dict[str, int]:
        with self._lock:
            return dict(self._stats)
