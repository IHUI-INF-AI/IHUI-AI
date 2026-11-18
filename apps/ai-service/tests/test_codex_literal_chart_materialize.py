# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""Tests for the literal-chart materialiser contract (R107)."""

from __future__ import annotations

import pytest

from app.core.codex_literal_chart_materialize import (
    CHART_PART,
    CLOSES_R103_GAP,
    CONVERSION_KIND,
    CONVERTED_CHART_KEY_COUNT,
    CONVERTED_CHART_KEYS,
    ENVELOPE_KEY_COUNT,
    ENVELOPE_KEYS,
    EXIT_CODES,
    LITERALS_PORTABLE_AFTER,
    LITERALS_PORTABLE_BEFORE,
    NEW_FORMULAS_SNAPSHOT_ONLY,
    OBSERVED_INPUT_BYTES,
    OBSERVED_OUTPUT_BYTES,
    OBSERVED_POINTS,
    OBSERVED_SERIES,
    PORTABLE_VALIDATION_PASSED,
    PRECONDITION_TRIAD,
    REFUSAL_ERROR,
    REFUSES_FALSE_PROVENANCE,
    REQUIRED_ARG_COUNT,
    SCHEMA_VERSION,
    SELF_DESCRIPTION,
    SOURCE_FORMULAS_PRESERVED,
    SOURCE_WORKBOOK_PRESERVED,
    STAGE_1_ERROR,
    STAGE_2_ERROR,
    STAGE_3_ERROR,
    STAGE_4_ERROR,
    WORKBOOK_PART,
    LiteralMaterializeError,
    materialize_contract,
    precondition_triad_met,
    refusal_matches_invocation,
    validate_materialize_contract,
)


def test_contract_validates() -> None:
    validate_materialize_contract()


def test_self_description_is_careful() -> None:
    assert "honest embedded XLSX" in SELF_DESCRIPTION
    assert "never recovers, preserves, or claims lineage" in SELF_DESCRIPTION
    assert "Experimental" in SELF_DESCRIPTION


def test_schema_declares_itself_experimental() -> None:
    assert SCHEMA_VERSION == "experimental.literal-chart-workbook-snapshot.v1"
    assert SCHEMA_VERSION.startswith("experimental.")


def test_four_required_arguments() -> None:
    assert REQUIRED_ARG_COUNT == 4
    assert "source" in STAGE_1_ERROR
    assert "destination" in STAGE_1_ERROR


def test_four_rejections_are_quoted() -> None:
    for msg in (STAGE_1_ERROR, STAGE_2_ERROR, STAGE_3_ERROR, STAGE_4_ERROR):
        assert msg
    assert "required" in STAGE_1_ERROR
    assert "required" in STAGE_2_ERROR


def test_precondition_triad_needs_all_three() -> None:
    assert PRECONDITION_TRIAD == ("approved", "bounded", "staged")
    assert precondition_triad_met(True, True, True) is True
    assert precondition_triad_met(True, True, False) is False
    assert precondition_triad_met(True, False, True) is False
    assert precondition_triad_met(False, True, True) is False


def test_both_late_stage_errors_mention_staged() -> None:
    assert "staged" in STAGE_3_ERROR
    assert "staged" in STAGE_4_ERROR


def test_refuses_false_provenance() -> None:
    assert "cannot preserve expressly required" in REFUSAL_ERROR
    assert REFUSES_FALSE_PROVENANCE is True
    assert refusal_matches_invocation(("--require-source-formulas-slide", "1")) is True
    assert refusal_matches_invocation(("--workspace", "ws")) is False


def test_envelope_shape() -> None:
    assert ENVELOPE_KEY_COUNT == 18 == len(ENVELOPE_KEYS)
    assert len(set(ENVELOPE_KEYS)) == 18
    assert "portable_chart_validation_passed" in ENVELOPE_KEYS
    assert "new_formulas_describe_snapshot_only" in ENVELOPE_KEYS
    assert "source_workbook_preserved" in ENVELOPE_KEYS


def test_per_chart_shape() -> None:
    assert CONVERTED_CHART_KEY_COUNT == 5 == len(CONVERTED_CHART_KEYS)
    assert CHART_PART == "ppt/charts/chart1.xml"
    assert WORKBOOK_PART == "ppt/embeddings/chart-data-snapshot-001.xlsx"
    assert CONVERSION_KIND == "chart_data_snapshot"


def test_the_conversion_grew_the_file() -> None:
    """A workbook was added, so the output must be bigger."""
    assert OBSERVED_INPUT_BYTES == 5_208
    assert OBSERVED_OUTPUT_BYTES == 6_915
    assert OBSERVED_OUTPUT_BYTES > OBSERVED_INPUT_BYTES
    assert OBSERVED_POINTS == 3 and OBSERVED_SERIES == 1


def test_portable_now_passes() -> None:
    assert LITERALS_PORTABLE_BEFORE is False
    assert LITERALS_PORTABLE_AFTER is True
    assert PORTABLE_VALIDATION_PASSED is True
    assert CLOSES_R103_GAP is True


def test_honesty_flags_are_false() -> None:
    assert NEW_FORMULAS_SNAPSHOT_ONLY is True
    assert SOURCE_FORMULAS_PRESERVED is False
    assert SOURCE_WORKBOOK_PRESERVED is False


def test_exit_codes() -> None:
    assert EXIT_CODES == (0, 2)


def test_contract_mapping() -> None:
    c = materialize_contract()
    assert c["required_args"] == 4
    assert c["envelope_keys"] == 18
    assert c["portable_passed"] is True
    assert c["closes_r103_gap"] is True


def test_validate_rejects_claiming_provenance(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(
        "app.core.codex_literal_chart_materialize.SOURCE_FORMULAS_PRESERVED", True
    )
    with pytest.raises(LiteralMaterializeError):
        validate_materialize_contract()


def test_validate_rejects_dropping_a_precondition(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(
        "app.core.codex_literal_chart_materialize.PRECONDITION_TRIAD",
        ("approved", "bounded"),
    )
    with pytest.raises(LiteralMaterializeError):
        validate_materialize_contract()
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
