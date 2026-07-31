/**
 * /v1/assistants + /v1/threads + /v1/messages + /v1/runs 路由(2026-07-31 立)。
 *
 * OpenAI Assistants API v2 兼容端点,让第三方 SDK(LangChain/LlamaIndex)可直接接入。
 * 端点清单(共 17 个):
 *   Assistants:POST /assistants | GET /assistants/:id | POST /assistants/:id | DELETE /assistants/:id | GET /assistants
 *   Threads:   POST /threads | GET /threads/:id | POST /threads/:id | DELETE /threads/:id
 *   Messages:  POST /threads/:threadId/messages | GET /threads/:threadId/messages/:id | GET /threads/:threadId/messages
 *   Runs:      POST /threads/:threadId/runs | GET /threads/:threadId/runs/:id | POST /threads/:threadId/runs/:id | GET /threads/:threadId/runs
 *   Run Steps: GET /threads/:threadId/runs/:runId/steps
 *
 * 内部映射:Assistant → ai-service 的 agent 配置;Thread → 会话;Run → agent 执行(调用 /api/llm/complete)。
 * 存储:助手/线程/消息/run 元数据存 Redis(key 前缀 assistant: / thread: / run:),TTL 90 天。
 * 鉴权:requireApiKeyAuth preHandler(Bearer token + developer_api_keys 表)。
 * 计费:Run 完成时 recordCall(model 从 assistant 配置读取)。
 *
 * 待主 agent 在 routes/index.ts 注册:
 *   import v1Assistants from './v1-assistants.js'
 *   server.register(v1Assistants, { prefix: '/v1' })
 *
 * 响应格式:OpenAI 兼容(不套 { code, message, data } 壳,与 v1-public.ts / v1-rerank-moderations.ts 一致)。
 * 错误格式:{ code, message } + HTTP 状态码(400/401/403/404/500/502/503)。
 */
import type { FastifyPluginAsync } from 'fastify'
import { randomUUID } from 'node:crypto'
import type { Redis } from 'ioredis'
import { z } from 'zod'
import { requireApiKeyAuth } from '../plugins/api-key-auth.js'
import { error } from '../utils/response.js'
import { aiServiceFetch } from '../utils/ai-service-fetch.js'
import { recordCall, modelToProviderCode } from '../services/relay-billing-service.js'

// =============================================================================
// 类型定义(OpenAI Assistants API v2 兼容,inline 定义避免污染 @ihui/types)
// =============================================================================

/** Assistant 工具定义(OpenAI 兼容:code_interpreter / retrieval / function) */
interface AssistantTool {
  type: string
  function?: {
    name: string
    description?: string
    parameters?: Record<string, unknown>
  }
}

/** OpenAI Assistant 对象 */
interface Assistant {
  id: string
  object: 'assistant'
  created_at: number
  name: string | null
  description: string | null
  model: string
  instructions: string | null
  tools: AssistantTool[]
  metadata: Record<string, string> | null
  /** 内部字段:所有者用户 id(不返回给客户端,见 toAssistantResponse) */
  userId: string
}

/** OpenAI Thread 对象 */
interface Thread {
  id: string
  object: 'thread'
  created_at: number
  metadata: Record<string, string> | null
  userId: string
}

/** Message 内容块(OpenAI v2 仅支持 text 类型) */
interface MessageContent {
  type: 'text'
  text: { value: string; annotations: unknown[] }
}

/** OpenAI Thread Message 对象 */
interface ThreadMessage {
  id: string
  object: 'thread.message'
  created_at: number
  thread_id: string
  role: 'user' | 'assistant'
  content: MessageContent[]
  assistant_id: string | null
  run_id: string | null
  metadata: Record<string, string> | null
}

type RunStatus = 'queued' | 'in_progress' | 'completed' | 'failed' | 'cancelled' | 'expired'

/** Run 用量统计 */
interface RunUsage {
  prompt_tokens: number
  completion_tokens: number
  total_tokens: number
}

/** OpenAI Run 对象 */
interface Run {
  id: string
  object: 'thread.run'
  created_at: number
  thread_id: string
  status: RunStatus
  assistant_id: string
  model: string
  instructions: string | null
  tools: AssistantTool[]
  metadata: Record<string, string> | null
  started_at: number | null
  completed_at: number | null
  failed_at: number | null
  usage: RunUsage | null
  /** 内部字段:所有者用户 id */
  userId: string
}

/** Run Step 详情(message_creation / tool_calls) */
interface RunStepDetails {
  type: 'message_creation' | 'tool_calls'
  message_creation?: { message_id: string }
  tool_calls?: unknown[]
}

/** OpenAI Run Step 对象 */
interface RunStep {
  id: string
  object: 'thread.run.step'
  created_at: number
  run_id: string
  assistant_id: string
  thread_id: string
  type: 'message_creation' | 'tool_calls'
  status: 'in_progress' | 'completed' | 'failed'
  step_details: RunStepDetails
  last_error: { code: string; message: string } | null
}

/** OpenAI 列表响应(cursor 分页) */
interface ListResponse<T> {
  object: 'list'
  data: T[]
  first_id: string | null
  last_id: string | null
  has_more: boolean
}

// =============================================================================
// 常量
// =============================================================================

/** Redis TTL:90 天(秒) */
const TTL_SECONDS = 90 * 24 * 60 * 60

/** 列表分页默认 limit */
const DEFAULT_LIMIT = 20

/** 列表分页最大 limit */
const MAX_LIMIT = 100

// =============================================================================
// Zod schemas(请求体校验)
// =============================================================================

const toolSchema = z.object({
  type: z.string().min(1),
  function: z
    .object({
      name: z.string().min(1),
      description: z.string().optional(),
      parameters: z.record(z.unknown()).optional(),
    })
    .optional(),
})

const metadataSchema = z.record(z.string(), z.string()).nullable().default(null)

const createAssistantSchema = z.object({
  model: z.string().min(1),
  name: z.string().max(256).nullable().default(null),
  description: z.string().nullable().default(null),
  instructions: z.string().nullable().default(null),
  tools: z.array(toolSchema).optional().default([]),
  metadata: metadataSchema,
})

const updateAssistantSchema = z.object({
  model: z.string().min(1).optional(),
  name: z.string().max(256).nullable().optional(),
  description: z.string().nullable().optional(),
  instructions: z.string().nullable().optional(),
  tools: z.array(toolSchema).optional(),
  metadata: z.record(z.string(), z.string()).nullable().optional(),
})

const createThreadSchema = z.object({
  messages: z
    .array(
      z.object({
        role: z.literal('user'),
        content: z.string(),
      }),
    )
    .optional(),
  metadata: metadataSchema,
})

const updateThreadSchema = z.object({
  metadata: z.record(z.string(), z.string()).nullable().optional(),
})

const createMessageSchema = z.object({
  role: z.literal('user'),
  content: z.string(),
  metadata: metadataSchema,
})

const createRunSchema = z.object({
  assistant_id: z.string().min(1),
  model: z.string().min(1).optional(),
  instructions: z.string().optional(),
  metadata: metadataSchema,
})

const updateRunSchema = z.object({
  metadata: z.record(z.string(), z.string()).nullable().optional(),
})

const listQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(MAX_LIMIT).optional().default(DEFAULT_LIMIT),
  after: z.string().optional(),
})

// =============================================================================
// Redis 存储辅助函数
// =============================================================================

/** 存储助手 + 加入用户助手集合 */
async function storeAssistant(redis: Redis, assistant: Assistant): Promise<void> {
  const key = `assistant:${assistant.id}`
  await redis.set(key, JSON.stringify(assistant), 'EX', TTL_SECONDS)
  const setKey = `assistant:user:${assistant.userId}`
  await redis.sadd(setKey, assistant.id)
  await redis.expire(setKey, TTL_SECONDS)
}

/** 读取助手 */
async function getAssistant(redis: Redis, id: string): Promise<Assistant | null> {
  const raw = await redis.get(`assistant:${id}`)
  if (!raw) return null
  return JSON.parse(raw) as Assistant
}

/** 列出用户助手(按 created_at 升序,cursor 分页) */
async function listAssistants(
  redis: Redis,
  userId: string,
  limit: number,
  after: string | undefined,
): Promise<ListResponse<Assistant>> {
  const setKey = `assistant:user:${userId}`
  const ids = await redis.smembers(setKey)
  const items: Assistant[] = []
  for (const id of ids) {
    const a = await getAssistant(redis, id)
    if (a) items.push(a)
  }
  items.sort((a, b) => a.created_at - b.created_at)
  let startIdx = 0
  if (after) {
    const idx = items.findIndex((a) => a.id === after)
    if (idx >= 0) startIdx = idx + 1
  }
  const page = items.slice(startIdx, startIdx + limit)
  const hasMore = startIdx + limit < items.length
  return {
    object: 'list',
    data: page,
    first_id: page[0]?.id ?? null,
    last_id: page[page.length - 1]?.id ?? null,
    has_more: hasMore,
  }
}

/** 存储线程 */
async function storeThread(redis: Redis, thread: Thread): Promise<void> {
  await redis.set(`thread:${thread.id}`, JSON.stringify(thread), 'EX', TTL_SECONDS)
}

/** 读取线程 */
async function getThread(redis: Redis, id: string): Promise<Thread | null> {
  const raw = await redis.get(`thread:${id}`)
  if (!raw) return null
  return JSON.parse(raw) as Thread
}

/** 追加消息到线程消息列表 + 存储消息体 */
async function storeMessage(redis: Redis, threadId: string, msg: ThreadMessage): Promise<void> {
  const listKey = `thread:${threadId}:msgs`
  const msgKey = `thread:${threadId}:msg:${msg.id}`
  await redis.rpush(listKey, msg.id)
  await redis.set(msgKey, JSON.stringify(msg), 'EX', TTL_SECONDS)
  await redis.expire(listKey, TTL_SECONDS)
}

/** 读取单条消息 */
async function getMessage(
  redis: Redis,
  threadId: string,
  msgId: string,
): Promise<ThreadMessage | null> {
  const raw = await redis.get(`thread:${threadId}:msg:${msgId}`)
  if (!raw) return null
  return JSON.parse(raw) as ThreadMessage
}

/** 列出线程消息(按 created_at 升序,cursor 分页) */
async function listMessages(
  redis: Redis,
  threadId: string,
  limit: number,
  after: string | undefined,
): Promise<ListResponse<ThreadMessage>> {
  const ids = await redis.lrange(`thread:${threadId}:msgs`, 0, -1)
  const items: ThreadMessage[] = []
  for (const id of ids) {
    const m = await getMessage(redis, threadId, id)
    if (m) items.push(m)
  }
  let startIdx = 0
  if (after) {
    const idx = items.findIndex((m) => m.id === after)
    if (idx >= 0) startIdx = idx + 1
  }
  const page = items.slice(startIdx, startIdx + limit)
  const hasMore = startIdx + limit < items.length
  return {
    object: 'list',
    data: page,
    first_id: page[0]?.id ?? null,
    last_id: page[page.length - 1]?.id ?? null,
    has_more: hasMore,
  }
}

/** 追加 run 到线程 run 列表 + 存储 run 体 */
async function storeRun(redis: Redis, run: Run): Promise<void> {
  const listKey = `thread:${run.thread_id}:runs`
  await redis.rpush(listKey, run.id)
  await redis.set(`run:${run.id}`, JSON.stringify(run), 'EX', TTL_SECONDS)
  await redis.expire(listKey, TTL_SECONDS)
}

/** 更新 run(覆盖写) */
async function updateRun(redis: Redis, run: Run): Promise<void> {
  await redis.set(`run:${run.id}`, JSON.stringify(run), 'EX', TTL_SECONDS)
}

/** 读取 run */
async function getRun(redis: Redis, id: string): Promise<Run | null> {
  const raw = await redis.get(`run:${id}`)
  if (!raw) return null
  return JSON.parse(raw) as Run
}

/** 列出线程 runs(cursor 分页) */
async function listRuns(
  redis: Redis,
  threadId: string,
  limit: number,
  after: string | undefined,
): Promise<ListResponse<Run>> {
  const ids = await redis.lrange(`thread:${threadId}:runs`, 0, -1)
  const items: Run[] = []
  for (const id of ids) {
    const r = await getRun(redis, id)
    if (r) items.push(r)
  }
  let startIdx = 0
  if (after) {
    const idx = items.findIndex((r) => r.id === after)
    if (idx >= 0) startIdx = idx + 1
  }
  const page = items.slice(startIdx, startIdx + limit)
  const hasMore = startIdx + limit < items.length
  return {
    object: 'list',
    data: page,
    first_id: page[0]?.id ?? null,
    last_id: page[page.length - 1]?.id ?? null,
    has_more: hasMore,
  }
}

/** 存储 run step */
async function storeRunStep(redis: Redis, step: RunStep): Promise<void> {
  const listKey = `run:${step.run_id}:steps`
  await redis.rpush(listKey, step.id)
  await redis.set(`run:${step.run_id}:step:${step.id}`, JSON.stringify(step), 'EX', TTL_SECONDS)
  await redis.expire(listKey, TTL_SECONDS)
}

/** 列出 run steps */
async function listRunSteps(
  redis: Redis,
  runId: string,
  limit: number,
  after: string | undefined,
): Promise<ListResponse<RunStep>> {
  const ids = await redis.lrange(`run:${runId}:steps`, 0, -1)
  const items: RunStep[] = []
  for (const id of ids) {
    const raw = await redis.get(`run:${runId}:step:${id}`)
    if (raw) items.push(JSON.parse(raw) as RunStep)
  }
  let startIdx = 0
  if (after) {
    const idx = items.findIndex((s) => s.id === after)
    if (idx >= 0) startIdx = idx + 1
  }
  const page = items.slice(startIdx, startIdx + limit)
  const hasMore = startIdx + limit < items.length
  return {
    object: 'list',
    data: page,
    first_id: page[0]?.id ?? null,
    last_id: page[page.length - 1]?.id ?? null,
    has_more: hasMore,
  }
}

// =============================================================================
// 响应裁剪(剥离内部 userId 字段,不暴露给客户端)
// =============================================================================

type AssistantResponse = Omit<Assistant, 'userId'>
type RunResponse = Omit<Run, 'userId'>

function toAssistantResponse(a: Assistant): AssistantResponse {
  const { userId: _userId, ...rest } = a
  return rest
}

function toRunResponse(r: Run): RunResponse {
  const { userId: _userId, ...rest } = r
  return rest
}

// =============================================================================
// 路由插件
// =============================================================================

const v1Assistants: FastifyPluginAsync = async (server) => {
  const redis = server.redis

  // ===========================================================================
  // 1. Assistants CRUD
  // ===========================================================================

  // POST /assistants — 创建助手
  server.post(
    '/assistants',
    {
      schema: {
        description: '创建 Assistant(OpenAI Assistants API v2 兼容)',
        tags: ['Assistants'],
        body: {
          type: 'object',
          properties: {
            model: { type: 'string' },
            name: { type: 'string', maxLength: 256 },
            description: { type: 'string' },
            instructions: { type: 'string' },
            tools: { type: 'array', items: { type: 'object' } },
            metadata: { type: 'object' },
          },
          required: ['model'],
        },
      },
      preHandler: [requireApiKeyAuth],
    },
    async (request, reply) => {
      const parsed = createAssistantSchema.safeParse(request.body)
      if (!parsed.success) {
        return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
      }
      const apiKey = request.apiKey
      if (!apiKey) return reply.status(401).send(error(401, 'API key authentication required'))
      const { model, name, description, instructions, tools, metadata } = parsed.data
      const now = Math.floor(Date.now() / 1000)
      const assistant: Assistant = {
        id: `asst_${randomUUID()}`,
        object: 'assistant',
        created_at: now,
        name: name ?? null,
        description: description ?? null,
        model,
        instructions: instructions ?? null,
        tools: tools ?? [],
        metadata: metadata ?? null,
        userId: apiKey.userId,
      }
      await storeAssistant(redis, assistant)
      return reply.send(toAssistantResponse(assistant))
    },
  )

  // GET /assistants/:id — 查询助手
  server.get('/assistants/:id', { preHandler: [requireApiKeyAuth] }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const apiKey = request.apiKey
    if (!apiKey) return reply.status(401).send(error(401, 'API key authentication required'))
    const assistant = await getAssistant(redis, id)
    if (!assistant || assistant.userId !== apiKey.userId) {
      return reply.status(404).send(error(404, 'Assistant not found'))
    }
    return reply.send(toAssistantResponse(assistant))
  })

  // POST /assistants/:id — 修改助手
  server.post(
    '/assistants/:id',
    {
      schema: {
        description: '修改 Assistant(部分字段更新)',
        tags: ['Assistants'],
        body: {
          type: 'object',
          properties: {
            model: { type: 'string' },
            name: { type: ['string', 'null'] },
            description: { type: ['string', 'null'] },
            instructions: { type: ['string', 'null'] },
            tools: { type: 'array', items: { type: 'object' } },
            metadata: { type: ['object', 'null'] },
          },
        },
      },
      preHandler: [requireApiKeyAuth],
    },
    async (request, reply) => {
      const { id } = request.params as { id: string }
      const parsed = updateAssistantSchema.safeParse(request.body)
      if (!parsed.success) {
        return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
      }
      const apiKey = request.apiKey
      if (!apiKey) return reply.status(401).send(error(401, 'API key authentication required'))
      const existing = await getAssistant(redis, id)
      if (!existing || existing.userId !== apiKey.userId) {
        return reply.status(404).send(error(404, 'Assistant not found'))
      }
      const patch = parsed.data
      const updated: Assistant = {
        ...existing,
        model: patch.model ?? existing.model,
        name: patch.name !== undefined ? patch.name : existing.name,
        description: patch.description !== undefined ? patch.description : existing.description,
        instructions: patch.instructions !== undefined ? patch.instructions : existing.instructions,
        tools: patch.tools ?? existing.tools,
        metadata: patch.metadata !== undefined ? patch.metadata : existing.metadata,
      }
      await storeAssistant(redis, updated)
      return reply.send(toAssistantResponse(updated))
    },
  )

  // DELETE /assistants/:id — 删除助手
  server.delete('/assistants/:id', { preHandler: [requireApiKeyAuth] }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const apiKey = request.apiKey
    if (!apiKey) return reply.status(401).send(error(401, 'API key authentication required'))
    const existing = await getAssistant(redis, id)
    if (!existing || existing.userId !== apiKey.userId) {
      return reply.status(404).send(error(404, 'Assistant not found'))
    }
    await redis.del(`assistant:${id}`)
    await redis.srem(`assistant:user:${apiKey.userId}`, id)
    return reply.send({
      id,
      object: 'assistant.deleted',
      deleted: true,
    })
  })

  // GET /assistants — 助手列表(分页)
  server.get('/assistants', { preHandler: [requireApiKeyAuth] }, async (request, reply) => {
    const apiKey = request.apiKey
    if (!apiKey) return reply.status(401).send(error(401, 'API key authentication required'))
    const parsed = listQuerySchema.safeParse(request.query)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const { limit, after } = parsed.data
    const result = await listAssistants(redis, apiKey.userId, limit, after)
    return reply.send({
      ...result,
      data: result.data.map(toAssistantResponse),
    })
  })

  // ===========================================================================
  // 2. Threads CRUD
  // ===========================================================================

  // POST /threads — 创建线程(可选携带初始消息)
  server.post(
    '/threads',
    {
      schema: {
        description: '创建 Thread(可选携带初始消息)',
        tags: ['Threads'],
        body: {
          type: 'object',
          properties: {
            messages: {
              type: 'array',
              items: {
                type: 'object',
                properties: { role: { type: 'string' }, content: { type: 'string' } },
              },
            },
            metadata: { type: 'object' },
          },
        },
      },
      preHandler: [requireApiKeyAuth],
    },
    async (request, reply) => {
      const parsed = createThreadSchema.safeParse(request.body)
      if (!parsed.success) {
        return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
      }
      const apiKey = request.apiKey
      if (!apiKey) return reply.status(401).send(error(401, 'API key authentication required'))
      const { messages, metadata } = parsed.data
      const now = Math.floor(Date.now() / 1000)
      const thread: Thread = {
        id: `thread_${randomUUID()}`,
        object: 'thread',
        created_at: now,
        metadata: metadata ?? null,
        userId: apiKey.userId,
      }
      await storeThread(redis, thread)
      // 追加初始消息(若有)
      if (messages) {
        for (const m of messages) {
          const msg: ThreadMessage = {
            id: `msg_${randomUUID()}`,
            object: 'thread.message',
            created_at: now,
            thread_id: thread.id,
            role: 'user',
            content: [{ type: 'text', text: { value: m.content, annotations: [] } }],
            assistant_id: null,
            run_id: null,
            metadata: null,
          }
          await storeMessage(redis, thread.id, msg)
        }
      }
      return reply.send(thread)
    },
  )

  // GET /threads/:id — 查询线程
  server.get('/threads/:id', { preHandler: [requireApiKeyAuth] }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const apiKey = request.apiKey
    if (!apiKey) return reply.status(401).send(error(401, 'API key authentication required'))
    const thread = await getThread(redis, id)
    if (!thread || thread.userId !== apiKey.userId) {
      return reply.status(404).send(error(404, 'Thread not found'))
    }
    return reply.send(thread)
  })

  // POST /threads/:id — 修改线程(更新 metadata)
  server.post(
    '/threads/:id',
    {
      schema: {
        description: '修改 Thread(更新 metadata)',
        tags: ['Threads'],
        body: {
          type: 'object',
          properties: { metadata: { type: ['object', 'null'] } },
        },
      },
      preHandler: [requireApiKeyAuth],
    },
    async (request, reply) => {
      const { id } = request.params as { id: string }
      const parsed = updateThreadSchema.safeParse(request.body)
      if (!parsed.success) {
        return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
      }
      const apiKey = request.apiKey
      if (!apiKey) return reply.status(401).send(error(401, 'API key authentication required'))
      const existing = await getThread(redis, id)
      if (!existing || existing.userId !== apiKey.userId) {
        return reply.status(404).send(error(404, 'Thread not found'))
      }
      const updated: Thread = {
        ...existing,
        metadata: parsed.data.metadata !== undefined ? parsed.data.metadata : existing.metadata,
      }
      await storeThread(redis, updated)
      return reply.send(updated)
    },
  )

  // DELETE /threads/:id — 删除线程
  server.delete('/threads/:id', { preHandler: [requireApiKeyAuth] }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const apiKey = request.apiKey
    if (!apiKey) return reply.status(401).send(error(401, 'API key authentication required'))
    const existing = await getThread(redis, id)
    if (!existing || existing.userId !== apiKey.userId) {
      return reply.status(404).send(error(404, 'Thread not found'))
    }
    await redis.del(`thread:${id}`)
    // 清理线程下的消息 + run 列表(尽力清理,不阻塞)
    const msgIds = await redis.lrange(`thread:${id}:msgs`, 0, -1)
    if (msgIds.length > 0) {
      await redis.del(msgIds.map((mid) => `thread:${id}:msg:${mid}`))
      await redis.del(`thread:${id}:msgs`)
    }
    const runIds = await redis.lrange(`thread:${id}:runs`, 0, -1)
    if (runIds.length > 0) {
      await redis.del(runIds.map((rid) => `run:${rid}`))
      await redis.del(`thread:${id}:runs`)
    }
    return reply.send({
      id,
      object: 'thread.deleted',
      deleted: true,
    })
  })

  // ===========================================================================
  // 3. Messages CRUD
  // ===========================================================================

  // POST /threads/:threadId/messages — 创建消息
  server.post(
    '/threads/:threadId/messages',
    {
      schema: {
        description: '向 Thread 追加消息',
        tags: ['Messages'],
        body: {
          type: 'object',
          properties: {
            role: { type: 'string', enum: ['user'] },
            content: { type: 'string' },
            metadata: { type: 'object' },
          },
          required: ['role', 'content'],
        },
      },
      preHandler: [requireApiKeyAuth],
    },
    async (request, reply) => {
      const { threadId } = request.params as { threadId: string }
      const parsed = createMessageSchema.safeParse(request.body)
      if (!parsed.success) {
        return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
      }
      const apiKey = request.apiKey
      if (!apiKey) return reply.status(401).send(error(401, 'API key authentication required'))
      const thread = await getThread(redis, threadId)
      if (!thread || thread.userId !== apiKey.userId) {
        return reply.status(404).send(error(404, 'Thread not found'))
      }
      const { content, metadata } = parsed.data
      const msg: ThreadMessage = {
        id: `msg_${randomUUID()}`,
        object: 'thread.message',
        created_at: Math.floor(Date.now() / 1000),
        thread_id: threadId,
        role: 'user',
        content: [{ type: 'text', text: { value: content, annotations: [] } }],
        assistant_id: null,
        run_id: null,
        metadata: metadata ?? null,
      }
      await storeMessage(redis, threadId, msg)
      return reply.send(msg)
    },
  )

  // GET /threads/:threadId/messages/:id — 查询单条消息
  server.get(
    '/threads/:threadId/messages/:id',
    { preHandler: [requireApiKeyAuth] },
    async (request, reply) => {
      const { threadId, id } = request.params as { threadId: string; id: string }
      const apiKey = request.apiKey
      if (!apiKey) return reply.status(401).send(error(401, 'API key authentication required'))
      const thread = await getThread(redis, threadId)
      if (!thread || thread.userId !== apiKey.userId) {
        return reply.status(404).send(error(404, 'Thread not found'))
      }
      const msg = await getMessage(redis, threadId, id)
      if (!msg) return reply.status(404).send(error(404, 'Message not found'))
      return reply.send(msg)
    },
  )

  // GET /threads/:threadId/messages — 消息列表(分页)
  server.get(
    '/threads/:threadId/messages',
    { preHandler: [requireApiKeyAuth] },
    async (request, reply) => {
      const { threadId } = request.params as { threadId: string }
      const apiKey = request.apiKey
      if (!apiKey) return reply.status(401).send(error(401, 'API key authentication required'))
      const thread = await getThread(redis, threadId)
      if (!thread || thread.userId !== apiKey.userId) {
        return reply.status(404).send(error(404, 'Thread not found'))
      }
      const parsed = listQuerySchema.safeParse(request.query)
      if (!parsed.success) {
        return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
      }
      const { limit, after } = parsed.data
      const result = await listMessages(redis, threadId, limit, after)
      return reply.send(result)
    },
  )

  // ===========================================================================
  // 4. Runs CRUD
  // ===========================================================================

  // POST /threads/:threadId/runs — 启动 run(同步执行:queued → in_progress → completed/failed)
  server.post(
    '/threads/:threadId/runs',
    {
      schema: {
        description: '启动 Run(同步执行,内部调用 ai-service /api/llm/complete)',
        tags: ['Runs'],
        body: {
          type: 'object',
          properties: {
            assistant_id: { type: 'string' },
            model: { type: 'string' },
            instructions: { type: 'string' },
            metadata: { type: 'object' },
          },
          required: ['assistant_id'],
        },
      },
      preHandler: [requireApiKeyAuth],
    },
    async (request, reply) => {
      const { threadId } = request.params as { threadId: string }
      const parsed = createRunSchema.safeParse(request.body)
      if (!parsed.success) {
        return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
      }
      const apiKey = request.apiKey
      if (!apiKey) return reply.status(401).send(error(401, 'API key authentication required'))

      // 校验线程归属
      const thread = await getThread(redis, threadId)
      if (!thread || thread.userId !== apiKey.userId) {
        return reply.status(404).send(error(404, 'Thread not found'))
      }
      // 校验助手归属
      const assistant = await getAssistant(redis, parsed.data.assistant_id)
      if (!assistant || assistant.userId !== apiKey.userId) {
        return reply.status(404).send(error(404, 'Assistant not found'))
      }

      const { model, instructions, metadata } = parsed.data
      const nowMs = Date.now()
      const nowSec = Math.floor(nowMs / 1000)
      const runId = `run_${randomUUID()}`
      const effectiveModel = model ?? assistant.model
      const effectiveInstructions = instructions ?? assistant.instructions

      // 初始状态:queued → in_progress
      const run: Run = {
        id: runId,
        object: 'thread.run',
        created_at: nowSec,
        thread_id: threadId,
        status: 'in_progress',
        assistant_id: assistant.id,
        model: effectiveModel,
        instructions: effectiveInstructions,
        tools: assistant.tools,
        metadata: metadata ?? null,
        started_at: nowSec,
        completed_at: null,
        failed_at: null,
        usage: null,
        userId: apiKey.userId,
      }
      await storeRun(redis, run)

      // 收集线程消息构建 ai-service 请求
      const msgList = await listMessages(redis, threadId, MAX_LIMIT, undefined)
      const aiMessages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = []
      if (effectiveInstructions) {
        aiMessages.push({ role: 'system', content: effectiveInstructions })
      }
      for (const m of msgList.data) {
        const textValue = m.content[0]?.text.value ?? ''
        aiMessages.push({ role: m.role, content: textValue })
      }

      try {
        const resp = await aiServiceFetch(request, '/api/llm/complete', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ messages: aiMessages, model: effectiveModel }),
        })

        if (!resp.ok) {
          const errText = await resp.text().catch(() => '')
          const failedRun: Run = {
            ...run,
            status: 'failed',
            failed_at: Math.floor(Date.now() / 1000),
          }
          await updateRun(redis, failedRun)
          return reply
            .status(502)
            .send(error(502, `AI service unavailable (${resp.status}): ${errText.slice(0, 200)}`))
        }

        const data = (await resp.json()) as {
          content?: string
          usage?: { total_tokens?: number; prompt_tokens?: number; completion_tokens?: number }
          error?: boolean
          error_message?: string
        }

        if (data.error) {
          const failedRun: Run = {
            ...run,
            status: 'failed',
            failed_at: Math.floor(Date.now() / 1000),
          }
          await updateRun(redis, failedRun)
          return reply.status(502).send(error(502, data.error_message ?? 'AI service error'))
        }

        const promptTokens = data.usage?.prompt_tokens ?? 0
        const completionTokens = data.usage?.completion_tokens ?? 0
        const totalTokens = data.usage?.total_tokens ?? promptTokens + completionTokens

        // 创建 assistant 回复消息
        const assistantMsg: ThreadMessage = {
          id: `msg_${randomUUID()}`,
          object: 'thread.message',
          created_at: Math.floor(Date.now() / 1000),
          thread_id: threadId,
          role: 'assistant',
          content: [{ type: 'text', text: { value: data.content ?? '', annotations: [] } }],
          assistant_id: assistant.id,
          run_id: runId,
          metadata: null,
        }
        await storeMessage(redis, threadId, assistantMsg)

        // 创建 message_creation run step
        const step: RunStep = {
          id: `step_${randomUUID()}`,
          object: 'thread.run.step',
          created_at: Math.floor(Date.now() / 1000),
          run_id: runId,
          assistant_id: assistant.id,
          thread_id: threadId,
          type: 'message_creation',
          status: 'completed',
          step_details: {
            type: 'message_creation',
            message_creation: { message_id: assistantMsg.id },
          },
          last_error: null,
        }
        await storeRunStep(redis, step)

        // 完成 run
        const completedRun: Run = {
          ...run,
          status: 'completed',
          completed_at: Math.floor(Date.now() / 1000),
          usage: {
            prompt_tokens: promptTokens,
            completion_tokens: completionTokens,
            total_tokens: totalTokens,
          },
        }
        await updateRun(redis, completedRun)

        // 计费(异步,不阻塞响应)
        void recordCall({
          apiKeyId: apiKey.id,
          userId: apiKey.userId,
          model: effectiveModel,
          prompt: aiMessages.map((m) => m.content).join('\n'),
          response: data.content ?? '',
          promptTokens,
          completionTokens,
          totalTokens,
          latencyMs: Date.now() - nowMs,
          status: 'success',
          providerCode: modelToProviderCode(effectiveModel),
          clientIp: request.ip,
          httpStatus: resp.status,
          metadata: { endpoint: 'assistants.run', threadId, runId, assistantId: assistant.id },
        }).catch((e) => {
          console.error('[v1/runs] recordCall FAIL', e?.message || e)
        })

        return reply.send(toRunResponse(completedRun))
      } catch (e) {
        const failedRun: Run = {
          ...run,
          status: 'failed',
          failed_at: Math.floor(Date.now() / 1000),
        }
        await updateRun(redis, failedRun)
        return reply.status(503).send(error(503, (e as Error).message || 'AI service unavailable'))
      }
    },
  )

  // GET /threads/:threadId/runs/:id — 查询 run 状态
  server.get(
    '/threads/:threadId/runs/:id',
    { preHandler: [requireApiKeyAuth] },
    async (request, reply) => {
      const { threadId, id } = request.params as { threadId: string; id: string }
      const apiKey = request.apiKey
      if (!apiKey) return reply.status(401).send(error(401, 'API key authentication required'))
      const thread = await getThread(redis, threadId)
      if (!thread || thread.userId !== apiKey.userId) {
        return reply.status(404).send(error(404, 'Thread not found'))
      }
      const run = await getRun(redis, id)
      if (!run || run.thread_id !== threadId) {
        return reply.status(404).send(error(404, 'Run not found'))
      }
      return reply.send(toRunResponse(run))
    },
  )

  // POST /threads/:threadId/runs/:id — 修改 run(更新 metadata)
  server.post(
    '/threads/:threadId/runs/:id',
    {
      schema: {
        description: '修改 Run(更新 metadata)',
        tags: ['Runs'],
        body: {
          type: 'object',
          properties: { metadata: { type: ['object', 'null'] } },
        },
      },
      preHandler: [requireApiKeyAuth],
    },
    async (request, reply) => {
      const { threadId, id } = request.params as { threadId: string; id: string }
      const parsed = updateRunSchema.safeParse(request.body)
      if (!parsed.success) {
        return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
      }
      const apiKey = request.apiKey
      if (!apiKey) return reply.status(401).send(error(401, 'API key authentication required'))
      const thread = await getThread(redis, threadId)
      if (!thread || thread.userId !== apiKey.userId) {
        return reply.status(404).send(error(404, 'Thread not found'))
      }
      const existing = await getRun(redis, id)
      if (!existing || existing.thread_id !== threadId) {
        return reply.status(404).send(error(404, 'Run not found'))
      }
      const updated: Run = {
        ...existing,
        metadata: parsed.data.metadata !== undefined ? parsed.data.metadata : existing.metadata,
      }
      await updateRun(redis, updated)
      return reply.send(toRunResponse(updated))
    },
  )

  // GET /threads/:threadId/runs — run 列表(分页)
  server.get(
    '/threads/:threadId/runs',
    { preHandler: [requireApiKeyAuth] },
    async (request, reply) => {
      const { threadId } = request.params as { threadId: string }
      const apiKey = request.apiKey
      if (!apiKey) return reply.status(401).send(error(401, 'API key authentication required'))
      const thread = await getThread(redis, threadId)
      if (!thread || thread.userId !== apiKey.userId) {
        return reply.status(404).send(error(404, 'Thread not found'))
      }
      const parsed = listQuerySchema.safeParse(request.query)
      if (!parsed.success) {
        return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
      }
      const { limit, after } = parsed.data
      const result = await listRuns(redis, threadId, limit, after)
      return reply.send({
        ...result,
        data: result.data.map(toRunResponse),
      })
    },
  )

  // ===========================================================================
  // 5. Run Steps
  // ===========================================================================

  // GET /threads/:threadId/runs/:runId/steps — 查询 run 步骤
  server.get(
    '/threads/:threadId/runs/:runId/steps',
    { preHandler: [requireApiKeyAuth] },
    async (request, reply) => {
      const { threadId, runId } = request.params as { threadId: string; runId: string }
      const apiKey = request.apiKey
      if (!apiKey) return reply.status(401).send(error(401, 'API key authentication required'))
      const thread = await getThread(redis, threadId)
      if (!thread || thread.userId !== apiKey.userId) {
        return reply.status(404).send(error(404, 'Thread not found'))
      }
      const run = await getRun(redis, runId)
      if (!run || run.thread_id !== threadId) {
        return reply.status(404).send(error(404, 'Run not found'))
      }
      const parsed = listQuerySchema.safeParse(request.query)
      if (!parsed.success) {
        return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
      }
      const { limit, after } = parsed.data
      const result = await listRunSteps(redis, runId, limit, after)
      return reply.send(result)
    },
  )
}

export default v1Assistants
