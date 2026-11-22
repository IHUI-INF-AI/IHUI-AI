// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

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

import { eq, asc, inArray, lt, sql, and } from 'drizzle-orm'
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

/** cleanupProcessedOutbox 的单批主键条数上界。 */
export const DEFAULT_CLEANUP_BATCH_LIMIT = 500

/**
 * 认领租约(毫秒):超过此阈值仍是 processing,视为持有者已崩溃,
 * 由下一轮原子认领按时间阈回收(否则崩溃会把这些事件永久卡在 processing)。
 */
export const OUTBOX_CLAIM_STALE_MS = 10 * 60 * 1000

/** postgres-js 的 execute 直接返回行数组,部分驱动返回 { rows },两种都接住。 */
function toRows(raw: unknown): Record<string, unknown>[] {
  if (Array.isArray(raw)) return raw as Record<string, unknown>[]
  if (raw && typeof raw === 'object' && Array.isArray((raw as { rows?: unknown }).rows)) {
    return (raw as { rows: Record<string, unknown>[] }).rows
  }
  return []
}

/**
 * 原子认领一批待投递事件(F-217)。
 *
 * 单语句认领:`UPDATE ... WHERE id IN (SELECT ... FOR UPDATE SKIP LOCKED) RETURNING *`
 * —— 取任务与置 processing 是同一条语句,多实例并发时同一个 id 只会被一个实例拿到
 * (SKIP LOCKED 让别的实例直接跳过已被锁住的行),不存在"先 select 后 update"的重复投递窗口。
 *
 * 所有权标记:outbox_events 无 locked_by/locked_until 列(本单不改表结构),
 * 复用 `last_attempt_at` 作认领时间戳 —— processing 期间该列语义 = 认领时刻;
 * 完成/失败回写按 `(id, status='processing', last_attempt_at=认领时刻)` 精确判主,
 * 非持有者(租约已被回收/被他人接管)命中 0 行(与 webhook-relay-notifier 复用
 * next_retry_at 作认领戳同口径)。
 */
async function claimOutboxBatch(
  batchSize: number,
): Promise<{ events: OutboxEvent[]; claimStamp: Date }> {
  const claimStamp = new Date()
  const staleCutoff = new Date(claimStamp.getTime() - OUTBOX_CLAIM_STALE_MS)
  const raw = await db.execute(sql`
    UPDATE outbox_events
    SET status = 'processing',
        last_attempt_at = ${claimStamp.toISOString()}::timestamptz
    WHERE id IN (
      SELECT id FROM outbox_events
      WHERE status = 'pending'
         OR (
           status = 'processing'
           AND (
             last_attempt_at IS NULL
             OR last_attempt_at <= ${staleCutoff.toISOString()}::timestamptz
           )
         )
      ORDER BY created_at
      LIMIT ${batchSize}
      FOR UPDATE SKIP LOCKED
    )
    RETURNING id, type, payload, status, attempts,
              last_error AS "lastError",
              last_attempt_at AS "lastAttemptAt",
              created_at AS "createdAt",
              processed_at AS "processedAt"
  `)
  return { events: toRows(raw) as unknown as OutboxEvent[], claimStamp }
}

/** 回写判据:只有本轮认领者(同 id + 仍 processing + 认领时刻未变)才命中行。 */
function claimFence(eventId: string, claimStamp: Date) {
  return and(
    eq(outboxEvents.id, eventId),
    eq(outboxEvents.status, 'processing'),
    eq(outboxEvents.lastAttemptAt, claimStamp),
  )
}

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
 * 驱动方式（b76-12e G-998160）：poll 周期捎带补报 + host 启动扫描（不新增 setInterval
 * 计时器）——周期侧由 plugins/scheduler.ts 任务表的 `outbox-drain-every-30s`
 * （BullMQ repeatable，挂既有 scheduler-worker 轮询）驱动；启动侧由 scheduler 插件的
 * onReady 启动扫描补一轮（见 runOutboxStartupScan）。两侧都调本函数，幂等可重入：
 * 已 processed 的事件不会被再次取出。**禁止**为本函数新增任何 setInterval 计时器。
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

  // 取任务与认领是同一条语句（按创建时间升序，保证消息顺序）
  const { events: claimed, claimStamp } = await claimOutboxBatch(batchSize)

  let processed = 0
  let failed = 0

  for (const event of claimed) {
    try {
      await dispatcher.dispatch(event)
      // 发送成功：标记 processed（attempts 原子自增，不回读快照）
      const finished = await db
        .update(outboxEvents)
        .set({
          status: 'processed',
          attempts: sql`${outboxEvents.attempts} + 1`,
          lastAttemptAt: new Date(),
          processedAt: new Date(),
        })
        .where(claimFence(event.id, claimStamp))
        .returning({ id: outboxEvents.id })
      // 判主失败（租约已被回收/被他人接管）不计数，避免把别人的在飞行算成本实例成功
      if (finished.length > 0) processed++
    } catch (err) {
      // 未达阈值 → 退回 pending 等下一轮重新认领；attempts 同样用原子自增表达式
      const exhausted = event.attempts + 1 >= maxAttempts
      const errorMessage = err instanceof Error ? err.message : String(err)
      const written = await db
        .update(outboxEvents)
        .set({
          status: exhausted ? 'failed' : 'pending',
          attempts: sql`${outboxEvents.attempts} + 1`,
          lastError: errorMessage.slice(0, 1000),
          lastAttemptAt: new Date(),
        })
        .where(claimFence(event.id, claimStamp))
        .returning({ id: outboxEvents.id })
      if (exhausted && written.length > 0) failed++
    }
  }

  return { processed, failed }
}

/**
 * 清理已处理（processed）且超过保留期的 outbox 事件。
 *
 * 单轮批上界:先按 processedAt 升序取一批主键,再按主键删 —— 一条无界 DELETE 会把
 * 全表行锁与 .returning() 返回集一次性摊进事务(积压可能是全量 processed 行)。
 * 短批即止,单轮持锁面始终只有一批。
 *
 * @param beforeDate 清理此日期之前 processed 的事件
 * @param options.limit 单批主键条数上界,默认 DEFAULT_CLEANUP_BATCH_LIMIT
 * @returns 删除的记录数
 */
export async function cleanupProcessedOutbox(
  beforeDate: Date,
  options: { limit?: number } = {},
): Promise<number> {
  const batchLimit = options.limit ?? DEFAULT_CLEANUP_BATCH_LIMIT
  // 取批与按批删除共用同一份谓词,防两半各写一遍漂移
  const cond = and(eq(outboxEvents.status, 'processed'), lt(outboxEvents.processedAt, beforeDate))
  let deleted = 0
  while (true) {
    const batch = await db
      .select({ id: outboxEvents.id })
      .from(outboxEvents)
      .where(cond)
      .orderBy(asc(outboxEvents.processedAt))
      .limit(batchLimit)
    if (batch.length === 0) return deleted
    await db.delete(outboxEvents).where(
      inArray(
        outboxEvents.id,
        batch.map((row) => row.id),
      ),
    )
    deleted += batch.length
    if (batch.length < batchLimit) return deleted
  }
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
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
