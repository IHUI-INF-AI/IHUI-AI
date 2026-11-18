# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""Tests for the measured documents toolkit behaviour (R118)."""

from __future__ import annotations

import pytest

from app.core.documents_tools_execution_contract import (
    A11Y_AUDIT_CAN_FIX,
    EMPTY_EDIT_STILL_WRITES_DOCUMENT,
    EXECUTED_TOOLS,
    FAILURE_OUTPUT_CAN_EQUAL_SOURCE_BYTE_FOR_BYTE,
    FAILURE_STILL_WRITES_OUTPUT,
    FIXTURE_TRACKED_SIZE,
    FIXTURE_WATERMARK_SIZE,
    HELP_ONLY,
    INSERT_TOC_PLACEHOLDER_DEFAULT,
    INSERT_TOC_REQUIRES_EXACT_PARAGRAPH_TEXT,
    OUT_ABSENT,
    OUT_OPTIONAL,
    OUT_REQUIRED,
    OUTPUT_EXISTENCE_IS_EVIDENCE_OF_WORK,
    POSITIONAL_PAIR,
    SET_PROTECTION_MODES,
    TOOL_COUNT,
    coverage,
    output_proves_work,
    shape_of,
    validate_contract,
    was_executed,
)


def test_contract_validates() -> None:
    validate_contract()


def test_thirty_six_tools() -> None:
    assert TOOL_COUNT == 36


def test_every_tool_has_a_shape() -> None:
    for tool in EXECUTED_TOOLS | HELP_ONLY:
        assert shape_of(tool) in {
            "out_required",
            "out_optional",
            "positional_pair",
            "positional_optional_output",
            "read_only",
            "subcommand",
            "fixture_generator",
            "two_input_documents",
            "json_patch_argument",
            "outdir",
        }


def test_unknown_tool_raises() -> None:
    with pytest.raises(KeyError):
        shape_of("not_a_tool")


def test_positional_pair_rejects_out_flag() -> None:
    """The measured failure: --out is unrecognized for these three."""
    assert len(POSITIONAL_PAIR) == 3
    for tool in POSITIONAL_PAIR:
        assert shape_of(tool) == "positional_pair"


def test_read_only_tools_never_write() -> None:
    assert len(OUT_ABSENT) == 7
    for tool in OUT_ABSENT:
        assert shape_of(tool) == "read_only"


def test_out_required_and_optional_are_disjoint() -> None:
    assert set(OUT_REQUIRED).isdisjoint(OUT_OPTIONAL)


def test_failure_wrote_an_output_equal_to_source() -> None:
    """The finding that matters: existence of a file is not evidence of work."""
    assert FAILURE_STILL_WRITES_OUTPUT is True
    assert FAILURE_OUTPUT_CAN_EQUAL_SOURCE_BYTE_FOR_BYTE is True
    assert OUTPUT_EXISTENCE_IS_EVIDENCE_OF_WORK is False


def test_output_identical_to_source_proves_nothing() -> None:
    assert output_proves_work(0, output_equals_source=True) is False
    assert output_proves_work(2, output_equals_source=True) is False


def test_empty_edit_still_writes_a_document() -> None:
    assert EMPTY_EDIT_STILL_WRITES_DOCUMENT is True


def test_insert_toc_needs_an_exact_placeholder_paragraph() -> None:
    assert INSERT_TOC_PLACEHOLDER_DEFAULT == "[[TOC]]"
    assert INSERT_TOC_REQUIRES_EXACT_PARAGRAPH_TEXT is True


def test_a11y_audit_is_a_dual_role_tool() -> None:
    assert A11Y_AUDIT_CAN_FIX is True


def test_five_protection_modes() -> None:
    assert SET_PROTECTION_MODES == ("off", "readOnly", "comments", "trackedChanges", "forms")


def test_fixture_sizes_are_measured() -> None:
    assert FIXTURE_TRACKED_SIZE == 36_784
    assert FIXTURE_WATERMARK_SIZE == 37_466


def test_coverage_counts_are_honest() -> None:
    c = coverage()
    assert c["tools"] == 36
    assert c["executed"] + c["help_only"] == 36
    assert c["help_only"] == len(HELP_ONLY)
    assert was_executed("insert_toc") is True
    assert was_executed("apply_template_styles") is False


def test_overclaiming_execution_is_rejected(monkeypatch: pytest.MonkeyPatch) -> None:
    from app.core import documents_tools_execution_contract as c

    monkeypatch.setattr(c, "HELP_ONLY", frozenset())
    with pytest.raises(ValueError):
        c.validate_contract()


def test_duplicate_shape_membership_is_rejected(monkeypatch: pytest.MonkeyPatch) -> None:
    from app.core import documents_tools_execution_contract as c

    dup = tuple(list(c.OUT_REQUIRED) + ["heading_audit"])
    monkeypatch.setattr(c, "OUT_REQUIRED", dup)
    with pytest.raises(ValueError):
        c.validate_contract()


def test_claiming_existence_proves_work_is_rejected(monkeypatch: pytest.MonkeyPatch) -> None:
    from app.core import documents_tools_execution_contract as c

    monkeypatch.setattr(c, "OUTPUT_EXISTENCE_IS_EVIDENCE_OF_WORK", True)
    with pytest.raises(ValueError):
        c.validate_contract()


def test_tool_count_drift_is_rejected(monkeypatch: pytest.MonkeyPatch) -> None:
    from app.core import documents_tools_execution_contract as c

    monkeypatch.setattr(c, "TOOL_COUNT", 35)
    with pytest.raises(ValueError):
        c.validate_contract()
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
