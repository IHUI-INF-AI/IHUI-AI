# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""AIS-098 / AIS-099 / AIS-110 夹具(同一批)。

- AIS-098:`download_image` 的 Content-Type 判据是 `"image" not in ct and not ext` ——
  URL 以 `.png` 结尾时**完全不看 CT**(ext 恒非空),反代/错误页(HTML/JSON)会被写成
  `.png` 再上传。现在 CT 必须含 image,且落盘前用魔数复核真实格式。
- AIS-099:`resp.content` 全量缓冲且无上限 —— 一个超大响应先吃满内存再落盘。现在先看
  Content-Length,再 64KB 分块流式读,累计超限立刻断开、不落盘。
- AIS-110:`refundId` 只判空就拼进上游路径(`/refund-record/{id}/approve`),
  `../../admin/x` 会把上游带到别的路径。现在只放字母/数字/-/_,其余本地拒绝、零上游。
"""

from __future__ import annotations

from typing import Any

import pytest

from app.services.publish import image_uploader
from app.services import mcp_server

_PNG = b"\x89PNG\r\n\x1a\n" + b"payload"
_URL = "https://cdn.example.com/pic.png"


class _FakeResponse:
    """httpx.Response 替身:只覆盖 download_image 用到的面。"""

    is_redirect = False
    status_code = 200

    def __init__(self, headers: dict[str, str], chunks: list[bytes], consumed: list[bytes]):
        self.headers = headers
        self._chunks = chunks
        self._consumed = consumed
        self.url = _URL

    @property
    def content(self) -> bytes:
        # 旧码走 `resp.content` 全量缓冲;保留它才能让"改前必红"是真断言失败
        # (而不是 AttributeError)。
        return b"".join(self._chunks)

    async def aiter_bytes(self, size: int | None = None):
        for chunk in self._chunks:
            self._consumed.append(chunk)
            yield chunk

    async def aclose(self) -> None:
        return None


class _FakeClient:
    def __init__(self, response: _FakeResponse) -> None:
        self._response = response

    async def __aenter__(self) -> "_FakeClient":
        return self

    async def __aexit__(self, *exc: Any) -> bool:
        return False

    def build_request(self, method: str, url: str, headers: dict[str, str] | None = None):
        return (method, url)

    async def send(self, request: Any, stream: bool = False) -> _FakeResponse:
        return self._response


@pytest.fixture()
def _download_env(monkeypatch: pytest.MonkeyPatch, tmp_path):
    """把临时目录换成 tmp_path,并把 httpx.AsyncClient 换成可控替身。"""
    monkeypatch.setattr(image_uploader, "_IMAGE_TMP_DIR", tmp_path)
    # SSRF 判据(含 DNS 解析)由 AIS-051 夹具另行钉住;这里只测下载体量与格式。
    monkeypatch.setattr(image_uploader, "_assert_safe_image_url", lambda url: None)

    def _install(headers: dict[str, str], chunks: list[bytes]) -> list[bytes]:
        consumed: list[bytes] = []
        resp = _FakeResponse(headers, chunks, consumed)
        monkeypatch.setattr(
            image_uploader.httpx, "AsyncClient", lambda **kw: _FakeClient(resp)
        )
        return consumed

    return _install


async def test_html_error_page_at_png_url_is_not_saved(_download_env, tmp_path) -> None:
    """AIS-098:URL 是 .png 但响应是 text/html ⇒ 一个字节都不能落盘。"""
    _download_env({"content-type": "text/html; charset=utf-8"}, [b"<!DOCTYPE html><html>"])
    out = await image_uploader.download_image(_URL)
    assert out is None, out
    assert list(tmp_path.glob("*.png")) == []


async def test_png_content_type_with_html_bytes_is_rejected(_download_env, tmp_path) -> None:
    """AIS-098:CT 自称 image/png、内容其实是 HTML ⇒ 魔数复核拦下。"""
    _download_env({"content-type": "image/png"}, [b"<!DOCTYPE html><html>"])
    out = await image_uploader.download_image(_URL)
    assert out is None, out
    assert list(tmp_path.glob("*.png")) == []


async def test_valid_png_is_still_saved(_download_env, tmp_path) -> None:
    """正向:真 PNG 仍照常落盘(不把闸改成一律拒绝)。"""
    _download_env({"content-type": "image/png"}, [_PNG])
    out = await image_uploader.download_image(_URL)
    assert out is not None and out.is_file()
    assert out.read_bytes() == _PNG


async def test_declared_content_length_over_cap_is_rejected_before_read(
    _download_env, monkeypatch: pytest.MonkeyPatch, tmp_path
) -> None:
    """AIS-099:Content-Length 已超上限 ⇒ 一个块都不读、不落盘。"""
    monkeypatch.setattr(image_uploader, "_MAX_IMAGE_BYTES", 1024, raising=False)
    consumed = _download_env(
        {"content-type": "image/png", "content-length": str(1024 * 1024)}, [_PNG]
    )
    out = await image_uploader.download_image(_URL)
    assert out is None, out
    assert consumed == [], "超上限的响应仍被读了正文"
    assert list(tmp_path.glob("*.png")) == []


async def test_streamed_bytes_over_cap_abort_midway(
    _download_env, monkeypatch: pytest.MonkeyPatch, tmp_path
) -> None:
    """AIS-099:没有 Content-Length 时按流累计,超限立刻断开(不读完、不落盘)。"""
    monkeypatch.setattr(image_uploader, "_MAX_IMAGE_BYTES", 1024, raising=False)
    consumed = _download_env(
        {"content-type": "image/png"}, [_PNG + b"x" * 700, b"y" * 700, b"z" * 700, b"w" * 700]
    )
    out = await image_uploader.download_image(_URL)
    assert out is None, out
    assert len(consumed) == 2, f"超限后还在继续读: 读了 {len(consumed)} 块"
    assert list(tmp_path.glob("*.png")) == []


# ---------------------------------------------------------------------------
# AIS-110:edu 退费 id 不能带出路径
# ---------------------------------------------------------------------------


@pytest.fixture()
def _edu_calls(monkeypatch: pytest.MonkeyPatch) -> list[tuple[str, str]]:
    calls: list[tuple[str, str]] = []

    async def _fake(method: str, path: str, **kw):
        calls.append((method, path))
        return {"ok": True}

    monkeypatch.setattr(mcp_server, "_edu_api_request", _fake)
    return calls


async def test_approve_refund_traversal_id_never_reaches_upstream(_edu_calls) -> None:
    out = await mcp_server._tool_edu_approve_refund(
        {"refundId": "../../admin/users", "__user_id": "u-1"}
    )
    assert out["ok"] is False, out
    assert out["errorCode"] == "INVALID_ARGUMENT", out
    assert _edu_calls == [], f"非法 id 仍打到了上游: {_edu_calls}"


async def test_reject_refund_traversal_id_never_reaches_upstream(_edu_calls) -> None:
    out = await mcp_server._tool_edu_reject_refund(
        {"refundId": "a/../../secret", "__user_id": "u-1"}
    )
    assert out["ok"] is False, out
    assert out["errorCode"] == "INVALID_ARGUMENT", out
    assert _edu_calls == [], f"非法 id 仍打到了上游: {_edu_calls}"


async def test_valid_refund_id_still_reaches_upstream(_edu_calls) -> None:
    out = await mcp_server._tool_edu_approve_refund(
        {"refundId": "R-2026_001", "__user_id": "u-1"}
    )
    assert out["ok"] is True, out
    assert _edu_calls == [("PUT", "/refund-record/R-2026_001/approve")], _edu_calls
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
