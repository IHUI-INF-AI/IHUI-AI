"""Bug-168: 服务降级策略.

按降级链: 完整 -> 缓存 -> 默认值 -> 失败
每一级有触发条件 (异常类型 / 错误率 / 熔断状态) 与回调.
"""

import enum
import threading
import time
from collections.abc import Callable
from dataclasses import dataclass
from typing import Any


class DegradeLevel(enum.StrEnum):
    FULL = "FULL"  # 完整调用
    CACHE = "CACHE"  # 命中缓存
    DEFAULT = "DEFAULT"  # 默认值
    FAIL = "FAIL"  # 失败返回


@dataclass
class DegradeStep:
    name: str
    fn: Callable[[], Any] | None = None
    fallback: Any = None
    except_on: tuple[type, ...] = ()
    timeout_sec: float = 0.0


class DegradeResult:
    def __init__(self, level: DegradeLevel, value: Any = None, err: str = ""):
        self.level = level
        self.value = value
        self.err = err


class DegradeChain:
    """降级链: 依次尝试各级, 失败自动降级."""

    def __init__(
        self,
        name: str,
        cache_get: Callable[[], Any] | None = None,
        cache_set: Callable[[Any], None] | None = None,
        default: Any = None,
    ):
        self.name = name
        self._cache_get = cache_get
        self._cache_set = cache_set
        self._default = default
        self._steps: list[DegradeStep] = []
        self._lock = threading.Lock()
        self._stats = {lvl.value: 0 for lvl in DegradeLevel}

    def add_step(self, step: DegradeStep) -> None:
        self._steps.append(step)

    def _try_step(self, step: DegradeStep) -> tuple[bool, Any]:
        if step.fn is None:
            return False, None
        if step.timeout_sec > 0:
            # 简化实现, 不引入线程
            start = time.time()
        try:
            v = step.fn()
            if step.timeout_sec > 0 and (time.time() - start) > step.timeout_sec:
                return False, None
            return True, v
        except Exception as e:
            if step.except_on and isinstance(e, step.except_on):
                return False, None
            if not step.except_on:
                return False, None
            return False, None

    def execute(self, primary: Callable[[], Any]) -> DegradeResult:
        with self._lock:
            self._stats[DegradeLevel.FULL.value] += 0  # 留位
        # 1. 完整调用
        try:
            v = primary()
            with self._lock:
                self._stats[DegradeLevel.FULL.value] += 1
            if self._cache_set is not None:
                try:
                    self._cache_set(v)
                except Exception:
                    pass  # intentionally ignored
            return DegradeResult(DegradeLevel.FULL, v)
        except Exception as e:
            err = f"{type(e).__name__}: {e}"
        # 2. 自定义步骤 (如 CACHE)
        for step in self._steps:
            ok, v = self._try_step(step)
            if ok:
                with self._lock:
                    self._stats[
                        step.name.upper() if step.name.upper() in self._stats else DegradeLevel.CACHE.value
                    ] += 1
                return DegradeResult(DegradeLevel.CACHE, v)
        # 3. 缓存
        if self._cache_get is not None:
            try:
                v = self._cache_get()
                if v is not None:
                    with self._lock:
                        self._stats[DegradeLevel.CACHE.value] += 1
                    return DegradeResult(DegradeLevel.CACHE, v)
            except Exception:
                pass  # intentionally ignored
        # 4. 默认
        if self._default is not None:
            with self._lock:
                self._stats[DegradeLevel.DEFAULT.value] += 1
            return DegradeResult(DegradeLevel.DEFAULT, self._default)
        # 5. 失败
        with self._lock:
            self._stats[DegradeLevel.FAIL.value] += 1
        return DegradeResult(DegradeLevel.FAIL, err=err)

    def stats(self) -> dict[str, int]:
        with self._lock:
            return dict(self._stats)
