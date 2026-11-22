# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""Tests for the presentations toolkit roster and the overflow checker's failure (R109)."""

from __future__ import annotations

import pytest

from app.core.codex_presentations_toolkit import (
    ALL_PROBES_PASSED,
    BMP_ALREADY_RASTER,
    BMP_PROBE_EXIT_CODE,
    BMP_PROBE_OUTPUT_FILES,
    CANVAS_HEIGHT_EMU,
    CANVAS_WIDTH_EMU,
    DECLARATION_NOT_THE_PROBLEM,
    ENSURE_RASTER,
    ENSURE_RASTER_BEHAVES_CORRECTLY,
    ENSURE_RASTER_DESCRIPTION,
    ENSURE_RASTER_INPUT_MODES,
    EXIT_CODE_CARRIES_INFORMATION,
    FAROUT_EXCEEDS_CANVAS,
    FAROUT_WIDTH_EMU,
    OVERFLOWING_DECK_PASSED,
    PASS_TEXT,
    PROBE_CASES,
    PROBE_COUNT,
    RENDER_PLUS_EYES_REMAINS_ONLY_WORKING,
    RENDERED_OVERFLOW_OBSERVED,
    SILENCE_MEANS_NOTHING_TO_DO,
    SLIDE_SIZE_XML,
    SLIDES_TEST,
    SLIDES_TEST_DEFAULTS,
    SLIDES_TEST_DESCRIPTION,
    SLIDES_TEST_DETECTS_OVERFLOW,
    SLIDES_TEST_OPTIONS,
    TOOL_COUNT,
    TOOLS,
    USABLE_AS_OVERFLOW_GATE,
    ToolkitError,
    exit_code_is_informative,
    toolkit_contract,
    toolkit_covers_all_tools,
    validate_toolkit_contract,
)


def test_contract_validates() -> None:
    validate_toolkit_contract()


def test_roster_is_complete() -> None:
    assert TOOL_COUNT == 12 == len(TOOLS)
    assert toolkit_covers_all_tools() is True
    names = [n for n, _ in TOOLS]
    assert SLIDES_TEST in names
    assert ENSURE_RASTER in names


def test_slides_test_stated_job_is_verbatim() -> None:
    assert SLIDES_TEST_DESCRIPTION == (
        "Check a PPTX for content overflowing the original canvas by rendering with padding "
        "and inspecting the margins."
    )
    assert len(SLIDES_TEST_OPTIONS) == 3
    assert SLIDES_TEST_DEFAULTS == (1600, 900)


def test_all_three_probes_returned_the_same_pass() -> None:
    assert PROBE_COUNT == 3 == len(PROBE_CASES)
    for _case, _pad, text, rc in PROBE_CASES:
        assert text == PASS_TEXT
        assert rc == 0
    assert ALL_PROBES_PASSED is True


def test_the_finding_overflow_overflows_and_passes() -> None:
    """Both the edge-cut deck and the spanning deck came back clean."""
    assert OVERFLOWING_DECK_PASSED is True
    assert SLIDES_TEST_DETECTS_OVERFLOW is False


def test_overflow_was_actually_visible() -> None:
    """Rendered and looked: 'OFF' at the right edge, tail cut."""
    assert RENDERED_OVERFLOW_OBSERVED is True


def test_geometry_was_sufficient() -> None:
    assert SLIDE_SIZE_XML == '<p:sldSz cx="12192000" cy="6858000"/>'
    assert CANVAS_WIDTH_EMU == 12_192_000
    assert CANVAS_HEIGHT_EMU == 6_858_000
    assert FAROUT_EXCEEDS_CANVAS is True
    assert FAROUT_WIDTH_EMU > CANVAS_WIDTH_EMU
    assert DECLARATION_NOT_THE_PROBLEM is True


def test_exit_code_is_useless_here() -> None:
    assert EXIT_CODE_CARRIES_INFORMATION is False
    assert exit_code_is_informative(True) is False
    assert exit_code_is_informative(False) is True
    assert USABLE_AS_OVERFLOW_GATE is False
    assert RENDER_PLUS_EYES_REMAINS_ONLY_WORKING is True


def test_ensure_raster_was_right_to_be_silent() -> None:
    assert ENSURE_RASTER_DESCRIPTION == (
        "Ensure input images are rasterized; convert to PNG if needed."
    )
    assert len(ENSURE_RASTER_INPUT_MODES) == 2
    assert BMP_PROBE_EXIT_CODE == 0
    assert BMP_PROBE_OUTPUT_FILES == 0
    assert BMP_ALREADY_RASTER is True
    assert SILENCE_MEANS_NOTHING_TO_DO is True
    assert ENSURE_RASTER_BEHAVES_CORRECTLY is True


def test_contract_mapping() -> None:
    c = toolkit_contract()
    assert c["tools"] == 12
    assert c["slides_test_detects"] is False
    assert c["usable_as_gate"] is False


def test_validate_rejects_claiming_it_detects(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(
        "app.core.codex_presentations_toolkit.SLIDES_TEST_DETECTS_OVERFLOW", True
    )
    with pytest.raises(ToolkitError):
        validate_toolkit_contract()


def test_validate_rejects_incomplete_roster(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(
        "app.core.codex_presentations_toolkit.TOOLS", TOOLS[:-1]
    )
    with pytest.raises(ToolkitError):
        validate_toolkit_contract()
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
