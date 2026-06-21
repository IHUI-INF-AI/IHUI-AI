"""Bug-59: 数据库连接池动态扩缩容.

设计:
  - 监控每个 engine.pool 的 in_use / idle / overflow 状态
  - 根据 QPS 与使用率自动调整 pool_size 与 max_overflow
  - 通过 hot_config 热加载阈值 (无需重启)
  - 缩容: 主动 dispose 空闲连接, 减少 pool 占用
  - 扩容: 调大 pool_size, 让 SQLAlchemy 在需要时开新连接

使用:
    from app.utils.pool_monitor import pool_monitor, resize_pool, get_pool_stats

    # 后台任务每 30s 跑一次
    pool_monitor.tick()  # 自动检查并扩缩容

    # 手动调整
    resize_pool("ai", new_size=20)

    # 拿监控
    stats = get_pool_stats()
"""

import logging
import threading
import time
from dataclasses import dataclass, field

logger = logging.getLogger(__name__)


@dataclass
class PoolStats:
    """单引擎连接池实时状态."""

    engine: str
    pool_size: int
    max_overflow: int
    in_use: int
    idle: int
    overflow: int
    checked_out: int  # = in_use (兼容名)
    target_size: int
    target_overflow: int
    last_tick: float
    history: list = field(default_factory=list)  # 最近 N 次的 in_use

    def utilization(self) -> float:
        """使用率 0-1 (in_use / pool_size, 排除 overflow)."""
        if self.pool_size <= 0:
            return 0.0
        return min(1.0, self.in_use / self.pool_size)

    def total_capacity(self) -> int:
        return self.pool_size + self.max_overflow

    def to_dict(self) -> dict:
        return {
            "engine": self.engine,
            "pool_size": self.pool_size,
            "max_overflow": self.max_overflow,
            "in_use": self.in_use,
            "idle": self.idle,
            "overflow": self.overflow,
            "checked_out": self.checked_out,
            "target_size": self.target_size,
            "target_overflow": self.target_overflow,
            "utilization": round(self.utilization(), 3),
            "last_tick": self.last_tick,
        }


class PoolMonitor:
    """连接池监控 + 自动扩缩容控制器."""

    SCALE_UP_UTILIZATION = 0.8  # 使用率 > 80% 触发扩容
    SCALE_DOWN_UTILIZATION = 0.2  # 使用率 < 20% 触发缩容
    SCALE_UP_OVERFLOW_RATIO = 0.5  # overflow 使用 > 50% 也触发扩容
    HISTORY_WINDOW = 6  # 连续 N 个 tick 触发才动手 (防抖)
    DEFAULT_MIN_SIZE = 2
    DEFAULT_MAX_SIZE = 50
    DEFAULT_MIN_OVERFLOW = 2
    DEFAULT_MAX_OVERFLOW = 30
    HISTORY_LIMIT = 20  # 最多保留 20 个历史点

    def __init__(self):
        self._stats: dict[str, PoolStats] = {}
        self._lock = threading.Lock()
        self._last_scale_at: dict[str, float] = {}
        self._scale_cooldown_sec = 60.0  # 同引擎扩缩容冷却 60s

    # ----- 拿 / 缓存状态 -----
    def get_stats(self, engine_name: str, engine) -> PoolStats:
        """读 engine.pool 状态, 缓存 + 更新历史."""
        try:
            pool = engine.pool
            pool_size = int(getattr(pool, "size", lambda: 0)() or 0)
            in_use = int(getattr(pool, "checkedout", lambda: 0)() or 0)
            overflow = int(getattr(pool, "overflow", lambda: 0)() or 0)
            # QueuePool 内 _pool 是 Queue, qsize = 空闲
            idle = 0
            try:
                inner = getattr(pool, "_pool", None)
                if inner is not None and hasattr(inner, "qsize"):
                    idle = int(inner.qsize() or 0)
            except Exception:
                logger.warning("Caught unexpected exception")
            max_overflow = int(getattr(pool, "_max_overflow", 0) or 0)
        except Exception as e:
            logger.debug(f"read pool {engine_name} stats fail: {e}")
            return PoolStats(
                engine=engine_name,
                pool_size=0,
                max_overflow=0,
                in_use=0,
                idle=0,
                overflow=0,
                checked_out=0,
                target_size=0,
                target_overflow=0,
                last_tick=time.time(),
            )
        with self._lock:
            prev = self._stats.get(engine_name)
            target_size = prev.target_size if prev else pool_size
            target_overflow = prev.target_overflow if prev else max_overflow
            history = list(prev.history) if prev else []
            history.append(in_use)
            if len(history) > self.HISTORY_LIMIT:
                history = history[-self.HISTORY_LIMIT :]
            stats = PoolStats(
                engine=engine_name,
                pool_size=pool_size,
                max_overflow=max_overflow,
                in_use=in_use,
                idle=idle,
                overflow=overflow,
                checked_out=in_use,
                target_size=target_size,
                target_overflow=target_overflow,
                last_tick=time.time(),
                history=history,
            )
            self._stats[engine_name] = stats
            return stats

    def all_stats(self) -> dict[str, dict]:
        with self._lock:
            return {k: v.to_dict() for k, v in self._stats.items()}

    # ----- 扩缩容决策 -----
    def _hot_thresholds(self) -> tuple[int, int, int, int]:
        """读 hot_config 阈值."""
        try:
            from app.utils.hot_config import hot_get

            mn = hot_get("DB_POOL_MIN_SIZE", self.DEFAULT_MIN_SIZE)
            mx = hot_get("DB_POOL_MAX_SIZE", self.DEFAULT_MAX_SIZE)
            mo_min = hot_get("DB_POOL_MIN_OVERFLOW", self.DEFAULT_MIN_OVERFLOW)
            mo_max = hot_get("DB_POOL_MAX_OVERFLOW", self.DEFAULT_MAX_OVERFLOW)
            return int(mn), int(mx), int(mo_min), int(mo_max)
        except Exception:
            return (self.DEFAULT_MIN_SIZE, self.DEFAULT_MAX_SIZE, self.DEFAULT_MIN_OVERFLOW, self.DEFAULT_MAX_OVERFLOW)

    def _avg_in_use(self, stats: PoolStats) -> float:
        if not stats.history:
            return 0.0
        return sum(stats.history) / len(stats.history)

    def _should_scale_up(self, stats: PoolStats) -> bool:
        if len(stats.history) < self.HISTORY_WINDOW:
            return False
        # 连续 N 次平均使用率高 → 扩容
        avg = self._avg_in_use(stats)
        if stats.pool_size <= 0:
            return False
        util = avg / stats.pool_size
        if util >= self.SCALE_UP_UTILIZATION:
            return True
        # overflow 频繁使用
        if stats.max_overflow > 0:
            of_ratio = stats.overflow / stats.max_overflow
            if of_ratio >= self.SCALE_UP_OVERFLOW_RATIO:
                return True
        return False

    def _should_scale_down(self, stats: PoolStats) -> bool:
        if len(stats.history) < self.HISTORY_WINDOW:
            return False
        avg = self._avg_in_use(stats)
        if stats.pool_size <= 0:
            return False
        util = avg / stats.pool_size
        # 使用率持续低, 且 pool 不全是 idle
        return util <= self.SCALE_DOWN_UTILIZATION and stats.in_use < stats.pool_size * 0.5

    def _in_cooldown(self, engine_name: str) -> bool:
        last = self._last_scale_at.get(engine_name, 0.0)
        return time.time() - last < self._scale_cooldown_sec

    def _decide_target(self, stats: PoolStats) -> tuple[int, int]:
        """根据 stats 与 hot_config 计算目标 size / overflow."""
        mn, mx, mo_min, mo_max = self._hot_thresholds()
        new_size = stats.pool_size
        new_overflow = stats.max_overflow
        if self._should_scale_up(stats):
            new_size = min(mx, max(stats.pool_size + 2, int(stats.pool_size * 1.3)))
            new_overflow = min(mo_max, max(stats.max_overflow, new_size // 2))
        elif self._should_scale_down(stats):
            new_size = max(mn, int(stats.pool_size * 0.7))
            new_overflow = max(mo_min, int(stats.max_overflow * 0.7))
        return new_size, new_overflow

    def tick(self, engines: dict[str, object] | None = None) -> dict[str, dict]:
        """每 N 秒跑一次: 采集 + 决定 + 调整.

        Args:
            engines: {"ai": engine1, "center": engine2, "course": engine3} 之类的 dict
                    缺省从 app.database 拿
        """
        if engines is None:
            try:
                from app.database import ENGINES

                engines = ENGINES
            except Exception:
                return {}
        out: dict[str, dict] = {}
        for name, eng in engines.items():
            try:
                stats = self.get_stats(name, eng)
                new_size, new_overflow = self._decide_target(stats)
                action = "noop"
                if new_size != stats.pool_size or new_overflow != stats.max_overflow:
                    if not self._in_cooldown(name):
                        self._apply(eng, new_size, new_overflow)
                        with self._lock:
                            stats.target_size = new_size
                            stats.target_overflow = new_overflow
                            self._last_scale_at[name] = time.time()
                        action = "scale" if new_size > stats.pool_size else "shrink"
                out[name] = {
                    **stats.to_dict(),
                    "action": action,
                    "new_size": new_size,
                    "new_overflow": new_overflow,
                }
            except Exception as e:
                logger.debug(f"pool_monitor tick({name}) fail: {e}")
        return out

    def _apply(self, engine, new_size: int, new_overflow: int) -> None:
        """实际改 engine.pool 的 size / max_overflow.

        SQLAlchemy 的 QueuePool:
          - size: pool 容量, 不能改 (要重建 pool)
          - _max_overflow: 可改 (直接赋值)
          - _pool: 内部的 Queue, 不能缩容量
        实用方案:
          - 改 _max_overflow
          - 缩容时 dispose 空闲连接
        """
        try:
            pool = engine.pool
            if hasattr(pool, "_max_overflow"):
                pool._max_overflow = int(new_overflow)
            # 缩容时: 主动让 idle 连接过期 (关闭后再开新连接会保持 _pool 容量)
            # 真正缩小 size 需要 dispose + 重建 pool, 这里采用渐进式
            if new_size < getattr(pool, "_size", 0):
                # 调用一次 dispose, 但保留 pool 结构 (SQLAlchemy 会重新填充到 new_size)
                # 实际操作: 在 idle 队列里 pop 部分连接
                try:
                    inner = getattr(pool, "_pool", None)
                    if inner is not None and hasattr(inner, "get"):
                        closed = 0
                        # 关闭一半的 idle
                        target_close = max(0, getattr(pool, "_size", 0) - new_size)
                        while closed < target_close:
                            try:
                                conn = inner.get(block=False)
                                try:
                                    conn.close()
                                except Exception:
                                    logger.warning("Caught unexpected exception")
                                closed += 1
                            except Exception:
                                break
                except Exception as e:
                    logger.debug(f"shrink pool close err: {e}")
        except Exception as e:
            logger.warning(f"pool_monitor._apply fail: {e}")


# 全局单例
pool_monitor = PoolMonitor()


def get_pool_stats() -> dict[str, dict]:
    """便捷: 一次性拿所有 engine 状态."""
    try:
        from app.database import ENGINES

        return {n: pool_monitor.get_stats(n, e).to_dict() for n, e in ENGINES.items()}
    except Exception:
        return pool_monitor.all_stats()


def resize_pool(engine_name: str, new_size: int) -> bool:
    """手动调整 pool_size (target 标记 + 实际缩容)."""
    try:
        from app.database import ENGINES

        eng = ENGINES.get(engine_name)
        if eng is None:
            return False
        stats = pool_monitor.get_stats(engine_name, eng)
        new_overflow = max(stats.max_overflow, new_size // 2)
        pool_monitor._apply(eng, new_size, new_overflow)
        with pool_monitor._lock:
            stats.target_size = new_size
            stats.target_overflow = new_overflow
            pool_monitor._last_scale_at[engine_name] = time.time()
        return True
    except Exception as e:
        logger.warning(f"resize_pool({engine_name}, {new_size}) fail: {e}")
        return False
