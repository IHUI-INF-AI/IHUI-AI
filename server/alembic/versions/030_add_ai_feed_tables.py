"""add ai feed tables (hot_item/snapshot/trend_signal/source)

Revision ID: 030_add_ai_feed_tables
Revises: 029_add_unique_admin_user_phone_email
Create Date: 2026-07-06

AI 动态/资讯聚合模块(对标 insprira):
  - ai_feed_source       数据源配置(DailyHotApi 平台 + RSSHub 路由 + 官方 API)
  - ai_feed_hot_item     条目主表(去重聚合, 含 LLM 分类/摘要缓存)
  - ai_feed_snapshot     每日快照(排名/热度, 趋势计算原料)
  - ai_feed_trend_signal 预计算趋势(rising/stable/cooling/new)

迁移采用幂等写法(inspect 检查存在性), 兼容 SQLite(dev) 与 PostgreSQL(生产).
"""
import sqlalchemy as sa
from alembic import op

revision = "030_add_ai_feed_tables"
down_revision = "029_add_unique_admin_user_phone_email"
branch_labels = None
depends_on = None


def _table_exists(bind, table_name: str) -> bool:
    inspector = sa.inspect(bind)
    return table_name in inspector.get_table_names()


def _index_exists(bind, table_name: str, index_name: str) -> bool:
    inspector = sa.inspect(bind)
    try:
        return any(i["name"] == index_name for i in inspector.get_indexes(table_name))
    except Exception:
        return False


def upgrade() -> None:
    bind = op.get_bind()

    # ------------------------------------------------------------------
    # 1. ai_feed_source — 数据源配置表
    # ------------------------------------------------------------------
    if not _table_exists(bind, "ai_feed_source"):
        op.create_table(
            "ai_feed_source",
            sa.Column("id", sa.Integer().with_variant(sa.BigInteger(), "postgresql"),
                      primary_key=True, autoincrement=True, comment="数据源ID"),
            sa.Column("source_code", sa.String(64), nullable=False, comment="源短码"),
            sa.Column("source_name", sa.String(100), nullable=False, comment="源显示名"),
            sa.Column("source_type", sa.String(32), nullable=False, server_default="hotlist", comment="hotlist/rss/api"),
            sa.Column("endpoint", sa.String(255), nullable=True, comment="平台码/路由/端点"),
            sa.Column("category", sa.String(64), nullable=False, server_default="general", comment="分类"),
            sa.Column("icon", sa.String(255), nullable=True, comment="图标"),
            sa.Column("color", sa.String(16), nullable=True, comment="主题色"),
            sa.Column("enabled", sa.Boolean, nullable=False, server_default=sa.text("1"), comment="是否启用"),
            sa.Column("sort_order", sa.Integer, nullable=False, server_default="100", comment="排序"),
            sa.Column("fetch_interval_minutes", sa.Integer, nullable=False, server_default="60", comment="采集间隔分钟"),
            sa.Column("last_fetch_at", sa.DateTime, nullable=True, comment="上次采集时间"),
            sa.Column("last_fetch_status", sa.String(32), nullable=True, comment="上次采集状态"),
            sa.Column("last_fetch_count", sa.Integer, nullable=True, comment="上次采集条数"),
            sa.Column("description", sa.String(500), nullable=True, comment="源描述"),
            sa.Column("created_at", sa.DateTime, server_default=sa.text("CURRENT_TIMESTAMP"), comment="创建时间"),
            sa.Column("updated_at", sa.DateTime, server_default=sa.text("CURRENT_TIMESTAMP"), comment="更新时间"),
            sa.UniqueConstraint("source_code", name="uq_ai_feed_source_code"),
            sa.Index("ix_ai_feed_source_enabled", "enabled"),
            sa.Index("ix_ai_feed_source_sort", "sort_order"),
        )

    # ------------------------------------------------------------------
    # 2. ai_feed_hot_item — 条目主表
    # ------------------------------------------------------------------
    if not _table_exists(bind, "ai_feed_hot_item"):
        op.create_table(
            "ai_feed_hot_item",
            sa.Column("id", sa.Integer().with_variant(sa.BigInteger(), "postgresql"),
                      primary_key=True, autoincrement=True, comment="条目ID"),
            sa.Column("source_code", sa.String(64), nullable=False, comment="来源源码"),
            sa.Column("platform_item_id", sa.String(128), nullable=False, comment="平台条目ID"),
            sa.Column("title", sa.String(500), nullable=False, comment="标题"),
            sa.Column("summary", sa.Text, nullable=True, comment="摘要"),
            sa.Column("url", sa.String(1000), nullable=True, comment="原文链接"),
            sa.Column("cover_url", sa.String(1000), nullable=True, comment="封面图"),
            sa.Column("author", sa.String(200), nullable=True, comment="作者"),
            sa.Column("current_rank", sa.Integer, nullable=True, comment="当前排名"),
            sa.Column("current_hot", sa.BigInteger, nullable=True, comment="当前热度值"),
            sa.Column("publish_time", sa.DateTime, nullable=True, comment="发布时间"),
            sa.Column("first_seen_at", sa.DateTime, nullable=False, server_default=sa.text("CURRENT_TIMESTAMP"), comment="首次采集"),
            sa.Column("last_seen_at", sa.DateTime, nullable=False, server_default=sa.text("CURRENT_TIMESTAMP"), comment="最近采集"),
            sa.Column("llm_category", sa.String(64), nullable=True, comment="LLM分类"),
            sa.Column("llm_tags", sa.String(500), nullable=True, comment="LLM标签JSON"),
            sa.Column("llm_summary", sa.Text, nullable=True, comment="LLM摘要"),
            sa.Column("llm_processed_at", sa.DateTime, nullable=True, comment="LLM处理时间"),
            sa.Column("trend_tag", sa.String(16), nullable=True, comment="趋势标签"),
            sa.Column("trend_growth_pct", sa.Float, nullable=True, comment="7天增长率%"),
            sa.Column("title_en", sa.String(500), nullable=True, comment="英文标题"),
            sa.Column("title_ja", sa.String(500), nullable=True, comment="日文标题"),
            sa.Column("title_ko", sa.String(500), nullable=True, comment="韩文标题"),
            sa.Column("created_at", sa.DateTime, server_default=sa.text("CURRENT_TIMESTAMP")),
            sa.Column("updated_at", sa.DateTime, server_default=sa.text("CURRENT_TIMESTAMP")),
            sa.UniqueConstraint("source_code", "platform_item_id", name="uq_ai_feed_item_source_pid"),
            sa.Index("ix_ai_feed_item_source", "source_code"),
            sa.Index("ix_ai_feed_item_category", "llm_category"),
            sa.Index("ix_ai_feed_item_trend", "trend_tag"),
            sa.Index("ix_ai_feed_item_hot", "current_hot"),
            sa.Index("ix_ai_feed_item_last_seen", "last_seen_at"),
        )

    # ------------------------------------------------------------------
    # 3. ai_feed_snapshot — 每日快照表
    # ------------------------------------------------------------------
    if not _table_exists(bind, "ai_feed_snapshot"):
        op.create_table(
            "ai_feed_snapshot",
            sa.Column("id", sa.Integer().with_variant(sa.BigInteger(), "postgresql"),
                      primary_key=True, autoincrement=True, comment="快照ID"),
            sa.Column("source_code", sa.String(64), nullable=False, comment="来源源码"),
            sa.Column("platform_item_id", sa.String(128), nullable=False, comment="平台条目ID"),
            sa.Column("item_id", sa.Integer, nullable=True, comment="关联条目ID"),
            sa.Column("title", sa.String(500), nullable=False, comment="快照时标题"),
            sa.Column("rank", sa.Integer, nullable=True, comment="当日排名"),
            sa.Column("hot_value", sa.BigInteger, nullable=True, comment="当日热度值"),
            sa.Column("snapshot_date", sa.Date, nullable=False, comment="快照日期"),
            sa.Column("captured_at", sa.DateTime, nullable=False, server_default=sa.text("CURRENT_TIMESTAMP"), comment="采集时间"),
            sa.Column("created_at", sa.DateTime, server_default=sa.text("CURRENT_TIMESTAMP")),
            sa.Column("updated_at", sa.DateTime, server_default=sa.text("CURRENT_TIMESTAMP")),
            sa.UniqueConstraint("source_code", "platform_item_id", "snapshot_date",
                                name="uq_ai_feed_snapshot_src_pid_date"),
            sa.Index("ix_ai_feed_snapshot_source_date", "source_code", "snapshot_date"),
            sa.Index("ix_ai_feed_snapshot_date", "snapshot_date"),
        )

    # ------------------------------------------------------------------
    # 4. ai_feed_trend_signal — 预计算趋势表
    # ------------------------------------------------------------------
    if not _table_exists(bind, "ai_feed_trend_signal"):
        op.create_table(
            "ai_feed_trend_signal",
            sa.Column("id", sa.Integer().with_variant(sa.BigInteger(), "postgresql"),
                      primary_key=True, autoincrement=True, comment="趋势信号ID"),
            sa.Column("item_id", sa.Integer, nullable=False, comment="关联条目ID"),
            sa.Column("source_code", sa.String(64), nullable=False, comment="来源源码"),
            sa.Column("platform_item_id", sa.String(128), nullable=False, comment="平台条目ID"),
            sa.Column("window_days", sa.Integer, nullable=False, comment="窗口天数"),
            sa.Column("growth_pct", sa.Float, nullable=True, comment="增长率%"),
            sa.Column("rank_delta", sa.Integer, nullable=True, comment="排名变化"),
            sa.Column("ema_hot", sa.BigInteger, nullable=True, comment="当前EMA热度"),
            sa.Column("hot_then", sa.BigInteger, nullable=True, comment="window天前EMA热度"),
            sa.Column("trend_tag", sa.String(16), nullable=False, server_default="stable", comment="趋势标签"),
            sa.Column("computed_at", sa.DateTime, nullable=False, server_default=sa.text("CURRENT_TIMESTAMP"), comment="计算时间"),
            sa.Column("snapshot_count", sa.Integer, nullable=True, comment="窗口内快照数"),
            sa.Column("created_at", sa.DateTime, server_default=sa.text("CURRENT_TIMESTAMP")),
            sa.Column("updated_at", sa.DateTime, server_default=sa.text("CURRENT_TIMESTAMP")),
            sa.UniqueConstraint("item_id", "window_days", name="uq_ai_feed_trend_item_window"),
            sa.Index("ix_ai_feed_trend_tag", "trend_tag"),
            sa.Index("ix_ai_feed_trend_window", "window_days"),
        )

    # ------------------------------------------------------------------
    # 5. Seed 默认数据源(DailyHotApi 平台 + RSSHub AI 媒体 + 官方 API)
    # ------------------------------------------------------------------
    _seed_default_sources(bind)


def _seed_default_sources(bind) -> None:
    """插入默认数据源配置, 幂等(已存在则跳过)."""
    defaults = [
        # --- DailyHotApi 平台热榜(通用热榜, 默认启用 6 个主流)---
        ("weibo", "微博热搜", "hotlist", "weibo", "general", "#ff6b35", 10, 30),
        ("zhihu", "知乎热榜", "hotlist", "zhihu", "general", "#0084ff", 20, 30),
        ("bilibili", "B站热门", "hotlist", "bilibili", "general", "#fb7299", 30, 30),
        ("douyin", "抖音热点", "hotlist", "douyin", "general", "#000000", 40, 30),
        ("toutiao", "今日头条", "hotlist", "toutiao", "general", "#ff5722", 50, 30),
        ("36kr", "36氪", "hotlist", "36kr", "ai-media", "#4285f4", 60, 30),
        # --- RSSHub AI 媒体(AI 资讯流, 默认启用)---
        ("jiqizhixin", "机器之心", "rss", "jiqizhixin/news", "ai-media", "#1a73e8", 70, 60),
        ("qbitai", "量子位", "rss", "qbitai/news", "ai-media", "#6c5ce7", 80, 60),
        ("xinzhiyuan", "新智元", "rss", "xinzhiyuan", "ai-media", "#0984e3", 90, 60),
        ("ithome-ai", "IT之家AI", "rss", "ithome/category/ai", "ai-media", "#d63031", 100, 60),
        # --- AI 论文(官方 API, 默认启用)---
        ("arxiv", "arXiv AI", "api", "arxiv:cs.AI", "ai-paper", "#b71540", 110, 120),
        ("hf-papers", "HF Daily Papers", "api", "huggingface:daily-papers", "ai-paper", "#ff9f1c", 120, 120),
        # --- 技术社区(默认启用)---
        ("hackernews", "Hacker News", "api", "hn:top", "tech-community", "#ff6600", 130, 60),
        ("v2ex", "V2EX", "hotlist", "v2ex", "tech-community", "#333333", 140, 60),
    ]

    for code, name, stype, endpoint, category, color, sort, interval in defaults:
        # 幂等: 已存在则跳过
        existing = bind.execute(
            sa.text("SELECT id FROM ai_feed_source WHERE source_code = :code"),
            {"code": code},
        ).fetchone()
        if existing:
            continue
        bind.execute(
            sa.text(
                "INSERT INTO ai_feed_source "
                "(source_code, source_name, source_type, endpoint, category, color, "
                " enabled, sort_order, fetch_interval_minutes, last_fetch_status, description) "
                "VALUES (:code, :name, :stype, :endpoint, :category, :color, "
                " 1, :sort, :interval, 'pending', :desc)"
            ),
            {
                "code": code, "name": name, "stype": stype, "endpoint": endpoint,
                "category": category, "color": color, "sort": sort,
                "interval": interval, "desc": f"{name} 数据源",
            },
        )


def downgrade() -> None:
    bind = op.get_bind()
    for table in ("ai_feed_trend_signal", "ai_feed_snapshot", "ai_feed_hot_item", "ai_feed_source"):
        if _table_exists(bind, table):
            op.drop_table(table)
