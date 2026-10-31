# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""安全强化第 29 批:browser/render 的 SSRF 收口。

缺陷(现读):
  `POST /api/browser/render` 只判 `url.startswith(("http://", "https://"))`,随后
  Playwright 直接 `page.goto(url)` —— 服务把目标页面 HTML 原样回传,等于一个带浏览器
  语义的 HTTP 客户端。`http://169.254.169.254/latest/meta-data/`、`http://127.0.0.1:6379/`
  这类内网/云元数据目标可被读走;服务端 302 到内网、页面 img/fetch 指向内网同样可达
  (Playwright 自行跟随重定向、加载子资源)。

修法(两道,缺一不可):
  ① 路由层:初始 URL 过 `screenshot_service._validate_url_ssrf`(与 media 代理同一把尺,
     不另立判据),内网/保留地址/非 80·443 端口直接 code=1,不进浏览器;
  ② service 层:`context.route("**/*", _guard_request)` 对**每个**请求(重定向 + 子资源
     + XHR)重过同一把尺,不过则 abort;data:/blob:/about: 不联网,放行。

用例:
  A 初始 URL:回环 / IPv6 回环 / 云元数据 / 私网端口 ⇒ 拒绝,且 render_page 未被调用。
  B 路由对公网放行(render_page 被调用一次;stub 掉真实渲染)。
  C route 闸:私网 ⇒ abort;data: ⇒ continue;公网 ⇒ continue。
  D 接线锁:`_render_page_locked` 源码必须含 context.route(摘掉即红)。
"""

from __future__ import annotations

import inspect
from types import SimpleNamespace
from typing import Any

import pytest

from app.routers import browser_render as render_router
from app.services import browser_render as render_service
from app.services.screenshot_service import _validate_url_ssrf


class _FakeRoute:
    def __init__(self, url: str) -> None:
        self.request = SimpleNamespace(url=url)
        self.action: str | None = None

    def abort(self) -> None:
        self.action = "abort"

    def continue_(self) -> None:
        self.action = "continue"


# ---------------------------------------------------------------------------
# A:初始 URL 判据(真实 _validate_url_ssrf,IP 直判不依赖 DNS)
# ---------------------------------------------------------------------------


@pytest.mark.parametrize(
    "url",
    [
        "http://127.0.0.1/admin",
        "http://169.254.169.254/latest/meta-data/",
        "http://10.0.0.5:8080/",
        "http://[::1]/",
    ],
)
def test_private_targets_rejected(url: str):
    ok, _reason = _validate_url_ssrf(url)
    assert ok is False


@pytest.mark.parametrize(
    "url",
    [
        "http://127.0.0.1/admin",
        "http://169.254.169.254/latest/meta-data/",
    ],
)
async def test_route_rejects_private_url_before_render(monkeypatch, url: str):
    called: list[str] = []

    async def _fake_render(target: str, timeout_ms: int = 30000) -> dict[str, Any]:
        called.append(target)
        return {}

    monkeypatch.setattr(render_router, "render_page", _fake_render)
    resp = await render_router.browser_render(render_router.BrowserRenderRequest(url=url))
    assert resp["code"] == 1
    assert "不允许访问" in resp["message"]
    assert called == [], "内网目标不得进入浏览器"


# ---------------------------------------------------------------------------
# B:公网放行
# ---------------------------------------------------------------------------


async def test_route_allows_public_url(monkeypatch):
    called: list[str] = []

    async def _fake_render(target: str, timeout_ms: int = 30000) -> dict[str, Any]:
        called.append(target)
        return {"url": target}

    monkeypatch.setattr(render_router, "render_page", _fake_render)
    # 用 example.com 走真实判据会做 DNS 解析(CI 可能无网)⇒ 只替换判据,保持放行语义
    monkeypatch.setattr(render_router, "_validate_url_ssrf", lambda _u: (True, ""))
    resp = await render_router.browser_render(
        render_router.BrowserRenderRequest(url="https://example.com/")
    )
    assert resp["code"] == 0
    assert called == ["https://example.com/"]


# ---------------------------------------------------------------------------
# C:route 闸(重定向与子资源)
# ---------------------------------------------------------------------------


def test_guard_aborts_private_request():
    route = _FakeRoute("http://127.0.0.1:6379/")
    render_service._guard_request(route)
    assert route.action == "abort"


def test_guard_allows_non_network_scheme():
    route = _FakeRoute("data:text/html,<h1>x</h1>")
    render_service._guard_request(route)
    assert route.action == "continue"


def test_guard_allows_public_request(monkeypatch):
    monkeypatch.setattr(render_service, "_validate_url_ssrf", lambda _u: (True, ""))
    route = _FakeRoute("https://cdn.example.com/app.js")
    render_service._guard_request(route)
    assert route.action == "continue"


# ---------------------------------------------------------------------------
# D:接线锁
# ---------------------------------------------------------------------------


def test_render_context_installs_route_guard():
    src = inspect.getsource(render_service._render_page_locked)
    assert 'context.route("**/*", _guard_request)' in src
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
