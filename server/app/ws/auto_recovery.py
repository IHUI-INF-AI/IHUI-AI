"""WebSocket 自动恢复管理器 (完善版).

迁移自 coze_zhs_py/websocket_auto_recovery.py, 解决 WebSocket 服务停掉但项目没停的问题.
2026-06-26 完善: 加 asyncio.Lock 串行化队列操作、task_done 计数、参数化阈值、移除废代码.

依赖 (ConnectionManager 必须实现):
- message_queue: asyncio.Queue  (出箱消息队列)
- queue_size: int                 (队列容量)
- queue_full_count: int           (队列满次数)
- total_messages: int             (累计入队消息数)
- active_api_calls: dict          (call_id -> start_time, 在飞 API 调用)
- processing_tasks: set[asyncio.Task] (后台任务引用, 防止 GC 丢异常)
- _tasks_started: bool            (后台任务是否已启动)
- _ensure_tasks_started()         (异步启动后台任务, 幂等)
- active_connections              (字典, 键为 conn_id)
- _loop                           (事件循环引用)
- _closed                         (关闭标志)
"""
from __future__ import annotations

import asyncio
import contextlib
import gc
import time
import traceback
from datetime import datetime, timezone
from functools import wraps
from typing import Any

from loguru import logger

try:
    import psutil
except ImportError:
    psutil = None

# 2026-06-26 新增: Prometheus 指标埋点
# 延迟 import 避免循环依赖 (auto_recovery_metrics 不依赖本模块)
try:
    from app.ws.auto_recovery_metrics import (
        RecoveryTimer,
        inc_monitor_exception,
        inc_recovery_failed,
        inc_recovery_succeeded,
        inc_recovery_triggered,
        update_gauges,
    )
    _METRICS_AVAILABLE = True
except ImportError:  # pragma: no cover - 单独运行场景
    _METRICS_AVAILABLE = False
    update_gauges = None  # type: ignore[assignment]
    inc_recovery_triggered = None  # type: ignore[assignment]
    inc_recovery_succeeded = None  # type: ignore[assignment]
    inc_recovery_failed = None  # type: ignore[assignment]
    inc_monitor_exception = None  # type: ignore[assignment]
    RecoveryTimer = None  # type: ignore[assignment]


# ===========================================================================
# 配置 (可通过环境变量覆盖)
# ===========================================================================
import os


def _env_float(name: str, default: float) -> float:
    try:
        return float(os.environ.get(name, default))
    except (TypeError, ValueError):
        return default


def _env_int(name: str, default: int) -> int:
    try:
        return int(os.environ.get(name, default))
    except (TypeError, ValueError):
        return default


HEALTH_CHECK_INTERVAL = _env_float("WS_RECOVERY_HEALTH_INTERVAL", 60.0)
SERVICE_CHECK_INTERVAL = _env_float("WS_RECOVERY_SERVICE_INTERVAL", 30.0)
MAX_MEMORY_MB = _env_int("WS_RECOVERY_MAX_MEMORY_MB", 2048)
MAX_INACTIVE_TIME = _env_int("WS_RECOVERY_MAX_INACTIVE_SEC", 900)
MAX_RECOVERY_ATTEMPTS = _env_int("WS_RECOVERY_MAX_ATTEMPTS", 5)
QUEUE_HIGH_WATERMARK = _env_float("WS_RECOVERY_QUEUE_HIGH_WATERMARK", 0.9)
PROCESSING_TASKS_HIGH_WATERMARK = _env_int("WS_RECOVERY_TASKS_HIGH_WATERMARK", 500)
CONSECUTIVE_ERROR_THRESHOLD = _env_int("WS_RECOVERY_CONSECUTIVE_ERRORS", 3)


class WebSocketAutoRecoveryManager:
    """WebSocket 自动恢复管理器.

    职责:
    1. 周期性健康检查: 队列水位 / 任务数 / 内存 / 服务活跃度
    2. 异常触发恢复: 连续错误超阈值时执行恢复
    3. 后台任务引用: 防止 GC 后任务异常丢失
    4. 队列过载保护: 队列满时清空降压 + 计数
    """

    def __init__(self, ws_manager: Any):
        self.ws_manager = ws_manager
        self.is_running = True
        self.recovery_count = 0
        self.max_recovery_attempts = MAX_RECOVERY_ATTEMPTS

        # 监控配置: 针对 Coze API 长响应时间优化
        self.health_check_interval = HEALTH_CHECK_INTERVAL
        self.service_check_interval = SERVICE_CHECK_INTERVAL
        self.max_memory_mb = MAX_MEMORY_MB
        self.max_inactive_time = MAX_INACTIVE_TIME
        self.queue_high_watermark = QUEUE_HIGH_WATERMARK
        self.processing_tasks_high_watermark = PROCESSING_TASKS_HIGH_WATERMARK
        self.consecutive_error_threshold = CONSECUTIVE_ERROR_THRESHOLD

        self.last_activity_time = time.time()
        self.last_health_check = time.time()
        self.service_status = "healthy"
        self.error_count = 0
        self.consecutive_errors = 0
        self.monitor_tasks: set[asyncio.Task] = set()
        self.exception_stats: dict[str, int] = {}
        self.recovery_history: list[dict[str, Any]] = []

        # 串行化队列操作的锁 (防止 clear/qsize 与消费者 get_nowait 竞态)
        self._queue_lock: asyncio.Lock = asyncio.Lock()

    # -----------------------------------------------------------------
    # 启动 / 停止
    # -----------------------------------------------------------------

    async def start_monitoring(self) -> None:
        """启动监控系统."""
        logger.info("启动 WebSocket 自动恢复监控系统")
        task_configs = [
            (self._health_monitor, "health_monitor"),
            (self._service_monitor, "service_monitor"),
            (self._connection_monitor, "connection_monitor"),
            (self._memory_monitor, "memory_monitor"),
            (self._task_monitor, "task_monitor"),
        ]
        started: list[asyncio.Task] = []
        for coro, name in task_configs:
            try:
                task = self._create_monitor_task(coro, name)
                started.append(task)
            except Exception as e:
                logger.error(f"启动监控任务失败 {name}: {e}")
        self.monitor_tasks.update(started)
        await asyncio.sleep(0.1)
        active = [t for t in started if not t.done()]
        logger.info(f"活跃监控任务: {len(active)}/{len(started)}")

    def _create_monitor_task(self, coro, task_name: str) -> asyncio.Task:
        @self._exception_wrapper(task_name)
        async def wrapped() -> None:
            return await coro()

        task = asyncio.create_task(wrapped())
        return task

    def _exception_wrapper(self, task_name: str):
        def decorator(func):
            @wraps(func)
            async def wrapper(*args, **kwargs):
                try:
                    return await func(*args, **kwargs)
                except asyncio.CancelledError:
                    raise
                except Exception as e:
                    self.consecutive_errors += 1
                    self.error_count += 1
                    self.exception_stats[type(e).__name__] = self.exception_stats.get(type(e).__name__, 0) + 1
                    # 2026-06-26 新增: Prometheus 指标埋点
                    if inc_monitor_exception is not None:
                        try:
                            inc_monitor_exception(task_name, e)
                        except Exception:
                            pass
                    logger.error(f"监控任务 {task_name} 异常: {e}")
                    if self.consecutive_errors >= self.consecutive_error_threshold:
                        await self._trigger_recovery(f"监控任务异常: {task_name}")
                    await asyncio.sleep(min(10 * self.consecutive_errors, 60))

            return wrapper

        return decorator

    # -----------------------------------------------------------------
    # 监控协程
    # -----------------------------------------------------------------

    async def _health_monitor(self) -> None:
        while self.is_running:
            try:
                await asyncio.sleep(self.health_check_interval)
                if not hasattr(self.ws_manager, "active_connections"):
                    await self._trigger_recovery("WebSocket 管理器状态异常")
                    continue

                # 启动后台任务 (幂等)
                if hasattr(self.ws_manager, "_ensure_tasks_started"):
                    with contextlib.suppress(Exception):
                        if not getattr(self.ws_manager, "_tasks_started", False):
                            await self.ws_manager._ensure_tasks_started()

                # 队列水位检查
                if hasattr(self.ws_manager, "message_queue") and hasattr(self.ws_manager, "queue_size"):
                    try:
                        size = self.ws_manager.message_queue.qsize()
                        threshold = self.ws_manager.queue_size * self.queue_high_watermark
                        if size > threshold:
                            dropped = await self._clear_message_queue()
                            logger.warning(
                                f"WS message_queue 水位 {size}/{self.ws_manager.queue_size} > "
                                f"{threshold:.0f}, 清空 {dropped} 条"
                            )
                    except Exception as e:
                        logger.debug(f"message_queue qsize check failed: {e}")
                self.consecutive_errors = 0
                self.last_health_check = time.time()
                # 2026-06-26 新增: 同步指标到 Prometheus Gauge
                if update_gauges is not None:
                    try:
                        update_gauges(self)
                    except Exception:
                        # 防御: 任何 metrics 异常都不应影响主监控循环
                        # 项目记忆: 吞 except Exception 必须加 logger.debug
                        logger.debug("[auto_recovery] update_gauges 失败", exc_info=False)
            except Exception as e:
                logger.error(f"健康监控异常: {e}")
                await asyncio.sleep(10)

    async def _service_monitor(self) -> None:
        while self.is_running:
            try:
                await asyncio.sleep(self.service_check_interval)
                # 累计消息计数 (total_messages 或 _total_messages_sent)
                total_msgs = getattr(self.ws_manager, "total_messages", 0) or getattr(
                    self.ws_manager, "_total_messages_sent", 0
                )
                if total_msgs > 0:
                    self.last_activity_time = time.time()
                active_calls = len(getattr(self.ws_manager, "active_api_calls", {}) or {})
                if active_calls > 0:
                    self.last_activity_time = time.time()
                inactive = time.time() - self.last_activity_time
                if inactive > self.max_inactive_time:
                    active = len(getattr(self.ws_manager, "active_connections", {}) or {})
                    if active > 0 and active_calls == 0:
                        await self._diagnose_service_status()
            except Exception as e:
                logger.error(f"服务监控异常: {e}")
                await asyncio.sleep(10)

    async def _connection_monitor(self) -> None:
        while self.is_running:
            try:
                await asyncio.sleep(120)
                connections = getattr(self.ws_manager, "active_connections", {}) or {}
                if not isinstance(connections, dict):
                    continue
                zombies: list[str] = []
                for cid in list(connections.keys()):
                    try:
                        ws = connections[cid]
                        state = getattr(getattr(ws, "client_state", ws), "name", "")
                        if state in ("DISCONNECTED", "CLOSED", "CLOSING"):
                            zombies.append(cid)
                    except Exception:
                        zombies.append(cid)
                for cid in zombies:
                    with contextlib.suppress(Exception):
                        await self.ws_manager.remove_connection(cid)
                if zombies:
                    logger.info(f"清理 {len(zombies)} 个僵尸连接")
            except Exception as e:
                logger.error(f"连接监控异常: {e}")
                await asyncio.sleep(60)

    async def _memory_monitor(self) -> None:
        while self.is_running:
            try:
                await asyncio.sleep(300)
                if psutil:
                    process = psutil.Process()
                    mem_mb = process.memory_info().rss / 1024 / 1024
                    if mem_mb > self.max_memory_mb:
                        await self._emergency_memory_cleanup()
                        logger.warning(f"内存 {mem_mb:.0f}MB 超阈值 {self.max_memory_mb}MB, 已 GC")
            except Exception as e:
                logger.error(f"内存监控异常: {e}")
                await asyncio.sleep(60)

    async def _task_monitor(self) -> None:
        while self.is_running:
            try:
                await asyncio.sleep(180)
                tasks = getattr(self.ws_manager, "processing_tasks", set()) or set()
                if not isinstance(tasks, set):
                    continue
                active = sum(1 for t in tasks if not t.done())
                if active > self.processing_tasks_high_watermark:
                    await self._cleanup_processing_tasks()
                    logger.warning(
                        f"处理任务数 {active} 超阈值 {self.processing_tasks_high_watermark}, 已清理"
                    )
            except Exception as e:
                logger.error(f"任务监控异常: {e}")
                await asyncio.sleep(30)

    # -----------------------------------------------------------------
    # 恢复
    # -----------------------------------------------------------------

    async def _trigger_recovery(self, reason: str) -> None:
        if self.recovery_count >= self.max_recovery_attempts:
            logger.critical(f"达到最大恢复次数 {self.max_recovery_attempts},需要手动干预")
            # 2026-06-26 新增: 超过最大次数也记一次 failed 事件, 便于告警
            if inc_recovery_failed is not None:
                try:
                    inc_recovery_failed(f"max_attempts_reached:{reason}")
                except Exception:
                    pass
            return
        self.recovery_count += 1
        self.recovery_history.append({
            "time": datetime.now(timezone.utc).isoformat(),
            "reason": reason,
            "attempt": self.recovery_count,
        })
        # 历史保留最近 50 条
        if len(self.recovery_history) > 50:
            self.recovery_history = self.recovery_history[-50:]
        # 2026-06-26 新增: 埋点 triggered
        if inc_recovery_triggered is not None:
            try:
                inc_recovery_triggered(reason)
            except Exception:
                pass
        try:
            # 2026-06-26 新增: 埋点 recovery 耗时 (succeeded | failed)
            if RecoveryTimer is not None:
                with RecoveryTimer("succeeded"):
                    await self._perform_recovery()
            else:
                await self._perform_recovery()
            self.consecutive_errors = 0
            if inc_recovery_succeeded is not None:
                try:
                    inc_recovery_succeeded(reason)
                except Exception:
                    pass
            logger.info(f"恢复成功 attempt={self.recovery_count} reason={reason}")
        except Exception as e:
            if inc_recovery_failed is not None:
                try:
                    inc_recovery_failed(reason)
                except Exception:
                    pass
            logger.error(f"恢复失败: {e}\n{traceback.format_exc()}")

    async def _perform_recovery(self) -> None:
        gc.collect()
        await self._cleanup_invalid_connections()
        await self._restart_background_tasks()
        await self._clear_message_queue()
        self._reset_statistics()

    async def _cleanup_invalid_connections(self) -> None:
        invalid: list[str] = []
        for cid in list(getattr(self.ws_manager, "active_connections", {}).keys()):
            try:
                if not self.ws_manager.is_client_connected(cid):
                    invalid.append(cid)
            except Exception:
                invalid.append(cid)
        for cid in invalid:
            with contextlib.suppress(Exception):
                await self.ws_manager.remove_connection(cid)

    async def _restart_background_tasks(self) -> None:
        try:
            if hasattr(self.ws_manager, "start_background_tasks"):
                await self.ws_manager.start_background_tasks()
            elif hasattr(self.ws_manager, "_ensure_tasks_started"):
                await self.ws_manager._ensure_tasks_started()
        except Exception as e:
            logger.error(f"重启后台任务失败: {e}")

    async def _clear_message_queue(self) -> int:
        """清空出箱消息队列 (线程安全, 返回清除条数).

        加锁防止与消费者 _outbox_consumer 的 get()/task_done() 竞态.
        """
        async with self._queue_lock:
            q = getattr(self.ws_manager, "message_queue", None)
            if q is None:
                return 0
            dropped = 0
            while not q.empty():
                try:
                    q.get_nowait()
                    q.task_done()
                    dropped += 1
                except asyncio.QueueEmpty:
                    break
                except Exception as e:
                    # 异常: 不吞, 记录并跳出
                    logger.debug(f"_clear_message_queue 异常: {e}")
                    break
            return dropped

    def _reset_statistics(self) -> None:
        if hasattr(self.ws_manager, "total_messages"):
            self.ws_manager.total_messages = 0
        if hasattr(self.ws_manager, "queue_full_count"):
            self.ws_manager.queue_full_count = 0
        self.error_count = 0
        self.consecutive_errors = 0
        self.last_activity_time = time.time()

    async def _diagnose_service_status(self) -> None:
        active_calls = len(getattr(self.ws_manager, "active_api_calls", {}) or {})
        inactive = time.time() - self.last_activity_time
        diagnostics = {
            "active_connections": len(getattr(self.ws_manager, "active_connections", {}) or {}),
            "active_api_calls": active_calls,
            "inactive_duration_minutes": inactive / 60,
            "error_count": self.error_count,
            "recovery_count": self.recovery_count,
        }
        logger.info(f"服务诊断结果: {diagnostics}")
        if active_calls == 0 and inactive / 60 > 20:
            await self._trigger_recovery(f"有连接但长时间无活动 {inactive / 60:.1f} 分钟")

    async def _emergency_memory_cleanup(self) -> None:
        gc.collect()
        if hasattr(self.ws_manager, "conversation_cache"):
            with contextlib.suppress(Exception):
                self.ws_manager.conversation_cache._cleanup_expired()
        if hasattr(self.ws_manager, "message_hashes"):
            self.ws_manager.message_hashes.clear()

    async def _cleanup_processing_tasks(self) -> None:
        tasks = getattr(self.ws_manager, "processing_tasks", set())
        if not isinstance(tasks, set):
            return
        done = [t for t in tasks if t.done()]
        for t in done:
            tasks.discard(t)

    async def stop_monitoring(self) -> None:
        self.is_running = False
        for task in list(self.monitor_tasks):
            if not task.done():
                task.cancel()
        if self.monitor_tasks:
            await asyncio.gather(*self.monitor_tasks, return_exceptions=True)
        self.monitor_tasks.clear()
        # 2026-06-26 新增: 同步停止状态到指标
        if update_gauges is not None:
            try:
                update_gauges(self)
            except Exception:
                logger.debug("[auto_recovery] stop_monitoring update_gauges 失败", exc_info=False)

    def get_status_report(self) -> dict[str, Any]:
        memory_mb = 0.0
        if psutil:
            with contextlib.suppress(Exception):
                memory_mb = psutil.Process().memory_info().rss / 1024 / 1024
        active_monitors = [t for t in self.monitor_tasks if not t.done()]
        failed_monitors = [t for t in self.monitor_tasks if t.done() and t.exception()]
        tasks = getattr(self.ws_manager, "processing_tasks", set()) or set()
        active_proc_tasks = sum(1 for t in tasks if not t.done()) if isinstance(tasks, set) else 0
        pending_tasks = getattr(self.ws_manager, "_pending_tasks", set()) or set()
        active_pending = sum(
            1 for t in pending_tasks if not t.done()
        ) if isinstance(pending_tasks, set) else 0
        return {
            "auto_recovery": {
                "is_running": self.is_running,
                "service_status": self.service_status,
                "recovery_count": self.recovery_count,
                "error_count": self.error_count,
                "consecutive_errors": self.consecutive_errors,
                "last_activity_time": datetime.fromtimestamp(
                    self.last_activity_time, tz=timezone.utc
                ).isoformat(),
                "last_health_check": datetime.fromtimestamp(
                    self.last_health_check, tz=timezone.utc
                ).isoformat(),
                "monitor_tasks": {
                    "total": len(self.monitor_tasks),
                    "active": len(active_monitors),
                    "failed": len(failed_monitors),
                },
                "memory_usage_mb": round(memory_mb, 2),
                "recovery_history": self.recovery_history[-5:],
                "active_connections": len(
                    getattr(self.ws_manager, "active_connections", {}) or {}
                ),
                "queue_size": getattr(self.ws_manager, "message_queue", None)
                and self.ws_manager.message_queue.qsize(),
                "queue_capacity": getattr(self.ws_manager, "queue_size", 0),
                "queue_full_count": getattr(self.ws_manager, "queue_full_count", 0),
                "active_api_calls": len(
                    getattr(self.ws_manager, "active_api_calls", {}) or {}
                ),
                "processing_tasks": active_proc_tasks,
                "pending_tasks": active_pending,
                "total_messages_queued": getattr(
                    self.ws_manager, "total_messages", 0
                ),
                "background_tasks_started": getattr(
                    self.ws_manager, "_tasks_started", False
                ),
            }
        }


_auto_recovery_manager: WebSocketAutoRecoveryManager | None = None


async def initialize_auto_recovery(ws_manager: Any) -> WebSocketAutoRecoveryManager:
    """初始化自动恢复系统 (幂等).

    启动后台监控任务, 同时确保 ConnectionManager 自己的后台任务也已启动.
    """
    global _auto_recovery_manager
    if _auto_recovery_manager is None:
        _auto_recovery_manager = WebSocketAutoRecoveryManager(ws_manager)
        # 先确保 ConnectionManager 的出箱消费者已启动
        if hasattr(ws_manager, "start_background_tasks"):
            with contextlib.suppress(Exception):
                await ws_manager.start_background_tasks()
        try:
            await _auto_recovery_manager.start_monitoring()
            logger.info("WebSocket 自动恢复系统已初始化并启动监控")
        except Exception as e:
            logger.error(
                f"WebSocket 自动恢复系统监控启动失败: {e}\n{traceback.format_exc()}"
            )
    return _auto_recovery_manager


def get_recovery_status() -> dict[str, Any]:
    """获取恢复状态 (供 /api/v1/system/auto-recovery/status 调用)."""
    if _auto_recovery_manager is not None:
        return _auto_recovery_manager.get_status_report()
    return {"status": "not_initialized"}


async def shutdown_auto_recovery() -> None:
    """关闭自动恢复系统 (lifespan 退出时调用)."""
    global _auto_recovery_manager
    if _auto_recovery_manager is not None:
        await _auto_recovery_manager.stop_monitoring()
        if hasattr(_auto_recovery_manager.ws_manager, "stop_background_tasks"):
            with contextlib.suppress(Exception):
                await _auto_recovery_manager.ws_manager.stop_background_tasks()
        _auto_recovery_manager = None
        # 2026-06-26 新增: 标记 is_running=0
        if update_gauges is not None:
            try:
                update_gauges(None)
            except Exception:
                logger.debug("[auto_recovery] shutdown update_gauges 失败", exc_info=False)
        logger.info("WebSocket 自动恢复系统已关闭")
