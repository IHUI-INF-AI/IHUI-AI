// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 每日缺勤补录 job 的行为回归(2026-11-01,收尾票)。全程不连库(§5 测试隔离铁律,
// PG 8810 / Redis 8811 一条都不碰):db 层用"脚本化读队列 + 世界状态假库",
// 形状抄同族既有件 tests/edu-attendance-rule-crud-contract.test.ts 与
// tests/edu-attendance-rbac-contract.test.ts 的链式桩基座,不自造第二套夹具。
//
// 判定逻辑零复制(§22c):阈值比较全部走生产实现 —— 要么让 job 内部真调
// `isPastHm`(经 runAbsentAttendance 可观测),要么直接用 `__test__.isPastHm`。
// 本文件里的"假库"只回答"真库在这条 SQL 下会吐出哪些行 / 唯一索引会拦下哪几行",
// 不替生产做"该不该补缺勤"的判断。

import { beforeEach, describe, expect, it, vi } from 'vitest'

import { eduAttendanceRecord, eduAttendanceRule, eduEnrollment } from '@ihui/database'

/**
 * 夹具账本(hoisted:vi.mock 工厂要在模块求值前拿到它)。
 * 每个计数器与世界状态都在 beforeEach 清零 ⇒ "跑两次逐字相同"才是判据而非运气。
 */
const H = vi.hoisted(() => {
  type TableKey = 'rule' | 'record' | 'enrollment'
  type Row = Record<string, unknown>

  /** 假库的 (student_id, class_id, date) 去重指纹 —— 对应 uq_edu_att_student_class_date 的索引列 */
  const uniqKey = (r: Row): string =>
    `${String(r.studentId)}|${String(r.classId)}|${String(r.date)}`

  /**
   * 假库写入层:模拟"部分唯一索引(deleted_at is null)+ onConflictDoNothing"。
   * 冲突 ⇒ 该行不入库也不进 returning 集(与 PG 实际行为同形)。
   */
  const applyInsert = (key: TableKey | undefined, rows: Row[]): Row[] => {
    if (key !== 'record') {
      return rows.map((r) => ({ id: `row-${(H.nextId += 1)}`, ...r }))
    }
    const out: Row[] = []
    for (const r of rows) {
      const clash = H.records.some((e) => e.deletedAt === null && uniqKey(e) === uniqKey(r))
      if (clash) continue
      const stored: Row = {
        id: `rec-${(H.nextId += 1)}`,
        checkInTime: null,
        checkOutTime: null,
        remark: null,
        deletedAt: null,
        ...r,
      }
      H.records.push(stored)
      out.push({ id: stored.id, studentId: stored.studentId })
    }
    return out
  }

  const tables = {} as Record<TableKey, unknown>

  return {
    /** 表身份注册(假库据此判定 select/insert 打在哪张表上) */
    tables,
    keyOf(t: unknown): TableKey | undefined {
      if (t === tables.rule) return 'rule'
      if (t === tables.record) return 'record'
      if (t === tables.enrollment) return 'enrollment'
      return undefined
    },
    uniqKey,
    applyInsert,
    /** 脚本化读队列:每张表按调用顺序吐出预置行集(= "真库会答什么") */
    reads: { rule: [], record: [], enrollment: [] } as Record<TableKey, Row[][]>,
    /** 取不到脚本还硬读 ⇒ 记账(每条用例断言为 0,防"空答复"把断言刷成假绿) */
    unscripted: 0,
    /** 实际发生的读表序(用于证明未到阈值时连在册学生都不查) */
    readOrder: [] as TableKey[],
    /** 假库世界状态:edu_attendance_record 的行 */
    records: [] as Row[],
    /** insert().values() 收到的批次(逐条留档,可直接对"库里没多出谁"断言) */
    insertBatches: [] as Row[][],
    insertCalls: 0,
    onConflictDoNothingCalls: 0,
    nextId: 0,
  }
})

/**
 * 假数据库:select 链按 from(table) 的身份从脚本队列吐行集;
 * insert 链把 values 落进世界状态并按唯一索引去重,returning 只回真插进去的行。
 */
vi.mock('../src/db/index.js', () => {
  type Row = Record<string, unknown>

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
      if (key) {
        H.readOrder.push(key)
        const queue = H.reads[key]
        const next = queue.shift()
        if (next) rows = next
        else {
          H.unscripted += 1
          rows = []
        }
      }
      return step
    })
    for (const m of CHAIN_METHODS) {
      step[m] = vi.fn(() => step)
    }
    step.then = (resolve: (v: unknown) => void, reject?: (e: unknown) => void) =>
      Promise.resolve(rows).then(resolve, reject)
    return step
  }

  const insertChain = (target: unknown) => {
    H.insertCalls += 1
    let values: Row[] = []
    let applied: Row[] | null = null
    const applyOnce = (): Row[] => {
      if (!applied) applied = H.applyInsert(H.keyOf(target), values)
      return applied
    }
    const step: Record<string, unknown> = {}
    step.values = vi.fn((v: Row | Row[]) => {
      values = Array.isArray(v) ? [...v] : [v]
      H.insertBatches.push(values)
      return step
    })
    step.onConflictDoNothing = vi.fn(() => {
      H.onConflictDoNothingCalls += 1
      return step
    })
    step.onConflictDoUpdate = vi.fn(() => step)
    step.returning = vi.fn(() => Promise.resolve(applyOnce()))
    step.then = (resolve: (v: unknown) => void, reject?: (e: unknown) => void) =>
      Promise.resolve(applyOnce()).then(resolve, reject)
    return step
  }

  const dbMock = {
    select: vi.fn(() => selectChain()),
    insert: vi.fn((t: unknown) => insertChain(t)),
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
  __test__ as jobTest,
  runAbsentAttendance,
} from '../src/services/edu-attendance-absent-job.js'

const CLASS_A = 'aaaaaaaa-4111-8111-8111-111111111111'
const CLASS_B = 'bbbbbbbb-4222-8222-8222-222222222222'
const STUDENT_1 = 'cccccccc-4333-8333-8333-333333333333'
const STUDENT_2 = 'dddddddd-4444-8444-8444-444444444444'
const STUDENT_3 = 'eeeeeeee-4555-8555-8555-555555555555'

/** 上海墙钟 10:00(= UTC 02:00):已过 08:30 阈值,业务日键 2026-11-03 */
const AT_10_00 = new Date('2026-11-03T02:00:00.000Z')
/** 上海墙钟 06:30(= 前一日 UTC 22:30):未到 08:30 阈值,业务日键仍是 2026-11-03 */
const AT_06_30 = new Date('2026-11-02T22:30:00.000Z')

/** 规则行(与 eduAttendanceRule 的 select 投影同键)。 */
const ruleRow = (classId: string, absentAfter: string): Record<string, unknown> => ({
  id: `rule-${classId.slice(0, 8)}`,
  classId,
  absentAfter,
})

/** 已存在的考勤行(测试自造,直接落进假库世界状态)。 */
const seedPresent = (studentId: string, classId: string, date: string): void => {
  H.records.push({
    id: `seed-${studentId.slice(0, 8)}`,
    studentId,
    classId,
    date,
    status: 'present',
    checkInMethod: 'self',
    checkOutMethod: null,
    operatedBy: null,
    checkInTime: '2026-11-03T00:20:00.000Z',
    checkOutTime: null,
    remark: null,
    deletedAt: null,
  })
}

type Rows = Record<string, unknown>
type TableKey = 'rule' | 'record' | 'enrollment'

const script = (queues: Partial<Record<TableKey, Rows[][]>>) => {
  for (const key of ['rule', 'enrollment', 'record'] as const) {
    const q = queues[key]
    if (q) H.reads[key].push(...q)
  }
}

beforeEach(() => {
  H.tables.rule = eduAttendanceRule
  H.tables.record = eduAttendanceRecord
  H.tables.enrollment = eduEnrollment
  H.reads = { rule: [], record: [], enrollment: [] }
  H.unscripted = 0
  H.readOrder = []
  H.records = []
  H.insertBatches = []
  H.insertCalls = 0
  H.onConflictDoNothingCalls = 0
  H.nextId = 0
})

describe('runAbsentAttendance ①:未签到 ∧ 已过 absentAfter ⇒ 落 absent 行', () => {
  it('过阈值的班 ⇒ 每名在册无记录学生补一条 status=absent(manual/operatedBy=null),日期键取上海业务日', async () => {
    script({
      rule: [[ruleRow(CLASS_A, '08:30')]],
      enrollment: [[{ studentId: STUDENT_1 }, { studentId: STUDENT_2 }]],
      record: [[]],
    })

    const result = await runAbsentAttendance(AT_10_00)

    expect(result).toEqual({
      rules: 1,
      students: 2,
      created: 2,
      skipped: 0,
      missedIds: [],
    })
    expect(H.records).toHaveLength(2)
    for (const row of H.records) {
      expect(row.status).toBe('absent')
      expect(row.checkInMethod).toBe('manual')
      expect(row.operatedBy).toBeNull()
      expect(row.classId).toBe(CLASS_A)
      // bizDayKey(AT_10_00) 的上海日:UTC 02:00 ⇒ 上海 10:00 同日
      expect(row.date).toBe('2026-11-03')
    }
    expect(H.records.map((r) => r.studentId).sort()).toEqual([STUDENT_1, STUDENT_2].sort())
    expect(H.onConflictDoNothingCalls).toBe(1)
    expect(H.unscripted).toBe(0)
  })

  it('两班两规则各自补录,计数按班去重后求和', async () => {
    script({
      rule: [[ruleRow(CLASS_A, '08:30'), ruleRow(CLASS_B, '09:00')]],
      enrollment: [
        [{ studentId: STUDENT_1 }],
        [{ studentId: STUDENT_2 }, { studentId: STUDENT_3 }],
      ],
      record: [[], []],
    })

    const result = await runAbsentAttendance(AT_10_00)

    expect(result).toMatchObject({ rules: 2, students: 3, created: 3, skipped: 0 })
    expect(H.records).toHaveLength(3)
    expect(H.readOrder).toEqual(['rule', 'enrollment', 'record', 'enrollment', 'record'])
    expect(H.unscripted).toBe(0)
  })
})

describe('runAbsentAttendance ②:已签到者不被补 absent', () => {
  it('当日已有未软删行的学生被剔出候选,既有行一字不改', async () => {
    seedPresent(STUDENT_1, CLASS_A, '2026-11-03')
    const before = H.records.find((r) => r.studentId === STUDENT_1)
    script({
      rule: [[ruleRow(CLASS_A, '08:30')]],
      enrollment: [[{ studentId: STUDENT_1 }, { studentId: STUDENT_2 }, { studentId: STUDENT_3 }]],
      record: [[{ studentId: STUDENT_1 }]],
    })

    const result = await runAbsentAttendance(AT_10_00)

    expect(result).toMatchObject({ rules: 1, students: 3, created: 2, skipped: 0 })
    expect(H.records).toHaveLength(3)
    // 既有 present 行仍在,且没被改写成 absent
    const after = H.records.find((r) => r.studentId === STUDENT_1)
    expect(after?.status).toBe('present')
    expect(after?.checkInTime).toBe(before?.checkInTime)
    expect(after?.id).toBe(before?.id)
    // 写入批次里根本没有该生(不靠"事后覆盖")
    expect(H.insertBatches.flat().map((v) => v.studentId)).toEqual([STUDENT_2, STUDENT_3])
    expect(H.unscripted).toBe(0)
  })
})

describe('runAbsentAttendance ③:同一天重复执行必须幂等', () => {
  it('第二次跑:预筛命中已存行 ⇒ 一次 insert 都不发,库中行数不变', async () => {
    script({
      rule: [[ruleRow(CLASS_A, '08:30')]],
      enrollment: [[{ studentId: STUDENT_1 }, { studentId: STUDENT_2 }]],
      record: [[]],
    })
    const first = await runAbsentAttendance(AT_10_00)
    expect(first.created).toBe(2)
    const snapshot = JSON.stringify(H.records)

    // 第二轮:库里已存在 ⇒ "existing" 查询答出两行(真库同形)
    script({
      rule: [[ruleRow(CLASS_A, '08:30')]],
      enrollment: [[{ studentId: STUDENT_1 }, { studentId: STUDENT_2 }]],
      record: [[{ studentId: STUDENT_1 }, { studentId: STUDENT_2 }]],
    })
    const second = await runAbsentAttendance(AT_10_00)

    expect(second).toEqual({
      rules: 1,
      students: 2,
      created: 0,
      skipped: 2,
      missedIds: [],
    })
    expect(H.insertCalls).toBe(1)
    expect(H.records).toHaveLength(2)
    expect(JSON.stringify(H.records)).toBe(snapshot)
    expect(H.unscripted).toBe(0)
  })

  it('预筛漏网(并发写)时由 uq_edu_att_student_class_date + onConflictDoNothing 兜底:不产生重复行', async () => {
    seedPresent(STUDENT_1, CLASS_A, '2026-11-03')
    script({
      rule: [[ruleRow(CLASS_A, '08:30')]],
      enrollment: [[{ studentId: STUDENT_1 }, { studentId: STUDENT_2 }]],
      record: [[]], // 预筛"看不见"已有行 ⇒ 候选仍是两人
    })

    const result = await runAbsentAttendance(AT_10_00)

    // created 来自 .returning() 回库确认,不是请求侧 length(门 134)
    expect(result).toEqual({
      rules: 1,
      students: 2,
      created: 1,
      skipped: 1,
      missedIds: [STUDENT_1],
    })
    expect(
      H.records.filter(
        (r) =>
          H.uniqKey(r) ===
          H.uniqKey({ studentId: STUDENT_1, classId: CLASS_A, date: '2026-11-03' }),
      ),
    ).toHaveLength(1)
    expect(H.records.find((r) => r.studentId === STUDENT_1)?.status).toBe('present')
    expect(H.records.find((r) => r.studentId === STUDENT_2)?.status).toBe('absent')
    expect(H.onConflictDoNothingCalls).toBe(1)
    expect(H.unscripted).toBe(0)
  })
})

describe('runAbsentAttendance ④:未到阈值时刻 ⇒ 不补', () => {
  it('上海 06:30 < absentAfter 08:30 ⇒ 整轮零动作(连在册学生都不查)', async () => {
    script({ rule: [[ruleRow(CLASS_A, '08:30')]] })

    const result = await runAbsentAttendance(AT_06_30)

    expect(result).toEqual({ rules: 0, students: 0, created: 0, skipped: 0, missedIds: [] })
    expect(H.records).toHaveLength(0)
    expect(H.insertCalls).toBe(0)
    expect(H.readOrder).toEqual(['rule'])
  })

  /**
   * 这一条曾是"把 bug 如实钉成断言"的形态(2026-11-01 收尾票翻正):
   * `edu_attendance_rule.absent_after` 是 PG `time` 列,驱动回读**恒为 `HH:MM:SS`**;
   * 旧 `normalizeHm` 只认 `HH:MM` ⇒ `isPastHm` 恒 false ⇒ 整轮一条 absent 都不写,
   * 生产表现为"任务在跑、日志没错、就是没有缺勤记录"。现按库里真值正常补录。
   */
  it("阈值形态为 PG time 列回读的 '18:30:00' ⇒ 到点照常补录,不再静默零写", async () => {
    // 上海墙钟 19:00:已过 absent_after = 18:30:00
    const AT_19_00 = new Date('2026-11-03T11:00:00.000Z')
    script({
      rule: [[ruleRow(CLASS_A, '18:30:00')]],
      enrollment: [[{ studentId: STUDENT_1 }, { studentId: STUDENT_2 }]],
      record: [[]],
    })

    const result = await runAbsentAttendance(AT_19_00)

    expect(result).toEqual({
      rules: 1,
      students: 2,
      created: 2,
      skipped: 0,
      missedIds: [],
    })
    expect(H.records).toHaveLength(2)
    expect(H.records.every((r) => r.status === 'absent')).toBe(true)

    // 同一判定走生产实现(§22c 零复制)
    expect(jobTest.isPastHm('18:30:00', AT_19_00)).toBe(true)
    // 秒截断到分钟:比较两侧都只到分钟(isPastHm 取 Intl 的 hour+minute),
    // 故 18:30:45 与 18:30 同档 ⇒ 墙钟 18:30:30 即判"已过",最多提前 59s(口径见 normalizeHm 头注)
    expect(jobTest.isPastHm('18:30:45', new Date('2026-11-03T10:30:30.000Z'))).toBe(true)
    expect(jobTest.normalizeHm('18:30:00')).toBe('18:30')
  })

  it("'HH:MM:SS' 形态但当日未到阈值 ⇒ 仍是整轮零动作(放宽解析没把'未到'洗成'已过')", async () => {
    script({ rule: [[ruleRow(CLASS_A, '18:30:00')]] })

    const result = await runAbsentAttendance(AT_10_00)

    expect(result).toEqual({ rules: 0, students: 0, created: 0, skipped: 0, missedIds: [] })
    expect(H.insertCalls).toBe(0)
    expect(H.readOrder).toEqual(['rule'])
  })

  it('跨日界(上海 00:30)仍按当日墙钟判:不到 08:30 ⇒ 不补,也不回溯昨日', async () => {
    script({ rule: [[ruleRow(CLASS_A, '08:30')]] })

    const result = await runAbsentAttendance(new Date('2026-11-03T16:30:00.000Z'))

    expect(result.rules).toBe(0)
    expect(H.records).toHaveLength(0)
    expect(H.insertCalls).toBe(0)
  })
})

describe('runAbsentAttendance ⑤:代码里没有"默认阈值"兜底分支(按代码现实钉)', () => {
  it('该班查不到规则 ⇒ 整轮零补录(默认阈值这一支在源码中不存在,故不编造)', async () => {
    script({ rule: [[]] })

    const result = await runAbsentAttendance(AT_10_00)

    expect(result).toEqual({ rules: 0, students: 0, created: 0, skipped: 0, missedIds: [] })
    expect(H.records).toHaveLength(0)
    expect(H.insertCalls).toBe(0)
    expect(H.readOrder).toEqual(['rule'])
  })

  it('absentAfter 为空串 / 非法 / 越界 ⇒ isPastHm 一律 false(缺失即不判,不回落任何默认时刻)', () => {
    expect(jobTest.isPastHm('', AT_10_00)).toBe(false)
    expect(jobTest.isPastHm('9:5', AT_10_00)).toBe(false)
    expect(jobTest.isPastHm('25:00', AT_10_00)).toBe(false)
    expect(jobTest.isPastHm('上午4点', AT_10_00)).toBe(false)
    expect(jobTest.isPastHm('18:30:0', AT_10_00)).toBe(false)
    expect(jobTest.isPastHm('18:30:60', AT_10_00)).toBe(false)
    // 归一化出口与生产共用同一实现(未补零也算得过)
    expect(jobTest.isPastHm('8:30', AT_10_00)).toBe(true)
    expect(jobTest.normalizeHm('8:30')).toBe('08:30')
  })

  it('absentAfter 为 null / undefined(列默认)⇒ 兜底成空串后 isPastHm 仍 false,函数自己不猜', () => {
    // 生产入口 runAbsentAttendance:`isPastHm(String(r.absentAfter ?? ''), at)`
    const fromDb: string | null = null
    const missing: string | undefined = undefined
    expect(jobTest.isPastHm(String(fromDb ?? ''), AT_10_00)).toBe(false)
    expect(jobTest.isPastHm(String(missing ?? ''), AT_10_00)).toBe(false)
    // 未过 String() 兜底直接送值时,normalizeHm 的 typeof 闸同样判 null
    expect(jobTest.normalizeHm(fromDb)).toBeNull()
    expect(jobTest.normalizeHm(missing)).toBeNull()
  })

  it('全员已有未软删行 ⇒ skipped 走"应写但已存在"口径而非 created', async () => {
    script({
      rule: [[ruleRow(CLASS_A, '08:30')]],
      enrollment: [[{ studentId: STUDENT_1 }, { studentId: STUDENT_2 }]],
      record: [[{ studentId: STUDENT_1 }, { studentId: STUDENT_2 }]],
    })

    const result = await runAbsentAttendance(AT_10_00)

    expect(result).toEqual({
      rules: 1,
      students: 2,
      created: 0,
      skipped: 2,
      missedIds: [],
    })
    expect(H.insertCalls).toBe(0)
  })
})

describe('阈值解析边界(判据零复制:直接调生产 normalizeHm/isPastHm,§22c)', () => {
  it('合法四形:H:MM / HH:MM / HH:MM:SS(秒为 0)/ HH:MM:SS(秒非 0)⇒ 全部归一到补零 HH:MM', () => {
    expect(jobTest.normalizeHm('08:30')).toBe('08:30')
    expect(jobTest.normalizeHm('8:30')).toBe('08:30')
    expect(jobTest.normalizeHm('18:30:00')).toBe('18:30')
    expect(jobTest.normalizeHm('18:30:45')).toBe('18:30')
  })

  it('非法形:缺分钟 / 时越界 / 非数字 / 空串 / null / undefined ⇒ 一律 null,不猜', () => {
    expect(jobTest.normalizeHm('9:5')).toBeNull()
    expect(jobTest.normalizeHm('25:00')).toBeNull()
    expect(jobTest.normalizeHm('上午4点')).toBeNull()
    expect(jobTest.normalizeHm('')).toBeNull()
    expect(jobTest.normalizeHm(null)).toBeNull()
    expect(jobTest.normalizeHm(undefined)).toBeNull()
    // 秒段同样要合规:一位数秒、秒越界、24 点都不收
    expect(jobTest.normalizeHm('18:30:5')).toBeNull()
    expect(jobTest.normalizeHm('18:30:60')).toBeNull()
    expect(jobTest.normalizeHm('24:00:00')).toBeNull()
    expect(jobTest.normalizeHm('09:60:00')).toBeNull()
  })

  it('放宽只放宽"秒",没有把"当日分钟数"的比较语义改掉', () => {
    // AT_10_00 = 上海墙钟 10:00
    expect(jobTest.isPastHm('09:59:59', AT_10_00)).toBe(true)
    expect(jobTest.isPastHm('10:00:00', AT_10_00)).toBe(true) // 同分钟 ⇒ 已过(与原 HH:MM 口径一致)
    expect(jobTest.isPastHm('10:00:01', AT_10_00)).toBe(true) // 截断到分钟 ⇒ 同档
    expect(jobTest.isPastHm('10:01:00', AT_10_00)).toBe(false)
    expect(jobTest.isPastHm('10:01:45', AT_10_00)).toBe(false)
  })
})

describe('runAbsentAttendance 计数诚实性(门 134 同型)', () => {
  it('重复报名行去重后才计入 students;students 不等于请求侧长度', async () => {
    script({
      rule: [[ruleRow(CLASS_A, '08:30')]],
      enrollment: [[{ studentId: STUDENT_1 }, { studentId: STUDENT_1 }, { studentId: STUDENT_2 }]],
      record: [[]],
    })

    const result = await runAbsentAttendance(AT_10_00)

    expect(result.students).toBe(2)
    expect(result.created).toBe(2)
    expect(H.records).toHaveLength(2)
  })

  it('连跑两轮不重复 ⇒ 每轮读队列都被消费干净(unscripted 恒 0)', async () => {
    script({
      rule: [[ruleRow(CLASS_A, '08:30')]],
      enrollment: [[{ studentId: STUDENT_1 }]],
      record: [[]],
    })
    await runAbsentAttendance(AT_10_00)
    expect(H.unscripted).toBe(0)
    expect(H.records).toHaveLength(1)

    H.reads.rule.push([ruleRow(CLASS_A, '08:30')])
    H.reads.enrollment.push([{ studentId: STUDENT_1 }])
    H.reads.record.push([{ studentId: STUDENT_1 }])
    const second = await runAbsentAttendance(AT_10_00)

    expect(second.created).toBe(0)
    expect(H.unscripted).toBe(0)
    expect(H.records).toHaveLength(1)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
