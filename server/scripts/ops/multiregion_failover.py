"""Phase 18 建议 1: 多区域容灾 - 健康检查 + DNS 切换 + 数据回切.

目的:
  - 多区域 (us-east-1 / us-west-2 / eu-west-1) 主备架构
  - 健康检查滑动窗口: latency / error_rate / consecutive_failures
  - 自动 failover: PRIMARY 不可用 -> 升级最佳 SECONDARY
  - 数据回切: 原 PRIMARY 恢复且数据滞后 < 阈值 -> 自动切回
  - 完整审计: FailoverEvent + 时间线

设计:
  Region:
    name, endpoint, role (PRIMARY/SECONDARY), weight, state

  HealthCheck:
    timestamp, latency_ms, success, status_code

  RegionHealthMonitor:
    per-region 滑动窗口, 产 RegionHealth 摘要

  DNSRouter:
    routing_table: {endpoint_alias -> region}
    模拟 TTL + 切流

  DataReplicator:
    追踪跨区域数据复制进度 (last_wal_lsn / lag_seconds)
    主备同步状态

  FailoverController:
    tick() 周期检查 -> 决策 (noop / failover / failback)
    bind_router(router) 触发时改 routing_table
    bind_replicator(replicator) 查 lag

  FailoverEvent:
    ts, action, from_region, to_region, reason, details
"""

from __future__ import annotations

import json
import time
from collections import defaultdict, deque
from collections.abc import Callable
from dataclasses import asdict, dataclass, field
from enum import Enum
from typing import Any

# ---------------------------------------------------------------------------
# 1. 枚举
# ---------------------------------------------------------------------------


class RegionRole(str, Enum):
    PRIMARY = "primary"
    SECONDARY = "secondary"
    DR = "dr"  # 灾备


class RegionState(str, Enum):
    HEALTHY = "healthy"
    DEGRADED = "degraded"
    OFFLINE = "offline"
    DRAINING = "draining"  # 切流中, 不接受新请求


class FailoverAction(str, Enum):
    NOOP = "noop"
    FAILOVER = "failover"  # 切到备
    FAILBACK = "failback"  # 切回主
    MARK_DEGRADED = "mark_degraded"
    MARK_OFFLINE = "mark_offline"
    RECOVER = "recover"


class FailoverReason(str, Enum):
    PRIMARY_DOWN = "primary_down"
    PRIMARY_DEGRADED = "primary_degraded"
    PRIMARY_RECOVERED = "primary_recovered"
    DATA_LAG_OK = "data_lag_ok"
    DATA_LAG_HIGH = "data_lag_high"
    MANUAL = "manual"


# ---------------------------------------------------------------------------
# 2. 数据类
# ---------------------------------------------------------------------------


@dataclass
class Region:
    name: str
    endpoint: str
    role: RegionRole
    state: RegionState = RegionState.HEALTHY
    weight: int = 100  # 流量权重 (健康时)
    region_id: str = ""  # 简短 ID, 用于 DNS 切换

    def __post_init__(self):
        if not self.region_id:
            self.region_id = self.name


@dataclass
class HealthCheck:
    region: str
    ts: float
    latency_ms: float
    success: bool
    status_code: int = 200
    error: str = ""


@dataclass
class HealthThresholds:
    max_latency_ms: float = 2000.0
    max_error_rate: float = 0.10
    min_sample_size: int = 5
    window_seconds: float = 30.0
    consecutive_failure_to_offline: int = 3
    max_data_lag_seconds: float = 10.0  # 切换/回切时 lag 容忍


@dataclass
class RegionHealth:
    region: str
    samples: int
    error_rate: float
    p99_latency_ms: float
    consecutive_failures: int
    status: str  # healthy / degraded / offline / insufficient_data


@dataclass
class FailoverEvent:
    ts: float
    action: str
    reason: str
    from_region: str
    to_region: str
    details: dict = field(default_factory=dict)

    def to_dict(self) -> dict:
        return {
            "ts": self.ts,
            "ts_iso": time.strftime("%Y-%m-%d %H:%M:%S", time.localtime(self.ts)),
            "action": self.action,
            "reason": self.reason,
            "from_region": self.from_region,
            "to_region": self.to_region,
            **self.details,
        }


# ---------------------------------------------------------------------------
# 3. RegionHealthMonitor
# ---------------------------------------------------------------------------


class RegionHealthMonitor:
    """per-region 滑动窗口健康监控."""

    def __init__(self, thresholds: HealthThresholds):
        self.thresholds = thresholds
        self._records: dict[str, deque[HealthCheck]] = defaultdict(deque)
        self._consecutive_failures: dict[str, int] = defaultdict(int)

    def record(self, hc: HealthCheck) -> None:
        dq = self._records[hc.region]
        dq.append(hc)
        self._cleanup(dq, hc.ts)
        if hc.success:
            self._consecutive_failures[hc.region] = 0
        else:
            self._consecutive_failures[hc.region] += 1

    def _cleanup(self, dq: deque, now: float) -> None:
        cutoff = now - self.thresholds.window_seconds
        while dq and dq[0].ts < cutoff:
            dq.popleft()

    def evaluate(self, region: str) -> RegionHealth:
        dq = self._records.get(region, deque())
        if dq:
            self._cleanup(dq, time.time())
        n = len(dq)
        if n < self.thresholds.min_sample_size:
            return RegionHealth(
                region=region,
                samples=n,
                error_rate=0.0,
                p99_latency_ms=0.0,
                consecutive_failures=self._consecutive_failures.get(region, 0),
                status="insufficient_data",
            )
        errors = sum(1 for h in dq if not h.success)
        error_rate = errors / n
        latencies = sorted([h.latency_ms for h in dq])
        p99_idx = max(0, int(0.99 * n) - 1)
        p99 = latencies[p99_idx]
        status = "healthy"
        if (
            self._consecutive_failures.get(region, 0) >= self.thresholds.consecutive_failure_to_offline
            or error_rate >= self.thresholds.max_error_rate * 2
        ):
            status = "offline"
        elif error_rate > self.thresholds.max_error_rate or p99 > self.thresholds.max_latency_ms:
            status = "degraded"
        return RegionHealth(
            region=region,
            samples=n,
            error_rate=round(error_rate, 4),
            p99_latency_ms=round(p99, 2),
            consecutive_failures=self._consecutive_failures.get(region, 0),
            status=status,
        )

    def clear(self, region: str | None = None) -> None:
        if region:
            self._records.get(region, deque()).clear()
        else:
            self._records.clear()
            self._consecutive_failures.clear()


# ---------------------------------------------------------------------------
# 4. DNSRouter
# ---------------------------------------------------------------------------


class DNSRouter:
    """DNS 路由表 + 模拟 TTL 切流."""

    def __init__(self):
        # 域名 -> 当前 region_id
        self._table: dict[str, str] = {}
        # 备援池: 域名 -> [region_id, ...] (按优先级)
        self._backup_pool: dict[str, list[str]] = {}
        # 切换历史
        self._history: list[dict] = []
        self._default_ttl_s: int = 60

    def add_record(self, domain: str, primary_region: str, backup_pool: list[str] | None = None) -> None:
        self._table[domain] = primary_region
        self._backup_pool[domain] = list(backup_pool or [])

    def resolve(self, domain: str) -> str | None:
        return self._table.get(domain)

    def switch(self, domain: str, to_region: str) -> bool:
        if domain not in self._table:
            return False
        prev = self._table[domain]
        if prev == to_region:
            return False
        self._table[domain] = to_region
        self._history.append(
            {
                "ts": time.time(),
                "domain": domain,
                "from": prev,
                "to": to_region,
            }
        )
        return True

    def history(self, limit: int = 50) -> list[dict]:
        return self._history[-limit:]

    def snapshot(self) -> dict:
        return {
            "routing_table": dict(self._table),
            "backup_pool": {k: list(v) for k, v in self._backup_pool.items()},
            "history_count": len(self._history),
        }


# ---------------------------------------------------------------------------
# 5. DataReplicator
# ---------------------------------------------------------------------------


class DataReplicator:
    """跨区域数据复制追踪 (模拟)."""

    def __init__(self):
        # (src_region, dst_region) -> {last_sync_ts, lag_seconds}
        self._lag: dict[tuple[str, str], float] = {}
        # 模拟上次同步时间
        self._last_sync: dict[tuple[str, str], float] = {}

    def set_lag(self, src: str, dst: str, lag_seconds: float) -> None:
        self._lag[(src, dst)] = max(0.0, lag_seconds)
        self._last_sync[(src, dst)] = time.time() - lag_seconds

    def get_lag(self, src: str, dst: str) -> float:
        return self._lag.get((src, dst), 0.0)

    def lag_ok(self, src: str, dst: str, max_lag: float) -> bool:
        return self.get_lag(src, dst) <= max_lag

    def all_lags(self) -> dict:
        return {f"{s}->{d}": v for (s, d), v in self._lag.items()}


# ---------------------------------------------------------------------------
# 6. FailoverController
# ---------------------------------------------------------------------------


class FailoverController:
    """自动 failover / failback 控制器."""

    def __init__(
        self,
        monitor: RegionHealthMonitor,
        router: DNSRouter,
        replicator: DataReplicator,
        regions: list[Region],
        thresholds: HealthThresholds | None = None,
        on_failover: Callable[[FailoverEvent], Any] | None = None,
    ):
        self.monitor = monitor
        self.router = router
        self.replicator = replicator
        self.regions = {r.region_id: r for r in regions}
        self.thresholds = thresholds or HealthThresholds()
        self.on_failover = on_failover
        self._events: list[FailoverEvent] = []
        # 当前主 (用于 DNS 切换)
        self._current_primary: str | None = None
        self._init_primary()

    def _init_primary(self) -> None:
        for r in self.regions.values():
            if r.role == RegionRole.PRIMARY:
                self._current_primary = r.region_id
                return

    def current_primary(self) -> str | None:
        return self._current_primary

    def record_health(self, hc: HealthCheck) -> None:
        self.monitor.record(hc)

    def regions_by_health(self) -> list[tuple[str, RegionHealth]]:
        """按健康度排序: healthy > degraded > offline (取最佳 SECONDARY)."""
        out: list[tuple[str, RegionHealth]] = []
        for rid in self.regions:
            h = self.monitor.evaluate(rid)
            out.append((rid, h))
        order = {"healthy": 3, "insufficient_data": 2, "degraded": 1, "offline": 0}
        out.sort(key=lambda x: -order.get(x[1].status, 0))
        return out

    def tick(self, now: float | None = None) -> dict:
        """周期检查, 决策 failover / failback."""
        t = now or time.time()
        primary = self._current_primary
        if primary is None:
            return {"action": FailoverAction.NOOP.value, "reason": "no_primary"}
        primary_health = self.monitor.evaluate(primary)
        # 1) PRIMARY offline -> failover
        if primary_health.status == "offline":
            backup = self._pick_best_backup()
            if backup is None:
                return {
                    "action": FailoverAction.MARK_OFFLINE.value,
                    "reason": FailoverReason.PRIMARY_DOWN.value,
                    "primary": primary,
                }
            ev = self._do_failover(
                t,
                primary,
                backup,
                FailoverReason.PRIMARY_DOWN,
                {"primary_health": asdict(primary_health)},
            )
            return {"action": FailoverAction.FAILOVER.value, "event": ev.to_dict()}
        # 2) PRIMARY degraded -> 标记 + (若满足) 切到备
        if primary_health.status == "degraded":
            # 备选 region 健康度更好 -> 切
            backup = self._pick_best_backup(exclude=primary)
            if backup is not None and self._is_healthier(backup, primary):
                ev = self._do_failover(
                    t,
                    primary,
                    backup,
                    FailoverReason.PRIMARY_DEGRADED,
                    {"primary_health": asdict(primary_health)},
                )
                return {"action": FailoverAction.FAILOVER.value, "event": ev.to_dict()}
            return {
                "action": FailoverAction.MARK_DEGRADED.value,
                "reason": FailoverReason.PRIMARY_DEGRADED.value,
                "primary": primary,
            }
        # 3) PRIMARY healthy -> 检查原 PRIMARY 是否需回切
        # 找"原 PRIMARY" (state=DRAINING/被切走的)
        draining = [r for r in self.regions.values() if r.state == RegionState.DRAINING and r.region_id != primary]
        for r in draining:
            lag = self.replicator.get_lag(r.region_id, primary)
            h = self.monitor.evaluate(r.region_id)
            if h.status == "healthy" and lag <= self.thresholds.max_data_lag_seconds:
                ev = self._do_failback(
                    t, r.region_id, primary, FailoverReason.PRIMARY_RECOVERED, {"lag_seconds": lag, "health": asdict(h)}
                )
                return {"action": FailoverAction.FAILBACK.value, "event": ev.to_dict()}
        return {"action": FailoverAction.NOOP.value, "reason": "all_good", "primary": primary}

    def _pick_best_backup(self, exclude: str | None = None) -> str | None:
        best = None
        best_score = -1
        order = {"healthy": 3, "insufficient_data": 2, "degraded": 1, "offline": 0}
        for rid, h in self.regions_by_health():
            if rid == exclude:
                continue
            r = self.regions.get(rid)
            if r is None or r.role == RegionRole.PRIMARY:
                continue
            score = order.get(h.status, 0)
            if score > best_score:
                best = rid
                best_score = score
        return best

    def _is_healthier(self, a: str, b: str) -> bool:
        order = {"healthy": 3, "insufficient_data": 2, "degraded": 1, "offline": 0}
        ha = self.monitor.evaluate(a)
        hb = self.monitor.evaluate(b)
        return order.get(ha.status, 0) > order.get(hb.status, 0)

    def _do_failover(self, ts: float, frm: str, to: str, reason: FailoverReason, details: dict) -> FailoverEvent:
        # 改 regions 状态
        old = self.regions.get(frm)
        new = self.regions.get(to)
        if old:
            old.state = RegionState.DRAINING
            old.role = RegionRole.SECONDARY
        if new:
            new.state = RegionState.HEALTHY
            new.role = RegionRole.PRIMARY
        # 改 DNS
        for domain in list(self.router._table.keys()):
            self.router.switch(domain, to)
        # 事件
        ev = FailoverEvent(
            ts=ts,
            action=FailoverAction.FAILOVER.value,
            reason=reason.value,
            from_region=frm,
            to_region=to,
            details=details,
        )
        self._events.append(ev)
        self._current_primary = to
        if self.on_failover:
            try:
                self.on_failover(ev)
            except Exception:
                pass
        return ev

    def _do_failback(self, ts: float, frm: str, to: str, reason: FailoverReason, details: dict) -> FailoverEvent:
        old = self.regions.get(frm)
        new = self.regions.get(to)
        if old:
            old.state = RegionState.HEALTHY
            old.role = RegionRole.PRIMARY
        if new:
            new.state = RegionState.DRAINING
            new.role = RegionRole.SECONDARY
        for domain in list(self.router._table.keys()):
            self.router.switch(domain, frm)
        ev = FailoverEvent(
            ts=ts,
            action=FailoverAction.FAILBACK.value,
            reason=reason.value,
            from_region=to,
            to_region=frm,
            details=details,
        )
        self._events.append(ev)
        self._current_primary = frm
        if self.on_failover:
            try:
                self.on_failover(ev)
            except Exception:
                pass
        return ev

    def force_failover(self, to_region: str) -> FailoverEvent:
        """手动触发 failover."""
        if to_region == self._current_primary:
            return FailoverEvent(
                ts=time.time(),
                action=FailoverAction.NOOP.value,
                reason="already_primary",
                from_region=to_region,
                to_region=to_region,
            )
        return self._do_failover(time.time(), self._current_primary or "", to_region, FailoverReason.MANUAL, {})

    def events(self, limit: int = 50) -> list[dict]:
        return [e.to_dict() for e in self._events[-limit:]]

    def report(self) -> str:
        lines: list[str] = []
        lines.append("# 多区域容灾报表")
        lines.append("")
        lines.append(f"- 当前主区域: **{self._current_primary}**")
        lines.append(f"- 事件总数: **{len(self._events)}**")
        lines.append("")
        lines.append("## 区域健康")
        lines.append("")
        lines.append("| 区域 | 角色 | 状态 | 样本 | 错误率 | P99(ms) | 连续失败 |")
        lines.append("| --- | --- | --- | --- | --- | --- | --- |")
        for rid in self.regions:
            r = self.regions[rid]
            h = self.monitor.evaluate(rid)
            lines.append(
                f"| {rid} | {r.role.value} | {r.state.value} | {h.samples} | "
                f"{h.error_rate*100:.1f}% | {h.p99_latency_ms:.0f} | {h.consecutive_failures} |"
            )
        lines.append("")
        if self._events:
            lines.append("## 最近事件")
            lines.append("")
            lines.append("| 时间 | 动作 | 原因 | from -> to |")
            lines.append("| --- | --- | --- | --- |")
            for e in self._events[-20:]:
                lines.append(f"| {e.ts_iso} | {e.action} | {e.reason} | {e.from_region} -> {e.to_region} |")
        return "\n".join(lines) + "\n"


# ---------------------------------------------------------------------------
# 7. CLI
# ---------------------------------------------------------------------------


def _demo_setup() -> tuple[FailoverController, DNSRouter, DataReplicator, list[Region]]:
    regions = [
        Region("us-east-1", "https://us-east-1.zhs.io", RegionRole.PRIMARY),
        Region("us-west-2", "https://us-west-2.zhs.io", RegionRole.SECONDARY),
        Region("eu-west-1", "https://eu-west-1.zhs.io", RegionRole.SECONDARY),
    ]
    router = DNSRouter()
    router.add_record("api.zhs.io", "us-east-1", ["us-west-2", "eu-west-1"])
    replicator = DataReplicator()
    monitor = RegionHealthMonitor(HealthThresholds())
    controller = FailoverController(monitor, router, replicator, regions)
    return controller, router, replicator, regions


def main(argv: list[str] | None = None, controller: FailoverController | None = None) -> int:
    import argparse

    p = argparse.ArgumentParser(description="多区域容灾")
    sub = p.add_subparsers(dest="cmd", required=True)

    p_demo = sub.add_parser("demo")
    p_demo.add_argument(
        "--simulate", default="healthy", choices=["healthy", "primary_down", "primary_degraded", "failback"]
    )

    p_report = sub.add_parser("report")

    args = p.parse_args(argv)
    if controller is None:
        controller, _, _, _ = _demo_setup()
    if args.cmd == "demo":
        # 注入样本
        now = time.time()
        if args.simulate == "healthy":
            for rid in ["us-east-1", "us-west-2", "eu-west-1"]:
                for i in range(10):
                    controller.record_health(
                        HealthCheck(
                            region=rid,
                            ts=now - i,
                            latency_ms=100.0 + i,
                            success=True,
                        )
                    )
        elif args.simulate == "primary_down":
            for i in range(10):
                controller.record_health(
                    HealthCheck(
                        region="us-east-1",
                        ts=now - i,
                        latency_ms=100.0,
                        success=False,
                        status_code=503,
                        error="conn refused",
                    )
                )
            for rid in ["us-west-2", "eu-west-1"]:
                for i in range(10):
                    controller.record_health(
                        HealthCheck(
                            region=rid,
                            ts=now - i,
                            latency_ms=120.0,
                            success=True,
                        )
                    )
        elif args.simulate == "primary_degraded":
            for i in range(10):
                controller.record_health(
                    HealthCheck(
                        region="us-east-1",
                        ts=now - i,
                        latency_ms=5000.0,
                        success=True,
                    )
                )
            for rid in ["us-west-2", "eu-west-1"]:
                for i in range(10):
                    controller.record_health(
                        HealthCheck(
                            region=rid,
                            ts=now - i,
                            latency_ms=120.0,
                            success=True,
                        )
                    )
        elif args.simulate == "failback":
            # 1) primary 先 down -> failover (ts 在 30s 窗口内)
            for i in range(10):
                controller.record_health(
                    HealthCheck(
                        region="us-east-1",
                        ts=now - i,
                        latency_ms=100.0,
                        success=False,
                    )
                )
            for i in range(10):
                controller.record_health(
                    HealthCheck(
                        region="us-west-2",
                        ts=now - i,
                        latency_ms=120.0,
                        success=True,
                    )
                )
            r1 = controller.tick()
            # 2) primary 恢复, 但 lag 仍高
            controller.monitor.clear()
            fresh = time.time()
            for i in range(10):
                controller.record_health(
                    HealthCheck(
                        region="us-east-1",
                        ts=fresh - i,
                        latency_ms=100.0,
                        success=True,
                    )
                )
            controller.replicator.set_lag("us-east-1", "us-west-2", 100.0)
            r2 = controller.tick()
            # 3) lag 降下来
            controller.replicator.set_lag("us-east-1", "us-west-2", 1.0)
            r3 = controller.tick()
            print(
                json.dumps(
                    {
                        "step1_failover": r1,
                        "step2_no_failback_high_lag": r2,
                        "step3_failback": r3,
                    },
                    ensure_ascii=False,
                    indent=2,
                    default=str,
                )
            )
            return 0
        result = controller.tick()
        print(json.dumps(result, ensure_ascii=False, indent=2, default=str))
        return 0
    if args.cmd == "report":
        print(controller.report())
        return 0
    return 1


if __name__ == "__main__":
    import sys

    sys.exit(main())
