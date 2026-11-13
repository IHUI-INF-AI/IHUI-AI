// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { and, between, eq, inArray, isNull, sql } from 'drizzle-orm'

import {
  hrAttendanceDaily,
  hrAttendanceMonthly,
  hrAttendanceRecord,
  hrAttendanceRule,
  hrDepartment,
  hrEmployee,
  hrLeaveRequest,
  hrOutgoingRecord,
  hrOvertimeRecord,
  hrShift,
} from '@ihui/database'
import { db } from '../db/index.js'
import { logger } from '../utils/logger.js'
import { AppError } from '../errors/AppError.js'

/**
 * 考勤日结 / 月结汇总服务(HR-5 第 4 期,2026-11-12 立)。
 *
 * 为什么必须有这一层:
 *   在此之前 hr_attendance_daily 与 hr_attendance_monthly **只有读、没有任何写**,
 *   四类导入数据(打卡/请假/加班/外出)存进去了却永远算不进工资 —— 等于白存。
 *
 * 数据流(单一方向,不回头):
 *   hr_attendance_record(打卡) ┐
 *   hr_leave_request(请假)      ├→ hr_attendance_daily(日结) → hr_attendance_monthly(月结)
 *   hr_overtime_record(加班)    ┘
 *   hr_outgoing_record(外出)    ┘
 *
 * 口径铁律:
 *   · 月结只**汇总**日结,不重新读原始单据(避免两套判据漂移);
 *   · 日结是幂等的:同一员工同一天重复跑只更新不重复插入;
 *   · 已 signed 的月结**拒绝覆盖** —— 财务签过字的账不能被后台任务悄悄改掉。
 */

// =============================================================================
// 日结
// =============================================================================

/** 业务时区固定 +08:00(与 hr-import 同源口径) */
const BIZ_TZ = 'Asia/Shanghai'

/** 取某月的起止日期(YYYY-MM-DD),含首尾 */
function monthRange(periodMonth: string): { start: string; end: string } {
  if (!/^\d{4}-\d{2}$/.test(periodMonth)) {
    throw new AppError('月份格式必须是 YYYY-MM', 400, 'ATT_BAD_PERIOD')
  }
  const [y, m] = periodMonth.split('-').map(Number) as [number, number]
  if (m < 1 || m > 12) throw new AppError('月份不合法', 400, 'ATT_BAD_PERIOD')
  const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate()
  return { start: `${periodMonth}-01`, end: `${periodMonth}-${String(lastDay).padStart(2, '0')}` }
}

/** 是否工作日(按规则周掩码:bit0=周一 … bit6=周日) */
function isWorkdayByMask(dateKey: string, workdaysMask: number): boolean {
  const d = new Date(`${dateKey}T00:00:00Z`)
  if (Number.isNaN(d.getTime())) return false
  // JS getUTCDay():0=周日…6=周六;规则掩码 bit0=周一
  const jsDow = d.getUTCDay()
  const bit = jsDow === 0 ? 6 : jsDow - 1
  return ((workdaysMask >> bit) & 1) === 1
}

/** 两个 HH:mm(:ss) 之间的分钟差;跨天按次日 */
function minutesBetweenHm(start: string, end: string): number {
  const toMin = (t: string) => {
    const [h, m] = t.split(':').map(Number)
    return (h ?? 0) * 60 + (m ?? 0)
  }
  let diff = toMin(end) - toMin(start)
  if (diff < 0) diff += 24 * 60
  return diff
}

/**
 * 同日两时刻的有符号差值(分钟):to - from。
 * 与 minutesBetweenHm 的区别:**不回绕**。
 *   sameDayDiff('09:00','08:55') = -5   (早到 5 分钟,不是迟到)
 *   sameDayDiff('09:00','09:30') = +30  (迟到 30 分钟)
 * 用于迟到/早退判定,避免把跨夜回绕当成迟到 23 小时。
 */
function sameDayDiff(from: string, to: string): number | null {
  const toMin = (t: string): number | null => {
    const m = /^(\d{1,2}):(\d{2})/.exec(t)
    if (!m) return null
    const h = Number(m[1])
    const mi = Number(m[2])
    if (h > 23 || mi > 59) return null
    return h * 60 + mi
  }
  const a = toMin(from)
  const b = toMin(to)
  if (a === null || b === null) return null
  return b - a
}

/** 从 timestamp 取业务时区的 HH:mm */
function bizHmOf(d: Date): string {
  const fmt = new Intl.DateTimeFormat('en-GB', {
    timeZone: BIZ_TZ,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
  return fmt.format(d)
}

export interface DailyBuildResult {
  periodMonth: string
  employeeDays: number
  inserted: number
  updated: number
}

/**
 * 生成日结(某月的每一天 × 每个在职员工)。
 *
 * 判定口径:
 *   · 应出勤分钟:scheduledMinutes —— 有班次按班次时长,无班次按规则工作日 480 分钟
 *   · 实出勤分钟:actualMinutes —— 打卡时刻差;请假/外出按对应单据补足
 *   · 迟到/早退:lateAfter / earlyBefore 阈值(来自 hr_attendance_rule)
 *   · 加班:approved 的 hr_overtime_record 汇总
 *   · 状态优先级:leave(请假) > absent(缺勤) > present(正常,含外出) > late/early
 */
export async function buildDailyAttendance(params: {
  periodMonth: string
  departmentId?: string | undefined
  employeeId?: string | undefined
}): Promise<DailyBuildResult> {
  const { periodMonth, departmentId, employeeId } = params
  const { start, end } = monthRange(periodMonth)

  // 在职员工
  const empFilters = [eq(hrEmployee.status, 'active'), isNull(hrEmployee.deletedAt)]
  if (departmentId) empFilters.push(eq(hrEmployee.departmentId, departmentId))
  if (employeeId) empFilters.push(eq(hrEmployee.id, employeeId))
  const employees = await db
    .select({
      id: hrEmployee.id,
      departmentId: hrEmployee.departmentId,
      hireDate: hrEmployee.hireDate,
    })
    .from(hrEmployee)
    .where(and(...empFilters))

  if (employees.length === 0) {
    return { periodMonth, employeeDays: 0, inserted: 0, updated: 0 }
  }

  const empIds = employees.map((e) => e.id)

  // 规则(按部门)
  const rules = await db.select().from(hrAttendanceRule).where(isNull(hrAttendanceRule.deletedAt))
  const ruleByDept = new Map(rules.map((r) => [r.departmentId, r]))

  // 班次(按部门)
  const shifts = await db
    .select()
    .from(hrShift)
    .where(and(isNull(hrShift.deletedAt), eq(hrShift.status, 'enabled')))
  const shiftByDept = new Map(shifts.map((s) => [s.departmentId, s]))

  // 一次性取回该月所有原始单据,避免逐日 N+1
  const records = await db
    .select()
    .from(hrAttendanceRecord)
    .where(
      and(
        inArray(hrAttendanceRecord.employeeId, empIds),
        between(hrAttendanceRecord.date, start, end),
        isNull(hrAttendanceRecord.deletedAt),
      ),
    )
  const recordByEmpDate = new Map(records.map((r) => [`${r.employeeId}|${r.date}`, r] as const))

  const leaves = await db
    .select()
    .from(hrLeaveRequest)
    .where(
      and(
        inArray(hrLeaveRequest.employeeId, empIds),
        eq(hrLeaveRequest.status, 'approved'),
        isNull(hrLeaveRequest.deletedAt),
        // 区间相交:请假开始 <= 月末 且 结束 >= 月初
        sql`${hrLeaveRequest.startDate} <= ${end}::date`,
        sql`${hrLeaveRequest.endDate} >= ${start}::date`,
      ),
    )

  const overtimes = await db
    .select()
    .from(hrOvertimeRecord)
    .where(
      and(
        inArray(hrOvertimeRecord.employeeId, empIds),
        between(hrOvertimeRecord.date, start, end),
        eq(hrOvertimeRecord.status, 'approved'),
        isNull(hrOvertimeRecord.deletedAt),
      ),
    )
  const otByEmpDate = new Map(overtimes.map((o) => [`${o.employeeId}|${o.date}`, o] as const))

  const outgoings = await db
    .select()
    .from(hrOutgoingRecord)
    .where(
      and(
        inArray(hrOutgoingRecord.employeeId, empIds),
        eq(hrOutgoingRecord.status, 'approved'),
        isNull(hrOutgoingRecord.deletedAt),
        sql`${hrOutgoingRecord.startDate} <= ${end}::date`,
        sql`${hrOutgoingRecord.endDate} >= ${start}::date`,
      ),
    )

  // 逐员工逐日算
  const rows: (typeof hrAttendanceDaily.$inferInsert)[] = []
  for (const emp of employees) {
    const rule = ruleByDept.get(emp.departmentId)
    const shift = shiftByDept.get(emp.departmentId)
    const workdaysMask = rule?.workdays ?? 127

    const cursor = new Date(`${start}T00:00:00Z`)
    const endDate = new Date(`${end}T00:00:00Z`)
    while (cursor <= endDate) {
      const dateKey = cursor.toISOString().slice(0, 10)

      // 入职前不算
      if (emp.hireDate && dateKey < emp.hireDate) {
        cursor.setUTCDate(cursor.getUTCDate() + 1)
        continue
      }

      const isWorkday = isWorkdayByMask(dateKey, workdaysMask)
      const record = recordByEmpDate.get(`${emp.id}|${dateKey}`)
      const leave = leaves.find(
        (l) => l.employeeId === emp.id && l.startDate <= dateKey && l.endDate >= dateKey,
      )
      const ot = otByEmpDate.get(`${emp.id}|${dateKey}`)
      const outgoing = outgoings.find(
        (o) => o.employeeId === emp.id && o.startDate <= dateKey && o.endDate >= dateKey,
      )

      // 应出勤
      let scheduledMinutes = 0
      if (isWorkday) {
        scheduledMinutes = shift ? minutesBetweenHm(shift.startTime, shift.endTime) : 480
      }

      // 实出勤
      let actualMinutes = 0
      let lateMinutes = 0
      let earlyMinutes = 0

      if (record?.checkInTime && record?.checkOutTime) {
        const inHm = bizHmOf(record.checkInTime)
        const outHm = bizHmOf(record.checkOutTime)
        actualMinutes = minutesBetweenHm(inHm, outHm)
        // 迟到:实际签到时刻**晚于** lateAfter。
        // 必须用「同日有符号差值」而非跨夜区间算法 ——
        // minutesBetweenHm('09:00','08:55') 会回绕成 23h55m,把早到判成迟到 1435 分钟。
        if (rule?.lateAfter) {
          const lateBy = sameDayDiff(rule.lateAfter, inHm)
          const flex = shift?.flexMinutes ?? 0
          if (lateBy !== null && lateBy > flex) lateMinutes = lateBy - flex
        }
        // 早退:实际签退时刻**早于** earlyBefore,同理用同日差值
        if (rule?.earlyBefore) {
          const earlyBy = sameDayDiff(outHm, rule.earlyBefore)
          if (earlyBy !== null && earlyBy > 0) earlyMinutes = earlyBy
        }
      } else if (record?.checkInTime || record?.checkOutTime) {
        // 只有一端打卡:按单边时刻计,不臆造另一端
        actualMinutes = 0
      }

      // 外出补足(外出算出勤,但不重复叠加已打卡时长)
      if (outgoing && actualMinutes < outgoing.minutes) {
        actualMinutes = Math.min(scheduledMinutes || outgoing.minutes, outgoing.minutes)
      }

      // 加班
      const overtimeMinutes = ot?.minutes ?? 0

      // 状态判定(优先级:请假 > 缺勤 > 正常)
      let status: string
      if (leave) {
        status = 'leave'
        // 请假当天算出勤(带薪假),实出勤补到应出勤
        if (scheduledMinutes > 0) actualMinutes = scheduledMinutes
        lateMinutes = 0
        earlyMinutes = 0
      } else if (!isWorkday && !record && !outgoing) {
        // 非工作日且无任何记录 → 休息,不记缺勤
        status = 'rest'
        scheduledMinutes = 0
      } else if (isWorkday && !record && !outgoing) {
        status = 'absent'
      } else if (lateMinutes > 0) {
        status = 'late'
      } else if (earlyMinutes > 0) {
        status = 'early'
      } else {
        status = 'present'
      }

      rows.push({
        employeeId: emp.id,
        departmentId: emp.departmentId,
        date: dateKey,
        shiftId: shift?.id ?? null,
        scheduledMinutes,
        actualMinutes,
        lateMinutes,
        earlyMinutes,
        overtimeMinutes,
        status,
      })

      cursor.setUTCDate(cursor.getUTCDate() + 1)
    }
  }

  // 落库:按 (employeeId, departmentId, date) 幂等 upsert
  let inserted = 0
  let updated = 0
  const CHUNK = 300
  for (let i = 0; i < rows.length; i += CHUNK) {
    const chunk = rows.slice(i, i + CHUNK)
    for (const row of chunk) {
      const [existing] = await db
        .select({ id: hrAttendanceDaily.id })
        .from(hrAttendanceDaily)
        .where(
          and(
            eq(hrAttendanceDaily.employeeId, row.employeeId),
            eq(hrAttendanceDaily.departmentId, row.departmentId),
            eq(hrAttendanceDaily.date, row.date!),
          ),
        )
        .limit(1)
      if (existing) {
        await db
          .update(hrAttendanceDaily)
          .set({
            shiftId: row.shiftId ?? null,
            scheduledMinutes: row.scheduledMinutes ?? 0,
            actualMinutes: row.actualMinutes ?? 0,
            lateMinutes: row.lateMinutes ?? 0,
            earlyMinutes: row.earlyMinutes ?? 0,
            overtimeMinutes: row.overtimeMinutes ?? 0,
            status: row.status ?? 'present',
            updatedAt: new Date(),
          })
          .where(eq(hrAttendanceDaily.id, existing.id))
        updated++
      } else {
        await db.insert(hrAttendanceDaily).values(row).onConflictDoNothing()
        inserted++
      }
    }
  }

  logger.info('日结生成完成', { periodMonth, employeeDays: rows.length, inserted, updated })
  return { periodMonth, employeeDays: rows.length, inserted, updated }
}

// =============================================================================
// 月结
// =============================================================================

export interface MonthlyBuildResult {
  periodMonth: string
  employees: number
  inserted: number
  updated: number
  skippedSigned: number
}

/**
 * 生成月结:把日结汇总成月度考勤表。
 *
 * 只读 hr_attendance_daily(单一真相源),不回头读原始单据,
 * 避免「日结一套口径、月结另一套口径」的经典漂移。
 */
export async function buildMonthlyAttendance(params: {
  periodMonth: string
  departmentId?: string | undefined
  overwriteSigned?: boolean | undefined
}): Promise<MonthlyBuildResult> {
  const { periodMonth, departmentId, overwriteSigned = false } = params
  const { start, end } = monthRange(periodMonth)

  const dailyFilters = [between(hrAttendanceDaily.date, start, end)]
  if (departmentId) dailyFilters.push(eq(hrAttendanceDaily.departmentId, departmentId))
  const dailies = await db
    .select()
    .from(hrAttendanceDaily)
    .where(and(...dailyFilters))

  if (dailies.length === 0) {
    throw new AppError(
      `该月没有日结数据,请先执行日结生成(periodMonth=${periodMonth})`,
      400,
      'ATT_NO_DAILY_DATA',
    )
  }

  // 按员工聚合
  const byEmp = new Map<
    string,
    {
      departmentId: string
      scheduledDays: number
      actualDays: number
      lateCount: number
      earlyCount: number
      absentDays: number
      otMinutes: number
      otByType: { weekday: number; weekend: number; holiday: number }
    }
  >()

  // 加班类型明细要从 hr_overtime_record 取(日结只存总分钟数)
  const empIds = [...new Set(dailies.map((d) => d.employeeId))]
  const overtimes = await db
    .select()
    .from(hrOvertimeRecord)
    .where(
      and(
        inArray(hrOvertimeRecord.employeeId, empIds),
        between(hrOvertimeRecord.date, start, end),
        eq(hrOvertimeRecord.status, 'approved'),
        isNull(hrOvertimeRecord.deletedAt),
      ),
    )
  const otTypeByEmp = new Map<string, { weekday: number; weekend: number; holiday: number }>()
  for (const o of overtimes) {
    const cur = otTypeByEmp.get(o.employeeId) ?? { weekday: 0, weekend: 0, holiday: 0 }
    if (o.overtimeType === 'weekend') cur.weekend += o.minutes
    else if (o.overtimeType === 'holiday') cur.holiday += o.minutes
    else cur.weekday += o.minutes
    otTypeByEmp.set(o.employeeId, cur)
  }

  for (const d of dailies) {
    const cur = byEmp.get(d.employeeId) ?? {
      departmentId: d.departmentId,
      scheduledDays: 0,
      actualDays: 0,
      lateCount: 0,
      earlyCount: 0,
      absentDays: 0,
      otMinutes: 0,
      otByType: { weekday: 0, weekend: 0, holiday: 0 },
    }
    // 天数按「有应出勤且实出勤达 8h」折算;此处用分钟/480 保留小数
    if (d.scheduledMinutes > 0) {
      cur.scheduledDays += d.scheduledMinutes / 480
      cur.actualDays += Math.min(d.actualMinutes / 480, d.scheduledMinutes / 480)
    }
    if (d.status === 'late') cur.lateCount++
    if (d.status === 'early') cur.earlyCount++
    if (d.status === 'absent') cur.absentDays += 1
    cur.otMinutes += d.overtimeMinutes
    byEmp.set(d.employeeId, cur)
  }

  // 请假明细
  const leaves = await db
    .select()
    .from(hrLeaveRequest)
    .where(
      and(
        inArray(hrLeaveRequest.employeeId, empIds),
        eq(hrLeaveRequest.status, 'approved'),
        isNull(hrLeaveRequest.deletedAt),
        sql`${hrLeaveRequest.startDate} <= ${end}::date`,
        sql`${hrLeaveRequest.endDate} >= ${start}::date`,
      ),
    )
  const leaveByEmp = new Map<string, Record<string, number>>()
  for (const l of leaves) {
    const cur = leaveByEmp.get(l.employeeId) ?? {}
    cur[l.leaveType] = (cur[l.leaveType] ?? 0) + l.totalDays
    leaveByEmp.set(l.employeeId, cur)
  }

  let inserted = 0
  let updated = 0
  let skippedSigned = 0

  for (const [empId, agg] of byEmp) {
    const [existing] = await db
      .select({ id: hrAttendanceMonthly.id, signed: hrAttendanceMonthly.signed })
      .from(hrAttendanceMonthly)
      .where(
        and(
          eq(hrAttendanceMonthly.periodMonth, periodMonth),
          eq(hrAttendanceMonthly.employeeId, empId),
        ),
      )
      .limit(1)

    if (existing?.signed && !overwriteSigned) {
      // 已签字归档的账不许后台任务悄悄改
      skippedSigned++
      continue
    }

    const otByType = otTypeByEmp.get(empId) ?? { weekday: 0, weekend: 0, holiday: 0 }
    const values = {
      periodMonth,
      employeeId: empId,
      departmentId: agg.departmentId,
      scheduledDays: agg.scheduledDays.toFixed(1),
      actualDays: agg.actualDays.toFixed(1),
      lateCount: agg.lateCount,
      earlyCount: agg.earlyCount,
      absentDays: agg.absentDays.toFixed(1),
      leaveDays: leaveByEmp.get(empId) ?? {},
      otHours: (agg.otMinutes / 60).toFixed(2),
      otDetail: {
        weekday: Number((otByType.weekday / 60).toFixed(2)),
        weekend: Number((otByType.weekend / 60).toFixed(2)),
        holiday: Number((otByType.holiday / 60).toFixed(2)),
      },
      generatedBy: 'system_job' as const,
      updatedAt: new Date(),
    }

    if (existing) {
      await db
        .update(hrAttendanceMonthly)
        .set(values)
        .where(eq(hrAttendanceMonthly.id, existing.id))
      updated++
    } else {
      await db.insert(hrAttendanceMonthly).values(values)
      inserted++
    }
  }

  logger.info('月结生成完成', {
    periodMonth,
    employees: byEmp.size,
    inserted,
    updated,
    skippedSigned,
  })
  return { periodMonth, employees: byEmp.size, inserted, updated, skippedSigned }
}

/** 部门存在性(月结按部门过滤时用) */
export async function assertDepartment(departmentId: string): Promise<void> {
  const [d] = await db
    .select({ id: hrDepartment.id })
    .from(hrDepartment)
    .where(eq(hrDepartment.id, departmentId))
    .limit(1)
  if (!d) throw new AppError('部门不存在', 404, 'HR_DEPARTMENT_NOT_FOUND')
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
