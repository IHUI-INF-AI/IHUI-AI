"""基于本地缓存的高效过期监听服务 (从 coze_zhs_py 迁移)."""

import asyncio
import threading
import time
from collections import defaultdict
from collections.abc import Callable
from dataclasses import dataclass
from datetime import datetime, timedelta
from typing import Any

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.interval import IntervalTrigger
from loguru import logger
from sqlalchemy import text

from app.database import SessionFactory1, get_session
from app.models.activity_models import AgentBuy
from app.models.agent_settlement import AgentSettlement

# 保留后台任务引用，防止被 GC 回收
_pending_tasks: set = set()


def _metric_records_cached(table_name: str, count: int) -> None:
    try:
        from app.metrics_business import MONITOR_RECORDS_CACHED

        MONITOR_RECORDS_CACHED.labels(table_name=table_name).set(count)
    except Exception:
        logger.warning("Caught unexpected exception")


def _metric_expired_inc(table_name: str, n: int) -> None:
    if n <= 0:
        return
    try:
        from app.metrics_business import MONITOR_EXPIRED_TOTAL

        MONITOR_EXPIRED_TOTAL.labels(table_name=table_name).inc(n)
    except Exception:
        logger.warning("Caught unexpected exception")


def _metric_refresh_observe(seconds: float) -> None:
    try:
        from app.metrics_business import MONITOR_REFRESH_DURATION

        MONITOR_REFRESH_DURATION.observe(seconds)
    except Exception:
        logger.warning("Caught unexpected exception")


def _metric_running_set(running: bool) -> None:
    try:
        from app.metrics_business import MONITOR_RUNNING

        MONITOR_RUNNING.set(1 if running else 0)
    except Exception:
        logger.warning("Caught unexpected exception")


def _metric_checks_inc() -> None:
    try:
        from app.metrics_business import MONITOR_CHECKS_TOTAL

        MONITOR_CHECKS_TOTAL.inc()
    except Exception:
        logger.warning("Caught unexpected exception")


def _metric_app_local_time_tick() -> None:
    """上报 app 内部 time.time(), promql `time() - zhs_biz_app_local_time_seconds` 算漂移."""
    try:
        from app.metrics_business import APP_LOCAL_TIME

        APP_LOCAL_TIME.set(time.time())
    except Exception as e:
        logger.debug("上报 app 本地时间指标失败: %s", e)  # metrics not available


def _metric_time_source_set() -> None:
    """打点当前用的时间源 (time.time / datetime.utcnow / monotonic), 便于追溯."""
    try:
        from app.metrics_business import APP_TIME_SOURCE

        APP_TIME_SOURCE.labels(source="time.time").set(1)
    except Exception:
        logger.warning("Caught unexpected exception")


@dataclass
class CachedRecord:
    """缓存的记录."""

    id: str
    table_name: str
    expiration_date: datetime
    current_status: str
    uuid: str | None = None
    order_no: str | None = None

    def is_expired(self) -> bool:
        return self.expiration_date <= datetime.now()


@dataclass
class TableConfig:
    """表配置."""

    model_class: Any
    table_name: str
    expiration_field: str
    status_field: str
    expired_value: str
    unexpired_value: str
    uuid_field: str | None = None
    order_field: str | None = None
    preload_hours: int = 24


class CachedExpirationMonitor:
    """基于缓存的过期监听器."""

    def __init__(self, db_session_factory: Callable | None = None) -> None:
        self.db_session_factory = db_session_factory or SessionFactory1
        self.scheduler = AsyncIOScheduler()
        self.cache: dict[str, dict[str, CachedRecord]] = {}
        self.cache_lock = threading.RLock()
        self.table_configs: dict[str, TableConfig] = {}
        self.callbacks: dict[str, list[Callable]] = defaultdict(list)
        self.stats = {
            "cache_size": 0,
            "total_checked": 0,
            "total_expired": 0,
            "last_check_time": None,
            "last_refresh_time": None,
            "check_duration": 0.0,
            "refresh_duration": 0.0,
        }
        self.is_running = False
        self._setup_default_configs()

    def _setup_default_configs(self) -> None:
        """注册默认表配置."""
        self.register_table_config(
            TableConfig(
                model_class=AgentBuy,
                table_name="zhs_agent_buy",
                expiration_field="expiration_date",
                status_field="status",
                expired_value="1",
                unexpired_value="0",
                uuid_field="agent_order_uuid",
                order_field="order_no",
                preload_hours=72,
            )
        )
        self.register_table_config(
            TableConfig(
                model_class=AgentSettlement,
                table_name="zhs_agent_settlement",
                expiration_field="expiration_date",
                status_field="settlement",
                expired_value="1",
                unexpired_value="0",
                uuid_field="uuid",
                order_field="order_no",
                preload_hours=24,
            )
        )

    def register_table_config(self, config: TableConfig) -> None:
        self.table_configs[config.table_name] = config
        self.cache[config.table_name] = {}
        logger.info(f"注册表配置: {config.table_name}, 预加载 {config.preload_hours} 小时")

    def register_callback(self, table_name: str, callback: Callable) -> None:
        self.callbacks[table_name].append(callback)
        logger.info(f"注册过期回调: {table_name}")

    async def start(self) -> None:
        if self.is_running:
            logger.warning("缓存过期监听服务已在运行")
            return
        await self._refresh_all_caches()
        self.scheduler.add_job(
            self._check_expired_in_cache,
            IntervalTrigger(seconds=10),
            id="check_expired_cache",
            replace_existing=True,
            max_instances=1,
        )
        self.scheduler.add_job(
            self._refresh_all_caches,
            IntervalTrigger(minutes=5),
            id="refresh_cache",
            replace_existing=True,
            max_instances=1,
        )
        self.scheduler.add_job(
            self._cleanup_expired_cache,
            IntervalTrigger(hours=1),
            id="cleanup_cache",
            replace_existing=True,
        )
        # Phase 8 建议 2: 时钟漂移上报, promql `time() - zhs_biz_app_local_time_seconds` 算漂移
        self.scheduler.add_job(
            _metric_app_local_time_tick,
            IntervalTrigger(seconds=60),
            id="app_local_time_tick",
            replace_existing=True,
            max_instances=1,
        )
        self.scheduler.start()
        self.is_running = True
        _metric_running_set(True)
        _metric_app_local_time_tick()  # 立即打点, 让首轮 /metrics 就能算漂移
        _metric_time_source_set()
        logger.info(f"缓存过期监听服务已启动,监听 {len(self.table_configs)} 张表")

    async def stop(self) -> None:
        if not self.is_running:
            return
        try:
            self.scheduler.shutdown(wait=True)
            self.is_running = False
            with self.cache_lock:
                self.cache.clear()
            _metric_running_set(False)
            logger.info("缓存过期监听服务已停止")
        except Exception as e:
            logger.error(f"停止缓存过期监听服务失败: {e}")

    async def _refresh_all_caches(self) -> None:
        start = time.time()
        total = 0
        for tname, cfg in self.table_configs.items():
            total += await self._refresh_table_cache(tname, cfg)
        elapsed = time.time() - start
        self.stats["last_refresh_time"] = datetime.now()
        self.stats["refresh_duration"] = elapsed
        self.stats["cache_size"] = total
        _metric_refresh_observe(elapsed)
        logger.info(f"缓存刷新完成: 加载 {total} 条, 耗时 {elapsed:.2f}s")

    async def _refresh_table_cache(self, table_name: str, config: TableConfig) -> int:
        start = time.time()
        try:
            with get_session() as db:
                now = datetime.now()
                future = now + timedelta(hours=config.preload_hours)
                extra_cols = ""
                if config.uuid_field:
                    extra_cols += f", {config.uuid_field}"
                if config.order_field:
                    extra_cols += f", {config.order_field}"
                sql = text(
                    f"SELECT id, {config.expiration_field}, {config.status_field}{extra_cols} "
                    f"FROM {config.table_name} "
                    f"WHERE {config.expiration_field} BETWEEN :now AND :future "
                    f"AND {config.status_field} = :unexpired "
                    f"ORDER BY {config.expiration_field} ASC"
                )
                rows = db.execute(sql, {"now": now, "future": future, "unexpired": config.unexpired_value}).fetchall()
                with self.cache_lock:
                    self.cache[table_name].clear()
                    for r in rows:
                        self.cache[table_name][r.id] = CachedRecord(
                            id=r.id,
                            table_name=table_name,
                            expiration_date=getattr(r, config.expiration_field),
                            current_status=getattr(r, config.status_field),
                            uuid=getattr(r, config.uuid_field, None) if config.uuid_field else None,
                            order_no=getattr(r, config.order_field, None) if config.order_field else None,
                        )
                count = len(rows)
                _metric_records_cached(table_name, count)
                _metric_refresh_observe(time.time() - start)
                return count
        except Exception as e:
            logger.error(f"刷新 {table_name} 缓存失败: {e}")
            return 0

    async def _check_expired_in_cache(self) -> None:
        start = time.time()
        total_expired = 0
        try:
            with self.cache_lock:
                for tname, records in self.cache.items():
                    expired = []
                    for rid, rec in list(records.items()):
                        if rec.is_expired():
                            expired.append(rec)
                            del records[rid]
                    if expired:
                        total_expired += len(expired)
                        _metric_expired_inc(tname, len(expired))
                        _expired_task = asyncio.create_task(self._process_expired(tname, expired))
                        _pending_tasks.add(_expired_task)
                        _expired_task.add_done_callback(_pending_tasks.discard)
                    _metric_records_cached(tname, len(records))
            self.stats["total_checked"] += 1
            self.stats["total_expired"] += total_expired
            self.stats["last_check_time"] = datetime.now()
            self.stats["check_duration"] = time.time() - start
            _metric_checks_inc()
        except Exception as e:
            logger.error(f"检查缓存过期记录失败: {e}")

    async def _process_expired(self, table_name: str, records: list[CachedRecord]) -> None:
        cfg = self.table_configs.get(table_name)
        if not cfg:
            return
        try:
            with get_session(factory=self.db_session_factory) as db:
                ids = tuple(r.id for r in records)
                sql = text(
                    f"UPDATE {cfg.table_name} "
                    f"SET {cfg.status_field} = :expired "
                    f"WHERE id IN :ids AND {cfg.status_field} = :unexpired"
                )
                db.execute(sql, {"expired": cfg.expired_value, "unexpired": cfg.unexpired_value, "ids": ids})
            for cb in self.callbacks.get(table_name, []):
                try:
                    if asyncio.iscoroutinefunction(cb):
                        await cb(records)
                    else:
                        cb(records)
                except Exception as e:
                    logger.error(f"执行 {table_name} 回调失败: {e}")
        except Exception as e:
            logger.error(f"处理 {table_name} 过期记录失败: {e}")

    async def _cleanup_expired_cache(self) -> None:
        with self.cache_lock:
            for records in self.cache.values():
                for rid in [
                    rid for rid, r in records.items() if r.expiration_date < datetime.now() - timedelta(hours=1)
                ]:
                    del records[rid]

    def get_cache_info(self) -> dict[str, Any]:
        with self.cache_lock:
            info = {
                t: {"count": len(recs), "next_expiring": min((r.expiration_date for r in recs.values()), default=None)}
                for t, recs in self.cache.items()
            }
        return {"cache_info": info, "stats": self.stats, "is_running": self.is_running}

    async def force_refresh(self) -> dict[str, int]:
        await self._refresh_all_caches()
        return {"refreshed_tables": len(self.table_configs)}


cached_expiration_monitor = CachedExpirationMonitor()


async def agent_buy_expired_callback(records: list[CachedRecord]) -> None:
    logger.info(f"智能体购买过期: {len(records)} 条已过期 (status=1)")


async def agent_settlement_expired_callback(records: list[CachedRecord]) -> None:
    logger.info(f"智能体结算过期: {len(records)} 条已自动结算 (settlement=1)")


cached_expiration_monitor.register_callback("zhs_agent_buy", agent_buy_expired_callback)
cached_expiration_monitor.register_callback("zhs_agent_settlement", agent_settlement_expired_callback)
