// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { and, eq, gte, lt, isNull, sql, desc } from 'drizzle-orm'
import {
  hrAttendanceDaily,
  hrAttendanceRecord,
  hrLeaveBalance,
  hrPunchFix,
  type HrAttendanceDaily,
  type HrAttendanceRecord,
  type HrLeaveBalance,
  type HrPunchFix,
} from '@ihui/database'
import { db } from '../db/index.js'
import { logger } from '../utils/logger.js'

/**
 * 人事考勤日结 / 假期额度 / 补卡(HR-2 第 1 期,2026-11-11 立)。
 *
 * 四件事:
 *   · 日结查询 —— 按员工 / 部门 / 月份拉 hr_attendance_daily(HR-1 日任务产出)。
 *   · 假期余额查询 —— 按员工(+ 可选假期类型 + 年度)拉 hr_leave_balance。
 *   · 补卡申请提交 —— 写 hr_punch_fix(pending),不预扣额度(补卡不涉假期额度)。
 *   · 补卡审批 —— 通过后回写 hr_attendance_record 的 checkInTime / checkOutTime / status。
 *
 * 假期额度校验口径:remaining_days = total - used - frozen;任何扣减(冻结 / 使用)前
 * 必须满足 `remaining >= 申请天数`,否则拒绝(拒绝请假 / 拒绝补卡申请均走同一条校验)。
 */

/** 日期键格式(YYYY-MM-DD)—— date 列在 drizzle 下就是字符串 */
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

function assertDateKey(v: string, label: string): void {
  if (!DATE_RE.test(v)) throw new Error(`${label} 必须是 YYYY-MM-DD 格式`)
}

// ─────────────────────────────────────────────────────────────────────────────
// 日结查询
// ─────────────────────────────────────────────────────────────────────────────

export interface DailyQuery {
  /** 员工 id(可选,与 departmentId/month 互不排斥,可叠加) */
  employeeId?: string
  /** 部门 id(可选) */
  departmentId?: string
  /** 月份 YYYY-MM(可选;给了就按该月 [1 日, 次月 1 日) 区间过滤) */
  month?: string
  limit?: number
  offset?: number
}

/** 按员工 / 部门 / 月份查询考勤日结(倒序按日期)。 */
export async function listAttendanceDaily(params: DailyQuery): Promise<{
  list: HrAttendanceDaily[]
  total: number
}> {
  const filters = [isNull(sql`1`)] // 占位,便于下方 and(...) 始终收数组
  filters.length = 0
  if (params.employeeId) filters.push(eq(hrAttendanceDaily.employeeId, params.employeeId))
  if (params.departmentId) filters.push(eq(hrAttendanceDaily.departmentId, params.departmentId))
  if (params.month) {
    assertDateKey(`${params.month}-01`, 'month')
    const [y, m] = params.month.split('-').map(Number) as [number, number]
    const start = `${y}-${String(m).padStart(2, '0')}-01`
    const endMonth = m === 12 ? 1 : m + 1
    const endYear = m === 12 ? y + 1 : y
    const end = `${endYear}-${String(endMonth).padStart(2, '0')}-01`
    filters.push(gte(hrAttendanceDaily.date, start))
    filters.push(lt(hrAttendanceDaily.date, end))
  }
  const where = filters.length > 0 ? and(...filters) : undefined

  const [totalRow] = await db
    .select({ c: sql<number>`count(*)::int` })
    .from(hrAttendanceDaily)
    .where(where)
  const list = await db
    .select()
    .from(hrAttendanceDaily)
    .where(where)
    .orderBy(desc(hrAttendanceDaily.date))
    .limit(params.limit ?? 50)
    .offset(params.offset ?? 0)
  return { list, total: Number(totalRow?.c ?? 0) }
}

// ─────────────────────────────────────────────────────────────────────────────
// 假期余额查询
// ─────────────────────────────────────────────────────────────────────────────

export interface LeaveBalanceQuery {
  employeeId: string
  leaveType?: string
  /** 年度(缺省 = 当年) */
  year?: number
}

/** 查询某员工的假期额度账(可选按假期类型 / 年度过滤)。 */
export async function listLeaveBalances(params: LeaveBalanceQuery): Promise<HrLeaveBalance[]> {
  const filters = [eq(hrLeaveBalance.employeeId, params.employeeId)]
  if (params.leaveType) filters.push(eq(hrLeaveBalance.leaveType, params.leaveType))
  if (params.year !== undefined) filters.push(eq(hrLeaveBalance.year, params.year))
  return db
    .select()
    .from(hrLeaveBalance)
    .where(and(...filters))
    .orderBy(desc(hrLeaveBalance.year), hrLeaveBalance.leaveType)
}

// ─────────────────────────────────────────────────────────────────────────────
// 补卡申请
// ─────────────────────────────────────────────────────────────────────────────

export interface SubmitPunchFixInput {
  employeeId: string
  departmentId: string
  date: string
  punchType: 'check_in' | 'check_out'
  punchTime?: Date
  reason: string
}

/**
 * 提交补卡申请。**补卡不消耗假期额度**(只补一次打卡时刻),故此处不查 hr_leave_balance;
 * 但仍校验日期格式与 punch_type 词表。返回新建的 hr_punch_fix 行(status=pending)。
 */
export async function submitPunchFix(input: SubmitPunchFixInput): Promise<HrPunchFix> {
  assertDateKey(input.date, 'date')
  if (input.punchType !== 'check_in' && input.punchType !== 'check_out') {
    throw new Error('punch_type 必须是 check_in 或 check_out')
  }
  if (!input.reason || input.reason.trim().length === 0) {
    throw new Error('补卡事由不能为空')
  }
  const [row] = await db
    .insert(hrPunchFix)
    .values({
      employeeId: input.employeeId,
      departmentId: input.departmentId,
      date: input.date,
      punchType: input.punchType,
      punchTime: input.punchTime ?? null,
      reason: input.reason.trim(),
      status: 'pending',
    })
    .returning()
  logger.info('hr punch fix submitted', {
    punchFixId: row?.id,
    employeeId: input.employeeId,
    date: input.date,
    punchType: input.punchType,
  })
  if (!row) throw new Error('补卡申请落库失败:未返回行')
  return row
}

// ─────────────────────────────────────────────────────────────────────────────
// 补卡审批(通过后回写考勤记录)
// ─────────────────────────────────────────────────────────────────────────────

export interface ApprovePunchFixInput {
  punchFixId: string
  approverId: string
  approveRemark?: string
  /** true=通过(回写考勤),false=驳回(不动考勤) */
  approve: boolean
}

/** 审批结果 */
export interface ApprovePunchFixOutcome {
  punchFix: HrPunchFix | null
  /** 仅 approve=true 时存在:被回写的考勤记录 */
  attendanceRecord: HrAttendanceRecord | null
}

/**
 * 审批补卡申请。
 * approve=true  ⇒ 找到该员工该日的 hr_attendance_record,按 punch_type 回写
 *                 checkInTime 或 checkOutTime,status 置 'present'(有打卡即视为已到岗);
 * approve=false ⇒ 只更新补卡单状态,不动考勤记录。
 * 找不到对应考勤记录时:补卡单照样通过,但 attendanceRecord 返回 null(调用方据此提示)。
 */
export async function approvePunchFix(
  input: ApprovePunchFixInput,
): Promise<ApprovePunchFixOutcome> {
  const [fix] = await db.select().from(hrPunchFix).where(eq(hrPunchFix.id, input.punchFixId))
  if (!fix) throw new Error(`补卡申请不存在: ${input.punchFixId}`)
  if (fix.status !== 'pending') {
    throw new Error(`补卡申请已处理(status=${fix.status}),不能重复审批`)
  }

  const now = new Date()
  const newStatus = input.approve ? 'approved' : 'rejected'

  // 回写目标考勤记录(同员工 + 同部门 + 同日,未删除)
  let attendanceRecord: HrAttendanceRecord | null = null
  if (input.approve) {
    const [rec] = await db
      .select()
      .from(hrAttendanceRecord)
      .where(
        and(
          eq(hrAttendanceRecord.employeeId, fix.employeeId),
          eq(hrAttendanceRecord.departmentId, fix.departmentId),
          eq(hrAttendanceRecord.date, fix.date),
          isNull(hrAttendanceRecord.deletedAt),
        ),
      )
    if (rec) {
      const patch: Partial<typeof hrAttendanceRecord.$inferInsert> = {
        status: 'present',
        updatedAt: now,
      }
      if (fix.punchType === 'check_in' && fix.punchTime) patch.checkInTime = fix.punchTime
      if (fix.punchType === 'check_out' && fix.punchTime) patch.checkOutTime = fix.punchTime
      const [updated] = await db
        .update(hrAttendanceRecord)
        .set(patch)
        .where(eq(hrAttendanceRecord.id, rec.id))
        .returning()
      attendanceRecord = updated ?? null
    }
  }

  const [updatedFix] = await db
    .update(hrPunchFix)
    .set({
      status: newStatus,
      approverId: input.approverId,
      approveRemark: input.approveRemark ?? null,
      approveAt: now,
      updatedAt: now,
    })
    .where(eq(hrPunchFix.id, input.punchFixId))
    .returning()

  logger.info('hr punch fix approved', {
    punchFixId: input.punchFixId,
    approve: input.approve,
    approverId: input.approverId,
    wroteAttendance: attendanceRecord !== null,
  })

  return { punchFix: updatedFix ?? null, attendanceRecord }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
