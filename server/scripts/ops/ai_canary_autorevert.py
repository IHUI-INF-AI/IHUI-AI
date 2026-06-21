"""Phase 17 建议 3: AI 灰度 Phase 3 - 严重度自动回滚.

目的:
  - 监控 canary 错误率, 超过阈值自动降级回 conventional
  - 监控延迟 P99, 超阈值告警
  - 监控成本激增, 超阈值暂停 canary
  - 滑动窗口评估, 误报过滤
  - 提供回滚审计 + 报表

设计:
  HealthMetric:
    canary/conventional 的 error_rate, p99_latency, cost_per_request

  WindowedMonitor:
    滑动窗口 (60s) 统计 canary 表现
    触发: 错误率 > X% OR 延迟 P99 > Yms OR 成本 > Z 倍

  RollbackAction:
    - DISABLE: 临时关 canary
    - ROLLBACK: 完全禁用 canary (灰度全停)
    - ALERT: 只告警, 不动

  AutoRollbackController:
    周期检查 (5s 一次)
    命中阈值时触发对应 action
    记录: 时间, 原因, action, 持续时间
"""

from __future__ import annotations

import json
import time
from collections import defaultdict, deque
from collections.abc import Callable
from dataclasses import dataclass, field
from enum import Enum
from typing import Any

# ---------------------------------------------------------------------------
# 1. 枚举
# ---------------------------------------------------------------------------


class RollbackAction(str, Enum):
    NONE = "none"
    ALERT = "alert"
    DISABLE = "disable"
    ROLLBACK = "rollback"


class RollbackReason(str, Enum):
    HIGH_ERROR_RATE = "high_error_rate"
    HIGH_LATENCY = "high_latency"
    COST_SPIKE = "cost_spike"
    ALL_FAILURES = "all_failures"


# ---------------------------------------------------------------------------
# 2. 数据类
# ---------------------------------------------------------------------------


@dataclass
class HealthThresholds:
    """健康阈值."""

    max_error_rate: float = 0.05  # 5%
    max_p99_latency_ms: float = 5000.0  # 5s
    max_cost_multiplier: float = 2.0  # canary 成本 > conventional 2 倍
    min_sample_size: int = 10  # 最少 10 个样本才评估
    window_seconds: float = 60.0  # 评估窗口


@dataclass
class CallRecord:
    model: str  # canary / conventional
    is_canary: bool
    success: bool
    latency_ms: float
    cost_usd: float
    ts: float = field(default_factory=time.time)


@dataclass
class RollbackEvent:
    ts: float
    reason: str
    action: str
    details: dict = field(default_factory=dict)
    auto_re_enable_after_s: float | None = None  # 自动恢复时间

    def to_dict(self) -> dict:
        return {
            "ts": self.ts,
            "ts_iso": time.strftime("%Y-%m-%d %H:%M:%S", time.localtime(self.ts)),
            "reason": self.reason,
            "action": self.action,
            **self.details,
        }


# ---------------------------------------------------------------------------
# 3. WindowedMonitor
# ---------------------------------------------------------------------------


class WindowedMonitor:
    """滑动窗口监控."""

    def __init__(self, thresholds: HealthThresholds):
        self.thresholds = thresholds
        # per-model deque
        self._records: dict[str, deque[CallRecord]] = defaultdict(deque)

    def record(self, rec: CallRecord) -> None:
        dq = self._records[rec.model]
        dq.append(rec)
        # 清理窗口外
        self._cleanup(dq, rec.ts)

    def _cleanup(self, dq: deque, now: float) -> None:
        cutoff = now - self.thresholds.window_seconds
        while dq and dq[0].ts < cutoff:
            dq.popleft()

    def stats(self, model: str, is_canary: bool) -> dict:
        dq = self._records.get(model, deque())
        if dq:
            self._cleanup(dq, time.time())
        if not dq:
            return {
                "samples": 0,
                "error_rate": 0.0,
                "p99_latency_ms": 0.0,
                "avg_cost_usd": 0.0,
                "total_cost_usd": 0.0,
            }
        n = len(dq)
        errors = sum(1 for r in dq if not r.success)
        latencies = sorted([r.latency_ms for r in dq])
        p99_idx = max(0, int(0.99 * n) - 1)
        p99 = latencies[p99_idx] if latencies else 0.0
        total_cost = sum(r.cost_usd for r in dq)
        avg_cost = total_cost / n if n > 0 else 0.0
        return {
            "samples": n,
            "error_rate": round(errors / n, 4) if n > 0 else 0.0,
            "p99_latency_ms": round(p99, 2),
            "avg_cost_usd": round(avg_cost, 6),
            "total_cost_usd": round(total_cost, 4),
        }

    def evaluate(self) -> dict:
        """评估 canary 状态. Returns: {status, action, reason, details}."""
        canary_stats = self.stats("canary", True)
        conv_stats = self.stats("conventional", False)
        details = {"canary": canary_stats, "conventional": conv_stats}
        # 样本不足, 不评估
        if canary_stats["samples"] < self.thresholds.min_sample_size:
            return {
                "status": "insufficient_data",
                "action": RollbackAction.NONE.value,
                "reason": "insufficient_data",
                "details": details,
            }
        # 1) 错误率
        if canary_stats["error_rate"] > self.thresholds.max_error_rate:
            return {
                "status": "unhealthy",
                "action": RollbackAction.ROLLBACK.value,
                "reason": RollbackReason.HIGH_ERROR_RATE.value,
                "details": details,
            }
        # 2) 延迟
        if canary_stats["p99_latency_ms"] > self.thresholds.max_p99_latency_ms:
            return {
                "status": "unhealthy",
                "action": RollbackAction.DISABLE.value,
                "reason": RollbackReason.HIGH_LATENCY.value,
                "details": details,
            }
        # 3) 成本倍数
        if conv_stats["samples"] > 0 and conv_stats["avg_cost_usd"] > 0:
            cost_mult = canary_stats["avg_cost_usd"] / conv_stats["avg_cost_usd"]
            if cost_mult > self.thresholds.max_cost_multiplier:
                return {
                    "status": "unhealthy",
                    "action": RollbackAction.ALERT.value,
                    "reason": RollbackReason.COST_SPIKE.value,
                    "details": {**details, "cost_multiplier": round(cost_mult, 2)},
                }
        return {
            "status": "healthy",
            "action": RollbackAction.NONE.value,
            "reason": "all_good",
            "details": details,
        }

    def clear(self) -> None:
        self._records.clear()


# ---------------------------------------------------------------------------
# 4. AutoRollbackController
# ---------------------------------------------------------------------------


class AutoRollbackController:
    """自动回滚控制器.

    用法:
        monitor = WindowedMonitor(thresholds)
        controller = AutoRollbackController(monitor, on_rollback=fn)
        controller.update_canary_strategy(strategy_obj_with_enabled_attr)
        # 每次有请求时:
        controller.observe(rec)
        # 周期 tick:
        controller.tick()
    """

    def __init__(
        self,
        monitor: WindowedMonitor,
        on_rollback: Callable[[RollbackEvent], Any] | None = None,
        check_interval_s: float = 5.0,
    ):
        self.monitor = monitor
        self.on_rollback = on_rollback
        self.check_interval = check_interval_s
        self._last_check = 0.0
        self._events: list[RollbackEvent] = []
        self._disabled_until: float | None = None
        self._canary_enabled = True
        # canary 策略回调 (修改 enabled 字段)
        self._canary_strategy: Any = None

    def bind_canary_strategy(self, strategy: Any) -> None:
        """绑定 CanaryStrategy, 触发回滚时改 strategy.enabled = False."""
        self._canary_strategy = strategy

    def observe(self, rec: CallRecord) -> None:
        self.monitor.record(rec)

    def tick(self, now: float | None = None) -> dict:
        """周期检查, 触发回滚."""
        t = now or time.time()
        if t - self._last_check < self.check_interval:
            return {"action": "skipped", "reason": "interval"}
        self._last_check = t
        # 检查是否已禁用到期 -> 重新启用, 清空历史避免立刻又触发
        if self._disabled_until is not None and t >= self._disabled_until:
            self._disabled_until = None
            self._canary_enabled = True
            if self._canary_strategy is not None:
                self._canary_strategy.enabled = True
            self.monitor.clear()
            self._events.append(
                RollbackEvent(
                    ts=t,
                    reason="auto_re_enable",
                    action="re_enable",
                    details={"reason": "disabled_until expired"},
                )
            )
            return {"action": "re_enabled", "reason": "disabled_until expired"}
        result = self.monitor.evaluate()
        action = result["action"]
        if action == RollbackAction.NONE.value:
            return result
        if action == RollbackAction.ALERT.value:
            self._emit_event(t, RollbackReason(result["reason"]), action, result["details"])
            return result
        if action == RollbackAction.DISABLE.value:
            self._canary_enabled = False
            if self._canary_strategy is not None:
                self._canary_strategy.enabled = False
            self._disabled_until = t + 60.0  # 60s 后重启用
            self._emit_event(t, RollbackReason(result["reason"]), action, result["details"])
            return result
        if action == RollbackAction.ROLLBACK.value:
            self._canary_enabled = False
            if self._canary_strategy is not None:
                self._canary_strategy.enabled = False
            self._disabled_until = t + 300.0  # 5min 后重启用
            self._emit_event(t, RollbackReason(result["reason"]), action, result["details"])
            return result
        return result

    def _emit_event(self, ts: float, reason: RollbackReason, action: str, details: dict) -> None:
        ev = RollbackEvent(ts=ts, reason=reason.value, action=action, details=details)
        self._events.append(ev)
        if self.on_rollback is not None:
            try:
                r = self.on_rollback(ev)
                if hasattr(r, "__await__") or hasattr(r, "__aiter__"):
                    pass  # 不在异步上下文
            except Exception:
                pass

    def is_canary_enabled(self) -> bool:
        return self._canary_enabled and (
            self._canary_strategy is None or getattr(self._canary_strategy, "enabled", True)
        )

    def events(self, limit: int = 50) -> list[dict]:
        return [e.to_dict() for e in self._events[-limit:]]

    def force_re_enable(self) -> None:
        """手动重启用 canary."""
        self._canary_enabled = True
        self._disabled_until = None
        if self._canary_strategy is not None:
            self._canary_strategy.enabled = True
        self._events.append(
            RollbackEvent(
                ts=time.time(),
                reason="manual_re_enable",
                action="re_enable",
            )
        )

    def report(self) -> str:
        lines: list[str] = []
        lines.append("# AI 灰度自动回滚报表")
        lines.append("")
        lines.append(f"- 监控窗口: {self.monitor.thresholds.window_seconds}s")
        lines.append(f"- 错误率阈值: {self.monitor.thresholds.max_error_rate*100:.1f}%")
        lines.append(f"- 延迟 P99 阈值: {self.monitor.thresholds.max_p99_latency_ms:.0f}ms")
        lines.append(f"- 成本倍数阈值: {self.monitor.thresholds.max_cost_multiplier:.1f}x")
        lines.append(f"- Canary 当前状态: {'启用' if self.is_canary_enabled() else '禁用'}")
        lines.append(f"- 事件总数: **{len(self._events)}**")
        lines.append("")
        if self._events:
            lines.append("## 最近事件")
            lines.append("")
            lines.append("| 时间 | 原因 | 动作 |")
            lines.append("| --- | --- | --- |")
            for e in self._events[-20:]:
                lines.append(f"| {e.ts_iso} | {e.reason} | {e.action} |")
        return "\n".join(lines) + "\n"


# ---------------------------------------------------------------------------
# 5. CLI
# ---------------------------------------------------------------------------


def main(argv: list[str] | None = None) -> int:
    import argparse

    p = argparse.ArgumentParser(description="AI 灰度自动回滚")
    sub = p.add_subparsers(dest="cmd", required=True)

    p_demo = sub.add_parser("demo")
    p_demo.add_argument("--simulate", default="healthy", choices=["healthy", "errors", "latency", "cost"])

    p_report = sub.add_parser("report")

    args = p.parse_args(argv)
    thresholds = HealthThresholds()
    monitor = WindowedMonitor(thresholds)
    controller = AutoRollbackController(monitor, check_interval_s=0.01)

    if args.cmd == "demo":
        # 注入模拟数据
        if args.simulate == "healthy":
            for i in range(50):
                controller.observe(
                    CallRecord(
                        model="canary" if i % 2 == 0 else "conventional",
                        is_canary=(i % 2 == 0),
                        success=True,
                        latency_ms=200.0,
                        cost_usd=0.001,
                    )
                )
        elif args.simulate == "errors":
            for i in range(20):
                # canary 80% 失败
                is_canary = i % 2 == 0
                success = (i % 5 != 0) if is_canary else True
                controller.observe(
                    CallRecord(
                        model="canary" if is_canary else "conventional",
                        is_canary=is_canary,
                        success=success,
                        latency_ms=200.0,
                        cost_usd=0.001,
                    )
                )
        elif args.simulate == "latency":
            for i in range(20):
                is_canary = i % 2 == 0
                latency = 6000.0 if is_canary else 200.0
                controller.observe(
                    CallRecord(
                        model="canary" if is_canary else "conventional",
                        is_canary=is_canary,
                        success=True,
                        latency_ms=latency,
                        cost_usd=0.001,
                    )
                )
        elif args.simulate == "cost":
            for i in range(20):
                is_canary = i % 2 == 0
                cost = 0.005 if is_canary else 0.001
                controller.observe(
                    CallRecord(
                        model="canary" if is_canary else "conventional",
                        is_canary=is_canary,
                        success=True,
                        latency_ms=200.0,
                        cost_usd=cost,
                    )
                )
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
