# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""Tests for the chart rejection codes and source-figure exception (R101-R103)."""

from __future__ import annotations

import pytest

from app.core.codex_chart_rejection_codes import (
    CODES_ARE_LOWER_SNAKE,
    COUNTS_NATIVE_AND_RASTER_SEPARATELY,
    EXCEPTION_CONDITION_COUNT,
    EXCEPTION_CONDITIONS,
    EXCEPTION_FLAG,
    EXCEPTION_FLAG_REJECTS_DIGEST,
    EXCEPTION_FLAG_TAKES_SLIDE_NUMBER,
    EXCEPTION_NEVER_GRANTED_IN_PROBES,
    EXCEPTION_VALUE_IS_PAGE_NUMBER_NOT_HASH,
    MULTIPLE_CODES_AT_ONCE,
    NONEDITABLE_DISCLOSURE_REQUIRED,
    OBSERVED_RASTER_WITH_ZERO_NATIVE,
    RASTER_DOES_NOT_COUNT_AS_NATIVE,
    RC_MISSING_NONEDITABLE_DISCLOSURE,
    RC_RASTER_IS_NOT_CHART,
    RC_REQUIRED_NATIVE_CHART_MISSING,
    RC_WORKBOOK_CONTRACT_FAILED,
    RECEIPT_DIRECTORY_LOCATED,
    RECEIPT_FLAG,
    RECEIPT_IS_PATH,
    RECEIPT_MUST_BE_INSIDE,
    RECEIPT_WRITTEN_IN_PROBES,
    RESULT_CODE_COUNT,
    RESULT_CODES,
    USAGE_ENVELOPE_KEYS,
    USAGE_ERROR_COUNT,
    USAGE_ERRORS,
    USAGE_ERRORS_ARE_SENTENCES,
    ChartRejectionError,
    exception_grantable,
    is_result_code,
    is_usage_error,
    raster_can_satisfy_native,
    rejection_contract,
    validate_rejection_contract,
)


def test_contract_validates() -> None:
    validate_rejection_contract()


def test_four_result_codes() -> None:
    assert RESULT_CODE_COUNT == 4
    assert RESULT_CODES == (
        "required_native_chart_missing",
        "native_chart_workbook_contract_failed",
        "raster_picture_is_not_native_chart",
        "approved_source_figure_missing_noneditable_disclosure",
    )
    assert CODES_ARE_LOWER_SNAKE is True


def test_individual_codes() -> None:
    assert is_result_code(RC_REQUIRED_NATIVE_CHART_MISSING)
    assert is_result_code(RC_WORKBOOK_CONTRACT_FAILED)
    assert is_result_code(RC_RASTER_IS_NOT_CHART)
    assert is_result_code(RC_MISSING_NONEDITABLE_DISCLOSURE)
    assert is_result_code("not-a-code") is False


def test_two_codes_can_fire_together() -> None:
    assert MULTIPLE_CODES_AT_ONCE is True


def test_usage_errors() -> None:
    assert USAGE_ERROR_COUNT == 3
    assert len(USAGE_ERRORS) == 3
    assert USAGE_ENVELOPE_KEYS == ("ok", "error")
    assert USAGE_ERRORS_ARE_SENTENCES is True
    assert is_usage_error(
        "Source-free chart receipts must remain inside the owner-private enforcement directory"
    )
    assert is_usage_error("nope") is False
    for msg in USAGE_ERRORS:
        assert msg[0].isupper()
        assert msg.rstrip().endswith(("directory", "discovery", "slide"))


def test_exception_requires_three_conditions() -> None:
    assert EXCEPTION_CONDITION_COUNT == 3
    assert len(EXCEPTION_CONDITIONS) == 3
    assert exception_grantable(True, True, True) is True
    assert exception_grantable(True, True, False) is False
    assert exception_grantable(True, False, True) is False
    assert exception_grantable(False, True, True) is False


def test_disclosure_is_the_crux() -> None:
    assert NONEDITABLE_DISCLOSURE_REQUIRED is True
    assert RC_MISSING_NONEDITABLE_DISCLOSURE == (
        "approved_source_figure_missing_noneditable_disclosure"
    )


def test_exception_flag_takes_a_page_number() -> None:
    assert EXCEPTION_FLAG == "--approved-source-figure"
    assert EXCEPTION_FLAG_TAKES_SLIDE_NUMBER is True
    assert EXCEPTION_VALUE_IS_PAGE_NUMBER_NOT_HASH is True
    assert EXCEPTION_FLAG_REJECTS_DIGEST is True


def test_exception_was_never_granted() -> None:
    assert EXCEPTION_NEVER_GRANTED_IN_PROBES is True


def test_raster_is_never_a_chart() -> None:
    assert RASTER_DOES_NOT_COUNT_AS_NATIVE is True
    assert raster_can_satisfy_native() is False
    assert COUNTS_NATIVE_AND_RASTER_SEPARATELY is True
    assert OBSERVED_RASTER_WITH_ZERO_NATIVE is True


def test_receipt_constraint() -> None:
    assert RECEIPT_FLAG == "--receipt"
    assert RECEIPT_IS_PATH is True
    assert RECEIPT_MUST_BE_INSIDE == "owner-private-enforcement-directory"
    assert RECEIPT_DIRECTORY_LOCATED is False
    assert RECEIPT_WRITTEN_IN_PROBES is False


def test_contract_mapping_shape() -> None:
    c = rejection_contract()
    assert c["result_codes"] == 4
    assert c["usage_errors"] == 3
    assert c["exception_conditions"] == 3
    assert c["raster_satisfies_native"] is False
    assert c["receipt_dir_located"] is False


def test_validate_rejects_raster_as_chart(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(
        "app.core.codex_chart_rejection_codes.RASTER_DOES_NOT_COUNT_AS_NATIVE", False
    )
    with pytest.raises(ChartRejectionError):
        validate_rejection_contract()


def test_validate_rejects_a_claimed_receipt(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(
        "app.core.codex_chart_rejection_codes.RECEIPT_DIRECTORY_LOCATED", True
    )
    with pytest.raises(ChartRejectionError):
        validate_rejection_contract()
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
