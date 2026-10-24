# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""本机 WorkBuddy 凭据采集:客户端内存令牌(主)+ 网页会话 Cookie(备)。

**客户端令牌(主路,2026-10-24 立)**:桌面端把 accessToken/refreshToken 包进
`$wbEncrypted` 信封落盘(密钥只在客户端进程内),但运行期明文就在主进程/守护
进程的堆上。客户端自己会持续自动刷新(用户实证:从不需要重登),所以只要它
在跑,内存里就有一枚**当前有效**的 28 天 Bearer。本模块只读扫描该令牌并交给
调度器写库,不参与刷新、不消耗 Offline refresh token —— 一旦拿客户端那枚
refresh token 去换票,Keycloak 可能轮换作废它,反而把客户端挤下线。

**网页 Cookie(备路)**:客户端长时间不启动时用。`session` cookie(HttpOnly,
7 天)可服务端直接复放;服务端没有任何续期接口(直连 Keycloak
`unauthorized_client`、网关注入对旧令牌 `access_denied`、`prompt=none`
`login_required`,三条都实测过)。Chrome 155 的 cookie 用 app-bound 加密,
外部进程解不开,但**同一个 chrome.exe** 可以:

1. `esentutl /y /vss` 快照被锁的 `Network/Cookies` 与 `Local State`;
2. 复制到临时 profile,`--headless=new` 启动同一个 chrome.exe;
3. 读 `DevToolsActivePort`,经 CDP `Storage.getCookies` 拿明文 cookie;
4. 立刻 kill 进程并删除临时目录。

两条路都只读;取不到一律返回 None 并点名原因(§0.3),绝不冒充成功。
"""

from __future__ import annotations

import asyncio
import base64
import ctypes
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile
from ctypes import wintypes
from typing import Any, Final

import websockets

from app.core.logging import get_logger

logger = get_logger(__name__)

_COOKIE_HOST_SUFFIX: Final = "workbuddy.cn"
_TARGET_PATHS: Final = ("/console/account", "/v2/billing/meter/daily-checkin")
_CREATE_NO_WINDOW: Final = 0x08000000 if sys.platform == "win32" else 0

# ---------------------------------------------------------------------------
# 客户端内存令牌采集(只读)
# ---------------------------------------------------------------------------

_JWT_ASCII: Final = re.compile(rb"eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}")
_JWT_UTF16: Final = re.compile(
    rb"e\x00y\x00J\x00(?:[A-Za-z0-9_-]\x00){10,}\.\x00"
    rb"(?:[A-Za-z0-9_-]\x00){10,}\.\x00(?:[A-Za-z0-9_-]\x00){10,}"
)
_PROCESS_QUERY_INFORMATION: Final = 0x0400
_PROCESS_VM_READ: Final = 0x0010
_MEM_COMMIT: Final = 0x1000
_PAGE_GUARD: Final = 0x100
_PAGE_NOACCESS: Final = 0x01
_READABLE_PROTECTIONS: Final = {0x02, 0x04, 0x20, 0x40, 0x80}
_MAX_USER_ADDRESS: Final = 0x7FFFFFFEFFFF
_SCAN_CHUNK: Final = 4 * 1024 * 1024


class _MemoryBasicInformation(ctypes.Structure):
    _fields_ = [
        ("BaseAddress", ctypes.c_void_p),
        ("AllocationBase", ctypes.c_void_p),
        ("AllocationProtect", wintypes.DWORD),
        ("RegionSize", ctypes.c_size_t),
        ("State", wintypes.DWORD),
        ("Protect", wintypes.DWORD),
        ("Type", wintypes.DWORD),
    ]


def decode_jwt_claims(token: str) -> dict[str, Any] | None:
    """解析 JWT payload(不验签);坏串返回 None。"""
    parts = (token or "").strip().split(".")
    if len(parts) < 2:
        return None
    try:
        pad = parts[1] + "=" * (-len(parts[1]) % 4)
        payload = json.loads(base64.urlsafe_b64decode(pad.replace("-", "+").replace("_", "/")))
    except Exception:
        return None
    return payload if isinstance(payload, dict) else None


def _workbuddy_pids() -> list[int]:
    """枚举持有凭据的 WorkBuddy 进程(跳过 renderer/gpu/utility/crashpad)。"""
    if sys.platform != "win32":
        return []
    try:
        import psutil
    except ImportError:
        logger.warning("[wb-local] psutil 未安装,无法枚举 WorkBuddy 进程")
        return []
    pids: list[int] = []
    for proc in psutil.process_iter(["pid", "name", "cmdline"]):
        try:
            info = proc.info
            if str(info.get("name") or "").lower() != "workbuddy.exe":
                continue
            argv = info.get("cmdline") or []
            if any(str(a).startswith("--type=") for a in argv):
                continue
            pids.append(int(info["pid"]))
        except (psutil.NoSuchProcess, psutil.AccessDenied, KeyError, ValueError):
            continue
    return pids


def _scan_pid_tokens(pid: int) -> list[tuple[str, dict[str, Any]]]:
    """只读扫描单个进程的可读内存,返回其中的 JWT 及声明。"""
    if sys.platform != "win32":
        return []
    k32 = ctypes.WinDLL("kernel32", use_last_error=True)
    handle = k32.OpenProcess(_PROCESS_QUERY_INFORMATION | _PROCESS_VM_READ, False, pid)
    if not handle:
        return []
    out: dict[str, dict[str, Any]] = {}
    addr = 0
    try:
        while addr < _MAX_USER_ADDRESS:
            mbi = _MemoryBasicInformation()
            if not k32.VirtualQueryEx(
                handle, ctypes.c_void_p(addr), ctypes.byref(mbi), ctypes.sizeof(mbi)
            ):
                break
            base = int(mbi.BaseAddress or 0)
            size = int(mbi.RegionSize or 0)
            if size <= 0:
                break
            prot = int(mbi.Protect or 0)
            if (
                int(mbi.State or 0) == _MEM_COMMIT
                and (prot & 0xFF) in _READABLE_PROTECTIONS
                and not (prot & (_PAGE_GUARD | _PAGE_NOACCESS))
            ):
                off = 0
                while off < size:
                    n = min(_SCAN_CHUNK, size - off)
                    buf = ctypes.create_string_buffer(n)
                    read = ctypes.c_size_t(0)
                    ok = k32.ReadProcessMemory(
                        handle, ctypes.c_void_p(base + off), buf, n, ctypes.byref(read)
                    )
                    if ok and read.value:
                        data = buf.raw[: read.value]
                        for rx in (_JWT_ASCII, _JWT_UTF16):
                            for m in rx.finditer(data):
                                tok = m.group(0).replace(b"\x00", b"").decode("ascii", "ignore")
                                claims = decode_jwt_claims(tok)
                                if claims is not None:
                                    out[tok] = claims
                    off += n
            addr = base + size
    finally:
        k32.CloseHandle(handle)
    return list(out.items())


async def extract_workbuddy_memory_tokens() -> dict[str, dict[str, Any]]:
    """按 uid 返回客户端内存中最新的 Bearer / Offline 令牌。

    返回 {uid: {"bearer": str, "bearer_exp": int, "offline": str, "offline_exp": int}}。
    同一 uid 多枚时按 exp 取最新一枚;取不到返回空 dict(不猜、不编造)。
    """
    if sys.platform != "win32":
        return {}
    pids = await asyncio.to_thread(_workbuddy_pids)
    if not pids:
        logger.info("[wb-local] 未发现运行中的 WorkBuddy 客户端进程")
        return {}
    found: dict[str, dict[str, Any]] = {}
    for pid in pids:
        try:
            tokens = await asyncio.to_thread(_scan_pid_tokens, pid)
        except OSError as e:
            logger.warning("[wb-local] 扫描 PID %s 失败: %s", pid, e)
            continue
        for tok, claims in tokens:
            uid = str(claims.get("sub") or "")
            typ = str(claims.get("typ") or "")
            if not uid or typ not in ("Bearer", "Offline"):
                continue
            exp = int(claims.get("exp") or 0)
            entry = found.setdefault(uid, {})
            key = "bearer" if typ == "Bearer" else "offline"
            if exp > int(entry.get(f"{key}_exp") or 0):
                entry[key] = tok
                entry[f"{key}_exp"] = exp
    return found


def _chrome_exe() -> str | None:
    if sys.platform != "win32":
        return None
    local = os.environ.get("LOCALAPPDATA") or ""
    candidates = [
        os.path.join(local, "Google", "Chrome", "Application", "chrome.exe"),
        os.path.join(os.environ.get("PROGRAMFILES", ""), "Google", "Chrome", "Application", "chrome.exe"),
        os.path.join(
            os.environ.get("PROGRAMFILES(X86)", ""), "Google", "Chrome", "Application", "chrome.exe"
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
                    with open(port_file, encoding="utf-8") as fh:
                        lines = fh.read().splitlines()
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
    except (TimeoutError, OSError, websockets.WebSocketException) as e:
        logger.warning("[wb-local] 抽取异常: %s: %s", type(e).__name__, e)
        return None
    finally:
        if proc is not None and proc.returncode is None:
            try:
                proc.kill()
                await asyncio.wait_for(proc.wait(), timeout=5)
            except (TimeoutError, ProcessLookupError):
                pass
        await asyncio.to_thread(shutil.rmtree, tmp, True)
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
