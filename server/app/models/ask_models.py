"""
问答社区数据模型 (迁移自 ihui-ai-edu-ask-service)
"""

import uuid

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


def _uuid() -> str:
    return uuid.uuid4().hex


class AskCategory(TimestampMixin, Base):
    """问答分类(多级分类,pid=0 为顶级)"""

    __tablename__ = "ask_category"

    id = id_column(comment="ID")
    pid = Column(BigInteger, default=0, comment="父级分类ID,0为顶级")
    name = Column(String(100), nullable=False, comment="分类名称")
    sort_order = Column(Integer, default=0, comment="排序序号")
    is_show = Column(Boolean, default=True, comment="是否显示")
    is_show_index = Column(Boolean, default=False, comment="是否首页显示")
    image = Column(String(500), nullable=True, comment="分类图片")
    level = Column(Integer, default=1, comment="分类级别")


class AskQuestion(TimestampMixin, Base):
    """问题主表"""

    __tablename__ = "ask_question"
    __table_args__ = (
        Index("idx_ask_question_member", "member_id"),
        Index("idx_ask_question_status", "status"),
    )

    id = id_column(comment="ID")
    title = Column(String(200), nullable=False, comment="问题标题")
    content = Column(Text, nullable=False, comment="问题内容")
    image = Column(String(500), nullable=True, comment="题图URL")
    member_id = Column(String(64), nullable=False, comment="提问者UUID")
    member_name = Column(String(100), nullable=True, comment="提问者昵称")
    member_avatar = Column(String(500), nullable=True, comment="提问者头像")
    status = Column(String(20), default="published", comment="draft/published/closed")
    favorite_num = Column(Integer, default=0, comment="收藏数")
    like_num = Column(Integer, default=0, comment="点赞数")
    comment_num = Column(Integer, default=0, comment="评论数")
    watch_num = Column(Integer, default=0, comment="浏览数")
    answer_num = Column(Integer, default=0, comment="回答数")
    is_top = Column(Boolean, default=False, comment="是否置顶")
    is_essence = Column(Boolean, default=False, comment="是否精华")
    deleted = Column(Boolean, default=False, comment="逻辑删除")


class AskQuestionCategory(TimestampMixin, Base):
    """问题-分类多对多关联表"""

    __tablename__ = "ask_question_category"
    __table_args__ = (
        Index("idx_aqc_question", "question_id"),
        Index("idx_aqc_category", "category_id"),
    )

    id = id_column(comment="ID")
    question_id = Column(BigInteger, nullable=False, comment="问题ID")
    category_id = Column(BigInteger, nullable=False, comment="分类ID")


class AskAnswer(TimestampMixin, Base):
    """回答表"""

    __tablename__ = "ask_answer"
    __table_args__ = (
        Index("idx_ask_answer_question", "question_id"),
        Index("idx_ask_answer_member", "member_id"),
    )

    id = id_column(comment="ID")
    question_id = Column(BigInteger, nullable=False, comment="问题ID")
    content = Column(Text, nullable=False, comment="回答内容")
    member_id = Column(String(64), nullable=False, comment="回答者UUID")
    member_name = Column(String(100), nullable=True, comment="回答者昵称")
    member_avatar = Column(String(500), nullable=True, comment="回答者头像")
    favorite_num = Column(Integer, default=0, comment="收藏数")
    like_num = Column(Integer, default=0, comment="点赞数")
    comment_num = Column(Integer, default=0, comment="评论数")
    is_adopted = Column(Boolean, default=False, comment="是否被采纳")
    is_top = Column(Boolean, default=False, comment="是否置顶")
    deleted = Column(Boolean, default=False, comment="逻辑删除")


class AskLike(TimestampMixin, Base):
    """点赞表(通用:问题/回答)"""

    __tablename__ = "ask_like"
    __table_args__ = (Index("idx_ask_like_user", "user_id", "target_type", "target_id"),)

    id = id_column(comment="ID")
    user_id = Column(String(64), nullable=False, comment="用户UUID")
    target_type = Column(String(20), nullable=False, comment="question/answer")
    target_id = Column(BigInteger, nullable=False, comment="目标ID")
    is_like = Column(Boolean, default=True, comment="是否点赞")


class AskFavorite(TimestampMixin, Base):
    """收藏表"""

    __tablename__ = "ask_favorite"
    __table_args__ = (Index("idx_ask_fav_user", "user_id", "target_type", "target_id"),)

    id = id_column(comment="ID")
    user_id = Column(String(64), nullable=False, comment="用户UUID")
    target_type = Column(String(20), nullable=False, comment="question/answer")
    target_id = Column(BigInteger, nullable=False, comment="目标ID")


class AskComment(TimestampMixin, Base):
    """评论表(对问题/回答评论)"""

    __tablename__ = "ask_comment"
    __table_args__ = (
        Index("idx_ask_comment_target", "target_type", "target_id"),
        Index("ix_ask_comment_user_id", "user_id"),
    )

    id = id_column(comment="ID")
    target_type = Column(String(20), nullable=False, comment="question/answer")
    target_id = Column(BigInteger, nullable=False, comment="目标ID")
    user_id = Column(String(64), nullable=False, comment="评论者UUID")
    user_name = Column(String(100), nullable=True)
    content = Column(Text, nullable=False, comment="评论内容")
    pid = Column(BigInteger, default=0, comment="父评论ID")


class AskCategoryRelation(TimestampMixin, Base):
    """分类父子关系表（多级分类树）

    - 迁移自 H:\\edu client\\service\\service\\ihui-ai-edu-ask-service\\t_category_relation
    - 与 AskCategory 配合支持多级分类层级
    """

    __tablename__ = "ask_category_relation"
    __table_args__ = (
        Index("idx_acr_child", "child_category_id"),
        Index("idx_acr_father", "father_category_id"),
    )

    id = id_column(comment="ID")
    child_category_id = Column(BigInteger, nullable=False, comment="子分类ID")
    father_category_id = Column(BigInteger, nullable=False, comment="父分类ID")
    direct_father_category_id = Column(BigInteger, default=0, comment="直接父分类ID")
    is_sub = Column(Integer, default=0, comment="是否子分类 0=否 1=是")


# ======================================================================
# H 盘 t_answer / t_question 字段对齐补全 (兼容旧 Java 微服务 H 字段命名)
# ======================================================================


class AskAnswerExt(TimestampMixin, Base):
    """回答扩展表 (对齐 H 盘 t_answer 字段冗余).

    - 旧 Java 端把 favorite_num/like_num/comment_num/is_adopted/is_top
      直接冗余到 t_answer, Python 端拆出通用 AskLike/AskFavorite 表
    - 这里保留一份"原始 H 字段名"列, 兼容旧业务接口/数据迁移
    """

    __tablename__ = "ask_answer_ext"
    __table_args__ = (
        Index("idx_aae_answer", "answer_id"),
        Index("idx_aae_member", "member_id"),
    )

    id = id_column(comment="ID")
    answer_id = Column(BigInteger, nullable=False, unique=True, comment="回答ID")
    member_id = Column(BigInteger, nullable=True, comment="回答者旧H主键 (兼容迁移)")
    favorite_num = Column(Integer, default=0, comment="收藏数(冗余)")
    like_num = Column(Integer, default=0, comment="点赞数(冗余)")
    comment_num = Column(Integer, default=0, comment="评论数(冗余)")
    is_adopted = Column(Boolean, default=False, comment="是否被采纳")
    is_top = Column(Boolean, default=False, comment="是否置顶")
    deleted = Column(Boolean, default=False, comment="逻辑删除")


class AskQuestionExt(TimestampMixin, Base):
    """问题扩展表 (对齐 H 盘 t_question 字段冗余).

    - view_num/collect_num/answer_num/comment_num 等冗余字段
    """

    __tablename__ = "ask_question_ext"
    __table_args__ = (
        Index("idx_aqe_question", "question_id"),
        Index("idx_aqe_member", "member_id"),
    )

    id = id_column(comment="ID")
    question_id = Column(BigInteger, nullable=False, unique=True, comment="问题ID")
    member_id = Column(BigInteger, nullable=True, comment="提问者旧H主键")
    view_num = Column(Integer, default=0, comment="浏览数 (H 字段名)")
    collect_num = Column(Integer, default=0, comment="收藏数 (H 字段名)")
    answer_num = Column(Integer, default=0, comment="回答数")
    comment_num = Column(Integer, default=0, comment="评论数")
    is_top = Column(Boolean, default=False, comment="是否置顶")
    is_essence = Column(Boolean, default=False, comment="是否精华")
    deleted = Column(Boolean, default=False, comment="逻辑删除")
