"""视频模块 — 生成 / 任务查询 / 编排。

端点(3 个):
- POST /v1/videos/generations
- GET  /v1/videos/tasks/:id
- POST /v1/videos/compose
"""

from __future__ import annotations

from urllib.parse import quote

from ..async_base import AsyncBaseClient
from ..base import BaseClient
from ..types import (
    V1VideoComposeRequest,
    V1VideoComposeResponse,
    V1VideoGenerationsRequest,
    V1VideoGenerationsResponse,
    V1VideoTaskResponse,
)


class VideosApi:
    """视频模块(同步)— 生成 / 任务查询 / 编排。"""

    def __init__(self, client: BaseClient) -> None:
        self._client = client

    def generations(self, req: V1VideoGenerationsRequest) -> V1VideoGenerationsResponse:
        """POST /v1/videos/generations(视频生成,异步任务)。"""
        return self._client.request("POST", "/videos/generations", req)

    def get_task(self, task_id: str) -> V1VideoTaskResponse:
        """GET /v1/videos/tasks/:id(查询视频任务状态)。"""
        return self._client.request("GET", f"/videos/tasks/{quote(task_id, safe='')}")

    def compose(self, req: V1VideoComposeRequest) -> V1VideoComposeResponse:
        """POST /v1/videos/compose(视频编排)。"""
        return self._client.request("POST", "/videos/compose", req)


class AsyncVideosApi:
    """视频模块(asyncio)— 生成 / 任务查询 / 编排。"""

    def __init__(self, client: AsyncBaseClient) -> None:
        self._client = client

    async def generations(self, req: V1VideoGenerationsRequest) -> V1VideoGenerationsResponse:
        """POST /v1/videos/generations(视频生成,异步任务)。"""
        return await self._client.request("POST", "/videos/generations", req)

    async def get_task(self, task_id: str) -> V1VideoTaskResponse:
        """GET /v1/videos/tasks/:id(查询视频任务状态)。"""
        return await self._client.request("GET", f"/videos/tasks/{quote(task_id, safe='')}")

    async def compose(self, req: V1VideoComposeRequest) -> V1VideoComposeResponse:
        """POST /v1/videos/compose(视频编排)。"""
        return await self._client.request("POST", "/videos/compose", req)


__all__ = ["VideosApi", "AsyncVideosApi"]
