"""虎嗅网 适配器(基于 Playwright + 反风控五层防线)。

虎嗅是科技商业媒体平台,内容偏向深度商业/科技分析。

凭证:{ huxiu_session, huxiu_token } — 均为 .huxiu.com 域 cookie

实现:
- verify_credentials: 打开 https://www.huxiu.com 检查登录态
- publish: 打开 https://www.huxiu.com/article/write → 人类化填标题/正文 → 点发布

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


_HOME_URL = "https://www.huxiu.com"
_CREATE_URL = "https://www.huxiu.com/article/write"
_TITLE_SELECTOR = 'input[placeholder*="标题"], input#title, .article-title-input'
_EDITOR_SELECTOR = '.ql-editor, [contenteditable="true"], .article-editor'
_PUBLISH_SELECTOR = 'button:has-text("发布"), button:has-text("提交"), .publish-btn'
_SUCCESS_SELECTOR = (
    '.success-tip, .msg-success, .el-message--success, '
    '.ant-message-success'
)


class HuxiuAdapter(BasePlatformAdapter):
    """虎嗅网适配器。"""

    platform_id = "huxiu"
    platform_name = "虎嗅网"
    supported_formats = ["md", "html", "image"]
    requires_credentials = ["huxiu_session", "huxiu_token"]
    needs_browser = True

    def _cookies(self, credentials: dict[str, Any]) -> list[SetCookieParam]:
        return [
            {
                "name": "huxiu_session",
                "value": credentials.get("huxiu_session", ""),
                "domain": ".huxiu.com",
                "path": "/",
                "httpOnly": True,
            },
            {
                "name": "huxiu_token",
                "value": credentials.get("huxiu_token", ""),
                "domain": ".huxiu.com",
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
        session = credentials.get("huxiu_session", "").strip()
        if not session:
            return False, "missing huxiu_session cookie"

        try:
            async with async_playwright() as p:
                browser, context = await create_stealth_browser_context(
                    account_id=self._account_id(credentials, session),
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
                    if "login" in url.lower() or "/login" in url:
                        return False, "cookie expired (redirected to login)"
                    content_text = await page.content()
                    if "登录" in content_text and "退出" not in content_text:
                        return False, "cookie may be expired (login button visible)"
                    return True, "connected (huxiu_session valid)"
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
        session = credentials.get("huxiu_session", "").strip()
        if not session:
            return PublishResult(
                success=False,
                platform=self.platform_id,
                error_message="missing huxiu_session cookie",
            )

        title = (content.title or "Untitled")[:40]
        body_text = content.html or content.text or ""

        try:
            async with async_playwright() as p:
                browser, context = await create_stealth_browser_context(
                    account_id=self._account_id(credentials, session),
                    platform=self.platform_id,
                    playwright_instance=p,
                    headless=True,
                )
                try:
                    await context.add_cookies(self._cookies(credentials))
                    page = await context.new_page()

                    await human_pause(1.5, 3.0)
                    await page.goto(_CREATE_URL, wait_until="networkidle", timeout=60000)
                    await simulate_reading(page, min_s=10.0, max_s=30.0)

                    if "login" in page.url.lower():
                        return PublishResult(
                            success=False,
                            platform=self.platform_id,
                            error_message="cookie expired, please refresh huxiu_session",
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
                                const ed = document.querySelector('.ql-editor, [contenteditable="true"], .article-editor');
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
                    if "/article/" in page.url and "write" not in page.url:
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
