import logging
import os
import time

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger

logger = logging.getLogger(__name__)

class FileCleanupService:
    def __init__(
        self,
        upload_dir: str = "uploads",
        output_dir: str = "outputs",
        max_age_hours: int = 24,
        max_total_size_mb: int = 1024,
        cleanup_interval_hours: int = 1
    ):
        self.upload_dir = upload_dir
        self.output_dir = output_dir
        self.max_age_hours = max_age_hours
        self.max_total_size_mb = max_total_size_mb
        self.cleanup_interval_hours = cleanup_interval_hours
        self.scheduler = AsyncIOScheduler()
        self._running = False

    def get_file_age(self, file_path: str) -> float:
        stat = os.stat(file_path)
        return (time.time() - stat.st_mtime) / 3600

    def get_file_size(self, file_path: str) -> int:
        return os.path.getsize(file_path)

    def get_total_size(self, directory: str) -> int:
        total = 0
        if os.path.exists(directory):
            for root, _dirs, files in os.walk(directory):
                for f in files:
                    total += os.path.getsize(os.path.join(root, f))
        return total

    def cleanup_old_files(self, directory: str) -> int:
        cleaned = 0
        if not os.path.exists(directory):
            return cleaned

        now = time.time()
        cutoff = now - (self.max_age_hours * 3600)

        for root, _dirs, files in os.walk(directory):
            for f in files:
                file_path = os.path.join(root, f)
                try:
                    stat = os.stat(file_path)
                    if stat.st_mtime < cutoff:
                        os.remove(file_path)
                        cleaned += 1
                        logger.debug(f"清理过期文件: {file_path}")
                except Exception as e:
                    logger.error(f"清理文件失败 {file_path}: {e}")

        return cleaned

    def cleanup_by_size(self, directory: str) -> int:
        cleaned = 0
        if not os.path.exists(directory):
            return cleaned

        max_size = self.max_total_size_mb * 1024 * 1024
        current_size = self.get_total_size(directory)

        if current_size <= max_size:
            return cleaned

        files = []
        for root, _dirs, filenames in os.walk(directory):
            for f in filenames:
                file_path = os.path.join(root, f)
                try:
                    stat = os.stat(file_path)
                    files.append((file_path, stat.st_mtime, stat.st_size))
                except OSError:
                    pass

        files.sort(key=lambda x: x[1])

        for file_path, _mtime, size in files:
            if current_size <= max_size:
                break
            try:
                os.remove(file_path)
                current_size -= size
                cleaned += 1
                logger.debug(f"清理文件释放空间: {file_path}")
            except Exception as e:
                logger.error(f"清理文件失败 {file_path}: {e}")

        return cleaned

    async def run_cleanup(self):
        logger.info("开始执行文件清理...")

        total_cleaned = 0

        for directory in [self.upload_dir, self.output_dir]:
            if os.path.exists(directory):
                cleaned = self.cleanup_old_files(directory)
                total_cleaned += cleaned
                logger.info(f"清理 {directory} 中 {cleaned} 个过期文件")

                cleaned = self.cleanup_by_size(directory)
                total_cleaned += cleaned
                logger.info(f"清理 {directory} 中 {cleaned} 个文件释放空间")

        logger.info(f"文件清理完成,共清理 {total_cleaned} 个文件")
        return total_cleaned

    def start(self):
        if self._running:
            return

        self.scheduler.add_job(
            self.run_cleanup,
            'interval',
            hours=self.cleanup_interval_hours,
            id='file_cleanup',
            replace_existing=True
        )

        self.scheduler.add_job(
            self.run_cleanup,
            CronTrigger(hour=3, minute=0),
            id='daily_cleanup',
            replace_existing=True
        )

        self.scheduler.start()
        self._running = True
        logger.info(f"文件清理服务已启动,每 {self.cleanup_interval_hours} 小时执行一次")

    def stop(self):
        if self._running:
            self.scheduler.shutdown()
            self._running = False
            logger.info("文件清理服务已停止")

    def get_stats(self) -> dict:
        stats = {
            "upload_dir": {
                "path": os.path.abspath(self.upload_dir),
                "exists": os.path.exists(self.upload_dir),
                "total_size": 0,
                "file_count": 0
            },
            "output_dir": {
                "path": os.path.abspath(self.output_dir),
                "exists": os.path.exists(self.output_dir),
                "total_size": 0,
                "file_count": 0
            },
            "config": {
                "max_age_hours": self.max_age_hours,
                "max_total_size_mb": self.max_total_size_mb,
                "cleanup_interval_hours": self.cleanup_interval_hours
            }
        }

        for name, directory in [("upload_dir", self.upload_dir), ("output_dir", self.output_dir)]:
            if os.path.exists(directory):
                total_size = 0
                file_count = 0
                for root, _dirs, files in os.walk(directory):
                    for f in files:
                        file_path = os.path.join(root, f)
                        try:
                            total_size += os.path.getsize(file_path)
                            file_count += 1
                        except OSError:
                            pass
                stats[name]["total_size"] = total_size
                stats[name]["file_count"] = file_count

        return stats


cleanup_service = FileCleanupService()
