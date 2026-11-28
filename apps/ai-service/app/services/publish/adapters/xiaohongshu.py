# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

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

import asyncio
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


def _extract_note_id(value: Any) -> str:
    """从小红书 web_api/sns/v2/note 响应中提取 note_id（字段名随版本变化）。"""
    if isinstance(value, dict):
        for key in ("note_id", "noteId", "noteid", "noteID"):
            if value.get(key):
                return str(value[key])
        for item in value.values():
            found = _extract_note_id(item)
            if found:
                return found
    elif isinstance(value, list):
        for item in value:
            found = _extract_note_id(item)
            if found:
                return found
    return ""

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
        jar = credentials.get("__cookie_jar__") or []
        if isinstance(jar, list) and jar:
            out: list[SetCookieParam] = []
            for c in jar:
                if not isinstance(c, dict) or not c.get("name"):
                    continue
                out.append({
                    "name": str(c.get("name")),
                    "value": str(c.get("value") or ""),
                    "domain": str(c.get("domain") or ".xiaohongshu.com"),
                    "path": str(c.get("path") or "/"),
                    "expires": float(c["expires"]) if c.get("expires") not in (None, "") else -1,
                    "httpOnly": bool(c.get("httpOnly", False)),
                    "secure": bool(c.get("secure", False)),
                    "sameSite": str(c.get("sameSite") or "Lax"),
                })
            if any(c["name"] == "web_session" for c in out):
                return out
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
        """账号唯一 ID(反风控 profile/指纹的稳定锚点)—— 委托唯一出口,禁止在此另算。"""
        return self.account_identity(credentials)

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
                    use_persistent=False,
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
                        # 图文笔记：默认落在「上传视频」tab，必须先点「上传图文」；
                        # 否则把 jpg 塞进视频 input 会静默失败，页面仍是视频上传态。
                        switched = False
                        tabs = page.locator('div.creator-tab:has-text("上传图文"):not([aria-hidden="true"])')
                        for i in range(min(await tabs.count(), 6)):
                            tab = tabs.nth(i)
                            try:
                                box = await tab.bounding_box()
                                if box and box.get("x", 0) > 250:
                                    await tab.click()
                                    switched = True
                                    await page.wait_for_timeout(1200)
                                    break
                            except Exception:
                                continue
                        if not switched:
                            logger.warning("[xiaohongshu] 上传图文 tab 未找到，继续用首个 file input")
                        file_input = page.locator('input[type="file"][accept*="image"]').first
                        if await file_input.count() == 0:
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
                    # 图片上传后会弹「图片可以编辑啦」功能引导，按钮「我知道了」会盖住
                    # 发布区；不关闭时点发布只会保存草稿/无响应（2026-11-26 实测）。
                    guide_btn = page.locator("button.feature-guide__btn, .feature-guide__btn").first
                    if await guide_btn.count() > 0:
                        try:
                            if await guide_btn.is_visible():
                                await guide_btn.click()
                                await page.wait_for_timeout(400)
                        except Exception:
                            pass
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

                    # 点发布（人类化）
                    # 新版小红书底部提交按钮不在常规 DOM 文本树里（视觉为红色「发布」，
                    # 但 div.btn-inner/button:text-is("发布") 均匹配 0），实测
                    # elementFromPoint 命中视口底部正中并点击可触发发布。
                    # 同时监听 web_api/sns/v2/note 响应，回填 note_id。
                    publish_response: dict[str, Any] = {}

                    async def _on_publish_response(resp: Any) -> None:
                        if "/web_api/sns/v2/note" not in resp.url or resp.request.method != "POST":
                            return
                        publish_response["status"] = resp.status
                        publish_response["url"] = resp.url
                        try:
                            publish_response["json"] = await resp.json()
                        except Exception:
                            try:
                                publish_response["text"] = (await resp.text())[:4000]
                            except Exception:
                                pass

                    page.on("response", _on_publish_response)

                    publish_selector = (
                        'div.btn-inner:text-is("发布"), '
                        'div.btn-wrapper:text-is("发布"), '
                        'button:text-is("发布")'
                    )
                    if await page.locator(publish_selector).count() > 0:
                        await human_click(page, publish_selector)
                    else:
                        viewport = page.viewport_size or {"width": 1536, "height": 864}
                        await page.mouse.click(viewport["width"] / 2, viewport["height"] * 0.944)

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

                    # 小红书发布成功页不回传 note_id，从 web_api/sns/v2/note 响应回填；
                    # 响应字段随版本变化，递归找 note_id/noteId。
                    await asyncio.sleep(1.5)
                    note_id = (
                        _extract_note_id(publish_response.get("json") or {})
                        or _extract_note_id(publish_response.get("text") or "")
                    )
                    xsec_token = ""
                    if not note_id:
                        # 发布响应不一定回传 note_id；直接 fetch 创作者接口缺签名头会返回
                        # {"code":-1}。改为让创作者后台自己发请求，再用 response 监听
                        # 捕获 latest_note_data / posted 列表，按标题匹配。
                        home_payload: dict[str, Any] = {}
                        posted_payload: dict[str, Any] = {}

                        async def _on_creator_response(resp: Any) -> None:
                            if "latest_note_data" in resp.url:
                                try:
                                    home_payload["json"] = await resp.json()
                                except Exception:
                                    pass
                            elif "creator/note/user/posted" in resp.url:
                                try:
                                    posted_payload["json"] = await resp.json()
                                except Exception:
                                    pass

                        page.on("response", _on_creator_response)
                        try:
                            await page.goto(
                                "https://creator.xiaohongshu.com/new/home",
                                wait_until="networkidle",
                                timeout=45000,
                            )
                            await asyncio.sleep(2.0)
                            note_info = (
                                ((home_payload.get("json") or {}).get("data") or {}).get("noteInfo")
                                or {}
                            )
                            if str(note_info.get("title") or "").strip() == title.strip() and note_info.get("id"):
                                note_id = str(note_info["id"])
                                xsec_token = str(note_info.get("xsec_token") or "")
                            if not note_id:
                                await page.goto(
                                    "https://creator.xiaohongshu.com/new/note-manager",
                                    wait_until="networkidle",
                                    timeout=45000,
                                )
                                await asyncio.sleep(2.0)
                                notes = (
                                    ((posted_payload.get("json") or {}).get("data") or {}).get("notes")
                                    or []
                                )
                                for note in notes:
                                    if str(note.get("display_title") or "").strip() == title.strip():
                                        note_id = str(note.get("id") or "")
                                        xsec_token = str(note.get("xsec_token") or "")
                                        break
                        except Exception as exc:
                            logger.warning("[xiaohongshu] note_id fallback failed: %s", exc)
                    published_url = ""
                    if note_id:
                        published_url = f"https://www.xiaohongshu.com/explore/{note_id}"
                        if xsec_token:
                            published_url += f"?xsec_token={xsec_token}&xsec_source=pc_creatormng"
                    return PublishResult(
                        success=True, platform=self.platform_id,
                        published_url=published_url,
                        platform_content_id=note_id,
                        payload={
                            "title": title,
                            "tags": tags,
                            "images_count": len(images),
                            "is_video": bool(video_path),
                            "note": "笔记已发布,审核通过后可在小红书 App 查看",
                            "publish_api": {
                                "status": publish_response.get("status"),
                                "url": publish_response.get("url"),
                            },
                        },
                    )
                finally:
                    await close_stealth_context(browser, context)
        except Exception as e:
            return PublishResult(
                success=False, platform=self.platform_id,
                error_message=f"publish failed: {type(e).__name__}: {e}",
            )
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
