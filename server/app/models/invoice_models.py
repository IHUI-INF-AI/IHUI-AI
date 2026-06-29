"""发票管理数据模型 (迁移自历史 ihui-ai-edu-order-service)

历史项目 service_2 的 order-service 增量 SQL (change.sql 202503271/2) 迁移.
涵盖: 发票抬头 + 发票申请 全闭环.
来源: H:\\历史项目存档\\ljd-交接文件\\service_2\\ihui-ai-edu-order-service\\src\\main\\resources\\db\\sql\\change.sql
"""

from sqlalchemy import (
    BigInteger,
    Boolean,
    Column,
    Index,
    Integer,
    Numeric,
    String,
)

from app.database import Base
from app.models.base import TimestampMixin, id_column


class InvoiceTitle(TimestampMixin, Base):
    """发票抬头 (历史 t_invoice_title)"""

    __tablename__ = "t_invoice_title"
    __table_args__ = (Index("idx_inv_title_user", "user_id"),)

    id = id_column(comment="主键id")
    user_id = Column(BigInteger, nullable=False, comment="用户ID")
    company_id = Column(BigInteger, nullable=True, comment="公司ID")
    title_type = Column(Integer, nullable=False, comment="抬头类型(1-企业/2-个人)")
    company_name = Column(String(200), nullable=False, comment="公司名称/个人姓名")
    company_tax_number = Column(String(50), nullable=True, comment="公司税号")
    company_address = Column(String(500), nullable=True, comment="公司地址")
    company_phone = Column(String(50), nullable=True, comment="公司电话")
    bank_name = Column(String(200), nullable=True, comment="开户银行")
    bank_account = Column(String(100), nullable=True, comment="银行账号")
    email = Column(String(200), nullable=True, comment="电子邮箱(接收电子发票)")
    mobile_phone = Column(String(50), nullable=True, comment="手机号码")
    default_flag = Column(Boolean, nullable=False, default=False, comment="是否默认发票抬头(0:否,1:是)")
    create_user_id = Column(BigInteger, nullable=True, comment="创建人ID")
    update_user_id = Column(BigInteger, nullable=True, comment="更新人ID")


class InvoiceApplication(TimestampMixin, Base):
    """发票申请 (历史 t_invoice_application)"""

    __tablename__ = "t_invoice_application"
    __table_args__ = (
        Index("idx_inv_app_user", "user_id"),
        Index("idx_inv_app_order", "order_id"),
        Index("idx_inv_app_status", "status"),
    )

    id = id_column(comment="主键id")
    user_id = Column(BigInteger, nullable=False, comment="用户ID")
    company_id = Column(BigInteger, nullable=True, comment="公司ID")
    order_id = Column(BigInteger, nullable=False, comment="订单ID")
    order_no = Column(String(50), nullable=False, comment="订单号")
    invoice_title_id = Column(BigInteger, nullable=True, comment="发票抬头ID")
    title_type = Column(Integer, nullable=False, comment="抬头类型(1-企业/2-个人)")
    company_name = Column(String(200), nullable=False, comment="公司名称/个人姓名")
    company_tax_number = Column(String(50), nullable=True, comment="公司税号")
    company_address = Column(String(500), nullable=True, comment="公司地址")
    company_phone = Column(String(50), nullable=True, comment="公司电话")
    bank_name = Column(String(200), nullable=True, comment="开户银行")
    bank_account = Column(String(100), nullable=True, comment="银行账号")
    email = Column(String(200), nullable=True, comment="电子邮箱")
    mobile_phone = Column(String(50), nullable=True, comment="手机号码")
    invoice_amount = Column(Numeric(14, 2), nullable=False, comment="开票金额")
    invoice_content = Column(String(500), nullable=True, comment="发票内容")
    status = Column(Integer, nullable=False, default=0, comment="状态(0-待开票/1-开票中/2-已开票/3-已拒绝/4-已取消)")
    invoice_no = Column(String(100), nullable=True, comment="发票号码")
    invoice_url = Column(String(500), nullable=True, comment="发票URL")
    reject_reason = Column(String(500), nullable=True, comment="拒绝原因")
    create_user_id = Column(BigInteger, nullable=True, comment="创建人ID")
    update_user_id = Column(BigInteger, nullable=True, comment="更新人ID")
