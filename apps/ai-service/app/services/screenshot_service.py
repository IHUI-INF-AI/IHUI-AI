"""Playwright 截图服务(sync API + 线程池,避免 Windows EventLoop 兼容问题)。

用途:对禁止 iframe 嵌入(X-Frame-Options / CSP frame-ancestors)的站点,
在后端用 headless Chromium 截图返回 base64,供前端 WorkPanel 降级展示。

设计:
- 核心用 sync_playwright + run_in_executor(不受 EventLoop policy 限制)
- 向后兼容:async _get_browser(用 async_playwright,供 opencompass_scrape 等旧代码使用)
- 单例 Browser(sync + async 各一个,进程级复用)
- 拦截图片/字体/媒体资源加速截图(只保留 HTML+CSS)
"""

from __future__ import annotations

import asyncio
import base64
import logging
import threading
import time
from typing import Any

logger = logging.getLogger(__name__)

# === sync 单例 Browser(核心实现,不受 EventLoop 限制)===
_browser: Any = None
_browser_lock = threading.Lock()
_playwright: Any = None

# === async 单例 Browser(向后兼容,供 opencompass_scrape 等旧代码使用)===
_browser_async: Any = None
_browser_lock_async = asyncio.Lock()
_playwright_async: Any = None


def _get_browser_sync() -> Any:
    """获取单例 sync Browser(首次调用启动 Playwright + Chromium)。

    sync API 在线程池中运行,不受 EventLoop policy 限制。
    """
    global _browser, _playwright
    if _browser and _browser.is_connected():
        return _browser

    with _browser_lock:
        if _browser and _browser.is_connected():
            return _browser

        try:
            from playwright.sync_api import sync_playwright
        except ImportError as e:
            raise RuntimeError(
                "Playwright 未安装。请在 ai-service 目录执行: "
                "pip install playwright && playwright install chromium"
            ) from e

        _playwright = sync_playwright().start()
        _browser = _playwright.chromium.launch(
            headless=True,
            args=[
                "--no-sandbox",
                "--disable-setuid-sandbox",
                "--disable-dev-shm-usage",
                "--disable-gpu",
                "--disable-extensions",
                "--disable-plugins",
                "--disable-default-apps",
            ],
        )
        logger.info("[screenshot_service] sync Playwright Chromium 启动成功")
        return _browser


def _check_headers_can_embed(headers: dict[str, str]) -> bool:
    """检查 HTTP 响应头判断是否可 iframe 嵌入。"""
    xfo = headers.get("x-frame-options", "").upper()
    if xfo in ("DENY", "SAMEORIGIN"):
        return False

    csp = headers.get("content-security-policy", "")
    if "frame-ancestors" in csp.lower():
        fa_part = csp.lower().split("frame-ancestors", 1)[1]
        if "'none'" in fa_part or "'self'" in fa_part:
            return False

    return True


def _probe_can_embed_sync(url: str) -> dict[str, Any]:
    """同步探测 URL 是否可 iframe 嵌入(只查 HTTP 头,不截图)。"""
    browser = _get_browser_sync()
    context = browser.new_context()
    try:
        response = context.request.get(url, timeout=10000)
        headers = {k.lower(): v for k, v in response.headers.items()}
        can_embed = _check_headers_can_embed(headers)
        return {"url": url, "can_embed": can_embed}
    except Exception as e:
        logger.debug("[screenshot_service] probe_can_embed 失败(降级为不可嵌入): %s", e)
        return {"url": url, "can_embed": False}
    finally:
        context.close()


def _take_screenshot_sync(
    url: str,
    width: int,
    height: int,
    full_page: bool,
    wait_until: str,
    timeout: int,
) -> dict[str, Any]:
    """同步截图(在线程池中运行,避免 EventLoop 兼容问题)。"""
    browser = _get_browser_sync()

    context = browser.new_context(
        viewport={"width": width, "height": height},
        locale="zh-CN",
        timezone_id="Asia/Shanghai",
    )

    # 拦截图片/字体/媒体资源加速截图
    def _route_filter(route: Any) -> None:
        rt = route.request.resource_type
        if rt in ("image", "font", "media"):
            route.abort()
        else:
            route.continue_()

    context.route("**/*", _route_filter)

    page = context.new_page()
    try:
        wait_map = {
            "none": None,
            "dom": "domcontentloaded",
            "load": "load",
            "networkidle": "networkidle",
        }
        wait_option = wait_map.get(wait_until, "load")

        goto_kwargs: dict[str, Any] = {"timeout": timeout}
        if wait_option:
            goto_kwargs["wait_until"] = wait_option

        response = page.goto(url, **goto_kwargs)
        if not response:
            raise RuntimeError(f"页面加载失败: {url}")

        screenshot_bytes = page.screenshot(full_page=full_page, type="png")
        screenshot_b64 = base64.b64encode(screenshot_bytes).decode("ascii")

        title = page.title()
        final_url = page.url

        can_embed = _check_headers_can_embed(
            {k.lower(): v for k, v in response.headers.items()}
        )

        return {
            "screenshot": screenshot_b64,
            "title": title or final_url,
            "url": final_url,
            "can_embed": can_embed,
            "captured_at": int(time.time() * 1000),
        }
    finally:
        page.close()
        context.close()


# === async wrapper(供 FastAPI 路由调用)===


async def take_screenshot(
    url: str,
    *,
    width: int = 1280,
    height: int = 720,
    full_page: bool = False,
    wait_until: str = "load",
    timeout: int = 15000,
) -> dict[str, Any]:
    """异步截图:在线程池中运行同步截图,不受 EventLoop policy 限制。"""
    loop = asyncio.get_event_loop()
    return await loop.run_in_executor(
        None,
        _take_screenshot_sync,
        url,
        width,
        height,
        full_page,
        wait_until,
        timeout,
    )


async def probe_can_embed(url: str) -> dict[str, Any]:
    """异步探测:在线程池中运行同步探测。"""
    loop = asyncio.get_event_loop()
    return await loop.run_in_executor(None, _probe_can_embed_sync, url)


# === 向后兼容:async API(供 opencompass_scrape 等旧代码使用)===
# 注意:Windows + SelectorEventLoop 下可能报 NotImplementedError,
# 新代码应使用 sync API + run_in_executor


async def _get_browser() -> Any:
    """获取单例 async Browser(向后兼容,用 async_playwright)。

    注意:Windows + python-socketio 环境下可能因 EventLoop 不支持
    subprocess_exec 而报 NotImplementedError。新代码应使用
    _get_browser_sync + run_in_executor 代替。
    """
    global _browser_async, _playwright_async
    if _browser_async and _browser_async.is_connected():
        return _browser_async

    async with _browser_lock_async:
        if _browser_async and _browser_async.is_connected():
            return _browser_async

        from playwright.async_api import async_playwright

        _playwright_async = await async_playwright().start()
        _browser_async = await _playwright_async.chromium.launch(
            headless=True,
            args=[
                "--no-sandbox",
                "--disable-setuid-sandbox",
                "--disable-dev-shm-usage",
                "--disable-gpu",
                "--disable-extensions",
                "--disable-plugins",
                "--disable-default-apps",
            ],
        )
        logger.info("[screenshot_service] async Playwright Chromium 启动成功")
        return _browser_async


async def _probe_can_embed(page: Any, url: str) -> bool:
    """探测 URL 是否可 iframe 嵌入(向后兼容 async 版本)。"""
    try:
        response = await page.context.request.get(url, timeout=10000)
        headers = {k.lower(): v for k, v in response.headers.items()}
        return _check_headers_can_embed(headers)
    except Exception as e:
        logger.debug("[screenshot_service] async probe_can_embed 失败: %s", e)
        return False


async def shutdown() -> None:
    """关闭所有 Playwright 实例(sync + async,应用退出时调用)。"""
    global _browser, _playwright, _browser_async, _playwright_async

    # 关闭 sync Browser
    if _browser:
        try:
            _browser.close()
        except Exception as e:
            logger.warning("[screenshot_service] 关闭 sync Browser 失败: %s", e)
        _browser = None
    if _playwright:
        try:
            _playwright.stop()
        except Exception as e:
            logger.warning("[screenshot_service] 停止 sync Playwright 失败: %s", e)
        _playwright = None

    # 关闭 async Browser
    if _browser_async:
        try:
            await _browser_async.close()
        except Exception as e:
            logger.warning("[screenshot_service] 关闭 async Browser 失败: %s", e)
        _browser_async = None
    if _playwright_async:
        try:
            await _playwright_async.stop()
        except Exception as e:
            logger.warning("[screenshot_service] 停止 async Playwright 失败: %s", e)
        _playwright_async = None
