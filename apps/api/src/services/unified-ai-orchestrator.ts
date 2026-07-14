import { logger } from '../utils/logger.js'

export interface ModelConfig {
  provider: string
  model: string
  apiKey: string
  baseURL?: string
  maxTokens?: number
  temperature?: number
}

export interface ChatRequest {
  messages: Array<{ role: string; content: string }>
  model?: string
  temperature?: number
  maxTokens?: number
  stream?: boolean
}

export interface ChatResponse {
  content: string
  model: string
  usage: { promptTokens: number; completionTokens: number; totalTokens: number }
  latencyMs: number
}

type ErrorCode = 'timeout' | 'rate_limit' | 'unavailable' | 'no_model' | 'api_error'

export class AIOrchestratorError extends Error {
  constructor(
    message: string,
    readonly code: ErrorCode,
    readonly statusCode?: number,
  ) {
    super(message)
    this.name = 'AIOrchestratorError'
  }
}

const DEFAULT_TIMEOUT = 30_000

interface OpenAIResponse {
  choices?: Array<{ message?: { content?: string } }>
  usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number }
}

interface AnthropicResponse {
  content?: Array<{ type: string; text?: string }>
  usage?: { input_tokens?: number; output_tokens?: number }
}

export class UnifiedAIOrchestrator {
  private readonly models: ModelConfig[]
  private readonly rrCounters = new Map<string, number>()

  constructor(models: ModelConfig[]) {
    if (!models || models.length === 0) {
      throw new AIOrchestratorError('至少需要一个模型配置', 'no_model')
    }
    this.models = models
  }

  async chat(req: ChatRequest): Promise<ChatResponse> {
    const model = req.model ?? this.models[0]!.model
    const config = this.routeRequest(model)
    return this.dispatch(config, req)
  }

  async chatWithFallback(req: ChatRequest, fallbackModel?: string): Promise<ChatResponse> {
    const primary = req.model ?? this.models[0]!.model
    try {
      return await this.dispatch(this.routeRequest(primary), req)
    } catch (err) {
      if (err instanceof AIOrchestratorError && err.code === 'no_model') throw err
      const fb = fallbackModel ?? this.models.find((m) => m.model !== primary)?.model
      if (!fb) throw err
      logger.warn('主模型失败,降级备用', { primary, fallback: fb, error: (err as Error).message })
      return this.dispatch(this.routeRequest(fb), { ...req, model: fb })
    }
  }

  private routeRequest(model: string): ModelConfig {
    const matches = this.models.filter((m) => m.model === model)
    if (matches.length === 0) throw new AIOrchestratorError(`未找到模型: ${model}`, 'no_model')
    if (matches.length === 1) return matches[0]!
    const key = `${matches[0]!.provider}:${model}`
    const idx = (this.rrCounters.get(key) ?? 0) % matches.length
    this.rrCounters.set(key, idx + 1)
    return matches[idx]!
  }

  private async dispatch(config: ModelConfig, req: ChatRequest): Promise<ChatResponse> {
    const start = Date.now()
    if (config.provider === 'anthropic') {
      return this.callAnthropic(config, req, start)
    }
    return this.callOpenAI(config, req, start)
  }

  private async callOpenAI(
    config: ModelConfig,
    req: ChatRequest,
    start: number,
  ): Promise<ChatResponse> {
    const url = `${config.baseURL ?? 'https://api.openai.com/v1'}/chat/completions`
    const body: Record<string, unknown> = { model: config.model, messages: req.messages }
    const temp = req.temperature ?? config.temperature
    if (temp !== undefined) body.temperature = temp
    const maxTok = req.maxTokens ?? config.maxTokens
    if (maxTok !== undefined) body.max_tokens = maxTok
    if (req.stream !== undefined) body.stream = req.stream

    const data = await this.fetchWithTimeout<OpenAIResponse>(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${config.apiKey}` },
      body: JSON.stringify(body),
    })
    const u = data.usage
    return {
      content: data.choices?.[0]?.message?.content ?? '',
      model: config.model,
      usage: {
        promptTokens: u?.prompt_tokens ?? 0,
        completionTokens: u?.completion_tokens ?? 0,
        totalTokens: u?.total_tokens ?? 0,
      },
      latencyMs: Date.now() - start,
    }
  }

  private async callAnthropic(
    config: ModelConfig,
    req: ChatRequest,
    start: number,
  ): Promise<ChatResponse> {
    const url = `${config.baseURL ?? 'https://api.anthropic.com'}/v1/messages`
    const system = req.messages
      .filter((m) => m.role === 'system')
      .map((m) => m.content)
      .join('\n')
    const messages = req.messages.filter((m) => m.role !== 'system')
    const body: Record<string, unknown> = {
      model: config.model,
      max_tokens: req.maxTokens ?? config.maxTokens ?? 4096,
      messages,
    }
    if (system) body.system = system
    const temp = req.temperature ?? config.temperature
    if (temp !== undefined) body.temperature = temp

    const data = await this.fetchWithTimeout<AnthropicResponse>(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': config.apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify(body),
    })
    const content = (data.content ?? [])
      .filter((c) => c.type === 'text')
      .map((c) => c.text ?? '')
      .join('')
    const promptTokens = data.usage?.input_tokens ?? 0
    const completionTokens = data.usage?.output_tokens ?? 0
    return {
      content,
      model: config.model,
      usage: { promptTokens, completionTokens, totalTokens: promptTokens + completionTokens },
      latencyMs: Date.now() - start,
    }
  }

  private async fetchWithTimeout<T>(url: string, init: RequestInit): Promise<T> {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT)
    try {
      const res = await fetch(url, { ...init, signal: controller.signal })
      if (res.status === 429) throw new AIOrchestratorError('速率限制(429)', 'rate_limit', 429)
      if (res.status >= 500)
        throw new AIOrchestratorError(`服务不可用(${res.status})`, 'unavailable', res.status)
      if (!res.ok) {
        const text = await res.text().catch(() => '')
        throw new AIOrchestratorError(
          `API错误(${res.status}): ${text.slice(0, 200)}`,
          'api_error',
          res.status,
        )
      }
      return (await res.json()) as T
    } catch (err) {
      if (err instanceof AIOrchestratorError) throw err
      if (err instanceof Error && err.name === 'AbortError') {
        throw new AIOrchestratorError('请求超时(30s)', 'timeout')
      }
      throw new AIOrchestratorError(`网络错误: ${(err as Error).message}`, 'api_error')
    } finally {
      clearTimeout(timer)
    }
  }
}
