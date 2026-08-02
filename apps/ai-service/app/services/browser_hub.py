"""Browser Hub 服务(2026-07-31 新增,2026-07-31 重构为 sync_playwright)。

需求:用户要求内置浏览器是"完整 Chrome",对标 Trae/Cursor。
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
import logging
import threading
import uuid
from concurrent.futures import ThreadPoolExecutor
from typing import Any, Callable, Coroutine, Literal, Optional, TypeVar, cast

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
# Chromium 可执行文件查找(复用 scan_login.py 逻辑)
# ---------------------------------------------------------------------------
def _find_chromium_executable() -> str | None:
    """查找可用的 Chromium 可执行文件路径。

    优先级:
    1. PLAYWRIGHT_BROWSERS_PATH 环境变量指向的路径(D 盘)
    2. Windows 默认路径(C:\\Users\\<user>\\AppData\\Local\\ms-playwright)
    3. 返回 None(让 Playwright 自己解析)
    """
    from pathlib import Path
    import os

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
    ) -> None:
        self.session_id = session_id
        self._context = context
        self._page = page
        self._executor = executor
        self._main_loop = main_loop
        self._cdp: Any | None = None  # sync CDPSession
        self._screencast_running = False
        self._screenshot_task: asyncio.Task[None] | None = None  # 截图轮询后台 task
        self._on_frame: Optional[Callable[[str, dict[str, Any]], Coroutine[Any, Any, None]]] = None
        self._on_navigation: Optional[Callable[[str, str | None], Coroutine[Any, Any, None]]] = None
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
            self._page.reload()
        await self._run_sync(_sync)

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
            try:
                await self._screenshot_task
            except asyncio.CancelledError:
                pass
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
                try:
                    self._cdp.detach()
                except Exception:
                    pass
            try:
                self._context.close()
            except Exception:
                pass
        await self._run_sync(_sync_close)


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
    ) -> BrowserSession:
        """创建新的浏览器会话(带 URL 幂等去重)。

        2026-07-31 完美化:同一 URL 在 _DEDUP_WINDOW_SECONDS 内的重复创建请求
        直接返回已有会话,防止前端 React StrictMode/双击/重试导致多会话泄漏。
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
                    logger.info(f"[browser_hub] 幂等命中:复用 session {sid} (url={url})")
                    return self._sessions[sid]

        self._main_loop = asyncio.get_running_loop()
        session_id = session_id or str(uuid.uuid4())
        vp = viewport or {"width": 1280, "height": 720}
        ua = user_agent or (
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
            "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
        )

        browser = self._browser
        assert browser is not None

        def _sync_create() -> tuple[BrowserContext, Page]:
            context = browser.new_context(
                viewport=cast(ViewportSize, vp),
                locale="zh-CN",
                timezone_id="Asia/Shanghai",
                user_agent=ua,
            )
            # 2026-08-02 fix:隐藏 navigator.webdriver 标志(抖音/微信等对自动化检测严格,
            # headless Playwright 默认 webdriver=true 会被风控拦截)
            context.add_init_script(
                "Object.defineProperty(navigator, 'webdriver', { get: () => undefined });"
            )
            page = context.new_page()
            return context, page
        context, page = await asyncio.get_running_loop().run_in_executor(self._executor, _sync_create)

        session = BrowserSession(session_id, context, page, self._executor, self._main_loop)

        if url:
            await session.navigate(url)

        self._sessions[session_id] = session
        # 注册到幂等去重表(同 URL 在 _DEDUP_WINDOW_SECONDS 内复用此会话)
        if url:
            import time as _time
            self._recent_creations[url] = (session_id, _time.monotonic())
        logger.info(f"[browser_hub] 创建 session {session_id} (url={url})")
        return session

    def get_session(self, session_id: str) -> BrowserSession | None:
        return self._sessions.get(session_id)

    def list_sessions(self) -> list[str]:
        return list(self._sessions.keys())

    async def close_session(self, session_id: str) -> bool:
        async with self._lock:
            return await self._close_session_internal(session_id)

    async def _close_session_internal(self, session_id: str) -> bool:
        session = self._sessions.pop(session_id, None)
        if not session:
            return False
        # 清理幂等去重表中引用此会话的条目
        stale_urls = [
            u for u, (sid, _) in self._recent_creations.items() if sid == session_id
        ]
        for u in stale_urls:
            self._recent_creations.pop(u, None)
        await session.close()
        logger.info(f"[browser_hub] 关闭 session {session_id}")
        return True

    @property
    def is_started(self) -> bool:
        return self._started

    @property
    def session_count(self) -> int:
        return len(self._sessions)


# 全局单例
hub = BrowserHub()
