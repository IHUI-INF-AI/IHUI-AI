"""通用网页渲染抓取服务(2026-09-05 新增)。

用途:Cloudflare 挑战类站点(chatgpt / claude / midjourney / dalle / leonardo /
ideogram / sora / perplexity / the-information 等)纯 HTTP fetch 返回 403,
需 Playwright headless Chromium 渲染后取 HTML。
供 apps/api 的 ai-world-sync.ts fetchSiteMeta 在直接抓取失败时兜底调用。

设计:
- 复用 screenshot_service._get_browser_sync 单例(避免重复启动 Chromium)
- sync API + run_in_executor(根治 Windows SelectorEventLoop NotImplementedError)
- Cloudflare 挑战检测("Just a moment" / cf-challenge 等),挑战未通过抛异常
- 代理:PLAYWRIGHT_PROXY_URL > HTTPS_PROXY > HTTP_PROXY(本机为 Clash 7897),
  在 context 级传入(Chromium 不读环境变量代理)
"""

from __future__ import annotations

import asyncio
import logging
import os
import threading
import time
from concurrent.futures import ThreadPoolExecutor
from typing import Any

logger = logging.getLogger(__name__)

# 根治线程亲和(2026-09-05):Playwright 同步对象绑定创建线程,且 greenlet 禁止跨线程切换。
# 此前用默认线程池 + 全局锁,锁只保证"不并发"但执行仍在不同物理线程间漂移,
# 实测同步期间报 "Cannot switch to a different thread" 全军覆没。
# 正解:专属单线程 executor —— 所有渲染永远在同一线程执行,浏览器实例也在该线程
# 内惰性创建(亲和性从此恒定),并独立于 screenshot_service 的共享单例,互不干扰。
_render_executor = ThreadPoolExecutor(max_workers=1, thread_name_prefix="browser-render")

_playwright: Any = None
_browser: Any = None
_browser_lock = threading.Lock()

# Cloudflare 挑战页特征(只检查前 4000 字符,降低误判)
_CF_MARKERS = (
    "just a moment",
    "cf-challenge",
    "challenge-platform",
    "cf-browser-verification",
    "attention required",
)


def _pick_proxy() -> str:
    """挑渲染代理:显式 PLAYWRIGHT_PROXY_URL 优先,回退通用 HTTPS/HTTP_PROXY。"""
    for key in ("PLAYWRIGHT_PROXY_URL", "HTTPS_PROXY", "https_proxy", "HTTP_PROXY", "http_proxy"):
        val = os.environ.get(key)
        if val:
            return val
    return ""


def _ensure_browser() -> Any:
    """在渲染线程内惰性创建 Playwright + Chromium 单例(线程亲和正确的前提)。"""
    global _playwright, _browser
    with _browser_lock:
        if _browser is None:
            from playwright.sync_api import sync_playwright

            _playwright = sync_playwright().start()
            launch_kwargs: dict[str, Any] = {"headless": True}
            proxy = _pick_proxy()
            if proxy:
                # 代理放在 browser 级(Chromium 不读环境变量代理),context 无需重复传
                launch_kwargs["proxy"] = {"server": proxy}
            _browser = _playwright.chromium.launch(**launch_kwargs)
            logger.info("[browser_render] chromium launched on dedicated render thread (proxy=%s)", bool(proxy))
    return _browser


def _render_page_sync(url: str, timeout_ms: int = 30000) -> dict[str, Any]:
    """同步渲染页面(只会被提交到 _render_executor 单线程执行)。

    返回 {url, final_url, http_status, title, html, captured_at}。
    失败抛异常,由调用方(路由层)捕获转 ApiResponse。
    """
    return _render_page_locked(url, timeout_ms)


def _render_page_locked(url: str, timeout_ms: int) -> dict[str, Any]:
    browser = _ensure_browser()
    context_kwargs: dict[str, Any] = {
        "viewport": {"width": 1280, "height": 900},
        "locale": "zh-CN",
        "timezone_id": "Asia/Shanghai",
        "user_agent": (
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
            "AppleWebKit/537.36 (KHTML, like Gecko) "
            "Chrome/120.0.0.0 Safari/537.36"
        ),
    }

    context = browser.new_context(**context_kwargs)
    page = context.new_page()
    try:
        resp = page.goto(url, wait_until="domcontentloaded", timeout=timeout_ms)
        status = resp.status if resp is not None else None

        # 等 JS 渲染收敛(networkidle 短等待,失败不阻塞)
        try:
            page.wait_for_load_state("networkidle", timeout=10_000)
        except Exception:
            pass

        # Cloudflare 挑战等待:最多再等 15s,轮询检查挑战标记是否消失
        deadline = time.time() + 15
        while time.time() < deadline:
            html = page.content()
            low = html[:4000].lower()
            if not any(marker in low for marker in _CF_MARKERS):
                break
            page.wait_for_timeout(3000)

        html = page.content()
        low = html[:4000].lower()
        if any(marker in low for marker in _CF_MARKERS):
            raise RuntimeError("cloudflare challenge not passed (headless)")

        return {
            "url": url,
            "final_url": page.url,
            "http_status": status,
            "title": page.title(),
            "html": html,
            "captured_at": int(time.time() * 1000),
        }
    finally:
        page.close()
        context.close()


async def render_page(url: str, timeout_ms: int = 30000) -> dict[str, Any]:
    """异步渲染页面:提交到专属单线程 executor,保证 Playwright 线程亲和。"""
    loop = asyncio.get_event_loop()
    return await loop.run_in_executor(_render_executor, _render_page_sync, url, timeout_ms)
