"""Database keep-alive for Serverless PostgreSQL (Neon etc.)

Neon 免费层 5 分钟无连接即 scale-to-zero, 下次查询冷启动 1-3 秒.
本模块启动一个后台线程, 定期对每个 engine 执行 SELECT 1, 保持实例活跃.

仅开发环境 (Neon) 需要开启, 生产环境 (Oracle Cloud 自建 PG) 关闭.
配置: DB_KEEP_ALIVE_ENABLED / DB_KEEP_ALIVE_INTERVAL_SECONDS (app/config.py)
"""

import threading
from typing import Dict

from loguru import logger
from sqlalchemy import text
from sqlalchemy.engine import Engine

_keepalive_thread: threading.Thread | None = None
_keepalive_stop_event = threading.Event()


def _keepalive_loop(engines: Dict[str, Engine], interval: int) -> None:
    """后台保活循环: 每 interval 秒对每个 engine 执行 SELECT 1."""
    logger.info(
        f"[DB KeepAlive] started, interval={interval}s, "
        f"engines={list(engines.keys())}"
    )
    while not _keepalive_stop_event.wait(timeout=interval):
        for name, eng in engines.items():
            try:
                with eng.connect() as conn:
                    conn.execute(text("SELECT 1"))
                logger.debug(f"[DB KeepAlive] {name}: ok")
            except Exception as e:
                logger.warning(f"[DB KeepAlive] {name}: {e}")
    logger.info("[DB KeepAlive] stopped")


def start_keepalive(engines: Dict[str, Engine], interval: int = 240) -> None:
    """启动保活后台线程 (幂等: 重复调用不会创建多个线程).

    Args:
        engines: SQLAlchemy engine 字典 {"ai": engine1, "center": engine2, ...}
        interval: 保活间隔秒数, 默认 240 (4 分钟, 小于 Neon 5 分钟休眠阈值)
    """
    global _keepalive_thread
    if _keepalive_thread and _keepalive_thread.is_alive():
        logger.debug("[DB KeepAlive] already running, skip")
        return
    _keepalive_stop_event.clear()
    _keepalive_thread = threading.Thread(
        target=_keepalive_loop,
        args=(engines, interval),
        daemon=True,
        name="db-keepalive",
    )
    _keepalive_thread.start()


def stop_keepalive() -> None:
    """停止保活后台线程 (测试用, 生产不需要调用)."""
    _keepalive_stop_event.set()
