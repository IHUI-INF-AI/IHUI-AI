# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""R82: address-level attribution, its falsification and its measured misfit rate."""

from __future__ import annotations

import pytest

from app.core.serde_struct_catalog import arities_of
from app.core.struct_pool_address_attribution import (
    ADDRESS_HITS,
    ADDRESS_LEVEL_ATTESTED,
    ATTRIBUTION_RULE,
    COVERAGE_AFTER,
    COVERAGE_BEFORE,
    FALSIFICATION_ID,
    HIT_COUNT,
    MISFIT_COUNT,
    NEW_COUNT,
    NEW_STRUCTS,
    RUNS_SINGLE_POOL,
    RUNS_WITH_LEA,
    SEMANTIC_MISFIT,
    TEMPLATE_TOTAL,
    AddressAttributionError,
    address_attribution_summary,
    fields_by_address,
    misfit_rate,
    validate_address_attribution,
)


def test_template_lea_is_the_falsification() -> None:
    assert TEMPLATE_TOTAL == 3186
    assert FALSIFICATION_ID == "template-has-no-lea-site"
    from app.core.struct_pool_address_attribution import TEMPLATES_WITH_LEA
    assert TEMPLATES_WITH_LEA == 0


def test_runs_with_lea_exceed_hits() -> None:
    assert RUNS_WITH_LEA == 2141
    assert RUNS_SINGLE_POOL > HIT_COUNT == 11


def test_counts_are_consistent() -> None:
    assert len(ADDRESS_HITS) == HIT_COUNT == 11
    assert MISFIT_COUNT == len(SEMANTIC_MISFIT) == 1
    assert NEW_COUNT == len(NEW_STRUCTS) == 4


def test_coverage_arithmetic() -> None:
    assert COVERAGE_BEFORE == 301
    assert COVERAGE_AFTER == 305 == COVERAGE_BEFORE + NEW_COUNT


def test_misfit_rate_is_measured_not_assumed() -> None:
    assert misfit_rate() == pytest.approx(1 / 11)


def test_the_known_misfit_is_semantically_wrong() -> None:
    assert "ByteRange" in SEMANTIC_MISFIT
    assert fields_by_address("ByteRange") == ("credential_export", "delivery")


def test_new_structs_read_self_consistently() -> None:
    assert fields_by_address("FsChangedNotification") == ("watchId", "changedPaths")
    assert fields_by_address("TextPosition") == ("line", "column")
    assert fields_by_address("WindowsSandboxProvisioningSettings") == (
        "proxy_ports", "allow_local_binding")
    assert fields_by_address("ElicitationCapability") == ("threadId", "sessionId")


def test_attribution_is_not_attested() -> None:
    assert ADDRESS_LEVEL_ATTESTED is False
    assert ATTRIBUTION_RULE == "all-pointers-inside-one-pool-and-length-equals-arity"
    validate_address_attribution()


def test_every_hit_matches_its_catalogued_arity() -> None:
    for name, (arity, _a, fields) in ADDRESS_HITS.items():
        assert arity in arities_of(name), name
        assert len(fields) == arity, name


def test_unattributed_name_returns_empty() -> None:
    assert fields_by_address("NoSuchAddressStruct") == ()


def test_summary_matches() -> None:
    s = address_attribution_summary()
    assert s["hits"] == 11
    assert s["misfit"] == 1
    assert s["coverage_after"] == 305
    assert s["attested"] is False


def test_validator_rejects_attesting(monkeypatch: pytest.MonkeyPatch) -> None:
    from app.core import struct_pool_address_attribution as mod
    monkeypatch.setattr(mod, "ADDRESS_LEVEL_ATTESTED", True)
    with pytest.raises(AddressAttributionError, match="pool test misfires"):
        mod.validate_address_attribution()


def test_validator_rejects_a_misfit_promoted_to_gain(monkeypatch: pytest.MonkeyPatch) -> None:
    from app.core import struct_pool_address_attribution as mod
    promoted = mod.NEW_STRUCTS + ("ByteRange",)
    monkeypatch.setattr(mod, "NEW_STRUCTS", promoted)
    monkeypatch.setattr(mod, "NEW_COUNT", len(promoted))
    monkeypatch.setattr(mod, "COVERAGE_AFTER", mod.COVERAGE_BEFORE + len(promoted))
    with pytest.raises(AddressAttributionError, match="misfit cannot also be a gain"):
        mod.validate_address_attribution()


def test_validator_rejects_an_arity_mismatch(monkeypatch: pytest.MonkeyPatch) -> None:
    from app.core import struct_pool_address_attribution as mod
    bad = dict(ADDRESS_HITS)
    bad["TextPosition"] = (3, "0x1", ("line", "column"))
    monkeypatch.setattr(mod, "ADDRESS_HITS", bad)
    with pytest.raises(AddressAttributionError, match="fields vs arity"):
        mod.validate_address_attribution()
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
