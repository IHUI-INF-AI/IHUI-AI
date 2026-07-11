/**
 * AI 生成队列服务。
 *
 * 复用 BullMQ（plugins/queue.ts 已封装基础连接），为 AI 生成任务提供：
 * - 入队：将生成任务（文本/图像/视频/音频）放入队列
 * - 状态查询：通过 jobId 查询任务状态
 * - 优先级：高/中/低三档，影响 BullMQ 的 priority
 * - 重试与去重：相同 hash 的任务在 N 分钟内不重复入队
 *
 * 设计：本服务只负责"队列生命周期管理"，实际生成逻辑由 ai-service
 * 在 Worker 中注册 processor 实现（与 plugins/queue.ts 的 createWorker 解耦）。
 */

import { Queue, type Job, type JobState } from 'bullmq'
import { config } from '../../config/index.js'

export type GenerationTaskType = 'text' | 'image' | 'video' | 'audio' | 'multimodal'

export interface GenerationJobData {
  taskId: string
  type: GenerationTaskType
  userId: string
  prompt: string
  modelId: string
  params: Record<string, unknown>
  callbackUrl?: string
}

export type GenerationPriority = 'high' | 'normal' | 'low'

const PRIORITY_MAP: Record<GenerationPriority, number> = {
  high: 10,
  normal: 5,
  low: 1,
}

const QUEUE_NAME = 'ai-generation'

let queue: Queue<GenerationJobData> | null = null

function getQueue(): Queue<GenerationJobData> {
  if (!queue) {
    queue = new Queue<GenerationJobData>(QUEUE_NAME, {
      connection: { url: config.REDIS_URL, maxRetriesPerRequest: null },
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: 'exponential', delay: 5000 },
        removeOnComplete: { count: 2000 },
        removeOnFail: { count: 5000 },
      },
    })
  }
  return queue
}

/** 简单哈希：用于去重指纹。 */
function hash(s: string): string {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0
  return h.toString(16)
}

/** 入队一个生成任务。 */
export async function enqueue(
  data: GenerationJobData,
  priority: GenerationPriority = 'normal',
  dedupeWindowMs?: number,
): Promise<string> {
  const q = getQueue()
  const dedupeId = dedupeWindowMs ? `${hash(JSON.stringify(data))}` : undefined

  // 去重：相同指纹的任务在窗口期内不重复入队
  if (dedupeId && dedupeWindowMs) {
    const existing = await q.getJob(dedupeId)
    if (existing && (await existing.getState()) === 'waiting') {
      const age = Date.now() - existing.timestamp
      if (age < dedupeWindowMs) return existing.id ?? ''
    }
  }

  const job = await q.add(QUEUE_NAME, data, {
    priority: PRIORITY_MAP[priority],
    jobId: dedupeId,
  })
  return job.id ?? ''
}

/** 查询任务状态。 */
export async function getStatus(jobId: string): Promise<{
  jobId: string
  state: JobState | 'unknown'
  progress: number | unknown
  result: unknown
  failedReason?: string
} | null> {
  const q = getQueue()
  const job = (await q.getJob(jobId)) as Job<GenerationJobData> | undefined
  if (!job) return null
  return {
    jobId,
    state: await job.getState(),
    progress: job.progress,
    result: job.returnvalue,
    failedReason: job.failedReason,
  }
}

/** 取消任务。 */
export async function cancel(jobId: string): Promise<boolean> {
  const q = getQueue()
  const job = await q.getJob(jobId)
  if (!job) return false
  await job.remove()
  return true
}

/** 列出某用户最近的生成任务。 */
export async function listByUser(
  userId: string,
  status?: JobState,
  limit = 50,
): Promise<Job<GenerationJobData>[]> {
  const q = getQueue()
  const jobs = await q.getJobs(status ? [status] : undefined, 0, limit - 1)
  return jobs.filter((j) => j.data?.userId === userId)
}

/** 关闭队列连接（应用退出时调用）。 */
export async function closeQueue(): Promise<void> {
  if (queue) {
    await queue.close()
    queue = null
  }
}

/** 获取队列统计（用于监控）。 */
export async function getQueueStats(): Promise<{
  waiting: number
  active: number
  completed: number
  failed: number
  delayed: number
}> {
  const q = getQueue()
  const counts = await q.getJobCounts('waiting', 'active', 'completed', 'failed', 'delayed')
  return {
    waiting: counts.waiting ?? 0,
    active: counts.active ?? 0,
    completed: counts.completed ?? 0,
    failed: counts.failed ?? 0,
    delayed: counts.delayed ?? 0,
  }
}
