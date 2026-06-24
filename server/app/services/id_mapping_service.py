"""主键映射 service - 解决 H 盘 Long → G 盘 UUID 的对接."""
from __future__ import annotations

import logging
import uuid
from typing import Any

from app.database import get_session
from app.models.id_mapping import IdMapping

logger = logging.getLogger(__name__)


def get_new_id(source_table: str, old_id: int | str) -> str | None:
    """根据 H 盘老主键查 G 盘新主键."""
    with get_session() as db:
        m = (
            db.query(IdMapping)
            .filter(
                IdMapping.source_table == source_table,
                IdMapping.old_id == str(old_id),
            )
            .first()
        )
        return m.new_uuid if m else None


def get_old_id(source_table: str, new_uuid: str) -> int | None:
    """反向: G 盘 UUID → H 盘 Long."""
    with get_session() as db:
        m = (
            db.query(IdMapping)
            .filter(
                IdMapping.source_table == source_table,
                IdMapping.new_uuid == new_uuid,
            )
            .first()
        )
        return int(m.old_id) if m else None


def batch_register(
    source_table: str,
    old_id: int,
    migration_batch: str,
    new_uuid: str | None = None,
    remark: str | None = None,
) -> str:
    """注册一条映射 (重复则返回已有)."""
    with get_session() as db:
        existing = (
            db.query(IdMapping)
            .filter(
                IdMapping.source_table == source_table,
                IdMapping.old_id == str(old_id),
            )
            .first()
        )
        if existing:
            return existing.new_uuid
        if new_uuid is None:
            new_uuid = uuid.uuid4().hex
        m = IdMapping(
            id=new_uuid,
            source_table=source_table,
            old_id=str(old_id),
            new_uuid=new_uuid,
            migration_batch=migration_batch,
            remark=remark,
        )
        db.add(m)
        return new_uuid


def batch_resolve(
    source_table: str,
    old_ids: list[int],
    migration_batch: str,
) -> dict[int, str]:
    """批量查询/生成映射. 一次性提交, 性能优于单条循环."""
    if not old_ids:
        return {}
    with get_session() as db:
        # 1. 查已有的
        existing_rows = (
            db.query(IdMapping.old_id, IdMapping.new_uuid)
            .filter(
                IdMapping.source_table == source_table,
                IdMapping.old_id.in_([str(i) for i in old_ids]),
            )
            .all()
        )
        result: dict[int, str] = {int(oid): nuid for oid, nuid in existing_rows}
        # 2. 缺失的批量生成
        missing = [i for i in old_ids if i not in result]
        for old_id in missing:
            new_uuid = uuid.uuid4().hex
            db.add(IdMapping(
                id=new_uuid,
                source_table=source_table,
                old_id=str(old_id),
                new_uuid=new_uuid,
                migration_batch=migration_batch,
            ))
            result[old_id] = new_uuid
        return result


def get_migration_stats() -> list[dict[str, Any]]:
    """按批次汇总映射统计."""
    from sqlalchemy import func

    with get_session() as db:
        rows = (
            db.query(
                IdMapping.migration_batch,
                IdMapping.source_table,
                func.count(IdMapping.id).label("count"),
            )
            .group_by(IdMapping.migration_batch, IdMapping.source_table)
            .all()
        )
        return [
            {
                "migration_batch": r[0],
                "source_table": r[1],
                "count": r[2],
            }
            for r in rows
        ]
