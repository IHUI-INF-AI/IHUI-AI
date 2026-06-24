"""
会员服务数据模型 (迁移自 ihui-ai-edu-member-service)

补全 H:\\edu client\\...\\ihui-ai-edu-member-service 11 个 entity
(原 G 盘 identity_models.py / user_models.py 缺失的 5 大类业务表).
"""

from sqlalchemy import BigInteger, Boolean, Column, Date, Index, Integer, String, Text

from app.database import Base
from app.models.base import TimestampMixin, id_column


class EduMember(TimestampMixin, Base):
    """会员主表 (迁移自 H:ihui-ai-edu-member-service\\Member).

    - 与 G 盘 user_models.User (zhs_member) 并存
    - 这里存的是 edu 微服务的 t_member 完整字段
    """

    __tablename__ = "edu_member"
    __table_args__ = (
        Index("idx_em_username", "username"),
        Index("idx_em_mobile", "mobile"),
        Index("idx_em_openid", "wechat_open_id"),
        Index("idx_em_company", "company_id"),
        Index("idx_em_status", "status"),
    )

    id = id_column(comment="ID")
    wechat_open_id = Column(String(100), nullable=True, comment="微信openId")
    wechat_union_id = Column(String(100), nullable=True, comment="微信unionId")
    username = Column(String(100), nullable=True, comment="登陆账号")
    password = Column(String(200), nullable=True, comment="密码(加密)")
    code = Column(String(100), nullable=True, comment="工号")
    name = Column(String(100), nullable=True, comment="姓名")
    status = Column(Integer, default=1, comment="0=禁用 1=正常")
    gender = Column(String(10), nullable=True, comment="性别")
    telephone = Column(String(50), nullable=True, comment="办公电话")
    mobile = Column(String(20), nullable=True, comment="移动电话")
    email = Column(String(100), nullable=True, comment="邮箱")
    birthday = Column(Date, nullable=True, comment="生日")
    avatar = Column(String(500), nullable=True, comment="头像")
    expire_time = Column(String(50), nullable=True, comment="过期时间")
    description = Column(String(500), nullable=True, comment="简介")
    company_id = Column(BigInteger, nullable=True, comment="公司id")
    realname = Column(String(100), nullable=True, comment="真实姓名")
    id_photo = Column(String(500), nullable=True, comment="证件照片")


class EduMemberLevel(TimestampMixin, Base):
    """会员等级 (迁移自 H:ihui-ai-edu-member-service\\MemberLevel)."""

    __tablename__ = "edu_member_level"

    id = id_column(comment="ID")
    name = Column(String(100), nullable=False, comment="等级名称")
    description = Column(String(500), nullable=True, comment="描述")
    conditions = Column(BigInteger, default=0, comment="升级条件(经验值/消费额等)")


class EduMemberLevelRelation(TimestampMixin, Base):
    """会员-等级多对多关联 (迁移自 H:ihui-ai-edu-member-service\\MemberLevelRelation)."""

    __tablename__ = "edu_member_level_relation"
    __table_args__ = (
        Index("idx_emlr_member", "member_id"),
        Index("idx_emlr_level", "level_id"),
    )

    id = id_column(comment="ID")
    member_id = Column(String(64), nullable=False, comment="会员UUID")
    level_id = Column(BigInteger, nullable=False, comment="等级ID")


class EduMemberCompany(TimestampMixin, Base):
    """企业/公司 (迁移自 H:ihui-ai-edu-member-service\\MemberCompany)."""

    __tablename__ = "edu_member_company"
    __table_args__ = (
        Index("idx_emc_status", "status"),
        Index("idx_emc_type", "company_type_id"),
    )

    id = id_column(comment="ID")
    name = Column(String(200), nullable=False, comment="公司名称")
    image = Column(String(500), nullable=True, comment="logo")
    mobile = Column(String(20), nullable=True, comment="联系电话")
    email = Column(String(100), nullable=True, comment="邮箱")
    status = Column(Integer, default=1, comment="0=禁用 1=正常")
    sort_order = Column(Integer, default=0, comment="排序 越大越靠前")
    company_type_id = Column(BigInteger, nullable=True, comment="公司类型ID")


class EduMemberCompanyType(TimestampMixin, Base):
    """公司类型 (迁移自 H:ihui-ai-edu-member-service\\MemberCompanyType)."""

    __tablename__ = "edu_member_company_type"

    id = id_column(comment="ID")
    name = Column(String(100), nullable=False, comment="类型名称")
    status = Column(Integer, default=1, comment="0=禁用 1=正常")
    sort_order = Column(Integer, default=0, comment="排序 越大越靠前")
    member_maximum = Column(Integer, default=0, comment="会员最大数量")


class EduMemberCompanyMemberRelation(TimestampMixin, Base):
    """会员-公司多对多关联 (迁移自 H:ihui-ai-edu-member-service\\MemberCompanyMemberRelation)."""

    __tablename__ = "edu_member_company_member_relation"
    __table_args__ = (
        Index("idx_emcmr_member", "member_id"),
        Index("idx_emcmr_company", "member_company_id"),
    )

    id = id_column(comment="ID")
    member_id = Column(String(64), nullable=False, comment="会员UUID")
    member_company_id = Column(BigInteger, nullable=False, comment="公司ID")


class EduMemberTag(TimestampMixin, Base):
    """会员标签 (迁移自 H:ihui-ai-edu-member-service\\MemberTag)."""

    __tablename__ = "edu_member_tag"

    id = id_column(comment="ID")
    name = Column(String(100), nullable=False, comment="标签名称")
    sort_order = Column(Integer, default=0, comment="排序")


class EduMemberTagMemberRelation(TimestampMixin, Base):
    """会员-标签多对多关联 (迁移自 H:ihui-ai-edu-member-service\\MemberTagMemberRelation)."""

    __tablename__ = "edu_member_tag_member_relation"
    __table_args__ = (
        Index("idx_emtmr_member", "member_id"),
        Index("idx_emtmr_tag", "member_tag_id"),
    )

    id = id_column(comment="ID")
    member_id = Column(String(64), nullable=False, comment="会员UUID")
    member_tag_id = Column(BigInteger, nullable=False, comment="标签ID")


class EduMemberPost(TimestampMixin, Base):
    """岗位 (迁移自 H:ihui-ai-edu-member-service\\MemberPost)."""

    __tablename__ = "edu_member_post"

    id = id_column(comment="ID")
    name = Column(String(100), nullable=False, comment="岗位名称")
    sort_order = Column(Integer, default=0, comment="排序")
    status = Column(Integer, default=1, comment="0=禁用 1=正常")


class EduMemberPostMemberRelation(TimestampMixin, Base):
    """会员-岗位多对多关联 (迁移自 H:ihui-ai-edu-member-service\\MemberPostMemberRelation)."""

    __tablename__ = "edu_member_post_member_relation"
    __table_args__ = (
        Index("idx_empmr_member", "member_id"),
        Index("idx_empmr_post", "member_post_id"),
    )

    id = id_column(comment="ID")
    member_id = Column(String(64), nullable=False, comment="会员UUID")
    member_post_id = Column(BigInteger, nullable=False, comment="岗位ID")


class EduMemberGroup(TimestampMixin, Base):
    """分组 (迁移自 H:ihui-ai-edu-member-service\\MemberGroup)."""

    __tablename__ = "edu_member_group"

    id = id_column(comment="ID")
    name = Column(String(100), nullable=False, comment="分组名称")
    sort_order = Column(Integer, default=0, comment="排序")
    status = Column(Integer, default=1, comment="0=禁用 1=正常")


class EduMemberGroupMemberRelation(TimestampMixin, Base):
    """会员-分组多对多关联 (迁移自 H:ihui-ai-edu-member-service\\MemberGroupMemberRelation)."""

    __tablename__ = "edu_member_group_member_relation"
    __table_args__ = (
        Index("idx_emgmr_member", "member_id"),
        Index("idx_emgmr_group", "member_group_id"),
    )

    id = id_column(comment="ID")
    member_id = Column(String(64), nullable=False, comment="会员UUID")
    member_group_id = Column(BigInteger, nullable=False, comment="分组ID")


class EduCheckIn(TimestampMixin, Base):
    """签到 (迁移自 H:ihui-ai-edu-member-service\\CheckIn)."""

    __tablename__ = "edu_check_in"
    __table_args__ = (Index("idx_eci_member", "member_id"),)

    id = id_column(comment="ID")
    member_id = Column(String(64), nullable=False, comment="会员UUID")
    continuous_num = Column(Integer, default=0, comment="连续签到数量")


class EduCheckInRecord(TimestampMixin, Base):
    """签到记录 (迁移自 H:ihui-ai-edu-member-service\\CheckInRecord)."""

    __tablename__ = "edu_check_in_record"
    __table_args__ = (
        Index("idx_ecir_member", "member_id"),
        Index("idx_ecir_type", "type"),
    )

    id = id_column(comment="ID")
    member_id = Column(String(64), nullable=False, comment="会员UUID")
    type = Column(Integer, default=0, comment="签到类型 0=普通 1=补签")


class EduFollow(TimestampMixin, Base):
    """关注 (迁移自 H:ihui-ai-edu-member-service\\Follow)."""

    __tablename__ = "edu_follow"
    __table_args__ = (
        Index("idx_ef_member", "member_id"),
        Index("idx_ef_follow", "follow_member_id"),
        Index("idx_ef_status", "status"),
    )

    id = id_column(comment="ID")
    member_id = Column(String(64), nullable=False, comment="会员UUID")
    follow_member_id = Column(String(64), nullable=False, comment="被关注者UUID")
    status = Column(Integer, default=1, comment="0=取消关注 1=关注中")
