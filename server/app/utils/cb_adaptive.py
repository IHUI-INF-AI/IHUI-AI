"""Bug-78: 熔断器半开期请求数动态调整 (按最近成功率).

设计:
  - 基础规则 (Bug-69): 半开期放行 N 个探测请求
  - 增强: 根据最近窗口成功率, 动态放大/缩小 N
  - 高成功率 (>80%) → 探测数加 1, 快速恢复
  - 低成功率 (<30%) → 探测数减 1, 防止雪崩
  - 范围限制: 最小 1, 最大 10
  - 与 circuit_breaker 解耦, 通过 wrap_cb 工厂注入

使用:
    from app.utils.cb_adaptive import adaptive_circuit_breaker

    cb = adaptive_circuit_breaker("llm.chat", failure_threshold=3)
"""

import logging
import threading
from collections import deque
from dataclasses import dataclass

logger = logging.getLogger(__name__)

DEFAULT_WINDOW = 50
DEFAULT_BASE_PROBES = 3
DEFAULT_MIN_PROBES = 1
DEFAULT_MAX_PROBES = 10
HIGH_RATE = 0.8
LOW_RATE = 0.3


@dataclass
class AdaptiveConfig:
    window: int = DEFAULT_WINDOW
    base_probes: int = DEFAULT_BASE_PROBES
    min_probes: int = DEFAULT_MIN_PROBES
    max_probes: int = DEFAULT_MAX_PROBES
    high_rate: float = HIGH_RATE
    low_rate: float = LOW_RATE


@dataclass
class ProbeDecision:
    base: int
    actual: int
    recent_success_rate: float
    reason: str


class AdaptiveHalfOpenPolicy:
    """半开期探测数动态策略.

    维护最近 N 次成功/失败样本, 在 OPEN→HALF_OPEN 时根据成功率决定探测数.
    """

    def __init__(self, config: AdaptiveConfig | None = None):
        self._cfg = config or AdaptiveConfig()
        self._samples: deque[bool] = deque(maxlen=self._cfg.window)
        self._lock = threading.Lock()
        self._decisions: dict[str, ProbeDecision] = {}
        self._total_decisions = 0

    def record(self, success: bool) -> None:
        with self._lock:
            self._samples.append(bool(success))

    def recent_success_rate(self) -> float:
        with self._lock:
            if not self._samples:
                return 0.0
            ok = sum(1 for s in self._samples if s)
            return ok / len(self._samples)

    def decide(self, breaker_name: str) -> ProbeDecision:
        """为指定熔断器决定半开探测数."""
        with self._lock:
            samples_count = len(self._samples)
            rate = sum(1 for s in self._samples if s) / samples_count if samples_count else 0.0
        base = self._cfg.base_probes
        # 无样本视为中立, 避免冷启动降级
        if samples_count == 0:
            actual = base
            reason = "neutral_no_samples → base"
        elif rate >= self._cfg.high_rate:
            actual = min(self._cfg.max_probes, base + 1)
            reason = f"high_rate {rate:.2f} >= {self._cfg.high_rate} → +1"
        elif rate <= self._cfg.low_rate:
            actual = max(self._cfg.min_probes, base - 1)
            reason = f"low_rate {rate:.2f} <= {self._cfg.low_rate} → -1"
        else:
            actual = base
            reason = f"neutral_rate {rate:.2f} → base"
        dec = ProbeDecision(
            base=base,
            actual=actual,
            recent_success_rate=round(rate, 4),
            reason=reason,
        )
        with self._lock:
            self._decisions[breaker_name] = dec
            self._total_decisions += 1
        return dec

    def get_decision(self, breaker_name: str) -> ProbeDecision | None:
        with self._lock:
            return self._decisions.get(breaker_name)

    def reset_samples(self) -> None:
        with self._lock:
            self._samples.clear()

    def stats(self) -> dict:
        with self._lock:
            samples_count = len(self._samples)
            if samples_count:
                ok = sum(1 for s in self._samples if s)
                rate = ok / samples_count
            else:
                rate = 0.0
            return {
                "samples_count": samples_count,
                "window": self._cfg.window,
                "base_probes": self._cfg.base_probes,
                "min_probes": self._cfg.min_probes,
                "max_probes": self._cfg.max_probes,
                "recent_success_rate": round(rate, 4),
                "total_decisions": self._total_decisions,
            }


# 全局单例
adaptive_policy = AdaptiveHalfOpenPolicy()


def adaptive_circuit_breaker(
    name: str,
    failure_threshold: int = 5,
    recovery_timeout: float = 30.0,
    success_threshold: int = 2,
    config: AdaptiveConfig | None = None,
):
    """工厂: 创建带自适应半开的熔断器.

    包装原始 circuit_breaker, 在 OPEN→HALF_OPEN 时根据策略调整探测数.
    """
    from app.utils.circuit_breaker import circuit_breaker as _cb_factory

    cb = _cb_factory(
        name=name,
        failure_threshold=failure_threshold,
        recovery_timeout=recovery_timeout,
        success_threshold=success_threshold,
    )
    policy = AdaptiveHalfOpenPolicy(config) if config else adaptive_policy

    # monkey-patch allow_request: 在 state==HALF_OPEN 时使用动态探测数
    original_allow = cb.allow_request
    last_state = [None]

    def adaptive_allow() -> bool:
        # 状态从 OPEN→HALF_OPEN 转换时计算探测数
        cur = cb.stats.state
        if last_state[0] != cur and cur.value == "half_open":
            dec = policy.decide(name)
            # 覆盖 half_open_max_calls (仅本次过渡)
            cb.half_open_max_calls = max(1, dec.actual)
            logger.info(f"adaptive[{name}] transition→HALF_OPEN probes={dec.actual} reason={dec.reason}")
        last_state[0] = cur
        return original_allow()

    cb.allow_request = adaptive_allow  # type: ignore[assignment]
    cb._adaptive_policy = policy  # type: ignore[attr-defined]
    return cb
