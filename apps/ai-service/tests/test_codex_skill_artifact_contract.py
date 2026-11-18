# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""Tests for the skill-artifact interaction contract (R95)."""

from __future__ import annotations

import pytest

from app.core.codex_skill_artifact_contract import (
    CITATION_ARGUMENT_COUNT,
    CITATION_ARGUMENTS,
    CITATION_EMITTED_BARE,
    CITATION_NAME,
    CITATION_OUTPUT_ONCE,
    CITATION_PURPOSE_COUNT,
    CITATION_PURPOSES,
    CITATION_REQUIRES_VERIFIED_TARGET,
    CITATION_SOURCE_INLINE,
    CITATION_UNIVERSAL_ARGUMENTS,
    FORMAT_COMPARISON,
    MARKER_ARGV_LEN,
    MARKER_COPY_COUNT,
    MARKER_COUNT_MAX,
    MARKER_COUNT_MIN,
    MARKER_EXIT_OK,
    MARKER_EXIT_USAGE,
    MARKER_FORBIDDEN_FOR_READ_ONLY,
    MARKER_FORMAT_TOTAL,
    MARKER_FORMATS,
    MARKER_IS_SILENT_ON_SUCCESS,
    MARKER_MAX_BYTES,
    MARKER_MIN_BYTES,
    MARKER_MIN_LINES,
    MARKER_MUTATES_ANYTHING,
    MARKER_ONCE_PER_OPERATION,
    MARKER_OPERATION_KINDS,
    MARKER_REQUIRED_FOR_WRITE,
    MARKER_SCRIPT,
    MARKER_SLOTS,
    SkillArtifactContractError,
    is_citation_argument,
    is_citation_purpose,
    marker_accepts,
    marker_formats_of,
    validate_contract,
)


def test_contract_validates() -> None:
    validate_contract()


def test_marker_is_four_near_identical_copies() -> None:
    assert MARKER_SCRIPT == "mark_artifact_operation_started.mjs"
    assert len(MARKER_FORMATS) == MARKER_COPY_COUNT == 4
    assert MARKER_MIN_LINES == 23
    assert MARKER_MIN_BYTES == 735
    assert MARKER_MAX_BYTES == 765


def test_marker_argv_shape() -> None:
    assert MARKER_SLOTS == ("--operation-kind", "--expected-output-count", "--output-format")
    assert MARKER_ARGV_LEN == 6
    assert len(MARKER_SLOTS) * 2 == MARKER_ARGV_LEN
    assert MARKER_OPERATION_KINDS == ("create", "edit")
    assert (MARKER_COUNT_MIN, MARKER_COUNT_MAX) == (1, 100)


def test_marker_is_a_validator_not_a_recorder() -> None:
    assert MARKER_MUTATES_ANYTHING is False
    assert MARKER_IS_SILENT_ON_SUCCESS is True
    assert (MARKER_EXIT_OK, MARKER_EXIT_USAGE) == (0, 2)


def test_format_allowlists_differ_by_plugin() -> None:
    assert marker_formats_of("pdf") == ("pdf",)
    assert marker_formats_of("documents") == ("docx",)
    assert marker_formats_of("presentations") == ("ppt", "pptx")
    assert marker_formats_of("spreadsheets") == ("csv", "tsv", "xls", "xlsm", "xlsx")
    assert MARKER_FORMAT_TOTAL == 9


def test_format_membership_is_case_insensitive() -> None:
    assert marker_accepts("pdf", "PDF") is True
    assert marker_accepts("pdf", "pdf") is True
    assert marker_accepts("pdf", "docx") is False
    assert FORMAT_COMPARISON == "lowercased-before-membership-test"


def test_unknown_plugin_raises() -> None:
    with pytest.raises(SkillArtifactContractError):
        marker_formats_of("template-creator")


def test_citation_argument_surface() -> None:
    assert CITATION_NAME == "codex-file-citation"
    assert CITATION_ARGUMENT_COUNT == 7
    assert CITATION_UNIVERSAL_ARGUMENTS == ("path", "purpose")
    for name in CITATION_ARGUMENTS:
        assert is_citation_argument(name)
    assert is_citation_argument("artifact_kind") is True
    assert is_citation_argument("not_an_arg") is False


def test_citation_purpose_vocabulary() -> None:
    assert CITATION_PURPOSES == ("output", "source")
    assert CITATION_PURPOSE_COUNT == 2
    assert is_citation_purpose("output") is True
    assert is_citation_purpose("input") is False


def test_citation_directives() -> None:
    assert CITATION_EMITTED_BARE is True
    assert CITATION_REQUIRES_VERIFIED_TARGET is True
    assert CITATION_OUTPUT_ONCE is True
    assert CITATION_SOURCE_INLINE is True


def test_marker_scope_rules() -> None:
    assert MARKER_REQUIRED_FOR_WRITE is True
    assert MARKER_FORBIDDEN_FOR_READ_ONLY is True
    assert MARKER_ONCE_PER_OPERATION is True


def test_validate_rejects_an_inflated_allowlist(monkeypatch: pytest.MonkeyPatch) -> None:
    bad = dict(MARKER_FORMATS)
    bad["pdf"] = ("pdf", "ps")
    monkeypatch.setattr("app.core.codex_skill_artifact_contract.MARKER_FORMATS", bad)
    with pytest.raises(SkillArtifactContractError):
        validate_contract()


def test_validate_rejects_an_uppercased_format(monkeypatch: pytest.MonkeyPatch) -> None:
    bad = dict(MARKER_FORMATS)
    bad["pdf"] = ("PDF",)
    monkeypatch.setattr("app.core.codex_skill_artifact_contract.MARKER_FORMATS", bad)
    with pytest.raises(SkillArtifactContractError):
        validate_contract()
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
