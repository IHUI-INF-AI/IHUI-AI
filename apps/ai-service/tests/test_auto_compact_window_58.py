# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
from app.core.auto_compact_window import (
    AutoCompactWindow,
    AutoCompactWindowIds,
)


def test_initial_ids() -> None:
    ids = AutoCompactWindowIds.new_initial()
    assert ids.first_window_id == ids.window_id
    assert ids.previous_window_id is None


def test_new_window_number_zero() -> None:
    w = AutoCompactWindow.new_with_ids(AutoCompactWindowIds.new_initial())
    assert w.window_number == 0


def test_restore_keeps_ids() -> None:
    w = AutoCompactWindow.new_with_ids(AutoCompactWindowIds.new_initial())
    first = w.ids.first_window_id
    restored = AutoCompactWindowIds(
        first_window_id=first, previous_window_id="p", window_id="cur"
    )
    w.restore(3, restored)
    assert w.window_number == 3
    assert w.ids.window_id == "cur"


def test_claim_reminder_once() -> None:
    w = AutoCompactWindow()
    assert w.claim_token_budget_reminder() is True
    assert w.claim_token_budget_reminder() is False


def test_claim_fallback_once() -> None:
    w = AutoCompactWindow()
    assert w.claim_auto_compact_fallback() is True
    assert w.claim_auto_compact_fallback() is False


def test_new_context_request_take_once() -> None:
    w = AutoCompactWindow()
    w.request_new_context_window()
    assert w.take_new_context_window_request() is True
    assert w.take_new_context_window_request() is False


def test_advance_resets_flags_and_advances_ids() -> None:
    w = AutoCompactWindow.new_with_ids(AutoCompactWindowIds.new_initial())
    first = w.ids.first_window_id
    cur = w.ids.window_id
    w.claim_token_budget_reminder()
    w.claim_auto_compact_fallback()
    w.request_new_context_window()
    number, ids = w.advance()
    assert number == 1
    assert ids.first_window_id == first
    assert ids.previous_window_id == cur
    assert ids.window_id != cur
    assert w.take_new_context_window_request() is False
    assert w.claim_token_budget_reminder() is True
    assert w.claim_auto_compact_fallback() is True


def test_estimated_prefill_then_server_observed_wins() -> None:
    w = AutoCompactWindow()
    w.set_estimated_prefill(150)
    assert w.snapshot().prefill_input_tokens == 150
    w.ensure_server_observed_prefill_from_usage(120)
    assert w.snapshot().prefill_input_tokens == 120


def test_server_observed_is_sticky() -> None:
    w = AutoCompactWindow()
    w.ensure_server_observed_prefill_from_usage(120)
    w.ensure_server_observed_prefill_from_usage(130)
    w.set_estimated_prefill(90)
    assert w.snapshot().prefill_input_tokens == 120


def test_negative_tokens_clamped() -> None:
    w = AutoCompactWindow()
    w.ensure_server_observed_prefill_from_usage(-5)
    assert w.snapshot().prefill_input_tokens == 0
    w.clear_prefill()
    w.set_estimated_prefill(-3)
    assert w.snapshot().prefill_input_tokens == 0


def test_snapshot_empty() -> None:
    w = AutoCompactWindow()
    assert w.snapshot().prefill_input_tokens is None
