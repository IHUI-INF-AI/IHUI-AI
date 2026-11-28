# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

"""总管运行控制 HTTP 面：显式 runId 的 pause/resume/talk/stop。"""

from __future__ import annotations

from typing import Any

import pytest
from fastapi import HTTPException
from starlette.requests import Request

from app.api.v1 import master_runs as module
from app.api.v1.master_runs import RunTalkRequest


class _FakeTool:
    def __init__(self, reply: dict[str, Any]) -> None:
        self.reply = reply
        self.calls: list[tuple[dict[str, Any], str]] = []

    async def handle(self, arguments: dict[str, Any], *, user_id: str) -> dict[str, Any]:
        self.calls.append((arguments, user_id))
        return self.reply


def _request() -> Request:
    return Request({"type": "http", "method": "POST", "path": "/api/v1/ai/master/runs/x"})


@pytest.mark.asyncio
async def test_pause_run_returns_tool_data(monkeypatch: pytest.MonkeyPatch) -> None:
    async def fake_principal(_request: Request) -> str:
        return "user-1"

    tool = _FakeTool(
        {"ok": True, "data": {"outcome": "paused", "runStatus": "paused"}}
    )
    monkeypatch.setattr(module, "require_request_user_id", fake_principal)
    monkeypatch.setattr(module, "agent_ops_tool", tool)

    result = await module.pause_run("run-1", _request())

    assert result == {
        "code": 0,
        "message": "ok",
        "data": {"outcome": "paused", "runStatus": "paused"},
    }
    assert tool.calls == [({"action": "run_pause", "runId": "run-1"}, "user-1")]


@pytest.mark.asyncio
async def test_talk_run_passes_message_only(monkeypatch: pytest.MonkeyPatch) -> None:
    async def fake_principal(_request: Request) -> str:
        return "user-1"

    tool = _FakeTool(
        {"ok": True, "data": {"outcome": "queued", "delivery": "next_iteration"}}
    )
    monkeypatch.setattr(module, "require_request_user_id", fake_principal)
    monkeypatch.setattr(module, "agent_ops_tool", tool)

    result = await module.talk_run("run-1", RunTalkRequest(message="补充风险点"), _request())

    assert result["data"]["outcome"] == "queued"
    assert tool.calls == [
        (
            {
                "action": "run_talk",
                "runId": "run-1",
                "message": "补充风险点",
            },
            "user-1",
        )
    ]


@pytest.mark.asyncio
async def test_tool_error_maps_to_http_status(monkeypatch: pytest.MonkeyPatch) -> None:
    async def fake_principal(_request: Request) -> str:
        return "user-1"

    tool = _FakeTool(
        {
            "ok": False,
            "error": {"code": "AGENT_RUN_NOT_PAUSED", "message": "只有 paused 才能续跑"},
        }
    )
    monkeypatch.setattr(module, "require_request_user_id", fake_principal)
    monkeypatch.setattr(module, "agent_ops_tool", tool)

    with pytest.raises(HTTPException) as exc_info:
        await module.resume_run("run-1", _request())

    assert exc_info.value.status_code == 409
    assert exc_info.value.detail == {
        "code": "AGENT_RUN_NOT_PAUSED",
        "message": "只有 paused 才能续跑",
    }
