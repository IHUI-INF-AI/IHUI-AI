# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

"""P3-01/P3-02 总管对话：人格与三工具由服务端固定，不由请求体决定。"""

from __future__ import annotations

from typing import Any

import pytest
from starlette.requests import Request

from app.agents.master_profile import MASTER_SYSTEM_PROMPT, MASTER_TOOL_NAMES
from app.api.v1 import master_chat as module
from app.api.v1.master_chat import MasterChatRequest, master_chat


@pytest.mark.asyncio
async def test_master_chat_pins_persona_and_tools(monkeypatch: pytest.MonkeyPatch) -> None:
    captured: dict[str, Any] = {}

    async def fake_require(_request: Request) -> str:
        return "user-1"

    async def fake_chat(**kwargs: Any) -> object:
        captured.update(kwargs)
        return object()

    monkeypatch.setattr(module, "require_request_user_id", fake_require)
    monkeypatch.setattr(module.conversation_service, "chat", fake_chat)
    monkeypatch.setattr(
        module.conversation_service,
        "result_to_dict",
        lambda _result: {"final_response": "已处理", "trace": []},
    )
    monkeypatch.setattr(module, "scan_output", lambda _text: None)
    monkeypatch.setattr(module, "annotate_ai_generated", lambda data: data)
    monkeypatch.setattr(module, "default_chat_model", lambda: "agnes/master-default")

    request = Request({"type": "http", "method": "POST", "path": "/api/v1/ai/master/chat"})
    body = await master_chat(MasterChatRequest(message="列一下我的智能体"), request)

    assert body["data"]["persona"] == "master"
    assert body["data"]["tools"] == list(MASTER_TOOL_NAMES)
    assert captured["allowed_tools"] == list(MASTER_TOOL_NAMES)
    assert captured["system_prompt"] == MASTER_SYSTEM_PROMPT
    assert captured["user_id"] == "user-1"
    assert captured["model"] == "agnes/master-default"


@pytest.mark.asyncio
async def test_master_chat_keeps_explicit_model(monkeypatch: pytest.MonkeyPatch) -> None:
    captured: dict[str, Any] = {}

    async def fake_require(_request: Request) -> str:
        return "user-1"

    async def fake_chat(**kwargs: Any) -> object:
        captured.update(kwargs)
        return object()

    monkeypatch.setattr(module, "require_request_user_id", fake_require)
    monkeypatch.setattr(module.conversation_service, "chat", fake_chat)
    monkeypatch.setattr(
        module.conversation_service,
        "result_to_dict",
        lambda _result: {"final_response": "已处理", "trace": []},
    )
    monkeypatch.setattr(module, "scan_output", lambda _text: None)
    monkeypatch.setattr(module, "annotate_ai_generated", lambda data: data)
    monkeypatch.setattr(module, "default_chat_model", lambda: "agnes/master-default")

    request = Request({"type": "http", "method": "POST", "path": "/api/v1/ai/master/chat"})
    await master_chat(
        MasterChatRequest(message="列一下我的智能体", model="agnes/explicit"), request
    )

    assert captured["model"] == "agnes/explicit"


@pytest.mark.asyncio
async def test_master_chat_rejects_empty_message() -> None:
    with pytest.raises(ValueError):
        MasterChatRequest(message="")
