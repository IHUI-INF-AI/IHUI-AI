# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""Tests for the render toolchain contract (R108)."""

from __future__ import annotations

import pytest

from app.core.codex_render_toolchain import (
    ALL_THREE_REQUIRED,
    BIN_DIR_NEEDS_MANIFEST,
    CLOSES_VISUAL_VERIFICATION_GAP,
    ENV_CHAIN,
    ENV_CHAIN_LENGTH,
    EXIT_CODE_TRUSTWORTHY_ON_SUCCESS_PATH,
    FIRST_ATTEMPT_EXIT_CODE,
    FIRST_ATTEMPT_HAD_TRACEBACK,
    FIRST_ATTEMPT_PRODUCED_PNG,
    LATER_FAILURES_EXIT_CODE,
    MONTAGE_DEFAULT_NUM_COL,
    MONTAGE_DESCRIPTION,
    MONTAGE_EXIT_CODE,
    MONTAGE_INPUT_MODES,
    MONTAGE_INPUT_MODES_EXCLUSIVE,
    MONTAGE_LABEL_MODES,
    MONTAGE_OPTIONS,
    MONTAGE_OUTPUT_BYTES,
    MUST_USE_RUNTIME_PYTHON,
    NODE_MODULES_PREFERENCE_RUNTIME_FIRST,
    PRESENCE_OF_PNG_IS_THE_JUDGE,
    RENDER_DEFAULT_HEIGHT,
    RENDER_DEFAULT_WIDTH,
    RENDER_DESCRIPTION,
    RENDER_EXIT_CODE,
    RENDER_INPUT_ACCEPTS,
    RENDER_OPTIONS,
    RENDER_OUTPUT_PATTERN,
    RENDER_SCALE_IS_ISOTROPIC,
    RENDERED_BYTES,
    RENDERED_OUTPUT,
    RUNTIME_BIN_DIR_ERROR,
    RUNTIME_HAS_PDF2IMAGE,
    RUNTIME_MODULES_OBSERVED,
    RUNTIME_NODE_MODULES_ERROR,
    RUNTIME_NODE_VAR,
    VENV_ERROR_TEXT,
    VENV_MISSING_MODULE,
    RenderToolchainError,
    env_chain_complete,
    exit_code_is_reliable,
    render_can_judge_by_output,
    toolchain_contract,
    validate_toolchain_contract,
)


def test_contract_validates() -> None:
    validate_toolchain_contract()


def test_descriptions_are_evidence() -> None:
    assert RENDER_DESCRIPTION == "Render slides to images."
    assert "fixed number of columns" in MONTAGE_DESCRIPTION


def test_render_arguments() -> None:
    assert RENDER_INPUT_ACCEPTS == ("PowerPoint", "PDF")
    assert len(RENDER_OPTIONS) == 3
    assert RENDER_DEFAULT_WIDTH == 1600
    assert RENDER_DEFAULT_HEIGHT == 900
    assert RENDER_SCALE_IS_ISOTROPIC is True
    assert RENDER_OUTPUT_PATTERN == "slide-<N>.png"


def test_montage_arguments() -> None:
    assert MONTAGE_INPUT_MODES == ("--input_files", "--input_dir")
    assert MONTAGE_INPUT_MODES_EXCLUSIVE is True
    assert MONTAGE_DEFAULT_NUM_COL == 5
    assert len(MONTAGE_OPTIONS) == 7
    assert MONTAGE_LABEL_MODES == ("number", "filename", "none")


def test_venv_lacks_pdf2image_but_runtime_has_it() -> None:
    assert VENV_MISSING_MODULE == "pdf2image"
    assert "No module named" in VENV_ERROR_TEXT
    assert RUNTIME_HAS_PDF2IMAGE is True
    assert MUST_USE_RUNTIME_PYTHON is True
    assert len(RUNTIME_MODULES_OBSERVED) == 4


def test_three_env_vars_are_a_chain() -> None:
    """Each one was only discovered after the previous was satisfied."""
    assert ENV_CHAIN_LENGTH == 3
    assert ENV_CHAIN == (RUNTIME_NODE_VAR, "RUNTIME_BIN_DIR", "RUNTIME_NODE_MODULES")
    assert ALL_THREE_REQUIRED is True


def test_env_chain_completeness() -> None:
    full = dict.fromkeys(ENV_CHAIN, "path")
    assert env_chain_complete(full) is True
    assert env_chain_complete({RUNTIME_NODE_VAR: "p", "RUNTIME_BIN_DIR": "q"}) is False
    assert env_chain_complete({}) is False


def test_env_var_errors_are_quoted() -> None:
    assert RUNTIME_BIN_DIR_ERROR == "RUNTIME_BIN_DIR is required."
    assert "RUNTIME_NODE_MODULES" in RUNTIME_NODE_MODULES_ERROR
    assert "CODEX_PRIMARY_RUNTIME_NODE_MODULES" in RUNTIME_NODE_MODULES_ERROR


def test_node_modules_name_preference() -> None:
    assert NODE_MODULES_PREFERENCE_RUNTIME_FIRST is True
    assert BIN_DIR_NEEDS_MANIFEST == "native-executables.json"


def test_both_tools_succeeded() -> None:
    assert RENDERED_OUTPUT == "slide-1.png"
    assert RENDERED_BYTES == 17_112
    assert RENDER_EXIT_CODE == 0
    assert MONTAGE_OUTPUT_BYTES == 5_670
    assert MONTAGE_EXIT_CODE == 0


def test_the_exit_zero_trap() -> None:
    """A traceback rode on exit 0 and produced nothing."""
    assert FIRST_ATTEMPT_EXIT_CODE == 0
    assert FIRST_ATTEMPT_HAD_TRACEBACK is True
    assert FIRST_ATTEMPT_PRODUCED_PNG is False
    assert LATER_FAILURES_EXIT_CODE == 1
    assert EXIT_CODE_TRUSTWORTHY_ON_SUCCESS_PATH is False
    assert PRESENCE_OF_PNG_IS_THE_JUDGE is True


def test_exit_code_reliability_helper() -> None:
    assert exit_code_is_reliable(True) is False
    assert exit_code_is_reliable(False) is True


def test_output_presence_helper() -> None:
    assert render_can_judge_by_output(True) is True
    assert render_can_judge_by_output(False) is False


def test_closes_visual_gap() -> None:
    assert CLOSES_VISUAL_VERIFICATION_GAP is True


def test_contract_mapping() -> None:
    c = toolchain_contract()
    assert c["env_chain"] == 3
    assert c["render_bytes"] == 17_112
    assert c["exit_zero_can_lie"] is True


def test_validate_rejects_trusting_exit_zero(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(
        "app.core.codex_render_toolchain.EXIT_CODE_TRUSTWORTHY_ON_SUCCESS_PATH", True
    )
    with pytest.raises(RenderToolchainError):
        validate_toolchain_contract()


def test_validate_rejects_dropping_an_env_var(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(
        "app.core.codex_render_toolchain.ENV_CHAIN",
        ("RUNTIME_NODE", "RUNTIME_BIN_DIR"),
    )
    with pytest.raises(RenderToolchainError):
        validate_toolchain_contract()
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
