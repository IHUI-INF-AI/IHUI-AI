"""考试系统扩展数据模型 (组卷能力, 迁移自 ihui-ai-edu-exam-service)"""

from sqlalchemy import (
    JSON,
    BigInteger,
    Boolean,
    Column,
    DateTime,
    Index,
    Integer,
    String,
)

from app.database import Base
from app.models.base import TimestampMixin, id_column

# ---------------------------------------------------------------------------
# Exam entity
# ---------------------------------------------------------------------------


class ExamExam(TimestampMixin, Base):
    """考试 (历史 exam_exam)"""

    __tablename__ = "exam_exam"
    __table_args__ = (Index("idx_exam_exam_status", "status"),)

    id = id_column(comment="主键id")
    name = Column(String(100), nullable=False, comment="名称")
    code = Column(String(100), nullable=False, comment="编号")
    start_time = Column(DateTime, nullable=False, comment="开始时间")
    end_time = Column(DateTime, nullable=False, comment="结束时间")
    image = Column(String(1000), nullable=False, comment="封面图片(海报)")
    status = Column(String(50), nullable=False, comment="状态")
    phrase = Column(String(255), nullable=False, default="", comment="短语介绍")
    introduction = Column(String(3000), nullable=False, default="", comment="详情")


class ExamExamCategoryRelation(TimestampMixin, Base):
    """考试与分类关系 (历史 exam_exam_category_relation)"""

    __tablename__ = "exam_exam_category_relation"
    __table_args__ = (
        Index("idx_eecr_category", "category_id"),
        Index("idx_eecr_exam", "exam_id"),
    )

    id = id_column(comment="主键id")
    category_id = Column(BigInteger, nullable=False, comment="目录id")
    exam_id = Column(BigInteger, nullable=False, comment="考试id")


class ExamExamChapter(TimestampMixin, Base):
    """考试章 (历史 exam_exam_chapter)"""

    __tablename__ = "exam_exam_chapter"
    __table_args__ = (Index("idx_eec_exam", "exam_id"),)

    id = id_column(comment="主键id")
    exam_id = Column(BigInteger, nullable=True, comment="考试id")
    title = Column(String(100), nullable=False, comment="章标题")
    phrase = Column(String(255), nullable=False, default="", comment="介绍")


class ExamExamChapterSection(TimestampMixin, Base):
    """考试章节 (历史 exam_exam_chapter_section)"""

    __tablename__ = "exam_exam_chapter_section"
    __table_args__ = (
        Index("idx_eecs_chapter", "exam_chapter_id"),
        Index("idx_eecs_paper", "paper_id"),
    )

    id = id_column(comment="主键id")
    exam_chapter_id = Column(BigInteger, nullable=True, comment="考试章id")
    title = Column(String(100), nullable=False, comment="章节标题")
    paper_id = Column(BigInteger, nullable=False, comment="试卷id")
    phrase = Column(String(255), nullable=False, default="", comment="介绍")


# ---------------------------------------------------------------------------
# Exam category relations
# ---------------------------------------------------------------------------


class ExamCategoryRelation(TimestampMixin, Base):
    """考试分类关系 (历史 exam_category_relation)"""

    __tablename__ = "exam_category_relation"

    id = id_column(comment="主键id")
    child_category_id = Column(BigInteger, nullable=False, comment="子分类id")
    father_category_id = Column(BigInteger, nullable=False, comment="父分类id")
    direct_father_category_id = Column(BigInteger, nullable=False, comment="直属父分类id")
    is_sub = Column(Boolean, nullable=False, comment="是否属于子分类")


# ---------------------------------------------------------------------------
# Paper category system
# ---------------------------------------------------------------------------


class ExamPaperCategory(TimestampMixin, Base):
    """试卷分类 (历史 exam_paper_category)"""

    __tablename__ = "exam_paper_category"

    id = id_column(comment="主键id")
    name = Column(String(50), nullable=False, comment="分类名称")
    sort_order = Column(Integer, nullable=False, default=1, comment="排列序号")
    is_show = Column(Boolean, nullable=False, default=True, comment="是否显示")
    is_show_index = Column(Boolean, nullable=False, default=True, comment="是否在首页显示")
    level = Column(Integer, nullable=False, comment="目录等级")
    image = Column(String(500), nullable=False, comment="分类图片")


class ExamPaperCategoryRelation(TimestampMixin, Base):
    """试卷分类与试卷分类关系 (历史 exam_paper_category_relation)"""

    __tablename__ = "exam_paper_category_relation"

    id = id_column(comment="主键id")
    child_category_id = Column(BigInteger, nullable=False, comment="子分类id")
    father_category_id = Column(BigInteger, nullable=False, comment="父分类id")
    direct_father_category_id = Column(BigInteger, nullable=False, comment="直属父分类id")
    is_sub = Column(Boolean, nullable=False, comment="是否属于子分类")


class ExamPaperPaperCategoryRelation(TimestampMixin, Base):
    """试卷与试卷分类关系 (历史 exam_paper_paper_category_relation)"""

    __tablename__ = "exam_paper_paper_category_relation"
    __table_args__ = (
        Index("idx_eppcr_category", "category_id"),
        Index("idx_eppcr_paper", "paper_id"),
    )

    id = id_column(comment="主键id")
    category_id = Column(BigInteger, nullable=False, comment="目录id")
    paper_id = Column(BigInteger, nullable=False, comment="试卷id")


# ---------------------------------------------------------------------------
# Paper composition: questions and rules
# ---------------------------------------------------------------------------


class ExamPaperQuestion(TimestampMixin, Base):
    """试卷题目 (历史 exam_paper_question)"""

    __tablename__ = "exam_paper_question"
    __table_args__ = (
        Index("idx_epq_paper", "paper_id"),
        Index("idx_epq_question", "question_id"),
    )

    id = id_column(comment="主键id")
    question_id = Column(BigInteger, nullable=False, comment="题目id")
    paper_id = Column(BigInteger, nullable=False, comment="试卷id")
    sort_order = Column(Integer, nullable=False, default=1, comment="排列序号")


class ExamPaperQuestionRule(TimestampMixin, Base):
    """试卷题目抽题规则 (历史 exam_paper_question_rule)"""

    __tablename__ = "exam_paper_question_rule"
    __table_args__ = (Index("idx_epqr_paper", "paper_id"),)

    id = id_column(comment="主键id")
    paper_id = Column(BigInteger, nullable=False, comment="试卷id")
    rule_json = Column(JSON, nullable=False, comment="抽题规则")


# ---------------------------------------------------------------------------
# Question category system
# ---------------------------------------------------------------------------


class ExamQuestionCategory(TimestampMixin, Base):
    """题目分类 (历史 exam_question_category)"""

    __tablename__ = "exam_question_category"

    id = id_column(comment="主键id")
    name = Column(String(50), nullable=False, comment="分类名称")
    sort_order = Column(Integer, nullable=False, default=1, comment="排列序号")
    is_show = Column(Boolean, nullable=False, default=True, comment="是否显示")
    is_show_index = Column(Boolean, nullable=False, default=True, comment="是否在首页显示")
    level = Column(Integer, nullable=False, comment="目录等级")
    image = Column(String(500), nullable=False, comment="分类图片")


class ExamQuestionCategoryRelation(TimestampMixin, Base):
    """题目分类与题目分类关系 (历史 exam_question_category_relation)"""

    __tablename__ = "exam_question_category_relation"

    id = id_column(comment="主键id")
    child_category_id = Column(BigInteger, nullable=False, comment="子分类id")
    father_category_id = Column(BigInteger, nullable=False, comment="父分类id")
    direct_father_category_id = Column(BigInteger, nullable=False, comment="直属父分类id")
    is_sub = Column(Boolean, nullable=False, comment="是否属于子分类")


class ExamQuestionAndCategoryRelation(TimestampMixin, Base):
    """题目与题目分类关系 (历史 exam_question_and_category_relation)"""

    __tablename__ = "exam_question_and_category_relation"
    __table_args__ = (
        Index("idx_eqacr_category", "category_id"),
        Index("idx_eqacr_question", "question_id"),
    )

    id = id_column(comment="主键id")
    category_id = Column(BigInteger, nullable=False, comment="目录id")
    question_id = Column(BigInteger, nullable=False, comment="题目id")


# ---------------------------------------------------------------------------
# Exam sign-up
# ---------------------------------------------------------------------------


class ExamSignUp(TimestampMixin, Base):
    """考试报名 (历史 exam_sign_up)"""

    __tablename__ = "exam_sign_up"
    __table_args__ = (
        Index("idx_esu_member", "member_id"),
        Index("idx_esu_exam", "exam_id"),
        Index("idx_esu_status", "status"),
    )

    id = id_column(comment="主键id")
    member_id = Column(BigInteger, nullable=False, comment="会员id")
    exam_id = Column(BigInteger, nullable=False, comment="考试id")
    status = Column(String(50), nullable=False, comment="状态")
    completed_time = Column(DateTime, nullable=True, comment="完成时间")
