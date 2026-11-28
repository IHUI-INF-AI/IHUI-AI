# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""微博 适配器(基于微博开放平台 OAuth2 API,完整代码)。

凭证:{ access_token, uid }

实现:
- verify_credentials: GET /2/account/get_uid.json 验证 token
- publish:
  - 图文:POST /2/statuses/upload_url_text.json(图 URL)/ POST /2/statuses/upload.json(图文件)
  - 视频:POST /2/statuses/upload_url_text.json(video_url)

注意:
- 微博开放平台接口需申请权限
- 文字微博 140 字,带图 140 字 + 9 图,视频 140 字描述
"""
from __future__ import annotations

import asyncio
from pathlib import Path
from typing import Any

import httpx

from app.core.logging import get_logger
from ..anti_risk import create_stealth_browser_context
from ..anti_risk.browser_factory import close_stealth_context
from ..base_adapter import BasePlatformAdapter, PublishContent, PublishResult

logger = get_logger(__name__)

_API_BASE = "https://api.weibo.com"


class WeiboAdapter(BasePlatformAdapter):
    platform_id = "weibo"
    platform_name = "微博"
    supported_formats = ["md", "html", "image", "video"]
    requires_credentials = []

    async def _web_cookies(self, credentials: dict[str, Any]) -> list[dict[str, Any]]:
        jar = credentials.get("__cookie_jar__") or []
        cookies = [
            {k: v for k, v in c.items() if k in ("name", "value", "domain", "path", "secure", "httpOnly", "expires", "sameSite")}
            for c in jar
        ]
        return [c for c in cookies if c.get("expires", 0) != -1]

    async def _verify_web(self, credentials: dict[str, Any]) -> tuple[bool, str]:
        from playwright.async_api import async_playwright
        cookies = await self._web_cookies(credentials)
        if not cookies:
            return False, "missing access_token or __cookie_jar__"
        try:
            async with async_playwright() as p:
                browser, context = await create_stealth_browser_context(
                    account_id=str(self.db_account_id or "weibo"),
                    platform="weibo",
                    playwright_instance=p,
                    headless=True,
                )
                try:
                    await context.add_cookies(cookies)
                    page = await context.new_page()
                    await page.goto("https://weibo.com", wait_until="domcontentloaded", timeout=30000)
                    await page.wait_for_timeout(3000)
                    if "login" in page.url or "passport" in page.url:
                        return False, f"web cookie invalid (redirected to {page.url})"
                    if await page.locator("textarea").count() == 0:
                        return False, "web cookie invalid (no compose box)"
                    return True, "web cookie valid (https://weibo.com)"
                finally:
                    await close_stealth_context(browser, context)
        except Exception as e:
            return False, f"web verify failed: {type(e).__name__}: {e}"

    async def _publish_web(self, content: PublishContent, credentials: dict[str, Any]) -> PublishResult:
        from playwright.async_api import async_playwright
        text = content.title or ""
        if content.text:
            text = (text + "\n" + content.text) if text else content.text
        text = text[:140]
        if not text.strip():
            return PublishResult(success=False, platform=self.platform_id, error_message="missing text content (140 chars required)")
        cookies = await self._web_cookies(credentials)
        if not cookies:
            return PublishResult(success=False, platform=self.platform_id, error_message="missing __cookie_jar__")
        try:
            async with async_playwright() as p:
                browser, context = await create_stealth_browser_context(
                    account_id=str(self.db_account_id or "weibo"),
                    platform="weibo",
                    playwright_instance=p,
                    headless=True,
                )
                try:
                    await context.add_cookies(cookies)
                    page = await context.new_page()
                    await page.goto("https://weibo.com", wait_until="domcontentloaded", timeout=30000)
                    await page.wait_for_timeout(3000)
                    area = page.locator("textarea").first
                    await area.fill(text)
                    await asyncio.sleep(0.4)
                    # 微博的「发送」是一个 span.woo-button-content（pointer-events:none），
                    # Playwright 点它会落空；Ctrl+Enter 是网页版真实快捷键，实测能触发
                    # POST /ajax/statuses/update 并返回 mid/mblogid。
                    updates: list[dict[str, Any]] = []

                    async def _on_update(r) -> None:
                        if "/ajax/statuses/update" not in r.url or r.request.method.upper() != "POST":
                            return
                        try:
                            data = await r.json()
                        except Exception:
                            return
                        updates.append({"status": r.status, "data": data})

                    page.on("response", lambda r: asyncio.create_task(_on_update(r)))
                    await area.press("Control+Enter")
                    for _ in range(20):
                        await asyncio.sleep(0.5)
                        if updates:
                            break
                    if updates:
                        payload = updates[0].get("data") or {}
                        item = payload.get("data") or {}
                        mid = item.get("idstr") or item.get("id") or item.get("mid")
                        mblogid = item.get("mblogid") or ""
                        user = item.get("user") or {}
                        uid = user.get("idstr") or user.get("id") or ""
                        if mid:
                            if uid and mblogid:
                                published_url = f"https://weibo.com/{uid}/{mblogid}"
                            elif mid:
                                published_url = f"https://m.weibo.cn/status/{mid}"
                            else:
                                published_url = ""
                            return PublishResult(
                                success=True, platform=self.platform_id,
                                published_url=published_url,
                                platform_content_id=str(mid),
                                payload={"mode": "web", "mid": str(mid), "mblogid": mblogid},
                            )
                        logger.warning("[weibo] update 响应无 mid: %s", str(payload)[:300])
                    if page.is_closed():
                        return PublishResult(
                            success=False, platform=self.platform_id,
                            error_message="weibo page closed before update response",
                        )
                    body = await page.locator("body").inner_text()
                    if "发布成功" in body or "发送成功" in body:
                        return PublishResult(success=True, platform=self.platform_id, payload={"mode": "web"})
                    return PublishResult(
                        success=False, platform=self.platform_id,
                        error_message="Ctrl+Enter sent but no update response / success toast",
                    )
                finally:
                    await close_stealth_context(browser, context)
        except Exception as e:
            return PublishResult(success=False, platform=self.platform_id, error_message=f"web publish failed: {type(e).__name__}: {e}")

    async def verify_credentials(self, credentials: dict[str, Any]) -> tuple[bool, str]:
        access_token = credentials.get("access_token", "").strip()
        if not access_token:
            if str(credentials.get("__cookie_jar__") or ""):
                return await self._verify_web(credentials)
            return False, "missing access_token"

        try:
            async with httpx.AsyncClient(timeout=20.0) as client:
                resp = await client.get(
                    f"{_API_BASE}/2/account/get_uid.json",
                    params={"access_token": access_token},
                )
        except httpx.HTTPError as e:
            return False, f"http error: {type(e).__name__}: {e}"

        if resp.status_code != 200:
            return False, f"API {resp.status_code}: {resp.text[:200]}"

        try:
            data = resp.json()
        except Exception as e:
            logger.warning("weibo.verify_credentials JSON 解析失败: %s", e, exc_info=True)
            return False, f"invalid json: {resp.text[:200]}"

        uid = data.get("uid")
        if not uid:
            return False, f"verify failed: {data}"

        # 取用户信息
        try:
            async with httpx.AsyncClient(timeout=20.0) as client:
                u_resp = await client.get(
                    f"{_API_BASE}/2/users/show.json",
                    params={"access_token": access_token, "uid": uid},
                )
            if u_resp.status_code == 200:
                udata = u_resp.json()
                name = udata.get("screen_name") or udata.get("name") or "?"
                return True, f"connected as {name} (uid={uid})"
        except Exception as e:
            logger.warning("weibo.verify_credentials 拉取用户信息失败: %s", e, exc_info=True)
        return True, f"connected (uid={uid})"

    async def publish(
        self,
        content: PublishContent,
        credentials: dict[str, Any],
        platform_config: dict[str, Any],
    ) -> PublishResult:
        access_token = credentials.get("access_token", "").strip()
        if not access_token:
            if str(credentials.get("__cookie_jar__") or ""):
                return await self._publish_web(content, credentials)
            return PublishResult(
                success=False, platform=self.platform_id,
                error_message="missing access_token",
            )

        # 微博内容(140 字)
        text = content.title or ""
        if content.text:
            text = (text + "\n" + content.text)[:140] if text else content.text[:140]
        elif not text:
            text = platform_config.get("text", "")[:140]
        if not text:
            return PublishResult(
                success=False, platform=self.platform_id,
                error_message="missing text content (140 chars required)",
            )

        # 选择接口
        fmt = content.format
        try:
            if fmt == "video":
                # 视频微博(通过 URL)
                video_url = content.file_path if str(content.file_path).startswith("http") else platform_config.get("video_url", "")
                if not video_url:
                    return PublishResult(
                        success=False, platform=self.platform_id,
                        error_message="video format requires file_path as URL or video_url in platform_config",
                    )
                async with httpx.AsyncClient(timeout=30.0) as client:
                    resp = await client.post(
                        f"{_API_BASE}/2/statuses/upload_url_text.json",
                        data={
                            "access_token": access_token,
                            "status": text,
                            "video_url": video_url,
                        },
                    )
            elif fmt == "image":
                # 图片微博(上传图片文件)
                if not content.file_path:
                    return PublishResult(
                        success=False, platform=self.platform_id,
                        error_message="image format requires file_path",
                    )
                p = Path(content.file_path)
                if not p.is_file():
                    return PublishResult(
                        success=False, platform=self.platform_id,
                        error_message=f"image not found: {content.file_path}",
                    )
                image_bytes = await asyncio.to_thread(p.read_bytes)
                files = {"pic": (p.name, image_bytes, "image/jpeg")}
                async with httpx.AsyncClient(timeout=60.0) as client:
                    # 上传图片到 Pic API
                    pic_resp = await client.post(
                        f"{_API_BASE}/2/statuses/uploadPic.json",
                        data={"access_token": access_token},
                        files=files,
                    )
                if pic_resp.status_code != 200:
                    return PublishResult(
                        success=False, platform=self.platform_id,
                        error_message=f"upload pic {pic_resp.status_code}: {pic_resp.text[:300]}",
                    )
                pic_data = pic_resp.json()
                pic_id = pic_data.get("pic_id") or pic_data.get("pic", {}).get("pic_id", "")
                if not pic_id:
                    return PublishResult(
                        success=False, platform=self.platform_id,
                        error_message=f"upload pic no pic_id: {pic_data}",
                    )
                # 发图文
                async with httpx.AsyncClient(timeout=30.0) as client:
                    resp = await client.post(
                        f"{_API_BASE}/2/statuses/upload_url_text.json",
                        data={
                            "access_token": access_token,
                            "status": text,
                            "pic_id": pic_id,
                        },
                    )
            else:
                # md/html → 纯文本
                async with httpx.AsyncClient(timeout=30.0) as client:
                    resp = await client.post(
                        f"{_API_BASE}/2/statuses/update.json",
                        data={
                            "access_token": access_token,
                            "status": text,
                        },
                    )
        except httpx.HTTPError as e:
            return PublishResult(
                success=False, platform=self.platform_id,
                error_message=f"http error: {type(e).__name__}: {e}",
            )

        if resp.status_code != 200:
            return PublishResult(
                success=False, platform=self.platform_id,
                error_message=f"API {resp.status_code}: {resp.text[:300]}",
            )

        try:
            rdata = resp.json()
        except Exception as e:
            logger.warning("weibo.publish 响应 JSON 解析失败,降级空 dict: %s", e, exc_info=True)
            rdata = {}

        if "error" in rdata or "error_code" in rdata:
            return PublishResult(
                success=False, platform=self.platform_id,
                error_message=f"publish failed: error_code={rdata.get('error_code')} "
                              f"error={rdata.get('error')}",
            )

        weibo_id = rdata.get("id") or rdata.get("idstr") or ""
        weibo_mid = rdata.get("mid") or ""
        uid = (rdata.get("user") or {}).get("id") or credentials.get("uid", "")
        published_url = f"https://weibo.com/{uid}/{weibo_mid}" if uid and weibo_mid else ""

        return PublishResult(
            success=True, platform=self.platform_id,
            platform_content_id=str(weibo_id),
            published_url=published_url,
            payload={
                "weibo_id": weibo_id,
                "mid": weibo_mid,
                "format": fmt,
            },
        )
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
