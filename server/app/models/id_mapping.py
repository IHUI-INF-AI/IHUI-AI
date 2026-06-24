"""
数据迁移主键映射中间表 (id_mapping)

背景: H 盘 Java 微服务的主键是 Long 自增, G 盘 Python 端主键是 String(64) UUID
      两套主键无法直接对接, 数据迁移时必须先建立 old_long_id <-> new_uuid 映射

本表设计:
- source_table: 来源表名 (H 盘 Java entity 的 t_xxx)
- old_id: H 盘 Long 主键
- new_uuid: G 盘 String(64) UUID 主键
- migration_batch: 迁移批次号, 用于回滚
- created_at: 映射创建时间
"""

from sqlalchemy import Column, Index, String

from app.database import Base
from app.models.base import TimestampMixin


class IdMapping(TimestampMixin, Base):
    """H 盘 Long 主键 ↔ G 盘 String(64) UUID 主键映射表.

    唯一索引: (source_table, old_id)
    查询索引: (source_table, new_uuid) / (migration_batch)
    """

    __tablename__ = "id_mapping"
    __table_args__ = (
        # 唯一索引: 按 (source_table, old_id) 查 G 盘 UUID
        Index("uk_idm_source_old", "source_table", "old_id", unique=True),
        # 反向索引: 按 (source_table, new_uuid) 查 H 盘 old_id
        Index("idx_idm_source_new", "source_table", "new_uuid"),
        # 批次索引: 按 migration_batch 统计 / 回滚
        Index("idx_idm_batch", "migration_batch"),
        # 复合索引: 优化"按批次 + 某表"批量查询 (回滚 + 统计都用)
        # 比 idx_idm_batch 单字段更精准, 避免扫全表再 filter
        Index("idx_idm_batch_source", "migration_batch", "source_table"),
        # created_at 索引: 用于按时间窗口审计
        Index("idx_idm_created", "created_at"),
    )

    id = Column(
        String(64),
        primary_key=True,
        comment="UUID, 与 new_uuid 相同 (便于本身用 id_column 形式主键)",
    )
    source_table = Column(String(64), nullable=False, comment="来源表名 H 盘 t_xxx")
    old_id = Column(String(32), nullable=False, comment="H 盘 Long 主键 (字符串形式避免精度丢失)")
    new_uuid = Column(String(64), nullable=False, comment="G 盘 String(64) UUID 主键")
    migration_batch = Column(String(32), nullable=True, comment="迁移批次号 v2026_06_24_xxx")
    remark = Column(String(500), nullable=True, comment="备注")
