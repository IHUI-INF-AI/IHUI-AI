"""订单明细数据模型 (订单商品 / 订单支付, 迁移自历史 t_order_item / t_order_payment)"""

from sqlalchemy import (
    BigInteger,
    Column,
    Index,
    Integer,
    Numeric,
    String,
)

from app.database import Base
from app.models.base import TimestampMixin, id_column


class OrderItem(TimestampMixin, Base):
    """订单商品 (历史 t_order_item)"""

    __tablename__ = "t_order_item"
    __table_args__ = (Index("idx_order_item_order", "order_id"),)

    id = id_column(comment="主键id")
    order_id = Column(BigInteger, nullable=False, comment="订单id")
    item_id = Column(String(100), nullable=False, comment="商品id")
    title = Column(String(500), nullable=False, comment="标题")
    image = Column(String(2000), nullable=False, comment="图片")
    original_price = Column(Numeric(14, 2), nullable=False, comment="原价")
    price = Column(Numeric(14, 2), nullable=False, comment="价格")
    quantity = Column(Integer, nullable=False, comment="数量")
    payment_amount = Column(Numeric(14, 2), nullable=False, comment="付款金额")


class OrderPayment(TimestampMixin, Base):
    """订单支付 (历史 t_order_payment)"""

    __tablename__ = "t_order_payment"
    __table_args__ = (Index("idx_order_payment_order", "order_id"),)

    id = id_column(comment="主键id")
    order_id = Column(BigInteger, nullable=False, comment="订单id")
    status = Column(String(100), nullable=False, comment="状态")
    channel = Column(String(100), nullable=False, comment="渠道")
    amount = Column(Numeric(14, 2), nullable=False, comment="金额")
