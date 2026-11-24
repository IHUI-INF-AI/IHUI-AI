# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""Tests for the documents toolkit contract (R112)."""

from __future__ import annotations

import pytest

from app.core.docx_toolkit_contract import (
    CANDIDATES_TRIED,
    CONTENT_CONTROLS,
    CONTRACT_FAMILIES,
    EMU_PER_POINT,
    EMU_PER_TWIP,
    LIST_FLAGS,
    LISTED_TEXT_AFTER_FILL,
    MODE_TOOLS,
    ONLY_DOUBLE_BRACES_SUPPORTED,
    PARAGRAPH_TEXT_AFTER_FILL,
    PLACEHOLDER_SYNTAX,
    RAW_XML_OCCURRENCES_OF_VALUE,
    READ_PATCH_WRITE,
    READ_PATCH_WRITE_TOOL_COUNT,
    REJECTED_SYNTAXES,
    SDT_TAG_ATTRIBUTE,
    SDT_VALUE_IS_INVISIBLE_TO_PARAGRAPH_TEXT,
    SUBCONTRACT_COMMANDS,
    SUBCONTRACT_TOOLS,
    TOOL_COUNT,
    TOOLS,
    TWIPS_PER_POINT,
    ContractError,
    contract_summary,
    family_of,
    is_placeholder,
    validate_contract,
)


def test_contract_validates() -> None:
    validate_contract()


def test_roster_is_complete() -> None:
    assert TOOL_COUNT == 36 == len(TOOLS)
    assert all(name.endswith(".py") for name, _ in TOOLS)


def test_families_account_for_every_tool() -> None:
    assert sum(CONTRACT_FAMILIES.values()) == TOOL_COUNT
    assert CONTRACT_FAMILIES[READ_PATCH_WRITE] == READ_PATCH_WRITE_TOOL_COUNT == 32
    assert len(SUBCONTRACT_TOOLS) == 1
    assert len(MODE_TOOLS) == 3


def test_family_of() -> None:
    assert family_of(CONTENT_CONTROLS) == "subcommands"
    assert family_of("accept_tracked_changes.py") == "--mode"
    assert family_of("docx_ooxml_patch.py") == "in_docx + --out"


def test_one_placeholder_syntax_only() -> None:
    assert PLACEHOLDER_SYNTAX == "{{tag}}"
    assert CANDIDATES_TRIED == len(REJECTED_SYNTAXES) + 1 == 5
    assert ONLY_DOUBLE_BRACES_SUPPORTED is True


def test_is_placeholder_accepts_only_double_braces() -> None:
    assert is_placeholder("{{name}}") is True
    for token in REJECTED_SYNTAXES[:3]:
        assert is_placeholder(token) is False


def test_fill_strips_the_braces() -> None:
    assert LISTED_TEXT_AFTER_FILL == "Alice"


def test_the_value_is_in_the_package() -> None:
    assert RAW_XML_OCCURRENCES_OF_VALUE == 1


def test_paragraph_text_cannot_see_it() -> None:
    """The finding: the value is real, listed, and invisible to paragraph.text."""
    assert PARAGRAPH_TEXT_AFTER_FILL == "Name: "
    assert SDT_VALUE_IS_INVISIBLE_TO_PARAGRAPH_TEXT is True


def test_tag_attribute_is_evidence() -> None:
    assert SDT_TAG_ATTRIBUTE == "w:tag"
    assert SUBCONTRACT_COMMANDS == ("list", "wrap_placeholders", "fill")
    assert LIST_FLAGS == ("--no_headers_footers", "--json")


def test_units_reconcile() -> None:
    assert TWIPS_PER_POINT == 20
    assert EMU_PER_TWIP == 635
    assert EMU_PER_TWIP * TWIPS_PER_POINT == EMU_PER_POINT == 12_700


def test_contract_mapping() -> None:
    c = contract_summary()
    assert c["tools"] == 36
    assert c["placeholder_syntax"] == "{{tag}}"
    assert c["sdt_invisible_to_paragraph_text"] is True


def test_validate_rejects_a_second_syntax(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(
        "app.core.docx_toolkit_contract.ONLY_DOUBLE_BRACES_SUPPORTED", False
    )
    with pytest.raises(ContractError):
        validate_contract()


def test_validate_rejects_hiding_the_blind_spot(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(
        "app.core.docx_toolkit_contract.SDT_VALUE_IS_INVISIBLE_TO_PARAGRAPH_TEXT", False
    )
    with pytest.raises(ContractError):
        validate_contract()


def test_validate_rejects_a_short_roster(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr("app.core.docx_toolkit_contract.TOOLS", TOOLS[:-1])
    with pytest.raises(ContractError):
        validate_contract()
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
