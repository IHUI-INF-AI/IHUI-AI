/**
 * Batch Queue 模块(2026-08-01 立)。
 *
 * BullMQ Queue 生产者 + Redis 任务存储,与 workers/batch-worker.ts(消费者)配对。
 *
 * 职责:
 * - 定义批量任务类型(OpenAI/Anthropic 兼容,从 v1-batches.ts 提取共享)
 * - Redis CRUD(key = `batch:task:<taskId>`,TTL 30 天)
 * - 入队 addBatchTask(redis 保存任务 + batchQueue.add)
 * - 输入文件存取(OpenAI JSONL,key = `batch:input:<fileId>`)
 *
 * 设计要点:
 * - 类型 + Redis 函数从 v1-batches.ts 移入此模块,避免 worker → route 循环依赖
 * - Queue 连接用 server.redisForQueue(BullMQ 专用),任务数据用 server.redis
 * - 队列 job payload 最小化(只带 taskId + type),完整任务数据从 Redis 读取
 */
import type { Redis } from 'ioredis'
import { getBatchQueue } from './index.js'

// =============================================================================
// 常量
// =============================================================================

export const BATCH_QUEUE_NAME = 'batch-queue'

/** Redis 任务 key 前缀(key = `batch:task:<taskId>`,TTL 30 天) */
export const BATCH_KEY_PREFIX = 'batch:task:'

/** Redis 输入文件 key 前缀(key = `batch:input:<fileId>`,TTL 30 天) */
export const BATCH_INPUT_KEY_PREFIX = 'batch:input:'

export const BATCH_TTL_SECONDS = 30 * 24 * 60 * 60 // 30 天 = 2,592,000 秒

// =============================================================================
// 类型定义(OpenAI/Anthropic 兼容,inline 定义避免污染 @ihui/types)
// =============================================================================

/** 任务状态机:validating → in_progress → finalizing → completed/failed/expired/cancelled */
export type BatchTaskStatus =
  'validating' | 'in_progress' | 'finalizing' | 'completed' | 'failed' | 'expired' | 'cancelled'

/** OpenAI Batch 支持的端点 */
export type OpenAIEndpoint = '/v1/chat/completions' | '/v1/embeddings' | '/v1/completions'

/** OpenAI Batch 请求计数 */
export interface BatchRequestCounts {
  total: number
  completed: number
  failed: number
}

/** OpenAI Batch 任务(完整元数据,存 Redis;_ 前缀字段为内部字段,不暴露给客户端) */
export interface OpenAIBatchTask {
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
  /** 内部字段:错误信息(failed 状态时填充) */
  _errorMessage?: string | null
}

/** Anthropic Batch 请求计数 */
export interface AnthropicRequestCounts {
  processing: number
  succeeded: number
  errored: number
  canceled: number
  expired: number
}

/** Anthropic Batch 单个结果 */
export interface AnthropicBatchResultItem {
  custom_id: string
  result: {
    type: 'succeeded' | 'errored' | 'canceled' | 'expired'
    message?: unknown
    error?: { type: string; message: string }
  }
}

/** Anthropic 消息(role + content,content 支持 string 或 content block 数组) */
export interface AnthropicMessage {
  role: 'user' | 'assistant'
  content: string | Record<string, unknown>[]
}

/**
 * Anthropic Batch 请求项(与 v1-batches.ts 的 Zod schema 结构一致)。
 * params 用 passthrough(允许额外字段),因此带 index signature。
 */
export interface AnthropicBatchRequestItem {
  custom_id: string
  params: {
    model: string
    max_tokens: number
    messages: AnthropicMessage[]
    system?: string | Record<string, unknown>[]
    temperature?: number
    top_p?: number
    top_k?: number
    stop_sequences?: string[]
    [k: string]: unknown
  }
}

/** Anthropic Batch 任务(完整元数据,存 Redis) */
export interface AnthropicBatchTask {
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
  /** 内部字段:错误信息(failed 状态时填充) */
  _errorMessage?: string | null
}

/** Batch 任务联合类型 */
export type BatchTask = OpenAIBatchTask | AnthropicBatchTask

// =============================================================================
// Queue Job Payload(最小化,完整数据从 Redis 读取)
// =============================================================================

/** BullMQ job 数据(只带 taskId + type,Worker 从 Redis 读取完整任务) */
export interface BatchJobData {
  taskId: string
  type: 'openai' | 'anthropic'
}

// =============================================================================
// Redis 存储辅助
// =============================================================================

/** 存储任务元数据到 Redis(TTL 30 天) */
export async function saveTask(redis: Redis, task: BatchTask): Promise<void> {
  await redis.set(BATCH_KEY_PREFIX + task.id, JSON.stringify(task), 'EX', BATCH_TTL_SECONDS)
}

/** 从 Redis 读取任务元数据(不存在返回 null) */
export async function getTask<T extends BatchTask>(
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

/** updateBatchTaskStatus 的 patch 参数(只含可更新字段,避免 OpenAI/Anthropic 交集产生 never) */
export interface BatchTaskPatch {
  request_counts?: BatchRequestCounts | AnthropicRequestCounts | null
  _outputContent?: string | null
  results?: AnthropicBatchResultItem[]
  _errorMessage?: string | null
  output_file_id?: string | null
}

/**
 * 更新任务状态(读取 → 修改 status + 时间戳 → 写回)。
 * @param redis Redis 客户端
 * @param taskId 任务 ID
 * @param status 新状态
 * @param patch 额外字段更新(如 request_counts / _outputContent / results / _errorMessage)
 */
export async function updateBatchTaskStatus(
  redis: Redis,
  taskId: string,
  status: BatchTaskStatus,
  patch?: BatchTaskPatch,
): Promise<BatchTask | null> {
  const raw = await redis.get(BATCH_KEY_PREFIX + taskId)
  if (!raw) return null
  try {
    const task = JSON.parse(raw) as BatchTask
    task.status = status
    // 按状态更新时间戳(OpenAI 用 number,Anthropic 用 ISO string)
    const now = Date.now()
    const nowIso = new Date(now).toISOString()
    const isOpenAI = 'object' in task
    if (isOpenAI) {
      const t = task as OpenAIBatchTask
      if (status === 'in_progress') t.in_progress_at = now
      if (status === 'finalizing') t.finalizing_at = now
      if (status === 'completed') {
        t.completed_at = now
        t.output_file_id = t.output_file_id ?? `batch_output_${t.id}`
      }
      if (status === 'failed') t.failed_at = now
      if (status === 'cancelled') t.cancelled_at = now
      if (status === 'expired') t.expired_at = now
    } else {
      const t = task as AnthropicBatchTask
      if (status === 'in_progress') t.processing_started_at = nowIso
      if (
        status === 'completed' ||
        status === 'failed' ||
        status === 'expired' ||
        status === 'cancelled'
      ) {
        t.ended_at = nowIso
      }
      if (status === 'cancelled') t.cancel_initiated_at = nowIso
    }
    // 应用额外字段
    if (patch) {
      Object.assign(task, patch)
    }
    await saveTask(redis, task)
    return task
  } catch {
    return null
  }
}

/**
 * 从 Redis 读取任务输出(JSONL 字符串)。
 * OpenAI: 返回 _outputContent(JSONL,每行一个响应对象)。
 * Anthropic: 返回 results 序列化为 JSONL。
 */
export async function getBatchTaskOutput(redis: Redis, taskId: string): Promise<string | null> {
  const raw = await redis.get(BATCH_KEY_PREFIX + taskId)
  if (!raw) return null
  try {
    const task = JSON.parse(raw) as BatchTask
    if ('object' in task) {
      return (task as OpenAIBatchTask)._outputContent
    }
    const anthropicTask = task as AnthropicBatchTask
    if (anthropicTask.results.length === 0) return null
    return anthropicTask.results.map((r) => JSON.stringify(r)).join('\n')
  } catch {
    return null
  }
}

// =============================================================================
// 输入文件存取(OpenAI Batch JSONL,未来文件上传端点使用)
// =============================================================================

/** 存储 OpenAI Batch 输入文件内容到 Redis(TTL 30 天) */
export async function saveBatchInput(redis: Redis, fileId: string, content: string): Promise<void> {
  await redis.set(BATCH_INPUT_KEY_PREFIX + fileId, content, 'EX', BATCH_TTL_SECONDS)
}

/** 从 Redis 读取 OpenAI Batch 输入文件内容(不存在返回 null) */
export async function getBatchInput(redis: Redis, fileId: string): Promise<string | null> {
  return redis.get(BATCH_INPUT_KEY_PREFIX + fileId)
}

// =============================================================================
// 入队(addBatchTask)
// =============================================================================

/**
 * 创建批量任务:保存到 Redis + 入队 BullMQ batch queue。
 *
 * @param redis 主 Redis 连接(server.redis,存任务数据)
 * @param queueConnection BullMQ 专用连接(server.redisForQueue)
 * @param task 任务对象(OpenAI 或 Anthropic)
 * @param type 任务类型('openai' | 'anthropic')
 * @returns BullMQ job id
 */
export async function addBatchTask(
  redis: Redis,
  queueConnection: Redis,
  task: BatchTask,
  type: 'openai' | 'anthropic',
): Promise<string | undefined> {
  // 1. 保存任务到 Redis
  await saveTask(redis, task)

  // 2. 入队(最小 payload,Worker 从 Redis 读取完整任务)
  const queue = getBatchQueue(queueConnection)
  const job = await queue.add('process-batch', { taskId: task.id, type } satisfies BatchJobData, {
    attempts: 3,
    backoff: { type: 'exponential', delay: 5000 },
    removeOnComplete: 100,
    removeOnFail: 500,
  })
  return job?.id
}
