"""CSDN 适配器(基于 Playwright 浏览器自动化框架)。

反风控接入: 通过 anti_risk.browser_factory 创建 BrowserContext,自动注入指纹/代理/stealth/持久化。
所有点击/输入走 behavior_humanizer 人类化操作(贝塞尔曲线鼠标 + 逐字符输入),
同账号跨会话指纹/代理固定,杜绝"新设备登录"告警。

凭证:{ UserName, UserToken, UserSecret cookies }

实现:
- verify_credentials: 打开 https://mp.csdn.net 检查登录态
- publish: 打开 https://mp.csdn.net/mdeditor → 填标题/内容(Markdown 模式)→ 点发布
"""
from __future__ import annotations

from typing import TYPE_CHECKING, Any

from app.core.logging import get_logger
from ..anti_risk import (
    close_stealth_context,
    create_stealth_browser_context,
    human_click,
    human_pause,
    human_type,
    simulate_reading,
)
from ..base_adapter import BasePlatformAdapter, PublishContent, PublishResult

logger = get_logger(__name__)

try:
    from playwright.async_api import async_playwright
    _HAS_PLAYWRIGHT = True
except ImportError:
    _HAS_PLAYWRIGHT = False

if TYPE_CHECKING:
    from playwright._impl._api_structures import SetCookieParam


class CsdnAdapter(BasePlatformAdapter):
    platform_id = "csdn"
    platform_name = "CSDN"
    supported_formats = ["md", "html"]
    requires_credentials = ["UserName", "UserToken", "UserSecret"]
    needs_browser = True

    def _cookies(self, credentials: dict[str, Any]) -> list[SetCookieParam]:
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

    def _extract_account_key(self, credentials: dict[str, Any]) -> str:
        """从凭证中提取账号唯一标识(用于反风控画像持久化)。

        优先级:UserName > UserToken 前 16 位 > UserSecret 前 16 位
        确保:同账号跨会话 account_id 稳定 → 同账号指纹/代理固定不变
        """
        for key in ("UserName", "UserToken", "UserSecret"):
            val = credentials.get(key, "")
            if val:
                return str(val)[:16]
        return "default"

    async def verify_credentials(self, credentials: dict[str, Any]) -> tuple[bool, str]:
        if not _HAS_PLAYWRIGHT:
            return False, "Playwright not installed. Run: pip install playwright && playwright install chromium"
        username = credentials.get("UserName", "").strip()
        if not username:
            return False, "missing UserName cookie"

        account_id = credentials.get("account_id") or f"{self.platform_id}_{self._extract_account_key(credentials)}"
        try:
            async with async_playwright() as p:
                browser, context = await create_stealth_browser_context(
                    account_id=account_id,
                    platform=self.platform_id,
                    playwright_instance=p,
                    headless=True,
                )
                try:
                    await context.add_cookies(self._cookies(credentials))
                    page = await context.new_page()
                    logger.info("[%s] 反风控 context 已创建 account=%s", self.platform_id, account_id)
                    await page.goto("https://mp.csdn.net/", wait_until="networkidle", timeout=30000)
                    await simulate_reading(page, min_s=2.0, max_s=5.0)
                    url = page.url
                    if "login" in url.lower() or "/login" in url:
                        return False, "cookie expired (redirected to login)"
                    return True, f"connected as {username}"
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

        account_id = credentials.get("account_id") or f"{self.platform_id}_{self._extract_account_key(credentials)}"
        try:
            async with async_playwright() as p:
                browser, context = await create_stealth_browser_context(
                    account_id=account_id,
                    platform=self.platform_id,
                    playwright_instance=p,
                    headless=True,
                )
                try:
                    await context.add_cookies(self._cookies(credentials))
                    page = await context.new_page()
                    logger.info("[%s] 反风控 context 已创建 account=%s", self.platform_id, account_id)
                    await human_pause(1.0, 2.5)  # 模拟用户思考停顿

                    # 打开 Markdown 编辑器
                    await page.goto("https://mp.csdn.net/mdeditor", wait_until="networkidle", timeout=60000)
                    if "login" in page.url.lower():
                        return PublishResult(
                            success=False, platform=self.platform_id,
                            error_message="cookie expired, please refresh cookies",
                        )
                    await human_pause(0.5, 1.5)

                    # 填标题(人类化逐字符输入)
                    title_selector = 'input.article-title, #articleTitle, input[placeholder*="标题"]'
                    title_input = page.locator(title_selector).first
                    if await title_input.count() == 0:
                        return PublishResult(
                            success=False, platform=self.platform_id,
                            error_message="title input not found",
                        )
                    logger.debug("[%s] 人类化操作中...", self.platform_id)
                    await human_type(page, title, selector=title_selector)
                    await human_pause(0.5, 1.5)

                    # 切换到 Markdown 模式(如有按钮)
                    md_tab_selector = 'a:has-text("Markdown"), button:has-text("Markdown")'
                    try:
                        md_tab = page.locator(md_tab_selector).first
                        if await md_tab.count() > 0:
                            logger.debug("[%s] 人类化操作中...", self.platform_id)
                            await human_click(page, selector=md_tab_selector)
                            await page.wait_for_timeout(1000)
                    except Exception as e:
                        logger.warning("csdn.publish Markdown tab click 失败: %s", e, exc_info=True)

                    # 填正文(用 textarea,人类化逐字符输入)
                    editor_selector = 'textarea.editor, #editor, textarea[name="content"]'
                    editor = page.locator(editor_selector).first
                    if await editor.count() > 0:
                        logger.debug("[%s] 人类化操作中...", self.platform_id)
                        await human_type(page, md_text, selector=editor_selector)
                    else:
                        # 富文本模式
                        editor_div_selector = '.editor-content, [contenteditable="true"]'
                        logger.debug("[%s] 人类化操作中...", self.platform_id)
                        await human_click(page, selector=editor_div_selector)
                        await page.evaluate(
                            """(text) => {
                                const ed = document.querySelector('.editor-content, [contenteditable="true"]');
                                if (ed) { ed.focus(); document.execCommand('insertText', false, text); }
                            }""",
                            md_text,
                        )
                    await human_pause(0.5, 1.5)

                    # 填标签
                    if tags:
                        try:
                            tag_selector = 'input[placeholder*="标签"], #tag-input'
                            tag_input = page.locator(tag_selector).first
                            for tag in tags:
                                if await tag_input.count() > 0:
                                    logger.debug("[%s] 人类化操作中...", self.platform_id)
                                    await human_type(page, str(tag), selector=tag_selector)
                                    await page.keyboard.press("Enter")
                                    await page.wait_for_timeout(300)
                        except Exception as e:
                            logger.warning("[csdn] tag input failed: %s", e)

                    # 点发布(人类化点击)
                    publish_selector = 'button:has-text("发布"), button.publish-btn, .btn-publish'
                    publish_btn = page.locator(publish_selector).first
                    if await publish_btn.count() == 0:
                        return PublishResult(
                            success=False, platform=self.platform_id,
                            error_message="publish button not found",
                        )
                    logger.debug("[%s] 人类化操作中...", self.platform_id)
                    await human_click(page, selector=publish_selector)
                    await human_pause(0.5, 1.5)

                    # 等待跳转
                    try:
                        await page.wait_for_url("**/article/details/**", timeout=30000)
                    except Exception as e:
                        logger.warning("csdn.publish wait_for_url 失败: %s", e, exc_info=True)
                        # 检查是否有错误对话框
                        err_dialog = page.locator('.error-msg, .el-message--error').first
                        if await err_dialog.count() > 0:
                            err_text = await err_dialog.text_content() or "unknown error"
                            return PublishResult(
                                success=False, platform=self.platform_id,
                                error_message=f"publish error: {err_text}",
                            )
                        return PublishResult(
                            success=False, platform=self.platform_id,
                            error_message="publish timeout (no redirect)",
                        )

                    published_url = page.url
                    parts = published_url.rstrip("/").split("/")
                    article_id = parts[-1] if parts else ""

                    return PublishResult(
                        success=True, platform=self.platform_id,
                        published_url=published_url,
                        platform_content_id=article_id,
                        payload={"title": title, "tags": tags, "category": category},
                    )
                finally:
                    await close_stealth_context(browser, context)
        except Exception as e:
            return PublishResult(
                success=False, platform=self.platform_id,
                error_message=f"publish failed: {type(e).__name__}: {e}",
            )
