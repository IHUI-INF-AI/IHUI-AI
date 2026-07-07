"""Edu platform models - migrated from Java Spring Boot project (2026-07-05).

教育平台后端模块数据模型, 迁移自旧 Java Spring Boot 项目.
涵盖: 认证/设置/内容/教育会员/用户中心/支付 等完整业务域.

所有表均带 created_at/updated_at (TimestampMixin 自动管理).
主键使用 id_column() 兼容 SQLite/PostgreSQL.
"""

from sqlalchemy import BigInteger, Boolean, Column, DateTime, Float, Integer, String, Text

from app.database import Base
from app.models.base import TimestampMixin, id_column


# ---------------------------------------------------------------------------
# 认证模块
# ---------------------------------------------------------------------------


class EduRole(TimestampMixin, Base):
    """角色表 (edu_role)"""

    __tablename__ = "edu_role"

    id = id_column()
    name = Column(String(100), nullable=False, comment="角色名称")
    code = Column(String(100), nullable=False, comment="角色编码")
    description = Column(Text, nullable=True, comment="描述")
    status = Column(Integer, default=1, comment="1=active, 0=disabled")


class EduAuthority(TimestampMixin, Base):
    """权限表 (edu_authority)"""

    __tablename__ = "edu_authority"

    id = id_column()
    pid = Column(BigInteger, default=0, comment="父权限id")
    name = Column(String(100), nullable=False, comment="权限名称")
    alias = Column(String(100), nullable=False, comment="权限别名")
    type = Column(Integer, default=1, comment="1=menu, 2=button")
    sort = Column(Integer, default=0)


class EduRoleAuthority(TimestampMixin, Base):
    """角色权限关联表 (edu_role_authority)"""

    __tablename__ = "edu_role_authority"

    id = id_column()
    role_id = Column(BigInteger, nullable=False, comment="角色id")
    authority_id = Column(BigInteger, nullable=False, comment="权限id")


# ---------------------------------------------------------------------------
# 设置模块
# ---------------------------------------------------------------------------


class EduCarousel(TimestampMixin, Base):
    """轮播图表 (edu_carousel)"""

    __tablename__ = "edu_carousel"

    id = id_column()
    title = Column(String(200), nullable=True, comment="标题")
    image = Column(String(500), nullable=False, comment="图片地址")
    link = Column(String(500), nullable=True, comment="跳转链接")
    sort = Column(Integer, default=0, comment="排序")
    status = Column(Integer, default=1, comment="1=显示, 0=隐藏")


class EduAgreement(TimestampMixin, Base):
    """协议表 (edu_agreement)"""

    __tablename__ = "edu_agreement"

    id = id_column()
    title = Column(String(200), nullable=False, comment="协议标题")
    content = Column(Text, nullable=True, comment="协议内容")
    type = Column(String(50), default="user", comment="user/privacy")
    status = Column(Integer, default=1, comment="1=生效, 0=失效")


# ---------------------------------------------------------------------------
# 内容模块
# ---------------------------------------------------------------------------


class EduArticle(TimestampMixin, Base):
    """文章表 (edu_article)"""

    __tablename__ = "edu_article"

    id = id_column()
    title = Column(String(200), nullable=False, comment="标题")
    content = Column(Text, nullable=True, comment="内容")
    summary = Column(String(500), nullable=True, comment="摘要")
    cover_image = Column(String(500), nullable=True, comment="封面图")
    author_id = Column(BigInteger, nullable=True, comment="作者id")
    author_name = Column(String(100), nullable=True, comment="作者名称")
    category_id = Column(BigInteger, nullable=True, comment="分类id")
    view_count = Column(Integer, default=0, comment="浏览量")
    like_count = Column(Integer, default=0, comment="点赞量")
    is_top = Column(Boolean, default=False, comment="是否置顶")
    is_recommend = Column(Boolean, default=False, comment="是否推荐")
    status = Column(Integer, default=1, comment="0=draft, 1=published")


class EduNews(TimestampMixin, Base):
    """资讯表 (edu_news)"""

    __tablename__ = "edu_news"

    id = id_column()
    title = Column(String(200), nullable=False, comment="标题")
    content = Column(Text, nullable=True, comment="内容")
    summary = Column(String(500), nullable=True, comment="摘要")
    cover_image = Column(String(500), nullable=True, comment="封面图")
    author_id = Column(BigInteger, nullable=True, comment="作者id")
    category_id = Column(BigInteger, nullable=True, comment="分类id")
    view_count = Column(Integer, default=0, comment="浏览量")
    is_top = Column(Boolean, default=False, comment="是否置顶")
    is_recommend = Column(Boolean, default=False, comment="是否推荐")
    status = Column(Integer, default=1, comment="0=draft, 1=published")


class EduCategory(TimestampMixin, Base):
    """分类表 (edu_category)"""

    __tablename__ = "edu_category"

    id = id_column()
    name = Column(String(100), nullable=False, comment="分类名称")
    pid = Column(BigInteger, default=0, comment="父分类id")
    type = Column(String(50), default="article", comment="article/news/resource")
    sort = Column(Integer, default=0, comment="排序")
    status = Column(Integer, default=1, comment="1=启用, 0=禁用")


# ---------------------------------------------------------------------------
# 教育会员模块 (不同于现有企业 member)
# ---------------------------------------------------------------------------


class EduMember(TimestampMixin, Base):
    """教育会员表 (edu_member)"""

    __tablename__ = "edu_member"

    id = id_column()
    mobile = Column(String(20), nullable=True, comment="手机号")
    email = Column(String(100), nullable=True, comment="邮箱")
    username = Column(String(100), nullable=True, comment="用户名")
    password = Column(String(200), nullable=True, comment="密码(sha256)")
    avatar = Column(String(500), nullable=True, comment="头像")
    nickname = Column(String(100), nullable=True, comment="昵称")
    gender = Column(Integer, default=0, comment="0=未知, 1=男, 2=女")
    status = Column(Integer, default=1, comment="0=pending, 1=active, 2=sealed")
    level_id = Column(BigInteger, nullable=True, comment="等级id")
    company_id = Column(BigInteger, nullable=True, comment="公司id")
    department_id = Column(BigInteger, nullable=True, comment="部门id")
    growth_value = Column(Integer, default=0, comment="成长值")


class EduMemberLevel(TimestampMixin, Base):
    """会员等级表 (edu_member_level)"""

    __tablename__ = "edu_member_level"

    id = id_column()
    name = Column(String(100), nullable=False, comment="等级名称")
    growth_value = Column(Integer, default=0, comment="所需成长值")
    discount = Column(Float, default=1.0, comment="折扣")
    sort = Column(Integer, default=0, comment="排序")


# ---------------------------------------------------------------------------
# 用户中心模块
# ---------------------------------------------------------------------------


class EduUser(TimestampMixin, Base):
    """用户表 (edu_user)"""

    __tablename__ = "edu_user"

    id = id_column()
    mobile = Column(String(20), nullable=True, comment="手机号")
    name = Column(String(100), nullable=True, comment="姓名")
    password = Column(String(200), nullable=True, comment="密码(sha256)")
    company_id = Column(BigInteger, nullable=True, comment="公司id")
    department_id = Column(BigInteger, nullable=True, comment="部门id")
    status = Column(Integer, default=1, comment="1=active, 0=disabled")


class EduDepartment(TimestampMixin, Base):
    """部门表 (edu_department)"""

    __tablename__ = "edu_department"

    id = id_column()
    name = Column(String(100), nullable=False, comment="部门名称")
    pid = Column(BigInteger, default=0, comment="父部门id")
    company_id = Column(BigInteger, nullable=True, comment="公司id")
    sort = Column(Integer, default=0, comment="排序")


# ---------------------------------------------------------------------------
# 支付模块
# ---------------------------------------------------------------------------


class EduTrade(TimestampMixin, Base):
    """交易表 (edu_trade)"""

    __tablename__ = "edu_trade"

    id = id_column()
    trade_no = Column(String(64), nullable=False, comment="交易号")
    order_no = Column(String(64), nullable=True, comment="订单号")
    user_id = Column(BigInteger, nullable=False, comment="用户id")
    amount = Column(BigInteger, default=0, comment="金额(分)")
    pay_type = Column(String(20), default="alipay", comment="alipay/wechat")
    status = Column(Integer, default=0, comment="0=pending, 1=paid, 2=refunded")
    pay_time = Column(DateTime, nullable=True, comment="支付时间")
