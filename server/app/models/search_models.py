"""
搜索功能数据模型 (迁移自 ihui-ai-edu-search-service)
"""

from sqlalchemy import (
    BigInteger,
    Boolean,
    Column,
    Index,
    Integer,
    String,
    Text,
)

from app.database import Base
from app.models.base import TimestampMixin, id_column


class SearchIndex(TimestampMixin, Base):
    """搜索索引 - 通用全文索引表"""

    __tablename__ = "search_index"
    __table_args__ = (
        Index("idx_si_target", "target_type", "target_id"),
        Index("idx_si_category", "category"),
        Index("idx_si_status", "status"),
        Index("ix_search_index_user_id", "user_id"),
    )

    id = id_column(comment="ID")
    target_type = Column(String(50), nullable=False, comment="agent/course/article/news/question/post等")
    target_id = Column(BigInteger, nullable=False, comment="目标ID")
    title = Column(String(500), nullable=False, comment="标题")
    content = Column(Text, nullable=True, comment="内容摘要")
    keywords = Column(String(500), nullable=True, comment="关键词(逗号分隔)")
    category = Column(String(100), nullable=True, comment="分类")
    tags = Column(String(500), nullable=True, comment="标签(逗号分隔)")
    cover = Column(String(500), nullable=True, comment="封面图")
    url = Column(String(500), nullable=True, comment="跳转URL")
    user_id = Column(String(64), nullable=True, comment="作者UUID")
    user_name = Column(String(100), nullable=True)
    weight = Column(Integer, default=0, comment="权重(用于排序)")
    view_num = Column(Integer, default=0)
    like_num = Column(Integer, default=0)
    comment_num = Column(Integer, default=0)
    status = Column(Integer, default=1, comment="0=下线 1=上线")
    is_top = Column(Boolean, default=False)
    is_essence = Column(Boolean, default=False)

class SearchHotKeyword(TimestampMixin, Base):
    """热搜词"""

    __tablename__ = "search_hot_keyword"
    __table_args__ = (
        Index("idx_shk_status", "status"),)

    id = id_column(comment="ID")
    keyword = Column(String(100), nullable=False, comment="搜索词")
    search_count = Column(Integer, default=0, comment="搜索次数")
    status = Column(Integer, default=1, comment="0=下线 1=上线")
    sort_order = Column(Integer, default=0)
    is_hot = Column(Boolean, default=False, comment="是否热门")

class SearchLog(TimestampMixin, Base):
    """搜索日志"""

    __tablename__ = "search_log"
    __table_args__ = (
        Index("idx_sl_user", "user_id"),
        Index("idx_sl_keyword", "keyword"),)

    id = id_column(comment="ID")
    user_id = Column(String(64), nullable=True)
    keyword = Column(String(200), nullable=False)
    target_type = Column(String(50), nullable=True)
    result_count = Column(Integer, default=0)
    ip = Column(String(50), nullable=True)
    user_agent = Column(String(500), nullable=True)
