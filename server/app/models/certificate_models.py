"""证书体系数据模型 (迁移自历史 ihui-ai-edu-learn-service)"""

from sqlalchemy import (
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


class Certificate(TimestampMixin, Base):
    """证书表 (历史 t_certificate)"""

    __tablename__ = "t_certificate"
    __table_args__ = (
        Index("idx_cert_certificate_id", "certificate_id"),
        Index("idx_cert_member_id", "member_id"),
        Index("idx_cert_lesson_id", "lesson_id"),
        Index("idx_cert_status", "status"),
        Index("idx_cert_company_id", "company_id"),
    )

    id = id_column(comment="主键ID")
    deleted = Column(Boolean, nullable=False, default=False, comment="逻辑删除（0-未删除，1-已删除）")
    version = Column(Integer, nullable=False, default=1, comment="乐观锁版本号")
    certificate_id = Column(BigInteger, nullable=True, comment="证书Id")
    code = Column(String(64), nullable=True, comment="证书编号")
    name = Column(String(128), nullable=True, comment="证书的名称")
    description = Column(String(2000), nullable=True, comment="证书的描述")
    awarding_organization = Column(String(128), nullable=True, comment="颁发证书的机构")
    awarder_name = Column(String(64), nullable=True, comment="颁发证书的人员或代表的名称")
    awarder_position = Column(String(64), nullable=True, comment="颁发证书的人员或代表的职位或职称")
    design = Column(String(512), nullable=True, comment="证书模板的设计图片或样式文件（存储URL/路径）")
    award_conditions = Column(String(2000), nullable=True, comment="证书的颁发条件或要求")
    validity_policy = Column(String(1024), nullable=True, comment="证书的有效期限或到期策略")
    award_date = Column(DateTime, nullable=True, comment="证书的颁发日期")
    validity = Column(DateTime, nullable=True, comment="证书的有效期限")
    status = Column(String(32), nullable=True, comment="证书的状态（例如：有效、已过期、作废等）")
    member_id = Column(BigInteger, nullable=True, comment="获证人员的唯一标识符")
    lesson_id = Column(BigInteger, nullable=True, comment="相关课程的唯一标识符")
    lesson_sign_id = Column(BigInteger, nullable=True, comment="课程报名Id")
    lesson_sign_time = Column(DateTime, nullable=True, comment="课程报名时间")
    lesson_complete_time = Column(DateTime, nullable=True, comment="课程报名学习完成时间")
    score = Column(String(32), nullable=True, comment="获证人员的成绩（支持分数/等级，如95/优秀）")
    company_id = Column(BigInteger, nullable=True, comment="公司Id")
    create_user_id = Column(BigInteger, nullable=True, comment="创建人Id")
    create_user_name = Column(String(64), nullable=True, comment="创建人名称")
    update_user_id = Column(BigInteger, nullable=True, comment="修改人Id")
    update_user_name = Column(String(64), nullable=True, comment="修改人名称")


class CertificateTemplate(TimestampMixin, Base):
    """证书模板表 (历史 t_certificate_template)"""

    __tablename__ = "t_certificate_template"
    __table_args__ = (
        Index("idx_cert_tpl_status", "status"),
        Index("idx_cert_tpl_company_id", "company_id"),
        Index("idx_cert_tpl_create_time", "created_at"),
    )

    id = id_column(comment="主键id")
    name = Column(String(200), nullable=False, default="", comment="证书模板的名称")
    description = Column(String(1000), nullable=True, default="", comment="证书模板的描述")
    awarding_organization = Column(String(200), nullable=True, default="", comment="颁发证书的机构")
    awarder_name = Column(String(100), nullable=True, default="", comment="颁发证书的人员或代表的名称")
    awarder_position = Column(String(100), nullable=True, default="", comment="颁发证书的人员或代表的职位或职称")
    design = Column(String(1000), nullable=True, default="", comment="证书模板的设计图片或样式文件（图片URL）")
    award_conditions = Column(String(500), nullable=True, default="", comment="证书的颁发条件或要求")
    validity_policy = Column(String(500), nullable=True, default="", comment="证书的有效期限或到期策略")
    status = Column(String(30), nullable=False, default="inactive", comment="状态：active-启用, inactive-禁用, deleted-已删除")
    company_id = Column(BigInteger, nullable=True, comment="公司Id")
    create_user_id = Column(BigInteger, nullable=True, comment="创建人Id")
    create_user_name = Column(String(100), nullable=True, default="", comment="创建人名称")
    update_user_id = Column(BigInteger, nullable=True, comment="修改人Id")
    update_user_name = Column(String(100), nullable=True, default="", comment="修改人名称")
