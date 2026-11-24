# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""R81: partial name sets claim FIELDS arrays for 23 more structures."""

from __future__ import annotations

import pytest

from app.core.serde_struct_catalog import arities_of
from app.core.struct_partial_run_claims import (
    AMBIGUOUS,
    AMBIGUOUS_COUNT,
    CLAIM_RULE,
    CLAIMED_COUNT,
    CLAIMS,
    COVERAGE_AFTER,
    COVERAGE_BEFORE,
    MIN_PARTIAL_NAMES,
    PARTIAL_CLAIMS_ATTESTED,
    TOTAL_CLAIMED_FIELDS,
    PartialClaimError,
    claim_of,
    partial_claims_summary,
)


def test_claim_table_is_self_consistent() -> None:
    assert len(CLAIMS) == CLAIMED_COUNT == 23
    assert len(AMBIGUOUS) == AMBIGUOUS_COUNT
    assert sum(len(f) for _a, _v, f in CLAIMS.values()) == TOTAL_CLAIMED_FIELDS


def test_coverage_arithmetic() -> None:
    assert COVERAGE_BEFORE == 278
    assert COVERAGE_AFTER == 301 == COVERAGE_BEFORE + CLAIMED_COUNT


def test_every_claim_matches_its_catalogued_arity() -> None:
    for name, (arity, _address, fields) in CLAIMS.items():
        assert arity in arities_of(name), name
        assert len(fields) == arity, name


def test_claims_are_not_attested() -> None:
    assert PARTIAL_CLAIMS_ATTESTED is False
    assert CLAIM_RULE == "partial-name-set-subset-of-array"


def test_known_claims_are_intact() -> None:
    assert claim_of("CodexWorkspaceMessage") == (
        "message_id", "message_type", "message_body", "created_at", "archived_at")
    assert claim_of("ChannelPermissions") == ("read", "post", "reply", "edit_metadata")
    assert len(claim_of("CompactedItemWire")) == 13


def test_addresses_are_hex() -> None:
    for _n, (_a, address, _f) in CLAIMS.items():
        assert address.startswith("0x")


def test_every_claim_meets_the_partial_floor() -> None:
    for _n, (_a, _v, fields) in CLAIMS.items():
        assert len(fields) >= MIN_PARTIAL_NAMES


def test_unclaimed_name_returns_empty() -> None:
    assert claim_of("NoSuchClaimedStruct") == ()


def test_summary_matches_the_table() -> None:
    s = partial_claims_summary()
    assert s["claimed"] == 23
    assert s["coverage_after"] == 301
    assert s["attested"] is False


def test_validator_rejects_an_arity_mismatch(monkeypatch: pytest.MonkeyPatch) -> None:
    from app.core import struct_partial_run_claims as mod
    bad = dict(CLAIMS)
    bad["ChannelPermissions"] = (5, "0x1", ("read", "post", "reply", "edit_metadata"))
    monkeypatch.setattr(mod, "CLAIMS", bad)
    monkeypatch.setattr(mod, "CLAIMED_COUNT", len(bad))
    with pytest.raises(PartialClaimError, match="fields vs arity"):
        mod.validate_partial_claims()


def test_validator_rejects_attesting_the_rule(monkeypatch: pytest.MonkeyPatch) -> None:
    from app.core import struct_partial_run_claims as mod
    monkeypatch.setattr(mod, "PARTIAL_CLAIMS_ATTESTED", True)
    with pytest.raises(PartialClaimError, match="containment is not equality"):
        mod.validate_partial_claims()
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
