"""PostgreSQL-only database configuration.

Creates 3 SQLAlchemy engines (全部指向 PostgreSQL):
  - Engine 1: zhs_platform AI 数据 (agents, payments, users, activities...)
  - Engine 2: zhs_platform 中心数据 (user accounts, auth, tokens)
  - Engine 3: zhs_platform 教学数据 (courses, videos, education)

默认 3 引擎都指向同一个 zhs_platform 数据库, 通过 schema 隔离业务域.
提供 smart table-to-engine routing via SmartDBManager.
"""

import os
from contextlib import contextmanager, suppress

from loguru import logger
from sqlalchemy import create_engine
from sqlalchemy.engine import Engine
from sqlalchemy.orm import declarative_base, sessionmaker

from app.config import settings


def _resolve_db_url(url: str, fallback_db_index: int) -> str:
    """如果 PostgreSQL 不可用, 自动降级到 SQLite 本地文件 (仅本地开发).

    生产环境 (ENV=production/prod/staging) 不允许降级, 直接抛出 RuntimeError.
    """
    if not url.startswith("postgres"):
        return url
    # 生产环境: 不可用直接报错, 不允许降级
    env = os.getenv("ENV", "dev").lower()
    if env in ("production", "prod", "staging"):
        # 生产环境必须连 PostgreSQL, 不降级
        from sqlalchemy import text

        try:
            test_engine = create_engine(url, pool_pre_ping=True, connect_args={"connect_timeout": 2})
            with test_engine.connect() as conn:
                conn.execute(text("SELECT 1"))
            return url
        except Exception as e:
            raise RuntimeError(
                f"[DB] 生产环境 (ENV={env}) PostgreSQL 不可用, 拒绝降级到 SQLite. "
                f"请检查 PostgreSQL 连接: {e}"
            ) from e
        finally:
            try:
                test_engine.dispose()
            except Exception as e:
                logger.debug("销毁测试 engine 失败: %s", e)
    # dev/test 环境: 尝试快速 ping 数据库, 失败则降级到 SQLite
    from sqlalchemy import text

    try:
        test_engine = create_engine(url, pool_pre_ping=True, connect_args={"connect_timeout": 2})
        with test_engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        return url
    except Exception:
        # 降级到 SQLite (仅 dev/test 环境)
        sqlite_path = os.path.abspath(f".zhs_db_fallback_{fallback_db_index}.sqlite")
        logger.warning(f"[DB Fallback] postgresql unavailable, using SQLite: {sqlite_path}")
        return f"sqlite:///{sqlite_path}"
    finally:
        try:
            test_engine.dispose()
        except Exception as e:
            logger.debug("销毁测试 engine 失败: %s", e)


def _build_engine(url: str, pool_size: int, max_overflow: int, pool_recycle: int, pre_ping: bool, fallback_idx: int):
    resolved = _resolve_db_url(url, fallback_idx)
    if resolved.startswith("sqlite"):
        # SQLite 不支持连接池参数
        return create_engine(resolved, connect_args={"check_same_thread": False}, pool_pre_ping=True)
    return create_engine(
        resolved,
        pool_size=pool_size,
        max_overflow=max_overflow,
        pool_recycle=pool_recycle,
        pool_pre_ping=pre_ping,
        echo=settings.API_DEBUG,
    )


engine1 = _build_engine(
    settings.DB1_URL,
    settings.DB1_POOL_SIZE,
    settings.DB1_MAX_OVERFLOW,
    settings.DB1_POOL_RECYCLE,
    settings.DB1_PRE_PING,
    1,
)

engine2 = _build_engine(
    settings.DB2_URL,
    settings.DB2_POOL_SIZE,
    settings.DB2_MAX_OVERFLOW,
    settings.DB2_POOL_RECYCLE,
    settings.DB2_PRE_PING,
    2,
)

engine3 = _build_engine(
    settings.DB3_URL,
    settings.DB3_POOL_SIZE,
    settings.DB3_MAX_OVERFLOW,
    settings.DB3_POOL_RECYCLE,
    settings.DB3_PRE_PING,
    3,
)

ENGINES = {
    "ai": engine1,
    "center": engine2,
    "course": engine3,
}

# Session factories
SessionFactory1 = sessionmaker(bind=engine1)
SessionFactory2 = sessionmaker(bind=engine2)
SessionFactory3 = sessionmaker(bind=engine3)

# Base class for declarative models
# 简化: Base/Base1/Base2/Base3 共享同一 metadata 对象.
# 这样所有 from app.database import Base 的 model (sys_models/agent_models/payment_models 等)
# 继承的表都进入统一 metadata, create_all() 一次性创建到任一 engine.
# dev SQLite 模式下, 三个 engine 都连同一个本地 .sqlite, 全部表可用;
# 生产 PG 模式下, CENTER_TABLES/COURSE_TABLES 的 sessionmaker 路由到对应 PG 库.
_BaseObj = declarative_base()
Base = _BaseObj
Base1 = _BaseObj
Base2 = _BaseObj
Base3 = _BaseObj


# ---------------------------------------------------------------------------
# Smart DB routing
# ---------------------------------------------------------------------------

# Tables belonging to each database
AI_PROJECT_TABLES = {
    # Agents
    "agents",
    "zhs_agent_category",
    "agent_category_link",
    "zhs_agent_rule",
    "agent_rule_param",
    "zhs_agent_need_task",
    "agent_callbacks",
    "agent_configs",
    "agent_billings",
    "agent_heat_stats",
    # Agent commerce
    "zhs_agent_buy",
    "zhs_agent_examine",
    "zhs_agent_developer",
    "zhs_agent_settlement",
    "zhs_agent_withdrawal_detail",
    "zhs_developer_link",
    # Commerce
    "zhs_order",
    "zhs_product",
    "zhs_commission_flow",
    "zhs_withdrawal_flow",
    "zhs_operate_token_flow",
    "zhs_identity_proportion",
    # Activities & content
    "zhs_activity",
    "zhs_banner_carousel",
    "zhs_information",
    "zhs_dictionary",
    "zhs_popular_courses",
    "zhs_knowledge_planet",
    "zhs_exchange_rate",
    "zhs_resources",
    "zhs_official_information",
    "zhs_product_identity",
    # User agent data
    "zhs_user_agent_context",
    "zhs_user_agent_audio",
    "zhs_user_agent_image",
    "zhs_user_model_chat",
    "video_generation_tasks",
    "agent_buy_scheduled_tasks",
    "zhs_user_agent_free_time",
    # AI
    "zhs_ai_model_info",
    "ai_user_feedback",
    "ai_gc",
    "ai_gc_user_log",
    # Multi-Agent Crew
    "zhs_crew_session",
    "zhs_crew_task",
    "zhs_crew_message",
    # Code generation
    "gen_table",
    "gen_table_column",
    # System (migrated from Admin)
    "admin_user",
    "admin_role",
    "admin_menu",
    "admin_dept",
    "admin_post",
    "admin_user_role",
    "admin_role_menu",
    "admin_role_dept",
    "admin_user_post",
    "admin_config",
    "admin_dict_type",
    "admin_dict_data",
    "admin_oper_log",
    "admin_logininfor",
    "admin_notice",
    "admin_job",
    "admin_job_log",
    "admin_sms_template",
    # App content
    "ai_about_us",
    "ai_contact",
    "ai_news",
    "ai_file_storage",
    "app_content",
    "app_version",
    "tbox_bean",
    "agent_upload",
    "exchange_rate",
    "resource",
    # VIP system
    "vip_level",
    "user_vip",
    # Chat room (migrated from coze_zhs_py chat_room_socket)
    "zhs_station_room",
    "zhs_station_user",
    "zhs_station_letter",
    # Live (migrated from edu server)
    "t_channel_lecturer",
    "t_tencent_cloud_live_stream",
    # Learn (migrated from edu server ihui-ai-edu-learn-service)
    "t_lesson",
    "t_lesson_chapter",
    "t_lesson_chapter_section",
    "t_lesson_category_relation",
    "t_sign_up",
    "t_record",
    "t_record_log",
    "lesson_task",
    "t_rate",
    "t_topic",
    "t_topic_lesson",
    "t_topic_topic_category_relation",
    "t_topic_category",
    "t_topic_category_relation",
    "t_category",
    "t_category_relation",
    "homework",
    "t_homework_record",
    "t_certificate",
    "t_certificate_template",
    "t_certificate_serial_number",
    "t_learn_map",
    "t_learn_map_topic",
    "lesson_access",
    "t_exam_paper_record",
}

CENTER_TABLES = {
    "users",
    "user_margin",
    "user_auth_info",
    "user_third_party_accounts",
    "user_sk_info",
    "oauth_apps",
    "oauth_sessions",
    "oauth_users",
    "oauth_private_keys",
}

COURSE_TABLES = {
    "zhs_course",
    "zhs_course_video",
    "zhs_course_pay",
    "zhs_course_pay_log",
    "zhs_course_audit",
    "zhs_course_platform_log",
    "zhs_course_temp",
    "zhs_course_video_temp",
    "zhs_education_platform",
    "zhs_category_dictionary",
    "zhs_educational_course",
    "zhs_identity",
    "zhs_organization",
    "zhs_user_platform",
    "zhs_user_video_log",
    "zhs_user_video_comment",
    "zhs_user_comment_log",
}


def get_engine_for_table(table_name: str) -> Engine:
    """Route a table name to the correct engine."""
    if table_name in CENTER_TABLES:
        return engine2
    elif table_name in COURSE_TABLES:
        return engine3
    else:
        return engine1


def get_metadata_for_table(table_name: str):
    """Return the SQLAlchemy MetaData that owns a given table name."""
    if table_name in CENTER_TABLES:
        return Base2.metadata
    if table_name in COURSE_TABLES:
        return Base3.metadata
    return Base1.metadata


def get_session_for_table(table_name: str):
    """Get the appropriate sessionmaker for a table."""
    if table_name in CENTER_TABLES:
        return SessionFactory2
    elif table_name in COURSE_TABLES:
        return SessionFactory3
    else:
        return SessionFactory1


def create_all_per_db() -> None:
    """Create all tables. Base/Base1/Base2/Base3 share metadata, so once is enough.

    dev 模式三个 engine 都连同一 SQLite 文件, create_all(engine1) 即可;
    生产模式各 engine 连接不同 PG 库, 用 shared metadata 一次创建到所有 engine.
    """
    import app.models  # noqa: F401  trigger model imports

    for eng in (engine1, engine2, engine3):
        try:
            Base.metadata.create_all(bind=eng, checkfirst=True)
        except Exception as e:
            logger.warning(f"[create_all_per_db] engine bind failed: {e}")


def drop_all_per_db() -> None:
    """Drop all tables on each engine. Use with care (mainly for tests)."""
    import app.models  # noqa: F401

    for eng in (engine1, engine2, engine3):
        try:
            Base.metadata.drop_all(bind=eng, checkfirst=True)
        except Exception as e:
            logger.warning(f"[drop_all_per_db] engine bind failed: {e}")


@contextmanager
def get_session(factory: object | None = None):
    """Default session context manager.

    Usage: with get_session() as db: or with get_session(factory=SessionFactory1) as db:
    Auto commit (no exception) / rollback (exception) / close.
    """
    if factory is None:
        factory = SessionFactory1
    db = factory()
    try:
        yield db
        db.commit()
    except Exception:
        with suppress(Exception):
            db.rollback()
        raise
    finally:
        with suppress(Exception):
            db.close()


# ---------------------------------------------------------------------------
# Health check
# ---------------------------------------------------------------------------


def check_database_health() -> dict:
    """Test all database connections."""
    results = {}
    for name, eng in ENGINES.items():
        try:
            eng.connect().close()
            results[name] = "ok"
        except Exception as e:
            results[name] = f"error: {e}"
    return results


# ---------------------------------------------------------------------------
# Multi-tenant routing registration (Proposal 102 Phase 1)
# ---------------------------------------------------------------------------
# Single-tenant mode (default, MULTI_TENANT_ENABLED=False) does not register hooks
# Multi-tenant mode (True) registers search_path switch hook per engine.


def _register_tenant_routing_if_enabled() -> None:
    """Conditional registration of search_path routing (only for multi-tenant mode)."""
    from app.core.tenant_filter import register_tenant_routing

    for eng in (engine1, engine2, engine3):
        try:
            register_tenant_routing(eng)
        except Exception:
            # Registration failure doesn't affect engine usage, single-tenant also bypasses
            pass


_register_tenant_routing_if_enabled()
