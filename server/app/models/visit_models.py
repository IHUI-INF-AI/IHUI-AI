"""
访问追踪数据模型 (迁移自 ihui-ai-edu-visit-tracking-service)
"""

from sqlalchemy import (
    Column,
    Float,
    Index,
    Integer,
    String,
    Text,
)

from app.database import Base
from app.models.base import TimestampMixin, id_column


class VisitLog(TimestampMixin, Base):
    """访问日志 - 用户访问行为"""

    __tablename__ = "visit_log"
    __table_args__ = (
        Index("idx_vl_user", "user_id"),
        Index("idx_vl_path", "path"),
        Index("idx_vl_time", "created_at"),
        Index("idx_vl_target", "target_type", "target_id"),)

    id = id_column(comment="ID")
    user_id = Column(String(64), nullable=True, comment="用户UUID,未登录为None")
    user_name = Column(String(100), nullable=True)
    session_id = Column(String(64), nullable=True, comment="会话ID")
    path = Column(String(500), nullable=False, comment="访问路径")
    method = Column(String(10), nullable=True, comment="HTTP方法")
    query_params = Column(Text, nullable=True, comment="查询参数JSON")
    referer = Column(String(500), nullable=True)
    user_agent = Column(String(500), nullable=True)
    ip = Column(String(50), nullable=True)
    device = Column(String(50), nullable=True, comment="设备: pc/mobile/tablet")
    os = Column(String(50), nullable=True)
    browser = Column(String(50), nullable=True)
    target_type = Column(String(50), nullable=True, comment="访问目标类型")
    target_id = Column(String(64), nullable=True, comment="访问目标ID")
    duration = Column(Integer, default=0, comment="停留时长(秒)")
    source = Column(String(50), nullable=True, comment="来源渠道")

class VisitStats(TimestampMixin, Base):
    """访问统计 - 汇总"""

    __tablename__ = "visit_stats"
    __table_args__ = (
        Index("idx_vs_date", "stat_date"),
        Index("idx_vs_target", "target_type", "target_id"),)

    id = id_column(comment="ID")
    stat_date = Column(String(20), nullable=False, comment="统计日期 YYYY-MM-DD")
    stat_type = Column(String(20), nullable=False, comment="daily/hourly/monthly")
    target_type = Column(String(50), nullable=True, comment="目标类型")
    target_id = Column(String(64), nullable=True, comment="目标ID")
    pv = Column(Integer, default=0, comment="PV")
    uv = Column(Integer, default=0, comment="UV")
    ip_count = Column(Integer, default=0, comment="IP数")
    new_user = Column(Integer, default=0, comment="新用户数")
    avg_duration = Column(Integer, default=0, comment="平均停留(秒)")
    bounce_rate = Column(Float, default=0, comment="跳出率")

class VisitSource(TimestampMixin, Base):
    """访问来源"""

    __tablename__ = "visit_source"
    __table_args__ = (
        Index("idx_vs2_date", "stat_date"),)

    id = id_column(comment="ID")
    stat_date = Column(String(20), nullable=False)
    source = Column(String(50), nullable=False, comment="来源: search/direct/ad/... ")
    visit_count = Column(Integer, default=0)

class VisitPage(TimestampMixin, Base):
    """页面统计"""

    __tablename__ = "visit_page"
    __table_args__ = (
        Index("idx_vp_date", "stat_date"),)

    id = id_column(comment="ID")
    stat_date = Column(String(20), nullable=False)
    path = Column(String(500), nullable=False)
    visit_count = Column(Integer, default=0)
    uv = Column(Integer, default=0)
    avg_duration = Column(Integer, default=0)
