"""小红书 适配器(基于 Playwright 浏览器自动化框架)。

凭证:{ web_session cookie }

实现:
- verify_credentials: 打开 https://creator.xiaohongshu.com 检查登录态
- publish: 打开 https://creator.xiaohongshu.com/publish/publish → 上传图片 → 填内容 → 点发布

反风控:接入 anti_risk 五层防线,所有输入/点击走 human_*。

注意:
- 小红书创作者中心仅支持图片笔记和视频笔记,不支持纯文本
- 笔记图片最多 9 张,正文 ≤1000 字,标题 ≤20 字
"""
from __future__ import annotations

import hashlib
from pathlib import Path
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


class XiaohongshuAdapter(BasePlatformAdapter):
    platform_id = "xiaohongshu"
    platform_name = "小红书"
    supported_formats = ["md", "html", "image", "video"]
    requires_credentials = ["web_session"]
    needs_browser = True

    def _cookies(self, credentials: dict[str, Any]) -> list[SetCookieParam]:
        return [{
            "name": "web_session",
            "value": credentials.get("web_session", ""),
            "domain": ".xiaohongshu.com",
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
        web_session = credentials.get("web_session", "").strip()
        if not web_session:
            return False, "missing web_session cookie"

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
                    await page.goto(
                        "https://creator.xiaohongshu.com/creator/home",
                        wait_until="networkidle",
                        timeout=30000,
                    )
                    url = page.url
                    if "login" in url.lower():
                        return False, "cookie expired (redirected to login)"
                    return True, "connected (web_session valid)"
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
        web_session = credentials.get("web_session", "").strip()
        if not web_session:
            return PublishResult(
                success=False, platform=self.platform_id,
                error_message="missing web_session cookie",
            )

        # 小红书需要至少一张图片或一个视频
        images = list(content.images or [])
        video_path = content.file_path if content.format == "video" else None
        if not images and not video_path and not content.cover_path:
            # 没有图片就用 cover_path 作为单图
            if content.cover_path:
                images = [content.cover_path]
            else:
                return PublishResult(
                    success=False, platform=self.platform_id,
                    error_message="xiaohongshu requires at least 1 image or video (cover_path or images)",
                )

        # 标题(≤20 字)
        title = (content.title or "")[:20]
        # 正文(≤1000 字,小红书笔记不需要 HTML)
        text = content.text or ""
        if not text and content.html:
            text = content.html.replace("<p>", "").replace("</p>", "\n").replace("<br>", "\n")
        text = text[:1000]
        # 标签
        tags = platform_config.get("tags", [])

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

                    # 打开发布页
                    await human_pause(1.5, 3.0)
                    await page.goto(
                        "https://creator.xiaohongshu.com/publish/publish",
                        wait_until="networkidle",
                        timeout=60000,
                    )
                    if "login" in page.url.lower():
                        return PublishResult(
                            success=False, platform=self.platform_id,
                            error_message="cookie expired, please refresh web_session",
                        )

                    await simulate_reading(page, min_s=3.0, max_s=8.0)

                    # 上传图片或视频
                    if video_path:
                        # 视频笔记
                        upload_tab_selector = 'div:has-text("上传视频"), .tab:has-text("视频")'
                        if await page.locator(upload_tab_selector).count() > 0:
                            await human_click(page, upload_tab_selector)
                            await page.wait_for_timeout(500)
                        file_input = page.locator('input[type="file"]').first
                        await file_input.set_input_files(video_path)
                    else:
                        # 图文笔记
                        file_input = page.locator('input[type="file"]').first
                        valid_images = [str(Path(p)) for p in images if p and Path(p).is_file()]
                        if not valid_images:
                            return PublishResult(
                                success=False, platform=self.platform_id,
                                error_message=f"no valid image files: {images}",
                            )
                        await file_input.set_input_files(valid_images[:9])

                    # 等待上传完成
                    await page.wait_for_timeout(3000)
                    await human_pause(1.0, 2.0)

                    # 填标题(人类化逐字符)
                    title_selector = 'input[placeholder*="标题"], #title, .title-input input'
                    if await page.locator(title_selector).count() > 0:
                        await human_type(page, title, title_selector)
                        await human_pause(0.5, 1.0)

                    # 填正文 + 话题标签(人类化)
                    editor_selector = 'div[contenteditable="true"], textarea[placeholder*="描述"], #desc'
                    if await page.locator(editor_selector).count() > 0:
                        tag_name = await page.locator(editor_selector).first.evaluate("el => el.tagName")
                        if tag_name == "TEXTAREA":
                            # 标签追加到正文末尾(保留原逻辑)
                            tag_text = " ".join(f"#{t}#" for t in tags[:10]) if tags else ""
                            full_text = (text + " " + tag_text).strip()[:1000] if tag_text else text[:1000]
                            await page.locator(editor_selector).first.click()
                            paragraphs = full_text.split("\n")
                            for i, para in enumerate(paragraphs):
                                if i > 0:
                                    await page.keyboard.press("Enter")
                                    await human_pause(0.3, 0.6)
                                await human_type(page, para, None)
                        else:
                            # contenteditable:仅插入正文(保留原逻辑,不追加标签)
                            await page.locator(editor_selector).first.click()
                            await human_pause(0.3, 0.6)
                            await page.evaluate(
                                """(text) => {
                                    const ed = document.querySelector('div[contenteditable="true"], #desc');
                                    if (ed) { ed.focus(); document.execCommand('insertText', false, text); }
                                }""",
                                text,
                            )

                    # 模拟阅读检查(人类发布前预览)
                    await simulate_reading(page, min_s=2.0, max_s=5.0)
                    await human_pause(1.0, 2.0)

                    # 点发布(人类化)
                    publish_selector = 'button:has-text("发布"), .publishBtn, button.publish'
                    if await page.locator(publish_selector).count() == 0:
                        return PublishResult(
                            success=False, platform=self.platform_id,
                            error_message="publish button not found",
                        )
                    await human_click(page, publish_selector)

                    # 等待跳转或成功提示
                    try:
                        await page.wait_for_url("**/publish/success**", timeout=30000)
                    except Exception:
                        # 也可能弹出 toast
                        success_toast = page.locator('.toast:has-text("成功"), .message:has-text("成功")').first
                        if await success_toast.count() > 0:
                            pass
                        else:
                            return PublishResult(
                                success=False, platform=self.platform_id,
                                error_message="publish timeout (no success indication)",
                            )

                    # 小红书不直接返回笔记 URL,需要在创作者后台查看
                    return PublishResult(
                        success=True, platform=self.platform_id,
                        published_url="",
                        platform_content_id="",
                        payload={
                            "title": title,
                            "tags": tags,
                            "images_count": len(images),
                            "is_video": bool(video_path),
                            "note": "笔记已发布,审核通过后可在小红书 App 查看",
                        },
                    )
                finally:
                    await close_stealth_context(browser, context)
        except Exception as e:
            return PublishResult(
                success=False, platform=self.platform_id,
                error_message=f"publish failed: {type(e).__name__}: {e}",
            )