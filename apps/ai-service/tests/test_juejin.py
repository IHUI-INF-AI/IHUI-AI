"""juejin.py 适配器单元测试。

掘金 适配器:基于 Playwright 浏览器自动化。

测试覆盖:
- 类属性:platform_id / platform_name / supported_formats / requires_credentials / needs_browser=True
- _cookies:映射 sessionid/signatureId 到 3 个 cookie(sessionid / sessionid_ss / sid_guard)
- verify_credentials:无 Playwright / 缺 sessionid / Playwright 异常 / 成功 / cookie 过期
- publish:无 Playwright / 缺 sessionid / 缺 content text
- publish 流程:Playwright 异常返回失败结果
"""

from __future__ import annotations

from typing import Any
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.services.publish.adapters import juejin
from app.services.publish.adapters.juejin import JuejinAdapter
from app.services.publish.base_adapter import PublishContent, PublishResult


# =============================================================================
# 类属性
# =============================================================================


def test_class_attributes():
    """类属性固定值。"""
    assert JuejinAdapter.platform_id == "juejin"
    assert JuejinAdapter.platform_name == "掘金"
    assert JuejinAdapter.supported_formats == ["md", "html"]
    assert JuejinAdapter.requires_credentials == ["sessionid", "signatureId"]
    assert JuejinAdapter.needs_browser is True


# =============================================================================
# _cookies
# =============================================================================


def test_cookies_returns_three_entries():
    """_cookies 返回 3 个 cookie(sessionid / sessionid_ss / sid_guard)。"""
    a = JuejinAdapter()
    cookies = a._cookies({"sessionid": "s1", "signatureId": "sig1"})
    assert len(cookies) == 3
    names = {c["name"] for c in cookies}
    assert names == {"sessionid", "sessionid_ss", "sid_guard"}


def test_cookies_sessionid_copied_to_sessionid_ss():
    """sessionid 复制到 sessionid_ss。"""
    a = JuejinAdapter()
    cookies = a._cookies({"sessionid": "abc", "signatureId": "sig"})
    sessionid = next(c for c in cookies if c["name"] == "sessionid")
    sessionid_ss = next(c for c in cookies if c["name"] == "sessionid_ss")
    assert sessionid["value"] == "abc"
    assert sessionid_ss["value"] == "abc"


def test_cookies_sid_guard_uses_signature_id():
    """sid_guard cookie 用 signatureId。"""
    a = JuejinAdapter()
    cookies = a._cookies({"sessionid": "s", "signatureId": "my-signature"})
    sid_guard = next(c for c in cookies if c["name"] == "sid_guard")
    assert sid_guard["value"] == "my-signature"


def test_cookies_all_domain_juejin_cn():
    """所有 cookie domain=.juejin.cn。"""
    a = JuejinAdapter()
    cookies = a._cookies({"sessionid": "s", "signatureId": "x"})
    for c in cookies:
        assert c["domain"] == ".juejin.cn"
        assert c["path"] == "/"


def test_cookies_missing_fields_default_empty():
    """缺字段时 value 为空字符串。"""
    a = JuejinAdapter()
    cookies = a._cookies({})
    for c in cookies:
        assert c["value"] == ""


# =============================================================================
# verify_credentials
# =============================================================================


async def test_verify_credentials_no_playwright():
    """未安装 Playwright → (False, 'Playwright not installed')。"""
    a = JuejinAdapter()
    with patch.object(juejin, "_HAS_PLAYWRIGHT", False):
        ok, msg = await a.verify_credentials({"sessionid": "x"})
    assert ok is False
    assert "Playwright not installed" in msg


async def test_verify_credentials_missing_sessionid():
    """缺 sessionid → (False, 'missing sessionid cookie')。"""
    a = JuejinAdapter()
    with patch.object(juejin, "_HAS_PLAYWRIGHT", True):
        ok, msg = await a.verify_credentials({"sessionid": ""})
    assert ok is False
    assert "sessionid" in msg


async def test_verify_credentials_playwright_exception():
    """Playwright 异常 → (False, 'verify failed: ...')。"""
    a = JuejinAdapter()

    fake_playwright = MagicMock()
    fake_playwright.return_value.__aenter__ = AsyncMock(side_effect=RuntimeError("no browser"))

    with patch.object(juejin, "_HAS_PLAYWRIGHT", True):
        with patch.object(juejin, "async_playwright", fake_playwright, create=True):
            ok, msg = await a.verify_credentials({"sessionid": "s"})

    assert ok is False
    assert "verify failed" in msg


async def test_verify_credentials_success_no_login_button():
    """页面无 '登录' 按钮 → (True, 'connected (sessionid valid)')。"""
    a = JuejinAdapter()

    fake_page = MagicMock()
    fake_page.content = AsyncMock(return_value="<html>welcome avatar</html>")
    fake_page.goto = AsyncMock()

    fake_context = MagicMock()
    fake_context.new_page = AsyncMock(return_value=fake_page)
    fake_context.add_cookies = AsyncMock()

    fake_browser = MagicMock()
    fake_browser.new_context = AsyncMock(return_value=fake_context)
    fake_browser.close = AsyncMock()

    fake_chromium = MagicMock()
    fake_chromium.launch = AsyncMock(return_value=fake_browser)

    fake_p = MagicMock()
    fake_p.chromium = fake_chromium

    fake_playwright_ctx = MagicMock()
    fake_playwright_ctx.__aenter__ = AsyncMock(return_value=fake_p)
    fake_playwright_ctx.__aexit__ = AsyncMock(return_value=None)

    with patch.object(juejin, "_HAS_PLAYWRIGHT", True):
        with patch.object(juejin, "async_playwright", return_value=fake_playwright_ctx, create=True):
            ok, msg = await a.verify_credentials({"sessionid": "valid"})

    assert ok is True
    assert "connected" in msg


async def test_verify_credentials_cookie_expired():
    """页面有 '登录' 按钮且无 avatar → (False, 'cookie expired')。"""
    a = JuejinAdapter()

    fake_page = MagicMock()
    fake_page.content = AsyncMock(
        return_value='<html>登录<button class="login">login</button></html>'
    )
    fake_page.goto = AsyncMock()

    fake_context = MagicMock()
    fake_context.new_page = AsyncMock(return_value=fake_page)
    fake_context.add_cookies = AsyncMock()

    fake_browser = MagicMock()
    fake_browser.new_context = AsyncMock(return_value=fake_context)
    fake_browser.close = AsyncMock()

    fake_chromium = MagicMock()
    fake_chromium.launch = AsyncMock(return_value=fake_browser)

    fake_p = MagicMock()
    fake_p.chromium = fake_chromium

    fake_playwright_ctx = MagicMock()
    fake_playwright_ctx.__aenter__ = AsyncMock(return_value=fake_p)
    fake_playwright_ctx.__aexit__ = AsyncMock(return_value=None)

    with patch.object(juejin, "_HAS_PLAYWRIGHT", True):
        with patch.object(juejin, "async_playwright", return_value=fake_playwright_ctx, create=True):
            ok, msg = await a.verify_credentials({"sessionid": "expired"})

    assert ok is False
    assert "cookie expired" in msg


# =============================================================================
# publish 输入校验
# =============================================================================


async def test_publish_no_playwright():
    """无 Playwright → PublishResult(success=False)。"""
    a = JuejinAdapter()
    with patch.object(juejin, "_HAS_PLAYWRIGHT", False):
        result = await a.publish(
            PublishContent(format="md", title="t", text="hello"),
            {"sessionid": "x"},
            {},
        )
    assert result.success is False
    assert "Playwright not installed" in result.error_message


async def test_publish_missing_sessionid():
    """缺 sessionid → 失败。"""
    a = JuejinAdapter()
    with patch.object(juejin, "_HAS_PLAYWRIGHT", True):
        result = await a.publish(
            PublishContent(format="md", title="t", text="hello"),
            {"sessionid": ""},
            {},
        )
    assert result.success is False
    assert "sessionid" in result.error_message


async def test_publish_missing_content_text():
    """缺 text 与 html → 失败。"""
    a = JuejinAdapter()
    with patch.object(juejin, "_HAS_PLAYWRIGHT", True):
        result = await a.publish(
            PublishContent(format="md", title="t"),  # 无 text 无 html
            {"sessionid": "x"},
            {},
        )
    assert result.success is False
    assert "missing content text" in result.error_message


async def test_publish_html_fallback_to_text():
    """仅有 html 时,html 被转为 text(<p>/<br> 替换)。"""
    a = JuejinAdapter()

    # 验证逻辑:html 被处理后作为 md_text 进入 Playwright 流程(后续会因 Playwright 异常失败)
    fake_playwright_ctx = MagicMock()
    fake_playwright_ctx.__aenter__ = AsyncMock(side_effect=RuntimeError("browser unavailable"))
    fake_playwright_ctx.__aexit__ = AsyncMock(return_value=None)

    with patch.object(juejin, "_HAS_PLAYWRIGHT", True):
        with patch.object(juejin, "async_playwright", return_value=fake_playwright_ctx, create=True):
            result = await a.publish(
                PublishContent(format="html", title="t", html="<p>hello</p><p>world</p>"),
                {"sessionid": "x"},
                {},
            )

    # Playwright 异常 → 失败但 error_message 含 'publish failed'
    assert result.success is False
    assert "publish failed" in result.error_message


# =============================================================================
# publish 流程异常
# =============================================================================


async def test_publish_playwright_exception_returns_failure_result():
    """Playwright 抛异常时返回 PublishResult(success=False)。"""
    a = JuejinAdapter()

    fake_playwright_ctx = MagicMock()
    fake_playwright_ctx.__aenter__ = AsyncMock(side_effect=RuntimeError("browser launch failed"))
    fake_playwright_ctx.__aexit__ = AsyncMock(return_value=None)

    with patch.object(juejin, "_HAS_PLAYWRIGHT", True):
        with patch.object(juejin, "async_playwright", return_value=fake_playwright_ctx, create=True):
            result = await a.publish(
                PublishContent(format="md", title="t", text="hello"),
                {"sessionid": "x"},
                {},
            )

    assert isinstance(result, PublishResult)
    assert result.success is False
    assert result.platform == "juejin"
    assert "publish failed" in result.error_message
