"""AI 核心模块 — chat / embeddings / models / moa。

端点(13 个):
- POST /v1/chat/completions(非流式 + 流式)
- POST /v1/embeddings
- POST /v1/chat/vision
- POST /v1/chat/moa
- GET  /v1/models
- GET  /v1/models/:id
- GET  /v1/vendors/:vendor/models
- GET  /v1/moa-presets
- POST /v1/moa-presets
- GET/POST/PUT/DELETE /v1/user/models
"""

from __future__ import annotations

from collections.abc import AsyncIterator, Iterator
from typing import TYPE_CHECKING
from urllib.parse import quote

from ..base import BaseClient
from ..async_base import AsyncBaseClient
from ..streaming import parse_chat_stream_async, parse_chat_stream_sync
from ..types import (
    ChatStreamChunk,
    V1ChatCompletionRequest,
    V1ChatCompletionResponse,
    V1ChatMoaRequest,
    V1ChatMoaResponse,
    V1ChatVisionRequest,
    V1ChatVisionResponse,
    V1CreateMoaPresetRequest,
    V1CreateUserModelRequest,
    V1EmbeddingsRequest,
    V1EmbeddingsResponse,
    V1ModelInfo,
    V1ModelsResponse,
    V1MoaPresetsResponse,
    V1UserModelConfig,
    V1UserModelsResponse,
    V1VendorModelsResponse,
)

if TYPE_CHECKING:
    pass


class AiApi:
    """AI 核心模块(同步)— chat / embeddings / models / moa。"""

    def __init__(self, client: BaseClient) -> None:
        self._client = client

    def completions(self, req: V1ChatCompletionRequest) -> V1ChatCompletionResponse:
        """POST /v1/chat/completions(非流式)。"""
        return self._client.request("POST", "/chat/completions", req)

    def completions_stream(self, req: V1ChatCompletionRequest) -> Iterator[ChatStreamChunk]:
        """POST /v1/chat/completions(stream:true)→ 生成器,yield ChatStreamChunk。"""
        stream_req = {**req, "stream": True}
        byte_iter = self._client.request_stream("POST", "/chat/completions", stream_req)
        yield from parse_chat_stream_sync(byte_iter)

    def embeddings(self, req: V1EmbeddingsRequest) -> V1EmbeddingsResponse:
        """POST /v1/embeddings。"""
        return self._client.request("POST", "/embeddings", req)

    def chat_vision(self, req: V1ChatVisionRequest) -> V1ChatVisionResponse:
        """POST /v1/chat/vision(视觉理解)。"""
        return self._client.request("POST", "/chat/vision", req)

    def chat_moa(self, req: V1ChatMoaRequest) -> V1ChatMoaResponse:
        """POST /v1/chat/moa(Mixture of Agents)。"""
        return self._client.request("POST", "/chat/moa", req)

    def list_models(self) -> V1ModelsResponse:
        """GET /v1/models(模型列表)。"""
        return self._client.request("GET", "/models")

    def get_model(self, model_id: str) -> V1ModelInfo:
        """GET /v1/models/:id(模型详情)。"""
        return self._client.request("GET", f"/models/{quote(model_id, safe='')}")

    def list_vendor_models(self, vendor: str) -> V1VendorModelsResponse:
        """GET /v1/vendors/:vendor/models(厂商模型列表)。"""
        return self._client.request("GET", f"/vendors/{quote(vendor, safe='')}/models")

    def list_moa_presets(self) -> V1MoaPresetsResponse:
        """GET /v1/moa-presets(MoA 预设列表)。"""
        return self._client.request("GET", "/moa-presets")

    def create_moa_preset(self, req: V1CreateMoaPresetRequest) -> V1MoaPresetsResponse:
        """POST /v1/moa-presets(创建 MoA 预设)。"""
        return self._client.request("POST", "/moa-presets", req)

    def list_user_models(self) -> V1UserModelsResponse:
        """GET /v1/user/models(用户自定义模型列表)。"""
        return self._client.request("GET", "/user/models")

    def create_user_model(self, req: V1CreateUserModelRequest) -> V1UserModelConfig:
        """POST /v1/user/models(创建用户自定义模型)。"""
        return self._client.request("POST", "/user/models", req)

    def update_user_model(self, model_id: str, req: V1CreateUserModelRequest) -> V1UserModelConfig:
        """PUT /v1/user/models/:id(更新用户自定义模型)。"""
        return self._client.request("PUT", f"/user/models/{quote(model_id, safe='')}", req)

    def delete_user_model(self, model_id: str) -> None:
        """DELETE /v1/user/models/:id(删除用户自定义模型)。"""
        self._client.request("DELETE", f"/user/models/{quote(model_id, safe='')}")


class AsyncAiApi:
    """AI 核心模块(asyncio)— chat / embeddings / models / moa。"""

    def __init__(self, client: AsyncBaseClient) -> None:
        self._client = client

    async def completions(self, req: V1ChatCompletionRequest) -> V1ChatCompletionResponse:
        """POST /v1/chat/completions(非流式)。"""
        return await self._client.request("POST", "/chat/completions", req)

    async def completions_stream(self, req: V1ChatCompletionRequest) -> AsyncIterator[ChatStreamChunk]:
        """POST /v1/chat/completions(stream:true)→ 异步生成器。"""
        stream_req = {**req, "stream": True}
        reader = await self._client.request_stream("POST", "/chat/completions", stream_req)
        async for chunk in parse_chat_stream_async(reader):
            yield chunk

    async def embeddings(self, req: V1EmbeddingsRequest) -> V1EmbeddingsResponse:
        """POST /v1/embeddings。"""
        return await self._client.request("POST", "/embeddings", req)

    async def chat_vision(self, req: V1ChatVisionRequest) -> V1ChatVisionResponse:
        """POST /v1/chat/vision(视觉理解)。"""
        return await self._client.request("POST", "/chat/vision", req)

    async def chat_moa(self, req: V1ChatMoaRequest) -> V1ChatMoaResponse:
        """POST /v1/chat/moa(Mixture of Agents)。"""
        return await self._client.request("POST", "/chat/moa", req)

    async def list_models(self) -> V1ModelsResponse:
        """GET /v1/models(模型列表)。"""
        return await self._client.request("GET", "/models")

    async def get_model(self, model_id: str) -> V1ModelInfo:
        """GET /v1/models/:id(模型详情)。"""
        return await self._client.request("GET", f"/models/{quote(model_id, safe='')}")

    async def list_vendor_models(self, vendor: str) -> V1VendorModelsResponse:
        """GET /v1/vendors/:vendor/models(厂商模型列表)。"""
        return await self._client.request("GET", f"/vendors/{quote(vendor, safe='')}/models")

    async def list_moa_presets(self) -> V1MoaPresetsResponse:
        """GET /v1/moa-presets(MoA 预设列表)。"""
        return await self._client.request("GET", "/moa-presets")

    async def create_moa_preset(self, req: V1CreateMoaPresetRequest) -> V1MoaPresetsResponse:
        """POST /v1/moa-presets(创建 MoA 预设)。"""
        return await self._client.request("POST", "/moa-presets", req)

    async def list_user_models(self) -> V1UserModelsResponse:
        """GET /v1/user/models(用户自定义模型列表)。"""
        return await self._client.request("GET", "/user/models")

    async def create_user_model(self, req: V1CreateUserModelRequest) -> V1UserModelConfig:
        """POST /v1/user/models(创建用户自定义模型)。"""
        return await self._client.request("POST", "/user/models", req)

    async def update_user_model(self, model_id: str, req: V1CreateUserModelRequest) -> V1UserModelConfig:
        """PUT /v1/user/models/:id(更新用户自定义模型)。"""
        return await self._client.request("PUT", f"/user/models/{quote(model_id, safe='')}", req)

    async def delete_user_model(self, model_id: str) -> None:
        """DELETE /v1/user/models/:id(删除用户自定义模型)。"""
        await self._client.request("DELETE", f"/user/models/{quote(model_id, safe='')}")


__all__ = ["AiApi", "AsyncAiApi"]
