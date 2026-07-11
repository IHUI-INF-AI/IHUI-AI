/**
 * VIP 会员过期自动降级服务（backing service for vip-expire-daily 定时任务）。
 * 迁移自旧架构 ai-smart-society-java/ruoyi-modules/ruoyi-job/UserVipExpireTask.java (M-86)。
 *
 * 每日检测 VIP 已过期的用户：
 * 1. 将 user_vips 表中 status=1 且 end_time < now() 的记录更新为 status=0（过期）
 * 2. 同时将 users 表中关联用户的 is_vip 字段重置为 0（降级为普通用户）
 *
 * 旧架构采用惰性读取过滤（查询时 WHERE status=1 AND end_time >= now()），
 * 但 users.is_vip 字段永不自动重置，导致依赖该字段的业务逻辑（如佣金计算）误判。
 */

import { eq, and, lt } from 'drizzle-orm'
import { db } from '../db/index.js'
import { userVips, users } from '@ihui/database'

export interface VipExpireResult {
  scanned: number
  expiredVips: number
  downgradedUsers: number
  errors: string[]
}

export async function expireVipMembers(): Promise<VipExpireResult> {
  const errors: string[] = []
  let expiredVips = 0
  let downgradedUsers = 0

  // 1. 查询所有已过期但状态仍为生效的 VIP 记录
  const expiredRecords = await db
    .select({
      id: userVips.id,
      userId: userVips.userId,
    })
    .from(userVips)
    .where(and(eq(userVips.status, 1), lt(userVips.endTime, new Date())))

  const scanned = expiredRecords.length

  if (scanned === 0) {
    return { scanned: 0, expiredVips: 0, downgradedUsers: 0, errors: [] }
  }

  // 2. 批量更新 VIP 记录状态为过期（status=0）
  for (const record of expiredRecords) {
    try {
      await db.update(userVips).set({ status: 0 }).where(eq(userVips.id, record.id))
      expiredVips++
    } catch (err) {
      errors.push(`Failed to expire VIP record ${record.id}: ${String(err)}`)
    }
  }

  // 3. 检查这些用户是否还有其他生效的 VIP 记录，如果没有则降级 users.is_vip
  const userIds = [...new Set(expiredRecords.map((r) => r.userId))]
  for (const userId of userIds) {
    try {
      // 查询该用户是否还有其他生效的 VIP
      const [activeVip] = await db
        .select({ id: userVips.id })
        .from(userVips)
        .where(and(eq(userVips.userId, userId), eq(userVips.status, 1)))
        .limit(1)

      // 如果没有其他生效的 VIP，将 users.is_vip 降级为 0
      if (!activeVip) {
        await db.update(users).set({ isVip: 0 }).where(eq(users.id, userId))
        downgradedUsers++
      }
    } catch (err) {
      errors.push(`Failed to downgrade user ${userId}: ${String(err)}`)
    }
  }

  return { scanned, expiredVips, downgradedUsers, errors }
}
