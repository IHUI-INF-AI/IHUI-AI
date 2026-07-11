/**
 * Outbox 可靠消息模式。
 *
 * 解决微服务/分布式场景下的"双写一致性"问题：
 * 业务事务内同时写业务表 + outbox 表（同一 DB 事务，保证原子性），
 * 事务提交后由独立进程/定时任务轮询 outbox 表，异步发送消息到 MQ/下游。
 *
 * 流程：
 * 1. writeToOutbox：在业务事务内调用，写入 outbox_events 表（status=pending）
 * 2. processOutbox：事务后轮询，取出 pending 事件 → 调用发送器 → 标记 processed
 * 3. 失败重试：attempts 递增，超过阈值标记 failed
 */

import { eq, asc, lt, sql, and } from 'drizzle-orm'
import { db, type Database } from '../db/index.js'
import { outboxEvents, type OutboxEvent } from '@ihui/database'

/**
 * 支持 db 主连接或事务 tx 的最小接口。
 * 两者都有 .insert() 方法，结构兼容。
 */
type DbOrTx = Pick<Database, 'insert'>

/** Outbox 事件写入入参。 */
export interface OutboxEventInput {
  /** 事件类型（如 order.created / payment.paid） */
  type: string
  /** 事件载荷（JSON 可序列化） */
  payload: unknown
}

/** 事件发送器（由调用方实现，如发到 Kafka/RabbitMQ/Webhook）。 */
export interface OutboxDispatcher {
  /**
   * 发送单个事件。
   * @throws 发送失败时抛出错误，触发重试
   */
  dispatch(event: OutboxEvent): Promise<void>
}

/** processOutbox 结果。 */
export interface ProcessOutboxResult {
  /** 成功处理数 */
  processed: number
  /** 失败数（达到最大重试次数） */
  failed: number
}

/** 默认最大重试次数。 */
export const DEFAULT_MAX_ATTEMPTS = 5

/** 默认单次处理事件数。 */
export const DEFAULT_BATCH_SIZE = 100

/**
 * 在业务事务内写入 outbox 事件。
 *
 * 必须在业务事务的 tx 上下文中调用，以保证与业务数据原子写入。
 * 若未传入 tx，则使用默认 db 连接（此时不保证与业务事务原子性）。
 *
 * @example
 * await db.transaction(async (tx) => {
 *   await tx.insert(orders).values(...);
 *   await writeToOutbox({ type: 'order.created', payload: { orderId } }, tx);
 * });
 */
export async function writeToOutbox(event: OutboxEventInput, tx: DbOrTx = db): Promise<void> {
  await tx.insert(outboxEvents).values({
    type: event.type,
    payload: event.payload,
    status: 'pending',
    attempts: 0,
  })
}

/**
 * 轮询处理 outbox 中 pending 的事件。
 *
 * 应由定时任务/独立 worker 周期调用。
 *
 * @param dispatcher 事件发送器
 * @param options.maxAttempts 最大重试次数，默认 5
 * @param options.batchSize 单次处理事件数，默认 100
 */
export async function processOutbox(
  dispatcher: OutboxDispatcher,
  options: {
    maxAttempts?: number
    batchSize?: number
  } = {},
): Promise<ProcessOutboxResult> {
  const maxAttempts = options.maxAttempts ?? DEFAULT_MAX_ATTEMPTS
  const batchSize = options.batchSize ?? DEFAULT_BATCH_SIZE

  // 取一批 pending 事件（按创建时间升序，保证消息顺序）
  const pending = await db
    .select()
    .from(outboxEvents)
    .where(eq(outboxEvents.status, 'pending'))
    .orderBy(asc(outboxEvents.createdAt))
    .limit(batchSize)

  let processed = 0
  let failed = 0

  for (const event of pending) {
    try {
      await dispatcher.dispatch(event)
      // 发送成功：标记 processed
      await db
        .update(outboxEvents)
        .set({
          status: 'processed',
          attempts: event.attempts + 1,
          lastAttemptAt: new Date(),
          processedAt: new Date(),
        })
        .where(eq(outboxEvents.id, event.id))
      processed++
    } catch (err) {
      const newAttempts = event.attempts + 1
      const errorMessage = err instanceof Error ? err.message : String(err)
      if (newAttempts >= maxAttempts) {
        // 超过最大重试次数：标记 failed
        await db
          .update(outboxEvents)
          .set({
            status: 'failed',
            attempts: newAttempts,
            lastError: errorMessage.slice(0, 1000),
            lastAttemptAt: new Date(),
          })
          .where(eq(outboxEvents.id, event.id))
        failed++
      } else {
        // 未达阈值：记录失败，等待下次重试
        await db
          .update(outboxEvents)
          .set({
            attempts: newAttempts,
            lastError: errorMessage.slice(0, 1000),
            lastAttemptAt: new Date(),
          })
          .where(eq(outboxEvents.id, event.id))
      }
    }
  }

  return { processed, failed }
}

/**
 * 清理已处理（processed）且超过保留期的 outbox 事件。
 * @param beforeDate 清理此日期之前的 processed 事件
 * @returns 删除的记录数
 */
export async function cleanupProcessedOutbox(beforeDate: Date): Promise<number> {
  const rows = await db
    .delete(outboxEvents)
    .where(and(eq(outboxEvents.status, 'processed'), lt(outboxEvents.processedAt, beforeDate)))
    .returning({ id: outboxEvents.id })
  return rows.length
}

/**
 * 统计当前 outbox 各状态事件数（监控用）。
 */
export async function getOutboxStats(): Promise<{
  pending: number
  processed: number
  failed: number
}> {
  const rows = await db
    .select({
      status: outboxEvents.status,
      count: sql<number>`count(*)::int`,
    })
    .from(outboxEvents)
    .groupBy(outboxEvents.status)

  const stats = { pending: 0, processed: 0, failed: 0 }
  for (const r of rows) {
    if (r.status === 'pending') stats.pending = r.count
    else if (r.status === 'processed') stats.processed = r.count
    else if (r.status === 'failed') stats.failed = r.count
  }
  return stats
}
