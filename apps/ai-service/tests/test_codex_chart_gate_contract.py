# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""Tests for the chart gate contract (R99)."""

from __future__ import annotations

import pytest

from app.core.codex_chart_gate_contract import (
    ACCESSES_SOURCE_ATTACHMENTS,
    BARE_FLAG_YIELDS_USAGE_RC,
    CLAIM_BOUNDARY,
    DISCOVERY_KEYS,
    DISCOVERY_SCHEMA,
    FAILURE_CODE_COUNT,
    FAILURE_CODES,
    GATE_SCHEMA,
    INSPECTS_SOURCE_PROVENANCE,
    NATIVE_CHART_COUNT_WAS_ZERO,
    NATIVE_PREFIX,
    OPENS_NATIVE_POWERPOINT,
    OWNER_PRIVATE_PREFIX,
    OWNER_PRIVATE_SCHEMA_COUNT,
    RC_FINDINGS,
    RC_PASS,
    RC_USAGE,
    RESULT_KEYS,
    RESULT_STATUSES,
    SCHEMA_NAMESPACE_COUNT,
    SHA_IS_PACKAGE_LEVEL,
    TOP_LEVEL_KEYS,
    VALUE_TAKING_FLAGS,
    ChartGateContractError,
    chart_gate_contract,
    failure_code_of,
    passed_from,
    requires_value,
    schema_namespace_of,
    validate_chart_gate_contract,
)


def test_contract_validates() -> None:
    validate_chart_gate_contract()


def test_chart_gate_schema_is_owner_private_not_native() -> None:
    assert schema_namespace_of(GATE_SCHEMA) == OWNER_PRIVATE_PREFIX
    assert schema_namespace_of(GATE_SCHEMA) != NATIVE_PREFIX
    assert GATE_SCHEMA == "owner-private.quantitative-chart-native-gate.v1"


def test_discovery_schema() -> None:
    assert DISCOVERY_SCHEMA == "owner-private.actual-native-chart-discovery.v1"
    assert OWNER_PRIVATE_SCHEMA_COUNT == 2
    assert SCHEMA_NAMESPACE_COUNT == 2


def test_unknown_namespace_raises() -> None:
    with pytest.raises(ChartGateContractError):
        schema_namespace_of("something-else.v1")


def test_claim_boundary_is_verbatim() -> None:
    assert CLAIM_BOUNDARY.startswith("OOXML/workbook structural validation only")
    assert "native PowerPoint opening remain separate checks" in CLAIM_BOUNDARY


def test_scope_flags_all_false() -> None:
    assert INSPECTS_SOURCE_PROVENANCE is False
    assert OPENS_NATIVE_POWERPOINT is False
    assert ACCESSES_SOURCE_ATTACHMENTS is False


def test_envelope_key_counts() -> None:
    assert len(TOP_LEVEL_KEYS) == 13
    assert len(RESULT_KEYS) == 7
    assert len(DISCOVERY_KEYS) == 9
    assert SHA_IS_PACKAGE_LEVEL is True


def test_result_statuses() -> None:
    assert RESULT_STATUSES == ("failed", "passed")


def test_value_taking_flags_are_not_booleans() -> None:
    assert requires_value("--require-native-table-slide") is True
    assert requires_value("--require-editorial-slide") is True
    assert requires_value("--receipt") is True
    assert requires_value("--discover-chart-slides") is False
    assert BARE_FLAG_YIELDS_USAGE_RC == 2
    assert len(VALUE_TAKING_FLAGS) == 7
    for f in VALUE_TAKING_FLAGS:
        assert requires_value(f) is True


def test_failure_code() -> None:
    assert FAILURE_CODES == ("required_native_chart_missing",)
    assert FAILURE_CODE_COUNT == 1
    assert NATIVE_CHART_COUNT_WAS_ZERO is True


def test_failure_code_of_reads_first_code() -> None:
    r = {"failure_codes": ["required_native_chart_missing"], "status": "failed"}
    assert failure_code_of(r) == "required_native_chart_missing"


def test_failure_code_of_empty_raises() -> None:
    with pytest.raises(ChartGateContractError):
        failure_code_of({"failure_codes": []})
    with pytest.raises(ChartGateContractError):
        failure_code_of({})


def test_passed_from_results() -> None:
    assert passed_from([{"status": "passed"}]) is True
    assert passed_from([{"status": "failed"}]) is False
    assert passed_from([]) is True


def test_exit_codes() -> None:
    assert (RC_PASS, RC_FINDINGS, RC_USAGE) == (0, 1, 2)


def test_contract_mapping_shape() -> None:
    c = chart_gate_contract()
    assert c["schemas"] == 2
    assert c["namespaces"] == 2
    assert c["failure_codes"] == 1
    assert c["opens_powerpoint"] is False


def test_validate_rejects_native_namespace_claim(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(
        "app.core.codex_chart_gate_contract.GATE_SCHEMA",
        "presentation-native-chart-gate.v1",
    )
    with pytest.raises(ChartGateContractError):
        validate_chart_gate_contract()


def test_validate_rejects_softening_the_zero_count(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(
        "app.core.codex_chart_gate_contract.NATIVE_CHART_COUNT_WAS_ZERO", False
    )
    with pytest.raises(ChartGateContractError):
        validate_chart_gate_contract()
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
