"""Identity, organization, system utility and OAuth key models."""

from sqlalchemy import BigInteger, Column, DateTime, Index, Integer, String, Text, func

from app.database import Base
from app.models.base import TimestampMixin, id_column


class ZhsIdentity(TimestampMixin, Base):
    """Identity/role type (zhs_educational_training.zhs_identity)."""

    __tablename__ = "zhs_identity"
    __table_args__ = (
        Index("ix_zhs_identity_status", "status"),
        {
            # 建议 113: 阶段 2 业务表 schema 改造 (第 2 批)
            "schema": "public",
        },
    )

    id = id_column(comment="ID")
    identity_name = Column(String(100), nullable=False, comment="Identity name")
    identity_type = Column(String(50), nullable=True, comment="Identity type")
    status = Column(Integer, default=1, comment="0=disabled, 1=active")
    create_time = Column(DateTime, server_default=func.now(), comment="Creation time")


class ZhsOrganization(TimestampMixin, Base):
    """Organization (zhs_educational_training.zhs_organization)."""

    __tablename__ = "zhs_organization"
    __table_args__ = (
        Index("ix_zhs_organization_parent_id", "parent_id"),
        Index("ix_zhs_organization_status", "status"),
    )

    id = id_column(comment="ID")
    org_name = Column(String(200), nullable=False, comment="Organization name")
    org_type = Column(String(50), nullable=True, comment="Organization type")
    parent_id = Column(BigInteger, default=0, comment="Parent organization ID (0=root)")
    status = Column(Integer, default=1, comment="0=disabled, 1=active")
    create_time = Column(DateTime, server_default=func.now(), comment="Creation time")


class TboxBean(TimestampMixin, Base):
    """Tbox system bean/config (zhs_ai_project.tbox_bean)."""

    __tablename__ = "tbox_bean"
    __table_args__ = (Index("ix_tbox_bean_status", "status"),)

    id = id_column(comment="ID")
    bean_type = Column(String(50), nullable=True, comment="Bean type")
    bean_data = Column(Text, nullable=True, comment="Bean data JSON")
    status = Column(Integer, default=1, comment="0=disabled, 1=active")
    create_time = Column(DateTime, server_default=func.now(), comment="Creation time")


class SysUserPost(TimestampMixin, Base):
    """User-post relationship (zhs_ai_project.admin_user_post)."""

    __tablename__ = "admin_user_post"

    user_id = Column(BigInteger, primary_key=True, comment="User ID")
    post_id = Column(BigInteger, primary_key=True, comment="Post ID")


class OAuthPrivateKey(TimestampMixin, Base):
    """OAuth private key (zhs_center_project.oauth_private_keys)."""

    __tablename__ = "oauth_private_keys"
    __table_args__ = (Index("ix_oauth_private_keys_status", "status"),)

    id = id_column(comment="ID")
    app_id = Column(String(64), nullable=False, comment="OAuth app ID")
    key_type = Column(String(32), default="rsa", comment="Key type: rsa/ec/hmac")
    key_data = Column(Text, nullable=False, comment="Private key data")
    status = Column(Integer, default=1, comment="0=disabled, 1=active")
    create_time = Column(DateTime, server_default=func.now(), comment="Creation time")
