# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""POST /api/browser/sessions 在"页面建成即被关掉"时必须降级,而不是抛 500。

实测(2026-09-29 本机):xiaohongshu 的登录页在 goto 之后被平台侧关闭,于是
`session.get_title()` 抛 `Page.title: Target page, context or browser has been closed`,
一路未捕获 → 整个请求 500「服务内部错误」,而那个死会话仍留在 hub 里占着一个 context。

本测试不启动浏览器:用替身会话把三种结局各钉一条 ——
  1) 读标题抛错 → 502 + 会话被 close(不泄漏)
  2) 一切正常 → code 0 且会话**不**被误关
  3) 文案必须给出下一步出路(外部浏览器/手动导入),不能只说"服务内部错误"
"""

from __future__ import annotations

import pytest
from fastapi import HTTPException

from app.routers import browser_hub as br


class FakeSession:
    def __init__(self, *, title_error: Exception | None = None) -> None:
        self.session_id = "sess-1"
        self.closed = False
        self._title_error = title_error

    async def get_current_url(self) -> str:
        return "https://example.com/login"

    async def get_title(self) -> str:
        if self._title_error:
            raise self._title_error
        return "示例登录页"

    async def get_cookies(self) -> list[dict[str, str]]:
        return [{"name": "a", "value": "b"}]

    async def close(self) -> None:
        self.closed = True


class FakeHub:
    def __init__(self, session: FakeSession) -> None:
        self._session = session

    async def create_session(self, **_kwargs: object) -> FakeSession:
        return self._session


@pytest.fixture()
def _patch_hub(monkeypatch: pytest.MonkeyPatch):
    def _apply(session: FakeSession) -> FakeSession:
        monkeypatch.setattr(br, "hub", FakeHub(session))
        return session

    return _apply


_BODY = br.CreateSessionRequest(url="https://example.com/login")


async def test_页面被关掉时降级为_502_且会话不泄漏(_patch_hub) -> None:
    session = _patch_hub(FakeSession(title_error=RuntimeError("Target page has been closed")))
    with pytest.raises(HTTPException) as exc:
        await br.create_session(_BODY, user_id="u-1")
    assert exc.value.status_code == 502
    assert session.closed is True, "死会话必须关掉,否则每次失败都留一个 Chromium"


async def test_正常路径不得误关会话(_patch_hub) -> None:
    session = _patch_hub(FakeSession())
    out = await br.create_session(_BODY, user_id="u-1")
    assert out["code"] == 0
    assert out["data"]["session_id"] == "sess-1"
    assert session.closed is False


async def test_文案必须给出下一步出路(_patch_hub) -> None:
    _patch_hub(FakeSession(title_error=RuntimeError("boom")))
    with pytest.raises(HTTPException) as exc:
        await br.create_session(_BODY, user_id="u-1")
    detail = str(exc.value.detail)
    assert "服务内部错误" not in detail
    assert "外部浏览器" in detail or "手动导入" in detail
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
