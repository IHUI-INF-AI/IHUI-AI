"""小红书 适配器(基于 Playwright 浏览器自动化框架)。

凭证:{ web_session cookie }

实现:
- verify_credentials: 打开 https://creator.xiaohongshu.com 检查登录态
- publish: 打开 https://creator.xiaohongshu.com/publish/publish → 上传图片 → 填内容 → 点发布

注意:
- 小红书创作者中心仅支持图片笔记和视频笔记,不支持纯文本
- 笔记图片最多 9 张,正文 ≤1000 字,标题 ≤20 字
"""
from __future__ import annotations

from pathlib import Path
from typing import Any

from app.core.logging import get_logger
from ..base_adapter import BasePlatformAdapter, PublishContent, PublishResult

logger = get_logger(__name__)

try:
    from playwright.async_api import async_playwright
    _HAS_PLAYWRIGHT = True
except ImportError:
    _HAS_PLAYWRIGHT = False


class XiaohongshuAdapter(BasePlatformAdapter):
    platform_id = "xiaohongshu"
    platform_name = "小红书"
    supported_formats = ["md", "html", "image", "video"]
    requires_credentials = ["web_session"]
    needs_browser = True

    def _cookies(self, credentials: dict) -> list[dict[str, Any]]:
        return [{
            "name": "web_session",
            "value": credentials.get("web_session", ""),
            "domain": ".xiaohongshu.com",
            "path": "/",
            "httpOnly": True,
            "secure": True,
            "sameSite": "Lax",
        }]

    async def verify_credentials(self, credentials: dict) -> tuple[bool, str]:
        if not _HAS_PLAYWRIGHT:
            return False, "Playwright not installed. Run: pip install playwright && playwright install chromium"
        web_session = credentials.get("web_session", "").strip()
        if not web_session:
            return False, "missing web_session cookie"

        try:
            async with async_playwright() as p:
                browser = await p.chromium.launch(headless=True)
                context = await browser.new_context()
                await context.add_cookies(self._cookies(credentials))
                page = await context.new_page()
                await page.goto(
                    "https://creator.xiaohongshu.com/creator/home",
                    wait_until="networkidle",
                    timeout=30000,
                )
                url = page.url
                await browser.close()
                if "login" in url.lower():
                    return False, "cookie expired (redirected to login)"
                return True, "connected (web_session valid)"
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
                browser = await p.chromium.launch(headless=True)
                context = await browser.new_context()
                await context.add_cookies(self._cookies(credentials))
                page = await context.new_page()

                # 打开发布页
                await page.goto(
                    "https://creator.xiaohongshu.com/publish/publish",
                    wait_until="networkidle",
                    timeout=60000,
                )
                if "login" in page.url.lower():
                    await browser.close()
                    return PublishResult(
                        success=False, platform=self.platform_id,
                        error_message="cookie expired, please refresh web_session",
                    )

                # 上传图片或视频
                if video_path:
                    # 视频笔记
                    upload_tab = page.locator('div:has-text("上传视频"), .tab:has-text("视频")').first
                    if await upload_tab.count() > 0:
                        await upload_tab.click()
                        await page.wait_for_timeout(500)
                    file_input = page.locator('input[type="file"]').first
                    await file_input.set_input_files(video_path)
                else:
                    # 图文笔记
                    file_input = page.locator('input[type="file"]').first
                    valid_images = [str(Path(p)) for p in images if p and Path(p).is_file()]
                    if not valid_images:
                        await browser.close()
                        return PublishResult(
                            success=False, platform=self.platform_id,
                            error_message=f"no valid image files: {images}",
                        )
                    await file_input.set_input_files(valid_images[:9])

                # 等待上传完成
                await page.wait_for_timeout(3000)

                # 填标题
                title_input = page.locator(
                    'input[placeholder*="标题"], #title, .title-input input'
                ).first
                if await title_input.count() > 0:
                    await title_input.fill(title)

                # 填正文
                editor = page.locator(
                    'div[contenteditable="true"], textarea[placeholder*="描述"], #desc'
                ).first
                if await editor.count() > 0:
                    if await editor.evaluate("el => el.tagName") == "TEXTAREA":
                        await editor.fill(text)
                    else:
                        await editor.click()
                        await page.evaluate(
                            """(text) => {
                                const ed = document.querySelector('div[contenteditable="true"], #desc');
                                if (ed) { ed.focus(); document.execCommand('insertText', false, text); }
                            }""",
                            text,
                        )

                # 填话题标签(简化:在文末追加 #标签#)
                if tags:
                    tag_text = " ".join(f"#{t}#" for t in tags[:10])
                    full_text = (text + " " + tag_text)[:1000]
                    if await editor.count() > 0:
                        if await editor.evaluate("el => el.tagName") == "TEXTAREA":
                            await editor.fill(full_text)

                # 点发布
                publish_btn = page.locator(
                    'button:has-text("发布"), .publishBtn, button.publish'
                ).first
                if await publish_btn.count() == 0:
                    await browser.close()
                    return PublishResult(
                        success=False, platform=self.platform_id,
                        error_message="publish button not found",
                    )
                await publish_btn.click()

                # 等待跳转或成功提示
                try:
                    await page.wait_for_url(
                        "**/publish/success**", timeout=30000
                    )
                except Exception:
                    # 也可能弹出 toast
                    success_toast = page.locator(
                        '.toast:has-text("成功"), .message:has-text("成功")'
                    ).first
                    if await success_toast.count() > 0:
                        pass
                    else:
                        await browser.close()
                        return PublishResult(
                            success=False, platform=self.platform_id,
                            error_message="publish timeout (no success indication)",
                        )

                await browser.close()
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
        except Exception as e:
            return PublishResult(
                success=False, platform=self.platform_id,
                error_message=f"publish failed: {type(e).__name__}: {e}",
            )
