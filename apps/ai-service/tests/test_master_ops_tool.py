# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

"""P3-05 agent_ops：只读面、未实现动作明确拒绝、HTTP 错误封闭。"""

from __future__ import annotations

import json
from typing import Any

import httpx
import pytest

from app.services.master_tools.ops import AgentOpsTool


def _tool(handler) -> AgentOpsTool:  # type: ignore[no-untyped-def]
    return AgentOpsTool(base_url="http://test", transport=httpx.MockTransport(handler))


@pytest.mark.asyncio
async def test_run_get_reads_result() -> None:
    captured: dict[str, Any] = {}

    def handler(request: httpx.Request) -> httpx.Response:
        captured.update(json.loads(request.content))
        return httpx.Response(
            200,
            json={"code": 0, "data": {"action": "run_get", "result": {"id": "run-1", "status": "running"}}},
        )

    envelope = await _tool(handler).handle({"action": "run_get", "runId": "run-1"}, user_id="user-1")

    assert envelope["ok"] is True
    assert envelope["data"]["status"] == "running"
    assert captured == {"action": "run_get", "runId": "run-1"}


@pytest.mark.asyncio
async def test_dispatch_not_implemented_is_explicit() -> None:
    envelope = await _tool(lambda _r: httpx.Response(200, json={"code": 0})).handle(
        {"action": "dispatch", "definitionId": "def-1", "goal": "做一件小事"},
        user_id="user-1",
    )

    assert envelope["ok"] is False
    assert envelope["error"]["code"] == "AGENT_ACTION_NOT_IMPLEMENTED"


@pytest.mark.asyncio
async def test_http_error_maps_code_and_retryable() -> None:
    def handler(_request: httpx.Request) -> httpx.Response:
        return httpx.Response(503, json={"code": 503, "message": "库挂了", "errorCode": "STORAGE_UNAVAILABLE"})

    envelope = await _tool(handler).handle({"action": "run_list", "definitionId": "def-1"}, user_id="user-1")

    assert envelope["error"]["code"] == "STORAGE_UNAVAILABLE"
    assert envelope["error"]["retryable"] is True


@pytest.mark.asyncio
async def test_health_is_passthrough() -> None:
    def handler(_request: httpx.Request) -> httpx.Response:
        return httpx.Response(200, json={"code": 0, "data": {"action": "health", "result": {"ok": True}}})

    envelope = await _tool(handler).handle({"action": "health"}, user_id="user-1")

    assert envelope["ok"] is True
    assert envelope["data"] == {"ok": True}
