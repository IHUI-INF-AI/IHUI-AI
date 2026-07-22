"""记忆模块 — 保存 / 召回 / 搜索 / Dream / 遗忘 / 分类记忆。

端点(8 个):
- POST   /v1/memory(保存记忆)
- GET    /v1/memory(召回记忆)
- POST   /v1/memory/search(语义搜索)
- POST   /v1/memory/dream(Dream 梦境系统)
- DELETE /v1/memory(遗忘记忆)
- GET    /v1/memory/working(工作记忆)
- GET    /v1/memory/episodic(情景记忆)
- GET    /v1/memory/procedural(程序记忆)
"""

from __future__ import annotations

from ..async_base import AsyncBaseClient
from ..base import BaseClient
from ..types import (
    V1EpisodicMemoryResponse,
    V1ForgetMemoryRequest,
    V1ForgetMemoryResponse,
    V1MemoryDreamRequest,
    V1MemoryDreamResponse,
    V1MemorySearchRequest,
    V1MemorySearchResponse,
    V1ProceduralMemoryResponse,
    V1RecallMemoryResponse,
    V1SaveMemoryRequest,
    V1SaveMemoryResponse,
    V1WorkingMemoryResponse,
)


class MemoryApi:
    """记忆模块(同步)— 保存 / 召回 / 搜索 / Dream / 遗忘 / 分类记忆。"""

    def __init__(self, client: BaseClient) -> None:
        self._client = client

    def save(self, req: V1SaveMemoryRequest) -> V1SaveMemoryResponse:
        """POST /v1/memory(保存记忆)。"""
        return self._client.request("POST", "/memory", req)

    def recall(self) -> V1RecallMemoryResponse:
        """GET /v1/memory(召回记忆)。"""
        return self._client.request("GET", "/memory")

    def search(self, req: V1MemorySearchRequest) -> V1MemorySearchResponse:
        """POST /v1/memory/search(语义搜索)。"""
        return self._client.request("POST", "/memory/search", req)

    def dream(self, req: V1MemoryDreamRequest | None = None) -> V1MemoryDreamResponse:
        """POST /v1/memory/dream(Dream 梦境系统)。"""
        return self._client.request("POST", "/memory/dream", req or {})

    def forget(self, req: V1ForgetMemoryRequest) -> V1ForgetMemoryResponse:
        """DELETE /v1/memory(遗忘记忆)。"""
        return self._client.request("DELETE", "/memory", req)

    def working(self) -> V1WorkingMemoryResponse:
        """GET /v1/memory/working(工作记忆)。"""
        return self._client.request("GET", "/memory/working")

    def episodic(self) -> V1EpisodicMemoryResponse:
        """GET /v1/memory/episodic(情景记忆)。"""
        return self._client.request("GET", "/memory/episodic")

    def procedural(self) -> V1ProceduralMemoryResponse:
        """GET /v1/memory/procedural(程序记忆)。"""
        return self._client.request("GET", "/memory/procedural")


class AsyncMemoryApi:
    """记忆模块(asyncio)— 保存 / 召回 / 搜索 / Dream / 遗忘 / 分类记忆。"""

    def __init__(self, client: AsyncBaseClient) -> None:
        self._client = client

    async def save(self, req: V1SaveMemoryRequest) -> V1SaveMemoryResponse:
        """POST /v1/memory(保存记忆)。"""
        return await self._client.request("POST", "/memory", req)

    async def recall(self) -> V1RecallMemoryResponse:
        """GET /v1/memory(召回记忆)。"""
        return await self._client.request("GET", "/memory")

    async def search(self, req: V1MemorySearchRequest) -> V1MemorySearchResponse:
        """POST /v1/memory/search(语义搜索)。"""
        return await self._client.request("POST", "/memory/search", req)

    async def dream(self, req: V1MemoryDreamRequest | None = None) -> V1MemoryDreamResponse:
        """POST /v1/memory/dream(Dream 梦境系统)。"""
        return await self._client.request("POST", "/memory/dream", req or {})

    async def forget(self, req: V1ForgetMemoryRequest) -> V1ForgetMemoryResponse:
        """DELETE /v1/memory(遗忘记忆)。"""
        return await self._client.request("DELETE", "/memory", req)

    async def working(self) -> V1WorkingMemoryResponse:
        """GET /v1/memory/working(工作记忆)。"""
        return await self._client.request("GET", "/memory/working")

    async def episodic(self) -> V1EpisodicMemoryResponse:
        """GET /v1/memory/episodic(情景记忆)。"""
        return await self._client.request("GET", "/memory/episodic")

    async def procedural(self) -> V1ProceduralMemoryResponse:
        """GET /v1/memory/procedural(程序记忆)。"""
        return await self._client.request("GET", "/memory/procedural")


__all__ = ["MemoryApi", "AsyncMemoryApi"]
