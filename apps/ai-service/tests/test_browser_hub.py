"""BrowserHub(browser_hub.py)单元测试(2026-08-12 立,补齐 0 覆盖)。

覆盖不依赖真实 Chromium/CDP 的纯逻辑 + mock 化网络层:
- 纯函数:_key_to_vk_code / _looks_like_challenge / _find_chromium_executable
- BrowserSession:导航 / 会话查询 / CDP 指令序列化 / 截图轮询 / 事件回调 / 关闭
- BrowserHub:启动/停止 / 会话注册/去重 / 风控墙重建 / 关闭清理

策略:
- 用 FakePage/FakeContext/FakeBrowser 替身,Playwright 对象全部打桩
- _run_sync 改为直接执行(mock 掉线程池),hub 的 run_in_executor 用 _DirectExecutor
- 不启动真实浏览器,不依赖任何外部资源
"""

from __future__ import annotations

import asyncio
import concurrent.futures
import time
from types import SimpleNamespace

import pytest

from app.services import browser_hub as bh


# ---------------------------------------------------------------------------
# Playwright 替身
# ---------------------------------------------------------------------------


class FakeFrame:
    pass


class FakeResponse:
    def __init__(self, status: int | None):
        self.status = status


class FakeCdp:
    """CDP session 替身:记录 send/detach。"""

    def __init__(self, detach_error: Exception | None = None):
        self.calls: list[tuple[str, dict]] = []
        self.detached = False
        self.detach_error = detach_error

    def send(self, method: str, params: dict | None = None) -> None:
        self.calls.append((method, params or {}))

    def detach(self) -> None:
        if self.detach_error:
            raise self.detach_error
        self.detached = True


class FakePage:
    def __init__(
        self,
        url: str = "",
        title_text: str = "",
        body_text: str = "",
        viewport: dict | None = None,
        scripts: int = 0,
        imgs: int = 0,
        goto_response: FakeResponse | None = None,
        goto_error: Exception | None = None,
        raise_inner_text: bool = False,
        reload_error: Exception | None = None,
    ):
        self.url = url
        self._title_text = title_text
        self.body_text = body_text
        self.viewport_size = viewport
        self.scripts = scripts
        self.imgs = imgs
        self.goto_response = goto_response
        self.goto_error = goto_error
        self.raise_inner_text = raise_inner_text
        self.reload_error = reload_error
        self._frame = FakeFrame()
        self.on_handlers: dict[str, list] = {}
        self.goto_calls: list[tuple[str, str, int]] = []
        self.reload_calls = 0
        self.screenshot_calls: list[tuple[str, bool, int | None]] = []
        self.evaluate_calls: list[str] = []
        self.back_result: object | None = None
        self.forward_result: object | None = None

    @property
    def main_frame(self) -> FakeFrame:
        return self._frame

    def inner_text(self, selector: str) -> str:
        if self.raise_inner_text:
            raise RuntimeError("page closed")
        return self.body_text

    def evaluate(self, script: str) -> object:
        self.evaluate_calls.append(script)
        if "scripts" in script:
            return self.scripts
        return self.imgs

    def title(self) -> str:
        return self._title_text

    def on(self, event: str, handler) -> None:
        self.on_handlers.setdefault(event, []).append(handler)

    def goto(self, url: str, wait_until: str = "domcontentloaded", timeout: int = 30000):
        self.goto_calls.append((url, wait_until, timeout))
        if self.goto_error:
            raise self.goto_error
        return self.goto_response

    def go_back(self):
        return self.back_result

    def go_forward(self):
        return self.forward_result

    def reload(self, wait_until: str = "domcontentloaded", timeout: int = 30000) -> None:
        self.reload_calls += 1
        if self.reload_error:
            raise self.reload_error

    def screenshot(self, type: str = "png", full_page: bool = False, quality: int | None = None) -> bytes:
        self.screenshot_calls.append((type, full_page, quality))
        return b"\x89PNG-JPEG-FAKE"


class FakeContext:
    def __init__(
        self,
        page: FakePage | None = None,
        close_error: Exception | None = None,
        cookies_result: list[dict] | None = None,
    ):
        self._page = page if page is not None else FakePage()
        self.closed = False
        self.close_error = close_error
        self.cdp: FakeCdp | None = None
        self.cdp_session_calls = 0
        self.init_scripts: list[str] = []
        self.cookies_urls: list[str] | None = None
        self.cookies_result = cookies_result or []
        self.launch_kwargs: dict = {}

    def new_page(self) -> FakePage:
        return self._page

    def add_init_script(self, script: str) -> None:
        self.init_scripts.append(script)

    def close(self) -> None:
        self.closed = True
        if self.close_error:
            raise self.close_error

    def cookies(self, urls: list[str] | None = None) -> list[dict]:
        self.cookies_urls = urls
        return self.cookies_result

    def new_cdp_session(self, page) -> FakeCdp:
        self.cdp_session_calls += 1
        self.cdp = FakeCdp()
        return self.cdp


class FakeBrowser:
    def __init__(self, context_factory=None):
        self._context_factory = context_factory or (lambda: FakeContext())
        self.contexts: list[FakeContext] = []
        self.closed = False

    def new_context(self, **kwargs) -> FakeContext:
        ctx = self._context_factory()
        ctx.launch_kwargs = kwargs
        self.contexts.append(ctx)
        return ctx

    def close(self) -> None:
        self.closed = True


class _DirectExecutor:
    """替代 ThreadPoolExecutor:submit 同步执行,返回已完成 Future。"""

    def submit(self, fn, /, *args, **kwargs):
        fut = concurrent.futures.Future()
        try:
            fut.set_result(fn(*args, **kwargs))
        except BaseException as e:  # noqa: BLE001 - 测试替身需原样透传
            fut.set_exception(e)
        return fut


# ---------------------------------------------------------------------------
# 公共 fixture / 工厂
# ---------------------------------------------------------------------------


@pytest.fixture(autouse=True)
def _direct_run_sync(monkeypatch):
    """把所有 BrowserSession._run_sync 替换为直接执行,mock 掉线程池与跨线程调用。"""

    async def _direct(self, func):
        return func()

    monkeypatch.setattr(bh.BrowserSession, "_run_sync", _direct)


def _make_session(
    page: FakePage | None = None,
    context: FakeContext | None = None,
    loop: asyncio.AbstractEventLoop | None = None,
    session_id: str = "sess-1",
) -> bh.BrowserSession:
    loop = loop or asyncio.get_running_loop()
    page = page if page is not None else FakePage()
    context = context if context is not None else FakeContext(page=page)
    return bh.BrowserSession(session_id, context, page, None, loop)


def _make_hub(loop: asyncio.AbstractEventLoop, browser: FakeBrowser | None = None) -> bh.BrowserHub:
    h = bh.BrowserHub()
    h._executor = _DirectExecutor()
    h._main_loop = loop
    h._started = True
    if browser is not None:
        h._browser = browser
    return h


# ---------------------------------------------------------------------------
# _key_to_vk_code
# ---------------------------------------------------------------------------


def test_key_to_vk_code_known_keys():
    assert bh._key_to_vk_code("Enter") == 13
    assert bh._key_to_vk_code("Return") == 13
    assert bh._key_to_vk_code("Tab") == 9
    assert bh._key_to_vk_code("Backspace") == 8
    assert bh._key_to_vk_code("Escape") == 27
    assert bh._key_to_vk_code("Esc") == 27
    assert bh._key_to_vk_code("ArrowUp") == 38
    assert bh._key_to_vk_code("ArrowDown") == 40
    assert bh._key_to_vk_code("ArrowLeft") == 37
    assert bh._key_to_vk_code("ArrowRight") == 39
    assert bh._key_to_vk_code("Home") == 36
    assert bh._key_to_vk_code("End") == 35
    assert bh._key_to_vk_code("PageUp") == 33
    assert bh._key_to_vk_code("PageDown") == 34
    assert bh._key_to_vk_code("Space") == 32
    assert bh._key_to_vk_code(" ") == 32
    assert bh._key_to_vk_code("Control") == 17
    assert bh._key_to_vk_code("Ctrl") == 17
    assert bh._key_to_vk_code("Shift") == 16
    assert bh._key_to_vk_code("Alt") == 18
    assert bh._key_to_vk_code("Meta") == 91
    assert bh._key_to_vk_code("Win") == 91
    assert bh._key_to_vk_code("CapsLock") == 20
    assert bh._key_to_vk_code("F1") == 112
    assert bh._key_to_vk_code("F12") == 123


def test_key_to_vk_code_single_char():
    assert bh._key_to_vk_code("a") == ord("A")
    assert bh._key_to_vk_code("A") == ord("A")
    assert bh._key_to_vk_code("z") == ord("Z")
    assert bh._key_to_vk_code("1") == ord("1")


def test_key_to_vk_code_unknown():
    assert bh._key_to_vk_code("UnknownKey") == 0
    assert bh._key_to_vk_code("") == 0


# ---------------------------------------------------------------------------
# _looks_like_challenge
# ---------------------------------------------------------------------------


def test_challenge_marker_detection():
    page = FakePage(body_text="请完成安全验证,验证通过后继续")
    assert bh._looks_like_challenge(page) is True


def test_challenge_marker_case_insensitive():
    page = FakePage(body_text="We detected unusual traffic from your network")
    assert bh._looks_like_challenge(page) is True


def test_normal_long_page_not_challenge():
    page = FakePage(body_text="这里是一段足够长的正常页面正文,用来确保不会被近空白检测逻辑误判为风控墙")
    assert bh._looks_like_challenge(page) is False


def test_blank_page_non_sensitive_host_not_challenge():
    page = FakePage(url="https://example.com/foo", body_text="")
    assert bh._looks_like_challenge(page) is False


def test_blank_page_no_url_not_challenge():
    page = FakePage(url="", body_text="")
    assert bh._looks_like_challenge(page) is False


def test_blank_page_sensitive_host_with_scripts_is_challenge():
    page = FakePage(url="https://www.weixin.qq.com/", body_text="", scripts=5, imgs=1)
    assert bh._looks_like_challenge(page) is True


def test_blank_page_sensitive_host_no_scripts_not_challenge():
    page = FakePage(url="https://www.douyin.com/", body_text="", scripts=0, imgs=1)
    assert bh._looks_like_challenge(page) is False


def test_blank_page_sensitive_host_many_images_not_challenge():
    page = FakePage(url="https://www.douyin.com/", body_text="", scripts=3, imgs=5)
    assert bh._looks_like_challenge(page) is False


def test_challenge_inner_text_raises_returns_false():
    page = FakePage(raise_inner_text=True)
    assert bh._looks_like_challenge(page) is False


def test_near_blank_check_only_for_short_text():
    page = FakePage(url="https://weixin.qq.com/", body_text="x" * 40, scripts=5, imgs=1)
    assert bh._looks_like_challenge(page) is False


# ---------------------------------------------------------------------------
# _find_chromium_executable
# ---------------------------------------------------------------------------


def test_find_chromium_no_path(monkeypatch, tmp_path):
    monkeypatch.delenv("PLAYWRIGHT_BROWSERS_PATH", raising=False)
    fake_home = tmp_path / "home"
    monkeypatch.setattr("pathlib.Path.home", classmethod(lambda cls: fake_home))
    assert bh._find_chromium_executable() is None


def test_find_chromium_env_full_chrome(monkeypatch, tmp_path):
    env = tmp_path / "ms-playwright"
    chrome = env / "chromium-1228" / "chrome-win64" / "chrome.exe"
    chrome.parent.mkdir(parents=True)
    chrome.write_text("x")
    monkeypatch.setenv("PLAYWRIGHT_BROWSERS_PATH", str(env))
    assert bh._find_chromium_executable() == str(chrome)


def test_find_chromium_env_headless_shell(monkeypatch, tmp_path):
    env = tmp_path / "ms-playwright"
    shell = env / "chromium_headless_shell-1228" / "chrome-headless-shell-win64" / "chrome-headless-shell.exe"
    shell.parent.mkdir(parents=True)
    shell.write_text("x")
    monkeypatch.setenv("PLAYWRIGHT_BROWSERS_PATH", str(env))
    assert bh._find_chromium_executable() == str(shell)


def test_find_chromium_fallback_to_home(monkeypatch, tmp_path):
    env = tmp_path / "empty-env"
    env.mkdir()
    monkeypatch.setenv("PLAYWRIGHT_BROWSERS_PATH", str(env))
    fake_home = tmp_path / "home"
    chrome = fake_home / "AppData" / "Local" / "ms-playwright" / "chromium-1228" / "chrome-win64" / "chrome.exe"
    chrome.parent.mkdir(parents=True)
    chrome.write_text("x")
    monkeypatch.setattr("pathlib.Path.home", classmethod(lambda cls: fake_home))
    assert bh._find_chromium_executable() == str(chrome)


# ---------------------------------------------------------------------------
# BrowserSession:视图 / 导航 / 查询
# ---------------------------------------------------------------------------


async def test_viewport():
    page = FakePage(viewport={"width": 800, "height": 600})
    session = _make_session(page=page)
    assert session.viewport == {"width": 800, "height": 600}


async def test_viewport_default_when_missing():
    session = _make_session(page=FakePage(viewport=None))
    assert session.viewport == {"width": 1280, "height": 720}


async def test_navigate_success():
    page = FakePage(url="https://a.com/", title_text="Hello", goto_response=FakeResponse(200))
    session = _make_session(page=page)
    result = await session.navigate("https://a.com/")
    assert result == {"url": "https://a.com/", "title": "Hello", "status": 200}
    assert page.goto_calls == [("https://a.com/", "domcontentloaded", 30000)]


async def test_navigate_custom_wait_timeout():
    page = FakePage(url="https://a.com/", goto_response=FakeResponse(301))
    session = _make_session(page=page)
    result = await session.navigate("https://a.com/", wait_until="load", timeout=5000)
    assert result["status"] == 301
    assert page.goto_calls == [("https://a.com/", "load", 5000)]


async def test_navigate_failure_returns_error():
    page = FakePage(url="https://a.com/", goto_error=RuntimeError("net::ERR_CONNECTION_REFUSED"))
    session = _make_session(page=page)
    result = await session.navigate("https://a.com/")
    assert result["status"] is None
    assert result["title"] == ""
    assert "net::ERR_CONNECTION_REFUSED" in result["error"]


async def test_get_current_url_and_title():
    page = FakePage(url="https://b.com/", title_text="T")
    session = _make_session(page=page)
    assert await session.get_current_url() == "https://b.com/"
    assert await session.get_title() == "T"


async def test_go_back_forward():
    page = FakePage()
    session = _make_session(page=page)
    page.back_result = FakeResponse(200)
    page.forward_result = None
    assert await session.go_back() is True
    assert await session.go_forward() is False


async def test_reload_swallows_error():
    page = FakePage(reload_error=RuntimeError("boom"))
    session = _make_session(page=page)
    await session.reload()
    assert page.reload_calls == 1


async def test_reload_with_recovery_true_when_challenged():
    page = FakePage(body_text="安全验证", url="https://douyin.com/")
    session = _make_session(page=page)
    assert await session.reload_with_recovery() is True
    assert page.reload_calls == 1


async def test_reload_with_recovery_false_when_normal():
    page = FakePage(body_text="normal page with enough content to avoid blank detection")
    session = _make_session(page=page)
    assert await session.reload_with_recovery() is False


# ---------------------------------------------------------------------------
# BrowserSession:cookies / 截图 / JS / CDP
# ---------------------------------------------------------------------------


async def test_get_cookies_forwards_urls():
    ctx = FakeContext(cookies_result=[{"name": "sid", "value": "abc"}])
    session = _make_session(context=ctx)
    result = await session.get_cookies(["https://a.com/"])
    assert result == [{"name": "sid", "value": "abc"}]
    assert ctx.cookies_urls == ["https://a.com/"]


async def test_screenshot():
    page = FakePage()
    session = _make_session(page=page)
    data = await session.screenshot(full_page=True)
    assert data == b"\x89PNG-JPEG-FAKE"
    assert page.screenshot_calls == [("png", True, None)]


async def test_execute_js():
    page = FakePage()
    page.scripts = 3
    page.imgs = 0
    session = _make_session(page=page)
    assert await session.execute_js("document.scripts.length") == 3


async def test_ensure_cdp_caches():
    ctx = FakeContext()
    session = _make_session(context=ctx)
    cdp1 = session._ensure_cdp()
    cdp2 = session._ensure_cdp()
    assert cdp1 is cdp2
    assert ctx.cdp_session_calls == 1


async def test_dispatch_mouse():
    ctx = FakeContext()
    session = _make_session(context=ctx)
    await session.dispatch_mouse(10, 20, button="left", event_type="mousePressed", click_count=2, modifiers=1)
    assert ctx.cdp is not None
    method, params = ctx.cdp.calls[0]
    assert method == "Input.dispatchMouseEvent"
    assert params == {
        "type": "mousePressed",
        "x": 10,
        "y": 20,
        "button": "left",
        "clickCount": 2,
        "modifiers": 1,
    }


async def test_dispatch_mouse_wheel():
    ctx = FakeContext()
    session = _make_session(context=ctx)
    await session.dispatch_mouse_wheel(5, 6, delta_x=100, delta_y=200)
    method, params = ctx.cdp.calls[0]
    assert method == "Input.dispatchMouseEvent"
    assert params["type"] == "mouseWheel"
    assert params["deltaX"] == 100
    assert params["deltaY"] == 200


async def test_dispatch_key_maps_vk_code():
    ctx = FakeContext()
    session = _make_session(context=ctx)
    await session.dispatch_key("Enter")
    method, params = ctx.cdp.calls[0]
    assert method == "Input.dispatchKeyEvent"
    assert params["key"] == "Enter"
    assert params["windowsVirtualKeyCode"] == 13
    assert "text" not in params


async def test_dispatch_key_with_text():
    ctx = FakeContext()
    session = _make_session(context=ctx)
    await session.dispatch_key("a", text="a")
    _, params = ctx.cdp.calls[0]
    assert params["windowsVirtualKeyCode"] == ord("A")
    assert params["text"] == "a"


async def test_type_text_sends_char_events():
    ctx = FakeContext()
    session = _make_session(context=ctx)
    await session.type_text("hi")
    assert [c[0] for c in ctx.cdp.calls] == ["Input.dispatchKeyEvent", "Input.dispatchKeyEvent"]
    assert ctx.cdp.calls[0][1] == {"type": "char", "text": "h"}
    assert ctx.cdp.calls[1][1] == {"type": "char", "text": "i"}


# ---------------------------------------------------------------------------
# BrowserSession:画面流(截图轮询)
# ---------------------------------------------------------------------------


async def test_screencast_start_stop():
    session = _make_session()
    calls = []

    async def on_frame(data, meta):
        calls.append((data, meta))

    await session.start_screencast(on_frame)
    assert session._screencast_running is True
    assert session._screenshot_task is not None
    await session.stop_screencast()
    assert session._screencast_running is False
    assert session._screenshot_task is None
    assert session._on_frame is None


async def test_screencast_loop_sends_frames():
    page = FakePage(viewport={"width": 800, "height": 600})
    session = _make_session(page=page)
    received = []

    async def on_frame(data, meta):
        received.append((data, meta))

    await session.start_screencast(on_frame)
    for _ in range(200):
        if received:
            break
        await asyncio.sleep(0.01)
    await session.stop_screencast()

    assert received, "截图轮询未推送任何帧"
    data_b64, meta = received[0]
    assert meta == {"deviceWidth": 800, "deviceHeight": 600}
    # base64 解码后应还原原始截图字节
    import base64
    assert base64.b64decode(data_b64) == b"\x89PNG-JPEG-FAKE"


async def test_screencast_start_is_idempotent():
    session = _make_session()

    async def h1(data, meta):
        pass

    async def h2(data, meta):
        pass

    await session.start_screencast(h1)
    task1 = session._screenshot_task
    await session.start_screencast(h2)
    assert session._screenshot_task is task1  # 未新建后台任务
    assert session._screencast_running is True
    assert session._on_frame is h2
    await session.stop_screencast()


async def test_stop_screencast_no_task():
    session = _make_session()
    await session.stop_screencast()
    assert session._screenshot_task is None
    assert session._on_frame is None


async def test_remove_frame_handler_stops_screencast():
    session = _make_session()

    async def h(data, meta):
        pass

    await session.start_screencast(h)
    await session.remove_frame_handler(h)
    assert session._screencast_running is False
    assert session._on_frame is None


# ---------------------------------------------------------------------------
# BrowserSession:导航事件回调 / 关闭
# ---------------------------------------------------------------------------


async def test_set_navigation_handler_fires_on_main_frame():
    page = FakePage(url="https://a.com/")
    session = _make_session(page=page)
    triggered = []
    event = asyncio.Event()

    async def on_nav(url, title):
        triggered.append((url, title))
        event.set()

    await session.set_navigation_handler(on_nav)
    assert "framenavigated" in page.on_handlers
    page.on_handlers["framenavigated"][0](page.main_frame)
    await asyncio.wait_for(event.wait(), 2)
    assert triggered == [("https://a.com/", None)]


async def test_set_navigation_handler_ignores_non_main_frame():
    page = FakePage(url="https://a.com/")
    session = _make_session(page=page)

    async def on_nav(url, title):
        raise AssertionError("非主 frame 不应触发导航回调")

    await session.set_navigation_handler(on_nav)
    page.on_handlers["framenavigated"][0](object())
    await asyncio.sleep(0.05)


async def test_close_detaches_cdp_and_closes_context():
    ctx = FakeContext()
    session = _make_session(context=ctx)
    await session.dispatch_key("Enter")  # 触发创建 cdp
    await session.close()
    assert ctx.cdp.detached is True
    assert ctx.closed is True


async def test_close_swallows_errors():
    cdp = FakeCdp(detach_error=RuntimeError("detach fail"))
    ctx = FakeContext(close_error=RuntimeError("close fail"))
    ctx.cdp = cdp
    session = _make_session(context=ctx)
    session._cdp = cdp
    await session.close()  # 不应抛出
    assert ctx.closed is True


# ---------------------------------------------------------------------------
# BrowserHub:start / stop
# ---------------------------------------------------------------------------


async def test_start(monkeypatch):
    loop = asyncio.get_running_loop()
    h = bh.BrowserHub()
    h._executor = _DirectExecutor()
    launched: dict = {}
    fake_browser = object()
    fake_pw = SimpleNamespace()
    fake_pw.chromium = SimpleNamespace()
    fake_pw.chromium.launch = lambda **kw: launched.update(kw) or fake_browser
    monkeypatch.setattr(bh, "sync_playwright", lambda: SimpleNamespace(start=lambda: fake_pw))
    monkeypatch.setattr(bh, "_find_chromium_executable", lambda: None)

    await h.start()
    assert h._started is True
    assert h._browser is fake_browser
    assert h._main_loop is loop
    assert launched["headless"] is True
    assert launched["executable_path"] is None
    assert "--no-sandbox" in launched["args"]
    assert "--disable-blink-features=AutomationControlled" in launched["args"]


async def test_start_idempotent(monkeypatch):
    h = bh.BrowserHub()
    h._executor = _DirectExecutor()
    launched: list[dict] = []
    fake_pw = SimpleNamespace()
    fake_pw.chromium = SimpleNamespace()
    fake_pw.chromium.launch = lambda **kw: launched.append(kw) or object()
    monkeypatch.setattr(bh, "sync_playwright", lambda: SimpleNamespace(start=lambda: fake_pw))
    monkeypatch.setattr(bh, "_find_chromium_executable", lambda: None)

    await h.start()
    await h.start()
    assert len(launched) == 1  # 只启动一次


async def test_stop_closes_sessions_and_browser(monkeypatch):
    loop = asyncio.get_running_loop()
    browser = FakeBrowser()
    h = _make_hub(loop, browser=browser)
    fake_pw = SimpleNamespace()
    fake_pw.stopped = False
    fake_pw.stop = lambda: setattr(fake_pw, "stopped", True)
    h._playwright = fake_pw

    await h.create_session(url="https://a.com", session_id="s1")
    await h.create_session(url="https://b.com", session_id="s2")
    await h.stop()

    assert browser.closed is True
    assert fake_pw.stopped is True
    assert h._started is False
    assert h._browser is None
    assert h._playwright is None
    assert h.session_count == 0
    assert h._recent_creations == {}


async def test_stop_without_browser(monkeypatch):
    loop = asyncio.get_running_loop()
    h = bh.BrowserHub()
    h._executor = _DirectExecutor()
    h._main_loop = loop
    h._started = True
    h._playwright = SimpleNamespace()
    await h.stop()
    assert h._playwright is None
    assert h._browser is None
    assert h._started is False


# ---------------------------------------------------------------------------
# BrowserHub:create_session(幂等去重 / 参数透传)
# ---------------------------------------------------------------------------


async def test_create_session_autostarts(monkeypatch):
    loop = asyncio.get_running_loop()
    h = bh.BrowserHub()
    h._executor = _DirectExecutor()
    started_calls = []

    async def fake_start(self):
        started_calls.append(1)
        self._started = True
        self._main_loop = asyncio.get_running_loop()
        self._browser = FakeBrowser()

    monkeypatch.setattr(bh.BrowserHub, "start", fake_start)
    s = await h.create_session(url="https://a.com", session_id="s1")
    assert started_calls == [1]
    assert s.session_id == "s1"
    assert h.session_count == 1


async def test_create_session_dedup_same_url():
    loop = asyncio.get_running_loop()
    h = _make_hub(loop, browser=FakeBrowser())
    s1 = await h.create_session(url="https://a.com")
    s2 = await h.create_session(url="https://a.com")
    assert s1 is s2
    assert h.session_count == 1


async def test_create_session_different_url_new_session():
    loop = asyncio.get_running_loop()
    h = _make_hub(loop, browser=FakeBrowser())
    s1 = await h.create_session(url="https://a.com")
    s2 = await h.create_session(url="https://b.com")
    assert s1 is not s2
    assert h.session_count == 2


async def test_create_session_custom_session_id():
    loop = asyncio.get_running_loop()
    h = _make_hub(loop, browser=FakeBrowser())
    s = await h.create_session(url=None, session_id="custom-1")
    assert s.session_id == "custom-1"
    assert h.get_session("custom-1") is s


async def test_create_session_passes_viewport_ua():
    loop = asyncio.get_running_loop()
    browser = FakeBrowser()
    h = _make_hub(loop, browser=browser)
    s = await h.create_session(
        url=None,
        session_id="s1",
        viewport={"width": 800, "height": 600},
        user_agent="custom-ua",
    )
    ctx = browser.contexts[0]
    assert ctx.launch_kwargs["viewport"] == {"width": 800, "height": 600}
    assert ctx.launch_kwargs["user_agent"] == "custom-ua"
    assert ctx.launch_kwargs["locale"] == "zh-CN"
    assert ctx.launch_kwargs["timezone_id"] == "Asia/Shanghai"
    assert ctx.init_scripts == [bh._ANTI_DETECT_SCRIPT]
    assert s._user_agent == "custom-ua"


async def test_create_session_default_viewport_ua():
    loop = asyncio.get_running_loop()
    browser = FakeBrowser()
    h = _make_hub(loop, browser=browser)
    s = await h.create_session(url=None, session_id="s1")
    ctx = browser.contexts[0]
    assert ctx.launch_kwargs["viewport"] == {"width": 1280, "height": 720}
    assert "Chrome/120" in ctx.launch_kwargs["user_agent"]
    assert s._user_agent == ctx.launch_kwargs["user_agent"]


async def test_create_session_cleans_stale_dedup_entries():
    loop = asyncio.get_running_loop()
    h = _make_hub(loop, browser=FakeBrowser())
    now = time.monotonic()
    h._recent_creations["https://expired.com"] = ("dead-1", now - 50)  # 超过去重窗口
    h._recent_creations["https://orphan.com"] = ("dead-2", now)  # 会话已不存在
    await h.create_session(url="https://new.com", session_id="s1")
    assert "https://expired.com" not in h._recent_creations
    assert "https://orphan.com" not in h._recent_creations
    assert "https://new.com" in h._recent_creations


async def test_create_session_dedup_expired_window():
    loop = asyncio.get_running_loop()
    h = _make_hub(loop, browser=FakeBrowser())
    s1 = await h.create_session(url="https://exp.com", session_id="s1")
    # 手动把去重时间戳推到窗口之外
    ts = h._recent_creations["https://exp.com"][1]
    h._recent_creations["https://exp.com"] = ("s1", ts - 11)
    s2 = await h.create_session(url="https://exp.com", session_id="s2")
    assert s2 is not s1
    assert h.session_count == 2
    assert h._recent_creations["https://exp.com"][0] == "s2"


# ---------------------------------------------------------------------------
# BrowserHub:_build_session(风控墙重建)
# ---------------------------------------------------------------------------


async def test_build_session_retry_on_challenge():
    loop = asyncio.get_running_loop()
    attempts = {"n": 0}

    def make_context():
        attempts["n"] += 1
        if attempts["n"] == 1:
            page = FakePage(url="https://douyin.com/", body_text="安全验证,请完成人机验证")
        else:
            page = FakePage(url="https://douyin.com/", body_text="这里是一段足够长的正常页面内容,用于避免被误判为近空白页面")
        return FakeContext(page=page)

    browser = FakeBrowser(make_context)
    h = _make_hub(loop, browser=browser)
    s = await h._build_session(
        url="https://douyin.com/",
        session_id="s1",
        viewport={"width": 1280, "height": 720},
        user_agent="ua",
    )
    assert attempts["n"] == 2  # 首访命中风控墙 → 重建 1 次
    assert browser.contexts[0].closed is True
    assert browser.contexts[1].closed is False
    assert s.session_id == "s1"
    assert s._page is browser.contexts[1]._page


async def test_build_session_double_challenge_keeps_last_session():
    """两次都命中风控墙:保留最后现场(不崩溃)。

    2026-08-12 回归:此前第二次命中后 session 被置 None,
    循环后 assert session is not None 抛 AssertionError。
    """
    loop = asyncio.get_running_loop()

    def make_context():
        page = FakePage(url="https://douyin.com/", body_text="安全验证,请完成人机验证")
        return FakeContext(page=page)

    browser = FakeBrowser(make_context)
    h = _make_hub(loop, browser=browser)
    s = await h._build_session(
        url="https://douyin.com/",
        session_id="s1",
        viewport={"width": 1280, "height": 720},
        user_agent="ua",
    )
    # 不崩溃且返回 session 对象(已 close,供 reload 端点触发 recreate_session 重建)
    assert s is not None
    assert s.session_id == "s1"
    assert len(browser.contexts) == 2
    assert browser.contexts[-1].closed is True


async def test_build_session_no_url_skips_challenge_check():
    loop = asyncio.get_running_loop()
    browser = FakeBrowser()
    h = _make_hub(loop, browser=browser)
    s = await h._build_session(
        url=None,
        session_id="s1",
        viewport={"width": 1280, "height": 720},
        user_agent="ua",
    )
    assert len(browser.contexts) == 1  # 无 url → 不做风控检测,不重建
    assert s.session_id == "s1"


# ---------------------------------------------------------------------------
# BrowserHub:recreate_session(风控墙重建)
# ---------------------------------------------------------------------------


async def test_recreate_session_nonexistent():
    loop = asyncio.get_running_loop()
    h = _make_hub(loop, browser=FakeBrowser())
    assert await h.recreate_session("nope") is None


async def test_recreate_session():
    loop = asyncio.get_running_loop()
    browser = FakeBrowser(lambda: FakeContext(page=FakePage(url="https://x.com/", body_text="正常页面内容足够长不会触发近空白检测")))
    h = _make_hub(loop, browser=browser)
    old = await h.create_session(url="https://x.com/", session_id="old-1")
    old._page.viewport_size = {"width": 300, "height": 400}

    new = await h.recreate_session("old-1")
    assert new is not None
    assert new.session_id != "old-1"
    assert h.get_session("old-1") is None
    assert h.session_count == 1
    assert h._recent_creations["https://x.com/"][0] == new.session_id
    # 新会话沿用旧会话的 URL / 视口 / UA
    last_ctx = browser.contexts[-1]
    assert last_ctx.launch_kwargs["viewport"] == {"width": 300, "height": 400}
    assert last_ctx.launch_kwargs["user_agent"] == old._user_agent
    # 旧会话 context 已关闭
    assert browser.contexts[0].closed is True


# ---------------------------------------------------------------------------
# BrowserHub:会话管理辅助
# ---------------------------------------------------------------------------


async def test_close_session():
    loop = asyncio.get_running_loop()
    browser = FakeBrowser()
    h = _make_hub(loop, browser=browser)
    await h.create_session(url="https://a.com", session_id="s1")
    await h.create_session(url="https://b.com", session_id="s2")

    assert await h.close_session("s1") is True
    assert h.get_session("s1") is None
    assert h.session_count == 1
    assert "https://a.com" not in h._recent_creations
    assert "https://b.com" in h._recent_creations
    assert browser.contexts[0].closed is True  # s1 的 context 已关闭


async def test_close_session_nonexistent():
    loop = asyncio.get_running_loop()
    h = _make_hub(loop, browser=FakeBrowser())
    assert await h.close_session("nope") is False
    assert h.session_count == 0


async def test_session_helpers():
    loop = asyncio.get_running_loop()
    h = _make_hub(loop, browser=FakeBrowser())
    assert h.is_started is True
    assert h.session_count == 0
    assert h.list_sessions() == []
    s = await h.create_session(url=None, session_id="abc")
    assert h.get_session("abc") is s
    assert h.get_session("zzz") is None
    assert h.list_sessions() == ["abc"]
    assert h.session_count == 1
