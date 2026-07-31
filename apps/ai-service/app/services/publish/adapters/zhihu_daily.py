"""知乎日报 适配器(基于 Playwright + 反风控五层防线)。

知乎日报是知乎旗下精选内容平台,与知乎主站共用 z_c0/d_c0 凭证。

凭证:{ z_c0, d_c0 } — 均为 .zhihu.com 域 cookie

实现:
- verify_credentials: 打开 https://daily.zhihu.com 检查登录态
- publish: 打开 https://daily.zhihu.com/contribute → 人类化填标题/正文 → 点投稿

反风控接入(强制):
- create_stealth_browser_context 替代裸 chromium.launch(每账号固定指纹+代理)
- human_type / human_click / human_pause / simulate_reading 人类化操作
- try/finally + close_stealth_context 统一清理
"""
from __future__ import annotations

import hashlib
from typing import TYPE_CHECKING, Any

from app.core.logging import get_logger
from ..anti_risk import (
    create_stealth_browser_context,
    human_click,
    human_pause,
    human_type,
    simulate_reading,
)
from ..anti_risk.browser_factory import close_stealth_context
from ..base_adapter import BasePlatformAdapter, PublishContent, PublishResult

logger = get_logger(__name__)

try:
    from playwright.async_api import async_playwright

    _HAS_PLAYWRIGHT = True
except ImportError:
    _HAS_PLAYWRIGHT = False

if TYPE_CHECKING:
    from playwright._impl._api_structures import SetCookieParam


_HOME_URL = "https://daily.zhihu.com"
_CREATE_URL = "https://daily.zhihu.com/contribute"
_TITLE_SELECTOR = 'input[placeholder*="标题"], input#title, .article-title-input'
_EDITOR_SELECTOR = '.ql-editor, [contenteditable="true"], .public-DraftEditor-content'
_PUBLISH_SELECTOR = 'button:has-text("投稿"), button:has-text("提交"), .submit-btn'
_SUCCESS_SELECTOR = (
    '.success-tip, .msg-success, .el-message--success, '
    '.ant-message-success'
)


class ZhihuDailyAdapter(BasePlatformAdapter):
    """知乎日报适配器。"""

    platform_id = "zhihu_daily"
    platform_name = "知乎日报"
    supported_formats = ["md", "html", "image"]
    requires_credentials = ["z_c0", "d_c0"]
    needs_browser = True

    def _cookies(self, credentials: dict[str, Any]) -> list[SetCookieParam]:
        return [
            {
                "name": "z_c0",
                "value": credentials.get("z_c0", ""),
                "domain": ".zhihu.com",
                "path": "/",
                "httpOnly": True,
                "secure": True,
                "sameSite": "Lax",
            },
            {
                "name": "d_c0",
                "value": credentials.get("d_c0", ""),
                "domain": ".zhihu.com",
                "path": "/",
            },
        ]

    def _account_id(self, credentials: dict[str, Any], primary: str) -> str:
        acct = credentials.get("account_id")
        if acct:
            return f"{self.platform_id}_{acct}"
        return f"{self.platform_id}_{hashlib.md5(primary.encode()).hexdigest()[:8]}"

    async def verify_credentials(self, credentials: dict[str, Any]) -> tuple[bool, str]:
        if not _HAS_PLAYWRIGHT:
            return (
                False,
                "Playwright not installed. Run: pip install playwright && playwright install chromium",
            )
        z_c0 = credentials.get("z_c0", "").strip()
        if not z_c0:
            return False, "missing z_c0 cookie"

        try:
            async with async_playwright() as p:
                browser, context = await create_stealth_browser_context(
                    account_id=self._account_id(credentials, z_c0),
                    platform=self.platform_id,
                    playwright_instance=p,
                    headless=True,
                )
                try:
                    await context.add_cookies(self._cookies(credentials))
                    page = await context.new_page()
                    await human_pause(1.0, 2.0)
                    await page.goto(_HOME_URL, wait_until="networkidle", timeout=30000)
                    url = page.url
                    if "login" in url.lower() or "/signin" in url:
                        return False, "cookie expired (redirected to login)"
                    content_text = await page.content()
                    if "登录" in content_text and "退出" not in content_text:
                        return False, "cookie may be expired (login button visible)"
                    return True, "connected (z_c0 valid)"
                finally:
                    await close_stealth_context(browser, context)
        except Exception as e:
            return False, f"verify failed: {type(e).__name__}: {e}"

    async def publish(
        self,
        content: PublishContent,
        credentials: dict[str, Any],
        platform_config: dict[str, Any],
    ) -> PublishResult:
        if not _HAS_PLAYWRIGHT:
            return PublishResult(
                success=False,
                platform=self.platform_id,
                error_message="Playwright not installed. Run: pip install playwright && playwright install chromium",
            )
        z_c0 = credentials.get("z_c0", "").strip()
        if not z_c0:
            return PublishResult(
                success=False,
                platform=self.platform_id,
                error_message="missing z_c0 cookie",
            )

        title = (content.title or "Untitled")[:100]
        body_text = content.html or content.text or ""

        try:
            async with async_playwright() as p:
                browser, context = await create_stealth_browser_context(
                    account_id=self._account_id(credentials, z_c0),
                    platform=self.platform_id,
                    playwright_instance=p,
                    headless=True,
                )
                try:
                    await context.add_cookies(self._cookies(credentials))
                    page = await context.new_page()

                    await human_pause(1.5, 3.0)
                    await page.goto(_CREATE_URL, wait_until="networkidle", timeout=60000)
                    await simulate_reading(page, min_s=5.0, max_s=15.0)

                    if "/signin" in page.url or "login" in page.url.lower():
                        return PublishResult(
                            success=False,
                            platform=self.platform_id,
                            error_message="cookie expired, please refresh z_c0",
                        )

                    await human_type(page, title, _TITLE_SELECTOR)
                    await human_pause(0.5, 1.0)

                    await human_click(page, _EDITOR_SELECTOR)
                    await human_pause(0.3, 0.6)
                    for paragraph in body_text.split("\n\n"):
                        text = paragraph.strip()
                        if not text:
                            continue
                        await page.evaluate(
                            """(text) => {
                                const ed = document.querySelector('.ql-editor, [contenteditable="true"], .public-DraftEditor-content');
                                if (ed) { ed.focus(); document.execCommand('insertText', false, text); }
                            }""",
                            text,
                        )
                        await page.keyboard.press("Enter")
                        await human_pause(0.5, 1.2)

                    if content.cover_path:
                        try:
                            cover_input = page.locator(
                                'input[type="file"][accept*="image"]'
                            ).first
                            if await cover_input.count() > 0:
                                await cover_input.set_input_files(content.cover_path)
                                await page.wait_for_timeout(2000)
                        except Exception as e:
                            logger.warning(
                                "[%s] cover upload failed: %s", self.platform_id, e
                            )

                    await simulate_reading(page, min_s=2.0, max_s=5.0)
                    await human_pause(1.0, 2.0)

                    publish_btn = page.locator(_PUBLISH_SELECTOR).first
                    if await publish_btn.count() == 0:
                        return PublishResult(
                            success=False,
                            platform=self.platform_id,
                            error_message="publish button not found",
                        )
                    await human_click(page, _PUBLISH_SELECTOR)

                    try:
                        await page.wait_for_load_state("networkidle", timeout=30000)
                    except Exception as e:
                        logger.debug(
                            "[%s] post-publish networkidle wait: %s",
                            self.platform_id,
                            e,
                        )
                    published = False
                    if "/story/" in page.url and "contribute" not in page.url:
                        published = True
                    elif await page.locator(_SUCCESS_SELECTOR).first.count() > 0:
                        published = True
                    if not published:
                        return PublishResult(
                            success=False,
                            platform=self.platform_id,
                            error_message="publish timeout (no success signal)",
                        )

                    return PublishResult(
                        success=True,
                        platform=self.platform_id,
                        published_url=page.url,
                        payload={"title": title},
                    )
                finally:
                    await close_stealth_context(browser, context)
        except Exception as e:
            return PublishResult(
                success=False,
                platform=self.platform_id,
                error_message=f"publish failed: {type(e).__name__}: {e}",
            )
