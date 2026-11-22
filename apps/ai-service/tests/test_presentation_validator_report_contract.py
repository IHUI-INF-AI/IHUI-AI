# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""Tests for the validator report-shape contract (R122)."""

from __future__ import annotations

import pytest

from app.core.presentation_validator_report_contract import (
    CHART_CHECK_STATUSES,
    CHART_DATA_SNAPSHOT,
    CHART_DISCOVERY,
    CHART_TARGET_APPLICATIONS,
    CHART_TITLE,
    CONFESSION_COUNT,
    CONFESSION_FIELDS,
    CONFESSION_REQUIRED_VALUE,
    CONTRACTS,
    DUAL_ZERO_FINDINGS,
    EXPERIMENTAL_SNAPSHOT_FLAGS,
    FIRST_PARTY_IMPORT,
    LAYOUT_GEOMETRY,
    NATIVE_CHART,
    ORDER_IS_PART_OF_THE_CONTRACT,
    PACKAGE_INTEGRITY,
    SET_COMPARISON_IS_NOT_ENOUGH,
    TABLE_ARITHMETIC,
    TABLE_ARITHMETIC_KEYS,
    TABLE_COMPONENT_MINIMUM,
    TEMPLATE_FIDELITY,
    TEMPLATE_FLAG_COUNT,
    VALIDATOR_MAX_BUFFER,
    VALIDATOR_TIMEOUT_MS,
    coverage,
    order_matches,
    owners_are_strictly_ascending,
    report_may_pass,
    validate_contract,
)


def test_contract_validates() -> None:
    validate_contract()


def test_nine_contracts() -> None:
    assert len(CONTRACTS) == 9


def test_every_contract_has_a_schema_and_fields() -> None:
    for c in CONTRACTS:
        assert c.schema_version
        assert len(c.checked_fields) >= 1


def test_dual_zero_findings() -> None:
    """A count of zero with a nonempty list is broken, not passing."""
    assert report_may_pass(0, []) is True
    assert report_may_pass(0, ["something"]) is False
    assert report_may_pass(3, []) is False


def test_owners_must_be_strictly_ascending() -> None:
    assert owners_are_strictly_ascending([1, 3, 5]) is True
    assert owners_are_strictly_ascending([1, 3, 3]) is False
    assert owners_are_strictly_ascending([3, 1]) is False


def test_order_must_match_position_by_position() -> None:
    assert order_matches([2, 5], [2, 5]) is True
    assert order_matches([2, 5], [5, 2]) is False
    assert order_matches([2, 5], [2]) is False


def test_four_confessions_must_be_false() -> None:
    assert CONFESSION_COUNT == 4
    assert CONFESSION_REQUIRED_VALUE is False
    assert "native_powerpoint_verified" in CONFESSION_FIELDS
    assert "source_attachments_accessed" in CONFESSION_FIELDS


def test_snapshot_admits_its_limits() -> None:
    """The converter must say it did not preserve the source workbook or formulas."""
    flags = dict(EXPERIMENTAL_SNAPSHOT_FLAGS)
    assert flags["experimental"] is True
    assert flags["source_formulas_preserved"] is False
    assert flags["source_workbook_preserved"] is False
    assert flags["new_formulas_describe_snapshot_only"] is True


def test_four_chart_title_statuses() -> None:
    assert len(CHART_CHECK_STATUSES) == 4
    assert "explicitly_suppressed" in CHART_CHECK_STATUSES


def test_two_chart_targets() -> None:
    assert CHART_TARGET_APPLICATIONS == ("portable", "powerpoint")


def test_validator_spawn_bounds() -> None:
    assert VALIDATOR_TIMEOUT_MS == 90_000
    assert VALIDATOR_MAX_BUFFER == 2 * 1024 * 1024


def test_order_is_part_of_the_contract() -> None:
    assert ORDER_IS_PART_OF_THE_CONTRACT is True
    assert SET_COMPARISON_IS_NOT_ENOUGH is True
    assert DUAL_ZERO_FINDINGS is True


def test_schema_versions_are_exact_strings() -> None:
    assert CHART_TITLE.schema_version == "presentation-native-chart-titles.v1"
    assert TABLE_ARITHMETIC.schema_version == "presentation-native-table-arithmetic.v1"
    assert CHART_DISCOVERY.schema_version == "owner-private.actual-native-chart-discovery.v1"
    assert (
        CHART_DATA_SNAPSHOT.schema_version == "experimental.literal-chart-workbook-snapshot.v1"
    )
    assert TEMPLATE_FIDELITY.schema_version == "template_source_fidelity.v1"


def test_chart_discovery_checks_both_confessions() -> None:
    assert "source_attachments_accessed" in CHART_DISCOVERY.checked_fields
    assert "source_required_chart_owners_inferred" in CHART_DISCOVERY.checked_fields


def test_chart_title_checks_both_confessions() -> None:
    assert "native_powerpoint_verified" in CHART_TITLE.checked_fields
    assert "source_text_emitted" in CHART_TITLE.checked_fields


def test_package_integrity_runs_first() -> None:
    assert CONTRACTS[0] is PACKAGE_INTEGRITY
    assert CONTRACTS[1] is LAYOUT_GEOMETRY


def test_six_table_coordinates() -> None:
    assert len(TABLE_ARITHMETIC_KEYS) == 6
    assert TABLE_COMPONENT_MINIMUM == 2


def test_three_template_flags() -> None:
    assert TEMPLATE_FLAG_COUNT == 3


def test_native_chart_checks_target_application() -> None:
    assert "target_application" in NATIVE_CHART.checked_fields
    assert "required_embedded_workbook_slides" in NATIVE_CHART.checked_fields


def test_first_party_import_hashes_its_input() -> None:
    assert "sha256" in FIRST_PARTY_IMPORT.checked_fields
    assert FIRST_PARTY_IMPORT.checked_fields == ("passed", "slideCount", "sha256")


def test_coverage_reports_full_read() -> None:
    c = coverage()
    assert c["contracts"] == 9
    assert c["lines_read"] == 1_077


def test_claiming_a_confession_may_be_true_is_rejected(monkeypatch: pytest.MonkeyPatch) -> None:
    from app.core import presentation_validator_report_contract as c

    monkeypatch.setattr(c, "CONFESSION_REQUIRED_VALUE", True)
    with pytest.raises(ValueError):
        c.validate_contract()


def test_claiming_one_counter_suffices_is_rejected(monkeypatch: pytest.MonkeyPatch) -> None:
    from app.core import presentation_validator_report_contract as c

    monkeypatch.setattr(c, "DUAL_ZERO_FINDINGS", False)
    with pytest.raises(ValueError):
        c.validate_contract()


def test_claiming_order_does_not_matter_is_rejected(monkeypatch: pytest.MonkeyPatch) -> None:
    from app.core import presentation_validator_report_contract as c

    monkeypatch.setattr(c, "SET_COMPARISON_IS_NOT_ENOUGH", False)
    with pytest.raises(ValueError):
        c.validate_contract()
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
