// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍‌​‌‌​‌‌​​‌‌​‍​‌​‌​​​‌‍​​‌​‌​​‌‌‍​​‌​‌​​‌‍​​‌​​​‌​‍​​‌​‌​‌​‍​​‌​‌‌​‌‍​​‌​‌‌​‌‍​​‌​‌‌​‌‍​⁠

/**
 * 发布 API 独立计费账本。
 *
 * 与 audit_logs 分开：
 * - audit_logs 记 HTTP 请求（含失败、读、参数摘要）；
 * - 本账本只在开放能力真正创建任务成功后写入一行，绑定 task_id 与 API Key。
 *
 * 第一版没有金额列：定价、结算账户、作者分成尚未落地，先保证计量单位可追溯。
 */
import { and, desc, eq, sql } from 'drizzle-orm'
import { db } from '../db/index.js'
import { developerApiKeys, publishApiUsageRecords } from '@ihui/database'

export interface RecordPublishUsageInput {
  apiKeyId: string
  userId: string
  taskId: string
  statusCode: number
  action?: 'task.create' | 'task.read'
  units?: number
}

/** 写一条计费账本；同一 Key 同一动作同一 task 幂等。失败不抛给发布主链路。 */
export async function recordPublishUsage(input: RecordPublishUsageInput): Promise<boolean> {
  if (!input.apiKeyId || !input.userId || !input.taskId) return false
  const inserted = await db
    .insert(publishApiUsageRecords)
    .values({
      apiKeyId: input.apiKeyId,
      userId: input.userId,
      capabilityScope: 'publish:submit',
      action: input.action ?? 'task.create',
      taskId: input.taskId,
      statusCode: input.statusCode,
      units: input.units ?? 1,
    })
    .onConflictDoNothing()
    .returning({ id: publishApiUsageRecords.id })
  return inserted.length > 0
}

export interface PublishUsageSummary {
  units: number
  records: number
  lastUsedAt: Date | null
  items: Array<{
    id: string
    action: string
    taskId: string | null
    statusCode: number
    units: number
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
      createdAt: publishApiUsageRecords.createdAt,
    })
    .from(publishApiUsageRecords)
    .where(eq(publishApiUsageRecords.apiKeyId, apiKeyId))
    .orderBy(desc(publishApiUsageRecords.createdAt))
    .limit(Math.min(Math.max(limit, 1), 100))

  return {
    units: agg?.units ?? 0,
    records: agg?.records ?? 0,
    lastUsedAt: agg?.lastUsedAt ? new Date(agg.lastUsedAt as unknown as string) : null,
    items,
  }
}
