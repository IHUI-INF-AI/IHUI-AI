"""Bug-120: 慢查询降级开关.

设计:
  - 阈值规则: 同一查询 (指纹) 累计耗时 > 阈值触发降级
  - 白名单: 永不被 kill
  - 临时限流: kill 后的一段时间内同类查询直接拒绝
  - 注入: 实际执行函数由调用方提供
  - 审计: 每次降级/限流记录
  - 影响范围统计: 被 kill 的查询数和总耗时
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


class KillAction(enum.StrEnum):
    ALLOW = "allow"
    KILL = "kill"  # 终止
    THROTTLE = "throttle"  # 限流
    DEGRADE = "degrade"  # 降级 (返回缓存/默认值)


@dataclass
class QueryStats:
    fingerprint: str
    sample: str
    total_count: int = 0
    total_duration_sec: float = 0.0
    max_duration_sec: float = 0.0
    p95_duration_sec: float = 0.0
    recent_durations: deque[float] = field(default_factory=lambda: deque(maxlen=100))
    last_seen: float = 0.0


@dataclass
class KillRule:
    fingerprint: str
    max_duration_sec: float = 5.0
    action: str = KillAction.KILL.value
    ttl_sec: float = 60.0
    triggered_at: float = 0.0
    hit_count: int = 0
    active: bool = True
    whitelist: bool = False


@dataclass
class KillAudit:
    ts: float
    fingerprint: str
    action: str
    sample: str
    duration_sec: float
    reason: str = ""


class SlowQueryKillSwitch:
    """慢查询降级开关."""

    def __init__(self, default_max_duration: float = 5.0, recent_window: int = 100):
        self._lock = threading.RLock()
        self._default_max = default_max_duration
        self._stats: dict[str, QueryStats] = {}
        self._rules: dict[str, KillRule] = {}
        self._whitelist: set[str] = set()
        self._audits: deque[KillAudit] = deque(maxlen=2000)
        self._total = 0
        self._total_killed = 0
        self._total_throttled = 0
        self._total_degraded = 0
        self._total_saved_sec = 0.0

    def add_whitelist(self, fingerprint: str) -> None:
        with self._lock:
            self._whitelist.add(fingerprint)

    def add_rule(
        self,
        fingerprint: str,
        max_duration_sec: float = 5.0,
        action: str = KillAction.KILL.value,
        ttl_sec: float = 60.0,
    ) -> KillRule:
        with self._lock:
            r = KillRule(
                fingerprint=fingerprint,
                max_duration_sec=max_duration_sec,
                action=action,
                ttl_sec=ttl_sec,
                triggered_at=time.time(),
            )
            self._rules[fingerprint] = r
            return r

    def remove_rule(self, fingerprint: str) -> bool:
        with self._lock:
            return self._rules.pop(fingerprint, None) is not None

    def expire_rules(self) -> int:
        with self._lock:
            now = time.time()
            expired = []
            for fp, r in self._rules.items():
                if r.active and (now - r.triggered_at) > r.ttl_sec:
                    r.active = False
                    expired.append(fp)
            return len(expired)

    def execute(
        self,
        fingerprint: str,
        sample: str,
        fn: Callable[[], Any],
        timeout_sec: float | None = None,
    ) -> dict:
        """执行查询. 返回 {ok, action, value, duration_sec, error}.
        若触发 kill/throttle, 不执行 fn, 直接返回决策.
        """
        with self._lock:
            self._total += 1
        if fingerprint in self._whitelist:
            return self._do_run(fingerprint, sample, fn)
        with self._lock:
            rule = self._rules.get(fingerprint)
            if rule is not None and rule.active:
                with self._lock:
                    rule.hit_count += 1
                if rule.action == KillAction.KILL.value:
                    self._record_audit(KillAudit(time.time(), fingerprint, "kill", sample, 0.0, "rule_active"))
                    with self._lock:
                        self._total_killed += 1
                    return {
                        "ok": False,
                        "action": "kill",
                        "value": None,
                        "duration_sec": 0.0,
                        "error": "killed by rule",
                    }
                if rule.action == KillAction.THROTTLE.value:
                    self._record_audit(KillAudit(time.time(), fingerprint, "throttle", sample, 0.0, "rule_active"))
                    with self._lock:
                        self._total_throttled += 1
                    return {"ok": False, "action": "throttle", "value": None, "duration_sec": 0.0, "error": "throttled"}
                if rule.action == KillAction.DEGRADE.value:
                    return self._do_run(fingerprint, sample, fn, degrade=True)
        return self._do_run(fingerprint, sample, fn, timeout_sec=timeout_sec)

    def _do_run(
        self,
        fingerprint: str,
        sample: str,
        fn: Callable[[], Any],
        timeout_sec: float | None = None,
        degrade: bool = False,
    ) -> dict:
        start = time.time()
        try:
            val = fn()
            duration = time.time() - start
            self._record_stats(fingerprint, sample, duration)
            if not degrade and duration > self._default_max:
                # 自动建规则
                self.add_rule(fingerprint, max_duration_sec=duration, action=KillAction.THROTTLE.value, ttl_sec=60.0)
                self._record_audit(
                    KillAudit(
                        time.time(), fingerprint, "auto_throttle", sample, duration, f"duration>{self._default_max}"
                    )
                )
            return {
                "ok": True,
                "action": "allow" if not degrade else "degrade",
                "value": val,
                "duration_sec": duration,
                "error": None,
            }
        except Exception as e:
            duration = time.time() - start
            self._record_stats(fingerprint, sample, duration)
            return {"ok": False, "action": "error", "value": None, "duration_sec": duration, "error": str(e)}

    def _record_stats(self, fingerprint: str, sample: str, duration: float) -> None:
        with self._lock:
            st = self._stats.get(fingerprint) or QueryStats(fingerprint=fingerprint, sample=sample)
            st.total_count += 1
            st.total_duration_sec += duration
            if duration > st.max_duration_sec:
                st.max_duration_sec = duration
            st.recent_durations.append(duration)
            # p95 估算
            arr = sorted(st.recent_durations)
            if arr:
                idx = int(len(arr) * 0.95)
                st.p95_duration_sec = arr[min(idx, len(arr) - 1)]
            st.last_seen = time.time()
            self._stats[fingerprint] = st

    def _record_audit(self, ev: KillAudit) -> None:
        with self._lock:
            self._audits.append(ev)

    def get_stats(self, fingerprint: str) -> QueryStats | None:
        with self._lock:
            return self._stats.get(fingerprint)

    def list_slow(self, threshold: float | None = None, limit: int = 20) -> list[QueryStats]:
        with self._lock:
            arr = list(self._stats.values())
        t = threshold or self._default_max
        arr = [s for s in arr if s.max_duration_sec >= t]
        arr.sort(key=lambda s: s.max_duration_sec, reverse=True)
        return arr[:limit]

    def list_audits(self, fingerprint: str | None = None, limit: int = 50) -> list[KillAudit]:
        with self._lock:
            arr = list(self._audits)
        if fingerprint:
            arr = [a for a in arr if a.fingerprint == fingerprint]
        return arr[-limit:]

    def impact(self) -> dict:
        """受影响范围统计."""
        with self._lock:
            saved = 0.0
            for fp, r in self._rules.items():
                st = self._stats.get(fp)
                if st is None:
                    continue
                avg = st.total_duration_sec / max(1, st.total_count)
                saved += avg * r.hit_count
            self._total_saved_sec = saved
            return {
                "total_queries": self._total,
                "killed": self._total_killed,
                "throttled": self._total_throttled,
                "degraded": self._total_degraded,
                "active_rules": sum(1 for r in self._rules.values() if r.active),
                "whitelist_count": len(self._whitelist),
                "saved_sec_estimate": round(saved, 2),
            }

    def stats(self) -> dict:
        return self.impact()


# 全局单例
slow_query_kill_switch = SlowQueryKillSwitch()
