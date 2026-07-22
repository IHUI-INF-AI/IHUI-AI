"""图像模块 — 文生图 / 编辑 / 修复 / 风格迁移 / 虚拟试穿 / 背景生成。

端点(6 个):
- POST /v1/images/generations
- POST /v1/images/edits
- POST /v1/images/inpaint
- POST /v1/images/style-transfer
- POST /v1/images/virtual-try-on
- POST /v1/images/background
"""

from __future__ import annotations

from ..async_base import AsyncBaseClient
from ..base import BaseClient
from ..types import (
    V1BackgroundGenerationRequest,
    V1ImageEditsRequest,
    V1ImageGenerationsRequest,
    V1ImageGenerationsResponse,
    V1ImageInpaintRequest,
    V1StyleTransferRequest,
    V1VirtualTryOnRequest,
)


class ImagesApi:
    """图像模块(同步)— 文生图 / 编辑 / 修复 / 风格迁移 / 虚拟试穿 / 背景。"""

    def __init__(self, client: BaseClient) -> None:
        self._client = client

    def generations(self, req: V1ImageGenerationsRequest) -> V1ImageGenerationsResponse:
        """POST /v1/images/generations(文生图)。"""
        return self._client.request("POST", "/images/generations", req)

    def edits(self, req: V1ImageEditsRequest) -> V1ImageGenerationsResponse:
        """POST /v1/images/edits(图片编辑)。"""
        return self._client.request("POST", "/images/edits", req)

    def inpaint(self, req: V1ImageInpaintRequest) -> V1ImageGenerationsResponse:
        """POST /v1/images/inpaint(图片修复)。"""
        return self._client.request("POST", "/images/inpaint", req)

    def style_transfer(self, req: V1StyleTransferRequest) -> V1ImageGenerationsResponse:
        """POST /v1/images/style-transfer(风格迁移)。"""
        return self._client.request("POST", "/images/style-transfer", req)

    def virtual_try_on(self, req: V1VirtualTryOnRequest) -> V1ImageGenerationsResponse:
        """POST /v1/images/virtual-try-on(虚拟试穿)。"""
        return self._client.request("POST", "/images/virtual-try-on", req)

    def background(self, req: V1BackgroundGenerationRequest) -> V1ImageGenerationsResponse:
        """POST /v1/images/background(背景生成)。"""
        return self._client.request("POST", "/images/background", req)


class AsyncImagesApi:
    """图像模块(asyncio)— 文生图 / 编辑 / 修复 / 风格迁移 / 虚拟试穿 / 背景。"""

    def __init__(self, client: AsyncBaseClient) -> None:
        self._client = client

    async def generations(self, req: V1ImageGenerationsRequest) -> V1ImageGenerationsResponse:
        """POST /v1/images/generations(文生图)。"""
        return await self._client.request("POST", "/images/generations", req)

    async def edits(self, req: V1ImageEditsRequest) -> V1ImageGenerationsResponse:
        """POST /v1/images/edits(图片编辑)。"""
        return await self._client.request("POST", "/images/edits", req)

    async def inpaint(self, req: V1ImageInpaintRequest) -> V1ImageGenerationsResponse:
        """POST /v1/images/inpaint(图片修复)。"""
        return await self._client.request("POST", "/images/inpaint", req)

    async def style_transfer(self, req: V1StyleTransferRequest) -> V1ImageGenerationsResponse:
        """POST /v1/images/style-transfer(风格迁移)。"""
        return await self._client.request("POST", "/images/style-transfer", req)

    async def virtual_try_on(self, req: V1VirtualTryOnRequest) -> V1ImageGenerationsResponse:
        """POST /v1/images/virtual-try-on(虚拟试穿)。"""
        return await self._client.request("POST", "/images/virtual-try-on", req)

    async def background(self, req: V1BackgroundGenerationRequest) -> V1ImageGenerationsResponse:
        """POST /v1/images/background(背景生成)。"""
        return await self._client.request("POST", "/images/background", req)


__all__ = ["ImagesApi", "AsyncImagesApi"]
