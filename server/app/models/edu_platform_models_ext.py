"""
教育平台扩展 ORM 模型 (2026-07-05)
从旧 Java Spring Boot 项目迁移 - 15 个缺失模块的数据模型
"""
from sqlalchemy import BigInteger, Boolean, Column, DateTime, Float, Integer, String, Text, ForeignKey
from app.database import Base
from app.models.base import TimestampMixin, id_column


# ---------------------------------------------------------------------------
# 学习模块 (learn)
# ---------------------------------------------------------------------------

class EduLearnCategory(TimestampMixin, Base):
    """课程分类 (edu_learn_category)"""
    __tablename__ = "edu_learn_category"
    id = id_column()
    name = Column(String(100), nullable=False, comment="分类名称")
    pid = Column(BigInteger, default=0, comment="父分类id")
    sort = Column(Integer, default=0, comment="排序")
    status = Column(Integer, default=1, comment="1=启用,0=禁用")


class EduLesson(TimestampMixin, Base):
    """课程 (edu_lesson)"""
    __tablename__ = "edu_lesson"
    id = id_column()
    title = Column(String(200), nullable=False, comment="课程标题")
    cover_image = Column(String(500), nullable=True, comment="封面图")
    intro = Column(Text, nullable=True, comment="简介")
    category_id = Column(BigInteger, nullable=True, comment="分类id")
    lecturer_id = Column(BigInteger, nullable=True, comment="讲师id")
    lecturer_name = Column(String(100), nullable=True, comment="讲师名称")
    price = Column(Float, default=0, comment="价格")
    original_price = Column(Float, default=0, comment="原价")
    is_free = Column(Boolean, default=False, comment="是否免费")
    is_published = Column(Boolean, default=False, comment="是否发布")
    sort = Column(Integer, default=0, comment="排序")
    view_count = Column(Integer, default=0, comment="浏览量")
    signup_count = Column(Integer, default=0, comment="报名人数")
    lesson_count = Column(Integer, default=0, comment="课时数")
    exam_paper_id = Column(BigInteger, nullable=True, comment="关联试卷id")
    certificate_template_id = Column(BigInteger, nullable=True, comment="证书模板id")
    status = Column(Integer, default=1, comment="1=正常,0=删除")


class EduLessonChapter(TimestampMixin, Base):
    """课程章节 (edu_lesson_chapter)"""
    __tablename__ = "edu_lesson_chapter"
    id = id_column()
    lesson_id = Column(BigInteger, nullable=False, comment="课程id")
    title = Column(String(200), nullable=False, comment="章节标题")
    sort_order = Column(Integer, default=0, comment="排序")
    status = Column(Integer, default=1, comment="1=正常,0=删除")


class EduLessonChapterSection(TimestampMixin, Base):
    """课程小节 (edu_lesson_chapter_section)"""
    __tablename__ = "edu_lesson_chapter_section"
    id = id_column()
    chapter_id = Column(BigInteger, nullable=False, comment="章节id")
    lesson_id = Column(BigInteger, nullable=False, comment="课程id")
    title = Column(String(200), nullable=False, comment="小节标题")
    video_url = Column(String(500), nullable=True, comment="视频地址")
    duration = Column(Integer, default=0, comment="时长(秒)")
    content = Column(Text, nullable=True, comment="图文内容")
    sort_order = Column(Integer, default=0, comment="排序")
    is_free_preview = Column(Boolean, default=False, comment="是否免费试看")
    status = Column(Integer, default=1, comment="1=正常,0=删除")


class EduLessonHomework(TimestampMixin, Base):
    """课程作业 (edu_lesson_homework)"""
    __tablename__ = "edu_lesson_homework"
    id = id_column()
    lesson_id = Column(BigInteger, nullable=False, comment="课程id")
    title = Column(String(200), nullable=False, comment="作业标题")
    content = Column(Text, nullable=True, comment="作业内容")
    deadline = Column(DateTime, nullable=True, comment="截止时间")
    status = Column(Integer, default=1, comment="1=正常,0=删除")


class EduLearnMap(TimestampMixin, Base):
    """学习地图 (edu_learn_map)"""
    __tablename__ = "edu_learn_map"
    id = id_column()
    name = Column(String(200), nullable=False, comment="地图名称")
    description = Column(Text, nullable=True, comment="描述")
    is_published = Column(Boolean, default=False, comment="是否发布")
    status = Column(Integer, default=1, comment="1=正常,0=删除")


class EduSignUp(TimestampMixin, Base):
    """报名记录 (edu_sign_up)"""
    __tablename__ = "edu_sign_up"
    id = id_column()
    member_id = Column(BigInteger, nullable=False, comment="会员id")
    target_id = Column(BigInteger, nullable=False, comment="目标id(课程/考试)")
    target_type = Column(String(50), default="lesson", comment="类型: lesson/exam")
    status = Column(Integer, default=1, comment="1=已报名,0=已取消")


class EduLessonStudyRecord(TimestampMixin, Base):
    """学习记录 (edu_lesson_study_record)"""
    __tablename__ = "edu_lesson_study_record"
    id = id_column()
    member_id = Column(BigInteger, nullable=False, comment="会员id")
    lesson_id = Column(BigInteger, nullable=False, comment="课程id")
    section_id = Column(BigInteger, nullable=True, comment="小节id")
    study_duration = Column(Integer, default=0, comment="学习时长(秒)")
    progress = Column(Float, default=0, comment="进度百分比")
    last_position = Column(Integer, default=0, comment="上次播放位置")


class EduLessonTopic(TimestampMixin, Base):
    """课程专题 (edu_lesson_topic)"""
    __tablename__ = "edu_lesson_topic"
    id = id_column()
    title = Column(String(200), nullable=False, comment="专题标题")
    cover_image = Column(String(500), nullable=True, comment="封面图")
    description = Column(Text, nullable=True, comment="描述")
    lesson_ids = Column(Text, nullable=True, comment="课程id列表(JSON)")
    is_published = Column(Boolean, default=False, comment="是否发布")
    sort = Column(Integer, default=0, comment="排序")
    status = Column(Integer, default=1, comment="1=正常,0=删除")


# ---------------------------------------------------------------------------
# 考试模块 (exam)
# ---------------------------------------------------------------------------

class EduExamCategory(TimestampMixin, Base):
    """考试分类 (edu_exam_category)"""
    __tablename__ = "edu_exam_category"
    id = id_column()
    name = Column(String(100), nullable=False, comment="分类名称")
    pid = Column(BigInteger, default=0, comment="父分类id")
    sort = Column(Integer, default=0, comment="排序")
    status = Column(Integer, default=1, comment="1=启用,0=禁用")


class EduExam(TimestampMixin, Base):
    """考试 (edu_exam)"""
    __tablename__ = "edu_exam"
    id = id_column()
    title = Column(String(200), nullable=False, comment="考试标题")
    category_id = Column(BigInteger, nullable=True, comment="分类id")
    description = Column(Text, nullable=True, comment="考试说明")
    total_score = Column(Float, default=100, comment="总分")
    pass_score = Column(Float, default=60, comment="及格分")
    duration = Column(Integer, default=60, comment="考试时长(分钟)")
    is_published = Column(Boolean, default=False, comment="是否发布")
    start_time = Column(DateTime, nullable=True, comment="开始时间")
    end_time = Column(DateTime, nullable=True, comment="结束时间")
    sort = Column(Integer, default=0, comment="排序")
    status = Column(Integer, default=1, comment="1=正常,0=删除")


class EduExamChapter(TimestampMixin, Base):
    """考试章节 (edu_exam_chapter)"""
    __tablename__ = "edu_exam_chapter"
    id = id_column()
    exam_id = Column(BigInteger, nullable=False, comment="考试id")
    title = Column(String(200), nullable=False, comment="章节标题")
    sort_order = Column(Integer, default=0, comment="排序")
    status = Column(Integer, default=1, comment="1=正常,0=删除")


class EduExamChapterSection(TimestampMixin, Base):
    """考试小节 (edu_exam_chapter_section)"""
    __tablename__ = "edu_exam_chapter_section"
    id = id_column()
    chapter_id = Column(BigInteger, nullable=False, comment="章节id")
    exam_id = Column(BigInteger, nullable=False, comment="考试id")
    title = Column(String(200), nullable=False, comment="小节标题")
    sort_order = Column(Integer, default=0, comment="排序")
    status = Column(Integer, default=1, comment="1=正常,0=删除")


class EduExamQuestion(TimestampMixin, Base):
    """题库题目 (edu_exam_question)"""
    __tablename__ = "edu_exam_question"
    id = id_column()
    category_id = Column(BigInteger, nullable=True, comment="分类id")
    type = Column(String(50, ), default="single_choice", comment="题型: single_choice/multi_choice/judgment/fill_blank/subjective")
    difficulty = Column(Integer, default=1, comment="难度:1-5")
    title = Column(Text, nullable=False, comment="题干")
    options = Column(Text, nullable=True, comment="选项(JSON)")
    answer = Column(Text, nullable=True, comment="答案")
    analysis = Column(Text, nullable=True, comment="解析")
    score = Column(Float, default=1, comment="分值")
    status = Column(Integer, default=1, comment="1=正常,0=删除")


class EduExamPaper(TimestampMixin, Base):
    """试卷 (edu_exam_paper)"""
    __tablename__ = "edu_exam_paper"
    id = id_column()
    exam_id = Column(BigInteger, nullable=True, comment="考试id")
    title = Column(String(200), nullable=False, comment="试卷标题")
    paper_type = Column(String(50), default="normal", comment="类型: normal/random/mock")
    total_score = Column(Float, default=100, comment="总分")
    pass_score = Column(Float, default=60, comment="及格分")
    duration = Column(Integer, default=60, comment="时长(分钟)")
    is_published = Column(Boolean, default=False, comment="是否发布")
    category_id = Column(BigInteger, nullable=True, comment="分类id")
    status = Column(Integer, default=1, comment="1=正常,0=删除")


class EduExamPaperRule(TimestampMixin, Base):
    """试卷规则 (edu_exam_paper_rule)"""
    __tablename__ = "edu_exam_paper_rule"
    id = id_column()
    paper_id = Column(BigInteger, nullable=False, comment="试卷id")
    question_type = Column(String(50), comment="题型")
    category_id = Column(BigInteger, nullable=True, comment="题库分类")
    difficulty = Column(Integer, default=1, comment="难度")
    question_count = Column(Integer, default=0, comment="题目数量")
    score_per_question = Column(Float, default=1, comment="每题分值")


class EduExamPaperQuestion(TimestampMixin, Base):
    """试卷题目关联 (edu_exam_paper_question)"""
    __tablename__ = "edu_exam_paper_question"
    id = id_column()
    paper_id = Column(BigInteger, nullable=False, comment="试卷id")
    question_id = Column(BigInteger, nullable=False, comment="题目id")
    sort_order = Column(Integer, default=0, comment="排序")
    score = Column(Float, default=1, comment="分值")


class EduExamRecord(TimestampMixin, Base):
    """考试记录 (edu_exam_record)"""
    __tablename__ = "edu_exam_record"
    id = id_column()
    exam_id = Column(BigInteger, nullable=True, comment="考试id")
    paper_id = Column(BigInteger, nullable=False, comment="试卷id")
    member_id = Column(BigInteger, nullable=False, comment="会员id")
    score = Column(Float, default=0, comment="得分")
    total_score = Column(Float, default=100, comment="总分")
    is_pass = Column(Boolean, default=False, comment="是否通过")
    is_marked = Column(Boolean, default=False, comment="是否已批阅")
    start_time = Column(DateTime, nullable=True, comment="开始时间")
    submit_time = Column(DateTime, nullable=True, comment="提交时间")
    duration = Column(Integer, default=0, comment="用时(秒)")
    status = Column(Integer, default=0, comment="0=未完成,1=已完成,2=已批阅")


# ---------------------------------------------------------------------------
# 资源模块 (resource)
# ---------------------------------------------------------------------------

class EduResourceCategory(TimestampMixin, Base):
    """资源分类 (edu_resource_category)"""
    __tablename__ = "edu_resource_category"
    id = id_column()
    name = Column(String(100), nullable=False, comment="分类名称")
    pid = Column(BigInteger, default=0, comment="父分类id")
    sort = Column(Integer, default=0, comment="排序")
    status = Column(Integer, default=1, comment="1=启用,0=禁用")


class EduResource(TimestampMixin, Base):
    """资源 (edu_resource)"""
    __tablename__ = "edu_resource"
    id = id_column()
    title = Column(String(200), nullable=False, comment="资源标题")
    cover_image = Column(String(500), nullable=True, comment="封面图")
    intro = Column(Text, nullable=True, comment="简介")
    category_id = Column(BigInteger, nullable=True, comment="分类id")
    file_url = Column(String(500), nullable=True, comment="文件地址")
    file_type = Column(String(50), nullable=True, comment="文件类型")
    file_size = Column(Integer, default=0, comment="文件大小")
    is_published = Column(Boolean, default=False, comment="是否发布")
    view_count = Column(Integer, default=0, comment="浏览量")
    download_count = Column(Integer, default=0, comment="下载量")
    sort = Column(Integer, default=0, comment="排序")
    status = Column(Integer, default=1, comment="1=正常,0=删除")


class EduResourceTag(TimestampMixin, Base):
    """资源标签 (edu_resource_tag)"""
    __tablename__ = "edu_resource_tag"
    id = id_column()
    name = Column(String(100), nullable=False, comment="标签名称")
    sort = Column(Integer, default=0, comment="排序")
    status = Column(Integer, default=1, comment="1=启用,0=禁用")


class EduResourceProduct(TimestampMixin, Base):
    """资源产品 (edu_resource_product)"""
    __tablename__ = "edu_resource_product"
    id = id_column()
    resource_id = Column(BigInteger, nullable=False, comment="资源id")
    name = Column(String(200), nullable=False, comment="产品名称")
    price = Column(Float, default=0, comment="价格")
    original_price = Column(Float, default=0, comment="原价")
    description = Column(Text, nullable=True, comment="描述")
    is_published = Column(Boolean, default=False, comment="是否发布")
    sort = Column(Integer, default=0, comment="排序")
    status = Column(Integer, default=1, comment="1=正常,0=删除")


# ---------------------------------------------------------------------------
# 圈子模块 (circle)
# ---------------------------------------------------------------------------

class EduCircleCategory(TimestampMixin, Base):
    """圈子分类 (edu_circle_category)"""
    __tablename__ = "edu_circle_category"
    id = id_column()
    name = Column(String(100), nullable=False, comment="分类名称")
    pid = Column(BigInteger, default=0, comment="父分类id")
    sort = Column(Integer, default=0, comment="排序")
    status = Column(Integer, default=1, comment="1=启用,0=禁用")


class EduCircle(TimestampMixin, Base):
    """圈子 (edu_circle)"""
    __tablename__ = "edu_circle"
    id = id_column()
    name = Column(String(200), nullable=False, comment="圈子名称")
    cover_image = Column(String(500), nullable=True, comment="封面图")
    description = Column(Text, nullable=True, comment="描述")
    category_id = Column(BigInteger, nullable=True, comment="分类id")
    member_count = Column(Integer, default=0, comment="成员数")
    post_count = Column(Integer, default=0, comment="动态数")
    sort = Column(Integer, default=0, comment="排序")
    status = Column(Integer, default=1, comment="1=正常,0=删除")


class EduCircleDynamic(TimestampMixin, Base):
    """圈子动态 (edu_circle_dynamic)"""
    __tablename__ = "edu_circle_dynamic"
    id = id_column()
    circle_id = Column(BigInteger, nullable=True, comment="圈子id")
    category_id = Column(BigInteger, nullable=True, comment="分类id")
    member_id = Column(BigInteger, nullable=False, comment="发布者id")
    member_name = Column(String(100), nullable=True, comment="发布者名称")
    content = Column(Text, nullable=False, comment="内容")
    images = Column(Text, nullable=True, comment="图片(JSON)")
    like_count = Column(Integer, default=0, comment="点赞数")
    comment_count = Column(Integer, default=0, comment="评论数")
    is_top = Column(Boolean, default=False, comment="是否置顶")
    status = Column(Integer, default=1, comment="1=正常,0=删除")


# ---------------------------------------------------------------------------
# 评论模块 (comment)
# ---------------------------------------------------------------------------

class EduComment(TimestampMixin, Base):
    """评论 (edu_comment)"""
    __tablename__ = "edu_comment"
    id = id_column()
    topic_id = Column(BigInteger, nullable=False, comment="目标id")
    topic_type = Column(String(50), nullable=False, comment="目标类型: lesson/news/article/resource/dynamic")
    member_id = Column(BigInteger, nullable=False, comment="评论者id")
    member_name = Column(String(100), nullable=True, comment="评论者名称")
    content = Column(Text, nullable=False, comment="评论内容")
    like_count = Column(Integer, default=0, comment="点赞数")
    reply_count = Column(Integer, default=0, comment="回复数")
    status = Column(Integer, default=1, comment="1=正常,0=删除")


class EduReplyComment(TimestampMixin, Base):
    """回复评论 (edu_reply_comment)"""
    __tablename__ = "edu_reply_comment"
    id = id_column()
    comment_id = Column(BigInteger, nullable=False, comment="评论id")
    member_id = Column(BigInteger, nullable=False, comment="回复者id")
    member_name = Column(String(100), nullable=True, comment="回复者名称")
    to_member_id = Column(BigInteger, nullable=True, comment="被回复者id")
    to_member_name = Column(String(100), nullable=True, comment="被回复者名称")
    content = Column(Text, nullable=False, comment="回复内容")
    like_count = Column(Integer, default=0, comment="点赞数")
    status = Column(Integer, default=1, comment="1=正常,0=删除")


class EduFavorite(TimestampMixin, Base):
    """收藏 (edu_favorite)"""
    __tablename__ = "edu_favorite"
    id = id_column()
    member_id = Column(BigInteger, nullable=False, comment="会员id")
    topic_id = Column(BigInteger, nullable=False, comment="目标id")
    topic_type = Column(String(50), nullable=False, comment="目标类型")


class EduLike(TimestampMixin, Base):
    """点赞 (edu_like)"""
    __tablename__ = "edu_like"
    id = id_column()
    member_id = Column(BigInteger, nullable=False, comment="会员id")
    topic_id = Column(BigInteger, nullable=False, comment="目标id")
    topic_type = Column(String(50), nullable=False, comment="目标类型: comment/reply/dynamic")


class EduSensitiveWord(TimestampMixin, Base):
    """敏感词 (edu_sensitive_word)"""
    __tablename__ = "edu_sensitive_word"
    id = id_column()
    word = Column(String(200), nullable=False, comment="敏感词")
    status = Column(Integer, default=1, comment="1=启用,0=禁用")


# ---------------------------------------------------------------------------
# 问答模块 (ask)
# ---------------------------------------------------------------------------

class EduAskCategory(TimestampMixin, Base):
    """问答分类 (edu_ask_category)"""
    __tablename__ = "edu_ask_category"
    id = id_column()
    name = Column(String(100), nullable=False, comment="分类名称")
    pid = Column(BigInteger, default=0, comment="父分类id")
    sort = Column(Integer, default=0, comment="排序")
    status = Column(Integer, default=1, comment="1=启用,0=禁用")


class EduQuestion(TimestampMixin, Base):
    """问答-问题 (edu_question)"""
    __tablename__ = "edu_question"
    id = id_column()
    title = Column(String(500), nullable=False, comment="问题标题")
    content = Column(Text, nullable=True, comment="问题内容")
    category_id = Column(BigInteger, nullable=True, comment="分类id")
    member_id = Column(BigInteger, nullable=False, comment="提问者id")
    member_name = Column(String(100), nullable=True, comment="提问者名称")
    answer_count = Column(Integer, default=0, comment="回答数")
    view_count = Column(Integer, default=0, comment="浏览量")
    like_count = Column(Integer, default=0, comment="点赞数")
    is_solved = Column(Boolean, default=False, comment="是否已解决")
    status = Column(Integer, default=1, comment="1=正常,0=删除")


class EduAnswer(TimestampMixin, Base):
    """问答-回答 (edu_answer)"""
    __tablename__ = "edu_answer"
    id = id_column()
    question_id = Column(BigInteger, nullable=False, comment="问题id")
    member_id = Column(BigInteger, nullable=False, comment="回答者id")
    member_name = Column(String(100), nullable=True, comment="回答者名称")
    content = Column(Text, nullable=False, comment="回答内容")
    like_count = Column(Integer, default=0, comment="点赞数")
    is_adopted = Column(Boolean, default=False, comment="是否采纳")
    status = Column(Integer, default=1, comment="1=正常,0=删除")


# ---------------------------------------------------------------------------
# 证书模块 (certificate)
# ---------------------------------------------------------------------------

class EduCertificateTemplate(TimestampMixin, Base):
    """证书模板 (edu_certificate_template)"""
    __tablename__ = "edu_certificate_template"
    id = id_column()
    name = Column(String(200), nullable=False, comment="模板名称")
    background_image = Column(String(500), nullable=True, comment="背景图")
    template_config = Column(Text, nullable=True, comment="模板配置(JSON)")
    is_active = Column(Boolean, default=False, comment="是否启用")
    status = Column(Integer, default=1, comment="1=正常,0=删除")


class EduCertificate(TimestampMixin, Base):
    """证书 (edu_certificate)"""
    __tablename__ = "edu_certificate"
    id = id_column()
    certificate_no = Column(String(100), nullable=True, comment="证书编号")
    member_id = Column(BigInteger, nullable=False, comment="会员id")
    member_name = Column(String(100), nullable=True, comment="会员名称")
    lesson_id = Column(BigInteger, nullable=True, comment="课程id")
    lesson_title = Column(String(200), nullable=True, comment="课程名称")
    template_id = Column(BigInteger, nullable=True, comment="模板id")
    issue_date = Column(DateTime, nullable=True, comment="发证日期")
    expire_date = Column(DateTime, nullable=True, comment="过期日期")
    certificate_status = Column(String(50), default="valid", comment="状态: valid/suspended/cancelled/expired/revoked")
    status = Column(Integer, default=1, comment="1=正常,0=删除")


# ---------------------------------------------------------------------------
# 直播模块 (live)
# ---------------------------------------------------------------------------

class EduLiveCategory(TimestampMixin, Base):
    """直播分类 (edu_live_category)"""
    __tablename__ = "edu_live_category"
    id = id_column()
    name = Column(String(100), nullable=False, comment="分类名称")
    pid = Column(BigInteger, default=0, comment="父分类id")
    sort = Column(Integer, default=0, comment="排序")
    status = Column(Integer, default=1, comment="1=启用,0=禁用")


class EduLiveChannel(TimestampMixin, Base):
    """直播频道 (edu_live_channel)"""
    __tablename__ = "edu_live_channel"
    id = id_column()
    title = Column(String(200), nullable=False, comment="直播标题")
    cover_image = Column(String(500), nullable=True, comment="封面图")
    intro = Column(Text, nullable=True, comment="简介")
    category_id = Column(BigInteger, nullable=True, comment="分类id")
    lecturer_id = Column(BigInteger, nullable=True, comment="讲师id")
    lecturer_name = Column(String(100), nullable=True, comment="讲师名称")
    push_url = Column(String(500), nullable=True, comment="推流地址")
    play_url = Column(String(500), nullable=True, comment="播放地址")
    start_time = Column(DateTime, nullable=True, comment="开始时间")
    end_time = Column(DateTime, nullable=True, comment="结束时间")
    is_live = Column(Boolean, default=False, comment="是否直播中")
    is_published = Column(Boolean, default=False, comment="是否发布")
    view_count = Column(Integer, default=0, comment="观看人数")
    sort = Column(Integer, default=0, comment="排序")
    status = Column(Integer, default=1, comment="1=正常,0=删除")


class EduLecturer(TimestampMixin, Base):
    """讲师 (edu_lecturer)"""
    __tablename__ = "edu_lecturer"
    id = id_column()
    name = Column(String(100), nullable=False, comment="讲师姓名")
    avatar = Column(String(500), nullable=True, comment="头像")
    title = Column(String(200), nullable=True, comment="职称")
    intro = Column(Text, nullable=True, comment="简介")
    sort = Column(Integer, default=0, comment="排序")
    status = Column(Integer, default=1, comment="1=正常,0=删除")


# ---------------------------------------------------------------------------
# 积分模块 (point)
# ---------------------------------------------------------------------------

class EduPointChannel(TimestampMixin, Base):
    """积分渠道 (edu_point_channel)"""
    __tablename__ = "edu_point_channel"
    id = id_column()
    name = Column(String(100), nullable=False, comment="渠道名称")
    code = Column(String(50), nullable=True, comment="渠道编码")
    description = Column(Text, nullable=True, comment="描述")
    sort = Column(Integer, default=0, comment="排序")
    status = Column(Integer, default=1, comment="1=启用,0=禁用")


class EduPoint(TimestampMixin, Base):
    """积分规则 (edu_point)"""
    __tablename__ = "edu_point"
    id = id_column()
    name = Column(String(100), nullable=False, comment="规则名称")
    code = Column(String(50), nullable=True, comment="规则编码")
    channel_id = Column(BigInteger, nullable=True, comment="渠道id")
    point = Column(Integer, default=0, comment="积分值")
    description = Column(Text, nullable=True, comment="描述")
    sort = Column(Integer, default=0, comment="排序")
    status = Column(Integer, default=1, comment="1=启用,0=禁用")


class EduPointChannelRelation(TimestampMixin, Base):
    """积分渠道关联 (edu_point_channel_relation)"""
    __tablename__ = "edu_point_channel_relation"
    id = id_column()
    point_id = Column(BigInteger, nullable=False, comment="积分id")
    channel_id = Column(BigInteger, nullable=False, comment="渠道id")


class EduPointRecord(TimestampMixin, Base):
    """积分记录 (edu_point_record)"""
    __tablename__ = "edu_point_record"
    id = id_column()
    member_id = Column(BigInteger, nullable=False, comment="会员id")
    point = Column(Integer, default=0, comment="积分变动值")
    balance = Column(Integer, default=0, comment="变动后余额")
    type = Column(String(50), default="earn", comment="类型: earn/spend")
    description = Column(String(500), nullable=True, comment="描述")
    ref_id = Column(BigInteger, nullable=True, comment="关联id")


# ---------------------------------------------------------------------------
# 消息模块 (message)
# ---------------------------------------------------------------------------

class EduAnnouncement(TimestampMixin, Base):
    """公告 (edu_announcement)"""
    __tablename__ = "edu_announcement"
    id = id_column()
    title = Column(String(200), nullable=False, comment="公告标题")
    content = Column(Text, nullable=True, comment="公告内容")
    is_published = Column(Boolean, default=False, comment="是否发布")
    is_top = Column(Boolean, default=False, comment="是否置顶")
    publish_time = Column(DateTime, nullable=True, comment="发布时间")
    sort = Column(Integer, default=0, comment="排序")
    status = Column(Integer, default=1, comment="1=正常,0=删除")


class EduMessage(TimestampMixin, Base):
    """站内消息 (edu_message)"""
    __tablename__ = "edu_message"
    id = id_column()
    member_id = Column(BigInteger, nullable=False, comment="接收会员id")
    sender_id = Column(BigInteger, nullable=True, comment="发送者id")
    title = Column(String(200), nullable=True, comment="消息标题")
    content = Column(Text, nullable=True, comment="消息内容")
    msg_type = Column(String(50), default="system", comment="类型: system/announcement/private")
    is_read = Column(Boolean, default=False, comment="是否已读")
    ref_id = Column(BigInteger, nullable=True, comment="关联id")
    ref_type = Column(String(50), nullable=True, comment="关联类型")


# ---------------------------------------------------------------------------
# 搜索模块 (search)
# ---------------------------------------------------------------------------

class EduHotWord(TimestampMixin, Base):
    """搜索热词 (edu_hot_word)"""
    __tablename__ = "edu_hot_word"
    id = id_column()
    word = Column(String(200), nullable=False, comment="热词")
    search_count = Column(Integer, default=0, comment="搜索次数")
    sort = Column(Integer, default=0, comment="排序")
    is_hot = Column(Boolean, default=False, comment="是否热门")
    status = Column(Integer, default=1, comment="1=启用,0=禁用")


# ---------------------------------------------------------------------------
# 首页配置模块 (index)
# ---------------------------------------------------------------------------

class EduIndexConfig(TimestampMixin, Base):
    """首页配置 (edu_index_config)"""
    __tablename__ = "edu_index_config"
    id = id_column()
    config_key = Column(String(100), nullable=False, comment="配置键")
    config_value = Column(Text, nullable=True, comment="配置值(JSON)")
    description = Column(String(500), nullable=True, comment="描述")
    status = Column(Integer, default=1, comment="1=启用,0=禁用")


class EduIndexCategory(TimestampMixin, Base):
    """首页分类导航 (edu_index_category)"""
    __tablename__ = "edu_index_category"
    id = id_column()
    name = Column(String(100), nullable=False, comment="分类名称")
    icon = Column(String(500), nullable=True, comment="图标")
    link_url = Column(String(500), nullable=True, comment="链接地址")
    sort = Column(Integer, default=0, comment="排序")
    status = Column(Integer, default=1, comment="1=启用,0=禁用")


# ---------------------------------------------------------------------------
# 订单模块 (order)
# ---------------------------------------------------------------------------

class EduOrder(TimestampMixin, Base):
    """订单 (edu_order)"""
    __tablename__ = "edu_order"
    id = id_column()
    order_no = Column(String(100), nullable=True, comment="订单号")
    member_id = Column(BigInteger, nullable=False, comment="会员id")
    order_type = Column(String(50), default="course", comment="类型: course/card")
    target_id = Column(BigInteger, nullable=True, comment="目标id(课程/会员卡)")
    target_title = Column(String(200), nullable=True, comment="目标标题")
    quantity = Column(Integer, default=1, comment="数量")
    original_price = Column(Float, default=0, comment="原价")
    discount_amount = Column(Float, default=0, comment="优惠金额")
    pay_amount = Column(Float, default=0, comment="支付金额")
    pay_type = Column(String(50), nullable=True, comment="支付方式: alipay/wechat/balance")
    status = Column(String(50), default="pending", comment="状态: pending/paid/cancelled/refunded")
    pay_time = Column(DateTime, nullable=True, comment="支付时间")
    cancel_time = Column(DateTime, nullable=True, comment="取消时间")
    refund_time = Column(DateTime, nullable=True, comment="退款时间")
    remark = Column(String(500), nullable=True, comment="备注")


class EduPayment(TimestampMixin, Base):
    """支付记录 (edu_payment)"""
    __tablename__ = "edu_payment"
    id = id_column()
    payment_no = Column(String(100), nullable=True, comment="支付号")
    order_id = Column(BigInteger, nullable=False, comment="订单id")
    order_type = Column(String(50), nullable=True, comment="订单类型")
    member_id = Column(BigInteger, nullable=False, comment="会员id")
    pay_type = Column(String(50), nullable=True, comment="支付方式")
    pay_amount = Column(Float, default=0, comment="支付金额")
    pay_url = Column(String(500), nullable=True, comment="支付地址")
    status = Column(String(50), default="created", comment="状态: created/paying/paid/failed/cancelled")
    pay_time = Column(DateTime, nullable=True, comment="支付时间")
    third_party_no = Column(String(200), nullable=True, comment="第三方支付号")


class EduRefund(TimestampMixin, Base):
    """退款记录 (edu_refund)"""
    __tablename__ = "edu_refund"
    id = id_column()
    order_id = Column(BigInteger, nullable=False, comment="订单id")
    order_type = Column(String(50), nullable=True, comment="订单类型")
    order_no = Column(String(100), nullable=True, comment="订单号")
    member_id = Column(BigInteger, nullable=False, comment="会员id")
    reason = Column(String(500), nullable=True, comment="退款原因")
    refund_amount = Column(Float, default=0, comment="退款金额")
    refund_type = Column(String(50), nullable=True, comment="退款方式: original/balance")
    status = Column(String(50), default="pending", comment="状态: pending/approved/rejected/processing/completed/failed")
    apply_time = Column(DateTime, nullable=True, comment="申请时间")
    process_time = Column(DateTime, nullable=True, comment="处理时间")
    complete_time = Column(DateTime, nullable=True, comment="完成时间")
    process_message = Column(String(500), nullable=True, comment="审核意见")
    handle_message = Column(String(500), nullable=True, comment="处理说明")


class EduInvoiceApplication(TimestampMixin, Base):
    """发票申请 (edu_invoice_application)"""
    __tablename__ = "edu_invoice_application"
    id = id_column()
    order_id = Column(BigInteger, nullable=True, comment="订单id")
    member_id = Column(BigInteger, nullable=False, comment="会员id")
    invoice_type = Column(String(50), default="normal", comment="类型: normal/special")
    title_id = Column(BigInteger, nullable=True, comment="发票抬头id")
    amount = Column(Float, default=0, comment="金额")
    email = Column(String(100), nullable=True, comment="邮箱")
    status = Column(String(50), default="pending", comment="状态: pending/approved/rejected/invoicing/invoiced/canceled")
    remark = Column(String(500), nullable=True, comment="备注")


class EduInvoiceTitle(TimestampMixin, Base):
    """发票抬头 (edu_invoice_title)"""
    __tablename__ = "edu_invoice_title"
    id = id_column()
    member_id = Column(BigInteger, nullable=False, comment="会员id")
    title_type = Column(String(50), default="personal", comment="类型: personal/company")
    title = Column(String(200), nullable=False, comment="抬头名称")
    tax_no = Column(String(50), nullable=True, comment="税号")
    bank = Column(String(200), nullable=True, comment="开户银行")
    bank_account = Column(String(50), nullable=True, comment="银行账号")
    address = Column(String(500), nullable=True, comment="地址")
    phone = Column(String(20), nullable=True, comment="电话")


# ---------------------------------------------------------------------------
# 访问统计模块 (visit-tracking)
# ---------------------------------------------------------------------------

class EduVisitLog(TimestampMixin, Base):
    """访问日志 (edu_visit_log)"""
    __tablename__ = "edu_visit_log"
    id = id_column()
    member_id = Column(BigInteger, nullable=True, comment="会员id")
    ip = Column(String(50), nullable=True, comment="IP地址")
    city = Column(String(100), nullable=True, comment="城市")
    url = Column(String(500), nullable=True, comment="访问URL")
    referer = Column(String(500), nullable=True, comment="来源URL")
    user_agent = Column(String(500), nullable=True, comment="User-Agent")
    session_id = Column(String(100), nullable=True, comment="会话ID")
    visit_date = Column(String(10), nullable=True, comment="访问日期 YYYY-MM-DD")


# ---------------------------------------------------------------------------
# 通知模块 (notification)
# ---------------------------------------------------------------------------

class EduNotification(TimestampMixin, Base):
    """通知 (edu_notification)"""
    __tablename__ = "edu_notification"
    id = id_column()
    member_id = Column(BigInteger, nullable=False, comment="接收会员id")
    sender_id = Column(BigInteger, nullable=True, comment="发送者id")
    title = Column(String(200), nullable=True, comment="通知标题")
    content = Column(Text, nullable=True, comment="通知内容")
    notif_type = Column(String(50), default="system", comment="类型: system/announcement/private/order/comment/like")
    channel = Column(String(50), default="letter", comment="渠道: letter/email/sms/push")
    is_read = Column(Boolean, default=False, comment="是否已读")
    ref_id = Column(BigInteger, nullable=True, comment="关联id")
    ref_type = Column(String(50), nullable=True, comment="关联类型")
    read_time = Column(DateTime, nullable=True, comment="阅读时间")


class EduNotificationDevice(TimestampMixin, Base):
    """通知设备 (edu_notification_device)"""
    __tablename__ = "edu_notification_device"
    id = id_column()
    member_id = Column(BigInteger, nullable=False, comment="会员id")
    device_type = Column(String(50), nullable=True, comment="设备类型: ios/android/web")
    device_token = Column(String(500), nullable=True, comment="设备token")
    is_active = Column(Boolean, default=True, comment="是否启用")


# ---------------------------------------------------------------------------
# 调度模块 (schedule)
# ---------------------------------------------------------------------------

class EduScheduleTask(TimestampMixin, Base):
    """定时任务 (edu_schedule_task)"""
    __tablename__ = "edu_schedule_task"
    id = id_column()
    name = Column(String(200), nullable=False, comment="任务名称")
    description = Column(Text, nullable=True, comment="任务描述")
    cron_expression = Column(String(100), nullable=False, comment="Cron表达式")
    target_service = Column(String(100), nullable=True, comment="目标服务")
    target_method = Column(String(100), nullable=True, comment="目标方法")
    parameters = Column(Text, nullable=True, comment="任务参数(JSON)")
    priority = Column(Integer, default=5, comment="优先级1-10")
    max_retry_count = Column(Integer, default=3, comment="最大重试次数")
    timeout = Column(Integer, default=3600, comment="超时时间(秒)")
    enabled = Column(Boolean, default=True, comment="是否启用")
    last_run_time = Column(DateTime, nullable=True, comment="上次执行时间")
    last_run_status = Column(String(50), nullable=True, comment="上次执行状态")
    last_run_message = Column(Text, nullable=True, comment="上次执行消息")


class EduScheduleLog(TimestampMixin, Base):
    """任务执行日志 (edu_schedule_log)"""
    __tablename__ = "edu_schedule_log"
    id = id_column()
    task_id = Column(BigInteger, nullable=False, comment="任务id")
    task_name = Column(String(200), nullable=True, comment="任务名称")
    status = Column(String(50), default="running", comment="状态: running/success/failed/timeout")
    start_time = Column(DateTime, nullable=True, comment="开始时间")
    end_time = Column(DateTime, nullable=True, comment="结束时间")
    duration = Column(Integer, default=0, comment="耗时(秒)")
    message = Column(Text, nullable=True, comment="执行消息")
    retry_count = Column(Integer, default=0, comment="重试次数")


# ---------------------------------------------------------------------------
# 行为模块 (behavior)
# ---------------------------------------------------------------------------

class EduWatchRecord(TimestampMixin, Base):
    """浏览记录 (edu_watch_record)"""
    __tablename__ = "edu_watch_record"
    id = id_column()
    member_id = Column(BigInteger, nullable=False, comment="会员id")
    topic_id = Column(BigInteger, nullable=False, comment="目标id")
    topic_type = Column(String(50), nullable=False, comment="目标类型: lesson/news/article/resource")
    topic_title = Column(String(200), nullable=True, comment="目标标题")
    watch_duration = Column(Integer, default=0, comment="观看时长(秒)")
    last_position = Column(Integer, default=0, comment="上次位置")
