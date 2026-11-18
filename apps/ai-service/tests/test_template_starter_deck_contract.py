# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""Tests for the starter-deck preparation contract (R127)."""

from __future__ import annotations

import pytest

from app.core.template_starter_deck_contract import (
    BUILD_MODE,
    CONTACT_SHEET_FALLBACK_PRESENT_LOCALLY,
    CONTACT_SHEET_FALLBACK_PYTHON,
    CONTACT_SHEET_OPTIONAL,
    DEFAULT_SCALE,
    DELETES_ORIGINALS_ONLY_AFTER_ALL_DUPLICATES,
    EXPORT_FORMATS,
    FENCED_WRITE_ROOTS,
    INSPECT_RELATIVE,
    LAYOUT_DIR_DEFAULT,
    MANIFEST_SLIDE_FIELDS,
    PLAN_FAIL_MESSAGE_LIMIT,
    PLAN_GATE_IS_HARD,
    PLAN_REPORT_RELATIVE,
    PREVIEW_DIR_DEFAULT,
    REQUIRED_ARGS,
    REQUIRED_REUSE_MODE,
    SLIDE_NUMBER_PADDING,
    VALIDATION_CHECKS,
    WRITE_ROOTS,
    coverage,
    pad_slide_number,
    validate_contract,
    validate_output_slides,
)


def test_contract_validates() -> None:
    validate_contract()


def test_four_required_args() -> None:
    assert REQUIRED_ARGS == ("workspace", "pptx", "map", "out")


def test_default_directories() -> None:
    assert PREVIEW_DIR_DEFAULT == "template-starter-preview"
    assert LAYOUT_DIR_DEFAULT == "template-starter-layout"


def test_inspect_path_matches_the_inspect_module() -> None:
    assert INSPECT_RELATIVE == "template-inspect/template-inspect.ndjson"


def test_zero_padding_is_three_digits() -> None:
    assert SLIDE_NUMBER_PADDING == 3
    assert pad_slide_number(1) == "001"
    assert pad_slide_number(12) == "012"
    assert pad_slide_number(123) == "123"


def test_scale_defaults_to_one() -> None:
    assert DEFAULT_SCALE == 1.0


def test_three_fenced_write_roots() -> None:
    assert len(FENCED_WRITE_ROOTS) == 3
    assert len(WRITE_ROOTS) == 3
    assert all(root.fenced for root in WRITE_ROOTS)


def test_reuse_mode_matches_the_plan_module() -> None:
    assert REQUIRED_REUSE_MODE == "duplicate-slide"


def test_build_is_duplicate_then_delete() -> None:
    """Deleting first would leave nothing to duplicate."""
    assert BUILD_MODE == "duplicate-then-delete"
    assert DELETES_ORIGINALS_ONLY_AFTER_ALL_DUPLICATES is True


def test_the_plan_gate_is_hard() -> None:
    assert PLAN_GATE_IS_HARD is True
    assert PLAN_REPORT_RELATIVE == "qa/template-plan-check.json"
    assert PLAN_FAIL_MESSAGE_LIMIT == 8


def test_two_export_formats_per_slide() -> None:
    assert EXPORT_FORMATS == ("png", "layout")


def test_nine_manifest_slide_fields() -> None:
    assert len(MANIFEST_SLIDE_FIELDS) == 9
    assert "previewRelativePath" in MANIFEST_SLIDE_FIELDS
    assert "editTargetCount" in MANIFEST_SLIDE_FIELDS


def test_six_validation_checks() -> None:
    assert len(VALIDATION_CHECKS) == 6


def test_contact_sheet_is_optional() -> None:
    assert CONTACT_SHEET_OPTIONAL is True


def test_contact_sheet_falls_back_to_python3() -> None:
    assert CONTACT_SHEET_FALLBACK_PYTHON == "python3"


def test_the_python3_gap_is_recorded() -> None:
    assert CONTACT_SHEET_FALLBACK_PRESENT_LOCALLY is False


def test_good_map_orders_the_run() -> None:
    entries = [
        {"outputSlide": 2, "sourceSlide": 1, "reuseMode": "duplicate-slide", "narrativeRole": "proof", "editTargets": []},
        {"outputSlide": 1, "sourceSlide": 2, "reuseMode": "duplicate-slide", "narrativeRole": "thesis", "editTargets": []},
    ]
    ordered = validate_output_slides(entries, 3)
    assert [e["outputSlide"] for e in ordered] == [1, 2]
    assert ordered[0]["narrativeRole"] == "thesis"


def test_empty_output_slides_is_rejected() -> None:
    with pytest.raises(ValueError):
        validate_output_slides([], 3)


def test_a_gap_is_rejected() -> None:
    with pytest.raises(ValueError):
        validate_output_slides(
            [
                {"outputSlide": 1, "sourceSlide": 1, "reuseMode": "duplicate-slide", "narrativeRole": "x", "editTargets": []},
                {"outputSlide": 3, "sourceSlide": 1, "reuseMode": "duplicate-slide", "narrativeRole": "x", "editTargets": []},
            ],
            3,
        )


def test_a_non_duplicate_reuse_mode_is_rejected() -> None:
    with pytest.raises(ValueError):
        validate_output_slides(
            [{"outputSlide": 1, "sourceSlide": 1, "reuseMode": "add", "narrativeRole": "x", "editTargets": []}],
            3,
        )


def test_a_source_slide_out_of_range_is_rejected() -> None:
    with pytest.raises(ValueError):
        validate_output_slides(
            [{"outputSlide": 1, "sourceSlide": 9, "reuseMode": "duplicate-slide", "narrativeRole": "x", "editTargets": []}],
            3,
        )


def test_an_empty_narrative_role_is_rejected() -> None:
    with pytest.raises(ValueError):
        validate_output_slides(
            [{"outputSlide": 1, "sourceSlide": 1, "reuseMode": "duplicate-slide", "narrativeRole": "  ", "editTargets": []}],
            3,
        )


def test_edit_targets_must_be_a_list() -> None:
    with pytest.raises(ValueError):
        validate_output_slides(
            [{"outputSlide": 1, "sourceSlide": 1, "reuseMode": "duplicate-slide", "narrativeRole": "x", "editTargets": None}],
            3,
        )


def test_coverage_reports_the_tables() -> None:
    c = coverage()
    assert c["required_args"] == 4
    assert c["fenced_write_roots"] == 3
    assert c["export_formats"] == 2
    assert c["manifest_slide_fields"] == 9
    assert c["validation_checks"] == 6
    assert c["slide_enumeration_shapes"] == 2


def test_claiming_the_build_deletes_first_is_rejected(monkeypatch: pytest.MonkeyPatch) -> None:
    from app.core import template_starter_deck_contract as c

    monkeypatch.setattr(c, "DELETES_ORIGINALS_ONLY_AFTER_ALL_DUPLICATES", False)
    with pytest.raises(ValueError):
        c.validate_contract()


def test_claiming_a_soft_plan_gate_is_rejected(monkeypatch: pytest.MonkeyPatch) -> None:
    from app.core import template_starter_deck_contract as c

    monkeypatch.setattr(c, "PLAN_GATE_IS_HARD", False)
    with pytest.raises(ValueError):
        c.validate_contract()


def test_claiming_the_contact_sheet_python_exists_is_rejected(monkeypatch: pytest.MonkeyPatch) -> None:
    from app.core import template_starter_deck_contract as c

    monkeypatch.setattr(c, "CONTACT_SHEET_FALLBACK_PRESENT_LOCALLY", True)
    with pytest.raises(ValueError):
        c.validate_contract()


def test_claiming_the_scale_may_be_zero_is_rejected(monkeypatch: pytest.MonkeyPatch) -> None:
    from app.core import template_starter_deck_contract as c

    monkeypatch.setattr(c, "SCALE_MUST_BE_POSITIVE", False)
    with pytest.raises(ValueError):
        c.validate_contract()
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
