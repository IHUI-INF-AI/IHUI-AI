"""签到体系数据模型 (迁移自历史项目)"""

from sqlalchemy import (
    BigInteger,
    Column,
    Index,
    String,
)

from app.database import Base
from app.models.base import TimestampMixin, id_column


class CheckIn(TimestampMixin, Base):
    """会员连续签到 (历史 t_check_in)"""

    __tablename__ = "t_check_in"
    __table_args__ = (
        Index("idx_checkin_member_id", "member_id"),
    )

    id = id_column(comment="主键id")
    member_id = Column(BigInteger, nullable=False, comment="会员id")
    continuous_num = Column(BigInteger, nullable=False, comment="连续签到天数")


class CheckInRecord(TimestampMixin, Base):
    """会员签到记录 (历史 t_check_in_record)"""

    __tablename__ = "t_check_in_record"
    __table_args__ = (
        Index("idx_checkin_rec_member_id", "member_id"),
        Index("idx_checkin_rec_type", "type"),
    )

    id = id_column(comment="主键id")
    member_id = Column(BigInteger, nullable=False, comment="会员id")
    type = Column(String(20), nullable=False, comment="签到类型")
