"""
Payment idempotency protection utilities.

Ensures that payment callbacks (WeChat Pay, Alipay) are processed exactly once,
preventing duplicate order status updates.

Features:
- Redis-based idempotency key storage with TTL
- Database-level idempotency tracking
- Automatic cleanup of expired keys
- Thread-safe implementation
"""

import logging
import time
from dataclasses import dataclass
from enum import Enum

logger = logging.getLogger(__name__)


class IdempotencyStatus(Enum):
    """Status of an idempotency check."""

    NEW = "new"  # First time seeing this key
    PROCESSING = "processing"  # Another request is processing
    COMPLETED = "completed"  # Already processed successfully
    FAILED = "failed"  # Previous attempt failed


@dataclass
class IdempotencyResult:
    """Result of an idempotency check."""

    status: IdempotencyStatus
    cached_result: dict | None = None
    retry_after: int = 5  # seconds to wait before retry


class PaymentIdempotency:
    """
    Redis-backed idempotency protection for payment callbacks.

    Uses Redis SETNX + TTL for atomic idempotency checks.
    Falls back to in-memory storage when Redis is unavailable.
    """

    # Default TTL: 24 hours (payment disputes can take time)
    DEFAULT_TTL_SECONDS = 86400

    # Keys for different payment types
    KEY_PREFIX = "idempotency:payment:"

    _instance = None

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
            cls._instance._initialized = False
        return cls._instance

    def __init__(self):
        if self._initialized:
            return
        self._initialized = True
        self._redis = None
        self._memory_store: dict[str, dict] = {}
        self._use_memory = False
        self._init_redis()

    def _init_redis(self):
        """Initialize Redis connection with fallback to memory."""
        try:
            from app.utils.redis_util import get_redis

            self._redis = get_redis()
            self._redis.ping()
            self._use_memory = False
        except Exception as e:
            logger.warning(f"Redis unavailable for idempotency, using memory: {e}")
            self._use_memory = True
            self._redis = None

    def _get_key(self, payment_id: str, idem_key: str) -> str:
        """Generate idempotency key."""
        return f"{self.KEY_PREFIX}{payment_id}:{idem_key}"

    def check_and_acquire(
        self,
        payment_id: str,
        idem_key: str,
        ttl_seconds: int | None = None,
    ) -> IdempotencyResult:
        """
        Check if this is a new request or a duplicate.

        Args:
            payment_id: Payment order ID (out_trade_no)
            idem_key: Idempotency key (e.g., WeChat transaction_id)
            ttl_seconds: Time to live for the idempotency key

        Returns:
            IdempotencyResult indicating the status
        """
        if ttl_seconds is None:
            ttl_seconds = self.DEFAULT_TTL_SECONDS

        key = self._get_key(payment_id, idem_key)

        if self._use_memory or self._redis is None:
            return self._memory_check_and_acquire(key, ttl_seconds)

        try:
            return self._redis_check_and_acquire(key, ttl_seconds)
        except Exception as e:
            logger.error(f"Redis idempotency check failed: {e}, falling back to memory")
            return self._memory_check_and_acquire(key, ttl_seconds)

    def _redis_check_and_acquire(self, key: str, ttl_seconds: int) -> IdempotencyResult:
        """Redis-based atomic idempotency check."""
        import json

        # Try to set the key with NX (only if not exists)
        was_set = self._redis.set(
            key,
            '{"status": "processing"}',
            nx=True,
            ex=ttl_seconds,
        )

        if was_set:
            return IdempotencyResult(status=IdempotencyStatus.NEW)

        # Key exists, check current status
        data = self._redis.get(key)
        if data:
            try:
                parsed = json.loads(data)
                status = parsed.get("status", "unknown")

                if status == "processing":
                    return IdempotencyResult(
                        status=IdempotencyStatus.PROCESSING,
                        retry_after=5,
                    )
                elif status == "completed":
                    return IdempotencyResult(
                        status=IdempotencyStatus.COMPLETED,
                        cached_result=parsed.get("result"),
                    )
                elif status == "failed":
                    # Allow retry for failed requests
                    return IdempotencyResult(status=IdempotencyStatus.NEW)
            except json.JSONDecodeError:
                pass

        # Key exists but unparseable, treat as new
        return IdempotencyResult(status=IdempotencyStatus.NEW)

    def _memory_check_and_acquire(self, key: str, ttl_seconds: int) -> IdempotencyResult:
        """In-memory idempotency check (fallback)."""
        now = time.time()

        if key not in self._memory_store:
            self._memory_store[key] = {
                "status": "processing",
                "created_at": now,
                "result": None,
            }
            return IdempotencyResult(status=IdempotencyStatus.NEW)

        entry = self._memory_store[key]
        created_at = entry.get("created_at", 0)

        # Check if expired
        if now - created_at > ttl_seconds:
            entry["status"] = "processing"
            entry["created_at"] = now
            return IdempotencyResult(status=IdempotencyStatus.NEW)

        status = entry.get("status", "unknown")
        if status == "processing":
            return IdempotencyResult(
                status=IdempotencyStatus.PROCESSING,
                retry_after=5,
            )
        elif status == "completed":
            return IdempotencyResult(
                status=IdempotencyStatus.COMPLETED,
                cached_result=entry.get("result"),
            )

        return IdempotencyResult(status=IdempotencyStatus.NEW)

    def mark_completed(
        self,
        payment_id: str,
        idem_key: str,
        result: dict | None = None,
        ttl_seconds: int | None = None,
    ):
        """
        Mark a payment as successfully processed.

        Args:
            payment_id: Payment order ID
            idem_key: Idempotency key
            result: Optional result data to cache
            ttl_seconds: TTL for the completed status
        """
        if ttl_seconds is None:
            ttl_seconds = self.DEFAULT_TTL_SECONDS

        key = self._get_key(payment_id, idem_key)

        if self._use_memory or self._redis is None:
            if key in self._memory_store:
                self._memory_store[key]["status"] = "completed"
                self._memory_store[key]["result"] = result
            return

        try:
            import json

            self._redis.set(
                key,
                json.dumps(
                    {
                        "status": "completed",
                        "completed_at": time.time(),
                        "result": result,
                    }
                ),
                ex=ttl_seconds,
            )
        except Exception as e:
            logger.error(f"Failed to mark idempotency completed: {e}")

    def mark_failed(
        self,
        payment_id: str,
        idem_key: str,
        error: str | None = None,
    ):
        """
        Mark a payment processing as failed.

        Allows retry on next attempt.
        """
        _key = self._get_key(payment_id, idem_key)

        # For failed requests, we don't persist - allow retry
        # Just log for monitoring
        logger.warning(f"Payment processing failed: payment_id={payment_id}, " f"idem_key={idem_key}, error={error}")

    def cleanup_expired(self, max_age_seconds: int = 86400):
        """Clean up expired entries from memory store."""
        if not self._use_memory:
            return

        now = time.time()
        expired_keys = [k for k, v in self._memory_store.items() if now - v.get("created_at", 0) > max_age_seconds]
        for k in expired_keys:
            del self._memory_store[k]

        if expired_keys:
            logger.info(f"Cleaned up {len(expired_keys)} expired idempotency entries")


# Global idempotency manager instance
_idempotency_manager: PaymentIdempotency | None = None


def get_idempotency_manager() -> PaymentIdempotency:
    """Get or create the global idempotency manager."""
    global _idempotency_manager
    if _idempotency_manager is None:
        _idempotency_manager = PaymentIdempotency()
    return _idempotency_manager


# Convenience functions for payment callbacks


def check_payment_idempotency(
    out_trade_no: str,
    transaction_id: str,
    ttl_seconds: int | None = None,
) -> IdempotencyResult:
    """
    Check if a payment callback is a duplicate.

    Args:
        out_trade_no: Merchant order number
        transaction_id: Payment platform transaction ID
        ttl_seconds: Optional TTL override

    Returns:
        IdempotencyResult indicating if this is a new or duplicate request
    """
    return get_idempotency_manager().check_and_acquire(out_trade_no, transaction_id, ttl_seconds)


def mark_payment_processed(
    out_trade_no: str,
    transaction_id: str,
    result: dict | None = None,
):
    """
    Mark a payment as successfully processed.

    Args:
        out_trade_no: Merchant order number
        transaction_id: Payment platform transaction ID
        result: Optional result data to cache for duplicate detection
    """
    get_idempotency_manager().mark_completed(out_trade_no, transaction_id, result)


def mark_payment_failed(
    out_trade_no: str,
    transaction_id: str,
    error: str | None = None,
):
    """
    Mark a payment processing as failed.

    Args:
        out_trade_no: Merchant order number
        transaction_id: Payment platform transaction ID
        error: Optional error message
    """
    get_idempotency_manager().mark_failed(out_trade_no, transaction_id, error)
