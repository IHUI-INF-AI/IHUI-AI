// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 教育欠费自动催费提醒服务（每日定时扫描）。
 *
 * 由 scheduler 队列 'edu-arrear-remind-daily'（每日北京时间 09:00）驱动：
 * 1. 扫描未删除、非退费状态、且欠费 > 0 的报名记录；欠费金额一律取自账目出口
 *    (edu-ledger)，不在这里重复写算式 —— 本文件的旧版自己写了一遍 totalFee-paidAmount,
 *    那是"8 处各自表达欠费"的其中一处。
 * 2. 幂等防重：同一报名记录当日（北京时间 0 点起）已有任意催费记录（含手动发送）则跳过。
 * 3. 落库 edu_fee_reminder 留痕（channel=in_app、operator 为空表示系统自动）。
 * 4. 站内信 + 微信订阅消息**逐个收件人**发：收件人 = 学员本人 + 已确认绑定的家长。
 *
 * ## 本版本修掉的三件事（旧版每一件事都表现为"安静"）
 * ① 旧版只发给 `enrollment.studentId`,而 schema 里那张家长绑定表
 *    (edu_parent_student_binding, status=confirmed) **从未被任何通知逻辑读过** ——
 *    但它的表注释写着"通知学生/家长"。培训场景掏钱的是家长,发给学员本人等于没发。
 * ② 旧版在未配置微信时 `if (isSubscribeMessageConfigured())` 整块跳过,
 *    **连一个计数都不加、一行日志都不写** ⇒ 报表上看不出"这一整天一条微信都没发出去"。
 *    现在 notConfigured / noOpenid / userRefused 各自计一档。
 * ③ 旧版把微信 errcode 43101（用户未订阅/额度耗尽）与真实发送失败混成一档 wxFailed,
 *    于是"用户根本没授权"被读成"发送出问题了",排查方向从第一步就错。
 *    43101 单独记 userRefused —— 它是**触达前置条件缺失**,不是故障。
 *
 * 到期分级（overdue / dueSoon）来自账期表;没有账期数据的报名仍按欠费额提醒(向后兼容),
 * 只是文案不带"逾期 N 天" —— 没排期就不假装知道到期日。
 */

import { and, asc, eq, gte, inArray, isNull, ne } from 'drizzle-orm'
import { eduEnrollment, eduFeeReminder, eduParentStudentBinding, users } from '@ihui/database'
import { db } from '../db/index.js'
import { createNotification } from '../db/notification-queries.js'
import { logger } from '../utils/logger.js'
import { DUE_SOON_LEAD_DAYS, hasArrearsCond, loadEnrollmentLedger } from './edu-ledger.js'
import { isSmsConfigured, sendSmsMessage } from './sms.js'
import {
  isSubscribeMessageConfigured,
  getWechatMiniOpenId,
  buildFeeReminderData,
  sendSubscribeMessage,
} from './wechat-subscribe-message.js'

export interface ArrearRemindResult {
  scanned: number
  reminded: number
  skippedToday: number
  notifyFailed: number
  /** 实际发出的收件人总数（学员 + 家长） */
  recipients: number
  /** 其中家长收件人数量 —— 旧版这个数永远是 0,而没人看得见 */
  parentRecipients: number
  wxSent: number
  /** 真实发送失败（网络、模板字段不符、签名错等） */
  wxFailed: number
  /** 服务端未配置订阅消息:整个微信通道不具备发送条件 */
  wxNotConfigured: number
  /** 配置在,但该收件人没有 openid（没在小程序登录过 / 未授权） */
  wxNoOpenid: number
  /** errcode 43101 一类:用户未订阅或一次性额度已耗尽 */
  wxUserRefused: number
  /** 短信通道四档(2026-09-29 接上真实发送;此前 channel='sms' 只是写进留痕的意图标记) */
  smsSent: number
  smsFailed: number
  smsNotConfigured: number
  smsNoPhone: number
  /** 回执写回失败次数:不影响催缴本身,但必须可见 —— 否则"回执空白"会被读成"没人被触达" */
  deliveryWriteFailed: number
  overdueCount: number
  dueSoonCount: number
  /** 无账期数据、只能按"欠多少"提醒的报名数 */
  withoutSchedule: number
}

/** 微信"未授权/额度耗尽"的稳定错误码,单独成档不与真故障并桶 */
const WX_ERRCODE_NOT_SUBSCRIBED = 43101

/** 催费文案（按到期状态分档;与手动催费共用一份构造,不得各写一遍） */
function buildReminderMessage(
  studentName: string,
  dueAmount: number,
  overdueDays: number,
  dueDate: string | null,
): string {
  if (overdueDays > 0) {
    return `【学费催缴】${studentName} 同学本学期学费 ${dueAmount} 元已逾期 ${overdueDays} 天未缴清,请尽快完成缴费。如有疑问请联系机构老师。`
  }
  if (dueDate) {
    return `【缴费提醒】${studentName} 同学有一笔 ${dueAmount} 元学费将于 ${dueDate} 到期,请提前安排缴费。如有疑问请联系机构老师。`
  }
  return `【学费催缴】${studentName} 同学尚有学费 ${dueAmount} 元未缴清,请尽快完成缴费。如有疑问请联系机构老师。`
}

/** 北京时间当日 0 点（返回 UTC Date） */
function beijingMidnightUtc(): Date {
  const bjNow = new Date(Date.now() + 8 * 3600 * 1000)
  const bjDate = bjNow.toISOString().slice(0, 10)
  return new Date(Date.parse(`${bjDate}T00:00:00+08:00`))
}

export interface ReminderRecipient {
  userId: string
  role: 'student' | 'parent'
  /** 收件人手机号;null = 该用户没留手机号,短信通道对它结构性不可达(必须计数,不得静默) */
  phone: string | null
}

/**
 * 解析催费收件人：学员本人 + 该学员**已确认绑定**的家长（去重）。
 * status 只认 'confirmed' —— pending 的绑定还没被家长承认,发给它等于发给陌生人。
 */
export async function resolveReminderRecipients(studentId: string): Promise<ReminderRecipient[]> {
  const ids = [studentId]
  const rows = await db
    .select({ parentId: eduParentStudentBinding.parentId })
    .from(eduParentStudentBinding)
    .where(
      and(
        eq(eduParentStudentBinding.studentId, studentId),
        eq(eduParentStudentBinding.status, 'confirmed'),
        isNull(eduParentStudentBinding.deletedAt),
      ),
    )
  const seen = new Set<string>([studentId])
  for (const r of rows) {
    if (seen.has(r.parentId)) continue
    seen.add(r.parentId)
    ids.push(r.parentId)
  }
  // 一次性取手机号(不逐个查):短信通道要按收件人各自的花名册号码发,
  // 家长号码常与学生号码不同 —— 只按 student.phone 发等于给没付钱的人发。
  const phoneRows = await db
    .select({ id: users.id, phone: users.phone })
    .from(users)
    .where(inArray(users.id, ids))
  const phoneById = new Map(phoneRows.map((u) => [u.id, u.phone ?? null]))
  return ids.map((id) => ({
    userId: id,
    role: id === studentId ? ('student' as const) : ('parent' as const),
    phone: phoneById.get(id) ?? null,
  }))
}

interface ChannelOutcome {
  sent: boolean
  bucket: 'sent' | 'failed' | 'not_configured' | 'no_openid' | 'user_refused'
  detail?: string
}

/**
 * 对一个收件人尽力发微信订阅消息。
 * 返回的是**分档结论**而不是布尔 —— 调用方要能把"没配置""没 openid""没授权"
 * 三种情况分别报出来,否则这三种在账面上长得一模一样。
 */
async function sendWxToRecipient(
  recipient: ReminderRecipient,
  studentName: string,
  dueAmount: number,
): Promise<ChannelOutcome> {
  if (!isSubscribeMessageConfigured()) {
    return { sent: false, bucket: 'not_configured' }
  }
  try {
    const openId = await getWechatMiniOpenId(recipient.userId)
    if (!openId) return { sent: false, bucket: 'no_openid' }
    const res = await sendSubscribeMessage(
      openId,
      buildFeeReminderData(studentName, dueAmount),
      '/pkg-user/bill/index',
    )
    if (res.ok) return { sent: true, bucket: 'sent' }
    if (res.errcode === WX_ERRCODE_NOT_SUBSCRIBED) {
      return { sent: false, bucket: 'user_refused', detail: String(res.errcode) }
    }
    return { sent: false, bucket: 'failed', detail: res.errcode ? String(res.errcode) : 'unknown' }
  } catch (err) {
    return { sent: false, bucket: 'failed', detail: (err as Error)?.message ?? 'exception' }
  }
}

export type ExternalChannel = 'in_app' | 'sms' | 'wechat'

export interface SmsOutcome {
  sent: boolean
  bucket: 'sent' | 'failed' | 'not_configured' | 'no_phone'
  detail?: string
}

/**
 * 对一个收件人尽力发短信。与微信那支同构:**返回分档而不是布尔** ——
 * "没配短信密钥""这人没留手机号""运营商拒了"是三件不同的事,
 * 并成一档就会重现"整天零触达与一切正常在账面上无法区分"那一型。
 * 刻意不在此处降级成 console 打日志充数:`sendSmsMessage` 内部未配置时本身会降级,
 * 但**本函数的 not_configured 档必须如实报**,否则运营看到的是"已发送"。
 */
export async function sendArrearSmsToRecipient(
  recipient: ReminderRecipient,
  message: string,
): Promise<SmsOutcome> {
  const avail = classifySmsAvailability(isSmsConfigured(), recipient.phone)
  if (!avail.ok) return { sent: false, bucket: avail.bucket }
  try {
    const r = await sendSmsMessage(avail.phone, message)
    return r.success
      ? { sent: true, bucket: 'sent' }
      : { sent: false, bucket: 'failed', detail: r.error ?? 'unknown' }
  } catch (err) {
    return { sent: false, bucket: 'failed', detail: (err as Error)?.message ?? 'exception' }
  }
}

export interface ChannelDispatch {
  /** 微信订阅消息:仅当请求了 wechat 通道才有值 */
  wx?: { sent: boolean; reason?: string }
  /** 短信:逐收件人分档(2026-09-29 起 channel='sms' 才真的发出去) */
  sms: Array<{ userId: string; role: string; bucket: SmsOutcome['bucket']; detail?: string }>
  smsSent: number
  smsFailed: number
  smsNotConfigured: number
  smsNoPhone: number
}

/**
 * 手动催费的通道编排,放在服务层而不是路由里:
 * 单发与批量两个端点此前各写一份 wechat 尽力外发 + 站内信,再加一条通道就要改两处
 * (本仓最贵的模式就是"同一件事两处各写一遍",欠费算式那次是同一个教训)。
 */
export async function dispatchArrearChannels(input: {
  studentId: string
  message: string
  studentName: string
  dueAmount: number
  channel: ExternalChannel
  /** 微信那支由调用方注入,保持本模块不直接依赖小程序通道实现细节 */
  sendWx?: (studentId: string, studentName: string, dueAmount: number) => Promise<{ sent: boolean; reason?: string }>
}): Promise<ChannelDispatch> {
  const out: ChannelDispatch = {
    sms: [],
    smsSent: 0,
    smsFailed: 0,
    smsNotConfigured: 0,
    smsNoPhone: 0,
  }
  if (input.channel === 'wechat' && input.sendWx) {
    out.wx = await input.sendWx(input.studentId, input.studentName, input.dueAmount)
  }
  if (input.channel === 'sms') {
    const recipients = await resolveReminderRecipients(input.studentId)
    for (const r of recipients) {
      const s = await sendArrearSmsToRecipient(r, input.message)
      out.sms.push({ userId: r.userId, role: r.role, bucket: s.bucket, detail: s.detail })
      if (s.bucket === 'sent') out.smsSent += 1
      else if (s.bucket === 'no_phone') out.smsNoPhone += 1
      else if (s.bucket === 'not_configured') out.smsNotConfigured += 1
      else out.smsFailed += 1
    }
  }
  return out
}

/**
 * 解析定时任务的催费通道配置。**默认只走微信**,与接短信之前的行为逐字一致 ——
 * 扩到短信要显式设 `EDU_ARREAR_REMIND_CHANNELS=sms`(或 `wechat,sms`)。
 * 因为每天 09:00 是按名单批量外发,擅自多开一条计费通道等于替运营做花钱的决定。
 * 非法值直接丢掉而不是抛错(配置写错不该让整个定时任务停摆);全丢光则回落默认档。
 */
export function parseRemindChannels(raw: string | undefined): ExternalChannel[] {
  const picked = (raw ?? 'wechat')
    .split(',')
    .map((s) => s.trim())
    .filter((v): v is ExternalChannel => (['in_app', 'sms', 'wechat'] as string[]).includes(v))
  return picked.length > 0 ? picked : ['wechat']
}

/**
 * "这次催缴算不算外部触达失败"的判据,抽成纯函数。
 * 立因:任务此前只要站内信没抛异常就记 success,于是"微信压根没配置、一条都没发出去"
 * 与"全部送达"在运维面上完全同形 —— 而 §5e 那条"失败必须响"禁的就是这个。
 * 规则:本次确有提醒对象,而被请求的外部通道全部零送达 ⇒ 判失败。
 * 只要站内信(in_app)的请求不算,因为它本来就不涉及外发。
 */
export function externalDeliveryMissed(input: {
  channels: ExternalChannel[]
  reminded: number
  wxSent: number
  smsSent: number
}): boolean {
  if (input.reminded <= 0) return false
  const wantWx = input.channels.includes('wechat')
  const wantSms = input.channels.includes('sms')
  if (!wantWx && !wantSms) return false
  if (wantWx && input.wxSent > 0) return false
  if (wantSms && input.smsSent > 0) return false
  return true
}

/**
 * 定时任务的外部通道集合;默认只走微信(与接短信之前的行为逐字一致,不偷偷扩面)。
 */
export async function scanAndRemindArrears(
  options?: { channels?: ExternalChannel[] },
): Promise<ArrearRemindResult> {
  const channels = options?.channels ?? ['wechat']
  const result: ArrearRemindResult = {
    scanned: 0,
    reminded: 0,
    skippedToday: 0,
    notifyFailed: 0,
    recipients: 0,
    parentRecipients: 0,
    wxSent: 0,
    wxFailed: 0,
    wxNotConfigured: 0,
    wxNoOpenid: 0,
    wxUserRefused: 0,
    smsSent: 0,
    smsFailed: 0,
    smsNotConfigured: 0,
    smsNoPhone: 0,
    deliveryWriteFailed: 0,
    overdueCount: 0,
    dueSoonCount: 0,
    withoutSchedule: 0,
  }

  // 候选:未删除、非退费、账面欠费 > 0
  const arrears = await db
    .select({
      enrollmentId: eduEnrollment.id,
      studentId: eduEnrollment.studentId,
      studentName: users.nickname,
    })
    .from(eduEnrollment)
    .innerJoin(users, eq(eduEnrollment.studentId, users.id))
    .where(
      and(isNull(eduEnrollment.deletedAt), ne(eduEnrollment.status, 'withdrawn'), hasArrearsCond()),
    )
    .orderBy(asc(eduEnrollment.nextDueDate))
  result.scanned = arrears.length
  if (arrears.length === 0) return result

  // 当日已提醒的报名（含手动发送）：同报名当日不重复打扰
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

    // 欠费额、逾期天数、最近到期日全部取自账目出口:与名单/汇总/催费端点同一把尺子
    const ledger = await loadEnrollmentLedger(item.enrollmentId)
    const dueAmount = ledger?.arrears ?? 0
    if (dueAmount <= 0) continue

    const overdueDays =
      ledger && ledger.schedules.length > 0
        ? Math.max(...ledger.schedules.map((s) => s.overdueDays), 0)
        : 0
    if (!ledger || ledger.schedules.length === 0) result.withoutSchedule += 1
    if (overdueDays > 0) result.overdueCount += 1
    if (ledger && ledger.dueSoonCount > 0 && overdueDays === 0) result.dueSoonCount += 1

    const message = buildReminderMessage(
      item.studentName ?? '学员',
      dueAmount,
      overdueDays,
      ledger?.nextDueDate ?? null,
    )

    // 留痕（operator 为空 = 系统自动）。按报名留一条,欠费快照存这一行。
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
      .returning({ id: eduFeeReminder.id })
    result.reminded += 1

    const recipients = await resolveReminderRecipients(item.studentId)
    result.recipients += recipients.length
    result.parentRecipients += recipients.filter((r) => r.role === 'parent').length
    /** 逐收件人回执,随发送过程累积写回留痕行(见 attachReminderDelivery) */
    const deliveryEntries: DeliveryEntry[] = []

    for (const recipient of recipients) {
      const wx = await sendWxToRecipient(recipient, item.studentName ?? '学员', dueAmount)
      if (wx.bucket === 'sent') result.wxSent += 1
      else if (wx.bucket === 'no_openid') result.wxNoOpenid += 1
      else if (wx.bucket === 'not_configured') result.wxNotConfigured += 1
      else if (wx.bucket === 'user_refused') result.wxUserRefused += 1
      else result.wxFailed += 1
      deliveryEntries.push({
        userId: recipient.userId,
        role: recipient.role,
        channel: 'wechat',
        bucket: wx.bucket,
        ...(wx.detail ? { detail: wx.detail } : {}),
        at: new Date().toISOString(),
      })

      if (channels.includes('sms')) {
        const sms = await sendArrearSmsToRecipient(recipient, message)
        if (sms.bucket === 'sent') result.smsSent += 1
        else if (sms.bucket === 'no_phone') result.smsNoPhone += 1
        else if (sms.bucket === 'not_configured') result.smsNotConfigured += 1
        else result.smsFailed += 1
        deliveryEntries.push({
          userId: recipient.userId,
          role: recipient.role,
          channel: 'sms',
          bucket: sms.bucket,
          ...(sms.detail ? { detail: sms.detail } : {}),
          at: new Date().toISOString(),
        })
      }
      // 累积写回:每人发完就落一次,使"中途异常退出"也留下已发生的部分回执 ——
      // 回执本身缺失时统计会归入 unknown,不能被写成"没送达"或"已送达"。
      if (row && !(await attachReminderDelivery(row.id, deliveryEntries))) {
        result.deliveryWriteFailed += 1
      }

      // 站内信逐收件人必达；失败只标记留痕,不中断其余人
      try {
        await createNotification({
          userId: recipient.userId,
          type: 'arrear_remind',
          title: overdueDays > 0 ? '学费逾期提醒' : '学费催缴提醒',
          content:
            recipient.role === 'parent'
              ? `${item.studentName ?? '孩子'}${message.replace('【', '【关于 ')}`
              : message,
          data: {
            enrollmentId: item.enrollmentId,
            dueAmount,
            source: 'auto_daily',
            role: recipient.role,
            overdueDays,
          },
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
  }

  // 汇总必须落日志:旧版跑完什么都不写,于是"整天零触达"与"一切正常"在运维面上不可区分
  logger.info('欠费催费定时任务完成', { ...result, leadDays: DUE_SOON_LEAD_DAYS })
  return result
}

export type SmsAvailability =
  | { ok: true; phone: string }
  | { ok: false; bucket: 'not_configured' | 'no_phone' }

/**
 * 短信通道的"可达性"判定,抽成纯函数:它决定的是**这条通道对这个人有没有意义**,
 * 与网络结果无关。三态不得并桶 —— 把"没配通道"与"这人没号码"混成一档,
 * 运营就会去查运营商,而真正的原因是没配密钥或花名册缺号码。
 * 返回判别联合而不是字符串:调用方拿到 ok:true 时 phone 已是非空字符串,
 * 不需要 `as string` 那种自我安慰式断言(断言不会证明任何事,只会让 typecheck 闭嘴)。
 */
export function classifySmsAvailability(
  configured: boolean,
  phone: string | null | undefined,
): SmsAvailability {
  if (!configured) return { ok: false, bucket: 'not_configured' }
  const trimmed = (phone ?? '').trim()
  if (!trimmed) return { ok: false, bucket: 'no_phone' }
  return { ok: true, phone: trimmed }
}

/** 一条催缴留痕的逐收件人回执元素 */
export interface DeliveryEntry {
  userId: string
  role: string
  channel: string
  bucket: 'sent' | 'failed' | 'not_configured' | 'no_openid' | 'no_phone' | 'user_refused'
  detail?: string
  at: string
}

/**
 * 把回执写回留痕行。
 * **失败不抛**（催缴本身比回执更重要），但必须由调用方计数 —— 静默吞掉就会让
 * "回执一片空白"被读成"没人被触达",而这只是写库失败(§5e 同一条禁令的反面)。
 */
export async function attachReminderDelivery(
  reminderId: string,
  entries: DeliveryEntry[],
  db2: typeof db = db,
): Promise<boolean> {
  if (!reminderId) return false
  try {
    await db2
      .update(eduFeeReminder)
      .set({ delivery: entries, updatedAt: new Date() })
      .where(eq(eduFeeReminder.id, reminderId))
    return true
  } catch {
    return false
  }
}

/**
 * 把多条留痕的回执聚成触达计数。
 * 规则:回执为 NULL 的留痕归 `unknownReminders`,**既不计送达也不计失败** ——
 * 该列落地前的历史行没有这份数据,把它们算成任何一侧都是造数。
 */
export function aggregateDeliveries(rows: Array<{ delivery: unknown }>): {
  buckets: Record<string, number>
  unknownReminders: number
  remindersWithDelivery: number
} {
  const buckets: Record<string, number> = {}
  let unknownReminders = 0
  let remindersWithDelivery = 0
  for (const r of rows) {
    const list = Array.isArray(r.delivery) ? (r.delivery as DeliveryEntry[]) : null
    if (!list || list.length === 0) {
      unknownReminders += 1
      continue
    }
    remindersWithDelivery += 1
    for (const e of list) buckets[e.bucket] = (buckets[e.bucket] ?? 0) + 1
  }
  return { buckets, unknownReminders, remindersWithDelivery }
}

export const __test__ = {
  buildReminderMessage,
  resolveReminderRecipients,
  beijingMidnightUtc,
  classifySmsAvailability,
  parseRemindChannels,
  externalDeliveryMissed,
  aggregateDeliveries,
  WX_ERRCODE_NOT_SUBSCRIBED,
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
