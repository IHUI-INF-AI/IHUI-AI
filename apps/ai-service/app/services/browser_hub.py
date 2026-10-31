# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""Browser Hub 服务(2026-07-31 新增,2026-07-31 重构为 sync_playwright)。

需求:用户要求内置浏览器是"完整 Chrome"。
当前 WorkPanel 是 iframe 架构,受 X-Frame-Options 限制无法打开第三方平台登录页。
本服务用 CDP(Chrome DevTools Protocol)远程控制真实 Chromium,通过 WebSocket
推送画面帧 + 接收鼠标键盘事件,实现"内置完整 Chrome"体验。

架构(2026-07-31 重构):
- 用 sync_playwright + ThreadPoolExecutor(max_workers=1) 运行所有 Playwright 操作
- 原因:uvicorn --reload 模式下,子进程的 event loop 是 SelectorEventLoop,
  async_playwright().start() 需要 asyncio.create_subprocess_exec 启动 node driver,
  SelectorEventLoop 不支持 → NotImplementedError。
  sync_playwright 用 subprocess.Popen,不依赖 asyncio subprocess,无此问题。
- 对外保持 async 接口不变(用 loop.run_in_executor 包装 sync 调用)
- screencast/navigation 回调用 asyncio.run_coroutine_threadsafe 跨线程传递到 main loop

CDP 关键 API:
- Page.startScreencast - 推送 JPEG/PNG 画面帧
- Page.stopScreencast - 停止推流
- Input.dispatchMouseEvent - 鼠标事件
- Input.dispatchKeyEvent - 键盘事件
- Network.getCookies - 获取 cookies(扫码登录后检测)
- Page.navigate - 导航(通过 page.goto 实现)
"""
from __future__ import annotations

import asyncio
import contextlib
import json
import os
import shutil
import sys
import tempfile
import threading
import time
import uuid
from collections.abc import Callable, Coroutine
from concurrent.futures import ThreadPoolExecutor
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Literal, TypeVar, cast

from playwright.sync_api import (
    Browser,
    BrowserContext,
    Page,
    ViewportSize,
    sync_playwright,
)

from ..core.logging import get_logger

logger = get_logger(__name__)

_T = TypeVar("_T")


# ---------------------------------------------------------------------------
# 反自动化 / 风控墙检测(2026-08-02)
# ---------------------------------------------------------------------------
# headless Playwright 常见指纹泄漏(webdriver=true / plugins 空 / languages 缺失)
# → 抖音/微信等反爬站点风控拦截,表现为"页面显示但点不动"(验证墙)。
_ANTI_DETECT_SCRIPT = """
// 隐藏 webdriver + 补齐常见指纹,规避自动化检测
Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
Object.defineProperty(navigator, 'languages', { get: () => ['zh-CN', 'zh', 'en'] });
Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3, 4, 5] });
Object.defineProperty(navigator, 'mimeTypes', { get: () => [1, 2, 3, 4, 5] });
window.chrome = window.chrome || { runtime: {} };
"""

# 反爬/风控墙文案(命中任意一个 → 判定为验证墙,需重建会话)
_ANTI_BOT_MARKERS = (
    "环境异常",
    "安全验证",
    "访问过于频繁",
    "请完成验证",
    "身份验证",
    "人机验证",
    "滑块验证",
    "verify you are human",
    "unusual traffic",
    "access denied",
)

# 近空白检测适用域名(风控墙高发站点,避免误伤正常轻量页面)
_CHALLENGE_SENSITIVE_HOSTS = (
    "weixin.qq.com",
    "douyin.com",
    "weibo.com",
    "zhihu.com",
    "bilibili.com",
    "xiaohongshu.com",
    "toutiao.com",
    "x.com",
    "youtube.com",
)


def _looks_like_challenge(page: Page) -> bool:
    """检测页面是否处于反爬/风控墙(验证墙或近乎空白的加载失败页)。

    仅在 executor 线程调用(sync Playwright)。
    """
    try:
        text = (page.inner_text("body") or "").strip()
    except Exception:
        return False
    lowered = text.lower()
    if any(m in lowered for m in _ANTI_BOT_MARKERS):
        return True
    # 敏感站点:已渲染但 body 几乎空白(有 JS 逻辑却无内容 → 大概率被墙)
    if len(text) < 40:
        try:
            host = (page.url or "").split("//")[-1].split("/")[0].lower()
        except Exception:
            return False
        if not any(h in host for h in _CHALLENGE_SENSITIVE_HOSTS):
            return False
        try:
            scripts = page.evaluate("document.scripts.length") or 0
            imgs = page.evaluate("document.images.length") or 0
        except Exception:
            return False
        return bool(scripts) and imgs <= 2
    return False


# ---------------------------------------------------------------------------
# Chromium 可执行文件查找(复用 scan_login.py 逻辑)
# ---------------------------------------------------------------------------
def _find_chromium_executable() -> str | None:
    """查找可用的 Chromium 可执行文件路径。

    优先级:
    1. PLAYWRIGHT_BROWSERS_PATH 环境变量指向的路径(D 盘)
    2. Windows 默认路径(C:\\Users\\<user>\\AppData\\Local\\ms-playwright)
    3. 返回 None(让 Playwright 自己解析)
    """
    import os
    from pathlib import Path

    env_path = os.environ.get("PLAYWRIGHT_BROWSERS_PATH")
    if env_path:
        candidate = Path(env_path) / "chromium-1228" / "chrome-win64" / "chrome.exe"
        if candidate.exists():
            return str(candidate)
        candidate = (
            Path(env_path)
            / "chromium_headless_shell-1228"
            / "chrome-headless-shell-win64"
            / "chrome-headless-shell.exe"
        )
        if candidate.exists():
            return str(candidate)

    home = Path.home()
    candidate = home / "AppData" / "Local" / "ms-playwright" / "chromium-1228" / "chrome-win64" / "chrome.exe"
    if candidate.exists():
        return str(candidate)

    return None


# ---------------------------------------------------------------------------
# 用户本机浏览器探测 + 真实 profile 复用(2026-09-16,"用你自己的浏览器"扫码登录)
# ---------------------------------------------------------------------------
@dataclass(frozen=True)
class SystemBrowser:
    """用户本机的 Chromium 系浏览器(Google Chrome / Microsoft Edge)。"""

    name: str
    exe: Path
    user_data: Path


def _browser_specs() -> list[tuple[str, tuple[str, ...], list[Path], Path | None]]:
    """返回 (显示名, 默认浏览器 ProgId 关键字, exe 候选, User Data 目录) 列表。"""
    local = os.environ.get("LOCALAPPDATA")
    roots = [Path(p) for p in (local, os.environ.get("PROGRAMFILES"), os.environ.get("PROGRAMFILES(X86)")) if p]
    chrome_exes = [r / "Google" / "Chrome" / "Application" / "chrome.exe" for r in roots]
    chrome_exes += [
        Path(r"C:\Program Files\Google\Chrome\Application\chrome.exe"),
        Path(r"C:\Program Files (x86)\Google\Chrome\Application\chrome.exe"),
    ]
    edge_exes = [r / "Microsoft" / "Edge" / "Application" / "msedge.exe" for r in roots]
    edge_exes += [
        Path(r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"),
        Path(r"C:\Program Files\Microsoft\Edge\Application\msedge.exe"),
    ]
    chrome_data = Path(local) / "Google" / "Chrome" / "User Data" if local else None
    edge_data = Path(local) / "Microsoft" / "Edge" / "User Data" if local else None
    return [
        ("Google Chrome", ("chrome",), chrome_exes, chrome_data),
        ("Microsoft Edge", ("msedge", "edge"), edge_exes, edge_data),
    ]


def _default_browser_progid() -> str:
    """读注册表取系统默认浏览器的 ProgId(非 Windows / 读取失败返回空串)。"""
    if sys.platform != "win32":
        return ""
    try:
        import winreg

        with winreg.OpenKey(
            winreg.HKEY_CURRENT_USER,
            r"Software\Microsoft\Windows\Shell\Associations\UrlAssociations\https\UserChoice",
        ) as key:
            return str(winreg.QueryValueEx(key, "ProgId")[0])
    except Exception:  # noqa: BLE001 — 注册表不可读时静默回退
        return ""


def _find_external_browser() -> SystemBrowser | None:
    """定位"用户自己的浏览器":优先系统默认浏览器(Chromium 系),否则 Chrome → Edge。

    默认浏览器是非 Chromium(如 Firefox)时,用 Chrome 兜底并照常复用其 profile。
    """
    progid = _default_browser_progid().lower()
    specs = _browser_specs()
    preferred = 1 if "edge" in progid else 0
    for idx in (preferred, 1 - preferred):
        name, _keywords, exes, user_data = specs[idx]
        exe = next((p for p in exes if p.exists()), None)
        if exe and user_data and user_data.exists():
            return SystemBrowser(name=name, exe=exe, user_data=user_data)
    return None


def _resolve_browser_profile_name(user_data: Path) -> str:
    """从 Local State 读 profile.last_used(用户真正在用的 profile),兜底 Default。"""
    try:
        state = json.loads((user_data / "Local State").read_text(encoding="utf-8"))
        last_used = str(state.get("profile", {}).get("last_used") or "")
        if last_used and (user_data / last_used).is_dir():
            return last_used
    except Exception:  # noqa: BLE001 — Local State 缺失/损坏时用 Default
        pass
    return "Default"


def _domain_suffix(login_url: str) -> str:
    """从平台登录页 URL 推导用于过滤 cookie 的域名后缀(去掉最左子域)。

    `https://passport.bilibili.com/login` → `bilibili.com`;
    `https://www.people.com.cn/` → `people.com.cn`(复合公共后缀取三段)。
    """
    from urllib.parse import urlparse

    host = (urlparse(login_url).hostname or "").lower()
    parts = [p for p in host.split(".") if p]
    if len(parts) <= 2:
        return host
    multi_suffix = {"com.cn", "net.cn", "org.cn", "gov.cn", "com.hk", "com.tw", "co.jp", "co.kr", "com.au"}
    tail2 = ".".join(parts[-2:])
    if tail2 in multi_suffix and len(parts) >= 3:
        return ".".join(parts[-3:])
    return tail2


def read_profile_cookie_names(user_data: Path, domain_suffix: str = "") -> set[str] | None:
    """只读"用户真实浏览器 profile"的 cookie 名集合(外部模式登录检测)。

    返回 None 表示**没读到**(库缺失/被占用/损坏);返回空集合表示**读到了,但该域名下没有
    cookie**(平台未登录)。两者语义不同:前者不能断言"用户没登录",UI 提示也不同。

    cookie 名在 SQLite 里是明文,不需要解密(App-Bound Encryption 只加密 value),
    因此可以在用户日常浏览器照常运行时安全读取:先把库文件复制到临时目录再读,
    避开与浏览器的锁竞争;失败重试若干次,仍失败返回空集合(调用方按"未检测到"处理)。
    """
    import sqlite3

    profile_name = _resolve_browser_profile_name(user_data)
    src = user_data / profile_name / "Network" / "Cookies"
    if not src.exists():
        return None

    tmpdir = Path(tempfile.mkdtemp(prefix="ihui-cookie-read-"))
    names: set[str] = set()
    try:
        dst = tmpdir / "Cookies"
        last_err: Exception | None = None
        for _ in range(4):
            try:
                shutil.copy2(src, dst)
                last_err = None
                break
            except Exception as e:  # noqa: BLE001 — 浏览器可能短暂占用文件
                last_err = e
                time.sleep(0.3)
        if last_err is not None:
            logger.warning(f"[browser_hub] 读取登录态失败(复制 cookie 库): {last_err}")
            return None
        con = sqlite3.connect(f"file:{dst}?mode=ro", uri=True)
        try:
            if domain_suffix:
                rows = con.execute(
                    "select distinct name from cookies where host_key like ?",
                    (f"%{domain_suffix}",),
                ).fetchall()
            else:
                rows = con.execute("select distinct name from cookies").fetchall()
            names = {str(r[0]) for r in rows if r and r[0]}
        finally:
            con.close()
    except Exception as e:  # noqa: BLE001 — 库结构变化/损坏时按"没读到"返回
        logger.warning(f"[browser_hub] 读取登录态失败: {e}")
        return None
    finally:
        shutil.rmtree(tmpdir, ignore_errors=True)
    return names


def _cleanup_stale_scan_profiles(max_age_seconds: float = 2 * 3600) -> int:
    """清理遗留的扫码临时 profile 目录(内含用户登录态副本,不应长期留存)。

    仅处理系统 temp 下前缀为 `ihui-chrome-scan-` 且闲置超过 2 小时的目录(浏览器在用的
    profile 会被持续写入,不会呈现"闲置"状态;单平台排队上限 2 分钟,2 小时足够安全),
    不触碰其它任何路径;返回清理数量。
    """
    import glob

    removed = 0
    now = time.time()
    for path in glob.glob(os.path.join(tempfile.gettempdir(), "ihui-chrome-scan-*")):
        try:
            if now - os.path.getmtime(path) < max_age_seconds:
                continue
            shutil.rmtree(path, ignore_errors=True)
            removed += 1
        except Exception:  # noqa: BLE001 — 清理失败不影响扫码主流程
            continue
    return removed


def _copy_browser_profile(user_data: Path, dest: Path) -> dict[str, Any]:
    """把用户真实浏览器 profile 的登录态最小文件集复制进临时 profile。

    复制清单(实测约 760KB,只读用户原 profile,不改动其中任何文件):
    - `Local State`:含 cookie 解密密钥,并把 `profile.last_used` 改写为 Default,
      使临时目录无论原 profile 叫什么名字都能被浏览器直接采用;
    - `<profile>/Preferences`:退出态修正为正常,避免"是否恢复页面"气泡;
    - `<profile>/Network/Cookies`:登录态本体;Chrome 自己负责解密
      (DPAPI + App-Bound Encryption 密钥随 Local State 一并复制,实测可正常解密)。

    返回 `{"profile_used", "profile_name", "copied", "error"}`,失败时降级为空 profile
    (仍能打开登录页,只是需要在该窗口内重新登录)。
    """
    info: dict[str, Any] = {"profile_used": False, "profile_name": "", "copied": [], "error": None}
    profile_name = _resolve_browser_profile_name(user_data)
    src_profile = user_data / profile_name
    (dest / "Default" / "Network").mkdir(parents=True, exist_ok=True)

    def _copy(src: Path, dst: Path) -> None:
        last_err: Exception | None = None
        for _ in range(3):
            try:
                shutil.copy2(src, dst)
                return
            except Exception as e:  # noqa: BLE001 — 日常浏览器可能短暂占用,重试后放弃
                last_err = e
                time.sleep(0.3)
        raise last_err if last_err else RuntimeError(f"复制失败: {src}")

    try:
        try:
            state = json.loads((user_data / "Local State").read_text(encoding="utf-8"))
        except Exception:  # noqa: BLE001
            state = {}
        if isinstance(state, dict):
            prof = state.setdefault("profile", {})
            if isinstance(prof, dict):
                prof["last_used"] = "Default"
        (dest / "Local State").write_text(json.dumps(state, ensure_ascii=False), encoding="utf-8")
        info["copied"].append("Local State")

        prefs_src = src_profile / "Preferences"
        if prefs_src.exists():
            try:
                prefs = json.loads(prefs_src.read_text(encoding="utf-8"))
                if isinstance(prefs, dict):
                    prof = prefs.setdefault("profile", {})
                    if isinstance(prof, dict):
                        prof["exit_type"] = "Normal"
                        prof["exited_cleanly"] = True
                (dest / "Default" / "Preferences").write_text(
                    json.dumps(prefs, ensure_ascii=False), encoding="utf-8"
                )
                info["copied"].append("Preferences")
            except Exception as e:  # noqa: BLE001 — Preferences 非必需
                logger.debug(f"[browser_hub] 复制 Preferences 跳过: {e}")

        for rel in ("Network/Cookies", "Network/Cookies-journal"):
            src = src_profile / rel
            if src.exists():
                _copy(src, dest / "Default" / rel)
                info["copied"].append(rel)
        if "Network/Cookies" not in info["copied"]:
            raise RuntimeError(f"未找到登录态数据库: {src_profile / 'Network' / 'Cookies'}")

        info["profile_used"] = True
        info["profile_name"] = profile_name
    except Exception as e:  # noqa: BLE001 — 任何失败都降级为"空 profile 打开",不阻断扫码
        info["error"] = str(e)
        logger.warning(f"[browser_hub] 复用用户浏览器登录态失败,退回空 profile: {e}")
    return info


# ---------------------------------------------------------------------------
# 键名 → Windows Virtual Key Code 映射(常用键)
# ---------------------------------------------------------------------------
def _key_to_vk_code(key: str) -> int:
    """键名 → Windows Virtual Key Code。"""
    vk_map = {
        "Enter": 13, "Return": 13,
        "Tab": 9,
        "Backspace": 8,
        "Delete": 46,
        "Escape": 27, "Esc": 27,
        "ArrowUp": 38, "Up": 38,
        "ArrowDown": 40, "Down": 40,
        "ArrowLeft": 37, "Left": 37,
        "ArrowRight": 39, "Right": 39,
        "Home": 36,
        "End": 35,
        "PageUp": 33,
        "PageDown": 34,
        "Space": 32, " ": 32,
        "Control": 17, "Ctrl": 17,
        "Shift": 16,
        "Alt": 18,
        "Meta": 91, "Win": 91, "OS": 91,
        "CapsLock": 20,
        "F1": 112, "F2": 113, "F3": 114, "F4": 115,
        "F5": 116, "F6": 117, "F7": 118, "F8": 119,
        "F9": 120, "F10": 121, "F11": 122, "F12": 123,
    }
    if key in vk_map:
        return vk_map[key]
    if len(key) == 1:
        return ord(key.upper())
    return 0


# ---------------------------------------------------------------------------
# BrowserSession:单个浏览器会话(sync_playwright 对象,async 接口)
# ---------------------------------------------------------------------------
class BrowserSession:
    """单个浏览器会话:一个 BrowserContext + Page + CDP session。

    sync_playwright 对象必须在创建它的线程里使用,因此所有操作通过
    ThreadPoolExecutor(max_workers=1) 串行执行。
    对外暴露 async 接口(用 loop.run_in_executor 包装)。
    """

    def __init__(
        self,
        session_id: str,
        context: BrowserContext,
        page: Page,
        executor: ThreadPoolExecutor,
        main_loop: asyncio.AbstractEventLoop,
        user_agent: str | None = None,
        owner_user_id: str | None = None,
    ) -> None:
        self.session_id = session_id
        self._context = context
        self._page = page
        self._executor = executor
        self._main_loop = main_loop
        self._user_agent = user_agent or ""
        # 属主:令牌主体 id。**None = 系统级会话**(由内部链路创建、无调用方身份),
        # 对已登录调用方一律不可见 —— 与 session_store.owner_scoped_allows 同一条口径,
        # 宁可让"没盖章的会话"少一个人能看见,也不给"谁都能碰"留口子。
        self.owner_user_id: str | None = owner_user_id or None
        self._cdp: Any | None = None  # sync CDPSession
        self._screencast_running = False
        self._screenshot_task: asyncio.Task[None] | None = None  # 截图轮询后台 task
        self._on_frame: Callable[[str, dict[str, Any]], Coroutine[Any, Any, None]] | None = None
        self._on_navigation: Callable[[str, str | None], Coroutine[Any, Any, None]] | None = None
        self._lock = threading.Lock()

    # ---- 内部辅助 ----
    async def _run_sync(self, func: Callable[[], _T]) -> _T:
        """在专用 executor 线程运行 sync 函数,返回结果。"""
        loop = asyncio.get_running_loop()
        return await loop.run_in_executor(self._executor, func)

    def _schedule_coro(self, coro: Coroutine[Any, Any, None]) -> None:
        """从 executor 线程向 main loop 提交 coroutine(navigation 回调用)。"""
        asyncio.run_coroutine_threadsafe(coro, self._main_loop)

    # ---- 导航 ----
    async def navigate(
        self,
        url: str,
        wait_until: Literal["commit", "domcontentloaded", "load", "networkidle"] = "domcontentloaded",
        timeout: int = 30000,
    ) -> dict[str, Any]:
        """导航到指定 URL。"""
        def _sync() -> dict[str, Any]:
            try:
                response = self._page.goto(url, wait_until=wait_until, timeout=timeout)
                return {
                    "url": self._page.url,
                    "title": self._page.title(),
                    "status": response.status if response else None,
                }
            except Exception as e:
                logger.warning(f"[browser_hub] session {self.session_id} 导航失败: {url} - {e}")
                return {"url": self._page.url, "title": "", "status": None, "error": str(e)[:200]}
        return await self._run_sync(_sync)

    async def set_viewport_size(self, width: int, height: int) -> dict[str, Any]:
        """2026-08-17:动态调整视口大小(前端容器 1:1,消除缩放/letterbox)。"""
        width = max(320, min(int(width), 1920))
        height = max(240, min(int(height), 1200))

        def _sync() -> dict[str, Any]:
            try:
                self._page.set_viewport_size({"width": width, "height": height})
                return {"width": width, "height": height}
            except Exception as e:
                logger.warning(f"[browser_hub] set_viewport 失败: {e}")
                return {"error": str(e)[:200]}

        return await self._run_sync(_sync)

    async def get_current_url(self) -> str:
        def _sync() -> str:
            return self._page.url
        return await self._run_sync(_sync)

    async def get_title(self) -> str:
        def _sync() -> str:
            return self._page.title()
        return await self._run_sync(_sync)

    async def go_back(self) -> bool:
        def _sync() -> bool:
            return self._page.go_back() is not None
        return await self._run_sync(_sync)

    async def go_forward(self) -> bool:
        def _sync() -> bool:
            return self._page.go_forward() is not None
        return await self._run_sync(_sync)

    async def reload(self) -> None:
        def _sync() -> None:
            try:
                self._page.reload(wait_until="domcontentloaded", timeout=30000)
            except Exception as e:
                logger.warning(f"[browser_hub] session {self.session_id} reload 异常: {e}")
        await self._run_sync(_sync)

    async def is_challenged(self) -> bool:
        """页面是否处于反爬/风控墙(在 executor 线程检测)。"""
        return await self._run_sync(lambda: _looks_like_challenge(self._page))

    async def reload_with_recovery(self) -> bool:
        """刷新页面;命中反爬/风控墙返回 True(由 hub 重建会话)。"""
        await self.reload()
        return await self.is_challenged()

    @property
    def viewport(self) -> dict[str, int]:
        """会话视口(用于风控墙重建时保持同尺寸)。"""
        # Playwright BrowserContext 无 viewport_size 属性,改从 Page.viewport_size 取
        size = self._page.viewport_size
        if size:
            return {"width": int(size["width"]), "height": int(size["height"])}
        return {"width": 1280, "height": 720}

    # ---- Cookies / 截图 / JS ----
    async def get_cookies(self, urls: list[str] | None = None) -> list[dict[str, Any]]:
        def _sync() -> list[dict[str, Any]]:
            return cast(list[dict[str, Any]], self._context.cookies(urls))
        return await self._run_sync(_sync)

    async def screenshot(self, full_page: bool = False) -> bytes:
        def _sync() -> bytes:
            return self._page.screenshot(type="png", full_page=full_page)
        return await self._run_sync(_sync)

    async def execute_js(self, script: str) -> Any:
        def _sync() -> Any:
            return self._page.evaluate(script)
        return await self._run_sync(_sync)

    # ---- 导航事件监听 ----
    async def set_navigation_handler(
        self, on_nav: Callable[[str, str | None], Coroutine[Any, Any, None]]
    ) -> None:
        """注册导航事件回调(页面加载完成时触发)。

        on_nav: async 函数(url, title) -> None,在 main loop 执行。
        """
        self._on_navigation = on_nav

        def _register() -> None:
            def _on_frame_navigated(frame: Any) -> None:
                try:
                    if frame == self._page.main_frame:
                        url = self._page.url
                        handler = self._on_navigation
                        if handler:
                            # title 在 sync 线程取可能为空,延迟到 main loop 取
                            self._schedule_coro(handler(url, None))
                except Exception as e:
                    logger.debug(f"[browser_hub] navigation 回调异常: {e}")
            self._page.on("framenavigated", _on_frame_navigated)
        await self._run_sync(_register)

    # ---- 画面流(截图轮询,2026-07-31 改)----
    # 原方案用 CDP Page.startScreencast,但 sync_playwright 的 CDP 事件回调在
    # playwright 后台线程触发,在回调里调 cdp.send("Page.screencastFrameAck") 会阻塞
    # (等 transport 空闲,但 transport 正在处理回调)→ 死锁,第一帧延迟 25s+ 且后续帧丢失。
    # 改用定时 page.screenshot 轮询:在 main loop 起后台 task,每次通过 run_in_executor
    # 在 executor 线程截图(不依赖 CDP 事件回调)。对扫码登录场景 ~3fps 足够。
    async def start_screencast(
        self, on_frame: Callable[[str, dict[str, Any]], Coroutine[Any, Any, None]]
    ) -> None:
        """开始推流截图帧(定时轮询 page.screenshot)。

        on_frame: async 函数(data_b64: str, metadata: dict) -> None,在 main loop 执行。
        - data_b64: base64 编码的 JPEG 图片
        - metadata: {"deviceWidth": ..., "deviceHeight": ...}(从 viewport 推导)
        """
        self._on_frame = on_frame
        if self._screencast_running:
            return
        self._screencast_running = True
        self._screenshot_task = asyncio.create_task(self._screenshot_loop())
        logger.info(f"[browser_hub] session {self.session_id} 截图轮询已启动")

    async def _screenshot_loop(self) -> None:
        """后台截图循环(在 main loop 运行,截图操作在 executor 线程执行)。"""
        import base64 as _base64
        while self._screencast_running:
            try:
                def _sync_shot() -> bytes:
                    return self._page.screenshot(type="jpeg", quality=70)
                jpeg_bytes = await self._run_sync(_sync_shot)
                data_b64 = _base64.b64encode(jpeg_bytes).decode("ascii")
                vp = self._page.viewport_size  # {"width": ..., "height": ...}
                metadata = {
                    "deviceWidth": vp.get("width", 1280) if vp else 1280,
                    "deviceHeight": vp.get("height", 720) if vp else 720,
                }
                handler = self._on_frame
                if handler:
                    await handler(data_b64, metadata)
            except asyncio.CancelledError:
                raise
            except Exception as e:
                logger.warning(f"[browser_hub] 截图循环异常: {e}")
            await asyncio.sleep(0.3)  # ~3fps

    async def stop_screencast(self) -> None:
        self._screencast_running = False
        if self._screenshot_task:
            self._screenshot_task.cancel()
            with contextlib.suppress(asyncio.CancelledError):
                await self._screenshot_task
            self._screenshot_task = None
        self._on_frame = None

    async def remove_frame_handler(self, on_frame: Callable[..., Any]) -> None:
        """移除指定的 frame handler(WebSocket 断开时调用)。"""
        await self.stop_screencast()

    # ---- CDP 输入事件(鼠标/键盘/滚轮)----
    async def dispatch_mouse(
        self,
        x: float,
        y: float,
        button: str = "left",
        event_type: str = "mousePressed",
        click_count: int = 1,
        modifiers: int = 0,
    ) -> None:
        """鼠标事件(CDP Input.dispatchMouseEvent)。"""
        def _sync() -> None:
            cdp = self._ensure_cdp()
            cdp.send("Input.dispatchMouseEvent", {
                "type": event_type,
                "x": x,
                "y": y,
                "button": button,
                "clickCount": click_count,
                "modifiers": modifiers,
            })
        await self._run_sync(_sync)

    async def dispatch_mouse_wheel(self, x: float, y: float, delta_x: float = 0, delta_y: float = 0) -> None:
        """滚轮事件(CDP Input.dispatchMouseEvent with mouseWheel)。"""
        def _sync() -> None:
            cdp = self._ensure_cdp()
            cdp.send("Input.dispatchMouseEvent", {
                "type": "mouseWheel",
                "x": x,
                "y": y,
                "deltaX": delta_x,
                "deltaY": delta_y,
            })
        await self._run_sync(_sync)

    async def dispatch_key(
        self,
        key: str,
        event_type: str = "keyDown",
        modifiers: int = 0,
        text: str | None = None,
    ) -> None:
        """键盘事件(CDP Input.dispatchKeyEvent)。"""
        def _sync() -> None:
            cdp = self._ensure_cdp()
            params: dict[str, Any] = {
                "type": event_type,
                "key": key,
                "modifiers": modifiers,
                "windowsVirtualKeyCode": _key_to_vk_code(key),
            }
            if text:
                params["text"] = text
            cdp.send("Input.dispatchKeyEvent", params)
        await self._run_sync(_sync)

    async def type_text(self, text: str) -> None:
        """输入文本(逐字符发送 char 事件)。"""
        def _sync() -> None:
            cdp = self._ensure_cdp()
            for char in text:
                cdp.send("Input.dispatchKeyEvent", {
                    "type": "char",
                    "text": char,
                })
        await self._run_sync(_sync)

    def _ensure_cdp(self) -> Any:
        """获取或创建 CDP session(必须在 executor 线程调用)。"""
        if self._cdp is None:
            self._cdp = self._context.new_cdp_session(self._page)
        return self._cdp

    # ---- 关闭 ----
    async def close(self) -> None:
        """关闭会话。"""
        await self.stop_screencast()
        def _sync_close() -> None:
            if self._cdp:
                with contextlib.suppress(Exception):
                    self._cdp.detach()
            with contextlib.suppress(Exception):
                self._context.close()
        await self._run_sync(_sync_close)


def _same_owner(session_owner: str | None, caller: str | None) -> bool:
    """会话属主与调用方主体是否同一人。

    判序刻意为三态,不是 `==`:
      - `caller is None` → 系统级调用(内部链路,无令牌主体),不设过滤 —— 与
        `session_store.owner_scoped_allows` 里"None = 系统级"同一条口径;
      - `caller` 有值而 `session_owner is None` → **不放行**(没盖章的会话对已登录
        用户不可见,否则任何一次内部创建都等于向全站开放);
      - 两者都有值 → 逐字等值才算。
    """
    if caller is None:
        return True
    return session_owner is not None and session_owner == caller


# ---------------------------------------------------------------------------
# Tab 级作用域(2026-10-31,gap#3,对照 Trae T2§3.2 的
# Scope{sessionId, browserOwner, strictBrowserOwner, tabId})
# ---------------------------------------------------------------------------
# 修的是哪一格:`_same_owner` 只到 **user 级**,而 `create_session` 那条 10s URL 幂等窗
# 也只管"同 URL 别串属主"。动作面(navigate / 鼠标键盘 / type / screenshot / execute_js)
# 从来没有"这一枚 tab 是不是登记在你名下、是不是你点名的那一枚"的判定 —— 拿到一个
# session_id 就等于拿到该用户作用域里所有满足归属的 tab。本节把动作入口收成"点名一枚
# 已登记 tab 才放行",缺位与错配一律拒,**绝不回退到 user 级**(回退=这次改动本身被绕过)。
#
# 刻意没接的一格(如实登记,不当已完成):请求侧一次性消费(jti 防重放)。
#   本仓唯一的 jti 消费判据 `consume(jti) -> 'consumed' | 'replayed'` 住在 apps/api 的
#   TS 侧(`src/plugins/internal-service-ticket.ts` 的 `ReplayStore`,Redis SET NX +
#   sha256 指纹键),而 ai-service 这边只有**发票**出口(`app/core/internal_ticket.py`),
#   没有验票口;更关键的是这条浏览器动作腿走的是**用户 access JWT**(routers/browser_hub
#   的 `Depends(get_current_user_id)` 与 WS 的 `verify_access_token`),请求形状里根本没有
#   jti 可消费。按 AGENTS §0.6(同类判据全仓只许一份)不在 Python 侧另抄第二份防重放
#   判据、不新造第三把密钥 ⇒ 跨语言复用受阻,交主席裁决(出路二选一:网关侧在动作腿前置
#   一次性票并由 api 侧 consume,或本腿显式改走内部票契约)。


TAB_SCOPE_MISSING = "missing_tab_scope"
TAB_SCOPE_UNKNOWN = "unknown_tab"
TAB_SCOPE_OWNER_MISMATCH = "tab_owner_mismatch"
TAB_SCOPE_SESSION_MISMATCH = "tab_session_mismatch"
TAB_SCOPE_UNVERIFIED_CALLER = "unverified_caller"

#: 拒因封闭集:审计与测试按名点名,新增一档必须同笔补对应用例。
TAB_SCOPE_DENY_CODES: frozenset[str] = frozenset(
    {
        TAB_SCOPE_MISSING,
        TAB_SCOPE_UNKNOWN,
        TAB_SCOPE_OWNER_MISMATCH,
        TAB_SCOPE_SESSION_MISMATCH,
        TAB_SCOPE_UNVERIFIED_CALLER,
    }
)


def _scope_text(raw: str | None) -> str | None:
    """作用域取值归一:空串/纯空白 = **该维缺位**(None),不得当成"匹配任何"。"""
    text = str(raw or "").strip()
    return text or None


class BrowserTabScopeError(RuntimeError):
    """tab 级作用域判定不通过。

    具名拒因(``code``)是这一格的交付物本身:调用方必须能区分"你没点名 tab"与
    "这枚 tab 不是你的",而承载层把它翻成 HTTP 时,跨属主/未登记必须与"不存在"同形
    (见 routers/browser_hub.py 的映射),不得成为探测他人 tab 的预言机。
    """

    def __init__(self, code: str, tab_id: str | None = None) -> None:
        if code not in TAB_SCOPE_DENY_CODES:  # 拒因封闭集外的代码一律判死,不许自创
            raise ValueError(f"未知的 tab 作用域拒因 {code!r};封闭集见 TAB_SCOPE_DENY_CODES")
        super().__init__(code)
        self.code = code
        self.tab_id = tab_id


@dataclass(frozen=True)
class BrowserTabScope:
    """浏览器动作的作用域(四个轴与 Trae 的 Scope 一一对应)。

    来源纪律(AGENTS §5「认证不等于授权」):三个字段的值**只能来自承载层**——
      - ``tab_id``:承载层给出的这一枚 tab 的指针(HTTP 路径参数 / 承载层注入的会话态键),
        不接受"我最近打开的那个"这类隐式解析,也不接受"用户的所有 tab"这种集合;
      - ``owner_user_id``:承载层已验证的令牌主体(JWT → request.state.user_id,或
        call_tool 覆盖写的 ``__user_id``),不得取自模型可填的入参形状;
      - ``chat_session_id``:承载层注入的会话态(call_tool 的 ``__session_id`` 同型)。
        浏览器 HTTP 主链路今天没有这一路承载层输入 ⇒ 恒 None,该维**不设限**;这不等於
        放宽 tab/owner 两维,也不是"回退到 user 级"(user 级只是 owner 这一维的名字)。
      - ``strict_browser_owner``:动作面必须为 True —— 它关掉的是 `_same_owner` 里
        `caller is None ⇒ True` 那格系统级放行,即"没有主体的调用不得动别人的 tab"。
        False 只留给内部系统级链路,且它仍要求 tab 已登记。
    """

    tab_id: str | None = None
    owner_user_id: str | None = None
    chat_session_id: str | None = None
    strict_browser_owner: bool = True

    @property
    def normalized_tab_id(self) -> str | None:
        return _scope_text(self.tab_id)

    @property
    def normalized_owner(self) -> str | None:
        return _scope_text(self.owner_user_id)

    @property
    def normalized_chat_session(self) -> str | None:
        return _scope_text(self.chat_session_id)


@dataclass(frozen=True)
class BrowserTabRegistration:
    """hub 侧的 tab 登记条目:创建即盖章,此后动作判定只认这份登记。

    `registered_at` 用 `time.monotonic()`(与 `_recent_creations` 同一时基),只用于诊断
    与后续清理策略;作用域判定不读它 —— 把"账龄"混进鉴权判据会变成第四把尺子。
    """

    tab_id: str
    owner_user_id: str | None
    chat_session_id: str | None
    registered_at: float


def _registration_session_matches(
    registration: BrowserTabRegistration | None, chat_session_id: str | None
) -> bool:
    """幂等复用同样不得跨会话态串 tab:动作方声明了会话态,就必须对上登记值。

    登记缺失(账上没有)而调用方声明了会话态 ⇒ False(拒),而不是"没记就当通过"。
    """
    declared = _scope_text(chat_session_id)
    if declared is None:
        return True
    return registration is not None and registration.chat_session_id == declared


# ---------------------------------------------------------------------------
# BrowserHub:单例,管理持续运行的 Chromium 实例
# ---------------------------------------------------------------------------
class BrowserHub:
    """浏览器中枢:管理持续运行的 Chromium 实例 + 多 session。

    用 sync_playwright + ThreadPoolExecutor(max_workers=1):
    - 所有 Playwright 操作在同一个线程执行(sync_playwright 对象非线程安全)
    - 对外 async 接口不变(用 loop.run_in_executor 包装)
    """

    # 会话创建幂等窗口:同一 URL 在此窗口内的重复创建请求返回已有会话
    _DEDUP_WINDOW_SECONDS: float = 10.0

    def __init__(self) -> None:
        self._playwright: Any | None = None
        self._browser: Browser | None = None
        self._sessions: dict[str, BrowserSession] = {}
        self._executor = ThreadPoolExecutor(max_workers=1, thread_name_prefix="playwright")
        self._lock = asyncio.Lock()
        self._started = False
        self._main_loop: asyncio.AbstractEventLoop | None = None
        # URL → (session_id, timestamp) 幂等去重表,防止前端重复请求创建多个会话
        self._recent_creations: dict[str, tuple[str, float]] = {}
        # 外部 Chrome 扫码会话:session_id → (subprocess, connected Browser, 临时 profile 目录)
        self._external_procs: dict[str, tuple[Any, Any, str]] = {}
        # tab 级作用域登记表:tab_id → 创建时盖的章(属主 + 会话态)。
        # 动作面 require_tab 只认这张表;`_sessions` 是"会话存续",两者缺一不可。
        self._tab_registry: dict[str, BrowserTabRegistration] = {}

    async def start(self) -> None:
        """启动 Chromium 实例(应用启动时调用)。"""
        if self._started:
            return
        async with self._lock:
            if self._started:
                return
            self._main_loop = asyncio.get_running_loop()
            logger.info("[browser_hub] 启动 Chromium 实例(sync_playwright + 专用线程)...")

            def _sync_start() -> None:
                self._playwright = sync_playwright().start()
                chromium_path = _find_chromium_executable()
                logger.info(f"[browser_hub] Chromium 路径: {chromium_path or '(Playwright 默认)'}")
                self._browser = self._playwright.chromium.launch(
                    executable_path=chromium_path,
                    headless=True,
                    args=[
                        "--no-sandbox",
                        "--disable-setuid-sandbox",
                        "--disable-dev-shm-usage",
                        "--disable-gpu",
                        "--disable-blink-features=AutomationControlled",
                    ],
                )
            await asyncio.get_running_loop().run_in_executor(self._executor, _sync_start)
            self._started = True
            logger.info("[browser_hub] Chromium 实例已启动")

    async def stop(self) -> None:
        """关闭 Chromium 实例(应用关闭时调用)。"""
        async with self._lock:
            for session_id in list(self._sessions.keys()):
                await self._close_session_internal(session_id)
            if self._browser:
                browser = self._browser
                playwright_inst = self._playwright
                def _sync_stop_browser() -> None:
                    try:
                        browser.close()
                    except Exception as e:
                        logger.warning(f"[browser_hub] 关闭浏览器异常: {e}")
                    if playwright_inst:
                        try:
                            playwright_inst.stop()
                        except Exception as e:
                            logger.warning(f"[browser_hub] 关闭 playwright 异常: {e}")
                if self._main_loop:
                    await self._main_loop.run_in_executor(self._executor, _sync_stop_browser)
            self._browser = None
            self._playwright = None
            self._started = False
            logger.info("[browser_hub] Chromium 实例已关闭")

    async def create_session(
        self,
        url: str | None = None,
        session_id: str | None = None,
        viewport: dict[str, int] | None = None,
        user_agent: str | None = None,
        owner_user_id: str | None = None,
        chat_session_id: str | None = None,
    ) -> BrowserSession:
        """创建新的浏览器会话(带 URL 幂等去重)。

        2026-07-31 完美化:同一 URL 在 _DEDUP_WINDOW_SECONDS 内的重复创建请求
        直接返回已有会话,防止前端 React StrictMode/双击/重试导致多会话泄漏。

        2026-10-31(gap#3):新增 `chat_session_id` —— 承载层注入的会话态(MCP 侧
        `__session_id` 同型;HTTP 主链路没有这一路输入,传 None)。创建即登记到
        `_tab_registry`,此后动作面只认登记;幂等复用档也必须同会话态才对上,
        否则 A 会话开的 tab 会被 B 会话的重复创建请求直接接走。
        """
        if not self._started or not self._browser:
            await self.start()
        assert self._browser is not None

        # ---- 幂等去重:同一 URL 短时间内的重复请求返回已有会话 ----
        if url:
            import time as _time
            now = _time.monotonic()
            # 清理过期条目
            stale = [
                u for u, (sid, ts) in self._recent_creations.items()
                if now - ts > self._DEDUP_WINDOW_SECONDS or sid not in self._sessions
            ]
            for u in stale:
                self._recent_creations.pop(u, None)
            # 检查是否有同 URL 的近期会话
            existing = self._recent_creations.get(url)
            if existing:
                sid, ts = existing
                if now - ts < self._DEDUP_WINDOW_SECONDS and sid in self._sessions:
                    candidate = self._sessions[sid]
                    # 幂等窗口**不得跨属主复用**:这张表的键只有 URL,而两个人同时打开
                    # 同一个平台登录页是常态(扫码登录更是如此)。旧写法会让第二个人拿到
                    # 第一个人的 context —— 于是他的 cookies、他的登录态、他的画面全在
                    # 别人屏幕上。判据用"同属主才复用",跨属主一律往下新建。
                    if _same_owner(candidate.owner_user_id, owner_user_id) and (
                        _registration_session_matches(self._tab_registry.get(sid), chat_session_id)
                    ):
                        logger.info(f"[browser_hub] 幂等命中:复用 session {sid} (url={url})")
                        return candidate
                    logger.info(f"[browser_hub] 幂等窗口内但属主不同:为 {session_id or '新会话'} 另建会话")

        self._main_loop = asyncio.get_running_loop()
        session_id = session_id or str(uuid.uuid4())
        vp = viewport or {"width": 1280, "height": 720}
        ua = user_agent or (
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
            "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
        )

        session = await self._build_session(
            url=url,
            session_id=session_id,
            viewport=vp,
            user_agent=ua,
            owner_user_id=owner_user_id,
        )

        self._sessions[session_id] = session
        self._register_tab(session_id, owner_user_id, chat_session_id)
        # 注册到幂等去重表(同 URL 在 _DEDUP_WINDOW_SECONDS 内复用此会话)
        if url:
            import time as _time
            self._recent_creations[url] = (session_id, _time.monotonic())
        logger.info(f"[browser_hub] 创建 session {session_id} (url={url})")
        return session

    async def _build_session(
        self,
        url: str | None,
        session_id: str,
        viewport: dict[str, int],
        user_agent: str,
        owner_user_id: str | None = None,
    ) -> BrowserSession:
        """创建独立 BrowserContext 会话;初始导航命中反爬/风控墙时自动重建。

        2026-08-02 fix:抖音/微信等对全新浏览器指纹的首访可能下发验证墙
        (表现为"页面显示但点不动"),重建 context(新指纹)通常可绕过,最多重试 2 次。
        """
        browser = self._browser
        assert browser is not None

        def _sync_create() -> tuple[BrowserContext, Page]:
            context = browser.new_context(
                viewport=cast(ViewportSize, viewport),
                locale="zh-CN",
                timezone_id="Asia/Shanghai",
                user_agent=user_agent,
            )
            # 2026-08-02 fix:隐藏 webdriver + 补齐指纹(抖音/微信等对自动化检测严格,
            # headless Playwright 默认 webdriver=true 会被风控拦截)
            context.add_init_script(_ANTI_DETECT_SCRIPT)
            page = context.new_page()
            return context, page

        session: BrowserSession | None = None
        for attempt in range(1, 3):
            context, page = await asyncio.get_running_loop().run_in_executor(
                self._executor, _sync_create
            )
            assert self._main_loop is not None  # _ensure_browser 已赋值,类型守卫
            session = BrowserSession(
                session_id,
                context,
                page,
                self._executor,
                self._main_loop,
                user_agent,
                owner_user_id=owner_user_id,
            )
            if url:
                await session.navigate(url)
            if url and await session.is_challenged():
                logger.warning(
                    f"[browser_hub] session {session_id} 命中风控墙(attempt {attempt}/2, url={url}),重建 context..."
                )
                await session.close()
                if attempt == 1:
                    # 首次命中:还有一次重建机会,丢弃当前 context
                    session = None
                    continue
                # 第二次命中(2026-08-12 修):保留最后现场(即使已 close),
                # 供 reload 端点触发 recreate_session 重建;此前 session 被置 None
                # 导致循环后 assert session is not None 抛 AssertionError 崩溃
                break
            return session
        # 连续命中风控墙 → 保留最后一个现场,用户可手动刷新(reload 端点会自动重建)
        assert session is not None
        return session

    async def recreate_session(
        self, session_id: str, owner_user_id: str | None = None
    ) -> BrowserSession | None:
        """风控墙重建:以旧会话 URL/视口创建全新 context,关闭旧会话。

        返回新会话;旧会话不存在返回 None。
        """
        async with self._lock:
            old = self._sessions.get(session_id)
            if not old:
                return None
            if not _same_owner(old.owner_user_id, owner_user_id):
                # 与 get_session 同形:别人的会话在这里同样"不存在"
                return None
            # 重建前先把旧登记抄下来:新 tab 必须**沿用同一作用域**(属主 + 会话态),
            # 否则一次风控墙重建就把 A 会话的 tab 变成未登记/换了归属的 tab。
            old_registration = self._tab_registry.get(session_id)
            url = await old.get_current_url()
            vp = old.viewport
            await self._close_session_internal(session_id)
            new_id = str(uuid.uuid4())
            session = await self._build_session(
                url=url or None,
                session_id=new_id,
                viewport=vp,
                user_agent=old._user_agent,
                owner_user_id=old.owner_user_id,
            )
            self._sessions[new_id] = session
            self._register_tab(
                new_id,
                old.owner_user_id,
                old_registration.chat_session_id if old_registration else None,
            )
            if url:
                import time as _time
                self._recent_creations[url] = (new_id, _time.monotonic())
            logger.info(f"[browser_hub] 风控墙重建 session {session_id} -> {new_id} (url={url})")
            return session

    def get_session(
        self, session_id: str, owner_user_id: str | None = None
    ) -> BrowserSession | None:
        """取会话;给了调用方身份时**按属主过滤**。

        返回 None 而不是抛 403:与 session_store / 引擎那几处同一条口径 —— 别人的会话
        与"不存在"必须同码同形,否则这个端点就成了"探测别人的 session_id 是否存在"的
        预言机(session_id 是 uuid4,但内部链路会把它们回显到日志与前端状态里)。

        注意:这是**读取/内部链路**的出口(扫码登录轮询、发布风控工厂等)。浏览器动作
        一律走 `require_tab` —— 那里才判"点名的这一枚 tab 是否已登记、登记的作用域是否
        就是调用方的作用域"。用 get_session 做动作面 = 只到 user 级(gap#3 的病灶)。
        """
        session = self._sessions.get(session_id)
        if session is None:
            return None
        if owner_user_id is not None and not _same_owner(session.owner_user_id, owner_user_id):
            return None
        return session

    # ---- tab 级作用域(gap#3)----
    def _register_tab(
        self, tab_id: str, owner_user_id: str | None, chat_session_id: str | None
    ) -> BrowserTabRegistration:
        """创建即盖章:把承载层给出的作用域记进登记表(同 tab 重复登记 = 覆盖)。"""
        registration = BrowserTabRegistration(
            tab_id=tab_id,
            owner_user_id=_scope_text(owner_user_id),
            chat_session_id=_scope_text(chat_session_id),
            registered_at=time.monotonic(),
        )
        self._tab_registry[tab_id] = registration
        return registration

    def tab_registration(self, tab_id: str) -> BrowserTabRegistration | None:
        """登记表只读出口(诊断/测试用;作用域判定请走 `require_tab`)。"""
        return self._tab_registry.get(tab_id)

    def require_tab(self, scope: BrowserTabScope) -> BrowserSession:
        """动作面唯一的取 tab 出口:命中**已登记**的这一枚 tab 才放行。

        判序(每一步不过 ⇒ `BrowserTabScopeError` 具名拒因,绝不回退到 user 级):
          1. `tab_id` 缺位 ⇒ `missing_tab_scope` —— "帮我点一下"这类没有点名 tab 的动作
             不接受,因为隐式解析"该用户的当前 tab"就是把边界重新降回 user 级;
          2. 登记表里没有 ⇒ `unknown_tab` —— 只在 `_sessions` 里、账上没登记的会话(旁路
             写入/已关闭的残留)对动作面一律不存在;
          3. 严格属主档下:调用方主体缺位 ⇒ `unverified_caller`(系统级放行不得从动作面
             进来),登记属主缺位或与之不等 ⇒ `tab_owner_mismatch`;非严格档回落到
             `_same_owner` 的既有三态(仍要求已登记);
          4. 调用方声明了会话态 ⇒ 必须与登记值逐字相等,否则 `tab_session_mismatch`
             (登记缺失而调用方声明了会话态同样是不匹配,不当成"通过");
          5. 登记与存续同轮核对:账上有、`_sessions` 里没有 ⇒ 摘账并按 `unknown_tab` 拒。
        """
        tab_id = scope.normalized_tab_id
        if tab_id is None:
            raise BrowserTabScopeError(TAB_SCOPE_MISSING)
        registration = self._tab_registry.get(tab_id)
        if registration is None:
            raise BrowserTabScopeError(TAB_SCOPE_UNKNOWN, tab_id)
        caller = scope.normalized_owner
        if scope.strict_browser_owner:
            if caller is None:
                raise BrowserTabScopeError(TAB_SCOPE_UNVERIFIED_CALLER, tab_id)
            if registration.owner_user_id is None or registration.owner_user_id != caller:
                # 跨属主与"没盖章"在这里同形:都是"这一枚 tab 不是你的"
                raise BrowserTabScopeError(TAB_SCOPE_OWNER_MISMATCH, tab_id)
        elif not _same_owner(registration.owner_user_id, caller):
            raise BrowserTabScopeError(TAB_SCOPE_OWNER_MISMATCH, tab_id)
        declared_session = scope.normalized_chat_session
        if declared_session is not None and registration.chat_session_id != declared_session:
            raise BrowserTabScopeError(TAB_SCOPE_SESSION_MISMATCH, tab_id)
        session = self._sessions.get(tab_id)
        if session is None:
            self._tab_registry.pop(tab_id, None)
            raise BrowserTabScopeError(TAB_SCOPE_UNKNOWN, tab_id)
        return session

    async def close_tab(self, scope: BrowserTabScope) -> bool:
        """按作用域关闭这一枚 tab:先过 `require_tab`,再走既有内部关闭出口。"""
        session = self.require_tab(scope)
        return await self._close_session_internal(session.session_id)

    # ---- 外部 Chrome 扫码登录(2026-09-02 新增,2026-09-16 改为复用用户真实 profile)----
    async def launch_external_chrome(
        self,
        url: str,
        owner_user_id: str | None = None,
        chat_session_id: str | None = None,
    ) -> tuple[BrowserSession, dict[str, Any]]:
        """用"用户自己的浏览器"打开 URL,并通过 CDP 附着,注册为 hub session。

        2026-09-16 重构(用户反馈"打开的不是我自己电脑上的浏览器"):
        旧实现用系统 Chrome + 全新空 profile,窗口里既没有用户的书签/语言设置,也没有任何
        已登录状态 → 用户看到"一个陌生的浏览器",且 19 个平台必须逐个重新扫码。
        新实现:定位用户本机默认 Chromium 浏览器(Chrome/Edge)→ 复制其真实 profile 的
        登录态最小文件集(Local State + Preferences + Network/Cookies,约 760KB)→ 以该
        临时目录启动同一个浏览器可执行文件 → 窗口即用户自己的浏览器(已登录的平台直接命中,
        CDP 轮询自动保存并切下一个,无需扫码)。

        仍必须用独立 --user-data-dir:① Chrome 136+ 禁止在默认 profile 上开
        --remote-debugging-port;② 默认 profile 被用户日常实例占用时调试端口不生效。
        关闭会话时终止进程 + 删除临时 profile(含登录态副本),全程只读用户原 profile。

        返回 `(session, meta)`,meta 含 `browser` / `profile_used` / `profile_name` / `error`,
        供前端如实展示"用的是哪个浏览器、是否带上了登录态"。
        """
        import socket
        import subprocess

        browser = _find_external_browser()
        if not browser:
            raise RuntimeError("未找到可用浏览器,请先安装 Google Chrome 或 Microsoft Edge")

        # 挑空闲端口
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            s.bind(("127.0.0.1", 0))
            port = s.getsockname()[1]

        profile_dir = tempfile.mkdtemp(prefix="ihui-chrome-scan-")
        _cleanup_stale_scan_profiles()  # 清理上次异常退出遗留的登录态副本
        profile_info = _copy_browser_profile(browser.user_data, Path(profile_dir))
        if not self._started or not self._playwright:
            await self.start()
        if self._playwright is None:
            raise RuntimeError("Playwright 初始化失败,无法连接外部 Chrome")
        self._main_loop = asyncio.get_running_loop()

        def _sync_launch() -> tuple[subprocess.Popen[Any], Any, BrowserContext, Page]:
            assert self._playwright is not None
            # 普通窗口(而非 --app):保留地址栏/标签,已登录平台可直接切换,未登录可正常交互
            proc = subprocess.Popen([
                str(browser.exe),
                "--new-window",
                url,
                f"--remote-debugging-port={port}",
                f"--user-data-dir={profile_dir}",
                "--no-first-run",
                "--no-default-browser-check",
                "--hide-crash-restore-bubble",
            ])
            # 等待 CDP 端口就绪(Chrome 启动需要一点时间)
            ext_browser = None
            last_err: Exception | None = None
            for _ in range(30):
                try:
                    ext_browser = self._playwright.chromium.connect_over_cdp(
                        f"http://127.0.0.1:{port}", timeout=2000
                    )
                    break
                except Exception as e:  # noqa: PERF203
                    last_err = e
                    time.sleep(1.0)
            if ext_browser is None:
                proc.terminate()
                shutil.rmtree(profile_dir, ignore_errors=True)  # 不留含登录态副本的残留目录
                raise RuntimeError(f"连接外部 Chrome CDP 失败: {last_err}")
            context = ext_browser.contexts[0] if ext_browser.contexts else ext_browser.new_context()
            page = context.pages[0] if context.pages else context.new_page()
            return proc, ext_browser, context, page

        proc, ext_browser, context, page = await self._main_loop.run_in_executor(
            self._executor, _sync_launch
        )
        session_id = str(uuid.uuid4())
        ua = (
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
            "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
        )
        session = BrowserSession(
            session_id,
            context,
            page,
            self._executor,
            self._main_loop,
            ua,
            owner_user_id=owner_user_id,
        )
        self._sessions[session_id] = session
        self._register_tab(session_id, owner_user_id, chat_session_id)
        self._external_procs[session_id] = (proc, ext_browser, profile_dir)
        meta: dict[str, Any] = {
            "browser": browser.name,
            "profile_used": profile_info["profile_used"],
            "profile_name": profile_info.get("profile_name") or "",
            "error": profile_info.get("error"),
        }
        logger.info(
            f"[browser_hub] 外部浏览器 session {session_id} 已附着 "
            f"(browser={browser.name}, url={url}, port={port}, "
            f"profile_used={meta['profile_used']})"
        )
        return session, meta

    async def read_profile_cookies(self, user_data: Path | None = None) -> dict[str, str]:
        """无窗口读取"用户真实浏览器 profile 快照"的 cookie 值(只要值,不要归属)。

        需要按站点归属筛 cookie 的调用方**必须**改用 `read_profile_cookies_with_domains` ——
        只返回值会把整浏览器 jar 交给上层,而"是不是这一站的 cookie"这件事在值上判不出来
        (2026-09-27 实测:发布账号里因此落进过 533 字段整浏览器混包)。
        """
        values, _domains = await self.read_profile_cookies_with_domains(user_data)
        return values

    async def read_profile_cookies_with_domains(
        self, user_data: Path | None = None
    ) -> tuple[dict[str, str], dict[str, str]]:
        """同 `read_profile_cookies`,但**同一次启动**里一并返回 name → domain。

        域名来自 CDP 的 cookie 条目本身(不是猜的),供上层按平台域名白名单筛;
        个别条目缺 domain 时该名字不进 domains 映射(上层据此退到名称兜底)。
        """
        raw = await self._read_profile_cookie_entries(user_data)
        values: dict[str, str] = {}
        domains: dict[str, str] = {}
        for c in raw:
            name = str(c.get("name") or "")
            value = c.get("value")
            if not name or not value:
                continue
            values[name] = str(value)
            dom = str(c.get("domain") or "").strip()
            if dom:
                domains[name] = dom
        return values, domains

    async def _read_profile_cookie_entries(
        self, user_data: Path | None = None
    ) -> list[dict[str, object]]:
        """复制 profile 快照 → headless 起同一浏览器 → CDP 读出原始 cookie 条目。"""
        import socket
        import subprocess

        browser = _find_external_browser()
        if not browser:
            logger.warning("[browser_hub] 读取登录态失败:未找到可用浏览器")
            return []
        user_data = user_data or browser.user_data
        if not self._started or not self._playwright:
            await self.start()
        if self._playwright is None:
            return []

        profile_dir = tempfile.mkdtemp(prefix="ihui-chrome-scan-")
        _cleanup_stale_scan_profiles()
        info = _copy_browser_profile(user_data, Path(profile_dir))
        if not info["profile_used"]:
            logger.warning(f"[browser_hub] 读取登录态失败:profile 复制失败({info.get('error')})")
            shutil.rmtree(profile_dir, ignore_errors=True)
            return []

        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            s.bind(("127.0.0.1", 0))
            port = s.getsockname()[1]

        def _sync_read() -> list[dict[str, object]]:
            assert self._playwright is not None
            proc = subprocess.Popen([
                str(browser.exe),
                "--headless=new",
                "--disable-gpu",
                "--no-first-run",
                "--no-default-browser-check",
                f"--remote-debugging-port={port}",
                f"--user-data-dir={profile_dir}",
                "about:blank",
            ])
            try:
                ext = None
                last_err: Exception | None = None
                for _ in range(20):
                    try:
                        ext = self._playwright.chromium.connect_over_cdp(
                            f"http://127.0.0.1:{port}", timeout=2000
                        )
                        break
                    except Exception as e:  # noqa: PERF203
                        last_err = e
                        time.sleep(0.5)
                if ext is None:
                    raise RuntimeError(f"连接读取用 Chrome 失败: {last_err}")
                context = ext.contexts[0] if ext.contexts else ext.new_context()
                cookies = context.cookies()
                with contextlib.suppress(Exception):
                    ext.close()
                return [dict(c) for c in cookies if c.get("value")]
            finally:
                with contextlib.suppress(Exception):
                    proc.terminate()
                with contextlib.suppress(Exception):
                    proc.wait(timeout=5)

        entries: list[dict[str, object]] = []
        try:
            entries = await asyncio.get_running_loop().run_in_executor(self._executor, _sync_read)
            logger.info(f"[browser_hub] 已从用户浏览器读取 {len(entries)} 条 cookie 条目(含域名)")
        except Exception as e:  # noqa: BLE001
            logger.warning(f"[browser_hub] 读取登录态失败: {e}")
        finally:
            for _ in range(5):
                shutil.rmtree(profile_dir, ignore_errors=True)
                if not os.path.exists(profile_dir):
                    break
                time.sleep(0.4)
        return entries

    def list_sessions(self, owner_user_id: str | None = None) -> list[str]:
        return [
            sid
            for sid, s in self._sessions.items()
            if owner_user_id is None or _same_owner(s.owner_user_id, owner_user_id)
        ]

    async def close_session(self, session_id: str, owner_user_id: str | None = None) -> bool:
        if self.get_session(session_id, owner_user_id) is None:
            return False
        async with self._lock:
            return await self._close_session_internal(session_id)

    async def _close_session_internal(self, session_id: str) -> bool:
        session = self._sessions.pop(session_id, None)
        if not session:
            return False
        # 摘账:登记与存续同生命周期。留着一条已关 tab 的登记 = 作用域判定会先"命中"
        # 一枚不存在的 tab(require_tab 的第 5 步会兜住并摘掉,但那条路径是异常残留,
        # 不能当常规回收口)。
        self._tab_registry.pop(session_id, None)
        # 清理幂等去重表中引用此会话的条目
        stale_urls = [
            u for u, (sid, _) in self._recent_creations.items() if sid == session_id
        ]
        for u in stale_urls:
            self._recent_creations.pop(u, None)
        await session.close()
        # 外部 Chrome 扫码会话:终止 Chrome 进程 + 清理临时 profile
        ext = self._external_procs.pop(session_id, None)
        if ext:
            proc, ext_browser, profile_dir = ext

            def _sync_cleanup_external() -> None:
                import contextlib

                with contextlib.suppress(Exception):
                    ext_browser.close()  # connect_over_cdp 只断开连接,不杀浏览器
                with contextlib.suppress(Exception):
                    proc.terminate()
                # 2026-09-16:terminate 是异步的,Chrome 尚未释放文件句柄时 rmtree 会静默失败,
                # 导致含用户 cookie 副本的临时目录残留在 %TEMP%(实测残留 27 份)。
                # 改为「等进程退出 + 重试删除」,仍失败则告警(下次启动按 2h 规则兜底清理)。
                with contextlib.suppress(Exception):
                    proc.wait(timeout=5)
                for _ in range(5):
                    shutil.rmtree(profile_dir, ignore_errors=True)
                    if not os.path.exists(profile_dir):
                        break
                    time.sleep(0.4)
                if os.path.exists(profile_dir):
                    logger.warning(f"[browser_hub] 临时 profile 删除失败,待兜底清理: {profile_dir}")

            # 用当前 loop 调度清理(旧写法 `if self._main_loop:` 在未启动 / loop 未注入时
            # 会把清理整段静默跳过,正是临时 profile 残留的原因之一)
            await asyncio.get_running_loop().run_in_executor(self._executor, _sync_cleanup_external)
            logger.info(f"[browser_hub] 外部 Chrome session {session_id} 已关闭并清理")
        logger.info(f"[browser_hub] 关闭 session {session_id}")
        return True

    @property
    def is_started(self) -> bool:
        return self._started

    @property
    def session_count(self) -> int:
        return len(self._sessions)

    def session_count_for(self, owner_user_id: str | None = None) -> int:
        """计数必须与 `list_sessions` **同一个谓词**(旧写法两个端点各算各的会分叉)。"""
        return len(self.list_sessions(owner_user_id))


# 全局单例
hub = BrowserHub()
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
