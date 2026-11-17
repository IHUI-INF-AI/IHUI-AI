# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""Contract test for the R67 attribution frontier.

The test pins the *negative* knowledge so later rounds cannot re-run a falsified method
by accident, and pins the measured numbers so a report/table drift is caught here.
"""

from __future__ import annotations

import pytest

from app.core.struct_attribution_frontier import (
    FALSIFIED_METHODS,
    FRONTIER_STRUCTS,
    MEASUREMENTS,
    can_string_methods_settle,
    ensure_frontier_consistent,
    falsified_methods,
    frontier_structs,
    resolved_structs,
    unknown_struct_fields,
)

EXPECTED_ARITY = {'ThreadStartParams': 27, 'TurnStartParams': 28}
EXPECTED_RESOLVED = {'ConfigRequirementsToml': 46}
EXPECTED_METHOD_IDS = frozenset({'distance-scan', 'content-contains', 'address-contains', 'coverage-union', 'whole-table-suffix', 'arity-only', 'pdata-same-function', 'pdata-in-function-slice', 'data-section-slice', 'pair-record-end', 'plain-tail-min-segmentation', 'gap-stitched-segmentation'})
EXPECTED_MEASUREMENTS = {'templates': 2661, 'bodies': 1706, 'unique_tails': 945, 'tail_suffix_ok': 30, 'tail_suffix_mismatch': 11, 'tail_accuracy': 0.732, 'record_ends': 1323, 'segmented_after_stitch': 1, 'attributed_structs': 44, 'record_runs_scanned': 15234, 'resolved_by_r68': 1}


def test_frontier_is_disjoint_from_attributed_contract() -> None:
    from app.core.struct_field_name_contract import STRUCT_FIELD_NAMES

    ensure_frontier_consistent(STRUCT_FIELD_NAMES)


def test_every_frontier_struct_reports_no_fields() -> None:
    assert unknown_struct_fields() == dict.fromkeys(FRONTIER_STRUCTS, ())
    for struct in frontier_structs().values():
        assert struct.fields_known is False


def test_frontier_arities_match_templates() -> None:
    got = {name: struct.arity for name, struct in frontier_structs().items()}
    assert got == EXPECTED_ARITY


def test_resolved_entries_are_off_the_frontier() -> None:
    resolved = resolved_structs()
    assert set(resolved) == set(EXPECTED_RESOLVED)
    for name in resolved:
        assert name not in FRONTIER_STRUCTS


def test_resolved_fields_match_r68_contract() -> None:
    from app.core.struct_fields_fat_pointer import CONFIG_REQUIREMENTS_TOML_FIELDS

    assert len(CONFIG_REQUIREMENTS_TOML_FIELDS) == EXPECTED_RESOLVED['ConfigRequirementsToml']


def test_string_methods_cannot_settle_frontier() -> None:
    for name in FRONTIER_STRUCTS:
        assert can_string_methods_settle(name) is False
    with pytest.raises(KeyError):
        can_string_methods_settle("ConfigToml")


def test_falsified_registry_is_unique_and_stable() -> None:
    ids = [method.method_id for method in FALSIFIED_METHODS]
    assert len(ids) == len(set(ids))
    assert set(ids) == EXPECTED_METHOD_IDS
    assert falsified_methods() == frozenset(FALSIFIED_METHODS)


def test_every_falsified_method_carries_measurement() -> None:
    for entry in FALSIFIED_METHODS:
        assert entry.why_falsified
        assert any(ch.isdigit() for ch in entry.why_falsified), entry.method_id
        assert entry.round_id.startswith("R")


def test_measurements_match_report() -> None:
    assert MEASUREMENTS == EXPECTED_MEASUREMENTS
    for key, value in MEASUREMENTS.items():
        assert isinstance(value, (int, float)), key


def test_validate_rejects_stale_frontier_entry() -> None:
    with pytest.raises(ValueError):
        ensure_frontier_consistent({"ThreadStartParams": ("model",)})
    with pytest.raises(ValueError):
        ensure_frontier_consistent({"TurnStartParams": ("model", "approval_policy")})


def test_validate_rejects_bad_arity_shape() -> None:
    from dataclasses import replace

    import app.core.struct_attribution_frontier as mod

    bad = dict(mod.FRONTIER_STRUCTS)
    bad["TurnStartParams"] = replace(mod.FRONTIER_STRUCTS["TurnStartParams"], arity=0)
    with pytest.raises(ValueError):
        _call_with(bad)


def _call_with(frontier: dict) -> None:
    import app.core.struct_attribution_frontier as mod

    original = mod.FRONTIER_STRUCTS
    try:
        mod.FRONTIER_STRUCTS = frontier
        mod.validate_frontier({})
    finally:
        mod.FRONTIER_STRUCTS = original
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
