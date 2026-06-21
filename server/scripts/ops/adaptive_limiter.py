"""Phase 19 建议 1: 自适应限流 - 动态令牌桶 + 实时调整.

目的:
  - 基础令牌桶限流 (capacity, refill_rate)
  - 根据实时错误率 / 延迟 动态调整 capacity / refill_rate
  - AIMD (Additive-Increase / Multiplicative-Decrease) 调整策略
  - 滑动窗口监控错误率 / 延迟
  - 健康时放宽, 异常时收紧
  - 完整 metrics + 审计

设计:
  TokenBucket:
    capacity, refill_rate (tokens/s), tokens (current), ts (last refill)

  HealthWindow:
    滑动窗口记录 (success, latency_ms)
    error_rate, p99_latency_ms

  AdaptiveLimiter:
    min_capacity / max_capacity / min_rate / max_rate
    observe(result) -> 喂信号
    acquire() -> 阻塞/非阻塞获取令牌
    tick() -> 周期调整 capacity / rate (AIMD)
"""

from __future__ import annotations

import json
import time
from collections import deque
from dataclasses import dataclass
from enum import Enum

# ---------------------------------------------------------------------------
# 1. 数据类
# ---------------------------------------------------------------------------


class Decision(str, Enum):
    ALLOW = "allow"
    DENY = "deny"


@dataclass
class HealthSample:
    ts: float
    success: bool
    latency_ms: float


@dataclass
class LimiterConfig:
    """限流器配置."""

    initial_capacity: int = 100
    initial_refill_rate: float = 10.0  # tokens/s
    min_capacity: int = 10
    max_capacity: int = 1000
    min_refill_rate: float = 1.0
    max_refill_rate: float = 100.0
    # 调整阈值
    target_error_rate: float = 0.01  # 目标错误率 1%
    target_p99_latency_ms: float = 500.0
    window_seconds: float = 30.0
    min_sample_size: int = 5
    # 调整系数
    add_capacity_on_healthy: int = 5
    multiply_factor_on_unhealthy: float = 0.5
    cooldown_s: float = 5.0  # 调整冷却时间


@dataclass
class AdjustEvent:
    ts: float
    old_capacity: int
    new_capacity: int
    old_rate: float
    new_rate: float
    reason: str

    def to_dict(self) -> dict:
        return {
            "ts": self.ts,
            "ts_iso": time.strftime("%Y-%m-%d %H:%M:%S", time.localtime(self.ts)),
            "old_capacity": self.old_capacity,
            "new_capacity": self.new_capacity,
            "old_rate": self.old_rate,
            "new_rate": self.new_rate,
            "reason": self.reason,
        }


# ---------------------------------------------------------------------------
# 2. TokenBucket
# ---------------------------------------------------------------------------


class TokenBucket:
    """基础令牌桶."""

    def __init__(self, capacity: int, refill_rate: float):
        self.capacity = capacity
        self.refill_rate = refill_rate  # tokens / second
        self.tokens = float(capacity)
        self.last_ts = time.time()

    def _refill(self, now: float) -> None:
        elapsed = max(0.0, now - self.last_ts)
        self.tokens = min(self.capacity, self.tokens + elapsed * self.refill_rate)
        self.last_ts = now

    def try_acquire(self, cost: float = 1.0, now: float | None = None) -> bool:
        t = now or time.time()
        self._refill(t)
        if self.tokens >= cost:
            self.tokens -= cost
            return True
        return False

    def available(self, now: float | None = None) -> float:
        t = now or time.time()
        self._refill(t)
        return round(self.tokens, 4)

    def set_params(self, capacity: int, refill_rate: float) -> None:
        # 改 capacity 时保证 tokens <= capacity
        self.capacity = capacity
        self.refill_rate = refill_rate
        self.tokens = min(self.tokens, capacity)


# ---------------------------------------------------------------------------
# 3. HealthWindow
# ---------------------------------------------------------------------------


class HealthWindow:
    """滑动窗口健康监控."""

    def __init__(self, window_seconds: float = 30.0):
        self.window = window_seconds
        self._samples: deque[HealthSample] = deque()

    def record(self, sample: HealthSample) -> None:
        self._samples.append(sample)
        self._cleanup(sample.ts)

    def _cleanup(self, now: float) -> None:
        cutoff = now - self.window
        while self._samples and self._samples[0].ts < cutoff:
            self._samples.popleft()

    def stats(self, now: float | None = None) -> dict:
        t = now or time.time()
        self._cleanup(t)
        n = len(self._samples)
        if n == 0:
            return {"samples": 0, "error_rate": 0.0, "p99_latency_ms": 0.0, "avg_latency_ms": 0.0}
        errors = sum(1 for s in self._samples if not s.success)
        latencies = sorted([s.latency_ms for s in self._samples])
        p99_idx = max(0, int(0.99 * n) - 1)
        return {
            "samples": n,
            "error_rate": round(errors / n, 4),
            "p99_latency_ms": round(latencies[p99_idx], 2),
            "avg_latency_ms": round(sum(latencies) / n, 2),
        }

    def clear(self) -> None:
        self._samples.clear()


# ---------------------------------------------------------------------------
# 4. AdaptiveLimiter
# ---------------------------------------------------------------------------


class AdaptiveLimiter:
    """自适应限流器 (AIMD)."""

    def __init__(self, config: LimiterConfig | None = None):
        self.config = config or LimiterConfig()
        self.bucket = TokenBucket(self.config.initial_capacity, self.config.initial_refill_rate)
        self.health = HealthWindow(self.config.window_seconds)
        self._last_adjust = 0.0
        self._events: list[AdjustEvent] = []
        self._metrics: dict[str, int] = {"allow": 0, "deny": 0, "adjust_up": 0, "adjust_down": 0}

    def acquire(self, cost: float = 1.0) -> bool:
        ok = self.bucket.try_acquire(cost)
        if ok:
            self._metrics["allow"] += 1
        else:
            self._metrics["deny"] += 1
        return ok

    def observe(self, success: bool, latency_ms: float, now: float | None = None) -> None:
        t = now or time.time()
        self.health.record(HealthSample(ts=t, success=success, latency_ms=latency_ms))

    def tick(self, now: float | None = None) -> AdjustEvent | None:
        """周期调整, 返回本次调整事件或 None."""
        t = now or time.time()
        if t - self._last_adjust < self.config.cooldown_s:
            return None
        s = self.health.stats(t)
        if s["samples"] < self.config.min_sample_size:
            return None
        old_c, old_r = self.bucket.capacity, self.bucket.refill_rate
        new_c, new_r = old_c, old_r
        reason = ""
        # 异常 -> 乘性下降
        is_unhealthy = (
            s["error_rate"] > self.config.target_error_rate * 2
            or s["p99_latency_ms"] > self.config.target_p99_latency_ms * 2
        )
        # 健康 -> 加性增加
        is_healthy = (
            s["error_rate"] <= self.config.target_error_rate
            and s["p99_latency_ms"] <= self.config.target_p99_latency_ms
        )
        if is_unhealthy:
            new_c = max(self.config.min_capacity, int(old_c * self.config.multiply_factor_on_unhealthy))
            new_r = max(self.config.min_refill_rate, old_r * self.config.multiply_factor_on_unhealthy)
            reason = f"unhealthy: error_rate={s['error_rate']}, p99={s['p99_latency_ms']}ms"
            self._metrics["adjust_down"] += 1
        elif is_healthy:
            new_c = min(self.config.max_capacity, old_c + self.config.add_capacity_on_healthy)
            new_r = min(self.config.max_refill_rate, old_r + self.config.add_capacity_on_healthy * 0.1)
            reason = f"healthy: error_rate={s['error_rate']}, p99={s['p99_latency_ms']}ms"
            self._metrics["adjust_up"] += 1
        if new_c == old_c and new_r == old_r:
            return None
        self.bucket.set_params(new_c, new_r)
        ev = AdjustEvent(ts=t, old_capacity=old_c, new_capacity=new_c, old_rate=old_r, new_rate=new_r, reason=reason)
        self._events.append(ev)
        self._last_adjust = t
        return ev

    def available_tokens(self) -> float:
        return self.bucket.available()

    def current_params(self) -> dict:
        return {"capacity": self.bucket.capacity, "refill_rate": self.bucket.refill_rate}

    def events(self, limit: int = 50) -> list[dict]:
        return [e.to_dict() for e in self._events[-limit:]]

    def metrics(self) -> dict:
        return dict(self._metrics)

    def report(self) -> str:
        s = self.health.stats()
        p = self.current_params()
        m = self.metrics()
        lines = ["# 自适应限流器报表", ""]
        lines.append(f"- 当前 capacity: **{p['capacity']}**")
        lines.append(f"- 当前 refill_rate: **{p['refill_rate']:.1f}** tokens/s")
        lines.append(f"- 可用令牌: **{self.available_tokens():.1f}**")
        lines.append("")
        lines.append("## 健康指标 (最近窗口)")
        lines.append("")
        lines.append(f"- 样本数: {s['samples']}")
        lines.append(f"- 错误率: {s['error_rate']*100:.2f}%")
        lines.append(f"- P99 延迟: {s['p99_latency_ms']:.0f} ms")
        lines.append(f"- 平均延迟: {s['avg_latency_ms']:.0f} ms")
        lines.append("")
        lines.append("## 指标")
        lines.append("")
        lines.append(f"- 允许: **{m['allow']}**")
        lines.append(f"- 拒绝: **{m['deny']}**")
        lines.append(f"- 调宽次数: **{m['adjust_up']}**")
        lines.append(f"- 调严次数: **{m['adjust_down']}**")
        lines.append("")
        if self._events:
            lines.append("## 最近调整")
            lines.append("")
            lines.append("| 时间 | capacity | rate | 原因 |")
            lines.append("| --- | --- | --- | --- |")
            for e in self._events[-20:]:
                lines.append(
                    f"| {e.ts_iso} | {e.old_capacity} -> {e.new_capacity} | "
                    f"{e.old_rate:.1f} -> {e.new_rate:.1f} | {e.reason} |"
                )
        return "\n".join(lines) + "\n"


# ---------------------------------------------------------------------------
# 5. CLI
# ---------------------------------------------------------------------------


def _demo() -> tuple[AdaptiveLimiter, dict]:
    limiter = AdaptiveLimiter(
        LimiterConfig(
            initial_capacity=10,
            initial_refill_rate=2.0,
            min_capacity=2,
            max_capacity=100,
            min_refill_rate=0.5,
            max_refill_rate=50.0,
            target_error_rate=0.1,
            target_p99_latency_ms=1000.0,
            window_seconds=30.0,
            min_sample_size=5,
            cooldown_s=0.0,
        )
    )
    out = {"scenarios": []}
    now = time.time()
    # 场景 1: 健康
    for i in range(20):
        limiter.acquire()
        limiter.observe(success=True, latency_ms=50.0, now=now + i * 0.1)
    ev1 = limiter.tick(now=now + 2.0)
    out["scenarios"].append(
        {"scenario": "healthy", "event": ev1.to_dict() if ev1 else None, "params": limiter.current_params()}
    )
    # 场景 2: 异常
    for i in range(20):
        limiter.observe(success=(i % 10 != 0), latency_ms=2000.0, now=now + 5.0 + i * 0.1)
    ev2 = limiter.tick(now=now + 8.0)
    out["scenarios"].append(
        {"scenario": "unhealthy", "event": ev2.to_dict() if ev2 else None, "params": limiter.current_params()}
    )
    # 场景 3: 恢复正常
    for i in range(20):
        limiter.observe(success=True, latency_ms=50.0, now=now + 12.0 + i * 0.1)
    ev3 = limiter.tick(now=now + 15.0)
    out["scenarios"].append(
        {"scenario": "recovered", "event": ev3.to_dict() if ev3 else None, "params": limiter.current_params()}
    )
    out["metrics"] = limiter.metrics()
    out["health"] = limiter.health.stats()
    return limiter, out


def main(argv: list[str] | None = None, limiter: AdaptiveLimiter | None = None) -> int:
    import argparse

    p = argparse.ArgumentParser(description="自适应限流器")
    sub = p.add_subparsers(dest="cmd", required=True)

    p_demo = sub.add_parser("demo")
    p_acquire = sub.add_parser("acquire")
    p_acquire.add_argument("--cost", type=float, default=1.0)
    p_observe = sub.add_parser("observe")
    p_observe.add_argument("--success", choices=["true", "false"], required=True)
    p_observe.add_argument("--latency-ms", type=float, required=True)
    p_tick = sub.add_parser("tick")
    p_report = sub.add_parser("report")

    args = p.parse_args(argv)
    l = limiter or AdaptiveLimiter()
    if args.cmd == "demo":
        _, out = _demo()
        print(json.dumps(out, ensure_ascii=False, indent=2, default=str))
        return 0
    if args.cmd == "acquire":
        ok = l.acquire(args.cost)
        print(json.dumps({"acquire": ok, "tokens": l.available_tokens()}, ensure_ascii=False))
        return 0
    if args.cmd == "observe":
        l.observe(success=(args.success == "true"), latency_ms=args.latency_ms)
        print(json.dumps(l.health.stats(), ensure_ascii=False))
        return 0
    if args.cmd == "tick":
        ev = l.tick()
        if ev:
            print(json.dumps(ev.to_dict(), ensure_ascii=False, indent=2))
        else:
            print(json.dumps({"event": None, "params": l.current_params()}, ensure_ascii=False))
        return 0
    if args.cmd == "report":
        print(l.report())
        return 0
    return 1


if __name__ == "__main__":
    import sys

    sys.exit(main())
