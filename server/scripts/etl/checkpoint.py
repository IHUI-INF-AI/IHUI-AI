"""迁移断点 (checkpoint) 持久化.

支持断点续传, 记录每个 task 已迁移到的最大 H 盘主键.
"""
from __future__ import annotations

import logging

from sqlalchemy import Column, DateTime, Index, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import declarative_base

from app.database import Base, get_session
from app.utils.datetime_helper import utcnow

logger = logging.getLogger(__name__)


class MigrationCheckpoint(Base):
    """单张表的迁移断点.

    唯一索引: (batch_id, source_table)
    """

    __tablename__ = "migration_checkpoint"
    __table_args__ = (
        UniqueConstraint("batch_id", "source_table", name="uk_mc_batch_table"),
        Index("idx_mc_status", "status"),
    )

    id = Column(Integer, primary_key=True, autoincrement=True)
    batch_id = Column(String(32), nullable=False, comment="迁移批次 v2026_06_24_01")
    source_table = Column(String(64), nullable=False, comment="H 盘表名")
    target_table = Column(String(64), nullable=False, comment="G 盘表名")
    last_pk = Column(String(64), default="0", comment="已迁移到 H 盘的最大主键")
    total_rows = Column(Integer, default=0, comment="总行数 (H 盘)")
    migrated_rows = Column(Integer, default=0, comment="已迁移行数")
    status = Column(String(20), default="pending", comment="pending/running/done/failed")
    error_msg = Column(Text, nullable=True)
    started_at = Column(DateTime, nullable=True)
    finished_at = Column(DateTime, nullable=True)
    updated_at = Column(DateTime, default=utcnow, onupdate=utcnow)


def get_checkpoint(batch_id: str, source_table: str) -> MigrationCheckpoint | None:
    with get_session() as db:
        return (
            db.query(MigrationCheckpoint)
            .filter(
                MigrationCheckpoint.batch_id == batch_id,
                MigrationCheckpoint.source_table == source_table,
            )
            .first()
        )


def upsert_checkpoint(
    batch_id: str,
    source_table: str,
    target_table: str,
    status: str,
    last_pk: str = "0",
    total_rows: int = 0,
    migrated_rows: int = 0,
    error_msg: str | None = None,
) -> None:
    with get_session() as db:
        ck = (
            db.query(MigrationCheckpoint)
            .filter(
                MigrationCheckpoint.batch_id == batch_id,
                MigrationCheckpoint.source_table == source_table,
            )
            .first()
        )
        if ck is None:
            ck = MigrationCheckpoint(
                batch_id=batch_id,
                source_table=source_table,
                target_table=target_table,
            )
            db.add(ck)
        ck.status = status
        ck.last_pk = last_pk
        ck.total_rows = total_rows
        ck.migrated_rows = migrated_rows
        ck.error_msg = error_msg
        if status == "running" and ck.started_at is None:
            ck.started_at = utcnow()
        if status in ("done", "failed"):
            ck.finished_at = utcnow()
        db.flush()
