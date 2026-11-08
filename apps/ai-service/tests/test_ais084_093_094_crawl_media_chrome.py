# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""AIS-084 / AIS-093 / AIS-094 三条一组回归(2026-11-08)。

- AIS-084:fetch_readable / map_site / crawl_site / extract_web 绕过网络审批门。
  此前只有 fetch_url / webhook 走 `evaluate_network_access_detailed`,抓取族仅做
  SSRF 校验 —— 用户拒绝了 fetch_url 的出站,换个同能力工具照样出站。
- AIS-093:media 下载/播放/图片代理与远程转存全量缓冲(stream=False),先灌内存再
  判长度 —— 单个登录用户即可让 worker OOM。改为 stream=True + 硬字节上限。
- AIS-094:import-chrome 的 port 由请求体任意指定,不与 launch-chrome 的调用者绑定
  —— 猜中他人 CDP 端口可把对方的平台登录 cookie 导进自己账号。
"""

from __future__ import annotations

from typing import Any

import pytest
from fastapi import FastAPI

from app.routers import media_tasks as mt
from app.services import chrome_import as ci
from app.tools import web_crawl_tools as wct


# ===========================================================================
# AIS-084:抓取族与 fetch_url 同过网络审批门
# ===========================================================================


@pytest.fixture()
def _deny_gate(monkeypatch: pytest.MonkeyPatch) -> list[tuple[str, str | None]]:
    import app.services.network_approval as _na

    calls: list[tuple[str, str | None]] = []

    def _gate(url: str, reason: str | None = None) -> tuple[str, str | None]:
        calls.append((url, reason))
        return "deny", "not_allowed"

    monkeypatch.setattr(_na, "evaluate_network_access_detailed", _gate)
    return calls


@pytest.fixture()
def _ssrf_pass(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(wct, "_validate_ssrf", lambda _u: None)


@pytest.mark.asyncio
@pytest.mark.parametrize(
    ("tool", "arguments"),
    [
        ("fetch_readable", {"url": "https://evil.example.com/a"}),
        ("map_site", {"url": "https://evil.example.com/a"}),
        ("crawl_site", {"url": "https://evil.example.com/a"}),
        ("extract_web", {"url": "https://evil.example.com/a", "fields": {"t": "title"}}),
    ],
)
async def test_crawl_family_denied_by_network_gate(
    tool: str, arguments: dict[str, Any], _deny_gate, _ssrf_pass
) -> None:
    """四个抓取工具都必须过审批门;deny 时以 NETWORK_APPROVAL_DENIED 收口。"""
    out = await getattr(wct, tool)(arguments)
    assert out["ok"] is False
    assert out["errorCode"] == "NETWORK_APPROVAL_DENIED"
    assert _deny_gate, "审批门未被调用:抓取族仍然旁路"
    assert _deny_gate[0][1] == f"tool:{tool}", "审批门未收到工具来源标注"


@pytest.mark.asyncio
async def test_crawl_family_allow_really_passes_gate(monkeypatch: pytest.MonkeyPatch, _ssrf_pass) -> None:
    """门 allow 后必须越过审批门(失败原因不得是 NETWORK_APPROVAL_DENIED)。"""
    import app.services.network_approval as _na

    calls: list[str] = []

    def _gate(url: str, reason: str | None = None) -> tuple[str, str | None]:
        calls.append(url)
        return "allow", None

    async def _no_page(_url: str) -> None:
        return None

    monkeypatch.setattr(_na, "evaluate_network_access_detailed", _gate)
    monkeypatch.setattr(wct, "_fetch_with_js_fallback", _no_page)
    out = await wct.fetch_readable({"url": "https://example.com/a"})
    assert calls, "审批门未被调用"
    assert out["errorCode"] != "NETWORK_APPROVAL_DENIED"


@pytest.mark.asyncio
async def test_gate_failure_does_not_break_existing_behavior(
    monkeypatch: pytest.MonkeyPatch, _ssrf_pass
) -> None:
    """审批门自身故障时的语义与 fetch_url 一致:不改变既有放行行为。"""
    import app.services.network_approval as _na

    def _boom(_url: str, reason: str | None = None) -> tuple[str, str | None]:
        raise RuntimeError("gate down")

    async def _no_page(_url: str) -> None:
        return None

    monkeypatch.setattr(_na, "evaluate_network_access_detailed", _boom)
    monkeypatch.setattr(wct, "_fetch_with_js_fallback", _no_page)
    out = await wct.fetch_readable({"url": "https://example.com/a"})
    assert out["errorCode"] != "NETWORK_APPROVAL_DENIED"


# ===========================================================================
# AIS-093:代理/转存流式 + 字节上限
# ===========================================================================


class _FakeResp:
    def __init__(self, body: bytes, headers: dict[str, str] | None = None, status: int = 200):
        self.status_code = status
        self._body = body
        self.headers = headers or {}
        self.is_redirect = False
        self.url = "https://example.com/x"
        self.closed = False

    def raise_for_status(self) -> None:
        return None

    async def aiter_bytes(self, chunk_size: int = 65536):
        for i in range(0, len(self._body), max(1, chunk_size)):
            yield self._body[i : i + chunk_size]

    async def aclose(self) -> None:
        self.closed = True


class _FakeClient:
    def __init__(self, resp: _FakeResp, *args: Any, **kwargs: Any):
        self._resp = resp
        self.send_kwargs: list[dict[str, Any]] = []

    def build_request(self, method: str, url: str, headers: Any = None, extensions: Any = None, **kw: Any):
        return {"method": method, "url": url, "headers": headers or {}, "extensions": extensions or {}}

    async def send(self, request: Any, **kwargs: Any) -> _FakeResp:
        self.send_kwargs.append(kwargs)
        return self._resp

    async def aclose(self) -> None:
        return None


@pytest.mark.asyncio
async def test_send_following_redirects_passes_stream_flag(monkeypatch: pytest.MonkeyPatch) -> None:
    """AIS-093:代理必须让 httpx 以 stream 模式发送(否则正文先全量进内存)。"""
    from app.routers.media_tasks import _send_following_redirects

    import app.routers.media_tasks as _mt
    import app.services.screenshot_service as _ss

    monkeypatch.setattr(_ss, "_validate_url_ssrf", lambda u: (True, ""))
    monkeypatch.setattr(_ss, "resolve_pinned_target", lambda u: (u, "example.com"))
    client = _FakeClient(_FakeResp(b"abc", {"content-type": "text/plain"}))
    await _send_following_redirects(client, "https://example.com/a", stream=True)  # type: ignore[arg-type]
    assert client.send_kwargs and client.send_kwargs[0].get("stream") is True
    del _mt


@pytest.mark.asyncio
async def test_read_capped_response_stops_at_limit() -> None:
    """AIS-093:边读边计数,超限返回 None;未超限返回完整内容。"""
    resp = _FakeResp(b"abcdef")
    assert await mt._read_capped_response(resp, 5) is None  # type: ignore[arg-type]
    ok = await mt._read_capped_response(_FakeResp(b"abcdef"), 6)  # type: ignore[arg-type]
    assert ok == b"abcdef"


@pytest.mark.asyncio
async def test_stream_capped_truncates_and_closes() -> None:
    """AIS-093:转发累计超上限即断流,并关闭响应与客户端。"""
    resp = _FakeResp(b"x" * 10)
    out = b"".join([chunk async for chunk in mt._stream_capped(resp, _FakeClient(resp), 4)])  # type: ignore[arg-type]
    assert out == b"xxxx"
    assert resp.closed is True


def _proxy_app() -> FastAPI:
    app = FastAPI()
    app.include_router(mt.router, prefix="/api")

    @app.middleware("http")
    async def _inject_identity(request: Any, call_next: Any) -> Any:
        # 三个代理端点直接调 _user_scope(request)(不是 Depends),只能从 state 注入身份
        request.state.user_id = "u-1"
        request.state.role_id = 0
        return await call_next(request)

    return app


@pytest.mark.asyncio
@pytest.mark.parametrize(
    ("path", "ctype"),
    [
        ("/api/media/download", "video/mp4"),
        ("/api/media/stream", "video/mp4"),
        ("/api/media/image", "image/png"),
    ],
)
async def test_proxy_rejects_declared_oversize(
    path: str, ctype: str, monkeypatch: pytest.MonkeyPatch
) -> None:
    """声明长度即超限时,三个代理都必须在开始转发前 413。"""
    from httpx import ASGITransport, AsyncClient

    import app.routers.media_tasks as _mt
    import app.services.screenshot_service as _ss

    monkeypatch.setattr(_ss, "_validate_url_ssrf", lambda u: (True, ""))
    monkeypatch.setattr(_ss, "resolve_pinned_target", lambda u: (u, "example.com"))
    big = _FakeResp(b"x", {"content-type": ctype, "content-length": str(999 * 1024 * 1024)})
    monkeypatch.setattr(_mt.httpx, "AsyncClient", lambda *a, **kw: _FakeClient(big))

    app = _proxy_app()
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        resp = await ac.get(path, params={"url": "https://example.com/x"})
    assert resp.status_code == 413
    assert big.closed is True


# ===========================================================================
# AIS-094:import-chrome 端口属主绑定
# ===========================================================================


@pytest.fixture(autouse=True)
def _clean_registry() -> None:
    ci._launch_registry.clear()


@pytest.mark.asyncio
async def test_import_rejects_unregistered_port(monkeypatch: pytest.MonkeyPatch) -> None:
    """未登记端口(例如猜到的他人 CDP 端口)必须在连 CDP 之前就拒绝。"""

    async def _must_not_probe(_port: int) -> bool:
        raise AssertionError("未登记端口不得探测/连接 CDP")

    monkeypatch.setattr(ci, "_wait_for_cdp_ready", _must_not_probe)
    platform = next(iter(ci.PLATFORM_SCAN_CONFIG))
    out = await ci.import_chrome_cookies(54321, platform, "mallory")
    assert out["detected"] is False
    assert "不是当前账号" in (out["error"] or "")


@pytest.mark.asyncio
async def test_import_rejects_other_users_port(monkeypatch: pytest.MonkeyPatch) -> None:
    """同一端口只有拉起它的账号可导入,换账号必须被拒。"""
    ci._register_launched_port(54322, "alice")

    async def _not_ready(_port: int) -> bool:
        return False

    monkeypatch.setattr(ci, "_wait_for_cdp_ready", _not_ready)
    platform = next(iter(ci.PLATFORM_SCAN_CONFIG))

    denied = await ci.import_chrome_cookies(54322, platform, "bob")
    assert denied["detected"] is False
    assert "不是当前账号" in (denied["error"] or "")

    # 属主自己通过属主校验,止步于"端口未就绪"(证明门放行的是正确的那一方)
    own = await ci.import_chrome_cookies(54322, platform, "alice")
    assert own["error"] == "Chrome 调试端口未就绪"


@pytest.mark.asyncio
async def test_launch_registers_port_owner(tmp_path, monkeypatch: pytest.MonkeyPatch) -> None:
    """launch-chrome 成功后必须登记端口属主(否则 import 侧门无从判定)。"""
    from unittest.mock import patch as _patch

    platform = next(iter(ci.PLATFORM_SCAN_CONFIG))
    with _patch.object(ci, "_find_browser_executable", return_value=(str(tmp_path / "c.exe"), "chrome")), \
         _patch.object(ci, "_pick_free_port", return_value=54323), \
         _patch.object(ci.subprocess, "Popen", return_value=type("P", (), {"pid": 1})()), \
         _patch.object(ci, "_wait_for_cdp_ready", return_value=True):
        r = await ci.launch_chrome_for_import(platform, user_id="alice")

    assert r["launched"] is True
    assert ci._port_owned_by(54323, "alice") is True
    assert ci._port_owned_by(54323, "bob") is False
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
