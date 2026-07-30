"""Browser Hub 服务(2026-07-31 新增)。

需求:用户要求内置浏览器是"完整 Chrome",对标 Trae/Cursor。
当前 WorkPanel 是 iframe 架构,受 X-Frame-Options 限制无法打开第三方平台登录页。
本服务用 CDP(Chrome DevTools Protocol)远程控制真实 Chromium,通过 WebSocket
推送画面帧 + 接收鼠标键盘事件,实现"内置完整 Chrome"体验。

架构:
- 单例 BrowserHub:管理持续运行的 Chromium 实例(async_playwright)
- BrowserSession:每个 WorkPanel tab 对应一个 BrowserContext + Page + CDP session
- WebSocket 推送画面帧(CDP Page.startScreencast)
- WebSocket 接收鼠标键盘事件(CDP Input.dispatchMouseEvent / dispatchKeyEvent)
- REST API:创建会话/导航/获取 cookies/关闭

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
import base64
import logging
import uuid
from typing import Any, Awaitable, Callable, Optional

from playwright.async_api import Browser, BrowserContext, Page, async_playwright

from ..core.logging import get_logger

logger = get_logger(__name__)


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
# BrowserSession:单个浏览器会话
# ---------------------------------------------------------------------------
class BrowserSession:
    """单个浏览器会话:一个 BrowserContext + Page + CDP session。

    每个 WorkPanel tab 对应一个 BrowserSession。
    """

    def __init__(self, session_id: str, context: BrowserContext, page: Page) -> None:
        self.session_id = session_id
        self.context = context
        self.page = page
        self._cdp: Any | None = None  # CDPSession
        self._screencast_running = False
        self._frame_handlers: list[Callable[[str, dict], Awaitable[None]]] = []
        self._lock = asyncio.Lock()

    async def init_cdp(self) -> Any:
        """初始化 CDP session(懒加载)。"""
        if self._cdp is None:
            self._cdp = await self.context.new_cdp_session(self.page)
        return self._cdp

    async def navigate(self, url: str, wait_until: str = "domcontentloaded", timeout: int = 30000) -> dict:
        """导航到指定 URL。"""
        try:
            response = await self.page.goto(url, wait_until=wait_until, timeout=timeout)
            return {
                "url": self.page.url,
                "title": await self.page.title(),
                "status": response.status if response else None,
            }
        except Exception as e:
            logger.warning(f"[browser_hub] session {self.session_id} 导航失败: {url} - {e}")
            return {"url": self.page.url, "title": "", "status": None, "error": str(e)[:200]}

    async def start_screencast(self, on_frame: Callable[[str, dict], Awaitable[None]]) -> None:
        """开始推流截图帧。

        on_frame 回调签名: async def on_frame(data_b64: str, metadata: dict) -> None
        - data_b64: base64 编码的 JPEG 图片
        - metadata: CDP 元数据(包含 sessionId、timestamp 等)
        """
        cdp = await self.init_cdp()
        self._frame_handlers.append(on_frame)

        if self._screencast_running:
            # 已在推流,只追加 handler
            return

        async def handle_frame(params: dict) -> None:
            """CDP Page.screencastFrame 事件回调。"""
            data_b64 = params.get("data", "")
            metadata = params.get("metadata", {})
            # 必须回 ack,否则后续帧不再推送
            await cdp.send("Page.screencastFrameAck", {"sessionId": params.get("sessionId", 0)})
            # 通知所有 handler
            for handler in list(self._frame_handlers):
                try:
                    await handler(data_b64, metadata)
                except Exception as e:
                    logger.debug(f"[browser_hub] frame handler 异常: {e}")

        cdp.on("Page.screencastFrame", handle_frame)

        await cdp.send("Page.startScreencast", {
            "format": "jpeg",
            "quality": 70,
            "maxWidth": 1280,
            "maxHeight": 720,
            "everyNthFrame": 1,
        })
        self._screencast_running = True
        logger.info(f"[browser_hub] session {self.session_id} screencast 已启动")

    async def stop_screencast(self) -> None:
        """停止推流截图帧。"""
        if not self._screencast_running:
            return
        try:
            cdp = await self.init_cdp()
            await cdp.send("Page.stopScreencast")
        except Exception as e:
            logger.debug(f"[browser_hub] stop_screencast 异常: {e}")
        finally:
            self._screencast_running = False
            self._frame_handlers.clear()

    async def remove_frame_handler(self, on_frame: Callable) -> None:
        """移除指定的 frame handler(WebSocket 断开时调用)。"""
        try:
            self._frame_handlers.remove(on_frame)
        except ValueError:
            pass
        if not self._frame_handlers:
            await self.stop_screencast()

    async def dispatch_mouse(
        self,
        x: float,
        y: float,
        button: str = "left",
        event_type: str = "mousePressed",
        click_count: int = 1,
        modifiers: int = 0,
    ) -> None:
        """鼠标事件(CDP Input.dispatchMouseEvent)。

        event_type: "mousePressed" | "mouseReleased" | "mouseMoved"
        button: "left" | "right" | "middle" | "none"
        modifiers: 0=none, 1=alt, 2=ctrl, 4=meta, 8=shift
        """
        cdp = await self.init_cdp()
        await cdp.send("Input.dispatchMouseEvent", {
            "type": event_type,
            "x": x,
            "y": y,
            "button": button,
            "clickCount": click_count,
            "modifiers": modifiers,
        })

    async def dispatch_mouse_wheel(self, x: float, y: float, delta_x: float = 0, delta_y: float = 0) -> None:
        """滚轮事件(CDP Input.dispatchMouseEvent with mouseWheel)。"""
        cdp = await self.init_cdp()
        await cdp.send("Input.dispatchMouseEvent", {
            "type": "mouseWheel",
            "x": x,
            "y": y,
            "deltaX": delta_x,
            "deltaY": delta_y,
        })

    async def dispatch_key(
        self,
        key: str,
        event_type: str = "keyDown",
        modifiers: int = 0,
        text: str | None = None,
    ) -> None:
        """键盘事件(CDP Input.dispatchKeyEvent)。

        event_type: "keyDown" | "keyUp" | "rawKeyDown" | "char"
        key: 键名(如 "Enter", "Tab", "Backspace", "a")
        """
        cdp = await self.init_cdp()
        params: dict[str, Any] = {
            "type": event_type,
            "key": key,
            "modifiers": modifiers,
            "windowsVirtualKeyCode": _key_to_vk_code(key),
        }
        if text:
            params["text"] = text
        await cdp.send("Input.dispatchKeyEvent", params)

    async def type_text(self, text: str) -> None:
        """输入文本(逐字符发送 char 事件)。"""
        cdp = await self.init_cdp()
        for char in text:
            await cdp.send("Input.dispatchKeyEvent", {
                "type": "char",
                "text": char,
            })

    async def get_cookies(self, urls: list[str] | None = None) -> list[dict]:
        """获取 cookies(扫码登录后检测登录态)。"""
        return await self.context.cookies(urls)

    async def get_current_url(self) -> str:
        return self.page.url

    async def get_title(self) -> str:
        return await self.page.title()

    async def screenshot(self, full_page: bool = False) -> bytes:
        """一次性截图(PNG)。"""
        return await self.page.screenshot(type="png", full_page=full_page)

    async def execute_js(self, script: str) -> Any:
        """执行 JavaScript。"""
        return await self.page.evaluate(script)

    async def go_back(self) -> bool:
        return await self.page.go_back()

    async def go_forward(self) -> bool:
        return await self.page.go_forward()

    async def reload(self) -> None:
        await self.page.reload()

    async def close(self) -> None:
        """关闭会话。"""
        await self.stop_screencast()
        if self._cdp:
            try:
                await self._cdp.detach()
            except Exception:
                pass
        try:
            await self.context.close()
        except Exception:
            pass


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
        # 单字符:A-Z, 0-9 等
        return ord(key.upper())
    return 0


# ---------------------------------------------------------------------------
# BrowserHub:单例,管理持续运行的 Chromium 实例
# ---------------------------------------------------------------------------
class BrowserHub:
    """浏览器中枢:管理持续运行的 Chromium 实例 + 多 session。

    生命周期:
    - 应用启动时(startup event)调用 hub.start()
    - 应用关闭时(shutdown event)调用 hub.stop()
    - 每个 WorkPanel tab 调用 create_session 创建会话
    - tab 关闭时调用 close_session
    """

    def __init__(self) -> None:
        self._playwright: Any | None = None
        self._browser: Browser | None = None
        self._sessions: dict[str, BrowserSession] = {}
        self._lock = asyncio.Lock()
        self._started = False

    async def start(self) -> None:
        """启动 Chromium 实例(应用启动时调用)。"""
        if self._started:
            return
        async with self._lock:
            if self._started:
                return
            logger.info("[browser_hub] 启动 Chromium 实例...")
            self._playwright = await async_playwright().start()
            chromium_path = _find_chromium_executable()
            logger.info(f"[browser_hub] Chromium 路径: {chromium_path or '(Playwright 默认)'}")
            self._browser = await self._playwright.chromium.launch(
                executable_path=chromium_path,
                headless=True,  # 后端 headless,前端通过 CDP screencast 看画面
                args=[
                    "--no-sandbox",
                    "--disable-setuid-sandbox",
                    "--disable-dev-shm-usage",
                    "--disable-gpu",
                    "--disable-blink-features=AutomationControlled",  # 反检测
                ],
            )
            self._started = True
            logger.info("[browser_hub] Chromium 实例已启动")

    async def stop(self) -> None:
        """关闭 Chromium 实例(应用关闭时调用)。"""
        async with self._lock:
            # 关闭所有 session
            for session_id in list(self._sessions.keys()):
                await self._close_session_internal(session_id)
            # 关闭浏览器
            if self._browser:
                try:
                    await self._browser.close()
                except Exception as e:
                    logger.warning(f"[browser_hub] 关闭浏览器异常: {e}")
            if self._playwright:
                try:
                    await self._playwright.stop()
                except Exception as e:
                    logger.warning(f"[browser_hub] 关闭 playwright 异常: {e}")
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
        """创建新的浏览器会话。

        每个 session = 独立的 BrowserContext(隔离 cookies/缓存) + Page。
        """
        if not self._started or not self._browser:
            await self.start()
        assert self._browser is not None

        session_id = session_id or str(uuid.uuid4())
        context = await self._browser.new_context(
            viewport=viewport or {"width": 1280, "height": 720},
            locale="zh-CN",
            timezone_id="Asia/Shanghai",
            user_agent=user_agent or (
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
                "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
            ),
        )
        page = await context.new_page()
        session = BrowserSession(session_id, context, page)

        if url:
            await session.navigate(url)

        self._sessions[session_id] = session
        logger.info(f"[browser_hub] 创建 session {session_id} (url={url})")
        return session

    def get_session(self, session_id: str) -> BrowserSession | None:
        return self._sessions.get(session_id)

    def list_sessions(self) -> list[str]:
        return list(self._sessions.keys())

    async def close_session(self, session_id: str) -> bool:
        """关闭会话。"""
        async with self._lock:
            return await self._close_session_internal(session_id)

    async def _close_session_internal(self, session_id: str) -> bool:
        """内部关闭(不加锁,由调用方加锁)。"""
        session = self._sessions.pop(session_id, None)
        if not session:
            return False
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
