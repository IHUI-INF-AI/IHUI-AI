"""CSDN 适配器(基于 Playwright 浏览器自动化框架)。

凭证:{ UserName, UserToken, UserSecret cookies }

实现:
- verify_credentials: 打开 https://mp.csdn.net 检查登录态
- publish: 打开 https://mp.csdn.net/mdeditor → 填标题/内容(Markdown 模式)→ 点发布
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


class CsdnAdapter(BasePlatformAdapter):
    platform_id = "csdn"
    platform_name = "CSDN"
    supported_formats = ["md", "html"]
    requires_credentials = ["UserName", "UserToken", "UserSecret"]
    needs_browser = True

    def _cookies(self, credentials: dict) -> list[dict[str, Any]]:
        return [
            {
                "name": "UserName",
                "value": credentials.get("UserName", ""),
                "domain": ".csdn.net",
                "path": "/",
            },
            {
                "name": "UserToken",
                "value": credentials.get("UserToken", ""),
                "domain": ".csdn.net",
                "path": "/",
                "httpOnly": True,
            },
            {
                "name": "UserSecret",
                "value": credentials.get("UserSecret", ""),
                "domain": ".csdn.net",
                "path": "/",
                "httpOnly": True,
            },
        ]

    async def verify_credentials(self, credentials: dict) -> tuple[bool, str]:
        if not _HAS_PLAYWRIGHT:
            return False, "Playwright not installed. Run: pip install playwright && playwright install chromium"
        username = credentials.get("UserName", "").strip()
        if not username:
            return False, "missing UserName cookie"

        try:
            async with async_playwright() as p:
                browser = await p.chromium.launch(headless=True)
                context = await browser.new_context()
                await context.add_cookies(self._cookies(credentials))
                page = await context.new_page()
                await page.goto("https://mp.csdn.net/", wait_until="networkidle", timeout=30000)
                url = page.url
                await browser.close()
                if "login" in url.lower() or "/login" in url:
                    return False, "cookie expired (redirected to login)"
                return True, f"connected as {username}"
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
        username = credentials.get("UserName", "").strip()
        if not username:
            return PublishResult(
                success=False, platform=self.platform_id,
                error_message="missing UserName cookie",
            )

        # CSDN 编辑器支持 Markdown 模式,优先用 text(md)
        md_text = content.text or ""
        if not md_text and content.html:
            # 简单 HTML → md 反向转换(实际生产应用 markdown 库)
            md_text = content.html.replace("<p>", "").replace("</p>", "\n\n").replace("<br>", "\n")
        if not md_text:
            return PublishResult(
                success=False, platform=self.platform_id,
                error_message="missing content text (md preferred)",
            )

        title = (content.title or "Untitled")[:100]
        tags = platform_config.get("tags", [])[:5]
        category = platform_config.get("category", "")
        cover = content.cover_path or platform_config.get("cover", "")

        try:
            async with async_playwright() as p:
                browser = await p.chromium.launch(headless=True)
                context = await browser.new_context()
                await context.add_cookies(self._cookies(credentials))
                page = await context.new_page()

                # 打开 Markdown 编辑器
                await page.goto("https://mp.csdn.net/mdeditor", wait_until="networkidle", timeout=60000)
                if "login" in page.url.lower():
                    await browser.close()
                    return PublishResult(
                        success=False, platform=self.platform_id,
                        error_message="cookie expired, please refresh cookies",
                    )

                # 填标题
                title_input = page.locator('input.article-title, #articleTitle, input[placeholder*="标题"]').first
                await title_input.fill(title)

                # 切换到 Markdown 模式(如有按钮)
                try:
                    md_tab = page.locator('a:has-text("Markdown"), button:has-text("Markdown")').first
                    if await md_tab.count() > 0:
                        await md_tab.click()
                        await page.wait_for_timeout(1000)
                except Exception:
                    pass

                # 填正文(用 textarea)
                editor = page.locator('textarea.editor, #editor, textarea[name="content"]').first
                if await editor.count() > 0:
                    await editor.fill(md_text)
                else:
                    # 富文本模式
                    editor_div = page.locator('.editor-content, [contenteditable="true"]').first
                    await editor_div.click()
                    await page.evaluate(
                        """(text) => {
                            const ed = document.querySelector('.editor-content, [contenteditable="true"]');
                            if (ed) { ed.focus(); document.execCommand('insertText', false, text); }
                        }""",
                        md_text,
                    )

                # 填标签
                if tags:
                    try:
                        tag_input = page.locator('input[placeholder*="标签"], #tag-input').first
                        for tag in tags:
                            await tag_input.fill(str(tag))
                            await page.keyboard.press("Enter")
                            await page.wait_for_timeout(300)
                    except Exception as e:
                        logger.warning("[csdn] tag input failed: %s", e)

                # 点发布
                publish_btn = page.locator('button:has-text("发布"), button.publish-btn, .btn-publish').first
                if await publish_btn.count() == 0:
                    await browser.close()
                    return PublishResult(
                        success=False, platform=self.platform_id,
                        error_message="publish button not found",
                    )
                await publish_btn.click()

                # 等待跳转
                try:
                    await page.wait_for_url("**/article/details/**", timeout=30000)
                except Exception:
                    # 检查是否有错误对话框
                    err_dialog = page.locator('.error-msg, .el-message--error').first
                    if await err_dialog.count() > 0:
                        err_text = await err_dialog.text_content() or "unknown error"
                        await browser.close()
                        return PublishResult(
                            success=False, platform=self.platform_id,
                            error_message=f"publish error: {err_text}",
                        )
                    await browser.close()
                    return PublishResult(
                        success=False, platform=self.platform_id,
                        error_message="publish timeout (no redirect)",
                    )

                published_url = page.url
                parts = published_url.rstrip("/").split("/")
                article_id = parts[-1] if parts else ""
                await browser.close()

                return PublishResult(
                    success=True, platform=self.platform_id,
                    published_url=published_url,
                    platform_content_id=article_id,
                    payload={"title": title, "tags": tags, "category": category},
                )
        except Exception as e:
            return PublishResult(
                success=False, platform=self.platform_id,
                error_message=f"publish failed: {type(e).__name__}: {e}",
            )
