"""视频号 适配器(基于 Playwright 浏览器自动化框架,微信生态)。

凭证:{ wechat_channels cookies } - 字符串(JSON 格式) 或 dict 多 cookie

实现:
- verify_credentials: 打开 https://channels.weixin.qq.com 检查登录态
- publish: 上传视频 → 填描述 → 点发布

注意:
- 视频号是微信生态的产品,需要扫码登录获取 cookie(无法用 OAuth)
- 凭证可传完整 cookie jar(JSON 字符串),适配器解析后注入
- 仅支持视频格式,不支持图文
"""
from __future__ import annotations

import json
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


class ShipinhaoAdapter(BasePlatformAdapter):
    platform_id = "shipinhao"
    platform_name = "视频号"
    supported_formats = ["video"]
    requires_credentials = ["wechat_channels"]
    needs_browser = True

    def _parse_cookies(self, credentials: dict) -> list[dict[str, Any]]:
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
            except Exception:
                # 尝试 cookie 字符串格式:k1=v1; k2=v2
                cookies = []
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
        result = []
        for c in parsed:
            if isinstance(c, dict) and "name" in c and "value" in c:
                cookie = {
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

    async def verify_credentials(self, credentials: dict) -> tuple[bool, str]:
        if not _HAS_PLAYWRIGHT:
            return False, "Playwright not installed. Run: pip install playwright && playwright install chromium"
        cookies = self._parse_cookies(credentials)
        if not cookies:
            return False, "missing wechat_channels cookies"

        try:
            async with async_playwright() as p:
                browser = await p.chromium.launch(headless=True)
                context = await browser.new_context()
                await context.add_cookies(cookies)
                page = await context.new_page()
                await page.goto(
                    "https://channels.weixin.qq.com/platform",
                    wait_until="networkidle",
                    timeout=30000,
                )
                url = page.url
                content = await page.content()
                await browser.close()
                if "login" in url.lower() or "/login" in url or "扫码" in content:
                    return False, "cookie expired (redirected to login / scan QR required)"
                return True, "connected (cookies valid)"
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
                browser = await p.chromium.launch(headless=True)
                context = await browser.new_context()
                await context.add_cookies(cookies)
                page = await context.new_page()

                # 打开视频号管理后台
                await page.goto(
                    "https://channels.weixin.qq.com/platform/post/create",
                    wait_until="networkidle",
                    timeout=60000,
                )
                if "login" in page.url.lower() or "/login" in page.url:
                    await browser.close()
                    return PublishResult(
                        success=False, platform=self.platform_id,
                        error_message="cookie expired, please refresh wechat_channels cookies",
                    )

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
                except Exception:
                    # 上传超时检查
                    await browser.close()
                    return PublishResult(
                        success=False, platform=self.platform_id,
                        error_message="video upload timeout (file too large or network slow)",
                    )

                # 填描述
                desc_editor = page.locator(
                    'textarea[placeholder*="描述"], .desc-input textarea, #desc'
                ).first
                if await desc_editor.count() > 0:
                    full_desc = desc
                    if tags:
                        full_desc = (desc + "\n" + " ".join(f"#{t}" for t in tags[:10]))[:500]
                    await desc_editor.fill(full_desc)

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

                # 点发布
                publish_btn = page.locator(
                    'button:has-text("发表"), button:has-text("发布"), .publish-btn'
                ).first
                if await publish_btn.count() == 0:
                    await browser.close()
                    return PublishResult(
                        success=False, platform=self.platform_id,
                        error_message="publish button not found",
                    )
                await publish_btn.click()

                # 等待发布成功提示
                try:
                    success_toast = page.locator(
                        '.toast:has-text("成功"), .message:has-text("成功")'
                    ).first
                    await success_toast.wait_for(state="visible", timeout=30000)
                except Exception:
                    # 检查 URL 跳转
                    if "create" in page.url:
                        await browser.close()
                        return PublishResult(
                            success=False, platform=self.platform_id,
                            error_message="publish timeout (no success toast)",
                        )

                await browser.close()
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
        except Exception as e:
            return PublishResult(
                success=False, platform=self.platform_id,
                error_message=f"publish failed: {type(e).__name__}: {e}",
            )
