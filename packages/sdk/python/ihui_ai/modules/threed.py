"""3D 模型生成模块。

端点(1 个):
- POST /v1/3d/generations
"""

from __future__ import annotations

from ..async_base import AsyncBaseClient
from ..base import BaseClient
from ..types import V1ThreeDGenerationsRequest, V1ThreeDGenerationsResponse


class ThreeDApi:
    """3D 模型生成模块(同步)。"""

    def __init__(self, client: BaseClient) -> None:
        self._client = client

    def generations(self, req: V1ThreeDGenerationsRequest) -> V1ThreeDGenerationsResponse:
        """POST /v1/3d/generations(3D 模型生成)。"""
        return self._client.request("POST", "/3d/generations", req)


class AsyncThreeDApi:
    """3D 模型生成模块(asyncio)。"""

    def __init__(self, client: AsyncBaseClient) -> None:
        self._client = client

    async def generations(self, req: V1ThreeDGenerationsRequest) -> V1ThreeDGenerationsResponse:
        """POST /v1/3d/generations(3D 模型生成)。"""
        return await self._client.request("POST", "/3d/generations", req)


__all__ = ["ThreeDApi", "AsyncThreeDApi"]
