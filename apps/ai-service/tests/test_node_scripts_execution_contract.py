# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""Tests for the measured .mjs helper behaviour (R120)."""

from __future__ import annotations

import pytest

from app.core.node_scripts_execution_contract import (
    MARK_COPIES_ARE_IDENTICAL_EXCEPT_FORMATS,
    MARK_COUNT_RANGE,
    MARK_FAILURE_EXIT_CODE,
    MARK_FORMATS,
    MEASURED,
    MEASURED_WITH_PIPELINE,
    MEASURED_WITHOUT_PIPELINE,
    PIPELINE_MASKS_EXIT_CODE,
    RASTERIZE_BLOCKS_ALL_DECODERS,
    RASTERIZE_LIMIT_INPUT_PIXELS,
    RASTERIZE_UNBLOCKS_ONLY,
    READ_ONLY_SCRIPTS,
    RUNTIME_ENV_FALLBACK,
    RUNTIME_ENV_PRIMARY,
    RUNTIME_PATH_MUST_BE_ABSOLUTE,
    SCRIPT_COUNT,
    accepted_formats,
    coverage,
    exit_code_for,
    guard_accepts,
    validate_contract,
)


def test_contract_validates() -> None:
    validate_contract()


def test_fifteen_scripts() -> None:
    assert SCRIPT_COUNT == 15


def test_four_guard_copies_with_distinct_format_sets() -> None:
    assert set(MARK_FORMATS) == {"documents", "pdf", "presentations", "spreadsheets"}
    assert accepted_formats("documents") == ("docx",)
    assert accepted_formats("pdf") == ("pdf",)
    assert accepted_formats("presentations") == ("ppt", "pptx")
    assert accepted_formats("spreadsheets") == ("csv", "tsv", "xls", "xlsm", "xlsx")


def test_unknown_skill_raises() -> None:
    with pytest.raises(KeyError):
        accepted_formats("email")


def test_guard_accepts_matching_format() -> None:
    assert guard_accepts("documents", "docx") is True
    assert guard_accepts("presentations", "ppt") is True
    assert guard_accepts("spreadsheets", "xlsx") is True


def test_guard_rejects_mismatched_format() -> None:
    assert guard_accepts("documents", "pptx") is False
    assert guard_accepts("spreadsheets", "docx") is False


def test_guard_rejects_out_of_range_count() -> None:
    assert guard_accepts("documents", "docx", count=0) is False
    assert guard_accepts("documents", "docx", count=MARK_COUNT_RANGE[1] + 1) is False
    assert guard_accepts("documents", "docx", count=MARK_COUNT_RANGE[1]) is True


def test_guard_rejects_other_operation_kinds() -> None:
    assert guard_accepts("documents", "docx", kind="delete") is False


def test_guard_failure_code_is_two() -> None:
    assert exit_code_for(True) == 0
    assert exit_code_for(False) == MARK_FAILURE_EXIT_CODE == 2


def test_the_copies_differ_only_in_formats() -> None:
    """A fix to the guard has to be applied four times; that is the recorded risk."""
    assert MARK_COPIES_ARE_IDENTICAL_EXCEPT_FORMATS is True


def test_runtime_module_environment() -> None:
    assert RUNTIME_ENV_PRIMARY == "RUNTIME_NODE_MODULES"
    assert RUNTIME_ENV_FALLBACK == "CODEX_PRIMARY_RUNTIME_NODE_MODULES"
    assert RUNTIME_PATH_MUST_BE_ABSOLUTE is True


def test_rasterizer_blocks_foreign_loaders() -> None:
    """Sharp sniffs bytes; only the SVG decoder may load input."""
    assert RASTERIZE_BLOCKS_ALL_DECODERS is True
    assert RASTERIZE_UNBLOCKS_ONLY == "VipsForeignLoadSvg"
    assert RASTERIZE_LIMIT_INPUT_PIXELS is False


def test_pipeline_masked_four_exit_codes() -> None:
    """The measured lesson: $LASTEXITCODE after a pipe is the pipe's, not node's."""
    assert PIPELINE_MASKS_EXIT_CODE is True
    assert MEASURED_WITH_PIPELINE == (0, 0, 0, 0, 0)
    assert MEASURED_WITHOUT_PIPELINE == (0, 1, 1, 1, 1)


def test_fifteen_measured_cases() -> None:
    assert len(MEASURED) == 15


def test_measured_set_has_both_outcomes() -> None:
    codes = {r.rc for r in MEASURED}
    assert 0 in codes and 1 in codes and 2 in codes


def test_coverage_is_honest() -> None:
    c = coverage()
    assert c["scripts"] == 15
    assert c["executed"] == 6
    assert c["read_only"] == len(READ_ONLY_SCRIPTS) == 9
    assert c["executed"] + c["read_only"] == 15


def test_claiming_a_shared_guard_is_rejected(monkeypatch: pytest.MonkeyPatch) -> None:
    from app.core import node_scripts_execution_contract as c

    monkeypatch.setattr(c, "MARK_GUARD_IS_SHARED_MODULE", True)
    with pytest.raises(ValueError):
        c.validate_contract()


def test_claiming_all_decoders_are_allowed_is_rejected(monkeypatch: pytest.MonkeyPatch) -> None:
    from app.core import node_scripts_execution_contract as c

    monkeypatch.setattr(c, "RASTERIZE_BLOCKS_ALL_DECODERS", False)
    with pytest.raises(ValueError):
        c.validate_contract()


def test_claiming_the_runtime_path_is_relative_is_rejected(monkeypatch: pytest.MonkeyPatch) -> None:
    from app.core import node_scripts_execution_contract as c

    monkeypatch.setattr(c, "RUNTIME_PATH_MUST_BE_ABSOLUTE", False)
    with pytest.raises(ValueError):
        c.validate_contract()


def test_claiming_one_masked_branch_is_rejected(monkeypatch: pytest.MonkeyPatch) -> None:
    from app.core import node_scripts_execution_contract as c

    monkeypatch.setattr(c, "MEASURED_WITH_PIPELINE", (0, 1, 1, 1, 1))
    with pytest.raises(ValueError):
        c.validate_contract()
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
