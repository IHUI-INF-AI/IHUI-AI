/**
 * OpenClaw Models Management System
 * 
 * AI 模型管理和切换:
 * - 多提供商支持 (Claude, GPT, Gemini, Ollama等)
 * - 本地模型支持 (Ollama)
 * - 模型切换和路由
 * - 使用量统计
 * - 成本估算
 * - 模型比较
 * 
 * 参考: https://docs.clawd.bot/models
 */

import { ref, reactive } from 'vue'
import { logger } from '@/utils/logger'
import { EventEmitter } from '@/utils/event-emitter'

/**
 * 模型提供商
 */
export type ModelProvider =
  | 'anthropic'
  | 'openai'
  | 'google'
  | 'azure'
  | 'ollama'
  | 'groq'
  | 'mistral'
  | 'cohere'
  | 'together'
  | 'replicate'
  | 'huggingface'
  | 'deepseek'
  | 'zhipu'
  | 'baidu'
  | 'alibaba'
  | 'moonshot'
  | 'custom'

/**
 * 模型类型
 */
export type ModelType =
  | 'chat'
  | 'completion'
  | 'embedding'
  | 'image'
  | 'audio'
  | 'video'
  | 'multimodal'

/**
 * 模型定义
 */
export interface ModelDefinition {
  id: string
  name: string
  provider: ModelProvider
  type: ModelType
  contextWindow: number
  maxOutputTokens: number
  inputPrice: number  // 每百万 token
  outputPrice: number // 每百万 token
  capabilities: ModelCapability[]
  supportedFeatures: string[]
  releaseDate?: string
  deprecated?: boolean
  recommended?: boolean
}

/**
 * 模型能力
 */
export interface ModelCapability {
  name: string
  supported: boolean
  description?: string
}

/**
 * 提供商配置
 */
export interface ProviderConfig {
  provider: ModelProvider
  name: string
  apiKey?: string
  baseUrl?: string
  organizationId?: string
  enabled: boolean
  models: string[]
  defaultModel?: string
  settings?: Record<string, unknown>
}

/**
 * 模型配置
 */
export interface ModelConfig {
  modelId: string
  temperature?: number
  topP?: number
  topK?: number
  maxTokens?: number
  stopSequences?: string[]
  presencePenalty?: number
  frequencyPenalty?: number
  systemPrompt?: string
  timeout?: number
}

/**
 * 模型使用统计
 */
export interface ModelUsageStats {
  modelId: string
  provider: ModelProvider
  totalRequests: number
  totalInputTokens: number
  totalOutputTokens: number
  totalCost: number
  averageLatency: number
  errorRate: number
  lastUsed: number
  dailyStats: DailyModelStats[]
}

/**
 * 每日统计
 */
export interface DailyModelStats {
  date: string
  requests: number
  inputTokens: number
  outputTokens: number
  cost: number
  errors: number
}

/**
 * 模型请求
 */
export interface ModelRequest {
  id: string
  modelId: string
  provider: ModelProvider
  type: 'chat' | 'completion' | 'embedding'
  messages?: Array<{ role: string; content: string }>
  prompt?: string
  config?: ModelConfig
  timestamp: number
}

/**
 * 模型响应
 */
export interface ModelResponse {
  id: string
  requestId: string
  modelId: string
  content: string
  usage: {
    inputTokens: number
    outputTokens: number
    totalTokens: number
  }
  finishReason: 'stop' | 'length' | 'content_filter' | 'error'
  latency: number
  cost: number
  timestamp: number
}

/**
 * 模型管理器配置
 */
export interface ModelManagerConfig {
  /** 默认提供商 */
  defaultProvider?: ModelProvider
  /** 默认模型 */
  defaultModel?: string
  /** 自动切换 */
  autoFallback?: boolean
  /** 缓存响应 */
  cacheResponses?: boolean
  /** 缓存时间 (秒) */
  cacheTTL?: number
  /** 重试次数 */
  maxRetries?: number
  /** 超时时间 (毫秒) */
  timeout?: number
}

/**
 * 模型管理器
 */
export class ModelManager extends EventEmitter {
  private config: Required<ModelManagerConfig>
  private providers = reactive<Map<ModelProvider, ProviderConfig>>(new Map())
  private models = reactive<Map<string, ModelDefinition>>(new Map())
  private usageStats = reactive<Map<string, ModelUsageStats>>(new Map())
  private responseCache = new Map<string, { response: ModelResponse; expires: number }>()
  
  private initialized = ref(false)
  private currentModel = ref<string>('')

  constructor(config: ModelManagerConfig = {}) {
    super()
    this.config = {
      defaultProvider: config.defaultProvider || 'anthropic',
      defaultModel: config.defaultModel || 'claude-3-5-sonnet-20241022',
      autoFallback: config.autoFallback ?? true,
      cacheResponses: config.cacheResponses ?? false,
      cacheTTL: config.cacheTTL || 300,
      maxRetries: config.maxRetries || 3,
      timeout: config.timeout || 60000,
    }
  }

  /**
   * 初始化模型管理器
   */
  async initialize(): Promise<void> {
    if (this.initialized.value) return

    logger.info('[Models] Initializing model manager...')

    // 注册内置模型
    this.registerBuiltinModels()

    // 加载提供商配置
    await this.loadProviderConfigs()

    // 加载使用统计
    await this.loadUsageStats()

    // 设置默认模型
    this.currentModel.value = this.config.defaultModel

    this.initialized.value = true
    logger.info('[Models] Model manager initialized')
    this.emit('initialized')
  }

  /**
   * 注册内置模型
   */
  private registerBuiltinModels(): void {
    const builtinModels: ModelDefinition[] = [
      // Anthropic Claude
      {
        id: 'claude-3-5-sonnet-20241022',
        name: 'Claude 3.5 Sonnet',
        provider: 'anthropic',
        type: 'chat',
        contextWindow: 200000,
        maxOutputTokens: 8192,
        inputPrice: 3.0,
        outputPrice: 15.0,
        capabilities: [
          { name: 'vision', supported: true },
          { name: 'function_calling', supported: true },
          { name: 'computer_use', supported: true },
        ],
        supportedFeatures: ['streaming', 'json_mode', 'system_prompt'],
        recommended: true,
      },
      {
        id: 'claude-3-opus-20240229',
        name: 'Claude 3 Opus',
        provider: 'anthropic',
        type: 'chat',
        contextWindow: 200000,
        maxOutputTokens: 4096,
        inputPrice: 15.0,
        outputPrice: 75.0,
        capabilities: [
          { name: 'vision', supported: true },
          { name: 'function_calling', supported: true },
        ],
        supportedFeatures: ['streaming', 'json_mode', 'system_prompt'],
      },
      {
        id: 'claude-3-haiku-20240307',
        name: 'Claude 3 Haiku',
        provider: 'anthropic',
        type: 'chat',
        contextWindow: 200000,
        maxOutputTokens: 4096,
        inputPrice: 0.25,
        outputPrice: 1.25,
        capabilities: [
          { name: 'vision', supported: true },
          { name: 'function_calling', supported: true },
        ],
        supportedFeatures: ['streaming', 'json_mode', 'system_prompt'],
      },

      // OpenAI GPT
      {
        id: 'gpt-4o',
        name: 'GPT-4o',
        provider: 'openai',
        type: 'multimodal',
        contextWindow: 128000,
        maxOutputTokens: 16384,
        inputPrice: 2.5,
        outputPrice: 10.0,
        capabilities: [
          { name: 'vision', supported: true },
          { name: 'function_calling', supported: true },
          { name: 'audio', supported: true },
        ],
        supportedFeatures: ['streaming', 'json_mode', 'system_prompt'],
        recommended: true,
      },
      {
        id: 'gpt-4-turbo',
        name: 'GPT-4 Turbo',
        provider: 'openai',
        type: 'chat',
        contextWindow: 128000,
        maxOutputTokens: 4096,
        inputPrice: 10.0,
        outputPrice: 30.0,
        capabilities: [
          { name: 'vision', supported: true },
          { name: 'function_calling', supported: true },
        ],
        supportedFeatures: ['streaming', 'json_mode', 'system_prompt'],
      },
      {
        id: 'gpt-4o-mini',
        name: 'GPT-4o Mini',
        provider: 'openai',
        type: 'chat',
        contextWindow: 128000,
        maxOutputTokens: 16384,
        inputPrice: 0.15,
        outputPrice: 0.6,
        capabilities: [
          { name: 'vision', supported: true },
          { name: 'function_calling', supported: true },
        ],
        supportedFeatures: ['streaming', 'json_mode', 'system_prompt'],
      },
      {
        id: 'o1-preview',
        name: 'o1 Preview',
        provider: 'openai',
        type: 'chat',
        contextWindow: 128000,
        maxOutputTokens: 32768,
        inputPrice: 15.0,
        outputPrice: 60.0,
        capabilities: [
          { name: 'reasoning', supported: true },
        ],
        supportedFeatures: ['streaming'],
      },

      // Google Gemini
      {
        id: 'gemini-2.0-flash-exp',
        name: 'Gemini 2.0 Flash',
        provider: 'google',
        type: 'multimodal',
        contextWindow: 1000000,
        maxOutputTokens: 8192,
        inputPrice: 0.075,
        outputPrice: 0.3,
        capabilities: [
          { name: 'vision', supported: true },
          { name: 'audio', supported: true },
          { name: 'video', supported: true },
        ],
        supportedFeatures: ['streaming', 'json_mode'],
        recommended: true,
      },
      {
        id: 'gemini-1.5-pro',
        name: 'Gemini 1.5 Pro',
        provider: 'google',
        type: 'multimodal',
        contextWindow: 2000000,
        maxOutputTokens: 8192,
        inputPrice: 1.25,
        outputPrice: 5.0,
        capabilities: [
          { name: 'vision', supported: true },
          { name: 'audio', supported: true },
          { name: 'video', supported: true },
        ],
        supportedFeatures: ['streaming', 'json_mode'],
      },

      // DeepSeek
      {
        id: 'deepseek-chat',
        name: 'DeepSeek Chat',
        provider: 'deepseek',
        type: 'chat',
        contextWindow: 64000,
        maxOutputTokens: 8192,
        inputPrice: 0.14,
        outputPrice: 0.28,
        capabilities: [
          { name: 'function_calling', supported: true },
        ],
        supportedFeatures: ['streaming', 'json_mode'],
      },
      {
        id: 'deepseek-reasoner',
        name: 'DeepSeek Reasoner',
        provider: 'deepseek',
        type: 'chat',
        contextWindow: 64000,
        maxOutputTokens: 8192,
        inputPrice: 0.55,
        outputPrice: 2.19,
        capabilities: [
          { name: 'reasoning', supported: true },
        ],
        supportedFeatures: ['streaming'],
      },

      // 国内模型
      {
        id: 'qwen-max',
        name: '通义千问 Max',
        provider: 'alibaba',
        type: 'chat',
        contextWindow: 32000,
        maxOutputTokens: 8192,
        inputPrice: 2.0,
        outputPrice: 6.0,
        capabilities: [
          { name: 'vision', supported: true },
          { name: 'function_calling', supported: true },
        ],
        supportedFeatures: ['streaming', 'json_mode'],
      },
      {
        id: 'glm-4',
        name: '智谱 GLM-4',
        provider: 'zhipu',
        type: 'chat',
        contextWindow: 128000,
        maxOutputTokens: 4096,
        inputPrice: 10.0,
        outputPrice: 10.0,
        capabilities: [
          { name: 'vision', supported: true },
          { name: 'function_calling', supported: true },
        ],
        supportedFeatures: ['streaming', 'json_mode'],
      },
      {
        id: 'moonshot-v1-128k',
        name: 'Moonshot 128K',
        provider: 'moonshot',
        type: 'chat',
        contextWindow: 128000,
        maxOutputTokens: 8192,
        inputPrice: 6.0,
        outputPrice: 6.0,
        capabilities: [],
        supportedFeatures: ['streaming'],
      },

      // Ollama 本地模型
      {
        id: 'ollama/llama3.2',
        name: 'Llama 3.2 (Local)',
        provider: 'ollama',
        type: 'chat',
        contextWindow: 128000,
        maxOutputTokens: 4096,
        inputPrice: 0,
        outputPrice: 0,
        capabilities: [],
        supportedFeatures: ['streaming'],
      },
      {
        id: 'ollama/qwen2.5',
        name: 'Qwen 2.5 (Local)',
        provider: 'ollama',
        type: 'chat',
        contextWindow: 32000,
        maxOutputTokens: 4096,
        inputPrice: 0,
        outputPrice: 0,
        capabilities: [],
        supportedFeatures: ['streaming'],
      },
      {
        id: 'ollama/deepseek-r1',
        name: 'DeepSeek R1 (Local)',
        provider: 'ollama',
        type: 'chat',
        contextWindow: 64000,
        maxOutputTokens: 8192,
        inputPrice: 0,
        outputPrice: 0,
        capabilities: [
          { name: 'reasoning', supported: true },
        ],
        supportedFeatures: ['streaming'],
      },
    ]

    for (const model of builtinModels) {
      this.models.set(model.id, model)
    }

    logger.info(`[Models] Registered built-in models`)
  }

  /**
   * 加载提供商配置
   */
  private async loadProviderConfigs(): Promise<void> {
    try {
      const saved = localStorage.getItem('openclaw_provider_configs')
      if (saved) {
        const configs = JSON.parse(saved) as ProviderConfig[]
        for (const config of configs) {
          this.providers.set(config.provider, config)
        }
      }
    } catch (error) {
      logger.error('[Models] Failed to load provider config:', error)
    }

    // 确保默认提供商存在
    if (!this.providers.has(this.config.defaultProvider)) {
      this.providers.set(this.config.defaultProvider, {
        provider: this.config.defaultProvider,
        name: this.getProviderName(this.config.defaultProvider),
        enabled: true,
        models: this.getModelsByProvider(this.config.defaultProvider).map(m => m.id),
      })
    }
  }

  /**
   * 加载使用统计
   */
  private async loadUsageStats(): Promise<void> {
    try {
      const saved = localStorage.getItem('openclaw_model_usage')
      if (saved) {
        const stats = JSON.parse(saved) as ModelUsageStats[]
        for (const stat of stats) {
          this.usageStats.set(stat.modelId, stat)
        }
      }
    } catch (error) {
      logger.error('[Models] Failed to load usage stats:', error)
    }
  }

  /**
   * 保存使用统计
   */
  private saveUsageStats(): void {
    const stats = Array.from(this.usageStats.values())
    localStorage.setItem('openclaw_model_usage', JSON.stringify(stats))
  }

  /**
   * 获取提供商名称
   */
  private getProviderName(provider: ModelProvider): string {
    const names: Record<ModelProvider, string> = {
      anthropic: 'Anthropic',
      openai: 'OpenAI',
      google: 'Google AI',
      azure: 'Azure OpenAI',
      ollama: 'Ollama (Local)',
      groq: 'Groq',
      mistral: 'Mistral AI',
      cohere: 'Cohere',
      together: 'Together AI',
      replicate: 'Replicate',
      huggingface: 'Hugging Face',
      deepseek: 'DeepSeek',
      zhipu: '智谱 AI',
      baidu: '百度文心',
      alibaba: '阿里通义',
      moonshot: 'Moonshot',
      custom: 'Custom',
    }
    return names[provider] || provider
  }

  /**
   * 配置提供商
   */
  configureProvider(config: ProviderConfig): void {
    this.providers.set(config.provider, config)
    
    const configs = Array.from(this.providers.values())
    localStorage.setItem('openclaw_provider_configs', JSON.stringify(configs))

    this.emit('providerConfigured', config)
  }

  /**
   * 获取提供商配置
   */
  getProviderConfig(provider: ModelProvider): ProviderConfig | undefined {
    return this.providers.get(provider)
  }

  /**
   * 获取所有提供商
   */
  getAllProviders(): ProviderConfig[] {
    return Array.from(this.providers.values())
  }

  /**
   * 获取所有模型
   */
  getAllModels(): ModelDefinition[] {
    return Array.from(this.models.values())
  }

  /**
   * 按提供商获取模型
   */
  getModelsByProvider(provider: ModelProvider): ModelDefinition[] {
    return this.getAllModels().filter(m => m.provider === provider)
  }

  /**
   * 按类型获取模型
   */
  getModelsByType(type: ModelType): ModelDefinition[] {
    return this.getAllModels().filter(m => m.type === type)
  }

  /**
   * 获取推荐模型
   */
  getRecommendedModels(): ModelDefinition[] {
    return this.getAllModels().filter(m => m.recommended && !m.deprecated)
  }

  /**
   * 获取模型
   */
  getModel(modelId: string): ModelDefinition | undefined {
    return this.models.get(modelId)
  }

  /**
   * 设置当前模型
   */
  setCurrentModel(modelId: string): void {
    const model = this.models.get(modelId)
    if (!model) {
      throw new Error(`模型不存在: ${modelId}`)
    }

    this.currentModel.value = modelId
    this.emit('modelChanged', model)
  }

  /**
   * 获取当前模型
   */
  getCurrentModel(): ModelDefinition | undefined {
    return this.models.get(this.currentModel.value)
  }

  /**
   * 估算成本
   */
  estimateCost(modelId: string, inputTokens: number, outputTokens: number): number {
    const model = this.models.get(modelId)
    if (!model) return 0

    const inputCost = (inputTokens / 1000000) * model.inputPrice
    const outputCost = (outputTokens / 1000000) * model.outputPrice

    return inputCost + outputCost
  }

  /**
   * 记录使用
   */
  recordUsage(
    modelId: string,
    inputTokens: number,
    outputTokens: number,
    latency: number,
    success: boolean
  ): void {
    const model = this.models.get(modelId)
    if (!model) return

    let stats = this.usageStats.get(modelId)
    if (!stats) {
      stats = {
        modelId,
        provider: model.provider,
        totalRequests: 0,
        totalInputTokens: 0,
        totalOutputTokens: 0,
        totalCost: 0,
        averageLatency: 0,
        errorRate: 0,
        lastUsed: Date.now(),
        dailyStats: [],
      }
      this.usageStats.set(modelId, stats)
    }

    const cost = this.estimateCost(modelId, inputTokens, outputTokens)

    stats.totalRequests++
    stats.totalInputTokens += inputTokens
    stats.totalOutputTokens += outputTokens
    stats.totalCost += cost
    stats.averageLatency = (stats.averageLatency * (stats.totalRequests - 1) + latency) / stats.totalRequests
    stats.lastUsed = Date.now()

    if (!success) {
      stats.errorRate = ((stats.errorRate * (stats.totalRequests - 1)) + 1) / stats.totalRequests
    }

    // 更新每日统计
    const today = new Date().toISOString().split('T')[0]
    let dailyStat = stats.dailyStats.find(d => d.date === today)
    if (!dailyStat) {
      dailyStat = { date: today, requests: 0, inputTokens: 0, outputTokens: 0, cost: 0, errors: 0 }
      stats.dailyStats.push(dailyStat)
    }
    dailyStat.requests++
    dailyStat.inputTokens += inputTokens
    dailyStat.outputTokens += outputTokens
    dailyStat.cost += cost
    if (!success) dailyStat.errors++

    // 只保留最近30天
    stats.dailyStats = stats.dailyStats.slice(-30)

    this.saveUsageStats()
    this.emit('usageRecorded', { modelId, inputTokens, outputTokens, cost })
  }

  /**
   * 获取使用统计
   */
  getUsageStats(modelId?: string): ModelUsageStats | ModelUsageStats[] | undefined {
    if (modelId) {
      return this.usageStats.get(modelId)
    }
    return Array.from(this.usageStats.values())
  }

  /**
   * 获取总成本
   */
  getTotalCost(): number {
    let total = 0
    for (const stats of this.usageStats.values()) {
      total += stats.totalCost
    }
    return total
  }

  /**
   * 比较模型
   */
  compareModels(modelIds: string[]): Array<{
    model: ModelDefinition
    stats?: ModelUsageStats
    score: number
  }> {
    return modelIds
      .map(id => {
        const model = this.models.get(id)
        if (!model) return null

        const stats = this.usageStats.get(id)
        
        // 计算综合得分
        let score = 0
        
        // 性价比 (上下文窗口/价格)
        const avgPrice = (model.inputPrice + model.outputPrice) / 2
        score += (model.contextWindow / 1000) / (avgPrice || 1) * 10

        // 延迟
        if (stats) {
          score -= stats.averageLatency / 1000
          score -= stats.errorRate * 100
        }

        // 能力数量
        score += model.capabilities.filter(c => c.supported).length * 5

        return { model, stats, score }
      })
      .filter(Boolean) as Array<{ model: ModelDefinition; stats?: ModelUsageStats; score: number }>
  }

  /**
   * 检查 Ollama 是否可用
   */
  async checkOllamaAvailable(): Promise<boolean> {
    try {
      const response = await fetch('http://localhost:11434/api/tags', {
        method: 'GET',
      })
      return response.ok
    } catch {
      return false
    }
  }

  /**
   * 获取 Ollama 模型列表
   */
  async getOllamaModels(): Promise<string[]> {
    try {
      const response = await fetch('http://localhost:11434/api/tags')
      if (!response.ok) return []

      const data = await response.json()
      return data.models?.map((m: { name: string }) => m.name) || []
    } catch {
      return []
    }
  }

  /**
   * 关闭模型管理器
   */
  shutdown(): void {
    this.saveUsageStats()
    this.initialized.value = false

    logger.info('[Models] Model manager shut down')
    this.emit('shutdown')
  }
}

// 单例实例
let modelManagerInstance: ModelManager | null = null

/**
 * 获取模型管理器实例
 */
export function getModelManager(config?: ModelManagerConfig): ModelManager {
  if (!modelManagerInstance) {
    modelManagerInstance = new ModelManager(config)
  }
  return modelManagerInstance
}

export default ModelManager
