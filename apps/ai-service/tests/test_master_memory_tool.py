# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

"""P3-06 master_memory：用户作用域、显式写入、遗忘归属校验。"""

from __future__ import annotations

from typing import Any

import pytest

from app.services.master_tools.memory import MasterMemoryTool


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
async def test_team_scope_is_explicitly_unsupported() -> None:
    envelope = await MasterMemoryTool(FakeMemoryService()).handle(
        {"action": "memory_search", "query": "决策", "scope": "team"},
        user_id="user-1",
    )

    assert envelope["error"]["code"] == "MEMORY_SCOPE_UNSUPPORTED"
