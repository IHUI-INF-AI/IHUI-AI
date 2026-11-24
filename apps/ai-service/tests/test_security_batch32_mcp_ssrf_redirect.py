# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""安全强化第 32 批:mcp_server 四处 URL 下载的 SSRF 收口。

缺陷(现读,mcp_server.py):
  · `_tool_fetch_url`(fetch_url 工具):首跳过 SSRF 尺,但 `follow_redirects=True` ——
    公网页 302 → `http://169.254.169.254/` 即绕过,正文原样回给模型;
  · `_tool_token6688_upload_file`(url 分支):同型 —— 内网文件可被上传到外部存储;
  · `_audio_source_from_args`(url 分支,同步):同型 —— 内网音频可被拉取;
  · `_tool_configure_automation_task`(action=webhook):`webhook_url` 外部可控,
    **连首跳校验都没有**(注释"内网地址不可达兜底"不成立:本服务能访问内网),
    POST 到内网 = 带副作用的 SSRF。

修法(判据仍只住 screenshot_service 一份):
  · 新增 `_fetch_url_ssrf_safe`(async,逐跳 + 钉 IP,返回 状态码/正文/content-type);
  · 新增 `_download_url_ssrf_safe_sync`(同步逐跳 + 钉 IP,供同步函数);
  · upload/audio 两处改用既有 `_download_url_ssrf_safe` / 新同步版;
  · webhook 出站前过同一把尺 + 钉 IP(POST 不跟随重定向,只需首跳)。

用例:
  A `_fetch_url_ssrf_safe`:私网拒绝且不发请求;302→私网拒绝(第二跳不请求);
    正常返回三元组;正文超限 ⇒ None。
  B 同步版:私网拒绝;正常返回字节。
  C 形态锁:三处调用点不含 `follow_redirects=True`;webhook 分支含 SSRF 闸。
"""

from __future__ import annotations

import inspect
import re
from typing import Any

import pytest

from app.services import mcp_server, screenshot_service


class _FakeURL:
    def __init__(self, base: str) -> None:
        self._base = base

    def join(self, loc: str) -> _FakeURL:
        return _FakeURL(loc)

    def __str__(self) -> str:
        return self._base


class _FakeResponse:
    def __init__(
        self,
        status_code: int = 200,
        headers: dict[str, str] | None = None,
        body: bytes = b"",
        url: str = "http://public.test/",
    ) -> None:
        self.status_code = status_code
        self.headers = headers or {}
        self.content = body
        self.text = body.decode("utf-8", errors="replace")
        self.encoding = "utf-8"
        self.url = _FakeURL(url)
        self.is_redirect = 300 <= status_code < 400

    async def aiter_bytes(self) -> Any:
        yield self.content

    async def aclose(self) -> None:
        return None

    def close(self) -> None:
        return None


class _FakeAsyncClient:
    def __init__(self, responses: list[_FakeResponse]) -> None:
        self.responses = list(responses)
        self.calls: list[str] = []

    async def __aenter__(self) -> _FakeAsyncClient:
        return self

    async def __aexit__(self, *_exc: object) -> bool:
        return False

    async def get(self, url: str, **_kw: object) -> _FakeResponse:
        self.calls.append(url)
        return self.responses.pop(0)


class _FakeSyncClient:
    def __init__(self, responses: list[_FakeResponse]) -> None:
        self.responses = list(responses)
        self.calls: list[str] = []

    def __enter__(self) -> _FakeSyncClient:
        return self

    def __exit__(self, *_exc: object) -> bool:
        return False

    def get(self, url: str, **_kw: object) -> _FakeResponse:
        self.calls.append(url)
        return self.responses.pop(0)


class _FakeHttpxAsync:
    def __init__(self, client: _FakeAsyncClient) -> None:
        self.AsyncClient = lambda **_kw: client


class _FakeHttpxSync:
    def __init__(self, client: _FakeSyncClient) -> None:
        self.Client = lambda **_kw: client


def _patch_ssrf(monkeypatch: pytest.MonkeyPatch, validate: Any) -> None:
    """打补丁到判据源模块:helper 内部 `from .screenshot_service import ...` 取到的就是它。"""
    monkeypatch.setattr(screenshot_service, "_validate_url_ssrf", validate)
    monkeypatch.setattr(
        screenshot_service, "resolve_pinned_target", lambda u: (u, "public.test")
    )


# ---------------------------------------------------------------------------
# A:async 逐跳
# ---------------------------------------------------------------------------


async def test_fetch_blocks_private_without_request(monkeypatch: pytest.MonkeyPatch):
    _patch_ssrf(monkeypatch, lambda _u: (False, "private"))
    client = _FakeAsyncClient([])
    out = await mcp_server._fetch_url_ssrf_safe(
        "http://127.0.0.1/admin", _FakeHttpxAsync(client)
    )
    assert out is None
    assert client.calls == [], "被拒目标不得发出请求"


async def test_fetch_blocks_redirect_into_private(monkeypatch: pytest.MonkeyPatch):
    def _validate(u: str) -> tuple[bool, str]:
        return (not u.startswith("http://127."), "private")

    _patch_ssrf(monkeypatch, _validate)
    client = _FakeAsyncClient(
        [_FakeResponse(302, {"location": "http://127.0.0.1/secret"}, url="http://public.test/")]
    )
    out = await mcp_server._fetch_url_ssrf_safe("http://public.test/", _FakeHttpxAsync(client))
    assert out is None
    assert len(client.calls) == 1, "重定向到内网的第二跳不得发出"


async def test_fetch_returns_status_body_content_type(monkeypatch: pytest.MonkeyPatch):
    _patch_ssrf(monkeypatch, lambda _u: (True, ""))
    client = _FakeAsyncClient(
        [_FakeResponse(headers={"content-type": "text/html"}, body=b"<h1>hi</h1>")]
    )
    out = await mcp_server._fetch_url_ssrf_safe("http://public.test/", _FakeHttpxAsync(client))
    assert out == (200, "<h1>hi</h1>", "text/html", "http://public.test/")


async def test_fetch_blocks_oversized_body(monkeypatch: pytest.MonkeyPatch):
    _patch_ssrf(monkeypatch, lambda _u: (True, ""))
    client = _FakeAsyncClient([_FakeResponse(body=b"0123456789")])
    out = await mcp_server._fetch_url_ssrf_safe(
        "http://public.test/", _FakeHttpxAsync(client), max_bytes=4
    )
    assert out is None


# ---------------------------------------------------------------------------
# B:同步逐跳
# ---------------------------------------------------------------------------


def test_sync_blocks_private(monkeypatch: pytest.MonkeyPatch):
    _patch_ssrf(monkeypatch, lambda _u: (False, "private"))
    client = _FakeSyncClient([])
    out = mcp_server._download_url_ssrf_safe_sync("http://127.0.0.1/", _FakeHttpxSync(client))
    assert out is None
    assert client.calls == []


def test_sync_returns_bytes(monkeypatch: pytest.MonkeyPatch):
    _patch_ssrf(monkeypatch, lambda _u: (True, ""))
    client = _FakeSyncClient([_FakeResponse(body=b"audio-bytes")])
    out = mcp_server._download_url_ssrf_safe_sync(
        "http://public.test/a.mp3", _FakeHttpxSync(client)
    )
    assert out == b"audio-bytes"


def test_sync_blocks_redirect_into_private(monkeypatch: pytest.MonkeyPatch):
    def _validate(u: str) -> tuple[bool, str]:
        return (not u.startswith("http://127."), "private")

    _patch_ssrf(monkeypatch, _validate)
    client = _FakeSyncClient(
        [_FakeResponse(302, {"location": "http://127.0.0.1/x"}, url="http://public.test/")]
    )
    out = mcp_server._download_url_ssrf_safe_sync(
        "http://public.test/a.mp3", _FakeHttpxSync(client)
    )
    assert out is None
    assert len(client.calls) == 1


# ---------------------------------------------------------------------------
# C:形态锁
# ---------------------------------------------------------------------------


def test_call_sites_no_longer_follow_redirects():
    # 只判**调用形态**(follow_redirects=True 后接 `)` 或 `,`),不误伤注释里
    # 描述历史缺陷的同名字面量(注释说"此前 follow_redirects=True 可被绕过")。
    pattern = re.compile(r"follow_redirects\s*=\s*True\s*[,)]")
    for fn in (
        mcp_server._tool_fetch_url,
        mcp_server._tool_token6688_upload_file,
        mcp_server._audio_source_from_args,
    ):
        src = inspect.getsource(fn)
        assert not pattern.search(src), f"{fn.__name__} 不得自动跟随重定向"


def test_webhook_branch_has_ssrf_gate():
    src = inspect.getsource(mcp_server._tool_configure_automation_task)
    assert "SSRF_BLOCKED" in src
    assert "resolve_pinned_target" in src
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
