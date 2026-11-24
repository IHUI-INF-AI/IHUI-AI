# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""G-816004 验收:审批注册/结算的代际 CAS —— 两把锁各给各的 reasonCode。

四条断言成对(票面):
① 同代同快照 ⇒ 放行;
② 换代 ⇒ 拒且 reasonCode=superseded;
③ 快照变 ⇒ 拒且 reasonCode=snapshot_mismatch(两码不同形是判据本身);
④ 迟到 resolve ⇒ 返回 False 且不抛、且副作用没发生(apply 闭包未执行)。

测试隔离(AGENTS §5):纯内存,零生产库,零外呼。
"""

from __future__ import annotations

import pytest

from app.services.approval_generation_cas import (
    REASON_SNAPSHOT_MISMATCH,
    REASON_SUPERSEDED,
    STATE_PENDING,
    STATE_RESOLVED,
    STATE_TIMED_OUT,
    ApprovalGenerationCas,
    ApprovalGenerationError,
    ApprovalSpec,
    content_digest,
)

_SESSION = "sess-cas-1"
_TOOL = "run_command"
_DIGEST_V1 = content_digest({"command": "git status"})
_DIGEST_V2 = content_digest({"command": "git push"})


def _spec(generation: int, snapshot_digest: str, deadline_seconds: float | None = None) -> ApprovalSpec:
    return ApprovalSpec(
        request_id="appr-cas-0001",
        session_id=_SESSION,
        tool_name=_TOOL,
        generation=generation,
        snapshot_digest=snapshot_digest,
        deadline_seconds=deadline_seconds,
    )


# ---------------------------------------------------------------------------
# ① 同代同快照 ⇒ 放行
# ---------------------------------------------------------------------------
def test_same_generation_same_snapshot_resolves() -> None:
    cas = ApprovalGenerationCas()
    cas.register(_spec(1, _DIGEST_V1))

    effects: list[str] = []
    outcome = cas.resolve(
        "appr-cas-0001",
        "approve",
        generation=1,
        snapshot_digest=_DIGEST_V1,
        apply=lambda: effects.append("settled"),
    )

    assert outcome.applied is True
    assert outcome.state == STATE_RESOLVED
    assert cas.describe("appr-cas-0001")["decision"] == "approve"
    # 放行的决策必须真的产生副作用(与 ④ 的"没发生"成对)
    assert effects == ["settled"]


# ---------------------------------------------------------------------------
# ② 换代 ⇒ 拒且 reasonCode=superseded
# ---------------------------------------------------------------------------
def test_generation_change_rejected_with_superseded() -> None:
    cas = ApprovalGenerationCas()
    cas.register(_spec(1, _DIGEST_V1))
    cas.supersede("appr-cas-0001", generation=2, snapshot_digest=_DIGEST_V1)

    veto = cas.validate("appr-cas-0001", generation=1, snapshot_digest=_DIGEST_V1)
    assert veto is not None and veto.reason_code == REASON_SUPERSEDED

    effects: list[str] = []
    outcome = cas.resolve(
        "appr-cas-0001",
        "approve",
        generation=1,
        snapshot_digest=_DIGEST_V1,
        apply=lambda: effects.append("settled"),
    )

    assert outcome.applied is False
    assert outcome.reason_code == REASON_SUPERSEDED
    # 副作用没发生:旧代决策既没落账也没唤醒
    assert effects == []
    assert cas.describe("appr-cas-0001")["decision"] is None


# ---------------------------------------------------------------------------
# ③ 快照变 ⇒ 拒且 reasonCode=snapshot_mismatch(与 ② 的码必须不同形)
# ---------------------------------------------------------------------------
def test_snapshot_change_rejected_with_snapshot_mismatch() -> None:
    cas = ApprovalGenerationCas()
    cas.register(_spec(1, _DIGEST_V1))

    veto = cas.validate("appr-cas-0001", generation=1, snapshot_digest=_DIGEST_V2)
    assert veto is not None and veto.reason_code == REASON_SNAPSHOT_MISMATCH

    effects: list[str] = []
    outcome = cas.resolve(
        "appr-cas-0001",
        "approve",
        generation=1,
        snapshot_digest=_DIGEST_V2,
        apply=lambda: effects.append("settled"),
    )

    assert outcome.applied is False
    assert outcome.reason_code == REASON_SNAPSHOT_MISMATCH
    assert effects == []
    assert cas.describe("appr-cas-0001")["decision"] is None


def test_two_reason_codes_are_distinct_shapes() -> None:
    """两码不同形是判据本身:并码等于把"该重新问用户"与"该丢弃"混成一件。"""
    cas_gen = ApprovalGenerationCas()
    cas_gen.register(_spec(1, _DIGEST_V1))
    cas_gen.supersede("appr-cas-0001", generation=2, snapshot_digest=_DIGEST_V1)
    superseded_code = cas_gen.validate(
        "appr-cas-0001", generation=1, snapshot_digest=_DIGEST_V1
    ).reason_code

    cas_snap = ApprovalGenerationCas()
    cas_snap.register(_spec(1, _DIGEST_V1))
    snapshot_code = cas_snap.validate(
        "appr-cas-0001", generation=1, snapshot_digest=_DIGEST_V2
    ).reason_code

    assert superseded_code == REASON_SUPERSEDED
    assert snapshot_code == REASON_SNAPSHOT_MISMATCH
    assert superseded_code != snapshot_code


# ---------------------------------------------------------------------------
# ④ 迟到 resolve ⇒ 返回 False 且不抛、且副作用没发生
# ---------------------------------------------------------------------------
def test_late_resolve_after_deadline_returns_false_without_side_effect() -> None:
    cas = ApprovalGenerationCas()
    cas.register(_spec(1, _DIGEST_V1, deadline_seconds=0.02))
    assert cas.wait_terminal("appr-cas-0001", timeout=5.0) == STATE_TIMED_OUT

    effects: list[str] = []
    outcome = cas.resolve(
        "appr-cas-0001",
        "approve",
        generation=1,
        snapshot_digest=_DIGEST_V1,
        apply=lambda: effects.append("settled"),
    )

    assert outcome.applied is False  # 迟到决策返回 False
    assert outcome.reason_code == REASON_SUPERSEDED
    assert effects == []  # 副作用没发生
    assert cas.describe("appr-cas-0001")["decision"] is None


def test_late_resolve_after_already_settled_returns_false_without_overwrite() -> None:
    cas = ApprovalGenerationCas()
    cas.register(_spec(1, _DIGEST_V1))
    effects: list[str] = []
    first = cas.resolve(
        "appr-cas-0001",
        "approve",
        generation=1,
        snapshot_digest=_DIGEST_V1,
        apply=lambda: effects.append("first"),
    )
    assert first.applied is True

    second = cas.resolve(
        "appr-cas-0001",
        "reject",  # 迟到的第二个决策
        generation=1,
        snapshot_digest=_DIGEST_V1,
        apply=lambda: effects.append("second"),
    )

    assert second.applied is False  # 不抛、返回 False
    assert effects == ["first"]  # 第二次的副作用没发生
    assert cas.describe("appr-cas-0001")["decision"] == "approve"  # 决策未被覆盖


# ---------------------------------------------------------------------------
# 注册盖章语义(open() / broker)
# ---------------------------------------------------------------------------
def test_pending_same_id_with_different_generation_requires_explicit_supersede() -> None:
    """open() 遇 pending 且非同代 ⇒ 抛 "must be superseded explicitly"。"""
    cas = ApprovalGenerationCas()
    cas.register(_spec(1, _DIGEST_V1))

    with pytest.raises(ApprovalGenerationError) as excinfo:
        cas.register(_spec(2, _DIGEST_V2))

    assert excinfo.value.reason_code == REASON_SUPERSEDED
    assert "superseded" in str(excinfo.value)


def test_same_stamp_replay_is_idempotent() -> None:
    """同代同快照的重放 = 幂等返回现有盖章(open() sameGeneration 分支)。"""
    cas = ApprovalGenerationCas()
    stamp1 = cas.register(_spec(1, _DIGEST_V1))
    stamp2 = cas.register(_spec(1, _DIGEST_V1))

    assert stamp2 == stamp1
    assert cas.state_of("appr-cas-0001") == STATE_PENDING


def test_supersede_settles_old_pending_and_advances_generation() -> None:
    cas = ApprovalGenerationCas()
    cas.register(_spec(1, _DIGEST_V1))
    stamp = cas.supersede("appr-cas-0001", generation=2, snapshot_digest=_DIGEST_V1)

    assert stamp.generation == 2
    # 新代可用;旧代在终态(pending 态已让位)
    assert cas.state_of("appr-cas-0001") == STATE_PENDING
    new_gen_outcome = cas.resolve(
        "appr-cas-0001", "approve", generation=2, snapshot_digest=_DIGEST_V1
    )
    assert new_gen_outcome.applied is True


def test_supersede_requires_advancing_generation() -> None:
    cas = ApprovalGenerationCas()
    cas.register(_spec(2, _DIGEST_V1))

    with pytest.raises(ApprovalGenerationError):
        cas.supersede("appr-cas-0001", generation=2, snapshot_digest=_DIGEST_V1)
    with pytest.raises(ApprovalGenerationError):
        cas.supersede("appr-cas-0001", generation=1, snapshot_digest=_DIGEST_V1)


# ---------------------------------------------------------------------------
# validate 与 resolve 分离;deadline timer 结算 timed_out
# ---------------------------------------------------------------------------
def test_validate_is_read_only() -> None:
    cas = ApprovalGenerationCas()
    cas.register(_spec(1, _DIGEST_V1))

    for _ in range(3):
        assert cas.validate("appr-cas-0001", generation=1, snapshot_digest=_DIGEST_V1) is None

    assert cas.state_of("appr-cas-0001") == STATE_PENDING
    assert cas.describe("appr-cas-0001")["decision"] is None


def test_deadline_timer_settles_timed_out() -> None:
    cas = ApprovalGenerationCas()
    cas.register(_spec(1, _DIGEST_V1, deadline_seconds=0.02))

    assert cas.wait_terminal("appr-cas-0001", timeout=5.0) == STATE_TIMED_OUT
    snapshot = cas.describe("appr-cas-0001")
    assert snapshot["state"] == STATE_TIMED_OUT
    assert snapshot["decision"] is None
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
