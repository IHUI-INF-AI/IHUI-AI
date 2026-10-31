# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""GET /api/media/image 同源图片代理的 SSRF 闸门 + 鉴权 + 内联转发(2026-10-30)。

复用 test_media_tasks.py 的裸 FastAPI(app.routers.media_tasks.router,前缀 /api)+
httpx ASGITransport 客户端模式。端点直接调用 _user_scope(request)(非 Depends),
故鉴权/放行通过 monkeypatch media_tasks 模块命名空间的 _user_scope 实现。
"""
from __future__ import annotations

import pytest
from fastapi import FastAPI
from httpx import ASGITransport, AsyncClient

from app.routers import media_tasks as mt_router

pytestmark = pytest.mark.asyncio


def _make_app() -> FastAPI:
    """裸 FastAPI(无 JWT 中间件),与 test_media_tasks.py 同模式。"""
    app = FastAPI()
    app.include_router(mt_router.router, prefix="/api")
    return app


# ---------------------------------------------------------------------------
# 最小自包含 fake httpx 客户端:供 happy path 替代真实源站请求
# ---------------------------------------------------------------------------


class _FakeResponse:
    def __init__(self, body: bytes, content_type: str):
        self.status_code = 200
        self._body = body
        self.headers = {"content-type": content_type}
        # 手动逐跳辅助(media_tasks._send_following_redirects)会读 is_redirect;
        # 假响应必须与 httpx.Response 的契约同形,否则测的是 AttributeError 不是业务。
        self.is_redirect = False

    async def aiter_bytes(self, chunk_size: int = 65536):
        yield self._body

    async def aclose(self):
        return None


class _FakeClient:
    def __init__(self, *args, **kwargs):
        self._body = b"\x89PNG\r\n\x1a\n fake png bytes"
        self._content_type = "image/png"

    def build_request(self, method, url, headers=None):
        return {"method": method, "url": url}

    async def send(self, request, stream: bool = False):
        return _FakeResponse(self._body, self._content_type)

    async def aclose(self):
        return None


# ---------------------------------------------------------------------------
# 鉴权:未登录 → 401(_user_scope 在 request.state.user_id 缺失时抛 401)
# ---------------------------------------------------------------------------


async def test_image_proxy_requires_auth(monkeypatch):
    """不带 _user_scope 覆盖 → 真实函数因 request.state.user_id 缺失自然 401。"""
    app = _make_app()
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        resp = await ac.get(
            "/api/media/image", params={"url": "https://example.com/x.png"}
        )
    assert resp.status_code == 401


# ---------------------------------------------------------------------------
# SSRF 闸门:私有/元数据 IP 必须被拒
# ---------------------------------------------------------------------------


async def test_image_proxy_ssrf_blocked(monkeypatch):
    """SSRF 闸门:169.254.169.254(云元数据)禁止访问 → 400。"""
    monkeypatch.setattr(mt_router, "_user_scope", lambda request: ("u1", True))
    app = _make_app()
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        resp = await ac.get(
            "/api/media/image", params={"url": "http://169.254.169.254/latest"}
        )
    assert resp.status_code == 400
    assert "不允许访问" in resp.json()["detail"]


# ---------------------------------------------------------------------------
# happy path:任意 SSRF 安全公网直链 → 200 + 透传 content-type + body
# ---------------------------------------------------------------------------


async def test_image_proxy_happy_path(monkeypatch):
    """正常直链:httpx 被替换为 fake,返回 200、body 与 content-type 透传。"""
    monkeypatch.setattr(mt_router, "_user_scope", lambda request: ("u1", True))
    # 端点构造 httpx.AsyncClient(...) → 改用 fake(不触网、不碰库)
    monkeypatch.setattr(mt_router.httpx, "AsyncClient", _FakeClient)
    app = _make_app()
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        resp = await ac.get(
            "/api/media/image", params={"url": "https://example.com/x.png"}
        )
    assert resp.status_code == 200
    assert resp.content == b"\x89PNG\r\n\x1a\n fake png bytes"
    assert resp.headers["content-type"] == "image/png"
    # 内联显示:不强制下载,且带私有缓存头
    assert "attachment" not in (resp.headers.get("content-disposition", ""))
    assert "max-age=3600" in resp.headers.get("cache-control", "")
