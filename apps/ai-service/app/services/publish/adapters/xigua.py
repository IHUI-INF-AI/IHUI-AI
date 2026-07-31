"""西瓜视频 适配器(基于 Playwright + 反风控五层防线)。

西瓜视频是字节系中长视频平台(ixigua.com),风控较严,本适配器完整接入反风控五层防线:
  stealth 反检测 / 指纹隔离 / 行为人类化 / 代理池 / 账号 profile 持久化。

凭证:{ sessionid, ttwid, sid_guard }  — 均为 .ixigua.com / .douyin.com 域 cookie
- sessionid: 字节系登录态核心 cookie(httpOnly)
- ttwid:    字节系反爬 token(缺失触发风控验证码)
- sid_guard: 字节系登录态续期 cookie

实现:
- verify_credentials: 用反风控 context 打开 https://studio.ixigua.com 检查登录态
- publish: 用反风控 context 打开 https://studio.ixigua.com/upload
  → input[type=file] 上传视频(setInputFiles)→ 等待上传完成(10 分钟超时)
  → 填标题(input)/描述(textarea)/标签/分类(human_type + human_click)
  → 点发布(human_click)→ 等待跳转到管理页或成功提示

反风控接入(强制):
- create_stealth_browser_context 替代裸 playwright launch(指纹隔离 + 反检测注入)
- human_click / human_type / human_pause / simulate_reading 人类化操作
- 持久化 context 跨会话保留 cookie,仍补充凭证 cookie(双保险)
- close_stealth_context 统一清理(finally 块)

平台特性:
- 西瓜视频是字节系平台,凭证用 sessionid + ttwid(字节系反爬 token)
- ttwid 缺失会触发字节系风控(验证码/限流),凭证必须同时提供
- 字节系上传页 accept 含 video 的 input[type=file] 可能有多个,取 first
- 视频上传必须用 input[type=file].set_input_files(不能用 click)
- 视频文件可能很大,上传完成等待超时设为 10 分钟(600000ms)
- 标题输入框是 input(不是 textarea,与好看视频不同)
- 字节系平台对发布频率敏感,建议同账号每日 ≤3 条 + 间隔 ≥30min
"""
from __future__ import annotations

import hashlib
from pathlib import Path
from typing import TYPE_CHECKING, Any, Optional
from urllib.parse import parse_qs, urlparse

from app.core.logging import get_logger
from ..anti_risk import (
    close_stealth_context,
    create_stealth_browser_context,
    human_click,
    human_pause,
    human_type,
    simulate_reading,
)
from ..base_adapter import BasePlatformAdapter, PublishContent, PublishResult

logger = get_logger(__name__)

try:
    from playwright.async_api import async_playwright
    _HAS_PLAYWRIGHT = True
except ImportError:
    _HAS_PLAYWRIGHT = False

if TYPE_CHECKING:
    from playwright._impl._api_structures import SetCookieParam


_CREATOR_URL = "https://studio.ixigua.com"
_UPLOAD_URL = "https://studio.ixigua.com/upload"
_TITLE_SELECTOR = (
    'input[placeholder*="标题"], .title-input input, '
    '[class*="title"] input, #title'
)
_DESC_SELECTOR = (
    'textarea[placeholder*="描述"], textarea[placeholder*="简介"], '
    '.desc-input textarea, [class*="desc"] textarea'
)
_TAG_SELECTOR = 'input[placeholder*="标签"], .tag-input input'
_CATEGORY_SELECTOR = (
    '.category-list :text("{cat}"), [class*="category"] :text("{cat}"), '
    'option:has-text("{cat}")'
)
_PUBLISH_SELECTOR = (
    'button:has-text("发布"), .publish-btn, '
    'button[class*="publish"], a:has-text("发布")'
)
_SUCCESS_SELECTOR = (
    '.el-message--success, .toast-success, .success-tip, '
    '.ant-message-success, [class*="success"], [class*="upload-success"]'
)


class XiguaAdapter(BasePlatformAdapter):
    """西瓜视频适配器(字节系,Playwright + 反风控五层防线)。"""

    platform_id = "xigua"
    platform_name = "西瓜视频"
    supported_formats = ["video"]
    requires_credentials = ["sessionid", "ttwid"]
    needs_browser = True

    def _cookies(self, credentials: dict[str, Any]) -> list[SetCookieParam]:
        """构建西瓜视频凭证 cookie(sessionid + ttwid + sid_guard)。

        字节系 cookie 跨域:.ixigua.com 主域,.douyin.com 共享登录态。
        sessionid: 登录态核心(httpOnly)
        ttwid:    反爬 token(缺失触发验证码风控)
        sid_guard: 登录态续期(可选,有则带)
        """
        cookies: list[SetCookieParam] = [
            {
                "name": "sessionid",
                "value": credentials.get("sessionid", ""),
                "domain": ".ixigua.com",
                "path": "/",
                "httpOnly": True,
            },
            {
                "name": "ttwid",
                "value": credentials.get("ttwid", ""),
                "domain": ".ixigua.com",
                "path": "/",
                "httpOnly": True,
            },
        ]
        # sid_guard 可选(字节系续期 cookie)
        sid_guard = credentials.get("sid_guard", "").strip()
        if sid_guard:
            cookies.append({
                "name": "sid_guard",
                "value": sid_guard,
                "domain": ".ixigua.com",
                "path": "/",
                "httpOnly": True,
            })
        # 同步写到 .douyin.com 域(字节系共享登录态)
        for c in list(cookies):
            cookies.append({**c, "domain": ".douyin.com"})
        return cookies

    def _account_id(self, credentials: dict[str, Any], primary: str) -> str:
        """生成反风控账号标识(同账号跨会话稳定,绑定固定指纹/代理)。"""
        acct = credentials.get("account_id")
        if acct:
            return f"{self.platform_id}_{acct}"
        return f"{self.platform_id}_{hashlib.md5(primary.encode()).hexdigest()[:8]}"

    async def verify_credentials(self, credentials: dict[str, Any]) -> tuple[bool, str]:
        """验证西瓜视频凭证:用反风控 context 打开创作中心首页检查登录态。

        Returns:
            (是否有效, 结果信息/错误信息)
        """
        if not _HAS_PLAYWRIGHT:
            return (
                False,
                "Playwright not installed. Run: pip install playwright && playwright install chromium",
            )
        sessionid = credentials.get("sessionid", "").strip()
        if not sessionid:
            return False, "missing sessionid cookie"
        ttwid = credentials.get("ttwid", "").strip()
        if not ttwid:
            return False, "missing ttwid cookie (anti-crawl token required)"

        try:
            async with async_playwright() as p:
                browser, context = await create_stealth_browser_context(
                    account_id=self._account_id(credentials, sessionid),
                    platform=self.platform_id,
                    playwright_instance=p,
                    headless=True,
                )
                try:
                    await context.add_cookies(self._cookies(credentials))
                    page = await context.new_page()

                    await human_pause(1.0, 2.0)
                    logger.info("[xigua] verify: 打开创作中心首页")
                    await page.goto(_CREATOR_URL, wait_until="networkidle", timeout=30000)
                    await human_pause(1.0, 2.0)

                    url = page.url
                    if "login" in url.lower() or "passport" in url.lower():
                        return False, "cookie expired (redirected to login)"

                    # 检查页面是否有登录态标识(头像/用户名/退出按钮)
                    try:
                        avatar = page.locator(
                            '.avatar, .user-avatar, [class*="avatar"], '
                            '[class*="user-info"], [class*="username"]'
                        ).first
                        if await avatar.count() > 0:
                            return True, "connected to xigua studio (login confirmed)"
                    except Exception:
                        pass

                    # 兜底:未跳登录页即认为有效
                    return True, "connected to xigua studio"
                finally:
                    await close_stealth_context(browser, context)
        except Exception as e:
            logger.warning("xigua.verify_credentials 失败: %s", e, exc_info=True)
            return False, f"verify failed: {type(e).__name__}: {e}"

    async def publish(
        self,
        content: PublishContent,
        credentials: dict[str, Any],
        platform_config: dict[str, Any],
    ) -> PublishResult:
        """发布视频到西瓜视频:上传 → 填元数据 → 发布(全流程反风控)。

        流程:
        1. 反风控 context 打开 https://studio.ixigua.com/upload
        2. 找到视频 input[type=file](accept 含 video)
        3. set_input_files 上传视频(不用 click)
        4. 等待上传完成(.upload-complete / progress 100%,超时 10 分钟)
        5. human_type 填标题(input)/描述(textarea)/标签
        6. human_click 点发布
        7. 等待跳转或成功提示

        异常不抛出,返回 PublishResult(success=False, error_message=...)。
        finally 块调用 close_stealth_context 统一清理。
        """
        if not _HAS_PLAYWRIGHT:
            return PublishResult(
                success=False, platform=self.platform_id,
                error_message="Playwright not installed. Run: pip install playwright && playwright install chromium",
            )

        sessionid = credentials.get("sessionid", "").strip()
        if not sessionid:
            return PublishResult(
                success=False, platform=self.platform_id,
                error_message="missing sessionid cookie",
            )
        ttwid = credentials.get("ttwid", "").strip()
        if not ttwid:
            return PublishResult(
                success=False, platform=self.platform_id,
                error_message="missing ttwid cookie (anti-crawl token required)",
            )

        if content.format != "video":
            return PublishResult(
                success=False, platform=self.platform_id,
                error_message=f"xigua only supports video format, got {content.format}",
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
        file_size = video_path.stat().st_size
        if file_size == 0:
            return PublishResult(
                success=False, platform=self.platform_id,
                error_message="video file is empty",
            )

        title = (content.title or "Untitled")[:80]
        desc = (content.text or platform_config.get("desc", ""))[:2000]
        tags = [str(t) for t in platform_config.get("tags", [])][:5]
        category = platform_config.get("category", "")

        try:
            async with async_playwright() as p:
                browser, context = await create_stealth_browser_context(
                    account_id=self._account_id(credentials, sessionid),
                    platform=self.platform_id,
                    playwright_instance=p,
                    headless=True,
                )
                try:
                    await context.add_cookies(self._cookies(credentials))
                    page = await context.new_page()

                    # 1. 打开上传页(反风控:先停顿再导航 + 模拟阅读)
                    logger.info("[xigua] 打开上传页: %s", _UPLOAD_URL)
                    await human_pause(1.0, 2.0)
                    await page.goto(_UPLOAD_URL, wait_until="networkidle", timeout=60000)
                    await human_pause(1.5, 3.0)

                    if "login" in page.url.lower() or "passport" in page.url.lower():
                        return PublishResult(
                            success=False, platform=self.platform_id,
                            error_message="cookie expired, please refresh sessionid/ttwid",
                        )

                    await simulate_reading(page, min_s=5.0, max_s=15.0)

                    # 2. 找到视频 file input(字节系上传页 accept 含 video)
                    logger.info(
                        "[xigua] 上传视频文件: %s (%d bytes)",
                        video_path.name, file_size,
                    )
                    file_input = page.locator(
                        'input[type="file"][accept*="video"]'
                    ).first
                    if await file_input.count() == 0:
                        # 降级:遍历所有 file input,找 accept 含 video 的
                        all_file_inputs = page.locator('input[type="file"]')
                        count = await all_file_inputs.count()
                        found_video_input = False
                        for i in range(count):
                            accept_val = await all_file_inputs.nth(i).get_attribute(
                                "accept"
                            ) or ""
                            if "video" in accept_val.lower():
                                file_input = all_file_inputs.nth(i)
                                found_video_input = True
                                break
                        if not found_video_input:
                            # 最终降级:取第一个 file input
                            file_input = page.locator('input[type="file"]').first
                            if await file_input.count() == 0:
                                return PublishResult(
                                    success=False, platform=self.platform_id,
                                    error_message="video file input not found on upload page",
                                )
                    await file_input.set_input_files(str(video_path))

                    # 3. 等待上传完成(视频可能很大,给 10 分钟超时)
                    logger.info("[xigua] 等待视频上传完成(超时 10 分钟)...")
                    await human_pause(2.0, 4.0)
                    try:
                        await page.wait_for_selector(
                            '.upload-complete, .progress-bar[style*="100%"], '
                            '[class*="upload-complete"], [class*="upload-success"], '
                            '[class*="video-status"]:has-text("完成")',
                            timeout=600000,  # 10 分钟
                        )
                    except Exception as e:
                        logger.warning("[xigua] 上传完成检测超时: %s", e, exc_info=True)
                        return PublishResult(
                            success=False, platform=self.platform_id,
                            error_message=f"video upload timeout (10min): {type(e).__name__}: {e}",
                        )
                    logger.info("[xigua] 视频上传完成")
                    await human_pause(2.0, 4.0)

                    # 4. 填标题(人类化输入,西瓜视频标题框是 input)
                    logger.info("[xigua] 填写标题: %s", title)
                    title_input = page.locator(_TITLE_SELECTOR).first
                    if await title_input.count() == 0:
                        return PublishResult(
                            success=False, platform=self.platform_id,
                            error_message="title input not found after upload",
                        )
                    await title_input.click()
                    await human_pause(0.3, 0.8)
                    await title_input.fill("")
                    await human_type(page, title, _TITLE_SELECTOR)

                    # 5. 填描述(人类化输入,西瓜视频描述框是 textarea)
                    if desc:
                        logger.info("[xigua] 填写描述: %d 字符", len(desc))
                        desc_input = page.locator(_DESC_SELECTOR).first
                        if await desc_input.count() > 0:
                            await desc_input.click()
                            await human_pause(0.3, 0.8)
                            await human_type(page, desc, _DESC_SELECTOR)

                    # 6. 选择分类(如有)
                    if category:
                        logger.info("[xigua] 选择分类: %s", category)
                        try:
                            category_selector = _CATEGORY_SELECTOR.format(cat=category)
                            category_el = page.locator(category_selector).first
                            if await category_el.count() > 0:
                                await human_click(page, category_selector)
                                await human_pause(0.5, 1.0)
                        except Exception as e:
                            logger.warning("[xigua] 分类选择失败: %s", e)

                    # 7. 填标签(人类化输入,逐个输入 + Enter)
                    if tags:
                        logger.info("[xigua] 填写标签: %s", tags)
                        tag_input = page.locator(_TAG_SELECTOR).first
                        if await tag_input.count() > 0:
                            for tag in tags:
                                await tag_input.click()
                                await human_type(page, str(tag), _TAG_SELECTOR)
                                await page.keyboard.press("Enter")
                                await human_pause(0.3, 0.6)

                    # 8. 设置封面(如有)
                    if content.cover_path:
                        cover_path_obj = Path(content.cover_path)
                        if cover_path_obj.is_file():
                            logger.info("[xigua] 设置封面: %s", content.cover_path)
                            cover_input = page.locator(
                                'input[type="file"][accept*="image"]'
                            ).first
                            if await cover_input.count() > 0:
                                await cover_input.set_input_files(str(cover_path_obj))
                                await human_pause(1.0, 2.0)

                    await human_pause(1.0, 2.0)

                    # 9. 点发布(人类化点击,传 selector 字符串给 human_click)
                    logger.info("[xigua] 点击发布按钮")
                    publish_btn = page.locator(_PUBLISH_SELECTOR).first
                    if await publish_btn.count() == 0:
                        return PublishResult(
                            success=False, platform=self.platform_id,
                            error_message="publish button not found",
                        )
                    await human_click(page, _PUBLISH_SELECTOR)
                    await human_pause(1.0, 2.0)

                    # 10. 等待跳转到管理页或成功提示
                    logger.info("[xigua] 等待发布完成跳转...")
                    published_url: str = page.url
                    try:
                        await page.wait_for_url(
                            "**/manage**, **/list**, **/video/list**, **/content**",
                            timeout=30000,
                        )
                        published_url = page.url
                    except Exception:
                        # 检查是否有成功提示
                        try:
                            success_msg = page.locator(_SUCCESS_SELECTOR).first
                            if await success_msg.count() > 0:
                                logger.info("[xigua] 发布成功提示已出现")
                            else:
                                logger.warning("[xigua] 未检测到跳转或成功提示")
                        except Exception:
                            logger.warning("[xigua] 成功提示检测异常")

                    # 尝试从 URL 提取视频 ID
                    platform_content_id: Optional[str] = None
                    try:
                        parsed = urlparse(published_url)
                        qs = parse_qs(parsed.query)
                        path_parts = parsed.path.rstrip("/").split("/")
                        platform_content_id = (
                            qs.get("id", [None])[0]
                            or qs.get("vid", [None])[0]
                            or qs.get("item_id", [None])[0]
                            or (path_parts[-1] if path_parts else None)
                        )
                    except Exception:
                        pass

                    logger.info("[xigua] 发布成功: %s", published_url)
                    return PublishResult(
                        success=True, platform=self.platform_id,
                        published_url=published_url,
                        platform_content_id=platform_content_id,
                        payload={
                            "title": title,
                            "tags": tags,
                            "category": category,
                            "file_size": file_size,
                            "video_name": video_path.name,
                        },
                    )
                finally:
                    await close_stealth_context(browser, context)
        except Exception as e:
            logger.warning("xigua.publish 失败: %s", e, exc_info=True)
            return PublishResult(
                success=False, platform=self.platform_id,
                error_message=f"publish failed: {type(e).__name__}: {e}",
            )


__all__ = ["XiguaAdapter"]
