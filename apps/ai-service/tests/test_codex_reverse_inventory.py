# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""Tests for the reverse-engineering inventory (R56-R103 index).

These tests are the mechanism that keeps the index honest: every module named in it must
exist on disk, and the boundary list must not be quietly shortened.
"""

from __future__ import annotations

import pytest

from app.core.codex_reverse_inventory import (
    AXES,
    AXIS_COUNT,
    BLACK_BOX_ONLY,
    COMPLETENESS_NOT_CLAIMED,
    CORE_DIR,
    GATE_AXIS,
    GROUPED_BY_CAPABILITY_NOT_BY_ROUND,
    HOOK_CONTRACT_AXIS,
    INDEX_DOES_NOT_ROT,
    LEDGER_AXIS,
    MODULES_BY_AXIS,
    PLUGIN_AXIS,
    RUNTIME_STATE_AXIS,
    SKILL_ENGINE_AXIS,
    STRUCTURAL_METHOD_AXIS,
    UNEXHAUSTED,
    UNEXHAUSTED_COUNT,
    InventoryError,
    describe_axes,
    module_count,
    module_path,
    modules_for,
    validate_inventory,
)


def test_inventory_validates() -> None:
    validate_inventory()


def test_seven_axes() -> None:
    assert AXIS_COUNT == 7
    assert AXES == (
        "structural",
        "hook",
        "runtime",
        "plugin",
        "skill",
        "gate",
        "ledger",
    )


def test_every_axis_has_modules() -> None:
    for axis in AXES:
        assert modules_for(axis), f"axis {axis} is empty"


def test_module_counts_are_consistent() -> None:
    total = module_count()
    assert total == sum(len(m) for m in MODULES_BY_AXIS.values())
    assert total >= 50, "48 rounds should have produced a substantial module set"
    assert describe_axes()[STRUCTURAL_METHOD_AXIS] == 21


def test_the_gate_axis_holds_the_eight_chart_modules() -> None:
    gate = modules_for(GATE_AXIS)
    assert len(gate) == 8
    for expected in (
        "codex_presentation_gate_behavior",
        "codex_presentation_gate_contract",
        "codex_presentation_gate_findings",
        "codex_chart_gate_contract",
        "codex_chart_workbook_verification",
        "codex_chart_rejection_codes",
        "codex_chart_target_application",
        "codex_source_figure_exception",
    ):
        assert expected in gate


def test_every_module_exists_on_disk() -> None:
    """The no-rot rule: a rename or deletion breaks this test."""
    missing = []
    for axis in AXES:
        for mod in modules_for(axis):
            p = module_path(mod)
            if not p.exists():
                missing.append(str(p))
    assert not missing, f"index names modules that are not on disk: {missing}"


def test_no_module_is_listed_twice() -> None:
    all_mods = [m for axis in AXES for m in modules_for(axis)]
    assert len(set(all_mods)) == len(all_mods)


def test_core_dir_points_at_the_package() -> None:
    assert CORE_DIR.name == "core"
    assert (CORE_DIR / "codex_reverse_inventory.py").exists()


def test_no_completeness_claim() -> None:
    assert COMPLETENESS_NOT_CLAIMED is True
    assert BLACK_BOX_ONLY is True
    assert GROUPED_BY_CAPABILITY_NOT_BY_ROUND is True
    assert INDEX_DOES_NOT_ROT is True


def test_boundaries_are_substantial() -> None:
    assert len(UNEXHAUSTED) == UNEXHAUSTED_COUNT
    assert UNEXHAUSTED_COUNT >= 10, (
        "the boundaries list must not be trimmed to make the programme look finished"
    )
    for area, gap, reason in UNEXHAUSTED:
        assert area.strip() and gap.strip() and reason.strip()


def test_boundaries_include_the_hard_ones() -> None:
    areas = {e[0] for e in UNEXHAUSTED}
    assert "hook 触发" in areas
    assert "chart receipt" in areas
    assert "许可" in areas


def test_axes_named_constants_match() -> None:
    assert STRUCTURAL_METHOD_AXIS == "structural"
    assert HOOK_CONTRACT_AXIS == "hook"
    assert RUNTIME_STATE_AXIS == "runtime"
    assert PLUGIN_AXIS == "plugin"
    assert SKILL_ENGINE_AXIS == "skill"
    assert LEDGER_AXIS == "ledger"


def test_validate_rejects_a_phantom_module(monkeypatch: pytest.MonkeyPatch) -> None:
    bad = dict(MODULES_BY_AXIS)
    bad[SKILL_ENGINE_AXIS] = ("definitely_not_a_real_module",)
    monkeypatch.setattr(
        "app.core.codex_reverse_inventory.MODULES_BY_AXIS", bad
    )
    with pytest.raises(InventoryError):
        validate_inventory()


def test_validate_rejects_a_trimmed_boundary_list(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(
        "app.core.codex_reverse_inventory.UNEXHAUSTED", UNEXHAUSTED[:3]
    )
    monkeypatch.setattr(
        "app.core.codex_reverse_inventory.UNEXHAUSTED_COUNT", 3
    )
    with pytest.raises(InventoryError):
        validate_inventory()
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
