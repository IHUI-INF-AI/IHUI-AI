"""掘金 适配器(基于 Playwright 浏览器自动化框架)。

凭证:{ sessionid, signatureId }

实现:
- verify_credentials: 打开 https://juejin.cn 检查登录态
- publish: 打开 https://juejin.cn/editor/drafts/new → 填标题/内容 → 点发布

反风控:接入 anti_risk 五层防线,所有输入/点击走 human_*。
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


class JuejinAdapter(BasePlatformAdapter):
    platform_id = "juejin"
    platform_name = "掘金"
    supported_formats = ["md", "html"]
    requires_credentials = ["sessionid", "signatureId"]
    needs_browser = True

    def _cookies(self, credentials: dict[str, Any]) -> list[SetCookieParam]:
        return [
            {
                "name": "sessionid",
                "value": credentials.get("sessionid", ""),
                "domain": ".juejin.cn",
                "path": "/",
                "httpOnly": True,
            },
            {
                "name": "sessionid_ss",
                "value": credentials.get("sessionid", ""),
                "domain": ".juejin.cn",
                "path": "/",
                "httpOnly": True,
            },
            {
                "name": "sid_guard",
                "value": credentials.get("signatureId", ""),
                "domain": ".juejin.cn",
                "path": "/",
                "httpOnly": True,
            },
        ]

    def _account_id(self, credentials: dict[str, Any]) -> str:
        """从凭证推导账号唯一 ID(用于反风控 profile 持久化,跨会话稳定)。"""
        first_cred = next((v for v in credentials.values() if v), "default")
        return f"{self.platform_id}_{hashlib.md5(str(first_cred).encode()).hexdigest()[:8]}"

    async def verify_credentials(self, credentials: dict[str, Any]) -> tuple[bool, str]:
        if not _HAS_PLAYWRIGHT:
            return False, "Playwright not installed. Run: pip install playwright && playwright install chromium"
        sessionid = credentials.get("sessionid", "").strip()
        if not sessionid:
            return False, "missing sessionid cookie"

        try:
            async with async_playwright() as p:
                browser, context = await create_stealth_browser_context(
                    account_id=self._account_id(credentials),
                    platform=self.platform_id,
                    playwright_instance=p,
                    headless=True,
                )
                try:
                    await context.add_cookies(self._cookies(credentials))
                    page = await context.new_page()
                    await human_pause(1.0, 2.0)
                    await page.goto("https://juejin.cn/", wait_until="networkidle", timeout=30000)
                    content = await page.content()
                    if '登录' in content and 'class="login"' in content:
                        if "avatar" not in content.lower():
                            return False, "cookie expired (login visible, no avatar)"
                    return True, "connected (sessionid valid)"
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
                success=False, platform=self.platform_id,
                error_message="Playwright not installed. Run: pip install playwright && playwright install chromium",
            )
        sessionid = credentials.get("sessionid", "").strip()
        if not sessionid:
            return PublishResult(
                success=False, platform=self.platform_id,
                error_message="missing sessionid cookie",
            )

        # 掘金编辑器支持 Markdown,优先用 text
        md_text = content.text or ""
        if not md_text and content.html:
            md_text = content.html.replace("<p>", "").replace("</p>", "\n\n").replace("<br>", "\n")
        if not md_text:
            return PublishResult(
                success=False, platform=self.platform_id,
                error_message="missing content text",
            )

        title = (content.title or "Untitled")[:100]
        category = platform_config.get("category", "后端")  # 默认后端分类
        tags = platform_config.get("tags", [])[:3]
        cover = content.cover_path or platform_config.get("cover", "")

        try:
            async with async_playwright() as p:
                browser, context = await create_stealth_browser_context(
                    account_id=self._account_id(credentials),
                    platform=self.platform_id,
                    playwright_instance=p,
                    headless=True,
                )
                try:
                    await context.add_cookies(self._cookies(credentials))
                    page = await context.new_page()

                    # 打开新草稿
                    await human_pause(1.5, 3.0)
                    await page.goto("https://juejin.cn/editor/drafts/new?v=2", wait_until="networkidle", timeout=60000)
                    if "login" in page.url.lower() or "/login" in page.url:
                        return PublishResult(
                            success=False, platform=self.platform_id,
                            error_message="cookie expired, please refresh sessionid",
                        )

                    await simulate_reading(page, min_s=3.0, max_s=8.0)

                    # 填标题(人类化逐字符)
                    title_selector = 'input.title-input, .title-input input, input[placeholder*="输入文章标题"]'
                    await human_type(page, title, title_selector)
                    await human_pause(0.5, 1.0)

                    # 切换到 Markdown 编辑器(掘金默认 Markdown)
                    md_tab_selector = 'div:has-text("Markdown"), button:has-text("Markdown")'
                    try:
                        if await page.locator(md_tab_selector).count() > 0:
                            await human_click(page, md_tab_selector)
                            await page.wait_for_timeout(500)
                    except Exception as e:
                        logger.warning("juejin.publish Markdown tab click 失败: %s", e, exc_info=True)

                    # 填正文(人类化分段输入)
                    editor_selector = 'textarea.editor, .CodeMirror textarea, [mode="markdown"] textarea'
                    if await page.locator(editor_selector).count() > 0:
                        await page.locator(editor_selector).first.click()
                        paragraphs = md_text.split("\n\n")
                        for i, para in enumerate(paragraphs):
                            if i > 0:
                                await page.keyboard.press("Enter")
                                await page.keyboard.press("Enter")
                                await human_pause(0.3, 0.8)
                            await human_type(page, para, None)
                    else:
                        # 富文本回退
                        editor_div_selector = '.content-input, [contenteditable="true"]'
                        await page.locator(editor_div_selector).first.click()
                        await page.evaluate(
                            """(text) => {
                                const ed = document.querySelector('.content-input, [contenteditable="true"]');
                                if (ed) { ed.focus(); document.execCommand('insertText', false, text); }
                            }""",
                            md_text,
                        )

                    # 选择分类(人类化)
                    if category:
                        try:
                            cat_selector_str = 'select.category-select, .category-list .item'
                            if await page.locator(cat_selector_str).count() > 0:
                                await human_click(page, cat_selector_str)
                                cat_option_selector = f'.category-option:has-text("{category}"), li:has-text("{category}")'
                                if await page.locator(cat_option_selector).count() > 0:
                                    await human_click(page, cat_option_selector)
                        except Exception as e:
                            logger.warning("[juejin] select category failed: %s", e)

                    # 填标签(人类化)
                    if tags:
                        try:
                            tag_selector = 'input[placeholder*="标签"], .tag-input input'
                            for tag in tags:
                                await human_type(page, str(tag), tag_selector)
                                await page.keyboard.press("Enter")
                                await human_pause(0.4, 0.8)
                        except Exception as e:
                            logger.warning("[juejin] tag input failed: %s", e)

                    # 封面(人类化)
                    if cover:
                        try:
                            cover_selector = 'input[placeholder*="封面"], .cover-input'
                            if await page.locator(cover_selector).count() > 0:
                                await human_type(page, cover, cover_selector)
                        except Exception as e:
                            logger.warning("juejin.publish cover input 失败: %s", e, exc_info=True)

                    # 模拟阅读检查(人类发布前预览)
                    await simulate_reading(page, min_s=2.0, max_s=5.0)
                    await human_pause(1.0, 2.0)

                    # 点发布(掘金需要先点 "发布" 弹窗,再确认)
                    publish_selector = 'button:has-text("发布"), .publish-btn'
                    if await page.locator(publish_selector).count() == 0:
                        return PublishResult(
                            success=False, platform=self.platform_id,
                            error_message="publish button not found",
                        )
                    await human_click(page, publish_selector)
                    await page.wait_for_timeout(1000)

                    # 弹窗确认(人类化)
                    confirm_selector = 'button:has-text("确认发布"), .modal .confirm-btn, .dialog button.btn-primary'
                    if await page.locator(confirm_selector).count() > 0:
                        await human_click(page, confirm_selector)

                    # 等待跳转
                    try:
                        await page.wait_for_url("**/post/**", timeout=30000)
                    except Exception as e:
                        logger.warning("juejin.publish wait_for_url 失败: %s", e, exc_info=True)
                        return PublishResult(
                            success=False, platform=self.platform_id,
                            error_message="publish timeout (no redirect to /post/<id>)",
                        )

                    published_url = page.url
                    parts = published_url.rstrip("/").split("/")
                    post_id = parts[-1] if parts else ""

                    return PublishResult(
                        success=True, platform=self.platform_id,
                        published_url=published_url,
                        platform_content_id=post_id,
                        payload={"title": title, "tags": tags, "category": category},
                    )
                finally:
                    await close_stealth_context(browser, context)
        except Exception as e:
            return PublishResult(
                success=False, platform=self.platform_id,
                error_message=f"publish failed: {type(e).__name__}: {e}",
            )