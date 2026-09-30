// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * Relay Webhook 通知 service(2026-08-01 立)。
 *
 * 职责:
 * 1. notifyRelayEvent:relay 调用完成/异常/余额不足时,异步触发用户订阅的 webhook
 *    - 查用户启用的 webhook_subscriptions(events 包含此 event)
 *    - 对每个 subscription:生成 HMAC-SHA256 签名 → POST 到 subscription.url → 写 webhook_delivery_logs
 *    - 失败 → status='retrying', nextRetryAt = now + 2^attempt 秒(指数退避),最多 3 次
 *    - 成功 → status='success'
 * 2. retryPendingWebhooks:定时任务调,查 status='retrying' AND nextRetryAt <= now → 重发
 *
 * 设计原则:
 * - 全异步,不阻塞主链路(notifyRelayEvent 由 recordCall 用 setImmediate 调用)
 * - 失败容错:单个 subscription 投递失败不影响其他 subscription
 * - HMAC 签名:用 node:crypto,X-IHUI-Signature 头传 sha256=<hex>
 * - 重试:指数退避(2^attempt 秒),最多 3 次,耗尽 → status='failed'
 */
import { createHmac, randomBytes } from 'node:crypto'
import { eq, and, sql } from 'drizzle-orm'
import { db, dbRead } from '../db/index.js'
import { webhookSubscriptions, webhookDeliveryLogs, type RelayWebhookEvent } from '@ihui/database'

// =============================================================================
// 常量
// =============================================================================

/** 最大尝试次数(含首次,3 = 首次 + 2 次重试) */
const MAX_ATTEMPTS = 3

/**
 * 认领超时阈值(毫秒):认领即写认领时间戳,超过该阈值仍是 processing 视为持有者已崩溃,
 * 由下一轮认领事务按时间阈复位收回(出处 b76-12e G-998158,吸收 upstream offPeakTaskRepo
 * 的 OFF_PEAK_CLAIM_STALE_MS 语义)。该常量与 automation 侧 CLAIM_STALE_MS 语义相同但
 * 独立一份,勿互相引用。
 */
export const WEBHOOK_CLAIM_STALE_MS = 10 * 60 * 1000

/** 单次投递超时(毫秒) */
const DELIVERY_TIMEOUT_MS = 10_000

/** 接收方响应体最大存储长度(截断,避免超大字段) */
const MAX_RESPONSE_BODY_LENGTH = 2000

// =============================================================================
// 辅助:生成 HMAC-SHA256 签名
// =============================================================================

/**
 * 生成请求体的 HMAC-SHA256 签名(hex)。
 * 签名内容 = JSON.stringify(body),接收方用相同 secret + body 重新计算并比对。
 */
function signBody(body: string, secret: string): string {
  return createHmac('sha256', secret).update(body).digest('hex')
}

/** 生成新订阅的 secret(32 字节随机 → hex 64 字符) */
export function generateWebhookSecret(): string {
  return randomBytes(32).toString('hex')
}

// =============================================================================
// 辅助:计算下次重试时间(指数退避:2^attempt 秒)
// =============================================================================

/**
 * 指数退避:attempt=1 → +2s,attempt=2 → +4s,attempt=3 → +8s。
 * 单次最大退避 60s 防止过长。
 */
function calcNextRetryAt(attempt: number): Date {
  const seconds = Math.min(60, Math.pow(2, attempt))
  return new Date(Date.now() + seconds * 1000)
}

// =============================================================================
// 辅助:单次投递(POST + 记录响应)
// =============================================================================

interface DeliveryResult {
  ok: boolean
  status: number
  body: string
}

/**
 * POST 请求体到 webhook URL,带 X-IHUI-Signature 头。
 * 超时 10s,返回响应状态码 + 截断的响应体。
 */
async function deliver(url: string, body: string, signature: string): Promise<DeliveryResult> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), DELIVERY_TIMEOUT_MS)
  try {
    const resp = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-IHUI-Signature': `sha256=${signature}`,
      },
      body,
      signal: controller.signal,
    })
    const rawBody = await resp.text().catch(() => '')
    const truncatedBody =
      rawBody.length > MAX_RESPONSE_BODY_LENGTH
        ? rawBody.slice(0, MAX_RESPONSE_BODY_LENGTH) + '...[truncated]'
        : rawBody
    return { ok: resp.ok, status: resp.status, body: truncatedBody }
  } catch (e) {
    return { ok: false, status: 0, body: (e as Error).message || 'delivery failed' }
  } finally {
    clearTimeout(timer)
  }
}

// =============================================================================
// 1. notifyRelayEvent — 触发 webhook 通知(recordCall 后异步调)
// =============================================================================

/**
 * 触发 relay 事件 webhook 通知。
 *
 * 逻辑:
 * 1. 查用户启用的 webhook_subscriptions(events jsonb 数组包含此 event)
 * 2. 对每个 subscription:
 *    - 构造请求体 { event, data: payload, timestamp }
 *    - 生成 HMAC-SHA256 签名
 *    - POST 到 subscription.url,带 X-IHUI-Signature 头
 *    - 写 webhook_delivery_logs(attempt=1)
 *    - 成功 → status='success'
 *    - 失败 → status='retrying', nextRetryAt = now + 2^1 秒(等 retryPendingWebhooks 重试)
 *
 * 全异步,不抛错(失败只 log,不影响主链路)。
 */
export async function notifyRelayEvent(params: {
  userId: string
  event: RelayWebhookEvent
  payload: Record<string, unknown>
}): Promise<void> {
  const { userId, event, payload } = params

  // 1. 查用户启用的订阅(events 包含此 event)
  // jsonb 数组包含查询:events @> '["event"]'::jsonb
  const subscriptions = await dbRead
    .select({
      id: webhookSubscriptions.id,
      url: webhookSubscriptions.url,
      secret: webhookSubscriptions.secret,
    })
    .from(webhookSubscriptions)
    .where(
      and(
        eq(webhookSubscriptions.userId, userId),
        eq(webhookSubscriptions.enabled, true),
        sql`${webhookSubscriptions.events} @> ${JSON.stringify([event])}::jsonb`,
      ),
    )

  if (subscriptions.length === 0) return

  // 2. 对每个 subscription 投递(并行)
  await Promise.all(
    subscriptions.map(async (sub) => {
      try {
        const body = JSON.stringify({
          event,
          data: payload,
          timestamp: new Date().toISOString(),
        })
        const signature = signBody(body, sub.secret)
        const result = await deliver(sub.url, body, signature)

        // 写投递日志(attempt=1)
        const isSuccess = result.ok
        const needRetry = !isSuccess // 失败则待重试
        await db.insert(webhookDeliveryLogs).values({
          subscriptionId: sub.id,
          event,
          payload: { event, data: payload, timestamp: new Date().toISOString() },
          responseStatus: result.status,
          responseBody: result.body,
          attempt: 1,
          status: isSuccess ? 'success' : needRetry ? 'retrying' : 'failed',
          nextRetryAt: needRetry ? calcNextRetryAt(1) : null,
        })
      } catch {
        // 单个 subscription 失败不影响其他,只忽略(已写日志或投递异常)
      }
    }),
  )
}

// =============================================================================
// 2. retryPendingWebhooks — 重试到期通知(定时任务调)
// =============================================================================

/** 安全提取 db.execute 结果为数组行。 */
function toRows(raw: unknown): Record<string, unknown>[] {
  if (Array.isArray(raw)) return raw as Record<string, unknown>[]
  if (raw && typeof raw === 'object' && Array.isArray((raw as { rows?: unknown }).rows)) {
    return (raw as { rows: Record<string, unknown>[] }).rows
  }
  return []
}

/**
 * 重试到期的 webhook 投递。
 *
 * P1 修复:用乐观锁抢占(原子 UPDATE status='processing' RETURNING),防止定时任务
 * 无分布式锁导致上一次未完成就触发下一次,产生重复投递。
 *
 * G-998158(认领的时间阈复位 + 只回收自己的僵尸):
 * - 认领时间戳:webhook_delivery_logs 无独立 claimed_at/updated_at 列,复用
 *   next_retry_at 作认领时间戳 —— status='processing' 期间该列语义 = 认领时刻
 *   (结算路径按投递结果重写该列,不影响 retrying/success/failed 语义)。
 * - 每轮认领前先按时间阈复位陈旧认领(超 WEBHOOK_CLAIM_STALE_MS 未结算 = 持有者
 *   已崩溃,同 upstream 在认领事务内先复位再取 due 行);谓词含 next_retry_at
 *   IS NOT NULL,对齐 upstream 的 claimed_at IS NOT NULL 守卫。
 * - finally 兜底只回收"本轮自己认领的行"(按认领时间戳精确匹配),绝不碰其他
 *   实例阈值内的在飞认领 —— 全表无阈值退回会抢走并发在飞者的 processing 行。
 *   (认领时间戳兼作本轮所有权标记,毫秒精度;同毫秒碰撞窗口极小,且 webhook
 *   投递本身是 at-least-once 语义,退化后果只是多一次重投,可接受。)
 *
 * 逻辑:
 * 1. 时间阈复位:processing 且认领时间超阈值的行 → retrying(立即可被重认领)
 * 2. 原子 UPDATE:retrying → processing 并写认领时间戳(LIMIT 100 + SKIP LOCKED 分批)
 * 3. 批量查关联 subscription → 逐条重试;成功 → 'success';失败未耗尽 → 'retrying';耗尽 → 'failed'
 * 4. finally 兜底:只把"仍为本轮认领时间戳且仍 processing"的记录改回 retrying(防本轮中途崩溃)
 *
 * 返回处理的日志数。
 */
export async function retryPendingWebhooks(): Promise<number> {
  // 1. 时间阈复位:先收回陈旧认领,再取 due 行(同一谓词即每轮/启动回收复用的判据)
  const staleCutoff = new Date(Date.now() - WEBHOOK_CLAIM_STALE_MS)
  await db.execute(sql`
    UPDATE webhook_delivery_logs
    SET status = 'retrying', next_retry_at = now()
    WHERE status = 'processing'
      AND next_retry_at IS NOT NULL
      AND next_retry_at <= ${staleCutoff}
  `)

  // 2. 乐观锁抢占 + 写认领时间戳(next_retry_at 复用为认领时刻,见函数头注释)
  const claimStamp = new Date()
  const lockedLogsRaw = await db.execute(sql`
    UPDATE webhook_delivery_logs
    SET status = 'processing', next_retry_at = ${claimStamp}
    WHERE ctid IN (
      SELECT ctid FROM webhook_delivery_logs
      WHERE status = 'retrying' AND next_retry_at <= now()
      LIMIT 100
      FOR UPDATE SKIP LOCKED
    )
    RETURNING id, subscription_id, event, payload, attempt
  `)
  const lockedLogs = toRows(lockedLogsRaw).map((r) => ({
    id: String(r['id']),
    subscriptionId: String(r['subscription_id']),
    event: String(r['event']),
    payload: r['payload'] as Record<string, unknown>,
    attempt: Number(r['attempt']),
  }))

  if (lockedLogs.length === 0) return 0

  try {
    // 2. 批量查关联 subscription(避免 N+1)
    const subIds = [...new Set(lockedLogs.map((l) => l.subscriptionId))]
    const subs = await dbRead
      .select({
        id: webhookSubscriptions.id,
        url: webhookSubscriptions.url,
        secret: webhookSubscriptions.secret,
        enabled: webhookSubscriptions.enabled,
      })
      .from(webhookSubscriptions)
      .where(sql`${webhookSubscriptions.id} IN ${subIds}`)

    const subMap = new Map(subs.map((s) => [s.id, s]))

    // 3. 逐条重试(并行)
    await Promise.all(
      lockedLogs.map(async (log) => {
        const sub = subMap.get(log.subscriptionId)
        // subscription 已删除或已禁用 → 标记 failed
        if (!sub || !sub.enabled) {
          await db
            .update(webhookDeliveryLogs)
            .set({ status: 'failed', responseBody: 'subscription deleted or disabled' })
            .where(eq(webhookDeliveryLogs.id, log.id))
          return
        }

        const nextAttempt = log.attempt + 1
        // payload 已是 { event, data, timestamp } 结构,直接 stringify
        const body = JSON.stringify(log.payload)
        const signature = signBody(body, sub.secret)
        const result = await deliver(sub.url, body, signature)

        const isSuccess = result.ok
        const exhausted = nextAttempt >= MAX_ATTEMPTS

        await db
          .update(webhookDeliveryLogs)
          .set({
            responseStatus: result.status,
            responseBody: result.body,
            attempt: nextAttempt,
            status: isSuccess ? 'success' : exhausted ? 'failed' : 'retrying',
            nextRetryAt: isSuccess || exhausted ? null : calcNextRetryAt(nextAttempt),
          })
          .where(eq(webhookDeliveryLogs.id, log.id))
      }),
    )
  } finally {
    // 4. 兜底:只回收"本轮自己认领"的行(认领时间戳 = 本轮 claimStamp 且仍 processing);
    //    不做全表无阈值退回 —— 其他实例阈值内的在飞 processing 行不被本轮抢走。
    //    被回收的行 next_retry_at 仍为本轮认领时刻(<= now),立即可被下一轮重认领。
    await db
      .update(webhookDeliveryLogs)
      .set({ status: 'retrying' })
      .where(
        and(
          eq(webhookDeliveryLogs.status, 'processing'),
          eq(webhookDeliveryLogs.nextRetryAt, claimStamp),
        ),
      )
  }

  return lockedLogs.length
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
