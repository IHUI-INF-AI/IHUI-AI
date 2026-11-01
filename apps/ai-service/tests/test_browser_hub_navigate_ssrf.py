# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

"""Browser Hub 导航的 SSRF 闸(2026-11-01 安全强化,高危)。

原缺陷:`NavigateRequest.url` / `create_session(url=...)` 都是裸 str,`page.goto` 直接
发请求 ⇒ 任意登录用户可让服务端 Chromium 访问云元数据(169.254.169.254)、内网管理面,
再用 `/screenshot` 或 title/url 读回,也能靠报错做端口探测。

判据复用 `screenshot_service._validate_url_ssrf`(与 fetch_url 同一把尺子)。
本文件钉:入口拒绝 + 被拒时不产生任何 page 操作 + 重定向逐跳复检(route 层已装)。
"""

from __future__ import annotations

import asyncio
from types import SimpleNamespace
from typing import Any

import pytest
from fastapi import HTTPException

from app.routers import browser_hub as br
from app.services import browser_hub as bh
from app.services.browser_hub import BrowserHub, BrowserSession


# ---------------------------------------------------------------------------
# 替身
# ---------------------------------------------------------------------------


class _Page:
    """只记录 goto/route 调用;被 SSRF 闸拦下时不得有任何 goto 发生。"""

    def __init__(self) -> None:
        self.url = ""
        self.goto_calls: list[str] = []
        self.route_handlers: list[tuple[str, Any]] = []

    def route(self, pattern: str, handler: Any) -> None:
        self.route_handlers.append((pattern, handler))

    def goto(self, url: str, wait_until: str = "domcontentloaded", timeout: int = 30000):
        self.goto_calls.append(url)
        return SimpleNamespace(status=200)

    def title(self) -> str:
        return "t"


class _Context:
    def __init__(self, page: _Page) -> None:
        self._page = page
        self.closed = False

    def new_page(self) -> _Page:
        return self._page

    def add_init_script(self, _script: str) -> None:
        return None

    def close(self) -> None:
        self.closed = True


class _Browser:
    def __init__(self, page: _Page) -> None:
        self._page = page
        self.contexts: list[_Context] = []

    def new_context(self, **_kwargs: Any) -> _Context:
        ctx = _Context(self._page)
        self.contexts.append(ctx)
        return ctx

    def is_connected(self) -> bool:
        return True


def _session(page: _Page | None = None) -> BrowserSession:
    page = page or _Page()
    return BrowserSession("s1", _Context(page), page, None, asyncio.get_running_loop())


# ---------------------------------------------------------------------------
# 1. 判据本身:入口 URL 的拒绝面
# ---------------------------------------------------------------------------


@pytest.mark.parametrize(
    "url",
    [
        "http://169.254.169.254/latest/meta-data/",  # 云元数据
        "http://127.0.0.1:8803/api/internal/relay",  # 回环 + 本服务端口
        "http://[::1]:8802/api",                     # IPv6 回环
        "file:///etc/passwd",                        # 非 http(s)
        "http://10.0.0.5/admin",                     # RFC1918
        "http://192.168.1.1/",                       # RFC1918
    ],
)
def test_gate_rejects_metadata_loopback_and_internal(url: str) -> None:
    ok, reason = bh._validate_browser_navigate_url(url)
    assert ok is False
    assert reason


def test_gate_rejects_own_service_port_range() -> None:
    """8800-8810 是本机服务段(8801 在共享判据的端口白名单里,这条是本面额外的收紧)。"""
    ok, reason = bh._validate_browser_navigate_url("http://93.184.216.34:8801/")
    assert ok is False
    assert "8800" in reason or "端口" in reason


def test_gate_allows_public_https_literal() -> None:
    """正向对照:公网 IP + 443 照常放行(闸不是"一律拒")。"""
    ok, reason = bh._validate_browser_navigate_url("https://93.184.216.34/")
    assert ok is True, reason


# ---------------------------------------------------------------------------
# 2. navigate:被拒时"一个请求都不发"(副作用断言)
# ---------------------------------------------------------------------------


async def test_navigate_blocks_before_touching_the_page() -> None:
    page = _Page()
    session = _session(page)

    result = await session.navigate("http://169.254.169.254/latest/meta-data/")

    assert result["errorCode"] == "SSRF_BLOCKED"
    assert page.goto_calls == [], "被 SSRF 闸拒绝的导航不得产生任何网络请求"


async def test_navigate_still_navigates_public_url() -> None:
    """正向对照:合法 URL 照常 goto(证明上面是闸在拦,不是 navigate 坏了)。"""
    page = _Page()
    session = _session(page)
    await session.navigate("https://93.184.216.34/")
    assert page.goto_calls == ["https://93.184.216.34/"]


# ---------------------------------------------------------------------------
# 3. 路由层:被拒 ⇒ 400 具名拒因(不再以 code=0 成功返回)
# ---------------------------------------------------------------------------


class _Hub:
    def __init__(self, session: BrowserSession) -> None:
        self._session = session

    def require_tab(self, _scope: Any) -> BrowserSession:
        return self._session


async def test_router_navigate_returns_400_on_ssrf_block(monkeypatch: pytest.MonkeyPatch) -> None:
    page = _Page()
    monkeypatch.setattr(br, "hub", _Hub(_session(page)))
    body = br.NavigateRequest(url="http://169.254.169.254/latest/meta-data/")

    with pytest.raises(HTTPException) as exc:
        await br.navigate("tab-1", body, user_id="u-1")

    assert exc.value.status_code == 400
    assert "SSRF_BLOCKED" in str(exc.value.detail)
    assert page.goto_calls == []


async def test_create_session_rejects_blocked_url_before_building() -> None:
    """create_session(url=...) 与 navigate 同闸(创建即导航,等价入口)。"""
    hub = BrowserHub()
    hub._started = True
    hub._browser = _Browser(_Page())

    with pytest.raises(ValueError) as exc:
        await hub.create_session(url="http://169.254.169.254/")

    assert "不允许访问" in str(exc.value)
    assert hub._browser.contexts == [], "被拒的 URL 不得建出 BrowserContext"


# ---------------------------------------------------------------------------
# 4. 重定向逐跳复检:route 层必须真的装上并复跑同一把尺子
# ---------------------------------------------------------------------------


async def test_build_session_installs_per_request_ssrf_route() -> None:
    page = _Page()
    hub = BrowserHub()
    hub._started = True
    hub._browser = _Browser(page)
    hub._main_loop = asyncio.get_running_loop()

    await hub._build_session(
        url=None,
        session_id="s-route",
        viewport={"width": 800, "height": 600},
        user_agent="ua",
    )

    assert page.route_handlers, "page.goto 会自己跟 302,入口校验挡不住第二跳"
    assert page.route_handlers[0][0] == "**/*"
    assert page.route_handlers[0][1] is bh._ssrf_route_filter


class _Route:
    def __init__(self, url: str) -> None:
        self.request = SimpleNamespace(url=url)
        self.aborted = False
        self.continued = False

    def abort(self) -> None:
        self.aborted = True

    def continue_(self) -> None:
        self.continued = True


def test_route_filter_aborts_blocked_hop_and_continues_public_hop() -> None:
    blocked = _Route("http://169.254.169.254/latest/meta-data/")
    bh._ssrf_route_filter(blocked)
    assert blocked.aborted is True and blocked.continued is False

    allowed = _Route("https://93.184.216.34/")
    bh._ssrf_route_filter(allowed)
    assert allowed.continued is True and allowed.aborted is False
