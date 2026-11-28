# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

"""P3-06 master_memory：用户作用域、团队作用域内部票、显式写入、遗忘归属校验。"""

from __future__ import annotations

import json
from typing import Any

import httpx
import pytest

from app.core.config import settings
from app.services.master_tools.memory import MasterMemoryTool

SECRET = "unit-test-shared-jwt-secret-0123456789-abcdefgh"
UID = "6b8cd0f6-546f-44c8-853a-5f96edbe08be"
TEAM_ID = "3f2b1c9d-8e7a-4b6c-9d0e-1f2a3b4c5d6e"


@pytest.fixture()
def with_jwt_secret(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(settings, "jwt_secret", SECRET, raising=False)
    monkeypatch.delenv("AI_CALLBACK_SECRET", raising=False)


class FakeMemoryService:
    def __init__(self) -> None:
        self.saved: list[dict[str, Any]] = []
        self.deleted: list[tuple[str, str]] = []
        self.exists = True

    async def recall(self, user_id: str, query: str, top_k: int) -> list[dict[str, Any]]:
        return [{"id": "mem-1", "content": f"{query}:{top_k}", "userId": user_id}]

    async def save(self, **kwargs: Any) -> dict[str, Any]:
        self.saved.append(kwargs)
        return {"id": "mem-2", **kwargs}

    async def delete_semantic(self, user_id: str, memory_id: str) -> bool:
        self.deleted.append((user_id, memory_id))
        return self.exists


@pytest.mark.asyncio
async def test_search_returns_items() -> None:
    envelope = await MasterMemoryTool(FakeMemoryService()).handle(
        {"action": "memory_search", "query": "偏好", "limit": 3}, user_id="user-1"
    )

    assert envelope["ok"] is True
    assert envelope["data"]["items"][0]["content"] == "偏好:3"


@pytest.mark.asyncio
async def test_write_forces_semantic_layer_and_metadata() -> None:
    service = FakeMemoryService()
    envelope = await MasterMemoryTool(service).handle(
        {
            "action": "memory_write",
            "content": "用户偏好中文回复",
            "kind": "preference",
            "source": "conversation:1",
            "importance": 0.9,
        },
        user_id="user-1",
    )

    assert envelope["ok"] is True
    saved = service.saved[0]
    assert saved["layer"] == "semantic"
    assert saved["metadata"] == {"kind": "preference", "source": "conversation:1"}
    assert saved["importance_score"] == 0.9


@pytest.mark.asyncio
async def test_forget_rejects_other_users_memory() -> None:
    service = FakeMemoryService()
    service.exists = False
    envelope = await MasterMemoryTool(service).handle(
        {"action": "memory_forget", "memoryId": "mem-1", "reason": "过期"},
        user_id="user-1",
    )

    assert envelope["ok"] is False
    assert envelope["error"]["code"] == "MEMORY_NOT_FOUND"
    assert service.deleted == [("user-1", "mem-1")]


@pytest.mark.asyncio
async def test_agent_scope_is_explicitly_unsupported() -> None:
    envelope = await MasterMemoryTool(FakeMemoryService()).handle(
        {"action": "memory_search", "query": "决策", "scope": "agent"},
        user_id="user-1",
    )

    assert envelope["error"]["code"] == "MEMORY_SCOPE_UNSUPPORTED"


def _team_tool(handler: Any) -> MasterMemoryTool:
    return MasterMemoryTool(
        base_url="http://api.test",
        transport=httpx.MockTransport(handler),
    )


@pytest.mark.asyncio
async def test_team_search_uses_scoped_internal_ticket(with_jwt_secret: None) -> None:
    seen: dict[str, Any] = {}

    def handler(request: httpx.Request) -> httpx.Response:
        seen["url"] = str(request.url)
        seen["headers"] = dict(request.headers)
        return httpx.Response(
            200,
            json={
                "code": 0,
                "message": "success",
                "data": [{"id": "tm-1", "kind": "decision", "title": "发布约定"}],
            },
        )

    tool = _team_tool(handler)
    envelope = await tool.handle(
        {
            "action": "memory_search",
            "scope": "team",
            "scopeId": TEAM_ID,
            "query": "发布",
            "kind": "decision",
            "limit": 3,
        },
        user_id=UID,
    )

    assert envelope["ok"] is True
    assert envelope["data"]["items"][0]["id"] == "tm-1"
    assert envelope["data"]["scopeId"] == TEAM_ID
    assert f"scopeId={TEAM_ID}" in seen["url"]
    assert "keyword=%E5%8F%91%E5%B8%83" in seen["url"]
    assert seen["headers"]["x-user-id"] == UID
    assert seen["headers"]["x-internal-service-ticket"]


@pytest.mark.asyncio
async def test_team_write_maps_summary_to_title_and_rejects_user_kind(
    with_jwt_secret: None,
) -> None:
    seen: dict[str, Any] = {}

    def handler(request: httpx.Request) -> httpx.Response:
        if request.method == "POST":
            seen["body"] = json.loads(request.content)
            return httpx.Response(
                200,
                json={"code": 0, "message": "success", "data": {"id": "tm-2", **seen["body"]}},
            )
        raise AssertionError("unexpected request")

    tool = _team_tool(handler)
    envelope = await tool.handle(
        {
            "action": "memory_write",
            "scope": "team",
            "scopeId": TEAM_ID,
            "kind": "decision",
            "summary": "数据库迁移窗口",
            "content": "迁移必须在低峰期执行。",
            "tags": ["db", "ops"],
        },
        user_id=UID,
    )

    assert envelope["ok"] is True
    assert seen["body"]["title"] == "数据库迁移窗口"
    assert seen["body"]["kind"] == "decision"

    bad = await tool.handle(
        {
            "action": "memory_write",
            "scope": "team",
            "scopeId": TEAM_ID,
            "kind": "preference",
            "content": "x",
        },
        user_id=UID,
    )
    assert bad["ok"] is False
    assert bad["error"]["code"] == "MEMORY_KIND_UNSUPPORTED"


@pytest.mark.asyncio
async def test_team_requires_scope_id_and_maps_forbidden(
    with_jwt_secret: None,
) -> None:
    tool = _team_tool(lambda request: httpx.Response(403, json={"code": 403, "message": "无权"}))
    missing = await tool.handle(
        {"action": "memory_search", "scope": "team", "query": "x"},
        user_id=UID,
    )
    assert missing["error"]["code"] == "MEMORY_SCOPE_ID_REQUIRED"

    forbidden = await tool.handle(
        {"action": "memory_search", "scope": "team", "scopeId": TEAM_ID, "query": "x"},
        user_id=UID,
    )
    assert forbidden["error"]["code"] == "MEMORY_SCOPE_FORBIDDEN"

