"""反风控浏览器工厂 — 整合五层防线,创建反风控 BrowserContext。

这是所有 Playwright 适配器的统一入口:替换原来"裸"的
  async with async_playwright() as p:
      browser = await p.chromium.launch(headless=True)
      context = await browser.new_context()
为反风控版本:
  async with async_playwright() as p:
      browser, context = await create_stealth_browser_context(
          account_id="csdn_zhangsan", platform="csdn", playwright_instance=p,
      )

五层防线整合顺序:
1. AccountProfile    — 获取账号持久化画像(指纹+代理+user_data_dir)
2. ProxyConfig       — 用账号绑定代理 launch(同账号同 IP)
3. BrowserFingerprint — 用账号固定指纹 new_context(UA/viewport/timezone)
4. apply_stealth     — 注入反检测 JS(隐藏 webdriver/CDP 特征)
5. launch_persistent_context — 持久化 Cookie/Storage(同账号跨会话稳定)

用 launch_persistent_context 而非 launch+new_context:
- 同账号 Cookie/LocalStorage/IndexedDB 跨会话保留(避免"新设备登录"告警)
- 每账号独立 user_data_dir,完全隔离

诚实说明:
- channel="chrome" 优先用真实 Chrome(比 Chromium 更隐蔽),未安装时降级 Chromium
- headless=True 适合服务器,但部分平台检测 headless,建议关键平台用 headless=False + xvfb(Linux)
"""
from __future__ import annotations

import logging
from typing import Any

from app.core.logging import get_logger
from .account_profile import get_account_profile
from .stealth import apply_stealth
from .stealth_advanced import apply_advanced_stealth

logger = get_logger(__name__)


# Chromium 启动参数(隐藏自动化特征)
_BROWSER_ARGS: list[str] = [
    "--disable-blink-features=AutomationControlled",  # 核心:隐藏 navigator.webdriver
    "--disable-features=IsolateOrigins,site-per-process",
    "--disable-infobars",  # 隐藏"Chrome 正在被自动测试软件控制"信息栏
    "--disable-dev-shm-usage",  # 避免 /dev/shm 不足(容器环境)
    "--no-first-run",
    "--no-default-browser-check",
    "--disable-background-networking",
    "--disable-background-timer-throttling",
    "--disable-renderer-backgrounding",
    "--disable-backgrounding-occluded-windows",
    "--disable-ipc-flooding-protection",  # 避免交互被节流
    "--force-webrtc-ip-handling-policy=disable_non_proxied_udp",  # WebRTC 不泄露真实 IP
    "--webrtc-ip-handling-policy=disable_non_proxied_udp",
]


async def create_stealth_browser_context(
    account_id: str,
    platform: str,
    playwright_instance: Any,
    headless: bool = True,
    use_persistent: bool = True,
) -> tuple[Any, Any]:
    """创建反风控 BrowserContext(所有 Playwright 适配器的统一入口)。

    Args:
        account_id: 账号唯一标识(建议:平台_用户名,如 csdn_zhangsan)
        platform: 平台 ID(如 csdn/zhihu/baijiahao)
        playwright_instance: async_playwright() 返回的实例
        headless: 是否无头(默认 True;关键平台建议 False + 显示器)
        use_persistent: 是否用持久化 context(默认 True,Cookie 跨会话保留)

    Returns:
        (browser, context) — browser 可为 None(持久化模式),context 是 BrowserContext
        使用完毕调用 await context.close()(持久化模式)或先关 context 再关 browser

    Raises:
        RuntimeError: Playwright 环境不可用或代理配置错误
    """
    # 1. 获取账号画像(指纹+代理+user_data_dir,跨会话稳定)
    profile = get_account_profile(account_id, platform)
    fingerprint = profile.fingerprint

    logger.info(
        "[browser_factory] 创建反风控 context:account=%s platform=%s "
        "UA=%s viewport=%s proxy=%s persistent=%s",
        account_id, platform, fingerprint.platform, fingerprint.viewport,
        profile.proxy.server if profile.proxy else "direct(无代理,降级)",
        use_persistent,
    )

    # 2. 构建 launch 参数
    launch_options: dict[str, Any] = {
        "headless": headless,
        "args": _BROWSER_ARGS,
    }

    # 代理(同账号同 IP)
    if profile.proxy:
        launch_options["proxy"] = profile.proxy.to_playwright_proxy()

    # 优先用真实 Chrome(更隐蔽),未安装降级 Chromium
    chrome_path = _find_chrome_executable()
    if chrome_path:
        launch_options["executable_path"] = chrome_path
        logger.debug("[browser_factory] 使用真实 Chrome: %s", chrome_path)
    else:
        launch_options["channel"] = "chrome"  # 让 Playwright 找 Chrome
        logger.debug("[browser_factory] 未找到 Chrome,降级 Chromium")

    # 3. context 选项(指纹)
    context_options = fingerprint.to_context_options()

    # 4. 创建浏览器 + context
    if use_persistent:
        # 持久化模式:Cookie/Storage 跨会话保留(反风控最佳实践)
        context = await playwright_instance.chromium.launch_persistent_context(
            user_data_dir=profile.user_data_dir,
            **launch_options,
            **context_options,
        )
        browser: Any = None  # 持久化模式无独立 browser 对象
    else:
        # 非持久化模式(临时会话,适合无状态验证)
        browser = await playwright_instance.chromium.launch(**launch_options)
        context = await browser.new_context(**context_options)

    # 5. 注入反检测脚本(必须在任何 page.goto 之前)
    await apply_stealth(context, fingerprint.fingerprint_seed)

    # 6. 注入高级反检测脚本(2026-08-01 深度强化,20 类深度检测点)
    # 在 apply_stealth 之后注入,增强字体/WebGL/Battery/Sensor 等深度检测点
    await apply_advanced_stealth(context, account_id)

    logger.info(
        "[browser_factory] 反风控 context 就绪:account=%s seed=%d "
        "stealth=已注入(基础17类+高级20类=37类检测点)",
        account_id, fingerprint.fingerprint_seed,
    )

    return browser, context


def _find_chrome_executable() -> str | None:
    """查找真实 Chrome 可执行文件(优先于 Chromium,更隐蔽)。

    复用 browser_hub._find_chromium_executable 逻辑,但优先找真实 Chrome。
    """
    import os
    from pathlib import Path

    # Windows 常见 Chrome 路径
    if os.name == "nt":
        program_files = os.environ.get("PROGRAMFILES", r"C:\Program Files")
        program_files_x86 = os.environ.get("PROGRAMFILES(X86)", r"C:\Program Files (x86)")
        local_app_data = os.environ.get("LOCALAPPDATA", "")

        candidates = [
            Path(program_files) / "Google" / "Chrome" / "Application" / "chrome.exe",
            Path(program_files_x86) / "Google" / "Chrome" / "Application" / "chrome.exe",
            Path(local_app_data) / "Google" / "Chrome" / "Application" / "chrome.exe",
        ]
        for c in candidates:
            if c.is_file():
                return str(c)

    # macOS
    mac_path = Path("/Applications/Google Chrome.app/Contents/MacOS/Google Chrome")
    if mac_path.is_file():
        return str(mac_path)

    # Linux
    for linux_path in [
        "/usr/bin/google-chrome",
        "/usr/bin/google-chrome-stable",
        "/usr/bin/chromium-browser",
    ]:
        if Path(linux_path).is_file():
            return linux_path

    return None


async def close_stealth_context(browser: Any, context: Any) -> None:
    """关闭反风控 context(统一清理)。

    持久化模式(browser=None):仅关 context。
    非持久化模式:先关 context 再关 browser。
    """
    try:
        await context.close()
    except Exception as e:
        logger.warning("[browser_factory] context.close 异常: %s", e)
    if browser is not None:
        try:
            await browser.close()
        except Exception as e:
            logger.warning("[browser_factory] browser.close 异常: %s", e)


__all__ = ["create_stealth_browser_context", "close_stealth_context"]
