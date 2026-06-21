"""Bug-167: 异常注入器 (混沌测试).

在调用前后注入: 延迟 / 异常 / 中断, 验证系统韧性.
支持: 规则 (target + 概率 + 行为) + 启用/禁用开关 + 注入统计.
"""

import enum
import random
import threading
import time
from collections.abc import Callable
from dataclasses import dataclass


class FaultType(enum.StrEnum):
    LATENCY = "LATENCY"  # 注入延迟
    EXCEPTION = "EXCEPTION"  # 注入异常
    ABORT = "ABORT"  # 注入中断


@dataclass
class FaultRule:
    target: str  # 目标名 (e.g. "user.get")
    fault: FaultType
    probability: float = 1.0
    latency_ms: int = 100
    exception_cls: type = Exception
    exception_msg: str = "injected"
    enabled: bool = True


class ChaosInjector:
    """混沌注入器: target + 概率 + 行为."""

    def __init__(self, seed: int | None = None):
        self._lock = threading.Lock()
        self._rules: dict[str, FaultRule] = {}
        self._enabled = True
        self._stats: dict[str, dict[str, int]] = {}
        self._rand = random.Random(seed)

    def add(self, rule: FaultRule) -> None:
        with self._lock:
            self._rules[rule.target] = rule
            self._stats[rule.target] = {"hit": 0, "skip": 0}

    def remove(self, target: str) -> bool:
        with self._lock:
            return self._rules.pop(target, None) is not None

    def enable(self, target: str | None = None) -> None:
        with self._lock:
            if target is None:
                self._enabled = True
            elif target in self._rules:
                self._rules[target].enabled = True

    def disable(self, target: str | None = None) -> None:
        with self._lock:
            if target is None:
                self._enabled = False
            elif target in self._rules:
                self._rules[target].enabled = False

    def _hit(self, target: str) -> bool:
        with self._lock:
            r = self._rules.get(target)
            if not r or not self._enabled or not r.enabled:
                self._stats.setdefault(target, {"hit": 0, "skip": 0})["skip"] += 1
                return False
            if self._rand.random() > r.probability:
                self._stats[target]["skip"] += 1
                return False
            self._stats[target]["hit"] += 1
            fault, lat, ex_cls, ex_msg = r.fault, r.latency_ms, r.exception_cls, r.exception_msg
        if fault == FaultType.LATENCY:
            time.sleep(lat / 1000)
        elif fault == FaultType.EXCEPTION:
            raise ex_cls(ex_msg)
        elif fault == FaultType.ABORT:
            raise KeyboardInterrupt(ex_msg)
        return True

    def wrap(self, target: str, fn: Callable, *args, **kwargs):
        """调用前注入故障, 实际执行 fn."""
        self._hit(target)
        return fn(*args, **kwargs)

    def guard(self, target: str):
        """装饰器: 给函数套上注入."""

        def deco(fn: Callable):
            def wrapper(*args, **kwargs):
                self._hit(target)
                return fn(*args, **kwargs)

            return wrapper

        return deco

    def stats(self) -> dict[str, dict[str, int]]:
        with self._lock:
            return {k: dict(v) for k, v in self._stats.items()}
