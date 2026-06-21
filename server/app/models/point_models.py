"""
积分体系数据模型 (迁移自 ihui-ai-edu-point-service)
"""

from sqlalchemy import (
    BigInteger,
    Column,
    Index,
    Integer,
    String,
    Text,
)

from app.database import Base
from app.models.base import TimestampMixin, id_column


class PointAccount(TimestampMixin, Base):
    """积分账户"""

    __tablename__ = "point_account"
    __table_args__ = (
        Index("idx_pa_user", "user_id"),)

    id = id_column(comment="ID")
    user_id = Column(String(64), unique=True, nullable=False)
    user_name = Column(String(100), nullable=True)
    total_point = Column(BigInteger, default=0, comment="累计积分")
    available_point = Column(BigInteger, default=0, comment="可用积分")
    frozen_point = Column(BigInteger, default=0, comment="冻结积分")
    used_point = Column(BigInteger, default=0, comment="已使用积分")
    level = Column(Integer, default=1, comment="积分等级")

class PointRule(TimestampMixin, Base):
    """积分规则"""

    __tablename__ = "point_rule"
    __table_args__ = (Index("ix_point_rule_status", "status"),)

    id = id_column(comment="ID")
    code = Column(String(50), unique=True, nullable=False, comment="规则编码")
    name = Column(String(100), nullable=False, comment="规则名称")
    type = Column(String(20), default="add", comment="add=获得 reduce=消耗")
    action = Column(String(50), nullable=False, comment="行为: signin/share/comment/buy/course_complete等")
    point = Column(Integer, default=0, comment="积分值")
    max_per_day = Column(Integer, default=0, comment="每日上限,0不限")
    description = Column(String(500), nullable=True, comment="规则描述")
    status = Column(Integer, default=1, comment="0=禁用 1=启用")

class PointLog(TimestampMixin, Base):
    """积分流水"""

    __tablename__ = "point_log"
    __table_args__ = (
        Index("idx_pl_user", "user_id"),
        Index("idx_pl_action", "action"),
        Index("idx_pl_time", "created_at"),)

    id = id_column(comment="ID")
    user_id = Column(String(64), nullable=False)
    user_name = Column(String(100), nullable=True)
    type = Column(String(20), default="add", comment="add/reduce")
    action = Column(String(50), nullable=False, comment="行为")
    point = Column(Integer, default=0, comment="积分变化")
    balance = Column(Integer, default=0, comment="操作后余额")
    description = Column(String(500), nullable=True, comment="描述")
    ref_id = Column(String(64), nullable=True, comment="关联业务ID")
    ref_type = Column(String(50), nullable=True, comment="关联业务类型")

class PointGoods(TimestampMixin, Base):
    """积分商品(兑换)"""

    __tablename__ = "point_goods"
    __table_args__ = (
        Index("idx_pg_status", "status"),)

    id = id_column(comment="ID")
    name = Column(String(200), nullable=False, comment="商品名称")
    description = Column(Text, nullable=True)
    image = Column(String(500), nullable=True)
    point_cost = Column(Integer, default=0, comment="所需积分")
    stock = Column(Integer, default=0, comment="库存")
    sold_num = Column(Integer, default=0, comment="已兑换数")
    limit_per_user = Column(Integer, default=1, comment="每人限兑次数")
    type = Column(String(20), default="virtual", comment="virtual/physical")
    status = Column(Integer, default=1, comment="0=下架 1=上架")
    sort_order = Column(Integer, default=0)

class PointExchange(TimestampMixin, Base):
    """积分兑换记录"""

    __tablename__ = "point_exchange"
    __table_args__ = (
        Index("idx_pe_user", "user_id"),
        Index("idx_pe_status", "status"),)

    id = id_column(comment="ID")
    user_id = Column(String(64), nullable=False)
    user_name = Column(String(100), nullable=True)
    goods_id = Column(BigInteger, nullable=False)
    goods_name = Column(String(200), nullable=True)
    point_cost = Column(Integer, default=0, comment="消耗积分")
    quantity = Column(Integer, default=1)
    total_point = Column(Integer, default=0, comment="总积分")
    status = Column(Integer, default=0, comment="0=待发货 1=已发货 2=已完成 3=已取消")
    address = Column(String(500), nullable=True)
    contact = Column(String(100), nullable=True)
    express_no = Column(String(100), nullable=True)
