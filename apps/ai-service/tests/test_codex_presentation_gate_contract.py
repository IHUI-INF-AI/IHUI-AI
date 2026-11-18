# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""Tests for the presentation gate contract (R95)."""

from __future__ import annotations

import pytest

from app.core.codex_presentation_gate_contract import (
    CHART_CONTENT_TYPE,
    CONTRACT_JSON_FLAG,
    CONTRACT_JSON_GATES,
    DECLARED_ONLY_SCOPE,
    DUAL_STATE_EXITS,
    EXIT_FINDINGS,
    EXIT_OK,
    EXIT_USAGE,
    FAIL_ON_FINDINGS_FLAG,
    FAIL_ON_FINDINGS_GATES,
    GATE_COUNT,
    GATE_TOTAL_BYTES,
    GATE_TOTAL_LINES,
    GATES,
    LARGEST_GATE,
    MAX_CLI_COUNT,
    MAX_CLI_GATE,
    MIN_CLI_COUNT,
    READ_ONLY_SOURCE_FREE,
    RECEIPT_FLAG,
    RECEIPT_GATES,
    SCHEMA_BEARING_GATES,
    SIBLING_IMPORT_COUNT,
    SKIP_IS_NOT_ZERO,
    SMALLEST_GATE,
    TRIPLE_STATE_EXITS,
    GateContractError,
    cli_count_of,
    exits_of,
    fails_only_on_request,
    gate_of,
    is_sibling_importer,
    tries_sibling_lib,
    validate_gates,
)


def test_six_gates() -> None:
    assert len(GATES) == GATE_COUNT == 6


def test_contract_validates() -> None:
    validate_gates()


def test_unknown_gate_raises() -> None:
    with pytest.raises(GateContractError):
        gate_of("no_such_gate")


def test_largest_and_smallest_are_real() -> None:
    assert cli_count_of(LARGEST_GATE) == MAX_CLI_COUNT
    assert cli_count_of(MAX_CLI_GATE) == MAX_CLI_COUNT
    assert min(cli_count_of(n) for n in GATES) == MIN_CLI_COUNT
    assert SMALLEST_GATE == "native_chart_title_gate"


def test_total_size() -> None:
    assert GATE_TOTAL_BYTES == 226_381
    assert GATE_TOTAL_LINES == 5655


def test_every_gate_reports_usage_exit() -> None:
    for name in GATES:
        assert EXIT_USAGE in exits_of(name), name


def test_only_one_gate_is_triple_state() -> None:
    triple = [n for n in GATES if EXIT_FINDINGS in exits_of(n)]
    assert triple == [LARGEST_GATE]
    assert DUAL_STATE_EXITS == (EXIT_OK, EXIT_USAGE)
    assert TRIPLE_STATE_EXITS == (EXIT_OK, EXIT_FINDINGS, EXIT_USAGE)


def test_sibling_library_is_the_chart_gate() -> None:
    assert tries_sibling_lib("native_table_arithmetic_gate") == (
        "native_table_arithmetic_gate",
        "native_chart_title_gate",
        "inspect_presentation_layout_geometry",
    )
    assert SIBLING_IMPORT_COUNT == 3
    assert is_sibling_importer("native_quantitative_chart_gate") is False


def test_opt_in_failure_set() -> None:
    assert fails_only_on_request("native_table_arithmetic_gate") is True
    assert fails_only_on_request("native_chart_title_gate") is False
    assert len(FAIL_ON_FINDINGS_GATES) == 3
    assert FAIL_ON_FINDINGS_FLAG == "--fail-on-findings"


def test_receipt_is_singular() -> None:
    assert RECEIPT_GATES == ("native_quantitative_chart_gate",)
    assert RECEIPT_FLAG == "--receipt"
    assert CONTRACT_JSON_GATES == ("native_table_arithmetic_gate",)
    assert CONTRACT_JSON_FLAG == "--contract-json"


def test_schema_bearing_gate() -> None:
    assert SCHEMA_BEARING_GATES == ("native_chart_title_gate",)
    assert gate_of("native_chart_title_gate")["schema"] == "presentation-native-chart-titles.v1"


def test_disciplines_are_pinned() -> None:
    assert DECLARED_ONLY_SCOPE is True
    assert SKIP_IS_NOT_ZERO is True
    assert READ_ONLY_SOURCE_FREE is True
    assert gate_of("native_table_arithmetic_gate")["skip_not_zero"] is True
    assert gate_of("inspect_presentation_package_integrity")["read_only_no_text"] is True


def test_chart_content_type() -> None:
    assert "drawingml.chart+xml" in CHART_CONTENT_TYPE


def test_validate_rejects_a_renamed_largest(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(
        "app.core.codex_presentation_gate_contract.LARGEST_GATE", "native_chart_title_gate"
    )
    with pytest.raises(GateContractError):
        validate_gates()


def test_validate_rejects_a_scope_escalation(monkeypatch: pytest.MonkeyPatch) -> None:
    bad = dict(GATES)
    bad["native_chart_title_gate"] = dict(GATES["native_chart_title_gate"])
    bad["native_chart_title_gate"]["declared_only"] = False
    monkeypatch.setattr("app.core.codex_presentation_gate_contract.GATES", bad)
    with pytest.raises(GateContractError):
        validate_gates()
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
