/**
 * /v1/batch + /v1/batches + /v1/messages/batches 路由(2026-07-31 立)。
 *
 * OpenAI Batch API + Anthropic Messages Batches API 兼容端点。
 * 批量任务按 50% 折扣计费,异步处理。
 *
 * 端点清单(8 个):
 *   OpenAI(5):
 *     POST   /batch                创建批量任务(input_file_id + endpoint + completion_window)
 *     GET    /batch/:id            查询任务状态
 *     POST   /batch/:id/cancel     取消任务
 *     GET    /batch/:id/content    下载结果(JSONL)
 *     GET    /batches              列出任务(分页 limit/after)
 *   Anthropic(3):
 *     POST   /messages/batches     创建批量任务(requests 数组)
 *     GET    /messages/batches/:id 查询状态
 *     GET    /messages/batches/:id/results 下载结果
 *
 * 鉴权:复用 plugins/api-key-auth.ts 的 requireApiKeyAuth(Bearer token + developer_api_keys 表)。
 * 存储:任务元数据存 Redis(key = `batch:task:<taskId>`,TTL 30 天)。
 * 计费:批量任务按 50% 折扣,recordCall 传入 metadata { batch: true, discount: 0.5 }。
 *
 * 异步处理(2026-08-01 立):创建任务后通过 addBatchTask 入队 BullMQ batch-queue,
 * workers/batch-worker.ts 消费队列逐请求调用 ai-service /api/llm/complete,
 * 每条调用 recordCall(metadata.discount=0.5)→ 更新状态/结果。
 *
 * 待主 agent 在 routes/index.ts 注册:
 *   import v1Batches from './v1-batches.js'
 *   server.register(v1Batches, { prefix: '/v1' })
 *
 * 响应格式:OpenAI/Anthropic 兼容(不套 { code, message, data } 壳,与 v1-public.ts 一致)。
 * 错误格式:{ code, message } + HTTP 状态码(400/401/404)。
 */
import type { FastifyPluginAsync, FastifyRequest } from 'fastify'
import { randomUUID } from 'node:crypto'
import { z } from 'zod'
import { requireApiKeyAuth } from '../plugins/api-key-auth.js'
import { error } from '../utils/response.js'
import {
  type BatchTaskStatus,
  type OpenAIBatchTask,
  type AnthropicBatchTask,
  type AnthropicBatchRequestItem,
  BATCH_KEY_PREFIX,
  saveTask,
  getTask,
  addBatchTask,
} from '../queue/batch-queue.js'

/** 鉴权后注入 request 的 API Key 上下文(与 v1-public.ts ApiKeyContext 结构一致) */
interface ApiKeyContext {
  id: string
  userId: string
  key: string
  permissions: string[]
  rateLimit: number
}

// =============================================================================
// Zod schemas(请求体校验)
// =============================================================================

const openAICreateBatchSchema = z.object({
  input_file_id: z.string().min(1),
  endpoint: z.enum(['/v1/chat/completions', '/v1/embeddings', '/v1/completions']),
  completion_window: z.literal('24h').default('24h'),
  metadata: z.record(z.string(), z.unknown()).optional(),
})

const anthropicMessageSchema = z.object({
  role: z.enum(['user', 'assistant']),
  content: z.union([z.string(), z.array(z.record(z.string(), z.unknown()))]),
})

const anthropicBatchRequestSchema = z.object({
  custom_id: z.string().min(1).max(500),
  params: z
    .object({
      model: z.string().min(1),
      max_tokens: z.number().int().positive(),
      messages: z.array(anthropicMessageSchema).min(1),
      system: z.union([z.string(), z.array(z.record(z.string(), z.unknown()))]).optional(),
      temperature: z.number().min(0).max(1).optional(),
      top_p: z.number().min(0).max(1).optional(),
      top_k: z.number().int().positive().optional(),
      stop_sequences: z.array(z.string()).optional(),
    })
    .passthrough(),
})

const anthropicCreateBatchSchema = z.object({
  requests: z.array(anthropicBatchRequestSchema).min(1).max(100000),
})

// =============================================================================
// 列表查询辅助(SCAN + 过滤,按创建时间降序)
// =============================================================================

/**
 * 列出指定 API Key 的任务(SCAN + 过滤,按创建时间降序)。
 * @param filter 类型过滤函数(区分 OpenAI/Anthropic)
 * @param limit 分页大小
 * @param afterId 游标(上一页最后一条任务 ID,返回此 ID 之后的任务)
 */
async function listTasksByUser<T extends OpenAIBatchTask | AnthropicBatchTask>(
  redis: Parameters<FastifyPluginAsync>[0]['redis'],
  apiKeyId: string,
  filter: (task: T) => boolean,
  limit: number,
  afterId: string | null,
): Promise<T[]> {
  const results: T[] = []
  let cursor = '0'
  do {
    const [nextCursor, keys] = await redis.scan(
      cursor,
      'MATCH',
      BATCH_KEY_PREFIX + '*',
      'COUNT',
      100,
    )
    cursor = nextCursor
    if (keys.length === 0) continue
    const values = await redis.mget(...keys)
    for (const val of values) {
      if (!val) continue
      try {
        const task = JSON.parse(val) as T
        if (task._apiKeyId !== apiKeyId) continue
        if (!filter(task)) continue
        results.push(task)
      } catch {
        // skip malformed JSON
      }
    }
  } while (cursor !== '0' && results.length < limit * 2)

  // 排序:按创建时间降序(OpenAI 用 number 时间戳,Anthropic 用 ISO string,统一转 number)
  results.sort((a, b) => {
    const ta = typeof a.created_at === 'number' ? a.created_at : Date.parse(a.created_at)
    const tb = typeof b.created_at === 'number' ? b.created_at : Date.parse(b.created_at)
    return tb - ta
  })

  // 分页:afterId 之后的任务
  let startIdx = 0
  if (afterId) {
    const idx = results.findIndex((t) => t.id === afterId)
    if (idx >= 0) startIdx = idx + 1
  }
  return results.slice(startIdx, startIdx + limit)
}

// =============================================================================
// 响应构建辅助(剥离内部字段,返回客户端可见结构)
// =============================================================================

/** 剥离 OpenAI Batch 任务的内部字段 */
function toOpenAIBatchResponse(task: OpenAIBatchTask): Record<string, unknown> {
  return {
    id: task.id,
    object: task.object,
    endpoint: task.endpoint,
    input_file_id: task.input_file_id,
    completion_window: task.completion_window,
    status: task.status,
    output_file_id: task.output_file_id,
    error_file_id: task.error_file_id,
    created_at: task.created_at,
    in_progress_at: task.in_progress_at,
    expires_at: task.expires_at,
    finalizing_at: task.finalizing_at,
    completed_at: task.completed_at,
    failed_at: task.failed_at,
    expired_at: task.expired_at,
    cancelled_at: task.cancelled_at,
    request_counts: task.request_counts,
    metadata: task.metadata,
  }
}

/** 剥离 Anthropic Batch 任务的内部字段(不含 results,results 仅 /results 端点返回) */
function toAnthropicBatchResponse(task: AnthropicBatchTask): Record<string, unknown> {
  return {
    id: task.id,
    type: task.type,
    status: task.status,
    created_at: task.created_at,
    expires_at: task.expires_at,
    archived_at: task.archived_at,
    cancel_initiated_at: task.cancel_initiated_at,
    processing_started_at: task.processing_started_at,
    ended_at: task.ended_at,
    request_counts: task.request_counts,
  }
}

// =============================================================================
// 路由插件
// =============================================================================

const v1Batches: FastifyPluginAsync = async (server) => {
  const redis = server.redis
  const queueConnection = server.redisForQueue

  // ===== OpenAI Batch API(5 个端点)=====

  // 1. POST /batch — 创建批量任务
  server.post(
    '/batch',
    {
      schema: {
        description: 'OpenAI Batch API — 创建批量任务(50% 折扣计费,异步处理)',
        tags: ['Batch'],
        body: {
          type: 'object',
          properties: {
            input_file_id: { type: 'string', description: '已上传的输入文件 ID(JSONL 格式)' },
            endpoint: {
              type: 'string',
              enum: ['/v1/chat/completions', '/v1/embeddings', '/v1/completions'],
            },
            completion_window: { type: 'string', enum: ['24h'], default: '24h' },
            metadata: { type: 'object', additionalProperties: true },
          },
          required: ['input_file_id', 'endpoint'],
        },
      },
      preHandler: [requireApiKeyAuth],
    },
    async (request, reply) => {
      const parsed = openAICreateBatchSchema.safeParse(request.body)
      if (!parsed.success) {
        return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
      }
      const { input_file_id, endpoint, completion_window, metadata } = parsed.data
      const apiKey = (request as FastifyRequest & { apiKey?: ApiKeyContext }).apiKey
      if (!apiKey) {
        return reply.status(401).send(error(401, 'API key authentication required'))
      }

      const now = Date.now()
      const taskId = `batch_${randomUUID()}`
      const task: OpenAIBatchTask = {
        id: taskId,
        object: 'batch',
        endpoint,
        input_file_id,
        completion_window,
        status: 'validating',
        output_file_id: null,
        error_file_id: null,
        created_at: now,
        in_progress_at: null,
        expires_at: now + 24 * 60 * 60 * 1000, // 24h
        finalizing_at: null,
        completed_at: null,
        failed_at: null,
        expired_at: null,
        cancelled_at: null,
        request_counts: null,
        metadata: metadata ?? null,
        _apiKeyId: apiKey.id,
        _userId: apiKey.userId,
        _outputContent: null,
      }

      // 入队 BullMQ batch-queue(addBatchTask 内部保存任务到 Redis + 入队)
      await addBatchTask(redis, queueConnection, task, 'openai')

      return reply.send(toOpenAIBatchResponse(task))
    },
  )

  // 2. GET /batch/:id — 查询任务状态
  server.get(
    '/batch/:id',
    {
      schema: { description: 'OpenAI Batch — 查询任务状态', tags: ['Batch'] },
      preHandler: [requireApiKeyAuth],
    },
    async (request, reply) => {
      const { id } = request.params as { id: string }
      const task = await getTask<OpenAIBatchTask>(redis, id)
      if (!task) {
        return reply.status(404).send(error(404, 'Batch not found'))
      }
      return reply.send(toOpenAIBatchResponse(task))
    },
  )

  // 3. POST /batch/:id/cancel — 取消任务
  server.post(
    '/batch/:id/cancel',
    {
      schema: { description: 'OpenAI Batch — 取消任务', tags: ['Batch'] },
      preHandler: [requireApiKeyAuth],
    },
    async (request, reply) => {
      const { id } = request.params as { id: string }
      const task = await getTask<OpenAIBatchTask>(redis, id)
      if (!task) {
        return reply.status(404).send(error(404, 'Batch not found'))
      }
      const terminalStatuses: BatchTaskStatus[] = ['completed', 'failed', 'cancelled', 'expired']
      if (terminalStatuses.includes(task.status)) {
        return reply
          .status(400)
          .send(error(400, `Cannot cancel batch in terminal status: ${task.status}`))
      }
      task.status = 'cancelled'
      task.cancelled_at = Date.now()
      await saveTask(redis, task)
      return reply.send(toOpenAIBatchResponse(task))
    },
  )

  // 4. GET /batch/:id/content — 下载结果(JSONL)
  server.get(
    '/batch/:id/content',
    {
      schema: { description: 'OpenAI Batch — 下载结果(JSONL)', tags: ['Batch'] },
      preHandler: [requireApiKeyAuth],
    },
    async (request, reply) => {
      const { id } = request.params as { id: string }
      const task = await getTask<OpenAIBatchTask>(redis, id)
      if (!task) {
        return reply.status(404).send(error(404, 'Batch not found'))
      }
      if (task.status !== 'completed') {
        return reply
          .status(400)
          .send(
            error(
              400,
              `Batch content available only for completed batches (current: ${task.status})`,
            ),
          )
      }
      const content = task._outputContent ?? ''
      reply.header('Content-Type', 'application/jsonl')
      return reply.send(content)
    },
  )

  // 5. GET /batches — 列出任务(分页 limit/after)
  server.get(
    '/batches',
    {
      schema: {
        description: 'OpenAI Batch — 列出任务(分页)',
        tags: ['Batch'],
        querystring: {
          type: 'object',
          properties: {
            limit: { type: 'integer', minimum: 1, maximum: 100, default: 20 },
            after: { type: 'string', description: '游标(上一页最后一条任务 ID)' },
          },
        },
      },
      preHandler: [requireApiKeyAuth],
    },
    async (request, reply) => {
      const query = request.query as { limit?: number; after?: string }
      const limit = Math.min(100, Math.max(1, query.limit ?? 20))
      const after = query.after ?? null
      const apiKey = (request as FastifyRequest & { apiKey?: ApiKeyContext }).apiKey
      if (!apiKey) {
        return reply.status(401).send(error(401, 'API key authentication required'))
      }

      const tasks = await listTasksByUser<OpenAIBatchTask>(
        redis,
        apiKey.id,
        (t) => t.object === 'batch',
        limit,
        after,
      )
      const data = tasks.map(toOpenAIBatchResponse)
      return reply.send({
        object: 'list',
        data,
        has_more: data.length === limit,
        first_id: (data[0]?.id as string | undefined) ?? null,
        last_id: (data[data.length - 1]?.id as string | undefined) ?? null,
      })
    },
  )

  // ===== Anthropic Messages Batches API(3 个端点)=====

  // 6. POST /messages/batches — 创建批量任务
  server.post(
    '/messages/batches',
    {
      schema: {
        description: 'Anthropic Messages Batches — 创建批量任务(50% 折扣计费,异步处理)',
        tags: ['Batch'],
        body: {
          type: 'object',
          properties: {
            requests: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  custom_id: { type: 'string', maxLength: 500 },
                  params: {
                    type: 'object',
                    properties: {
                      model: { type: 'string' },
                      max_tokens: { type: 'integer' },
                      messages: { type: 'array' },
                    },
                    required: ['model', 'max_tokens', 'messages'],
                  },
                },
                required: ['custom_id', 'params'],
              },
            },
          },
          required: ['requests'],
        },
      },
      preHandler: [requireApiKeyAuth],
    },
    async (request, reply) => {
      const parsed = anthropicCreateBatchSchema.safeParse(request.body)
      if (!parsed.success) {
        return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
      }
      const { requests } = parsed.data
      const apiKey = (request as FastifyRequest & { apiKey?: ApiKeyContext }).apiKey
      if (!apiKey) {
        return reply.status(401).send(error(401, 'API key authentication required'))
      }

      const now = new Date()
      const expires = new Date(now.getTime() + 24 * 60 * 60 * 1000)
      const taskId = `msgbatch_${randomUUID()}`
      const task: AnthropicBatchTask = {
        id: taskId,
        type: 'message_batch',
        status: 'validating',
        created_at: now.toISOString(),
        expires_at: expires.toISOString(),
        archived_at: null,
        cancel_initiated_at: null,
        processing_started_at: null,
        ended_at: null,
        request_counts: null,
        results: [],
        _apiKeyId: apiKey.id,
        _userId: apiKey.userId,
        _requests: requests as AnthropicBatchRequestItem[],
      }

      // 入队 BullMQ batch-queue(addBatchTask 内部保存任务到 Redis + 入队)
      await addBatchTask(redis, queueConnection, task, 'anthropic')

      return reply.send(toAnthropicBatchResponse(task))
    },
  )

  // 7. GET /messages/batches/:id — 查询状态
  server.get(
    '/messages/batches/:id',
    {
      schema: { description: 'Anthropic Messages Batches — 查询状态', tags: ['Batch'] },
      preHandler: [requireApiKeyAuth],
    },
    async (request, reply) => {
      const { id } = request.params as { id: string }
      const task = await getTask<AnthropicBatchTask>(redis, id)
      if (!task) {
        return reply.status(404).send(error(404, 'Message batch not found'))
      }
      return reply.send(toAnthropicBatchResponse(task))
    },
  )

  // 8. GET /messages/batches/:id/results — 下载结果
  server.get(
    '/messages/batches/:id/results',
    {
      schema: { description: 'Anthropic Messages Batches — 下载结果(JSONL)', tags: ['Batch'] },
      preHandler: [requireApiKeyAuth],
    },
    async (request, reply) => {
      const { id } = request.params as { id: string }
      const task = await getTask<AnthropicBatchTask>(redis, id)
      if (!task) {
        return reply.status(404).send(error(404, 'Message batch not found'))
      }
      const endedStatuses: BatchTaskStatus[] = ['completed', 'failed', 'expired', 'cancelled']
      if (!endedStatuses.includes(task.status)) {
        return reply
          .status(400)
          .send(error(400, `Results available only for ended batches (current: ${task.status})`))
      }
      // Anthropic 返回 JSONL(每行一个 result 对象)
      const lines = task.results.map((r) => JSON.stringify(r))
      reply.header('Content-Type', 'application/jsonl')
      return reply.send(lines.join('\n'))
    },
  )
}

export default v1Batches
