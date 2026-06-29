"""资讯文章数据模型 (迁移自历史项目)"""

from sqlalchemy import (
    BigInteger,
    Boolean,
    Column,
    Index,
    String,
    Text,
)

from app.database import Base
from app.models.base import TimestampMixin, id_column


class News(TimestampMixin, Base):
    """新闻 (历史 t_news)"""

    __tablename__ = "t_news"
    __table_args__ = (
        Index("idx_news_status", "status"),
        Index("idx_news_user_id", "user_id"),
    )

    id = id_column(comment="主键id")
    title = Column(String(100), nullable=False, comment="标题")
    type = Column(String(100), nullable=False, comment="类型")
    user_id = Column(BigInteger, nullable=False, comment="用户id")
    content = Column(Text, nullable=False, comment="内容")
    image = Column(String(3000), nullable=True, comment="海报图片")
    tags = Column(String(3000), nullable=True, comment="标签")
    keywords = Column(String(3000), nullable=True, comment="关键字")
    status = Column(String(100), nullable=False, comment="状态")
    recommend = Column(Boolean, nullable=False, default=False, comment="推荐")
    top = Column(Boolean, nullable=False, default=False, comment="置顶")
    description = Column(String(3000), nullable=False, default="", comment="简介")


class Article(TimestampMixin, Base):
    """文章 (历史 t_article)"""

    __tablename__ = "t_article"
    __table_args__ = (
        Index("idx_article_status", "status"),
        Index("idx_article_member_id", "member_id"),
    )

    id = id_column(comment="主键id")
    title = Column(String(100), nullable=False, comment="标题")
    member_id = Column(BigInteger, nullable=False, comment="用户id")
    content = Column(Text, nullable=False, comment="内容")
    image = Column(String(3000), nullable=True, comment="海报图片")
    tags = Column(String(3000), nullable=True, comment="标签")
    keywords = Column(String(3000), nullable=True, comment="关键字")
    status = Column(String(100), nullable=False, comment="状态")
    introduction = Column(String(200), nullable=False, default="", comment="描述")
    recommend = Column(Boolean, nullable=False, default=False, comment="推荐")
    top = Column(Boolean, nullable=False, default=False, comment="置顶")
