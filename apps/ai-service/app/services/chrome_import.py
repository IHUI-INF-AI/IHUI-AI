# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 本仓库以 Apache-2.0 授权分发，须保留本声明与 LICENSE / NOTICE。

"""从外部 Google Chrome CDP 调试端口导入登录 Cookie(2026-08-17 新增)。

场景:桌面端(Tauri)弹出用户自己的 Google Chrome(完整浏览器体验):
    chrome.exe --app=<登录页URL> --remote-debugging-port=<随机端口> --user-data-dir=<临时目录>
用户扫码/登录完成后,前端轮询本服务 → 通过 CDP 调试端口提取 Cookie → 检测登录成功 → 自动保存账号。

安全性(重点):
- `connect_over_cdp` 连接的是"现有 Chrome"(不是新起浏览器),**绝不调用 browser.close()**,
  否则会发送 CDP Browser.close 命令关闭用户的 Chrome(已验证 `_should_close_connection_on_close=False`)。
- 通过 `async with async_playwright()` 作用域退出时仅断开 playwright driver 的 pipe 连接,
  已实测外部 Chrome 进程不受影响。
"""
from __future__ import annotations

import asyncio
import time
from typing import Any

from ..core.logging import get_logger
from .scan_login import PLATFORM_SCAN_CONFIG, _collect_platform_relevant, _save_account_to_db

logger = get_logger(__name__)

# 归属判定不在这里:唯一出口是 scan_login._collect_platform_relevant(域名优先、名称兜底、判不出即丢)。
# 本文件曾因自带一份"统计类关键字"名单,把用户 Chrome 全部 context 的整包 cookie 直接落库
# —— 2026-09-27 库里那两份逐字节相同的 533 字段混包就是这个形状(同一次整浏览器 jar 被存成了两个平台账号)。

# CDP 就绪探测参数
_CDP_READY_TIMEOUT_SECONDS = 10.0
_CDP_POLL_INTERVAL_SECONDS = 0.5
_HTTP_TIMEOUT_SECONDS = 3.0


async def _wait_for_cdp_ready(port: int) -> bool:
    """轮询 CDP 调试端口是否就绪(静默重试,最多 10 秒)。"""
    import httpx

    url = f"http://127.0.0.1:{port}/json/version"
    deadline = time.monotonic() + _CDP_READY_TIMEOUT_SECONDS
    async with httpx.AsyncClient(timeout=_HTTP_TIMEOUT_SECONDS) as client:
        while time.monotonic() < deadline:
            try:
                resp = await client.get(url)
                if resp.status_code == 200:
                    return True
            except Exception:
                # 端口未就绪,静默重试
                pass
            await asyncio.sleep(_CDP_POLL_INTERVAL_SECONDS)
    return False


async def _collect_cookies_from_browser(browser: Any) -> tuple[dict[str, str], list[dict[str, Any]]]:
    """遍历 browser.contexts 合并 cookie,并**一并带回原始条目(含 domain)**供上层按站点归属筛。"""
    cookies_dict: dict[str, str] = {}
    raw: list[dict[str, Any]] = []
    for ctx in browser.contexts:
        try:
            for c in await ctx.cookies():
                if c.get("value"):
                    cookies_dict[str(c["name"])] = str(c["value"])
                    raw.append(dict(c))
        except Exception:
            # 单个 context 异常不影响其它 context 的 cookie
            continue
    return cookies_dict, raw


async def import_chrome_cookies(port: int, platform: str, user_id: str) -> dict[str, Any]:
    """从外部 Chrome CDP 调试端口提取 Cookie、检测登录并保存账号。

    Args:
        port: 外部 Chrome 的 CDP 调试端口。
        platform: 平台 ID(需在 PLATFORM_SCAN_CONFIG 中)。
        user_id: 当前登录用户 ID。

    Returns:
        {"detected": bool, "cookies_count": int, "account_id": int|None, "error": str|None}
    """
    # 1. 平台校验
    if platform not in PLATFORM_SCAN_CONFIG:
        return {"detected": False, "cookies_count": 0, "account_id": None,
                "error": f"不支持的平台: {platform}"}

    # 2. 等 CDP 就绪(最多 10 秒,每 0.5s 一次)
    if not await _wait_for_cdp_ready(port):
        return {"detected": False, "cookies_count": 0, "account_id": None,
                "error": "Chrome 调试端口未就绪"}

    config = PLATFORM_SCAN_CONFIG[platform]

    try:
        from playwright.async_api import async_playwright

        async with async_playwright() as p:
            # connect_over_cdp 连接现有 Chrome(不新起浏览器)
            browser = await p.chromium.connect_over_cdp(f"http://127.0.0.1:{port}")
            # 注意:绝不调用 browser.close()(会关闭用户的 Chrome);
            # async with 作用域退出时仅断开 playwright driver 连接,外部 Chrome 不受影响。
            cookies_dict, raw_cookies = await _collect_cookies_from_browser(browser)
        # 先按平台归属筛:整浏览器 jar 里"名字像"的登录 cookie 不等于"这一站的登录态"
        cookies_dict = _collect_platform_relevant(platform, cookies_dict, raw_cookies, config)

        # 3. 检测命中:success_cookies 中任一 key 存在且值长度 > 5
        hit = [
            target for target in config["success_cookies"]
            if target in cookies_dict and len(cookies_dict.get(target, "")) > 5
        ]
        if not hit:
            return {"detected": False, "cookies_count": len(cookies_dict),
                    "account_id": None, "error": None}

        # 4. 命中集已在上面按归属筛过(不再套名字黑名单),直接加密保存
        all_relevant = cookies_dict
        account_id = await _save_account_to_db(user_id, platform, all_relevant, config["name"])
        logger.info(
            f"[chrome_import] 导入成功: platform={platform}, account_id={account_id}, "
            f"cookies={len(all_relevant)}"
        )
        return {"detected": True, "cookies_count": len(all_relevant),
                "account_id": account_id, "error": None}
    except Exception as e:
        logger.exception(
            f"[chrome_import] 导入失败: port={port}, platform={platform}, error={e}"
        )
        return {"detected": False, "cookies_count": 0, "account_id": None, "error": str(e)}
