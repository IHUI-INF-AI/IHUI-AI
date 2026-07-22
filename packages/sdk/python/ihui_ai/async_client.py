"""AsyncIhuiClient — asyncio SDK 入口,聚合 13 个功能模块。

用法:
    import asyncio
    from ihui_ai import AsyncIhuiClient

    async def main():
        client = AsyncIhuiClient({"apiKey": "ihui_xxx"})
        models = await client.ai.list_models()
        async for chunk in client.ai.completions_stream({"model": "gpt-4", "messages": [...]}):
            print(chunk["choices"][0]["delta"].get("content", ""), end="")

    asyncio.run(main())
"""

from __future__ import annotations

from .async_base import AsyncBaseClient
from .base import SdkConfig
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


class AsyncIhuiClient:
    """IHUI SDK asyncio 客户端,聚合 13 个功能模块。

    所有方法都是协程,支持高并发场景。方法签名与同步版 ``IhuiClient`` 一致,
    但方法名前缀 ``async def``,返回 awaitable。

    Attributes:
        ai: AI 核心(chat / embeddings / models / moa)。
        agents: Agent(列表 / 调用 / 高级执行 / Pipeline / 并行)。
        audio: 音频(TTS / ASR / 语音对话 / 声纹 / 音乐)。
        images: 图像(文生图 / 编辑 / 修复 / 风格迁移 / 虚拟试穿 / 背景)。
        videos: 视频(生成 / 任务查询 / 编排)。
        threed: 3D 模型生成。
        generation: 生成队列(入队 / 状态 / 取消)。
        knowledge: 知识库 / RAG / 知识图谱。
        tools: MCP 工具 / 技能 / 人格 / 代码搜索 / 截图。
        memory: 记忆(保存 / 召回 / 搜索 / Dream / 分类记忆)。
        messages: 消息(发布 / 订阅 / 状态)。
        files: 文件(列表 / 上传 / 详情 / 删除 / 内容 / 版本 / 分片上传)。
        user: 用户 / 工作区 / 工作流 / 统计。
    """

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
        """初始化 asyncio SDK 客户端。

        Args:
            config: SDK 配置(apiKey 必需,其余可选)。

        Raises:
            SdkError: apiKey 缺失时抛出。
        """
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
        """底层 AsyncBaseClient 的 baseUrl。"""
        return self._base.base_url


def create_async_client(config: SdkConfig) -> AsyncIhuiClient:
    """创建 IHUI SDK asyncio 客户端。

    Args:
        config: SDK 配置(与 ``create_client`` 相同)。

    Returns:
        AsyncIhuiClient 实例,包含 13 个功能模块。

    Example:
        >>> import asyncio
        >>> from ihui_ai import create_async_client
        >>> async def main():
        ...     client = create_async_client({"apiKey": "ihui_xxx"})
        ...     models = await client.ai.list_models()
        ...     print(models["data"][0]["id"])
        >>> asyncio.run(main())
    """
    return AsyncIhuiClient(config)


__all__ = ["AsyncIhuiClient", "create_async_client"]
