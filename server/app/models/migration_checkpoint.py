"""
数据迁移 checkpoint 检查点表 (migration_checkpoint)

背景: 长期数据迁移过程 (Java H 盘 → Python G 盘) 需要支持断点续传与幂等性校验,
      每次迁移批次都需要记录当前进度, 失败后可从最近 checkpoint 继续.

本表设计:
- batch_id:  迁移批次号 (与 id_mapping.migration_batch 对齐)
- step_name: 当前迁移步骤名 (如 "phase1_user" / "phase2_order")
- cursor:    上次处理到的最后主键 / 时间戳 (字符串形式, 由具体 step 自行解析)
- status:    0=进行中 1=已完成 2=失败
- updated_at: 最后一次写入时间
- 唯一索引: (batch_id, step_name)
"""
from sqlalchemy import Column, Index, Integer, String, Text

from app.database import Base
from app.models.base import TimestampMixin


class MigrationCheckpoint(TimestampMixin, Base):
    """数据迁移 checkpoint 表.

    唯一索引: (batch_id, step_name)
    """

    __tablename__ = "migration_checkpoint"
    __table_args__ = (
        Index("uk_mcp_batch_step", "batch_id", "step_name", unique=True),
        Index("idx_mcp_status", "status"),
    )

    id = Column(
        String(64),
        primary_key=True,
        comment="UUID, 与 id_column 形式主键一致",
    )
    batch_id = Column(String(32), nullable=False, comment="迁移批次号 (与 id_mapping.migration_batch 对齐)")
    step_name = Column(String(64), nullable=False, comment="迁移步骤名 (如 phase1_user)")
    cursor = Column(String(128), nullable=True, comment="断点游标 (last_id 或 last_ts, 字符串形式)")
    processed_count = Column(Integer, default=0, comment="已处理条数")
    total_count = Column(Integer, default=0, comment="总条数 (0 表示未知)")
    status = Column(Integer, default=0, comment="0=进行中 1=已完成 2=失败")
    last_error = Column(Text, nullable=True, comment="最近一次失败错误信息")
