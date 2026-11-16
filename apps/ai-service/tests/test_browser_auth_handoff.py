# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""browser_auth_handoff 单测 — 钉住凭据零回传、状态机处置、请求消毒、跨域拒绝。"""

from __future__ import annotations

import dataclasses

import pytest

from app.services.browser_auth_handoff import (
    CROSS_ORIGIN_REASONS,
    NEVER_FALLBACK_TO_CHAT,
    REJECTION_REASONS,
    STATUSES,
    AuthResult,
    handle_auth_result,
    normalize_origin,
    sanitize_auth_request,
)

# ── 状态机 ─────────────────────────────────────────────────────────────────


def test_status_set_matches_codex() -> None:
    assert len(STATUSES) == 10
    for s in (
        "submitted",
        "locator_invalid",
        "page_changed",
        "origin_changed",
        "expired",
        "declined_user_took_over",
        "declined",
        "cancelled",
        "unavailable",
        "submission_failed",
    ):
        assert s in STATUSES


def test_unavailable_never_fallback() -> None:
    r = handle_auth_result("unavailable")
    assert r.never_fallback_to_chat is True
    assert "绝不 fallback" in r.detail or "不 fallback" in r.detail


def test_submission_failed_never_fallback() -> None:
    r = handle_auth_result("submission_failed")
    assert r.never_fallback_to_chat is True


def test_submitted_not_proof_of_success() -> None:
    r = handle_auth_result("submitted")
    assert r.never_fallback_to_chat is False
    assert "不证明登录成功" in r.detail


def test_unknown_status_handled() -> None:
    r = handle_auth_result("bogus_status")
    assert r.status == "unknown"
    assert "不假设成功" in r.detail


def test_cross_origin_rejection_flag() -> None:
    r = handle_auth_result("locator_invalid", rejection_reason="iframe_origin")
    assert r.is_cross_origin_rejection is True
    assert r.rejection_reason == "iframe_origin"


def test_cross_origin_reasons_present() -> None:
    assert {
        "paused_iframe",
        "iframe_origin",
        "child_frame_origin",
    } <= CROSS_ORIGIN_REASONS


def test_invalid_rejection_reason_ignored() -> None:
    r = handle_auth_result("submitted", rejection_reason="nonsense")
    assert r.rejection_reason is None


# ── 凭据零回传(核心不变量) ─────────────────────────────────────────────────


def test_auth_result_has_no_credential_field() -> None:
    """AuthResult 结构永不含凭据值字段。"""
    r = handle_auth_result("submitted")
    d = r.to_dict()
    for forbidden in ("credential", "password", "token", "secret", "value", "cookie"):
        assert forbidden not in d, forbidden


# ── origin 归一 ────────────────────────────────────────────────────────────


def test_normalize_origin_strips_path_query() -> None:
    o = normalize_origin("https://login.example.com:8443/auth?next=/admin#frag")
    assert o == "https://login.example.com:8443"


def test_normalize_origin_default_port_omitted() -> None:
    o = normalize_origin("https://login.example.com/auth")
    assert o == "https://login.example.com"


def test_normalize_origin_lowercases() -> None:
    o = normalize_origin("HTTPS://Login.Example.COM/auth")
    assert o == "https://login.example.com"


def test_normalize_origin_bad_input() -> None:
    assert normalize_origin("") is None
    assert normalize_origin("not a url ::::") is None


# ── 请求消毒 ───────────────────────────────────────────────────────────────


def test_sanitize_valid_request() -> None:
    req = {
        "origin": "https://login.example.com/auth",
        "fields": [
            {"id": "u", "label": "Email", "type": "email", "selector": "#email"},
            {"id": "p", "label": "Password", "type": "password", "selector": "#pw"},
        ],
        "submit": {"selector": "#submit", "action": "click"},
    }
    out = sanitize_auth_request(req)
    assert out.ok is True
    assert out.origin == "https://login.example.com"


def test_sanitize_rejects_secret_key() -> None:
    req = {
        "origin": "https://login.example.com",
        "fields": [{"id": "u", "selector": "#u"}],
        "secret": "hunter2",
    }
    out = sanitize_auth_request(req)
    assert out.ok is False
    assert "secret" in out.dropped_keys


def test_sanitize_rejects_cookie_key() -> None:
    req = {
        "origin": "https://login.example.com",
        "fields": [{"id": "u", "selector": "#u"}],
        "cookie": "session=abc",
    }
    out = sanitize_auth_request(req)
    assert out.ok is False


def test_sanitize_rejects_missing_origin() -> None:
    req = {"fields": [{"id": "u", "selector": "#u"}]}
    out = sanitize_auth_request(req)
    assert out.ok is False


def test_sanitize_qr_code_ok() -> None:
    req = {"origin": "https://login.example.com", "qr_code": True}
    out = sanitize_auth_request(req)
    assert out.ok is True


def test_sanitize_rejects_non_dict() -> None:
    out = sanitize_auth_request("not a dict")  # type: ignore[arg-type]
    assert out.ok is False


def test_sanitize_rejects_empty_fields_and_no_qr() -> None:
    req = {"origin": "https://login.example.com", "fields": []}
    out = sanitize_auth_request(req)
    assert out.ok is False


def test_sanitize_fields_forbidden_key_flagged() -> None:
    req = {
        "origin": "https://login.example.com",
        "fields": [{"id": "u", "selector": "#u", "value": "secretval"}],
    }
    out = sanitize_auth_request(req)
    assert any("value" in k for k in out.dropped_keys)


def test_never_fallback_set_matches_codex() -> None:
    assert {"unavailable", "submission_failed"} == NEVER_FALLBACK_TO_CHAT


def test_rejection_reasons_closed_set() -> None:
    assert set(REJECTION_REASONS) >= {
        "request_url_invalid",
        "request_scheme",
        "request_origin",
        "paused_iframe",
        "iframe_origin",
        "child_frame_origin",
    }


def test_auth_result_to_dict_shape() -> None:
    r = handle_auth_result("submitted")
    d = r.to_dict()
    assert set(d.keys()) == {
        "status",
        "detail",
        "rejection_reason",
        "is_cross_origin_rejection",
        "never_fallback_to_chat",
    }


def test_auth_result_is_immutable() -> None:
    r = handle_auth_result("submitted")
    with pytest.raises(dataclasses.FrozenInstanceError):
        r.status = "changed"  # type: ignore[misc]


def test_authresult_is_dataclass() -> None:
    r = AuthResult(status="submitted", detail="x")
    assert r.status == "submitted"
    assert r.rejection_reason is None


if __name__ == "__main__":
    pytest.main([__file__, "-q"])
