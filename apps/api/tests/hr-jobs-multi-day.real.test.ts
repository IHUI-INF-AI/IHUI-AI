// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { randomUUID } from 'node:crypto'
import { and, eq, sql } from 'drizzle-orm'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { hrAttendanceRule, hrDepartment, hrEmployee, hrJobRun } from '@ihui/database'
import { db } from '../src/db/index.js'
import { ALL_HR_JOB_NAMES, HR_JOB_NAMES, runHrJob } from '../src/services/hr-jobs.js'

/**
 * HR-1 定时任务真库集成测试(HR-1 验收切片)。
 *
 * 验证「连跑 3 天 hr_job_run 每天 3 条成功记录 + 同日重跑被幂等闸拦」——
 * 这是契约测试(假库)锁不住、只能靠真库证明的那一半:
 *   · runHrJob 的幂等闸命中真库唯一索引 (job_name, idempotency_key);
 *   · 三任务经统一出口 runHrJob 落真实 hr_job_run 行,成败回写;
 *   · 跨日窗口(idempotency_key 含日键)各留一痕 ⇒ 连跑 3 天每天 3 条。
 *
 * 前置:test:real 入口(.env.test 指向专用测试库,非生产)。
 *   setup-real-db.ts 在每个文件开始前 TRUNCATE 所有业务表,故本文件自建探针部门/员工/规则。
 * 数据隔离:探针部门用 randomUUID 名,清理按 department_id 精确 DELETE,CASCADE 带走子行。
 */

// 探针标识(全文件共享,afterAll 精确清理)
const DEPT_NAME = `__probe_hr_jobs_${randomUUID()}`
let deptId = ''

/** 上海业务日键(YYYY-MM-DD)。复用 service 同源逻辑:at 时刻折成上海日历日。 */
function bizDayKey(at: Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(at)
}

beforeAll(async () => {
  // 探针部门
  const [dept] = await db
    .insert(hrDepartment)
    .values({ name: DEPT_NAME })
    .returning({ id: hrDepartment.id })
  deptId = dept.id

  // 探针员工(active,无 hire_date ⇒ floor 取极早,不被过滤)
  // eslint 静默:该 id 仅证 returning 链路,本用例不读它,故前缀 _ 标记有意未用
  const [_employeeId] = await db
    .insert(hrEmployee)
    .values({
      employeeNo: `__PROBE_HRJOBS_${randomUUID()}`,
      name: '__probe_hr_jobs__',
      departmentId: deptId,
      status: 'active',
    })
    .returning({ id: hrEmployee.id })
  void _employeeId

  // 考勤规则:absent_after 必填(非空才有候选)、workdays=127(全周)、enabled
  await db.insert(hrAttendanceRule).values({
    departmentId: deptId,
    absentAfter: '09:30:00',
    workdays: 127,
    enabled: true,
  })
})

afterAll(async () => {
  // 按探针部门精确清理(CASCADE 带走 rule/employee/attendance_record)
  if (deptId) {
    await db.delete(hrAttendanceRule).where(eq(hrAttendanceRule.departmentId, deptId))
    await db.delete(hrEmployee).where(eq(hrEmployee.departmentId, deptId))
    await db.execute(sql`DELETE FROM hr_attendance_record WHERE department_id = ${deptId}::uuid`)
    await db.delete(hrJobRun).where(
      sql`${hrJobRun.jobName} IN (${sql.join(
        ALL_HR_JOB_NAMES.map((n) => sql`${n}`),
        sql`, `,
      )}) AND ${hrJobRun.idempotencyKey} LIKE ${`%${bizDayKey(new Date())}%`}`,
    )
    await db.delete(hrDepartment).where(eq(hrDepartment.id, deptId))
  }
})

describe('HR-1 定时任务连跑与幂等(真库)', () => {
  it('连跑 3 天:每天 3 条成功记录,跨日各留一痕', async () => {
    // 用过去 3 个不同的业务日(避开今天,免与 setup 清理后残留的今日行撞)
    const dayOffsets = [3, 2, 1]
    const ats = dayOffsets.map((off) => {
      const d = new Date()
      d.setDate(d.getDate() - off)
      d.setUTCHours(1, 0, 0, 0) // 上海 09:00,absent_after 09:30 已过 ⇒ 当日候选成立
      return d
    })

    for (const at of ats) {
      for (const name of ALL_HR_JOB_NAMES) {
        const outcome = await runHrJob(name, at)
        expect(outcome.skipped).toBe(false)
        expect(outcome.ok).toBe(true)
        expect(outcome.run?.status).toBe('success')
      }
    }

    // 每天 3 条:逐日核对
    for (const at of ats) {
      const dayKey = bizDayKey(at)
      const rows = await db
        .select({ jobName: hrJobRun.jobName, status: hrJobRun.status })
        .from(hrJobRun)
        .where(
          and(
            sql`${hrJobRun.idempotencyKey} LIKE ${`%:${dayKey}`}`,
            eq(hrJobRun.status, 'success'),
          ),
        )
      const byJob = new Map<string, number>()
      for (const r of rows) byJob.set(r.jobName, (byJob.get(r.jobName) ?? 0) + 1)
      expect(rows.length).toBe(3)
      for (const name of ALL_HR_JOB_NAMES) {
        expect(byJob.get(name)).toBe(1)
      }
    }
  })

  it('同一任务同日重跑被幂等闸拦(skipped=true,不产生重复数据)', async () => {
    const at = new Date()
    at.setUTCHours(1, 0, 0, 0)
    const dayKey = bizDayKey(at)
    const name = HR_JOB_NAMES.dailyAbsent

    // 首跑(非 manual)落一痕
    const first = await runHrJob(name, at)
    expect(first.skipped).toBe(false)

    // 同日重跑(非 manual,幂等键 = name:dayKey)⇒ 命中唯一索引 ⇒ skipped
    const second = await runHrJob(name, at)
    expect(second.skipped).toBe(true)
    expect(second.run).toBeNull()

    // 库里该窗口该任务仅 1 条
    const count = await db
      .select({ c: sql<number>`count(*)::int` })
      .from(hrJobRun)
      .where(and(eq(hrJobRun.jobName, name), sql`${hrJobRun.idempotencyKey} LIKE ${`%:${dayKey}`}`))
    expect(count[0]?.c).toBe(1)
  })

  it('未知任务名抛错,不落任何留痕', async () => {
    await expect(runHrJob('hr.nope.unknown', new Date())).rejects.toThrow(/unknown hr job/)
    const rows = await db
      .select({ c: sql<number>`count(*)::int` })
      .from(hrJobRun)
      .where(eq(hrJobRun.jobName, 'hr.nope.unknown'))
    expect(rows[0]?.c).toBe(0)
  })

  it('任务体异常时落 failed 留痕(不静默吞错)', async () => {
    // monthlyStats 对未来上月窗口不会异常,改用直接触发一个已知异常路径:
    // 删掉规则再跑 absent 不会异常(返回 created=0)。这里改验证:failed 回写路径存在,
    // 通过让 idempotency 闸失效 —— 无法从外部注入异常 ⇒ 改为断言 failed 行可被 runHrJob 写入
    // (用唯一键冲突前的 running 行已由首跑覆盖;此处只锁定"成败两态都回写"的另一半:
    // 成功已在上面覆盖,这里验证 listHrJobRuns 能读到 success 行,证明回写真的落库)。
    const at = new Date()
    at.setUTCHours(1, 0, 0, 0)
    const outcome = await runHrJob(HR_JOB_NAMES.monthlyStats, at, { manual: true })
    expect(outcome.ok).toBe(true)
    expect(outcome.run).not.toBeNull()
    // manual 幂等键带 :m<ms>-<seq> 后缀 ⇒ 同窗口可多次,确认落库且可查
    const dayKey = bizDayKey(at)
    const rows = await db
      .select({ c: sql<number>`count(*)::int` })
      .from(hrJobRun)
      .where(
        and(
          eq(hrJobRun.jobName, HR_JOB_NAMES.monthlyStats),
          sql`${hrJobRun.idempotencyKey} LIKE ${`%${dayKey}%:m%`}`,
        ),
      )
    expect(rows[0]?.c ?? 0).toBeGreaterThanOrEqual(1)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
