# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE).

"""抖音创作者网页发布器(2026-11-27)。

抖音开放平台需要企业资质和视频发布权限;当前账号池只有有效网页 cookie,
原生 API 适配器缺 access_token,完全发不了。这里用创作者后台真实发布链路:
上传视频 → 进入作品发布页 → 填作品描述 → 点发布 → 从内容管理取作品 ID。

边界:只做视频;失败必须返回真实错误,不伪造成功。
"""
from __future__ import annotations

import re
from pathlib import Path
from typing import Any

from app.core.logging import get_logger

from .anti_risk import create_stealth_browser_context, human_pause, simulate_reading
from .anti_risk.browser_factory import close_stealth_context
from .base_adapter import BasePlatformAdapter, PublishContent, PublishResult
from .cookie_session import build_cookie_list, verify_cookie_session

logger = get_logger(__name__)

try:
    from playwright.async_api import async_playwright

    _HAS_PLAYWRIGHT = True
except ImportError:  # pragma: no cover
    _HAS_PLAYWRIGHT = False


class DouyinWebAdapter(BasePlatformAdapter):
    platform_id = "douyin"
    platform_name = "抖音"
    supported_formats = ["video"]
    requires_credentials: list[str] = []
    needs_browser = True

    upload_url = "https://creator.douyin.com/creator-micro/content/upload"
    manage_url = "https://creator.douyin.com/creator-micro/content/manage"

    async def verify_credentials(self, credentials: dict[str, Any]) -> tuple[bool, str]:
        return await verify_cookie_session(
            account_id=self.db_account_id,
            platform=self.platform_id,
            credentials=credentials,
        )

    @staticmethod
    def _video_path(content: PublishContent) -> Path | None:
        raw = content.file_path or ""
        path = Path(str(raw)) if raw else None
        if path and path.exists() and path.is_file():
            return path
        return None

    async def _latest_work(self, page: Any) -> dict[str, Any] | None:
        """发布成功后从作品列表接口取最新作品(aweme_id/状态/分享链接)。"""
        try:
            async with page.expect_response(
                lambda r: "work_list" in r.url and "count=12" in r.url,
                timeout=30000,
            ) as resp_info:
                await page.goto(self.manage_url, wait_until="domcontentloaded", timeout=60000)
            resp = await resp_info.value
            data = await resp.json()
            items = data.get("aweme_list") or []
            if items:
                return items[0]
        except Exception as e:  # noqa: BLE001
            logger.warning("douyin.web 读取作品列表失败: %s", e)
        return None

    async def publish(
        self,
        content: PublishContent,
        credentials: dict[str, Any],
        platform_config: dict[str, Any],
    ) -> PublishResult:
        if not _HAS_PLAYWRIGHT:
            return PublishResult(
                success=False, platform=self.platform_id,
                error_message="playwright not installed",
            )
        video = self._video_path(content)
        if video is None:
            return PublishResult(
                success=False, platform=self.platform_id,
                error_message="douyin web publish requires an existing video file",
            )
        title = (content.title or "").strip()
        body = (content.text or "").strip()
        text = title
        if body and body not in title:
            text = f"{title}\n{body}" if title else body
        text = text.strip()[:1000]

        cookies = build_cookie_list(self.platform_id, credentials)
        if not cookies:
            return PublishResult(
                success=False, platform=self.platform_id,
                error_message="douyin web cookie missing",
            )

        async with async_playwright() as p:
            browser, context = await create_stealth_browser_context(
                account_id=self.db_account_id,
                platform=self.platform_id,
                playwright_instance=p,
                headless=True,
            )
            try:
                await context.add_cookies(cookies)
                page = await context.new_page()
                await page.goto(self.upload_url, wait_until="domcontentloaded", timeout=60000)
                await page.wait_for_timeout(3000)
                if "login" in page.url.lower():
                    return PublishResult(
                        success=False, platform=self.platform_id,
                        error_message="douyin creator login expired",
                    )

                file_input = page.locator('input[type=file]').first
                if await file_input.count() == 0:
                    return PublishResult(
                        success=False, platform=self.platform_id,
                        error_message="douyin upload input not found",
                    )
                await simulate_reading(page, min_s=2.0, max_s=4.0)
                await file_input.set_input_files(str(video))

                # 上传完成后 URL 进入 /content/post/video。
                for _ in range(36):
                    if "/content/post/video" in page.url:
                        break
                    await page.wait_for_timeout(5000)
                else:
                    return PublishResult(
                        success=False, platform=self.platform_id,
                        error_message="douyin video upload timeout (post form not opened)",
                    )
                await page.wait_for_timeout(2000)

                editor = page.locator("[contenteditable=true]").first
                if await editor.count() == 0:
                    return PublishResult(
                        success=False, platform=self.platform_id,
                        error_message="douyin description editor not found",
                    )
                await editor.click()
                await page.keyboard.insert_text(text)
                await page.wait_for_timeout(1000)

                publish_btn = (
                    page.locator("button:visible")
                    .filter(has_text=re.compile(r"^发布$"))
                    .first
                )
                if await publish_btn.count() == 0:
                    return PublishResult(
                        success=False, platform=self.platform_id,
                        error_message="douyin publish button not found",
                    )
                await publish_btn.click()
                await page.wait_for_timeout(1000)

                # 可能出现二次确认弹层。
                confirm = (
                    page.locator("button:visible")
                    .filter(has_text=re.compile(r"^(确认发布|确定发布|发布)$"))
                    .last
                )
                if await confirm.count() > 0 and await confirm.is_visible():
                    try:
                        await confirm.click(timeout=3000)
                    except Exception:
                        pass

                for _ in range(24):
                    if "post/video" not in page.url:
                        break
                    body_text = ""
                    try:
                        body_text = await page.locator("body").first.inner_text()
                    except Exception:
                        pass
                    if "发布成功" in body_text:
                        break
                    await page.wait_for_timeout(5000)
                else:
                    return PublishResult(
                        success=False, platform=self.platform_id,
                        error_message="douyin publish timeout (no success signal)",
                    )

                await human_pause(0.5, 1.0)
                work = await self._latest_work(page)
                aweme_id = str((work or {}).get("aweme_id") or "")
                status = (work or {}).get("status") if isinstance(work, dict) else {}
                status = status if isinstance(status, dict) else {}
                reviewing = bool(status.get("in_reviewing"))
                restricted = bool(status.get("is_private") or status.get("is_prohibited") or status.get("is_delete"))
                share_url = str((work or {}).get("share_url") or "")
                public_url = ""
                if aweme_id and not restricted:
                    public_url = (
                        share_url
                        if share_url.startswith("http")
                        else f"https://www.douyin.com/video/{aweme_id}"
                    )
                payload: dict[str, Any] = {
                    "title": title,
                    "text": text,
                    "video_file": str(video),
                    "aweme_id": aweme_id,
                    "review_status": "审核中" if reviewing else "已发布",
                    "is_private": bool(status.get("is_private")),
                    "is_prohibited": bool(status.get("is_prohibited")),
                }
                if reviewing:
                    payload["submitted_note"] = (
                        f"已真实提交（抖音作品 {aweme_id}，审核中）;公开链接待审核通过后回填"
                    )
                    public_url = ""
                return PublishResult(
                    success=True,
                    platform=self.platform_id,
                    published_url=public_url,
                    platform_content_id=aweme_id,
                    payload=payload,
                )
            finally:
                await close_stealth_context(browser, context)
