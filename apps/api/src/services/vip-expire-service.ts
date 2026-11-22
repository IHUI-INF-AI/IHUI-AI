// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

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

import { eq, and, lt, gt, inArray, notExists, sql } from 'drizzle-orm'
import { db } from '../db/index.js'
import { userVips, users } from '@ihui/database'

export interface VipExpireResult {
  scanned: number
  expiredVips: number
  downgradedUsers: number
  errors: string[]
}

/**
 * F-232:降级判定的纯函数镜像(离线可断言,不碰 DB)。
 *
 * 唯一判据 —— 只有「本轮出现过期记录」且「已无任何未过期 VIP」的用户才进候选集:
 * - 仍持有未过期 VIP(降级窗口内续费)的用户不在集合里;
 * - 没有任何 VIP 记录的用户压根不在到期集合里,保持 users.is_vip 原状,绝不被误降。
 * 生产实现由下方 `expireVipMembers` 的第二条集合 SQL(NOT EXISTS 未过期 VIP)落地,
 * 两者语义必须一致;该函数只用于回归测试锁定判据,不参与线上写路径。
 */
export function collectVipDowngradeCandidates(
  expiredUserIds: readonly string[],
  activeVipCountByUser: ReadonlyMap<string, number>,
): string[] {
  const candidates: string[] = []
  const seen = new Set<string>()
  for (const userId of expiredUserIds) {
    if (seen.has(userId)) continue
    seen.add(userId)
    if ((activeVipCountByUser.get(userId) ?? 0) === 0) candidates.push(userId)
  }
  return candidates
}

/**
 * VIP 过期降级邮件通知(fire-and-forget,失败不阻塞每日降级任务)。
 * 动态 import 避免与 db 层循环依赖;信号红警示 + 续费按钮。
 */
async function notifyVipExpired(userId: string, expiredAt: Date): Promise<void> {
  try {
    const [{ findUserById }, { sendEmail }, { renderVipExpireEmail, resolveWebOrigin }] =
      await Promise.all([
        import('../db/queries.js'),
        import('./email-service.js'),
        import('./email-templates.js'),
      ])
    const user = await findUserById(userId)
    if (!user?.email) return
    const mail = renderVipExpireEmail({
      userName: user.nickname ?? undefined,
      expiredAt: expiredAt.toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai', hour12: false }),
      renewUrl: `${resolveWebOrigin()}/vip`,
    })
    await sendEmail({
      to: user.email,
      subject: mail.subject,
      html: mail.html,
      text: mail.text,
      scene: 'notification',
      userId,
    })
  } catch {
    /* 到期通知失败不阻塞降级任务 */
  }
}

/** VIP 到期短信通知(与邮件并列,fire-and-forget)。动态 import 避免循环依赖。
 *  bizId 用「用户 + 到期时刻」:同一期会员只通知一次,续费后再到期是新事件。 */
async function notifyVipExpiredSms(userId: string, expiredAt: Date): Promise<void> {
  try {
    const { sendNoticeSmsToUser } = await import('./sms-notify.js')
    await sendNoticeSmsToUser(userId, 'membership-expiry', {
      bizType: 'vip',
      bizId: `vip:${userId}:${expiredAt.toISOString()}`,
    })
  } catch {
    /* 短信通知失败不阻塞降级任务 */
  }
}

export async function expireVipMembers(): Promise<VipExpireResult> {
  const errors: string[] = []
  let expiredVips = 0
  let downgradedUsers = 0
  const now = new Date()

  try {
    // F-232:两条集合 SQL 在同一事务内完成「到期 + 降级/通知」。
    // 旧实现先全表加载过期记录再逐条 update、逐用户查一次再逐个覆盖 is_vip:
    // 续费用户在两条语句之间写入的 status=1 卡片会被「查不到就置 0」覆盖误降。
    const outcome = await db.transaction(async (tx) => {
      // ① 到期:集合式更新,只把本轮过期的 user_id / end_time 取回内存(无逐条 UPDATE)
      const expiredRows = await tx
        .update(userVips)
        .set({ status: 0 })
        .where(and(eq(userVips.status, 1), lt(userVips.endTime, now)))
        .returning({ userId: userVips.userId, endTime: userVips.endTime })

      const userIds = [...new Set(expiredRows.map((r) => r.userId))]
      if (userIds.length === 0) return { expiredRows, downgradedIds: [] as string[] }

      // ② 降级:唯一判据 = 该用户已无任何未过期 VIP(status=1 且 end_time > now),
      //    而不是「某条 VIP 记录刚过期」;窗口内续费的用户被 NOT EXISTS 保护。
      const downgraded = await tx
        .update(users)
        .set({ isVip: 0 })
        .where(
          and(
            inArray(users.id, userIds),
            notExists(
              tx
                .select({ one: sql`1` })
                .from(userVips)
                .where(
                  and(
                    eq(userVips.userId, users.id),
                    eq(userVips.status, 1),
                    gt(userVips.endTime, now),
                  ),
                ),
            ),
          ),
        )
        .returning({ id: users.id })

      return { expiredRows, downgradedIds: downgraded.map((r) => r.id) }
    })

    expiredVips = outcome.expiredRows.length
    downgradedUsers = outcome.downgradedIds.length

    // ③ 通知只发给真正被降级的用户;到期时刻取本轮该用户最晚的一条过期记录
    if (outcome.downgradedIds.length > 0) {
      const downgradedSet = new Set(outcome.downgradedIds)
      const expiredEndTimes = new Map<string, Date>()
      for (const row of outcome.expiredRows) {
        if (!downgradedSet.has(row.userId)) continue
        const prev = expiredEndTimes.get(row.userId)
        if (!prev || row.endTime > prev) expiredEndTimes.set(row.userId, row.endTime)
      }
      for (const userId of downgradedSet) {
        const expiredAt = expiredEndTimes.get(userId)
        if (!expiredAt) continue
        void notifyVipExpired(userId, expiredAt)
        void notifyVipExpiredSms(userId, expiredAt)
      }
    }
  } catch (err) {
    // 事务整体失败:不部分提交,记录后由定时任务下一轮重试
    errors.push(`Failed to expire VIP members: ${String(err)}`)
  }

  return { scanned: expiredVips, expiredVips, downgradedUsers, errors }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
