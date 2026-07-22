/**
 * IhuiClient — 统一 SDK 入口,聚合 13 个功能模块。
 *
 * 用法:
 * ```ts
 * import { createClient } from '@ihui/sdk'
 *
 * const client = createClient({ apiKey: 'ihui_xxx' })
 * const models = await client.ai.listModels()
 * const stream = client.ai.completionsStream({ model: 'gpt-4', messages: [...] })
 * for await (const chunk of stream) {
 *   process.stdout.write(chunk.choices[0]?.delta?.content ?? '')
 * }
 * ```
 */

import { BaseClient, type SdkConfig } from './base.js'
import { createAiModule, type AiModule } from './ai.js'
import { createAgentsModule, type AgentsModule } from './agents.js'
import { createAudioModule, type AudioModule } from './audio.js'
import { createImagesModule, type ImagesModule } from './images.js'
import { createVideosModule, type VideosModule } from './videos.js'
import { createThreeDModule, type ThreeDModule } from './threed.js'
import { createGenerationModule, type GenerationModule } from './generation.js'
import { createKnowledgeModule, type KnowledgeModule } from './knowledge.js'
import { createToolsModule, type ToolsModule } from './tools.js'
import { createMemoryModule, type MemoryModule } from './memory.js'
import { createMessagesModule, type MessagesModule } from './messages.js'
import { createFilesModule, type FilesModule } from './files.js'
import { createUserModule, type UserModule } from './user.js'

/** IHUI SDK 客户端,聚合所有功能模块。 */
export interface IhuiClient {
  /** AI 核心:chat / embeddings / models / moa。 */
  ai: AiModule
  /** Agent:列表 / 调用 / 高级执行 / Pipeline / 并行。 */
  agents: AgentsModule
  /** 音频:TTS / ASR / 语音对话 / 声纹 / 音乐。 */
  audio: AudioModule
  /** 图像:文生图 / 编辑 / 修复 / 风格迁移 / 虚拟试穿 / 背景。 */
  images: ImagesModule
  /** 视频:生成 / 任务查询 / 编排。 */
  videos: VideosModule
  /** 3D 模型生成。 */
  threed: ThreeDModule
  /** 生成队列:入队 / 状态 / 取消。 */
  generation: GenerationModule
  /** 知识库 / RAG / 知识图谱。 */
  knowledge: KnowledgeModule
  /** MCP 工具 / 技能 / 人格 / 代码搜索 / 截图。 */
  tools: ToolsModule
  /** 记忆:保存 / 召回 / 搜索 / Dream / 分类记忆。 */
  memory: MemoryModule
  /** 消息:发布 / 订阅 / 状态。 */
  messages: MessagesModule
  /** 文件:列表 / 上传 / 详情 / 删除 / 内容 / 版本 / 分片上传。 */
  files: FilesModule
  /** 用户 / 工作区 / 工作流 / 统计。 */
  user: UserModule
}

/**
 * 创建 IHUI SDK 客户端。
 *
 * @param config - SDK 配置(apiKey 必需,其余可选)
 * @returns IhuiClient 实例,包含 13 个功能模块
 */
export function createClient(config: SdkConfig): IhuiClient {
  const client = new BaseClient(config)
  return {
    ai: createAiModule(client),
    agents: createAgentsModule(client),
    audio: createAudioModule(client),
    images: createImagesModule(client),
    videos: createVideosModule(client),
    threed: createThreeDModule(client),
    generation: createGenerationModule(client),
    knowledge: createKnowledgeModule(client),
    tools: createToolsModule(client),
    memory: createMemoryModule(client),
    messages: createMessagesModule(client),
    files: createFilesModule(client),
    user: createUserModule(client),
  }
}
