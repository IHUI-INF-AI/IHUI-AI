# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""Tests for the coverage ledger (R113)."""

from __future__ import annotations

import pytest

from app.core.codex_coverage_ledger import (
    DOMAINS,
    UNREACHABLE,
    UNREACHABLE_COUNT,
    AuditError,
    complete,
    coverage_ratio,
    covered_total,
    domain_ratios,
    reachable_total,
    remaining_by_domain,
    report,
    validate_ledger,
)


def test_ledger_validates() -> None:
    validate_ledger()


def test_denominator_is_the_sum_of_reachable_entities() -> None:
    assert reachable_total() == sum(d.total for d in DOMAINS)
    assert reachable_total() > 0


def test_coverage_is_consistent() -> None:
    assert covered_total() == sum(d.covered for d in DOMAINS)
    assert 0.0 <= coverage_ratio() <= 1.0


def test_not_complete_yet() -> None:
    """The honest answer today."""
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


def test_documents_contract_but_not_behaviour() -> None:
    by_key = {x.key: x for x in DOMAINS}
    assert by_key["documents_tools_contract"].ratio == 1.0
    assert by_key["documents_tools_behaviour"].covered == 1
    assert by_key["documents_tools_behaviour"].remaining == 35


def test_node_scripts_untouched() -> None:
    d = {x.key: x for x in DOMAINS}["node_scripts"]
    assert d.total == 15
    assert d.covered == 0


def test_four_unreachable_domains_each_carry_evidence() -> None:
    assert len(UNREACHABLE) == UNREACHABLE_COUNT == 4
    for key, reason, evidence in UNREACHABLE:
        assert reason and evidence
        assert len(evidence) > 40, f"{key} needs real evidence, not a shrug"


def test_unreachable_keys_do_not_overlap() -> None:
    reachable_keys = {d.key for d in DOMAINS}
    for key, _, _ in UNREACHABLE:
        assert key not in reachable_keys


def test_report_shape() -> None:
    r = report()
    assert r["reachable_total"] == reachable_total()
    assert r["complete"] is False
    assert len(r["unreachable"]) == 4


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
        (("x", "because", "probably cannot, maybe later"),),
    )
    with pytest.raises(AuditError):
        validate_ledger()


def test_domain_ratios_and_remaining() -> None:
    ratios = domain_ratios()
    remaining = remaining_by_domain()
    assert set(ratios) == {d.key for d in DOMAINS}
    assert set(remaining) == {d.key for d in DOMAINS}
    assert remaining["node_scripts"] == 15
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
