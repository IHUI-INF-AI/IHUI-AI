"""Java 原项目迁移到 Python 时缺失的 Domain 模型补齐.

迁移自 3 个 Java 项目, 共 9 个缺失模型:

迁移自 ZHS_Server_java/small/domain/:
- AiBotSites
- PaymentCallback
- TransferInfo
- UserAgentFreeTimes
- WxPayNotification

迁移自 ai-smart-society-java:
- PowerPurchaseRule
- ZhsDeveloperFundLogs
- ZhsUserSysLink

迁移自 edu Java 微服务 usercenter-service:
- Company
"""

from typing import Any

from sqlalchemy import Column, DateTime, Integer, String, Text

from app.database import Base
from app.models.base import id_column
from app.utils.datetime_helper import utcnow


class AiBotSites(Base):
    """AI 工具站点信息表."""

    __tablename__ = "ai_bot_sites"

    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(255), nullable=False)
    url = Column(String(512))
    category = Column(String(64))
    description = Column(Text)
    icon = Column(String(512))
    sort = Column(Integer, default=0)
    is_use = Column(Integer, default=1)
    created_at = Column(DateTime, default=utcnow)
    updated_at = Column(DateTime, default=utcnow, onupdate=utcnow)

    def to_dict(self) -> dict[str, Any]:
        return {
            "id": self.id,
            "name": self.name,
            "url": self.url,
            "category": self.category,
            "description": self.description,
            "icon": self.icon,
            "sort": self.sort,
            "is_use": self.is_use,
        }


class PaymentCallback(Base):
    """支付回调记录表."""

    __tablename__ = "payment_callbacks"

    id = id_column()
    order_id = Column(String(64), index=True)
    payment_method = Column(String(32))
    callback_type = Column(String(32))
    raw_data = Column(Text)
    status = Column(Integer, default=0)
    amount = Column(Integer, default=0)
    created_at = Column(DateTime, default=utcnow)
    updated_at = Column(DateTime, default=utcnow, onupdate=utcnow)

    def to_dict(self) -> dict[str, Any]:
        return {
            "id": self.id,
            "order_id": self.order_id,
            "payment_method": self.payment_method,
            "callback_type": self.callback_type,
            "raw_data": self.raw_data,
            "status": self.status,
            "amount": self.amount,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }


class TransferInfo(Base):
    """转账信息表."""

    __tablename__ = "transfer_infos"

    id = id_column()
    transfer_no = Column(String(64), unique=True, index=True)
    from_user = Column(String(64))
    to_user = Column(String(64))
    amount = Column(Integer, default=0)
    status = Column(Integer, default=0)
    remark = Column(String(255))
    created_at = Column(DateTime, default=utcnow)

    def to_dict(self) -> dict[str, Any]:
        return {
            "id": self.id,
            "transfer_no": self.transfer_no,
            "from_user": self.from_user,
            "to_user": self.to_user,
            "amount": self.amount,
            "status": self.status,
            "remark": self.remark,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }


class UserAgentFreeTimes(Base):
    """用户 Agent 免费次数表."""

    __tablename__ = "user_agent_free_times"

    id = id_column()
    user_uuid = Column(String(64), index=True, nullable=False)
    agent_id = Column(String(64), index=True, nullable=False)
    free_times = Column(Integer, default=0)
    used_times = Column(Integer, default=0)
    last_reset_at = Column(DateTime)
    created_at = Column(DateTime, default=utcnow)
    updated_at = Column(DateTime, default=utcnow, onupdate=utcnow)

    def to_dict(self) -> dict[str, Any]:
        return {
            "id": self.id,
            "user_uuid": self.user_uuid,
            "agent_id": self.agent_id,
            "free_times": self.free_times,
            "used_times": self.used_times,
            "remaining": max(0, (self.free_times or 0) - (self.used_times or 0)),
            "last_reset_at": self.last_reset_at.isoformat() if self.last_reset_at else None,
        }


class WxPayNotification(Base):
    """微信支付通知表."""

    __tablename__ = "wx_pay_notifications"

    id = id_column()
    out_trade_no = Column(String(64), index=True)
    transaction_id = Column(String(64), index=True)
    openid = Column(String(128))
    trade_type = Column(String(32))
    bank_type = Column(String(32))
    total_fee = Column(Integer, default=0)
    cash_fee = Column(Integer, default=0)
    refund_no = Column(String(64))
    notification_type = Column(String(32))
    result_code = Column(String(16))
    raw_xml = Column(Text)
    status = Column(Integer, default=0)
    created_at = Column(DateTime, default=utcnow)

    def to_dict(self) -> dict[str, Any]:
        return {
            "id": self.id,
            "out_trade_no": self.out_trade_no,
            "transaction_id": self.transaction_id,
            "openid": self.openid,
            "trade_type": self.trade_type,
            "bank_type": self.bank_type,
            "total_fee": self.total_fee,
            "cash_fee": self.cash_fee,
            "refund_no": self.refund_no,
            "notification_type": self.notification_type,
            "result_code": self.result_code,
            "status": self.status,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }


class PowerPurchaseRule(Base):
    """算力购买规则表 (迁移自 ai-smart-society-java: power_purchase_rule)."""

    __tablename__ = "power_purchase_rule"

    id = Column(String(64), primary_key=True)
    title = Column(String(255), nullable=True, comment="商品信息")
    status = Column(Integer, default=0, comment="0正常|1活动|3折扣")
    is_del = Column(Integer, default=0, comment="逻辑删除 0保留|1删除")
    begin_at = Column(DateTime, comment="活动开始时间")
    end_at = Column(DateTime, comment="活动结束时间")
    pic_explain = Column(String(512), comment="说明图片地址")
    field1 = Column(String(255), comment="备用字段")
    created_at = Column(DateTime, default=utcnow)
    updated_at = Column(DateTime, default=utcnow, onupdate=utcnow)

    def to_dict(self) -> dict[str, Any]:
        return {
            "id": self.id,
            "title": self.title,
            "status": self.status,
            "is_del": self.is_del,
            "begin_at": self.begin_at.isoformat() if self.begin_at else None,
            "end_at": self.end_at.isoformat() if self.end_at else None,
            "pic_explain": self.pic_explain,
            "field1": self.field1,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }


class ZhsDeveloperFundLogs(Base):
    """开发者订单日志表 (迁移自 ai-smart-society-java: zhs_developer_fund_logs)."""

    __tablename__ = "zhs_developer_fund_logs"

    id = id_column()
    order_id = Column(String(64), index=True, comment="关联订单")
    operate = Column(Integer, default=0, comment="操作类型 0其他|1购买|2提现|3退款")
    amount = Column(Integer, default=0, comment="约定金额")
    real_amount = Column(Integer, default=0, comment="实际金额")
    discount = Column(Integer, default=100, comment="平台折扣比例")
    product_id = Column(String(64), comment="商品id")
    type = Column(Integer, default=0, comment="商品类型 0其他|1开发者身份")
    operate_id = Column(String(64), comment="操作人")
    operated_at = Column(DateTime, comment="操作时间")
    beneficiary = Column(String(64), comment="受益人（只有分销才会使用）")
    benefit_amount = Column(String(32), comment="受益金额")
    created_at = Column(DateTime, default=utcnow)

    def to_dict(self) -> dict[str, Any]:
        return {
            "id": self.id,
            "order_id": self.order_id,
            "operate": self.operate,
            "amount": self.amount,
            "real_amount": self.real_amount,
            "discount": self.discount,
            "product_id": self.product_id,
            "type": self.type,
            "operate_id": self.operate_id,
            "operated_at": self.operated_at.isoformat() if self.operated_at else None,
            "beneficiary": self.beneficiary,
            "benefit_amount": self.benefit_amount,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }


class ZhsUserSysLink(Base):
    """普通用户与系统用户对应表 (迁移自 ai-smart-society-java: zhs_user_sys_link)."""

    __tablename__ = "zhs_user_sys_link"

    id = id_column()
    user_uuid = Column(String(64), index=True, comment="登录用户id")
    sys_user_id = Column(String(64), index=True, comment="系统登录用户id")
    field1 = Column(String(255), comment="预留字段")
    status = Column(Integer, default=0, comment="状态（预留字段）")
    is_del = Column(Integer, default=0, comment="是否删除")
    created_at = Column(DateTime, default=utcnow)

    def to_dict(self) -> dict[str, Any]:
        return {
            "id": self.id,
            "user_uuid": self.user_uuid,
            "sys_user_id": self.sys_user_id,
            "field1": self.field1,
            "status": self.status,
            "is_del": self.is_del,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }


class Company(Base):
    """公司表 (迁移自 edu Java 微服务: usercenter-service CompanyController).

    对应 Java: com.ihui.ai.edu.usercenter.entity.Company
    表名: zhs_company (兼容旧数据)
    """

    __tablename__ = "zhs_company"

    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(255), nullable=False, comment="公司名称")
    short_name = Column(String(128), comment="公司简称")
    code = Column(String(64), index=True, comment="公司编码")
    contact_person = Column(String(64), comment="联系人")
    contact_phone = Column(String(32), comment="联系电话")
    address = Column(String(512), comment="公司地址")
    description = Column(Text, comment="公司描述")
    status = Column(Integer, default=1, comment="状态 0禁用|1启用")
    is_del = Column(Integer, default=0, comment="逻辑删除 0保留|1删除")
    created_at = Column(DateTime, default=utcnow)
    updated_at = Column(DateTime, default=utcnow, onupdate=utcnow)

    def to_dict(self) -> dict[str, Any]:
        return {
            "id": self.id,
            "name": self.name,
            "shortName": self.short_name,
            "code": self.code,
            "contactPerson": self.contact_person,
            "contactPhone": self.contact_phone,
            "address": self.address,
            "description": self.description,
            "status": self.status,
            "isDel": self.is_del,
            "createdAt": self.created_at.isoformat() if self.created_at else None,
            "updatedAt": self.updated_at.isoformat() if self.updated_at else None,
        }
