/**
 * 旅游事件总线服务。
 *
 * 复用 outbox 模式：业务事务内写入 tour_events 表，
 * 独立 worker 周期性轮询 pending 事件并分发到下游（多平台/监控/告警）。
 *
 * 与 utils/outbox.ts 的差异：
 * - 使用 tour 专属事件表（tour_events），不污染全局 outbox_events。
 * - dispatcher 类型简化，便于旅游业务自定义分发逻辑。
 */

import { eq, asc } from 'drizzle-orm'
import { db } from '../../db/index.js'
import { tourEvents } from '@ihui/database'
import type { TourEvent } from '@ihui/database'
export type { TourEvent }

export interface TourEventInput {
  type: string
  payload: unknown
}

export interface TourEventDispatcher {
  dispatch(event: TourEvent): Promise<void>
}

export interface ProcessResult {
  processed: number
  failed: number
}

const DEFAULT_BATCH_SIZE = 100
const DEFAULT_MAX_ATTEMPTS = 5

/** 在业务事务内写入事件（status=pending）。 */
export async function publish(event: TourEventInput): Promise<void> {
  await db.insert(tourEvents).values({
    type: event.type,
    payload: event.payload,
    status: 'pending',
    attempts: 0,
  })
}

/** 批量写入多个事件。 */
export async function publishBatch(events: TourEventInput[]): Promise<void> {
  if (events.length === 0) return
  await db.insert(tourEvents).values(
    events.map((e) => ({
      type: e.type,
      payload: e.payload,
      status: 'pending' as const,
      attempts: 0,
    })),
  )
}

/** 轮询处理 pending 事件。应由定时任务周期性调用。 */
export async function processEvents(
  dispatcher: TourEventDispatcher,
  options: { maxAttempts?: number; batchSize?: number } = {},
): Promise<ProcessResult> {
  const maxAttempts = options.maxAttempts ?? DEFAULT_MAX_ATTEMPTS
  const batchSize = options.batchSize ?? DEFAULT_BATCH_SIZE

  const pending = await db
    .select()
    .from(tourEvents)
    .where(eq(tourEvents.status, 'pending'))
    .orderBy(asc(tourEvents.createdAt))
    .limit(batchSize)

  let processed = 0
  let failed = 0

  for (const event of pending) {
    try {
      await dispatcher.dispatch(event)
      await db
        .update(tourEvents)
        .set({
          status: 'processed',
          attempts: event.attempts + 1,
          lastAttemptAt: new Date(),
          processedAt: new Date(),
        })
        .where(eq(tourEvents.id, event.id))
      processed++
    } catch (err) {
      const newAttempts = event.attempts + 1
      const errorMessage = err instanceof Error ? err.message : String(err)
      const isFinal = newAttempts >= maxAttempts
      await db
        .update(tourEvents)
        .set({
          status: isFinal ? 'failed' : 'pending',
          attempts: newAttempts,
          lastError: errorMessage.slice(0, 1000),
          lastAttemptAt: new Date(),
        })
        .where(eq(tourEvents.id, event.id))
      if (isFinal) failed++
    }
  }

  return { processed, failed }
}

/** 简单控制台 dispatcher（开发期占位实现）。 */
export const consoleDispatcher: TourEventDispatcher = {
  async dispatch(event) {
    console.log(`[tour-event-bus] ${event.type}:`, JSON.stringify(event.payload).slice(0, 200))
  },
}

/** 按 type 订阅事件（订阅者模式：返回该类型的所有 pending 事件）。 */
export async function getPendingByType(type: string, limit = 50): Promise<TourEvent[]> {
  return db
    .select()
    .from(tourEvents)
    .where(eq(tourEvents.type, type))
    .orderBy(asc(tourEvents.createdAt))
    .limit(limit)
}
