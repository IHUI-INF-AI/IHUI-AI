# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""Tests for the presentation finaliser contract (R121)."""

from __future__ import annotations

import pytest

from app.core.presentation_finalizer_contract import (
    BOOLEAN_FLAG_COUNT,
    BOOLEAN_FLAGS,
    BULLET_DEFAULTS,
    BULLET_EMU_PER_POINT,
    COVER_CHARTS_NEED_HYBRID,
    FINALIZE_OVERWRITE_ALLOWED,
    FINALIZE_PUBLISHES_BY_HARD_LINK,
    FINALIZE_ROLLBACK_PRESERVES_USER_FILE,
    FINALIZE_SELF_APPROVAL_REJECTED,
    FINALIZE_UNION_OF_CHART_OWNERS,
    FONT_BASIS_VALUES,
    FONT_DEFAULT_FORBIDS_EXPLICIT_FAMILIES,
    FONT_FAMILY_COUNT_RANGE,
    HASHED_SNAPSHOTS,
    MAX_LAYOUT_ARGS,
    MAX_PRESENTATION_BYTES,
    PREFERRED_PRESENTATION_FONTS,
    RECEIPT_SCHEMA_VERSION,
    REFERENCE_EXTENSIONS,
    REFERENCE_FONT_MUST_APPEAR,
    REFERENCE_ONLY_FROM_REFERENCE_BASIS,
    REJECTED_MOTION_OPTIONS,
    RENDER_NEEDS_LIBREOFFICE,
    RENDER_OUTPUT_IS_ONE_BASED,
    REQUIRED_PACKAGE_VALIDATORS,
    SCRIPT_FONT_KEYS,
    SLIDE_COUNT_ADDED_FOR_COVER,
    UTILS_EXPORTS,
    VALUE_FLAG_COUNT,
    VALUE_FLAGS,
    coverage,
    validate_contract,
)


def test_contract_validates() -> None:
    validate_contract()


def test_seven_exports() -> None:
    assert len(UTILS_EXPORTS) == 7
    assert "finalizePresentation" in UTILS_EXPORTS


def test_preferred_fonts_are_four_in_fixed_order() -> None:
    assert PREFERRED_PRESENTATION_FONTS == ("Helvetica Neue", "Helvetica", "Arial", "Aptos")


def test_nineteen_value_flags_and_eight_booleans() -> None:
    assert VALUE_FLAG_COUNT == len(VALUE_FLAGS) == 19
    assert BOOLEAN_FLAG_COUNT == len(BOOLEAN_FLAGS) == 8
    assert "--folio-mode" in VALUE_FLAGS
    assert "--require-uniform-font-family" in BOOLEAN_FLAGS


def test_value_flag_regexes_are_anchored() -> None:
    for name, pattern in VALUE_FLAGS.items():
        assert pattern.startswith("^"), f"{name} is not anchored at the start"
        assert pattern.endswith("$"), f"{name} is not anchored at the end"


def test_layout_args_are_bounded() -> None:
    assert MAX_LAYOUT_ARGS == 96


def test_font_bases_are_four() -> None:
    assert FONT_BASIS_VALUES == ("default", "design", "user_request", "reference")


def test_default_basis_may_not_name_families() -> None:
    assert FONT_DEFAULT_FORBIDS_EXPLICIT_FAMILIES is True


def test_family_count_is_bounded() -> None:
    assert FONT_FAMILY_COUNT_RANGE == (1, 16)


def test_script_slots_are_three() -> None:
    assert SCRIPT_FONT_KEYS == ("ea", "cs", "symbol")


def test_reference_needs_pptx_or_pdf() -> None:
    assert REFERENCE_EXTENSIONS == (".pptx", ".pdf")


def test_a_reference_font_must_be_used() -> None:
    """Any declared family has to appear in the reference's encoded text."""
    assert REFERENCE_FONT_MUST_APPEAR is True


def test_only_reference_basis_may_name_a_file() -> None:
    assert REFERENCE_ONLY_FROM_REFERENCE_BASIS is True


def test_finaliser_refuses_to_overwrite() -> None:
    assert FINALIZE_OVERWRITE_ALLOWED is False


def test_self_approval_is_rejected() -> None:
    assert FINALIZE_SELF_APPROVAL_REJECTED is True


def test_declared_chart_owners_are_unioned() -> None:
    assert FINALIZE_UNION_OF_CHART_OWNERS is True


def test_publication_is_a_hard_link() -> None:
    assert FINALIZE_PUBLISHES_BY_HARD_LINK is True


def test_rollback_preserves_a_user_file() -> None:
    assert FINALIZE_ROLLBACK_PRESERVES_USER_FILE is True


def test_motion_is_rejected() -> None:
    assert len(REJECTED_MOTION_OPTIONS) == 4


def test_four_snapshots_are_rehashed() -> None:
    assert len(HASHED_SNAPSHOTS) == 4
    assert "originalCandidateHash" in HASHED_SNAPSHOTS
    assert "validationHash" in HASHED_SNAPSHOTS


def test_six_packaged_validators() -> None:
    assert len(REQUIRED_PACKAGE_VALIDATORS) == 6


def test_size_ceiling() -> None:
    assert MAX_PRESENTATION_BYTES == 250 * 1024 * 1024


def test_receipt_schema() -> None:
    assert RECEIPT_SCHEMA_VERSION == "presentation-finalization.v1"


def test_cover_charts_need_hybrid() -> None:
    assert COVER_CHARTS_NEED_HYBRID is True


def test_presentations_do_not_need_libreoffice() -> None:
    """The render header routes through @oai/artifact-tool, not soffice."""
    assert RENDER_NEEDS_LIBREOFFICE is False


def test_slide_output_is_one_based() -> None:
    assert RENDER_OUTPUT_IS_ONE_BASED is True


def test_cover_adds_one_slide() -> None:
    assert SLIDE_COUNT_ADDED_FOR_COVER == 1


def test_bullet_geometry_uses_emu() -> None:
    assert BULLET_EMU_PER_POINT == 12_700
    assert BULLET_DEFAULTS["marginLeftPoints"] == 18
    assert BULLET_DEFAULTS["hangingPoints"] == 9


def test_coverage_reports_what_was_read() -> None:
    c = coverage()
    assert c["exports"] == 7
    assert c["value_flags"] == 19
    assert c["boolean_flags"] == 8


def test_claiming_overwrite_is_rejected(monkeypatch: pytest.MonkeyPatch) -> None:
    from app.core import presentation_finalizer_contract as c

    monkeypatch.setattr(c, "FINALIZE_OVERWRITE_ALLOWED", True)
    with pytest.raises(ValueError):
        c.validate_contract()


def test_claiming_self_approval_is_allowed_is_rejected(monkeypatch: pytest.MonkeyPatch) -> None:
    from app.core import presentation_finalizer_contract as c

    monkeypatch.setattr(c, "FINALIZE_SELF_APPROVAL_REJECTED", False)
    with pytest.raises(ValueError):
        c.validate_contract()


def test_claiming_libreoffice_is_needed_is_rejected(monkeypatch: pytest.MonkeyPatch) -> None:
    from app.core import presentation_finalizer_contract as c

    monkeypatch.setattr(c, "RENDER_NEEDS_LIBREOFFICE", True)
    with pytest.raises(ValueError):
        c.validate_contract()


def test_claiming_a_reference_font_need_not_appear_is_rejected(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    from app.core import presentation_finalizer_contract as c

    monkeypatch.setattr(c, "REFERENCE_FONT_MUST_APPEAR", False)
    with pytest.raises(ValueError):
        c.validate_contract()
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
