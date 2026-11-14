# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:

"""截图类工具的图片直投(2026-11-15 立,对标 DSH screenshot → image content)。

背景(改动前现读):computer_screenshot_screen 把 base64 放在 result.data.data.screenshot,
browser_selfcheck_screenshot 直接返回 imageBase64 —— 二者都会进 call_tool 的
8000 token 截断护栏(base64 被截成无效串),SSE tool-result 也会被单帧撑爆。

契约:
① 内联 base64 一律转入 tool_image_delivery 有界暂存,正文只留元数据;
② 交付失败不改工具 ok(保留原结果 + image_error,模型可改用 vision_analyze);
③ agent-control 双层 data / 三个键名都能取到截图。
"""

from __future__ import annotations

import base64

import httpx
import pytest

from app.services import mcp_server as mcp
from app.services import tool_image_delivery as delivery

_PNG_BYTES = base64.b64decode(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=="
)
_PNG_B64 = base64.b64encode(_PNG_BYTES).decode()


@pytest.fixture(autouse=True)
def _clean_stash():
    delivery.reset_image_stash()
    yield
    delivery.reset_image_stash()


def test_deliver_inline_image_moves_base64_to_stash() -> None:
    result = {"ok": True, "imageBase64": _PNG_B64}

    out = mcp._deliver_inline_image(
        result, raw_b64=_PNG_B64, label="test", name="shot.png", remove_keys=("imageBase64",)
    )

    assert "imageBase64" not in out
    assert "iVBOR" not in str(out)  # 正文不再携带 base64
    assert out["image"]["content_id"].startswith("img_")
    images = delivery.take_images([out["image"]["content_id"]])
    assert len(images) == 1
    assert images[0]["data_url"].startswith("data:image/png;base64,")


def test_deliver_inline_image_never_fails_the_tool() -> None:
    result = {"ok": True}

    out = mcp._deliver_inline_image(result, raw_b64="!!!not-base64!!!", label="test")

    assert out["ok"] is True
    assert "image" not in out
    assert "image_error" in out


def test_screenshot_extraction_accepts_double_data_and_three_keys() -> None:
    assert mcp._screenshot_b64_from_agent_result({"data": {"screenshot": "AAA"}}) == "AAA"
    assert mcp._screenshot_b64_from_agent_result({"screenshot": "BBB"}) == "BBB"
    assert mcp._screenshot_b64_from_agent_result({"data": {"imageBase64": "CCC"}}) == "CCC"
    assert mcp._screenshot_b64_from_agent_result({"base64": "DDD"}) == "DDD"
    assert mcp._screenshot_b64_from_agent_result({}) == ""
    assert mcp._screenshot_b64_from_agent_result(None) == ""


@pytest.mark.parametrize(
    ("category", "action"),
    [("computer", "screenshot_screen"), ("browser", "screenshot")],
)
@pytest.mark.asyncio
async def test_agent_control_screenshot_delivers_image(
    monkeypatch, category, action
) -> None:
    class _Resp:
        def raise_for_status(self) -> None:
            return None

        def json(self):
            return {"data": {"success": True, "data": {"screenshot": _PNG_B64}}}

    class _Client:
        async def __aenter__(self):
            return self

        async def __aexit__(self, *args):
            return False

        async def post(self, *args, **kwargs):
            return _Resp()

    monkeypatch.setattr(mcp, "_get_agent_control_secret", lambda: "secret")
    monkeypatch.setattr(mcp, "_get_agent_control_api_url", lambda: "http://stub")
    monkeypatch.setattr(httpx, "AsyncClient", lambda **kwargs: _Client())
    monkeypatch.setattr(
        "app.services.agent_security_prefs.current_security_principal", lambda: "u1"
    )

    out = await mcp._tool_agent_control(category, action, {})

    assert out["ok"] is True
    assert "screenshot" not in out["result"]["data"]
    assert out["image"]["content_id"].startswith("img_")
    assert len(delivery.take_images([out["image"]["content_id"]])) == 1


@pytest.mark.asyncio
async def test_browser_selfcheck_screenshot_delivers_image(monkeypatch) -> None:
    async def fake_capture(url, viewport=None, full_page=False, wait_ms=1500):
        return {
            "ok": True,
            "finalUrl": url,
            "title": "t",
            "width": 1,
            "height": 1,
            "consoleErrors": [],
            "imageBase64": _PNG_B64,
        }

    monkeypatch.setattr("app.tools.browser_selfcheck.capture_screenshot", fake_capture)
    monkeypatch.setattr(
        "app.services.screenshot_service._validate_url_ssrf", lambda url: (True, "")
    )

    out = await mcp._tool_browser_selfcheck_screenshot({"url": "https://example.com"})

    assert "imageBase64" not in out
    assert "iVBOR" not in str(out)
    assert out["image"]["content_id"].startswith("img_")
    assert len(delivery.take_images([out["image"]["content_id"]])) == 1
