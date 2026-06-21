"""
考试系统数据模型 (迁移自 ihui-ai-edu-exam-service)
"""

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
)

from app.database import Base
from app.models.base import TimestampMixin, id_column


class ExamCategory(TimestampMixin, Base):
    """考试分类"""

    __tablename__ = "exam_category"

    id = id_column(comment="ID")
    name = Column(String(100), nullable=False)
    pid = Column(BigInteger, default=0)
    sort_order = Column(Integer, default=0)
    is_show = Column(Boolean, default=True)

class ExamPaper(TimestampMixin, Base):
    """试卷"""

    __tablename__ = "exam_paper"
    __table_args__ = (
        Index("idx_exam_paper_cat", "category_id"),
        Index("idx_exam_paper_status", "status"),)

    id = id_column(comment="ID")
    title = Column(String(200), nullable=False, comment="试卷标题")
    description = Column(Text, nullable=True, comment="试卷描述")
    category_id = Column(BigInteger, nullable=True, comment="分类ID")
    course_id = Column(BigInteger, nullable=True, comment="关联课程ID")
    cover = Column(String(500), nullable=True, comment="封面图")
    total_score = Column(Float, default=100, comment="总分")
    pass_score = Column(Float, default=60, comment="及格分")
    duration = Column(Integer, default=60, comment="时长(分钟)")
    question_num = Column(Integer, default=0, comment="题目数")
    attempt_num = Column(Integer, default=0, comment="参考人数")
    avg_score = Column(Float, default=0, comment="平均分")
    type = Column(Integer, default=1, comment="1=固定试卷 2=随机试卷 3=章节练习")
    difficulty = Column(Integer, default=1, comment="1=简单 2=中等 3=困难")
    is_free = Column(Boolean, default=True, comment="是否免费")
    price = Column(Float, default=0, comment="价格")
    status = Column(Integer, default=1, comment="0=下架 1=上架 2=待审核")
    sort_order = Column(Integer, default=0)

class ExamQuestion(TimestampMixin, Base):
    """题目"""

    __tablename__ = "exam_question"
    __table_args__ = (
        Index("idx_eq_paper", "paper_id"),
        Index("idx_eq_type", "type"),)

    id = id_column(comment="ID")
    paper_id = Column(BigInteger, nullable=False, comment="所属试卷ID")
    type = Column(Integer, nullable=False, comment="1=单选 2=多选 3=判断 4=填空 5=简答")
    content = Column(Text, nullable=False, comment="题目内容")
    options = Column(Text, nullable=True, comment="选项JSON")
    answer = Column(Text, nullable=False, comment="参考答案")
    analysis = Column(Text, nullable=True, comment="答案解析")
    score = Column(Float, default=1, comment="分值")
    difficulty = Column(Integer, default=1, comment="1=简单 2=中等 3=困难")
    sort_order = Column(Integer, default=0)

class ExamRecord(TimestampMixin, Base):
    """考试记录"""

    __tablename__ = "exam_record"
    __table_args__ = (
        Index("idx_er_user", "user_id"),
        Index("idx_er_paper", "paper_id"),
        Index("ix_exam_record_status", "status"),
    )

    id = id_column(comment="ID")
    paper_id = Column(BigInteger, nullable=False)
    paper_title = Column(String(200), nullable=True)
    user_id = Column(String(64), nullable=False)
    user_name = Column(String(100), nullable=True)
    score = Column(Float, default=0, comment="得分")
    total_score = Column(Float, default=0, comment="总分")
    pass_score = Column(Float, default=0, comment="及格分")
    is_pass = Column(Boolean, default=False, comment="是否通过")
    status = Column(Integer, default=0, comment="0=进行中 1=已完成 2=已批改")
    start_time = Column(DateTime, nullable=True)
    submit_time = Column(DateTime, nullable=True)
    cost_time = Column(Integer, default=0, comment="用时(秒)")
    correct_num = Column(Integer, default=0)
    wrong_num = Column(Integer, default=0)
    answer_data = Column(Text, nullable=True, comment="答题数据JSON")
    remark = Column(String(500), nullable=True)

class ExamWrongQuestion(TimestampMixin, Base):
    """错题本"""

    __tablename__ = "exam_wrong_question"
    __table_args__ = (
        Index("idx_ewq_user", "user_id"),
        Index("idx_ewq_question", "question_id"),)

    id = id_column(comment="ID")
    user_id = Column(String(64), nullable=False)
    question_id = Column(BigInteger, nullable=False)
    paper_id = Column(BigInteger, nullable=False)
    paper_title = Column(String(200), nullable=True)
    user_answer = Column(Text, nullable=True)
    right_answer = Column(Text, nullable=True)
    wrong_count = Column(Integer, default=1, comment="错误次数")
    last_wrong_time = Column(DateTime, nullable=True)
    is_mastered = Column(Boolean, default=False, comment="是否已掌握")
