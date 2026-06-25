"""Article, InvoiceApplication models for Java migration.

Tables migrated from H:\\ihui-ai-edu-content-service (Article) and
H:\\ihui-ai-edu-order-service (InvoiceApplication).
"""
from __future__ import annotations

from sqlalchemy import (
    BigInteger,
    Boolean,
    Column,
    DateTime,
    Float,
    Index,
    Integer,
    Numeric,
    String,
    Text,
    func,
)

from app.database import Base
from app.models.base import TimestampMixin, id_column


class Article(TimestampMixin, Base):
    """Article (content.article)."""

    __tablename__ = "article"
    __table_args__ = (
        Index("ix_article_status", "status"),
        Index("ix_article_member_id", "member_id"),
    )

    id = id_column(comment="Article ID")
    member_id = Column(BigInteger, nullable=True, comment="Author member ID")
    title = Column(String(200), nullable=False, comment="Title")
    content = Column(Text, nullable=True, comment="Content")
    summary = Column(String(500), nullable=True, comment="Summary")
    cover = Column(String(500), nullable=True, comment="Cover image")
    status = Column(Integer, default=0, comment="0=draft, 1=published, 2=hidden")
    is_recommend = Column(Boolean, default=False, comment="Recommend flag")
    is_top = Column(Boolean, default=False, comment="Top flag")
    view_count = Column(Integer, default=0, comment="View count")
    like_count = Column(Integer, default=0, comment="Like count")
    comment_count = Column(Integer, default=0, comment="Comment count")
    sort_order = Column(Integer, default=0, comment="Sort order")


class InvoiceApplication(TimestampMixin, Base):
    """Invoice application (order.invoice_application)."""

    __tablename__ = "invoice_application"
    __table_args__ = (
        Index("ix_invoice_application_user_id", "user_id"),
        Index("ix_invoice_application_status", "status"),
    )

    # Status: 0=pending, 1=approved, 2=rejected, 3=invoicing, 4=invoiced, 5=canceled
    id = id_column(comment="Invoice application ID")
    user_id = Column(BigInteger, nullable=True, comment="Applicant user ID")
    order_id = Column(BigInteger, nullable=True, comment="Related order ID")
    invoice_type = Column(String(20), nullable=True, comment="PERSONAL/COMPANY")
    title = Column(String(200), nullable=True, comment="Invoice title")
    tax_no = Column(String(50), nullable=True, comment="Tax number")
    amount = Column(Numeric(10, 2), default=0, comment="Invoice amount")
    email = Column(String(100), nullable=True, comment="Recipient email")
    phone = Column(String(20), nullable=True, comment="Recipient phone")
    address = Column(String(500), nullable=True, comment="Recipient address")
    bank_name = Column(String(100), nullable=True, comment="Bank name")
    bank_account = Column(String(50), nullable=True, comment="Bank account")
    remark = Column(Text, nullable=True, comment="Applicant remark")
    audit_remark = Column(Text, nullable=True, comment="Audit remark")
    status = Column(Integer, default=0, comment="0=pending, 1=approved, 2=rejected, 3=invoicing, 4=invoiced, 5=canceled")
