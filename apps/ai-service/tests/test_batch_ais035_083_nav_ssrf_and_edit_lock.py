# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""AIS-035 / AIS-083 夹具(同一批)。

- AIS-035:`POST /api/computer-use/open` 直接把任意 URL 交给服务端 Chromium,
  `file://`/回环/云元数据都能打开,再经 extract-text 回读。现在入口先过
  `_validate_url_ssrf`,并给该用户 context 装逐请求路由闸。
- AIS-083:`file_edit` 的读盘 / 匹配计数 / 3-way 合并都在 per-path 写锁之外,
  锁只覆盖写回,两个并发编辑会基于同一旧快照互相覆盖。现在读-改-写整体入锁。
"""

from __future__ import annotations

import builtins
import os
from typing import Any

import pytest
from fastapi import HTTPException

from app.routers import computer_use as cu
from app.services import mcp_server


# ---------------------------------------------------------------------------
# AIS-035:computer-use open 必须先过 SSRF 尺子
# ---------------------------------------------------------------------------


class _FakePage:
    def __init__(self) -> None:
        self.goto_calls: list[str] = []

    async def goto(self, url: str, timeout: int, wait_until: str) -> None:
        self.goto_calls.append(url)

    async def title(self) -> str:
        return "Example"

    @property
    def url(self) -> str:
        return self.goto_calls[-1] if self.goto_calls else ""


async def _browser_must_not_start(user_id: str) -> Any:
    raise AssertionError(f"非法 URL 不应拉起浏览器(user={user_id})")


@pytest.mark.parametrize(
    "url",
    [
        "file:///C:/Windows/win.ini",
        "javascript:alert(1)",
        "data:text/html,<h1>x</h1>",
        "http://127.0.0.1:8080/admin",
        "http://169.254.169.254/latest/meta-data/",
        "http://10.0.0.8:80/",
    ],
)
async def test_open_rejects_unsafe_urls_before_browser(
    monkeypatch: pytest.MonkeyPatch, url: str
) -> None:
    """改前必红:旧码直接 page.goto,file/回环/元数据全部可达。"""
    monkeypatch.setattr(cu, "_ensure_page", _browser_must_not_start)
    with pytest.raises(HTTPException) as ei:
        await cu.computer_use_open(cu.OpenRequest(url=url), user_id="u1")
    assert ei.value.status_code == 400, ei.value
    assert "URL" in str(ei.value.detail), ei.value


async def test_open_allows_public_page(monkeypatch: pytest.MonkeyPatch) -> None:
    """正向控制:公网 https 仍可打开,不被 SSRF 闸误杀。"""
    page = _FakePage()

    async def _page(user_id: str) -> _FakePage:
        return page

    monkeypatch.setattr(cu, "_ensure_page", _page)
    monkeypatch.setattr(cu, "_require_session", lambda uid: object())
    monkeypatch.setattr(cu, "_record_step", lambda *a, **k: None)

    out = await cu.computer_use_open(
        cu.OpenRequest(url="https://example.com/"), user_id="u1"
    )
    assert out["status"] == "opened", out
    assert page.goto_calls == ["https://example.com/"], page.goto_calls


class _FakeRequest:
    def __init__(self, url: str) -> None:
        self.url = url


class _FakeRoute:
    def __init__(self) -> None:
        self.aborted: list[str] = []
        self.continued: list[str] = []

    async def abort(self, reason: str) -> None:
        self.aborted.append(reason)

    async def continue_(self) -> None:
        self.continued.append("ok")


async def test_context_route_guard_blocks_each_hop(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """改前必红:没有逐请求闸,重定向到内网/子资源请求不会被拦。"""
    assert hasattr(cu, "_ssrf_route_guard"), "缺少逐请求 SSRF 路由闸(AIS-035)"

    def _ssrf(url: str) -> tuple[bool, str]:
        if "169.254.169.254" in url or "127.0.0.1" in url:
            return False, "内网地址"
        return True, ""

    monkeypatch.setattr(cu, "_validate_url_ssrf", _ssrf)

    blocked = _FakeRoute()
    # playwright 的 handler 是单参(route),这里按真实签名调用
    await cu._ssrf_route_guard(_make_route(blocked, "http://169.254.169.254/x"))
    assert blocked.aborted, "内网请求未被 abort"

    allowed = _FakeRoute()
    await cu._ssrf_route_guard(_make_route(allowed, "https://example.com/a.js"))
    assert allowed.continued == ["ok"], allowed.continued


def _make_route(route: _FakeRoute, url: str) -> Any:
    class _R:
        request = _FakeRequest(url)

        async def abort(self, reason: str) -> None:
            await route.abort(reason)

        async def continue_(self) -> None:
            await route.continue_()

    return _R()


# ---------------------------------------------------------------------------
# AIS-083:file_edit 读-改-写必须整体持同一把 per-path 锁
# ---------------------------------------------------------------------------


class _LockSpy:
    def __init__(self) -> None:
        self.depth = 0

    def __call__(self, path: str) -> Any:
        async def _enter() -> None:
            self.depth += 1

        async def _exit() -> None:
            self.depth -= 1

        class _CM:
            async def __aenter__(self) -> None:
                await _enter()

            async def __aexit__(self, *exc: Any) -> None:
                await _exit()

        return _CM()


async def test_file_edit_reads_under_write_lock(
    monkeypatch: pytest.MonkeyPatch, tmp_path: Any
) -> None:
    """改前必红:读盘发生在锁外(记录到的 depth=0),并发编辑会基于旧快照覆盖。"""
    target = tmp_path / "a.txt"
    target.write_text("alpha\nbeta\n", encoding="utf-8")
    monkeypatch.setattr(mcp_server, "_get_workspace_roots", lambda: [str(tmp_path.resolve())])

    spy = _LockSpy()
    monkeypatch.setattr(mcp_server, "get_path_write_lock", spy)

    real_open = builtins.open
    read_depths: list[int] = []

    def _open(file: Any, mode: str = "r", *args: Any, **kwargs: Any):
        if os.path.abspath(str(file)) == os.path.abspath(str(target)) and "r" in mode and "w" not in mode:
            read_depths.append(spy.depth)
        return real_open(file, mode, *args, **kwargs)

    monkeypatch.setattr("builtins.open", _open)

    out = await mcp_server._tool_file_edit({
        "file_path": str(target),
        "old_string": "alpha",
        "new_string": "ALPHA",
    })
    assert out["ok"] is True, out
    assert target.read_text(encoding="utf-8") == "ALPHA\nbeta\n"
    assert read_depths, "夹具没有观察到读盘"
    assert read_depths[0] >= 1, f"读盘仍在锁外: depths={read_depths}"
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
