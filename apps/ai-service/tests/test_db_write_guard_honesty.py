# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""`db_write_guard` 判定层的回归锁。

立论(2026-09-27 实测):`publish_history` 序列落后 ⇒ 每次 INSERT 撞 `*_pkey`,
而两处写入方都 `except Exception → logger.warning` ⇒ 审计静默丢失。这一格的修复判据是
**「撞主键必须喊到 error 并给出修复出口」**，所以测试必须证明判级真的会翻，而不是恒绿。
"""

from __future__ import annotations

from collections.abc import Callable

import asyncpg
import pytest

from app.services.publish.db_write_guard import (
    classify_db_write_failure,
    classify_write_retryability,
    run_db_write_with_retry,
)


def _err(msg: str) -> Exception:
    """造一个与 asyncpg 同型的 UniqueViolationError(用真实异常类型,不用自造鸭子)。"""
    return asyncpg.exceptions.UniqueViolationError(msg)


def test_pkey_clash_on_named_table_is_error_with_repair_hint() -> None:
    exc = _err(
        'duplicate key value violates unique constraint "publish_history_pkey"\n'
        "DETAIL: Key (id)=(6) already exists."
    )
    v = classify_db_write_failure(exc, table="publish_history")
    assert v.level == "error", "撞主键降成 warning = 本型故障静默的根因"
    assert v.repair_hint and "check:sequence-lag" in v.repair_hint, "必须给可复制的修复出口"


def test_other_db_errors_stay_warning() -> None:
    exc = RuntimeError("connection reset by peer")
    v = classify_db_write_failure(exc, table="publish_history")
    assert v.level == "warning"
    assert v.repair_hint is None


def test_pkey_clash_on_other_table_does_not_claim_our_sequence() -> None:
    """别的表撞主键不得被算成本表序列落后(否则报告替无关故障背书)。"""
    exc = _err('duplicate key value violates unique constraint "users_email_key"')
    v = classify_db_write_failure(exc, table="publish_history")
    assert v.level == "error"
    assert "未必是序列落后" in v.message


def test_non_unique_violation_with_the_word_pkey_is_not_escalated() -> None:
    """判据须认"唯一约束冲突"这一型,不能只看字面量 _pkey(那是恒真的假升级)。"""
    exc = RuntimeError('relation "publish_history_pkey" does not exist')
    v = classify_db_write_failure(exc, table="publish_history")
    assert v.level == "warning"


# ---------------------------------------------------------------------------
# G-815958:「该不该重试」三分语义。
# 40001/40P01 ⇒ 可重试(有界退避,记 retryable=1);23505/23503 ⇒ 不可重试
# (立即上抛,记 retryable=0);其余错误码 ⇒ 未判定(retryable=None,不自动重试、
# 不吞异常、原样上抛、记录标 undetermined)。以下全部用注入/伪造异常,不连任何数据库。
# ---------------------------------------------------------------------------


class _PgCodeFake(Exception):
    """psycopg2 同型伪造:错误码挂在 pgcode 属性(而非 asyncpg 的 sqlstate)。"""

    def __init__(self, msg: str, pgcode: str | None) -> None:
        super().__init__(msg)
        self.pgcode = pgcode


class SerializationFailure(Exception):
    """伪造 psycopg2 40001 的类名同型(无任何错误码属性)。"""


class DeadlockDetected(Exception):
    """伪造 psycopg2 40P01 的类名同型(无任何错误码属性)。"""


class UniqueViolation(Exception):
    """伪造 psycopg2 23505 的类名同型(无任何错误码属性)。"""


def _failing_write(err: Exception, calls: list[int]) -> Callable[[], None]:
    def _write() -> None:
        calls.append(1)
        raise err

    return _write


def _never_sleep(_seconds: float) -> None:
    raise AssertionError("不可重试/未判定路径绝不许进退避等待")


@pytest.mark.parametrize(
    ("make_exc", "expect_retryable", "expect_disposition"),
    [
        pytest.param(
            lambda: asyncpg.exceptions.SerializationError(
                "could not serialize access due to read/write dependencies among transactions"
            ),
            True,
            "retry",
            id="serialization-40001-is-retryable",
        ),
        pytest.param(
            lambda: asyncpg.exceptions.DeadlockDetectedError("deadlock detected"),
            True,
            "retry",
            id="deadlock-40P01-is-retryable",
        ),
        pytest.param(
            lambda: asyncpg.exceptions.UniqueViolationError(
                'duplicate key value violates unique constraint "publish_history_pkey"'
            ),
            False,
            "raise",
            id="unique-23505-is-not-retryable",
        ),
        pytest.param(
            lambda: asyncpg.exceptions.ForeignKeyViolationError(
                "insert or update on table violates foreign key constraint"
            ),
            False,
            "raise",
            id="fk-23503-is-not-retryable",
        ),
        pytest.param(
            lambda: asyncpg.exceptions.InFailedSQLTransactionError(
                "current transaction is aborted, commands ignored"
            ),
            None,
            "undetermined",
            id="unknown-25P02-is-undetermined",
        ),
    ],
)
def test_retry_matrix_five_cells(
    make_exc: Callable[[], Exception], expect_retryable: bool | None, expect_disposition: str
) -> None:
    """三分矩阵:该重试的记 retryable=1,不该的记 0,拿不准的必须落 None,不许并档。"""
    v = classify_write_retryability(make_exc())
    assert v.retryable is expect_retryable, f"三态判定失真:{v}"
    assert v.disposition == expect_disposition


def test_serialization_40001_retries_with_bounded_backoff_then_succeeds() -> None:
    """正例:40001 真的走重试(有界退避),每次失败记 retryable=1。"""
    err = asyncpg.exceptions.SerializationError("could not serialize access")
    calls: list[int] = []
    delays: list[float] = []
    records: list = []

    def write() -> str:
        calls.append(1)
        if len(calls) <= 2:
            raise err
        return "ok"

    result = run_db_write_with_retry(
        write, table="publish_history", sleep=delays.append, records=records
    )
    assert result == "ok"
    assert len(calls) == 3, "必须真的重试过,而不是一次失败就放弃"
    assert delays == [0.01, 0.02], f"退避必须毫秒级有界(10ms→20ms 起步):{delays}"
    assert len(records) == 2 and all(r.retryable is True for r in records)


def test_serialization_40001_retry_budget_exhausts_and_raises_original() -> None:
    """预算耗尽:总尝试次数有界,退避有界,上抛的是**原异常对象**(不包装不吞)。"""
    err = asyncpg.exceptions.SerializationError("could not serialize access")
    calls: list[int] = []
    delays: list[float] = []
    with pytest.raises(asyncpg.exceptions.SerializationError) as exc_info:
        run_db_write_with_retry(
            _failing_write(err, calls), table="publish_history", sleep=delays.append
        )
    assert exc_info.value is err
    assert len(calls) == 3
    assert delays == [0.01, 0.02]
    assert all(d <= 0.2 for d in delays), "业务连接不许继承迁移的长等待预算"


def test_deadlock_40p01_retries_same_shape_as_serialization() -> None:
    """同型格:40P01 与 40001 同走有界重试,记 retryable=1。"""
    err = asyncpg.exceptions.DeadlockDetectedError("deadlock detected")
    calls: list[int] = []
    delays: list[float] = []
    records: list = []

    def write() -> str:
        calls.append(1)
        if len(calls) == 1:
            raise err
        return "ok"

    result = run_db_write_with_retry(
        write, table="publish_history", sleep=delays.append, records=records
    )
    assert result == "ok"
    assert len(calls) == 2
    assert delays == [0.01]
    assert all(r.retryable is True for r in records)


def test_serialization_backoff_doubling_is_capped_at_200ms() -> None:
    """退避翻倍必须封顶 200ms(上游经验:10→200 有界,不无界指数爆炸)。"""
    err = asyncpg.exceptions.SerializationError("could not serialize access")
    delays: list[float] = []
    with pytest.raises(asyncpg.exceptions.SerializationError):
        run_db_write_with_retry(
            _failing_write(err, []),
            table="publish_history",
            backoff_initial_ms=150,
            sleep=delays.append,
        )
    assert delays == [0.15, 0.2], f"150ms 翻倍到 300ms 必须被压回 200ms:{delays}"


def test_unique_violation_23505_is_never_retried_and_raises_original() -> None:
    """反例:23505 是语义性失败,重试一万次结果不变 ⇒ 一次都不许试,原样上抛。"""
    err = asyncpg.exceptions.UniqueViolationError(
        'duplicate key value violates unique constraint "publish_history_pkey"'
    )
    calls: list[int] = []
    records: list = []
    with pytest.raises(asyncpg.exceptions.UniqueViolationError) as exc_info:
        run_db_write_with_retry(
            _failing_write(err, calls), table="publish_history", sleep=_never_sleep, records=records
        )
    assert exc_info.value is err
    assert len(calls) == 1, "23505 进了重试循环 = 把语义性失败当瞬时抖动"
    assert records[0].retryable is False


def test_foreign_key_violation_23503_is_never_retried_same_shape() -> None:
    """同型格:23503 与 23505 同样一次不试、原样上抛、记 retryable=0。"""
    err = asyncpg.exceptions.ForeignKeyViolationError("violates foreign key constraint")
    calls: list[int] = []
    records: list = []
    with pytest.raises(asyncpg.exceptions.ForeignKeyViolationError) as exc_info:
        run_db_write_with_retry(
            _failing_write(err, calls), table="publish_history", sleep=_never_sleep, records=records
        )
    assert exc_info.value is err
    assert len(calls) == 1
    assert records[0].retryable is False


def test_unknown_sqlstate_25p02_is_undetermined_no_retry_no_swallow() -> None:
    """第三态:25P02 既不冒重试(不进退避)也不冒不可重试(retryable 不许是 False),
    不吞异常原样上抛,并在记录里标 undetermined。"""
    err = asyncpg.exceptions.InFailedSQLTransactionError("current transaction is aborted")
    calls: list[int] = []
    records: list = []
    with pytest.raises(asyncpg.exceptions.InFailedSQLTransactionError) as exc_info:
        run_db_write_with_retry(
            _failing_write(err, calls), table="publish_history", sleep=_never_sleep, records=records
        )
    assert exc_info.value is err, "未判定路径不吞异常,必须原样上抛"
    assert len(calls) == 1, "未判定路径不许自动重试"
    assert records[0].retryable is None, "未判定必须落 None,不许并进 True/False"
    assert records[0].disposition == "undetermined"
    assert records[0].sqlstate == "25P02"


def test_plain_error_without_evidence_is_undetermined_not_guessed() -> None:
    """没有码也没有类名证据 ⇒ 未判定,不许靠猜(既不冒 retryable=1 也不冒 =0)。"""
    err = RuntimeError("boom")
    calls: list[int] = []
    records: list = []
    with pytest.raises(RuntimeError) as exc_info:
        run_db_write_with_retry(
            _failing_write(err, calls), table="publish_history", sleep=_never_sleep, records=records
        )
    assert exc_info.value is err
    assert len(calls) == 1
    assert records[0].retryable is None
    assert records[0].disposition == "undetermined"
    assert records[0].basis == "none"


def test_serialization_40001_via_pgcode_psycopg2_style_fake() -> None:
    """psycopg2 同型:码挂在 pgcode 属性也必须被认出来(不绑死 asyncpg)。"""
    v = classify_write_retryability(_PgCodeFake("could not serialize access", pgcode="40001"))
    assert v.retryable is True and v.disposition == "retry" and v.sqlstate == "40001"
    v2 = classify_write_retryability(_PgCodeFake("duplicate key", pgcode="23505"))
    assert v2.retryable is False and v2.disposition == "raise"


def test_serialization_class_name_markers_without_code_still_decide() -> None:
    """无码但有类名证据(psycopg2 裸类名)⇒ 仍可判,不落未判定。"""
    assert classify_write_retryability(SerializationFailure("serialize conflict")).retryable is True
    assert classify_write_retryability(DeadlockDetected("deadlock detected")).retryable is True
    v = classify_write_retryability(UniqueViolation("duplicate key"))
    assert v.retryable is False and v.basis == "exception-class"


def test_serialization_word_in_message_alone_never_flips_retryable() -> None:
    """反例:消息文本里的 "serialization" 不许当重试证据
    (如 "error serializing request payload" 是 JSON 序列化失败,不是 40001)。"""
    v = classify_write_retryability(RuntimeError("error serializing request payload to JSON"))
    assert v.retryable is None and v.disposition == "undetermined"


def test_serialization_wrapped_as_cause_chain_is_still_classified() -> None:
    """中间层包装异常:沿 __cause__ 链找码,不许判成未判定。"""
    wrapped = RuntimeError("write failed")
    wrapped.__cause__ = asyncpg.exceptions.SerializationError("could not serialize access")
    assert classify_write_retryability(wrapped).retryable is True
    wrapped_fk = RuntimeError("write failed")
    wrapped_fk.__cause__ = asyncpg.exceptions.ForeignKeyViolationError("violates fk constraint")
    v = classify_write_retryability(wrapped_fk)
    assert v.retryable is False and v.sqlstate == "23503"


def test_classify_db_write_failure_now_carries_three_state_retryable() -> None:
    """既有 severity 面不被推倒:level 语义原样,新补 retryable 三态。"""
    pkey = asyncpg.exceptions.UniqueViolationError(
        'duplicate key value violates unique constraint "publish_history_pkey"'
    )
    v1 = classify_db_write_failure(pkey, table="publish_history")
    assert v1.level == "error" and v1.repair_hint and v1.retryable is False

    v2 = classify_db_write_failure(
        asyncpg.exceptions.SerializationError("could not serialize access"), table="publish_history"
    )
    assert v2.level == "warning" and v2.retryable is True

    v3 = classify_db_write_failure(RuntimeError("boom"), table="publish_history")
    assert v3.level == "warning" and v3.retryable is None
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
