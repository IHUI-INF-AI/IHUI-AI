"""知乎 适配器(基于 Playwright 浏览器自动化框架)。

凭证:{ z_c0 cookie }

实现:
- verify_credentials: 打开 https://www.zhihu.com 检查是否登录态
- publish: 打开 https://zhuanlan.zhihu.com/write → 填标题/正文 → 点发布

注意:
- 需要 Playwright + chromium,缺依赖时 verify 返回明确错误
- 凭证仅 cookie,不需要 AppID
"""
from __future__ import annotations

import asyncio
from typing import Any

from app.core.logging import get_logger
from ..base_adapter import BasePlatformAdapter, PublishContent, PublishResult

logger = get_logger(__name__)

try:
    from playwright.async_api import async_playwright, Browser, BrowserContext, Page
    _HAS_PLAYWRIGHT = True
except ImportError:
    _HAS_PLAYWRIGHT = False
    Browser = BrowserContext = Page = None  # type: ignore[assignment,misc]


class ZhihuAdapter(BasePlatformAdapter):
    platform_id = "zhihu"
    platform_name = "知乎"
    supported_formats = ["md", "html"]
    requires_credentials = ["z_c0"]
    needs_browser = True

    def _cookies(self, credentials: dict) -> list[dict[str, Any]]:
        return [{
            "name": "z_c0",
            "value": credentials.get("z_c0", ""),
            "domain": ".zhihu.com",
            "path": "/",
            "httpOnly": True,
            "secure": True,
            "sameSite": "Lax",
        }]

    async def verify_credentials(self, credentials: dict) -> tuple[bool, str]:
        if not _HAS_PLAYWRIGHT:
            return False, "Playwright not installed. Run: pip install playwright && playwright install chromium"
        z_c0 = credentials.get("z_c0", "").strip()
        if not z_c0:
            return False, "missing z_c0 cookie"

        try:
            async with async_playwright() as p:
                browser = await p.chromium.launch(headless=True)
                context = await browser.new_context()
                await context.add_cookies(self._cookies(credentials))
                page = await context.new_page()
                await page.goto("https://www.zhihu.com/", wait_until="networkidle", timeout=30000)
                # 检查登录态:页面是否有 "登录" 按钮或已显示用户头像
                content = await page.content()
                await browser.close()
                # 简单判断:若页面包含 z_c0 对应的用户名 element,则登录
                if "登录" in content and "写文章" not in content:
                    return False, "cookie expired or invalid (login button visible)"
                return True, "connected (cookie valid)"
        except Exception as e:
            return False, f"verify failed: {type(e).__name__}: {e}"

    async def publish(
        self,
        content: PublishContent,
        credentials: dict,
        platform_config: dict,
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
                browser = await p.chromium.launch(headless=True)
                context = await browser.new_context()
                await context.add_cookies(self._cookies(credentials))
                page = await context.new_page()

                # 打开写文章页
                await page.goto("https://zhuanlan.zhihu.com/write", wait_until="networkidle", timeout=60000)

                # 检查登录态
                if "/signin" in page.url or "login" in page.url.lower():
                    await browser.close()
                    return PublishResult(
                        success=False, platform=self.platform_id,
                        error_message="cookie expired, please refresh z_c0",
                    )

                # 填标题
                title_input = page.locator('textarea[placeholder*="标题"], input[placeholder*="标题"]').first
                await title_input.fill(title)

                # 填正文(知乎用 contenteditable div,直接 setInnerHtml 或 paste)
                editor = page.locator('.public-DraftEditor-content, [contenteditable="true"]').first
                await editor.click()
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

                # 选择话题(若提供)
                if topic_ids:
                    # 知乎话题选择 UI 复杂,简化:仅点击 "添加话题" 并输入第一个
                    try:
                        topic_btn = page.locator('button:has-text("话题"), input[placeholder*="话题"]').first
                        if await topic_btn.count() > 0:
                            await topic_btn.click()
                            for tid in topic_ids[:5]:
                                topic_input = page.locator('input[placeholder*="搜索话题"]').first
                                await topic_input.fill(str(tid))
                                await page.wait_for_timeout(500)
                                # 选第一个候选
                                candidate = page.locator('.topic-suggest li, .topic-item').first
                                if await candidate.count() > 0:
                                    await candidate.click()
                    except Exception as e:
                        logger.warning("[zhihu] topic select failed: %s", e)

                # 点发布按钮
                publish_btn = page.locator('button:has-text("发布"), button.PublishButton').first
                if await publish_btn.count() == 0:
                    await browser.close()
                    return PublishResult(
                        success=False, platform=self.platform_id,
                        error_message="publish button not found",
                    )
                await publish_btn.click()

                # 等待跳转到文章页
                try:
                    await page.wait_for_url("**/p/**", timeout=30000)
                except Exception:
                    await browser.close()
                    return PublishResult(
                        success=False, platform=self.platform_id,
                        error_message="publish timeout (no redirect to /p/<id>)",
                    )

                published_url = page.url
                # 提取文章 ID
                parts = published_url.rstrip("/").split("/")
                article_id = parts[-1] if parts else ""
                await browser.close()

                return PublishResult(
                    success=True, platform=self.platform_id,
                    published_url=published_url,
                    platform_content_id=article_id,
                    payload={"title": title, "topic_ids": topic_ids},
                )
        except Exception as e:
            return PublishResult(
                success=False, platform=self.platform_id,
                error_message=f"publish failed: {type(e).__name__}: {e}",
            )
