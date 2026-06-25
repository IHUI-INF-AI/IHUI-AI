"""影子流量动态配比 controller (建议 122).

设计:
  - 基础配比 (base_ratio): ZHS_SHADOW_TRAFFIC_RATIO, 默认 0.0
  - 调比策略 (基于最近 5 分钟比对结果):
      错误率 < 0.1% (绿色)  → 配比 +0.5% (逐步放大)
      0.1% <= 错误率 < 1%   → 配比不变 (稳定期)
      1% <= 错误率 < 5%     → 配比 -1% (减负)
      错误率 >= 5%           → 配比 = 0 (紧急关停)
  - 上下限: [0.0, 1.0], 步进 [0.0, 0.1] 最多 10% / 次
  - 调比冷却: 30s 内最多调一次
  - 与 ShadowRouter 集成: 每次调比后 router.ratio 立即生效

用法:
    from app.shadow_traffic import get_default_router
    from app.shadow_compare import get_aggregator_or_default
    from app.shadow_ratio_controller import ShadowRatioController

    router = get_default_router()
    controller = ShadowRatioController(router=router, error_source=aggregator)
    await controller.start()  # 后台 task
    ...
    await controller.stop()
"""

from __future__ import annotations

import asyncio
import contextlib
import os
import threading
import time
from dataclasses import dataclass

try:
    from loguru import logger as _loguru_logger
except Exception:
    _loguru_logger = None  # type: ignore

try:
    from prometheus_client import Counter, Gauge

    RATIO_CHANGES = Counter(
        "zhs_shadow_ratio_changes_total",
        "Shadow ratio changes by reason (建议 122)",
        ["reason"],  # grow / shrink / halt / manual / reset
    )
    CURRENT_RATIO = Gauge(
        "zhs_shadow_traffic_ratio_current",
        "Current shadow traffic ratio (建议 122)",
    )
    HEALTH_GAUGE = Gauge(
        "zhs_shadow_health_state",
        "Shadow health state: 0=green, 1=stable, 2=warning, 3=halt",
    )
except Exception:
    RATIO_CHANGES = None
    CURRENT_RATIO = None
    HEALTH_GAUGE = None


@dataclass
class RatioChange:
    """一次调比记录."""

    timestamp: float
    from_ratio: float
    to_ratio: float
    reason: str  # grow / shrink / halt / manual / reset
    error_rate: float
    health: str  # green / stable / warning / halt


class ShadowRatioController:
    """根据比对健康度动态调配比.

    Args:
        router: ShadowRouter 实例 (会被直接改 .ratio)
        error_source: 提供错误率的对象, 必须有 .get_recent_error_rate(window_sec) 方法
        base_ratio: 初始配比 (默认从 env 读)
        grow_step: 增长步长 (默认 0.005)
        shrink_step: 缩减步长 (默认 0.01)
        max_ratio: 配比上限 (默认 0.5)
        interval_sec: 调比周期 (默认 30s)
        cooldown_sec: 调比冷却 (默认 30s)
        window_sec: 错误率计算窗口 (默认 300s = 5分钟)
    """

    # 阈值
    THRESHOLD_GREEN = 0.001  # < 0.1%
    THRESHOLD_WARN = 0.01  # 1%
    THRESHOLD_HALT = 0.05  # 5%

    def __init__(
        self,
        router,
        error_source=None,
        base_ratio: float | None = None,
        grow_step: float = 0.005,
        shrink_step: float = 0.01,
        max_ratio: float = 0.5,
        interval_sec: float = 30.0,
        cooldown_sec: float = 30.0,
        window_sec: float = 300.0,
    ):
        self.router = router
        self.error_source = error_source
        self.base_ratio = base_ratio if base_ratio is not None else self._env_ratio()
        self.grow_step = grow_step
        self.shrink_step = shrink_step
        self.max_ratio = max_ratio
        self.interval_sec = interval_sec
        self.cooldown_sec = cooldown_sec
        self.window_sec = window_sec

        self._current_ratio = self.base_ratio
        self._last_change_ts = 0.0
        self._task: asyncio.Task | None = None
        self._stop: asyncio.Event | None = None
        self._changes: list[RatioChange] = []
        self._max_history = 100
        self._lock = threading.RLock()
        # 同步 router 初始值
        with contextlib.suppress(Exception):
            self.router.ratio = self._current_ratio
        if CURRENT_RATIO is not None:
            with contextlib.suppress(Exception):
                CURRENT_RATIO.set(self._current_ratio)

    # ---------- 配置 ----------
    @staticmethod
    def _env_ratio() -> float:
        try:
            return float(os.getenv("ZHS_SHADOW_TRAFFIC_RATIO", "0"))
        except Exception:
            return 0.0

    @property
    def current_ratio(self) -> float:
        with self._lock:
            return self._current_ratio

    @property
    def health(self) -> str:
        er = self._get_error_rate_safe()
        if er >= self.THRESHOLD_HALT:
            return "halt"
        if er >= self.THRESHOLD_WARN:
            return "warning"
        if er >= self.THRESHOLD_GREEN:
            return "stable"
        return "green"

    def _get_error_rate_safe(self) -> float:
        if self.error_source is None:
            return 0.0
        try:
            if hasattr(self.error_source, "get_recent_error_rate"):
                return float(self.error_source.get_recent_error_rate(self.window_sec))
        except Exception as e:
            if _loguru_logger is not None:
                _loguru_logger.debug("获取 shadow 错误率失败: %s", e)
        return 0.0

    # ---------- 调比 ----------
    def set_ratio(self, new_ratio: float, reason: str = "manual", force: bool = False) -> RatioChange | None:
        """设置配比, 走冷却 + 上下限校验.

        force=True 跳过冷却 (紧急关停用).
        """
        new_ratio = max(0.0, min(self.max_ratio, new_ratio))
        with self._lock:
            now = time.time()
            old = self._current_ratio
            if abs(new_ratio - old) < 1e-9:
                return None
            if not force and now - self._last_change_ts < self.cooldown_sec:
                return None
            self._current_ratio = new_ratio
            self._last_change_ts = now
            er = self._get_error_rate_safe()
            h = self.health
            change = RatioChange(
                timestamp=now,
                from_ratio=old,
                to_ratio=new_ratio,
                reason=reason,
                error_rate=er,
                health=h,
            )
            self._changes.append(change)
            if len(self._changes) > self._max_history:
                self._changes = self._changes[-self._max_history :]

        # 同步 router + 指标 + 日志
        with contextlib.suppress(Exception):
            self.router.ratio = new_ratio
        if CURRENT_RATIO is not None:
            with contextlib.suppress(Exception):
                CURRENT_RATIO.set(new_ratio)
        if HEALTH_GAUGE is not None:
            with contextlib.suppress(Exception):
                HEALTH_GAUGE.set({"green": 0, "stable": 1, "warning": 2, "halt": 3}.get(h, 0))
        if RATIO_CHANGES is not None:
            with contextlib.suppress(Exception):
                RATIO_CHANGES.labels(reason=reason).inc()
        if _loguru_logger is not None:
            with contextlib.suppress(Exception):
                _loguru_logger.bind(
                    shadow_from_ratio=old,
                    shadow_to_ratio=new_ratio,
                    shadow_reason=reason,
                    shadow_health=h,
                    shadow_error_rate=er,
                ).info(f"[shadow_ratio] {old:.3f} -> {new_ratio:.3f} ({reason}, health={h}, er={er:.4f})")
        return change

    def adjust(self) -> RatioChange | None:
        """根据当前健康度调一次配比. 冷却期不调."""
        with self._lock:
            now = time.time()
            if now - self._last_change_ts < self.cooldown_sec:
                return None
            cur = self._current_ratio
            er = self._get_error_rate_safe()

        if er >= self.THRESHOLD_HALT:
            return self.set_ratio(0.0, reason="halt", force=True)
        if er >= self.THRESHOLD_WARN:
            new = max(0.0, cur - self.shrink_step)
            return self.set_ratio(new, reason="shrink")
        if er < self.THRESHOLD_GREEN and cur < self.max_ratio:
            new = min(self.max_ratio, cur + self.grow_step)
            return self.set_ratio(new, reason="grow")
        # 稳定期
        return None

    def reset(self) -> RatioChange | None:
        """重置回 base_ratio."""
        return self.set_ratio(self.base_ratio, reason="reset", force=True)

    # ---------- 后台 loop ----------
    async def start(self) -> None:
        if self._task is not None:
            return
        self._stop = asyncio.Event()
        self._task = asyncio.create_task(self._loop())

    async def stop(self) -> None:
        if self._stop is not None:
            self._stop.set()
        if self._task is not None:
            with contextlib.suppress(TimeoutError, asyncio.CancelledError):
                await asyncio.wait_for(self._task, timeout=self.interval_sec + 5)
            self._task = None

    async def _loop(self) -> None:
        assert self._stop is not None
        while not self._stop.is_set():
            try:
                self.adjust()
            except Exception as e:
                if _loguru_logger is not None:
                    with contextlib.suppress(Exception):
                        _loguru_logger.warning(f"[shadow_ratio] adjust failed: {e}")
            try:
                await asyncio.wait_for(self._stop.wait(), timeout=self.interval_sec)
            except TimeoutError:
                continue

    # ---------- 快照 ----------
    def snapshot(self) -> dict:
        with self._lock:
            return {
                "base_ratio": self.base_ratio,
                "current_ratio": self._current_ratio,
                "max_ratio": self.max_ratio,
                "grow_step": self.grow_step,
                "shrink_step": self.shrink_step,
                "cooldown_sec": self.cooldown_sec,
                "window_sec": self.window_sec,
                "health": self.health,
                "error_rate": self._get_error_rate_safe(),
                "last_change_ts": self._last_change_ts,
                "changes_count": len(self._changes),
                "recent_changes": [
                    {
                        "ts": c.timestamp,
                        "from": c.from_ratio,
                        "to": c.to_ratio,
                        "reason": c.reason,
                        "health": c.health,
                        "error_rate": c.error_rate,
                    }
                    for c in self._changes[-10:]
                ],
            }
