"""视频号 适配器(基于 Playwright 浏览器自动化框架,微信生态)。

凭证:{ wechat_channels cookies } - 字符串(JSON 格式) 或 dict 多 cookie

实现:
- verify_credentials: 打开 https://channels.weixin.qq.com 检查登录态
- publish: 上传视频 → 填描述 → 点发布

反风控:接入 anti_risk 五层防线,所有输入/点击走 human_*。

注意:
- 视频号是微信生态的产品,需要扫码登录获取 cookie(无法用 OAuth)
- 凭证可传完整 cookie jar(JSON 字符串),适配器解析后注入
- 仅支持视频格式,不支持图文
"""
from __future__ import annotations

import hashlib
import json
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


class ShipinhaoAdapter(BasePlatformAdapter):
    platform_id = "shipinhao"
    platform_name = "视频号"
    supported_formats = ["video"]
    requires_credentials = ["wechat_channels"]
    needs_browser = True

    def _parse_cookies(self, credentials: dict[str, Any]) -> list[SetCookieParam]:
        """解析 cookie 凭证。

        支持两种格式:
        1. wechat_channels 为 JSON 字符串 [{"name":"...","value":"..."}]
        2. wechat_channels 为 dict,转 Playwright cookie list
        """
        raw = credentials.get("wechat_channels", "")
        if isinstance(raw, str):
            if not raw.strip():
                return []
            try:
                parsed = json.loads(raw)
            except Exception as e:
                # 尝试 cookie 字符串格式:k1=v1; k2=v2
                logger.warning("shipinhao._parse_cookies cookie JSON 解析失败,尝试字符串格式: %s", e, exc_info=True)
                cookies: list[SetCookieParam] = []
                for pair in raw.split(";"):
                    if "=" in pair:
                        k, v = pair.strip().split("=", 1)
                        cookies.append({
                            "name": k.strip(),
                            "value": v.strip(),
                            "domain": ".qq.com",
                            "path": "/",
                        })
                return cookies
        elif isinstance(raw, list):
            parsed = raw
        elif isinstance(raw, dict):
            parsed = [{"name": k, "value": str(v), "domain": ".qq.com", "path": "/"}
                      for k, v in raw.items()]
        else:
            return []

        # 标准化:list of dict → Playwright cookie list
        result: list[SetCookieParam] = []
        for c in parsed:
            if isinstance(c, dict) and "name" in c and "value" in c:
                cookie: SetCookieParam = {
                    "name": str(c["name"]),
                    "value": str(c["value"]),
                    "domain": c.get("domain", ".qq.com"),
                    "path": c.get("path", "/"),
                }
                if "httpOnly" in c:
                    cookie["httpOnly"] = bool(c["httpOnly"])
                if "secure" in c:
                    cookie["secure"] = bool(c["secure"])
                result.append(cookie)
        return result

    def _account_id(self, credentials: dict[str, Any]) -> str:
        """从凭证推导账号唯一 ID(用于反风控 profile 持久化,跨会话稳定)。"""
        first_cred = next((v for v in credentials.values() if v), "default")
        return f"{self.platform_id}_{hashlib.md5(str(first_cred).encode()).hexdigest()[:8]}"

    async def verify_credentials(self, credentials: dict[str, Any]) -> tuple[bool, str]:
        if not _HAS_PLAYWRIGHT:
            return False, "Playwright not installed. Run: pip install playwright && playwright install chromium"
        cookies = self._parse_cookies(credentials)
        if not cookies:
            return False, "missing wechat_channels cookies"

        try:
            async with async_playwright() as p:
                browser, context = await create_stealth_browser_context(
                    account_id=self._account_id(credentials),
                    platform=self.platform_id,
                    playwright_instance=p,
                    headless=True,
                )
                try:
                    await context.add_cookies(cookies)
                    page = await context.new_page()
                    await human_pause(1.0, 2.0)
                    await page.goto(
                        "https://channels.weixin.qq.com/platform",
                        wait_until="networkidle",
                        timeout=30000,
                    )
                    url = page.url
                    content = await page.content()
                    if "login" in url.lower() or "/login" in url or "扫码" in content:
                        return False, "cookie expired (redirected to login / scan QR required)"
                    return True, "connected (cookies valid)"
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
        cookies = self._parse_cookies(credentials)
        if not cookies:
            return PublishResult(
                success=False, platform=self.platform_id,
                error_message="missing wechat_channels cookies",
            )

        if content.format != "video":
            return PublishResult(
                success=False, platform=self.platform_id,
                error_message=f"视频号 only supports video format, got {content.format}",
            )
        if not content.file_path:
            return PublishResult(
                success=False, platform=self.platform_id,
                error_message="missing file_path (video file required)",
            )

        video_path = Path(content.file_path)
        if not video_path.is_file():
            return PublishResult(
                success=False, platform=self.platform_id,
                error_message=f"video file not found: {content.file_path}",
            )

        # 描述(标题 + 正文)
        desc = content.title or ""
        if content.text:
            desc = (desc + "\n" + content.text)[:500]  # 视频号描述 ≤500 字
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
                    await context.add_cookies(cookies)
                    page = await context.new_page()

                    # 打开视频号管理后台
                    await human_pause(1.5, 3.0)
                    await page.goto(
                        "https://channels.weixin.qq.com/platform/post/create",
                        wait_until="networkidle",
                        timeout=60000,
                    )
                    if "login" in page.url.lower() or "/login" in page.url:
                        return PublishResult(
                            success=False, platform=self.platform_id,
                            error_message="cookie expired, please refresh wechat_channels cookies",
                        )

                    await simulate_reading(page, min_s=3.0, max_s=8.0)

                    # 上传视频
                    file_input = page.locator('input[type="file"][accept*="video"]').first
                    if await file_input.count() == 0:
                        file_input = page.locator('input[type="file"]').first
                    await file_input.set_input_files(str(video_path))

                    # 等待上传完成(进度条消失)
                    try:
                        await page.wait_for_selector(
                            '.upload-progress, .progress-bar', state='detached', timeout=600000
                        )
                    except Exception as e:
                        # 上传超时检查
                        logger.warning("shipinhao.publish 视频上传等待超时: %s", e, exc_info=True)
                        return PublishResult(
                            success=False, platform=self.platform_id,
                            error_message="video upload timeout (file too large or network slow)",
                        )

                    await human_pause(1.0, 2.0)

                    # 填描述(人类化逐字符)
                    full_desc = desc
                    if tags:
                        full_desc = (desc + "\n" + " ".join(f"#{t}" for t in tags[:10]))[:500]
                    desc_selector = 'textarea[placeholder*="描述"], .desc-input textarea, #desc'
                    if await page.locator(desc_selector).count() > 0:
                        await human_type(page, full_desc, desc_selector)
                        await human_pause(0.5, 1.0)

                    # 上传封面(如有)
                    if content.cover_path:
                        try:
                            cover_input = page.locator('input[type="file"][accept*="image"]').first
                            if await cover_input.count() > 0:
                                cover_p = Path(content.cover_path)
                                if cover_p.is_file():
                                    await cover_input.set_input_files(str(cover_p))
                                    await page.wait_for_timeout(2000)
                        except Exception as e:
                            logger.warning("[shipinhao] cover upload failed: %s", e)

                    # 模拟阅读检查(人类发布前预览)
                    await simulate_reading(page, min_s=2.0, max_s=5.0)
                    await human_pause(1.0, 2.0)

                    # 点发布(人类化)
                    publish_selector = 'button:has-text("发表"), button:has-text("发布"), .publish-btn'
                    if await page.locator(publish_selector).count() == 0:
                        return PublishResult(
                            success=False, platform=self.platform_id,
                            error_message="publish button not found",
                        )
                    await human_click(page, publish_selector)

                    # 等待发布成功提示
                    try:
                        success_toast = page.locator(
                            '.toast:has-text("成功"), .message:has-text("成功")'
                        ).first
                        await success_toast.wait_for(state="visible", timeout=30000)
                    except Exception as e:
                        # 检查 URL 跳转
                        logger.warning("shipinhao.publish 发布成功提示等待超时: %s", e, exc_info=True)
                        if "create" in page.url:
                            return PublishResult(
                                success=False, platform=self.platform_id,
                                error_message="publish timeout (no success toast)",
                            )

                    # 视频号不直接返回 URL,需在视频号助手查看
                    return PublishResult(
                        success=True, platform=self.platform_id,
                        published_url="",
                        platform_content_id="",
                        payload={
                            "title": content.title,
                            "tags": tags,
                            "video_file": str(video_path),
                            "note": "视频已提交,审核通过后可在微信视频号查看",
                        },
                    )
                finally:
                    await close_stealth_context(browser, context)
        except Exception as e:
            return PublishResult(
                success=False, platform=self.platform_id,
                error_message=f"publish failed: {type(e).__name__}: {e}",
            )