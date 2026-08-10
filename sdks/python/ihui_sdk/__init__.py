"""ihui_sdk — IHUI AI Platform Python SDK。

完整封装 105 个 ``/v1/*`` 对外开放 API 端点,提供同步 + asyncio 双版本客户端。

用法:
    from ihui_sdk import create_client

    client = create_client({"apiKey": "ihui_xxx"})
    models = client.ai.list_models()

asyncio 用法:
    import asyncio
    from ihui_sdk import AsyncIhuiClient

    async def main():
        client = AsyncIhuiClient({"apiKey": "ihui_xxx"})
        models = await client.ai.list_models()

    asyncio.run(main())
"""

from __future__ import annotations

__version__ = "0.1.0"

from .async_client import AsyncBaseClient
from .base_client import BaseClient, SdkConfig
from .client import IhuiClient, create_client
from .exceptions import (
    AuthenticationError,
    NetworkError,
    NotFoundError,
    PermissionError,
    QuotaExceededError,
    SdkError,
    ServerError,
)
from .modules import (
    AsyncAgentsApi,
    AsyncAiApi,
    AsyncAudioApi,
    AsyncFilesApi,
    AsyncGenerationApi,
    AsyncImagesApi,
    AsyncKnowledgeApi,
    AsyncMemoryApi,
    AsyncMessagesApi,
    AsyncThreeDApi,
    AsyncToolsApi,
    AsyncUserApi,
    AsyncVideosApi,
)
from .streaming import (
    parse_agent_stream_async,
    parse_agent_stream_sync,
    parse_chat_stream_async,
    parse_chat_stream_sync,
)


class AsyncIhuiClient:
    """IHUI SDK asyncio 客户端,聚合 13 个功能模块。"""

    ai: AsyncAiApi
    agents: AsyncAgentsApi
    audio: AsyncAudioApi
    images: AsyncImagesApi
    videos: AsyncVideosApi
    threed: AsyncThreeDApi
    generation: AsyncGenerationApi
    knowledge: AsyncKnowledgeApi
    tools: AsyncToolsApi
    memory: AsyncMemoryApi
    messages: AsyncMessagesApi
    files: AsyncFilesApi
    user: AsyncUserApi

    def __init__(self, config: SdkConfig) -> None:
        client = AsyncBaseClient(config)
        self.ai = AsyncAiApi(client)
        self.agents = AsyncAgentsApi(client)
        self.audio = AsyncAudioApi(client)
        self.images = AsyncImagesApi(client)
        self.videos = AsyncVideosApi(client)
        self.threed = AsyncThreeDApi(client)
        self.generation = AsyncGenerationApi(client)
        self.knowledge = AsyncKnowledgeApi(client)
        self.tools = AsyncToolsApi(client)
        self.memory = AsyncMemoryApi(client)
        self.messages = AsyncMessagesApi(client)
        self.files = AsyncFilesApi(client)
        self.user = AsyncUserApi(client)
        self._base = client

    @property
    def base_url(self) -> str:
        return self._base.base_url


def create_async_client(config: SdkConfig) -> AsyncIhuiClient:
    """创建 IHUI SDK asyncio 客户端。"""
    return AsyncIhuiClient(config)


__all__ = [
    "__version__",
    # 客户端
    "IhuiClient",
    "create_client",
    "AsyncIhuiClient",
    "create_async_client",
    # 基础类
    "BaseClient",
    "AsyncBaseClient",
    "SdkConfig",
    # 异常
    "SdkError",
    "AuthenticationError",
    "PermissionError",
    "NotFoundError",
    "QuotaExceededError",
    "ServerError",
    "NetworkError",
    # 流式解析
    "parse_chat_stream_sync",
    "parse_agent_stream_sync",
    "parse_chat_stream_async",
    "parse_agent_stream_async",
]