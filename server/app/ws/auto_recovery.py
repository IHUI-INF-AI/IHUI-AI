"""WebSocket 自动恢复管理器.

迁移自 coze_zhs_py/websocket_auto_recovery.py.
解决 WebSocket 服务停掉但项目没停的问题.
"""

import asyncio
import contextlib
import gc
import time
import traceback
from datetime import datetime
from functools import wraps

from loguru import logger

try:
    import psutil
except ImportError:
    psutil = None


class WebSocketAutoRecoveryManager:
    """WebSocket 自动恢复管理器."""

    def __init__(self, ws_manager):
        self.ws_manager = ws_manager
        self.is_running = True
        self.recovery_count = 0
        self.max_recovery_attempts = 5

        # 监控配置:针对 Coze API 长响应时间优化
        self.health_check_interval = 60
        self.service_check_interval = 30
        self.max_memory_mb = 2048
        self.max_inactive_time = 900

        self.last_activity_time = time.time()
        self.last_health_check = time.time()
        self.service_status = "healthy"
        self.error_count = 0
        self.consecutive_errors = 0
        self.monitor_tasks = set()
        self.exception_stats = {}
        self.recovery_history = []

    async def start_monitoring(self):
        """启动监控系统."""
        logger.info("启动 WebSocket 自动恢复监控系统")
        task_configs = [
            (self._health_monitor, "health_monitor"),
            (self._service_monitor, "service_monitor"),
            (self._connection_monitor, "connection_monitor"),
            (self._memory_monitor, "memory_monitor"),
            (self._task_monitor, "task_monitor"),
        ]
        started = []
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

    def _create_monitor_task(self, coro, task_name: str):
        @self._exception_wrapper(task_name)
        async def wrapped():
            return await coro()

        return asyncio.create_task(wrapped())

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
                    logger.error(f"监控任务 {task_name} 异常: {e}")
                    if self.consecutive_errors >= 3:
                        await self._trigger_recovery(f"监控任务异常: {task_name}")
                    await asyncio.sleep(min(10 * self.consecutive_errors, 60))

            return wrapper

        return decorator

    async def _health_monitor(self):
        while self.is_running:
            try:
                await asyncio.sleep(self.health_check_interval)
                if not hasattr(self.ws_manager, "active_connections"):
                    await self._trigger_recovery("WebSocket 管理器状态异常")
                    continue
                if hasattr(self.ws_manager, "_tasks_started") and not self.ws_manager._tasks_started:
                    await self._restart_background_tasks()
                if hasattr(self.ws_manager, "message_queue"):
                    try:
                        size = self.ws_manager.message_queue.qsize()
                        if size > self.ws_manager.queue_size * 0.9:
                            await self._clear_message_queue()
                    except Exception as e:
                        # 2026-06-25 P2 加固: 记录异常
                        logger.debug(f"message_queue qsize check failed: {e}")
                self.consecutive_errors = 0
                self.last_health_check = time.time()
            except Exception as e:
                logger.error(f"健康监控异常: {e}")
                await asyncio.sleep(10)

    async def _service_monitor(self):
        while self.is_running:
            try:
                await asyncio.sleep(self.service_check_interval)
                if hasattr(self.ws_manager, "total_messages") and self.ws_manager.total_messages > 0:
                    self.last_activity_time = time.time()
                active_calls = 0
                if hasattr(self.ws_manager, "active_api_calls"):
                    active_calls = len(self.ws_manager.active_api_calls)
                if active_calls > 0:
                    self.last_activity_time = time.time()
                inactive = time.time() - self.last_activity_time
                if inactive > self.max_inactive_time:
                    active = len(self.ws_manager.active_connections)
                    if active > 0 and active_calls == 0:
                        await self._diagnose_service_status()
            except Exception as e:
                logger.error(f"服务监控异常: {e}")
                await asyncio.sleep(10)

    async def _connection_monitor(self):
        while self.is_running:
            try:
                await asyncio.sleep(120)
                zombies = []
                for cid in list(self.ws_manager.active_connections.keys()):
                    try:
                        ws = self.ws_manager.active_connections[cid]
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

    async def _memory_monitor(self):
        while self.is_running:
            try:
                await asyncio.sleep(300)
                if psutil:
                    process = psutil.Process()
                    mem_mb = process.memory_info().rss / 1024 / 1024
                    if mem_mb > self.max_memory_mb:
                        await self._emergency_memory_cleanup()
            except Exception as e:
                logger.error(f"内存监控异常: {e}")
                await asyncio.sleep(60)

    async def _task_monitor(self):
        while self.is_running:
            try:
                await asyncio.sleep(180)
                if hasattr(self.ws_manager, "processing_tasks"):
                    active = len(self.ws_manager.processing_tasks)
                    if active > 500:
                        await self._cleanup_processing_tasks()
            except Exception as e:
                logger.error(f"任务监控异常: {e}")
                await asyncio.sleep(30)

    async def _trigger_recovery(self, reason: str):
        if self.recovery_count >= self.max_recovery_attempts:
            logger.critical(f"达到最大恢复次数 {self.max_recovery_attempts},需要手动干预")
            return
        self.recovery_count += 1
        self.recovery_history.append({
            "time": datetime.now().isoformat(),
            "reason": reason,
            "attempt": self.recovery_count,
        })
        try:
            await self._perform_recovery()
            self.consecutive_errors = 0
        except Exception as e:
            logger.error(f"恢复失败: {e}\n{traceback.format_exc()}")

    async def _perform_recovery(self):
        gc.collect()
        await self._cleanup_invalid_connections()
        await self._restart_background_tasks()
        await self._clear_message_queue()
        self._reset_statistics()

    async def _cleanup_invalid_connections(self):
        invalid = []
        for cid in list(self.ws_manager.active_connections.keys()):
            try:
                if not self.ws_manager.is_client_connected(cid):
                    invalid.append(cid)
            except Exception:
                invalid.append(cid)
        for cid in invalid:
            with contextlib.suppress(Exception):
                await self.ws_manager.remove_connection(cid)

    async def _restart_background_tasks(self):
        try:
            if hasattr(self.ws_manager, "_ensure_tasks_started"):
                self.ws_manager._tasks_started = False
                await self.ws_manager._ensure_tasks_started()
        except Exception as e:
            logger.error(f"重启后台任务失败: {e}")

    async def _clear_message_queue(self):
        if hasattr(self.ws_manager, "message_queue"):
            q = self.ws_manager.message_queue
            while not q.empty():
                try:
                    q.get_nowait()
                except Exception:
                    break

    def _reset_statistics(self):
        if hasattr(self.ws_manager, "total_messages"):
            self.ws_manager.total_messages = 0
        if hasattr(self.ws_manager, "queue_full_count"):
            self.ws_manager.queue_full_count = 0
        self.error_count = 0
        self.consecutive_errors = 0
        self.last_activity_time = time.time()

    async def _diagnose_service_status(self):
        active_calls = len(getattr(self.ws_manager, "active_api_calls", {}))
        inactive = time.time() - self.last_activity_time
        diagnostics = {
            "active_connections": len(self.ws_manager.active_connections),
            "active_api_calls": active_calls,
            "inactive_duration_minutes": inactive / 60,
            "error_count": self.error_count,
            "recovery_count": self.recovery_count,
        }
        logger.info(f"服务诊断结果: {diagnostics}")
        if active_calls == 0 and inactive / 60 > 20:
            await self._trigger_recovery(f"有连接但长时间无活动 {inactive / 60:.1f} 分钟")

    async def _emergency_memory_cleanup(self):
        gc.collect()
        if hasattr(self.ws_manager, "conversation_cache"):
            with contextlib.suppress(Exception):
                self.ws_manager.conversation_cache._cleanup_expired()
        if hasattr(self.ws_manager, "message_hashes"):
            self.ws_manager.message_hashes.clear()

    async def _cleanup_processing_tasks(self):
        if hasattr(self.ws_manager, "processing_tasks"):
            done = [t for t in self.ws_manager.processing_tasks if t.done()]
            for t in done:
                self.ws_manager.processing_tasks.discard(t)

    async def stop_monitoring(self):
        self.is_running = False
        for task in self.monitor_tasks:
            if not task.done():
                task.cancel()
        if self.monitor_tasks:
            await asyncio.gather(*self.monitor_tasks, return_exceptions=True)

    def get_status_report(self):
        memory_mb = 0
        if psutil:
            with contextlib.suppress(Exception):
                memory_mb = psutil.Process().memory_info().rss / 1024 / 1024
        active = [t for t in self.monitor_tasks if not t.done()]
        failed = [t for t in self.monitor_tasks if t.done() and t.exception()]
        return {
            "auto_recovery": {
                "is_running": self.is_running,
                "service_status": self.service_status,
                "recovery_count": self.recovery_count,
                "error_count": self.error_count,
                "consecutive_errors": self.consecutive_errors,
                "last_activity_time": datetime.fromtimestamp(self.last_activity_time).isoformat(),
                "last_health_check": datetime.fromtimestamp(self.last_health_check).isoformat(),
                "monitor_tasks": {"total": len(self.monitor_tasks), "active": len(active), "failed": len(failed)},
                "memory_usage_mb": round(memory_mb, 2),
                "recovery_history": self.recovery_history[-5:],
                "active_connections": len(self.ws_manager.active_connections) if hasattr(self.ws_manager, "active_connections") else 0,
            }
        }


_auto_recovery_manager: WebSocketAutoRecoveryManager | None = None


async def initialize_auto_recovery(ws_manager) -> WebSocketAutoRecoveryManager:
    """初始化自动恢复系统."""
    global _auto_recovery_manager
    if _auto_recovery_manager is None:
        _auto_recovery_manager = WebSocketAutoRecoveryManager(ws_manager)
        try:
            await _auto_recovery_manager.start_monitoring()
            logger.info("WebSocket 自动恢复系统已初始化并启动监控")
        except Exception as e:
            logger.error(f"WebSocket 自动恢复系统监控启动失败: {e}\n{traceback.format_exc()}")
    return _auto_recovery_manager


def get_recovery_status():
    """获取恢复状态."""
    if _auto_recovery_manager:
        return _auto_recovery_manager.get_status_report()
    return {"status": "not_initialized"}
