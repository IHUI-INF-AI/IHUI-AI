# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""P1 AIS-051:浏览器自检工具是 screenshot_url 的 SSRF 旁路。

旧写法:两个自检工具不在 `_ADMIN_ONLY_TOOLS`、handler 与 capture 层都不跑
`_validate_url_ssrf` ⇒ role=0 可让服务端访问回环/私网/链路本地。本夹具钉住:
role=0 → PERMISSION_DENIED;admin 调回环/链路本地 → SSRF_BLOCKED 且 capture 未被调用;
公网 URL(monkeypatch 校验与 capture)仍走通;capture 层与逐跳 route 守卫也有防线。
"""

from __future__ import annotations

from types import SimpleNamespace

import pytest

from app.services import mcp_server
from app.services import screenshot_service as _ss
from app.tools import browser_selfcheck as _bs


class _Recorder:
    def __init__(self, result: dict | None = None) -> None:
        self.calls: list[tuple] = []
        self.result = result or {
            "ok": True,
            "imageBase64": "fake",
            "width": 1280,
            "height": 720,
            "consoleErrors": [],
            "title": "Example",
            "finalUrl": "https://example.com/",
        }

    async def capture(self, url, viewport=None, full_page=False, wait_ms=1500):
        self.calls.append((url, viewport, full_page, wait_ms))
        return dict(self.result)

    async def report(self, url, checks):
        self.calls.append((url, checks))
        return {
            "ok": True,
            "url": url,
            "title": "Example",
            "finalUrl": "https://example.com/",
            "consoleErrors": [],
            "screenshot_length": 10,
            "visionChecked": True,
            "visionModel": "fake",
            "checks": [],
        }


@pytest.fixture
def server() -> mcp_server.MCPServer:
    return mcp_server.MCPServer()


@pytest.mark.parametrize(
    "tool_name,url",
    [
        ("browser_selfcheck_screenshot", "http://127.0.0.1:8080/"),
        ("browser_selfcheck_screenshot", "http://169.254.169.254/latest/meta-data/"),
        ("browser_selfcheck", "http://169.254.169.254/latest/meta-data/"),
    ],
)
async def test_role_zero_denied_without_capture(
    server, monkeypatch: pytest.MonkeyPatch, tool_name: str, url: str
) -> None:
    rec = _Recorder()
    monkeypatch.setattr(_bs, "capture_screenshot", rec.capture)
    monkeypatch.setattr(_bs, "selfcheck_report", rec.report)

    out = await server.call_tool(tool_name, {"url": url}, user_role=0)

    assert out["ok"] is False
    assert out["errorCode"] == "PERMISSION_DENIED"
    assert rec.calls == []


@pytest.mark.parametrize(
    "tool_name,url",
    [
        ("browser_selfcheck_screenshot", "http://127.0.0.1:8080/"),
        ("browser_selfcheck_screenshot", "http://169.254.169.254/"),
        ("browser_selfcheck", "http://169.254.169.254/"),
    ],
)
async def test_admin_private_target_blocked_before_capture(
    server, monkeypatch: pytest.MonkeyPatch, tool_name: str, url: str
) -> None:
    rec = _Recorder()
    monkeypatch.setattr(_bs, "capture_screenshot", rec.capture)
    monkeypatch.setattr(_bs, "selfcheck_report", rec.report)

    out = await server.call_tool(tool_name, {"url": url}, user_role=1)

    assert out["ok"] is False
    assert out["errorCode"] == "SSRF_BLOCKED"
    assert rec.calls == []


@pytest.mark.parametrize(
    "tool_name", ["browser_selfcheck_screenshot", "browser_selfcheck"]
)
async def test_public_url_still_works(
    server, monkeypatch: pytest.MonkeyPatch, tool_name: str
) -> None:
    rec = _Recorder()
    monkeypatch.setattr(_bs, "capture_screenshot", rec.capture)
    monkeypatch.setattr(_bs, "selfcheck_report", rec.report)
    # 公网域名需 DNS;这里只钉"校验通过后继续走 capture",不重复 SSRF 判据
    monkeypatch.setattr(_ss, "_validate_url_ssrf", lambda url: (True, ""))

    out = await server.call_tool(tool_name, {"url": "https://example.com/"}, user_role=1)

    assert out["ok"] is True
    assert len(rec.calls) == 1


@pytest.mark.parametrize(
    "url", ["http://127.0.0.1:8080/", "http://169.254.169.254/"]
)
async def test_capture_layer_also_blocks(
    monkeypatch: pytest.MonkeyPatch, url: str
) -> None:
    calls: list[tuple] = []

    def _fake_sync(u, viewport, full_page, wait_ms):
        calls.append((u, viewport, full_page, wait_ms))
        return {
            "ok": True, "imageBase64": "fake", "width": 1, "height": 1,
            "consoleErrors": [], "title": "t", "finalUrl": u,
        }

    monkeypatch.setattr(_bs, "_sync_capture", _fake_sync)

    out = await _bs.capture_screenshot(url)

    assert out["ok"] is False
    assert out["errorCode"] == "SSRF_BLOCKED"
    assert calls == []


def test_route_guard_checks_every_hop(monkeypatch: pytest.MonkeyPatch) -> None:
    guard = _bs._route_ssrf_guard

    def _validate(url: str) -> tuple[bool, str]:
        if "169.254.169.254" in url or "127.0.0.1" in url:
            return False, "私有/回环地址"
        return True, ""

    monkeypatch.setattr(_ss, "_validate_url_ssrf", _validate)

    class _Route:
        def __init__(self, url: str) -> None:
            self.request = SimpleNamespace(url=url)
            self.aborted = False
            self.continued = False

        def abort(self) -> None:
            self.aborted = True

        def continue_(self) -> None:
            # Playwright 路由回调必须显式 abort/continue/fulfill,否则请求挂起
            self.continued = True

    private = _Route("http://169.254.169.254/latest/meta-data/")
    assert guard(private) is True
    assert private.aborted is True
    assert private.continued is False

    public = _Route("https://8.8.8.8/")
    assert guard(public) is True
    assert public.aborted is False
    assert public.continued is True
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
