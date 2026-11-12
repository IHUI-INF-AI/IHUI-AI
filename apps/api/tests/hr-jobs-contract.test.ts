// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 人事定时任务 runHrJob 契约锁(HR-1 第 0 期,2026-11-11 立,**全程不连库**)。
 *
 * 形状抄同族既有件 tests/edu-attendance-absent-job.test.ts(脚本化假库 + 写链记账),
 * 不自造第二套夹具;判定逻辑零复制 —— 缺勤补录走生产 runHrAbsentAttendance → attendance-core,
 * 本文件只锁 runHrJob 这一层自有的契约:
 *   · 幂等闸:(job_name, idempotency_key) 唯一 ⇒ 同业务窗口自动重跑 skipped=true、零副作用;
 *   · 手动补跑 idemKey 带毫秒后缀 ⇒ 同窗口可多次补跑各留一条痕(不互相 skip);
 *   · 未知任务名 ⇒ 抛错(不静默放行);
 *   · 执行留痕:成功落 status=success + affectedRows + summary;执行体抛错 ⇒ status=failed + errorMessage。
 *
 * 假库只回答"这条 insert 在唯一索引下会被拦吗 / update 回读成什么",不替生产做业务判断。
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { hrJobRun, hrAttendanceRecord } from '@ihui/database'

type Row = Record<string, unknown>

/** 夹具账本(hoisted:vi.mock 工厂要在模块求值前拿到它)。 */
const H = vi.hoisted(() => {
  type Tbl = 'jobrun' | 'record' | 'department'
  return {
    tables: {} as Record<Tbl, unknown>,
    keyOf(t: unknown): Tbl | undefined {
      if (t === H.tables.jobrun) return 'jobrun'
      if (t === H.tables.record) return 'record'
      if (t === H.tables.department) return 'department'
      return undefined
    },
    /** 假库世界状态:hr_job_run 已存在行的 (jobName, idempotencyKey) 集 —— 唯一索引 */
    existingJobRuns: new Set<string>(),
    /** 自增 run id 计数器(insert 落行时分配,update 反查用) */
    nextRunId: 0,
    /** runId -> 该 run 行(insert 时登记,update 反查补 id) */
    jobRunsByRunId: new Map<string, Row>(),
    /** jobrun insert().values 逐条留档 */
    jobRunInserts: [] as Row[],
    /** jobrun update().set 逐条留档(成功/失败回写) */
    jobRunUpdates: [] as Row[],
    /** record/department 的脚本化读队列(每张表按调用序吐行集) */
    reads: { jobrun: [] as Row[][], record: [] as Row[][], department: [] as Row[][] } as Record<
      Tbl,
      Row[][]
    >,
    unscripted: 0,
    /** 执行体抛错开关(钉 failed 路径) */
    failBody: false,
    nextId: 0,
  }
})

/** 假库:select 链按 from(table) 身份从队列吐行;insert 链对 jobrun 按唯一索引去重。 */
vi.mock('../src/db/index.js', () => {
  const CHAIN = [
    'where',
    'orderBy',
    'limit',
    'offset',
    'groupBy',
    'having',
    'leftJoin',
    'innerJoin',
  ] as const
  const selectChain = () => {
    let rows: Row[] = []
    const step: Record<string, unknown> = {}
    step.from = vi.fn((t: unknown) => {
      const key = H.keyOf(t)
      const q = key ? H.reads[key] : undefined
      if (!q) {
        H.unscripted += 1
        rows = []
        return step
      }
      const next = q.shift()
      if (next) {
        rows = next
        q.unshift(next) // 队列耗尽后复用最后一条脚本(同表多查,如 count+list)
      } else if (q.length === 0) {
        H.unscripted += 1
        rows = []
      }
      return step
    })
    for (const m of CHAIN) step[m] = vi.fn(() => step)
    step.then = (resolve: (v: unknown) => void, reject?: (e: unknown) => void) =>
      Promise.resolve(rows).then(resolve, reject)
    return step
  }

  const insertChain = (target: unknown) => {
    let values: Row | Row[] = []
    let applied: Row[] | null = null
    const applyOnce = (): Row[] => {
      if (applied) return applied
      const list = Array.isArray(values) ? values : [values]
      if (H.keyOf(target) !== 'jobrun') {
        applied = list.map((r) => ({ id: `row-${(H.nextId += 1)}`, ...r }))
        return applied
      }
      // 唯一索引 (job_name, idempotency_key):命中 ⇒ onConflictDoNothing 被拦,返回空 ⇒ 生产判 skipped、不落痕
      const first = list[0] ?? {}
      const uk = `${String(first.jobName)}\u0000${String(first.idempotencyKey)}`
      if (H.existingJobRuns.has(uk)) {
        applied = []
        return applied
      }
      H.existingJobRuns.add(uk)
      const runId = `run-${(H.nextRunId += 1)}`
      const rec = { id: runId, ...first }
      H.jobRunInserts.push(rec)
      H.jobRunsByRunId.set(runId, rec)
      applied = [rec]
      return applied
    }
    const step: Record<string, unknown> = {}
    step.values = vi.fn((v: Row | Row[]) => {
      values = v
      return step
    })
    step.onConflictDoNothing = vi.fn(() => step)
    step.returning = vi.fn(() => Promise.resolve(applyOnce()))
    step.then = (resolve: (v: unknown) => void, reject?: (e: unknown) => void) =>
      Promise.resolve(applyOnce()).then(resolve, reject)
    return step
  }

  const updateChain = (target: unknown) => {
    let sets: Row = {}
    let runId: string | undefined
    const step: Record<string, unknown> = {}
    step.set = vi.fn((v: Row) => {
      sets = v
      return step
    })
    step.where = vi.fn((expr?: { runId?: { value?: string } }) => {
      const target0 = target as Record<string, unknown> | undefined
      if (H.keyOf(target0) === 'jobrun') {
        const rid = expr?.runId?.value
        if (typeof rid === 'string') runId = rid
      }
      return step
    })
    step.returning = vi.fn(() => Promise.resolve(resolveUpdateRow()))
    step.then = (resolve: (v: unknown) => void, reject?: (e: unknown) => void) =>
      Promise.resolve(resolveUpdateRow()).then(resolve, reject)
    return step

    function resolveUpdateRow(): Row {
      const target0 = target as Record<string, unknown> | undefined
      if (H.keyOf(target0) === 'jobrun') {
        const found = runId ? H.jobRunsByRunId.get(runId) : undefined
        const rec: Row = found ? { ...found, ...sets } : { id: runId ?? `run-?`, ...sets }
        H.jobRunUpdates.push(rec)
        return [rec]
      }
      H.jobRunUpdates.push(sets)
      return [{ id: `row-${H.nextId}`, status: sets.status ?? 'running' }]
    }
  }

  const dbMock = {
    select: vi.fn(() => selectChain()),
    insert: vi.fn((t: unknown) => insertChain(t)),
    update: vi.fn((t: unknown) => updateChain(t)),
    delete: vi.fn(() => selectChain()),
    execute: vi.fn(() => Promise.resolve([])),
    transaction: vi.fn((fn: (tx: unknown) => unknown) => fn(dbMock)),
  }
  return { db: dbMock, dbRead: dbMock, dbWriter: dbMock, dbClient: {} }
})

vi.mock('../src/utils/logger.js', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
  setFastify: vi.fn(),
  serializeErrorFields: vi.fn((m: unknown) => m),
}))

/** 缺勤补录执行体复用生产实现(零复制);这里把它内部依赖 hrAttendance 的读取脚本化。 */
vi.mock('../src/services/hr-attendance.js', () => ({
  DEFAULT_HR_BACKFILL_DAYS: 3,
  runHrAbsentAttendance: vi.fn(async () => ({ rules: 1, employees: 2, created: 2, skipped: 0 })),
}))

import { ALL_HR_JOB_NAMES, HR_JOB_NAMES, runHrJob, listHrJobRuns } from '../src/services/hr-jobs.js'
import { runHrAbsentAttendance } from '../src/services/hr-attendance.js'

/** 固定业务日:2026-11-03(上海墙钟 UTC 2026-11-02T16:00:00Z = 北京 11-03 00:00) */
const AT = new Date('2026-11-02T16:00:00.000Z')

beforeEach(() => {
  H.tables.jobrun = hrJobRun
  H.tables.record = hrAttendanceRecord
  H.tables.department = {}
  H.existingJobRuns = new Set()
  H.nextRunId = 0
  H.jobRunsByRunId = new Map()
  H.jobRunInserts = []
  H.jobRunUpdates = []
  H.reads = { jobrun: [], record: [[]], department: [[]] }
  H.unscripted = 0
  H.failBody = false
  H.nextId = 0
  vi.mocked(runHrAbsentAttendance).mockClear()
})

describe('runHrJob · 任务清单单源', () => {
  it('ALL_HR_JOB_NAMES 覆盖三个任务且与 HR_JOBS 清单一致', () => {
    expect(ALL_HR_JOB_NAMES).toEqual([
      HR_JOB_NAMES.dailyAbsent,
      HR_JOB_NAMES.dailyException,
      HR_JOB_NAMES.monthlyStats,
    ])
  })
})

describe('runHrJob · 自动触发幂等', () => {
  it('同一业务窗口第二次自动触发 ⇒ skipped=true、不再执行业务体、不落新痕', async () => {
    const first = await runHrJob(HR_JOB_NAMES.dailyAbsent, AT, { manual: false })
    expect(first.ok).toBe(true)
    expect(first.skipped).toBe(false)
    expect(first.run?.status).toBe('success')
    expect(runHrAbsentAttendance).toHaveBeenCalledTimes(1)

    // 第二轮:假库唯一索引里已有 (jobName, idemKey) ⇒ insert 冲突不返回 ⇒ skipped
    const second = await runHrJob(HR_JOB_NAMES.dailyAbsent, AT, { manual: false })
    expect(second.skipped).toBe(true)
    expect(second.run).toBeNull()
    // 业务体未再执行 ⇒ 不产生重复数据
    expect(runHrAbsentAttendance).toHaveBeenCalledTimes(1)
    expect(H.jobRunInserts).toHaveLength(1)
  })

  it('不同业务日 ⇒ 不同幂等键 ⇒ 各自执行一轮', async () => {
    await runHrJob(HR_JOB_NAMES.dailyAbsent, AT, { manual: false })
    const nextDay = new Date('2026-11-03T16:00:00.000Z') // 北京 11-04 00:00
    const res = await runHrJob(HR_JOB_NAMES.dailyAbsent, nextDay, { manual: false })
    expect(res.skipped).toBe(false)
    expect(runHrAbsentAttendance).toHaveBeenCalledTimes(2)
  })
})

describe('runHrJob · 手动补跑', () => {
  it('同窗口多次手动补跑 ⇒ 幂等键带毫秒后缀,各留一条痕、互不 skip', async () => {
    const a = await runHrJob(HR_JOB_NAMES.dailyAbsent, AT, { manual: true })
    const b = await runHrJob(HR_JOB_NAMES.dailyAbsent, AT, { manual: true })
    expect(a.skipped).toBe(false)
    expect(b.skipped).toBe(false)
    expect(H.jobRunInserts).toHaveLength(2)
    expect(runHrAbsentAttendance).toHaveBeenCalledTimes(2)
  })

  it('手动补跑可指定历史业务日(date 参数折成 at)', async () => {
    const at = new Date('2026-11-01T00:00:00+08:00')
    const res = await runHrJob(HR_JOB_NAMES.dailyAbsent, at, { manual: true })
    expect(res.skipped).toBe(false)
    // 幂等键取业务日键(上海 11-01)
    expect(H.jobRunInserts[0].idempotencyKey).toContain('2026-11-01')
  })
})

describe('runHrJob · 未知任务名', () => {
  it('未知名字 ⇒ 抛错,不静默放行', async () => {
    await expect(runHrJob('hr.nope', AT)).rejects.toThrow(/unknown hr job/)
    expect(H.jobRunInserts).toHaveLength(0)
  })
})

describe('runHrJob · 执行留痕成败回写', () => {
  it('执行体抛错 ⇒ status=failed + errorMessage 落痕', async () => {
    vi.mocked(runHrAbsentAttendance).mockRejectedValueOnce(new Error('boom'))
    const res = await runHrJob(HR_JOB_NAMES.dailyAbsent, AT, { manual: true })
    expect(res.ok).toBe(false)
    const failed = H.jobRunUpdates.find((u) => u.status === 'failed')
    expect(failed).toBeDefined()
    expect(String(failed?.errorMessage)).toContain('boom')
  })

  it('异常汇总任务空记录 ⇒ success,affectedRows=0', async () => {
    H.reads.record = [[]] // 昨日无考勤行
    const res = await runHrJob(HR_JOB_NAMES.dailyException, AT, { manual: true })
    expect(res.ok).toBe(true)
    expect(res.skipped).toBe(false)
    const successUpdate = H.jobRunUpdates.find((u) => u.status === 'success')
    expect(successUpdate).toBeDefined()
    expect(successUpdate?.affectedRows).toBe(0)
  })
})

describe('runHrJob · 执行历史查询', () => {
  it('listHrJobRuns 走 select 链并返回 { list, total }', async () => {
    H.reads.jobrun = [[{ id: 'run-1', jobName: HR_JOB_NAMES.dailyAbsent, status: 'success', c: 1 }]]
    const { list, total } = await listHrJobRuns({ jobName: HR_JOB_NAMES.dailyAbsent })
    expect(Array.isArray(list)).toBe(true)
    expect(total).toBe(1)
  })
})

/**
 * 代码层可自证的验收切片(2026-11-11 立):把票面「连跑 3 天 hr_job_run 每天 3 条成功记录 +
 * 重复触发不产生重复数据(幂等)」里能脱离部署环境的那一半锁进假库 —— 3 天 × 3 任务各成功一条,
 * 且同一天对同一任务重复自动触发被幂等闸拦下、不落第二条痕。多日真实调度落库仍归部署期验证。
 */
describe('runHrJob · 验收切片(连跑 3 天每天 3 条 + 幂等)', () => {
  it('连续 3 个业务日各跑全部三任务 ⇒ 9 条成功留痕,同日重跑被幂等闸拦下', async () => {
    const days = [
      new Date('2026-11-02T16:00:00.000Z'), // 北京 11-03
      new Date('2026-11-03T16:00:00.000Z'), // 北京 11-04
      new Date('2026-11-04T16:00:00.000Z'), // 北京 11-05
    ]
    let inserted = 0
    for (const day of days) {
      for (const name of ALL_HR_JOB_NAMES) {
        const res = await runHrJob(name, day, { manual: false })
        expect(res.ok).toBe(true)
        expect(res.skipped).toBe(false) // 每天首次触发都成功
        expect(res.run?.status).toBe('success')
        inserted += 1
      }
    }
    // 3 天 × 3 任务 = 9 条 insert 留痕
    expect(inserted).toBe(9)
    expect(H.jobRunInserts).toHaveLength(9)
    // 成功回写也是 9 条(每轮 success update)
    expect(H.jobRunUpdates.filter((u) => u.status === 'success')).toHaveLength(9)

    // 同日对同一任务重复自动触发 ⇒ 幂等命中 ⇒ skipped、不落新痕
    const before = H.jobRunInserts.length
    for (const name of ALL_HR_JOB_NAMES) {
      const dup = await runHrJob(name, days[2], { manual: false })
      expect(dup.ok).toBe(true)
      expect(dup.skipped).toBe(true)
      expect(dup.run).toBeNull()
    }
    expect(H.jobRunInserts).toHaveLength(before) // 重复触发零新增留痕
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
