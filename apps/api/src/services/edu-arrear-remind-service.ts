// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​‌‌‌​‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​​

import { and, eq, gte, gt, isNull, ne, sql } from 'drizzle-orm'
import { db } from '../db/index.js'
import { createNotification } from '../db/notification-queries.js'
import { eduEnrollment, eduFeeReminder, users } from '@ihui/database'
import {
  isSubscribeMessageConfigured,
  getWechatMiniOpenId,
  buildFeeReminderData,
  sendSubscribeMessage,
} from './wechat-subscribe-message.js'

/**
 * 教育欠费自动催费提醒服务（每日定时扫描）。
 *
 * 由 scheduler 队列 'edu-arrear-remind-daily'（每日北京时间 09:00）驱动：
 * 1. 扫描全部未删除、非退费状态、且 totalFee > paidAmount 的报名记录；
 * 2. 幂等防重：同一报名记录当日（北京时间 0 点起）已有任意催费记录（含手动发送）则跳过；
 * 3. 落库 edu_fee_reminder 留痕（channel=in_app、operator 为空表示系统自动），
 *    并通过 createNotification 发站内信；通知失败仅标记 status='failed' 不回滚留痕。
 * 4. 微信订阅消息尽力外发（需用户在小程序内已订阅授权；一次性授权消耗后不可再发）。
 */

export interface ArrearRemindResult {
  scanned: number
  reminded: number
  skippedToday: number
  notifyFailed: number
  wxSent: number
  wxFailed: number
}

/** 催费默认文案（与手动催费端点保持一致） */
function defaultReminderMessage(studentName: string, dueAmount: number): string {
  return `【学费催缴】${studentName} 同学本学期尚有学费 ${dueAmount} 元未缴清,请尽快完成缴费。如有疑问请联系机构老师。`
}

/** 北京时间当日 0 点（返回 UTC Date） */
function beijingMidnightUtc(): Date {
  const bjNow = new Date(Date.now() + 8 * 3600 * 1000)
  const bjDate = bjNow.toISOString().slice(0, 10)
  return new Date(Date.parse(`${bjDate}T00:00:00+08:00`))
}

export async function scanAndRemindArrears(): Promise<ArrearRemindResult> {
  const result: ArrearRemindResult = {
    scanned: 0,
    reminded: 0,
    skippedToday: 0,
    notifyFailed: 0,
    wxSent: 0,
    wxFailed: 0,
  }

  // 欠费名单:未删除、非退费、欠费 > 0 的报名记录(实时计算欠费快照)
  const arrears = await db
    .select({
      enrollmentId: eduEnrollment.id,
      studentId: eduEnrollment.studentId,
      studentName: users.nickname,
      dueAmount: sql<number>`${eduEnrollment.totalFee} - ${eduEnrollment.paidAmount}`,
    })
    .from(eduEnrollment)
    .innerJoin(users, eq(eduEnrollment.studentId, users.id))
    .where(
      and(
        isNull(eduEnrollment.deletedAt),
        ne(eduEnrollment.status, 'withdrawn'),
        gt(sql`${eduEnrollment.totalFee} - ${eduEnrollment.paidAmount}`, 0),
      ),
    )
  result.scanned = arrears.length
  if (arrears.length === 0) return result

  // 当日已提醒的报名记录(含手动发送):同报名记录当日不重复打扰
  const sentTodayRows = await db
    .select({ enrollmentId: eduFeeReminder.enrollmentId })
    .from(eduFeeReminder)
    .where(gte(eduFeeReminder.createdAt, beijingMidnightUtc()))
  const sentToday = new Set(
    sentTodayRows.map((r) => r.enrollmentId).filter((id): id is string => id !== null),
  )

  for (const item of arrears) {
    if (sentToday.has(item.enrollmentId)) {
      result.skippedToday += 1
      continue
    }
    const dueAmount = Number(item.dueAmount) || 0
    if (dueAmount <= 0) continue
    const message = defaultReminderMessage(item.studentName ?? '学员', dueAmount)

    // 留痕(operator 为空表示系统自动发送)
    const [row] = await db
      .insert(eduFeeReminder)
      .values({
        studentId: item.studentId,
        enrollmentId: item.enrollmentId,
        dueAmount,
        channel: 'in_app',
        status: 'sent',
        message,
      })
      .returning()
    result.reminded += 1

    // 微信订阅消息尽力外发(需用户已订阅授权;失败不影响站内信兜底)
    if (isSubscribeMessageConfigured()) {
      try {
        const openId = await getWechatMiniOpenId(item.studentId)
        if (openId) {
          const wxRes = await sendSubscribeMessage(
            openId,
            buildFeeReminderData(item.studentName ?? '学员', dueAmount),
            '/pkg-user/message/index',
          )
          if (wxRes.ok) result.wxSent += 1
          else result.wxFailed += 1
        } else {
          result.wxFailed += 1
        }
      } catch {
        result.wxFailed += 1
      }
    }

    // 站内信必达,失败仅标记 failed 不回滚留痕
    try {
      await createNotification({
        userId: item.studentId,
        type: 'arrear_remind',
        title: '学费催缴提醒',
        content: message,
        data: { enrollmentId: item.enrollmentId, dueAmount, source: 'auto_daily' },
      })
    } catch {
      result.notifyFailed += 1
      if (row) {
        await db
          .update(eduFeeReminder)
          .set({ status: 'failed', updatedAt: new Date() })
          .where(eq(eduFeeReminder.id, row.id))
      }
    }
  }

  return result
}
