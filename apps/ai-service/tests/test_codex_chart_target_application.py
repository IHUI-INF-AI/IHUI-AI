# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""Tests for the two chart targets (R103)."""

from __future__ import annotations

import pytest

from app.core.codex_chart_target_application import (
    CACHE_AND_LITERAL_ARE_SEPARATE_COUNTERS,
    DEFAULT_TARGET,
    EDITABILITY_EVIDENCE,
    EVIDENCE_OBSERVED_COUNT,
    FLAG,
    GATE_DESCRIPTION_QUOTE,
    LITERAL_ELEMENTS,
    LITERAL_NUMERIC_CACHE_POINT_COUNT,
    LITERAL_NUMERIC_POINT_COUNT,
    LITERAL_SERIES_FORMULA_COUNT,
    OBSERVED_VERDICTS,
    PORTABLE_ELEMENTS,
    PORTABLE_REJECTION_CODE,
    PORTABLE_REJECTION_DETAIL,
    PORTABLE_REQUIRES_WORKBOOK,
    POWERPOINT_REQUIRES_WORKBOOK,
    SAME_CHART_DIFFERENT_VERDICT,
    TARGET_COUNT,
    TARGETS,
    TargetApplicationError,
    accepts_literal,
    evidence_for,
    observed_verdict,
    requires_workbook,
    validate_target_contract,
)


def test_contract_validates() -> None:
    validate_target_contract()


def test_two_targets() -> None:
    assert TARGET_COUNT == 2
    assert TARGETS == ("portable", "powerpoint")
    assert DEFAULT_TARGET == "portable"
    assert FLAG == "--target-application"


def test_workbook_requirement_splits() -> None:
    assert PORTABLE_REQUIRES_WORKBOOK is True
    assert POWERPOINT_REQUIRES_WORKBOOK is False
    assert requires_workbook("portable") is True
    assert requires_workbook("powerpoint") is False


def test_literal_acceptance_splits() -> None:
    assert accepts_literal("portable") is False
    assert accepts_literal("powerpoint") is True


def test_unknown_target_raises() -> None:
    for fn in (requires_workbook, accepts_literal, evidence_for):
        with pytest.raises(TargetApplicationError):
            fn("web")


def test_data_model_elements_differ() -> None:
    assert "c:numRef" in PORTABLE_ELEMENTS
    assert "c:externalData" in PORTABLE_ELEMENTS
    assert LITERAL_ELEMENTS == ("c:numLit", "c:strLit")
    assert "c:externalData" not in LITERAL_ELEMENTS


def test_literal_carries_no_formula() -> None:
    assert LITERAL_SERIES_FORMULA_COUNT == 0
    assert LITERAL_NUMERIC_POINT_COUNT == 3
    assert LITERAL_NUMERIC_CACHE_POINT_COUNT == 0
    assert CACHE_AND_LITERAL_ARE_SEPARATE_COUNTERS is True


def test_evidence_field() -> None:
    assert EVIDENCE_OBSERVED_COUNT == 1
    assert EDITABILITY_EVIDENCE == ("powerpoint_native_literal",)
    assert evidence_for("powerpoint") == "powerpoint_native_literal"
    assert evidence_for("portable") is None


def test_same_chart_two_verdicts() -> None:
    assert SAME_CHART_DIFFERENT_VERDICT is True
    assert observed_verdict("portable") == {
        "passed": False,
        "exit_code": 1,
        "code": "native_chart_workbook_contract_failed",
    }
    assert observed_verdict("powerpoint") == {
        "passed": True,
        "exit_code": 0,
        "code": None,
    }


def test_portable_rejection_names_external_data() -> None:
    assert PORTABLE_REJECTION_CODE == "native_chart_workbook_contract_failed"
    assert "externalData" in PORTABLE_REJECTION_DETAIL


def test_gate_quote_kept() -> None:
    assert "durable embedded-workbook requirement" in GATE_DESCRIPTION_QUOTE


def test_verdicts_are_copies() -> None:
    v = observed_verdict("portable")
    v["passed"] = True
    assert OBSERVED_VERDICTS["portable"]["passed"] is False


def test_validate_rejects_a_cosmetic_flag(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(
        "app.core.codex_chart_target_application.POWERPOINT_REQUIRES_WORKBOOK", True
    )
    with pytest.raises(TargetApplicationError):
        validate_target_contract()
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
