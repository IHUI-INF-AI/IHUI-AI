# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""人工编辑草稿端点测试(2026-11-27 立)。

覆盖:只传显式字段、成功信封、预检阻断 409、非草稿 409、不存在 404。
工具层打桩,不连真库、不执行发布。
"""

from __future__ import annotations

from types import SimpleNamespace
from typing import Any

import pytest
from fastapi import HTTPException

import app.routers.publish as publish_router
from app.tools import publish_tools


def _ok_result(**overrides: Any) -> dict[str, Any]:
    base = {
        "tool": "update_publish_draft",
        "ok": True,
        "taskId": "pub-1",
        "status": "draft",
        "title": "新标题",
        "format": "md",
        "targets": [{"platform": "douyin", "account_id": 7}],
        "contentHash": "hash-1",
        "changedFields": ["text", "title"],
        "warnings": 0,
        "preflight": [],
        "updatedAt": "2026-11-27T09:00:00+00:00",
        "confirm": {"path": "/publish/history", "hint": "仍需人工确认"},
    }
    base.update(overrides)
    return base


@pytest.fixture
def req():
    return SimpleNamespace(state=SimpleNamespace(user_id="user-1"))


@pytest.fixture
def fake_tool(monkeypatch):
    state: dict[str, Any] = {"result": _ok_result(), "captured": None}

    async def _tool(arguments):
        state["captured"] = arguments
        return state["result"]

    monkeypatch.setattr(publish_tools, "update_publish_draft", _tool)
    return state


async def test_update_draft_route_merges_explicit_fields(req, fake_tool):
    body = publish_router.DraftUpdateRequest(title="新标题", text="新正文")
    res = await publish_router.update_draft("pub-1", req, body)
    assert res["code"] == 0
    assert res["data"]["taskId"] == "pub-1"
    assert res["data"]["status"] == "draft"
    assert res["data"]["changedFields"] == ["text", "title"]
    captured = fake_tool["captured"]
    assert captured["task_id"] == "pub-1"
    assert captured["__user_id"] == "user-1"
    assert captured["title"] == "新标题"
    assert captured["text"] == "新正文"
    assert "format" not in captured
    assert "targets" not in captured


async def test_update_draft_route_turns_preflight_block_into_409(req, fake_tool):
    fake_tool["result"] = {
        "tool": "update_publish_draft",
        "ok": False,
        "errorCode": "PREFLIGHT_BLOCKED",
        "message": "预检未通过",
        "taskId": "pub-1",
        "blocked": 2,
        "warnings": 1,
        "contentCheck": {"blocking": 1},
        "targets": [{"platform": "douyin", "accountId": 7, "ok": False}],
    }
    with pytest.raises(HTTPException) as exc_info:
        await publish_router.update_draft("pub-1", req, publish_router.DraftUpdateRequest(title="带#标题"))
    assert exc_info.value.status_code == 409
    assert exc_info.value.detail["code"] == "PREFLIGHT_BLOCKED"
    assert exc_info.value.detail["blocked"] == 2
    assert exc_info.value.detail["contentCheck"]["blocking"] == 1


async def test_update_draft_route_non_draft_is_409(req, fake_tool):
    fake_tool["result"] = {
        "tool": "update_publish_draft",
        "ok": False,
        "errorCode": "NOT_DRAFT",
        "message": "只有草稿可以编辑",
    }
    with pytest.raises(HTTPException) as exc_info:
        await publish_router.update_draft("pub-1", req, publish_router.DraftUpdateRequest(title="新标题"))
    assert exc_info.value.status_code == 409


async def test_update_draft_route_missing_task_is_404(req, fake_tool):
    fake_tool["result"] = {
        "tool": "update_publish_draft",
        "ok": False,
        "errorCode": "TASK_NOT_FOUND",
        "message": "草稿不存在或不属于当前用户",
    }
    with pytest.raises(HTTPException) as exc_info:
        await publish_router.update_draft("pub-404", req, publish_router.DraftUpdateRequest(title="新标题"))
    assert exc_info.value.status_code == 404
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
