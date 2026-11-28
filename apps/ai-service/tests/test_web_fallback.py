# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE).

"""网页版发布兜底 — 只测纯选择逻辑,不启动浏览器、不发真实内容。"""
from __future__ import annotations

from app.services.publish.adapters.toutiao import ToutiaoAdapter
from app.services.publish.base_adapter import PublishContent
from app.services.publish.web_fallback import _plain_text, get_web_fallback


def test_plain_text_strips_html_keeps_paragraphs() -> None:
    content = PublishContent(
        format="md",
        title="t",
        html="<p>第一段</p><p>第二段 <strong>加粗</strong></p>",
    )
    text = _plain_text(content)
    assert "第一段" in text
    assert "第二段" in text
    assert "<p>" not in text
    assert "\n\n" in text


def test_toutiao_with_web_cookie_gets_fallback() -> None:
    adapter = ToutiaoAdapter()
    fallback = get_web_fallback("toutiao", adapter, {"sessionid": "x", "ttwid": "y"})
    assert fallback is not None
    assert fallback.platform_id == "toutiao"
    assert fallback.needs_browser is True


def test_api_credentials_complete_does_not_use_fallback() -> None:
    adapter = ToutiaoAdapter()
    assert get_web_fallback(
        "toutiao", adapter, {"app_id": "a", "app_secret": "b"}
    ) is None


def test_no_cookie_does_not_use_fallback() -> None:
    adapter = ToutiaoAdapter()
    assert get_web_fallback("toutiao", adapter, {"app_id": "a"}) is None


def test_video_platform_gets_douyin_web_publisher() -> None:
    from app.services.publish.douyin_web import DouyinWebAdapter

    fallback = get_web_fallback("douyin", None, {"sessionid": "x"})
    assert isinstance(fallback, DouyinWebAdapter)
    assert fallback.needs_browser is True


def test_video_platform_without_cookie_stays_none() -> None:
    assert get_web_fallback("douyin", None, {"access_token": "t"}) is None
