"""ihui-ai — IHUI AI Platform Python SDK。

完整封装 105 个 ``/v1/*`` 对外开放 API 端点,提供同步 + asyncio 双版本客户端,
零运行时依赖(纯 stdlib)。

用法:
    from ihui_ai import create_client

    client = create_client({"apiKey": "ihui_xxx"})
    models = client.ai.list_models()

asyncio 用法:
    import asyncio
    from ihui_ai import AsyncIhuiClient

    async def main():
        client = AsyncIhuiClient({"apiKey": "ihui_xxx"})
        models = await client.ai.list_models()

    asyncio.run(main())
"""

from __future__ import annotations

__version__ = "0.1.0"

from .async_client import AsyncIhuiClient, create_async_client
from .base import BaseClient, SdkConfig
from .async_base import AsyncBaseClient
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
from .streaming import (
    parse_agent_stream_async,
    parse_agent_stream_sync,
    parse_chat_stream_async,
    parse_chat_stream_sync,
)

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
