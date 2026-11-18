# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""R91: A6 — the schema descriptions, and the rule one of them states."""

from __future__ import annotations

import pytest

from app.core import hook_field_description as mod
from app.core.hook_field_description import (
    BLOCK_REQUIRES_REASON,
    BLOCK_RULE_TITLES,
    DESCRIBED_FIELDS,
    DESCRIPTION_COUNT,
    DESCRIPTIONS,
    PROPERTY_TOTAL,
    TEXTS,
    UNDESCRIBED_PROPERTIES,
    UNIQUE_TEXTS,
    FieldDescriptionError,
    described_fields,
    description_of,
    field_description_summary,
    validate_field_descriptions,
)


def test_two_fields_are_documented() -> None:
    assert DESCRIBED_FIELDS == 2
    assert DESCRIPTION_COUNT == 12
    assert UNIQUE_TEXTS == 2
    validate_field_descriptions()


def test_the_fields_are_reason_and_turn_id() -> None:
    assert described_fields() == ("reason", "turn_id")


def test_the_turn_id_text_is_an_extension_note() -> None:
    note = description_of("turn_id", "pre-tool-use.command.input")
    assert note.startswith("Codex extension")


def test_the_reason_text_states_a_schema_external_rule() -> None:
    note = description_of("reason", "stop.command.output")
    assert "decision" in note
    assert "block" in note
    assert "rather than in the JSON schema" in note


def test_the_block_rule_targets_two_output_schemas() -> None:
    assert BLOCK_REQUIRES_REASON is True
    assert BLOCK_RULE_TITLES == ("stop.command.output", "subagent-stop.command.output")
    for title in BLOCK_RULE_TITLES:
        from app.core.hook_contract_schema import HOOK_SCHEMA_FIELDS
        assert "decision" in HOOK_SCHEMA_FIELDS[title]
        assert "reason" in HOOK_SCHEMA_FIELDS[title]


def test_undescribed_properties_are_the_majority() -> None:
    assert PROPERTY_TOTAL == 170
    assert UNDESCRIBED_PROPERTIES == 158


def test_lookup_returns_empty_for_an_undocumented_field() -> None:
    assert description_of("cwd", "pre-tool-use.command.input") == ""


def test_summary_matches() -> None:
    s = field_description_summary()
    assert s["descriptions"] == 12
    assert s["fields"] == 2
    assert s["block_rule_titles"] == 2


def test_validator_rejects_losing_the_rule(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(mod, "BLOCK_REQUIRES_REASON", False)
    with pytest.raises(FieldDescriptionError, match="stated in the schema"):
        mod.validate_field_descriptions()


def test_validator_rejects_an_undeclared_field(monkeypatch: pytest.MonkeyPatch) -> None:
    bad = dict(DESCRIPTIONS)
    bad["no_such_field"] = {"post-tool-use.command.input": TEXTS[0]}
    monkeypatch.setattr(mod, "DESCRIPTIONS", bad)
    monkeypatch.setattr(mod, "DESCRIBED_FIELDS", len(bad))
    monkeypatch.setattr(mod, "DESCRIPTION_COUNT", sum(len(v) for v in bad.values()))
    with pytest.raises(FieldDescriptionError, match="not declared"):
        mod.validate_field_descriptions()
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
