/**
 * /v1/* 对外公开 API 路由(2026-07-22 立)。
 *
 * 所有端点统一 requireApiKeyAuth + requireApiKeyPermission + requireApiKeyQuota 三重 preHandler。
 * 响应格式 OpenAI 兼容(不套 { code, message, data } 壳)。
 * 鉴权由 plugins/api-key-auth.ts 提供,契约类型由 @ihui/types 提供。
 *
 * 端点清单:
 * 1. GET    /v1/agents           — 列出可用 Agent(权限: agents:read)
 * 2. GET    /v1/agents/:id       — Agent 详情(权限: agents:read)
 * 3. POST   /v1/agents/:id/call  — 调用 Agent(权限: agents:call)
 * 4. POST   /v1/chat/completions — Chat 补全(权限: chat:write,OpenAI 兼容)
 * 5. GET    /v1/models           — 模型列表(权限: models:read)
 * 6. GET    /v1/files            — 文件列表(权限: files:read)
 * 7. POST   /v1/files            — 上传文件(权限: files:write)
 */
import type { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify'
import { randomUUID } from 'node:crypto'
import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { eq, and, isNull, desc, sql } from 'drizzle-orm'
import { z } from 'zod'
import { config } from '../config/index.js'
import { db, dbRead } from '../db/index.js'
import {
  agents,
  files,
  projects,
  chatConversations,
  aiModelConfigModels,
  aiModelConfig,
} from '@ihui/database'
import type {
  V1AgentInfo,
  V1AgentsListResponse,
  V1AgentCallResponse,
  V1ChatCompletionResponse,
  V1ModelsResponse,
} from '@ihui/types'
import {
  requireApiKeyAuth,
  requireApiKeyPermission,
  requireApiKeyQuota,
} from '../plugins/api-key-auth.js'
import { error } from '../utils/response.js'
// P0-5 中转站计费(2026-07-29 立)
import { checkQuota, recordCall, isByokCall } from '../services/relay-billing-service.js'

/** 鉴权后注入 request 的 API Key 上下文(与 AuthenticatedApiKey 结构一致) */
interface ApiKeyContext {
  id: string
  userId: string
  key: string
  permissions: string[]
  rateLimit: number
}

// =============================================================================
// Zod schemas
// =============================================================================

const chatCompletionSchema = z.object({
  model: z.string().min(1),
  messages: z
    .array(
      z.object({
        role: z.enum(['system', 'user', 'assistant']),
        content: z.string(),
      }),
    )
    .min(1),
  stream: z.boolean().optional().default(false),
  temperature: z.number().optional(),
  maxTokens: z.number().int().positive().optional(),
})

const agentCallSchema = z.object({
  input: z.string().min(1),
  sessionId: z.string().optional(),
})

// =============================================================================
// Fastify OpenAPI schemas(共享)
// =============================================================================

const errorResponseSchema = {
  type: 'object',
  properties: { code: { type: 'number' }, message: { type: 'string' } },
}

// =============================================================================
// 静态降级数据 + 模型缓存
// =============================================================================

/** ai-service 不可用时的最终兜底模型清单(只在 live + cache 均失败时使用)。 */
const FALLBACK_MODELS: V1ModelsResponse = {
  object: 'list',
  data: [
    { id: 'gpt-4o', object: 'model', created: 1700000000, owned_by: 'openai' },
    { id: 'gpt-4o-mini', object: 'model', created: 1700000000, owned_by: 'openai' },
    { id: 'gpt-4-turbo', object: 'model', created: 1700000000, owned_by: 'openai' },
    { id: 'claude-3-5-sonnet', object: 'model', created: 1700000000, owned_by: 'anthropic' },
    { id: 'claude-3-5-haiku', object: 'model', created: 1700000000, owned_by: 'anthropic' },
    { id: 'glm-4', object: 'model', created: 1700000000, owned_by: 'zhipu' },
    { id: 'glm-4-flash', object: 'model', created: 1700000000, owned_by: 'zhipu' },
    { id: 'deepseek-chat', object: 'model', created: 1700000000, owned_by: 'deepseek' },
    { id: 'qwen-plus', object: 'model', created: 1700000000, owned_by: 'alibaba' },
    { id: 'moonshot-v1-8k', object: 'model', created: 1700000000, owned_by: 'moonshot' },
  ],
}

/**
 * 模型列表缓存(5 分钟 TTL,避免每次请求都打 ai-service)。
 * source 标识:'live' 实时拉取 / 'cache' 命中缓存 / 'fallback' 静态兜底。
 */
const MODELS_CACHE_TTL_MS = 5 * 60 * 1000
interface ModelsCacheEntry {
  data: V1ModelsResponse
  fetchedAt: number
}
let modelsCache: ModelsCacheEntry | null = null

/**
 * 拉取模型列表(P0-5 中转站:优先 DB 驱动 → live → cache → fallback)。
 * 返回响应体 + 来源标识,由调用方写入 X-Model-Source 响应头。
 *
 * 来源优先级:
 * 1. 'db' — 从 ai_model_config_models WHERE is_relay_public=true 查询中转站已上架模型(admin 控制)
 * 2. 'live' — 从 ai-service /api/llm/models 实时拉取
 * 3. 'cache' — 命中 5min 缓存
 * 4. 'fallback' — 静态兜底清单
 */
/**
 * P0-5 修复(2026-07-30):DB model_id → LiteLLM 带前缀 model id 映射。
 *
 * ai-service /api/llm/complete 的 _resolve_provider 根据 model 前缀路由 provider:
 *   stepfun/* → STEPFUN_API_KEY + STEPFUN_API_BASE
 *   agnes/*   → AGNES_API_KEY + AGNES_API_BASE
 *   其他      → 默认 OPENAI_API_KEY
 *
 * DB ai_model_config_models.model_id 存的是不带前缀的原始 model 名(如 step-3.7-flash),
 * 需要根据 ai_model_config.provider_code + base_url 推断 LiteLLM 前缀并拼接。
 *
 * 映射规则:
 *   provider_code='stepfun'                → stepfun/{model_id}
 *   base_url 含 'agnes-ai.com'             → agnes/{model_id}
 *   base_url 含 'openai.com' 或其他        → {model_id}(不加前缀,走默认 OpenAI 路径)
 *
 * 反向去前缀在 relay-billing-service.ts 的 stripLiteLLMPrefix 中实现(calculateCost 用)。
 */
function toLiteLLMModelId(modelId: string, providerCode: string, baseUrl: string): string {
  if (providerCode === 'stepfun') return `stepfun/${modelId}`
  if (baseUrl && baseUrl.includes('agnes-ai.com')) return `agnes/${modelId}`
  // P0-5m(2026-07-30):OpenRouter 模型加 openrouter/ 前缀,
  // ai-service _resolve_provider 识别 openrouter/ 前缀后走 LiteLLM 原生 OpenRouter 路由。
  // OpenRouter 上游模型 ID 已含厂商前缀(如 deepseek/deepseek-v4-pro),
  // 加 openrouter/ 后变成 openrouter/deepseek/deepseek-v4-pro(LiteLLM 原生格式)。
  if (providerCode === 'openrouter') return `openrouter/${modelId}`
  // 其他 provider(openai/groq/gemini 等)若已带前缀则原样返回,否则不加前缀
  return modelId
}

async function fetchModels(userId?: string): Promise<{
  body: V1ModelsResponse
  source: 'db' | 'live' | 'cache' | 'fallback'
}> {
  const now = Date.now()

  // 1. 优先 DB 驱动:查中转站已上架模型(admin 控制可见性)
  try {
    const dbModels = await dbRead
      .select({
        id: aiModelConfigModels.modelId,
        relayDisplayName: aiModelConfigModels.relayDisplayName,
        displayName: aiModelConfigModels.displayName,
        sortOrder: aiModelConfigModels.relaySortOrder,
        providerCode: aiModelConfig.providerCode,
        configName: aiModelConfig.name,
        baseUrl: aiModelConfig.baseUrl,
      })
      .from(aiModelConfigModels)
      .innerJoin(aiModelConfig, eq(aiModelConfigModels.configId, aiModelConfig.id))
      .where(
        and(
          eq(aiModelConfigModels.isRelayPublic, true),
          eq(aiModelConfigModels.enabled, true),
          eq(aiModelConfig.enabled, true),
        ),
      )
      .orderBy(aiModelConfigModels.relaySortOrder, aiModelConfigModels.modelId)

    // BYOK 平台模式(2026-07-30):鉴权用户额外查其私有 BYOK 配置下的 models,
    // 合并到返回结果,owned_by 标记为 'byok'(用户用自己的 key 调用,平台只收抽成)
    let byokModels: Array<{
      id: string
      providerCode: string
      configName: string
      baseUrl: string
    }> = []
    if (userId) {
      try {
        byokModels = await dbRead
          .select({
            id: aiModelConfigModels.modelId,
            providerCode: aiModelConfig.providerCode,
            configName: aiModelConfig.name,
            baseUrl: aiModelConfig.baseUrl,
          })
          .from(aiModelConfigModels)
          .innerJoin(aiModelConfig, eq(aiModelConfigModels.configId, aiModelConfig.id))
          .where(
            and(
              eq(aiModelConfig.ownerUuid, userId),
              eq(aiModelConfig.enabled, true),
              eq(aiModelConfigModels.enabled, true),
            ),
          )
          .orderBy(aiModelConfigModels.modelId)
      } catch {
        // BYOK 查询失败,忽略(不影响主列表)
      }
    }

    if (dbModels.length > 0 || byokModels.length > 0) {
      const relayList = dbModels.map((m) => ({
        // P0-5 修复(2026-07-30):返回带 LiteLLM 前缀的 model id,
        // 客户端可直接传给 /v1/chat/completions,api 转发给 ai-service 无需二次映射。
        // 映射规则:provider_code=stepfun → stepfun/,base_url 含 agnes-ai.com → agnes/,
        // 其他(如 openai/原生)→ 不加前缀。
        id: toLiteLLMModelId(m.id, m.providerCode, m.baseUrl),
        object: 'model' as const,
        created: Math.floor(now / 1000),
        owned_by: m.providerCode || m.configName || 'ihui',
      }))
      const byokList = byokModels.map((m) => ({
        id: toLiteLLMModelId(m.id, m.providerCode, m.baseUrl),
        object: 'model' as const,
        created: Math.floor(now / 1000),
        owned_by: 'byok',
      }))
      const mapped: V1ModelsResponse = {
        object: 'list',
        data: [...relayList, ...byokList],
      }
      modelsCache = { data: mapped, fetchedAt: now }
      return { body: mapped, source: 'db' }
    }
  } catch {
    // DB 查询失败,降级 live
  }

  // 2. 缓存未过期 → 直接命中
  if (modelsCache && now - modelsCache.fetchedAt < MODELS_CACHE_TTL_MS) {
    return { body: modelsCache.data, source: 'cache' }
  }
  try {
    const resp = await fetch(`${config.AI_SERVICE_URL}/api/llm/models`, { method: 'GET' })
    if (resp.ok) {
      const data = (await resp.json()) as unknown
      let models: unknown[] = []
      if (Array.isArray(data)) models = data
      else if (data && typeof data === 'object') {
        const obj = data as Record<string, unknown>
        if (Array.isArray(obj.data)) models = obj.data
        else if (Array.isArray(obj.models)) models = obj.models
      }
      if (models.length > 0) {
        const mapped: V1ModelsResponse = {
          object: 'list',
          data: models.map((m) => {
            const mo = (m ?? {}) as Record<string, unknown>
            const id =
              (typeof mo.id === 'string' && mo.id) ||
              (typeof mo.model === 'string' && mo.model) ||
              (typeof mo.code === 'string' && mo.code) ||
              (typeof mo.name === 'string' && mo.name) ||
              'unknown'
            const ownedBy =
              (typeof mo.owned_by === 'string' && mo.owned_by) ||
              (typeof mo.provider === 'string' && mo.provider) ||
              (typeof mo.manufacturer === 'string' && mo.manufacturer) ||
              'ihui'
            const created = typeof mo.created === 'number' ? mo.created : Math.floor(now / 1000)
            return { id, object: 'model' as const, created, owned_by: ownedBy }
          }),
        }
        modelsCache = { data: mapped, fetchedAt: now }
        return { body: mapped, source: 'live' }
      }
    }
  } catch {
    // live 失败,降级 cache(若已过期则进一步降级 fallback)
  }
  // live 失败,但缓存还在(即便已过期)→ 用旧缓存
  if (modelsCache) {
    return { body: modelsCache.data, source: 'cache' }
  }
  return { body: FALLBACK_MODELS, source: 'fallback' }
}

// =============================================================================
// 辅助函数
// =============================================================================

/**
 * 根据模型名推导能力标签(用于 GET /v1/agents capabilities + GET /v1/models/:id)。
 * 规则:基于模型名前缀匹配主流厂商命名约定。
 */
function deriveModelCapabilities(modelName: string): string[] {
  const name = modelName.toLowerCase()
  const caps: string[] = ['chat']
  // GPT-4* / GPT-5* → vision + tools
  if (/^gpt-(4|5|o)/.test(name) || name.includes('gpt-4o') || name.includes('gpt-4-turbo')) {
    caps.push('vision', 'tools')
  } else if (/^gpt-3/.test(name)) {
    caps.push('tools')
  }
  // Claude 3+ → vision + tools
  if (/^claude-3/.test(name) || /^claude-4/.test(name)) {
    caps.push('vision', 'tools')
  }
  // o1 / o3 / o4 系列 → reasoning
  if (
    /^o[134]-/.test(name) ||
    name.startsWith('o1') ||
    name.startsWith('o3') ||
    name.startsWith('o4')
  ) {
    caps.push('reasoning', 'tools')
  }
  // Gemini → vision + tools
  if (name.startsWith('gemini-')) {
    caps.push('vision', 'tools')
  }
  // Qwen-VL / Qwen2-VL → vision
  if (name.includes('vl') || name.includes('vision')) {
    caps.push('vision')
  }
  return Array.from(new Set(caps))
}

type AgentRow = typeof agents.$inferSelect

/** 从 agents 表行映射为 V1AgentInfo。capabilities 由 botId + agentModel 综合推导。 */
function toAgentInfo(row: AgentRow): V1AgentInfo {
  const capabilities = new Set<string>(['chat'])
  if (row.botId) capabilities.add('coze')
  if (row.agentModel) {
    capabilities.add('model:' + row.agentModel)
    // 沿用模型名推导 vision/tools/reasoning 标签(与 GET /v1/models/:id 一致)
    for (const c of deriveModelCapabilities(row.agentModel)) capabilities.add(c)
  }
  return {
    id: row.agentId,
    name: row.name,
    description: row.description ?? '',
    capabilities: Array.from(capabilities),
  }
}

/**
 * 从 ai-service 流式响应行中提取文本。
 * 处理 Vercel AI SDK `0:"text"` 格式和 `data: {...}` SSE 格式。
 */
function extractStreamText(line: string): string | null {
  const trimmed = line.trim()
  if (!trimmed || trimmed.startsWith(':')) return null

  // Vercel AI SDK: 0:"text" (type:payload)
  const vercelMatch = /^(\d+):(.+)$/.exec(trimmed)
  if (vercelMatch) {
    const type = vercelMatch[1]
    const payload = vercelMatch[2]
    if (type === '0' && payload) {
      try {
        const text = JSON.parse(payload)
        if (typeof text === 'string') return text
      } catch {
        /* not JSON */
      }
    }
    return null
  }

  // SSE data: format
  if (trimmed.startsWith('data:')) {
    const data = trimmed.slice(5).trim()
    if (!data || data === '[DONE]') return null
    try {
      const json = JSON.parse(data)
      if (typeof json === 'string') return json
      if (typeof json.content === 'string') return json.content
      if (typeof json.token === 'string') return json.token
      if (json.delta?.content) return json.delta.content
      if (json.choices?.[0]?.delta?.content) return json.choices[0].delta.content
    } catch {
      /* not JSON */
    }
  }

  return null
}

// =============================================================================
// 流式 Chat 补全辅助函数
// =============================================================================

async function streamChatCompletion(
  request: FastifyRequest,
  reply: FastifyReply,
  opts: {
    model: string
    messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>
    temperature?: number
    maxTokens?: number
    /** P0-5 中转站计费:API Key id + 用户 id + prompt 文本 + 调用起始时间 */
    apiKeyId?: string
    userId?: string
    promptText?: string
    startTime?: number
    /** 计费模式:'relay'=中转站(默认) | 'byok'=BYOK(平台只收抽成) */
    mode?: 'relay' | 'byok'
  },
): Promise<void> {
  reply.hijack()
  const raw = reply.raw
  raw.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  })

  const id = `chatcmpl-${randomUUID()}`
  const created = Math.floor(Date.now() / 1000)
  const { model, messages, temperature, maxTokens, userId } = opts
  /** 累计响应文本用于估算 token(P0-5 流式无准确 usage) */
  let responseText = ''
  let streamError: string | null = null

  const writeChunk = (delta: Record<string, unknown>, finishReason: string | null) => {
    raw.write(
      `data: ${JSON.stringify({
        id,
        object: 'chat.completion.chunk',
        created,
        model,
        choices: [{ index: 0, delta, finish_reason: finishReason }],
      })}\n\n`,
    )
  }

  // 首个 chunk:role
  writeChunk({ role: 'assistant', content: '' }, null)

  const controller = new AbortController()
  const onClose = () => controller.abort()
  request.raw.on('close', onClose)

  try {
    const body: Record<string, unknown> = { messages, model }
    if (temperature !== undefined) body.temperature = temperature
    if (maxTokens !== undefined) body.max_tokens = maxTokens
    // BYOK 平台模式(2026-07-30):透传 owner_uuid via metadata.userId
    if (userId) body.metadata = { userId }

    const resp = await fetch(`${config.AI_SERVICE_URL}/api/llm/complete/stream`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'text/event-stream',
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    })

    if (!resp.ok || !resp.body) {
      const errText = await resp.text().catch(() => '')
      streamError = `upstream ${resp.status}: ${errText.slice(0, 200)}`
      writeChunk({ content: `[error] ${streamError}` }, 'stop')
      raw.write('data: [DONE]\n\n')
      return
    }

    const reader = resp.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''

    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      let nl: number
      while ((nl = buffer.indexOf('\n')) !== -1) {
        const line = buffer.slice(0, nl).replace(/\r$/, '')
        buffer = buffer.slice(nl + 1)
        const text = extractStreamText(line)
        if (text) {
          responseText += text
          writeChunk({ content: text }, null)
        }
      }
    }
    if (buffer.trim()) {
      const text = extractStreamText(buffer)
      if (text) {
        responseText += text
        writeChunk({ content: text }, null)
      }
    }

    // 结束 chunk
    writeChunk({}, 'stop')
    raw.write('data: [DONE]\n\n')
  } catch (e) {
    const msg = (e as Error).name === 'AbortError' ? 'client disconnected' : (e as Error).message
    streamError = msg
    writeChunk({ content: `[error] ${msg}` }, 'stop')
    raw.write('data: [DONE]\n\n')
  } finally {
    request.raw.off('close', onClose)
    raw.end()

    // P0-5 中转站计费:流式结束后聚合 token 用量写入计费
    if (opts.apiKeyId && opts.userId) {
      const promptTokens = Math.ceil((opts.promptText ?? '').length / 4)
      const completionTokens = Math.ceil(responseText.length / 4)
      const totalTokens = promptTokens + completionTokens
      void recordCall({
        apiKeyId: opts.apiKeyId,
        userId: opts.userId,
        model,
        prompt: opts.promptText ?? '',
        response: responseText,
        promptTokens,
        completionTokens,
        totalTokens,
        latencyMs: Date.now() - (opts.startTime ?? Date.now()),
        status: streamError ? 'error' : 'success',
        errorMessage: streamError,
        metadata: { stream: true },
        mode: opts.mode ?? 'relay',
      }).catch(() => {})
    }
  }
}

// =============================================================================
// 路由插件
// =============================================================================

const v1PublicRoutes: FastifyPluginAsync = async (server) => {
  // ===== 1. GET /agents — 列出可用 Agent =====
  server.get(
    '/agents',
    {
      schema: {
        description: '列出可用 Agent',
        tags: ['Agents'],
        // P2 修复:新增可选 limit/offset 分页参数,防止返回所有 published agents(原无 limit)
        querystring: {
          type: 'object',
          properties: {
            limit: { type: 'integer', minimum: 1, maximum: 100, default: 20 },
            offset: { type: 'integer', minimum: 0, default: 0 },
          },
          additionalProperties: false,
        },
        response: {
          200: {
            type: 'object',
            properties: {
              object: { type: 'string' },
              data: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    id: { type: 'string' },
                    name: { type: 'string' },
                    description: { type: 'string' },
                    capabilities: { type: 'array', items: { type: 'string' } },
                  },
                },
              },
            },
          },
          401: errorResponseSchema,
        },
      },
      preHandler: [requireApiKeyAuth, requireApiKeyPermission('agents:read'), requireApiKeyQuota()],
    },
    async (request, reply) => {
      // P2 修复:解析分页参数,默认 limit=20,范围 1-100;offset 默认 0
      const query = (request.query ?? {}) as { limit?: number; offset?: number }
      const safeLimit = Math.min(Math.max(Number(query.limit) || 20, 1), 100)
      const safeOffset = Math.max(Number(query.offset) || 0, 0)

      const rows = await dbRead
        .select()
        .from(agents)
        .where(eq(agents.status, 'published'))
        .limit(safeLimit)
        .offset(safeOffset)
      const data = rows.map(toAgentInfo)
      const resp: V1AgentsListResponse = { object: 'list', data }
      return reply.send(resp)
    },
  )

  // ===== 2. GET /agents/:id — Agent 详情 =====
  server.get(
    '/agents/:id',
    {
      schema: {
        description: 'Agent 详情',
        tags: ['Agents'],
        params: {
          type: 'object',
          properties: { id: { type: 'string' } },
          required: ['id'],
        },
        response: {
          200: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              name: { type: 'string' },
              description: { type: 'string' },
              capabilities: { type: 'array', items: { type: 'string' } },
            },
          },
          401: errorResponseSchema,
          404: errorResponseSchema,
        },
      },
      preHandler: [requireApiKeyAuth, requireApiKeyPermission('agents:read'), requireApiKeyQuota()],
    },
    async (request, reply) => {
      const { id } = request.params as { id: string }
      const [row] = await dbRead.select().from(agents).where(eq(agents.agentId, id)).limit(1)

      if (!row || row.status !== 'published') {
        return reply.status(404).send(error(404, 'Agent not found'))
      }
      return reply.send(toAgentInfo(row))
    },
  )

  // ===== 3. POST /agents/:id/call — 调用 Agent =====
  server.post(
    '/agents/:id/call',
    {
      schema: {
        description: '调用 Agent',
        tags: ['Agents'],
        params: {
          type: 'object',
          properties: { id: { type: 'string' } },
          required: ['id'],
        },
        body: {
          type: 'object',
          properties: {
            input: { type: 'string' },
            sessionId: { type: 'string' },
          },
          required: ['input'],
        },
        response: {
          200: {
            type: 'object',
            properties: {
              agentId: { type: 'string' },
              sessionId: { type: 'string' },
              output: { type: 'string' },
              usage: {
                type: 'object',
                properties: { totalTokens: { type: 'number' } },
              },
            },
          },
          400: errorResponseSchema,
          401: errorResponseSchema,
          404: errorResponseSchema,
          502: errorResponseSchema,
          503: errorResponseSchema,
        },
      },
      preHandler: [requireApiKeyAuth, requireApiKeyPermission('agents:call'), requireApiKeyQuota()],
    },
    async (request, reply) => {
      const { id } = request.params as { id: string }
      const parsed = agentCallSchema.safeParse(request.body)
      if (!parsed.success) {
        return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
      }
      const { input, sessionId } = parsed.data

      const [agent] = await dbRead.select().from(agents).where(eq(agents.agentId, id)).limit(1)
      if (!agent || agent.status !== 'published') {
        return reply.status(404).send(error(404, 'Agent not found'))
      }

      // 转发到 ai-service /api/llm/complete,用 agent.agentPrompt 作为 system 消息
      const messages: Array<{ role: 'system' | 'user'; content: string }> = []
      if (agent.agentPrompt) {
        messages.push({ role: 'system', content: agent.agentPrompt })
      }
      messages.push({ role: 'user', content: input })

      try {
        const resp = await fetch(`${config.AI_SERVICE_URL}/api/llm/complete`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            messages,
            model: agent.agentModel ?? undefined,
          }),
        })

        if (!resp.ok) {
          return reply.status(503).send(error(503, `AI service unavailable (${resp.status})`))
        }

        const data = (await resp.json()) as {
          content?: string
          usage?: { total_tokens?: number }
          error?: boolean
          error_message?: string
        }

        if (data.error) {
          return reply.status(502).send(error(502, data.error_message ?? 'AI service error'))
        }

        const result: V1AgentCallResponse = {
          agentId: agent.agentId,
          sessionId: sessionId ?? randomUUID(),
          output: data.content ?? '',
          usage: { totalTokens: data.usage?.total_tokens ?? 0 },
        }
        return reply.send(result)
      } catch (e) {
        return reply.status(503).send(error(503, (e as Error).message || 'AI service unavailable'))
      }
    },
  )

  // ===== 4. POST /chat/completions — Chat 补全(OpenAI 兼容) =====
  server.post(
    '/chat/completions',
    {
      schema: {
        description: 'Chat 补全(OpenAI 兼容,支持 stream)',
        tags: ['Chat'],
        body: {
          type: 'object',
          properties: {
            model: { type: 'string' },
            messages: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  role: { type: 'string', enum: ['system', 'user', 'assistant'] },
                  content: { type: 'string' },
                },
                required: ['role', 'content'],
              },
            },
            stream: { type: 'boolean' },
            temperature: { type: 'number' },
            maxTokens: { type: 'number' },
          },
          required: ['model', 'messages'],
        },
        response: {
          200: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              object: { type: 'string' },
              created: { type: 'number' },
              model: { type: 'string' },
              choices: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    index: { type: 'number' },
                    message: {
                      type: 'object',
                      properties: {
                        role: { type: 'string' },
                        content: { type: 'string' },
                      },
                    },
                    finish_reason: { type: 'string' },
                  },
                },
              },
              // P0-5m(2026-07-30):必须声明 usage 子字段 properties,
              // 否则 fast-json-stringify 会过滤掉所有子字段,返回 usage: {}
              usage: {
                type: 'object',
                properties: {
                  prompt_tokens: { type: 'number' },
                  completion_tokens: { type: 'number' },
                  total_tokens: { type: 'number' },
                },
              },
            },
          },
          400: errorResponseSchema,
          401: errorResponseSchema,
          402: errorResponseSchema,
          502: errorResponseSchema,
          503: errorResponseSchema,
        },
      },
      preHandler: [requireApiKeyAuth, requireApiKeyPermission('chat:write'), requireApiKeyQuota()],
    },
    async (request, reply) => {
      const parsed = chatCompletionSchema.safeParse(request.body)
      if (!parsed.success) {
        return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
      }
      const { model, messages, stream, temperature, maxTokens } = parsed.data

      // P0-5 中转站计费:调用前检查 API Key 余额
      const apiKey = (request as FastifyRequest & { apiKey?: ApiKeyContext }).apiKey
      const startTime = Date.now()
      const promptText = messages.map((m) => `${m.role}: ${m.content}`).join('\n')
      if (apiKey) {
        const estimatedTokens = messages.reduce(
          (sum, m) => sum + Math.ceil(m.content.length / 4),
          0,
        )
        const quotaCheck = await checkQuota(apiKey.id, estimatedTokens)
        if (!quotaCheck.allowed) {
          const reasonMap: Record<string, string> = {
            no_balance_token: 'Token 余额不足,请充值或联系管理员',
            no_balance_cost: '成本余额不足,请充值或联系管理员',
            key_not_found: 'API Key 不存在',
            key_revoked: 'API Key 已被吊销',
          }
          const statusCode = quotaCheck.reason === 'key_not_found' ? 401 : 402
          return reply
            .status(statusCode)
            .send(error(statusCode, reasonMap[quotaCheck.reason ?? ''] ?? '额度不足'))
        }
      }

      // BYOK 平台模式(2026-07-30):若用户对该 model 有私有 ai_model_config,走 BYOK 计费分支
      // mode='byok' 时 recordCall 只扣 platformFeeCents(上游原价 × 抽成率),不扣大厂成本
      let mode: 'relay' | 'byok' = 'relay'
      if (apiKey?.userId) {
        try {
          if (await isByokCall(apiKey.userId, model)) mode = 'byok'
        } catch {
          // isByokCall 失败默认走 relay,不影响主链路
        }
      }

      if (stream) {
        return streamChatCompletion(request, reply, {
          model,
          messages,
          temperature,
          maxTokens,
          apiKeyId: apiKey?.id,
          userId: apiKey?.userId,
          promptText,
          startTime,
          mode,
        })
      }

      // 非流式:转发到 ai-service /api/llm/complete
      try {
        const body: Record<string, unknown> = { messages, model }
        if (temperature !== undefined) body.temperature = temperature
        if (maxTokens !== undefined) body.max_tokens = maxTokens
        // P0-5 BYOK(2026-07-30):非流式也透传 metadata.userId + byokMode,
        // 让 ai-service 能识别 BYOK 调用并走用户自有 key 路径(与流式 streamChatCompletion 对齐)。
        if (apiKey?.userId) {
          body.metadata = { userId: apiKey.userId, ...(mode === 'byok' ? { byokMode: true } : {}) }
        }

        const resp = await fetch(`${config.AI_SERVICE_URL}/api/llm/complete`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        })

        if (!resp.ok) {
          if (apiKey) {
            void recordCall({
              apiKeyId: apiKey.id,
              userId: apiKey.userId,
              model,
              prompt: promptText,
              response: null,
              promptTokens: 0,
              completionTokens: 0,
              totalTokens: 0,
              latencyMs: Date.now() - startTime,
              status: 'error',
              errorMessage: `AI service unavailable (${resp.status})`,
              mode,
            }).catch(() => {})
          }
          return reply.status(503).send(error(503, `AI service unavailable (${resp.status})`))
        }

        const data = (await resp.json()) as {
          content?: string
          model?: string
          usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number }
          error?: boolean
          error_message?: string
        }

        if (data.error) {
          if (apiKey) {
            void recordCall({
              apiKeyId: apiKey.id,
              userId: apiKey.userId,
              model,
              prompt: promptText,
              response: null,
              promptTokens: 0,
              completionTokens: 0,
              totalTokens: 0,
              latencyMs: Date.now() - startTime,
              status: 'error',
              errorMessage: data.error_message ?? 'AI service error',
              mode,
            }).catch(() => {})
          }
          return reply.status(502).send(error(502, data.error_message ?? 'AI service error'))
        }

        const promptTokens = data.usage?.prompt_tokens ?? 0
        const completionTokens = data.usage?.completion_tokens ?? 0
        const totalTokens = data.usage?.total_tokens ?? 0
        // P0-5 防御:ai-service 偶发把 usage 序列化为 '***' 字符串(LLMMetrics 中间件脱敏),
        // 此时按字符数估算(1 token ≈ 4 字符,中英文混合),避免 recordCall 写库失败。
        const safeInt = (v: unknown, fallbackChars: number): number => {
          if (typeof v === 'number' && Number.isFinite(v) && v >= 0) return Math.floor(v)
          if (typeof v === 'string') {
            const n = Number(v)
            if (Number.isFinite(n) && n >= 0) return Math.floor(n)
            return Math.max(1, Math.ceil(fallbackChars / 4))
          }
          return Math.max(1, Math.ceil(fallbackChars / 4))
        }
        const safePrompt = safeInt(promptTokens, promptText.length)
        const safeCompletion = safeInt(completionTokens, (data.content ?? '').length)
        const safeTotal = safeInt(totalTokens, promptText.length + (data.content ?? '').length)

        const result: V1ChatCompletionResponse = {
          id: `chatcmpl-${randomUUID()}`,
          object: 'chat.completion',
          created: Math.floor(Date.now() / 1000),
          model: data.model ?? model,
          choices: [
            {
              index: 0,
              message: { role: 'assistant', content: data.content ?? '' },
              finish_reason: 'stop',
            },
          ],
          usage: {
            prompt_tokens: safePrompt,
            completion_tokens: safeCompletion,
            total_tokens: safeTotal,
          },
        }

        // P0-5 中转站计费:调用成功,记录流水 + 扣减余额
        if (apiKey) {
          recordCall({
            apiKeyId: apiKey.id,
            userId: apiKey.userId,
            model,
            prompt: promptText,
            response: data.content ?? '',
            promptTokens: safePrompt,
            completionTokens: safeCompletion,
            totalTokens: safeTotal,
            latencyMs: Date.now() - startTime,
            status: 'success',
            mode,
          }).catch((e) => {
            console.error('[v1/chat] recordCall FAIL', e?.message || e)
          })
        }

        return reply.send(result)
      } catch (e) {
        if (apiKey) {
          void recordCall({
            apiKeyId: apiKey.id,
            userId: apiKey.userId,
            model,
            prompt: promptText,
            response: null,
            promptTokens: 0,
            completionTokens: 0,
            totalTokens: 0,
            latencyMs: Date.now() - startTime,
            status: 'error',
            errorMessage: (e as Error).message || 'AI service unavailable',
            mode,
          }).catch(() => {})
        }
        return reply.status(503).send(error(503, (e as Error).message || 'AI service unavailable'))
      }
    },
  )

  // ===== 5. GET /models — 模型列表(5min 缓存 + X-Model-Source 标识来源) =====
  server.get(
    '/models',
    {
      schema: {
        description: '模型列表(5min 缓存,X-Model-Source 标识来源)',
        tags: ['Models'],
        response: {
          200: {
            type: 'object',
            properties: {
              object: { type: 'string' },
              data: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    id: { type: 'string' },
                    object: { type: 'string' },
                    created: { type: 'number' },
                    owned_by: { type: 'string' },
                  },
                },
              },
            },
          },
          401: errorResponseSchema,
        },
      },
      preHandler: [requireApiKeyAuth, requireApiKeyPermission('models:read'), requireApiKeyQuota()],
    },
    async (request, reply) => {
      // BYOK 平台模式(2026-07-30):鉴权用户额外返回其私有 BYOK 模型
      const apiKey = (request as FastifyRequest & { apiKey?: ApiKeyContext }).apiKey
      const { body, source } = await fetchModels(apiKey?.userId)
      reply.header('X-Model-Source', source)
      return reply.send(body)
    },
  )

  // ===== 6. GET /files — 文件列表 =====
  server.get(
    '/files',
    {
      schema: {
        description: '文件列表(当前 API Key 用户上传的文件)',
        tags: ['Files'],
        response: {
          200: {
            type: 'object',
            properties: {
              object: { type: 'string' },
              data: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    id: { type: 'string' },
                    object: { type: 'string' },
                    filename: { type: 'string' },
                    bytes: { type: 'number' },
                    createdAt: { type: 'string' },
                  },
                },
              },
            },
          },
          401: errorResponseSchema,
        },
      },
      preHandler: [requireApiKeyAuth, requireApiKeyPermission('files:read'), requireApiKeyQuota()],
    },
    async (request, reply) => {
      const apiKey = (request as FastifyRequest & { apiKey?: ApiKeyContext }).apiKey
      if (!apiKey) {
        return reply.status(401).send(error(401, 'API key authentication required'))
      }
      const userId = apiKey.userId
      // 查询当前用户上传的文件(未删除)
      const rows = await dbRead
        .select()
        .from(files)
        .where(and(eq(files.uploadedBy, userId), isNull(files.deletedAt)))

      const data = rows.map((f) => ({
        id: f.id,
        object: 'file' as const,
        filename: f.name,
        bytes: f.size,
        createdAt: f.createdAt.toISOString(),
      }))
      return reply.send({ object: 'list', data })
    },
  )

  // ===== 7. POST /files — 上传文件(落盘 + files 表持久化) =====
  server.post(
    '/files',
    {
      schema: {
        description: '上传文件(multipart/form-data,落盘 + files 表持久化)',
        tags: ['Files'],
        consumes: ['multipart/form-data'],
        response: {
          201: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              object: { type: 'string' },
              filename: { type: 'string' },
              bytes: { type: 'number' },
              createdAt: { type: 'string' },
              persisted: { type: 'boolean' },
            },
          },
          400: errorResponseSchema,
          401: errorResponseSchema,
          500: errorResponseSchema,
        },
      },
      preHandler: [requireApiKeyAuth, requireApiKeyPermission('files:write'), requireApiKeyQuota()],
    },
    async (request, reply) => {
      const apiKey = (request as FastifyRequest & { apiKey?: ApiKeyContext }).apiKey
      if (!apiKey) {
        return reply.status(401).send(error(401, 'API key authentication required'))
      }
      const userId = apiKey.userId

      if (!request.isMultipart()) {
        return reply.status(400).send(error(400, 'Request must be multipart/form-data'))
      }

      const data = await request.file()
      if (!data) {
        return reply.status(400).send(error(400, 'No file uploaded'))
      }

      const buffer = await data.toBuffer()
      if (buffer.length === 0) {
        return reply.status(400).send(error(400, 'File is empty'))
      }

      const filename = data.filename || `upload-${Date.now()}`
      const UPLOAD_DIR = process.env.UPLOAD_DIR ?? join(process.cwd(), 'uploads')

      try {
        if (!existsSync(UPLOAD_DIR)) mkdirSync(UPLOAD_DIR, { recursive: true })
        const fileId = randomUUID()
        const filePath = join(UPLOAD_DIR, fileId)
        writeFileSync(filePath, buffer)

        // files 表 projectId 必填(notNull):取该用户的第一个项目作为默认归属,
        // 若用户无任何项目则自动创建名为 "API Uploads" 的默认项目(隔离公开 API 上传)。
        const [existingProject] = await dbRead
          .select({ id: projects.id })
          .from(projects)
          .where(eq(projects.userId, userId))
          .orderBy(projects.createdAt)
          .limit(1)

        let projectId = existingProject?.id
        if (!projectId) {
          const [created] = await db
            .insert(projects)
            .values({
              userId,
              name: 'API Uploads',
              description: 'Default project for /v1/files uploads',
            })
            .returning({ id: projects.id })
          projectId = created?.id
        }

        let persisted = false
        if (projectId) {
          await db.insert(files).values({
            id: fileId,
            projectId,
            name: filename,
            path: filePath,
            size: buffer.length,
            mimeType: data.mimetype || 'application/octet-stream',
            uploadedBy: userId,
          })
          persisted = true
        }

        return reply.status(201).send({
          id: fileId,
          object: 'file',
          filename,
          bytes: buffer.length,
          createdAt: new Date().toISOString(),
          persisted,
        })
      } catch {
        return reply.status(500).send(error(500, 'File save failed'))
      }
    },
  )

  // ===== 8. GET /chat/sessions — 列出当前 API Key 用户的会话(chat:read) =====
  server.get(
    '/chat/sessions',
    {
      schema: {
        description: '列出当前 API Key 用户的会话',
        tags: ['Chat'],
        querystring: {
          type: 'object',
          properties: {
            page: { type: 'number' },
            pageSize: { type: 'number' },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              code: { type: 'number' },
              message: { type: 'string' },
              data: {
                type: 'object',
                properties: {
                  list: { type: 'array' },
                  total: { type: 'number' },
                  page: { type: 'number' },
                  pageSize: { type: 'number' },
                },
              },
            },
          },
          401: errorResponseSchema,
          500: errorResponseSchema,
        },
      },
      preHandler: [requireApiKeyAuth, requireApiKeyPermission('chat:read'), requireApiKeyQuota()],
    },
    async (request, reply) => {
      const apiKey = (request as FastifyRequest & { apiKey?: ApiKeyContext }).apiKey
      if (!apiKey) {
        return reply.status(401).send(error(401, 'API key authentication required'))
      }
      const query = request.query as { page?: string; pageSize?: string }
      const page = Math.max(1, Number(query.page ?? '1') || 1)
      const pageSize = Math.min(100, Math.max(1, Number(query.pageSize ?? '20') || 20))
      const offset = (page - 1) * pageSize

      try {
        // chat_conversations 表无 api_key_id 字段,按 apiKey.userId 过滤(同用户所有会话)
        const [rows, countRow] = await Promise.all([
          dbRead
            .select()
            .from(chatConversations)
            .where(eq(chatConversations.userId, apiKey.userId))
            .orderBy(desc(chatConversations.updatedAt))
            .limit(pageSize)
            .offset(offset),
          dbRead
            .select({ total: sql<number>`count(*)::int` })
            .from(chatConversations)
            .where(eq(chatConversations.userId, apiKey.userId)),
        ])
        const total = countRow[0]?.total ?? 0
        const list = rows.map((r) => ({
          id: r.id,
          title: r.title,
          model: r.model,
          lastMessageAt: r.lastMessageAt?.toISOString() ?? null,
          createdAt: r.createdAt.toISOString(),
          updatedAt: r.updatedAt.toISOString(),
        }))
        return reply.send({
          code: 0,
          message: 'success',
          data: { list, total, page, pageSize },
        })
      } catch (e) {
        return reply
          .status(500)
          .send(error(500, (e as Error).message || 'Failed to fetch chat sessions'))
      }
    },
  )
}

export default v1PublicRoutes
