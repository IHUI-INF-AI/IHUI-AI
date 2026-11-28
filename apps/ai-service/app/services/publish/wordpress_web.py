# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""WordPress.com 网页版真实发布器（2026-11-27）。

WordPress 账号 20 已经创建并上线了免费站点 `ihuiaicommunity.wordpress.com`。
它的编辑器是 Gutenberg，标题/正文在 `iframe[name=editor-canvas]` 里，发布要走
“打开发布面板 → 确认发布”两段式。基类 PlaywrightBaseAdapter 的选择器都在主页面，
无法直接填 iframe，所以这里单独实现发布流程。

验收标准：发布后 URL 必须变成 `post.php?post=<id>&action=edit`，并且页面出现
“文章已发布”；再拼出公开地址 `https://<site>/?p=<id>` 供验收矩阵核验。
"""
from __future__ import annotations

import asyncio
import os
import re
from html import unescape
from typing import Any

import httpx

from app.core.logging import get_logger

from .anti_risk import human_pause
from .anti_risk.browser_factory import close_stealth_context, create_stealth_browser_context
from .base_adapter import PublishContent, PublishResult
from .cookie_session import build_cookie_list
from .web_fallback import WebArticleAdapter, _plain_text

logger = get_logger(__name__)

try:
    from playwright.async_api import async_playwright

    _HAS_PLAYWRIGHT = True
except ImportError:
    _HAS_PLAYWRIGHT = False

# 站点地址可以由账号凭据里显式写入的 site_url/blog_url 覆盖，也可以由环境变量
# 指定；最后回落到这次实际创建并上线的免费站点。
_DEFAULT_SITE = "ihuiaicommunity.wordpress.com"


def _site_domain(credentials: dict[str, Any]) -> str:
    for key in ("site_url", "blog_url", "site", "domain"):
        value = str(credentials.get(key) or "").strip()
        if value:
            value = re.sub(r"^https?://", "", value).strip("/")
            if value:
                return value
    env = str(os.environ.get("PUBLISH_WORDPRESS_SITE") or "").strip()
    return re.sub(r"^https?://", "", env).strip("/") if env else _DEFAULT_SITE


class WordPressWebAdapter(WebArticleAdapter):
    """在 WordPress.com 的 Gutenberg 编辑器里完成真实发布。"""

    platform_id = "wordpress"
    platform_name = "WordPress"
    home_url = "https://wordpress.com/me"
    create_url = "https://wordpress.com/post"
    title_selector = ".editor-post-title__input"
    editor_selector = ".block-editor-writing-flow"
    publish_selector = ".editor-post-publish-button"
    success_selector = "text=文章已发布"
    max_title_len = 60
    max_tags = 0

    def build_create_url(self, platform_config: dict[str, Any]) -> str:
        site = platform_config.get("site") or platform_config.get("site_url")
        if site:
            site = re.sub(r"^https?://", "", str(site)).strip("/")
        else:
            site = _site_domain({})
        return f"https://{site}/wp-admin/post-new.php?post_type=post"

    async def _verify_public_page(self, url: str, title: str) -> tuple[bool, str]:
        """发布后用无 cookie 的匿名请求核验公开页。

        WordPress 后台提示“文章已发布”不等于公开可访问：站点可能仍处于
        “即将推出”，也可能被缓存/权限挡住。只有匿名 GET 返回 200 且页面里
        能搜到标题，才把这次发布记为成功。
        """
        last = "no attempt"
        headers = {
            "User-Agent": (
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                "AppleWebKit/537.36 (KHTML, like Gecko) "
                "Chrome/131.0.0.0 Safari/537.36"
            ),
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
        }
        for attempt in range(3):
            try:
                async with httpx.AsyncClient(
                    follow_redirects=True,
                    timeout=30.0,
                    headers=headers,
                ) as client:
                    resp = await client.get(url)
                page = unescape(resp.text or "")
                if resp.status_code == 200 and title in page:
                    return True, f"HTTP 200 final={resp.url} len={len(page)}"
                last = f"HTTP {resp.status_code} final={resp.url} len={len(page)} title_found={title in page}"
            except Exception as e:  # noqa: BLE001
                last = f"{type(e).__name__}: {e}"
            if attempt < 2:
                await asyncio.sleep(2)

        # WordPress.com 的 WAF 会对脚本 UA/无浏览器指纹的请求返回 403，
        # 但真实浏览器匿名访问是通的。HTTP 核验失败后必须用浏览器再核一次，
        # 否则会把“公开可访问”误判成失败。
        if _HAS_PLAYWRIGHT:
            try:
                async with async_playwright() as p:
                    browser, context = await create_stealth_browser_context(
                        account_id="wp-public-verify",
                        platform=self.platform_id,
                        playwright_instance=p,
                        headless=True,
                    )
                    try:
                        page = await context.new_page()
                        page.set_default_timeout(45000)
                        resp = await page.goto(url, wait_until="domcontentloaded", timeout=60000)
                        await page.wait_for_timeout(4000)
                        body = await page.inner_text("body")
                        page_title = await page.title()
                        if title in body or title in page_title:
                            status = resp.status if resp else "?"
                            return True, (
                                f"browser HTTP {status} final={page.url} "
                                f"body_title_found={title in body} page_title_found={title in page_title}"
                            )
                        last = (
                            f"browser HTTP {resp.status if resp else '?'} final={page.url} "
                            f"body_title_found={title in body} page_title_found={title in page_title}"
                        )
                    finally:
                        await close_stealth_context(browser, context)
            except Exception as e:  # noqa: BLE001
                last = f"{last}; browser {type(e).__name__}: {e}"
        return False, last

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
                error_message="Playwright not installed",
            )
        site = _site_domain(credentials)
        editor_url = f"https://{site}/wp-admin/post-new.php?post_type=post"
        title = (content.title or "Untitled")[: self.max_title_len]
        body = _plain_text(content)
        cookies = build_cookie_list(self.platform_id, credentials)

        try:
            async with async_playwright() as p:
                browser, context = await create_stealth_browser_context(
                    account_id=self.account_identity(credentials),
                    platform=self.platform_id,
                    playwright_instance=p,
                    headless=True,
                )
                try:
                    await context.add_cookies(cookies)
                    page = await context.new_page()
                    page.set_default_timeout(60000)
                    await human_pause(1.0, 2.0)
                    await page.goto(editor_url, wait_until="domcontentloaded", timeout=60000)
                    await page.wait_for_timeout(9000)

                    if "wp-admin" not in page.url or "login" in page.url.lower():
                        return PublishResult(
                            success=False,
                            platform=self.platform_id,
                            error_message=f"WordPress 后台未登录或站点不存在: {page.url}",
                        )

                    # 首次进入编辑器会出现“欢迎使用编辑器”引导弹层，挡住发布按钮。
                    for _ in range(3):
                        overlay = page.locator(".components-modal__screen-overlay")
                        if await overlay.count() == 0:
                            break
                        modal = page.locator(".components-modal__frame").first
                        close = modal.locator('button[aria-label="关闭"]')
                        if await close.count():
                            await close.first.click()
                            await page.wait_for_timeout(700)
                        else:
                            break

                    frame = page.frame(name="editor-canvas")
                    if frame is None:
                        # 某些构建把 iframe 延迟挂载；等一次再取。
                        await page.wait_for_timeout(3000)
                        frame = page.frame(name="editor-canvas")
                    if frame is None:
                        return PublishResult(
                            success=False,
                            platform=self.platform_id,
                            error_message="找不到 Gutenberg 编辑器 iframe(editor-canvas)",
                        )

                    title_box = frame.locator('h1[role="textbox"]').first
                    if await title_box.count() == 0:
                        return PublishResult(
                            success=False,
                            platform=self.platform_id,
                            error_message="找不到文章标题输入框",
                        )
                    await title_box.fill(title)
                    body_box = frame.locator('p[role="document"]').first
                    if await body_box.count() == 0:
                        return PublishResult(
                            success=False,
                            platform=self.platform_id,
                            error_message="找不到文章正文输入框",
                        )
                    await body_box.fill(body)
                    await page.wait_for_timeout(1500)

                    # 第一段：打开发布面板。
                    toggle = page.locator("button").filter(has_text=re.compile(r"^\s*发布\s*$")).first
                    if await toggle.count() == 0:
                        return PublishResult(
                            success=False,
                            platform=self.platform_id,
                            error_message="找不到发布按钮",
                        )
                    await toggle.click()
                    await page.wait_for_timeout(2000)

                    # 第二段：面板里的最终发布按钮。
                    confirm = page.locator("button.editor-post-publish-button").first
                    if await confirm.count() == 0:
                        return PublishResult(
                            success=False,
                            platform=self.platform_id,
                            error_message="找不到发布面板确认按钮",
                        )
                    await confirm.click()

                    # 发布后 URL 变成 post.php?post=<id>&action=edit。
                    try:
                        await page.wait_for_url(
                            re.compile(r"post\.php\?post=\d+"), timeout=20000
                        )
                    except Exception:
                        pass
                    post_match = re.search(r"post=(\d+)", page.url)
                    if not post_match:
                        return PublishResult(
                            success=False,
                            platform=self.platform_id,
                            error_message=f"发布后未拿到文章 ID: {page.url}",
                        )
                    post_id = post_match.group(1)
                    page_text = await page.inner_text("body")
                    if "文章已发布" not in page_text and "已发布" not in page_text:
                        return PublishResult(
                            success=False,
                            platform=self.platform_id,
                            error_message=f"发布后未出现成功提示: {page.url}",
                        )

                    public_url = f"https://{site}/?p={post_id}"
                    public_ok, public_detail = await self._verify_public_page(public_url, title)
                    if not public_ok:
                        return PublishResult(
                            success=False,
                            platform=self.platform_id,
                            error_message=(
                                f"文章已进入编辑器但公开页核验失败: {public_detail}"
                            ),
                            payload={
                                "title": title,
                                "post_id": post_id,
                                "site": site,
                                "editor_url": page.url,
                                "public_url": public_url,
                            },
                        )
                    return PublishResult(
                        success=True,
                        platform=self.platform_id,
                        published_url=public_url,
                        platform_content_id=post_id,
                        payload={
                            "title": title,
                            "post_id": post_id,
                            "site": site,
                            "editor_url": page.url,
                            "public_verified": True,
                            "public_detail": public_detail,
                        },
                    )
                finally:
                    await close_stealth_context(browser, context)
        except Exception as e:
            logger.exception("[wordpress-web] publish failed")
            return PublishResult(
                success=False,
                platform=self.platform_id,
                error_message=f"WordPress 网页发布失败: {type(e).__name__}: {e}",
            )
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
