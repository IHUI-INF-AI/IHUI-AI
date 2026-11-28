// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠


/**
 * 发布 API 独立计费账本。
 *
 * 与 audit_logs 分开：
 * - audit_logs 记 HTTP 请求（含失败、读、参数摘要）；
 * - 本账本只在开放能力真正创建任务成功后写入一行，绑定 task_id 与 API Key。
 *
 * 第一版价格默认 0（免费期），但单价与金额在写入时快照，调价不改历史行。
 */
import { and, desc, eq, sql } from 'drizzle-orm'
import { db } from '../db/index.js'
import { developerApiKeys, publishApiUsageRecords } from '@ihui/database'

/** 发布任务单价（分）。免费期默认 0；无效配置回落 0，不因环境变量写坏账本。 */
export function resolvePublishUnitPriceCents(): number {
  const raw = Number(process.env.PUBLISH_TASK_UNIT_PRICE_CENTS ?? '0')
  return Number.isInteger(raw) && raw >= 0 ? raw : 0
}

export interface RecordPublishUsageInput {
  apiKeyId: string
  userId: string
  taskId: string
  statusCode: number
  action?: 'task.create' | 'task.read'
  units?: number
  unitPriceCents?: number
  currency?: string
}

/** 写一条计费账本；同一 Key 同一动作同一 task 幂等。失败不抛给发布主链路。 */
export async function recordPublishUsage(input: RecordPublishUsageInput): Promise<boolean> {
  if (!input.apiKeyId || !input.userId || !input.taskId) return false
  const units = input.units ?? 1
  const unitPriceCents = input.unitPriceCents ?? resolvePublishUnitPriceCents()
  const inserted = await db
    .insert(publishApiUsageRecords)
    .values({
      apiKeyId: input.apiKeyId,
      userId: input.userId,
      capabilityScope: 'publish:submit',
      action: input.action ?? 'task.create',
      taskId: input.taskId,
      statusCode: input.statusCode,
      units,
      unitPriceCents,
      amountCents: units * unitPriceCents,
      currency: input.currency ?? 'CNY',
    })
    .onConflictDoNothing()
    .returning({ id: publishApiUsageRecords.id })
  return inserted.length > 0
}

export interface PublishUsageSummary {
  units: number
  amountCents: number
  currency: string
  unitPriceCents: number
  records: number
  lastUsedAt: Date | null
  items: Array<{
    id: string
    action: string
    taskId: string | null
    statusCode: number
    units: number
    unitPriceCents: number
    amountCents: number
    currency: string
    createdAt: Date
  }>
}

/** 按 Key 读账本；带归属权校验，非本人 Key 返回 null。 */
export async function getPublishUsage(
  apiKeyId: string,
  userId: string,
  limit = 20,
): Promise<PublishUsageSummary | null> {
  const [key] = await db
    .select({ id: developerApiKeys.id })
    .from(developerApiKeys)
    .where(and(eq(developerApiKeys.id, apiKeyId), eq(developerApiKeys.userId, userId)))
    .limit(1)
  if (!key) return null

  const [agg] = await db
    .select({
      units: sql<number>`coalesce(sum(${publishApiUsageRecords.units}), 0)::int`,
      amountCents: sql<number>`coalesce(sum(${publishApiUsageRecords.amountCents}), 0)::int`,
      records: sql<number>`count(*)::int`,
      lastUsedAt: sql<Date | null>`max(${publishApiUsageRecords.createdAt})`,
    })
    .from(publishApiUsageRecords)
    .where(eq(publishApiUsageRecords.apiKeyId, apiKeyId))

  const items = await db
    .select({
      id: publishApiUsageRecords.id,
      action: publishApiUsageRecords.action,
      taskId: publishApiUsageRecords.taskId,
      statusCode: publishApiUsageRecords.statusCode,
      units: publishApiUsageRecords.units,
      unitPriceCents: publishApiUsageRecords.unitPriceCents,
      amountCents: publishApiUsageRecords.amountCents,
      currency: publishApiUsageRecords.currency,
      createdAt: publishApiUsageRecords.createdAt,
    })
    .from(publishApiUsageRecords)
    .where(eq(publishApiUsageRecords.apiKeyId, apiKeyId))
    .orderBy(desc(publishApiUsageRecords.createdAt))
    .limit(Math.min(Math.max(limit, 1), 100))

  return {
    units: agg?.units ?? 0,
    amountCents: agg?.amountCents ?? 0,
    currency: items[0]?.currency ?? 'CNY',
    unitPriceCents: items[0]?.unitPriceCents ?? resolvePublishUnitPriceCents(),
    records: agg?.records ?? 0,
    lastUsedAt: agg?.lastUsedAt ? new Date(agg.lastUsedAt as unknown as string) : null,
    items,
  }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
