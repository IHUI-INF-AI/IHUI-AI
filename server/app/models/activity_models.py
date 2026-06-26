"""
Activity and agent purchase models (from zhs_ai_project).
"""

from sqlalchemy import BigInteger, Column, DateTime, Float, Index, Integer, SmallInteger, String, Text, func

from app.database import Base
from app.models.base import TimestampMixin, id_column


class Activity(TimestampMixin, Base):
    """Promotional activity (zhs_ai_project.zhs_activity)."""

    __tablename__ = "zhs_activity"
    __table_args__ = (Index("ix_zhs_activity_status", "status"), {"extend_existing": True})  # noqa: RUF012

    id = Column(String(64), primary_key=True, nullable=False, comment="UUID")
    activity_name = Column(String(255), nullable=True, comment="Activity name")
    activity_rule = Column(Text, nullable=True, comment="Rules description")
    activity_recharge = Column(Text, nullable=True, comment="Recharge instructions")
    multiple = Column(Integer, nullable=True, comment="Recharge multiplier")
    computing = Column(BigInteger, nullable=True, comment="Amount per yuan")
    begin_time = Column(DateTime, nullable=True, comment="Start time")
    end_time = Column(DateTime, nullable=True, comment="End time")
    status = Column(SmallInteger, nullable=True, comment="0=off, 1=on")
    begin_amount = Column(Integer, nullable=True, comment="Minimum recharge amount")
    creator = Column(String(255), nullable=True, comment="Creator")
    updator = Column(String(255), nullable=True, comment="Updater")


class AgentBuy(TimestampMixin, Base):
    """Agent purchase record (zhs_ai_project.zhs_agent_buy).

    Settlement field: 0=unpaid, 1=paid (not settlement-confirmed).
    Status field: 0=active, 1=expired.
    """

    __tablename__ = "zhs_agent_buy"
    __table_args__ = (
        Index("ix_zhs_agent_buy_status", "status"),
        {
            # 建议 108: 多租户阶段 2, schema 占位 (默认 public, 多租户模式时动态改为 tenant_{tid})
            "schema": "public",
            "extend_existing": True,  # 与 small_models.ZhsAgentBuy 共享同一张表
        },
    )

    id = id_column(comment="ID")
    agent_order_uuid = Column(String(64), nullable=True, comment="Developer UUID (agent owner)")
    order_no = Column(String(64), nullable=True, comment="Order number (WXAT prefix)")
    bug_uuid = Column(String(64), nullable=True, comment="Buyer UUID")
    bug_name = Column(String(100), nullable=True, comment="Buyer display name")
    agent_id = Column(String(64), nullable=True, comment="Agent ID")
    agent_name = Column(String(200), nullable=True, comment="Agent name")
    category_id = Column(String(64), nullable=True, comment="Category config ID")
    discount = Column(BigInteger, nullable=True, comment="Discount e.g. 80=8折 (out of 100)")
    real_price = Column(BigInteger, nullable=True, comment="Actual price after discount in cents (fen)")
    price = Column(BigInteger, nullable=True, comment="List price from category config (account) in cents")
    count = Column(BigInteger, default=1, comment="Purchase count (months)")
    bug_time = Column(DateTime, nullable=True, comment="Purchase time")
    expiration_date = Column(DateTime, nullable=True, comment="Expiration date")
    status = Column(String(10), default="0", comment="0=active, 1=expired")
    settlement = Column(String(10), default="0", comment="0=unpaid, 1=paid")
    prologue = Column(Text, nullable=True, comment="Prologue text")
    settlement_time = Column(DateTime, nullable=True, comment="Settlement time")
    issue_no = Column(Integer, nullable=True, comment="Issue number")


class AgentCategory(TimestampMixin, Base):
    """Agent pricing/configuration (zhs_ai_project.zhs_agent_category)."""

    __tablename__ = "zhs_agent_category"
    __table_args__ = {"extend_existing": True}  # noqa: RUF012  # 与 small_models.ZhsAgentCategory 共享同一张表

    id = id_column(comment="ID")
    agent_id = Column(String(64), nullable=True, comment="Agent ID")
    group = Column(Integer, default=2, comment="Visibility: 1=members, 2=all")
    type = Column(String(10), default="1", comment="1=free, 2=limited-free, 3=paid")
    type_child = Column(String(10), default="1", comment="1=monthly, 2=yearly, 3=permanent")
    limit_free = Column(String(10), nullable=True, comment="Free duration code")
    account = Column(Integer, default=0, comment="Price in cents")
    create_time = Column(DateTime, nullable=True, comment="Creation time")


class AgentExamine(TimestampMixin, Base):
    """Agent review/examination (zhs_ai_project.zhs_agent_examine).

    Status values (aligned with Java):
      0=pending, 1=examining, 2=approved/published,
      3=rejected(to coze), 4=rejected(platform internal), 5=delisted
    """

    __tablename__ = "zhs_agent_examine"
    __table_args__ = (Index("ix_zhs_agent_examine_status", "status"),)

    id = id_column(comment="ID")
    agent_id = Column(String(64), nullable=False, comment="Agent ID (botId)")
    agent_name = Column(String(200), nullable=True, comment="Agent name")
    category_id = Column(String(64), nullable=True, comment="Pricing category config ID")
    status = Column(
        BigInteger,
        default=0,
        comment="0=pending 1=examining 2=approved 3=rejected(coze) 4=rejected(platform) 5=delisted",
    )
    start_time = Column(DateTime, nullable=True, comment="Submit time")
    start_user = Column(String(64), nullable=True, comment="Submitter UUID")
    start_phone = Column(String(32), nullable=True, comment="Submitter phone")
    start_name = Column(String(100), nullable=True, comment="Submitter name")
    examine_user = Column(String(64), nullable=True, comment="Reviewer name")
    examine_user_id = Column(String(64), nullable=True, comment="Reviewer ID")
    examine_time = Column(DateTime, nullable=True, comment="Review time")
    desc = Column(Text, nullable=True, comment="Review remarks / pass/reject reason")
    follow = Column(Text, nullable=True, comment="Review flow audit trail")
    agent_avatar = Column(String(500), nullable=True, comment="Agent avatar URL")
    prologue = Column(Text, nullable=True, comment="Agent prologue text")


class AgentDeveloper(TimestampMixin, Base):
    """Agent developer relationship (zhs_ai_project.zhs_agent_developer)."""

    __tablename__ = "zhs_agent_developer"
    __table_args__ = (
        Index("ix_zhs_agent_developer_user_id", "user_id"),
        Index("ix_zhs_agent_developer_status", "status"),
    )

    id = id_column(comment="ID")
    agent_id = Column(String(64), nullable=False, comment="Agent ID")
    user_id = Column(String(64), nullable=False, comment="Developer UUID")
    order_no = Column(String(64), nullable=True, comment="Developer order number")
    status = Column(Integer, default=1, comment="0=disabled, 1=active")
    price = Column(Float, nullable=True, comment="Developer price")
    uuid = Column(String(64), nullable=True, comment="开发者唯一标识 UUID")
    user_name = Column(String(100), nullable=True, comment="用户名")
    creator_id = Column(BigInteger, nullable=True, comment="创建者用户 ID")
    creator_name = Column(String(100), nullable=True, comment="创建者用户名")
    bug_time = Column(DateTime, nullable=True, comment="购买时间 (历史字段名 bug_time, 语义为 buy_time)")
    type = Column(String(20), nullable=True, comment="开发者类型 (如 month/year 等)")
    count = Column(Integer, nullable=True, comment="数量 (如购买月数)")
    expiration_date = Column(DateTime, nullable=True, comment="到期时间")


class DeveloperLink(TimestampMixin, Base):
    """Developer-Coze account link (zhs_ai_project.zhs_developer_link)."""

    __tablename__ = "zhs_developer_link"
    __table_args__ = (
        Index("ix_zhs_developer_link_user_id", "user_id"),
        Index("ix_zhs_developer_link_status", "status"),
    )

    id = id_column(comment="ID")
    user_id = Column(String(64), nullable=False, comment="Developer UUID")
    coze_account_id = Column(String(64), nullable=True, comment="Coze account ID")
    coze_account_name = Column(String(200), nullable=True, comment="Coze account name")
    status = Column(Integer, default=1, comment="0=disabled, 1=active")


class ZhsUserModelChat(TimestampMixin, Base):
    """User model chat record (zhs_ai_project.zhs_user_model_chat)."""

    __tablename__ = "zhs_user_model_chat"

    id = id_column(comment="ID")
    user_uuid = Column(String(64), nullable=False, index=True, comment="User UUID")
    model_name = Column(String(100), nullable=False, comment="Model name")
    mark = Column(String(500), nullable=True, comment="Chat summary/label")
    create_time = Column(DateTime, server_default=func.now(), comment="Created time")


class AiModelInfo(TimestampMixin, Base):
    """Available AI model info (zhs_ai_project.zhs_ai_model_info)."""

    __tablename__ = "zhs_ai_model_info"
    __table_args__ = (Index("ix_zhs_ai_model_info_status", "status"),)

    id = id_column(comment="ID")
    name = Column(String(100), unique=True, nullable=False, comment="Model name")
    source = Column(String(100), nullable=True, comment="Source/provider")
    icon = Column(String(500), nullable=True, comment="Icon URL")
    description = Column(Text, nullable=True, comment="Description")
    status = Column(Integer, default=1, comment="0=disabled, 1=active")
    sort = Column(Integer, default=0, comment="Sort order")
