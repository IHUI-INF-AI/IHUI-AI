# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""secret_redaction 单测 — 钉住多类型分级脱敏行为。"""

from __future__ import annotations

import pytest

from app.services.secret_redaction import (
    RedactionLevel,
    is_sensitive_header,
    redact_secrets,
    redact_text,
    strip_vt,
)


class TestStripVT:
    def test_strips_csi_and_osc(self) -> None:
        assert strip_vt("\x1b[31mred\x1b[0m") == "red"
        assert strip_vt("\x1b]0;title\x07body") == "body"

    def test_preserves_tab_newline(self) -> None:
        assert strip_vt("a\tb\nc") == "a\tb\nc"

    def test_anti_bypass_splits_token(self) -> None:
        # 攻击者用 VT 拆开敏感词; 剥离后应能正常脱敏
        s = "Bea\x1b[0mrer abc123XYZ"
        red = redact_text(s)
        assert "abc123XYZ" not in red
        assert RedactionLevel.BEARER in red


class TestRedactionLevels:
    def test_bearer_token(self) -> None:
        out = redact_text("Authorization: Bearer eyJhbGciOiJIUzI1NiJ9.abc")
        assert "eyJhbGciOiJIUzI1NiJ9" not in out
        assert RedactionLevel.BEARER in out

    def test_url_redacted(self) -> None:
        out = redact_text("fetch https://api.example.com/v1?key=secret123")
        assert "api.example.com" not in out
        assert "secret123" not in out
        assert RedactionLevel.URL in out

    def test_path_redacted(self) -> None:
        out = redact_text("read /home/user/secrets/token.txt now")
        assert "/home/user/secrets/token.txt" not in out
        assert RedactionLevel.PATH in out

    def test_windows_path_redacted(self) -> None:
        out = redact_text("open C:\\Users\\me\\creds.pem please")
        assert "C:\\Users\\me\\creds.pem" not in out
        assert RedactionLevel.PATH in out

    def test_host_redacted(self) -> None:
        out = redact_text("connect db.internal.corp for data")
        assert "db.internal.corp" not in out
        assert RedactionLevel.HOST in out

    def test_sensitive_keyvalue(self) -> None:
        for key in ("api_key", "secret", "token", "password"):
            out = redact_text(f"{key}=supersecretvalue123")
            assert "supersecretvalue123" not in out
            assert "<redacted>" in out

    def test_opaque_long_token(self) -> None:
        longtok = "A1b2C3d4E5f6G7h8I9j0K1l2M3n4O5p6"  # 32 chars, not url/path/host
        out = redact_text(f"blob {longtok} end")
        assert longtok not in out
        assert RedactionLevel.OPAQUE in out

    def test_non_sensitive_text_untouched(self) -> None:
        s = "hello world this is plain text"
        assert redact_text(s) == s


class TestHeaderRecognition:
    @pytest.mark.parametrize(
        "name",
        [
            "Authorization",
            "authorization",
            "Cookie",
            "Set-Cookie",
            "sig",
            "Signature",
            "AWSAccessKeyId",
            "X-Goog-Signature",
            "x-amz-signature",
            "X_AMZ_SECURITY_TOKEN",
        ],
    )
    def test_sensitive(self, name: str) -> None:
        assert is_sensitive_header(name) is True

    @pytest.mark.parametrize("name", ["Content-Type", "Accept", "User-Agent", "X-Request-Id"])
    def test_not_sensitive(self, name: str) -> None:
        assert is_sensitive_header(name) is False

    def test_empty(self) -> None:
        assert is_sensitive_header("") is False


class TestTruncationAndDeterminism:
    def test_long_output_truncated(self) -> None:
        # 用含空格的真实文本, 避免被 opaque 规则压缩成单个占位符
        out = redact_text("lorem ipsum dolor sit amet " * 400)
        assert out.endswith(" [truncated]")

    def test_deterministic(self) -> None:
        s = "Bearer aaa111 https://h.co/p api_key=zzz999 /etc/pw C:\\a\\b host.name.io"
        assert redact_text(s) == redact_text(s)

    def test_placeholder_has_no_secret_fragment(self) -> None:
        secret = "sk-proj-REALSECRETVALUE000"
        out = redact_text(f"token={secret}")
        assert "REALSECRETVALUE" not in out
        assert "sk-proj" not in out

    def test_empty_input(self) -> None:
        assert redact_text("") == ""
        assert strip_vt("") == ""

    def test_redact_secrets_alias(self) -> None:
        assert redact_secrets("Bearer abcdef123456") == redact_text("Bearer abcdef123456")
