# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""Tests for the hook configuration contract and its four falsifications (R94)."""

from __future__ import annotations

import pytest

from app.core.codex_hook_config_contract import (
    CONFIG_LOAD_FAILURES,
    HANDLER_TOML_TYPE_VALUES,
    HANDLER_VARIANT_COUNT,
    HANDLER_VARIANTS,
    HOOK_COLUMNS_IN_STATE_DB,
    HOOK_EVENT_COUNT,
    HOOK_EVENT_PASCAL_COUNT,
    HOOK_EVENTS,
    HOOK_EVENTS_PASCAL,
    HOOKS_KEY_ACCEPTED,
    HOOKS_KEY_WARNING_EMITTED,
    HOOKS_TRIGGERED,
    MATCHER_GROUP_ARITY,
    MATCHER_GROUP_FIELDS,
    PASCAL_TABLE_OBSERVED_COUNT,
    PAYLOADS_CAPTURED,
    RECORDER_COMMANDS_CONFIGURED,
    SNAKE_TABLE_OBSERVED_COUNT,
    STATE_DB_TABLE_COUNT,
    STATE_DB_TABLES,
    STATE_FIELD_COUNT,
    STATE_FIELDS,
    TRUST_BYPASS_CONFIG_KEY_RECOGNIZED,
    TRUST_FLAG,
    TRUST_REQUIRED_BY_DEFAULT,
    HookConfigContractError,
    events_with_prefix,
    is_event,
    pascal_of,
    toml_type_of,
    validate_contract,
)


def test_fourteen_events_both_spellings() -> None:
    assert HOOK_EVENT_COUNT == HOOK_EVENT_PASCAL_COUNT == 14
    assert len(set(HOOK_EVENTS)) == 14
    assert len(set(HOOK_EVENTS_PASCAL)) == 14


def test_contract_validates() -> None:
    validate_contract()


def test_every_snake_event_has_a_pascal_twin() -> None:
    for name in HOOK_EVENTS:
        pascal = pascal_of(name)
        assert pascal[:1].isupper()
        assert pascal.lower() == name.replace("_", "")


def test_short_table_is_two_short() -> None:
    assert SNAKE_TABLE_OBSERVED_COUNT == 12
    assert PASCAL_TABLE_OBSERVED_COUNT == 14
    assert HOOK_EVENT_COUNT - SNAKE_TABLE_OBSERVED_COUNT == 2
    # the two events the short table cannot spell out
    assert "pre_model_request" not in (
        "post_model_request", "pre_tool_use", "permission_request", "post_tool_use",
        "pre_compact", "post_compact", "session_start", "session_end",
        "user_prompt_submit", "subagent_start", "subagent_stop", "interrupt",
    )
    assert "stop" not in (
        "post_model_request", "pre_tool_use", "permission_request", "post_tool_use",
        "pre_compact", "post_compact", "session_start", "session_end",
        "user_prompt_submit", "subagent_start", "subagent_stop", "interrupt",
    )


def test_handler_variants_pair_with_toml_types() -> None:
    assert HANDLER_VARIANTS == ("Command", "Prompt", "Agent", "McpTool")
    assert toml_type_of("Command") == "command"
    assert toml_type_of("McpTool") == "mcp_tool"
    assert len(HANDLER_VARIANTS) == HANDLER_VARIANT_COUNT == 4
    assert len(set(HANDLER_TOML_TYPE_VALUES)) == 4


def test_matcher_group_shape() -> None:
    assert MATCHER_GROUP_FIELDS == ("matcher", "hooks")
    assert MATCHER_GROUP_ARITY == 2


def test_state_fields_lead_with_enabled() -> None:
    assert STATE_FIELDS == ("enabled", "trusted_hash", "trusted_content_hash")
    assert STATE_FIELD_COUNT == 3


def test_events_with_prefix() -> None:
    assert events_with_prefix("pre_") == (
        "pre_model_request",
        "pre_tool_use",
        "pre_compact",
    )
    assert events_with_prefix("subagent_") == ("subagent_start", "subagent_stop")


def test_non_event_raises() -> None:
    assert is_event("stop") is True
    assert is_event("not_an_event") is False
    with pytest.raises(HookConfigContractError):
        pascal_of("not_an_event")
    with pytest.raises(HookConfigContractError):
        toml_type_of("Nope")


def test_trust_gate_facts_are_negative() -> None:
    assert TRUST_REQUIRED_BY_DEFAULT is True
    assert TRUST_BYPASS_CONFIG_KEY_RECOGNIZED is False
    assert TRUST_FLAG == "--dangerously-bypass-hook-trust"
    assert HOOKS_KEY_ACCEPTED is True
    assert HOOKS_KEY_WARNING_EMITTED is False


def test_state_database_carries_no_hook_surface() -> None:
    assert STATE_DB_TABLE_COUNT == 17
    assert len(STATE_DB_TABLES) == 17
    assert HOOK_COLUMNS_IN_STATE_DB == 0
    assert not any("hook" in t.lower() for t in STATE_DB_TABLES)


def test_negative_runtime_outcome_is_pinned() -> None:
    assert CONFIG_LOAD_FAILURES == 1
    assert HOOKS_TRIGGERED == 0
    assert PAYLOADS_CAPTURED == 0
    assert RECORDER_COMMANDS_CONFIGURED == 6


def test_validate_rejects_a_softened_falsification(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr("app.core.codex_hook_config_contract.HOOKS_TRIGGERED", 1)
    with pytest.raises(HookConfigContractError):
        validate_contract()


def test_validate_rejects_a_shortened_event_table(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(
        "app.core.codex_hook_config_contract.HOOK_EVENT_COUNT", 13
    )
    with pytest.raises(HookConfigContractError):
        validate_contract()
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
