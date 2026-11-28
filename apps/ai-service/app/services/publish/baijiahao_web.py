# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""百家号网页版真实发布器（2026-11-27）。

账号 17 的 cookie 能进百家号后台（218 篇历史投稿），但旧适配器仍在用
`input.article-title` / `.ql-editor`，与 2026-11 的真实编辑器不一致。真实编辑器：
- 入口：首页点“发布图文” → `/builder/rc/edit?type=news&is_from_cms=1`
- 标题：页面上唯一一个 `[contenteditable=true]`（Lexical）
- 正文：`.edui-editor-iframeholder iframe` 里的 UEditor `body`
- 封面：点“选择封面”→ `input[type=file][accept="image/*"]` → 点“确定 (1)”
- 发布：点底部“发布”；成功会跳到 `/builder/rc/clue` 并提示“提交成功，正在审核中...”

验收标准：必须拿到 `app_id`（作品 ID）并出现提交成功/审核中提示；公开页
`s?id=<app_id>` 在审核通过前可能 404，payload 里如实记录 `review_status`。
"""
from __future__ import annotations

import re
import tempfile
from pathlib import Path
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
except ImportError:  # pragma: no cover
    _HAS_PLAYWRIGHT = False

_HOME = "https://baijiahao.baidu.com/builder/rc/home"
_EDITOR = "https://baijiahao.baidu.com/builder/rc/edit?type=news&is_from_cms=1"
_DEFAULT_TITLE = "智汇AI社区发布链路验收"


def _make_default_cover(title: str) -> str | None:
    """没有 cover_path 时生成一张品牌封面，避免百家号“请添加封面”拦截。"""
    try:
        from PIL import Image, ImageDraw, ImageFont
    except Exception:
        return None
    try:
        width, height = 1080, 608
        img = Image.new("RGB", (width, height), "#0b1e3a")
        draw = ImageDraw.Draw(img)
        # 纵向渐变
        for y in range(height):
            ratio = y / max(1, height - 1)
            r = int(11 + (26 - 11) * ratio)
            g = int(30 + (115 - 30) * ratio)
            b = int(58 + (232 - 58) * ratio)
            draw.line([(0, y), (width, y)], fill=(r, g, b))
        font_path = Path(r"C:\Windows\Fonts\msyh.ttc")
        if not font_path.is_file():
            font_path = Path(r"C:\Windows\Fonts\simhei.ttf")
        try:
            f_big = ImageFont.truetype(str(font_path), 66)
            f_small = ImageFont.truetype(str(font_path), 30)
        except Exception:
            f_big = ImageFont.load_default()
            f_small = ImageFont.load_default()
        headline = "智汇AI社区"
        draw.text((72, 190), headline, font=f_big, fill="white")
        draw.text((76, 292), "IHUI-AI 发布系统 · 真实验收", font=f_small, fill="#dbeafe")
        # 右下角标题摘要（截断，避免溢出）
        summary = (title or _DEFAULT_TITLE)[:24]
        draw.text((76, 470), summary, font=f_small, fill="#ffffff")
        tmp = Path(tempfile.gettempdir()) / "ihui_baijiahao_cover.png"
        img.save(tmp, "PNG")
        return str(tmp)
    except Exception as e:  # noqa: BLE001
        logger.warning("[baijiahao-web] 生成默认封面失败: %s", e)
        return None


class BaijiahaoWebAdapter(WebArticleAdapter):
    platform_id = "baijiahao"
    platform_name = "百家号"
    home_url = _HOME
    create_url = _HOME
    max_title_len = 64
    max_tags = 0

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

        title = (content.title or _DEFAULT_TITLE)[: self.max_title_len]
        body = _plain_text(content)
        cookies = build_cookie_list(self.platform_id, credentials)
        cover_path = ""
        try:
            if content.cover_path and Path(content.cover_path).is_file():
                cover_path = str(content.cover_path)
            else:
                cover_path = _make_default_cover(title) or ""
        except Exception:
            cover_path = ""

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
                    await page.goto(_EDITOR, wait_until="domcontentloaded", timeout=60000)
                    title_box = page.locator("[contenteditable=true]").first
                    try:
                        await title_box.wait_for(state="visible", timeout=20000)
                    except Exception:
                        title_box = page.locator("[contenteditable=true]").first
                    if "passport" in page.url or "/login" in page.url.lower():
                        return PublishResult(
                            success=False,
                            platform=self.platform_id,
                            error_message=f"百家号登录态无效，被重定向到登录页: {page.url}",
                        )
                    page_text_initial = await page.inner_text("body")
                    if "百度安全验证" in page_text_initial or "安全验证" in page_text_initial:
                        return PublishResult(
                            success=False,
                            platform=self.platform_id,
                            error_message="百家号触发“百度安全验证”，自动化发布被拦截，需人工过一次验证",
                        )

                    if await title_box.count() == 0:
                        # 新版入口叫“发布作品”，先回首页兜底再进编辑器。
                        entry = page.get_by_text(re.compile("发布作品|发布图文")).first
                        if await entry.count() == 0:
                            return PublishResult(
                                success=False,
                                platform=self.platform_id,
                                error_message="百家号后台找不到“发布作品/发布图文”入口",
                            )
                        await entry.click()
                        await page.wait_for_timeout(8000)
                        title_box = page.locator("[contenteditable=true]").first
                    if await title_box.count() == 0:
                        return PublishResult(
                            success=False,
                            platform=self.platform_id,
                            error_message="百家号图文编辑器未加载出标题输入框",
                        )
                    await title_box.fill(title)
                    await page.wait_for_timeout(500)

                    frame_locator = page.frame_locator(".edui-editor-iframeholder iframe")
                    body_box = frame_locator.locator("body").first
                    if await body_box.count() == 0:
                        return PublishResult(
                            success=False,
                            platform=self.platform_id,
                            error_message="百家号正文 UEditor iframe 未加载",
                        )
                    await body_box.fill(body)
                    await page.wait_for_timeout(1000)

                    if cover_path:
                        try:
                            await page.get_by_text("选择封面", exact=True).first.click()
                            await page.wait_for_timeout(2000)
                            file_input = page.locator(
                                'input[type=file][accept="image/*"]'
                            ).first
                            await file_input.set_input_files(cover_path)
                            await page.wait_for_timeout(3500)
                            confirm = page.locator(".cheetah-modal-wrap button").filter(
                                has_text=re.compile("确定")
                            ).last
                            if await confirm.count():
                                await confirm.click()
                                await page.wait_for_timeout(2000)
                            if await page.locator(".cheetah-modal-wrap").count():
                                return PublishResult(
                                    success=False,
                                    platform=self.platform_id,
                                    error_message="百家号封面上传后确认弹层未关闭",
                                )
                        except Exception as e:
                            logger.warning("[baijiahao-web] 封面上传失败: %s", e)
                            return PublishResult(
                                success=False,
                                platform=self.platform_id,
                                error_message=f"百家号封面上传失败: {type(e).__name__}: {e}",
                            )
                    else:
                        return PublishResult(
                            success=False,
                            platform=self.platform_id,
                            error_message="百家号必须设置封面，且默认封面生成失败",
                        )

                    publish_btn = page.locator("button").filter(
                        has_text=re.compile(r"^\s*发布\s*$")
                    ).first
                    await publish_btn.click()
                    await page.wait_for_timeout(6000)
                    submit_url = page.url
                    page_text = await page.inner_text("body")
                    if "请添加封面" in page_text:
                        return PublishResult(
                            success=False,
                            platform=self.platform_id,
                            error_message="百家号仍提示“请添加封面”，发布未提交",
                        )
                    if not ("/builder/rc/clue" in submit_url or "提交成功" in page_text or "审核" in page_text):
                        return PublishResult(
                            success=False,
                            platform=self.platform_id,
                            error_message=(
                                "百家号未出现提交成功/审核中状态，不能算真实提交: "
                                f"url={submit_url} text={page_text[:300].replace(chr(10), ' | ')}"
                            ),
                        )

                    review_status = (
                        "待审核"
                        if ("审核" in page_text or "提交成功" in page_text)
                        else "已提交"
                    )
                    # 成功页会带出账号历史作品里的 app_id，不能拿来当新作品 ID。
                    # 审核中公开页尚不可用，先只承认“已提交”，等公开页可访问再回填 URL。
                    return PublishResult(
                        success=True,
                        platform=self.platform_id,
                        published_url=None,
                        platform_content_id=None,
                        payload={
                            "title": title,
                            "review_status": review_status,
                            "submit_url": submit_url,
                            "cover_path": cover_path,
                            "note": "审核中，公开链接待审核通过后回填；不伪造 app_id",
                        },
                    )
                finally:
                    await close_stealth_context(browser, context)
        except Exception as e:
            logger.exception("[baijiahao-web] publish failed")
            return PublishResult(
                success=False,
                platform=self.platform_id,
                error_message=f"百家号网页发布异常: {type(e).__name__}: {e}",
            )


__all__ = ["BaijiahaoWebAdapter"]
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
