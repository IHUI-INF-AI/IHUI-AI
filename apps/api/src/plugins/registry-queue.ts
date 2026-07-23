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
import { Queue } from 'bullmq'
import type { Redis } from 'ioredis'

export const REGISTRY_SYNC_QUEUE_NAME = 'registry-sync-queue'

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
