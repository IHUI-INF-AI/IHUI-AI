"""
App content models (P2 Admin ai_* tables -> zhs_ai_project).
"""

from sqlalchemy import BigInteger, Column, DateTime, Float, Index, Integer, String, Text

from app.database import Base
from app.models.base import TimestampMixin, id_column


class AiAboutUs(TimestampMixin, Base):
    __tablename__ = "ai_about_us"
    __table_args__ = (Index("ix_ai_about_us_status", "status"), {"extend_existing": True})  # noqa: RUF012

    id = id_column(comment="ID")
    title = Column(String(200), nullable=True)
    content = Column(Text, nullable=True)
    status = Column(Integer, default=1)
    sort = Column(Integer, default=0)
    creator = Column(String(64), nullable=True)


class AiContact(TimestampMixin, Base):
    __tablename__ = "ai_contact"
    __table_args__ = (Index("ix_ai_contact_status", "status"), {"extend_existing": True})  # noqa: RUF012

    id = id_column(comment="ID")
    name = Column(String(100), nullable=True)
    phone = Column(String(20), nullable=True)
    email = Column(String(100), nullable=True)
    content = Column(Text, nullable=True)
    status = Column(Integer, default=0)
    title = Column(String(200), nullable=True)
    sort_order = Column(Integer, default=0)
    remark = Column(String(500), nullable=True)


class AiNews(TimestampMixin, Base):
    __tablename__ = "ai_news"
    __table_args__ = (Index("ix_ai_news_status", "status"),)

    id = id_column(comment="ID")
    title = Column(String(300), nullable=False)
    subtitle = Column(String(500), nullable=True)
    content = Column(Text, nullable=True)
    cover_image = Column(String(500), nullable=True)
    author = Column(String(100), nullable=True)
    category = Column(String(50), nullable=True)
    view_count = Column(BigInteger, default=0)
    status = Column(Integer, default=1)
    publish_time = Column(DateTime, nullable=True)
    sort = Column(Integer, default=0)


class AiFileStorage(TimestampMixin, Base):
    __tablename__ = "ai_file_storage"
    __table_args__ = (Index("ix_ai_file_storage_status", "status"),)

    id = id_column(comment="ID")
    file_name = Column(String(255), nullable=True)
    file_path = Column(String(500), nullable=True)
    file_size = Column(BigInteger, nullable=True)
    file_type = Column(String(50), nullable=True)
    bucket = Column(String(100), nullable=True)
    user_uuid = Column(String(64), nullable=True)
    status = Column(Integer, default=1)


class BannerCarousel(TimestampMixin, Base):
    __tablename__ = "zhs_banner_carousel"
    __table_args__ = (Index("ix_zhs_banner_carousel_status", "status"), {"extend_existing": True})  # noqa: RUF012

    id = id_column(comment="ID")
    title = Column(String(200), nullable=True)
    image_url = Column(String(500), nullable=True)
    link_url = Column(String(500), nullable=True)
    position = Column(String(50), nullable=True)
    status = Column(Integer, default=1)
    sort = Column(Integer, default=0)
    # 兼容 API 端使用的字段名
    is_active = Column(Integer, default=1)
    sort_order = Column(Integer, default=0)


class Information(TimestampMixin, Base):
    __tablename__ = "zhs_information"
    __table_args__ = (Index("ix_zhs_information_status", "status"),)

    id = id_column(comment="ID")
    title = Column(String(300), nullable=True)
    content = Column(Text, nullable=True)
    type = Column(Integer, nullable=True)
    status = Column(Integer, default=1)
    sort = Column(Integer, default=0)


class AppVersion(TimestampMixin, Base):
    __tablename__ = "app_version"
    __table_args__ = (Index("ix_app_version_status", "status"), {"extend_existing": True})  # noqa: RUF012

    id = id_column(comment="ID")
    version_code = Column(String(50), nullable=True)
    version_name = Column(String(50), nullable=True)
    version = Column(String(20), nullable=True, comment="版本号 (兼容)")
    build = Column(Integer, default=1, comment="构建号 (兼容)")
    title = Column(String(200), nullable=True, comment="更新标题 (兼容)")
    content = Column(Text, nullable=True, comment="更新内容 (兼容)")
    download_url = Column(String(500), nullable=True)
    description = Column(Text, nullable=True)
    platform = Column(String(20), nullable=True)
    force_update = Column(Integer, default=0)
    is_force = Column(Integer, default=0, comment="强制更新 (兼容)")
    is_silent = Column(Integer, default=0, comment="静默更新 (兼容)")
    min_version = Column(String(20), nullable=True, comment="最低支持版本 (兼容)")
    gray_ratio = Column(Integer, default=0, comment="灰度比例 (兼容)")
    file_size = Column(Integer, default=0, comment="包大小 (兼容)")
    md5 = Column(String(50), nullable=True, comment="MD5 (兼容)")
    status = Column(Integer, default=1)


class AiUserFeedback(TimestampMixin, Base):
    __tablename__ = "ai_user_feedback"
    __table_args__ = (Index("ix_ai_user_feedback_status", "status"),)

    id = id_column(comment="ID")
    user_uuid = Column(String(64), nullable=True)
    content = Column(Text, nullable=True)
    images = Column(Text, nullable=True)
    type = Column(String(50), nullable=True)
    status = Column(Integer, default=0)
    reply = Column(Text, nullable=True)
    reply_time = Column(DateTime, nullable=True)


class ProductIdentity(TimestampMixin, Base):
    __tablename__ = "zhs_product_identity"
    __table_args__ = (Index("ix_zhs_product_identity_status", "status"),)

    id = Column(String(64), primary_key=True)
    name = Column(String(200), nullable=True)
    description = Column(Text, nullable=True)
    price = Column(BigInteger, nullable=True)
    token_amount = Column(BigInteger, nullable=True)
    identity_type = Column(String(50), nullable=True)
    duration_days = Column(Integer, nullable=True)
    status = Column(Integer, default=1)
    sort = Column(Integer, default=0)


class CategoryDictionary(TimestampMixin, Base):
    __tablename__ = "zhs_category_dictionary"
    __table_args__ = (
        Index("ix_zhs_category_dictionary_parent_id", "parent_id"),
        Index("ix_zhs_category_dictionary_status", "status"),
    )

    id = id_column(comment="ID")
    name = Column(String(100), nullable=True)
    code = Column(String(50), nullable=True)
    parent_id = Column(BigInteger, default=0)
    type = Column(String(50), nullable=True)
    status = Column(Integer, default=1)
    sort = Column(Integer, default=0)


class ZhsProduct(TimestampMixin, Base):
    __tablename__ = "zhs_product"
    __table_args__ = (Index("ix_zhs_product_status", "status"), {"extend_existing": True})  # noqa: RUF012

    id = Column(String(64), primary_key=True)
    name = Column(String(200), nullable=True)
    price = Column(BigInteger, nullable=True)
    token_amount = Column(BigInteger, nullable=True)
    type = Column(String(50), nullable=True)
    status = Column(Integer, default=1)
    sort = Column(Integer, default=0)


class ExchangeRate(TimestampMixin, Base):
    """Exchange rate table (zhs_ai_project.exchange_rate)."""

    __tablename__ = "exchange_rate"
    __table_args__ = (Index("ix_exchange_rate_status", "status"),)

    id = id_column(comment="ID")
    currency_code = Column(String(20), nullable=True, comment="Currency code e.g. USD")
    currency_name = Column(String(50), nullable=True, comment="Currency name")
    rate = Column(Float, nullable=True, comment="Exchange rate to CNY")
    status = Column(Integer, default=1, comment="0=disabled, 1=active")
    sort = Column(Integer, default=0)


class KnowledgePlanet(TimestampMixin, Base):
    """Knowledge planet (zhs_ai_project.zhs_knowledge_planet)."""

    __tablename__ = "zhs_knowledge_planet"
    __table_args__ = (Index("ix_zhs_knowledge_planet_status", "status"),)

    id = id_column(comment="ID")
    name = Column(String(200), nullable=True, comment="Planet name")
    description = Column(Text, nullable=True, comment="Description")
    cover = Column(String(500), nullable=True, comment="Cover image URL")
    price = Column(BigInteger, nullable=True, comment="Price in cents")
    type = Column(String(50), nullable=True, comment="Planet type: course/knowledge")
    status = Column(Integer, default=1, comment="0=disabled, 1=active")
    sort = Column(Integer, default=0)
    creator = Column(String(64), nullable=True, comment="Creator UUID")


class AppContent(TimestampMixin, Base):
    """App content management (zhs_ai_project.app_content)."""

    __tablename__ = "app_content"
    __table_args__ = (Index("ix_app_content_status", "status"),)

    id = id_column(comment="ID")
    title = Column(String(200), nullable=True)
    image_url = Column(String(500), nullable=True)
    link_url = Column(String(500), nullable=True)
    type = Column(String(50), nullable=True, comment="Content type: banner/notice/etc")
    status = Column(Integer, default=1)
    sort = Column(Integer, default=0)
