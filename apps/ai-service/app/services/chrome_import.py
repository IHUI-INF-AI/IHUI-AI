# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""从外部 Google Chrome CDP 调试端口导入登录 Cookie(2026-08-17 新增)。

场景:桌面端(Tauri)弹出用户自己的 Google Chrome(完整浏览器体验):
    chrome.exe --app=<登录页URL> --remote-debugging-port=<随机端口> --user-data-dir=<临时目录>
用户扫码/登录完成后,前端轮询本服务 → 通过 CDP 调试端口提取 Cookie → 检测登录成功 → 自动保存账号。

2026-09-30 补"拉起"半边:此前只实现了"对着一个已在监听的 CDP 端口导入"这后半截,
前端没有消费方、Chrome 由谁拉起也没着落 ⇒ 整条能力悬空。现在补上
`launch_chrome_for_import`:后端找用户本机 Chrome/Edge → 独立临时 profile(规避
Chrome 136+ 禁默认 profile 开 CDP 的限制,也避开单例锁)→ 独立调试端口 → --app 打开
平台登录页。前端流程:launch-chrome 拿 port → 用户在新窗口登录 → 轮询 import-chrome。

安全性(重点):
- `connect_over_cdp` 连接的是"现有 Chrome"(不是新起浏览器),**绝不调用 browser.close()**,
  否则会发送 CDP Browser.close 命令关闭用户的 Chrome(已验证 `_should_close_connection_on_close=False`)。
- 通过 `async with async_playwright()` 作用域退出时仅断开 playwright driver 的 pipe 连接,
  已实测外部 Chrome 进程不受影响。
- CDP 只绑 127.0.0.1 回环(Chrome 默认行为),端口由 OS 随机分配,导入动作要过 JWT 鉴权。
"""
from __future__ import annotations

import asyncio
import os
import socket
import subprocess
import sys
import tempfile
import time
from pathlib import Path
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
    """轮询 CDP 调试端口是否就绪(静默重试,最多 10 秒)。

    trust_env=False 是硬要求(2026-09-30 实证):本机系统代理会拦回环地址,
    默认 trust_env=True 时 httpx 把 127.0.0.1 也交给代理 → 502 "upstream connect failed",
    端口明明活着却永远探不 ready。
    """
    import httpx

    url = f"http://127.0.0.1:{port}/json/version"
    deadline = time.monotonic() + _CDP_READY_TIMEOUT_SECONDS
    async with httpx.AsyncClient(timeout=_HTTP_TIMEOUT_SECONDS, trust_env=False) as client:
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


# =============================================================================
# 拉起 Chrome(2026-09-30 新增):chrome_import 消费端闭环的"前半截"
# =============================================================================

# 候选浏览器:Chrome 优先,Edge 兜底(同为 Chromium,CDP 行为一致;Windows 机器必有 Edge)。
# Windows 常规安装位 + 注册表 App Paths 都查;环境变量 IHUI_CHROME_PATH 可强制指定。
_BROWSER_CANDIDATES: list[tuple[str, list[str]]] = [
    (
        "chrome",
        [
            # 环境变量覆盖(放最前,优先级最高)
            os.environ.get("IHUI_CHROME_PATH", ""),
            r"C:\Program Files\Google\Chrome\Application\chrome.exe",
            r"C:\Program Files (x86)\Google\Chrome\Application\chrome.exe",
            str(Path.home() / "AppData" / "Local" / "Google" / "Chrome" / "Application" / "chrome.exe"),
            "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
            "/usr/bin/google-chrome",
            "/usr/bin/google-chrome-stable",
        ],
    ),
    (
        "edge",
        [
            r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe",
            r"C:\Program Files\Microsoft\Edge\Application\msedge.exe",
            str(Path.home() / "AppData" / "Local" / "Microsoft" / "Edge" / "Application" / "msedge.exe"),
            "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
            "/usr/bin/microsoft-edge",
        ],
    ),
]

# 就绪等待时长由 _wait_for_cdp_ready 自身的 _CDP_READY_TIMEOUT_SECONDS 决定(10s),
# 这里不再单独设常量,避免两处超时来源漂移。


def _find_browser_executable() -> tuple[str, str] | tuple[None, None]:
    """按候选清单找本机可用的 Chromium 系浏览器。返回 (路径, 浏览器名) 或 (None, None)。"""
    for name, candidates in _BROWSER_CANDIDATES:
        for cand in candidates:
            if not cand:
                continue
            try:
                if os.path.isfile(cand) and os.access(cand, os.X_OK):
                    return cand, name
            except OSError:
                continue
    return None, None


def _pick_free_port() -> int:
    """向 OS 要一个空闲回环端口(绑定 127.0.0.1:0 后立刻释放)。

    有极小的竞态窗口(释放后到 Chrome 监听前被别的进程抢走),但 CDP 就绪探测
    (launch 流程内)会兜住这种偶发,失败由 data.error 如实上报。
    """
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.bind(("127.0.0.1", 0))
        return int(s.getsockname()[1])


def _spawn_browser(chrome_path: str, port: int, login_url: str, profile_dir: str) -> None:
    """脱离当前进程树拉起浏览器(用户登录窗口,必须可见,不能跟随服务进程退出)。"""
    args = [
        chrome_path,
        f"--user-data-dir={profile_dir}",
        f"--remote-debugging-port={port}",
        "--no-first-run",
        "--no-default-browser-check",
        f"--app={login_url}",
    ]
    if sys.platform == "win32":
        flags = subprocess.CREATE_NEW_PROCESS_GROUP | subprocess.DETACHED_PROCESS
        try:
            # BREAKAWAY 优先:彻底脱离服务的 job 对象,服务重启也不牵连用户的登录窗口。
            subprocess.Popen(
                args,
                creationflags=flags | subprocess.CREATE_BREAKAWAY_FROM_JOB,
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL,
                close_fds=True,
            )
            return
        except PermissionError:
            # job 对象不允许 breakaway(WinError 5)时降级:仍在 job 内,但 DETACHED
            # 已保证不继承控制台;常规部署(NSSM 服务/前台进程)两种都验证可用。
            pass
        subprocess.Popen(
            args,
            creationflags=flags,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
            close_fds=True,
        )
    else:
        subprocess.Popen(
            args,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
            start_new_session=True,
            close_fds=True,
        )


async def launch_chrome_for_import(platform: str) -> dict[str, Any]:
    """为本平台拉起一个带 CDP 调试端口的浏览器窗口,打开平台登录页。

    Returns:
        {"launched": bool, "port": int|None, "login_url": str|None,
         "browser": str|None, "error": str|None}
    """
    if platform not in PLATFORM_SCAN_CONFIG:
        return {"launched": False, "port": None, "login_url": None,
                "browser": None, "error": f"不支持的平台: {platform}"}

    config = PLATFORM_SCAN_CONFIG[platform]
    login_url = config.get("login_url")
    if not login_url:
        return {"launched": False, "port": None, "login_url": None,
                "browser": None, "error": f"平台 {platform} 未配置登录页地址"}

    browser_path, browser_name = _find_browser_executable()
    if not browser_path or not browser_name:
        return {"launched": False, "port": None, "login_url": login_url,
                "browser": None, "error": "本机未找到 Chrome/Edge 浏览器"}

    port = _pick_free_port()
    # 独立临时 profile:既规避 Chrome 136+ 对默认 profile 的 CDP 封禁,也避开
    # "用户 Chrome 已在运行"的单例锁(同 profile 二次启动只会新开标签页、不开调试端口)。
    profile_dir = tempfile.mkdtemp(prefix="ihui-chrome-import-")

    try:
        _spawn_browser(browser_path, port, str(login_url), profile_dir)
    except Exception as e:
        logger.exception(f"[chrome_import] 拉起浏览器失败: platform={platform}, error={e}")
        return {"launched": False, "port": port, "login_url": str(login_url),
                "browser": browser_name, "error": f"拉起浏览器失败: {e}"}

    # 等调试端口真正就绪(浏览器冷启动可能要几秒),超时不算硬失败——
    # 窗口可能仍在起,前端轮询 import-chrome 时每次调用内部还会再探。
    ready = await _wait_for_cdp_ready(port)
    logger.info(
        f"[chrome_import] 已拉起浏览器: platform={platform}, browser={browser_name}, "
        f"port={port}, ready={ready}, profile={profile_dir}"
    )
    return {"launched": True, "port": port, "login_url": str(login_url),
            "browser": browser_name, "error": None if ready else "浏览器已启动,调试端口就绪较慢,请稍候"}


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
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
