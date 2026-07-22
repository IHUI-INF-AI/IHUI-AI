"""业务模块包 — 13 个功能模块,每个模块提供同步 + asyncio 双版本。

模块清单:
- ai: Chat / Embeddings / Models / MoA(13 端点)
- agents: Agent 列表 / 调用 / 高级执行 / Pipeline / 并行(12 端点)
- audio: TTS / ASR / 语音对话 / 声纹 / 音乐(8 端点)
- images: 文生图 / 编辑 / 修复 / 风格迁移 / 虚拟试穿 / 背景(6 端点)
- videos: 生成 / 任务查询 / 编排(3 端点)
- threed: 3D 模型生成(1 端点)
- generation: 生成队列 入队 / 状态 / 取消(3 端点)
- knowledge: 知识库 / RAG / 知识图谱(13 端点)
- tools: MCP 工具 / 技能 / 人格 / 代码搜索 / 截图(16 端点)
- memory: 记忆 保存 / 召回 / 搜索 / Dream(8 端点)
- messages: 消息 发布 / 订阅 / 状态(4 端点)
- files: 文件 列表 / 上传 / 详情 / 删除 / 内容 / 版本 / 分片(9 端点)
- user: 用户 / 工作区 / 工作流 / 统计(9 端点)
"""

from __future__ import annotations

from .ai import AiApi, AsyncAiApi
from .agents import AgentsApi, AsyncAgentsApi
from .audio import AudioApi, AsyncAudioApi
from .files import FilesApi, AsyncFilesApi
from .generation import GenerationApi, AsyncGenerationApi
from .images import ImagesApi, AsyncImagesApi
from .knowledge import KnowledgeApi, AsyncKnowledgeApi
from .memory import MemoryApi, AsyncMemoryApi
from .messages import MessagesApi, AsyncMessagesApi
from .threed import AsyncThreeDApi, ThreeDApi
from .tools import ToolsApi, AsyncToolsApi
from .user import UserApi, AsyncUserApi
from .videos import VideosApi, AsyncVideosApi

__all__ = [
    # 同步
    "AiApi",
    "AgentsApi",
    "AudioApi",
    "ImagesApi",
    "VideosApi",
    "ThreeDApi",
    "GenerationApi",
    "KnowledgeApi",
    "ToolsApi",
    "MemoryApi",
    "MessagesApi",
    "FilesApi",
    "UserApi",
    # 异步
    "AsyncAiApi",
    "AsyncAgentsApi",
    "AsyncAudioApi",
    "AsyncImagesApi",
    "AsyncVideosApi",
    "AsyncThreeDApi",
    "AsyncGenerationApi",
    "AsyncKnowledgeApi",
    "AsyncToolsApi",
    "AsyncMemoryApi",
    "AsyncMessagesApi",
    "AsyncFilesApi",
    "AsyncUserApi",
]
