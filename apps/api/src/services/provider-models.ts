/**
 * Provider 模型列表拉取服务(2026-07-24 立)。
 *
 * 支持 7 个 provider(stepfun/agnes/groq/gemini/openrouter/openai/anthropic)
 * 调用各自 /v1/models 接口拉取上游模型列表,Redis 缓存 24h TTL,
 * 失败降级到 FALLBACK_MODELS,保证调用方始终拿到可用模型。
 *
 * 设计:
 *  1. 不引入新依赖,仅用全局 fetch + ioredis(已存在)。
 *  2. API key 优先用户传入,否则读环境变量。
 *  3. gemini 用 key=API_KEY query 参数;anthropic 用 x-api-key + anthropic-version;
 *     其余 OpenAI 兼容端点用 Authorization: Bearer。
 *  4. 超时 10s(AbortController),失败不抛错,降级 FALLBACK_MODELS。
 *  5. Redis 缓存 key=`provider:models:<provider>`,TTL 86400s;Redis 不可用时跳过缓存。
 */
import type { Redis } from 'ioredis'
import type { ProviderModelInfo, ProviderModelListResponse } from '@ihui/types'

/** 各 provider 的 API base 与 API key 环境变量名映射 */
const PROVIDER_CONFIG: Record<string, { apiBase: string; apiKeyEnv: string }> = {
  stepfun: {
    apiBase: process.env.STEPFUN_API_BASE || 'https://api.stepfun.com/step_plan/v1',
    apiKeyEnv: 'STEPFUN_API_KEY',
  },
  agnes: {
    apiBase: process.env.AGNES_API_BASE || 'https://apihub.agnes-ai.com/v1',
    apiKeyEnv: 'AGNES_API_KEY',
  },
  groq: { apiBase: 'https://api.groq.com/openai/v1', apiKeyEnv: 'GROQ_API_KEY' },
  gemini: {
    apiBase: 'https://generativelanguage.googleapis.com/v1beta',
    apiKeyEnv: 'GEMINI_API_KEY',
  },
  openrouter: { apiBase: 'https://openrouter.ai/api/v1', apiKeyEnv: 'OPENROUTER_API_KEY' },
  openai: { apiBase: 'https://api.openai.com/v1', apiKeyEnv: 'OPENAI_API_KEY' },
  anthropic: { apiBase: 'https://api.anthropic.com/v1', apiKeyEnv: 'ANTHROPIC_API_KEY' },
}

/** 缓存 TTL 24h(秒) */
const CACHE_TTL_SEC = 86400

/** 请求超时 10s */
const FETCH_TIMEOUT_MS = 10000

/** FALLBACK_MODELS:provider 失败时的兜底模型列表(每个 provider 几个常用模型) */
const FALLBACK_MODELS: Record<string, ProviderModelInfo[]> = {
  stepfun: [
    { id: 'step-3.7-flash', name: 'Step 3.7 Flash', contextWindow: 32768, supportsStreaming: true, supportsToolCalls: true, supportsVision: false, inputPrice: null, outputPrice: null },
    { id: 'step-3.5-flash', name: 'Step 3.5 Flash', contextWindow: 32768, supportsStreaming: true, supportsToolCalls: true, supportsVision: false, inputPrice: null, outputPrice: null },
    { id: 'step-router-v1', name: 'Step Router v1', contextWindow: 32768, supportsStreaming: true, supportsToolCalls: true, supportsVision: false, inputPrice: null, outputPrice: null },
  ],
  agnes: [
    { id: 'gpt-4o', name: 'GPT-4o', contextWindow: 128000, supportsStreaming: true, supportsToolCalls: true, supportsVision: true, inputPrice: null, outputPrice: null },
    { id: 'claude-3-5-sonnet', name: 'Claude 3.5 Sonnet', contextWindow: 200000, supportsStreaming: true, supportsToolCalls: true, supportsVision: true, inputPrice: null, outputPrice: null },
  ],
  groq: [
    { id: 'llama-3.3-70b-versatile', name: 'Llama 3.3 70B Versatile', contextWindow: 131072, supportsStreaming: true, supportsToolCalls: true, supportsVision: false, inputPrice: null, outputPrice: null },
    { id: 'llama-3.1-8b-instant', name: 'Llama 3.1 8B Instant', contextWindow: 131072, supportsStreaming: true, supportsToolCalls: true, supportsVision: false, inputPrice: null, outputPrice: null },
    { id: 'mixtral-8x7b-32768', name: 'Mixtral 8x7B', contextWindow: 32768, supportsStreaming: true, supportsToolCalls: true, supportsVision: false, inputPrice: null, outputPrice: null },
  ],
  gemini: [
    { id: 'gemini-1.5-pro', name: 'Gemini 1.5 Pro', contextWindow: 2000000, supportsStreaming: true, supportsToolCalls: true, supportsVision: true, inputPrice: null, outputPrice: null },
    { id: 'gemini-1.5-flash', name: 'Gemini 1.5 Flash', contextWindow: 1000000, supportsStreaming: true, supportsToolCalls: true, supportsVision: true, inputPrice: null, outputPrice: null },
    { id: 'gemini-2.0-flash', name: 'Gemini 2.0 Flash', contextWindow: 1000000, supportsStreaming: true, supportsToolCalls: true, supportsVision: true, inputPrice: null, outputPrice: null },
  ],
  openrouter: [
    { id: 'anthropic/claude-3.5-sonnet', name: 'Claude 3.5 Sonnet (OpenRouter)', contextWindow: 200000, supportsStreaming: true, supportsToolCalls: true, supportsVision: true, inputPrice: null, outputPrice: null },
    { id: 'openai/gpt-4o', name: 'GPT-4o (OpenRouter)', contextWindow: 128000, supportsStreaming: true, supportsToolCalls: true, supportsVision: true, inputPrice: null, outputPrice: null },
    { id: 'google/gemini-2.0-flash-exp', name: 'Gemini 2.0 Flash (OpenRouter)', contextWindow: 1000000, supportsStreaming: true, supportsToolCalls: true, supportsVision: true, inputPrice: null, outputPrice: null },
  ],
  openai: [
    { id: 'gpt-4o', name: 'GPT-4o', contextWindow: 128000, supportsStreaming: true, supportsToolCalls: true, supportsVision: true, inputPrice: null, outputPrice: null },
    { id: 'gpt-4o-mini', name: 'GPT-4o mini', contextWindow: 128000, supportsStreaming: true, supportsToolCalls: true, supportsVision: true, inputPrice: null, outputPrice: null },
    { id: 'gpt-4-turbo', name: 'GPT-4 Turbo', contextWindow: 128000, supportsStreaming: true, supportsToolCalls: true, supportsVision: true, inputPrice: null, outputPrice: null },
  ],
  anthropic: [
    { id: 'claude-3-5-sonnet-20241022', name: 'Claude 3.5 Sonnet', contextWindow: 200000, supportsStreaming: true, supportsToolCalls: true, supportsVision: true, inputPrice: null, outputPrice: null },
    { id: 'claude-3-5-haiku-20241022', name: 'Claude 3.5 Haiku', contextWindow: 200000, supportsStreaming: true, supportsToolCalls: true, supportsVision: false, inputPrice: null, outputPrice: null },
    { id: 'claude-3-opus-20240229', name: 'Claude 3 Opus', contextWindow: 200000, supportsStreaming: true, supportsToolCalls: true, supportsVision: true, inputPrice: null, outputPrice: null },
  ],
}

/** 支持的 provider 列表(供调用方校验) */
export const SUPPORTED_PROVIDERS: string[] = Object.keys(PROVIDER_CONFIG)

/** 计算 Redis 缓存 key */
export function getCacheKey(provider: string, userId?: string): string {
  return `provider:models:${provider}${userId ? `:${userId}` : ''}`
}

interface CachePayload {
  models: ProviderModelInfo[]
  expiresAt: string
}

/**
 * 拉取 provider 模型列表(带 Redis 缓存 24h,失败降级 FALLBACK_MODELS)。
 *
 * 流程:
 *  1. 查 Redis 缓存 → 命中返回 { source: 'cache', cached: true }
 *  2. 未命中 → 调 GET <apiBase>/models(Authorization: Bearer / x-api-key / key=?)
 *  3. 成功 → 缓存 24h,返回 { source: 'live', cached: false }
 *  4. 失败 → 降级 FALLBACK_MODELS,返回 { source: 'fallback', cached: false }
 */
export async function fetchProviderModels(
  provider: string,
  userApiKey?: string,
  redis?: Redis | null,
): Promise<ProviderModelListResponse> {
  const fallbackModels = FALLBACK_MODELS[provider] ?? []
  const fallback: ProviderModelListResponse = {
    provider,
    models: fallbackModels,
    cached: false,
    cacheExpiresAt: null,
    source: 'fallback',
  }

  const cfg = PROVIDER_CONFIG[provider]
  if (!cfg) return fallback

  const cacheKey = getCacheKey(provider)

  // 1. 查 Redis 缓存
  if (redis) {
    try {
      const raw = await redis.get(cacheKey)
      if (raw) {
        const payload = JSON.parse(raw) as Partial<CachePayload>
        if (Array.isArray(payload?.models)) {
          return {
            provider,
            models: payload.models as ProviderModelInfo[],
            cached: true,
            cacheExpiresAt: payload.expiresAt ?? null,
            source: 'cache',
          }
        }
      }
    } catch {
      // Redis 读失败 → 忽略,走 live
    }
  }

  // 2. 解析 API key(优先用户传入,否则环境变量)
  const apiKey = userApiKey || process.env[cfg.apiKeyEnv] || ''

  // 3. 调上游 /models
  const models = await fetchUpstreamModels(provider, cfg.apiBase, apiKey)
  if (models.length === 0) return fallback

  // 4. 写 Redis 缓存 24h
  const expiresAt = new Date(Date.now() + CACHE_TTL_SEC * 1000).toISOString()
  if (redis) {
    try {
      const payload: CachePayload = { models, expiresAt }
      await redis.set(cacheKey, JSON.stringify(payload), 'EX', CACHE_TTL_SEC)
    } catch {
      // Redis 写失败 → 忽略
    }
  }

  return {
    provider,
    models,
    cached: false,
    cacheExpiresAt: expiresAt,
    source: 'live',
  }
}

/** 调上游 /models 并规范化为 ProviderModelInfo[](10s 超时,失败返回空数组) */
async function fetchUpstreamModels(
  provider: string,
  apiBase: string,
  apiKey: string,
): Promise<ProviderModelInfo[]> {
  const base = apiBase.replace(/\/$/, '')
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)
  try {
    let url: string
    const headers: Record<string, string> = { Accept: 'application/json' }
    if (provider === 'gemini') {
      // gemini 用 key=API_KEY query 参数
      url = `${base}/models${apiKey ? `?key=${encodeURIComponent(apiKey)}` : ''}`
    } else if (provider === 'anthropic') {
      url = `${base}/models?limit=1000`
      if (apiKey) headers['x-api-key'] = apiKey
      headers['anthropic-version'] = '2023-06-01'
    } else {
      url = `${base}/models`
      if (apiKey) headers.Authorization = `Bearer ${apiKey}`
    }

    const resp = await fetch(url, { method: 'GET', headers, signal: controller.signal })
    if (!resp.ok) return []
    const data = (await resp.json()) as Record<string, unknown>
    return normalizeModels(provider, data)
  } catch {
    return []
  } finally {
    clearTimeout(timer)
  }
}

/** 将上游响应规范化为 ProviderModelInfo[](OpenAI / anthropic / gemini 三种格式) */
function normalizeModels(provider: string, data: Record<string, unknown>): ProviderModelInfo[] {
  let candidates: unknown[] = []
  if (Array.isArray(data.data)) candidates = data.data
  else if (Array.isArray(data.models)) candidates = data.models

  const models: ProviderModelInfo[] = []
  for (const m of candidates) {
    if (!m || typeof m !== 'object') continue
    const row = m as Record<string, unknown>

    // 解析 id:gemini 用 name("models/xxx") 前缀,其余用 id
    let id = ''
    if (provider === 'gemini' && typeof row.name === 'string') {
      id = row.name.startsWith('models/') ? row.name.slice(7) : row.name
    } else if (typeof row.id === 'string') {
      id = row.id
    }
    if (!id) continue

    // 解析显示名:anthropic 用 display_name,gemini 用 displayName,其余回退 id
    const name =
      (typeof row.display_name === 'string' && row.display_name) ||
      (typeof row.displayName === 'string' && row.displayName) ||
      id

    // 上下文窗口:OpenAI context_length / Groq context_window
    const ctxRaw = row.context_length ?? row.context_window ?? row.contextLength
    const contextWindow = typeof ctxRaw === 'number' ? ctxRaw : null

    models.push({
      id,
      name,
      contextWindow,
      supportsStreaming: null,
      supportsToolCalls: null,
      supportsVision: null,
      inputPrice: null,
      outputPrice: null,
    })
  }
  return models
}
