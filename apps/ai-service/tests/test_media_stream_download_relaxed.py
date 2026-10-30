# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
"""GET /api/media/stream 与 /api/media/download 放宽测试(2026-10-30)。

2026-10-30 行为变更:两端点不再要求 url 命中 media_tasks 登记(与
/api/media/image 一致),只保留 _user_scope(401 未登录)+ _validate_url_ssrf
(封死内网/元数据)两道闸门。本测试验证:
  - 任意 SSRF 安全公网直链(如 https://example.com/x.mp4)→ 200;
  - stream 透传 content-type、download 带 attachment content-disposition;
  - SSRF 阻塞 URL(169.254.169.254 / localhost / 127.0.0.1)→ 400;
  - 未登录 → 401。

复用 test_media_image_proxy.py 的裸 FastAPI + httpx ASGITransport 模式;
端点直接调用 _user_scope(request)(非 Depends),故经 monkeypatch
media_tasks 模块命名空间的 _user_scope 实现放行;httpx.AsyncClient 也替换为
不触网的 fake。
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
    def __init__(self, body: bytes, content_type: str, content_length: int | None = None):
        self.status_code = 200
        self._body = body
        headers = {"content-type": content_type}
        if content_length is not None:
            headers["content-length"] = str(content_length)
        self.headers = headers

    async def aiter_bytes(self, chunk_size: int = 65536):
        yield self._body

    async def aclose(self):
        return None


class _FakeClient:
    def __init__(self, *args, **kwargs):
        # 默认 mp4 小体量;download/stream 都吃这一份。
        self._body = b"\x00\x00\x00\x18ftypmp42 fake mp4 bytes"
        self._content_type = "video/mp4"

    def build_request(self, method, url, headers=None):
        return {"method": method, "url": url, "headers": headers or {}}

    async def send(self, request, stream: bool = False):
        return _FakeResponse(self._body, self._content_type, content_length=len(self._body))

    async def aclose(self):
        return None


# ---------------------------------------------------------------------------
# 鉴权:未登录 → 401(_user_scope 在 request.state.user_id 缺失时抛 401)
# ---------------------------------------------------------------------------


async def test_stream_requires_auth():
    """不带 _user_scope 覆盖 → 真实函数因 request.state.user_id 缺失自然 401。"""
    app = _make_app()
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        resp = await ac.get("/api/media/stream", params={"url": "https://example.com/x.mp4"})
    assert resp.status_code == 401


async def test_download_requires_auth():
    """不带 _user_scope 覆盖 → 真实函数因 request.state.user_id 缺失自然 401。"""
    app = _make_app()
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        resp = await ac.get("/api/media/download", params={"url": "https://example.com/x.mp4"})
    assert resp.status_code == 401


# ---------------------------------------------------------------------------
# SSRF 闸门:私有/元数据/环回 IP 必须被拒(400)
# ---------------------------------------------------------------------------


@pytest.mark.parametrize(
    "bad_url",
    [
        "http://169.254.169.254/latest",
        "http://localhost/x.mp4",
        "http://127.0.0.1/x.mp4",
    ],
)
async def test_stream_ssrf_blocked(monkeypatch, bad_url):
    """SSRF 闸门:阻塞 URL → 400,且不再尝试查库/触网。"""
    monkeypatch.setattr(mt_router, "_user_scope", lambda request: ("u1", True))
    # 若 SSRF 没拦住会落到真实 httpx;用 fake 顶上以防真实触网,但本用例应已 400 早退。
    monkeypatch.setattr(mt_router.httpx, "AsyncClient", _FakeClient)
    app = _make_app()
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        resp = await ac.get("/api/media/stream", params={"url": bad_url})
    assert resp.status_code == 400
    assert "不允许访问" in resp.json()["detail"]


@pytest.mark.parametrize(
    "bad_url",
    [
        "http://169.254.169.254/latest",
        "http://localhost/x.mp4",
        "http://127.0.0.1/x.mp4",
    ],
)
async def test_download_ssrf_blocked(monkeypatch, bad_url):
    """SSRF 闸门:阻塞 URL → 400,且不再尝试查库/触网。"""
    monkeypatch.setattr(mt_router, "_user_scope", lambda request: ("u1", True))
    monkeypatch.setattr(mt_router.httpx, "AsyncClient", _FakeClient)
    app = _make_app()
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        resp = await ac.get("/api/media/download", params={"url": bad_url})
    assert resp.status_code == 400
    assert "不允许访问" in resp.json()["detail"]


# ---------------------------------------------------------------------------
# 行为变更核心:任意 SSRF 安全公网直链 → 200(不再 404 未登记)
# ---------------------------------------------------------------------------


async def test_stream_public_url_ok(monkeypatch):
    """放宽后:未登记的 https://example.com/x.mp4 也应 200,且透传 content-type。"""
    monkeypatch.setattr(mt_router, "_user_scope", lambda request: ("u1", True))
    monkeypatch.setattr(mt_router.httpx, "AsyncClient", _FakeClient)
    app = _make_app()
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        resp = await ac.get("/api/media/stream", params={"url": "https://example.com/x.mp4"})
    assert resp.status_code == 200
    assert resp.content == b"\x00\x00\x00\x18ftypmp42 fake mp4 bytes"
    assert resp.headers["content-type"] == "video/mp4"
    # stream 不应带 attachment(内联播放)
    assert "attachment" not in (resp.headers.get("content-disposition", ""))


async def test_stream_public_url_passthrough_range(monkeypatch):
    """透传浏览器 Range 到源站(本 fake 忽略 range,仅验证端点不报错、200)。"""
    monkeypatch.setattr(mt_router, "_user_scope", lambda request: ("u1", True))
    monkeypatch.setattr(mt_router.httpx, "AsyncClient", _FakeClient)
    app = _make_app()
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        resp = await ac.get(
            "/api/media/stream",
            params={"url": "https://example.com/x.mp4"},
            headers={"range": "bytes=0-100"},
        )
    assert resp.status_code == 200
    assert resp.content == b"\x00\x00\x00\x18ftypmp42 fake mp4 bytes"


async def test_download_public_url_ok(monkeypatch):
    """放宽后:未登记的 https://example.com/x.mp4 也应 200 且带 attachment。"""
    monkeypatch.setattr(mt_router, "_user_scope", lambda request: ("u1", True))
    monkeypatch.setattr(mt_router.httpx, "AsyncClient", _FakeClient)
    app = _make_app()
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        resp = await ac.get("/api/media/download", params={"url": "https://example.com/x.mp4"})
    assert resp.status_code == 200
    assert resp.content == b"\x00\x00\x00\x18ftypmp42 fake mp4 bytes"
    # 下载必须带 Content-Disposition: attachment
    cd = resp.headers.get("content-disposition", "")
    assert "attachment" in cd
    # 文件按 URL 末段命名(x.mp4 带扩展名则保留;无扩展名回退 ihui-media.bin)
    assert "x.mp4" in cd or "ihui-media" in cd
