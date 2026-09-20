# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
from app.core.token_budget_config import (
    AUTO_COMPACT_FALLBACK_PROMPT_MAX_BYTES,
    TOKEN_BUDGET_GUIDANCE_MESSAGE_MAX_BYTES,
    TOKEN_BUDGET_REMINDER_MESSAGE_TEMPLATE_MAX_BYTES,
    TokenBudgetConfig,
    TokenBudgetConfigError,
    has_explicit_settings,
    resolve_token_budget,
)


def test_constants() -> None:
    assert TOKEN_BUDGET_REMINDER_MESSAGE_TEMPLATE_MAX_BYTES == 2000
    assert TOKEN_BUDGET_GUIDANCE_MESSAGE_MAX_BYTES == 2000
    assert AUTO_COMPACT_FALLBACK_PROMPT_MAX_BYTES == 2000


def _valid(**overrides: object) -> TokenBudgetConfig:
    base: dict[str, object] = {
        "reminder_message_template": "{n_remaining} tokens left",
    }
    base.update(overrides)
    return TokenBudgetConfig(**base)  # type: ignore[arg-type]


def test_validate_ok() -> None:
    _valid().validate()


def test_validate_threshold_must_be_positive() -> None:
    try:
        _valid(reminder_threshold_tokens=0).validate()
        raise AssertionError("expected error")
    except TokenBudgetConfigError as e:
        assert "reminder_threshold_tokens must be positive" in str(e)


def test_validate_template_empty() -> None:
    try:
        TokenBudgetConfig(reminder_message_template="  ").validate()
        raise AssertionError("expected error")
    except TokenBudgetConfigError as e:
        assert "must not be empty" in str(e)


def test_validate_template_too_large() -> None:
    try:
        _valid(reminder_message_template="x" * 2001).validate()
        raise AssertionError("expected error")
    except TokenBudgetConfigError as e:
        assert "2000 bytes" in str(e)


def test_validate_guidance_too_large() -> None:
    try:
        _valid(guidance_message="x" * 2001).validate()
        raise AssertionError("expected error")
    except TokenBudgetConfigError as e:
        assert "guidance_message must not exceed 2000 bytes" in str(e)


def test_validate_fallback_prompt_too_large() -> None:
    try:
        _valid(auto_compact_fallback_prompt="x" * 2001, auto_compact_fallback_buffer_tokens=100).validate()
        raise AssertionError("expected error")
    except TokenBudgetConfigError as e:
        assert "auto_compact_fallback_prompt must not exceed 2000 bytes" in str(e)


def test_validate_buffer_required_with_prompt() -> None:
    try:
        _valid(auto_compact_fallback_prompt="prompt").validate()
        raise AssertionError("expected error")
    except TokenBudgetConfigError as e:
        assert "is required when auto_compact_fallback_prompt is set" in str(e)


def test_validate_buffer_must_be_positive() -> None:
    try:
        _valid(auto_compact_fallback_prompt="p", auto_compact_fallback_buffer_tokens=0).validate()
        raise AssertionError("expected error")
    except TokenBudgetConfigError as e:
        assert "must be positive" in str(e)


def test_fallback_buffer_tokens() -> None:
    assert _valid().fallback_buffer_tokens() is None
    assert _valid(auto_compact_fallback_prompt="p", auto_compact_fallback_buffer_tokens=500).fallback_buffer_tokens() == 500


def test_has_explicit_settings_none() -> None:
    assert has_explicit_settings(None) is False


def test_has_explicit_settings_default_only() -> None:
    cfg = TokenBudgetConfig(reminder_message_template="")
    assert has_explicit_settings(cfg) is False


def test_has_explicit_settings_explicit() -> None:
    assert has_explicit_settings(_valid(reminder_threshold_tokens=500)) is True


def test_resolve_no_model_defaults() -> None:
    cfg = _valid()
    assert resolve_token_budget(cfg, True, None) is cfg


def test_resolve_disabled() -> None:
    cfg = _valid()
    assert resolve_token_budget(cfg, False, {"reminder_threshold_tokens": 1}) is cfg


def test_resolve_merges_model_defaults() -> None:
    merged = resolve_token_budget(
        _valid(),
        True,
        {
            "reminder_threshold_tokens": 1000,
            "reminder_message_template": "model template {n_remaining}",
            "guidance_message": "be concise",
            "auto_compact_fallback_prompt": "compact now",
            "auto_compact_fallback_buffer_tokens": 200,
        },
    )
    assert merged is not None
    assert merged.reminder_threshold_tokens == 1000
    assert merged.reminder_message_template == "model template {n_remaining}"
    assert merged.guidance_message == "be concise"
    assert merged.auto_compact_fallback_prompt == "compact now"
    assert merged.auto_compact_fallback_buffer_tokens == 200
    assert merged.use_history_notes_extension is False


def test_resolve_preserves_extension_flag() -> None:
    merged = resolve_token_budget(
        _valid(use_history_notes_extension=True),
        True,
        {"reminder_threshold_tokens": 10, "reminder_message_template": "t"},
    )
    assert merged is not None and merged.use_history_notes_extension is True


def test_resolve_invalid_model_defaults_falls_back() -> None:
    cfg = _valid()
    merged = resolve_token_budget(
        cfg,
        True,
        {"reminder_threshold_tokens": -5, "reminder_message_template": "bad"},
    )
    assert merged is cfg


def test_resolve_empty_template_invalid_falls_back() -> None:
    cfg = _valid()
    merged = resolve_token_budget(cfg, True, {"reminder_message_template": "   "})
    assert merged is cfg
