# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 本仓库以 Apache-2.0 授权分发，须保留本声明与 LICENSE / NOTICE。

"""`db_write_guard` 判定层的回归锁。

立论(2026-09-27 实测):`publish_history` 序列落后 ⇒ 每次 INSERT 撞 `*_pkey`,
而两处写入方都 `except Exception → logger.warning` ⇒ 审计静默丢失。这一格的修复判据是
**「撞主键必须喊到 error 并给出修复出口」**，所以测试必须证明判级真的会翻，而不是恒绿。
"""

from __future__ import annotations

import asyncpg

from app.services.publish.db_write_guard import classify_db_write_failure


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
