/**
 * /v1/* 对外开放 API — AI 核心类路由(2026-07-22 立)。
 *
 * 所有端点统一 requireApiKeyAuth + requireApiKeyPermission + requireApiKeyQuota 三重 preHandler。
 * 响应格式 OpenAI 兼容(不套 { code, message, data } 壳)。
 * 鉴权由 plugins/api-key-auth.ts 提供,契约类型由 @ihui/types 提供。
 *
 * 端点清单(20 个):
 * 1.  POST   /v1/embeddings                 — Embedding 向量生成(权限: embeddings:write)
 * 2.  POST   /v1/chat/vision                — 视觉理解(权限: chat:write)
 * 3.  POST   /v1/chat/moa                   — Mixture of Agents(权限: chat:write)
 * 4.  GET    /v1/moa-presets                — MoA 预设列表(权限: models:read)
 * 5.  POST   /v1/moa-presets                — 创建 MoA 预设(权限: models:write)
 * 6.  GET    /v1/models/:id                 — 模型详情(权限: models:read)
 * 7.  GET    /v1/vendors/:vendor/models     — 厂商模型列表(权限: models:read)
 * 8.  GET    /v1/user/models                — 用户模型列表(权限: models:read)
 * 9.  POST   /v1/user/models                — 创建用户模型(权限: models:write)
 * 10. PUT    /v1/user/models/:id            — 更新用户模型(权限: models:write)
 * 11. DELETE /v1/user/models/:id            — 删除用户模型(权限: models:write)
 * 12. POST   /v1/agents/execute             — Agent 高级执行(权限: agents:call)
 * 13. POST   /v1/agents/execute/stream     — Agent 流式执行(权限: agents:call)
 * 14. GET    /v1/agents/tasks/:id/status   — 任务状态(权限: agents:read)
 * 15. POST   /v1/agents/tasks/:id/cancel   — 取消任务(权限: agents:call)
 * 16. GET    /v1/agents/sessions           — 会话列表(权限: agents:read)
 * 17. DELETE /v1/agents/sessions/:id       — 删除会话(权限: agents:read)
 * 18. POST   /v1/agents/pipeline           — Pipeline 编排(权限: agents:call)
 * 19. POST   /v1/agents/parallel           — 并行执行(权限: agents:call)
 * 20. POST   /v1/agents/decompose          — 任务分解(权限: agents:call)
 */
import type { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify'
import { eq } from 'drizzle-orm'
import { z } from 'zod'
import { config } from '../config/index.js'
import { db, dbRead } from '../db/index.js'
import { zhsAiUserModelChatConfig } from '@ihui/database'
import type {
  V1EmbeddingsResponse,
  V1ChatVisionRequest,
  V1ChatVisionResponse,
  V1ChatMoaRequest,
  V1ChatMoaResponse,
  V1MoaPresetsResponse,
  V1CreateMoaPresetRequest,
  V1ModelInfo,
  V1VendorModelsResponse,
  V1UserModelConfig,
  V1UserModelsResponse,
  V1CreateUserModelRequest,
  V1AgentExecuteRequest,
  V1AgentExecuteResponse,
  V1AgentSessionsResponse,
  V1AgentPipelineRequest,
  V1AgentPipelineResponse,
  V1AgentParallelRequest,
  V1AgentParallelResponse,
} from '@ihui/types'
import {
  requireApiKeyAuth,
  requireApiKeyPermission,
  requireApiKeyQuota,
} from '../plugins/api-key-auth.js'
import { error } from '../utils/response.js'

// =============================================================================
// Zod schemas
// =============================================================================

const embeddingsSchema = z.object({
  model: z.string().min(1),
  input: z.union([z.string(), z.array(z.string()).max(100)]),
  dimensions: z.number().int().positive().optional(),
})

const chatVisionSchema = z.object({
  model: z.string().min(1),
  image: z.string().min(1),
  prompt: z.string().min(1),
  maxTokens: z.number().int().positive().optional(),
})

const chatMoaSchema = z.object({
  messages: z
    .array(
      z.object({
        role: z.enum(['system', 'user', 'assistant']),
        content: z.string(),
      }),
    )
    .min(1),
  presetId: z.string().optional(),
  stream: z.boolean().optional().default(false),
})

const createMoaPresetSchema = z.object({
  name: z.string().min(1),
  models: z.array(z.string()).min(1).max(100),
  strategy: z.string().min(1),
})

const createUserModelSchema = z.object({
  name: z.string().min(1).max(64),
  provider: z.string().min(1).max(64),
  model: z.string().min(1).max(128),
  apiKey: z.string().min(1).max(256),
  baseUrl: z.string().url().optional(),
})

const updateUserModelSchema = z.object({
  name: z.string().min(1).max(64).optional(),
  provider: z.string().min(1).max(64).optional(),
  model: z.string().min(1).max(128).optional(),
  apiKey: z.string().min(1).max(256).optional(),
  baseUrl: z.string().url().optional(),
})

const agentExecuteSchema = z.object({
  agentId: z.string().min(1),
  input: z.string().min(1),
  sessionId: z.string().optional(),
  permissionMode: z.string().optional(),
  maxIterations: z.number().int().positive().optional(),
})

const agentPipelineSchema = z.object({
  steps: z
    .array(
      z.object({
        agentId: z.string().min(1),
        input: z.string().min(1),
        dependsOn: z.array(z.number().int()).max(100).optional(),
      }),
    )
    .min(1)
    .max(100),
})

const agentParallelSchema = z.object({
  tasks: z
    .array(
      z.object({
        agentId: z.string().min(1),
        input: z.string().min(1),
      }),
    )
    .min(1)
    .max(100),
})

// =============================================================================
// Fastify OpenAPI schemas(共享)
// =============================================================================

const errorResponseSchema = {
  type: 'object',
  properties: { code: { type: 'number' }, message: { type: 'string' } },
}

// =============================================================================
// 辅助函数
// =============================================================================

/** 鉴权后注入 request 的 API Key 上下文(与 AuthenticatedApiKey 结构一致)。 */
interface ApiKeyContext {
  id: string
  userId: string
  key: string
  permissions: string[]
  rateLimit: number
}

/** 从 apiKey 上下文取 userId,失败 reply 401。 */
function getUserId(request: FastifyRequest, reply: FastifyReply): string | null {
  const apiKey = (request as FastifyRequest & { apiKey?: ApiKeyContext }).apiKey
  if (!apiKey) {
    reply.status(401).send(error(401, 'API key authentication required'))
    return null
  }
  return apiKey.userId
}

/** 屏蔽 API Key 中间部分,只保留首 4 + 末 4 字符。 */
function maskKey(key: string): string {
  if (key.length <= 8) return '****'
  return `${key.slice(0, 4)}****${key.slice(-4)}`
}

/**
 * 通用 ai-service 转发(JSON 请求 + JSON 响应)。
 * 失败返回 503 + 错误信息,成功返回 ai-service 原始 JSON。
 */
async function forwardAiService(
  reply: FastifyReply,
  path: string,
  init: RequestInit,
): Promise<void> {
  try {
    const resp = await fetch(`${config.AI_SERVICE_URL}${path}`, init)
    if (!resp.ok) {
      const txt = await resp.text().catch(() => '')
      return reply
        .status(503)
        .send(error(503, `AI service unavailable (${resp.status}): ${txt.slice(0, 200)}`))
    }
    const data = await resp.json()
    return reply.send(data)
  } catch (e) {
    return reply.status(503).send(error(503, (e as Error).message || 'AI service unavailable'))
  }
}

/** 构造 JSON 请求 init。 */
function jsonInit(body: unknown, method: 'POST' | 'PUT' = 'POST'): RequestInit {
  return {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }
}

/**
 * 从 ai-service /api/llm/models 提取模型列表(兼容多种格式)。
 * 失败返回 null,由调用方决定降级策略。
 */
async function fetchAiServiceModels(): Promise<
  Array<{ id: string; ownedBy?: string; created?: number }>
> {
  const resp = await fetch(`${config.AI_SERVICE_URL}/api/llm/models`, { method: 'GET' })
  if (!resp.ok) return []
  const data = (await resp.json()) as unknown
  let models: unknown[] = []
  if (Array.isArray(data)) {
    models = data
  } else if (data && typeof data === 'object') {
    const obj = data as Record<string, unknown>
    if (Array.isArray(obj.data)) models = obj.data
    else if (Array.isArray(obj.models)) models = obj.models
  }
  return models.map((m) => {
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
      undefined
    const created = typeof mo.created === 'number' ? mo.created : undefined
    return { id, ownedBy, created }
  })
}

/**
 * 根据模型名推导能力标签(用于 GET /v1/models/:id capabilities)。
 * 规则:基于模型名前缀匹配主流厂商命名约定。
 */
function deriveModelCapabilities(modelName: string): string[] {
  const name = modelName.toLowerCase()
  const caps: string[] = ['chat']
  if (/^gpt-(4|5|o)/.test(name) || name.includes('gpt-4o') || name.includes('gpt-4-turbo')) {
    caps.push('vision', 'tools')
  } else if (/^gpt-3/.test(name)) {
    caps.push('tools')
  }
  if (/^claude-3/.test(name) || /^claude-4/.test(name)) {
    caps.push('vision', 'tools')
  }
  if (/^o[134]-/.test(name) || name.startsWith('o1') || name.startsWith('o3') || name.startsWith('o4')) {
    caps.push('reasoning', 'tools')
  }
  if (name.startsWith('gemini-')) {
    caps.push('vision', 'tools')
  }
  if (name.includes('vl') || name.includes('vision')) {
    caps.push('vision')
  }
  return Array.from(new Set(caps))
}

/** 主流模型上下文窗口大小静态映射(未知模型返回 undefined)。 */
const CONTEXT_WINDOW_MAP: Record<string, number> = {
  'gpt-4o': 128000,
  'gpt-4o-mini': 128000,
  'gpt-4-turbo': 128000,
  'gpt-4': 8192,
  'gpt-3.5-turbo': 16385,
  'gpt-5': 256000,
  'claude-3-5-sonnet': 200000,
  'claude-3-5-haiku': 200000,
  'claude-3-opus': 200000,
  'claude-3-sonnet': 200000,
  'claude-3-haiku': 200000,
  'claude-4-opus': 200000,
  'o1': 200000,
  'o1-mini': 128000,
  'o1-preview': 128000,
  'o3': 200000,
  'o3-mini': 200000,
  'o4-mini': 200000,
  'gemini-1.5-pro': 2000000,
  'gemini-1.5-flash': 1000000,
  'gemini-2.0-flash': 1000000,
  'gemini-2.5-pro': 2000000,
  'glm-4': 128000,
  'glm-4-flash': 128000,
  'glm-4-plus': 128000,
  'glm-4v': 8192,
  'deepseek-chat': 64000,
  'deepseek-coder': 64000,
  'deepseek-reasoner': 64000,
  'qwen-plus': 131072,
  'qwen-max': 32768,
  'qwen-turbo': 8192,
  'moonshot-v1-8k': 8192,
  'moonshot-v1-32k': 32768,
  'moonshot-v1-128k': 131072,
}

/** 查模型上下文窗口大小(模糊匹配,unknown → undefined)。 */
function lookupContextWindow(modelName: string): number | undefined {
  const name = modelName.toLowerCase()
  if (CONTEXT_WINDOW_MAP[name] !== undefined) return CONTEXT_WINDOW_MAP[name]
  for (const key of Object.keys(CONTEXT_WINDOW_MAP)) {
    if (name.startsWith(key) || name.includes(key)) {
      return CONTEXT_WINDOW_MAP[key]!
    }
  }
  return undefined
}

// =============================================================================
// 路由插件
// =============================================================================

const v1AiCoreRoutes: FastifyPluginAsync = async (server) => {
  // ===== 1. POST /embeddings — Embedding 向量生成 =====
  server.post(
    '/embeddings',
    {
      schema: {
        description: 'Embedding 向量生成',
        tags: ['AI Core'],
        body: {
          type: 'object',
          properties: {
            model: { type: 'string' },
            input: { type: ['string', 'array'] },
            dimensions: { type: 'number' },
          },
          required: ['model', 'input'],
        },
        response: {
          200: {
            type: 'object',
            properties: {
              object: { type: 'string' },
              data: { type: 'array' },
              model: { type: 'string' },
              usage: { type: 'object' },
            },
          },
          400: errorResponseSchema,
          401: errorResponseSchema,
          503: errorResponseSchema,
        },
      },
      preHandler: [
        requireApiKeyAuth,
        requireApiKeyPermission('embeddings:write'),
        requireApiKeyQuota(),
      ],
    },
    async (request, reply) => {
      const parsed = embeddingsSchema.safeParse(request.body)
      if (!parsed.success) {
        return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
      }
      const { model, input, dimensions } = parsed.data

      // 转发到 ai-service /api/llm/embeddings(2026-07-22 立已补建 HTTP 端点)
      try {
        const body: Record<string, unknown> = { model, input }
        if (dimensions !== undefined) body.dimensions = dimensions
        const resp = await fetch(`${config.AI_SERVICE_URL}/api/llm/embeddings`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        })
        if (!resp.ok) {
          const txt = await resp.text().catch(() => '')
          return reply
            .status(503)
            .send(
              error(503, `Embedding service unavailable (${resp.status}): ${txt.slice(0, 200)}`),
            )
        }
        const data = (await resp.json()) as {
          data?: Array<{ embedding?: number[] }>
          embedding?: number[]
          model?: string
          usage?: { prompt_tokens?: number; total_tokens?: number }
        }
        // 适配 LiteLLM / OpenAI 兼容格式
        const embeds =
          Array.isArray(data.data) && data.data.length > 0
            ? data.data.map((d, i) => ({
                object: 'embedding' as const,
                index: i,
                embedding: d.embedding ?? [],
              }))
            : data.embedding
              ? [{ object: 'embedding' as const, index: 0, embedding: data.embedding }]
              : []
        const result: V1EmbeddingsResponse = {
          object: 'list',
          data: embeds,
          model: data.model ?? model,
          usage: {
            promptTokens: data.usage?.prompt_tokens ?? 0,
            totalTokens: data.usage?.total_tokens ?? 0,
          },
        }
        return reply.send(result)
      } catch (e) {
        return reply
          .status(503)
          .send(error(503, (e as Error).message || 'Embedding service unavailable'))
      }
    },
  )

  // ===== 2. POST /chat/vision — 视觉理解 =====
  server.post(
    '/chat/vision',
    {
      schema: {
        description: '视觉理解',
        tags: ['AI Core'],
        body: {
          type: 'object',
          properties: {
            model: { type: 'string' },
            image: { type: 'string' },
            prompt: { type: 'string' },
            maxTokens: { type: 'number' },
          },
          required: ['model', 'image', 'prompt'],
        },
        response: {
          200: {
            type: 'object',
            properties: {
              description: { type: 'string' },
              model: { type: 'string' },
              usage: { type: 'object' },
            },
          },
          400: errorResponseSchema,
          401: errorResponseSchema,
          502: errorResponseSchema,
          503: errorResponseSchema,
        },
      },
      preHandler: [
        requireApiKeyAuth,
        requireApiKeyPermission('chat:write'),
        requireApiKeyQuota(),
      ],
    },
    async (request, reply) => {
      const parsed = chatVisionSchema.safeParse(request.body)
      if (!parsed.success) {
        return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
      }
      const { model, image, prompt, maxTokens } = parsed.data as V1ChatVisionRequest

      // 转发到 ai-service /api/llm/vision(snake_case)
      const body: Record<string, unknown> = { model, image, prompt }
      if (maxTokens !== undefined) body.max_tokens = maxTokens
      try {
        const resp = await fetch(`${config.AI_SERVICE_URL}/api/llm/vision`, jsonInit(body))
        if (!resp.ok) {
          const txt = await resp.text().catch(() => '')
          return reply
            .status(503)
            .send(error(503, `AI service unavailable (${resp.status}): ${txt.slice(0, 200)}`))
        }
        const data = (await resp.json()) as {
          description?: string
          content?: string
          model?: string
          usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number }
          error?: boolean
          error_message?: string
        }
        if (data.error) {
          return reply.status(502).send(error(502, data.error_message ?? 'AI service error'))
        }
        const result: V1ChatVisionResponse = {
          description: data.description ?? data.content ?? '',
          model: data.model ?? model,
          usage: {
            promptTokens: data.usage?.prompt_tokens ?? 0,
            completionTokens: data.usage?.completion_tokens ?? 0,
            totalTokens: data.usage?.total_tokens ?? 0,
          },
        }
        return reply.send(result)
      } catch (e) {
        return reply.status(503).send(error(503, (e as Error).message || 'AI service unavailable'))
      }
    },
  )

  // ===== 3. POST /chat/moa — Mixture of Agents =====
  server.post(
    '/chat/moa',
    {
      schema: {
        description: 'Mixture of Agents 多智能体混合补全',
        tags: ['AI Core'],
        body: {
          type: 'object',
          properties: {
            messages: { type: 'array' },
            presetId: { type: 'string' },
            stream: { type: 'boolean' },
          },
          required: ['messages'],
        },
        response: {
          200: {
            type: 'object',
            properties: {
              output: { type: 'string' },
              presetId: { type: 'string' },
              model: { type: 'string' },
              usage: { type: 'object' },
            },
          },
          400: errorResponseSchema,
          401: errorResponseSchema,
          502: errorResponseSchema,
          503: errorResponseSchema,
        },
      },
      preHandler: [
        requireApiKeyAuth,
        requireApiKeyPermission('chat:write'),
        requireApiKeyQuota(),
      ],
    },
    async (request, reply) => {
      const parsed = chatMoaSchema.safeParse(request.body)
      if (!parsed.success) {
        return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
      }
      const { messages, presetId, stream } = parsed.data as V1ChatMoaRequest

      if (stream) {
        // ai-service /api/llm/moa-complete 暂不支持 stream(2026-07-22):
        // 显式拒绝并返回 400 + stream_supported=false,避免默默降级为非流式误导客户端。
        // 建议客户端改用 POST /v1/chat/completions(stream=true)获取流式响应。
        return reply.status(400).send(
          error(
            400,
            'stream=true is not supported by /v1/chat/moa (stream_supported=false). Use stream=false, or fall back to POST /v1/chat/completions with stream=true.',
          ),
        )
      }

      // 转发到 ai-service /api/llm/moa-complete(snake_case preset_name)
      const body: Record<string, unknown> = { messages }
      if (presetId) body.preset_name = presetId
      try {
        const resp = await fetch(`${config.AI_SERVICE_URL}/api/llm/moa-complete`, jsonInit(body))
        if (!resp.ok) {
          const txt = await resp.text().catch(() => '')
          return reply
            .status(503)
            .send(error(503, `AI service unavailable (${resp.status}): ${txt.slice(0, 200)}`))
        }
        const data = (await resp.json()) as {
          output?: string
          content?: string
          preset_id?: string
          preset_name?: string
          model?: string
          usage?: { total_tokens?: number }
          error?: boolean
          error_message?: string
        }
        if (data.error) {
          return reply.status(502).send(error(502, data.error_message ?? 'AI service error'))
        }
        const result: V1ChatMoaResponse = {
          output: data.output ?? data.content ?? '',
          presetId: data.preset_id ?? data.preset_name ?? presetId ?? '',
          model: data.model ?? '',
          usage: { totalTokens: data.usage?.total_tokens ?? 0 },
        }
        return reply.send(result)
      } catch (e) {
        return reply.status(503).send(error(503, (e as Error).message || 'AI service unavailable'))
      }
    },
  )

  // ===== 4. GET /moa-presets — MoA 预设列表 =====
  server.get(
    '/moa-presets',
    {
      schema: {
        description: 'MoA 预设列表',
        tags: ['AI Core'],
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
                    models: { type: 'array', items: { type: 'string' } },
                    strategy: { type: 'string' },
                  },
                },
              },
            },
          },
          401: errorResponseSchema,
          503: errorResponseSchema,
        },
      },
      preHandler: [
        requireApiKeyAuth,
        requireApiKeyPermission('models:read'),
        requireApiKeyQuota(),
      ],
    },
    async (_request, reply) => {
      try {
        const resp = await fetch(`${config.AI_SERVICE_URL}/api/llm/moa-presets`, { method: 'GET' })
        if (!resp.ok) {
          const txt = await resp.text().catch(() => '')
          return reply
            .status(503)
            .send(error(503, `AI service unavailable (${resp.status}): ${txt.slice(0, 200)}`))
        }
        const data = (await resp.json()) as {
          data?: unknown
          presets?: unknown
        }
        // 适配 { data: [...] } / { presets: [...] } / 裸数组
        let presets: unknown[] = []
        if (Array.isArray(data.data)) presets = data.data
        else if (Array.isArray(data.presets)) presets = data.presets
        else if (Array.isArray(data)) presets = data

        const mapped = presets.map((p) => {
          const po = (p ?? {}) as Record<string, unknown>
          return {
            id: (typeof po.id === 'string' && po.id) || (typeof po.name === 'string' && po.name) || '',
            name: (typeof po.name === 'string' && po.name) || '',
            models: Array.isArray(po.models) ? (po.models as string[]) : [],
            strategy: (typeof po.strategy === 'string' && po.strategy) || 'moa',
          }
        })
        const result: V1MoaPresetsResponse = { object: 'list', data: mapped }
        return reply.send(result)
      } catch (e) {
        return reply.status(503).send(error(503, (e as Error).message || 'AI service unavailable'))
      }
    },
  )

  // ===== 5. POST /moa-presets — 创建 MoA 预设 =====
  server.post(
    '/moa-presets',
    {
      schema: {
        description: '创建 MoA 预设',
        tags: ['AI Core'],
        body: {
          type: 'object',
          properties: {
            name: { type: 'string' },
            models: { type: 'array', items: { type: 'string' } },
            strategy: { type: 'string' },
          },
          required: ['name', 'models', 'strategy'],
        },
        response: {
          200: { type: 'object' },
          400: errorResponseSchema,
          401: errorResponseSchema,
        },
      },
      preHandler: [
        requireApiKeyAuth,
        requireApiKeyPermission('models:write'),
        requireApiKeyQuota(),
      ],
    },
    async (request, reply) => {
      const parsed = createMoaPresetSchema.safeParse(request.body)
      if (!parsed.success) {
        return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
      }
      const { name, models, strategy } = parsed.data as V1CreateMoaPresetRequest
      // 转发到 ai-service /api/llm/moa-presets
      return forwardAiService(
        reply,
        '/api/llm/moa-presets',
        jsonInit({ name, models, strategy }),
      )
    },
  )

  // ===== 6. GET /models/:id — 模型详情 =====
  server.get(
    '/models/:id',
    {
      schema: {
        description: '模型详情',
        tags: ['AI Core'],
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
              object: { type: 'string' },
              created: { type: 'number' },
              ownedBy: { type: 'string' },
              capabilities: { type: 'array', items: { type: 'string' } },
              contextWindow: { type: 'number' },
              supportsStream: { type: 'boolean' },
            },
          },
          401: errorResponseSchema,
          404: errorResponseSchema,
          503: errorResponseSchema,
        },
      },
      preHandler: [
        requireApiKeyAuth,
        requireApiKeyPermission('models:read'),
        requireApiKeyQuota(),
      ],
    },
    async (request, reply) => {
      const { id } = request.params as { id: string }
      try {
        const models = await fetchAiServiceModels()
        const found = models.find((m) => m.id === id)
        if (!found) {
          return reply.status(404).send(error(404, `Model not found: ${id}`))
        }
        const info: V1ModelInfo = {
          id: found.id,
          object: 'model',
          created: found.created ?? Math.floor(Date.now() / 1000),
          ownedBy: found.ownedBy ?? 'ihui',
          // ai-service /api/llm/models 未返回 capabilities/contextWindow/supportsStream 字段
          // → 由 model name 静态推导(GPT-4* → vision+tools, Claude-3+ → vision+tools, o1-* → reasoning, etc.)
          capabilities: deriveModelCapabilities(found.id),
          contextWindow: lookupContextWindow(found.id),
          supportsStream: true,
        }
        return reply.send(info)
      } catch (e) {
        return reply.status(503).send(error(503, (e as Error).message || 'AI service unavailable'))
      }
    },
  )

  // ===== 7. GET /vendors/:vendor/models — 厂商模型列表 =====
  server.get(
    '/vendors/:vendor/models',
    {
      schema: {
        description: '厂商模型列表',
        tags: ['AI Core'],
        params: {
          type: 'object',
          properties: { vendor: { type: 'string' } },
          required: ['vendor'],
        },
        response: {
          200: {
            type: 'object',
            properties: {
              vendor: { type: 'string' },
              object: { type: 'string' },
              data: { type: 'array' },
            },
          },
          401: errorResponseSchema,
          503: errorResponseSchema,
        },
      },
      preHandler: [
        requireApiKeyAuth,
        requireApiKeyPermission('models:read'),
        requireApiKeyQuota(),
      ],
    },
    async (request, reply) => {
      const { vendor } = request.params as { vendor: string }
      try {
        const models = await fetchAiServiceModels()
        // 按 ownedBy / id 前缀过滤
        const filtered = models.filter(
          (m) =>
            (m.ownedBy && m.ownedBy.toLowerCase() === vendor.toLowerCase()) ||
            m.id.toLowerCase().startsWith(vendor.toLowerCase() + '/') ||
            m.id.toLowerCase().startsWith(vendor.toLowerCase() + '-'),
        )
        const result: V1VendorModelsResponse = {
          vendor,
          object: 'list',
          data: filtered.map((m) => ({ id: m.id, object: 'model' })),
        }
        return reply.send(result)
      } catch (e) {
        return reply.status(503).send(error(503, (e as Error).message || 'AI service unavailable'))
      }
    },
  )

  // ===== 8. GET /user/models — 用户自定义模型列表 =====
  server.get(
    '/user/models',
    {
      schema: {
        description: '用户自定义模型列表',
        tags: ['AI Core'],
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
                    provider: { type: 'string' },
                    model: { type: 'string' },
                    apiKey: { type: 'string' },
                    baseUrl: { type: 'string' },
                    createdAt: { type: 'string' },
                    updatedAt: { type: 'string' },
                  },
                },
              },
            },
          },
          401: errorResponseSchema,
        },
      },
      preHandler: [
        requireApiKeyAuth,
        requireApiKeyPermission('models:read'),
        requireApiKeyQuota(),
      ],
    },
    async (request, reply) => {
      const userId = getUserId(request, reply)
      if (!userId) return

      const rows = await dbRead
        .select()
        .from(zhsAiUserModelChatConfig)
        .where(eq(zhsAiUserModelChatConfig.userId, userId))

      const data: V1UserModelConfig[] = rows.map((r) => ({
        id: r.id,
        name: r.name,
        provider: r.vendor,
        model: r.modelId,
        apiKey: maskKey(r.apiKey),
        baseUrl: r.baseUrl ?? undefined,
        createdAt: r.createdAt.toISOString(),
        updatedAt: r.createdAt.toISOString(),
      }))
      const result: V1UserModelsResponse = { object: 'list', data }
      return reply.send(result)
    },
  )

  // ===== 9. POST /user/models — 创建用户模型 =====
  server.post(
    '/user/models',
    {
      schema: {
        description: '创建用户模型',
        tags: ['AI Core'],
        body: {
          type: 'object',
          properties: {
            name: { type: 'string' },
            provider: { type: 'string' },
            model: { type: 'string' },
            apiKey: { type: 'string' },
            baseUrl: { type: 'string' },
          },
          required: ['name', 'provider', 'model', 'apiKey'],
        },
        response: {
          201: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              name: { type: 'string' },
              provider: { type: 'string' },
              model: { type: 'string' },
              apiKey: { type: 'string' },
              baseUrl: { type: 'string' },
              createdAt: { type: 'string' },
              updatedAt: { type: 'string' },
            },
          },
          400: errorResponseSchema,
          401: errorResponseSchema,
        },
      },
      preHandler: [
        requireApiKeyAuth,
        requireApiKeyPermission('models:write'),
        requireApiKeyQuota(),
      ],
    },
    async (request, reply) => {
      const userId = getUserId(request, reply)
      if (!userId) return

      const parsed = createUserModelSchema.safeParse(request.body)
      if (!parsed.success) {
        return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
      }
      const { name, provider, model, apiKey, baseUrl } = parsed.data as V1CreateUserModelRequest

      const [row] = await db
        .insert(zhsAiUserModelChatConfig)
        .values({
          userId,
          name,
          vendor: provider,
          modelId: model,
          apiKey,
          baseUrl: baseUrl ?? null,
        })
        .returning()

      const result: V1UserModelConfig = {
        id: row!.id,
        name: row!.name,
        provider: row!.vendor,
        model: row!.modelId,
        apiKey: maskKey(row!.apiKey),
        baseUrl: row!.baseUrl ?? undefined,
        createdAt: row!.createdAt.toISOString(),
        updatedAt: row!.createdAt.toISOString(),
      }
      return reply.status(201).send(result)
    },
  )

  // ===== 10. PUT /user/models/:id — 更新用户模型 =====
  server.put(
    '/user/models/:id',
    {
      schema: {
        description: '更新用户模型',
        tags: ['AI Core'],
        params: {
          type: 'object',
          properties: { id: { type: 'string' } },
          required: ['id'],
        },
        body: {
          type: 'object',
          properties: {
            name: { type: 'string' },
            provider: { type: 'string' },
            model: { type: 'string' },
            apiKey: { type: 'string' },
            baseUrl: { type: 'string' },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              name: { type: 'string' },
              provider: { type: 'string' },
              model: { type: 'string' },
              apiKey: { type: 'string' },
              baseUrl: { type: 'string' },
              createdAt: { type: 'string' },
              updatedAt: { type: 'string' },
            },
          },
          400: errorResponseSchema,
          401: errorResponseSchema,
          403: errorResponseSchema,
          404: errorResponseSchema,
        },
      },
      preHandler: [
        requireApiKeyAuth,
        requireApiKeyPermission('models:write'),
        requireApiKeyQuota(),
      ],
    },
    async (request, reply) => {
      const userId = getUserId(request, reply)
      if (!userId) return

      const { id } = request.params as { id: string }
      const parsed = updateUserModelSchema.safeParse(request.body)
      if (!parsed.success) {
        return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
      }

      const [existing] = await dbRead
        .select()
        .from(zhsAiUserModelChatConfig)
        .where(eq(zhsAiUserModelChatConfig.id, id))
        .limit(1)
      if (!existing) return reply.status(404).send(error(404, 'Model config not found'))
      if (existing.userId !== userId) return reply.status(403).send(error(403, 'Forbidden'))

      const updates: Record<string, unknown> = {}
      if (parsed.data.name !== undefined) updates.name = parsed.data.name
      if (parsed.data.provider !== undefined) updates.vendor = parsed.data.provider
      if (parsed.data.model !== undefined) updates.modelId = parsed.data.model
      if (parsed.data.apiKey !== undefined) updates.apiKey = parsed.data.apiKey
      if (parsed.data.baseUrl !== undefined) updates.baseUrl = parsed.data.baseUrl

      let row = existing
      if (Object.keys(updates).length > 0) {
        const [updated] = await db
          .update(zhsAiUserModelChatConfig)
          .set(updates)
          .where(eq(zhsAiUserModelChatConfig.id, id))
          .returning()
        row = updated ?? existing
      }

      const result: V1UserModelConfig = {
        id: row.id,
        name: row.name,
        provider: row.vendor,
        model: row.modelId,
        apiKey: maskKey(row.apiKey),
        baseUrl: row.baseUrl ?? undefined,
        createdAt: row.createdAt.toISOString(),
        updatedAt: row.createdAt.toISOString(),
      }
      return reply.send(result)
    },
  )

  // ===== 11. DELETE /user/models/:id — 删除用户模型 =====
  server.delete(
    '/user/models/:id',
    {
      schema: {
        description: '删除用户模型',
        tags: ['AI Core'],
        params: {
          type: 'object',
          properties: { id: { type: 'string' } },
          required: ['id'],
        },
        response: {
          204: { type: 'null' },
          401: errorResponseSchema,
          403: errorResponseSchema,
          404: errorResponseSchema,
        },
      },
      preHandler: [
        requireApiKeyAuth,
        requireApiKeyPermission('models:write'),
        requireApiKeyQuota(),
      ],
    },
    async (request, reply) => {
      const userId = getUserId(request, reply)
      if (!userId) return

      const { id } = request.params as { id: string }
      const [existing] = await dbRead
        .select()
        .from(zhsAiUserModelChatConfig)
        .where(eq(zhsAiUserModelChatConfig.id, id))
        .limit(1)
      if (!existing) return reply.status(404).send(error(404, 'Model config not found'))
      if (existing.userId !== userId) return reply.status(403).send(error(403, 'Forbidden'))

      await db
        .delete(zhsAiUserModelChatConfig)
        .where(eq(zhsAiUserModelChatConfig.id, id))
      return reply.status(204).send()
    },
  )

  // ===== 12. POST /agents/execute — Agent 高级执行 =====
  server.post(
    '/agents/execute',
    {
      schema: {
        description: 'Agent 高级执行',
        tags: ['AI Core'],
        body: {
          type: 'object',
          properties: {
            agentId: { type: 'string' },
            input: { type: 'string' },
            sessionId: { type: 'string' },
            permissionMode: { type: 'string' },
            maxIterations: { type: 'number' },
          },
          required: ['agentId', 'input'],
        },
        response: {
          200: {
            type: 'object',
            properties: {
              taskId: { type: 'string' },
              sessionId: { type: 'string' },
              status: { type: 'string' },
              output: { type: 'string' },
              iterations: { type: 'number' },
              usage: { type: 'object' },
            },
          },
          400: errorResponseSchema,
          401: errorResponseSchema,
          502: errorResponseSchema,
          503: errorResponseSchema,
        },
      },
      preHandler: [
        requireApiKeyAuth,
        requireApiKeyPermission('agents:call'),
        requireApiKeyQuota(),
      ],
    },
    async (request, reply) => {
      const parsed = agentExecuteSchema.safeParse(request.body)
      if (!parsed.success) {
        return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
      }
      const { agentId, input, sessionId, permissionMode, maxIterations } =
        parsed.data as V1AgentExecuteRequest

      // 转发到 ai-service /api/agents/execute(snake_case)
      const body: Record<string, unknown> = {
        agent_id: agentId,
        input,
      }
      if (sessionId) body.session_id = sessionId
      if (permissionMode) body.permission_mode = permissionMode
      if (maxIterations) body.max_iterations = maxIterations

      try {
        const resp = await fetch(
          `${config.AI_SERVICE_URL}/api/agents/execute`,
          jsonInit(body),
        )
        if (!resp.ok) {
          const txt = await resp.text().catch(() => '')
          return reply
            .status(503)
            .send(error(503, `AI service unavailable (${resp.status}): ${txt.slice(0, 200)}`))
        }
        const data = (await resp.json()) as {
          task_id?: string
          sessionId?: string
          session_id?: string
          status?: string
          output?: string
          iterations?: number
          usage?: { total_tokens?: number }
          error?: boolean
          error_message?: string
        }
        if (data.error) {
          return reply.status(502).send(error(502, data.error_message ?? 'AI service error'))
        }
        const result: V1AgentExecuteResponse = {
          taskId: data.task_id ?? '',
          sessionId: data.sessionId ?? data.session_id ?? sessionId ?? '',
          status: (data.status as V1AgentExecuteResponse['status']) ?? 'completed',
          output: data.output ?? '',
          iterations: data.iterations ?? 0,
          usage: { totalTokens: data.usage?.total_tokens ?? 0 },
        }
        return reply.send(result)
      } catch (e) {
        return reply.status(503).send(error(503, (e as Error).message || 'AI service unavailable'))
      }
    },
  )

  // ===== 13. POST /agents/execute/stream — Agent 流式执行(SSE) =====
  server.post(
    '/agents/execute/stream',
    {
      schema: {
        description: 'Agent 流式执行(SSE)',
        tags: ['AI Core'],
        body: {
          type: 'object',
          properties: {
            agentId: { type: 'string' },
            input: { type: 'string' },
            sessionId: { type: 'string' },
            permissionMode: { type: 'string' },
            maxIterations: { type: 'number' },
          },
          required: ['agentId', 'input'],
        },
        response: {
          200: { type: 'string' },
          400: errorResponseSchema,
          401: errorResponseSchema,
        },
      },
      preHandler: [
        requireApiKeyAuth,
        requireApiKeyPermission('agents:call'),
        requireApiKeyQuota(),
      ],
    },
    async (request, reply) => {
      const parsed = agentExecuteSchema.safeParse(request.body)
      if (!parsed.success) {
        return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
      }
      const { agentId, input, sessionId, permissionMode, maxIterations } =
        parsed.data as V1AgentExecuteRequest

      const body: Record<string, unknown> = {
        agent_id: agentId,
        input,
      }
      if (sessionId) body.session_id = sessionId
      if (permissionMode) body.permission_mode = permissionMode
      if (maxIterations) body.max_iterations = maxIterations

      reply.hijack()
      const raw = reply.raw
      raw.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
        'X-Accel-Buffering': 'no',
      })

      const controller = new AbortController()
      const onClose = () => controller.abort()
      request.raw.on('close', onClose)

      try {
        const resp = await fetch(`${config.AI_SERVICE_URL}/api/agents/execute/stream`, {
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
          raw.write(
            `data: ${JSON.stringify({
              error: true,
              message: `upstream ${resp.status}: ${errText.slice(0, 200)}`,
            })}\n\n`,
          )
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
            // 透传 SSE 行(空行也保留以维持 SSE 帧结构)
            raw.write(`${line}\n`)
          }
        }
        if (buffer.trim()) raw.write(`${buffer}\n`)
        raw.write('data: [DONE]\n\n')
      } catch (e) {
        const msg =
          (e as Error).name === 'AbortError' ? 'client disconnected' : (e as Error).message
        raw.write(`data: ${JSON.stringify({ error: true, message: msg })}\n\n`)
        raw.write('data: [DONE]\n\n')
      } finally {
        request.raw.off('close', onClose)
        raw.end()
      }
    },
  )

  // ===== 14. GET /agents/tasks/:id/status — 任务状态 =====
  server.get(
    '/agents/tasks/:id/status',
    {
      schema: {
        description: '任务状态',
        tags: ['AI Core'],
        params: {
          type: 'object',
          properties: { id: { type: 'string' } },
          required: ['id'],
        },
        response: {
          200: {
            type: 'object',
            properties: {
              taskId: { type: 'string' },
              status: { type: 'string' },
              progress: { type: 'number' },
              result: { type: 'string' },
              error: { type: 'string' },
              createdAt: { type: 'string' },
              updatedAt: { type: 'string' },
            },
          },
          401: errorResponseSchema,
          503: errorResponseSchema,
        },
      },
      preHandler: [
        requireApiKeyAuth,
        requireApiKeyPermission('agents:read'),
        requireApiKeyQuota(),
      ],
    },
    async (request, reply) => {
      const { id } = request.params as { id: string }
      try {
        const resp = await fetch(
          `${config.AI_SERVICE_URL}/api/agents/${encodeURIComponent(id)}/status`,
          { method: 'GET' },
        )
        if (!resp.ok) {
          const txt = await resp.text().catch(() => '')
          return reply
            .status(503)
            .send(error(503, `AI service unavailable (${resp.status}): ${txt.slice(0, 200)}`))
        }
        const data = (await resp.json()) as {
          task_id?: string
          status?: string
          progress?: number
          result?: string
          error?: string
          created_at?: string
          updated_at?: string
        }
        // 透传 + camelCase 映射
        return reply.send({
          taskId: data.task_id ?? id,
          status: data.status ?? 'unknown',
          ...(data.progress !== undefined ? { progress: data.progress } : {}),
          ...(data.result !== undefined ? { result: data.result } : {}),
          ...(data.error !== undefined ? { error: data.error } : {}),
          createdAt: data.created_at ?? new Date().toISOString(),
          updatedAt: data.updated_at ?? new Date().toISOString(),
        })
      } catch (e) {
        return reply.status(503).send(error(503, (e as Error).message || 'AI service unavailable'))
      }
    },
  )

  // ===== 15. POST /agents/tasks/:id/cancel — 取消任务 =====
  server.post(
    '/agents/tasks/:id/cancel',
    {
      schema: {
        description: '取消任务',
        tags: ['AI Core'],
        params: {
          type: 'object',
          properties: { id: { type: 'string' } },
          required: ['id'],
        },
        response: {
          200: { type: 'object' },
          401: errorResponseSchema,
        },
      },
      preHandler: [
        requireApiKeyAuth,
        requireApiKeyPermission('agents:call'),
        requireApiKeyQuota(),
      ],
    },
    async (request, reply) => {
      const { id } = request.params as { id: string }
      return forwardAiService(
        reply,
        `/api/agents/${encodeURIComponent(id)}/cancel`,
        jsonInit({}),
      )
    },
  )

  // ===== 16. GET /agents/sessions — 会话列表 =====
  server.get(
    '/agents/sessions',
    {
      schema: {
        description: '会话列表',
        tags: ['AI Core'],
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
                    agentId: { type: 'string' },
                    title: { type: 'string' },
                    messageCount: { type: 'number' },
                    lastMessageAt: { type: 'string' },
                    createdAt: { type: 'string' },
                  },
                },
              },
            },
          },
          401: errorResponseSchema,
          503: errorResponseSchema,
        },
      },
      preHandler: [
        requireApiKeyAuth,
        requireApiKeyPermission('agents:read'),
        requireApiKeyQuota(),
      ],
    },
    async (_request, reply) => {
      try {
        const resp = await fetch(`${config.AI_SERVICE_URL}/api/agents/sessions`, { method: 'GET' })
        if (!resp.ok) {
          const txt = await resp.text().catch(() => '')
          return reply
            .status(503)
            .send(error(503, `AI service unavailable (${resp.status}): ${txt.slice(0, 200)}`))
        }
        const data = (await resp.json()) as {
          data?: unknown
          sessions?: unknown
        }
        let sessions: unknown[] = []
        if (Array.isArray(data.data)) sessions = data.data
        else if (Array.isArray(data.sessions)) sessions = data.sessions
        else if (Array.isArray(data)) sessions = data

        const mapped = sessions.map((s) => {
          const so = (s ?? {}) as Record<string, unknown>
          return {
            id: (typeof so.id === 'string' && so.id) || (typeof so.session_id === 'string' && so.session_id) || '',
            agentId: (typeof so.agent_id === 'string' && so.agent_id) || (typeof so.agentId === 'string' && so.agentId) || '',
            title: (typeof so.title === 'string' && so.title) || '',
            messageCount: (typeof so.message_count === 'number' && so.message_count) || (typeof so.messageCount === 'number' && so.messageCount) || 0,
            lastMessageAt: (typeof so.last_message_at === 'string' && so.last_message_at) || (typeof so.lastMessageAt === 'string' && so.lastMessageAt) || new Date().toISOString(),
            createdAt: (typeof so.created_at === 'string' && so.created_at) || (typeof so.createdAt === 'string' && so.createdAt) || new Date().toISOString(),
          }
        })
        const result: V1AgentSessionsResponse = { object: 'list', data: mapped }
        return reply.send(result)
      } catch (e) {
        return reply.status(503).send(error(503, (e as Error).message || 'AI service unavailable'))
      }
    },
  )

  // ===== 17. DELETE /agents/sessions/:id — 删除会话 =====
  server.delete(
    '/agents/sessions/:id',
    {
      schema: {
        description: '删除会话',
        tags: ['AI Core'],
        params: {
          type: 'object',
          properties: { id: { type: 'string' } },
          required: ['id'],
        },
        response: {
          200: { type: 'object' },
          204: { type: 'null' },
          401: errorResponseSchema,
          503: errorResponseSchema,
        },
      },
      preHandler: [
        requireApiKeyAuth,
        requireApiKeyPermission('agents:read'),
        requireApiKeyQuota(),
      ],
    },
    async (request, reply) => {
      const { id } = request.params as { id: string }
      try {
        const resp = await fetch(
          `${config.AI_SERVICE_URL}/api/agents/sessions/${encodeURIComponent(id)}`,
          { method: 'DELETE' },
        )
        if (!resp.ok) {
          const txt = await resp.text().catch(() => '')
          return reply
            .status(503)
            .send(error(503, `AI service unavailable (${resp.status}): ${txt.slice(0, 200)}`))
        }
        // 204 No Content 或 200 + body
        if (resp.status === 204) return reply.status(204).send()
        const data = await resp.json().catch(() => ({}))
        return reply.send(data)
      } catch (e) {
        return reply.status(503).send(error(503, (e as Error).message || 'AI service unavailable'))
      }
    },
  )

  // ===== 18. POST /agents/pipeline — Pipeline 编排 =====
  server.post(
    '/agents/pipeline',
    {
      schema: {
        description: 'Pipeline 编排',
        tags: ['AI Core'],
        body: {
          type: 'object',
          properties: {
            steps: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  agentId: { type: 'string' },
                  input: { type: 'string' },
                  dependsOn: { type: 'array', items: { type: 'number' } },
                },
                required: ['agentId', 'input'],
              },
            },
          },
          required: ['steps'],
        },
        response: {
          200: {
            type: 'object',
            properties: {
              pipelineId: { type: 'string' },
              results: { type: 'array' },
            },
          },
          400: errorResponseSchema,
          401: errorResponseSchema,
          502: errorResponseSchema,
          503: errorResponseSchema,
        },
      },
      preHandler: [
        requireApiKeyAuth,
        requireApiKeyPermission('agents:call'),
        requireApiKeyQuota(),
      ],
    },
    async (request, reply) => {
      const parsed = agentPipelineSchema.safeParse(request.body)
      if (!parsed.success) {
        return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
      }
      const { steps } = parsed.data as V1AgentPipelineRequest

      // 转发到 ai-service /api/v1/ai/agent/pipeline
      const body = {
        steps: steps.map((s) => ({
          agent_id: s.agentId,
          input: s.input,
          ...(s.dependsOn ? { depends_on: s.dependsOn } : {}),
        })),
      }
      try {
        const resp = await fetch(
          `${config.AI_SERVICE_URL}/api/v1/ai/agent/pipeline`,
          jsonInit(body),
        )
        if (!resp.ok) {
          const txt = await resp.text().catch(() => '')
          return reply
            .status(503)
            .send(error(503, `AI service unavailable (${resp.status}): ${txt.slice(0, 200)}`))
        }
        const data = (await resp.json()) as {
          pipeline_id?: string
          results?: Array<{ step_index?: number; stepIndex?: number; status?: string; output?: string }>
          error?: boolean
          error_message?: string
        }
        if (data.error) {
          return reply.status(502).send(error(502, data.error_message ?? 'AI service error'))
        }
        const result: V1AgentPipelineResponse = {
          pipelineId: data.pipeline_id ?? '',
          results: (data.results ?? []).map((r) => ({
            stepIndex: r.step_index ?? r.stepIndex ?? 0,
            status: (r.status as 'completed' | 'failed') ?? 'completed',
            output: r.output ?? '',
          })),
        }
        return reply.send(result)
      } catch (e) {
        return reply.status(503).send(error(503, (e as Error).message || 'AI service unavailable'))
      }
    },
  )

  // ===== 19. POST /agents/parallel — 并行执行 =====
  server.post(
    '/agents/parallel',
    {
      schema: {
        description: '并行执行',
        tags: ['AI Core'],
        body: {
          type: 'object',
          properties: {
            tasks: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  agentId: { type: 'string' },
                  input: { type: 'string' },
                },
                required: ['agentId', 'input'],
              },
            },
          },
          required: ['tasks'],
        },
        response: {
          200: {
            type: 'object',
            properties: {
              batchId: { type: 'string' },
              results: { type: 'array' },
            },
          },
          400: errorResponseSchema,
          401: errorResponseSchema,
          502: errorResponseSchema,
          503: errorResponseSchema,
        },
      },
      preHandler: [
        requireApiKeyAuth,
        requireApiKeyPermission('agents:call'),
        requireApiKeyQuota(),
      ],
    },
    async (request, reply) => {
      const parsed = agentParallelSchema.safeParse(request.body)
      if (!parsed.success) {
        return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
      }
      const { tasks } = parsed.data as V1AgentParallelRequest

      // 转发到 ai-service /api/v1/ai/agent/parallel
      const body = {
        tasks: tasks.map((t) => ({ agent_id: t.agentId, input: t.input })),
      }
      try {
        const resp = await fetch(
          `${config.AI_SERVICE_URL}/api/v1/ai/agent/parallel`,
          jsonInit(body),
        )
        if (!resp.ok) {
          const txt = await resp.text().catch(() => '')
          return reply
            .status(503)
            .send(error(503, `AI service unavailable (${resp.status}): ${txt.slice(0, 200)}`))
        }
        const data = (await resp.json()) as {
          batch_id?: string
          results?: Array<{ index?: number; status?: string; output?: string }>
          error?: boolean
          error_message?: string
        }
        if (data.error) {
          return reply.status(502).send(error(502, data.error_message ?? 'AI service error'))
        }
        const result: V1AgentParallelResponse = {
          batchId: data.batch_id ?? '',
          results: (data.results ?? []).map((r) => ({
            index: r.index ?? 0,
            status: (r.status as 'completed' | 'failed') ?? 'completed',
            output: r.output ?? '',
          })),
        }
        return reply.send(result)
      } catch (e) {
        return reply.status(503).send(error(503, (e as Error).message || 'AI service unavailable'))
      }
    },
  )

  // ===== 20. POST /agents/decompose — 任务分解 =====
  server.post(
    '/agents/decompose',
    {
      schema: {
        description: '任务分解',
        tags: ['AI Core'],
        body: { type: 'object' },
        response: {
          200: { type: 'object' },
          401: errorResponseSchema,
        },
      },
      preHandler: [
        requireApiKeyAuth,
        requireApiKeyPermission('agents:call'),
        requireApiKeyQuota(),
      ],
    },
    async (request, reply) => {
      // 转发到 ai-service /api/v1/ai/agent/decompose(透传 body)
      return forwardAiService(
        reply,
        '/api/v1/ai/agent/decompose',
        jsonInit(request.body ?? {}),
      )
    },
  )
}

export default v1AiCoreRoutes
