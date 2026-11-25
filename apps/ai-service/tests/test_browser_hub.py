# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

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

from app.services import ask_user_question as auq
from app.services import browser_hub as bh
from app.services import browser_task as auq_task


@pytest.fixture(autouse=True)
def _resolve_fake_domains(monkeypatch: pytest.MonkeyPatch) -> None:
    """假域名解析成公网 IP:导航机制用例不该依赖真实 DNS。

    2026-11-01 起 navigate/create_session 会过 SSRF 闸(判据在
    screenshot_service._validate_url_ssrf)。本文件测的是导航/会话机制,用的
    a.com/b.com 等假域名在离线机器上 DNS 必失败 ⇒ 闸会(正确地)拒。这里只把
    **DNS 解析**钉成公网 IP,闸的协议/端口/内网判据照旧执行。
    闸本身的逐条用例见 tests/test_browser_hub_navigate_ssrf.py。
    """
    import socket

    from app.services import screenshot_service as _ss

    real = socket.getaddrinfo

    def _fake(host, *args, **kwargs):
        try:
            return real(host, *args, **kwargs)
        except socket.gaierror:
            return [(socket.AF_INET, socket.SOCK_STREAM, 6, "", ("93.184.216.34", 0))]

    monkeypatch.setattr(_ss.socket, "getaddrinfo", _fake)

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
        # 2026-11-01:会话建立时会在 page 上装 SSRF 的逐请求 route 处理器
        # (真实 Playwright 的 page.route)。替身只记录安装动作,不拦截网络。
        self.route_handlers: list[tuple[str, object]] = []

    def route(self, pattern: str, handler: object) -> None:
        self.route_handlers.append((pattern, handler))

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
    # 系统 Edge/Chrome 回落是 2026-11-25 新增的真实能力;本用例只测
    # “Playwright 缓存与用户目录都没有时返回 None”,所以显式清空回落候选。
    monkeypatch.setattr(bh, "_SYSTEM_BROWSER_CANDIDATES", ())
    assert bh._find_chromium_executable() is None


def test_find_chromium_system_fallback(monkeypatch, tmp_path):
    edge = tmp_path / "Microsoft" / "Edge" / "Application" / "msedge.exe"
    edge.parent.mkdir(parents=True)
    edge.write_text("x")
    monkeypatch.setenv("PROGRAMFILES", str(tmp_path))
    monkeypatch.setattr(
        bh,
        "_SYSTEM_BROWSER_CANDIDATES",
        (("PROGRAMFILES", r"Microsoft\Edge\Application\msedge.exe"),),
    )
    assert bh._find_chromium_executable() == str(edge)


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
    assert session._frame_handlers == []


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
    # 同一回调重复登记不重复收帧
    await session.start_screencast(h1)
    assert session._frame_handlers == [h1]
    # 第二个观众共用同一条截图循环
    await session.start_screencast(h2)
    assert session._screenshot_task is task1  # 未新建后台任务
    assert session._screencast_running is True
    assert session._frame_handlers == [h1, h2]
    await session.stop_screencast()


async def test_multiple_frame_handlers_receive_same_frame():
    page = FakePage(viewport={"width": 800, "height": 600})
    session = _make_session(page=page)
    got_first: list[tuple[str, dict]] = []
    got_pip: list[tuple[str, dict]] = []

    async def h_first(data, meta):
        got_first.append((data, meta))

    async def h_pip(data, meta):
        got_pip.append((data, meta))

    await session.start_screencast(h_first)
    await session.start_screencast(h_pip)
    for _ in range(200):
        if got_first and got_pip:
            break
        await asyncio.sleep(0.01)

    assert got_first, "主视图观众未收到帧"
    assert got_pip, "画中画观众未收到帧"
    assert got_first[0] == got_pip[0], "同一 tick 的帧应发给所有观众"

    # 一个观众离开,其余观众继续收帧
    await session.remove_frame_handler(h_first)
    assert session._screencast_running is True
    assert session._frame_handlers == [h_pip]
    count = len(got_pip)
    for _ in range(200):
        if len(got_pip) > count:
            break
        await asyncio.sleep(0.01)
    assert len(got_pip) > count, "移除一个观众后剩余观众断流"

    # 最后一个观众离开才停流
    await session.remove_frame_handler(h_pip)
    assert session._screencast_running is False
    assert session._frame_handlers == []


async def test_stop_screencast_no_task():
    session = _make_session()
    await session.stop_screencast()
    assert session._screenshot_task is None
    assert session._frame_handlers == []


async def test_remove_frame_handler_stops_screencast():
    session = _make_session()

    async def h(data, meta):
        pass

    await session.start_screencast(h)
    await session.remove_frame_handler(h)
    assert session._screencast_running is False
    assert session._frame_handlers == []


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


async def test_multiple_navigation_handlers_fire_once_each():
    """主面板 + 画中画同时登记导航:两者都收到,且同一次导航不重复广播。"""
    page = FakePage(url="https://a.com/")
    session = _make_session(page=page)
    first: list[tuple[str, str | None]] = []
    second: list[tuple[str, str | None]] = []
    done = asyncio.Event()

    async def on_nav_first(url, title):
        first.append((url, title))
        if first and second:
            done.set()

    async def on_nav_second(url, title):
        second.append((url, title))
        if first and second:
            done.set()

    await session.set_navigation_handler(on_nav_first)
    await session.set_navigation_handler(on_nav_second)
    # 第二个观众接入不应重复挂 page.on 监听
    assert len(page.on_handlers["framenavigated"]) == 1
    page.on_handlers["framenavigated"][0](page.main_frame)
    await asyncio.wait_for(done.wait(), 2)
    assert first == [("https://a.com/", None)]
    assert second == [("https://a.com/", None)]

    # 一个观众离开,另一个继续收
    await session.remove_navigation_handler(on_nav_first)
    trigger = asyncio.Event()

    async def _once_more(url, title):
        trigger.set()

    # 重新挂一个（模拟重连的观众）
    await session.set_navigation_handler(_once_more)
    page.on_handlers["framenavigated"][0](page.main_frame)
    await asyncio.wait_for(trigger.wait(), 2)
    assert len(second) == 2


async def test_set_navigation_handler_ignores_non_main_frame():
    page = FakePage(url="https://a.com/")
    session = _make_session(page=page)

    async def on_nav(url, title):
        raise AssertionError("非主 frame 不应触发导航回调")

    await session.set_navigation_handler(on_nav)
    page.on_handlers["framenavigated"][0](object())
    await asyncio.sleep(0.05)


async def test_set_phase_broadcasts_once_to_all_viewers():
    """人工节点状态:主面板 + 浮窗同时在线时,两边都收到同一次变更。"""
    session = _make_session(page=FakePage(url="https://a.com/"))
    first: list[dict] = []
    second: list[dict] = []

    async def on_phase_first(state):
        first.append(state)

    async def on_phase_second(state):
        second.append(state)

    await session.set_phase_handler(on_phase_first)
    await session.set_phase_handler(on_phase_second)
    # 登记时补发快照:晚连的观众立刻对上当前状态
    assert [s["phase"] for s in first] == ["running"]
    assert [s["phase"] for s in second] == ["running"]

    await session.set_phase("waiting", "login required")
    assert first[-1] == {"phase": "waiting", "reason": "login required"}
    assert second[-1] == {"phase": "waiting", "reason": "login required"}

    # 同值重复设置不重复广播(轮询式调用不会刷屏)
    await session.set_phase("waiting", "login required")
    assert len(first) == 2
    assert len(second) == 2

    await session.set_phase("running")
    assert first[-1]["phase"] == "running"


async def test_set_phase_normalizes_unknown_value():
    """非法状态不原样透传给前端,一律归 running。"""
    session = _make_session(page=FakePage(url="https://a.com/"))
    state = await session.set_phase("pause-ish")
    assert state == {"phase": "running", "reason": None}


async def test_set_phase_viewer_failure_does_not_block_others():
    """一个观众断开(发送抛错)时,其余观众仍要收到状态。"""
    session = _make_session(page=FakePage(url="https://a.com/"))
    good: list[dict] = []

    async def broken(state):
        raise RuntimeError("ws gone")

    async def on_phase_good(state):
        good.append(state)

    await session.set_phase_handler(broken)
    await session.set_phase_handler(on_phase_good)
    state = await session.set_phase("waiting", "captcha")
    assert state["phase"] == "waiting"
    assert good[-1]["phase"] == "waiting"


async def test_remove_phase_handler_stops_delivery():
    session = _make_session(page=FakePage(url="https://a.com/"))
    got: list[dict] = []

    async def on_phase(state):
        got.append(state)

    await session.set_phase_handler(on_phase)
    await session.remove_phase_handler(on_phase)
    await session.set_phase("waiting")
    assert [s["phase"] for s in got] == ["running"]


@pytest.mark.parametrize(
    ("url", "expected"),
    [
        ("https://accounts.example.com/login", True),
        ("https://example.com/sign-in?next=/x", True),
        ("https://login.example.com/", True),
        ("https://example.com/captcha", True),
        ("https://example.com/blog/how-to-login", False),
        ("https://example.com/article?tag=login", False),
        ("about:blank", False),
        ("", False),
    ],
)
def test_detect_human_gate(url, expected):
    """登录闸判据:按路径整段/主机前缀/query 键名,不做子串匹配。"""
    assert bh.detect_human_gate(url) is expected


async def test_navigation_gate_autosets_and_clears_phase():
    """导航到登录页 → 自动 gate;离开 → 自动收回 running。"""
    session = _make_session(page=FakePage(url="https://example.com/login"))
    states: list[dict] = []

    async def on_phase(state):
        states.append(state)

    await session.set_phase_handler(on_phase)
    await session._sync_gate_phase("https://example.com/login")
    assert states[-1] == {"phase": "gate", "reason": "login-or-captcha"}

    await session._sync_gate_phase("https://example.com/dashboard")
    assert states[-1]["phase"] == "running"


async def test_auto_gate_does_not_override_manual_waiting():
    """人工已经声明 waiting 时,自动判据不改口。"""
    session = _make_session(page=FakePage(url="https://example.com/login"))
    await session.set_phase("waiting", "agent paused for user")
    await session._sync_gate_phase("https://example.com/login")
    assert session._phase_state["phase"] == "waiting"


async def test_navigation_listener_marks_gate_automatically():
    """真实链路:page.on(framenavigated) → 自动判 gate,不需要任何观众。"""
    page = FakePage(url="https://example.com/login")
    session = _make_session(page=page)

    async def on_nav(url, title):
        pass

    await session.set_navigation_handler(on_nav)
    page.on_handlers["framenavigated"][0](page.main_frame)
    await asyncio.sleep(0.05)
    assert session._phase_state["phase"] == "gate"


async def test_notify_user_attention_targets_owner_only():
    """提问属于"人必须介入":按属主扇出,别家的会话不动。"""
    mine = _make_session(page=FakePage(url="https://a.com/"))
    mine.owner_user_id = "u-attn-1"
    other = _make_session(page=FakePage(url="https://b.com/"))
    other.owner_user_id = "u-other-1"

    hits = await bh.notify_user_attention("u-attn-1", "waiting", "agent-question")
    assert hits == 1
    assert mine._phase_state["phase"] == "waiting"
    assert other._phase_state["phase"] == "running"


async def test_ask_user_question_drives_browser_phase():
    """提问登记 → 浮窗 waiting;回答 → 收回 running(整条链路,不是单点)。"""
    session = _make_session(page=FakePage(url="https://a.com/"))
    session.owner_user_id = "u-attn-2"

    item = auq.create_question(
        session_id="chat-attn-2",
        user_id="u-attn-2",
        prompt="需要你登录一下",
        options=[{"id": "ok", "label": "好"}],
    )
    assert not isinstance(item, dict)
    await asyncio.sleep(0.05)
    assert session._phase_state["phase"] == "waiting"

    status, _item = auq.resolve_question(
        item.question_id,
        session_id="chat-attn-2",
        user_id="u-attn-2",
        selected_ids=["ok"],
    )
    assert status == auq.STATUS_ANSWERED
    await asyncio.sleep(0.05)
    assert session._phase_state["phase"] == "running"


async def test_cancel_session_questions_clears_browser_waiting():
    """会话中断也必须把浮窗从"等待人工"收回,不能留一个假等待。"""
    session = _make_session(page=FakePage(url="https://a.com/"))
    session.owner_user_id = "u-attn-3"

    item = auq.create_question(
        session_id="chat-attn-3",
        user_id="u-attn-3",
        prompt="需要你确认一下",
        options=[{"id": "ok", "label": "好"}],
    )
    assert not isinstance(item, dict)
    await asyncio.sleep(0.05)
    assert session._phase_state["phase"] == "waiting"

    affected = auq.cancel_session_questions("chat-attn-3")
    assert affected
    await asyncio.sleep(0.05)
    assert session._phase_state["phase"] == "running"


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
    asyncio.get_running_loop()
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


# ---------------------------------------------------------------------------
# 任务模板 / 检查点(2026-11-25)
# ---------------------------------------------------------------------------


def _task_payload() -> dict:
    return {
        "goal": "完成支付",
        "requirements": ["核对金额", "保留回执"],
        "checkpoints": [
            {"id": "checkout", "label": "进入结算页", "match": "checkout"},
            {"id": "pay", "label": "付款前确认", "match": "pay"},
        ],
    }


async def test_task_start_and_checkpoint_flow():
    session = _make_session(page=FakePage(url="https://a.com/"))
    snapshot = await session.start_task(_task_payload())
    assert snapshot["goal"] == "完成支付"
    assert snapshot["checkpoints"][0]["status"] == "pending"

    data = await session.enter_checkpoint("checkout")
    assert data["checkpoint"]["status"] == "active"
    assert session._phase_state["phase"] == "waiting"
    assert session._phase_state["reason"] == "checkpoint:进入结算页"

    # 提问答复/审批结算这类 manual running 不能替用户放过检查点
    await session.set_phase("running", None)
    assert session._phase_state["phase"] == "waiting"

    # 同一检查点重复进入幂等,不重复广播成新事件
    again = await session.enter_checkpoint("checkout")
    assert again["checkpoint"]["status"] == "active"

    await session.resume_checkpoint()
    assert session._phase_state["phase"] == "running"
    assert session._task["checkpoints"][0]["status"] == "done"


async def test_navigation_auto_enters_first_matching_checkpoint():
    session = _make_session(page=FakePage(url="https://a.com/"))
    await session.start_task(_task_payload())
    await session._sync_after_navigation("https://a.com/checkout/pay")
    assert session._phase_state["phase"] == "waiting"
    assert session._task["checkpoints"][0]["status"] == "active"

    # 已完成的不再触发;同一页面恢复后不重新弹
    await session.resume_checkpoint()
    await session._sync_after_navigation("https://a.com/checkout")
    assert session._task["checkpoints"][0]["status"] == "done"
    assert session._phase_state["phase"] == "running"


async def test_task_and_checkpoint_multi_viewer_snapshots():
    session = _make_session(page=FakePage(url="https://a.com/"))
    task_events: list[dict] = []
    checkpoint_events: list[dict] = []

    async def on_task(state):
        task_events.append(state)

    async def on_checkpoint(state):
        checkpoint_events.append(state)

    await session.set_task_handler(on_task)
    await session.set_checkpoint_handler(on_checkpoint)
    await session.start_task(_task_payload())
    assert task_events[-1]["task"]["goal"] == "完成支付"
    assert task_events[-1]["progress"] == {"done": 0, "total": 2}

    await session.enter_checkpoint("checkout")
    assert checkpoint_events[-1]["checkpoint"]["id"] == "checkout"
    assert checkpoint_events[-1]["progress"]["total"] == 2


async def test_checkpoint_waiting_times_out_without_auto_resume():
    """超时只广播 timed_out,phase 仍 waiting、检查点仍 active,必须人点继续。"""
    session = _make_session(page=FakePage(url="https://a.com/"))
    events: list[dict] = []

    async def on_checkpoint(state):
        events.append(state)

    await session.set_checkpoint_handler(on_checkpoint)
    await session.start_task(_task_payload())
    # 直接把任务上限压到 1.2 秒,验证会话层用的是任务自己的值,不是写死常量。
    session._task["checkpoint_timeout_seconds"] = 1.2
    await session.enter_checkpoint("checkout")
    assert events[-1]["checkpoint"]["timed_out"] is False
    assert session._phase_state["phase"] == "waiting"

    await asyncio.sleep(1.5)
    assert events[-1]["checkpoint"]["timed_out"] is True
    assert events[-1]["checkpoint"]["status"] == "active"
    assert session._phase_state["phase"] == "waiting"
    assert session._task["checkpoints"][0]["status"] == "active"

    await session.resume_checkpoint("checkout")
    assert session._task["checkpoints"][0]["status"] == "done"
    assert session._phase_state["phase"] == "running"


async def test_clear_task_and_close_reset_task_state():
    session = _make_session(page=FakePage(url="https://a.com/"))
    await session.start_task(_task_payload())
    await session.enter_checkpoint("checkout")
    await session.clear_task()
    assert session._task is None
    assert session._phase_state["phase"] == "running"
    assert (await session.task_state())["task"] is None

    await session.start_task(_task_payload())
    await session.close()
    assert session._task is None


async def test_attention_sources_are_stacked_until_all_clear():
    """提问与审批同时在等:先结束的一方不能把另一方顶回 running。"""
    session = _make_session(page=FakePage(url="https://a.com/"))
    session.owner_user_id = "u-attn-stack"

    await bh.set_user_attention("u-attn-stack", "agent-question", True)
    assert session._phase_state["phase"] == "waiting"
    assert session._phase_state["reason"] == "agent-question"

    await bh.set_user_attention("u-attn-stack", "tool-approval", True)
    assert session._phase_state["phase"] == "waiting"

    await bh.set_user_attention("u-attn-stack", "agent-question", False)
    assert session._phase_state["phase"] == "waiting"
    assert session._phase_state["reason"] == "tool-approval"

    await bh.set_user_attention("u-attn-stack", "tool-approval", False)
    assert session._phase_state["phase"] == "running"


async def test_attention_waiting_keeps_checkpoint_reason_and_restores_it():
    """检查点等待优先显示具体步骤;恢复后若审批仍在等,phase 仍是 waiting。"""
    session = _make_session(page=FakePage(url="https://a.com/"))
    session.owner_user_id = "u-attn-cp"
    await session.start_task(_task_payload())
    await session.enter_checkpoint("checkout")
    assert session._phase_state["reason"].startswith("checkpoint:")

    await bh.set_user_attention("u-attn-cp", "tool-approval", True)
    assert session._phase_state["phase"] == "waiting"
    assert session._phase_state["reason"].startswith("checkpoint:")

    await session.resume_checkpoint("checkout")
    assert session._phase_state["phase"] == "waiting"
    assert session._phase_state["reason"] == "tool-approval"

    await bh.set_user_attention("u-attn-cp", "tool-approval", False)
    assert session._phase_state["phase"] == "running"


async def test_checkpoint_validation_errors():
    session = _make_session(page=FakePage(url="https://a.com/"))
    with pytest.raises(auq_task.TaskValidationError) as exc:
        await session.enter_checkpoint("checkout")
    assert exc.value.code == "task_not_started"

    await session.start_task(_task_payload())
    with pytest.raises(auq_task.TaskValidationError) as exc2:
        await session.enter_checkpoint("ghost")
    assert exc2.value.code == "checkpoint_not_found"

    with pytest.raises(auq_task.TaskValidationError) as exc3:
        await session.resume_checkpoint()
    assert exc3.value.code == "checkpoint_not_active"
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
