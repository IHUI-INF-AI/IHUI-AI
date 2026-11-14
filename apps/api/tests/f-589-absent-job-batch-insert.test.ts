// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * F-589 回归锁(2026-11-13)。
 *
 * 病灶:缺勤补录对每条规则只发**一条** `insert().values(candidates)`,而
 * candidates 行数 = 学生数 × 待补日期数、每行 6 个绑定参数 ⇒ 超大班/长回溯越过
 * PG 的 65,535 参数上限就抛错;且该异常发生在 for 循环体内、无 try/catch,
 * 一条规则失败 ⇒ 整轮后续班级全部漏判。
 *
 * 本文件锁:
 *   ① 1201 个候选 ⇒ 分 3 次 insert(500/500/201),每批不超过 ABSENT_INSERT_CHUNK_SIZE;
 *   ② 某批写失败 ⇒ 该规则计入 failed 并 logger.error,后续规则照常判定落库;
 *   ③ 成功路径:多规则分片写,created 总数如实入账。
 *
 * 只 mock db 与 logger,不连 PG / Redis。
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  eduAttendanceRecord,
  eduAttendanceRule,
  eduCourseSchedule,
  eduEnrollment,
} from '@ihui/database'

type Row = Record<string, unknown>
type TableKey = 'rule' | 'record' | 'enrollment' | 'schedule'

/**
 * 夹具账本(hoisted:vi.mock 工厂要在模块求值前拿到它)。
 * `reads` 是脚本化读队列:每张表按调用顺序吐出预置行集;`insertBatches` 逐批留档。
 */
const H = vi.hoisted(() => {
  const tables = {} as Record<TableKey, unknown>
  return {
    tables,
    reads: { rule: [], record: [], enrollment: [], schedule: [] } as Record<TableKey, Row[][]>,
    insertBatches: [] as Row[][],
    insertCalls: 0,
    /** 第 N 次 insert(1 起)让 returning 抛错 ⇒ 模拟该批写失败;0 = 不注入 */
    failInsertCall: 0,
    keyOf(t: unknown): TableKey | undefined {
      if (t === tables.rule) return 'rule'
      if (t === tables.record) return 'record'
      if (t === tables.enrollment) return 'enrollment'
      if (t === tables.schedule) return 'schedule'
      return undefined
    },
  }
})

vi.mock('../src/db/index.js', () => {
  const CHAIN_METHODS = [
    'where',
    'orderBy',
    'limit',
    'offset',
    'innerJoin',
    'leftJoin',
    'groupBy',
    'having',
  ] as const

  const selectChain = () => {
    let rows: Row[] = []
    const step: Record<string, unknown> = {}
    step.from = vi.fn((t: unknown) => {
      const key = H.keyOf(t)
      rows = key ? (H.reads[key].shift() ?? []) : []
      return step
    })
    for (const m of CHAIN_METHODS) step[m] = vi.fn(() => step)
    step.then = (resolve: (v: unknown) => void, reject?: (e: unknown) => void) =>
      Promise.resolve(rows).then(resolve, reject)
    return step
  }

  const insertChain = () => {
    H.insertCalls += 1
    const callNo = H.insertCalls
    let values: Row[] = []
    const step: Record<string, unknown> = {}
    const landed = () =>
      values.map((r, i) => ({
        id: `row-${callNo}-${i}`,
        studentId: r.studentId,
        date: r.date,
      }))
    step.values = vi.fn((v: Row | Row[]) => {
      values = Array.isArray(v) ? [...v] : [v]
      H.insertBatches.push(values)
      return step
    })
    step.onConflictDoNothing = vi.fn(() => step)
    step.onConflictDoUpdate = vi.fn(() => step)
    step.returning = vi.fn(() =>
      callNo === H.failInsertCall
        ? Promise.reject(new Error(`insert batch #${callNo} failed`))
        : Promise.resolve(landed()),
    )
    step.then = (resolve: (v: unknown) => void, reject?: (e: unknown) => void) =>
      Promise.resolve(landed()).then(resolve, reject)
    return step
  }

  const dbMock = {
    select: vi.fn(() => selectChain()),
    insert: vi.fn(() => insertChain()),
    update: vi.fn(() => selectChain()),
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

import {
  ABSENT_INSERT_CHUNK_SIZE,
  runAbsentAttendance,
} from '../src/services/edu-attendance-absent-job.js'
import { logger } from '../src/utils/logger.js'

const CLASS_A = 'aaaaaaaa-4111-8111-8111-111111111111'
const CLASS_B = 'bbbbbbbb-4222-8222-8222-222222222222'

/** 上海墙钟 10:00:已过 08:30 阈值,业务日键 2026-11-03 */
const AT_10_00 = new Date('2026-11-03T02:00:00.000Z')
/** 关掉回溯窗:单条规则的候选数 = 在册学生数 × 1 */
const SAME_DAY_ONLY = { backfillDays: 0 }

const ruleRow = (classId: string): Row => ({
  id: `rule-${classId.slice(0, 8)}`,
  classId,
  absentAfter: '08:30',
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
})

/** 造 n 个唯一学生 id(与班级无关,本文件每班独立读报名表) */
const makeStudents = (n: number, prefix: string): Row[] =>
  Array.from({ length: n }, (_, i) => ({
    studentId: `${prefix}-${String(i + 1).padStart(4, '0')}`,
  }))

const script = (queues: Partial<Record<TableKey, Row[][]>>) => {
  for (const key of ['rule', 'enrollment', 'record', 'schedule'] as const) {
    const q = queues[key]
    if (q) H.reads[key].push(...q)
  }
}

beforeEach(() => {
  H.tables.rule = eduAttendanceRule
  H.tables.record = eduAttendanceRecord
  H.tables.enrollment = eduEnrollment
  H.tables.schedule = eduCourseSchedule
  H.reads = { rule: [], record: [], enrollment: [], schedule: [] }
  H.insertBatches = []
  H.insertCalls = 0
  H.failInsertCall = 0
  vi.mocked(logger.error).mockClear()
})

describe('F-589 ①:超大班候选取 1201 行 ⇒ 分片 insert', () => {
  it('产生 3 次 insert(500/500/201),每批不超过 500 行,created 总数 1201', async () => {
    script({
      rule: [[ruleRow(CLASS_A)]],
      schedule: [[]],
      enrollment: [makeStudents(1201, 'stu-a')],
      record: [[]],
    })

    const result = await runAbsentAttendance(AT_10_00, SAME_DAY_ONLY)

    expect(H.insertCalls).toBe(3)
    expect(H.insertBatches.map((b) => b.length)).toEqual([500, 500, 201])
    for (const batch of H.insertBatches) {
      expect(batch.length).toBeLessThanOrEqual(ABSENT_INSERT_CHUNK_SIZE)
    }
    expect(ABSENT_INSERT_CHUNK_SIZE).toBe(500)
    expect(result.created).toBe(1201)
    expect(result.failed).toBe(0)
  })
})

describe('F-589 ②:某批写失败被计数,后续规则继续', () => {
  it('第 2 批 insert 抛错 ⇒ failed=1、首批已落库计入 created,下一班照常写', async () => {
    // 第 1 次 = A 班首批(500),第 2 次 = A 班次批(100,注入失败),第 3 次 = B 班
    H.failInsertCall = 2
    script({
      rule: [[ruleRow(CLASS_A), ruleRow(CLASS_B)]],
      schedule: [[]],
      enrollment: [makeStudents(600, 'stu-big'), makeStudents(2, 'stu-small')],
      record: [[], []],
    })

    const result = await runAbsentAttendance(AT_10_00, SAME_DAY_ONLY)

    expect(H.insertCalls).toBe(3)
    expect(H.insertBatches.map((b) => b.length)).toEqual([500, 100, 2])
    // A 班首批 500 已真落库 + B 班 2 条;失败批不计入 created
    expect(result.created).toBe(502)
    expect(result.failed).toBe(1)
    expect(result.rules).toBe(2)
    // 失败规则被点名,不是静默少判
    expect(vi.mocked(logger.error)).toHaveBeenCalledWith(
      expect.stringContaining('隔离跳过'),
      expect.objectContaining({ classId: CLASS_A }),
    )
    // 后续规则确实继续写了(批次落在 B 班)
    expect(H.insertBatches[2].every((r) => r.classId === CLASS_B)).toBe(true)
  })
})

describe('F-589 ③:成功路径计数如实', () => {
  it('两条规则分别写 3 行/2 行 ⇒ created=5、failed=0、每次规则一次 insert', async () => {
    script({
      rule: [[ruleRow(CLASS_A), ruleRow(CLASS_B)]],
      schedule: [[]],
      enrollment: [makeStudents(3, 'stu-a'), makeStudents(2, 'stu-b')],
      record: [[], []],
    })

    const result = await runAbsentAttendance(AT_10_00, SAME_DAY_ONLY)

    expect(H.insertBatches.map((b) => b.length)).toEqual([3, 2])
    expect(result.created).toBe(5)
    expect(result.students).toBe(5)
    expect(result.failed).toBe(0)
    expect(vi.mocked(logger.error)).not.toHaveBeenCalled()
  })
})
