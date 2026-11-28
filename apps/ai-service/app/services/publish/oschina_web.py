# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""开源中国（OSChina）网页版真实发布器（2026-11-27）。

账号 28 的 cookie 能进个人空间，但旧版 `/blog/write` 已经 404。真实入口在
个人空间的“智写平台”：`https://my.oschina.net/u/<uid>/blog/ai-write`。
编辑器是 Tiptap（`.ProseMirror.aie-content`），标题是 `input.title-input`，
点“发布文章”后会弹出文章来源/分类/权限面板，再点“确定并发布”才真正提交。

验收标准：提交后 URL 必须变成 `/blog/<post_id>`，页面里能看到标题和正文；
如果页面显示“待审核/审核中”，仍然算真实提交成功，但 payload 里要如实记录
审核状态，不能把待审核说成已公开。
"""
from __future__ import annotations

import re
from typing import Any

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
except ImportError:  # pragma: no cover - 仅缺依赖时走到
    _HAS_PLAYWRIGHT = False

_DEFAULT_SPACE = "https://my.oschina.net/u/9284031"


def _space_url(credentials: dict[str, Any], platform_config: dict[str, Any]) -> str:
    """优先用账号里落库的个人空间地址，其次平台配置，最后回落到当前账号。"""
    for source in (credentials, platform_config):
        for key in ("space_url", "site_url", "home_url", "blog_url"):
            value = str(source.get(key) or "").strip()
            if value:
                value = re.sub(r"/blog/ai-write/?$", "", value)
                return value.rstrip("/")
    return _DEFAULT_SPACE


class OSChinaWebAdapter(WebArticleAdapter):
    """在开源中国“智写平台”里完成真实发布。"""

    platform_id = "oschina"
    platform_name = "开源中国"
    home_url = "https://my.oschina.net/"
    create_url = f"{_DEFAULT_SPACE}/blog/ai-write"
    title_selector = "input.title-input"
    editor_selector = ".ProseMirror.aie-content"
    publish_selector = "button.publish-btn"
    success_selector = "text=发布成功"
    max_title_len = 80
    max_tags = 0

    def build_create_url(self, platform_config: dict[str, Any]) -> str:
        return f"{_space_url({}, platform_config)}/blog/ai-write"

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

        space = _space_url(credentials, platform_config)
        editor_url = f"{space}/blog/ai-write"
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
                    await page.wait_for_timeout(3000)

                    if "passport" in page.url or "login" in page.url.lower():
                        return PublishResult(
                            success=False,
                            platform=self.platform_id,
                            error_message=f"开源中国登录态无效，被重定向到登录页: {page.url}",
                        )

                    try:
                        await page.wait_for_selector(
                            "input.title-input", timeout=20000, state="visible"
                        )
                        await page.wait_for_selector(
                            ".ProseMirror.aie-content", timeout=20000, state="visible"
                        )
                    except Exception:
                        return PublishResult(
                            success=False,
                            platform=self.platform_id,
                            error_message=(
                                "开源中国智写平台编辑器未加载: "
                                f"url={page.url} title={await page.title()}"
                            ),
                        )

                    title_box = page.locator("input.title-input").first
                    await title_box.fill(title)
                    editor = page.locator(".ProseMirror.aie-content").first
                    await editor.fill(body)
                    await page.wait_for_timeout(1000)

                    # 第一段：打开发布设置面板。
                    publish_btn = page.locator("button.publish-btn").first
                    if await publish_btn.count() == 0:
                        return PublishResult(
                            success=False,
                            platform=self.platform_id,
                            error_message="找不到“发布文章”按钮",
                        )
                    await publish_btn.click()
                    await page.wait_for_timeout(3000)
                    pop_count = await page.locator(".ant-popover").count()
                    pop_text = ""
                    if pop_count:
                        try:
                            pop_text = (await page.locator(".ant-popover").first.inner_text())[:200]
                        except Exception:
                            pass
                    logger.info(
                        "[oschina-web] 发布面板 popover=%s text=%r",
                        pop_count,
                        pop_text.replace("\n", " | "),
                    )

                    # 第二段：面板里的“确定并发布”。面板是异步挂载的，
                    # 不能只 count 一次；先等可见，再点。部分账号可能没有面板，
                    # 此时直接走 URL 变化判定。
                    confirm = page.locator("button").filter(
                        has_text=re.compile(r"确定并发布")
                    ).first
                    try:
                        await confirm.wait_for(state="visible", timeout=10000)
                    except Exception:
                        pass
                    if await confirm.count():
                        await confirm.click()
                        await page.wait_for_timeout(2500)

                    try:
                        await page.wait_for_url(
                            re.compile(r"/blog/\d+(?:\?.*)?$"), timeout=25000
                        )
                    except Exception:
                        pass

                    post_match = re.search(r"/blog/(\d+)", page.url)
                    if not post_match:
                        try:
                            await page.screenshot(
                                path=r"C:\IHUI-AI\.ihui-agent\tmp\oschina_web_fail.png"
                            )
                        except Exception:
                            pass
                        page_text = (await page.inner_text("body"))[:400].replace("\n", " | ")
                        return PublishResult(
                            success=False,
                            platform=self.platform_id,
                            error_message=(
                                "发布后未进入文章页，可能仍在审核弹窗/编辑器: "
                                f"url={page.url} popover={pop_text!r} text={page_text}"
                            ),
                        )

                    post_id = post_match.group(1)
                    # URL 变了不等于 React 已经渲染完文章页；新账号的详情页
                    # 往往先出骨架再填标题/正文，必须等标题真正出现在 DOM 里。
                    try:
                        await page.wait_for_function(
                            "(t) => document.body && document.body.innerText.includes(t)",
                            arg=title,
                            timeout=15000,
                        )
                    except Exception:
                        pass
                    page_text = await page.inner_text("body")
                    if title not in page_text:
                        try:
                            await page.screenshot(
                                path=r"C:\IHUI-AI\.ihui-agent\tmp\oschina_web_title_missing.png"
                            )
                        except Exception:
                            pass
                        return PublishResult(
                            success=False,
                            platform=self.platform_id,
                            error_message=(
                                f"发布后文章页未找到标题，不能算成功: post={post_id} "
                                f"url={page.url} text={page_text[:300].replace(chr(10), ' | ')}"
                            ),
                        )

                    review_status = (
                        "待审核"
                        if ("待审核" in page_text or "审核中" in page_text)
                        else "已发布"
                    )
                    public_url = f"{space}/blog/{post_id}"
                    return PublishResult(
                        success=True,
                        platform=self.platform_id,
                        published_url=public_url,
                        platform_content_id=post_id,
                        payload={
                            "title": title,
                            "post_id": post_id,
                            "space": space,
                            "editor_url": editor_url,
                            "post_url": page.url,
                            "review_status": review_status,
                        },
                    )
                finally:
                    await close_stealth_context(browser, context)
        except Exception as e:
            logger.exception("[oschina-web] publish failed")
            return PublishResult(
                success=False,
                platform=self.platform_id,
                error_message=f"开源中国网页发布异常: {type(e).__name__}: {e}",
            )


__all__ = ["OSChinaWebAdapter"]
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
