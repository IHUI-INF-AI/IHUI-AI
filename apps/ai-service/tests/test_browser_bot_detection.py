# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""browser_bot_detection 单测 — 钉住 7 类封闭集、排除项防误报、hostname-only 隐私。"""

from __future__ import annotations

import re

import pytest

from app.services.browser_bot_detection import (
    NON_BOT_CAUSES,
    REASONS,
    NonBotCause,
    build_report,
    classify_bot_detection,
    extract_hostname,
)

# Codex 7 类 reason,逐项对齐
_CODEX_SEVEN = {
    "captcha_failed",
    "access_denied",
    "challenge_loop",
    "sign_in_blocked",
    "add_to_cart_blocked",
    "purchase_blocked",
    "unexpected_bot_error",
}


def test_reason_set_matches_codex_exactly() -> None:
    assert set(REASONS) == _CODEX_SEVEN
    assert len(REASONS) == 7


def test_non_bot_causes_present() -> None:
    # 裸状态码 / egress / dns / tls / timeout 五类排除项齐备
    assert set(NON_BOT_CAUSES) >= {
        "bare_http_status",
        "proxy_egress_denied",
        "dns_failure",
        "tls_error",
        "timeout",
    }


def test_transport_error_classified_non_bot() -> None:
    # 传输层错误恒判非反爬(防误报,Codex §4.4)
    for cause in ("proxy_egress_denied", "dns_failure", "tls_error", "timeout"):
        d = classify_bot_detection(reason="captcha_failed", transport_error=cause)
        assert d.is_bot_detection is False
        assert d.non_bot_cause == cause
    # 未知传输错误回落 timeout
    d = classify_bot_detection(reason="captcha_failed", transport_error="weird")
    assert d.non_bot_cause == NonBotCause.TIMEOUT


def test_bare_http_status_classified_non_bot() -> None:
    # 裸 HTTP 状态码不当 bot detection(Codex:Do not use for a bare HTTP status code)
    d = classify_bot_detection(reason="access_denied", http_status=403)
    assert d.is_bot_detection is False
    assert d.non_bot_cause == NonBotCause.BARE_HTTP_STATUS


def test_valid_reason_with_evidence_is_bot_detection() -> None:
    d = classify_bot_detection(
        reason="captcha_failed",
        visible_evidence="CAPTCHA challenge visible, solve failed",
    )
    assert d.is_bot_detection is True
    assert d.reason == "captcha_failed"


def test_reason_without_evidence_rejected() -> None:
    # 有 reason 但无可见证据 → 不归类(防误报)
    d = classify_bot_detection(reason="challenge_loop", visible_evidence="")
    assert d.is_bot_detection is False
    assert d.reason is None


def test_unknown_reason_insufficient() -> None:
    d = classify_bot_detection(reason="some_unknown", visible_evidence="blocked page")
    assert d.is_bot_detection is False
    assert d.reason is None


def test_extract_hostname_drops_query_and_path() -> None:
    # 隐私核心:只留 hostname,丢 scheme/port/path/query/fragment
    h, status = extract_hostname(
        "https://user:pw@shop.example.com:8443/cart?token=SECRET&q=ssn#frag"
    )
    assert status == "ok"
    assert h == "shop.example.com"
    assert "SECRET" not in (h or "")
    assert "token" not in (h or "")


def test_extract_hostname_failure_returns_none() -> None:
    for bad in ("", "   ", "not a url"):
        h, status = extract_hostname(bad)
        assert h is None
        assert status != "ok"


def test_build_report_never_stores_full_url() -> None:
    url = "https://api.example.com/checkout?card=4111111111111111"
    report, status = build_report(
        url=url,
        reason="purchase_blocked",
        visible_evidence="payment blocked by risk control",
    )
    assert status == "ok"
    assert report is not None
    assert report.hostname == "api.example.com"
    blob = report.to_dict()
    # URL 的敏感 query(全卡号)永不进记录;path(/checkout)不进 hostname
    assert "4111111111111111" not in str(blob)
    assert report.hostname == "api.example.com"  # 不含 /checkout 路径
    assert "/checkout" not in str(blob)
    assert report.reason == "purchase_blocked"


def test_build_report_failure_no_url_fallback() -> None:
    # URL 解析失败不回落全 URL
    report, status = build_report(
        url="bad url", reason="access_denied", visible_evidence="x"
    )
    assert report is None
    assert status.startswith("无法构造上报")


def test_reason_literals_no_whitespace() -> None:
    # 防回归:reason/cause 字面量不得含空格(封闭枚举干净)
    for r in list(REASONS) + list(NON_BOT_CAUSES):
        assert re.search(r"\s", r) is None, r


if __name__ == "__main__":
    pytest.main([__file__, "-q"])
