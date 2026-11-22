# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""Tests for the gate behaviour contract (R97).

The facts here came from executing the gates, so the tests guard *observed behaviour*,
especially the two-tier verdict that pure text reading had got wrong (it reported three
``--fail-on-findings`` gates; running them shows four).
"""

from __future__ import annotations

import pytest

from app.core.codex_presentation_gate_behavior import (
    ALL_GATES_JSON_DIAGNOSTICS,
    CONTENT_FINDINGS_ARE_OPT_IN,
    CONTRACT_JSON_FLAG,
    CONTRACT_JSON_FLAG_GATES,
    FAIL_ON_FINDINGS_FLAG,
    FAIL_ON_FINDINGS_GATES,
    FLAG_COUNTS,
    GATE_COUNT,
    GEOMETRY_APPROVAL_FLAGS,
    GEOMETRY_FAIL_FLAGS,
    GEOMETRY_LIMIT_FLAGS,
    GEOMETRY_MODE_FLAGS,
    GEOMETRY_REQUIRE_FLAGS,
    GEOMETRY_VALIDATE_FLAGS,
    HELP_EXIT_CODE,
    MAX_FLAGS,
    MAX_FLAGS_GATE,
    MINIMAL_DIAGNOSTICS,
    MINIMAL_PACKAGE_ALL_FAILED,
    MINIMAL_PACKAGE_EXIT_CODE,
    NO_ARGS_EXIT_CODE,
    RECEIPT_FLAG,
    RECEIPT_FLAG_GATES,
    REFERENCE_REQUIRED_GATE,
    SCHEMA_BEARING_GATE_COUNT,
    SCHEMA_SUFFIX,
    SCHEMA_VERSIONS,
    STRUCTURAL_FAILURE_EXIT_CODE,
    STRUCTURAL_FAILURE_IS_UNSOFTENABLE,
    TOTAL_FLAGS,
    TWO_TIER_VERDICT,
    GateBehaviorError,
    behaviour_contract,
    content_verdict_is,
    flags_of,
    is_schema_bearing,
    schema_of,
    structural_failure_is_hard,
    validate_behavior,
)


def test_contract_validates() -> None:
    validate_behavior()


def test_six_gates_and_flag_table() -> None:
    assert GATE_COUNT == 6
    assert len(FLAG_COUNTS) == 6
    assert TOTAL_FLAGS == 59
    assert TOTAL_FLAGS == 8 + 4 + 2 + 8 + 3 + 34


def test_largest_gate_has_34_flags() -> None:
    assert MAX_FLAGS_GATE == "inspect_presentation_layout_geometry"
    assert MAX_FLAGS == 34
    assert FLAG_COUNTS[MAX_FLAGS_GATE] == 34


def test_geometry_flag_groups_total_34() -> None:
    total = (
        len(GEOMETRY_APPROVAL_FLAGS)
        + len(GEOMETRY_REQUIRE_FLAGS)
        + len(GEOMETRY_VALIDATE_FLAGS)
        + len(GEOMETRY_LIMIT_FLAGS)
        + len(GEOMETRY_MODE_FLAGS)
        + len(GEOMETRY_FAIL_FLAGS)
        + 2
    )
    assert total == 34


def test_geometry_groups_have_no_duplicates() -> None:
    groups = (
        GEOMETRY_APPROVAL_FLAGS,
        GEOMETRY_REQUIRE_FLAGS,
        GEOMETRY_VALIDATE_FLAGS,
        GEOMETRY_LIMIT_FLAGS,
        GEOMETRY_MODE_FLAGS,
        GEOMETRY_FAIL_FLAGS,
    )
    flat = [f for g in groups for f in g]
    assert len(flat) == len(set(flat))


def test_four_fail_on_findings_gates_not_three() -> None:
    # text reading said 3; executing them shows 4
    assert len(FAIL_ON_FINDINGS_GATES) == 4
    assert FAIL_ON_FINDINGS_GATE_COUNT() == 4


def FAIL_ON_FINDINGS_GATE_COUNT() -> int:  # noqa: N802 - mirrors an observed count
    return len(FAIL_ON_FINDINGS_GATES)


def test_chart_title_gate_has_no_strictness_flag() -> None:
    assert "native_chart_title_gate" not in FAIL_ON_FINDINGS_GATES
    assert content_verdict_is("native_chart_title_gate", True) == "unsupported-no-flag"


def test_two_tier_verdict() -> None:
    assert TWO_TIER_VERDICT is True
    assert STRUCTURAL_FAILURE_IS_UNSOFTENABLE is True
    assert CONTENT_FINDINGS_ARE_OPT_IN is True
    assert structural_failure_is_hard() is True


def test_structural_failure_exit_code_is_2() -> None:
    assert STRUCTURAL_FAILURE_EXIT_CODE == 2
    assert MINIMAL_PACKAGE_EXIT_CODE == 2
    assert NO_ARGS_EXIT_CODE == 2
    assert HELP_EXIT_CODE == 0


def test_flags_alone_do_not_rescue_a_broken_package() -> None:
    # the prediction must never read "pass" for a structurally invalid package
    for gate in FAIL_ON_FINDINGS_GATES:
        assert content_verdict_is(gate, False) == "diagnosed-only"
        assert content_verdict_is(gate, True) == "failed"


def test_every_gate_uses_json_diagnostics() -> None:
    assert ALL_GATES_JSON_DIAGNOSTICS is True


def test_schema_bearing_gates() -> None:
    assert SCHEMA_BEARING_GATE_COUNT == 2
    assert schema_of("native_table_arithmetic_gate") == (
        "presentation-native-table-arithmetic.v1"
    )
    assert schema_of("native_chart_title_gate") == "presentation-native-chart-titles.v1"
    assert is_schema_bearing("native_quantitative_chart_gate") is False


def test_schema_suffix() -> None:
    assert SCHEMA_SUFFIX == ".v1"
    for s in SCHEMA_VERSIONS.values():
        assert s.endswith(SCHEMA_SUFFIX)


def test_unknown_gate_raises() -> None:
    with pytest.raises(GateBehaviorError):
        flags_of("no-such-gate")


def test_non_schema_gate_raises() -> None:
    with pytest.raises(GateBehaviorError):
        schema_of("inspect_presentation_package_integrity")


def test_minimal_package_fails_every_gate() -> None:
    assert MINIMAL_PACKAGE_ALL_FAILED is True
    assert len(MINIMAL_DIAGNOSTICS) == 5
    assert REFERENCE_REQUIRED_GATE == "template_source_fidelity_gate"
    assert REFERENCE_REQUIRED_GATE not in MINIMAL_DIAGNOSTICS  # answered with usage instead


def test_minimal_diagnostic_text_is_preserved_verbatim() -> None:
    assert MINIMAL_DIAGNOSTICS["inspect_presentation_layout_geometry"] == (
        "presentation has no slide dimensions"
    )
    assert "missing required package part" in MINIMAL_DIAGNOSTICS[
        "inspect_presentation_package_integrity"
    ]


def test_receipt_and_contract_flags() -> None:
    assert RECEIPT_FLAG == "--receipt"
    assert RECEIPT_FLAG_GATES == ("native_quantitative_chart_gate",)
    assert CONTRACT_JSON_FLAG == "--contract-json"
    assert CONTRACT_JSON_FLAG_GATES == ("native_table_arithmetic_gate",)
    assert FAIL_ON_FINDINGS_FLAG == "--fail-on-findings"


def test_contract_mapping_shape() -> None:
    c = behaviour_contract()
    assert c["gates"] == 6
    assert c["two_tier"] is True
    assert c["structural_hard"] is True
    assert c["fail_on_findings_gates"] == 4


def test_validate_rejects_a_collapsed_two_tier(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(
        "app.core.codex_presentation_gate_behavior.STRUCTURAL_FAILURE_IS_UNSOFTENABLE", False
    )
    with pytest.raises(GateBehaviorError):
        validate_behavior()


def test_validate_rejects_a_wrong_total(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr("app.core.codex_presentation_gate_behavior.TOTAL_FLAGS", 58)
    with pytest.raises(GateBehaviorError):
        validate_behavior()
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
