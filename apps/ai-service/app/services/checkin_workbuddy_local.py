# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""本机 Chrome → WorkBuddy 网页会话 Cookie 抽取(2026-10-24 立)。

为什么需要:WorkBuddy 网页会话(`session` cookie,HttpOnly,7 天)是目前唯一
能在客户端关闭后继续签到的凭据。服务端没有可用的续期接口:

- Keycloak 直连刷新 ⇒ `unauthorized_client`(console 客户端需凭据);
- 网关注入刷新(`/console/v2/auth/token/refresh`)⇒ 旧离线令牌 `access_denied`;
- 静默 SSO(`prompt=none` + KEYCLOAK_SESSION)⇒ `login_required`(身份 cookie 已失效)。

因此续期只能回到浏览器本身。Chrome 155 的 cookie 用 app-bound 加密(ABE),
外部进程无法解密;但**同一个 chrome.exe** 可以。做法:

1. `esentutl /y /vss` 快照被锁的 `Network/Cookies` 与 `Local State`(VSS 只读复制);
2. 复制到临时 profile,用 `--headless=new` 启动同一个 chrome.exe;
3. 读 `DevToolsActivePort`,经 CDP `Storage.getCookies` 拿到明文 cookie;
4. 立刻 kill 进程并删除临时目录。

本模块只读、不写 Chrome 的任何数据;取不到一律返回 None 并点名原因(§0.3)。
"""

from __future__ import annotations

import asyncio
import json
import os
import shutil
import subprocess
import sys
import tempfile
from typing import Any, Final

import websockets

from app.core.logging import get_logger

logger = get_logger(__name__)

_COOKIE_HOST_SUFFIX: Final = "workbuddy.cn"
_TARGET_PATHS: Final = ("/console/account", "/v2/billing/meter/daily-checkin")
_CREATE_NO_WINDOW: Final = 0x08000000 if sys.platform == "win32" else 0


def _chrome_exe() -> str | None:
    if sys.platform != "win32":
        return None
    local = os.environ.get("LOCALAPPDATA") or ""
    candidates = [
        os.path.join(local, "Google", "Chrome", "Application", "chrome.exe"),
        os.path.join(os.environ.get("ProgramFiles", ""), "Google", "Chrome", "Application", "chrome.exe"),
        os.path.join(
            os.environ.get("ProgramFiles(x86)", ""), "Google", "Chrome", "Application", "chrome.exe"
        ),
    ]
    for path in candidates:
        if path and os.path.isfile(path):
            return path
    return None


def _default_user_data() -> str:
    return os.path.join(os.environ.get("LOCALAPPDATA") or "", "Google", "Chrome", "User Data")


def _vss_copy(src: str, dst: str) -> bool:
    """esentutl VSS 只读快照(Chrome 运行中会锁库,普通复制拿不到一致副本)。"""
    try:
        subprocess.run(
            ["esentutl.exe", "/y", "/vss", src, "/d", dst],
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
            timeout=30,
            creationflags=_CREATE_NO_WINDOW,
            check=False,
        )
    except (OSError, subprocess.SubprocessError) as e:
        logger.warning("[wb-local] esentutl 失败(%s): %s", os.path.basename(src), e)
        return False
    return os.path.isfile(dst) and os.path.getsize(dst) > 0


def _build_cookie_header(cookies: list[dict[str, Any]]) -> str:
    """只拼当前业务路径会发送的 cookie(按 Chrome 的 path 规则),不夹带无关域。"""
    picked: dict[str, str] = {}
    for c in sorted(cookies, key=lambda x: len(str(x.get("path") or "/"))):
        name = c.get("name")
        value = c.get("value")
        path = str(c.get("path") or "/")
        if not isinstance(name, str) or not isinstance(value, str):
            continue
        if path != "/" and not any(p.startswith(path.rstrip("/") + "/") or p == path for p in _TARGET_PATHS):
            continue
        picked[name] = value
    return "; ".join(f"{k}={v}" for k, v in picked.items())


async def _cdp_get_cookies(port: int, ws_path: str) -> tuple[list[dict[str, Any]], str | None]:
    """连 DevTools,返回 (cookies, userAgent)。ws_path 来自 DevToolsActivePort 第二行。"""
    async with websockets.connect(f"ws://127.0.0.1:{port}{ws_path}", open_timeout=10) as ws:
        await ws.send(json.dumps({"id": 1, "method": "Storage.getCookies"}))
        while True:
            msg = json.loads(await asyncio.wait_for(ws.recv(), timeout=15))
            if msg.get("id") == 1:
                cookies = (msg.get("result") or {}).get("cookies") or []
                break
        await ws.send(json.dumps({"id": 2, "method": "Browser.getVersion"}))
        user_agent = None
        while True:
            msg = json.loads(await asyncio.wait_for(ws.recv(), timeout=15))
            if msg.get("id") == 2:
                user_agent = (msg.get("result") or {}).get("userAgent")
                break
    return cookies, user_agent


async def extract_workbuddy_cookie(
    *, user_data_dir: str | None = None, timeout: float = 45.0
) -> dict[str, Any] | None:
    """从本机 Chrome 抽取 WorkBuddy 网页会话。

    成功返回 {cookie, session, expires_at, user_agent};任何一步取不到 ⇒ None(点名原因)。
    """
    chrome = _chrome_exe()
    if not chrome:
        logger.info("[wb-local] 未找到 chrome.exe,跳过网页会话抽取")
        return None
    root = user_data_dir or _default_user_data()
    cookies_src = os.path.join(root, "Default", "Network", "Cookies")
    state_src = os.path.join(root, "Local State")
    if not os.path.isfile(cookies_src):
        logger.warning("[wb-local] 未找到 Chrome cookies 库: %s", cookies_src)
        return None

    tmp = tempfile.mkdtemp(prefix="ihui-wb-")
    proc: asyncio.subprocess.Process | None = None
    try:
        dst_cookies = os.path.join(tmp, "Default", "Network", "Cookies")
        os.makedirs(os.path.dirname(dst_cookies), exist_ok=True)
        if not await asyncio.to_thread(_vss_copy, cookies_src, dst_cookies):
            logger.warning("[wb-local] cookies 快照失败(Chrome 未运行或权限不足)")
            return None
        dst_state = os.path.join(tmp, "Local State")
        if os.path.isfile(state_src):
            await asyncio.to_thread(_vss_copy, state_src, dst_state)

        proc = await asyncio.create_subprocess_exec(
            chrome,
            "--headless=new",
            f"--user-data-dir={tmp}",
            "--remote-debugging-port=0",
            "--no-first-run",
            "--no-default-browser-check",
            "--disable-gpu",
            "--disable-extensions",
            "about:blank",
            stdout=asyncio.subprocess.DEVNULL,
            stderr=asyncio.subprocess.DEVNULL,
            creationflags=_CREATE_NO_WINDOW,
        )
        port_file = os.path.join(tmp, "DevToolsActivePort")
        port = 0
        ws_path = ""
        deadline = asyncio.get_running_loop().time() + timeout
        while asyncio.get_running_loop().time() < deadline:
            if os.path.isfile(port_file):
                try:
                    lines = open(port_file, encoding="utf-8").read().splitlines()
                    port = int(lines[0].strip()) if lines else 0
                    ws_path = lines[1].strip() if len(lines) > 1 else ""
                except (OSError, ValueError):
                    port, ws_path = 0, ""
                if port and ws_path:
                    break
            if proc.returncode is not None:
                logger.warning("[wb-local] 无头 Chrome 提前退出 rc=%s", proc.returncode)
                return None
            await asyncio.sleep(0.2)
        if not port or not ws_path:
            logger.warning("[wb-local] 无头 Chrome 未在 %.0fs 内就绪", timeout)
            return None

        cookies, user_agent = await _cdp_get_cookies(port, ws_path)
        # 无头 Chrome 自报 HeadlessChrome/155,本域网关按此判机器人 ⇒ 302 回登录页
        # (2026-10-24 实测:同 cookie 换 Chrome/155 立即 200)。版本号原样保留。
        if isinstance(user_agent, str) and "HeadlessChrome/" in user_agent:
            user_agent = user_agent.replace("HeadlessChrome/", "Chrome/")
        relevant = [c for c in cookies if str(c.get("domain") or "").endswith(_COOKIE_HOST_SUFFIX)]
        header = _build_cookie_header(relevant)
        session = next((c for c in relevant if c.get("name") == "session"), None)
        if not header or not session:
            logger.warning("[wb-local] Chrome 中没有 WorkBuddy 网页会话(需先在浏览器登录)")
            return None
        expires = session.get("expires")
        return {
            "cookie": header,
            "session": session.get("value"),
            "expires_at": int(expires) if isinstance(expires, (int, float)) and expires > 0 else None,
            "user_agent": user_agent,
        }
    except (OSError, asyncio.TimeoutError, websockets.WebSocketException) as e:
        logger.warning("[wb-local] 抽取异常: %s: %s", type(e).__name__, e)
        return None
    finally:
        if proc is not None and proc.returncode is None:
            try:
                proc.kill()
                await asyncio.wait_for(proc.wait(), timeout=5)
            except (ProcessLookupError, asyncio.TimeoutError):
                pass
        await asyncio.to_thread(shutil.rmtree, tmp, True)
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
