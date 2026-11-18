# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""Tests for the chart-workbook verification contract (R100).

These guard the two findings that took the most work to reach:
the category-series trigger, and the cache-vs-live-cell comparison.
"""

from __future__ import annotations

import pytest

from app.core.codex_chart_workbook_verification import (
    CACHE_MISMATCH_NAMES_THE_SERIES_AND_POINT,
    CAT_CACHE_MISMATCH_TEMPLATE,
    CATEGORY_SERIES_REQUIRED,
    CATEGORY_VALUE_COUNT_MISMATCH,
    CHECKS_SERIES_NAME_TOO,
    COMPARES_CACHE_TO_LIVE_CELLS,
    DEFAULT_TARGET_APPLICATION,
    DETAILS_ARE_HUMAN_ACTIONABLE,
    EMBEDDED_PART_FOLDER,
    EMBEDDED_WORKBOOK_NOT_REQUIRED_TO_COUNT,
    EMBEDDED_WORKBOOK_RELATIONSHIP_TYPE,
    FAILURE_CODE,
    FAILURE_CODE_IS_SINGLE,
    FAILURE_DETAIL_COUNT,
    FAILURE_DETAIL_KEY,
    FAILURE_DETAILS,
    MISSING_SHARED_STRING,
    NATIVE_CHART_COUNT_TRIGGER,
    OBSERVED_CHART_TYPE,
    OBSERVED_NUMERIC_CACHE_POINTS,
    OBSERVED_WORKBOOK_NUMERIC_CELLS,
    PASS_CHART_KEY_COUNT,
    PASS_CHART_KEYS,
    PASS_CHARTS_ARRAY_ABSENT_ON_FAILURE,
    R99_CHART_ELEMENTS,
    R100_CHART_ELEMENTS,
    RC_FINDINGS,
    RC_PASS,
    RC_USAGE,
    REMEDY_IS_STATED,
    REQUIRED_EMBEDDED_KEY,
    REQUIRES_OWNERS_FIRST,
    TARGET_APPLICATION_CHOICES,
    TX_CACHE_MISMATCH_TEMPLATE,
    UNRESOLVED_EXCEL_RELATIONSHIP,
    VERIFICATION_STAGE_COUNT,
    VERIFICATION_STAGES,
    WORKBOOK_HAD_ONE_UNREFERENCED_CELL,
    ChartWorkbookError,
    chart_workbook_contract,
    counted_as_native,
    detail_for,
    is_pass_chart_key,
    validate_chart_workbook_contract,
    workbook_verified,
)


def test_contract_validates() -> None:
    validate_chart_workbook_contract()


def test_category_series_is_the_trigger() -> None:
    assert NATIVE_CHART_COUNT_TRIGGER == "c:cat"
    assert CATEGORY_SERIES_REQUIRED is True
    assert counted_as_native(R99_CHART_ELEMENTS) is False
    assert counted_as_native(R100_CHART_ELEMENTS) is True


def test_embedded_workbook_not_needed_to_count() -> None:
    assert EMBEDDED_WORKBOOK_NOT_REQUIRED_TO_COUNT is True
    # the no-embed variant still counted 1
    assert counted_as_native(("c:tx", "c:cat", "c:val")) is True


def test_five_verbatim_details() -> None:
    assert FAILURE_DETAIL_COUNT == 5
    assert CATEGORY_VALUE_COUNT_MISMATCH in FAILURE_DETAILS
    assert UNRESOLVED_EXCEL_RELATIONSHIP in FAILURE_DETAILS
    assert MISSING_SHARED_STRING in FAILURE_DETAILS
    assert CAT_CACHE_MISMATCH_TEMPLATE in FAILURE_DETAILS
    assert TX_CACHE_MISMATCH_TEMPLATE in FAILURE_DETAILS
    assert len(set(FAILURE_DETAILS)) == 5


def test_details_are_actionable_prose() -> None:
    assert DETAILS_ARE_HUMAN_ACTIONABLE is True
    assert REMEDY_IS_STATED is True
    assert CACHE_MISMATCH_NAMES_THE_SERIES_AND_POINT is True
    for d in (CAT_CACHE_MISMATCH_TEMPLATE, TX_CACHE_MISMATCH_TEMPLATE):
        assert "{series}" in d and "{point}" in d
        assert "refresh the chart cache" in d


def test_detail_for_renders_each_stage() -> None:
    assert detail_for("point-counts-agree") == CATEGORY_VALUE_COUNT_MISMATCH
    assert detail_for("workbook-relationship-resolves") == UNRESOLVED_EXCEL_RELATIONSHIP
    assert detail_for("workbook-cells-readable") == MISSING_SHARED_STRING
    rendered = detail_for("cached-points-match-live-cells", series=1, point=1)
    assert "series 1" in rendered and "point 1" in rendered
    with pytest.raises(ChartWorkbookError):
        detail_for("no-such-stage")


def test_four_verification_stages_in_order() -> None:
    assert VERIFICATION_STAGE_COUNT == 4
    assert VERIFICATION_STAGES == (
        "point-counts-agree",
        "workbook-relationship-resolves",
        "workbook-cells-readable",
        "cached-points-match-live-cells",
    )
    assert COMPARES_CACHE_TO_LIVE_CELLS is True
    assert CHECKS_SERIES_NAME_TOO is True


def test_seven_pass_only_keys() -> None:
    assert PASS_CHART_KEY_COUNT == 7
    assert len(PASS_CHART_KEYS) == 7
    assert is_pass_chart_key("cache_reference_ranges_verified")
    assert is_pass_chart_key("workbook_numeric_cell_count")
    assert is_pass_chart_key("failure_codes") is False
    assert PASS_CHARTS_ARRAY_ABSENT_ON_FAILURE is True


def test_observed_counts() -> None:
    assert OBSERVED_CHART_TYPE == "barChart"
    assert OBSERVED_WORKBOOK_NUMERIC_CELLS == 4
    assert OBSERVED_NUMERIC_CACHE_POINTS == 3
    assert WORKBOOK_HAD_ONE_UNREFERENCED_CELL is True


def test_workbook_verified() -> None:
    assert workbook_verified([{"cache_reference_ranges_verified": True}]) is True
    assert workbook_verified([{"cache_reference_ranges_verified": False}]) is False
    assert workbook_verified([]) is False


def test_failure_code_and_flags() -> None:
    assert FAILURE_CODE == "native_chart_workbook_contract_failed"
    assert FAILURE_CODE_IS_SINGLE is True
    assert FAILURE_DETAIL_KEY == "failure_detail"
    assert REQUIRES_OWNERS_FIRST is True
    assert REQUIRED_EMBEDDED_KEY == "required_embedded_workbook_slides"
    assert DEFAULT_TARGET_APPLICATION == "portable"
    assert TARGET_APPLICATION_CHOICES == ("portable", "powerpoint")
    assert EMBEDDED_WORKBOOK_RELATIONSHIP_TYPE == "package"
    assert EMBEDDED_PART_FOLDER == "ppt/embeddings/"


def test_exit_codes() -> None:
    assert (RC_PASS, RC_FINDINGS, RC_USAGE) == (0, 1, 2)


def test_contract_mapping_shape() -> None:
    c = chart_workbook_contract()
    assert c["trigger"] == "c:cat"
    assert c["detail_kinds"] == 5
    assert c["stages"] == 4
    assert c["pass_keys"] == 7
    assert c["compares_cache"] is True


def test_validate_rejects_a_workbook_trigger(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(
        "app.core.codex_chart_workbook_verification.NATIVE_CHART_COUNT_TRIGGER",
        "embedded-workbook",
    )
    with pytest.raises(ChartWorkbookError):
        validate_chart_workbook_contract()


def test_validate_rejects_a_shortened_detail_list(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(
        "app.core.codex_chart_workbook_verification.FAILURE_DETAIL_COUNT", 3
    )
    with pytest.raises(ChartWorkbookError):
        validate_chart_workbook_contract()
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
