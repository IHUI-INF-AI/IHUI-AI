"""Unified SQLAlchemy session management utilities.

Provides consistent session handling patterns throughout the codebase.

Design principles:
1. Always use context managers for automatic cleanup
2. Explicit database selection (no implicit routing)
3. Clear error handling with automatic rollback
4. Support for both dependency injection and service layer

Usage:
    # Pattern 1: Context manager (preferred for services)
    with db_session() as db:
        db.query(Model).filter(...)
        # Auto-commits on success, auto-rollbacks on exception

    # Pattern 2: Generator (for FastAPI Depends)
    def get_db():
        db = SessionFactory()
        try:
            yield db
            db.commit()
        except Exception:
            db.rollback()
            raise
        finally:
            db.close()
"""

import logging
from collections.abc import Callable, Generator
from contextlib import contextmanager, suppress
from functools import wraps
from typing import TypeVar

from sqlalchemy.orm import Session

from app.database import (
    SessionFactory1,
    SessionFactory2,
    SessionFactory3,
)

logger = logging.getLogger(__name__)

T = TypeVar("T")


# ---------------------------------------------------------------------------
# Unified context manager
# ---------------------------------------------------------------------------


class DatabaseSession:
    """Unified database session wrapper with consistent behavior."""

    def __init__(self, session: Session, auto_commit: bool = True):
        self._session = session
        self._auto_commit = auto_commit
        self._committed = False

    @property
    def session(self) -> Session:
        return self._session

    def __enter__(self) -> Session:
        return self._session

    def __exit__(self, exc_type, exc_val, exc_tb):
        if exc_type is not None:
            # Exception occurred - rollback
            try:
                self._session.rollback()
                logger.debug(f"Session rolled back due to: {exc_type.__name__}: {exc_val}")
            except Exception as rollback_err:
                logger.error(f"Rollback failed: {rollback_err}")
            return False  # Don't suppress exception

        # Success - commit if auto_commit enabled
        if self._auto_commit and not self._committed:
            try:
                self._session.commit()
                self._committed = True
            except Exception as commit_err:
                logger.error(f"Commit failed: {commit_err}")
                with suppress(Exception):
                    self._session.rollback()
                raise

        return True

    def commit(self):
        """Explicit commit."""
        self._session.commit()
        self._committed = True

    def rollback(self):
        """Explicit rollback."""
        self._session.rollback()

    def close(self):
        """Close the session."""
        self._session.close()


@contextmanager
def db_session(
    factory=None,
    auto_commit: bool = True,
) -> Generator[Session, None, None]:
    """Unified database session context manager.

    Args:
        factory: Session factory to use. If None, uses SessionFactory1 (AI database).
        auto_commit: Whether to auto-commit on success. Default True.

    Usage:
        with db_session() as db:
            users = db.query(User).limit(500).all()

        with db_session(factory=SessionFactory2) as db:
            auth = db.query(AuthInfo).first()

    Yields:
        SQLAlchemy Session
    """
    if factory is None:
        factory = SessionFactory1

    session = factory()
    try:
        yield session

        if auto_commit:
            session.commit()

    except Exception as e:
        session.rollback()
        logger.error(f"Database operation failed: {e}")
        raise

    finally:
        session.close()


@contextmanager
def ai_db_session() -> Generator[Session, None, None]:
    """Context manager for AI project database."""
    with db_session(SessionFactory1) as db:
        yield db


@contextmanager
def center_db_session() -> Generator[Session, None, None]:
    """Context manager for center project database."""
    with db_session(SessionFactory2) as db:
        yield db


@contextmanager
def course_db_session() -> Generator[Session, None, None]:
    """Context manager for educational training database."""
    with db_session(SessionFactory3) as db:
        yield db


# ---------------------------------------------------------------------------
# FastAPI Depends helpers
# ---------------------------------------------------------------------------


def get_ai_db() -> Generator[Session, None, None]:
    """FastAPI Depends for AI database session."""
    session = SessionFactory1()
    try:
        yield session
        session.commit()
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()


def get_center_db() -> Generator[Session, None, None]:
    """FastAPI Depends for center database session."""
    session = SessionFactory2()
    try:
        yield session
        session.commit()
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()


def get_course_db() -> Generator[Session, None, None]:
    """FastAPI Depends for course database session."""
    session = SessionFactory3()
    try:
        yield session
        session.commit()
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()


# ---------------------------------------------------------------------------
# Decorators for service layer
# ---------------------------------------------------------------------------


def transactional(auto_commit: bool = True):
    """Decorator for service methods that need transaction support.

    Usage:
        @transactional()
        def create_order(db, user_id, amount):
            order = Order(user_id=user_id, amount=amount)
            db.add(order)
            return order

    Args:
        auto_commit: Whether to commit after method execution. Default True.
    """

    def decorator(func: Callable[..., T]) -> Callable[..., T]:
        @wraps(func)
        def wrapper(*args, **kwargs) -> T:
            # Check if db session is provided in args
            db_in_args = len(args) > 0 and isinstance(args[0], Session)

            if db_in_args:
                # Session provided, don't create new one
                return func(*args, **kwargs)

            # Session not provided, create new one
            with db_session(auto_commit=auto_commit) as db:
                return func(db, *args, **kwargs)

        return wrapper

    return decorator


def read_only():
    """Decorator for read-only service methods.

    Automatically sets auto_commit=False and ensures rollback on any exception.
    """
    return transactional(auto_commit=False)


# ---------------------------------------------------------------------------
# Query helpers
# ---------------------------------------------------------------------------


def paginate_query(query, page: int = 1, page_size: int = 20):
    """Paginate a SQLAlchemy query.

    Args:
        query: SQLAlchemy query object
        page: Page number (1-indexed)
        page_size: Items per page

    Returns:
        Tuple of (items, total_count)
    """
    total = query.count()
    offset = (page - 1) * page_size
    items = query.offset(offset).limit(page_size).all()
    return items, total


# ---------------------------------------------------------------------------
# Backward compatibility aliases
# ---------------------------------------------------------------------------


# Legacy alias - prefer using db_session() context manager directly
def get_db_session(factory=None) -> Generator[Session, None, None]:
    """Legacy session generator (deprecated).

    Use db_session() context manager instead for better error handling.
    """
    if factory is None:
        factory = SessionFactory1
    return db_session(factory)
