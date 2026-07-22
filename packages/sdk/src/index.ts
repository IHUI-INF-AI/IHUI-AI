/**
 * @ihui/sdk — IHUI-AI 平台 JavaScript/TypeScript SDK
 *
 * 完整封装 105 个 /v1/* 对外开放 API 端点,零运行时依赖。
 *
 * 用法:
 * ```ts
 * import { createClient } from '@ihui/sdk'
 *
 * const client = createClient({ apiKey: 'ihui_xxx' })
 * const models = await client.ai.listModels()
 * ```
 */

export { createClient, type IhuiClient } from './client.js'
export { BaseClient, SdkError, type SdkConfig } from './base.js'
export {
  parseChatStream,
  parseAgentStream,
  type ChatStreamChunk,
  type AgentStreamEvent,
} from './streaming.js'

// 模块接口类型导出(供消费者按需引用)
export type { AiModule } from './ai.js'
export type { AgentsModule, V1AgentDecomposeResponse } from './agents.js'
export type { AudioModule } from './audio.js'
export type { ImagesModule } from './images.js'
export type { VideosModule } from './videos.js'
export type { ThreeDModule } from './threed.js'
export type { GenerationModule } from './generation.js'
export type { KnowledgeModule } from './knowledge.js'
export type { ToolsModule } from './tools.js'
export type { MemoryModule } from './memory.js'
export type { MessagesModule } from './messages.js'
export type { FilesModule } from './files.js'
export type { UserModule } from './user.js'
