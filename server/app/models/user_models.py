"""
User models (from zhs_center_project).

Merged from P1 (ZhsUser), P2 (Users), and P3 (User).
"""

from sqlalchemy import BigInteger, Column, DateTime, Index, Integer, String, Text, func

from app.database import Base
from app.models.base import SoftDeleteMixin, TimestampMixin, id_column
from app.orm.tenant_base import TenantBase


class User(TenantBase):
    """Central user account table (zhs_center_project.users).

    建议 132: 第二个迁移到 TenantBase 的业务表 (核心用户表).
    """

    __abstract__ = False  # SQLAlchemy 1.x 必须
    __tablename__ = "users"
    # 透明化: 用 __tenant_schema__ 替代手写 "schema"
    __tenant_schema__ = "public"
    __table_args__ = (
        Index("ix_users_status", "status"),
        Index("ix_users_parent_id", "parent_id"),
        {},
    )

    uuid = Column(String(64), primary_key=True, comment="User UUID")
    phone = Column(String(32), nullable=True, comment="手机号")
    password_hash = Column(String(255), nullable=True, comment="BCrypt hashed password")
    password_salt = Column(String(64), nullable=True, comment="Password salt")
    nickname = Column(String(100), nullable=True, comment="Nickname")
    avatar = Column(String(500), nullable=True, comment="Avatar URL")
    gender = Column(Integer, default=0, comment="Gender: 0=unknown, 1=male, 2=female")
    birthday = Column(DateTime, nullable=True, comment="Birthday")
    status = Column(Integer, default=1, comment="Status: 0=disabled, 1=active")
    invite_code = Column(String(32), unique=True, nullable=True, comment="Invitation code")
    parent_id = Column(String(64), nullable=True, comment="Parent user UUID (referral)")
    created_at = Column(DateTime, default=func.now(), comment="Created")
    updated_at = Column(DateTime, default=func.now(), onupdate=func.now(), comment="Updated")
    is_vip = Column(Integer, default=0, comment="VIP status: 0=no, 1=yes")


class UserMargin(TenantBase, TimestampMixin):
    """User token/margin balance (zhs_center_project.user_margin).

    建议 132: 第二个迁移到 TenantBase 的业务表.
    """

    __abstract__ = False
    __tablename__ = "user_margin"
    __tenant_schema__ = "public"
    __table_args__ = ({},)

    user_uuid = Column(String(64), primary_key=True, comment="User UUID")
    token_quantity = Column(BigInteger, default=0, comment="Token balance")


class UserAuthInfo(TimestampMixin, Base):
    """User authentication info (zhs_center_project.user_auth_info)."""

    __tablename__ = "user_auth_info"

    user_uuid = Column(String(64), primary_key=True, comment="User UUID")
    phone = Column(String(20), nullable=True, comment="Phone number")
    cancel_phone = Column(String(20), nullable=True, comment="Cancelled phone number")


class UserThirdPartyAccount(TimestampMixin, SoftDeleteMixin, Base):
    """Third-party account bindings (zhs_center_project.user_third_party_accounts)."""

    __tablename__ = "user_third_party_accounts"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_uuid = Column(String(64), nullable=False, comment="User UUID")
    open_id = Column(String(100), nullable=True, comment="Open ID")
    union_id = Column(String(100), nullable=True, comment="Union ID")
    platform = Column(String(20), nullable=True, comment="Platform: wechat, google, alipay, feishu")
    access_token = Column(Text, nullable=True, comment="Access token")
    refresh_token = Column(Text, nullable=True, comment="Refresh token")
    expire_time = Column(DateTime, nullable=True, comment="Token expiry")


class VipLevel(TimestampMixin, Base):
    """VIP level definitions (zhs_center_project.vip_level)."""

    __tablename__ = "vip_level"
    __table_args__ = (Index("ix_vip_level_status", "status"),)

    id = Column(Integer, primary_key=True, autoincrement=True, comment="VIP level ID")
    level_name = Column(String(50), nullable=False, comment="Level name, e.g. Bronze/Silver/Gold")
    level_value = Column(Integer, default=1, comment="Level numeric value (1, 2, 3 ...)")
    price = Column(BigInteger, default=0, comment="Price in cents")
    duration_days = Column(Integer, default=30, comment="Subscription duration in days")
    benefits = Column(Text, nullable=True, comment="JSON text describing benefits")
    status = Column(Integer, default=1, comment="Status: 0=disabled, 1=active")
    sort_order = Column(Integer, default=0, comment="Display sort order")
    created_at = Column(DateTime, server_default=func.now(), comment="Created")
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now(), comment="Updated")


class UserVip(TimestampMixin, Base):
    """User VIP subscription record (zhs_center_project.user_vip)."""

    __tablename__ = "user_vip"
    __table_args__ = (Index("ix_user_vip_status", "status"),)

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_uuid = Column(String(64), nullable=False, index=True, comment="User UUID")
    vip_level_id = Column(Integer, nullable=False, comment="FK -> vip_level.id")
    level_value = Column(Integer, default=1, comment="Snapshot of level value at subscription time")
    start_time = Column(DateTime, nullable=True, comment="VIP effective start time")
    end_time = Column(DateTime, nullable=True, comment="VIP expiration time")
    status = Column(Integer, default=1, comment="Status: 0=expired, 1=active")
    order_id = Column(String(64), nullable=True, comment="Related order ID")
    created_at = Column(DateTime, server_default=func.now(), comment="Created")
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now(), comment="Updated")


class UserAgentFreeTime(TimestampMixin, Base):
    """User agent free usage count (zhs_ai_project.zhs_user_agent_free_time)."""

    __tablename__ = "zhs_user_agent_free_time"

    id = id_column(comment="ID")
    user_uuid = Column(String(64), nullable=False, comment="User UUID")
    agent_id = Column(String(64), nullable=True, comment="Agent ID")
    free_count = Column(Integer, default=0, comment="Free usage count remaining")
    used_count = Column(Integer, default=0, comment="Free usage count used")
    expire_time = Column(DateTime, nullable=True, comment="Expiration time")
