// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * webhook 认领的时间阈复位 + 只回收自己的僵尸 — 真实 DB 集成测试(出处 b76-12e G-998158)。
 *
 * 判据(票面验收草案):
 * ① 时间阈复位:一行 status='processing'、认领时间 = now-11min(超 WEBHOOK_CLAIM_STALE_MS),
 *    retryPendingWebhooks() 必须先把它复位回 retrying 并纳入本轮候选,返回值行数 +1。
 * ② 竞态回归:手工插一行 status='processing'、认领时间 = now(模拟另一实例刚抢占、阈值内),
 *    跑完一轮后该行必须仍是 processing(现行全表无阈值 finally 会把它抢回 retrying)。
 *
 * 注:webhook_delivery_logs 无独立 updated_at 列,认领时间复用 next_retry_at
 * (status='processing' 期间该列语义 = 认领时刻,见 webhook-relay-notifier.ts 函数头注释)。
 * 跑法:cd apps/api && node node_modules/vitest/vitest.mjs run --config vitest.real.config.ts tests/webhook-claim-stale.real.test.ts
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { randomUUID } from 'node:crypto'
import { sql, eq } from 'drizzle-orm'
import { db } from '../src/db/index.js'
import { webhookSubscriptions, webhookDeliveryLogs } from '@ihui/database'
import { retryPendingWebhooks, WEBHOOK_CLAIM_STALE_MS } from '../src/services/webhook-relay-notifier.js'

/** 快速失败 URL(discard 端口,连接即拒),避免测试触真网。 */
const DEAD_URL = 'http://127.0.0.1:9/webhook'

async function insertSub(): Promise<string> {
  const rows = await db
    .insert(webhookSubscriptions)
    .values({
      userId: randomUUID(),
      url: DEAD_URL,
      secret: 'test-secret',
      events: ['relay.call.completed'],
    })
    .returning({ id: webhookSubscriptions.id })
  return rows[0]!.id
}

async function insertLog(subId: string, status: string, nextRetryAt: Date | null): Promise<string> {
  const rows = await db
    .insert(webhookDeliveryLogs)
    .values({
      subscriptionId: subId,
      event: 'relay.call.completed',
      payload: { event: 'relay.call.completed', data: {} },
      attempt: 1,
      status,
      nextRetryAt,
    })
    .returning({ id: webhookDeliveryLogs.id })
  return rows[0]!.id
}

async function readLog(id: string): Promise<webhookDeliveryLogsRow> {
  const rows = await db
    .select()
    .from(webhookDeliveryLogs)
    .where(eq(webhookDeliveryLogs.id, id))
  return rows[0]!
}
type webhookDeliveryLogsRow = typeof webhookDeliveryLogs.$inferSelect

describe('retryPendingWebhooks — 认领的时间阈复位 + 只回收自己的僵尸', () => {
  beforeEach(async () => {
    await db.execute(sql`DELETE FROM webhook_delivery_logs`)
    await db.execute(sql`DELETE FROM webhook_subscriptions`)
  })

  it('① 超 11min 的僵尸认领被时间阈复位并纳入本轮候选(返回值 +1)', async () => {
    const subId = await insertSub()
    const zombieId = await insertLog(
      subId,
      'processing',
      new Date(Date.now() - WEBHOOK_CLAIM_STALE_MS - 60_000), // 认领于 now-11min
    )

    const processed = await retryPendingWebhooks()
    expect(processed).toBe(1) // 僵尸被复位后重认领,本轮候选恰 +1

    const zombie = await readLog(zombieId)
    // 已被本轮重处理:attempt 1→2,投递失败未耗尽 → retrying(不再是滞留的 processing)
    expect(zombie.attempt).toBe(2)
    expect(zombie.status).toBe('retrying')
  })

  it('② 阈值内的他实例在飞认领不被本轮抢回(仍 processing、认领时间未改写)', async () => {
    const subId = await insertSub()
    // 另一实例刚抢占的行(阈值内):processing + 认领时间 = now-1.5s
    const foreignStamp = new Date(Date.now() - 1_500)
    const foreignId = await insertLog(subId, 'processing', foreignStamp)
    // 再插一行到期的 retrying,让本轮真正跑起来(finally 兜底路径必被触发)
    await insertLog(subId, 'retrying', new Date(Date.now() - 1_000))

    await retryPendingWebhooks()

    const foreign = await readLog(foreignId)
    expect(foreign.status).toBe('processing') // 现行全表 finally 会把它改回 retrying —— 本断言即竞态回归
    expect(foreign.nextRetryAt).toEqual(foreignStamp) // 认领时间戳未被本轮改写
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
