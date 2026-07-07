"""AI 动态/资讯聚合模块数据模型.

对标 insprira(灵感熔炉)的热榜聚合 + 趋势分析能力, 但完全自研:
  - 数据源: DailyHotApi(40+ 平台热榜) + RSSHub(AI 媒体资讯) + arXiv/HF Papers/Hacker News
  - 趋势: 每日快照 + pandas EMA 平滑对比, 输出 rising/stable/cooling 三态
  - 智能化: DeepSeek-V3 自动分类 + 摘要生成(批处理降本)

四张表:
  1. ai_feed_source      — 数据源配置(平台/媒体, 支持动态 Tab 启停)
  2. ai_feed_hot_item    — 条目主表(去重聚合, 含 LLM 分类/摘要)
  3. ai_feed_snapshot    — 每日快照(排名/热度值, 趋势计算原料)
  4. ai_feed_trend_signal — 预计算趋势(7/14 天窗口, rising/stable/cooling)

设计要点:
  - 表名前缀 ai_feed_, 与现有 ai_news/ai_gc 命名风格一致
  - 继承 TimestampMixin + Base, 主键用 id_column()(PG BigInteger / SQLite Integer)
  - 归属 AI_PROJECT_TABLES(默认 engine1), 无需跨库
  - source_code 用短码(weibo/zhihu/dy/xhs/arxiv/hf-papers/hn...), 与 DailyHotApi 对齐
  - item_uuid 用 (source_code + platform_item_id) 去重, 避免重复入库
"""

from datetime import datetime

from sqlalchemy import (
    BigInteger,
    Boolean,
    Column,
    Date,
    DateTime,
    Float,
    Index,
    Integer,
    String,
    Text,
    UniqueConstraint,
)

from app.models.base import TimestampMixin, id_column

try:
    from app.database import Base
except ImportError:  # 允许独立 import 时不崩
    from sqlalchemy.orm import declarative_base
    Base = declarative_base()


# ---------------------------------------------------------------------------
# 1. 数据源配置表 — 控制哪些平台/媒体在动态 Tab 中显示
# ---------------------------------------------------------------------------
class AiFeedSource(TimestampMixin, Base):
    """数据源配置: 对应 DailyHotApi 的一个平台 或 RSSHub 的一条路由 或 一个官方 API.

    前端"动态 Tab"由 enabled=True 的 source 驱动, 支持拖拽排序(sort_order).
    """

    __tablename__ = "ai_feed_source"
    __table_args__ = (
        UniqueConstraint("source_code", name="uq_ai_feed_source_code"),
        Index("ix_ai_feed_source_enabled", "enabled"),
        Index("ix_ai_feed_source_sort", "sort_order"),
    )

    id = id_column(comment="数据源ID")
    source_code = Column(String(64), nullable=False, comment="源短码: weibo/zhihu/dy/arxiv/hf-papers/hn")
    source_name = Column(String(100), nullable=False, comment="源显示名: 微博/知乎/抖音/arXiv")
    source_type = Column(String(32), nullable=False, default="hotlist", comment="hotlist/rss/api")
    # DailyHotApi 平台标识(如 weibo/zhihu/bilibili), RSS 源填 rsshub 路由路径
    endpoint = Column(String(255), nullable=True, comment="DailyHotApi 平台码 / RSSHub 路由 / API 端点")
    category = Column(String(64), nullable=False, default="general",
                      comment="分类: general(通用热榜)/ai-media(AI媒体)/ai-paper(AI论文)/tech-community(技术社区)")
    icon = Column(String(255), nullable=True, comment="源图标 URL 或 SVG name")
    color = Column(String(16), nullable=True, comment="源主题色, 如 #ff6b35")
    enabled = Column(Boolean, nullable=False, default=True, comment="是否在动态 Tab 显示")
    sort_order = Column(Integer, nullable=False, default=100, comment="排序(越小越靠前)")
    fetch_interval_minutes = Column(Integer, nullable=False, default=60, comment="采集间隔(分钟)")
    last_fetch_at = Column(DateTime, nullable=True, comment="上次采集时间")
    last_fetch_status = Column(String(32), nullable=True, comment="success/failed/skipped")
    last_fetch_count = Column(Integer, nullable=True, comment="上次采集条数")
    description = Column(String(500), nullable=True, comment="源描述")


# ---------------------------------------------------------------------------
# 2. 条目主表 — 去重聚合的资讯/热榜条目
# ---------------------------------------------------------------------------
class AiFeedHotItem(TimestampMixin, Base):
    """热榜/资讯条目主表.

    一个 (source_code + platform_item_id) 全局唯一, 多日快照复用同一行.
    LLM 分类与摘要缓存在此表, 避免重复调用.
    """

    __tablename__ = "ai_feed_hot_item"
    __table_args__ = (
        UniqueConstraint("source_code", "platform_item_id", name="uq_ai_feed_item_source_pid"),
        Index("ix_ai_feed_item_source", "source_code"),
        Index("ix_ai_feed_item_category", "llm_category"),
        Index("ix_ai_feed_item_trend", "trend_tag"),
        Index("ix_ai_feed_item_hot", "current_hot"),
        Index("ix_ai_feed_item_last_seen", "last_seen_at"),
    )

    id = id_column(comment="条目ID")
    source_code = Column(String(64), nullable=False, comment="来源源码")
    platform_item_id = Column(String(128), nullable=False, comment="平台原始条目ID(DailyHotApi/RSS 的 id)")
    title = Column(String(500), nullable=False, comment="标题")
    summary = Column(Text, nullable=True, comment="摘要(原始或 LLM 生成)")
    url = Column(String(1000), nullable=True, comment="原文链接")
    cover_url = Column(String(1000), nullable=True, comment="封面图 URL")
    author = Column(String(200), nullable=True, comment="作者/账号")
    # 热度数据(最新快照同步)
    current_rank = Column(Integer, nullable=True, comment="当前排名")
    current_hot = Column(BigInteger, nullable=True, comment="当前热度值")
    # 时间
    publish_time = Column(DateTime, nullable=True, comment="发布时间(平台原始)")
    first_seen_at = Column(DateTime, nullable=False, default=datetime.utcnow, comment="首次采集时间")
    last_seen_at = Column(DateTime, nullable=False, default=datetime.utcnow, comment="最近采集时间")
    # LLM 智能字段(批处理生成, 缓存)
    llm_category = Column(String(64), nullable=True,
                          comment="LLM 分类: hotspot/account/source/creation/analysis/retrieval/tool")
    llm_tags = Column(String(500), nullable=True, comment="LLM 标签(JSON 数组字符串)")
    llm_summary = Column(Text, nullable=True, comment="LLM 生成的 50 字摘要")
    llm_processed_at = Column(DateTime, nullable=True, comment="LLM 处理时间")
    # 趋势标签(由 trend_signal 同步, 便于列表快速筛选)
    trend_tag = Column(String(16), nullable=True, comment="趋势标签: rising/stable/cooling/new")
    trend_growth_pct = Column(Float, nullable=True, comment="7天增长率%")
    # 多语言标题缓存(LLM 翻译, 按需生成)
    title_en = Column(String(500), nullable=True, comment="英文标题(LLM 翻译)")
    title_ja = Column(String(500), nullable=True, comment="日文标题")
    title_ko = Column(String(500), nullable=True, comment="韩文标题")


# ---------------------------------------------------------------------------
# 3. 每日快照表 — 趋势计算的原料
# ---------------------------------------------------------------------------
class AiFeedSnapshot(TimestampMixin, Base):
    """每日热榜快照: 记录某条目在某天的排名与热度, 用于 7/14 天趋势对比.

    每日 cron 任务(凌晨 2 点)为每个 enabled source 的 top N 条目写一条快照.
    (source_code, platform_item_id, snapshot_date) 三元组唯一.
    """

    __tablename__ = "ai_feed_snapshot"
    __table_args__ = (
        UniqueConstraint("source_code", "platform_item_id", "snapshot_date",
                         name="uq_ai_feed_snapshot_src_pid_date"),
        Index("ix_ai_feed_snapshot_source_date", "source_code", "snapshot_date"),
        Index("ix_ai_feed_snapshot_date", "snapshot_date"),
    )

    id = id_column(comment="快照ID")
    source_code = Column(String(64), nullable=False, comment="来源源码")
    platform_item_id = Column(String(128), nullable=False, comment="平台条目ID")
    item_id = Column(Integer, nullable=True, comment="关联 ai_feed_hot_item.id(冗余加速查询)")
    title = Column(String(500), nullable=False, comment="快照时标题(冗余, 防止标题变更丢失历史)")
    rank = Column(Integer, nullable=True, comment="当日排名")
    hot_value = Column(BigInteger, nullable=True, comment="当日热度值")
    snapshot_date = Column(Date, nullable=False, default=datetime.utcnow().date, comment="快照日期(仅日期)")
    captured_at = Column(DateTime, nullable=False, default=datetime.utcnow, comment="采集时间戳")


# ---------------------------------------------------------------------------
# 4. 预计算趋势表 — 前端列表直接读取, 零实时计算
# ---------------------------------------------------------------------------
class AiFeedTrendSignal(TimestampMixin, Base):
    """预计算的趋势信号: 每日 cron 任务(凌晨 3 点)用 pandas 计算并刷新.

    对每个有快照的条目, 计算 7 天 / 14 天窗口的增长率与排名变化,
    输出 rising(增长)/stable(稳定)/cooling(冷却)/new(新晋) 四态标签.
    前端列表直接读 trend_tag, 无需实时计算.
    """

    __tablename__ = "ai_feed_trend_signal"
    __table_args__ = (
        UniqueConstraint("item_id", "window_days", name="uq_ai_feed_trend_item_window"),
        Index("ix_ai_feed_trend_tag", "trend_tag"),
        Index("ix_ai_feed_trend_window", "window_days"),
    )

    id = id_column(comment="趋势信号ID")
    item_id = Column(Integer, nullable=False, comment="关联 ai_feed_hot_item.id")
    source_code = Column(String(64), nullable=False, comment="来源源码(冗余)")
    platform_item_id = Column(String(128), nullable=False, comment="平台条目ID(冗余)")
    window_days = Column(Integer, nullable=False, comment="窗口天数: 7 / 14")
    # EMA 平滑后的增长率
    growth_pct = Column(Float, nullable=True, comment="EMA 平滑后增长率%")
    rank_delta = Column(Integer, nullable=True, comment="排名变化(正=上升)")
    ema_hot = Column(BigInteger, nullable=True, comment="当前 EMA 热度值")
    hot_then = Column(BigInteger, nullable=True, comment="window 天前的 EMA 热度值")
    trend_tag = Column(String(16), nullable=False, default="stable",
                       comment="趋势标签: rising/stable/cooling/new")
    computed_at = Column(DateTime, nullable=False, default=datetime.utcnow, comment="计算时间")
    snapshot_count = Column(Integer, nullable=True, comment="窗口内有效快照数(数据质量参考)")
