"""Resource, dictionary, exchange rate and official information models."""

from sqlalchemy import BigInteger, Column, DateTime, Float, Index, Integer, String, Text, func

from app.database import Base
from app.models.base import TimestampMixin, id_column


class Resource(TimestampMixin, Base):
    """Resource record (zhs_ai_project.resource)."""

    __tablename__ = "resource"
    __table_args__ = (Index("ix_resource_status", "status"),)

    id = id_column(comment="ID")
    resource_name = Column(String(200), nullable=True, comment="Resource name")
    resource_type = Column(String(50), nullable=True, comment="Resource type")
    resource_url = Column(String(500), nullable=True, comment="Resource URL")
    status = Column(Integer, default=1, comment="0=disabled, 1=active")
    create_time = Column(DateTime, server_default=func.now(), comment="Creation time")


class PopularCourse(TimestampMixin, Base):
    """Popular course recommendation (zhs_ai_project.zhs_popular_courses)."""

    __tablename__ = "zhs_popular_courses"
    __table_args__ = (Index("ix_zhs_popular_courses_status", "status"),)

    id = id_column(comment="ID")
    course_id = Column(BigInteger, nullable=False, comment="Course ID")
    sort_order = Column(Integer, default=0, comment="Sort order")
    status = Column(Integer, default=1, comment="0=disabled, 1=active")
    create_time = Column(DateTime, server_default=func.now(), comment="Creation time")


class ZhsExchangeRate(TimestampMixin, Base):
    """Exchange rate (zhs_ai_project.zhs_exchange_rate)."""

    __tablename__ = "zhs_exchange_rate"
    __table_args__ = (Index("ix_zhs_exchange_rate_status", "status"),)

    id = id_column(comment="ID")
    from_currency = Column(String(20), nullable=False, comment="Source currency code")
    to_currency = Column(String(20), nullable=False, comment="Target currency code")
    rate = Column(Float, nullable=False, comment="Exchange rate")
    status = Column(Integer, default=1, comment="0=disabled, 1=active")
    create_time = Column(DateTime, server_default=func.now(), comment="Creation time")


class OfficialInformation(TimestampMixin, Base):
    """Official information/announcement (zhs_ai_project.zhs_official_information)."""

    __tablename__ = "zhs_official_information"
    __table_args__ = (Index("ix_zhs_official_information_status", "status"),)

    id = id_column(comment="ID")
    title = Column(String(300), nullable=True, comment="Title")
    content = Column(Text, nullable=True, comment="Content")
    type = Column(String(50), nullable=True, comment="Information type")
    status = Column(Integer, default=1, comment="0=disabled, 1=active")
    create_time = Column(DateTime, server_default=func.now(), comment="Creation time")


class ZhsResources(TimestampMixin, Base):
    """Platform resource (zhs_ai_project.zhs_resources)."""

    __tablename__ = "zhs_resources"
    __table_args__ = (Index("ix_zhs_resources_status", "status"),)

    id = id_column(comment="ID")
    resource_name = Column(String(200), nullable=True, comment="Resource name")
    resource_type = Column(String(50), nullable=True, comment="Resource type")
    resource_url = Column(String(500), nullable=True, comment="Resource URL")
    status = Column(Integer, default=1, comment="0=disabled, 1=active")
    create_time = Column(DateTime, server_default=func.now(), comment="Creation time")
