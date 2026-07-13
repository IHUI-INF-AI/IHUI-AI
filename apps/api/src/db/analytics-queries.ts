import { db } from './index.js'
import { analyticsEvents, type AnalyticsEvent } from '@ihui/database'

export interface CreateAnalyticsEventInput {
  userId?: string | null
  event: string
  properties?: unknown
  ip?: string | null
  userAgent?: string | null
}

export async function createAnalyticsEvent(
  data: CreateAnalyticsEventInput,
): Promise<AnalyticsEvent> {
  const rows = await db
    .insert(analyticsEvents)
    .values({
      userId: data.userId,
      event: data.event,
      properties: data.properties,
      ip: data.ip,
      userAgent: data.userAgent,
    })
    .returning()
  const row = rows[0]
  if (!row) throw new Error('创建分析事件失败')
  return row
}
