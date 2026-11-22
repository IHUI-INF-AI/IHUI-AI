# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""browser_auth_scenarios 单测 — 钉住 QR 隔离、数字匹配禁发明、未知结果、前置门。"""

from __future__ import annotations

import pytest

from app.services.browser_auth_scenarios import (
    build_matching_challenge,
    check_auth_preflight,
    classify_auth_outcome_evidence,
    handle_qr_handoff,
)

# ── QR handoff ─────────────────────────────────────────────────────────────


def test_qr_captured_hides_url() -> None:
    """client 捕获 QR,模型不碰目标 URL。"""
    o = handle_qr_handoff(client_captured=True)
    assert o.captured is True
    assert o.show_login_url is False
    assert o.login_url is None


def test_qr_not_captured_no_url() -> None:
    o = handle_qr_handoff(client_captured=False)
    assert o.captured is False
    assert o.login_url is None


def test_qr_native_https_exception_shows_url() -> None:
    o = handle_qr_handoff(
        client_captured=True,
        trusted_native_error_url="https://login.example.com/auth",
    )
    assert o.show_login_url is True
    assert o.login_url == "https://login.example.com/auth"


def test_qr_native_http_not_shown() -> None:
    """非 HTTPS 不满足例外(须已验证 HTTPS)。"""
    o = handle_qr_handoff(
        client_captured=True, trusted_native_error_url="http://login.example.com"
    )
    assert o.show_login_url is False


# ── 数字匹配 ───────────────────────────────────────────────────────────────


def test_number_challenge_reports_nonsecret() -> None:
    c = build_matching_challenge(kind="number", number=37)
    assert c is not None
    assert c.invented_number is False
    assert "37" in c.user_instruction


def test_number_missing_rejected() -> None:
    """无明确数字 → 不发明。"""
    c = build_matching_challenge(kind="number", number=None)
    assert c is not None
    assert c.invented_number is False
    assert c.user_instruction == ""


def test_emoji_challenge_visual_cue() -> None:
    c = build_matching_challenge(kind="emoji", visual_cue="🥶 emoji")
    assert c is not None
    assert c.invented_number is False
    assert "🥶" in c.user_instruction


def test_emoji_missing_visual_cue_rejected() -> None:
    c = build_matching_challenge(kind="emoji", visual_cue=None)
    assert c is not None
    assert c.user_instruction == ""


def test_unknown_kind_returns_none() -> None:
    assert build_matching_challenge(kind="bogus") is None


# ── 未知结果判定 ───────────────────────────────────────────────────────────


@pytest.mark.parametrize(
    "kwargs",
    [
        {"spinner_visible": True},
        {"blank_page": True},
        {"stale_or_missing_tab": True},
        {"timed_out": True},
        {"popup_closed": True},
    ],
)
def test_unknown_evidence(kwargs: dict) -> None:
    d = classify_auth_outcome_evidence(**kwargs)
    assert d.evidence == "unknown"
    assert d.report_success is False
    assert d.report_failure is False


def test_positive_login_reports_success() -> None:
    d = classify_auth_outcome_evidence(fresh_positive_login_signal=True)
    assert d.evidence == "positive_login"
    assert d.report_success is True
    assert d.report_failure is False


def test_site_error_reports_failure() -> None:
    d = classify_auth_outcome_evidence(site_error_visible=True)
    assert d.evidence == "known_failure"
    assert d.report_failure is True
    assert d.report_success is False


def test_no_signal_is_unknown() -> None:
    d = classify_auth_outcome_evidence()
    assert d.evidence == "unknown"
    assert d.report_success is False
    assert d.report_failure is False


# ── 前置门 ─────────────────────────────────────────────────────────────────


def test_preflight_captcha_first() -> None:
    """CAPTCHA 优先判(即便同时有插件)。"""
    o = check_auth_preflight(
        installable_plugin_available=True, is_registration=True, is_captcha=True
    )
    assert o.decision == "not_captcha"
    assert o.proceed_with_browser_auth is False


def test_preflight_registration_blocked() -> None:
    o = check_auth_preflight(installable_plugin_available=True, is_registration=True)
    assert o.decision == "manual_handoff"
    assert o.proceed_with_browser_auth is False


def test_preflight_plugin_preferred() -> None:
    o = check_auth_preflight(installable_plugin_available=True)
    assert o.decision == "use_plugin"
    assert o.proceed_with_browser_auth is False


def test_preflight_proceed() -> None:
    o = check_auth_preflight(installable_plugin_available=False)
    assert o.decision == "proceed"
    assert o.proceed_with_browser_auth is True


def test_all_decisions_detail_nonempty() -> None:
    assert handle_qr_handoff(client_captured=True).detail
    assert build_matching_challenge(kind="number", number=1).detail
    assert classify_auth_outcome_evidence().detail
    assert check_auth_preflight(installable_plugin_available=False).detail


if __name__ == "__main__":
    pytest.main([__file__, "-q"])
