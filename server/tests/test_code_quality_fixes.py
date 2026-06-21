"""Tests to verify code quality fixes.

This module tests the fixes applied during the code quality improvement pass:
1. Dependency injection naming
2. Redis-based distributed rate limiting
3. Payment idempotency protection
4. Commission service query optimization
5. Session management consistency
6. Role-based access control
7. Garbled comment cleanup
8. Error handling improvements
"""

import time
from unittest.mock import MagicMock

import pytest


class TestDependencyInjection:
    """Test dependency injection naming fixes."""

    def test_get_ai_db_session_exists(self):
        """Verify typed session generators exist with correct names."""
        from app.dependencies import get_ai_db_session, get_center_db_session, get_course_db_session

        assert callable(get_ai_db_session)
        assert callable(get_center_db_session)
        assert callable(get_course_db_session)

    def test_backward_compatibility_aliases(self):
        """Verify legacy aliases still work."""
        from app.dependencies import get_ai_session, get_session

        assert callable(get_session)
        assert callable(get_ai_session)


class TestDistributedRateLimiter:
    """Test Redis-backed distributed rate limiter."""

    def test_rate_limiter_initialization(self):
        """Verify rate limiter can be initialized."""
        from app.middleware.rate_limiter import get_rate_limiter

        limiter = get_rate_limiter()
        assert limiter is not None

    def test_memory_fallback(self):
        """Verify fallback to memory when Redis unavailable."""
        from app.middleware.rate_limiter import DistributedRateLimiter

        limiter = DistributedRateLimiter()
        assert limiter._initialized

    def test_rate_limit_check(self):
        """Test rate limit checking returns expected format."""
        from app.middleware.rate_limiter import DistributedRateLimiter

        limiter = DistributedRateLimiter()

        allowed, remaining, reset_in = limiter.check_rate_limit("test_key", max_requests=10, window_seconds=60)

        assert allowed is True
        assert remaining >= 0
        assert reset_in >= 0


class TestPaymentIdempotency:
    """Test payment callback idempotency protection."""

    def test_idempotency_manager_exists(self):
        """Verify idempotency manager can be created."""
        from app.utils.payment_idempotency import get_idempotency_manager

        manager = get_idempotency_manager()
        assert manager is not None

    def test_first_request_is_new(self):
        """First request should be marked as NEW."""
        from app.utils.payment_idempotency import IdempotencyStatus, get_idempotency_manager

        manager = get_idempotency_manager()
        result = manager.check_and_acquire("test_order_001", "transaction_001", ttl_seconds=3600)

        assert result.status == IdempotencyStatus.NEW

    def test_duplicate_request_is_completed(self):
        """Duplicate request should be marked as completed."""
        from app.utils.payment_idempotency import IdempotencyStatus, get_idempotency_manager

        manager = get_idempotency_manager()
        order_id = f"test_order_{int(time.time())}"
        trans_id = f"trans_{int(time.time())}"

        result1 = manager.check_and_acquire(order_id, trans_id, ttl_seconds=3600)
        assert result1.status == IdempotencyStatus.NEW

        manager.mark_completed(order_id, trans_id, result={"status": "success"})

        result2 = manager.check_and_acquire(order_id, trans_id, ttl_seconds=3600)
        assert result2.status == IdempotencyStatus.COMPLETED


class TestCommissionService:
    """Test commission service optimizations."""

    def test_cached_proportion_function_exists(self):
        """Verify cached proportion lookup exists."""
        from app.services.commission_service import _get_cached_active_proportion

        assert callable(_get_cached_active_proportion)

    def test_cache_invalidation(self):
        """Test cache invalidation function exists."""
        from app.services.commission_service import invalidate_proportion_cache

        invalidate_proportion_cache()


class TestDatabaseSession:
    """Test unified database session management."""

    def test_db_session_context_manager(self):
        """Verify unified context manager exists."""
        from app.utils.db_session import ai_db_session, center_db_session, db_session

        assert callable(db_session)
        assert callable(ai_db_session)
        assert callable(center_db_session)

    def test_transaction_decorator(self):
        """Verify transactional decorator exists."""
        from app.utils.db_session import read_only, transactional

        assert callable(transactional)
        assert callable(read_only)

    def test_pagination_helper(self):
        """Verify pagination helper exists."""
        from app.utils.db_session import paginate_query

        assert callable(paginate_query)


class TestPermissionDecorator:
    """Test role-based access control."""

    def test_role_constants_exist(self):
        """Verify role constants are defined."""
        from app.utils.permission_decorator import Role

        assert Role.SUPER_ADMIN == "super_admin"
        assert Role.ADMIN == "admin"
        assert Role.USER == "user"
        assert Role.GUEST == "guest"

    def test_permission_constants_exist(self):
        """Verify permission constants are defined."""
        from app.utils.permission_decorator import Permission

        assert Permission.CONTENT_BANNER_CREATE == "content:banner:create"
        assert Permission.USER_READ == "system:user:read"
        assert Permission.ORDER_REFUND == "order:refund"

    def test_require_role_class(self):
        """Verify require_role dependency class exists."""
        from app.utils.permission_decorator import require_role

        assert callable(require_role) or isinstance(require_role, type)

    def test_require_permission_class(self):
        """Verify require_permission dependency class exists."""
        from app.utils.permission_decorator import require_permission

        assert callable(require_permission) or isinstance(require_permission, type)


class TestErrorHandling:
    """Test error handling improvements."""

    def test_error_codes_exist(self):
        """Verify standard error codes are defined."""
        from app.utils.error_handler import ErrorCode

        assert ErrorCode.VALIDATION_ERROR == "VALIDATION_ERROR"
        assert ErrorCode.UNAUTHORIZED == "UNAUTHORIZED"
        assert ErrorCode.NOT_FOUND == "NOT_FOUND"
        assert ErrorCode.INTERNAL_ERROR == "INTERNAL_ERROR"

    def test_api_error_class(self):
        """Verify API error classes exist."""
        from app.utils.error_handler import (
            APIError,
            ConflictError,
            ForbiddenError,
            NotFoundError,
            UnauthorizedError,
            ValidationAPIError,
        )

        assert issubclass(APIError, Exception)
        assert issubclass(ValidationAPIError, APIError)
        assert issubclass(UnauthorizedError, APIError)
        assert issubclass(ForbiddenError, APIError)
        assert issubclass(NotFoundError, APIError)
        assert issubclass(ConflictError, APIError)

    def test_error_response_helpers(self):
        """Verify response helper functions exist."""
        from app.utils.error_handler import error_response, paginated_response, success_response

        assert callable(success_response)
        assert callable(error_response)
        assert callable(paginated_response)

    def test_exception_handler_registration(self):
        """Verify exception handlers can be registered."""
        from app.utils.error_handler import register_exception_handlers

        mock_app = MagicMock()
        register_exception_handlers(mock_app)

        assert mock_app.add_exception_handler.called


class TestFileEncoding:
    """Test that files have proper UTF-8 encoding."""

    def test_main_py_encoding(self):
        """Verify main.py has no garbled characters."""
        with open("app/main.py", encoding="utf-8") as f:
            content = f.read()

        assert "锟斤拷" not in content
        assert "\ufffd\ufffd" not in content

    def test_security_py_encoding(self):
        """Verify security.py has no garbled characters."""
        with open("app/security.py", encoding="utf-8") as f:
            content = f.read()

        assert "锟斤拷" not in content
        assert "\ufffd\ufffd" not in content

    def test_database_py_encoding(self):
        """Verify database.py has no garbled characters."""
        with open("app/database.py", encoding="utf-8") as f:
            content = f.read()

        assert "锟斤拷" not in content
        assert "\ufffd\ufffd" not in content

    def test_config_py_encoding(self):
        """Verify config.py has no garbled characters."""
        with open("app/config.py", encoding="utf-8") as f:
            content = f.read()

        assert "锟斤拷" not in content
        assert "\ufffd\ufffd" not in content


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
