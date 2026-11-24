# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""browser_management_guard 单测 — 钉住 management.md Safety Rules 四条护栏。"""

from __future__ import annotations

import pytest

from app.services.browser_management_guard import (
    check_request_scope,
    check_tab_move_allowed,
    guard_denied_method,
    validate_bookmark_url,
)

# ── validate_bookmark_url ──────────────────────────────────────────────────


class TestBookmarkUrl:
    def test_https_ok(self):
        d = validate_bookmark_url("https://example.com/page")
        assert d.status == "ok"
        assert d.allowed is True
        assert d.scheme == "https"

    def test_http_ok(self):
        d = validate_bookmark_url("http://example.com")
        assert d.status == "ok"
        assert d.allowed is True

    def test_ftp_forbidden(self):
        d = validate_bookmark_url("ftp://files.example.com")
        assert d.status == "forbidden_scheme"
        assert d.allowed is False
        assert d.scheme == "ftp"

    def test_javascript_forbidden(self):
        d = validate_bookmark_url("javascript:alert(1)")
        assert d.status == "forbidden_scheme"
        assert d.allowed is False

    def test_data_forbidden(self):
        d = validate_bookmark_url("data:text/html,<script>alert(1)</script>")
        assert d.status == "forbidden_scheme"
        assert d.allowed is False

    def test_empty_malformed(self):
        d = validate_bookmark_url("")
        assert d.status == "malformed"
        assert d.allowed is False

    def test_no_scheme_malformed(self):
        d = validate_bookmark_url("example.com")
        assert d.status == "malformed"
        assert d.allowed is False


# ── check_tab_move_allowed ─────────────────────────────────────────────────


class TestTabMoveAllowed:
    def test_shared_group_blocked(self):
        d = check_tab_move_allowed(target_window_has_shared_group=True)
        assert d.allowed is False
        assert d.shared_group_in_window is True

    def test_no_shared_group_ok(self):
        d = check_tab_move_allowed(target_window_has_shared_group=False)
        assert d.allowed is True
        assert d.shared_group_in_window is False


# ── guard_denied_method ────────────────────────────────────────────────────


class TestDeniedMethod:
    def test_respect_denial(self):
        d = guard_denied_method(attempting_workaround=False)
        assert d.path == "respect_denial"
        assert d.allowed is True

    def test_workaround_blocked(self):
        d = guard_denied_method(attempting_workaround=True)
        assert d.path == "workaround"
        assert d.allowed is False
        assert "绕过" in d.detail


# ── check_request_scope ────────────────────────────────────────────────────


class TestRequestScope:
    def test_in_scope(self):
        d = check_request_scope(user_requested=True)
        assert d.scope == "in_scope"
        assert d.allowed is True

    def test_out_of_scope(self):
        d = check_request_scope(user_requested=False)
        assert d.scope == "out_of_scope"
        assert d.allowed is False
        assert "只做点名" in d.detail


if __name__ == "__main__":
    pytest.main([__file__, "-q"])
