"""IhuiClient — 同步 SDK 入口,聚合 13 个功能模块。

用法:
    from ihui_ai import create_client

    client = create_client({"apiKey": "ihui_xxx"})
    models = client.ai.list_models()
    for chunk in client.ai.completions_stream({"model": "gpt-4", "messages": [...]}):
        print(chunk["choices"][0]["delta"].get("content", ""), end="")
"""

from __future__ import annotations

from .base import BaseClient, SdkConfig
from .modules import (
    AgentsApi,
    AiApi,
    AudioApi,
    FilesApi,
    GenerationApi,
    ImagesApi,
    KnowledgeApi,
    MemoryApi,
    MessagesApi,
    ThreeDApi,
    ToolsApi,
    UserApi,
    VideosApi,
)


class IhuiClient:
    """IHUI SDK 同步客户端,聚合 13 个功能模块。

    通过 ``create_client(config)`` 创建,无需直接实例化。

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

    ai: AiApi
    agents: AgentsApi
    audio: AudioApi
    images: ImagesApi
    videos: VideosApi
    threed: ThreeDApi
    generation: GenerationApi
    knowledge: KnowledgeApi
    tools: ToolsApi
    memory: MemoryApi
    messages: MessagesApi
    files: FilesApi
    user: UserApi

    def __init__(self, config: SdkConfig) -> None:
        """初始化 SDK 客户端。

        Args:
            config: SDK 配置(apiKey 必需,其余可选)。

        Raises:
            SdkError: apiKey 缺失时抛出。
        """
        client = BaseClient(config)
        self.ai = AiApi(client)
        self.agents = AgentsApi(client)
        self.audio = AudioApi(client)
        self.images = ImagesApi(client)
        self.videos = VideosApi(client)
        self.threed = ThreeDApi(client)
        self.generation = GenerationApi(client)
        self.knowledge = KnowledgeApi(client)
        self.tools = ToolsApi(client)
        self.memory = MemoryApi(client)
        self.messages = MessagesApi(client)
        self.files = FilesApi(client)
        self.user = UserApi(client)
        self._base = client

    @property
    def base_url(self) -> str:
        """底层 BaseClient 的 baseUrl(去除尾部 ``/``)。"""
        return self._base.base_url


def create_client(config: SdkConfig) -> IhuiClient:
    """创建 IHUI SDK 同步客户端。

    Args:
        config: SDK 配置,支持以下键:
            - ``apiKey``(必需):API Key,格式 ``ihui_xxx``。
            - ``secret``(可选):API Secret。
            - ``baseUrl``(可选):基础 URL,默认 ``http://localhost:8802``。
            - ``timeout``(可选):请求超时(秒),默认 30。
            - ``maxRetries``(可选):最大重试次数,默认 2。

    Returns:
        IhuiClient 实例,包含 13 个功能模块。

    Example:
        >>> from ihui_ai import create_client
        >>> client = create_client({"apiKey": "ihui_xxx"})
        >>> models = client.ai.list_models()
        >>> print(models["data"][0]["id"])
    """
    return IhuiClient(config)


__all__ = ["IhuiClient", "create_client"]
