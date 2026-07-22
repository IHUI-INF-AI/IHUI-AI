/**
 * AI 核心模块 — chat / embeddings / models / moa。
 *
 * 端点(13 个):
 * - POST /v1/chat/completions(非流式 + 流式)
 * - POST /v1/embeddings
 * - POST /v1/chat/vision
 * - POST /v1/chat/moa
 * - GET  /v1/models
 * - GET  /v1/models/:id
 * - GET  /v1/vendors/:vendor/models
 * - GET  /v1/moa-presets
 * - POST /v1/moa-presets
 * - GET/POST/PUT/DELETE /v1/user/models
 */

import type { BaseClient } from './base.js'
import { parseChatStream, type ChatStreamChunk } from './streaming.js'
import type {
  V1ChatCompletionRequest,
  V1ChatCompletionResponse,
  V1ModelsResponse,
  V1EmbeddingsRequest,
  V1EmbeddingsResponse,
  V1ChatVisionRequest,
  V1ChatVisionResponse,
  V1ChatMoaRequest,
  V1ChatMoaResponse,
  V1MoaPresetsResponse,
  V1CreateMoaPresetRequest,
  V1ModelInfo,
  V1VendorModelsResponse,
  V1UserModelsResponse,
  V1CreateUserModelRequest,
  V1UserModelConfig,
} from '@ihui/types'

export interface AiModule {
  /** POST /v1/chat/completions(非流式)。 */
  completions(req: V1ChatCompletionRequest): Promise<V1ChatCompletionResponse>
  /** POST /v1/chat/completions(stream:true)→ 异步生成器。 */
  completionsStream(req: V1ChatCompletionRequest): AsyncGenerator<ChatStreamChunk>
  /** POST /v1/embeddings。 */
  embeddings(req: V1EmbeddingsRequest): Promise<V1EmbeddingsResponse>
  /** POST /v1/chat/vision(视觉理解)。 */
  chatVision(req: V1ChatVisionRequest): Promise<V1ChatVisionResponse>
  /** POST /v1/chat/moa(Mixture of Agents)。 */
  chatMoa(req: V1ChatMoaRequest): Promise<V1ChatMoaResponse>
  /** GET /v1/models(模型列表)。 */
  listModels(): Promise<V1ModelsResponse>
  /** GET /v1/models/:id(模型详情)。 */
  getModel(id: string): Promise<V1ModelInfo>
  /** GET /v1/vendors/:vendor/models(厂商模型列表)。 */
  listVendorModels(vendor: string): Promise<V1VendorModelsResponse>
  /** GET /v1/moa-presets(MoA 预设列表)。 */
  listMoaPresets(): Promise<V1MoaPresetsResponse>
  /** POST /v1/moa-presets(创建 MoA 预设)。 */
  createMoaPreset(req: V1CreateMoaPresetRequest): Promise<V1MoaPresetsResponse>
  /** GET /v1/user/models(用户自定义模型列表)。 */
  listUserModels(): Promise<V1UserModelsResponse>
  /** POST /v1/user/models(创建用户自定义模型)。 */
  createUserModel(req: V1CreateUserModelRequest): Promise<V1UserModelConfig>
  /** PUT /v1/user/models/:id(更新用户自定义模型)。 */
  updateUserModel(id: string, req: V1CreateUserModelRequest): Promise<V1UserModelConfig>
  /** DELETE /v1/user/models/:id(删除用户自定义模型)。 */
  deleteUserModel(id: string): Promise<void>
}

export function createAiModule(client: BaseClient): AiModule {
  return {
    completions: (req) => client.request<V1ChatCompletionResponse>('POST', '/chat/completions', req),

    async *completionsStream(req) {
      const stream = await client.requestStream('POST', '/chat/completions', { ...req, stream: true })
      yield* parseChatStream(stream)
    },

    embeddings: (req) => client.request<V1EmbeddingsResponse>('POST', '/embeddings', req),
    chatVision: (req) => client.request<V1ChatVisionResponse>('POST', '/chat/vision', req),
    chatMoa: (req) => client.request<V1ChatMoaResponse>('POST', '/chat/moa', req),
    listModels: () => client.request<V1ModelsResponse>('GET', '/models'),
    getModel: (id) => client.request<V1ModelInfo>('GET', `/models/${encodeURIComponent(id)}`),
    listVendorModels: (vendor) =>
      client.request<V1VendorModelsResponse>('GET', `/vendors/${encodeURIComponent(vendor)}/models`),
    listMoaPresets: () => client.request<V1MoaPresetsResponse>('GET', '/moa-presets'),
    createMoaPreset: (req) => client.request<V1MoaPresetsResponse>('POST', '/moa-presets', req),
    listUserModels: () => client.request<V1UserModelsResponse>('GET', '/user/models'),
    createUserModel: (req) => client.request<V1UserModelConfig>('POST', '/user/models', req),
    updateUserModel: (id, req) =>
      client.request<V1UserModelConfig>('PUT', `/user/models/${encodeURIComponent(id)}`, req),
    deleteUserModel: (id) => client.request<void>('DELETE', `/user/models/${encodeURIComponent(id)}`),
  }
}
