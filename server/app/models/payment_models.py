"""
Order and payment models (from zhs_ai_project).
"""
from sqlalchemy import (
    BigInteger,
    Boolean,
    Column,
    DateTime,
    Index,
    Integer,
    Numeric,
    String,
    Text,
    func,
)

from app.database import Base
from app.models.base import TimestampMixin, id_column


class Order(TimestampMixin, Base):
    """Payment order (zhs_ai_project.zhs_order)."""

    __tablename__ = "zhs_order"
    __table_args__ = (
        Index("ix_zhs_order_user_id", "user_id"),
        Index("ix_zhs_order_status", "status"),
        {
            # 建议 108: 多租户阶段 2, schema 占位 (默认 public, 多租户模式时动态改为 tenant_{tid})
            "schema": "public",
        },
    )

    id = id_column(comment="Order ID")
    user_id = Column(String(64), nullable=True, comment="User UUID")
    out_trade_no = Column(String(64), nullable=True, comment="Merchant order number")
    open_id = Column(String(100), nullable=True, comment="WeChat open ID")
    amount = Column(BigInteger, nullable=True, comment="Amount in cents")
    status = Column(Integer, default=0, comment="0=pending, 1=paid, 2=refunded, 3=cancelled")
    payment_status = Column(Integer, default=0, comment="0=unpaid, 1=paid, 2=refunded")
    created_at = Column(DateTime, default=func.now(), comment="Created")
    paid_at = Column(DateTime, nullable=True, comment="Payment time")
    product_id = Column(String(64), nullable=True, comment="Product ID")
    order_type = Column(Integer, default=0, comment="0=token, 1=activity, 2=identity, 3=agent")
    activity_id = Column(String(64), nullable=True, comment="Activity ID")
    product_identity_id = Column(String(64), nullable=True, comment="Product identity ID")
    pay_type = Column(String(20), nullable=True, comment="wechat, alipay")
    refund_time = Column(DateTime, nullable=True, comment="Refund time")
    refund_reason = Column(String(255), nullable=True, comment="Refund reason")


class CommissionFlow(TimestampMixin, Base):
    """Commission/referral flow (zhs_ai_project.zhs_commission_flow)."""

    __tablename__ = "zhs_commission_flow"
    __table_args__ = (
        Index("ix_zhs_commission_flow_user_id", "user_id"),
        Index("ix_zhs_commission_flow_status", "status"),
        {
            # 建议 113: 阶段 2 业务表 schema 改造 (第 2 批)
            "schema": "public",
        },
    )

    id = id_column(comment="Commission flow ID")
    user_id = Column(String(64), nullable=True, comment="User UUID")
    order_id = Column(BigInteger, nullable=True, comment="Order ID")
    open_id = Column(String(100), nullable=True, comment="Open ID")
    amount = Column(BigInteger, nullable=True, comment="Commission amount")
    type = Column(Integer, nullable=True, comment="0=regular, 1=VIP, 2=trader")
    status = Column(Integer, default=1, comment="0=invalid, 1=active")
    token = Column(BigInteger, nullable=True, comment="Token earned")
    time = Column(BigInteger, nullable=True, comment="Unix timestamp")
    remark = Column(String(255), nullable=True)
    belongers_open_id = Column(String(100), nullable=True, comment="Direct referrer open ID")
    order_status = Column(Integer, nullable=True)
    invited_user_id = Column(String(64), nullable=True, comment="Invited user ID")


class WithdrawalFlow(TimestampMixin, Base):
    """Withdrawal flow (zhs_ai_project.zhs_withdrawal_flow)."""

    __tablename__ = "zhs_withdrawal_flow"
    __table_args__ = (
        Index("ix_zhs_withdrawal_flow_user_id", "user_id"),
        Index("ix_zhs_withdrawal_flow_status", "status"),
        {
            # 建议 113: 阶段 2 业务表 schema 改造 (第 2 批)
            "schema": "public",
        },
    )

    id = id_column(comment="Withdrawal ID")
    user_id = Column(String(64), nullable=False, comment="User UUID")
    amount = Column(BigInteger, nullable=False, comment="Withdrawal amount")
    status = Column(Integer, default=0, comment="0=pending, 1=processing, 2=completed, 3=failed")
    partner_trade_no = Column(String(64), nullable=True, comment="WeChat transfer number")
    payment_no = Column(String(64), nullable=True, comment="Payment number")


class IdentityProportion(TimestampMixin, Base):
    """Commission ratio configuration (zhs_ai_project.zhs_identity_proportion).

    Controls how much commission each user role earns from referrals.
    All proportion fields are integer percentages (e.g. 5 means 5%).
    """

    __tablename__ = "zhs_identity_proportion"
    __table_args__ = (Index("ix_zhs_identity_proportion_status", "status"), {"extend_existing": True})  # noqa: RUF012

    id = Column(String(64), primary_key=True, comment="UUID")
    begin_time = Column(DateTime, nullable=True, comment="Effective start time")
    end_time = Column(DateTime, nullable=True, comment="Effective end time")
    status = Column(Integer, default=0, comment="0=stopped, 1=active")
    gift = Column(BigInteger, default=0, comment="Token gift for inviting new user (normal)")
    token_proportion = Column(Integer, default=0, comment="Normal user token commission %")
    vip_gift = Column(BigInteger, default=0, comment="Token gift for VIP inviting new user")
    routine_proportion = Column(Integer, default=0, comment="VIP -> routine order commission %")
    vip_proportion = Column(Integer, default=0, comment="VIP -> VIP order commission %")
    trader_proportion = Column(Integer, default=0, comment="VIP -> trader order commission %")
    trader_gift = Column(BigInteger, default=0, comment="Token gift for trader inviting new user")
    trader_routine_proportion = Column(Integer, default=0, comment="Trader -> routine order commission %")
    trader_vip_proportion = Column(Integer, default=0, comment="Trader -> VIP order commission %")
    trader_trader_proportion = Column(Integer, default=0, comment="Trader -> trader order commission %")
    grand_routine_proportion = Column(Integer, default=0, comment="Grandparent -> routine order commission %")
    grand_vip_proportion = Column(Integer, default=0, comment="Grandparent -> VIP order commission %")
    grand_trader_proportion = Column(Integer, default=0, comment="Grandparent -> trader order commission %")
    creator = Column(String(64), nullable=True)
    created_time = Column(DateTime, nullable=True)
    updator = Column(String(64), nullable=True)
    updated_time = Column(DateTime, nullable=True)


# NOTE: OperateTokenFlow 已合并至 app.models.token_models.ZhsOperateTokenFlow
# 此处保留别名导入以兼容现有代码 (token_service / margin 等)。
# 原先此处重复定义了同名表导致 SQLAlchemy "Table already defined" 错误。
from app.models.token_models import ZhsOperateTokenFlow as OperateTokenFlow  # noqa: E402,F401


class Refund(TimestampMixin, Base):
    """退款记录 (zhs_ai_project.zhs_refund)."""

    __tablename__ = "zhs_refund"
    __table_args__ = (
        Index("ix_zhs_refund_user_id", "user_id"),
        Index("ix_zhs_refund_status", "status"),
        Index("ix_zhs_refund_order_no", "order_no"),
        {"schema": "public"},
    )

    id = id_column(comment="Refund ID")
    refund_id = Column(String(32), nullable=False, unique=True, comment="退款单号 RFxxx")
    user_id = Column(String(64), nullable=False, comment="用户 UUID")
    order_no = Column(String(64), nullable=False, comment="订单号")
    reason = Column(String(500), nullable=False, comment="退款原因")
    amount = Column(BigInteger, nullable=True, comment="退款金额(分)")
    description = Column(String(500), nullable=True, comment="描述")
    status = Column(String(20), default="pending", comment="退款状态")
    retry_count = Column(Integer, default=0, comment="重试次数")
    evidence = Column(Text, default="[]", comment="凭证 JSON 数组")


class RefundTimeline(TimestampMixin, Base):
    """退款时间线 (zhs_ai_project.zhs_refund_timeline)."""

    __tablename__ = "zhs_refund_timeline"
    __table_args__ = (
        Index("ix_zhs_refund_timeline_refund_id", "refund_id"),
        {"schema": "public"},
    )

    id = id_column(comment="Timeline ID")
    refund_id = Column(String(32), nullable=False, comment="退款单号")
    action = Column(String(50), nullable=False, comment="动作")
    operator = Column(String(64), nullable=True, comment="操作人")
    note = Column(String(500), nullable=True, comment="备注")
    status_from = Column(String(20), nullable=True, comment="变更前状态")


# ======================================================================
# 以下模型按 H:\\edu client 旧 edu 微服务 entity 字段 1:1 补全
# - Payment / PaymentConfig: 来自 ihui-ai-edu-pay-service (P0 阻塞)
# - OrderItem / OrderPayment: 来自 ihui-ai-edu-order-service
# - InvoiceApplication / InvoiceTitle: 来自 ihui-ai-edu-order-service
# ======================================================================


class Payment(TimestampMixin, Base):
    """支付记录 (迁移自 H:ihui-ai-edu-pay-service\\Payment).

    - 适配微信/支付宝/银联等 TradePlatform
    - 金额统一存 BigInteger 分, 避免浮点精度问题
    """

    __tablename__ = "edu_payment"
    __table_args__ = (
        Index("idx_ep_order_no", "order_no"),
        Index("idx_ep_pay_no", "pay_no"),
        Index("idx_ep_user", "user_id"),
        Index("idx_ep_status", "status"),
    )

    id = id_column(comment="ID")
    order_no = Column(String(64), nullable=False, comment="商户订单号")
    pay_no = Column(String(64), nullable=True, comment="商户支付订单号")
    status = Column(Integer, default=0, comment="0=待支付 1=已支付 2=已退款 3=已关闭 4=失败")
    callback_url = Column(String(500), nullable=True, comment="支付回调接口")
    subject = Column(String(256), nullable=True, comment="订单标题")
    total_amount = Column(BigInteger, nullable=False, default=0, comment="订单总金额(分)")
    order_create_time = Column(DateTime, nullable=True, comment="创建订单时间")
    expire_time = Column(DateTime, nullable=True, comment="过期时间")
    return_url = Column(String(500), nullable=True, comment="支付成功同步跳转")
    platform = Column(String(20), nullable=True, comment="wechatpay/alipay/unionpay")
    terminal = Column(String(20), nullable=True, comment="H5/MINI/APP/PC")
    channel = Column(String(20), nullable=True, comment="平台渠道类型")
    ip = Column(String(64), nullable=True, comment="客户端IP")
    open_id = Column(String(100), nullable=True, comment="微信OpenId")
    transaction_id = Column(String(100), nullable=True, comment="平台交易订单号")
    user_id = Column(String(64), nullable=True, comment="用户UUID")
    department_id = Column(BigInteger, nullable=True, comment="部门ID")
    company_id = Column(BigInteger, nullable=True, comment="公司ID")


class PaymentConfig(TimestampMixin, Base):
    """支付平台配置 (迁移自 H:ihui-ai-edu-pay-service\\PaymentConfig).

    - 按 platformCode+configKey 维度存储配置
    - 支持多个支付平台, 每平台多组 key-value
    """

    __tablename__ = "edu_payment_config"
    __table_args__ = (
        Index("idx_epc_platform", "platform_code"),
        Index("idx_epc_status", "status"),
    )

    id = id_column(comment="ID")
    platform_code = Column(String(50), nullable=False, comment="支付平台编码 wechatpay/alipay")
    platform_name = Column(String(100), nullable=True, comment="支付平台名称")
    config_key = Column(String(100), nullable=False, comment="配置项键")
    config_value = Column(Text, nullable=True, comment="配置项值")
    description = Column(String(500), nullable=True, comment="配置项描述")
    status = Column(Integer, default=1, comment="0=禁用 1=启用")


class OrderItem(TimestampMixin, Base):
    """订单商品 (迁移自 H:ihui-ai-edu-order-service\\OrderItem).

    - 一张 Order 可包含多个 OrderItem
    - 与现存的 zhs_order 区分, 存的是 edu 微服务 t_order_item 的字段
    """

    __tablename__ = "edu_order_item"
    __table_args__ = (
        Index("idx_eoi_order", "order_id"),
        Index("idx_eoi_item", "item_id"),
    )

    id = id_column(comment="ID")
    order_id = Column(BigInteger, nullable=False, comment="订单ID")
    item_id = Column(BigInteger, nullable=False, comment="商品关联ID")
    title = Column(String(200), nullable=True, comment="商品标题")
    image = Column(String(500), nullable=True, comment="商品图片")
    original_price = Column(BigInteger, default=0, comment="原价(分)")
    price = Column(BigInteger, default=0, comment="单价(分)")
    quantity = Column(Integer, default=1, comment="数量")
    payment_amount = Column(BigInteger, default=0, comment="实付款金额(分)")
    discount_amount = Column(BigInteger, default=0, comment="优惠金额(分)")
    total_amount = Column(BigInteger, default=0, comment="总金额(分)")


class OrderPayment(TimestampMixin, Base):
    """订单支付流水 (迁移自 H:ihui-ai-edu-order-service\\OrderPayment).

    - 一张 Order 可有多次支付尝试 (合并支付/补差价)
    """

    __tablename__ = "edu_order_payment"
    __table_args__ = (
        Index("idx_eop_order", "order_id"),
        Index("idx_eop_status", "status"),
    )

    id = id_column(comment="ID")
    order_id = Column(BigInteger, nullable=False, comment="订单ID")
    status = Column(Integer, default=0, comment="0=待支付 1=成功 2=失败")
    channel = Column(String(20), nullable=True, comment="支付渠道 wechatpay/alipay")
    amount = Column(BigInteger, default=0, comment="支付金额(分)")


class InvoiceApplication(TimestampMixin, Base):
    """发票申请 (迁移自 H:ihui-ai-edu-order-service\\InvoiceApplication)."""

    __tablename__ = "edu_invoice_application"
    __table_args__ = (
        Index("idx_eia_order_no", "order_no"),
        Index("idx_eia_user", "user_id"),
        Index("idx_eia_status", "invoice_status"),
    )

    id = id_column(comment="ID")
    order_no = Column(String(64), nullable=False, comment="订单号")
    user_id = Column(String(64), nullable=True, comment="用户UUID")
    company_id = Column(BigInteger, nullable=True, comment="公司ID")
    product_fee = Column(BigInteger, default=0, comment="商品费用(分)")
    invoice_amount = Column(BigInteger, default=0, comment="开票金额(分)")
    invoice_content = Column(String(500), nullable=True, comment="发票内容")
    title_type = Column(Integer, default=1, comment="1=企业单位 2=个人或非企业单位")
    company_name = Column(String(200), nullable=True, comment="公司抬头")
    company_tax_number = Column(String(100), nullable=True, comment="公司税号")
    company_address = Column(String(500), nullable=True, comment="公司地址")
    company_phone = Column(String(50), nullable=True, comment="公司电话")
    bank_name = Column(String(100), nullable=True, comment="开户银行")
    bank_account = Column(String(50), nullable=True, comment="开户账号")
    email = Column(String(100), nullable=True, comment="电子邮箱")
    mobile_phone = Column(String(20), nullable=True, comment="手机号码")
    invoice_status = Column(Integer, default=0, comment="0=待开 1=已开 2=已拒绝")
    create_user_id = Column(String(64), nullable=True, comment="创建人UUID")
    create_user_name = Column(String(100), nullable=True, comment="创建人姓名")
    update_user_id = Column(String(64), nullable=True, comment="更新人UUID")
    update_user_name = Column(String(100), nullable=True, comment="更新人姓名")


class InvoiceTitle(TimestampMixin, Base):
    """发票抬头 (迁移自 H:ihui-ai-edu-order-service\\InvoiceTitle)."""

    __tablename__ = "edu_invoice_title"
    __table_args__ = (
        Index("idx_eit_user", "user_id"),
        Index("idx_eit_company", "company_id"),
    )

    id = id_column(comment="ID")
    user_id = Column(String(64), nullable=True, comment="用户UUID")
    company_id = Column(BigInteger, nullable=True, comment="公司ID")
    title_type = Column(Integer, default=1, comment="1=企业单位 2=个人或非企业单位")
    company_name = Column(String(200), nullable=True, comment="公司名称/个人姓名")
    company_tax_number = Column(String(100), nullable=True, comment="公司税号")
    company_address = Column(String(500), nullable=True, comment="公司地址")
    company_phone = Column(String(50), nullable=True, comment="公司电话")
    bank_name = Column(String(100), nullable=True, comment="开户银行")
    bank_account = Column(String(50), nullable=True, comment="银行账号")
    email = Column(String(100), nullable=True, comment="电子邮箱")
    mobile_phone = Column(String(20), nullable=True, comment="手机号码")
    default_flag = Column(Boolean, default=False, comment="是否默认发票抬头")
    create_user_id = Column(String(64), nullable=True, comment="创建人UUID")
    update_user_id = Column(String(64), nullable=True, comment="更新人UUID")
