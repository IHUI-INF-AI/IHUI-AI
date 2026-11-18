# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""Tests for the content-level finding contract (R98)."""

from __future__ import annotations

import pytest

from app.core.codex_presentation_gate_findings import (
    EXIT_CLEAN,
    EXIT_CODE_COUNT,
    EXIT_FINDINGS,
    EXIT_STRUCTURAL_OR_USAGE,
    FINDING_DISCRIMINATOR,
    FINDING_KIND_COUNT,
    FINDING_KINDS,
    FINDINGS_AND_WARNINGS_ARE_SEPARATE_LISTS,
    FINDINGS_EXIT_CODE_DISCOVERED_IN_R98,
    FINDINGS_OBSERVED_ALL_EXIT_1,
    FLAG_TO_OBSERVED_TIER,
    INTEGRITY_CLAIM_BOUNDARY,
    INTEGRITY_INSPECTS_SLIDE_TEXT,
    INTEGRITY_KEYS,
    INTEGRITY_PASS_STATUS,
    NATIVE_TABLE_FLAG_NOT_ACCEPTED_IN_OBSERVED_FORM,
    PROSE_CAP_NOT_TRIGGERED,
    UNTRIGGERED_KINDS,
    WARNING_IS_NOT_ESCALATED_BY_FAIL_ON_FINDINGS,
    WARNING_KIND_COUNT,
    WARNING_KINDS,
    WARNING_UNDER_BOTH_FLAGS_STILL_CLEAN,
    GateFindingError,
    escalates_to_failure,
    exit_tier,
    findings_contract,
    is_finding_kind,
    is_warning_kind,
    payload_fields_of,
    severity_of,
    validate_findings_contract,
)


def test_contract_validates() -> None:
    validate_findings_contract()


def test_three_state_exit_codes() -> None:
    assert EXIT_CODE_COUNT == 3
    assert (EXIT_CLEAN, EXIT_FINDINGS, EXIT_STRUCTURAL_OR_USAGE) == (0, 1, 2)


def test_exit_tiers() -> None:
    assert exit_tier(0) == "clean-or-warnings-only"
    assert exit_tier(1) == "findings"
    assert exit_tier(2) == "structural-or-usage"


def test_exit_code_outside_the_model_raises() -> None:
    with pytest.raises(GateFindingError):
        exit_tier(3)


def test_rc_one_is_the_new_discovery() -> None:
    assert FINDINGS_EXIT_CODE_DISCOVERED_IN_R98 is True


def test_warning_never_escalates() -> None:
    assert WARNING_IS_NOT_ESCALATED_BY_FAIL_ON_FINDINGS is True
    assert escalates_to_failure("presentation_heading_trailing_full_stop", True) is False
    assert WARNING_UNDER_BOTH_FLAGS_STILL_CLEAN is True


def test_findings_need_the_strictness_flag() -> None:
    assert escalates_to_failure("inconsistent_presentation_font_family", False) is False
    assert escalates_to_failure("inconsistent_presentation_font_family", True) is True


def test_three_observed_finding_kinds() -> None:
    assert FINDING_KIND_COUNT == 3
    assert is_finding_kind("inconsistent_presentation_font_family")
    assert is_finding_kind("requested_slide_count_changed")
    assert is_finding_kind("unexpected_slide_aspect_ratio")
    assert FINDINGS_OBSERVED_ALL_EXIT_1 is True


def test_one_observed_warning_kind() -> None:
    assert WARNING_KIND_COUNT == 1
    assert is_warning_kind("presentation_heading_trailing_full_stop")
    assert is_finding_kind("presentation_heading_trailing_full_stop") is False


def test_severity_discriminates() -> None:
    assert severity_of("inconsistent_presentation_font_family") == "finding"
    assert severity_of("presentation_heading_trailing_full_stop") == "warning"
    with pytest.raises(GateFindingError):
        severity_of("not-a-kind")


def test_payload_fields() -> None:
    assert payload_fields_of("inconsistent_presentation_font_family") == (
        "font_families",
        "font_family_count",
    )
    assert "expected_aspect" in payload_fields_of("unexpected_slide_aspect_ratio")
    assert "character_count" in payload_fields_of("presentation_heading_trailing_full_stop")
    with pytest.raises(GateFindingError):
        payload_fields_of("nope")


def test_kind_sets_do_not_overlap() -> None:
    assert not (set(FINDING_KINDS) & set(WARNING_KINDS))
    assert FINDING_DISCRIMINATOR == "kind"


def test_findings_and_warnings_are_separate_lists() -> None:
    assert FINDINGS_AND_WARNINGS_ARE_SEPARATE_LISTS is True


def test_integrity_claim_boundary_is_verbatim() -> None:
    assert INTEGRITY_PASS_STATUS == "pass"
    assert INTEGRITY_CLAIM_BOUNDARY.startswith("Structural package checks only")
    assert "slide text" in INTEGRITY_CLAIM_BOUNDARY
    assert INTEGRITY_INSPECTS_SLIDE_TEXT is False
    assert len(INTEGRITY_KEYS) == 8


def test_flag_tier_table() -> None:
    assert FLAG_TO_OBSERVED_TIER["--require-uniform-font-family"] == "finding"
    assert FLAG_TO_OBSERVED_TIER["--validate-heading-punctuation"] == "warning"


def test_untriggered_surface_is_stated() -> None:
    assert PROSE_CAP_NOT_TRIGGERED is True
    assert NATIVE_TABLE_FLAG_NOT_ACCEPTED_IN_OBSERVED_FORM is True
    assert len(UNTRIGGERED_KINDS) == 3


def test_contract_mapping_shape() -> None:
    c = findings_contract()
    assert c["exit_states"] == 3
    assert c["finding_kinds"] == 3
    assert c["warning_escalates"] is False
    assert c["integrity_inspects_text"] is False


def test_validate_rejects_escalated_warning(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(
        "app.core.codex_presentation_gate_findings."
        "WARNING_IS_NOT_ESCALATED_BY_FAIL_ON_FINDINGS",
        False,
    )
    with pytest.raises(GateFindingError):
        validate_findings_contract()


def test_validate_rejects_a_two_state_exit_model(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr("app.core.codex_presentation_gate_findings.EXIT_CODE_COUNT", 2)
    with pytest.raises(GateFindingError):
        validate_findings_contract()
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
