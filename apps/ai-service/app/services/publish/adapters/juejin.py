"""掘金 适配器(基于 Playwright 浏览器自动化框架)。

凭证:{ sessionid, signatureId }

实现:
- verify_credentials: 打开 https://juejin.cn 检查登录态
- publish: 打开 https://juejin.cn/editor/drafts/new → 填标题/内容 → 点发布
"""
from __future__ import annotations

from typing import Any

from app.core.logging import get_logger
from ..base_adapter import BasePlatformAdapter, PublishContent, PublishResult

logger = get_logger(__name__)

try:
    from playwright.async_api import async_playwright
    _HAS_PLAYWRIGHT = True
except ImportError:
    _HAS_PLAYWRIGHT = False


class JuejinAdapter(BasePlatformAdapter):
    platform_id = "juejin"
    platform_name = "掘金"
    supported_formats = ["md", "html"]
    requires_credentials = ["sessionid", "signatureId"]
    needs_browser = True

    def _cookies(self, credentials: dict) -> list[dict[str, Any]]:
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

    async def verify_credentials(self, credentials: dict) -> tuple[bool, str]:
        if not _HAS_PLAYWRIGHT:
            return False, "Playwright not installed. Run: pip install playwright && playwright install chromium"
        sessionid = credentials.get("sessionid", "").strip()
        if not sessionid:
            return False, "missing sessionid cookie"

        try:
            async with async_playwright() as p:
                browser = await p.chromium.launch(headless=True)
                context = await browser.new_context()
                await context.add_cookies(self._cookies(credentials))
                page = await context.new_page()
                await page.goto("https://juejin.cn/", wait_until="networkidle", timeout=30000)
                content = await page.content()
                await browser.close()
                # 检查是否有 "登录" 按钮(未登录)
                if '登录' in content and 'class="login"' in content:
                    # 进一步判断:是否有用户头像
                    if "avatar" not in content.lower():
                        return False, "cookie expired (login visible, no avatar)"
                return True, "connected (sessionid valid)"
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
                browser = await p.chromium.launch(headless=True)
                context = await browser.new_context()
                await context.add_cookies(self._cookies(credentials))
                page = await context.new_page()

                # 打开新草稿
                await page.goto("https://juejin.cn/editor/drafts/new?v=2", wait_until="networkidle", timeout=60000)
                if "login" in page.url.lower() or "/login" in page.url:
                    await browser.close()
                    return PublishResult(
                        success=False, platform=self.platform_id,
                        error_message="cookie expired, please refresh sessionid",
                    )

                # 填标题
                title_input = page.locator('input.title-input, .title-input input, input[placeholder*="输入文章标题"]').first
                await title_input.fill(title)

                # 切换到 Markdown 编辑器(掘金默认 Markdown)
                try:
                    md_tab = page.locator('div:has-text("Markdown"), button:has-text("Markdown")').first
                    if await md_tab.count() > 0:
                        await md_tab.click()
                        await page.wait_for_timeout(500)
                except Exception:
                    pass

                # 填正文
                editor = page.locator('textarea.editor, .CodeMirror textarea, [mode="markdown"] textarea').first
                if await editor.count() > 0:
                    await editor.fill(md_text)
                else:
                    # 富文本回退
                    editor_div = page.locator('.content-input, [contenteditable="true"]').first
                    await editor_div.click()
                    await page.evaluate(
                        """(text) => {
                            const ed = document.querySelector('.content-input, [contenteditable="true"]');
                            if (ed) { ed.focus(); document.execCommand('insertText', false, text); }
                        }""",
                        md_text,
                    )

                # 选择分类
                if category:
                    try:
                        cat_selector = page.locator('select.category-select, .category-list .item').first
                        if await cat_selector.count() > 0:
                            await cat_selector.click()
                            cat_option = page.locator(f'.category-option:has-text("{category}"), li:has-text("{category}")').first
                            if await cat_option.count() > 0:
                                await cat_option.click()
                    except Exception as e:
                        logger.warning("[juejin] select category failed: %s", e)

                # 填标签
                if tags:
                    try:
                        tag_input = page.locator('input[placeholder*="标签"], .tag-input input').first
                        for tag in tags:
                            await tag_input.fill(str(tag))
                            await page.keyboard.press("Enter")
                            await page.wait_for_timeout(300)
                    except Exception as e:
                        logger.warning("[juejin] tag input failed: %s", e)

                # 封面
                if cover:
                    try:
                        cover_input = page.locator('input[placeholder*="封面"], .cover-input').first
                        if await cover_input.count() > 0:
                            await cover_input.fill(cover)
                    except Exception:
                        pass

                # 点发布(掘金需要先点 "发布" 弹窗,再确认)
                publish_btn = page.locator('button:has-text("发布"), .publish-btn').first
                if await publish_btn.count() == 0:
                    await browser.close()
                    return PublishResult(
                        success=False, platform=self.platform_id,
                        error_message="publish button not found",
                    )
                await publish_btn.click()
                await page.wait_for_timeout(1000)

                # 弹窗确认
                confirm_btn = page.locator('button:has-text("确认发布"), .modal .confirm-btn, .dialog button.btn-primary').first
                if await confirm_btn.count() > 0:
                    await confirm_btn.click()

                # 等待跳转
                try:
                    await page.wait_for_url("**/post/**", timeout=30000)
                except Exception:
                    await browser.close()
                    return PublishResult(
                        success=False, platform=self.platform_id,
                        error_message="publish timeout (no redirect to /post/<id>)",
                    )

                published_url = page.url
                parts = published_url.rstrip("/").split("/")
                post_id = parts[-1] if parts else ""
                await browser.close()

                return PublishResult(
                    success=True, platform=self.platform_id,
                    published_url=published_url,
                    platform_content_id=post_id,
                    payload={"title": title, "tags": tags, "category": category},
                )
        except Exception as e:
            return PublishResult(
                success=False, platform=self.platform_id,
                error_message=f"publish failed: {type(e).__name__}: {e}",
            )
