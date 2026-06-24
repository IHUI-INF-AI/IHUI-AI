"""
FastAPI dependency injection - database sessions, auth, current user.

Refactored to resolve naming conflicts:
- Uses typed session generators with clear names
- Eliminates confusion between dependency injection and context manager
"""

from collections.abc import Generator

from sqlalchemy.orm import Session

from app.config import settings
from app.database import SessionFactory1, SessionFactory2, SessionFactory3
# 2026-06-24: decode_access_token 已不再使用 (get_current_user_uuid 已移除, 统一到 app.security)

# ---------------------------------------------------------------------------
# Database session generators (for FastAPI Depends)
# ---------------------------------------------------------------------------


def get_ai_db_session() -> Generator[Session, None, None]:
    """
    Get SQLAlchemy session for zhs_ai_project database.

    This is the primary database for:
    - Agents, orders, payments, AI models
    - System users, roles, menus
    - Activity and content management

    Usage: Depends(get_ai_db_session)
    """
    db = SessionFactory1()
    try:
        yield db
        db.commit()
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


def get_center_db_session() -> Generator[Session, None, None]:
    """
    Get SQLAlchemy session for zhs_center_project database.

    This database handles:
    - User accounts and authentication
    - OAuth sessions and tokens
    - User SK info

    Usage: Depends(get_center_db_session)
    """
    db = SessionFactory2()
    try:
        yield db
        db.commit()
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


def get_course_db_session() -> Generator[Session, None, None]:
    """
    Get SQLAlchemy session for zhs_educational_training database.

    This database manages:
    - Courses and videos
    - User progress and comments
    - Organization and category data

    Usage: Depends(get_course_db_session)
    """
    db = SessionFactory3()
    try:
        yield db
        db.commit()
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


# Backward compatibility aliases (deprecated, use typed versions above)
get_ai_session = get_ai_db_session
get_center_session = get_center_db_session
get_course_session = get_course_db_session

# Legacy alias - will be removed in future version
# 2026-06-24: 原 get_default_db_session 智能路由因参数无 Depends() 永不生效 (死代码), 已删除。
# get_session 保留为 get_ai_db_session 的别名, 仅供旧测试/调用方兼容。
get_session = get_ai_db_session


# ---------------------------------------------------------------------------
# Auth helpers
# ---------------------------------------------------------------------------
# 2026-06-24 联调: get_current_user_uuid 已统一到 app.security.get_current_user_uuid
# 该处实现包含 tenant_id 注入 (多租户 ContextVar), 此处旧实现已删除以避免不一致.
# 如需鉴权依赖, 请使用: from app.security import get_current_user_uuid


# ---------------------------------------------------------------------------
# Settings shortcut
# ---------------------------------------------------------------------------

# Re-export settings for convenience in routes
app_settings = settings


# ---------------------------------------------------------------------------
# Deprecation notice
# ---------------------------------------------------------------------------

_deprecated_notice = """
DEPRECATED: 'get_session' is now an alias of get_ai_db_session.
Please update your code to use the explicit database session generators:
  - get_ai_db_session()     -> zhs_ai_project
  - get_center_db_session()  -> zhs_center_project
  - get_course_db_session()  -> zhs_educational_training

Migration example:
  BEFORE: async def endpoint(db: Session = Depends(get_session))
  AFTER:  async def endpoint(db: Session = Depends(get_ai_db_session))
"""
