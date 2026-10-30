# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""同源媒体代理的内容类型白名单 + 响应头加固(2026-10-30,修实测确认的同源 XSS)。

背景(修前实测):
    GET /api/media/image?url=https://example.com/
    → 200 + `content-type: text/html; charset=utf-8`,无 nosniff、无 CSP
浏览器直接导航该同源 URL 即把攻击者 HTML 当文档渲染并执行脚本 = 同源 XSS。
/API/media/stream 同型。

修法三道防线:
  ① content-type 白名单,非白名单 415;
  ② 显式拒绝 image/svg+xml(可内嵌脚本);
  ③ 一律 X-Content-Type-Options: nosniff + CSP "default-src 'none'; sandbox"。

复用 test_media_image_proxy.py 的裸 FastAPI + ASGITransport + fake httpx 模式。
"""
from __future__ import annotations

import pytest
from fastapi import FastAPI
from httpx import ASGITransport, AsyncClient

from app.routers import media_tasks as mt_router

pytestmark = pytest.mark.asyncio


def _make_app() -> FastAPI:
    app = FastAPI()
    app.include_router(mt_router.router, prefix="/api")
    return app


class _FakeResponse:
    """可定制 content-type / 状态码 / Range 头的 fake 源站响应。"""

    def __init__(self, body: bytes, content_type: str | None, status: int = 200, extra: dict | None = None):
        self.status_code = status
        self._body = body
        headers: dict[str, str] = {}
        if content_type is not None:
            headers["content-type"] = content_type
        if extra:
            headers.update(extra)
        self.headers = headers

    async def aiter_bytes(self, chunk_size: int = 65536):
        yield self._body

    async def aclose(self):
        return None


class _FakeClient:
    """类级变量控制下一次响应,便于参数化不同 content-type。"""

    content_type: str | None = "image/png"
    status: int = 200
    extra_headers: dict | None = None
    body: bytes = b"\x89PNG\r\n\x1a\nfake"

    def __init__(self, *args, **kwargs):
        pass

    def build_request(self, method, url, headers=None):
        return {"method": method, "url": url, "headers": headers or {}}

    async def send(self, request, stream: bool = False):
        return _FakeResponse(
            type(self).body, type(self).content_type, type(self).status, type(self).extra_headers
        )

    async def aclose(self):
        return None


@pytest.fixture
def authed(monkeypatch):
    """鉴权放行 + 用 fake httpx 替换真实客户端。"""
    monkeypatch.setattr(mt_router, "_user_scope", lambda request: ("u1", True))
    monkeypatch.setattr(mt_router.httpx, "AsyncClient", _FakeClient)
    _FakeClient.content_type = "image/png"
    _FakeClient.status = 200
    _FakeClient.extra_headers = None
    _FakeClient.body = b"\x89PNG\r\n\x1a\nfake"
    return _FakeClient


# ---------------------------------------------------------------------------
# ① 图片代理:可渲染/可执行类型必须 415(核心漏洞的回归锁)
# ---------------------------------------------------------------------------


@pytest.mark.parametrize(
    "ctype",
    [
        "text/html; charset=utf-8",   # 修前实测可 200 返回,直接同源 XSS
        "application/xhtml+xml",
        "image/svg+xml",              # SVG 可内嵌 <script>
        "text/plain",
        "application/javascript",
        "text/xml",
        None,                          # 源站未声明类型 → 也不放行
    ],
)
async def test_image_proxy_rejects_renderable_types(authed, ctype):
    authed.content_type = ctype
    app = _make_app()
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        resp = await ac.get("/api/media/image", params={"url": "https://example.com/x.html"})
    assert resp.status_code == 415, f"{ctype!r} 应被拒(否则同源 XSS)"
    assert "同源 XSS" in resp.json()["detail"]


@pytest.mark.parametrize(
    "ctype",
    ["image/png", "image/jpeg", "image/gif", "image/webp", "image/avif", "image/x-icon"],
)
async def test_image_proxy_allows_safe_image_types(authed, ctype):
    authed.content_type = ctype
    app = _make_app()
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        resp = await ac.get("/api/media/image", params={"url": "https://example.com/a.png"})
    assert resp.status_code == 200
    assert resp.headers["content-type"].split(";")[0].strip() == ctype


async def test_image_proxy_strips_content_type_parameters(authed):
    """`image/png; charset=binary` 这类带参数的值要取主值后再比对/返回。"""
    authed.content_type = "image/png; charset=binary"
    app = _make_app()
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        resp = await ac.get("/api/media/image", params={"url": "https://example.com/a.png"})
    assert resp.status_code == 200
    assert resp.headers["content-type"] == "image/png"


# ---------------------------------------------------------------------------
# ③ 响应头加固:成功的响应也必须带 nosniff + CSP sandbox
# ---------------------------------------------------------------------------


async def test_image_proxy_sets_hardening_headers(authed):
    authed.content_type = "image/png"
    app = _make_app()
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        resp = await ac.get("/api/media/image", params={"url": "https://example.com/a.png"})
    assert resp.status_code == 200
    assert resp.headers["x-content-type-options"] == "nosniff"
    csp = resp.headers["content-security-policy"]
    assert "default-src 'none'" in csp
    assert "sandbox" in csp


# ---------------------------------------------------------------------------
# stream 端点:同样的类型闸门 + 加固头,且 Range 206 仍要工作
# ---------------------------------------------------------------------------


@pytest.mark.parametrize(
    "ctype",
    ["text/html; charset=utf-8", "image/svg+xml", "application/json", "text/plain", None],
)
async def test_stream_proxy_rejects_non_media_types(authed, ctype):
    authed.content_type = ctype
    app = _make_app()
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        resp = await ac.get("/api/media/stream", params={"url": "https://example.com/x.html"})
    assert resp.status_code == 415, f"{ctype!r} 应被拒(否则同源 XSS)"


@pytest.mark.parametrize(
    "ctype",
    ["video/mp4", "video/webm", "audio/mpeg", "audio/wav", "application/octet-stream"],
)
async def test_stream_proxy_allows_media_types(authed, ctype):
    authed.content_type = ctype
    app = _make_app()
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        resp = await ac.get("/api/media/stream", params={"url": "https://example.com/a.mp4"})
    assert resp.status_code == 200
    assert resp.headers["x-content-type-options"] == "nosniff"
    assert "sandbox" in resp.headers["content-security-policy"]


async def test_stream_proxy_preserves_range_206_and_headers(authed):
    """Range 透传不能被加固改动破坏:206 + Content-Range 原样回传。"""
    authed.content_type = "video/mp4"
    authed.status = 206
    authed.extra_headers = {
        "content-range": "bytes 0-1023/1260890",
        "accept-ranges": "bytes",
        "content-length": "1024",
    }
    app = _make_app()
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        resp = await ac.get(
            "/api/media/stream",
            params={"url": "https://example.com/a.mp4"},
            headers={"range": "bytes=0-1023"},
        )
    assert resp.status_code == 206
    assert resp.headers["content-range"] == "bytes 0-1023/1260890"
    assert resp.headers["accept-ranges"] == "bytes"
    assert resp.headers["x-content-type-options"] == "nosniff"


# ---------------------------------------------------------------------------
# download 端点:attachment 之外再加 nosniff/CSP 纵深防御
# ---------------------------------------------------------------------------


async def test_download_proxy_sets_hardening_headers(authed):
    authed.content_type = "video/mp4"
    app = _make_app()
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        resp = await ac.get("/api/media/download", params={"url": "https://example.com/a.mp4"})
    assert resp.status_code == 200
    assert "attachment" in resp.headers["content-disposition"]
    assert resp.headers["x-content-type-options"] == "nosniff"
    assert "sandbox" in resp.headers["content-security-policy"]


# ---------------------------------------------------------------------------
# SSRF 闸门在三个端点都仍然生效(放宽 URL 登记后不能把内网也放开)
# ---------------------------------------------------------------------------


@pytest.mark.parametrize(
    ("path", "url"),
    [
        ("/api/media/image", "http://169.254.169.254/latest"),
        ("/api/media/stream", "http://127.0.0.1/x.mp4"),
        ("/api/media/download", "http://localhost/x.mp4"),
        ("/api/media/image", "file:///etc/passwd"),
    ],
)
async def test_all_proxies_still_block_ssrf(authed, path, url):
    app = _make_app()
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        resp = await ac.get(path, params={"url": url})
    assert resp.status_code == 400


# ---------------------------------------------------------------------------
# 压缩响应不得透传 content-length(httpx 自动解压 ⇒ 上游长度是压缩后长度)
# 实测:httpbin/gzip header=198 bytes,解压后 252 bytes;透传长度会让浏览器截断/挂起
# ---------------------------------------------------------------------------


async def test_compressed_response_does_not_leak_content_length(authed):
    """上游声明 gzip 且给了压缩后的 content-length → 绝不透传该长度。"""
    authed.content_type = "image/png"
    authed.extra_headers = {"content-encoding": "gzip", "content-length": "198"}
    app = _make_app()
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        resp = await ac.get("/api/media/image", params={"url": "https://example.com/a.png"})
    assert resp.status_code == 200
    # 不透传:k 要么缺失,要么与实际体长一致(绝不等于谎报的 198)
    assert resp.headers.get("content-length") != "198"


async def test_identity_encoding_keeps_content_length(authed):
    """未压缩(或显式 identity)时仍应正常透传长度。"""
    authed.content_type = "image/png"
    authed.body = b"\x89PNG" + b"x" * 100
    authed.extra_headers = {"content-length": str(len(authed.body))}
    app = _make_app()
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        resp = await ac.get("/api/media/image", params={"url": "https://example.com/a.png"})
    assert resp.status_code == 200
    assert resp.headers["content-length"] == str(len(authed.body))
    assert len(resp.content) == len(authed.body)


async def test_stream_compressed_does_not_leak_content_length(authed):
    authed.content_type = "video/mp4"
    authed.extra_headers = {"content-encoding": "br", "content-length": "999"}
    app = _make_app()
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        resp = await ac.get("/api/media/stream", params={"url": "https://example.com/a.mp4"})
    assert resp.status_code == 200
    assert resp.headers.get("content-length") != "999"


async def test_upstream_client_requests_identity_encoding():
    """三个端点都必须以 accept-encoding: identity 请求上游(防自动解压错配)。"""
    assert mt_router._UPSTREAM_NO_COMPRESSION == {"accept-encoding": "identity"}
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
