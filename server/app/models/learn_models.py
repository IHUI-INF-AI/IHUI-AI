"""学习模块数据模型 (迁移自 ihui-ai-edu-learn-service)

历史项目 service/service_2 的 learn-service 整模块迁移。
涵盖: 课程分类/课程/章节/小节/专题/学习地图/作业/学习记录/报名 等完整学习闭环。
"""

from sqlalchemy import (
    BigInteger,
    Boolean,
    Column,
    DateTime,
    Index,
    Integer,
    Numeric,
    String,
    Text,
)

from app.database import Base
from app.models.base import TimestampMixin, id_column

# ---------------------------------------------------------------------------
# 分类体系
# ---------------------------------------------------------------------------


class LearnCategory(TimestampMixin, Base):
    """课程分类 (历史 learn_category)"""

    __tablename__ = "learn_category"
    __table_args__ = (
        Index("idx_learn_cat_level", "level"),
        Index("idx_learn_cat_company", "company_id"),
    )

    id = id_column(comment="主键id")
    name = Column(String(50), nullable=False, comment="类目名称")
    sort_order = Column(Integer, nullable=False, default=1, comment="排列序号")
    is_show = Column(Boolean, nullable=False, default=True, comment="是否显示")
    is_show_index = Column(Boolean, nullable=False, default=True, comment="是否在首页显示")
    level = Column(Integer, nullable=False, comment="目录等级")
    image = Column(String(500), nullable=False, comment="分类图片")
    company_id = Column(BigInteger, nullable=False, default=0, comment="公司id")
    department_id = Column(BigInteger, nullable=False, default=0, comment="部门id")
    create_user_id = Column(BigInteger, nullable=False, default=0, comment="创建用户id")


class LearnCategoryRelation(TimestampMixin, Base):
    """课程分类关系 (历史 learn_category_relation)"""

    __tablename__ = "learn_category_relation"

    id = id_column(comment="主键id")
    child_category_id = Column(BigInteger, nullable=False, comment="子类目id")
    father_category_id = Column(BigInteger, nullable=False, comment="父类目id")
    direct_father_category_id = Column(BigInteger, nullable=False, comment="直属父类目id")
    is_sub = Column(Boolean, nullable=False, default=False, comment="是否属于子类目")


class LearnLessonCategoryRelation(TimestampMixin, Base):
    """课程与分类关系 (历史 learn_lesson_category_relation)"""

    __tablename__ = "learn_lesson_category_relation"
    __table_args__ = (
        Index("idx_llcr_category", "category_id"),
        Index("idx_llcr_lesson", "lesson_id"),
    )

    id = id_column(comment="主键id")
    category_id = Column(BigInteger, nullable=False, comment="目录id")
    lesson_id = Column(BigInteger, nullable=False, comment="课程id")


# ---------------------------------------------------------------------------
# 课程主体
# ---------------------------------------------------------------------------


class LearnLesson(TimestampMixin, Base):
    """课程表 (历史 learn_lesson)"""

    __tablename__ = "learn_lesson"
    __table_args__ = (
        Index("idx_learn_lesson_status", "status"),
        Index("idx_learn_lesson_code", "code"),
    )

    id = id_column(comment="主键id")
    name = Column(String(100), nullable=False, comment="课程名称")
    code = Column(String(100), nullable=False, comment="编号")
    start_time = Column(DateTime, nullable=False, comment="开始时间")
    end_time = Column(DateTime, nullable=False, comment="结束时间")
    image = Column(String(1000), nullable=False, comment="封面图片(海报)")
    status = Column(String(50), nullable=False, default="draft", comment="状态")
    phrase = Column(String(255), nullable=False, default="", comment="短语介绍")
    introduction = Column(String(3000), nullable=False, default="", comment="详情")
    company_id = Column(BigInteger, nullable=True, comment="公司id")
    department_id = Column(BigInteger, nullable=True, comment="部门id")
    create_user_id = Column(BigInteger, nullable=True, comment="创建用户id")
    price = Column(Numeric(14, 2), nullable=True, default=0, comment="价格")
    original_price = Column(Numeric(14, 2), nullable=True, default=0, comment="原价")


class LearnLessonChapter(TimestampMixin, Base):
    """课程章表 (历史 learn_lesson_chapter)"""

    __tablename__ = "learn_lesson_chapter"
    __table_args__ = (Index("idx_llc_lesson", "lesson_id"),)

    id = id_column(comment="主键id")
    lesson_id = Column(BigInteger, nullable=True, comment="课程id")
    title = Column(String(100), nullable=False, comment="章标题")
    phrase = Column(String(255), nullable=False, default="", comment="介绍")
    sort_order = Column(Integer, nullable=False, default=0, comment="排序")


class LearnLessonChapterSection(TimestampMixin, Base):
    """课程章节表 (历史 learn_lesson_chapter_section)"""

    __tablename__ = "learn_lesson_chapter_section"
    __table_args__ = (Index("idx_llcs_chapter", "lesson_chapter_id"),)

    id = id_column(comment="主键id")
    lesson_chapter_id = Column(BigInteger, nullable=True, comment="课程章id")
    title = Column(String(100), nullable=False, comment="章节标题")
    url = Column(String(1000), nullable=False, comment="内容地址")
    phrase = Column(String(255), nullable=False, default="", comment="介绍")
    total_time = Column(BigInteger, nullable=False, default=0, comment="内容总时长(秒)")
    sort_order = Column(Integer, nullable=False, default=0, comment="排序")
    type = Column(String(20), nullable=False, default="upload", comment="内容类型(upload/link)")


# ---------------------------------------------------------------------------
# 专题学习
# ---------------------------------------------------------------------------


class LearnTopic(TimestampMixin, Base):
    """专题 (历史 learn_topic)"""

    __tablename__ = "learn_topic"
    __table_args__ = (Index("idx_learn_topic_status", "status"),)

    id = id_column(comment="主键id")
    title = Column(String(100), nullable=False, comment="标题")
    image = Column(String(1000), nullable=False, comment="封面图片(海报)")
    status = Column(String(50), nullable=False, default="draft", comment="状态")
    description = Column(String(3000), nullable=False, default="", comment="详情")
    company_id = Column(BigInteger, nullable=True, comment="公司id")
    department_id = Column(BigInteger, nullable=True, comment="部门id")
    create_user_id = Column(BigInteger, nullable=True, comment="创建用户id")
    price = Column(Numeric(14, 2), nullable=True, default=0, comment="价格")
    original_price = Column(Numeric(14, 2), nullable=True, default=0, comment="原价")


class LearnTopicCategory(TimestampMixin, Base):
    """专题分类 (历史 learn_topic_category)"""

    __tablename__ = "learn_topic_category"

    id = id_column(comment="主键id")
    name = Column(String(50), nullable=False, comment="类目名称")
    sort_order = Column(Integer, nullable=False, default=1, comment="排列序号")
    is_show = Column(Boolean, nullable=False, default=True, comment="是否显示")
    is_show_index = Column(Boolean, nullable=False, default=True, comment="是否在首页显示")
    level = Column(Integer, nullable=False, comment="目录等级")
    image = Column(String(500), nullable=False, comment="分类图片")
    company_id = Column(BigInteger, nullable=False, default=0, comment="公司id")
    department_id = Column(BigInteger, nullable=False, default=0, comment="部门id")
    create_user_id = Column(BigInteger, nullable=False, default=0, comment="创建用户id")


class LearnTopicCategoryRelation(TimestampMixin, Base):
    """专题分类关系 (历史 learn_topic_category_relation)"""

    __tablename__ = "learn_topic_category_relation"

    id = id_column(comment="主键id")
    child_category_id = Column(BigInteger, nullable=False, comment="子类目id")
    father_category_id = Column(BigInteger, nullable=False, comment="父类目id")
    direct_father_category_id = Column(BigInteger, nullable=False, comment="直属父类目id")
    is_sub = Column(Boolean, nullable=False, default=False, comment="是否属于子类目")


class LearnTopicLesson(TimestampMixin, Base):
    """专题与课程关系 (历史 learn_topic_lesson)"""

    __tablename__ = "learn_topic_lesson"
    __table_args__ = (
        Index("idx_ltl_topic", "topic_id"),
        Index("idx_ltl_lesson", "lesson_id"),
    )

    id = id_column(comment="主键id")
    lesson_id = Column(BigInteger, nullable=False, comment="课程id")
    topic_id = Column(BigInteger, nullable=False, comment="专题id")


class LearnTopicTopicCategoryRelation(TimestampMixin, Base):
    """专题与分类关系 (历史 learn_topic_topic_category_relation)"""

    __tablename__ = "learn_topic_topic_category_relation"
    __table_args__ = (
        Index("idx_ltcr_category", "category_id"),
        Index("idx_ltcr_topic", "topic_id"),
    )

    id = id_column(comment="主键id")
    category_id = Column(BigInteger, nullable=False, comment="目录id")
    topic_id = Column(BigInteger, nullable=False, comment="专题id")


# ---------------------------------------------------------------------------
# 学习地图
# ---------------------------------------------------------------------------


class LearnLearnMap(TimestampMixin, Base):
    """学习地图 (历史 learn_learn_map)"""

    __tablename__ = "learn_learn_map"
    __table_args__ = (Index("idx_learn_map_status", "status"),)

    id = id_column(comment="主键id")
    title = Column(String(100), nullable=False, comment="标题")
    image = Column(String(1000), nullable=False, comment="封面图片(海报)")
    status = Column(String(50), nullable=False, default="draft", comment="状态")
    description = Column(String(3000), nullable=False, default="", comment="详情")
    company_id = Column(BigInteger, nullable=True, comment="公司id")
    department_id = Column(BigInteger, nullable=True, comment="部门id")


class LearnLearnMapTopic(TimestampMixin, Base):
    """学习地图与专题的关系 (历史 learn_learn_map_topic)"""

    __tablename__ = "learn_learn_map_topic"
    __table_args__ = (
        Index("idx_llmt_map", "learn_map_id"),
        Index("idx_llmt_topic", "topic_id"),
    )

    id = id_column(comment="主键id")
    learn_map_id = Column(BigInteger, nullable=False, comment="学习地图id")
    topic_id = Column(BigInteger, nullable=False, comment="专题id")


# ---------------------------------------------------------------------------
# 作业
# ---------------------------------------------------------------------------


class LearnHomework(TimestampMixin, Base):
    """作业 (历史 learn_homework)"""

    __tablename__ = "learn_homework"
    __table_args__ = (Index("idx_learn_hw_lesson", "lesson_id"),)

    id = id_column(comment="主键id")
    lesson_id = Column(BigInteger, nullable=False, comment="课程id")
    url = Column(String(3000), nullable=False, default="", comment="附件地址")
    content = Column(Text, nullable=False, comment="作业内容")


class LearnHomeworkRecord(TimestampMixin, Base):
    """作业提交内容记录 (历史 learn_homework_record)"""

    __tablename__ = "learn_homework_record"
    __table_args__ = (
        Index("idx_learn_hwr_member", "member_id"),
        Index("idx_learn_hwr_lesson", "lesson_id"),
        Index("idx_learn_hwr_signup", "sign_up_id"),
    )

    id = id_column(comment="主键id")
    member_id = Column(BigInteger, nullable=False, comment="会员id")
    lesson_id = Column(BigInteger, nullable=False, comment="课程id")
    url = Column(String(3000), nullable=False, comment="作业提交内容的地址")
    status = Column(String(200), nullable=False, default="pending", comment="状态")
    sign_up_id = Column(BigInteger, nullable=False, comment="报名id")


# ---------------------------------------------------------------------------
# 学习记录与报名
# ---------------------------------------------------------------------------


class LearnRecord(TimestampMixin, Base):
    """学习记录 (历史 learn_record)"""

    __tablename__ = "learn_record"
    __table_args__ = (
        Index("idx_learn_record_member", "member_id"),
        Index("idx_learn_record_lesson", "lesson_id"),
        Index("idx_learn_record_signup", "sign_up_id"),
    )

    id = id_column(comment="主键id")
    member_id = Column(BigInteger, nullable=False, comment="会员id")
    lesson_id = Column(BigInteger, nullable=False, comment="课程id")
    lesson_chapter_section_id = Column(BigInteger, nullable=False, comment="章节id")
    sign_up_id = Column(BigInteger, nullable=False, comment="报名id")
    learn_time = Column(BigInteger, nullable=False, default=0, comment="学习时长(秒)")
    max_progress_time = Column(BigInteger, nullable=False, default=0, comment="最大的学习进度时间")
    status = Column(String(200), nullable=False, default="progressing", comment="状态")


class LearnRecordLog(TimestampMixin, Base):
    """学习记录日志 (历史 learn_record_log)"""

    __tablename__ = "learn_record_log"
    __table_args__ = (
        Index("idx_learn_rlog_member", "member_id"),
        Index("idx_learn_rlog_lesson", "lesson_id"),
    )

    id = id_column(comment="主键id")
    member_id = Column(BigInteger, nullable=False, comment="会员id")
    lesson_id = Column(BigInteger, nullable=False, comment="课程id")
    lesson_chapter_section_id = Column(BigInteger, nullable=False, comment="章节id")
    sign_up_id = Column(BigInteger, nullable=False, comment="报名id")
    learn_time = Column(BigInteger, nullable=False, default=0, comment="学习时长(秒)")


class LearnSignUp(TimestampMixin, Base):
    """课程报名 (历史 learn_sign_up)"""

    __tablename__ = "learn_sign_up"
    __table_args__ = (
        Index("idx_learn_su_member", "member_id"),
        Index("idx_learn_su_lesson", "lesson_id"),
        Index("idx_learn_su_status", "status"),
    )

    id = id_column(comment="主键id")
    member_id = Column(BigInteger, nullable=False, comment="会员id")
    lesson_id = Column(BigInteger, nullable=False, comment="课程id")
    status = Column(String(50), nullable=False, default="enrolled", comment="状态")
    completed_time = Column(DateTime, nullable=True, comment="完成时间")


# ---------------------------------------------------------------------------
# 订单
# ---------------------------------------------------------------------------


class LearnOrder(TimestampMixin, Base):
    """学习模块订单 (历史 learn_order)"""

    __tablename__ = "learn_order"
    __table_args__ = (
        Index("idx_learn_order_member", "member_id"),
        Index("idx_learn_order_status", "status"),
    )

    id = id_column(comment="主键id")
    order_no = Column(String(64), nullable=False, unique=True, comment="订单号")
    member_id = Column(String(64), nullable=False, comment="用户id")
    lesson_id = Column(BigInteger, nullable=True, comment="课程id")
    amount = Column(Numeric(14, 2), nullable=False, default=0, comment="金额")
    status = Column(String(20), nullable=False, default="pending", comment="状态: pending/paid/cancelled/refunded")
    pay_type = Column(String(20), nullable=True, comment="支付方式: wechat/alipay")
    invoice_title = Column(String(255), nullable=True, comment="发票抬头")
    invoice_status = Column(String(20), nullable=False, default="none", comment="发票状态: none/pending/issued")
