// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 每日缺勤补录 job(2026-11-01 立,ATT-JOB 票)。
 *
 * 立因:`edu_attendance_record` 的 status 支持 absent,但**全仓无任何定时任务
 * 为"当天没签到的学生"补一条缺勤记录**(实测:`eduAttendanceRecord` 只在
 * `routes/edu-ai-management.ts` 与 schema 出现)。后果是 `GET /attendance/stats`
 * 的分母 = "表里已有的行",没来的人压根不进统计 ⇒ 报表缺勤恒 0、出勤率虚高。
 *
 * 本票补上这一格:每条 enabled 且过 absentAfter 的规则 ⇒ 对该班在册学生
 * 逐一日无未软删签到记录者 insert `{status:'absent', checkInMethod:'manual', operatedBy:null}`。
 * 幂等靠 S1 席在 `edu_attendance_record` 加的 `(student_id, class_id, date)`
 * 部分唯一索引 + `onConflictDoNothing`(本仓铁律:幂等用它)。
 *
 * 在册口径(§22c 单源,不另定义):
 *   grep `apps/api/src/routes/edu-ai-management.ts` 得
 *     · L3011:`where(and(eq(eduEnrollment.studentId, childId), isNull(eduEnrollment.deletedAt)))`
 *     · L3994–3997:`conds = [isNull(eduEnrollment.deletedAt)]; if (parsed.data.status) conds.push(eq(eduEnrollment.status, parsed.data.status))`
 *     · schema L620 注释:`status: enrolled/withdrawn/graduate`
 *   ⇒ 本 job 的"在册" = `eduEnrollment.status='enrolled' ∧ isNull(deletedAt)`;
 *     withdrawn / graduate 不算在册(退学与毕业的人不该被记今日缺勤)。
 *
 * 计数诚实性(blocking 门 134):
 *   rules / students / created / skipped / missedIds 五个数一律来自 `.returning()`
 *   回库确认;禁止把请求侧 `.length` 当 affected。
 *
 * 契约依赖(2026-11-01 现读):S1 席已把 `eduAttendanceRule` 落到
 *   `packages/database/src/schema/edu-ai-management.ts:267`(classId/lateAfter/
 *   earlyBefore/absentAfter/enabled/deletedAt 六列齐备)。
 *
 * 时区:`absentAfter` 语义是**北京时间(Asia/Shanghai)的墙钟 HH:MM**
 *   (与 `agent-automation-scheduler.ts:22` 头注同一条纪律,不受宿主时区影响)。
 *   阈值到期判定走 Intl 显式时区,不读 `Date#setHours`。
 */

import { and, eq, inArray, isNull, sql } from 'drizzle-orm'
import { eduAttendanceRecord, eduAttendanceRule, eduEnrollment } from '@ihui/database'
import { db } from '../db/index.js'
import { logger } from '../utils/logger.js'
import { bizDayKey } from '../utils/biz-day.js'
import { normalizeHm } from './edu-schedule-conflict.js'

/** 业务时区:与 patrol/automation 调度器同源,不受宿主 TZ 漂移 */
const BIZ_TIMEZONE = 'Asia/Shanghai'

/** 单次运行汇总;五档计数全部来自 .returning() 回库,禁止用请求侧 length */
export interface AbsentRunResult {
  /** 本轮扫到的启用规则数(仅计过 absentAfter 的) */
  rules: number
  /** 本轮纳入判定的在册学生总数(按班去重后的候选人数之和) */
  students: number
  /** 实际写入的缺勤条数 */
  created: number
  /** 应写但被唯一索引去重 / 已存在未软删行 ⇒ 跳过的条数 */
  skipped: number
  /** 未落库的学生 id 集合(供二次核对/告警;门 134 要求"响应带 missedIds") */
  missedIds: string[]
}

/** 只暴露判据与主入口给测试;`judgeStatus` 在 edu-attendance-rule.ts,本文件不复制 */
export const __test__ = {
  isPastHm,
  normalizeHm,
}

/**
 * 判定"当前时刻是否已过 wallClock(HH:MM) 的墙钟阈值"。
 * 归一化拿不到 ⇒ 返回 false(不猜"已过");比较两侧必须是补零 HH:MM(§22c 单源)。
 */
export function isPastHm(
  wallClock: string,
  now: Date = new Date(),
  timezone: string = BIZ_TIMEZONE,
): boolean {
  const threshold = normalizeHm(wallClock)
  if (!threshold) return false
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: timezone,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(now)
  const hh = parts.find((p) => p.type === 'hour')?.value ?? ''
  const mm = parts.find((p) => p.type === 'minute')?.value ?? ''
  const nowHm = `${hh}:${mm}`
  if (nowHm.length !== 5) return false // 量不到 ⇒ 不猜"已过"
  return nowHm >= threshold
}

/**
 * 主入口:每日缺勤补录一轮。
 * 由 `scheduled-tasks-service.recordAbsentDaily()` 包装,再由 scheduler-worker 的
 * switch case 调用;本文件不做 setInterval(§"造好没装车"= 没有)。
 */
export async function runAbsentAttendance(at: Date = new Date()): Promise<AbsentRunResult> {
  const dateKey = bizDayKey(at) // YYYY-MM-DD 与 edu_attendance_record.date 对齐

  // ① 取所有 enabled 且 absentAfter 非空的规则(表未落盘时此句 typecheck 红属预期)
  const rules = await db
    .select({
      id: eduAttendanceRule.id,
      classId: eduAttendanceRule.classId,
      absentAfter: eduAttendanceRule.absentAfter,
    })
    .from(eduAttendanceRule)
    .where(
      and(
        eq(eduAttendanceRule.enabled, true),
        isNull(eduAttendanceRule.deletedAt),
        sql`${eduAttendanceRule.absentAfter} IS NOT NULL`,
      ),
    )

  // ② 只保留"当前墙钟已过 absentAfter"的规则(未过 ⇒ 今日还没到判缺勤的点)
  const dueRules = rules.filter((r) => isPastHm(String(r.absentAfter ?? ''), at))
  if (dueRules.length === 0) {
    return { rules: 0, students: 0, created: 0, skipped: 0, missedIds: [] }
  }

  let studentTotal = 0
  let createdTotal = 0
  let skippedTotal = 0
  const missedAll: string[] = []

  // ③ 逐规则:取该班在册学生 → 剔掉当日已有未软删签到记录的 → 批量 insert
  for (const rule of dueRules) {
    const enrolledStudents = await db
      .select({ studentId: eduEnrollment.studentId })
      .from(eduEnrollment)
      .where(
        and(
          eq(eduEnrollment.classId, rule.classId),
          eq(eduEnrollment.status, 'enrolled'),
          isNull(eduEnrollment.deletedAt),
        ),
      )
    const studentIds = Array.from(new Set(enrolledStudents.map((s) => s.studentId)))
    studentTotal += studentIds.length
    if (studentIds.length === 0) continue

    // 已有未软删记录的学生(本 job 幂等预筛;真正兜底靠 S1 唯一索引)
    const existing = await db
      .select({ studentId: eduAttendanceRecord.studentId })
      .from(eduAttendanceRecord)
      .where(
        and(
          eq(eduAttendanceRecord.classId, rule.classId),
          eq(eduAttendanceRecord.date, dateKey),
          inArray(eduAttendanceRecord.studentId, studentIds),
          isNull(eduAttendanceRecord.deletedAt),
        ),
      )
    const existingSet = new Set(existing.map((r) => r.studentId))
    const candidates = studentIds.filter((id) => !existingSet.has(id))

    if (candidates.length === 0) {
      skippedTotal += studentIds.length
      continue
    }

    const inserted = await db
      .insert(eduAttendanceRecord)
      .values(
        candidates.map((studentId) => ({
          studentId,
          classId: rule.classId,
          date: dateKey,
          status: 'absent',
          checkInMethod: 'manual',
          operatedBy: null,
        })),
      )
      .onConflictDoNothing()
      .returning({ id: eduAttendanceRecord.id, studentId: eduAttendanceRecord.studentId })

    createdTotal += inserted.length
    const insertedSet = new Set(inserted.map((r) => r.studentId))
    const missed = candidates.filter((id) => !insertedSet.has(id))
    if (missed.length > 0) {
      skippedTotal += missed.length
      missedAll.push(...missed)
    }
  }

  logger.info('edu attendance absent job done', {
    dateKey,
    rules: dueRules.length,
    students: studentTotal,
    created: createdTotal,
    skipped: skippedTotal,
    missedIds: missedAll.length,
  })

  return {
    rules: dueRules.length,
    students: studentTotal,
    created: createdTotal,
    skipped: skippedTotal,
    missedIds: missedAll,
  }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
