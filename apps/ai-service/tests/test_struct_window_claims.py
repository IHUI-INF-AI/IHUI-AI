# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""R83: sliding-window claims and their two-tier evidence grading."""

from __future__ import annotations

import pytest

from app.core.hook_definition_contract import HOOK_DEFINITION_OBJECTS
from app.core.serde_struct_catalog import arities_of
from app.core.struct_window_claims import (
    COVERAGE_AFTER,
    COVERAGE_BEFORE,
    CROSS_SOURCE_ATTESTED,
    MIN_SCORE,
    THIN_EVIDENCE,
    UNCLAIMED_UNDER,
    WIDTH,
    WINDOW_CLAIMS,
    WINDOW_CLAIMS_ATTESTED,
    WindowClaimError,
    fields_of,
    score_of,
    thin_share,
    validate_window_claims,
    window_claims_summary,
)


def test_table_and_coverage() -> None:
    assert len(WINDOW_CLAIMS) == WIDTH == 16
    assert COVERAGE_BEFORE == 305
    assert COVERAGE_AFTER == 321 == COVERAGE_BEFORE + WIDTH
    assert UNCLAIMED_UNDER == 144
    assert WINDOW_CLAIMS_ATTESTED is False
    validate_window_claims()


def test_no_overlap_with_earlier_tables() -> None:
    from app.core.struct_fields_run_pairs import FIELDS_RUNS
    from app.core.struct_partial_run_claims import CLAIMS
    from app.core.struct_pool_address_attribution import ADDRESS_HITS
    from app.core.struct_strict_reconstruction import STRICT_STRUCTURES
    for name in WINDOW_CLAIMS:
        assert name not in STRICT_STRUCTURES, name
        assert name not in CLAIMS, name
        assert name not in FIELDS_RUNS, name
        assert name not in ADDRESS_HITS, name


def test_the_cross_source_claim_matches_the_json_schema_exactly() -> None:
    name = "PreToolUseHookSpecificOutputWire"
    assert tuple(CROSS_SOURCE_ATTESTED) == (name,)
    schema_fields, schema_required = HOOK_DEFINITION_OBJECTS[name]
    assert set(fields_of(name)) == set(schema_fields)
    assert len(fields_of(name)) == len(schema_fields) == 5
    for req in schema_required:
        assert req in fields_of(name)


def test_capability_pairs_are_self_consistent() -> None:
    assert fields_of("ClientCapabilities") == (
        "experimental", "extensions", "roots", "sampling", "elicitation")
    assert set(fields_of("ServerCapabilities")) >= {
        "experimental", "extensions", "roots", "sampling", "elicitation"}
    assert fields_of("ModelReroutedNotification") == (
        "threadId", "turnId", "fromModel", "toModel", "reason")


def test_thin_evidence_sits_at_the_score_floor() -> None:
    assert len(THIN_EVIDENCE) == 2
    for name in THIN_EVIDENCE:
        assert score_of(name) == MIN_SCORE


def test_grading_partitions_the_table() -> None:
    assert len(CROSS_SOURCE_ATTESTED) + len(THIN_EVIDENCE) == 3
    assert not set(CROSS_SOURCE_ATTESTED) & set(THIN_EVIDENCE)


def test_thin_share_is_measured() -> None:
    assert thin_share() == pytest.approx(2 / 16)


def test_every_claim_matches_its_catalogued_arity() -> None:
    for name, (arity, _a, _o, _s, fields) in WINDOW_CLAIMS.items():
        assert arity in arities_of(name), name
        assert len(fields) == arity, name


def test_unclaimed_returns_empty() -> None:
    assert fields_of("NoSuchWindowStruct") == ()
    assert score_of("NoSuchWindowStruct") == 0


def test_summary_matches() -> None:
    s = window_claims_summary()
    assert s["width"] == 16
    assert s["coverage_after"] == 321
    assert s["attested"] == 1
    assert s["thin"] == 2


def test_validator_rejects_attesting_all(monkeypatch: pytest.MonkeyPatch) -> None:
    from app.core import struct_window_claims as mod
    monkeypatch.setattr(mod, "WINDOW_CLAIMS_ATTESTED", True)
    with pytest.raises(WindowClaimError, match="name-overlap scoring is not proof"):
        mod.validate_window_claims()


def test_validator_rejects_a_thin_claim_above_the_floor(monkeypatch: pytest.MonkeyPatch) -> None:
    from app.core import struct_window_claims as mod
    bumped = dict(WINDOW_CLAIMS)
    arity, address, off, _score, fields = bumped["ExecutorPlugin"]
    bumped["ExecutorPlugin"] = (arity, address, off, MIN_SCORE + 1, fields)
    monkeypatch.setattr(mod, "WINDOW_CLAIMS", bumped)
    with pytest.raises(WindowClaimError, match="must sit at the score floor"):
        mod.validate_window_claims()


def test_validator_rejects_a_score_above_arity(monkeypatch: pytest.MonkeyPatch) -> None:
    from app.core import struct_window_claims as mod
    bad = dict(WINDOW_CLAIMS)
    arity, address, off, _score, fields = bad["FsRemoveParams"]
    bad["FsRemoveParams"] = (arity, address, off, arity + 1, fields)
    monkeypatch.setattr(mod, "WINDOW_CLAIMS", bad)
    with pytest.raises(WindowClaimError, match="outside"):
        mod.validate_window_claims()
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
