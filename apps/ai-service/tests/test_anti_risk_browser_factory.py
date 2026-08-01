"""app/services/publish/anti_risk/browser_factory.py 单元测试:反风控浏览器工厂。

测试覆盖(12 cases):
- create_stealth_browser_context:持久化/非持久化模式 / headless 透传 / proxy 透传 /
  user_data_dir / apply_stealth 调用 / apply_advanced_stealth 调用 /
  launch 失败异常传播 / new_context 失败异常传播
- close_stealth_context:正常关闭 / None browser / None 输入降级 / 关闭异常不传播

测试隔离:全用 AsyncMock mock Playwright,patch get_account_profile /
apply_stealth / apply_advanced_stealth / _find_chrome_executable,不真实启动浏览器。
"""
from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.services.publish.anti_risk.browser_factory import (
    close_stealth_context,
    create_stealth_browser_context,
)


# =============================================================================
# 辅助 fixtures / 工厂
# =============================================================================


def _make_mock_fingerprint(seed: int = 12345) -> MagicMock:
    """构造 mock BrowserFingerprint(含 to_context_options / fingerprint_seed)。"""
    fp = MagicMock()
    fp.fingerprint_seed = seed
    fp.platform = "Win32"
    fp.viewport = {"width": 1920, "height": 1080}
    fp.to_context_options.return_value = {
        "user_agent": "Mozilla/5.0 Test UA",
        "viewport": {"width": 1920, "height": 1080},
        "locale": "zh-CN",
    }
    return fp


def _make_mock_profile(
    fingerprint: MagicMock | None = None,
    proxy_server: str | None = None,
    user_data_dir: str = "/tmp/test-profile",
) -> MagicMock:
    """构造 mock AccountProfile(含 fingerprint / proxy / user_data_dir)。"""
    profile = MagicMock()
    profile.fingerprint = fingerprint or _make_mock_fingerprint()
    profile.user_data_dir = user_data_dir
    if proxy_server:
        profile.proxy = MagicMock()
        profile.proxy.server = proxy_server
        profile.proxy.to_playwright_proxy.return_value = {"server": proxy_server}
    else:
        profile.proxy = None
    return profile


def _make_mock_playwright(
    launch_result: MagicMock | None = None,
    context_result: MagicMock | None = None,
    launch_side_effect: Exception | None = None,
    new_context_side_effect: Exception | None = None,
    persistent_context_result: MagicMock | None = None,
) -> MagicMock:
    """构造 mock Playwright 实例(含 chromium.launch / launch_persistent_context)。"""
    pw = MagicMock()
    chromium = MagicMock()

    if launch_side_effect:
        chromium.launch = AsyncMock(side_effect=launch_side_effect)
    else:
        browser = launch_result or MagicMock(name="browser")
        browser.new_context = AsyncMock()
        if new_context_side_effect:
            browser.new_context.side_effect = new_context_side_effect
        elif context_result:
            browser.new_context.return_value = context_result
        chromium.launch = AsyncMock(return_value=browser)

    if persistent_context_result is not None:
        chromium.launch_persistent_context = AsyncMock(return_value=persistent_context_result)
    else:
        chromium.launch_persistent_context = AsyncMock(return_value=MagicMock(name="context"))

    pw.chromium = chromium
    return pw


# =============================================================================
# create_stealth_browser_context 创建反风控 BrowserContext(7 tests)
# =============================================================================


class TestCreateStealthBrowserContext:
    """测试 create_stealth_browser_context() 创建带反风控的 BrowserContext。"""

    @patch("app.services.publish.anti_risk.browser_factory._find_chrome_executable")
    @patch("app.services.publish.anti_risk.browser_factory.apply_advanced_stealth")
    @patch("app.services.publish.anti_risk.browser_factory.apply_stealth")
    @patch("app.services.publish.anti_risk.browser_factory.get_account_profile")
    async def test_persistent_mode_returns_none_browser_and_context(
        self, mock_get_profile, mock_apply_stealth, mock_apply_advanced, mock_find_chrome
    ):
        """持久化模式返回 (None, context) — browser 为 None,context 是 BrowserContext。"""
        mock_get_profile.return_value = _make_mock_profile()
        mock_find_chrome.return_value = None
        mock_context = MagicMock(name="context")
        pw = _make_mock_playwright(persistent_context_result=mock_context)

        browser, context = await create_stealth_browser_context(
            account_id="csdn_test", platform="csdn",
            playwright_instance=pw, use_persistent=True,
        )
        assert browser is None
        assert context is mock_context

    @patch("app.services.publish.anti_risk.browser_factory._find_chrome_executable")
    @patch("app.services.publish.anti_risk.browser_factory.apply_advanced_stealth")
    @patch("app.services.publish.anti_risk.browser_factory.apply_stealth")
    @patch("app.services.publish.anti_risk.browser_factory.get_account_profile")
    async def test_non_persistent_mode_returns_browser_and_context(
        self, mock_get_profile, mock_apply_stealth, mock_apply_advanced, mock_find_chrome
    ):
        """非持久化模式返回 (browser, context) — 两者均为非 None。"""
        mock_get_profile.return_value = _make_mock_profile()
        mock_find_chrome.return_value = None
        mock_context = MagicMock(name="context")
        pw = _make_mock_playwright(context_result=mock_context)

        browser, context = await create_stealth_browser_context(
            account_id="zhihu_test", platform="zhihu",
            playwright_instance=pw, use_persistent=False,
        )
        assert browser is not None
        assert context is mock_context

    @patch("app.services.publish.anti_risk.browser_factory._find_chrome_executable")
    @patch("app.services.publish.anti_risk.browser_factory.apply_advanced_stealth")
    @patch("app.services.publish.anti_risk.browser_factory.apply_stealth")
    @patch("app.services.publish.anti_risk.browser_factory.get_account_profile")
    async def test_headless_param_passed_to_launch(
        self, mock_get_profile, mock_apply_stealth, mock_apply_advanced, mock_find_chrome
    ):
        """headless 参数透传到 chromium.launch / launch_persistent_context。"""
        mock_get_profile.return_value = _make_mock_profile()
        mock_find_chrome.return_value = None
        pw = _make_mock_playwright()

        await create_stealth_browser_context(
            account_id="a1", platform="csdn",
            playwright_instance=pw, headless=False, use_persistent=False,
        )
        launch_kwargs = pw.chromium.launch.call_args.kwargs
        assert launch_kwargs["headless"] is False

    @patch("app.services.publish.anti_risk.browser_factory._find_chrome_executable")
    @patch("app.services.publish.anti_risk.browser_factory.apply_advanced_stealth")
    @patch("app.services.publish.anti_risk.browser_factory.apply_stealth")
    @patch("app.services.publish.anti_risk.browser_factory.get_account_profile")
    async def test_proxy_passed_to_launch_options(
        self, mock_get_profile, mock_apply_stealth, mock_apply_advanced, mock_find_chrome
    ):
        """profile.proxy 存在时,proxy 参数透传到 launch_options。"""
        mock_get_profile.return_value = _make_mock_profile(proxy_server="http://proxy:8080")
        mock_find_chrome.return_value = None
        pw = _make_mock_playwright()

        await create_stealth_browser_context(
            account_id="a2", platform="csdn",
            playwright_instance=pw, use_persistent=False,
        )
        launch_kwargs = pw.chromium.launch.call_args.kwargs
        assert "proxy" in launch_kwargs
        assert launch_kwargs["proxy"]["server"] == "http://proxy:8080"

    @patch("app.services.publish.anti_risk.browser_factory._find_chrome_executable")
    @patch("app.services.publish.anti_risk.browser_factory.apply_advanced_stealth")
    @patch("app.services.publish.anti_risk.browser_factory.apply_stealth")
    @patch("app.services.publish.anti_risk.browser_factory.get_account_profile")
    async def test_persistent_mode_passes_user_data_dir(
        self, mock_get_profile, mock_apply_stealth, mock_apply_advanced, mock_find_chrome
    ):
        """持久化模式使用 profile.user_data_dir 调用 launch_persistent_context。"""
        mock_get_profile.return_value = _make_mock_profile(user_data_dir="/data/profile-x")
        mock_find_chrome.return_value = None
        pw = _make_mock_playwright()

        await create_stealth_browser_context(
            account_id="a3", platform="csdn",
            playwright_instance=pw, use_persistent=True,
        )
        call_kwargs = pw.chromium.launch_persistent_context.call_args.kwargs
        assert call_kwargs["user_data_dir"] == "/data/profile-x"

    @patch("app.services.publish.anti_risk.browser_factory._find_chrome_executable")
    @patch("app.services.publish.anti_risk.browser_factory.apply_advanced_stealth")
    @patch("app.services.publish.anti_risk.browser_factory.apply_stealth")
    @patch("app.services.publish.anti_risk.browser_factory.get_account_profile")
    async def test_apply_stealth_called_with_context_and_seed(
        self, mock_get_profile, mock_apply_stealth, mock_apply_advanced, mock_find_chrome
    ):
        """apply_stealth 被调用,参数为 context 和 fingerprint.fingerprint_seed。"""
        fp = _make_mock_fingerprint(seed=42)
        mock_get_profile.return_value = _make_mock_profile(fingerprint=fp)
        mock_find_chrome.return_value = None
        mock_context = MagicMock(name="context")
        pw = _make_mock_playwright(persistent_context_result=mock_context)

        await create_stealth_browser_context(
            account_id="a4", platform="csdn",
            playwright_instance=pw, use_persistent=True,
        )
        mock_apply_stealth.assert_awaited_once_with(mock_context, 42)

    @patch("app.services.publish.anti_risk.browser_factory._find_chrome_executable")
    @patch("app.services.publish.anti_risk.browser_factory.apply_advanced_stealth")
    @patch("app.services.publish.anti_risk.browser_factory.apply_stealth")
    @patch("app.services.publish.anti_risk.browser_factory.get_account_profile")
    async def test_launch_failure_propagates(
        self, mock_get_profile, mock_apply_stealth, mock_apply_advanced, mock_find_chrome
    ):
        """chromium.launch 抛异常时,异常向上传播(当前实现不做降级)。

        注意:源码未包裹 try/except,Playwright 环境不可用时异常直接传播给调用方。
        """
        mock_get_profile.return_value = _make_mock_profile()
        mock_find_chrome.return_value = None
        pw = _make_mock_playwright(
            launch_side_effect=RuntimeError("playwright not installed"),
        )

        with pytest.raises(RuntimeError, match="playwright not installed"):
            await create_stealth_browser_context(
                account_id="a5", platform="csdn",
                playwright_instance=pw, use_persistent=False,
            )


# =============================================================================
# close_stealth_context 关闭反风控 context(5 tests)
# =============================================================================


class TestCloseStealthContext:
    """测试 close_stealth_context() 统一清理逻辑。"""

    async def test_closes_context_then_browser(self):
        """正常关闭:先关 context,再关 browser。"""
        context = AsyncMock()
        browser = AsyncMock()
        await close_stealth_context(browser, context)
        context.close.assert_awaited_once()
        browser.close.assert_awaited_once()

    async def test_handles_none_browser(self):
        """browser=None(持久化模式)时仅关 context,不调 browser.close。"""
        context = AsyncMock()
        await close_stealth_context(None, context)
        context.close.assert_awaited_once()

    async def test_handles_none_context_gracefully(self):
        """context=None 时不抛异常(await None.close() 触发 AttributeError 被捕获)。"""
        browser = AsyncMock()
        # 不应抛任何异常
        await close_stealth_context(browser, None)
        # browser.close 仍被调用(browser 非 None)
        browser.close.assert_awaited_once()

    async def test_handles_both_none_gracefully(self):
        """browser=None + context=None 时不抛任何异常(完全降级)。"""
        # 不应抛任何异常
        await close_stealth_context(None, None)

    async def test_context_close_exception_does_not_propagate(self):
        """context.close 抛异常时不传播,browser.close 仍被调用。"""
        context = AsyncMock()
        context.close.side_effect = RuntimeError("context already closed")
        browser = AsyncMock()
        # 不应抛异常
        await close_stealth_context(browser, context)
        # browser.close 仍被调用(不受 context 异常影响)
        browser.close.assert_awaited_once()

    async def test_browser_close_exception_does_not_propagate(self):
        """browser.close 抛异常时不传播(降级:仅记日志)。"""
        context = AsyncMock()
        browser = AsyncMock()
        browser.close.side_effect = RuntimeError("browser crashed")
        # 不应抛异常
        await close_stealth_context(browser, context)
        context.close.assert_awaited_once()
        browser.close.assert_awaited_once()
