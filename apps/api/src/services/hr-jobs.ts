// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
import { and, eq, isNull, ne, sql, desc, count } from 'drizzle-orm'
import { hrAttendanceRecord, hrDepartment, hrJobRun, type HrJobRun } from '@ihui/database'
import { db } from '../db/index.js'
import { bizDayKey, shiftBizDayKey } from '../utils/biz-day.js'
import { logger } from '../utils/logger.js'
import { runHrAbsentAttendance, DEFAULT_HR_BACKFILL_DAYS } from './hr-attendance.js'

/**
 * 人事定时任务(HR-1 第 0 期,2026-11-11 立):让「到点自己跑」成立。
 *
 * 三个幂等任务,全部在此单源定义(名字 / 业务窗口 / 幂等键派生 / 执行体),
 * cron 与管理端手动补跑走同一出口 runHrJob,执行留痕落 hr_job_run。
 * 幂等契约:(job_name, idempotency_key) 唯一 ⇒ 同一业务窗口重复触发不再执行、不落新数据。
 *   自动触发 idemKey = <jobName>:<业务日键>  —— 当天重跑去重
 *   手动补跑 idemKey = <jobName>:<业务日键>:m<毫秒> —— 允许管理端对同一窗口多次补跑留痕
 */

/** 任务名封闭集(与 hr_job_run.job_name 列词表一致) */
export const HR_JOB_NAMES = {
  dailyAbsent: 'hr.daily.absent',
  dailyException: 'hr.daily.exception',
  monthlyStats: 'hr.monthly.stats',
} as const

export type HrJobName = (typeof HR_JOB_NAMES)[keyof typeof HR_JOB_NAMES]

export const ALL_HR_JOB_NAMES: HrJobName[] = Object.values(HR_JOB_NAMES)

/** 任务元数据(供 GET /jobs 列表展示:名字 + 说明 + cron 表达式) */
export interface HrJobMeta {
  name: HrJobName
  description: string
  cron: string
}

export const HR_JOBS: HrJobMeta[] = [
  {
    name: HR_JOB_NAMES.dailyAbsent,
    description: '每日 00:10 补昨日(含回溯窗)缺勤',
    cron: '10 0 * * *',
  },
  {
    name: HR_JOB_NAMES.dailyException,
    description: '每日 09:00 汇总昨日迟到/早退/未签退异常清单',
    cron: '0 9 * * *',
  },
  {
    name: HR_JOB_NAMES.monthlyStats,
    description: '每月 1 日 00:30 汇总上月各部门考勤统计',
    cron: '30 0 1 * *',
  },
]

/** 统一执行结果:调用方(cron / 端点)按 ok 区分成败 */
export interface HrJobRunOutcome {
  ok: boolean
  /** skipped=true 表示幂等命中,本轮未执行(重复触发) */
  skipped: boolean
  run: HrJobRun | null
}

// ─────────────────────────────────────────────────────────────────────────────
// 各任务的纯执行体:返回 { affectedRows, summary },抛异常则该轮记 failed。
// 它们只做业务,不碰 hr_job_run(留痕由 runHrJob 统一包)。
// ─────────────────────────────────────────────────────────────────────────────

interface JobBodyResult {
  affectedRows: number
  summary: Record<string, unknown>
}

/** 任务① 每日缺勤补录:复用既有 runHrAbsentAttendance(含回溯窗 + 工作日门控 + core 判定)。 */
async function runDailyAbsentBody(at: Date): Promise<JobBodyResult> {
  const res = await runHrAbsentAttendance(at, { backfillDays: DEFAULT_HR_BACKFILL_DAYS })
  return {
    affectedRows: res.created,
    summary: {
      rules: res.rules,
      employees: res.employees,
      created: res.created,
      skipped: res.skipped,
    },
  }
}

/** 昨日异常类型(迟到/早退/未签退) */
type ExceptionKind = 'late' | 'early' | 'missing_checkout'

interface ExceptionItem {
  employeeId: string
  departmentId: string
  date: string
  status: string
  kinds: ExceptionKind[]
}

/** 任务② 昨日异常汇总:统计迟到/早退/未签退,不写考勤记录,只把清单落 job_run.summary。 */
async function runDailyExceptionBody(at: Date): Promise<JobBodyResult> {
  // 昨日(上海业务日)的 [起点, 终点) UTC 区间;date 列按业务日键等值更稳妥,这里用键
  const yesterdayKey = shiftBizDayKey(bizDayKey(at), -1)
  const rows = await db
    .select({
      employeeId: hrAttendanceRecord.employeeId,
      departmentId: hrAttendanceRecord.departmentId,
      date: hrAttendanceRecord.date,
      status: hrAttendanceRecord.status,
      checkInTime: hrAttendanceRecord.checkInTime,
      checkOutTime: hrAttendanceRecord.checkOutTime,
    })
    .from(hrAttendanceRecord)
    .where(
      and(
        eq(hrAttendanceRecord.date, yesterdayKey),
        isNull(hrAttendanceRecord.deletedAt),
        ne(hrAttendanceRecord.status, 'leave'),
      ),
    )

  const items: ExceptionItem[] = []
  for (const r of rows) {
    const kinds: ExceptionKind[] = []
    if (r.status === 'late') kinds.push('late')
    if (r.status === 'early') kinds.push('early')
    // 未签退:有签到但无签退(且不是缺勤/请假 —— absent 由任务①补,leave 由审批覆盖)
    if (r.checkInTime && !r.checkOutTime && r.status !== 'absent') kinds.push('missing_checkout')
    if (kinds.length > 0) {
      items.push({
        employeeId: String(r.employeeId),
        departmentId: String(r.departmentId),
        date: r.date,
        status: r.status,
        kinds,
      })
    }
  }

  // 按类型计数,便于机主一眼看清昨日异常结构
  const byKind: Record<ExceptionKind, number> = { late: 0, early: 0, missing_checkout: 0 }
  for (const it of items) for (const k of it.kinds) byKind[k] += 1

  return {
    affectedRows: items.length,
    summary: { date: yesterdayKey, total: items.length, byKind, items },
  }
}

/** 任务③ 上月部门考勤统计:按部门 × 状态聚合上月记录数,清单落 job_run.summary。 */
async function runMonthlyStatsBody(at: Date): Promise<JobBodyResult> {
  // 上月 1 日 ~ 本月 1 日(上海业务日)→ 折成 [startUtc, endUtc) 供 gte/lt createdAt 对齐 biz-day 口径。
  // 这里按 date 列(业务日键 YYYY-MM-DD)做字符串区间,与考勤记录写入口径一致。
  const now = bizDayKey(at)
  const [y, m] = now.split('-').map(Number)
  // 上月:本月 1 日往前推一天所在月(处理 1 月 → 去年 12 月)
  const firstOfThisMonthKey = `${y}-${String(m).padStart(2, '0')}-01`
  const lastOfPrevMonthKey = shiftBizDayKey(firstOfThisMonthKey, -1)
  const [py, pm] = lastOfPrevMonthKey.split('-').map(Number)
  const firstOfPrevMonthKey = `${py}-${String(pm).padStart(2, '0')}-01`

  // 按部门聚合各状态计数(status 是封闭集 present/late/early/absent/leave)
  const rows = await db
    .select({
      departmentId: hrAttendanceRecord.departmentId,
      status: hrAttendanceRecord.status,
      c: count(),
    })
    .from(hrAttendanceRecord)
    .where(
      and(
        sql`${hrAttendanceRecord.date} >= ${firstOfPrevMonthKey}`,
        sql`${hrAttendanceRecord.date} < ${firstOfThisMonthKey}`,
        isNull(hrAttendanceRecord.deletedAt),
      ),
    )
    .groupBy(hrAttendanceRecord.departmentId, hrAttendanceRecord.status)

  // 折成 { deptId: { status: n } }
  const deptMap = new Map<string, Record<string, number>>()
  for (const r of rows) {
    const dept = String(r.departmentId)
    const cur = deptMap.get(dept) ?? {}
    cur[r.status] = Number(r.c)
    deptMap.set(dept, cur)
  }

  const departments = await db
    .select({ id: hrDepartment.id, name: hrDepartment.name })
    .from(hrDepartment)
  const nameOf = new Map(departments.map((d) => [String(d.id), d.name]))

  const perDepartment = Array.from(deptMap.entries()).map(([deptId, statuses]) => ({
    departmentId: deptId,
    departmentName: nameOf.get(deptId) ?? null,
    statuses,
    total: Object.values(statuses).reduce((a, b) => a + b, 0),
  }))

  return {
    affectedRows: perDepartment.length,
    summary: {
      month: `${py}-${String(pm).padStart(2, '0')}`,
      range: { start: firstOfPrevMonthKey, end: firstOfThisMonthKey },
      departments: perDepartment,
    },
  }
}

/** 任务名 → 执行体(单源映射,runHrJob 据此分发) */
const JOB_BODIES: Record<HrJobName, (at: Date) => Promise<JobBodyResult>> = {
  [HR_JOB_NAMES.dailyAbsent]: runDailyAbsentBody,
  [HR_JOB_NAMES.dailyException]: runDailyExceptionBody,
  [HR_JOB_NAMES.monthlyStats]: runMonthlyStatsBody,
}

// ─────────────────────────────────────────────────────────────────────────────
// 统一执行出口:留痕 + 幂等 + 成败回写。cron 与手动补跑唯一入口。
// ─────────────────────────────────────────────────────────────────────────────

/** 手动补跑幂等键的单调后缀:进程内单调递增,保证同毫秒多次补跑也各得唯一键。 */
let manualSeq = 0

/**
 * 执行一个人事定时任务并留痕。
 * @param name 任务名(必须 ∈ ALL_HR_JOB_NAMES,未知名字抛错)
 * @param at 触发时刻(用于派生业务窗口与幂等键;cron 传当下,手动补跑可传指定时刻)
 * @param opts.manual 手动补跑=true ⇒ 幂等键带毫秒后缀,允许对同一业务窗口多次补跑留痕
 */
export async function runHrJob(
  name: string,
  at: Date = new Date(),
  opts: { manual?: boolean } = {},
): Promise<HrJobRunOutcome> {
  if (!Object.prototype.hasOwnProperty.call(JOB_BODIES, name)) {
    throw new Error(`unknown hr job: ${name}`)
  }
  const jobName = name as HrJobName
  const body = JOB_BODIES[jobName]

  // 幂等键:业务窗口 = 触发时刻所在的上海业务日键(月任务也用日键区分,只是窗口语义在 body 内是上月)
  const dayKey = bizDayKey(at)
  // 手动补跑后缀用单调计数器:同毫秒内多次补跑也各得唯一键(避免 Date.now() 同毫秒碰撞成同键)
  manualSeq += 1
  const idemKey = opts.manual
    ? `${jobName}:${dayKey}:m${Date.now()}-${manualSeq}`
    : `${jobName}:${dayKey}`

  // 幂等闸:先插 running 行;命中唯一约束 ⇒ skipped=true 直接返回(自动重复触发去重)
  const [inserted] = await db
    .insert(hrJobRun)
    .values({
      jobName,
      scheduledAt: at,
      startedAt: new Date(),
      status: 'running',
      idempotencyKey: idemKey,
    })
    .onConflictDoNothing()
    .returning()

  if (!inserted) {
    logger.info('hr job skipped (idempotent hit)', { jobName, idemKey })
    return { ok: true, skipped: true, run: null }
  }

  const runId = inserted.id
  try {
    const result = await body(at)
    const [updated] = await db
      .update(hrJobRun)
      .set({
        status: 'success',
        affectedRows: result.affectedRows,
        summary: result.summary,
        finishedAt: new Date(),
      })
      .where(eq(hrJobRun.id, runId))
      .returning()
    logger.info('hr job success', { jobName, idemKey, affectedRows: result.affectedRows })
    return { ok: true, skipped: false, run: updated ?? null }
  } catch (e) {
    const msg = String((e as { message?: string })?.message ?? e).slice(0, 1000)
    const [updated] = await db
      .update(hrJobRun)
      .set({ status: 'failed', errorMessage: msg, finishedAt: new Date() })
      .where(eq(hrJobRun.id, runId))
      .returning()
    logger.error('hr job failed', { jobName, idemKey, err: msg })
    return { ok: false, skipped: false, run: updated ?? null }
  }
}

/** 任务执行历史(供 GET /jobs/:name/runs 与管理端回查;按开始时间倒序,分页)。 */ export async function listHrJobRuns(params: {
  jobName?: string
  limit?: number
  offset?: number
}): Promise<{ list: HrJobRun[]; total: number }> {
  const where = params.jobName ? eq(hrJobRun.jobName, params.jobName) : undefined
  const [totalRow] = await db.select({ c: count() }).from(hrJobRun).where(where)
  const list = await db
    .select()
    .from(hrJobRun)
    .where(where)
    .orderBy(desc(hrJobRun.startedAt))
    .limit(params.limit ?? 50)
    .offset(params.offset ?? 0)
  return { list, total: Number(totalRow?.c ?? 0) }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
