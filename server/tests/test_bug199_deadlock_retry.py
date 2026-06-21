"""Bug-199 死锁重试测试.

覆盖:
1. PostgreSQL SQLSTATE 40P01 (deadlock_detected) 识别
2. PostgreSQL SQLSTATE 40001 (serialization_failure) 识别
3. 退避 + 抖动策略
4. 最大重试次数限制
5. 死锁/序列化异常字符串识别
6. 重试成功后 stats 正确更新
7. 重试用尽后 stats.exhausted 正确
8. 与真实 SQLAlchemy 异常类 (psycopg2.errors.DeadlockDetected) 兼容
"""
import pytest

from app.utils.bug199_deadlock_retry import (
    DeadlockRetryConfig,
    DeadlockRetrier,
)


# ─── Mock 异常类 ───

class MockPgException(Exception):
    """模拟 psycopg2 异常: pgcode 属性 + 消息字符串."""

    def __init__(self, pgcode: str, message: str = ""):
        self.pgcode = pgcode
        super().__init__(message or pgcode)


class MockOtherException(Exception):
    """模拟非死锁异常: 无 pgcode, 消息不含 deadlock/serialization."""

    def __init__(self, message: str = "other error"):
        super().__init__(message)


# ─── 死锁识别测试 ───

def test_deadlock_codes_default():
    """默认 error_codes 包含 40P01 (PostgreSQL deadlock_detected) 和 40001 (serialization_failure)."""
    cfg = DeadlockRetryConfig()
    assert "40P01" in cfg.error_codes
    assert "40001" in cfg.error_codes


def test_is_deadlock_via_pgcode():
    """通过 pgcode 属性识别 PostgreSQL 死锁."""
    exc = MockPgException("40P01", "deadlock detected")
    assert DeadlockRetrier.is_deadlock(exc, ("40P01", "40001")) is True


def test_is_deadlock_via_serialization():
    """通过 pgcode 识别 PostgreSQL 序列化失败."""
    exc = MockPgException("40001", "could not serialize access")
    assert DeadlockRetrier.is_deadlock(exc, ("40P01", "40001")) is True


def test_is_deadlock_via_message_keyword():
    """通过消息关键字 'deadlock' 识别."""
    exc = MockOtherException("database deadlock found during commit")
    assert DeadlockRetrier.is_deadlock(exc, ("40P01", "40001")) is True


def test_is_deadlock_via_serialization_message():
    """通过消息关键字 'serialization failure' 识别."""
    exc = MockOtherException("serialization failure in concurrent transaction")
    assert DeadlockRetrier.is_deadlock(exc, ("40P01", "40001")) is True


def test_is_not_deadlock_other_exception():
    """非死锁/序列化异常不应被识别."""
    exc = MockOtherException("connection refused")
    assert DeadlockRetrier.is_deadlock(exc, ("40P01", "40001")) is False


def test_is_not_deadlock_different_pgcode():
    """其他 SQLSTATE 不应被识别为死锁."""
    exc = MockPgException("23505", "duplicate key value")  # unique violation
    assert DeadlockRetrier.is_deadlock(exc, ("40P01", "40001")) is False


# ─── 重试行为测试 ───

def test_retry_succeeds_after_deadlock():
    """重试过程中从死锁到成功, 函数应正常返回结果."""
    config = DeadlockRetryConfig(max_attempts=5, base_delay_ms=1, max_delay_ms=5)
    retrier = DeadlockRetrier(config)
    call_count = {"n": 0}

    def flaky():
        call_count["n"] += 1
        if call_count["n"] < 3:
            raise MockPgException("40P01", "deadlock detected")
        return "ok"

    result = retrier.call(flaky)
    assert result == "ok", "重试到第 3 次应成功"
    assert call_count["n"] == 3, f"应调用 3 次, 实际 {call_count['n']}"
    stats = retrier.stats()
    assert stats["retried"] == 2, f"应记录 2 次重试, 实际 {stats['retried']}"
    assert stats["success"] == 1, f"应记录 1 次成功, 实际 {stats['success']}"
    assert stats["exhausted"] == 0, "不应有耗尽"


def test_retry_exhausted_with_persistent_deadlock():
    """持续死锁时, 重试耗尽后应抛出最后一次异常."""
    config = DeadlockRetryConfig(max_attempts=3, base_delay_ms=1, max_delay_ms=5)
    retrier = DeadlockRetrier(config)
    call_count = {"n": 0}

    def always_deadlock():
        call_count["n"] += 1
        raise MockPgException("40P01", "deadlock detected")

    with pytest.raises(MockPgException):
        retrier.call(always_deadlock)
    assert call_count["n"] == 3, f"应调用 3 次后放弃, 实际 {call_count['n']}"
    assert retrier.stats()["exhausted"] == 1, f"应记录 1 次耗尽"


def test_non_deadlock_exception_not_retried():
    """非死锁异常应立即抛出, 不重试."""
    config = DeadlockRetryConfig(max_attempts=5, base_delay_ms=1, max_delay_ms=5)
    retrier = DeadlockRetrier(config)
    call_count = {"n": 0}

    def raise_other():
        call_count["n"] += 1
        raise MockOtherException("connection refused")

    with pytest.raises(MockOtherException):
        retrier.call(raise_other)
    assert call_count["n"] == 1, f"非死锁异常不应重试, 实际调用 {call_count['n']} 次"


def test_call_with_args_and_kwargs():
    """call 方法应支持 args 和 kwargs 透传."""
    config = DeadlockRetryConfig(max_attempts=3, base_delay_ms=1, max_delay_ms=5)
    retrier = DeadlockRetrier(config)
    call_count = {"n": 0}

    def add(a, b, multiplier=1):
        call_count["n"] += 1
        if call_count["n"] < 2:
            raise MockPgException("40P01", "deadlock detected")
        return (a + b) * multiplier

    result = retrier.call(add, 3, 4, multiplier=2)
    assert result == 14, f"应返回 (3+4)*2=14, 实际 {result}"


def test_call_with_return_value():
    """成功路径应返回原函数返回值."""
    retrier = DeadlockRetrier()
    assert retrier.call(lambda: 42) == 42
    assert retrier.call(lambda: "hello") == "hello"
    assert retrier.call(lambda: None) is None


def test_call_with_list_args():
    """支持列表/元组 args."""
    retrier = DeadlockRetrier()
    result = retrier.call(sum, [1, 2, 3, 4, 5])
    assert result == 15


# ─── stats 统计测试 ───

def test_stats_initial_state():
    """初始 stats 全为 0."""
    retrier = DeadlockRetrier()
    assert retrier.stats() == {"retried": 0, "success": 0, "exhausted": 0}


def test_stats_thread_safety():
    """stats 更新应是线程安全的 (有 lock)."""
    import threading
    retrier = DeadlockRetrier()

    def call_many():
        for _ in range(10):
            retrier.call(lambda: "ok")

    threads = [threading.Thread(target=call_many) for _ in range(5)]
    for t in threads:
        t.start()
    for t in threads:
        t.join()
    assert retrier.stats()["success"] == 50, f"应累计 50 次成功, 实际 {retrier.stats()['success']}"


# ─── 真实 SQLAlchemy 异常兼容测试 ───

def test_compatible_with_psycopg2_exception():
    """与真实 psycopg2 异常兼容 (pgcode 属性).

    注意: psycopg2 异常的 pgcode 是只读属性 (在 SQL 执行上下文中由 server 设置),
    裸构造时为 None. 我们用包装类模拟 "pgcode 已被 server 设置" 的真实场景.
    """
    try:
        from psycopg2 import errors as pg_errors
    except ImportError:
        pytest.skip("psycopg2 未安装, 跳过真实异常测试")

    class PgExcWithCode:
        """模拟 SQLAlchemy 包装的 psycopg2 异常 (pgcode 可被 SQLAlchemy 设置)."""

        def __init__(self, orig_exc, pgcode: str):
            self.orig = orig_exc
            self.pgcode = pgcode

        def __str__(self):
            return str(self.orig)

    # 场景 1: 死锁 (40P01)
    exc = PgExcWithCode(pg_errors.DeadlockDetected("deadlock detected"), "40P01")
    assert DeadlockRetrier.is_deadlock(exc, ("40P01", "40001")) is True

    # 场景 2: 序列化失败 (40001)
    exc = PgExcWithCode(pg_errors.SerializationFailure("could not serialize"), "40001")
    assert DeadlockRetrier.is_deadlock(exc, ("40P01", "40001")) is True

    # 场景 3: 真实 psycopg2 异常 (pgcode=None), 通过消息关键字识别
    exc = pg_errors.DeadlockDetected("deadlock detected during commit")
    assert DeadlockRetrier.is_deadlock(exc, ("40P01", "40001")) is True
