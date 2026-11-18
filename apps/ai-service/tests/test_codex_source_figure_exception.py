# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""Tests for the source-figure exception (R104-R106)."""

from __future__ import annotations

import pytest

from app.core.codex_source_figure_exception import (
    ACCEPTED_COUNT,
    ACCEPTED_DISCLOSURE_PHRASES,
    CASE_INSENSITIVE,
    COMMA_IRRELEVANT,
    CONDITION_DISCLOSURE,
    CONDITION_EXPECTED,
    CONDITION_RASTER,
    CROSS_SHAPE_OK,
    DISCLOSURE_CARRIER,
    EXCEPTION_CONDITIONS,
    EXCEPTION_FLAG,
    EXCEPTION_GRANTED_EXIT_CODE,
    EXCEPTION_GRANTED_IN_PROBES,
    NONEDITABLE_SPELLINGS,
    ORDER_INDEPENDENT,
    PICTURE_DESCRIPTION_WORKS,
    PICTURE_NAME_WORKS,
    REJECTED_COUNT,
    REJECTED_DISCLOSURE_PHRASES,
    REVERSED_ORDER_OK,
    SLIDE_SCOPED,
    SOURCE_HALF,
    TEXT_RUN_IS_REQUIRED,
    SourceFigureError,
    disclosure_from_shapes,
    exception_grantable,
    slide_has_disclosure,
    validate_disclosure_contract,
)


def test_contract_validates() -> None:
    validate_disclosure_contract()


def test_carrier_is_slide_text() -> None:
    assert DISCLOSURE_CARRIER == "slide-text"
    assert TEXT_RUN_IS_REQUIRED is True
    assert PICTURE_NAME_WORKS is False
    assert PICTURE_DESCRIPTION_WORKS is False


def test_both_halves_required() -> None:
    assert SOURCE_HALF == "source figure"
    assert slide_has_disclosure("Source figure") is False
    assert slide_has_disclosure("non-editable") is False
    assert slide_has_disclosure("Source figure, non-editable") is True


@pytest.mark.parametrize("phrase", ACCEPTED_DISCLOSURE_PHRASES)
def test_accepted_phrases_pass(phrase: str) -> None:
    assert slide_has_disclosure(phrase) is True


@pytest.mark.parametrize("phrase", REJECTED_DISCLOSURE_PHRASES)
def test_rejected_phrases_fail(phrase: str) -> None:
    assert slide_has_disclosure(phrase) is False


def test_counts() -> None:
    assert ACCEPTED_COUNT == 7 == len(ACCEPTED_DISCLOSURE_PHRASES)
    assert REJECTED_COUNT == 4 == len(REJECTED_DISCLOSURE_PHRASES)


def test_spelling_variants() -> None:
    assert NONEDITABLE_SPELLINGS == (
        "non-editable",
        "noneditable",
        "non editable",
        "not editable",
    )
    for s in NONEDITABLE_SPELLINGS:
        assert slide_has_disclosure(f"Source figure, {s}") is True


def test_underscore_does_not_join() -> None:
    assert slide_has_disclosure("Source figure, non_editable") is False


def test_case_and_order_and_comma() -> None:
    assert CASE_INSENSITIVE is True
    assert COMMA_IRRELEVANT is True
    assert REVERSED_ORDER_OK is True
    assert slide_has_disclosure("SOURCE FIGURE NON-EDITABLE") is True
    assert slide_has_disclosure("non-editable source figure") is True
    assert slide_has_disclosure("Source figure non-editable") is True


def test_slide_scope() -> None:
    assert SLIDE_SCOPED is True
    assert CROSS_SHAPE_OK is True
    assert ORDER_INDEPENDENT is True
    assert disclosure_from_shapes(["Source figure", "non-editable"]) is True
    assert disclosure_from_shapes(["non-editable", "Source figure"]) is True
    assert disclosure_from_shapes(["just a title", "nothing else"]) is False


def test_three_conditions() -> None:
    assert EXCEPTION_CONDITIONS == (
        CONDITION_EXPECTED,
        CONDITION_RASTER,
        CONDITION_DISCLOSURE,
    )
    assert exception_grantable(True, True, True) is True
    assert exception_grantable(True, True, False) is False
    assert exception_grantable(True, False, True) is False
    assert exception_grantable(False, True, True) is False


def test_exception_was_actually_granted() -> None:
    assert EXCEPTION_GRANTED_IN_PROBES is True
    assert EXCEPTION_GRANTED_EXIT_CODE == 0
    assert EXCEPTION_FLAG == "--approved-source-figure"


def test_validate_rejects_a_metadata_carrier(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(
        "app.core.codex_source_figure_exception.PICTURE_NAME_WORKS", True
    )
    with pytest.raises(SourceFigureError):
        validate_disclosure_contract()
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
