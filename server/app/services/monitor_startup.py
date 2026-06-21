"""监听服务启动管理 (从 coze_zhs_py 迁移)."""


from loguru import logger

from app.services.cached_expiration_monitor import cached_expiration_monitor


class MonitorManager:
    """监听服务管理器."""

    def __init__(self) -> None:
        self.cached_monitor = None
        self.is_started = False

    async def start_all_monitors(self) -> None:
        if self.is_started:
            logger.warning("监听服务已启动")
            return
        try:
            await cached_expiration_monitor.start()
            self.cached_monitor = cached_expiration_monitor
            self.is_started = True
            logger.info("所有监听服务启动完成")
        except Exception as e:
            logger.error(f"启动监听服务失败: {e}")
            raise

    async def stop_all_monitors(self) -> None:
        if not self.is_started:
            return
        try:
            if self.cached_monitor:
                await self.cached_monitor.stop()
            self.is_started = False
            logger.info("所有监听服务已停止")
        except Exception as e:
            logger.error(f"停止监听服务失败: {e}")

    def get_status(self) -> dict:
        return {
            "is_started": self.is_started,
            "cached_monitor_running": self.cached_monitor.is_running if self.cached_monitor else False,
        }


monitor_manager = MonitorManager()
