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
 * 待主 agent 在 routes/index.ts 注册:
 *   import v1Batches from './v1-batches.js'
 *   server.register(v1Batches, { prefix: '/v1' })
 *
 * 响应格式:OpenAI/Anthropic 兼容(不套 { code, message, data } 壳,与 v1-public.ts 一致)。
 * 错误格式:{ code, message } + HTTP 状态码(400/401/404)。
 */
import type { FastifyPluginAsync, FastifyRequest } from 'fastify'
import type { Redis } from 'ioredis'
import { randomUUID } from 'node:crypto'
import { z } from 'zod'
import { requireApiKeyAuth } from '../plugins/api-key-auth.js'
import { error } from '../utils/response.js'
import { recordCall, modelToProviderCode } from '../services/relay-billing-service.js'

// TODO(batch-queue): ../queue/index.js 队列模块尚未创建,当前用 setTimeout 模拟异步处理。
// 主 agent 创建 src/queue/index.js(BullMQ Queue + Worker)后,替换 setTimeout 为:
//   import { batchQueue } from '../queue/index.js'
//   await batchQueue.add('process-batch', { taskId, type: 'openai' | 'anthropic', apiKeyId, userId })
// Worker 中实现:逐请求调用上游 LLM → recordCall(metadata.discount=0.5)→ 更新状态/结果。

/** 鉴权后注入 request 的 API Key 上下文(与 v1-public.ts ApiKeyContext 结构一致) */
interface ApiKeyContext {
  id: string
  userId: string
  key: string
  permissions: string[]
  rateLimit: number
}

// =============================================================================
// 类型定义(OpenAI/Anthropic 兼容,inline 定义避免污染 @ihui/types)
// =============================================================================

/** 任务状态机:validating → in_progress → finalizing → completed/failed/expired/cancelled */
type BatchTaskStatus =
  'validating' | 'in_progress' | 'finalizing' | 'completed' | 'failed' | 'expired' | 'cancelled'

/** OpenAI Batch 支持的端点 */
type OpenAIEndpoint = '/v1/chat/completions' | '/v1/embeddings' | '/v1/completions'

/** OpenAI Batch 请求计数 */
interface BatchRequestCounts {
  total: number
  completed: number
  failed: number
}

/** OpenAI Batch 任务(完整元数据,存 Redis;_ 前缀字段为内部字段,不暴露给客户端) */
interface OpenAIBatchTask {
  id: string
  object: 'batch'
  endpoint: OpenAIEndpoint
  input_file_id: string
  completion_window: '24h'
  status: BatchTaskStatus
  output_file_id: string | null
  error_file_id: string | null
  created_at: number
  in_progress_at: number | null
  expires_at: number | null
  finalizing_at: number | null
  completed_at: number | null
  failed_at: number | null
  expired_at: number | null
  cancelled_at: number | null
  request_counts: BatchRequestCounts | null
  metadata: Record<string, unknown> | null
  /** 内部字段:API Key ID + User ID(异步计费用) */
  _apiKeyId: string
  _userId: string
  /** 内部字段:输出结果 JSONL(生产环境应存对象存储,此处简化存 Redis) */
  _outputContent: string | null
}

/** Anthropic Batch 请求计数 */
interface AnthropicRequestCounts {
  processing: number
  succeeded: number
  errored: number
  canceled: number
  expired: number
}

/** Anthropic Batch 单个结果 */
interface AnthropicBatchResultItem {
  custom_id: string
  result: {
    type: 'succeeded' | 'errored' | 'canceled' | 'expired'
    message?: unknown
    error?: { type: string; message: string }
  }
}

/** Anthropic Batch 任务(完整元数据,存 Redis) */
interface AnthropicBatchTask {
  id: string
  type: 'message_batch'
  status: BatchTaskStatus
  created_at: string
  expires_at: string
  archived_at: string | null
  cancel_initiated_at: string | null
  processing_started_at: string | null
  ended_at: string | null
  request_counts: AnthropicRequestCounts | null
  results: AnthropicBatchResultItem[]
  /** 内部字段 */
  _apiKeyId: string
  _userId: string
  /** 内部字段:原始请求数组(Worker 逐请求处理用) */
  _requests: AnthropicBatchRequestItem[]
}

// =============================================================================
// Zod schemas(请求体校验)+ 推断类型
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

/** Anthropic Batch 请求项(Zod 推断类型,含 passthrough 的 [k: string]: unknown) */
type AnthropicBatchRequestItem = z.infer<typeof anthropicBatchRequestSchema>

// =============================================================================
// Redis 存储辅助(key = `batch:task:<taskId>`,TTL 30 天)
// =============================================================================

const BATCH_TTL_SECONDS = 30 * 24 * 60 * 60 // 30 天 = 2,592,000 秒
const BATCH_KEY_PREFIX = 'batch:task:'

/** 存储任务元数据到 Redis(TTL 30 天) */
async function saveTask(redis: Redis, task: OpenAIBatchTask | AnthropicBatchTask): Promise<void> {
  await redis.set(BATCH_KEY_PREFIX + task.id, JSON.stringify(task), 'EX', BATCH_TTL_SECONDS)
}

/** 从 Redis 读取任务元数据(不存在返回 null) */
async function getTask<T extends OpenAIBatchTask | AnthropicBatchTask>(
  redis: Redis,
  taskId: string,
): Promise<T | null> {
  const raw = await redis.get(BATCH_KEY_PREFIX + taskId)
  if (!raw) return null
  try {
    return JSON.parse(raw) as T
  } catch {
    return null
  }
}

/**
 * 列出指定 API Key 的任务(SCAN + 过滤,按创建时间降序)。
 * @param filter 类型过滤函数(区分 OpenAI/Anthropic)
 * @param limit 分页大小
 * @param afterId 游标(上一页最后一条任务 ID,返回此 ID 之后的任务)
 */
async function listTasksByUser<T extends OpenAIBatchTask | AnthropicBatchTask>(
  redis: Redis,
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
// 异步处理模拟(setTimeout,待替换为 BullMQ Worker)
// =============================================================================

/** setTimeout Promise 化(用于 async/await 链式状态转换) */
function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * 模拟 OpenAI Batch 异步处理:validating → in_progress → finalizing → completed。
 *
 * TODO(batch-queue): 替换为 BullMQ Worker:
 *   1. 读取 input_file_id 对应的 JSONL 文件(每行一个 OpenAI 请求)
 *   2. 逐行调用上游 LLM(chat/completions、embeddings、completions)
 *   3. 每个请求调用 recordCall({ metadata: { batch: true, discount: 0.5, batchId } })
 *   4. 汇总结果写入 output JSONL
 *   5. 更新任务状态 + request_counts
 */
async function simulateOpenAIBatchProcessing(redis: Redis, task: OpenAIBatchTask): Promise<void> {
  try {
    // validating → in_progress
    await delay(100)
    let current = await getTask<OpenAIBatchTask>(redis, task.id)
    if (!current || current.status !== 'validating') return
    current.status = 'in_progress'
    current.in_progress_at = Date.now()
    await saveTask(redis, current)

    // in_progress → finalizing
    await delay(200)
    current = await getTask<OpenAIBatchTask>(redis, task.id)
    if (!current || current.status !== 'in_progress') return
    current.status = 'finalizing'
    current.finalizing_at = Date.now()
    await saveTask(redis, current)

    // finalizing → completed
    await delay(300)
    current = await getTask<OpenAIBatchTask>(redis, task.id)
    if (!current || current.status !== 'finalizing') return
    current.status = 'completed'
    current.completed_at = Date.now()
    current.output_file_id = `batch_output_${current.id}`
    current.request_counts = { total: 1, completed: 1, failed: 0 }
    // 模拟输出 JSONL(每行一个 JSON 对象:id + custom_id + response)
    current._outputContent = JSON.stringify({
      id: `batch_req_${randomUUID()}`,
      custom_id: 'request-1',
      response: {
        status_code: 200,
        body: {
          id: `chatcmpl-${randomUUID()}`,
          object: 'chat.completion',
          choices: [],
        },
      },
    })
    await saveTask(redis, current)

    // 计费:批量任务按 50% 折扣,recordCall 传入 metadata { batch: true, discount: 0.5 }
    // TODO(batch-billing): 真实 Worker 中,每个请求调用上游后应单独 recordCall(含真实 token 数)。
    // 当前模拟:汇总记录一次,0 tokens(无真实 LLM 调用,不产生实际扣费)。
    // TODO(billing-discount): recordCall 当前不支持 metadata.discount 自动折扣,
    //   主 agent 需在 relay-billing-service.ts 的 recordCall 中添加:
    //   if (input.metadata?.discount) { costCentsToDeduct = Math.round(costCentsToDeduct * (1 - input.metadata.discount)) }
    void recordCall({
      apiKeyId: current._apiKeyId,
      userId: current._userId,
      model: 'batch-processing',
      prompt: `batch:${current.id}`,
      response: null,
      promptTokens: 0,
      completionTokens: 0,
      totalTokens: 0,
      latencyMs: 0,
      status: 'success',
      providerCode: 'openai',
      clientIp: '',
      metadata: { batch: true, discount: 0.5, batchId: current.id, simulated: true },
    }).catch((e: unknown) => {
      console.error('[batch:openai] recordCall FAIL', (e as Error)?.message || e)
    })
  } catch (e) {
    console.error('[batch:openai] processing FAIL', (e as Error)?.message || e)
  }
}

/**
 * 模拟 Anthropic Messages Batch 异步处理。
 *
 * TODO(batch-queue): 替换为 BullMQ Worker,逐请求调用 Anthropic Messages API。
 */
async function simulateAnthropicBatchProcessing(
  redis: Redis,
  task: AnthropicBatchTask,
): Promise<void> {
  try {
    // validating → in_progress
    await delay(100)
    let current = await getTask<AnthropicBatchTask>(redis, task.id)
    if (!current || current.status !== 'validating') return
    current.status = 'in_progress'
    current.processing_started_at = new Date().toISOString()
    await saveTask(redis, current)

    // in_progress → finalizing
    await delay(200)
    current = await getTask<AnthropicBatchTask>(redis, task.id)
    if (!current || current.status !== 'in_progress') return
    current.status = 'finalizing'
    await saveTask(redis, current)

    // finalizing → completed
    await delay(200)
    current = await getTask<AnthropicBatchTask>(redis, task.id)
    if (!current || current.status !== 'finalizing') return
    current.status = 'completed'
    current.ended_at = new Date().toISOString()
    current.request_counts = {
      processing: 0,
      succeeded: current._requests.length,
      errored: 0,
      canceled: 0,
      expired: 0,
    }
    // 模拟结果(每个请求一个 succeeded 结果)
    current.results = current._requests.map((req) => ({
      custom_id: req.custom_id,
      result: {
        type: 'succeeded' as const,
        message: {
          id: `msg_${randomUUID()}`,
          type: 'message',
          role: 'assistant',
          model: req.params.model,
          content: [{ type: 'text', text: 'Simulated batch response' }],
          stop_reason: 'end_turn',
          usage: { input_tokens: 0, output_tokens: 0 },
        },
      },
    }))
    await saveTask(redis, current)

    // 计费:批量任务按 50% 折扣,recordCall 传入 metadata { batch: true, discount: 0.5 }
    // TODO(batch-billing): 真实 Worker 中,每个请求调用上游后应单独 recordCall(含真实 token 数)。
    // 当前模拟:汇总记录一次,0 tokens(无真实 LLM 调用,不产生实际扣费)。
    const firstModel = current._requests[0]?.params.model ?? 'claude-3-5-sonnet-20241022'
    void recordCall({
      apiKeyId: current._apiKeyId,
      userId: current._userId,
      model: firstModel,
      prompt: `batch:${current.id}`,
      response: null,
      promptTokens: 0,
      completionTokens: 0,
      totalTokens: 0,
      latencyMs: 0,
      status: 'success',
      providerCode: modelToProviderCode(firstModel),
      clientIp: '',
      metadata: { batch: true, discount: 0.5, batchId: current.id, simulated: true },
    }).catch((e: unknown) => {
      console.error('[batch:anthropic] recordCall FAIL', (e as Error)?.message || e)
    })
  } catch (e) {
    console.error('[batch:anthropic] processing FAIL', (e as Error)?.message || e)
  }
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

      await saveTask(redis, task)
      // 启动异步处理(模拟,待替换为 BullMQ)
      void simulateOpenAIBatchProcessing(redis, task)

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

      await saveTask(redis, task)
      void simulateAnthropicBatchProcessing(redis, task)

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
