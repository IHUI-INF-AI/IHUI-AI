// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * Clawdbot Models - 模型管理
 *
 * 模型注册、配置、切换、多模型路由。
 */
import { EventEmitter } from 'node:events'
import { logger } from './logger.js'

export type ModelProvider =
  | 'openai'
  | 'anthropic'
  | 'gemini'
  | 'deepseek'
  | 'qwen'
  | 'zhipu'
  | 'local'
  | 'custom'
  // 2026-07-22 新增免费 / 试用 credits provider(参考 cheahjs/free-llm-api-resources)
  | 'cloudflare_workers_ai'
  | 'nvidia_nim'
  | 'github_models'
  | 'vercel_ai_gateway'
  | 'opencode_zen'
  | 'modal'
  | 'inferencenet'
  | 'nlpcloud'
  | 'scaleway'
  | 'alibaba_intl'

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

/**
 * 密钥脱敏:只留末 4 位指纹(够运维核对"是哪一把",不够复用)。
 * 短密钥一律全掩,避免掩码本身泄露过多信息。
 */
function maskKey(key: string): string {
  if (key.length <= 8) return '****'
  return `****${key.slice(-4)}`
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

  /**
   * 对外(HTTP 响应)可返回的模型视图 —— 2026-10-27 安全加固。
   *
   * `list()` 原样带出 `apiKey` / `baseUrl`,而 `/api/crew/models` 曾完全无鉴权、
   * `/api/clawdbot/models` 仅需普通登录 —— 两者都把**平台上游密钥明文**交给了调用方。
   * 路由层一律改用本方法:密钥只保留"是否已配置"与末 4 位指纹,供运维核对是哪一把,
   * 不足以复用。真正需要密钥的调用链(complete)在服务内部取 `get(id)`,不受影响。
   */
  listPublic(): Array<Omit<ModelConfig, 'apiKey'> & { apiKey?: string; hasApiKey: boolean }> {
    return Array.from(this.models.values()).map((cfg) => {
      const { apiKey, ...rest } = cfg
      return {
        ...rest,
        hasApiKey: Boolean(apiKey),
        ...(apiKey ? { apiKey: maskKey(apiKey) } : {}),
      }
    })
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
    logger.info(
      { model: modelId, messages: request.messages.length },
      '[Models] Completion request',
    )
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
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
