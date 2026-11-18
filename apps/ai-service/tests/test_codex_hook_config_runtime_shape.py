# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""Tests for the hook config runtime shape (R105)."""

from __future__ import annotations

import pytest

from app.core.codex_hook_config_runtime_shape import (
    ACCEPTED_CONFIGURATIONS,
    ACCEPTED_COUNT,
    ACCEPTED_DOES_NOT_MEAN_RAN,
    BYPASS_DOES_NOT_IMPLY_ENABLED,
    CANDIDATE_REASON_COUNT,
    CANDIDATE_REASONS,
    EVENT_KEY_CASE,
    EVENT_VALUE_TYPE,
    HANDLER_EXECUTED,
    HOOKS_ROOT_TYPE,
    LAYER_COUNT,
    LAYERS,
    MATCHER_GROUP_TYPE,
    PAYLOAD_CAPTURED,
    REASONS_ARE_UNRESOLVED,
    RUNTIME_MATCHES_BINARY_SCHEMA,
    RUNTIME_TYPE_ERROR_COUNT,
    RUNTIME_TYPE_ERRORS,
    SHAPE_ESTABLISHED,
    STATE_KEY_IS_A_FREE_NAME,
    STATE_TYPE,
    STATE_VALUE_TYPE,
    TRIGGER_ESTABLISHED,
    TRUST_FLAG,
    TRUST_FLAG_RECOGNIZED,
    TRUST_WARNING_TEXT,
    HookRuntimeShapeError,
    event_key_is_snake_case,
    layers_agree_with_binary,
    runtime_contract,
    validate_runtime_contract,
)


def test_contract_validates() -> None:
    validate_runtime_contract()


def test_three_parser_rejections_are_quoted() -> None:
    assert RUNTIME_TYPE_ERROR_COUNT == 3
    for msg in RUNTIME_TYPE_ERRORS:
        assert "in `hooks" in msg
        assert "expected" in msg


def test_five_layers() -> None:
    assert LAYER_COUNT == 5
    assert len(LAYERS) == 5
    assert LAYERS[0] == ("hooks", "struct HooksToml")
    assert LAYERS[1] == ("hooks.<event>", "sequence<MatcherGroup>")


def test_the_three_error_pairs_derive_the_shape() -> None:
    """Each rejection is the reason one layer is what it is."""
    # map -> sequence  ⇒ the per-event value is an array
    assert "map, expected a sequence" in RUNTIME_TYPE_ERRORS[0]
    assert EVENT_VALUE_TYPE == "sequence<MatcherGroup>"
    # sequence -> struct HooksToml  ⇒ hooks itself is the struct
    assert "sequence, expected struct HooksToml" in RUNTIME_TYPE_ERRORS[1]
    assert HOOKS_ROOT_TYPE == "struct HooksToml"
    # boolean -> struct HookStateToml  ⇒ state is a map of that struct
    assert "boolean `true`, expected struct HookStateToml" in RUNTIME_TYPE_ERRORS[2]
    assert STATE_TYPE == "map<string, HookStateToml>"


def test_runtime_agrees_with_the_binary_schema() -> None:
    assert RUNTIME_MATCHES_BINARY_SCHEMA is True
    assert layers_agree_with_binary() is True
    assert MATCHER_GROUP_TYPE == "struct MatcherGroup(matcher, hooks)"
    assert STATE_VALUE_TYPE == (
        "struct HookStateToml(enabled, trusted_hash, trusted_content_hash)"
    )


def test_event_case() -> None:
    assert EVENT_KEY_CASE == "snake_case"
    assert event_key_is_snake_case("user_prompt_submit") is True
    assert event_key_is_snake_case("pre_tool_use") is True
    assert event_key_is_snake_case("user-prompt-submit") is False
    assert event_key_is_snake_case("UserPromptSubmit") is False


def test_state_key_is_free() -> None:
    assert STATE_KEY_IS_A_FREE_NAME is True


def test_five_acceptances_do_not_mean_execution() -> None:
    assert ACCEPTED_COUNT == 5 == len(ACCEPTED_CONFIGURATIONS)
    assert ACCEPTED_DOES_NOT_MEAN_RAN is True


def test_trust_flag_was_recognised() -> None:
    assert TRUST_FLAG == "--dangerously-bypass-hook-trust"
    assert TRUST_FLAG_RECOGNIZED is True
    assert "Enabled hooks may run" in TRUST_WARNING_TEXT
    assert BYPASS_DOES_NOT_IMPLY_ENABLED is True


def test_nothing_ran() -> None:
    """The headline: shape known, trigger not."""
    assert SHAPE_ESTABLISHED is True
    assert TRIGGER_ESTABLISHED is False
    assert HANDLER_EXECUTED is False
    assert PAYLOAD_CAPTURED is False


def test_reasons_stay_unresolved() -> None:
    assert CANDIDATE_REASON_COUNT == 4 == len(CANDIDATE_REASONS)
    assert REASONS_ARE_UNRESOLVED is True


def test_contract_mapping() -> None:
    c = runtime_contract()
    assert c["layers"] == 5
    assert c["shape_established"] is True
    assert c["trigger_established"] is False
    assert c["handler_executed"] is False
    assert c["agrees_with_binary"] is True


def test_validate_rejects_a_triggering_claim(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(
        "app.core.codex_hook_config_runtime_shape.TRIGGER_ESTABLISHED", True
    )
    with pytest.raises(HookRuntimeShapeError):
        validate_runtime_contract()


def test_validate_rejects_acceptance_as_execution(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(
        "app.core.codex_hook_config_runtime_shape.ACCEPTED_DOES_NOT_MEAN_RAN", False
    )
    with pytest.raises(HookRuntimeShapeError):
        validate_runtime_contract()
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
