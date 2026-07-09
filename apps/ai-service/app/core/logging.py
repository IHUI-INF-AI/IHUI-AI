"""Structured logging setup using structlog.

Provides ``get_logger`` used across the ai-service for consistent, structured
log output. Falls back to stdlib logging when structlog is unavailable.
"""
from __future__ import annotations

import logging
import sys
from typing import Any

try:
    import structlog  # type: ignore[import-untyped]
    _HAS_STRUCTLOG = True
except ImportError:  # pragma: no cover - structlog is in pyproject deps
    structlog = None  # type: ignore[assignment]
    _HAS_STRUCTLOG = False


def _configure_structlog() -> None:
    """Configure structlog processors and stdlib logging integration once."""
    if not _HAS_STRUCTLOG:
        return

    structlog.configure(
        processors=[
            structlog.contextvars.merge_contextvars,
            structlog.processors.add_log_level,
            structlog.processors.TimeStamper(fmt="iso"),
            structlog.processors.StackInfoRenderer(),
            structlog.processors.format_exc_info,
            structlog.dev.ConsoleRenderer(),
        ],
        wrapper_class=structlog.make_filtering_bound_logger(logging.INFO),
        logger_factory=structlog.PrintLoggerFactory(file=sys.stderr),
        cache_logger_on_first_use=True,
    )


def get_logger(name: str | None = None) -> Any:
    """Return a structured logger instance.

    Args:
        name: Optional logger name, typically ``__name__`` of the calling module.

    Returns:
        A structlog bound logger (or stdlib logger fallback) with ``bind`` and
        structured keyword args support.
    """
    _configure_structlog()
    if _HAS_STRUCTLOG:
        return structlog.get_logger(name or "ai-service")
    return logging.getLogger(name or "ai-service")


__all__ = ["get_logger"]
