# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

"""P3-04 agent_registry：动作映射、删除只发审批、错误封闭。"""

from __future__ import annotations

import json
from typing import Any

import httpx
import pytest

from app.services.master_tools.registry import AgentRegistryTool


def _tool(handler) -> AgentRegistryTool:  # type: ignore[no-untyped-def]
    return AgentRegistryTool(
        base_url="http://test",
        transport=httpx.MockTransport(handler),
    )


@pytest.mark.asyncio
async def test_list_builds_payload_and_unwraps_result() -> None:
    captured: dict[str, Any] = {}

    def handler(request: httpx.Request) -> httpx.Response:
        captured.update(json.loads(request.content))
        return httpx.Response(
            200,
            json={
                "code": 0,
                "message": "success",
                "data": {
                    "action": "list",
                    "result": {
                        "list": [
                            {
                                "id": "def-1",
                                "name": "reviewer",
                                "displayName": "评审",
                                "scope": "system",
                                "status": "active",
                                "isDispatchable": True,
                                "version": 2,
                                "updatedAt": "2026-11-28T00:00:00.000Z",
                                "description": "不应出现在列表摘要里",
                            }
                        ],
                        "total": 11,
                        "nextCursor": None,
                    },
                },
            },
        )

    tool = _tool(handler)
    envelope = await tool.handle(
        {"action": "list", "limit": 5, "query": "reviewer", "unexpected": "drop"},
        user_id="user-1",
    )

    assert envelope["ok"] is True
    assert envelope["data"]["total"] == 11
    assert envelope["data"]["count"] == 1
    assert envelope["data"]["items"][0]["name"] == "reviewer"
    assert "description" not in envelope["data"]["items"][0]
    assert captured == {"action": "list", "limit": 5, "query": "reviewer"}
    assert "requestId" in envelope["meta"]


@pytest.mark.asyncio
async def test_delete_returns_approval_required_not_success() -> None:
    def handler(_request: httpx.Request) -> httpx.Response:
        return httpx.Response(
            202,
            json={
                "code": 0,
                "message": "success",
                "data": {
                    "action": "delete",
                    "result": {"id": "appr-1", "status": "pending", "impactHash": "sha256:x"},
                },
            },
        )

    tool = _tool(handler)
    envelope = await tool.handle(
        {"action": "delete", "id": "def-1", "precheckToken": "pc_token"},
        user_id="user-1",
    )

    assert envelope["ok"] is False
    assert envelope["error"]["code"] == "APPROVAL_REQUIRED"
    assert envelope["error"]["details"]["approvalId"] == "appr-1"


@pytest.mark.asyncio
async def test_api_error_is_wrapped() -> None:
    def handler(_request: httpx.Request) -> httpx.Response:
        return httpx.Response(
            403,
            json={"code": 403, "message": "无权", "errorCode": "AGENT_FORBIDDEN"},
        )

    envelope = await _tool(handler).handle({"action": "create", "name": "x"}, user_id="user-1")

    assert envelope["ok"] is False
    assert envelope["error"]["code"] == "AGENT_FORBIDDEN"
    assert envelope["error"]["retryable"] is False


@pytest.mark.asyncio
async def test_network_error_is_retryable() -> None:
    def handler(_request: httpx.Request) -> httpx.Response:
        raise httpx.ConnectError("down")

    envelope = await _tool(handler).handle({"action": "list"}, user_id="user-1")

    assert envelope["ok"] is False
    assert envelope["error"]["code"] == "STORAGE_UNAVAILABLE"
    assert envelope["error"]["retryable"] is True


@pytest.mark.asyncio
async def test_unknown_action_is_rejected_before_http() -> None:
    calls = 0

    def handler(_request: httpx.Request) -> httpx.Response:
        nonlocal calls
        calls += 1
        return httpx.Response(200, json={"code": 0, "data": {"result": None}})

    envelope = await _tool(handler).handle({"action": "purge"}, user_id="user-1")

    assert calls == 0
    assert envelope["error"]["code"] == "AGENT_ACTION_INVALID"
