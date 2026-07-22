"""生成队列模块 — 入队 / 状态查询 / 取消。

端点(3 个):
- POST /v1/generation/enqueue
- GET  /v1/generation/status/:id
- POST /v1/generation/cancel/:id
"""

from __future__ import annotations

from urllib.parse import quote

from ..async_base import AsyncBaseClient
from ..base import BaseClient
from ..types import (
    V1GenerationCancelResponse,
    V1GenerationEnqueueRequest,
    V1GenerationEnqueueResponse,
    V1GenerationStatusResponse,
)


class GenerationApi:
    """生成队列模块(同步)— 入队 / 状态 / 取消。"""

    def __init__(self, client: BaseClient) -> None:
        self._client = client

    def enqueue(self, req: V1GenerationEnqueueRequest) -> V1GenerationEnqueueResponse:
        """POST /v1/generation/enqueue(入队生成任务)。"""
        return self._client.request("POST", "/generation/enqueue", req)

    def get_status(self, job_id: str) -> V1GenerationStatusResponse:
        """GET /v1/generation/status/:id(查询生成状态)。"""
        return self._client.request("GET", f"/generation/status/{quote(job_id, safe='')}")

    def cancel(self, job_id: str) -> V1GenerationCancelResponse:
        """POST /v1/generation/cancel/:id(取消生成任务)。"""
        return self._client.request("POST", f"/generation/cancel/{quote(job_id, safe='')}")


class AsyncGenerationApi:
    """生成队列模块(asyncio)— 入队 / 状态 / 取消。"""

    def __init__(self, client: AsyncBaseClient) -> None:
        self._client = client

    async def enqueue(self, req: V1GenerationEnqueueRequest) -> V1GenerationEnqueueResponse:
        """POST /v1/generation/enqueue(入队生成任务)。"""
        return await self._client.request("POST", "/generation/enqueue", req)

    async def get_status(self, job_id: str) -> V1GenerationStatusResponse:
        """GET /v1/generation/status/:id(查询生成状态)。"""
        return await self._client.request("GET", f"/generation/status/{quote(job_id, safe='')}")

    async def cancel(self, job_id: str) -> V1GenerationCancelResponse:
        """POST /v1/generation/cancel/:id(取消生成任务)。"""
        return await self._client.request("POST", f"/generation/cancel/{quote(job_id, safe='')}")


__all__ = ["GenerationApi", "AsyncGenerationApi"]
