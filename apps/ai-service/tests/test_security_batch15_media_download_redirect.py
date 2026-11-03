# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""安全强化第 15 批:图片下载的重定向 SSRF 收口(2026-10-31)。

现读缺陷(回源确认):
  - `services/vision_helper.download_image`:`follow_redirects=True` + 零校验 ⇒ 公网页
    302 → `http://169.254.169.254/` 即整条 SSRF,取回内容还会被编码成 data URI 交给多模态
    模型(等于把内网内容读回来)。
  - `services/publish/image_uploader.download_image`:只有首跳 `_assert_safe_image_url`,
    仍是 `follow_redirects=True` ⇒ 同型绕过。

修法:两条腿都改手动逐跳,每跳复检同一份 SSRF 判据,中间跳响应即时关闭。

用例:
  A vision_helper:302 → 169.254.169.254 ⇒ 抛错,且**内网地址一次都没被请求**。
  B vision_helper:302 → 安全地址 ⇒ 正常返回,跳数正确。
  C image_uploader:302 → 内网 ⇒ 返回 None,内网零请求。
  D image_uploader:跳到内网与非图片两种坏落点都拒绝。
"""

from __future__ import annotations

from typing import Any
from unittest.mock import patch

import httpx

from app.services import vision_helper
from app.services.publish import image_uploader


class _Resp:
    def __init__(self, status: int, headers: dict[str, str] | None = None, body: bytes = b"") -> None:
        self.status_code = status
        self.headers = headers or {}
        self.content = body
        self.url = httpx.URL("https://public.example/a.png")

    @property
    def is_redirect(self) -> bool:
        return 300 <= self.status_code < 400

    def raise_for_status(self) -> None:
        if self.status_code >= 400:
            raise httpx.HTTPStatusError("boom", request=None, response=None)  # type: ignore[arg-type]

    async def aclose(self) -> None:
        return None


class _Client:
    """按 URL 前缀返回预设响应,并记录所有被真正请求的 URL。"""

    def __init__(self, routes: dict[str, _Resp], seen: list[str]) -> None:
        self._routes = routes
        self._seen = seen

    def __call__(self, *args: Any, **kwargs: Any) -> _Client:
        return self

    async def __aenter__(self) -> _Client:
        return self

    async def __aexit__(self, *exc: Any) -> bool:
        return False

    def build_request(self, method: str, url: str, headers: Any = None) -> Any:
        return {"method": method, "url": url, "headers": headers or {}}

    async def send(self, request: Any, **kwargs: Any) -> _Resp:
        url = request["url"] if isinstance(request, dict) else str(request)
        self._seen.append(url)
        for prefix, resp in self._routes.items():
            if url.startswith(prefix):
                return resp
        raise AssertionError(f"未预设的 URL 被请求: {url}")


async def test_vision_download_rejects_redirect_to_link_local():
    """A 302 落点是链路本地地址 ⇒ 拒绝,且不向该地址发请求。"""
    seen: list[str] = []
    routes = {
        "https://public.example/a.png": _Resp(
            302, {"location": "http://169.254.169.254/latest/meta-data/"}
        ),
    }
    with patch("httpx.AsyncClient", _Client(routes, seen)):
        try:
            await vision_helper.download_image("https://public.example/a.png")
        except ValueError as e:
            assert "不允许" in str(e) or "URL" in str(e)
        else:  # pragma: no cover
            raise AssertionError("应当拒绝重定向到内网")

    assert not any("169.254" in u for u in seen), f"内网地址被请求了: {seen}"


async def test_vision_download_follows_safe_redirect():
    """B 302 落点安全 ⇒ 正常返回内容。

    判据本身另有直接用例(上一条);本用例测的是"逐跳跟随"这条控制流,故把 SSRF 尺
    打桩为放行 —— 否则测试机会去真解析 public.example 而失败(与本批无关的网络依赖)。
    """
    seen: list[str] = []
    routes = {
        "https://public.example/a.png": _Resp(302, {"location": "https://cdn.example/b.png"}),
        "https://cdn.example/b.png": _Resp(200, {"content-type": "image/png"}, b"PNGDATA"),
    }
    with (
        patch(
            "app.services.screenshot_service._validate_url_ssrf", return_value=(True, "")
        ),
        patch("httpx.AsyncClient", _Client(routes, seen)),
    ):
        data, mime = await vision_helper.download_image("https://public.example/a.png")

    assert data == b"PNGDATA"
    assert mime == "image/png"
    assert seen == ["https://public.example/a.png", "https://cdn.example/b.png"]


async def test_image_uploader_rejects_redirect_to_private():
    """C image_uploader:跳到内网 ⇒ 返回 None,内网零请求。"""
    seen: list[str] = []
    routes = {
        "https://public.example/a.png": _Resp(
            302, {"location": "https://127.0.0.1/secret.png"}
        ),
    }
    with patch("httpx.AsyncClient", _Client(routes, seen)):
        out = await image_uploader.download_image("https://public.example/a.png")

    assert out is None
    assert not any("127.0.0.1" in u for u in seen), f"内网地址被请求了: {seen}"


async def test_image_uploader_rejects_non_image_after_redirect():
    """D 跳到安全地址但不是图片 ⇒ 返回 None(内容类型闸仍在)。"""
    seen: list[str] = []
    routes = {
        "https://public.example/a.png": _Resp(302, {"location": "https://cdn.example/x.png"}),
        "https://cdn.example/x.png": _Resp(200, {"content-type": "text/html"}, b"<html>"),
    }
    with patch("httpx.AsyncClient", _Client(routes, seen)):
        out = await image_uploader.download_image("https://public.example/a.png")

    assert out is None
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠


async def test_canteen_receipt_rejects_local_path(tmp_path):
    """E 小票识别端点不再接受本地路径(任意文件读的入口被摘掉)。

    此前 image 字段走 `read_local_image` ⇒ 任意登录用户传服务器上任意 `.png/.jpg`
    路径即可把内容读出来交给多模态模型。现该分支直接拒绝;即使文件真实存在也不读。
    """
    from app.routers.edu_canteen_receipt import _resolve_image_data_uri

    real = tmp_path / "secret.png"
    real.write_bytes(b"\x89PNG\r\n\x1a\nfake")

    data, err = await _resolve_image_data_uri(str(real))
    assert data is None
    assert "本地路径" in (err or "")


async def test_canteen_receipt_still_accepts_data_uri():
    """对照:data URI 通路不受影响(前端上传后的主路径)。"""
    from app.routers.edu_canteen_receipt import _resolve_image_data_uri

    uri = "data:image/png;base64,iVBORw0KGgo="
    data, err = await _resolve_image_data_uri(uri)
    assert err is None
    assert data == uri
