# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""POST /publish/prepare-draft 路由契约测试（2026-11-27 立）。

锁三件事：
1. 请求体默认口径是 470–490 字 / 标题 16 字 / 5 话题词；
2. 当前用户身份只从 request.state.user_id 取，并作为 __user_id 传给工具；
3. 工具的业务失败（NO_ACCOUNT / PREFLIGHT_BLOCKED）走 200 + code=0，
   前端能拿到完整 data，而不是被 HTTP 网关吞成一句“请求失败”。
"""

from __future__ import annotations

import asyncio
from types import SimpleNamespace

from app.routers.publish import PrepareDraftRequest, prepare_draft


def _request(user_id: str = "user-1") -> SimpleNamespace:
    return SimpleNamespace(
        state=SimpleNamespace(user_id=user_id),
        headers={"x-session-id": "session-1"},
    )


def test_prepare_draft_request_defaults() -> None:
    body = PrepareDraftRequest(brief="讲清楚一人公司为什么先跑发布链路", platforms=["wechat"])
    assert body.profile == "ihui_koubo"
    assert body.format == "md"
    assert body.min_chars == 470
    assert body.max_chars == 490
    assert body.title_chars == 16
    assert body.hashtag_count == 5


def test_prepare_draft_route_forwards_user_and_keeps_business_error(
    monkeypatch,
) -> None:
    captured: dict[str, object] = {}

    async def fake_tool(arguments: dict[str, object]) -> dict[str, object]:
        captured.update(arguments)
        return {
            "tool": "prepare_publish_draft",
            "ok": False,
            "errorCode": "NO_ACCOUNT",
            "message": "目标平台没有可用发布账号，未生成内容、未落草稿",
            "missingPlatforms": ["wechat"],
        }

    monkeypatch.setattr("app.routers.publish.run_prepare_publish_draft", fake_tool)
    body = PrepareDraftRequest(brief="测试", platforms=["wechat"])
    result = asyncio.run(prepare_draft(body, _request()))  # type: ignore[arg-type]

    assert result["code"] == 0
    assert result["data"]["ok"] is False
    assert result["data"]["errorCode"] == "NO_ACCOUNT"
    assert captured["__user_id"] == "user-1"
    assert captured["__session_id"] == "session-1"
    assert captured["brief"] == "测试"
    assert captured["platforms"] == ["wechat"]
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
