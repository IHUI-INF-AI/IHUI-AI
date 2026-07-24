/**
 * 资源上游同步中心 BullMQ 队列(2026-07-24 立)。
 *
 * 双路径触发:
 *  1. 定时拉取(每 6 小时)— repeat job `registry-sync-cron`
 *  2. webhook 推送 — 单次 job `registry-sync-manual` / `registry-sync-webhook`
 *
 * 队列名 `registry-sync-queue`,与既有 queue.ts 的 4 个队列独立,避免相互影响。
 * Worker 处理逻辑由调用方(services/registry-sync)注册,本模块只负责 Queue 生产者。
 */
import { Queue, Worker } from 'bullmq'
import type { Redis } from 'ioredis'
import { cleanupOldSyncLogs, cleanupOldWebhookTriggers } from '../db/registry-queries.js'

export const REGISTRY_SYNC_QUEUE_NAME = 'registry-sync-queue'

/** 每日 TTL 清理队列名(与同步队列独立,避免相互影响)。 */
export const REGISTRY_CLEANUP_QUEUE_NAME = 'registry-cleanup-queue'

/** 每天凌晨 3:00 执行清理(避开每 6 小时的同步任务时间点)。 */
const CLEANUP_CRON_PATTERN = '0 3 * * *'

/** 同步任务 payload。sourceType/source 均不传 = 全部源。 */
export interface RegistrySyncJobData {
  sourceType: 'mcp' | 'skill' | 'plugin' | null
  source: 'github' | 'npm' | 'mcp_marketplace' | 'custom' | null
  force: boolean
  /** webhook 触发时附带的 triggerId,用于回写处理状态 */
  triggerId?: string
}

let registrySyncQueue: Queue | null = null

/** 获取(惰性创建)同步队列。 */
export function getRegistrySyncQueue(connection: Redis): Queue {
  if (!registrySyncQueue) {
    registrySyncQueue = new Queue(REGISTRY_SYNC_QUEUE_NAME, { connection })
  }
  return registrySyncQueue
}

/** 注册定时同步 job(每 6 小时一次)。幂等:重复调用不会创建多个 repeat job。 */
export async function scheduleRegistrySync(connection: Redis): Promise<void> {
  const queue = getRegistrySyncQueue(connection)
  await queue.add(
    'registry-sync-cron',
    { sourceType: null, source: null, force: false } satisfies RegistrySyncJobData,
    {
      repeat: { pattern: '0 */6 * * *' },
      jobId: 'registry-sync-cron',
      removeOnComplete: 100,
      removeOnFail: 500,
    },
  )
}

/** 入队手动同步任务(管理员触发)。返回 BullMQ job id。 */
export async function enqueueManualSync(
  connection: Redis,
  data: RegistrySyncJobData,
): Promise<string | undefined> {
  const queue = getRegistrySyncQueue(connection)
  const job = await queue.add('registry-sync-manual', data, {
    removeOnComplete: 100,
    removeOnFail: 500,
  })
  return job?.id
}

/** 入队 webhook 触发的同步任务。返回 BullMQ job id。 */
export async function enqueueWebhookSync(
  connection: Redis,
  data: RegistrySyncJobData,
): Promise<string | undefined> {
  const queue = getRegistrySyncQueue(connection)
  const job = await queue.add('registry-sync-webhook', data, {
    removeOnComplete: 100,
    removeOnFail: 500,
  })
  return job?.id
}

// ──────────────────────────────────────────────────────────────────────────
// 每日 TTL 清理任务(2026-07-24 立)
//
// 自动清理过期记录,避免 webhook_triggers / registry_sync_logs 无限增长:
//  - webhook_triggers:保留 30 天
//  - registry_sync_logs:保留 90 天
//
// 采用 BullMQ repeat job(生产者)+ 内联 Worker(消费者)模式,避免改动 worker 文件。
// ──────────────────────────────────────────────────────────────────────────

let registryCleanupQueue: Queue | null = null

/** 获取(惰性创建)清理队列。 */
export function getRegistryCleanupQueue(connection: Redis): Queue {
  if (!registryCleanupQueue) {
    registryCleanupQueue = new Queue(REGISTRY_CLEANUP_QUEUE_NAME, { connection })
  }
  return registryCleanupQueue
}

/**
 * 注册每日 TTL 清理定时任务(凌晨 3:00)。
 * 幂等:重复调用不会创建多个 repeat job(jobId 固定)。
 *
 * 注意:本函数只注册 cron job(生产者),实际执行由 startRegistryCleanupWorker 消费。
 */
export async function scheduleRegistryCleanup(connection: Redis): Promise<void> {
  const queue = getRegistryCleanupQueue(connection)
  await queue.add(
    'registry-cleanup-cron',
    { type: 'cleanup' },
    {
      repeat: { pattern: CLEANUP_CRON_PATTERN },
      jobId: 'registry-cleanup-cron',
      removeOnComplete: 100,
      removeOnFail: 500,
    },
  )
}

/**
 * 启动清理 Worker(消费者),内联执行清理逻辑,无需改动外部 worker 文件。
 * 返回 Worker 实例,调用方可在关闭时调用 worker.close() 优雅退出。
 */
export function startRegistryCleanupWorker(connection: Redis): Worker {
  const worker = new Worker(
    REGISTRY_CLEANUP_QUEUE_NAME,
    async () => {
      const webhookDeleted = await cleanupOldWebhookTriggers(30)
      const logsDeleted = await cleanupOldSyncLogs(90)
      console.log(
        `[registry-cleanup] 清理完成: webhook_triggers=${webhookDeleted} sync_logs=${logsDeleted}`,
      )
      return { webhookDeleted, logsDeleted }
    },
    { connection, concurrency: 1 },
  )
  worker.on('failed', (_job, err) => {
    console.error('[registry-cleanup] 清理任务失败:', err.message)
  })
  console.log('[registry-queue] 清理 Worker 已启动')
  return worker
}
