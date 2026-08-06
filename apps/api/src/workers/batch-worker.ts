/**
 * Batch Worker — BullMQ 消费者(2026-08-01 立)。
 *
 * 消费 batch-queue 队列任务,逐请求调用 ai-service /api/llm/complete,
 * 收集结果写入 Redis,每条调用 recordCall 按 50% 折扣计费。
 *
 * 处理流程:
 *   1. 从 Redis 读取任务(幂等:终态任务跳过)
 *   2. 更新状态 validating → in_progress
 *   3. OpenAI: 读取 input JSONL(batch:input:<fileId>)→ 逐行调用 LLM → 写 output JSONL
 *      Anthropic: 读取 _requests → 逐请求调用 LLM → 写 results
 *   4. 每条调用 recordCall(metadata { batch: true, discount: 0.5, batchId })
 *   5. 更新状态 finalizing → completed(含 request_counts + output)
 *   6. 失败时更新状态 failed + _errorMessage
 *
 * 与 registry-sync-worker / relay-health-check-worker 同模式:
 * - server.redisForQueue 作为 BullMQ 连接
 * - server.redis 作为任务数据存储
 * - onClose 优雅关闭
 */
import type { FastifyInstance } from 'fastify'
import type { Redis } from 'ioredis'
import { Worker } from 'bullmq'
import { randomUUID } from 'node:crypto'
import {
  BATCH_QUEUE_NAME,
  type BatchJobData,
  type BatchTaskStatus,
  type OpenAIBatchTask,
  type AnthropicBatchTask,
  type AnthropicBatchRequestItem,
  type AnthropicBatchResultItem,
  type BatchTaskPatch,
  getTask,
  updateBatchTaskStatus,
  getBatchInput,
} from '../queue/batch-queue.js'
import { aiServiceFetch } from '../utils/ai-service-fetch.js'
import { recordCall, modelToProviderCode } from '../services/relay-billing-service.js'
import { logger } from '../utils/logger.js'

/** 终态状态(已终态任务不再处理,幂等) */
const TERMINAL_STATUSES: BatchTaskStatus[] = ['completed', 'failed', 'cancelled', 'expired']

// P1 修复(2026-08-06):计费幂等 — worker 崩溃后 BullMQ 会重新投递同一任务,
// 重试时任务状态是 in_progress(非终态),原实现会从头重跑并再次计费 → 重复扣费。
// 以 taskId + 行标识 作为唯一键(Redis SET NX),已计费的行直接跳过。
const BILLING_DEDUP_PREFIX = 'batch:billing:dedup:'
const BILLING_DEDUP_TTL_SEC = 7 * 24 * 3600

/** 尝试认领一次计费:true=首次(应计费);false=已计费(跳过)。Redis 异常时 fail-open 计费。 */
async function claimBillingOnce(redis: Redis, taskId: string, lineKey: string): Promise<boolean> {
  try {
    const key = `${BILLING_DEDUP_PREFIX}${taskId}:${lineKey}`
    const claimed = await redis.set(key, '1', 'EX', BILLING_DEDUP_TTL_SEC, 'NX')
    return claimed === 'OK'
  } catch {
    return true
  }
}

// =============================================================================
// LLM 调用 + 计费辅助
// =============================================================================

/** ai-service /api/llm/complete 响应(简化结构) */
interface LlmCompleteResponse {
  content?: string
  usage?: {
    prompt_tokens?: number
    completion_tokens?: number
    total_tokens?: number
  }
  stub?: boolean
  error?: boolean
  error_message?: string
}

/** LLM 调用结果(成功/失败联合类型) */
type LlmResult =
  | {
      content: string
      usage: { prompt_tokens: number; completion_tokens: number; total_tokens: number }
    }
  | { error: string }

/**
 * 调用 ai-service /api/llm/complete(非流式,120s 超时)。
 * @param body OpenAI 格式请求体({ model, messages, max_tokens?, ... })
 */
async function callLlmComplete(body: Record<string, unknown>): Promise<LlmResult> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 120_000)
  try {
    const res = await aiServiceFetch(null, '/api/llm/complete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    })
    if (!res.ok) {
      const errText = await res.text().catch(() => '')
      return { error: `upstream ${res.status}: ${errText.slice(0, 200)}` }
    }
    const json = (await res.json()) as LlmCompleteResponse
    if (json.error) {
      return { error: json.error_message ?? 'LLM error' }
    }
    if (json.stub) {
      return { error: 'LLM stub mode (no real API key configured)' }
    }
    return {
      content: json.content ?? '',
      usage: {
        prompt_tokens: json.usage?.prompt_tokens ?? 0,
        completion_tokens: json.usage?.completion_tokens ?? 0,
        total_tokens: json.usage?.total_tokens ?? 0,
      },
    }
  } catch (e) {
    return {
      error:
        e instanceof Error && e.name === 'AbortError'
          ? 'request timeout (120s)'
          : ((e as Error)?.message ?? String(e)),
    }
  } finally {
    clearTimeout(timer)
  }
}

/**
 * 记录批量调用计费(50% 折扣)。
 * metadata.batch=true 标记批量调用,metadata.discount=0.5 标记折扣比例。
 * 注:实际折扣计算在 relay-billing-service.ts 的 recordCall 中实现(本任务范围外)。
 */
function recordBatchCall(
  apiKeyId: string,
  userId: string,
  model: string,
  prompt: string,
  response: string,
  usage: { prompt_tokens: number; completion_tokens: number; total_tokens: number },
  latencyMs: number,
  status: 'success' | 'error',
  errorMessage: string | null,
  batchId: string,
): void {
  void recordCall({
    apiKeyId,
    userId,
    model,
    prompt: prompt.slice(0, 5000),
    response: response.slice(0, 5000),
    promptTokens: usage.prompt_tokens,
    completionTokens: usage.completion_tokens,
    totalTokens: usage.total_tokens,
    latencyMs,
    status,
    errorMessage,
    providerCode: modelToProviderCode(model),
    clientIp: '',
    metadata: { batch: true, discount: 0.5, batchId },
  }).catch((err: unknown) => {
    // 计费失败不阻塞批处理流程,但记录日志便于排查
    logger.warn('batch billing failed', { batchId, err })
  })
}

// =============================================================================
// OpenAI Batch 输入解析
// =============================================================================

/** OpenAI Batch JSONL 输入行结构 */
interface OpenAIBatchInputLine {
  custom_id: string
  method: string
  url: string
  body: {
    model: string
    messages: unknown[]
    [k: string]: unknown
  }
}

/** 类型守卫:验证 OpenAI Batch 输入行结构 */
function isOpenAIBatchInputLine(obj: unknown): obj is OpenAIBatchInputLine {
  if (typeof obj !== 'object' || obj === null) return false
  const o = obj as Record<string, unknown>
  if (typeof o.custom_id !== 'string') return false
  if (typeof o.body !== 'object' || o.body === null) return false
  const body = o.body as Record<string, unknown>
  return typeof body.model === 'string' && Array.isArray(body.messages)
}

// =============================================================================
// Anthropic → OpenAI 格式转换
// =============================================================================

/**
 * Anthropic system 字段转 string(支持 string 和 content block 数组)。
 * Anthropic system 可以是 "text" 或 [{"type":"text","text":"..."}]
 */
function anthropicSystemToString(system: string | Record<string, unknown>[]): string {
  if (typeof system === 'string') return system
  return system
    .map((block) => {
      if (typeof block === 'object' && block !== null && 'text' in block) {
        return String((block as Record<string, unknown>).text)
      }
      return ''
    })
    .filter(Boolean)
    .join('\n')
}

/**
 * Anthropic Batch 请求参数转 OpenAI /api/llm/complete 请求体。
 * - system 字段 → prepend 为 system message
 * - messages / model / max_tokens / temperature 等直接透传(ai-service 兼容)
 */
function anthropicToOpenAIBody(
  params: AnthropicBatchRequestItem['params'],
): Record<string, unknown> {
  const messages: Record<string, unknown>[] = []
  // system → system message(OpenAI 格式)
  if (params.system !== undefined) {
    messages.push({ role: 'system', content: anthropicSystemToString(params.system) })
  }
  // 追加原始 messages(Anthropic 格式与 OpenAI 格式兼容)
  for (const msg of params.messages) {
    messages.push({ role: msg.role, content: msg.content })
  }
  const body: Record<string, unknown> = { model: params.model, messages }
  if (params.max_tokens !== undefined) body.max_tokens = params.max_tokens
  if (params.temperature !== undefined) body.temperature = params.temperature
  if (params.top_p !== undefined) body.top_p = params.top_p
  if (params.stop_sequences !== undefined) body.stop = params.stop_sequences
  return body
}

// =============================================================================
// OpenAI Batch 处理
// =============================================================================

async function processOpenAIBatch(
  redis: Redis,
  taskId: string,
  server: FastifyInstance,
): Promise<void> {
  // 1. 读取任务 + 幂等检查
  const task = await getTask<OpenAIBatchTask>(redis, taskId)
  if (!task) {
    server.log.warn({ taskId }, 'batch-worker[openai]: 任务不存在(可能已过期)')
    return
  }
  if (TERMINAL_STATUSES.includes(task.status)) {
    server.log.info({ taskId, status: task.status }, 'batch-worker[openai]: 任务已终态,跳过')
    return
  }

  // 2. 更新状态 → in_progress
  await updateBatchTaskStatus(redis, taskId, 'in_progress')

  // 3. 读取输入 JSONL
  const inputContent = await getBatchInput(redis, task.input_file_id)
  if (!inputContent) {
    const errMsg = `Input file not found: ${task.input_file_id}`
    await updateBatchTaskStatus(redis, taskId, 'failed', { _errorMessage: errMsg })
    server.log.error(
      { taskId, input_file_id: task.input_file_id },
      'batch-worker[openai]: 输入文件未找到(需先通过文件上传端点存储)',
    )
    return
  }

  // 4. 解析 JSONL + 逐条处理
  const lines = inputContent.split('\n').filter((line) => line.trim())
  const total = lines.length
  let completed = 0
  let failed = 0
  const outputLines: string[] = []

  for (const line of lines) {
    // 取消检查
    const current = await getTask<OpenAIBatchTask>(redis, taskId)
    if (current?.status === 'cancelled') {
      server.log.info({ taskId }, 'batch-worker[openai]: 任务已取消,停止处理')
      return
    }

    // 解析行
    let customId = `request-${completed + failed + 1}`
    let parsed: unknown
    try {
      parsed = JSON.parse(line)
    } catch {
      failed++
      outputLines.push(
        JSON.stringify({
          id: `batch_req_${randomUUID()}`,
          custom_id: customId,
          response: null,
          error: { message: 'JSON 格式错误' },
        }),
      )
      continue
    }

    if (!isOpenAIBatchInputLine(parsed)) {
      failed++
      outputLines.push(
        JSON.stringify({
          id: `batch_req_${randomUUID()}`,
          custom_id: 'unknown',
          response: null,
          error: {
            message: '批处理输入格式无效(缺少 custom_id 或 body.model/messages)',
          },
        }),
      )
      continue
    }

    customId = parsed.custom_id
    const { body } = parsed
    const model = body.model
    const promptText = JSON.stringify(body.messages).slice(0, 5000)
    const startTime = Date.now()

    // 调用 LLM
    const result = await callLlmComplete(body as Record<string, unknown>)
    const latencyMs = Date.now() - startTime

    if ('error' in result) {
      failed++
      outputLines.push(
        JSON.stringify({
          id: `batch_req_${randomUUID()}`,
          custom_id: customId,
          response: null,
          error: { message: result.error },
        }),
      )
      // P1 修复(2026-08-06):重试时跳过已计费行,防重复扣费
      if (await claimBillingOnce(redis, taskId, customId)) {
        recordBatchCall(
          task._apiKeyId,
          task._userId,
          model,
          promptText,
          '',
          { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
          latencyMs,
          'error',
          result.error,
          taskId,
        )
      }
      continue
    }

    // 成功:构造 OpenAI 兼容输出
    completed++
    outputLines.push(
      JSON.stringify({
        id: `batch_req_${randomUUID()}`,
        custom_id: customId,
        response: {
          status_code: 200,
          body: {
            id: `chatcmpl-${randomUUID()}`,
            object: 'chat.completion',
            model,
            choices: [
              {
                index: 0,
                message: { role: 'assistant', content: result.content },
                finish_reason: 'stop',
              },
            ],
            usage: result.usage,
          },
        },
        error: null,
      }),
    )
    // P1 修复(2026-08-06):重试时跳过已计费行,防重复扣费
    if (await claimBillingOnce(redis, taskId, customId)) {
      recordBatchCall(
        task._apiKeyId,
        task._userId,
        model,
        promptText,
        result.content,
        result.usage,
        latencyMs,
        'success',
        null,
        taskId,
      )
    }
  }

  // 5. 更新状态 finalizing → completed
  await updateBatchTaskStatus(redis, taskId, 'finalizing')
  const patch: BatchTaskPatch = {
    request_counts: { total, completed, failed },
    _outputContent: outputLines.join('\n'),
  }
  await updateBatchTaskStatus(redis, taskId, 'completed', patch)

  server.log.info({ taskId, total, completed, failed }, 'batch-worker[openai]: 批量任务完成')
}

// =============================================================================
// Anthropic Batch 处理
// =============================================================================

async function processAnthropicBatch(
  redis: Redis,
  taskId: string,
  server: FastifyInstance,
): Promise<void> {
  // 1. 读取任务 + 幂等检查
  const task = await getTask<AnthropicBatchTask>(redis, taskId)
  if (!task) {
    server.log.warn({ taskId }, 'batch-worker[anthropic]: 任务不存在(可能已过期)')
    return
  }
  if (TERMINAL_STATUSES.includes(task.status)) {
    server.log.info({ taskId, status: task.status }, 'batch-worker[anthropic]: 任务已终态,跳过')
    return
  }

  // 2. 更新状态 → in_progress
  await updateBatchTaskStatus(redis, taskId, 'in_progress')

  // 3. 逐请求处理
  const total = task._requests.length
  let succeeded = 0
  let errored = 0
  const results: AnthropicBatchResultItem[] = []

  for (const req of task._requests) {
    // 取消检查
    const current = await getTask<AnthropicBatchTask>(redis, taskId)
    if (current?.status === 'cancelled') {
      server.log.info({ taskId }, 'batch-worker[anthropic]: 任务已取消,停止处理')
      return
    }

    const { custom_id, params } = req
    const model = params.model
    const body = anthropicToOpenAIBody(params)
    const promptText = JSON.stringify(params.messages).slice(0, 5000)
    const startTime = Date.now()

    // 调用 LLM
    const result = await callLlmComplete(body)
    const latencyMs = Date.now() - startTime

    if ('error' in result) {
      errored++
      results.push({
        custom_id,
        result: {
          type: 'errored',
          error: { type: 'error', message: result.error },
        },
      })
      // P1 修复(2026-08-06):重试时跳过已计费行,防重复扣费
      if (await claimBillingOnce(redis, taskId, custom_id)) {
        recordBatchCall(
          task._apiKeyId,
          task._userId,
          model,
          promptText,
          '',
          { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
          latencyMs,
          'error',
          result.error,
          taskId,
        )
      }
      continue
    }

    // 成功:构造 Anthropic 兼容结果
    succeeded++
    results.push({
      custom_id,
      result: {
        type: 'succeeded',
        message: {
          id: `msg_${randomUUID()}`,
          type: 'message',
          role: 'assistant',
          model,
          content: [{ type: 'text', text: result.content }],
          stop_reason: 'end_turn',
          usage: {
            input_tokens: result.usage.prompt_tokens,
            output_tokens: result.usage.completion_tokens,
          },
        },
      },
    })
    // P1 修复(2026-08-06):重试时跳过已计费行,防重复扣费
    if (await claimBillingOnce(redis, taskId, custom_id)) {
      recordBatchCall(
        task._apiKeyId,
        task._userId,
        model,
        promptText,
        result.content,
        result.usage,
        latencyMs,
        'success',
        null,
        taskId,
      )
    }
  }

  // 4. 更新状态 finalizing → completed
  await updateBatchTaskStatus(redis, taskId, 'finalizing')
  const patch: BatchTaskPatch = {
    request_counts: {
      processing: 0,
      succeeded,
      errored,
      canceled: 0,
      expired: 0,
    },
    results,
  }
  await updateBatchTaskStatus(redis, taskId, 'completed', patch)

  server.log.info({ taskId, total, succeeded, errored }, 'batch-worker[anthropic]: 批量任务完成')
}

// =============================================================================
// Worker 启动
// =============================================================================

/**
 * 启动 Batch Worker(消费 batch-queue 队列)。
 * 与 startRegistrySyncWorker / startRelayHealthCheckWorker 同模式。
 */
export function startBatchWorker(server: FastifyInstance): Worker {
  const connection = server.redisForQueue
  if (!connection) {
    server.log.warn('batch-worker: Redis 不适用,Worker 未启动')
    return {} as Worker
  }

  const redis = server.redis

  const worker = new Worker<BatchJobData>(
    BATCH_QUEUE_NAME,
    async (job) => {
      const { taskId, type } = job.data
      server.log.info({ jobId: job.id, taskId, type }, 'batch-worker: 开始处理批量任务')

      try {
        if (type === 'openai') {
          await processOpenAIBatch(redis, taskId, server)
        } else {
          await processAnthropicBatch(redis, taskId, server)
        }
      } catch (err) {
        // 未预期的异常(处理函数内部的错误已在内部 catch)
        const errMsg = err instanceof Error ? err.message : String(err)
        server.log.error({ jobId: job.id, taskId, err: errMsg }, 'batch-worker: 批量任务处理异常')
        await updateBatchTaskStatus(redis, taskId, 'failed', {
          _errorMessage: errMsg,
        }).catch(() => {})
        throw err
      }
    },
    {
      connection,
      concurrency: 1,
      lockDuration: 300_000, // 5 min,批量任务可能很长
    },
  )

  worker.on('completed', (job) => {
    server.log.info({ jobId: job?.id, taskId: job?.data?.taskId }, 'batch-worker: 批量任务完成')
  })
  worker.on('failed', (job, err) => {
    server.log.error(
      { jobId: job?.id, taskId: job?.data?.taskId, err: err.message },
      'batch-worker: 批量任务失败',
    )
  })

  // 优雅关闭
  server.addHook('onClose', async () => {
    try {
      await worker.close()
    } catch {
      /* ignore */
    }
  })

  server.log.info({ queue: BATCH_QUEUE_NAME }, 'batch-worker started')

  return worker
}
