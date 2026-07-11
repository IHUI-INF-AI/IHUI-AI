/**
 * 活动到期自动关闭服务（backing service for activity-status-hourly 定时任务）。
 * 迁移自旧架构 ai-smart-society-java/ruoyi-modules/ruoyi-job/ActivityStatusTask.java (M-86)。
 *
 * 每小时检测到期活动，将 status='published' 且 end_at < now() 的活动更新为 status='ended'。
 *
 * 旧架构采用惰性读取过滤（前端按时间计算展示态），但数据库 status 永不自动更新，
 * 导致大量已过期活动仍为 published 状态，影响管理端筛选和数据一致性。
 */

import { eq, and, lt } from 'drizzle-orm'
import { db } from '../db/index.js'
import { activities } from '@ihui/database'

export interface ActivityStatusResult {
  scanned: number
  endedActivities: number
  errors: string[]
}

export async function autoCloseExpiredActivities(): Promise<ActivityStatusResult> {
  const errors: string[] = []

  // 1. 查询所有已过期但状态仍为 published 的活动
  const expiredActivities = await db
    .select({
      id: activities.id,
      title: activities.title,
    })
    .from(activities)
    .where(and(eq(activities.status, 'published'), lt(activities.endAt, new Date())))

  const scanned = expiredActivities.length

  if (scanned === 0) {
    return { scanned: 0, endedActivities: 0, errors: [] }
  }

  // 2. 批量更新活动状态为 ended
  let endedActivities = 0
  for (const activity of expiredActivities) {
    try {
      await db.update(activities).set({ status: 'ended' }).where(eq(activities.id, activity.id))
      endedActivities++
    } catch (err) {
      errors.push(`Failed to end activity ${activity.id} (${activity.title}): ${String(err)}`)
    }
  }

  return { scanned, endedActivities, errors }
}
