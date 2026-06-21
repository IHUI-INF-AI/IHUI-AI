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
from app.security import decode_access_token

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


def get_default_db_session(
    db1: Session = None,
    db2: Session = None,
    db3: Session = None,
) -> Generator[Session, None, None]:
    """
    Smart session generator - picks the right engine based on caller context.

    DEPRECATED: Use get_ai_db_session(), get_center_db_session(), or get_course_db_session()
    instead for explicit database selection.

    Defaults to AI engine (engine1) for backward compatibility.
    """
    db = db1 or SessionFactory1()
    try:
        yield db
        db.commit()
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


# Legacy alias - will be removed in future version
get_session = get_default_db_session


# ---------------------------------------------------------------------------
# Auth helpers
# ---------------------------------------------------------------------------


async def get_current_user_uuid(authorization: str | None = None) -> str | None:
    """
    Extract user UUID from Bearer token or settings (dev mode).
    Returns None for public endpoints.
    """
    if not authorization:
        return None

    token = authorization[7:] if authorization.startswith("Bearer ") else authorization

    payload = decode_access_token(token)
    if payload is None:
        return None

    return payload.get("sub")


# ---------------------------------------------------------------------------
# Settings shortcut
# ---------------------------------------------------------------------------

# Re-export settings for convenience in routes
app_settings = settings


# ---------------------------------------------------------------------------
# Deprecation notice
# ---------------------------------------------------------------------------

_deprecated_notice = """
DEPRECATED: 'get_session' has been renamed to 'get_default_db_session'.
Please update your code to use the explicit database session generators:
  - get_ai_db_session()     -> zhs_ai_project
  - get_center_db_session()  -> zhs_center_project
  - get_course_db_session()  -> zhs_educational_training

Migration example:
  BEFORE: async def endpoint(db: Session = Depends(get_session))
  AFTER:  async def endpoint(db: Session = Depends(get_ai_db_session))
"""
