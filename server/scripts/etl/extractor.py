"""ETL 抽取器 - 从 H 盘 MySQL 抽取数据."""
from __future__ import annotations

import logging
from typing import Any, Iterator

from sqlalchemy import create_engine, text
from sqlalchemy.engine import Engine

from scripts.etl.config import H_SOURCES, MySQLDataSource, MigrationTask

logger = logging.getLogger(__name__)

# H 盘 engine 缓存 (按 service 编码)
_engines: dict[str, Engine] = {}


def get_h_engine(db_key: str) -> Engine:
    """获取 H 盘某 service 的 MySQL engine (含连接池)."""
    if db_key not in _engines:
        ds: MySQLDataSource = H_SOURCES[db_key]
        _engines[db_key] = create_engine(
            ds.url,
            pool_size=2,
            max_overflow=2,
            pool_pre_ping=True,
            pool_recycle=3600,
        )
    return _engines[db_key]


def extract_count(task: MigrationTask) -> int:
    """获取源表总行数 (用于校验)."""
    eng = get_h_engine(task.source_db)
    with eng.connect() as conn:
        result = conn.execute(text(f"SELECT COUNT(*) FROM `{task.source_table}`"))
        return int(result.scalar() or 0)


def extract_batches(
    task: MigrationTask,
    last_id: int = 0,
) -> Iterator[list[dict[str, Any]]]:
    """按主键分批抽取 (断点续传).

    Args:
        task: 迁移任务配置
        last_id: 上次中断处的最大主键 (断点续传用)

    Yields:
        每批 N 行 (字典列表)
    """
    eng = get_h_engine(task.source_db)
    pk = task.pk_columns[0]
    sql = text(
        f"SELECT * FROM `{task.source_table}` "
        f"WHERE `{pk}` > :last_id ORDER BY `{pk}` ASC LIMIT :limit"
    )

    logger.info(f"[extract] {task.source_db}.{task.source_table} last_id={last_id}")
    cursor_id = last_id
    while True:
        with eng.connect() as conn:
            result = conn.execute(sql, {"last_id": cursor_id, "limit": task.batch_size})
            rows = [dict(row._mapping) for row in result]
        if not rows:
            break
        yield rows
        cursor_id = rows[-1][pk]
        if len(rows) < task.batch_size:
            break
