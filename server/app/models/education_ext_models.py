"""Education extension models (course audit, payment, comments, platform links)."""

from sqlalchemy import BigInteger, Column, DateTime, Index, Integer, String, Text, func

from app.database import Base
from app.models.base import TimestampMixin, id_column


class ZhsCourseAudit(TimestampMixin, Base):
    """Course audit record (zhs_educational_training.zhs_course_audit)."""

    __tablename__ = "zhs_course_audit"

    id = id_column(comment="ID")
    course_id = Column(BigInteger, nullable=False, comment="Course ID")
    audit_status = Column(Integer, default=0, comment="Audit status: 0=pending, 1=approved, 2=rejected")
    auditor = Column(String(64), nullable=True, comment="Auditor UUID")
    audit_time = Column(DateTime, nullable=True, comment="Audit time")
    remark = Column(Text, nullable=True, comment="Audit remark")
    create_time = Column(DateTime, server_default=func.now(), comment="Creation time")


class ZhsCoursePay(TimestampMixin, Base):
    """Course payment record (zhs_educational_training.zhs_course_pay)."""

    __tablename__ = "zhs_course_pay"
    __table_args__ = (Index("ix_zhs_course_pay_status", "status"),)

    id = id_column(comment="ID")
    course_id = Column(BigInteger, nullable=False, comment="Course ID")
    user_uuid = Column(String(64), nullable=False, comment="User UUID")
    order_no = Column(String(64), nullable=True, comment="Order number")
    amount = Column(BigInteger, default=0, comment="Amount in cents")
    status = Column(Integer, default=0, comment="0=unpaid, 1=paid, 2=refunded")
    create_time = Column(DateTime, server_default=func.now(), comment="Creation time")


class ZhsCoursePayLog(TimestampMixin, Base):
    """Course payment log (zhs_educational_training.zhs_course_pay_log)."""

    __tablename__ = "zhs_course_pay_log"

    id = id_column(comment="ID")
    pay_id = Column(BigInteger, nullable=False, comment="Course pay record ID")
    action = Column(String(32), nullable=False, comment="Action: create/pay/refund/notify")
    detail = Column(Text, nullable=True, comment="Action detail JSON")
    create_time = Column(DateTime, server_default=func.now(), comment="Creation time")


class ZhsCoursePlatformLog(TimestampMixin, Base):
    """Course-platform operation log (zhs_educational_training.zhs_course_platform_log)."""

    __tablename__ = "zhs_course_platform_log"

    id = id_column(comment="ID")
    course_id = Column(BigInteger, nullable=False, comment="Course ID")
    platform_id = Column(BigInteger, nullable=False, comment="Platform ID")
    action = Column(String(32), nullable=False, comment="Action: bind/unbind/sync")
    create_time = Column(DateTime, server_default=func.now(), comment="Creation time")


class ZhsCourseTemp(TimestampMixin, Base):
    """Course temporary/staging record (zhs_educational_training.zhs_course_temp)."""

    __tablename__ = "zhs_course_temp"
    __table_args__ = (Index("ix_zhs_course_temp_status", "status"),)

    id = id_column(comment="ID")
    course_name = Column(String(200), nullable=True, comment="Course name")
    status = Column(Integer, default=0, comment="0=draft, 1=submitted, 2=processed")
    create_time = Column(DateTime, server_default=func.now(), comment="Creation time")


class ZhsCourseVideoTemp(TimestampMixin, Base):
    """Course video temporary/staging record (zhs_educational_training.zhs_course_video_temp)."""

    __tablename__ = "zhs_course_video_temp"
    __table_args__ = (Index("ix_zhs_course_video_temp_status", "status"),)

    id = id_column(comment="ID")
    video_name = Column(String(200), nullable=True, comment="Video name")
    status = Column(Integer, default=0, comment="0=draft, 1=submitted, 2=processed")
    create_time = Column(DateTime, server_default=func.now(), comment="Creation time")


class ZhsUserCommentLog(TimestampMixin, Base):
    """User comment action log (zhs_educational_training.zhs_user_comment_log)."""

    __tablename__ = "zhs_user_comment_log"

    id = id_column(comment="ID")
    user_uuid = Column(String(64), nullable=False, comment="User UUID")
    comment_id = Column(BigInteger, nullable=False, comment="Comment ID")
    action = Column(String(32), nullable=False, comment="Action: create/edit/delete/report")
    create_time = Column(DateTime, server_default=func.now(), comment="Creation time")


class ZhsUserPlatform(TimestampMixin, Base):
    """User-platform relationship (zhs_educational_training.zhs_user_platform)."""

    __tablename__ = "zhs_user_platform"
    __table_args__ = (Index("ix_zhs_user_platform_status", "status"),)

    id = id_column(comment="ID")
    user_uuid = Column(String(64), nullable=False, comment="User UUID")
    platform_id = Column(BigInteger, nullable=False, comment="Platform ID")
    status = Column(Integer, default=1, comment="0=disabled, 1=active")
    create_time = Column(DateTime, server_default=func.now(), comment="Creation time")


class ZhsUserVideoComment(TimestampMixin, Base):
    """User video comment (zhs_educational_training.zhs_user_video_comment)."""

    __tablename__ = "zhs_user_video_comment"
    __table_args__ = (
        Index("ix_zhs_user_video_comment_parent_id", "parent_id"),
        Index("ix_zhs_user_video_comment_status", "status"),
    )

    id = id_column(comment="ID")
    video_id = Column(BigInteger, nullable=False, comment="Video ID")
    user_uuid = Column(String(64), nullable=False, comment="User UUID")
    content = Column(Text, nullable=True, comment="Comment content")
    parent_id = Column(BigInteger, default=0, comment="Parent comment ID (0=top-level)")
    status = Column(Integer, default=1, comment="0=hidden, 1=visible")
    create_time = Column(DateTime, server_default=func.now(), comment="Creation time")


class ZhsUserVideoLog(TimestampMixin, Base):
    """User video action log (zhs_educational_training.zhs_user_video_log)."""

    __tablename__ = "zhs_user_video_log"

    id = id_column(comment="ID")
    video_id = Column(BigInteger, nullable=False, comment="Video ID")
    user_uuid = Column(String(64), nullable=False, comment="User UUID")
    action = Column(String(32), nullable=False, comment="Action: view/like/collect/share")
    create_time = Column(DateTime, server_default=func.now(), comment="Creation time")
