/**
 * Clawdbot Models - 模型管理
 *
 * 模型注册、配置、切换、多模型路由。
 */
import { EventEmitter } from 'node:events'
import { logger } from './logger.js'

export type ModelProvider = 'openai' | 'anthropic' | 'gemini' | 'deepseek' | 'qwen' | 'zhipu' | 'local' | 'custom'

export interface ModelConfig {
  id: string
  name: string
  provider: ModelProvider
  apiKey?: string
  baseUrl?: string
  maxTokens: number
  temperature: number
  capabilities: string[]
  costPer1kTokens?: { input: number; output: number }
  enabled: boolean
  isDefault?: boolean
}

export interface ModelCompletionRequest {
  modelId?: string
  messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>
  temperature?: number
  maxTokens?: number
  stream?: boolean
  tools?: unknown[]
}

export interface ModelCompletionResponse {
  modelId: string
  content: string
  usage: { promptTokens: number; completionTokens: number; totalTokens: number }
  finishReason: string
}

export class ModelManager extends EventEmitter {
  private models = new Map<string, ModelConfig>()
  private defaultModelId: string | null = null

  register(config: ModelConfig): void {
    this.models.set(config.id, config)
    if (config.isDefault || !this.defaultModelId) {
      this.defaultModelId = config.id
    }
    logger.info({ model: config.id, provider: config.provider }, '[Models] Registered')
    this.emit('registered', config)
  }

  unregister(id: string): boolean {
    if (this.defaultModelId === id) this.defaultModelId = null
    return this.models.delete(id)
  }

  get(id: string): ModelConfig | undefined {
    return this.models.get(id)
  }

  list(): ModelConfig[] {
    return Array.from(this.models.values())
  }

  listEnabled(): ModelConfig[] {
    return this.list().filter((m) => m.enabled)
  }

  setDefault(id: string): boolean {
    if (!this.models.has(id)) return false
    this.defaultModelId = id
    this.emit('defaultChanged', id)
    return true
  }

  getDefault(): ModelConfig | undefined {
    return this.defaultModelId ? this.models.get(this.defaultModelId) : undefined
  }

  async complete(request: ModelCompletionRequest): Promise<ModelCompletionResponse> {
    const modelId = request.modelId ?? this.defaultModelId
    if (!modelId) throw new Error('No model configured')
    const model = this.models.get(modelId)
    if (!model) throw new Error(`Model "${modelId}" not found`)
    if (!model.enabled) throw new Error(`Model "${modelId}" is disabled`)

    // 简化的完成调用：实际实现需要对接各厂商 SDK
    logger.info({ model: modelId, messages: request.messages.length }, '[Models] Completion request')
    this.emit('completionRequested', { modelId, request })

    return {
      modelId,
      content: `[${model.name}] 模型调用已路由，请接入实际 SDK 完成。`,
      usage: {
        promptTokens: request.messages.reduce((s, m) => s + m.content.length / 4, 0) | 0,
        completionTokens: 0,
        totalTokens: 0,
      },
      finishReason: 'stop',
    }
  }

  selectByCapability(capability: string): ModelConfig | undefined {
    return this.listEnabled().find((m) => m.capabilities.includes(capability))
  }

  getStats() {
    const models = this.list()
    return {
      total: models.length,
      enabled: models.filter((m) => m.enabled).length,
      providers: Array.from(new Set(models.map((m) => m.provider))),
      defaultModel: this.defaultModelId,
    }
  }
}

let instance: ModelManager | null = null

export function getModelManager(): ModelManager {
  if (!instance) instance = new ModelManager()
  return instance
}
