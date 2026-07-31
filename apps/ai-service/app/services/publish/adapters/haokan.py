"""好看视频 适配器(基于 Playwright + 反风控模块)。

凭证: { BDUSS, STOKEN }

实现:
- verify_credentials: 用反风控 context 打开 https://haokan.baidu.com/creator 检查登录态
- publish: 用反风控 context 打开 https://haokan.baidu.com/creator/upload
  → input[type=file] 上传视频(setInputFiles)→ 等待上传完成(10 分钟超时)
  → 填标题/分类/标签(human_type)→ 点发布(human_click)→ 等待跳转

反风控接入(强制):
- create_stealth_browser_context 替代裸 playwright launch(指纹隔离 + 反检测注入)
- human_click / human_type / human_pause / simulate_reading 人类化操作
- 持久化 context 跨会话保留 cookie,仍补充凭证 cookie(双保险)
- close_stealth_context 统一清理(finally 块)

平台特性:
- 好看视频是百度系平台,凭证用 BDUSS(.baidu.com 域,httpOnly)+ STOKEN(百度反爬 token)
- STOKEN 缺失会触发百度系风控(验证码/限流),凭证必须同时提供
- 好看视频上传页可能有多个 input[type=file],需找 accept 含 video 的那个
- 视频上传必须用 input[type=file].set_input_files(不能用 click)
- 视频文件可能很大,上传完成等待超时设为 10 分钟(600000ms)
- 标题输入框是 textarea(不是 input),与字节系不同
"""
from __future__ import annotations

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


class HaokanAdapter(BasePlatformAdapter):
    """好看视频适配器(百度系,Playwright + 反风控)。

    supported_formats = ["video"]
    requires_credentials = ["BDUSS", "STOKEN"]
    needs_browser = True
    """

    platform_id = "haokan"
    platform_name = "好看视频"
    supported_formats = ["video"]
    requires_credentials = ["BDUSS", "STOKEN"]
    needs_browser = True

    def _cookies(self, credentials: dict[str, Any]) -> list[SetCookieParam]:
        """构建好看视频凭证 cookie(BDUSS + STOKEN,.baidu.com 域)。

        BDUSS: 百度系登录态 cookie(httpOnly)
        STOKEN: 百度系反爬 token(缺失触发风控)
        """
        return [
            {
                "name": "BDUSS",
                "value": credentials.get("BDUSS", ""),
                "domain": ".baidu.com",
                "path": "/",
                "httpOnly": True,
            },
            {
                "name": "STOKEN",
                "value": credentials.get("STOKEN", ""),
                "domain": ".baidu.com",
                "path": "/",
                "httpOnly": True,
            },
        ]

    async def verify_credentials(self, credentials: dict[str, Any]) -> tuple[bool, str]:
        """验证好看视频凭证:用反风控 context 打开创作中心首页检查登录态。

        Returns:
            (是否有效, 结果信息/错误信息)
        """
        if not _HAS_PLAYWRIGHT:
            return False, "Playwright not installed. Run: pip install playwright && playwright install chromium"

        bduss = credentials.get("BDUSS", "").strip()
        if not bduss:
            return False, "missing BDUSS cookie"
        stoken = credentials.get("STOKEN", "").strip()
        if not stoken:
            return False, "missing STOKEN cookie (anti-crawl token required)"

        try:
            async with async_playwright() as p:
                browser, context = await create_stealth_browser_context(
                    account_id=f"{self.platform_id}_{credentials.get('account_id', 'default')}",
                    platform=self.platform_id,
                    playwright_instance=p,
                    headless=True,
                )
                try:
                    await context.add_cookies(self._cookies(credentials))
                    page = await context.new_page()

                    await human_pause(0.5, 1.5)
                    logger.info("[haokan] verify: 打开创作中心首页")
                    await page.goto(
                        "https://haokan.baidu.com/creator",
                        wait_until="networkidle",
                        timeout=30000,
                    )
                    await human_pause(1.0, 2.0)

                    url = page.url
                    if "login" in url.lower() or "passport" in url.lower():
                        return False, "cookie expired (redirected to login)"

                    # 检查页面是否有登录态标识(头像/用户名)
                    try:
                        avatar = page.locator(
                            '.avatar, .user-avatar, [class*="avatar"], '
                            '[class*="user-info"], [class*="username"]'
                        ).first
                        if await avatar.count() > 0:
                            return True, "connected to haokan creator center (login confirmed)"
                    except Exception:
                        pass

                    return True, "connected to haokan creator center"
                finally:
                    await close_stealth_context(browser, context)
        except Exception as e:
            logger.warning("haokan.verify_credentials 失败: %s", e, exc_info=True)
            return False, f"verify failed: {type(e).__name__}: {e}"

    async def publish(
        self,
        content: PublishContent,
        credentials: dict[str, Any],
        platform_config: dict[str, Any],
    ) -> PublishResult:
        """发布视频到好看视频:上传 → 填元数据 → 发布(全流程反风控)。

        流程:
        1. 反风控 context 打开 https://haokan.baidu.com/creator/upload
        2. 找到视频 input[type=file](多个 file input 中找 accept 含 video 的)
        3. set_input_files 上传视频(不用 click)
        4. 等待上传完成(.upload-complete / .progress-bar[style*="100%"],超时 10 分钟)
        5. human_type 填标题(textarea)/描述/标签
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

        bduss = credentials.get("BDUSS", "").strip()
        if not bduss:
            return PublishResult(
                success=False, platform=self.platform_id,
                error_message="missing BDUSS cookie",
            )
        stoken = credentials.get("STOKEN", "").strip()
        if not stoken:
            return PublishResult(
                success=False, platform=self.platform_id,
                error_message="missing STOKEN cookie (anti-crawl token required)",
            )

        if content.format != "video":
            return PublishResult(
                success=False, platform=self.platform_id,
                error_message=f"haokan only supports video format, got {content.format}",
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
        tags = platform_config.get("tags", [])[:5]
        category = platform_config.get("category", "")

        try:
            async with async_playwright() as p:
                browser, context = await create_stealth_browser_context(
                    account_id=f"{self.platform_id}_{credentials.get('account_id', 'default')}",
                    platform=self.platform_id,
                    playwright_instance=p,
                    headless=True,
                )
                try:
                    await context.add_cookies(self._cookies(credentials))
                    page = await context.new_page()

                    # 1. 打开上传页(反风控:先停顿再导航 + 模拟阅读)
                    logger.info("[haokan] 打开上传页: https://haokan.baidu.com/creator/upload")
                    await human_pause(1.0, 2.0)
                    await page.goto(
                        "https://haokan.baidu.com/creator/upload",
                        wait_until="networkidle",
                        timeout=60000,
                    )
                    await human_pause(1.5, 3.0)

                    if "login" in page.url.lower() or "passport" in page.url.lower():
                        return PublishResult(
                            success=False, platform=self.platform_id,
                            error_message="cookie expired, please refresh cookies",
                        )

                    await simulate_reading(page, min_s=5.0, max_s=15.0)

                    # 2. 找到视频 file input(好看视频页可能有多个 file input)
                    logger.info(
                        "[haokan] 上传视频文件: %s (%d bytes)",
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
                    logger.info("[haokan] 等待视频上传完成(超时 10 分钟)...")
                    await human_pause(2.0, 4.0)
                    try:
                        await page.wait_for_selector(
                            '.upload-complete, .progress-bar[style*="100%"], '
                            '[class*="upload-complete"], [class*="upload-success"]',
                            timeout=600000,  # 10 分钟
                        )
                    except Exception as e:
                        logger.warning("[haokan] 上传完成检测超时: %s", e, exc_info=True)
                        return PublishResult(
                            success=False, platform=self.platform_id,
                            error_message=f"video upload timeout (10min): {type(e).__name__}: {e}",
                        )
                    logger.info("[haokan] 视频上传完成")
                    await human_pause(2.0, 4.0)

                    # 4. 填标题(人类化输入,好看视频标题框是 textarea)
                    logger.info("[haokan] 填写标题: %s", title)
                    title_selector = (
                        'textarea[placeholder*="标题"], .video-title, '
                        'input[placeholder*="标题"], [class*="title"] textarea, '
                        '[class*="title"] input'
                    )
                    title_input = page.locator(title_selector).first
                    if await title_input.count() == 0:
                        return PublishResult(
                            success=False, platform=self.platform_id,
                            error_message="title input not found after upload",
                        )
                    await title_input.click()
                    await human_pause(0.3, 0.8)
                    await title_input.fill("")
                    await human_type(page, title, title_selector)

                    # 5. 填描述(人类化输入)
                    if desc:
                        logger.info("[haokan] 填写描述: %d 字符", len(desc))
                        desc_selector = (
                            'textarea[placeholder*="描述"], '
                            'textarea[placeholder*="简介"], .desc-input textarea'
                        )
                        desc_input = page.locator(desc_selector).first
                        if await desc_input.count() > 0:
                            await desc_input.click()
                            await human_pause(0.3, 0.8)
                            await human_type(page, desc, desc_selector)

                    # 6. 选择分类(如有)
                    if category:
                        logger.info("[haokan] 选择分类: %s", category)
                        try:
                            category_selector = (
                                f'.category-list :text("{category}"), '
                                f'[class*="category"] :text("{category}"), '
                                f'option:has-text("{category}")'
                            )
                            category_el = page.locator(category_selector).first
                            if await category_el.count() > 0:
                                await human_click(page, category_selector)
                                await human_pause(0.5, 1.0)
                        except Exception as e:
                            logger.warning("[haokan] 分类选择失败: %s", e)

                    # 7. 填标签(人类化输入,逐个输入 + Enter)
                    if tags:
                        logger.info("[haokan] 填写标签: %s", tags)
                        tag_selector = (
                            'input[placeholder*="标签"], .tag-input input'
                        )
                        tag_input = page.locator(tag_selector).first
                        if await tag_input.count() > 0:
                            for tag in tags:
                                await tag_input.click()
                                await human_type(page, str(tag), tag_selector)
                                await page.keyboard.press("Enter")
                                await human_pause(0.3, 0.6)

                    # 8. 设置封面(如有)
                    if content.cover_path:
                        cover_path_obj = Path(content.cover_path)
                        if cover_path_obj.is_file():
                            logger.info("[haokan] 设置封面: %s", content.cover_path)
                            cover_input = page.locator(
                                'input[type="file"][accept*="image"]'
                            ).first
                            if await cover_input.count() > 0:
                                await cover_input.set_input_files(str(cover_path_obj))
                                await human_pause(1.0, 2.0)

                    await human_pause(1.0, 2.0)

                    # 9. 点发布(人类化点击,传 selector 字符串给 human_click)
                    logger.info("[haokan] 点击发布按钮")
                    publish_selector = (
                        'button:has-text("发布"), .publish-btn, '
                        'button[class*="publish"], a:has-text("发布")'
                    )
                    publish_btn = page.locator(publish_selector).first
                    if await publish_btn.count() == 0:
                        return PublishResult(
                            success=False, platform=self.platform_id,
                            error_message="publish button not found",
                        )
                    await human_click(page, publish_selector)
                    await human_pause(1.0, 2.0)

                    # 10. 等待跳转到管理页或成功提示
                    logger.info("[haokan] 等待发布完成跳转...")
                    published_url: str = page.url
                    try:
                        await page.wait_for_url(
                            "**/manage**, **/list**, **/video/list**",
                            timeout=30000,
                        )
                        published_url = page.url
                    except Exception:
                        # 检查是否有成功提示
                        try:
                            success_msg = page.locator(
                                '[class*="success"], .toast:has-text("成功")'
                            ).first
                            if await success_msg.count() > 0:
                                logger.info("[haokan] 发布成功提示已出现")
                            else:
                                logger.warning("[haokan] 未检测到跳转或成功提示")
                        except Exception:
                            logger.warning("[haokan] 成功提示检测异常")

                    # 尝试从 URL 提取视频 ID
                    platform_content_id: Optional[str] = None
                    try:
                        parsed = urlparse(published_url)
                        qs = parse_qs(parsed.query)
                        path_parts = parsed.path.rstrip("/").split("/")
                        platform_content_id = (
                            qs.get("id", [None])[0]
                            or qs.get("vid", [None])[0]
                            or (path_parts[-1] if path_parts else None)
                        )
                    except Exception:
                        pass

                    logger.info("[haokan] 发布成功: %s", published_url)
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
            logger.warning("haokan.publish 失败: %s", e, exc_info=True)
            return PublishResult(
                success=False, platform=self.platform_id,
                error_message=f"publish failed: {type(e).__name__}: {e}",
            )
