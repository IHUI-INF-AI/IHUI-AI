"""网易号 适配器(基于 Playwright + 反风控五层防线)。

网易号是网易系内容创作平台(mp.163.com),风控较严,本适配器完整接入反风控五层防线:
  stealth 反检测 / 指纹隔离 / 行为人类化 / 代理池 / 账号 profile 持久化。

凭证:{ P_INFO, S_INFO, NTES_SESS }  — 均为 .163.com 域 cookie(网易登录态)

实现:
- verify_credentials: 打开 https://mp.163.com 检查登录态
- publish: 打开 https://mp.163.com/editor/article.html
          → 人类化填标题 → 分段填正文(富文本 execCommand)→ 选分类 → 填标签
          → 上传封面 → 模拟阅读 → 人类化点发布 → 等待成功信号

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


_CREATOR_URL = "https://mp.163.com"
_EDIT_URL = "https://mp.163.com/editor/article.html"
_TITLE_SELECTOR = "input.article-title"
_EDITOR_SELECTOR = ".article-editor [contenteditable=\"true\"], [contenteditable=\"true\"]"
_CATEGORY_SELECTOR = "select.category"
_TAG_SELECTOR = "input[placeholder*=\"标签\"]"
_PUBLISH_SELECTOR = "button:has-text(\"发布\")"
_SUCCESS_SELECTOR = (
    ".el-message--success, .toast-success, .success-tip, "
    ".ant-message-success, .msg-success"
)


class NeteaseAdapter(BasePlatformAdapter):
    """网易号适配器。"""

    platform_id = "netease"
    platform_name = "网易号"
    supported_formats = ["md", "html", "image"]
    requires_credentials = ["P_INFO", "S_INFO", "NTES_SESS"]
    needs_browser = True

    def _cookies(self, credentials: dict[str, Any]) -> list[SetCookieParam]:
        return [
            {
                "name": "P_INFO",
                "value": credentials.get("P_INFO", ""),
                "domain": ".163.com",
                "path": "/",
                "httpOnly": True,
            },
            {
                "name": "S_INFO",
                "value": credentials.get("S_INFO", ""),
                "domain": ".163.com",
                "path": "/",
            },
            {
                "name": "NTES_SESS",
                "value": credentials.get("NTES_SESS", ""),
                "domain": ".163.com",
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
        p_info = credentials.get("P_INFO", "").strip()
        if not p_info:
            return False, "missing P_INFO cookie"

        try:
            async with async_playwright() as p:
                browser, context = await create_stealth_browser_context(
                    account_id=self._account_id(credentials, p_info),
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
                    return True, "connected (P_INFO valid)"
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
        p_info = credentials.get("P_INFO", "").strip()
        if not p_info:
            return PublishResult(
                success=False,
                platform=self.platform_id,
                error_message="missing P_INFO cookie",
            )

        title = (content.title or "Untitled")[:80]
        body_text = content.html or content.text or ""
        tags = [str(t) for t in platform_config.get("tags", [])][:5]
        category = platform_config.get("category", "")

        try:
            async with async_playwright() as p:
                browser, context = await create_stealth_browser_context(
                    account_id=self._account_id(credentials, p_info),
                    platform=self.platform_id,
                    playwright_instance=p,
                    headless=True,
                )
                try:
                    await context.add_cookies(self._cookies(credentials))
                    page = await context.new_page()

                    await human_pause(1.5, 3.0)
                    await page.goto(_EDIT_URL, wait_until="networkidle", timeout=60000)
                    await simulate_reading(page, min_s=15.0, max_s=45.0)

                    if "login" in page.url.lower():
                        return PublishResult(
                            success=False,
                            platform=self.platform_id,
                            error_message="cookie expired, please refresh P_INFO/S_INFO/NTES_SESS",
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
                                const ed = document.querySelector(
                                    '.article-editor [contenteditable="true"], [contenteditable="true"]');
                                if (ed) { ed.focus(); document.execCommand('insertText', false, text); }
                            }""",
                            text,
                        )
                        await page.keyboard.press("Enter")
                        await human_pause(0.5, 1.2)

                    # 分类(可选)
                    if category:
                        try:
                            cat_select = page.locator(_CATEGORY_SELECTOR).first
                            if await cat_select.count() > 0:
                                await cat_select.select_option(label=str(category))
                                await human_pause(0.3, 0.6)
                        except Exception as e:
                            logger.warning(
                                "[%s] category select failed: %s", self.platform_id, e
                            )

                    # 标签(逐个人类化输入 + 回车确认)
                    if tags:
                        for tag in tags:
                            await human_type(page, tag, _TAG_SELECTOR)
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

                    # 等待发布完成:URL 离开编辑页 或 成功提示
                    try:
                        await page.wait_for_load_state("networkidle", timeout=30000)
                    except Exception as e:
                        logger.debug(
                            "[%s] post-publish networkidle wait: %s",
                            self.platform_id,
                            e,
                        )
                    published = False
                    if "/editor/article" not in page.url and "login" not in page.url.lower():
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
                        payload={"title": title, "tags": tags, "category": category},
                    )
                finally:
                    await close_stealth_context(browser, context)
        except Exception as e:
            return PublishResult(
                success=False,
                platform=self.platform_id,
                error_message=f"publish failed: {type(e).__name__}: {e}",
            )