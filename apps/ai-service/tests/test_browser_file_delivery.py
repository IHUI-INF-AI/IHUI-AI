# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""browser_file_delivery 单测 — 钉住下载前置/失败、轮询卫生、截图卫生、禁用编码。"""

from __future__ import annotations

import pytest

from app.services.browser_file_delivery import (
    POLL_TIMEOUT_SECONDS,
    VIOLATIONS,
    check_screenshot_hygiene,
    classify_download,
    is_forbidden_encoding,
    poll_until_settled,
)

# ── 下载判定 ───────────────────────────────────────────────────────────────


def test_download_success_returns_link() -> None:
    d = classify_download(prearmed_wait=True, download_path="/share/a.pdf")
    assert d.outcome == "success"
    assert d.should_return_link is True


def test_download_null_path_fails() -> None:
    d = classify_download(prearmed_wait=True, download_path=None)
    assert d.outcome == "failed_null_path"
    assert d.should_return_link is False


def test_download_empty_path_fails() -> None:
    d = classify_download(prearmed_wait=True, download_path="  ")
    assert d.outcome == "failed_null_path"


def test_download_not_prearmed_rejected() -> None:
    d = classify_download(prearmed_wait=False, download_path="/share/a.pdf")
    assert d.outcome == "not_prearmed"
    assert d.should_return_link is False


def test_download_decision_detail_never_empty() -> None:
    for pw in (True, False):
        for p in ("/share/a.pdf", None):
            assert classify_download(prearmed_wait=pw, download_path=p).detail


# ── 交付轮询 ───────────────────────────────────────────────────────────────


def test_poll_settled_on_nonempty() -> None:
    o = poll_until_settled(matched_file_size=2048, elapsed_seconds=1.0)
    assert o.settled is True
    assert o.should_omit_link is False


def test_poll_zero_size_not_settled() -> None:
    o = poll_until_settled(matched_file_size=0, elapsed_seconds=1.0)
    assert o.settled is False


def test_poll_timeout_omits_link() -> None:
    o = poll_until_settled(matched_file_size=None, elapsed_seconds=5.0)
    assert o.settled is False
    assert o.should_omit_link is True
    assert "省略坏链接" in o.detail


def test_poll_within_timeout_keeps_waiting() -> None:
    o = poll_until_settled(matched_file_size=None, elapsed_seconds=2.0)
    assert o.settled is False
    assert o.should_omit_link is False


def test_poll_default_timeout_is_5s() -> None:
    assert POLL_TIMEOUT_SECONDS == 5.0


# ── 截图交付卫生 ───────────────────────────────────────────────────────────


def test_screenshot_hygiene_compliant() -> None:
    h = check_screenshot_hygiene(
        is_single_shot=True,
        is_jpeg_unique_name=True,
        file_mode=0o600,
        is_emitimage_final_link=False,
        reused_old_link=False,
        encoded_base64=False,
    )
    assert h.ok is True
    assert h.violations == ()


@pytest.mark.parametrize(
    "kwargs,expected",
    [
        ({"is_single_shot": False}, "re_screenshot"),
        ({"is_jpeg_unique_name": False}, "not_single_jpeg"),
        ({"file_mode": 0o644}, "wrong_mode"),
        ({"is_emitimage_final_link": True}, "reused_link"),
        ({"reused_old_link": True}, "reused_link"),
        ({"encoded_base64": True}, "base64_encoded"),
        ({"sync_complete": False}, "re_screenshot"),
    ],
)
def test_screenshot_hygiene_violations(kwargs: dict, expected: str) -> None:
    base: dict = {
        "is_single_shot": True,
        "is_jpeg_unique_name": True,
        "file_mode": 0o600,
        "is_emitimage_final_link": False,
        "reused_old_link": False,
        "encoded_base64": False,
    }
    base.update(kwargs)
    h = check_screenshot_hygiene(**base)
    assert h.ok is False
    assert expected in h.violations


def test_screenshot_violation_set_closed() -> None:
    assert set(VIOLATIONS) == {
        "reused_link",
        "re_screenshot",
        "base64_encoded",
        "not_single_jpeg",
        "wrong_mode",
    }


def test_screenshot_mode_none_is_violation() -> None:
    h = check_screenshot_hygiene(
        is_single_shot=True,
        is_jpeg_unique_name=True,
        file_mode=None,
        is_emitimage_final_link=False,
        reused_old_link=False,
        encoded_base64=False,
    )
    assert "wrong_mode" in h.violations


# ── 禁用编码 ───────────────────────────────────────────────────────────────


@pytest.mark.parametrize("m", ["base64", "data_url", "dataurl", "data-uri"])
def test_forbidden_encoding_true(m: str) -> None:
    assert is_forbidden_encoding(m) is True


@pytest.mark.parametrize("m", ["file", "markdown_link", "direct_path", ""])
def test_forbidden_encoding_false(m: str) -> None:
    assert is_forbidden_encoding(m) is False


if __name__ == "__main__":
    pytest.main([__file__, "-q"])
