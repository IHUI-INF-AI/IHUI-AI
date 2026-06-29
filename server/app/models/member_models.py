"""企业会员体系数据模型 (迁移自历史 ihui-ai-edu-member-service)"""

from sqlalchemy import (
    BigInteger,
    Column,
    Index,
    Integer,
    String,
)

from app.database import Base
from app.models.base import TimestampMixin, id_column


class MemberCompany(TimestampMixin, Base):
    """会员公司表 (历史 t_member_company)"""

    __tablename__ = "t_member_company"
    __table_args__ = (
        Index("idx_member_company_type_id", "company_type_id"),
        Index("idx_member_company_status", "status"),
        Index("idx_member_company_sort_order", "sort_order"),
        Index("idx_member_company_create_time", "created_at"),
    )

    id = id_column(comment="主键id")
    name = Column(String(100), nullable=False, default="", comment="公司名称")
    image = Column(String(1000), nullable=True, default="", comment="公司logo（图片URL）")
    mobile = Column(String(20), nullable=False, default="", comment="联系电话")
    email = Column(String(100), nullable=False, default="", comment="邮箱地址")
    status = Column(String(30), nullable=False, default="normal", comment="状态：normal-正常, invalid-无效, deleted-已删除")
    sort_order = Column(Integer, nullable=False, default=0, comment="排序，数值越大越靠前")
    company_type_id = Column(BigInteger, nullable=True, comment="公司类型id（关联 t_member_company_type 表）")


class MemberGroup(TimestampMixin, Base):
    """会员分组表 (历史 t_member_group)"""

    __tablename__ = "t_member_group"
    __table_args__ = (
        Index("idx_member_group_status", "status"),
        Index("idx_member_group_sort_order", "sort_order"),
        Index("idx_member_group_create_time", "created_at"),
    )

    id = id_column(comment="主键id")
    name = Column(String(100), nullable=False, default="", comment="分组名称")
    sort_order = Column(Integer, nullable=False, default=0, comment="排序，数值越大越靠前")
    status = Column(String(30), nullable=False, default="enable", comment="状态：enable-启用, disable-禁用")


class MemberLevel(TimestampMixin, Base):
    """会员等级 (历史 t_member_level)"""

    __tablename__ = "t_member_level"

    id = id_column(comment="主键id")
    name = Column(String(100), nullable=False, comment="名称")
    description = Column(String(2000), nullable=False, comment="描述")
    conditions = Column(BigInteger, nullable=False, comment="状态")
