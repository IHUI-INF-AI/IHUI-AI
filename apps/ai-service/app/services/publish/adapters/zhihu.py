"""知乎 适配器(基于 Playwright 浏览器自动化框架)。

凭证:{ z_c0 cookie }

实现:
- verify_credentials: 打开 https://www.zhihu.com 检查是否登录态
- publish: 打开 https://zhuanlan.zhihu.com/write → 填标题/正文 → 点发布

反风控:接入 anti_risk 五层防线,所有输入/点击走 human_*。

注意:
- 需要 Playwright + chromium,缺依赖时 verify 返回明确错误
- 凭证仅 cookie,不需要 AppID
"""
from __future__ import annotations

import asyncio
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
    from playwright.async_api import async_playwright, Browser, BrowserContext, Page
    _HAS_PLAYWRIGHT = True
except ImportError:
    _HAS_PLAYWRIGHT = False
    # playwright 未安装时 None 赋值给类型变量仅用于 is None 判定,
    # 真正使用前会先检查 _HAS_PLAYWRIGHT 标志,运行时不会访问这些占位符。
    Browser = BrowserContext = Page = None  # type: ignore[assignment,misc]

if TYPE_CHECKING:
    from playwright._impl._api_structures import SetCookieParam


class ZhihuAdapter(BasePlatformAdapter):
    platform_id = "zhihu"
    platform_name = "知乎"
    supported_formats = ["md", "html"]
    requires_credentials = ["z_c0"]
    needs_browser = True

    def _cookies(self, credentials: dict[str, Any]) -> list[SetCookieParam]:
        return [{
            "name": "z_c0",
            "value": credentials.get("z_c0", ""),
            "domain": ".zhihu.com",
            "path": "/",
            "httpOnly": True,
            "secure": True,
            "sameSite": "Lax",
        }]

    def _account_id(self, credentials: dict[str, Any]) -> str:
        """从凭证推导账号唯一 ID(用于反风控 profile 持久化,跨会话稳定)。"""
        first_cred = next((v for v in credentials.values() if v), "default")
        return f"{self.platform_id}_{hashlib.md5(str(first_cred).encode()).hexdigest()[:8]}"

    async def verify_credentials(self, credentials: dict[str, Any]) -> tuple[bool, str]:
        if not _HAS_PLAYWRIGHT:
            return False, "Playwright not installed. Run: pip install playwright && playwright install chromium"
        z_c0 = credentials.get("z_c0", "").strip()
        if not z_c0:
            return False, "missing z_c0 cookie"

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
                    await page.goto("https://www.zhihu.com/", wait_until="networkidle", timeout=30000)
                    content = await page.content()
                    if "登录" in content and "写文章" not in content:
                        return False, "cookie expired or invalid (login button visible)"
                    return True, "connected (cookie valid)"
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
        z_c0 = credentials.get("z_c0", "").strip()
        if not z_c0:
            return PublishResult(
                success=False, platform=self.platform_id,
                error_message="missing z_c0 cookie",
            )

        html = content.html or ""
        if not html and content.text:
            # md → 简单 HTML 转换(知乎编辑器支持 HTML 富文本)
            html = "".join(
                f"<p>{line}</p>" if line.strip() else "<br>"
                for line in content.text.split("\n\n")
            )

        title = (content.title or "Untitled")[:100]
        topic_ids = platform_config.get("topic_ids", [])  # 知乎话题 ID

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

                    # 打开写文章页
                    await human_pause(1.5, 3.0)
                    await page.goto("https://zhuanlan.zhihu.com/write", wait_until="networkidle", timeout=60000)

                    # 检查登录态
                    if "/signin" in page.url or "login" in page.url.lower():
                        return PublishResult(
                            success=False, platform=self.platform_id,
                            error_message="cookie expired, please refresh z_c0",
                        )

                    await simulate_reading(page, min_s=3.0, max_s=8.0)

                    # 填标题(人类化逐字符)
                    title_selector = 'textarea[placeholder*="标题"], input[placeholder*="标题"]'
                    await human_type(page, title, title_selector)
                    await human_pause(0.5, 1.0)

                    # 填正文(知乎用 contenteditable div,直接 setInnerHtml 或 paste)
                    editor_selector = '.public-DraftEditor-content, [contenteditable="true"]'
                    await page.locator(editor_selector).first.click()
                    await human_pause(0.3, 0.6)
                    # 使用 evaluate 注入 HTML 内容(知乎编辑器为富文本)
                    await page.evaluate(
                        """(html) => {
                            const editor = document.querySelector('.public-DraftEditor-content, [contenteditable="true"]');
                            if (!editor) return;
                            editor.focus();
                            document.execCommand('insertHTML', false, html);
                        }""",
                        html,
                    )

                    # 选择话题(若提供,人类化)
                    if topic_ids:
                        try:
                            topic_btn_selector = 'button:has-text("话题"), input[placeholder*="话题"]'
                            if await page.locator(topic_btn_selector).count() > 0:
                                await human_click(page, topic_btn_selector)
                                for tid in topic_ids[:5]:
                                    topic_input_selector = 'input[placeholder*="搜索话题"]'
                                    await human_type(page, str(tid), topic_input_selector)
                                    await page.wait_for_timeout(500)
                                    candidate_selector = '.topic-suggest li, .topic-item'
                                    if await page.locator(candidate_selector).count() > 0:
                                        await human_click(page, candidate_selector)
                        except Exception as e:
                            logger.warning("[zhihu] topic select failed: %s", e)

                    # 模拟阅读检查(人类发布前预览)
                    await simulate_reading(page, min_s=2.0, max_s=5.0)
                    await human_pause(1.0, 2.0)

                    # 点发布按钮(人类化)
                    publish_selector = 'button:has-text("发布"), button.PublishButton'
                    if await page.locator(publish_selector).count() == 0:
                        return PublishResult(
                            success=False, platform=self.platform_id,
                            error_message="publish button not found",
                        )
                    await human_click(page, publish_selector)

                    # 等待跳转到文章页
                    try:
                        await page.wait_for_url("**/p/**", timeout=30000)
                    except Exception:
                        return PublishResult(
                            success=False, platform=self.platform_id,
                            error_message="publish timeout (no redirect to /p/<id>)",
                        )

                    published_url = page.url
                    # 提取文章 ID
                    parts = published_url.rstrip("/").split("/")
                    article_id = parts[-1] if parts else ""

                    return PublishResult(
                        success=True, platform=self.platform_id,
                        published_url=published_url,
                        platform_content_id=article_id,
                        payload={"title": title, "topic_ids": topic_ids},
                    )
                finally:
                    await close_stealth_context(browser, context)
        except Exception as e:
            return PublishResult(
                success=False, platform=self.platform_id,
                error_message=f"publish failed: {type(e).__name__}: {e}",
            )