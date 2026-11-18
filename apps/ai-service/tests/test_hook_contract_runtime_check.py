# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""R90: A12 — the recovered contract as an executable check."""

from __future__ import annotations

import pytest

from app.core.hook_contract_runtime_check import (
    CheckResult,
    HookPayloadError,
    Violation,
    audit_all_schemas,
    check_hook_event,
    check_hook_payload,
    minimal_payload,
    schema_title,
    violations_summary,
)
from app.core.hook_contract_schema import (
    HOOK_SCHEMA_FIELDS,
    HOOK_SCHEMA_NAMES,
    HOOK_SCHEMA_REQUIRED,
)


def test_every_schema_accepts_its_own_minimal_payload() -> None:
    audit = audit_all_schemas()
    assert len(audit) == len(HOOK_SCHEMA_NAMES) == 23
    for title, result in audit.items():
        assert result.ok, title
        assert result.violations == ()


def test_a_legal_payload_is_not_rejected() -> None:
    title = "pre-tool-use.command.input"
    payload = dict(minimal_payload(title))
    result = check_hook_payload(title, payload)
    assert result.ok
    assert result.checked_fields == len(HOOK_SCHEMA_REQUIRED[title])


def test_an_unknown_field_is_rejected() -> None:
    title = "post-tool-use.command.output"
    payload = {"smuggled_key": 1}
    result = check_hook_payload(title, payload)
    assert not result.ok
    assert any(v.kind == "unknown-field" and v.field == "smuggled_key"
               for v in result.violations)


def test_a_missing_required_field_is_rejected() -> None:
    title = "pre-tool-use.command.input"
    payload = dict(minimal_payload(title))
    dropped = HOOK_SCHEMA_REQUIRED[title][0]
    payload.pop(dropped)
    result = check_hook_payload(title, payload)
    assert not result.ok
    assert any(v.kind == "missing-required" and v.field == dropped
               for v in result.violations)


def test_both_kinds_are_reported_together() -> None:
    title = "stop.command.input"
    payload = {"extra": 1}
    result = check_hook_payload(title, payload)
    kinds = {v.kind for v in result.violations}
    assert kinds == {"unknown-field", "missing-required"}
    assert not result.ok


def test_an_output_schema_with_no_required_fields_accepts_an_empty_payload() -> None:
    title = "interrupt.command.output"
    assert title in HOOK_SCHEMA_FIELDS
    result = check_hook_payload(title, {})
    assert result.ok
    assert title in HOOK_SCHEMA_NAMES


def test_unknown_title_raises() -> None:
    with pytest.raises(HookPayloadError, match="unknown schema title"):
        check_hook_payload("nope.command.input", {})


def test_direction_is_checked() -> None:
    with pytest.raises(HookPayloadError, match="direction must be one of"):
        check_hook_event("pre-tool-use", "sideways", {})
    assert schema_title("pre-tool-use", "input") == "pre-tool-use.command.input"


def test_minimal_payload_rejects_unknown_title() -> None:
    with pytest.raises(HookPayloadError):
        minimal_payload("bogus.command.output")


def test_non_mapping_payload_raises() -> None:
    with pytest.raises(HookPayloadError, match="must be a mapping"):
        check_hook_payload("interrupt.command.output", ["not", "a", "mapping"])  # type: ignore[arg-type]


def test_field_counts_match_the_table() -> None:
    for title, fields in HOOK_SCHEMA_FIELDS.items():
        payload = dict(minimal_payload(title))
        result = check_hook_payload(title, payload)
        assert result.checked_fields <= len(fields), title


def test_summary_counts_are_zero_when_all_clean() -> None:
    audit = audit_all_schemas()
    assert set(violations_summary(audit).values()) == {0}


def test_result_is_frozen_and_reports_ok() -> None:
    r = CheckResult(title="interrupt.command.output", checked_fields=0, violations=())
    assert r.ok
    with pytest.raises(AttributeError):
        r.title = "x"  # type: ignore[misc]
    v = Violation("unknown-field", "k")
    assert v.kind == "unknown-field"
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
