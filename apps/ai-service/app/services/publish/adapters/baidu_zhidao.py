"""百度知道 适配器(基于 Playwright + 反风控五层防线)。

百度知道是百度系问答平台,与百家号共用 BDUSS/STOKEN 凭证。

凭证:{ BDUSS, STOKEN } — 均为 .baidu.com 域 httpOnly cookie

实现:
- verify_credentials: 打开 https://zhidao.baidu.com 检查登录态(是否跳登录页)
- publish: 打开 https://zhidao.baidu.com/ask → 人类化填标题/正文 → 提交问题

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


_CREATOR_URL = "https://zhidao.baidu.com"
_ASK_URL = "https://zhidao.baidu.com/ask"
_TITLE_SELECTOR = 'input[placeholder*="问"], input.ask-title, #title'
_EDITOR_SELECTOR = '.ql-editor, [contenteditable="true"], textarea.editor-content'
_PUBLISH_SELECTOR = 'button:has-text("提交"), button:has-text("发布"), .ask-submit-btn'
_SUCCESS_SELECTOR = (
    '.success-tip, .msg-success, .el-message--success, '
    '.ant-message-success'
)


class BaiduZhidaoAdapter(BasePlatformAdapter):
    """百度知道适配器。"""

    platform_id = "baidu_zhidao"
    platform_name = "百度知道"
    supported_formats = ["md", "html", "image"]
    requires_credentials = ["BDUSS", "STOKEN"]
    needs_browser = True

    def _cookies(self, credentials: dict[str, Any]) -> list[SetCookieParam]:
        return [
            {
                "name": "BDUSS",
                "value": credentials.get("BDUSS", ""),
                "domain": ".baidu.com",
                "path": "/",
                "httpOnly": True,
            },
            {
                "name": "STOKEN",
                "value": credentials.get("STOKEN", ""),
                "domain": ".baidu.com",
                "path": "/",
                "httpOnly": True,
            },
        ]

    def _account_id(self, credentials: dict[str, Any], primary: str) -> str:
        """生成反风控账号标识(同账号跨会话稳定,绑定固定指纹/代理)。"""
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
        bduss = credentials.get("BDUSS", "").strip()
        if not bduss:
            return False, "missing BDUSS cookie"

        try:
            async with async_playwright() as p:
                browser, context = await create_stealth_browser_context(
                    account_id=self._account_id(credentials, bduss),
                    platform=self.platform_id,
                    playwright_instance=p,
                    headless=True,
                )
                try:
                    await context.add_cookies(self._cookies(credentials))
                    page = await context.new_page()
                    await human_pause(1.0, 2.0)
                    await page.goto(_CREATOR_URL, wait_until="networkidle", timeout=30000)
                    url = page.url
                    content_text = await page.content()
                    if "login" in url.lower() or "/login" in url:
                        return False, "cookie expired (redirected to login)"
                    if "退出" not in content_text and "logout" not in content_text.lower():
                        return False, "cookie may be expired (no logout button)"
                    return True, "connected (BDUSS valid)"
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
        bduss = credentials.get("BDUSS", "").strip()
        if not bduss:
            return PublishResult(
                success=False,
                platform=self.platform_id,
                error_message="missing BDUSS cookie",
            )

        title = (content.title or "Untitled")[:50]
        body_text = content.html or content.text or ""
        tags = [str(t) for t in platform_config.get("tags", [])][:5]

        try:
            async with async_playwright() as p:
                browser, context = await create_stealth_browser_context(
                    account_id=self._account_id(credentials, bduss),
                    platform=self.platform_id,
                    playwright_instance=p,
                    headless=True,
                )
                try:
                    await context.add_cookies(self._cookies(credentials))
                    page = await context.new_page()

                    await human_pause(1.5, 3.0)
                    await page.goto(_ASK_URL, wait_until="networkidle", timeout=60000)
                    await simulate_reading(page, min_s=10.0, max_s=30.0)

                    if "login" in page.url.lower():
                        return PublishResult(
                            success=False,
                            platform=self.platform_id,
                            error_message="cookie expired, please refresh BDUSS/STOKEN",
                        )

                    # 标题(人类化逐字输入)
                    await human_type(page, title, _TITLE_SELECTOR)
                    await human_pause(0.5, 1.0)

                    # 正文(富文本:聚焦后分段 execCommand insertText,段间人类化停顿)
                    await human_click(page, _EDITOR_SELECTOR)
                    await human_pause(0.3, 0.6)
                    for paragraph in body_text.split("\n\n"):
                        text = paragraph.strip()
                        if not text:
                            continue
                        await page.evaluate(
                            """(text) => {
                                const ed = document.querySelector('.ql-editor, [contenteditable="true"], textarea.editor-content');
                                if (ed) { ed.focus(); document.execCommand('insertText', false, text); }
                            }""",
                            text,
                        )
                        await page.keyboard.press("Enter")
                        await human_pause(0.5, 1.2)

                    # 标签(逐个人类化输入 + 回车确认)
                    if tags:
                        tag_selector = 'input[placeholder*="标签"], input[placeholder*="tag"]'
                        for tag in tags:
                            await human_type(page, tag, tag_selector)
                            await page.keyboard.press("Enter")
                            await human_pause(0.4, 0.8)

                    # 封面上传(可选)
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

                    # 发布前模拟阅读预览
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
                    if "/ask" not in page.url and "login" not in page.url.lower():
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
                        payload={"title": title, "tags": tags},
                    )
                finally:
                    await close_stealth_context(browser, context)
        except Exception as e:
            return PublishResult(
                success=False,
                platform=self.platform_id,
                error_message=f"publish failed: {type(e).__name__}: {e}",
            )
