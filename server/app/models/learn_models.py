"""
Learn 服务数据模型 (迁移自 edu server ihui-ai-edu-learn-service)

包含 16 个模块的数据表:
lesson / signup / record / task / rate / report / statistics /
topic / topiccategory / category / homework / certificate /
order / learnmap / access / exampaper
"""

from sqlalchemy import BigInteger, Column, DateTime, Index, Integer, String, Text

from app.database import Base
from app.models.base import TimestampMixin, id_column


# ---------------------------------------------------------------------------
# 1. 课程模块 (lesson)
# ---------------------------------------------------------------------------


class Lesson(TimestampMixin, Base):
    """课程表 (t_lesson)"""

    __tablename__ = "t_lesson"
    __table_args__ = (
        Index("idx_lesson_status", "status"),
        Index("idx_lesson_creator", "create_user_id"),
    )

    id = id_column(comment="主键id")
    name = Column(String(200), nullable=False, comment="课程名称")
    code = Column(String(100), nullable=True, comment="编号")
    start_time = Column(DateTime, nullable=True, comment="开始时间")
    end_time = Column(DateTime, nullable=True, comment="结束时间")
    image = Column(String(500), nullable=True, comment="封面图片")
    status = Column(Integer, default=0, comment="0=未发布 1=已发布 2=已删除")
    phrase = Column(Text, nullable=True, comment="简介")
    introduction = Column(Text, nullable=True, comment="描述")
    price = Column(Integer, default=0, comment="价格(分)")
    original_price = Column(Integer, default=0, comment="原价(分)")
    create_user_id = Column(BigInteger, nullable=True, comment="创建人ID")
    company_id = Column(BigInteger, nullable=True, comment="公司ID")
    department_id = Column(BigInteger, nullable=True, comment="部门ID")
    certificate_id = Column(BigInteger, nullable=True, comment="证书ID")
    exam_paper_id = Column(BigInteger, nullable=True, comment="试卷ID")
    sort_weight = Column(Integer, default=0, comment="排序权重")


class LessonChapter(TimestampMixin, Base):
    """课程章表 (t_lesson_chapter)"""

    __tablename__ = "t_lesson_chapter"
    __table_args__ = (Index("idx_lchapter_lesson", "lesson_id"),)

    id = id_column(comment="主键id")
    lesson_id = Column(BigInteger, nullable=False, comment="课程ID")
    title = Column(String(200), nullable=False, comment="标题")
    phrase = Column(Text, nullable=True, comment="简介")
    sort_order = Column(Integer, default=0, comment="排序")


class LessonChapterSection(TimestampMixin, Base):
    """课程章节表 (t_lesson_chapter_section)"""

    __tablename__ = "t_lesson_chapter_section"
    __table_args__ = (Index("idx_lsection_chapter", "lesson_chapter_id"),)

    id = id_column(comment="主键id")
    lesson_chapter_id = Column(BigInteger, nullable=False, comment="章ID")
    title = Column(String(200), nullable=False, comment="标题")
    type = Column(String(50), nullable=True, comment="内容类型")
    url = Column(String(500), nullable=True, comment="内容路径")
    phrase = Column(Text, nullable=True, comment="简介")
    total_time = Column(Integer, default=0, comment="内容总时间(秒)")
    sort_order = Column(Integer, default=0, comment="排序")
    content = Column(Text, nullable=True, comment="内容")
    content_type = Column(String(50), nullable=True, comment="内容类型枚举")


class LessonCategoryRelation(TimestampMixin, Base):
    """课堂类目关系表 (t_lesson_category_relation)"""

    __tablename__ = "t_lesson_category_relation"
    __table_args__ = (
        Index("idx_lcr_lesson", "lesson_id"),
        Index("idx_lcr_category", "category_id"),
    )

    id = id_column(comment="主键id")
    lesson_id = Column(BigInteger, nullable=False, comment="课堂ID")
    category_id = Column(BigInteger, nullable=False, comment="类目ID")


# ---------------------------------------------------------------------------
# 2. 报名模块 (signup)
# ---------------------------------------------------------------------------


class SignUp(TimestampMixin, Base):
    """报名表 (t_sign_up)"""

    __tablename__ = "t_sign_up"
    __table_args__ = (
        Index("idx_signup_lesson", "lesson_id"),
        Index("idx_signup_member", "member_id"),
        Index("idx_signup_status", "status"),
    )

    id = id_column(comment="主键id")
    lesson_id = Column(BigInteger, nullable=False, comment="课程ID")
    member_id = Column(BigInteger, nullable=False, comment="会员ID")
    company_id = Column(BigInteger, nullable=True, comment="公司ID")
    status = Column(Integer, default=0, comment="报名状态: 0=已报名 1=已完成 2=已取消")
    completed_time = Column(DateTime, nullable=True, comment="完成时间")
    progress = Column(Integer, default=0, comment="学习进度(0-100)")


# ---------------------------------------------------------------------------
# 3. 学习记录模块 (record)
# ---------------------------------------------------------------------------


class Record(TimestampMixin, Base):
    """学习记录表 (t_record)"""

    __tablename__ = "t_record"
    __table_args__ = (
        Index("idx_record_member", "member_id"),
        Index("idx_record_lesson", "lesson_id"),
        Index("idx_record_signup", "sign_up_id"),
    )

    id = id_column(comment="主键id")
    lesson_id = Column(BigInteger, nullable=False, comment="课程ID")
    lesson_chapter_section_id = Column(BigInteger, nullable=False, comment="课程章节ID")
    member_id = Column(BigInteger, nullable=False, comment="会员ID")
    learn_time = Column(Integer, default=0, comment="学习时长(秒)")
    sign_up_id = Column(BigInteger, nullable=True, comment="报名ID")
    max_progress_time = Column(Integer, default=0, comment="最大学习进度时间")
    status = Column(Integer, default=0, comment="状态: 0=进行中 1=已完成")
    progress = Column(Integer, default=0, comment="进度(0-100)")


class RecordLog(TimestampMixin, Base):
    """学习记录日志表 (t_record_log)"""

    __tablename__ = "t_record_log"
    __table_args__ = (Index("idx_rlog_member", "member_id"),)

    id = id_column(comment="主键id")
    lesson_id = Column(BigInteger, nullable=False, comment="课程ID")
    lesson_chapter_section_id = Column(BigInteger, nullable=False, comment="课程章节ID")
    member_id = Column(BigInteger, nullable=False, comment="会员ID")
    learn_time = Column(Integer, default=0, comment="学习时长(秒)")
    sign_up_id = Column(BigInteger, nullable=True, comment="报名ID")


# ---------------------------------------------------------------------------
# 4. 课程任务模块 (task)
# ---------------------------------------------------------------------------


class LessonTask(TimestampMixin, Base):
    """课程任务表 (lesson_task)"""

    __tablename__ = "lesson_task"
    __table_args__ = (
        Index("idx_task_lesson", "lesson_id"),
        Index("idx_task_chapter", "lesson_chapter_id"),
    )

    id = id_column(comment="主键id")
    lesson_id = Column(BigInteger, nullable=False, comment="课程ID")
    lesson_chapter_id = Column(BigInteger, nullable=True, comment="章节ID")
    lesson_chapter_section_id = Column(BigInteger, nullable=True, comment="节点ID")
    title = Column(String(200), nullable=True, comment="名称")
    content_type = Column(String(50), nullable=True, comment="资源类型")
    conditions = Column(Text, nullable=True, comment="条件(JSON)")
    status = Column(Integer, default=0, comment="状态: 0=禁用 1=启用")


# ---------------------------------------------------------------------------
# 5. 课程评价模块 (rate)
# ---------------------------------------------------------------------------


class Rate(TimestampMixin, Base):
    """课程评分表 (t_rate)"""

    __tablename__ = "t_rate"
    __table_args__ = (
        Index("idx_rate_lesson", "lesson_id"),
        Index("idx_rate_member", "member_id"),
    )

    id = id_column(comment="主键id")
    lesson_id = Column(BigInteger, nullable=False, comment="课程ID")
    sign_id = Column(BigInteger, nullable=True, comment="报名ID")
    member_id = Column(BigInteger, nullable=False, comment="会员ID")
    content_utility_score = Column(Integer, default=5, comment="内容实用性 1-5")
    content_depth_score = Column(Integer, default=5, comment="内容深度 1-5")
    instructor_expertise_score = Column(Integer, default=5, comment="专业知识 1-5")
    teaching_method_score = Column(Integer, default=5, comment="教学方法 1-5")
    innovate_score = Column(Integer, default=5, comment="创新设计 1-5")
    overall_satisfaction_score = Column(Integer, default=5, comment="整体满意度 1-5")
    additional_comments = Column(Text, nullable=True, comment="其他建议")
    company_id = Column(BigInteger, nullable=True, comment="公司ID")
    create_user_id = Column(BigInteger, nullable=True)
    create_user_name = Column(String(100), nullable=True)
    update_user_id = Column(BigInteger, nullable=True)
    update_user_name = Column(String(100), nullable=True)


# ---------------------------------------------------------------------------
# 6. 专题模块 (topic)
# ---------------------------------------------------------------------------


class Topic(TimestampMixin, Base):
    """专题表 (t_topic)"""

    __tablename__ = "t_topic"
    __table_args__ = (Index("idx_topic_status", "status"),)

    id = id_column(comment="主键id")
    title = Column(String(200), nullable=False, comment="标题")
    description = Column(Text, nullable=True, comment="描述")
    image = Column(String(500), nullable=True, comment="封面")
    status = Column(Integer, default=1, comment="状态: 0=未发布 1=已发布 2=已删除")
    price = Column(Integer, default=0, comment="价格(分)")
    original_price = Column(Integer, default=0, comment="原价(分)")
    create_user_id = Column(BigInteger, nullable=True)
    company_id = Column(BigInteger, nullable=True)
    department_id = Column(BigInteger, nullable=True)


class TopicLesson(TimestampMixin, Base):
    """主题课程关系表 (t_topic_lesson)"""

    __tablename__ = "t_topic_lesson"
    __table_args__ = (
        Index("idx_tl_topic", "topic_id"),
        Index("idx_tl_lesson", "lesson_id"),
    )

    id = id_column(comment="主键id")
    lesson_id = Column(BigInteger, nullable=False, comment="课程ID")
    topic_id = Column(BigInteger, nullable=False, comment="专题ID")


class TopicTopicCategoryRelation(TimestampMixin, Base):
    """主题分类关系表 (t_topic_topic_category_relation)"""

    __tablename__ = "t_topic_topic_category_relation"
    __table_args__ = (Index("idx_ttcr_topic", "topic_id"),)

    id = id_column(comment="主键id")
    topic_id = Column(BigInteger, nullable=False, comment="专题ID")
    category_id = Column(BigInteger, nullable=False, comment="分类ID")


# ---------------------------------------------------------------------------
# 7. 专题分类模块 (topiccategory)
# ---------------------------------------------------------------------------


class TopicCategory(TimestampMixin, Base):
    """专题分类表 (t_topic_category)"""

    __tablename__ = "t_topic_category"
    __table_args__ = (Index("idx_tc_show", "is_show"),)

    id = id_column(comment="主键id")
    name = Column(String(100), nullable=False, comment="分类名称")
    sort_order = Column(Integer, default=0, comment="排序")
    is_show = Column(Integer, default=1, comment="是否显示")
    is_show_index = Column(Integer, default=0, comment="是否首页显示")
    image = Column(String(500), nullable=True, comment="图片")
    level = Column(Integer, default=1, comment="层级")
    create_user_id = Column(BigInteger, nullable=True)
    company_id = Column(BigInteger, nullable=True)
    department_id = Column(BigInteger, nullable=True)


class TopicCategoryRelation(TimestampMixin, Base):
    """专题分类关系表 (t_topic_category_relation)"""

    __tablename__ = "t_topic_category_relation"
    __table_args__ = (Index("idx_tcr_child", "child_category_id"),)

    id = id_column(comment="主键id")
    child_category_id = Column(BigInteger, nullable=False, comment="子分类ID")
    father_category_id = Column(BigInteger, nullable=False, comment="父分类ID")
    direct_father_category_id = Column(BigInteger, nullable=True, comment="直接父分类ID")
    is_sub = Column(Integer, default=0, comment="是否子分类")


# ---------------------------------------------------------------------------
# 8. 课程分类模块 (category)
# ---------------------------------------------------------------------------


class Category(TimestampMixin, Base):
    """课程分类表 (t_category)"""

    __tablename__ = "t_category"
    __table_args__ = (Index("idx_cat_show", "is_show"),)

    id = id_column(comment="主键id")
    name = Column(String(100), nullable=False, comment="分类名称")
    sort_order = Column(Integer, default=0, comment="排序")
    is_show = Column(Integer, default=1, comment="是否显示")
    is_show_index = Column(Integer, default=0, comment="是否首页显示")
    image = Column(String(500), nullable=True, comment="图片")
    level = Column(Integer, default=1, comment="层级")
    create_user_id = Column(BigInteger, nullable=True)
    company_id = Column(BigInteger, nullable=True)
    department_id = Column(BigInteger, nullable=True)
    type = Column(String(20), default="live", comment="分类归属业务板块: live/learn/exam/circle 等")


class CategoryRelation(TimestampMixin, Base):
    """课程分类关系表 (t_category_relation)"""

    __tablename__ = "t_category_relation"
    __table_args__ = (Index("idx_catrel_child", "child_category_id"),)

    id = id_column(comment="主键id")
    child_category_id = Column(BigInteger, nullable=False, comment="子分类ID")
    father_category_id = Column(BigInteger, nullable=False, comment="父分类ID")
    direct_father_category_id = Column(BigInteger, nullable=True, comment="直接父分类ID")
    is_sub = Column(Integer, default=0, comment="是否子分类")


# ---------------------------------------------------------------------------
# 9. 作业模块 (homework)
# ---------------------------------------------------------------------------


class Homework(TimestampMixin, Base):
    """作业表 (homework)"""

    __tablename__ = "homework"
    __table_args__ = (Index("idx_hw_lesson", "lesson_id"),)

    id = id_column(comment="主键id")
    lesson_id = Column(BigInteger, nullable=False, comment="课程ID")
    content = Column(Text, nullable=True, comment="作业内容")
    url = Column(String(500), nullable=True, comment="附件路径")


class HomeworkRecord(TimestampMixin, Base):
    """作业记录表 (t_homework_record)"""

    __tablename__ = "t_homework_record"
    __table_args__ = (
        Index("idx_hr_lesson", "lesson_id"),
        Index("idx_hr_member", "member_id"),
        Index("idx_hr_status", "status"),
    )

    id = id_column(comment="主键id")
    lesson_id = Column(BigInteger, nullable=False, comment="课程ID")
    member_id = Column(BigInteger, nullable=False, comment="会员ID")
    url = Column(String(500), nullable=True, comment="提交内容路径")
    sign_up_id = Column(BigInteger, nullable=True, comment="报名ID")
    status = Column(Integer, default=0, comment="状态: 0=待审批 1=通过 2=驳回")


# ---------------------------------------------------------------------------
# 10. 证书模块 (certificate)
# ---------------------------------------------------------------------------


class Certificate(TimestampMixin, Base):
    """证书表 (t_certificate)"""

    __tablename__ = "t_certificate"
    __table_args__ = (
        Index("idx_cert_member", "member_id"),
        Index("idx_cert_lesson", "lesson_id"),
        Index("idx_cert_status", "status"),
    )

    id = id_column(comment="主键id")
    certificate_id = Column(BigInteger, nullable=True, comment="证书模板ID")
    code = Column(String(100), nullable=True, comment="证书编号")
    name = Column(String(200), nullable=True, comment="名称")
    description = Column(Text, nullable=True, comment="描述")
    awarding_organization = Column(String(200), nullable=True, comment="颁发机构")
    awarder_name = Column(String(100), nullable=True, comment="颁发人名称")
    awarder_position = Column(String(100), nullable=True, comment="颁发人职位")
    design = Column(String(500), nullable=True, comment="设计图片")
    award_conditions = Column(Text, nullable=True, comment="颁发条件")
    validity_policy = Column(Text, nullable=True, comment="有效期限策略")
    award_date = Column(DateTime, nullable=True, comment="颁发日期")
    validity = Column(String(100), nullable=True, comment="有效期限")
    status = Column(Integer, default=0, comment="状态: 0=有效 1=暂停 2=注销 3=失效 4=撤销 5=删除")
    member_id = Column(BigInteger, nullable=True, comment="会员ID")
    lesson_id = Column(BigInteger, nullable=True, comment="课程ID")
    lesson_sign_id = Column(BigInteger, nullable=True, comment="报名ID")
    lesson_sign_time = Column(DateTime, nullable=True, comment="报名时间")
    lesson_complete_time = Column(DateTime, nullable=True, comment="完成时间")
    score = Column(Integer, nullable=True, comment="成绩")
    company_id = Column(BigInteger, nullable=True)
    create_user_id = Column(BigInteger, nullable=True)
    create_user_name = Column(String(100), nullable=True)
    update_user_id = Column(BigInteger, nullable=True)
    update_user_name = Column(String(100), nullable=True)


class CertificateTemplate(TimestampMixin, Base):
    """证书模版表 (t_certificate_template)"""

    __tablename__ = "t_certificate_template"
    __table_args__ = (Index("idx_ct_status", "status"),)

    id = id_column(comment="主键id")
    name = Column(String(200), nullable=False, comment="名称")
    description = Column(Text, nullable=True, comment="描述")
    awarding_organization = Column(String(200), nullable=True, comment="颁发机构")
    awarder_name = Column(String(100), nullable=True, comment="颁发人名称")
    awarder_position = Column(String(100), nullable=True, comment="颁发人职位")
    design = Column(String(500), nullable=True, comment="设计图片")
    award_conditions = Column(Text, nullable=True, comment="颁发条件")
    validity_policy = Column(Text, nullable=True, comment="有效期限策略")
    status = Column(Integer, default=1, comment="状态: 0=禁用 1=启用 2=删除")
    company_id = Column(BigInteger, nullable=True)
    create_user_id = Column(BigInteger, nullable=True)
    create_user_name = Column(String(100), nullable=True)
    update_user_id = Column(BigInteger, nullable=True)
    update_user_name = Column(String(100), nullable=True)


class CertificateSerialNumber(TimestampMixin, Base):
    """证书序列号表 (t_certificate_serial_number)"""

    __tablename__ = "t_certificate_serial_number"
    __table_args__ = (Index("idx_csn_date", "year", "month", "day"),)

    id = id_column(comment="主键id")
    year = Column(Integer, nullable=False, comment="年")
    month = Column(Integer, nullable=False, comment="月")
    day = Column(Integer, nullable=False, comment="日")
    current_serial = Column(Integer, default=0, comment="当前序列号")


# ---------------------------------------------------------------------------
# 11. 学习地图模块 (learnmap)
# ---------------------------------------------------------------------------


class LearnMap(TimestampMixin, Base):
    """学习地图表 (t_learn_map)"""

    __tablename__ = "t_learn_map"
    __table_args__ = (Index("idx_lm_status", "status"),)

    id = id_column(comment="主键id")
    title = Column(String(200), nullable=False, comment="标题")
    description = Column(Text, nullable=True, comment="描述")
    image = Column(String(500), nullable=True, comment="封面")
    status = Column(Integer, default=1, comment="状态: 0=未发布 1=已发布 2=已删除")
    create_user_id = Column(BigInteger, nullable=True)
    company_id = Column(BigInteger, nullable=True)
    department_id = Column(BigInteger, nullable=True)


class LearnMapTopic(TimestampMixin, Base):
    """学习地图主题关系表 (t_learn_map_topic)"""

    __tablename__ = "t_learn_map_topic"
    __table_args__ = (
        Index("idx_lmt_map", "learn_map_id"),
        Index("idx_lmt_topic", "topic_id"),
    )

    id = id_column(comment="主键id")
    learn_map_id = Column(BigInteger, nullable=False, comment="学习地图ID")
    topic_id = Column(BigInteger, nullable=False, comment="专题ID")


# ---------------------------------------------------------------------------
# 12. 学习权限模块 (access)
# ---------------------------------------------------------------------------


class LessonAccess(TimestampMixin, Base):
    """学习权限表 (lesson_access)"""

    __tablename__ = "lesson_access"
    __table_args__ = (Index("idx_la_lesson", "lesson_id"),)

    id = id_column(comment="主键id")
    lesson_id = Column(BigInteger, nullable=False, comment="课程ID")
    access_type = Column(String(50), nullable=False, comment="权限类型")
    access_value = Column(String(100), nullable=False, comment="权限值")


# ---------------------------------------------------------------------------
# 13. 答卷记录模块 (exampaper)
# ---------------------------------------------------------------------------


class ExamPaperRecord(TimestampMixin, Base):
    """考试记录表 (t_exam_paper_record)"""

    __tablename__ = "t_exam_paper_record"
    __table_args__ = (
        Index("idx_epr_member", "member_id"),
        Index("idx_epr_exam", "exam_id"),
        Index("idx_epr_status", "status"),
    )

    id = id_column(comment="主键id")
    exam_id = Column(BigInteger, nullable=False, comment="考试ID")
    exam_chapter_section_id = Column(BigInteger, nullable=True, comment="考试章节ID")
    sign_up_id = Column(BigInteger, nullable=True, comment="报名ID")
    member_id = Column(BigInteger, nullable=False, comment="会员ID")
    paper = Column(Text, nullable=True, comment="试卷")
    answer = Column(Text, nullable=True, comment="用户答案")
    reference_answer = Column(Text, nullable=True, comment="参考答案")
    start_time = Column(DateTime, nullable=True, comment="开始答卷时间")
    end_time = Column(DateTime, nullable=True, comment="结束答卷时间")
    score = Column(Integer, nullable=True, comment="试卷得分")
    status = Column(Integer, default=0, comment="状态: 0=未提交 1=已提交 2=已评分")
    lesson_id = Column(BigInteger, nullable=True, comment="课程ID")
    serial_num = Column(String(100), nullable=True, comment="考试流水号")
    exam_title = Column(String(200), nullable=True, comment="考试名称")


# ---------------------------------------------------------------------------
# 14. 评论回复模块 (reply_comment) — 迁移自历史项目 t_reply_comment
# ---------------------------------------------------------------------------


class ReplyComment(TimestampMixin, Base):
    """评论回复表 (t_reply_comment) — 二级回复关系.

    迁移自 edu client init_database.sql. 用于评论的二级回复关系,
    reply_comment_id 为父回复ID (回复评论表时值跟评论id相等).
    """

    __tablename__ = "t_reply_comment"
    __table_args__ = (
        Index("idx_reply_comment_comment", "comment_id"),
        Index("idx_reply_comment_member", "member_id"),
    )

    id = id_column(comment="主键id")
    comment_id = Column(BigInteger, nullable=False, comment="评论id")
    reply_comment_id = Column(BigInteger, nullable=False, comment="回复评论id (父ID)")
    content = Column(String(4000), nullable=False, comment="回复内容")
    member_id = Column(BigInteger, nullable=False, comment="当前评论的用户ID")
    to_member_id = Column(BigInteger, nullable=False, comment="回复的评论的用户id")


# ---------------------------------------------------------------------------
# 15. 内容浏览统计模块 (watch) — 迁移自历史项目 t_watch
# ---------------------------------------------------------------------------


class Watch(TimestampMixin, Base):
    """内容浏览统计表 (t_watch).

    迁移自 edu client init_database.sql. 通过 topic_id + topic_type 多态关联
    课程评论、知识评论等多种内容的浏览行为, 用于内容维度的浏览统计.
    """

    __tablename__ = "t_watch"
    __table_args__ = (
        Index("idx_watch_topic", "topic_id", "topic_type"),
        Index("idx_watch_member", "member_id"),
    )

    id = id_column(comment="主键id")
    topic_id = Column(BigInteger, nullable=False, comment="主题ID (课程评论/知识评论ID等)")
    topic_type = Column(String(50), nullable=False, comment="主题类型 (课程评论/知识评论等)")
    member_id = Column(BigInteger, nullable=False, comment="用户id")
    ip_addr = Column(String(200), nullable=False, comment="ip地址")
