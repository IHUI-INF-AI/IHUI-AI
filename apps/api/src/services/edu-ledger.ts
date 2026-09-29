// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 教育学费账目的**唯一出口**(2026-09-29 立,D180)。
 *
 * ## 为什么必须存在
 * 此前"欠费"这个数字在 8 处各自表达(`totalFee - paidAmount`、`Math.max(0, t-p)`、
 * SQL 表达式三种写法),而 `edu_enrollment.paid_amount` 是一列谁都能 set 的存储值:
 * - 后台录一笔缴费 → 只写 `edu_payment_record` 流水,不回写 paid_amount ⇒ 欠费名单照旧亮红,
 *   第二天定时任务继续给已缴的人发催缴;
 * - 退费审批通过 → 只把 `edu_refund_record.status` 改成 approved,**既不冲销已缴额也不动流水**
 *   ⇒ 退完钱系统仍认为"已缴清",从此永不催缴(资金级缺陷);
 * - 在线支付回调的幂等靠"先查一次 receipt_no 再 insert + 累加",查与写不同事务
 *   ⇒ 两个并发回调能把同一笔款累加两次。
 * 三条的共同点是**没有单一真相源**,所以任何一处的"正确算法"都不能保证另一处一致。
 *
 * ## 本模块的口径
 * 真相源 = 该报名名下的**缴费流水(status=paid)** 之和 − 由这些流水关联的**已结退费
 * (status ∈ approved/completed)** 之和。`paid_amount` / `next_due_date` 只是派生缓存,
 * 写入口只有本模块(见 `recomputeEnrollment`)。
 *
 * ## 摊派规则(必须是确定性的)
 * 1. 带 `schedule_id` 的流水直接归该账期 —— 这是确定信息。
 * 2. 未带归属的流水按 due_date 升序摊给未清账期,摊完为止;余量记为 unallocatedPaid
 *    (仍计入报名级已缴,只是不冒充"某一期已缴")。
 * 3. 退款优先冲抵它所关联那笔流水所在的期;关联不上则从最早未清期开始冲。
 *
 * ## 一条不静默的边界
 * `enrollment_id` 回填前为 NULL 的历史流水(同一 student×class 存在多个学期报名时归不出来),
 * 既**不重复计入多个报名**,也不静默丢弃 —— 由 `loadUnattributedPayments` 点名出来,
 * 让机构看得见"有几笔钱归不到期次",而不是让它在两个期次里各出现一次。
 */

import { and, asc, count, eq, inArray, isNull, or, sql } from 'drizzle-orm'
import { eduEnrollment, eduFeeSchedule, eduPaymentRecord, eduRefundRecord } from '@ihui/database'
import { db } from '../db/index.js'
import { logger } from '../utils/logger.js'

/** 计入"已收"的流水状态。pending/refunded/cancelled 一律不算已缴。 */
export const PAYMENT_CREDIT_STATUSES: readonly string[] = ['paid']
/** 已经真金白银退出去的退费状态。 */
export const REFUND_SETTLED_STATUSES: readonly string[] = ['approved', 'completed']
/** 到期前多少天算「即将到期」,与 edu_fee_schedule.grace_days 无关(那是逾期宽限)。 */
export const DUE_SOON_LEAD_DAYS = 7
/**
 * 催费通道清单的唯一真相源。
 * 此前这个三元素数组在路由的两份 zod、一份裸 string 过滤、web 前端、schema 注释里各写一遍
 * (5 处),加一档要改 5 个地方且漏一处就静默少一个通道。
 */
export const EDU_REMINDER_CHANNELS = ['in_app', 'sms', 'wechat'] as const
export type EduReminderChannel = (typeof EDU_REMINDER_CHANNELS)[number]

/**
 * 欠费的两条 SQL 形态,由账目出口**唯一持有**。
 *
 * 为什么做成导出的构造函数而不是各查询里现写:列表分页与定时扫描都需要在 SQL 侧算欠费
 * (逐行回到本模块 loadEnrollmentLedger 会把一次列表查询放大成 N 次三表查询),
 * 但"现写一遍减法"就是第二个口径 —— 本仓这次修的四条缺陷里有一条正是
 * 「roster 那处漏了下限 0,超缴学员被算成负欠费,在汇总里把总欠费额冲小」。
 * 所以这里把**算式本身**收成一份,调用方引用它:分页性能保住,文本只有一处。
 * 用函数而不是常量:每次调用产出新的 SQL 对象,避免同一实例被复用到不同查询里
 * (drizzle 的 sql 模板虽多为不可变描述,但把它当共享常量传是隐式耦合)。
 */
export function arrearsSqlExpr() {
  return sql<number>`GREATEST(${eduEnrollment.totalFee} - ${eduEnrollment.paidAmount}, 0)`
}

/** 「有欠费」的预筛条件(粗筛用;欠费**金额**一律走 arrearsSqlExpr 或本模块的纯函数) */
export function hasArrearsCond() {
  return sql`${eduEnrollment.totalFee} > ${eduEnrollment.paidAmount}`
}

/** 金额单位:整数元(与 edu_enrollment.total_fee / edu_payment_record.amount 一致)。 */
export interface ScheduleLike {
  id: string
  dueDate: string
  graceDays: number
  amountDue: number
  status: string
}
export interface PaymentLike {
  id: string
  amount: number
  status: string
  scheduleId: string | null
}
export interface RefundLike {
  amount: number
  status: string
  /** 经由 payment_id 关联到流水后拿到的期次;归不出来则 null */
  scheduleId: string | null
}

export interface LedgerInput {
  totalFee: number
  schedules: ScheduleLike[]
  payments: PaymentLike[]
  refunds: RefundLike[]
  /** 注入以便测试确定性;格式 YYYY-MM-DD */
  today: string
}

export interface ScheduleOutcome {
  id: string
  /** 账期到期日,随结果一起带出,免得调用方为了"即将到期"再去查一次表 */
  dueDate: string
  paidAmount: number
  refundAmount: number
  /** 该期净额已缴(paid - refund),status 由它算 */
  netPaid: number
  status: string
  /** 该期是否逾期(逾期天数 > 0) */
  overdue: boolean
  overdueDays: number
}

export interface EnrollmentLedger {
  enrollmentId?: string
  totalFee: number
  /** 流水口径的已收 */
  creditedAmount: number
  /** 已结退费 */
  settledRefund: number
  /** 写回 paid_amount 的值 = max(0, credited - refunded) */
  paidAmount: number
  /** 写回的唯一欠费算式 = max(0, totalFee - paidAmount) */
  arrears: number
  /** 写回 next_due_date:最早一个未清账期的到期日;无账期则 null */
  nextDueDate: string | null
  schedules: ScheduleOutcome[]
  /** 摊完账期后剩下的已缴额(报名级,不属于任何一期) */
  unallocatedPaid: number
  overdueCount: number
  dueSoonCount: number
}

/** ISO 日期差(天),按 UTC 零点算,避免时区导致 ±1 天漂移。a - b。 */
function dayDiff(a: string, b: string): number {
  const ms = Date.parse(`${a}T00:00:00Z`) - Date.parse(`${b}T00:00:00Z`)
  return Number.isNaN(ms) ? 0 : Math.floor(ms / 86_400_000)
}

/**
 * 纯函数:喂进原始行,算出账目。**不碰数据库**。
 * 之所以拆成纯函数:欠费口径是本模块唯一的判据,它必须在没有库的情况下也能被断言
 * (本仓反复出现的失效型是"判据只能连库跑,于是没人跑")。
 */
export function deriveEnrollmentLedger(input: LedgerInput): EnrollmentLedger {
  const { totalFee, today } = input
  // 账期按到期日升序 —— 摊派顺序的唯一依据,不依赖行插入顺序
  const schedules = [...input.schedules]
    .filter((s) => s.status !== 'cancelled')
    .sort((a, b) => (a.dueDate < b.dueDate ? -1 : a.dueDate > b.dueDate ? 1 : 0))

  // 期次摊派桶:先收"明确带 schedule_id"的,确定性优先
  const paidBySchedule = new Map<string, number>()
  const refundBySchedule = new Map<string, number>()
  let unassignedPaid = 0
  let unassignedRefund = 0

  for (const p of input.payments) {
    if (!PAYMENT_CREDIT_STATUSES.includes(p.status)) continue
    if (p.scheduleId && paidBySchedule.has(p.scheduleId)) {
      paidBySchedule.set(p.scheduleId, (paidBySchedule.get(p.scheduleId) ?? 0) + p.amount)
    } else if (p.scheduleId) {
      paidBySchedule.set(p.scheduleId, p.amount)
    } else {
      unassignedPaid += p.amount
    }
  }
  for (const r of input.refunds) {
    if (!REFUND_SETTLED_STATUSES.includes(r.status)) continue
    if (r.scheduleId && refundBySchedule.has(r.scheduleId)) {
      refundBySchedule.set(r.scheduleId, (refundBySchedule.get(r.scheduleId) ?? 0) + r.amount)
    } else if (r.scheduleId) {
      refundBySchedule.set(r.scheduleId, r.amount)
    } else {
      unassignedRefund += r.amount
    }
  }

  // 未归属的钱按到期日升序摊给未清账期(先填最紧的),摊完余量留报名级
  for (const s of schedules) {
    if (unassignedPaid <= 0) break
    const already = paidBySchedule.get(s.id) ?? 0
    const need = Math.max(0, s.amountDue - already)
    if (need === 0) continue
    const take = Math.min(need, unassignedPaid)
    paidBySchedule.set(s.id, already + take)
    unassignedPaid -= take
  }
  // 未归属的退费同样从最早期开始冲
  for (const s of schedules) {
    if (unassignedRefund <= 0) break
    const already = refundBySchedule.get(s.id) ?? 0
    const room = Math.max(0, (paidBySchedule.get(s.id) ?? 0) - already)
    if (room === 0) continue
    const take = Math.min(room, unassignedRefund)
    refundBySchedule.set(s.id, already + take)
    unassignedRefund -= take
  }

  const outcomes: ScheduleOutcome[] = schedules.map((s) => {
    const paid = paidBySchedule.get(s.id) ?? 0
    const refunded = refundBySchedule.get(s.id) ?? 0
    const netPaid = Math.max(0, paid - refunded)
    const overdueDays = Math.max(0, dayDiff(today, s.dueDate) - Math.max(0, s.graceDays))
    let status: string
    if (s.amountDue > 0 && netPaid >= s.amountDue) status = 'paid'
    else if (netPaid > 0) status = 'partial'
    else if (overdueDays > 0) status = 'overdue'
    else status = 'pending'
    // 逾期判定独立于 status:部分缴且已过宽限期同样算逾期。
    // 否则"交了一点点"的期次会永久躲开逾期视图,而那恰恰是最该被看见的一档。
    return {
      id: s.id,
      dueDate: s.dueDate,
      paidAmount: paid,
      refundAmount: refunded,
      netPaid,
      status,
      overdue: overdueDays > 0 && netPaid < s.amountDue,
      overdueDays,
    }
  })

  const creditedAmount = input.payments
    .filter((p) => PAYMENT_CREDIT_STATUSES.includes(p.status))
    .reduce((sum, p) => sum + p.amount, 0)
  const settledRefund = input.refunds
    .filter((r) => REFUND_SETTLED_STATUSES.includes(r.status))
    .reduce((sum, r) => sum + r.amount, 0)
  const paidAmount = Math.max(0, creditedAmount - settledRefund)

  const open = outcomes.filter((o) => o.status !== 'paid')
  const nextDueDate = open.map((o) => o.dueDate).sort()[0] ?? null

  return {
    totalFee,
    creditedAmount,
    settledRefund,
    paidAmount,
    arrears: Math.max(0, totalFee - paidAmount),
    nextDueDate,
    schedules: outcomes,
    unallocatedPaid: unassignedPaid,
    overdueCount: outcomes.filter((o) => o.overdue).length,
    // 「即将到期」= 未逾期、未缴清,且距到期日 0..DUE_SOON_LEAD_DAYS 天。
    // 这一档才是"自动分析什么时间缴费"的产出:机构要提前而不是事后催。
    dueSoonCount: open.filter((o) => {
      const d = dayDiff(o.dueDate, today)
      return !o.overdue && d >= 0 && d <= DUE_SOON_LEAD_DAYS
    }).length,
  }
}

/**
 * 「没有归属报名的流水/退费」能不能算到本报名头上 —— 只取决于该 student×class 下
 * 有效报名的条数:1 条 ⇒ 认领(否则这笔钱在账面上凭空消失,学员被多催);
 * ≥2 条 ⇒ 谁都不算(算给任一边都会让同一笔钱出现两次,那是本模块要消灭的第一型)。
 * 刻意抽成纯函数:这是**判据**,必须能在没有库的情况下被断言(本仓最高频失效型
 * 就是"判据只能连库跑,于是没人跑")。
 */
export function shouldAdoptUnattributed(activeEnrollmentsForStudentClass: number): boolean {
  return activeEnrollmentsForStudentClass === 1
}

/**
 * 账期展开(纯函数,不猜业务规则)。
 *
 * 为什么要它:`edu_fee_schedule` 建好后是一张空表,而"什么时间该缴费"这条能力
 * 必须有账期才成立 —— 没有生成通道,到期分级、提前提醒、按账期摊派全是空转。
 * 但**分期规则属机构的经营决定**(几期、首期哪天、按月还是按学期),
 * 所以这里只做机械展开:三个入参一律由调用方给,任何一项缺失或非法都返回 null,
 * 绝不替使用者编一个"看起来合理"的到期日(编出来的到期日会直接变成催缴文案里的日期)。
 *
 * 两条确定性要求:
 *  ① 金额摊派必须**逐期相加恰好等于总额**(整数元,余数给末期) —— 摊完少 1 元,
 *     末期永远"差一点缴清",而那 1 元会一直挂在欠费里。
 *  ② 月末钳制:1/31 起按月推,2 月没有 31 日 ⇒ 落到当月最后一天,
 *     不得产出 `2026-02-31` 这种能被字符串比较排序、却永远 parse 不出的日期。
 */
export interface SchedulePlanInput {
  periodCount: number
  amountTotal: number
  firstDueDate: string
  cycle: 'once' | 'monthly' | 'termly'
  /** cycle=termly 时每期之间的月数(由调用方给,例如一学期 6 个月) */
  monthsPerPeriod?: number
}

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/

function daysInMonth(y: number, m1: number): number {
  return new Date(Date.UTC(y, m1, 0)).getUTCDate()
}

/** 把 YYYY-MM-DD 往后推 n 个月,钳制到当月最后一天 */
function addMonthsClamped(iso: string, n: number): string | null {
  const parts = iso.split('-')
  const y = Number(parts[0])
  const m = Number(parts[1])
  const d = Number(parts[2])
  if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) return null
  const total = m - 1 + n
  const ny = y + Math.floor(total / 12)
  const nm = (total % 12 + 12) % 12 + 1
  const nd = Math.min(d, daysInMonth(ny, nm))
  return `${String(ny).padStart(4, '0')}-${String(nm).padStart(2, '0')}-${String(nd).padStart(2, '0')}`
}

export function buildSchedulePlan(
  input: SchedulePlanInput,
): Array<{ periodLabel: string; dueDate: string; amountDue: number }> | null {
  const { periodCount, amountTotal, firstDueDate, cycle } = input
  if (!Number.isInteger(periodCount) || periodCount < 1) return null
  if (!Number.isInteger(amountTotal) || amountTotal < 0) return null
  if (!ISO_DATE_RE.test(firstDueDate)) return null
  if (Number.isNaN(Date.parse(`${firstDueDate}T00:00:00Z`))) return null
  if (cycle !== 'once' && cycle !== 'monthly' && cycle !== 'termly') return null
  // cycle=once 配多期是**矛盾输入**(一次缴清 vs 分成几期)。
  // 放任它会产出多条"同一天到期"的账期:到期提醒会对同一报名连发多条,
  // 而摊派看着像系统算错 —— 矛盾输入应当被拒,不是被将就成一个能跑的形状。
  if (cycle === 'once' && periodCount !== 1) return null
  const stepMonths =
    cycle === 'once' ? 0 : cycle === 'monthly' ? 1 : (input.monthsPerPeriod ?? 0)
  if (cycle === 'termly' && (!Number.isInteger(stepMonths) || stepMonths < 1)) return null

  // 摊派:基础值 × (n-1) + 末期(带余数) = 总额,逐分不差
  const base = Math.floor(amountTotal / periodCount)
  const last = amountTotal - base * (periodCount - 1)
  const out: Array<{ periodLabel: string; dueDate: string; amountDue: number }> = []
  for (let i = 0; i < periodCount; i++) {
    const dueDate = i === 0 ? firstDueDate : addMonthsClamped(firstDueDate, stepMonths * i)
    if (!dueDate) return null
    out.push({
      periodLabel: periodCount === 1 ? '全额' : `第 ${i + 1}/${periodCount} 期`,
      dueDate,
      amountDue: i === periodCount - 1 ? last : base,
    })
  }
  return out
}

function todayIso(): string {  // 用北京日界,与催费定时任务的"当日幂等"口径一致(那边按北京时间 0 点算)
  return new Date(Date.now() + 8 * 3600 * 1000).toISOString().slice(0, 10)
}

/**
 * 把一个报名的原始行读齐后算账。
 * 退费经 payment_id 关联到流水,再取其 schedule_id;关联不上的按"未归属退费"处理。
 */
export async function loadEnrollmentLedger(enrollmentId: string): Promise<EnrollmentLedger | null> {
  const [enrollment] = await db
    .select({
      totalFee: eduEnrollment.totalFee,
      studentId: eduEnrollment.studentId,
      classId: eduEnrollment.classId,
    })
    .from(eduEnrollment)
    .where(and(eq(eduEnrollment.id, enrollmentId), isNull(eduEnrollment.deletedAt)))
    .limit(1)
  if (!enrollment) return null

  /**
   * 该 student×class 下有几条有效报名 —— 决定"没有归属的流水/退费"能不能算到本报名头上。
   * 只有一条时可以确定地认领;有多条(续读)时**两边都不算**:
   * 算给本报名 = 同一笔钱在两个期次各出现一次(重复计钱,正是本模块要消灭的),
   * 完全不算 = 学员已缴额凭空变小、又被催缴(我上一版按 enrollment_id 精确过滤就是这个形状,
   * 而顶部注释写的是"仍计入报名级" —— 注释与实现分叉比两处都缺更坏,因为读代码的人会信注释)。
   * 两种情形都由 loadUnattributedPayments 点名,不静默。
   */
  const [sibling] = await db
    .select({ n: count() })
    .from(eduEnrollment)
    .where(
      and(
        eq(eduEnrollment.studentId, enrollment.studentId),
        eq(eduEnrollment.classId, enrollment.classId),
        isNull(eduEnrollment.deletedAt),
      ),
    )
  const adoptUnattributed = shouldAdoptUnattributed(Number(sibling?.n ?? 0))

  // 归属条件:确定归属(enrollment_id 命中) always-in;无归属行只在"唯一报名"时认领。
  // 刻意各表写各表的列(不抽泛型 helper)—— 跨表混用列会生成坏 SQL,而这里两处条件不同形。
  const payOwner = adoptUnattributed
    ? or(
        eq(eduPaymentRecord.enrollmentId, enrollmentId),
        and(
          isNull(eduPaymentRecord.enrollmentId),
          eq(eduPaymentRecord.studentId, enrollment.studentId),
          eq(eduPaymentRecord.classId, enrollment.classId),
        ),
      )
    : eq(eduPaymentRecord.enrollmentId, enrollmentId)
  const refundOwner = adoptUnattributed
    ? or(
        eq(eduRefundRecord.enrollmentId, enrollmentId),
        and(
          isNull(eduRefundRecord.enrollmentId),
          eq(eduRefundRecord.studentId, enrollment.studentId),
          eq(eduRefundRecord.classId, enrollment.classId),
        ),
      )
    : eq(eduRefundRecord.enrollmentId, enrollmentId)

  const [payments, refunds, schedules] = await Promise.all([
    db
      .select({
        id: eduPaymentRecord.id,
        amount: eduPaymentRecord.amount,
        status: eduPaymentRecord.status,
        scheduleId: eduPaymentRecord.scheduleId,
      })
      .from(eduPaymentRecord)
      .where(
        and(payOwner, isNull(eduPaymentRecord.deletedAt)),
      ),
    db
      .select({
        amount: eduRefundRecord.amount,
        status: eduRefundRecord.status,
        scheduleId: eduPaymentRecord.scheduleId,
      })
      .from(eduRefundRecord)
      .leftJoin(eduPaymentRecord, eq(eduRefundRecord.paymentId, eduPaymentRecord.id))
      .where(
        and(refundOwner, isNull(eduRefundRecord.deletedAt)),
      ),
    db
      .select({
        id: eduFeeSchedule.id,
        dueDate: eduFeeSchedule.dueDate,
        graceDays: eduFeeSchedule.graceDays,
        amountDue: eduFeeSchedule.amountDue,
        status: eduFeeSchedule.status,
      })
      .from(eduFeeSchedule)
      .where(and(eq(eduFeeSchedule.enrollmentId, enrollmentId), isNull(eduFeeSchedule.deletedAt)))
      .orderBy(asc(eduFeeSchedule.dueDate)),
  ])

  return deriveEnrollmentLedger({
    totalFee: enrollment.totalFee,
    schedules,
    payments,
    refunds,
    today: todayIso(),
  })
}

/**
 * 重算并写回派生缓存:enrollment.paid_amount / next_due_date + 各账期摊派值。
 * 这是这两列**唯一的写入口**。读不到报名就返回 null 并留一行日志(不静默成功)。
 */
export async function recomputeEnrollment(enrollmentId: string): Promise<EnrollmentLedger | null> {
  const ledger = await loadEnrollmentLedger(enrollmentId)
  if (!ledger) {
    logger.warn('账目重算跳过:报名不存在或已删除', { enrollmentId })
    return null
  }
  await db.transaction(async (tx) => {
    await tx
      .update(eduEnrollment)
      .set({
        paidAmount: ledger.paidAmount,
        nextDueDate: ledger.nextDueDate,
        updatedAt: new Date(),
      })
      .where(eq(eduEnrollment.id, enrollmentId))
    for (const o of ledger.schedules) {
      await tx
        .update(eduFeeSchedule)
        .set({
          paidAmount: o.paidAmount,
          refundAmount: o.refundAmount,
          status: o.status,
          updatedAt: new Date(),
        })
        .where(eq(eduFeeSchedule.id, o.id))
    }
  })
  return { ...ledger, enrollmentId }
}

/** 批量重算(退费审批、批量改状态、账期重排等一次影响多报名的场景)。 */
export async function recomputeEnrollments(enrollmentIds: string[]): Promise<number> {
  const uniq = [...new Set(enrollmentIds)].filter(Boolean)
  if (uniq.length === 0) return 0
  let done = 0
  for (const id of uniq) {
    if (await recomputeEnrollment(id)) done += 1
  }
  return done
}

/**
 * 唯一的「记一笔缴费」入口。
 * 旧端点 `POST /payment-record` 只做 insert,这正是"录了缴费仍算欠费"的直接成因;
 * 所有写入缴费流水的路径都必须走这里(或由本入口重算),否则判据不成立。
 */
export async function recordPayment(input: {
  enrollmentId: string
  studentId: string
  classId: string
  feeId?: string | null
  scheduleId?: string | null
  amount: number
  paymentDate: string
  paymentMethod: string
  status?: string
  receiptNo?: string | null
  remark?: string | null
  operatorId?: string | null
}): Promise<{ paymentId: string; ledger: EnrollmentLedger | null }> {
  const [row] = await db
    .insert(eduPaymentRecord)
    .values({
      studentId: input.studentId,
      classId: input.classId,
      enrollmentId: input.enrollmentId,
      feeId: input.feeId ?? null,
      scheduleId: input.scheduleId ?? null,
      amount: input.amount,
      paymentDate: input.paymentDate,
      paymentMethod: input.paymentMethod,
      status: input.status ?? 'paid',
      receiptNo: input.receiptNo ?? null,
      remark: input.remark ?? null,
      operatorId: input.operatorId ?? null,
    })
    .returning({ id: eduPaymentRecord.id })
  if (!row) {
    // insert...returning 取不到行 = 写没落地,必须抛而不是继续算账
    // (继续算会产出一个"已重算"的假结论,而那条缴费其实不存在)
    throw new Error(`缴费写入未返回记录:报名 ${input.enrollmentId}`)
  }
  const ledger = await recomputeEnrollment(input.enrollmentId)
  return { paymentId: row.id, ledger }
}

/** 撤销一笔缴费(软删)后必须重算,否则欠费永远回不来。 */
export async function voidPaymentRecord(
  paymentId: string,
): Promise<{ enrollmentId: string | null; ledger: EnrollmentLedger | null }> {
  const [existing] = await db
    .select({ enrollmentId: eduPaymentRecord.enrollmentId })
    .from(eduPaymentRecord)
    .where(and(eq(eduPaymentRecord.id, paymentId), isNull(eduPaymentRecord.deletedAt)))
    .limit(1)
  await db
    .update(eduPaymentRecord)
    .set({ deletedAt: new Date(), updatedAt: new Date() })
    .where(eq(eduPaymentRecord.id, paymentId))
  if (!existing?.enrollmentId) {
    logger.warn('缴费撤销后无法重算账目:该流水没有报名归属', { paymentId })
    return { enrollmentId: null, ledger: null }
  }
  return {
    enrollmentId: existing.enrollmentId,
    ledger: await recomputeEnrollment(existing.enrollmentId),
  }
}

/**
 * 唯一的「记一笔退费」入口(2026-09-29 抽口)。
 *
 * 为什么必须抽:退费登记此前是路由里**两个别名端点各写一遍** `insert(eduRefundRecord)`,
 * 于是"归属解析 + 重算"这段账目逻辑要在两处保持同步 —— 而它一旦只做一半就是静默错账
 * (实际发生过:早期版本只在带 paymentId 时重算,不带 paymentId 的退费退了钱却不减已缴额)。
 * 结构与 `recordPayment` 对称:归属解析 → 落库 → 重算,一次做完,调用方拿不到"半成品"选项。
 *
 * 归属仍走**两级**、不猜:① 关联流水的 enrollment_id(确定信息);
 * ② 无 paymentId 时仅当该 student×class 只有一条有效报名才认领(复用同一个纯函数)。
 * 两级都不成立 ⇒ enrollmentId 为 null 并原样回传,由 `loadUnattributedPayments` 点名。
 */
export async function recordRefund(input: {
  studentId: string
  classId: string
  amount: number
  refundDate: string
  reason: string
  paymentId?: string | null
  refundMethod?: string | null
  operatorId?: string | null
}): Promise<{
  refund: { id: string; enrollmentId: string | null; amount: number; status: string }
  enrollmentId: string | null
  ledger: EnrollmentLedger | null
}> {
  let ownerEnrollmentId: string | null = null
  if (input.paymentId) {
    const [pay] = await db
      .select({ enrollmentId: eduPaymentRecord.enrollmentId })
      .from(eduPaymentRecord)
      .where(
        and(
          eq(eduPaymentRecord.id, input.paymentId),
          isNull(eduPaymentRecord.deletedAt),
        ),
      )
      .limit(1)
    ownerEnrollmentId = pay?.enrollmentId ?? null
  }
  if (!ownerEnrollmentId) {
    const siblings = await db
      .select({ id: eduEnrollment.id })
      .from(eduEnrollment)
      .where(
        and(
          eq(eduEnrollment.studentId, input.studentId),
          eq(eduEnrollment.classId, input.classId),
          isNull(eduEnrollment.deletedAt),
        ),
      )
      .limit(2)
    if (shouldAdoptUnattributed(siblings.length)) ownerEnrollmentId = siblings[0]?.id ?? null
  }
  const [row] = await db
    .insert(eduRefundRecord)
    .values({
      studentId: input.studentId,
      classId: input.classId,
      paymentId: input.paymentId ?? null,
      enrollmentId: ownerEnrollmentId,
      amount: input.amount,
      refundDate: input.refundDate,
      refundMethod: input.refundMethod ?? null,
      reason: input.reason,
      operatorId: input.operatorId ?? null,
    })
    .returning()
  if (!row) throw new Error(`退费写入未返回记录:学员 ${input.studentId}`)
  const ledger = ownerEnrollmentId ? await recomputeEnrollment(ownerEnrollmentId) : null
  return { refund: row, enrollmentId: ownerEnrollmentId, ledger }
}

/**
 * 退费落账(审批通过 / 驳回都走这里,由 status 决定要不要重算)。
 * 退费必须同时把关联流水的状态推离 'paid',否则它仍会被当已收计入。
 */
export async function settleRefund(input: {
  refundId: string
  status: string
  approverId?: string | null
  approveRemark?: string | null
}): Promise<{ enrollmentId: string | null; ledger: EnrollmentLedger | null }> {
  const [existing] = await db
    .select({ enrollmentId: eduRefundRecord.enrollmentId })
    .from(eduRefundRecord)
    .where(and(eq(eduRefundRecord.id, input.refundId), isNull(eduRefundRecord.deletedAt)))
    .limit(1)
  await db
    .update(eduRefundRecord)
    .set({
      status: input.status,
      approverId: input.approverId ?? null,
      approveRemark: input.approveRemark ?? null,
      approveAt: REFUND_SETTLED_STATUSES.includes(input.status) ? new Date() : null,
      updatedAt: new Date(),
    })
    .where(eq(eduRefundRecord.id, input.refundId))
  if (!existing?.enrollmentId) {
    logger.warn('退费审批后无法重算账目:该退费记录没有报名归属', { refundId: input.refundId })
    return { enrollmentId: null, ledger: null }
  }
  return {
    enrollmentId: existing.enrollmentId,
    ledger: await recomputeEnrollment(existing.enrollmentId),
  }
}

/**
 * 归不到报名的流水(历史数据),点名给运营看。
 * 刻意既不并进任何报名的已缴额、也不丢弃 —— 并进去会重复计钱,丢弃会让机构以为少收。
 */
export async function loadUnattributedPayments(
  studentIds?: string[],
): Promise<
  { id: string; studentId: string; classId: string; amount: number; paymentDate: string }[]
> {
  const cond =
    studentIds && studentIds.length > 0
      ? and(
          isNull(eduPaymentRecord.enrollmentId),
          isNull(eduPaymentRecord.deletedAt),
          inArray(eduPaymentRecord.studentId, studentIds),
        )
      : and(isNull(eduPaymentRecord.enrollmentId), isNull(eduPaymentRecord.deletedAt))
  return db
    .select({
      id: eduPaymentRecord.id,
      studentId: eduPaymentRecord.studentId,
      classId: eduPaymentRecord.classId,
      amount: eduPaymentRecord.amount,
      paymentDate: eduPaymentRecord.paymentDate,
    })
    .from(eduPaymentRecord)
    .where(cond)
    .orderBy(asc(eduPaymentRecord.paymentDate))
}

export const __test__ = {
  deriveEnrollmentLedger,
  dayDiff,
  shouldAdoptUnattributed,
  buildSchedulePlan,
  PAYMENT_CREDIT_STATUSES,
  REFUND_SETTLED_STATUSES,
  EDU_REMINDER_CHANNELS,
  DUE_SOON_LEAD_DAYS,
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
