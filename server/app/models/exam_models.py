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
    code = Column(String(64), nullable=True, comment="试卷编号 (H 字段)")
    description = Column(Text, nullable=True, comment="试卷描述")
    category_id = Column(BigInteger, nullable=True, comment="分类ID")
    course_id = Column(BigInteger, nullable=True, comment="关联课程ID")
    cover = Column(String(500), nullable=True, comment="封面图")
    total_score = Column(Float, default=100, comment="总分")
    pass_score = Column(Float, default=60, comment="及格分")
    duration = Column(Integer, default=60, comment="时长(分钟)")
    question_disordered = Column(Boolean, default=False, comment="题序打乱 (H 字段)")
    option_disordered = Column(Boolean, default=False, comment="选项打乱 (H 字段)")
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
    title = Column(String(500), nullable=True, comment="题干 (H 字段)")
    content = Column(Text, nullable=True, comment="题目内容 (兼容)")
    note = Column(Text, nullable=True, comment="题干描述 (H 字段)")
    options = Column(Text, nullable=True, comment="选项JSON")
    answer = Column(Text, nullable=True, comment="参考答案 (G 字段)")
    reference_answer = Column(Text, nullable=True, comment="参考答案 (H 字段)")
    analysis = Column(Text, nullable=True, comment="答案解析 (G 字段)")
    reference_answer_note = Column(Text, nullable=True, comment="答案解析 (H 字段)")
    status = Column(Integer, default=1, comment="0=禁用 1=启用 (H 字段)")
    score = Column(Float, default=1, comment="分值")
    difficulty = Column(Integer, default=1, comment="1=简单 2=中等 3=困难")
    sort_order = Column(Integer, default=0)

class ExamRecord(TimestampMixin, Base):
    """考试记录"""

    __tablename__ = "exam_record"
    __table_args__ = (
        Index("idx_er_user", "user_id"),
        Index("idx_er_paper", "paper_id"),
        Index("idx_er_exam", "exam_id"),
        Index("idx_er_signup", "sign_up_id"),
        Index("ix_exam_record_status", "status"),
    )

    id = id_column(comment="ID")
    exam_id = Column(BigInteger, nullable=True, comment="测评ID (H 字段)")
    exam_chapter_section_id = Column(BigInteger, nullable=True, comment="章节小节ID (H 字段)")
    sign_up_id = Column(BigInteger, nullable=True, comment="报名ID (H 字段)")
    paper_id = Column(BigInteger, nullable=False)
    paper_title = Column(String(200), nullable=True)
    user_id = Column(String(64), nullable=False)
    user_name = Column(String(100), nullable=True)
    member_id = Column(BigInteger, nullable=True, comment="答题人旧H主键 (兼容)")
    score = Column(Float, default=0, comment="得分")
    total_score = Column(Float, default=0, comment="总分")
    pass_score = Column(Float, default=0, comment="及格分")
    is_pass = Column(Boolean, default=False, comment="是否通过")
    status = Column(Integer, default=0, comment="0=进行中 1=已完成 2=已批改")
    start_time = Column(DateTime, nullable=True)
    submit_time = Column(DateTime, nullable=True)
    end_time = Column(DateTime, nullable=True, comment="结束时间 (H 字段)")
    cost_time = Column(Integer, default=0, comment="用时(秒)")
    correct_num = Column(Integer, default=0)
    wrong_num = Column(Integer, default=0)
    answer_data = Column(Text, nullable=True, comment="答题数据JSON")
    answer = Column(Text, nullable=True, comment="答案 (H 字段名)")
    reference_answer = Column(Text, nullable=True, comment="参考答案 (H 字段)")
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
    # H 盘冗余字段, 用于兼容旧数据
    title = Column(String(500), nullable=True, comment="题干 (H 字段)")
    note = Column(Text, nullable=True, comment="题干描述 (H 字段)")
    type = Column(Integer, nullable=True, comment="题型 (H 字段)")
    reference_answer = Column(Text, nullable=True, comment="参考答案 (H 字段)")
    reference_answer_note = Column(Text, nullable=True, comment="答案解析 (H 字段)")
    difficulty = Column(Integer, nullable=True, comment="难度 (H 字段)")
    score = Column(Float, nullable=True, comment="分数 (H 字段)")
    options = Column(Text, nullable=True, comment="选项 (H 字段)")
    scored = Column(Float, nullable=True, comment="得分 (H 字段)")
    result = Column(Boolean, nullable=True, comment="对错结果 (H 字段)")
    member_id = Column(BigInteger, nullable=True, comment="会员旧H主键 (兼容)")
    answer = Column(Text, nullable=True, comment="学生答案 (H 字段名)")
    status = Column(Integer, default=0, comment="错题状态 (H 字段)")

class ExamChapter(TimestampMixin, Base):
    """chapter"""

    __tablename__ = "exam_chapter"
    __table_args__ = (
        Index("idx_exam_chapter_paper", "paper_id"),
        Index("idx_exam_chapter_sort", "sort_order"),)

    id = id_column(comment="ID")
    paper_id = Column(BigInteger, nullable=True, comment="paper id")
    title = Column(String(200), nullable=False, comment="chapter title")
    description = Column(Text, nullable=True, comment="chapter description")
    cover = Column(String(500), nullable=True, comment="cover url")
    question_num = Column(Integer, default=0, comment="question count")
    total_score = Column(Float, default=0, comment="total score")
    sort_order = Column(Integer, default=0)


class ExamChapterSection(TimestampMixin, Base):
    """section"""

    __tablename__ = "exam_chapter_section"
    __table_args__ = (
        Index("idx_exam_chapter_section_chapter", "chapter_id"),
        Index("idx_exam_chapter_section_paper", "paper_id"),)

    id = id_column(comment="ID")
    chapter_id = Column(BigInteger, nullable=True, comment="chapter id")
    paper_id = Column(BigInteger, nullable=True, comment="paper id")
    title = Column(String(200), nullable=False, comment="section title")
    description = Column(Text, nullable=True, comment="section description")
    media_url = Column(String(500), nullable=True, comment="media url")
    content = Column(Text, nullable=True, comment="learning material")
    question_num = Column(Integer, default=0, comment="question count")
    total_score = Column(Float, default=0, comment="total score")
    duration = Column(Integer, default=0, comment="duration in minutes")
    sort_order = Column(Integer, default=0)


# ======================================================================
# 以下模型为按 H:\\edu client\\...\\ihui-ai-edu-exam-service 19 个 entity
# 字段 1:1 补全, 用于支持 测评 / 试卷抽题规则 / 题库分类树 / 报名 等业务.
# ======================================================================


class Exam(TimestampMixin, Base):
    """测评主表 (迁移自 t_exam).

    - 区别于 ExamPaper (固定试卷), Exam 用于发布一个"测评活动"
    - 可绑定多张试卷 (Paper) 通过 ExamCategoryRelation 关联分类
    """

    __tablename__ = "exam"
    __table_args__ = (
        Index("idx_exam_status", "status"),
        Index("idx_exam_type", "type"),
    )

    id = id_column(comment="ID")
    name = Column(String(64), nullable=False, comment="测评名称")
    code = Column(String(64), nullable=True, comment="编号")
    start_time = Column(DateTime, nullable=True, comment="开始时间")
    end_time = Column(DateTime, nullable=True, comment="结束时间")
    image = Column(String(500), nullable=True, comment="封面/banner")
    status = Column(Integer, default=0, comment="0=未发布 1=进行中 2=已结束")
    phrase = Column(String(500), nullable=True, comment="简介")
    introduction = Column(Text, nullable=True, comment="描述")
    type = Column(String(20), default="sign", comment="activity=公开自动报名 / sign=需报名")


class ExamCategoryRelation(TimestampMixin, Base):
    """测评-分类多对多关联 (迁移自 t_exam_category_relation).

    - 用于把 Exam 挂到多级分类下
    """

    __tablename__ = "exam_category_relation"
    __table_args__ = (
        Index("idx_ecr_exam", "exam_id"),
        Index("idx_ecr_category", "category_id"),
    )

    id = id_column(comment="ID")
    exam_id = Column(BigInteger, nullable=False, comment="测评ID")
    category_id = Column(BigInteger, nullable=False, comment="分类ID")


class PaperCategory(TimestampMixin, Base):
    """试卷分类 (迁移自 t_paper_category).

    - 区别于 ExamCategory (G 盘 exam_category), 试卷分类是"题库维度"
    """

    __tablename__ = "paper_category"
    __table_args__ = (
        Index("idx_pc_show", "is_show"),
        Index("idx_pc_level", "level"),
    )

    id = id_column(comment="ID")
    name = Column(String(100), nullable=False, comment="分类名称")
    sort_order = Column(Integer, default=0, comment="排序")
    is_show = Column(Boolean, default=True, comment="是否显示")
    is_show_index = Column(Boolean, default=False, comment="是否首页显示")
    image = Column(String(500), nullable=True, comment="分类图片")
    level = Column(Integer, default=1, comment="分类级别")


class PaperCategoryRelation(TimestampMixin, Base):
    """试卷分类父子关系表 (迁移自 t_paper_category_relation)."""

    __tablename__ = "paper_category_relation"
    __table_args__ = (
        Index("idx_pcr_child", "child_category_id"),
        Index("idx_pcr_father", "father_category_id"),
    )

    id = id_column(comment="ID")
    child_category_id = Column(BigInteger, nullable=False, comment="子分类ID")
    father_category_id = Column(BigInteger, nullable=False, comment="父分类ID")
    direct_father_category_id = Column(BigInteger, default=0, comment="直接父分类ID")
    is_sub = Column(Integer, default=0, comment="是否子分类")


class PaperPaperCategoryRelation(TimestampMixin, Base):
    """试卷-试卷分类多对多关联 (迁移自 t_paper_paper_category_relation).

    - 命名保留 H 盘原表名, 语义等价于 PaperCategory 关联 Paper
    """

    __tablename__ = "paper_paper_category_relation"
    __table_args__ = (
        Index("idx_ppcr_paper", "paper_id"),
        Index("idx_ppcr_category", "category_id"),
    )

    id = id_column(comment="ID")
    paper_id = Column(BigInteger, nullable=False, comment="试卷ID")
    category_id = Column(BigInteger, nullable=False, comment="试卷分类ID")


class PaperQuestion(TimestampMixin, Base):
    """试卷-题目关联 (迁移自 t_paper_question).

    - 显式保存题序, 用于组卷
    """

    __tablename__ = "paper_question"
    __table_args__ = (
        Index("idx_pq_paper", "paper_id"),
        Index("idx_pq_question", "question_id"),
    )

    id = id_column(comment="ID")
    paper_id = Column(BigInteger, nullable=False, comment="试卷ID")
    question_id = Column(BigInteger, nullable=False, comment="题目ID")
    sort_order = Column(Integer, default=0, comment="题序")


class PaperQuestionRule(TimestampMixin, Base):
    """试卷抽题规则 (迁移自 t_paper_question_rule).

    - 随机组卷时按 ruleJson 配置从题库抽取题目
    - ruleJson 字段是 JSON 字符串 (按题型/分类/难度/数量等)
    """

    __tablename__ = "paper_question_rule"
    __table_args__ = (Index("idx_pqr_paper", "paper_id"),)

    id = id_column(comment="ID")
    paper_id = Column(BigInteger, nullable=False, comment="试卷ID")
    rule_json = Column(Text, nullable=True, comment="抽题规则JSON")


class QuestionCategory(TimestampMixin, Base):
    """题库分类 (迁移自 t_question_category).

    - 区别于 PaperCategory, 是"题目维度"的分类
    """

    __tablename__ = "question_category"
    __table_args__ = (
        Index("idx_qc_show", "is_show"),
        Index("idx_qc_level", "level"),
    )

    id = id_column(comment="ID")
    name = Column(String(100), nullable=False, comment="分类名称")
    sort_order = Column(Integer, default=0, comment="排序")
    is_show = Column(Boolean, default=True, comment="是否显示")
    is_show_index = Column(Boolean, default=False, comment="是否首页显示")
    image = Column(String(500), nullable=True, comment="分类图片")
    level = Column(Integer, default=1, comment="分类级别")


class QuestionCategoryRelation(TimestampMixin, Base):
    """题库分类父子关系表 (迁移自 t_question_category_relation)."""

    __tablename__ = "question_category_relation"
    __table_args__ = (
        Index("idx_qcr_child", "child_category_id"),
        Index("idx_qcr_father", "father_category_id"),
    )

    id = id_column(comment="ID")
    child_category_id = Column(BigInteger, nullable=False, comment="子分类ID")
    father_category_id = Column(BigInteger, nullable=False, comment="父分类ID")
    direct_father_category_id = Column(BigInteger, default=0, comment="直接父分类ID")
    is_sub = Column(Integer, default=0, comment="是否子分类")


class QuestionAndCategoryRelation(TimestampMixin, Base):
    """题目-题库分类多对多关联 (迁移自 t_question_and_category_relation)."""

    __tablename__ = "question_and_category_relation"
    __table_args__ = (
        Index("idx_qacr_question", "question_id"),
        Index("idx_qacr_category", "category_id"),
    )

    id = id_column(comment="ID")
    question_id = Column(BigInteger, nullable=False, comment="题目ID")
    category_id = Column(BigInteger, nullable=False, comment="题库分类ID")


class Question(TimestampMixin, Base):
    """题库主表 (迁移自 t_question, 与 exam_question 字段不一致).

    - exam_question: 试卷中已组好的题目 (有 paper_id)
    - question:      题库中的原始题目 (无 paper_id)
    """

    __tablename__ = "question"
    __table_args__ = (
        Index("idx_q_type", "type"),
        Index("idx_q_difficulty", "difficulty"),
        Index("idx_q_status", "status"),
    )

    id = id_column(comment="ID")
    title = Column(String(500), nullable=False, comment="题干")
    note = Column(Text, nullable=True, comment="题干描述")
    type = Column(Integer, nullable=False, comment="1=单选 2=多选 3=判断 4=填空 5=简答")
    reference_answer = Column(Text, nullable=True, comment="参考答案")
    reference_answer_note = Column(Text, nullable=True, comment="答案解析")
    status = Column(Integer, default=0, comment="0=禁用 1=启用")
    difficulty = Column(Integer, default=1, comment="1=简单 2=中等 3=困难")
    score = Column(Float, default=0, comment="分数")
    options = Column(Text, nullable=True, comment="选项JSON")


class ExamSignUp(TimestampMixin, Base):
    """测评报名 (迁移自 t_sign_up).

    - 学员在某个 Exam 上报名; 状态机: 已报名/已完成/已取消
    """

    __tablename__ = "exam_sign_up"
    __table_args__ = (
        Index("idx_su_exam", "exam_id"),
        Index("idx_su_member", "member_id"),
        Index("idx_su_status", "status"),
    )

    id = id_column(comment="ID")
    exam_id = Column(BigInteger, nullable=False, comment="测评ID")
    member_id = Column(String(64), nullable=False, comment="会员UUID")
    status = Column(Integer, default=0, comment="0=已报名 1=已完成 2=已取消")
    completed_time = Column(DateTime, nullable=True, comment="完成时间")
