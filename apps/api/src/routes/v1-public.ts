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
import { eq, and, isNull } from 'drizzle-orm'
import { z } from 'zod'
import { config } from '../config/index.js'
import { dbRead } from '../db/index.js'
import { agents, files } from '@ihui/database'
import {
  requireApiKeyAuth,
  requireApiKeyPermission,
  requireApiKeyQuota,
} from '../plugins/api-key-auth.js'
import { error } from '../utils/response.js'

// =============================================================================
// 本地类型定义
// TODO: packages/types/src/index.ts 尚未 re-export api-key.ts,待补齐后切换为:
//   import type { V1AgentsListResponse, V1AgentInfo, ... } from '@ihui/types'
// 当前与 packages/types/src/api-key.ts 保持结构一致(2026-07-22 立)
// =============================================================================

interface V1AgentInfo {
  id: string
  name: string
  description: string
  capabilities: string[]
}

interface V1AgentsListResponse {
  object: 'list'
  data: V1AgentInfo[]
}

interface V1AgentCallResponse {
  agentId: string
  sessionId: string
  output: string
  usage: { totalTokens: number }
}

interface V1ChatCompletionResponse {
  id: string
  object: 'chat.completion'
  created: number
  model: string
  choices: Array<{
    index: number
    message: { role: 'assistant'; content: string }
    finishReason: 'stop' | 'length'
  }>
  usage: { promptTokens: number; completionTokens: number; totalTokens: number }
}

interface V1ModelsResponse {
  object: 'list'
  data: Array<{
    id: string
    object: 'model'
    created: number
    ownedBy: string
  }>
}

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
// 静态降级数据
// =============================================================================

// TODO: 接入真实 ai-service 模型列表(ai-service /api/llm/models 不可用时降级)
const FALLBACK_MODELS: V1ModelsResponse = {
  object: 'list',
  data: [
    { id: 'gpt-4o', object: 'model', created: 1700000000, ownedBy: 'openai' },
    { id: 'gpt-4o-mini', object: 'model', created: 1700000000, ownedBy: 'openai' },
    { id: 'gpt-4-turbo', object: 'model', created: 1700000000, ownedBy: 'openai' },
    { id: 'claude-3-5-sonnet', object: 'model', created: 1700000000, ownedBy: 'anthropic' },
    { id: 'claude-3-5-haiku', object: 'model', created: 1700000000, ownedBy: 'anthropic' },
    { id: 'glm-4', object: 'model', created: 1700000000, ownedBy: 'zhipu' },
    { id: 'glm-4-flash', object: 'model', created: 1700000000, ownedBy: 'zhipu' },
    { id: 'deepseek-chat', object: 'model', created: 1700000000, ownedBy: 'deepseek' },
    { id: 'qwen-plus', object: 'model', created: 1700000000, ownedBy: 'alibaba' },
    { id: 'moonshot-v1-8k', object: 'model', created: 1700000000, ownedBy: 'moonshot' },
  ],
}

// =============================================================================
// 辅助函数
// =============================================================================

type AgentRow = typeof agents.$inferSelect

/** 从 agents 表行映射为 V1AgentInfo */
function toAgentInfo(row: AgentRow): V1AgentInfo {
  // TODO: 根据 agent 配置(botId/agentModel/agentTools)推导 capabilities
  const capabilities: string[] = ['chat']
  if (row.botId) capabilities.push('coze')
  if (row.agentModel) capabilities.push('model:' + row.agentModel)
  return {
    id: row.agentId,
    name: row.name,
    description: row.description ?? '',
    capabilities,
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
  const { model, messages, temperature, maxTokens } = opts

  const writeChunk = (delta: Record<string, unknown>, finishReason: string | null) => {
    raw.write(
      `data: ${JSON.stringify({
        id,
        object: 'chat.completion.chunk',
        created,
        model,
        choices: [{ index: 0, delta, finishReason }],
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
      writeChunk(
        { content: `[error] upstream ${resp.status}: ${errText.slice(0, 200)}` },
        'stop',
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
        const text = extractStreamText(line)
        if (text) writeChunk({ content: text }, null)
      }
    }
    if (buffer.trim()) {
      const text = extractStreamText(buffer)
      if (text) writeChunk({ content: text }, null)
    }

    // 结束 chunk
    writeChunk({}, 'stop')
    raw.write('data: [DONE]\n\n')
  } catch (e) {
    const msg = (e as Error).name === 'AbortError' ? 'client disconnected' : (e as Error).message
    writeChunk({ content: `[error] ${msg}` }, 'stop')
    raw.write('data: [DONE]\n\n')
  } finally {
    request.raw.off('close', onClose)
    raw.end()
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
      preHandler: [
        requireApiKeyAuth,
        requireApiKeyPermission('agents:read'),
        requireApiKeyQuota(),
      ],
    },
    async (_request, reply) => {
      const rows = await dbRead.select().from(agents).where(eq(agents.status, 'published'))
      const data = rows.map(toAgentInfo)
      const resp: V1AgentsListResponse = { object: 'list', data }
      return reply.send(resp)
    },
  )

  // ===== 2. GET /agents/:id — Agent 详情 =====
  server.get(
    '/agents/:id',
    {
      preHandler: [
        requireApiKeyAuth,
        requireApiKeyPermission('agents:read'),
        requireApiKeyQuota(),
      ],
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
      preHandler: [
        requireApiKeyAuth,
        requireApiKeyPermission('agents:call'),
        requireApiKeyQuota(),
      ],
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
      preHandler: [
        requireApiKeyAuth,
        requireApiKeyPermission('chat:write'),
        requireApiKeyQuota(),
      ],
    },
    async (request, reply) => {
      const parsed = chatCompletionSchema.safeParse(request.body)
      if (!parsed.success) {
        return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
      }
      const { model, messages, stream, temperature, maxTokens } = parsed.data

      if (stream) {
        return streamChatCompletion(request, reply, { model, messages, temperature, maxTokens })
      }

      // 非流式:转发到 ai-service /api/llm/complete
      try {
        const body: Record<string, unknown> = { messages, model }
        if (temperature !== undefined) body.temperature = temperature
        if (maxTokens !== undefined) body.max_tokens = maxTokens

        const resp = await fetch(`${config.AI_SERVICE_URL}/api/llm/complete`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        })

        if (!resp.ok) {
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
          return reply.status(502).send(error(502, data.error_message ?? 'AI service error'))
        }

        const result: V1ChatCompletionResponse = {
          id: `chatcmpl-${randomUUID()}`,
          object: 'chat.completion',
          created: Math.floor(Date.now() / 1000),
          model: data.model ?? model,
          choices: [
            {
              index: 0,
              message: { role: 'assistant', content: data.content ?? '' },
              finishReason: 'stop',
            },
          ],
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

  // ===== 5. GET /models — 模型列表 =====
  server.get(
    '/models',
    {
      preHandler: [
        requireApiKeyAuth,
        requireApiKeyPermission('models:read'),
        requireApiKeyQuota(),
      ],
    },
    async (_request, reply) => {
      try {
        const resp = await fetch(`${config.AI_SERVICE_URL}/api/llm/models`, { method: 'GET' })

        if (resp.ok) {
          const data = (await resp.json()) as unknown
          // 适配多种格式:LiteLLM/OpenAI { data: [...] } / 裸数组 / { models: [...] }
          let models: unknown[] = []
          if (Array.isArray(data)) {
            models = data
          } else if (data && typeof data === 'object') {
            const obj = data as Record<string, unknown>
            if (Array.isArray(obj.data)) models = obj.data
            else if (Array.isArray(obj.models)) models = obj.models
          }

          if (models.length > 0) {
            const mapped = models.map((m) => {
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
              const created =
                typeof mo.created === 'number' ? mo.created : Math.floor(Date.now() / 1000)
              return { id, object: 'model' as const, created, ownedBy }
            })
            const result: V1ModelsResponse = { object: 'list', data: mapped }
            return reply.send(result)
          }
        }
      } catch {
        // 降级到静态列表
      }

      // TODO: 接入真实 ai-service 模型列表,当前为静态降级数据
      return reply.send(FALLBACK_MODELS)
    },
  )

  // ===== 6. GET /files — 文件列表 =====
  server.get(
    '/files',
    {
      preHandler: [
        requireApiKeyAuth,
        requireApiKeyPermission('files:read'),
        requireApiKeyQuota(),
      ],
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

  // ===== 7. POST /files — 上传文件 =====
  server.post(
    '/files',
    {
      preHandler: [
        requireApiKeyAuth,
        requireApiKeyPermission('files:write'),
        requireApiKeyQuota(),
      ],
    },
    async (request, reply) => {
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

        // TODO: 接入 files 表持久化(files 表 projectId 必填,公开 API 无项目上下文,暂仅存磁盘)
        return reply.status(201).send({
          id: fileId,
          object: 'file',
          filename,
          bytes: buffer.length,
          createdAt: new Date().toISOString(),
        })
      } catch {
        return reply.status(500).send(error(500, 'File save failed'))
      }
    },
  )
}

export default v1PublicRoutes
