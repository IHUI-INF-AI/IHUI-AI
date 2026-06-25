"""Resource extended models for Java resource service migration.

Tables migrated from H:\\ihui-ai-edu-resource-service:
  - resource (扩展自 zhs_ai_project.resource, 已存在于 resource_models.py)
  - resource_tag
  - resource_product
  - resource_category
  - resource_download (下载记录)
  - resource_search_record (搜索记录)
  - resource_tag_relation (资源-标签关联)
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
    String,
    Text,
    func,
)

from app.database import Base
from app.models.base import TimestampMixin, id_column


class ResourceTag(TimestampMixin, Base):
    """Resource tag (resource.tag)."""

    __tablename__ = "resource_tag"
    __table_args__ = (Index("ix_resource_tag_status", "status"),)

    id = id_column(comment="Tag ID")
    name = Column(String(100), nullable=False, comment="Tag name")
    sort_order = Column(Integer, default=0, comment="Sort order")
    status = Column(Boolean, default=True, comment="0=disabled, 1=active")


class ResourceProduct(TimestampMixin, Base):
    """Resource product (resource.product)."""

    __tablename__ = "resource_product"
    __table_args__ = (Index("ix_resource_product_status", "status"),)

    id = id_column(comment="Product ID")
    name = Column(String(200), nullable=False, comment="Product name")
    description = Column(Text, nullable=True, comment="Product description")
    price = Column(Float, default=0.0, comment="Product price")
    sort_order = Column(Integer, default=0, comment="Sort order")
    status = Column(Boolean, default=True, comment="0=disabled, 1=active")


class ResourceCategory(TimestampMixin, Base):
    """Resource category (resource.category)."""

    __tablename__ = "resource_category"
    __table_args__ = (
        Index("ix_resource_category_status", "status"),
        Index("ix_resource_category_parent_id", "parent_id"),
    )

    id = id_column(comment="Category ID")
    name = Column(String(100), nullable=False, comment="Category name")
    parent_id = Column(BigInteger, nullable=True, comment="Parent category ID (for tree)")
    icon = Column(String(500), nullable=True, comment="Category icon URL")
    image = Column(String(500), nullable=True, comment="Category image URL")
    sort_order = Column(Integer, default=0, comment="Sort order")
    is_show = Column(Boolean, default=True, comment="Show in list")
    is_show_index = Column(Boolean, default=False, comment="Show on home")
    status = Column(Integer, default=1, comment="0=disabled, 1=active")


class ResourceDownload(TimestampMixin, Base):
    """Resource download record (resource.download)."""

    __tablename__ = "resource_download"
    __table_args__ = (Index("ix_resource_download_member_id", "member_id"),)

    id = id_column(comment="Download record ID")
    resource_id = Column(BigInteger, nullable=False, comment="Resource ID")
    member_id = Column(BigInteger, nullable=False, comment="Member ID")
    download_time = Column(DateTime, server_default=func.now(), comment="Download time")


class ResourceSearchRecord(TimestampMixin, Base):
    """Resource search keyword record (resource.search_record)."""

    __tablename__ = "resource_search_record"
    __table_args__ = (Index("ix_resource_search_record_member_id", "member_id"),)

    id = id_column(comment="Search record ID")
    member_id = Column(BigInteger, nullable=False, comment="Member ID")
    keyword = Column(String(500), nullable=False, comment="Search keyword")
    search_time = Column(DateTime, server_default=func.now(), comment="Search time")
