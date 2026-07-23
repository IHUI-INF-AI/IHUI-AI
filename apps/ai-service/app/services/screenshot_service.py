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
import ipaddress
import logging
import socket
import threading
import time
from typing import Any
from urllib.parse import urlparse

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# SSRF 防护(2026-07-24 安全加固,CWE-918)
# ---------------------------------------------------------------------------
# 攻击场景:用户调 screenshot_url 工具传 http://169.254.169.254/ 窃取云元数据,
# 或 file:///etc/passwd 读本地文件,或 http://127.0.0.1:8801/ 探测内网 API。
# 防护:协议白名单 + 端口白名单 + IP 黑名单(内网/保留/链路本地)+ DNS 解析校验。

_ALLOWED_SCHEMES = {"http", "https"}
_ALLOWED_PORTS = {80, 443, 8080, 8443, 3000, 8801}


def _is_private_ip(ip: str) -> bool:
    """检查 IP 是否为内网/保留地址(SSRF 黑名单)。

    覆盖:私有(10/172.16/192.168)/ 回环(127)/ 链路本地(169.254 云元数据)/
          保留 / 未指定 / 多播。命中任一即视为危险。
    """
    try:
        addr = ipaddress.ip_address(ip)
    except ValueError:
        return True  # 无效 IP 视为危险(fail-closed)
    return (
        addr.is_private
        or addr.is_loopback
        or addr.is_link_local  # 含 169.254.x.x(云元数据 IP)
        or addr.is_reserved
        or addr.is_unspecified
        or addr.is_multicast
    )


def _validate_url_ssrf(url: str) -> tuple[bool, str]:
    """SSRF 防护:校验 URL 协议、域名、IP、端口。

    Returns:
        (True, "") 或 (False, reason)
    """
    try:
        parsed = urlparse(url)
    except Exception as e:
        return False, f"URL 解析失败: {e}"

    # 1. 协议白名单(禁止 file:// / gopher:// / dict:// / ftp:// 等)
    if parsed.scheme not in _ALLOWED_SCHEMES:
        return False, f"协议 {parsed.scheme!r} 不被允许(仅 http/https)"

    hostname = parsed.hostname
    if not hostname:
        return False, "URL 缺少 hostname"

    # 2. 端口白名单(若显式指定端口)
    if parsed.port is not None and parsed.port not in _ALLOWED_PORTS:
        return False, f"端口 {parsed.port} 不在允许列表(80/443/8080/8443/3000/8801)"

    # 3. IP 校验:hostname 是 IP 直接校验;是域名则 DNS 解析后校验所有结果
    try:
        ipaddress.ip_address(hostname)
        if _is_private_ip(hostname):
            return False, f"目标 IP {hostname} 是内网/保留地址,禁止访问"
    except ValueError:
        # 域名:DNS 解析后校验(防 attacker.com 解析到 127.0.0.1)
        try:
            addrs = socket.getaddrinfo(hostname, None)
        except socket.gaierror:
            return False, f"DNS 解析失败: {hostname}"
        seen: set[str] = set()
        for _family, _type, _proto, _canon, sockaddr in addrs:
            ip = sockaddr[0]
            if ip in seen:
                continue
            seen.add(ip)
            # IPv6 sockaddr 可能是 (host, port, flowinfo, scopeid)
            if _is_private_ip(ip):
                return False, f"域名 {hostname} 解析到内网 IP {ip},禁止访问"

    return True, ""

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
    # 2026-07-24 安全加固:SSRF 防护(校验协议/IP/端口,防内网探测 + 云元数据窃取)
    ok, reason = _validate_url_ssrf(url)
    if not ok:
        return {
            "screenshot": "",
            "title": "",
            "url": url,
            "can_embed": False,
            "captured_at": int(time.time() * 1000),
            "ssrf_blocked": True,
            "error": reason,
        }
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
    # 2026-07-24 安全加固:SSRF 防护(与 take_screenshot 同一校验入口)
    ok, reason = _validate_url_ssrf(url)
    if not ok:
        return {"url": url, "can_embed": False, "ssrf_blocked": True, "error": reason}
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
