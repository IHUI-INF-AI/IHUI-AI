import gzip
import logging
import os
import shutil
import subprocess
from datetime import datetime, timedelta

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger

logger = logging.getLogger(__name__)

class BackupService:
    def __init__(
        self,
        db_host: str = "localhost",
        db_port: int = 5432,
        db_name: str = "pdfdb",
        db_user: str = "pdfuser",
        db_password: str = "pdfpass",
        backup_dir: str = "backups",
        retention_days: int = 30,
        compress: bool = True
    ):
        self.db_host = db_host
        self.db_port = db_port
        self.db_name = db_name
        self.db_user = db_user
        self.db_password = db_password
        self.backup_dir = backup_dir
        self.retention_days = retention_days
        self.compress = compress
        self.scheduler = AsyncIOScheduler()
        self._running = False

        os.makedirs(backup_dir, exist_ok=True)

    def create_backup(self) -> str | None:
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        backup_name = f"backup_{self.db_name}_{timestamp}.sql"
        backup_path = os.path.join(self.backup_dir, backup_name)

        env = os.environ.copy()
        env["PGPASSWORD"] = self.db_password

        try:
            cmd = [
                "pg_dump",
                "-h", self.db_host,
                "-p", str(self.db_port),
                "-U", self.db_user,
                "-d", self.db_name,
                "-F", "p",
                "-f", backup_path
            ]

            result = subprocess.run(
                cmd,
                env=env,
                capture_output=True,
                text=True
            )

            if result.returncode != 0:
                logger.error(f"备份失败: {result.stderr}")
                return None

            if self.compress:
                compressed_path = f"{backup_path}.gz"
                with open(backup_path, 'rb') as f_in, gzip.open(compressed_path, 'wb') as f_out:
                    shutil.copyfileobj(f_in, f_out)
                os.remove(backup_path)
                backup_path = compressed_path

            size = os.path.getsize(backup_path)
            logger.info(f"备份创建成功: {backup_path} ({size / 1024 / 1024:.2f} MB)")

            return backup_path

        except Exception as e:
            logger.error(f"备份过程出错: {e}")
            return None

    def restore_backup(self, backup_path: str) -> bool:
        if not os.path.exists(backup_path):
            logger.error(f"备份文件不存在: {backup_path}")
            return False

        env = os.environ.copy()
        env["PGPASSWORD"] = self.db_password

        try:
            if backup_path.endswith('.gz'):
                temp_path = backup_path[:-3]
                with gzip.open(backup_path, 'rb') as f_in, open(temp_path, 'wb') as f_out:
                    shutil.copyfileobj(f_in, f_out)
                sql_path = temp_path
            else:
                sql_path = backup_path

            cmd = [
                "psql",
                "-h", self.db_host,
                "-p", str(self.db_port),
                "-U", self.db_user,
                "-d", self.db_name,
                "-f", sql_path
            ]

            result = subprocess.run(
                cmd,
                env=env,
                capture_output=True,
                text=True
            )

            if backup_path.endswith('.gz') and os.path.exists(temp_path):
                os.remove(temp_path)

            if result.returncode != 0:
                logger.error(f"恢复失败: {result.stderr}")
                return False

            logger.info(f"备份恢复成功: {backup_path}")
            return True

        except Exception as e:
            logger.error(f"恢复过程出错: {e}")
            return False

    def cleanup_old_backups(self) -> int:
        cutoff = datetime.now() - timedelta(days=self.retention_days)
        cleaned = 0

        for filename in os.listdir(self.backup_dir):
            if not filename.startswith(f"backup_{self.db_name}_"):
                continue

            file_path = os.path.join(self.backup_dir, filename)
            stat = os.stat(file_path)
            file_time = datetime.fromtimestamp(stat.st_mtime)

            if file_time < cutoff:
                try:
                    os.remove(file_path)
                    cleaned += 1
                    logger.info(f"清理过期备份: {filename}")
                except Exception as e:
                    logger.error(f"清理备份失败 {filename}: {e}")

        return cleaned

    def list_backups(self) -> list[dict]:
        backups = []

        for filename in os.listdir(self.backup_dir):
            if not filename.startswith(f"backup_{self.db_name}_"):
                continue

            file_path = os.path.join(self.backup_dir, filename)
            stat = os.stat(file_path)

            backups.append({
                "filename": filename,
                "path": file_path,
                "size": stat.st_size,
                "created_at": datetime.fromtimestamp(stat.st_mtime).isoformat(),
                "compressed": filename.endswith('.gz')
            })

        return sorted(backups, key=lambda x: x["created_at"], reverse=True)

    async def scheduled_backup(self):
        logger.info("开始执行定时备份...")
        backup_path = self.create_backup()

        if backup_path:
            cleaned = self.cleanup_old_backups()
            logger.info(f"备份完成,清理了 {cleaned} 个过期备份")

        return backup_path

    def start(self):
        if self._running:
            return

        self.scheduler.add_job(
            self.scheduled_backup,
            CronTrigger(hour=2, minute=0),
            id='daily_backup',
            replace_existing=True
        )

        self.scheduler.add_job(
            self.scheduled_backup,
            CronTrigger(hour=14, minute=0),
            id='afternoon_backup',
            replace_existing=True
        )

        self.scheduler.start()
        self._running = True
        logger.info("备份服务已启动,每天2:00和14:00执行备份")

    def stop(self):
        if self._running:
            self.scheduler.shutdown()
            self._running = False
            logger.info("备份服务已停止")


backup_service = BackupService(
    db_host=os.getenv("DB_HOST", "localhost"),
    db_port=int(os.getenv("DB_PORT", "5432")),
    db_name=os.getenv("DB_NAME", "pdfdb"),
    db_user=os.getenv("DB_USER", "pdfuser"),
    db_password=os.getenv("DB_PASSWORD", "pdfpass"),
    backup_dir=os.getenv("BACKUP_DIR", "backups"),
    retention_days=int(os.getenv("BACKUP_RETENTION_DAYS", "30"))
)
