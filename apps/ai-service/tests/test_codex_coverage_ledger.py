# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""Tests for the coverage ledger (R113, three-tier correction in R114)."""

from __future__ import annotations

import pytest

from app.core.codex_coverage_ledger import (
    DOMAINS,
    SEMANTIC_FACE_COUNT,
    SEMANTIC_FACES,
    STRUCTURAL_REPORT_COUNT,
    UNREACHABLE,
    UNREACHABLE_COUNT,
    AuditError,
    closed_tier_complete,
    complete,
    coverage_ratio,
    covered_total,
    domain_ratios,
    reachable_total,
    remaining_by_domain,
    report,
    semantic_faces_covered,
    validate_ledger,
)


def test_ledger_validates() -> None:
    validate_ledger()


def test_denominator_is_the_sum_of_closed_entities() -> None:
    assert reachable_total() == sum(d.total for d in DOMAINS)
    assert reachable_total() > 0


def test_coverage_is_consistent() -> None:
    assert covered_total() == sum(d.covered for d in DOMAINS)
    assert 0.0 <= coverage_ratio() <= 1.0


def test_not_complete_yet() -> None:
    """The honest answer today: the closed tier is not finished."""
    assert closed_tier_complete() is False
    assert complete() is False
    assert coverage_ratio() < 1.0


def test_every_domain_declares_what_was_done() -> None:
    for d in DOMAINS:
        assert d.note, f"{d.key} must record what was done"
        assert 0 <= d.covered <= d.total


def test_presentations_are_fully_behaviour_tested() -> None:
    d = {x.key: x for x in DOMAINS}["presentations_tools"]
    assert d.covered == d.total == 12
    assert d.remaining == 0


def test_documents_contract_complete_and_behaviour_partly_exercised() -> None:
    by_key = {x.key: x for x in DOMAINS}
    assert by_key["documents_tools_contract"].ratio == 1.0
    assert by_key["documents_tools_behaviour"].ratio == 1.0
    assert by_key["documents_tools_behaviour"].remaining == 0


def test_node_scripts_partly_executed() -> None:
    """R120 executed six; R121 to R128 read nine more end to end."""
    d = {x.key: x for x in DOMAINS}["node_scripts"]
    assert d.total == 15
    assert d.covered == 15
    assert d.remaining == 0


def test_the_binary_is_not_declared_unreachable() -> None:
    """R114 correction: static extraction reached it, so it is not in the unreachable tier."""
    keys = {k for k, _, _ in UNREACHABLE}
    assert "binary_semantics" not in keys
    assert "agent_runtime" not in keys


def test_three_unreachable_items_each_carry_real_evidence() -> None:
    assert len(UNREACHABLE) == UNREACHABLE_COUNT == 3
    for key, reason, evidence in UNREACHABLE:
        assert reason and evidence
        assert len(evidence) > 80, f"{key} needs real evidence, not a shrug"


def test_unreachable_keys_do_not_overlap_closed_domains() -> None:
    closed_keys = {d.key for d in DOMAINS}
    for key, _, _ in UNREACHABLE:
        assert key not in closed_keys


def test_semantic_faces_are_all_landed() -> None:
    """Twenty-two faces were recovered statically and each landed with a report."""
    assert len(SEMANTIC_FACES) == SEMANTIC_FACE_COUNT
    assert SEMANTIC_FACE_COUNT >= 22
    assert semantic_faces_covered() == SEMANTIC_FACE_COUNT


def test_semantic_faces_are_unique_and_attributed() -> None:
    keys = [k for k, _, _ in SEMANTIC_FACES]
    assert len(set(keys)) == len(keys)
    rounds = {r for _, r, _ in SEMANTIC_FACES}
    assert "R11" in rounds and "R23" in rounds


def test_unbounded_tier_is_declared_unbounded() -> None:
    """A percentage over an unknown denominator would be a fake number."""
    r = report()
    assert r["semantic_tier_bounded"] is False
    assert "closed_ratio" in r
    assert "semantic_faces" in r


def test_structural_catalogue_is_counted_separately() -> None:
    """The struct catalogue is not a set of runtime faces."""
    assert STRUCTURAL_REPORT_COUNT == 47
    assert STRUCTURAL_REPORT_COUNT != SEMANTIC_FACE_COUNT


def test_report_shape() -> None:
    r = report()
    assert r["closed_total"] == reachable_total()
    assert r["complete"] is False
    assert r["closed_complete"] is False
    assert len(r["unreachable"]) == 3


def test_over_claiming_is_rejected(monkeypatch: pytest.MonkeyPatch) -> None:
    """A domain cannot claim more than it holds."""
    from app.core import codex_coverage_ledger as ledger

    monkeypatch.setattr(ledger, "DOMAINS", (ledger.Domain("x", "x", 5, 9, "note"),))
    with pytest.raises(AuditError):
        validate_ledger()


def test_unreachable_hedging_is_rejected(monkeypatch: pytest.MonkeyPatch) -> None:
    from app.core import codex_coverage_ledger as ledger

    monkeypatch.setattr(
        ledger,
        "UNREACHABLE",
        (("x", "because", "probably cannot be done, maybe later we will see about it somehow"),),
    )
    with pytest.raises(AuditError):
        validate_ledger()


def test_short_evidence_is_rejected(monkeypatch: pytest.MonkeyPatch) -> None:
    from app.core import codex_coverage_ledger as ledger

    monkeypatch.setattr(ledger, "UNREACHABLE", (("x", "because", "nope"),))
    with pytest.raises(AuditError):
        validate_ledger()


def test_duplicate_semantic_face_is_rejected(monkeypatch: pytest.MonkeyPatch) -> None:
    from app.core import codex_coverage_ledger as ledger

    dup = (("a", "R1", "x"), ("a", "R2", "y"))
    monkeypatch.setattr(ledger, "SEMANTIC_FACES", dup)
    monkeypatch.setattr(ledger, "SEMANTIC_FACE_COUNT", 2)
    with pytest.raises(AuditError):
        validate_ledger()


def test_domain_ratios_and_remaining() -> None:
    ratios = domain_ratios()
    remaining = remaining_by_domain()
    assert set(ratios) == {d.key for d in DOMAINS}
    assert set(remaining) == {d.key for d in DOMAINS}
    assert remaining["node_scripts"] == 0
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
