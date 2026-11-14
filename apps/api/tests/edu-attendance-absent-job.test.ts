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
//
// 回溯窗(2026-11-05,ATT-BACKFILL 票)后的分组口径:①~⑤ 组用
// `SAME_DAY_ONLY = { backfillDays: 0 }` 把窗口关掉,逐字保住"只判当日"的旧断言与
// 判据基准(上海墙钟 + isPastHm);⑥~⑧ 组跑**默认窗口**,钉的是"absent_after 晚于
// 跑批时刻的那一日不再永远漏判"这一新格(正反成对:次日补得出 / 同轮再跑不重复 /
// leave 不被改写 / 规则与报名日之前的历史不造)。
//
// 排课门控(2026-11-07,ATT-SCHEDGATE 票)加的两组:⑨ 钉三态行为(有课日照判 /
// 无课日零写 / 判不出 ⇒ 照旧判),⑩ 钉星期几与档位折法由生产实现单源定义。
// **①~⑧ 组全部落 `schedule: NO_SCHEDULE_ROWS`(该班从没排过课)= no-schedule 档 ⇒
// 照旧判 ⇒ 旧断言逐字不动**;只有 readOrder 两处按新增的一次排课查询如实插了
// 'schedule'(那条 SQL 整轮只发一次,不按班轮询)。假库另加两条防线:未注册身份的表
// 被读也计 unscripted(防"生产新读一张假库不认识的表"静默答空刷成假绿),
// 以及 `H.failReads` 让指定表抛错(钉"表不可读 ⇒ 照旧判")。

import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  eduAttendanceRecord,
  eduAttendanceRule,
  eduCourseSchedule,
  eduEnrollment,
} from '@ihui/database'

/**
 * 夹具账本(hoisted:vi.mock 工厂要在模块求值前拿到它)。
 * 每个计数器与世界状态都在 beforeEach 清零 ⇒ "跑两次逐字相同"才是判据而非运气。
 */
const H = vi.hoisted(() => {
  type TableKey = 'rule' | 'record' | 'enrollment' | 'schedule'
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
      out.push({ id: stored.id, studentId: stored.studentId, date: stored.date })
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
      if (t === tables.schedule) return 'schedule'
      return undefined
    },
    uniqKey,
    applyInsert,
    /** 脚本化读队列:每张表按调用顺序吐出预置行集(= "真库会答什么") */
    reads: { rule: [], record: [], enrollment: [], schedule: [] } as Record<TableKey, Row[][]>,
    /** 取不到脚本还硬读 ⇒ 记账(每条用例断言为 0,防"空答复"把断言刷成假绿) */
    unscripted: 0,
    /** 点名"这张表读不动"(模拟 relation 不存在 / 连接异常):生产侧必须落"照旧判" */
    failReads: [] as TableKey[],
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
      if (!key) {
        // 未注册身份的表也被读了 ⇒ 同样记账(否则"生产新读了一张假库不认识的表"
        // 会静默答空,把断言刷成假绿 —— 本票的排课表正是这条防线的来处)
        H.unscripted += 1
        rows = []
        return step
      }
      H.readOrder.push(key)
      if (H.failReads.includes(key)) {
        throw new Error(`relation "${key}" does not exist`)
      }
      const queue = H.reads[key]
      const next = queue.shift()
      if (next) rows = next
      else {
        H.unscripted += 1
        rows = []
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
  DEFAULT_BACKFILL_DAYS,
  MAX_BACKFILL_DAYS,
  runAbsentAttendance,
} from '../src/services/edu-attendance-absent-job.js'
import { logger } from '../src/utils/logger.js'

const CLASS_A = 'aaaaaaaa-4111-8111-8111-111111111111'
const CLASS_B = 'bbbbbbbb-4222-8222-8222-222222222222'
const STUDENT_1 = 'cccccccc-4333-8333-8333-333333333333'
const STUDENT_2 = 'dddddddd-4444-8444-8444-444444444444'
const STUDENT_3 = 'eeeeeeee-4555-8555-8555-555555555555'

/** 上海墙钟 10:00(= UTC 02:00):已过 08:30 阈值,业务日键 2026-11-03 */
const AT_10_00 = new Date('2026-11-03T02:00:00.000Z')
/** 上海墙钟 06:30(= 前一日 UTC 22:30):未到 08:30 阈值,业务日键仍是 2026-11-03 */
const AT_06_30 = new Date('2026-11-02T22:30:00.000Z')
/** 真跑批时刻:cron `30 10 * * *`(UTC 10:30 = 北京 18:30),业务日键 2026-11-04 */
const AT_CRON_04 = new Date('2026-11-04T10:30:00.000Z')
/** 同一 cron 时刻但落在周一:北京 2026-11-09 18:30,窗口要吃掉周六/周日 */
const AT_CRON_MON = new Date('2026-11-09T10:30:00.000Z')
/** **周六**那轮的 cron 时刻:北京 2026-11-07 18:30(2026-11-07 = weekday 6),排课门控的主案 */
const AT_SAT = new Date('2026-11-07T10:30:00.000Z')
/** 周一~周五的星期几档(1..7 = 周一..周日,与 edu_course_schedule.weekday 同键;夹具数据,非判据) */
const WEEKDAYS = { mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6, sun: 7 } as const
/** 规则/报名的下界列默认给一个远早于窗口的时刻 ⇒ 不构成回溯阻力(真实库里就是历史行) */
const EARLY = new Date('2026-01-01T00:00:00.000Z')

/** 关掉回溯窗的一档:既有用例逐字保持"只判当日"的旧断言;窗口本体在 ⑥~⑧ 组里验。 */
const SAME_DAY_ONLY = { backfillDays: 0 }

/** 规则行(与 eduAttendanceRule 的 select 投影同键;createdAt 是回溯下界的一侧)。 */
const ruleRow = (
  classId: string,
  absentAfter: string,
  createdAt: Date | null = EARLY,
): Record<string, unknown> => ({
  id: `rule-${classId.slice(0, 8)}`,
  classId,
  absentAfter,
  createdAt,
})

/** 已存在的考勤行(测试自造,直接落进假库世界状态)。 */
const seedRow = (
  studentId: string,
  classId: string,
  date: string,
  status: string,
  checkInTime: string | null = null,
): void => {
  H.records.push({
    id: `seed-${studentId.slice(0, 8)}-${date}`,
    studentId,
    classId,
    date,
    status,
    checkInMethod: 'self',
    checkOutMethod: null,
    operatedBy: null,
    checkInTime,
    checkOutTime: null,
    remark: null,
    deletedAt: null,
  })
}

const seedPresent = (studentId: string, classId: string, date: string): void =>
  seedRow(studentId, classId, date, 'present', '2026-11-03T00:20:00.000Z')

/**
 * 假库对"窗口内已有未软删记录"这条 SQL 的答复。
 * 生产的幂等预筛按 (学生, 日期) **对**匹配 ⇒ 这里必须带 date(真库 date 列 notNull)。
 */
const existingRow = (studentId: string, date: string): Rows => ({ studentId, date })

/** 按学生×日期展开的"全窗已有"答复(幂等第二轮用的就是这个形状)。 */
const existingRowsFor = (studentIds: string[], dates: string[]): Rows[] =>
  studentIds.flatMap((studentId) => dates.map((date) => existingRow(studentId, date)))

/** 报名行:enrollDate 是回溯下界的另一侧;不给 = 量不到 ⇒ 不设界。 */
const enrollRow = (studentId: string, enrollDate?: string): Rows =>
  enrollDate ? { studentId, enrollDate } : { studentId }

/**
 * 排课表答复里的"有效排课"行(投影与生产的 select 同键:`classId` + `weekday`)。
 * weekday 档 = **1=周一…7=周日**,与 `edu_course_schedule.weekday` 列注释同键。
 * 给空数组 `[]` = 该班在排课表里**一条有效记录都没有** ⇒ 门控判不出"无课" ⇒ 照旧判缺勤。
 * (假库的 where 是 no-op,所以"软删行不出现在答复里"这一条由本夹具直接表达,
 *  与真库 `isNull(eduCourseSchedule.deletedAt)` 的答形同构。)
 */
const schedRow = (classId: string, weekday: number): Rows => ({ classId, weekday })

/** 该班"从没排过课"的答复(既有用例全部走这一档 ⇒ 门控落 no-schedule、照旧判,旧断言逐字不变)。 */
const NO_SCHEDULE_ROWS: Rows[][] = [[]]

/** 断言用:库里 absent 行的日期集合(升序)。 */
const absentDates = (studentId?: string): string[] =>
  H.records
    .filter((r) => r.status === 'absent' && (studentId === undefined || r.studentId === studentId))
    .map((r) => String(r.date))
    .sort()

type Rows = Record<string, unknown>
type TableKey = 'rule' | 'record' | 'enrollment' | 'schedule'

const script = (queues: Partial<Record<TableKey, Rows[][]>>) => {
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
  H.unscripted = 0
  H.failReads = []
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
      schedule: NO_SCHEDULE_ROWS,
    })

    const result = await runAbsentAttendance(AT_10_00, SAME_DAY_ONLY)

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
      schedule: NO_SCHEDULE_ROWS,
    })

    const result = await runAbsentAttendance(AT_10_00, SAME_DAY_ONLY)

    expect(result).toMatchObject({ rules: 2, students: 3, created: 3, skipped: 0 })
    expect(H.records).toHaveLength(3)
    expect(H.readOrder).toEqual([
      'rule',
      'schedule',
      'enrollment',
      'record',
      'enrollment',
      'record',
    ])
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
      record: [[existingRow(STUDENT_1, '2026-11-03')]],
      schedule: NO_SCHEDULE_ROWS,
    })

    const result = await runAbsentAttendance(AT_10_00, SAME_DAY_ONLY)

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
      schedule: NO_SCHEDULE_ROWS,
    })
    const first = await runAbsentAttendance(AT_10_00, SAME_DAY_ONLY)
    expect(first.created).toBe(2)
    const snapshot = JSON.stringify(H.records)

    // 第二轮:库里已存在 ⇒ "existing" 查询答出两行(真库同形)
    script({
      rule: [[ruleRow(CLASS_A, '08:30')]],
      enrollment: [[{ studentId: STUDENT_1 }, { studentId: STUDENT_2 }]],
      record: [[existingRow(STUDENT_1, '2026-11-03'), existingRow(STUDENT_2, '2026-11-03')]],
      schedule: NO_SCHEDULE_ROWS,
    })
    const second = await runAbsentAttendance(AT_10_00, SAME_DAY_ONLY)

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
      schedule: NO_SCHEDULE_ROWS,
    })

    const result = await runAbsentAttendance(AT_10_00, SAME_DAY_ONLY)

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
  it('上海 06:30 < absentAfter 08:30 ⇒ 当日整轮零动作(连在册学生都不查)', async () => {
    script({ rule: [[ruleRow(CLASS_A, '08:30')]] })

    const result = await runAbsentAttendance(AT_06_30, SAME_DAY_ONLY)

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
      schedule: NO_SCHEDULE_ROWS,
    })

    const result = await runAbsentAttendance(AT_19_00, SAME_DAY_ONLY)

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

  it("'HH:MM:SS' 形态但当日未到阈值 ⇒ 当日整轮零动作(放宽解析没把'未到'洗成'已过')", async () => {
    script({ rule: [[ruleRow(CLASS_A, '18:30:00')]] })

    const result = await runAbsentAttendance(AT_10_00, SAME_DAY_ONLY)

    expect(result).toEqual({ rules: 0, students: 0, created: 0, skipped: 0, missedIds: [] })
    expect(H.insertCalls).toBe(0)
    expect(H.readOrder).toEqual(['rule'])
  })

  it('跨日界(上海 00:30)仍按当日墙钟判:不到 08:30 ⇒ 当日不补(窗口关掉时也不回溯昨日)', async () => {
    // 这一条钉的是**判据基准**(上海日 + 当日墙钟),不是窗口;窗口那一维在 ⑦ 组里验。
    script({ rule: [[ruleRow(CLASS_A, '08:30')]] })

    const result = await runAbsentAttendance(new Date('2026-11-03T16:30:00.000Z'), SAME_DAY_ONLY)

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
      record: [[existingRow(STUDENT_1, '2026-11-03'), existingRow(STUDENT_2, '2026-11-03')]],
      schedule: NO_SCHEDULE_ROWS,
    })

    const result = await runAbsentAttendance(AT_10_00, SAME_DAY_ONLY)

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

describe('回溯窗 ⑥:窗口口径由生产实现单源定义(§22c 判据零复制)', () => {
  it('默认回溯 3 天 ⇒ 一轮判定含当日在内 4 个上海业务日,由旧到新', () => {
    expect(DEFAULT_BACKFILL_DAYS).toBe(3)
    expect(jobTest.buildBizDayWindow('2026-11-03', DEFAULT_BACKFILL_DAYS)).toEqual([
      '2026-10-31',
      '2026-11-01',
      '2026-11-02',
      '2026-11-03',
    ])
  })

  it('跨月/跨年边界一律走 utils/biz-day 唯一出口;backfillDays=0 退化为"只判当日"', () => {
    expect(jobTest.buildBizDayWindow('2026-01-01', 3)).toEqual([
      '2025-12-29',
      '2025-12-30',
      '2025-12-31',
      '2026-01-01',
    ])
    expect(jobTest.buildBizDayWindow('2026-11-03', 0)).toEqual(['2026-11-03'])
  })

  it('backfillDays 取值:未给=默认 / 0 合法 / 非法回落默认 / 越界封顶,且回落必须留日志(不静默)', () => {
    const warn = vi.mocked(logger.warn)
    warn.mockClear()
    expect(jobTest.resolveBackfillDays(undefined)).toBe(DEFAULT_BACKFILL_DAYS)
    expect(jobTest.resolveBackfillDays(0)).toBe(0)
    expect(jobTest.resolveBackfillDays(2)).toBe(2)
    expect(jobTest.resolveBackfillDays(-1)).toBe(DEFAULT_BACKFILL_DAYS)
    expect(jobTest.resolveBackfillDays(1.5)).toBe(DEFAULT_BACKFILL_DAYS)
    expect(jobTest.resolveBackfillDays('abc')).toBe(DEFAULT_BACKFILL_DAYS)
    expect(jobTest.resolveBackfillDays(9999)).toBe(MAX_BACKFILL_DAYS)
    // 4 次非法/越界 ⇒ 4 条 warn:回落与封顶都不是"没人知道的降级"
    expect(warn).toHaveBeenCalledTimes(4)
  })

  it('dayFloorOf:Date / YYYY-MM-DD / 带时刻的串都吃;量不到 ⇒ null(不猜下界)', () => {
    expect(jobTest.dayFloorOf(new Date('2026-11-02T20:00:00.000Z'))).toBe('2026-11-03') // 上海 04:00
    expect(jobTest.dayFloorOf('2026-11-02')).toBe('2026-11-02')
    expect(jobTest.dayFloorOf('2026-11-02T00:00:00Z')).toBe('2026-11-02')
    expect(jobTest.dayFloorOf('昨天')).toBeNull()
    expect(jobTest.dayFloorOf(null)).toBeNull()
    expect(jobTest.dayFloorOf(undefined)).toBeNull()
    expect(jobTest.dayFloorOf(new Date('not-a-date'))).toBeNull()
  })

  it('候选对:同 (学生,日期) 已有行 ⇒ 不进候选;换一天的对照样补;量不到日期的已有行不据此排除', () => {
    const hit = jobTest.absentCandidatePairsForRule({
      classId: CLASS_A,
      dueDates: ['2026-11-02', '2026-11-03'],
      students: [
        { studentId: STUDENT_1, floor: null },
        { studentId: STUDENT_2, floor: null },
      ],
      ruleFloor: null,
      existing: [{ studentId: STUDENT_1, date: '2026-11-03' }],
    })
    expect(hit.existingHits).toBe(1)
    expect(hit.unplacedExisting).toBe(0)
    expect(hit.candidates.map((c) => `${c.studentId}@${c.date}`)).toEqual([
      `${STUDENT_1}@2026-11-02`,
      `${STUDENT_2}@2026-11-02`,
      `${STUDENT_2}@2026-11-03`,
    ])

    // 已有行 date 量不到 ⇒ 不能当成"这天已记过"(§0.3:取不到不猜),但要留数进日志
    const unreadable = jobTest.absentCandidatePairsForRule({
      classId: CLASS_A,
      dueDates: ['2026-11-03'],
      students: [{ studentId: STUDENT_1, floor: null }],
      ruleFloor: null,
      existing: [{ studentId: STUDENT_1, date: null }],
    })
    expect(unreadable.unplacedExisting).toBe(1)
    expect(unreadable.candidates).toEqual([
      { studentId: STUDENT_1, classId: CLASS_A, date: '2026-11-03' },
    ])
  })
})

describe('runAbsentAttendance ⑦:本票主案 —— absent_after 晚于跑批时刻的班级不再永远漏判', () => {
  it('正向:北京 18:30 跑批 + absent_after 19:00 ⇒ 昨日及更早的缺勤照样补出来', async () => {
    script({
      rule: [[ruleRow(CLASS_A, '19:00')]],
      enrollment: [[enrollRow(STUDENT_1), enrollRow(STUDENT_2)]],
      record: [[]],
      schedule: NO_SCHEDULE_ROWS,
    })

    const result = await runAbsentAttendance(AT_CRON_04)

    // 当日(11-04)墙钟 18:30 < 19:00 ⇒ 当日仍不判;窗口里已过完的 3 天照补
    expect(absentDates(STUDENT_1)).toEqual(['2026-11-01', '2026-11-02', '2026-11-03'])
    expect(absentDates(STUDENT_2)).toEqual(['2026-11-01', '2026-11-02', '2026-11-03'])
    expect(H.records.some((r) => r.date === '2026-11-04')).toBe(false)
    expect(result).toEqual({
      rules: 1,
      students: 2,
      created: 6,
      skipped: 0,
      missedIds: [],
    })
    // 读放大不随窗口/班级涨:排课表**整轮一条 SQL**(不按班轮询)+ 一班一条 enroll +
    //   一条"整窗已有记录"查询(不按日轮询)
    expect(H.readOrder).toEqual(['rule', 'schedule', 'enrollment', 'record'])
    expect(H.insertCalls).toBe(1)
    expect(H.unscripted).toBe(0)
    for (const row of H.records) {
      expect(row.status).toBe('absent')
      expect(row.checkInMethod).toBe('manual')
      expect(row.operatedBy).toBeNull()
    }
  })

  it('反向(成对):同一轮之后立刻再跑 ⇒ 一条 insert 都不发,库中行数与内容逐字不变', async () => {
    const window = jobTest.buildBizDayWindow('2026-11-04', DEFAULT_BACKFILL_DAYS)
    script({
      rule: [[ruleRow(CLASS_A, '19:00')]],
      enrollment: [[enrollRow(STUDENT_1)]],
      record: [[]],
      schedule: NO_SCHEDULE_ROWS,
    })
    const first = await runAbsentAttendance(AT_CRON_04)
    expect(first.created).toBe(window.length - 1) // 当日未到阈值 ⇒ 只有前 3 天
    const snapshot = JSON.stringify(H.records)

    // 第二轮:真库把整窗(含刚写进去的 3 条)答出来 ⇒ 幂等预筛按 (学生,日期) 对逐个命中
    script({
      rule: [[ruleRow(CLASS_A, '19:00')]],
      enrollment: [[enrollRow(STUDENT_1)]],
      record: [existingRowsFor([STUDENT_1], window)],
      schedule: NO_SCHEDULE_ROWS,
    })
    const second = await runAbsentAttendance(AT_CRON_04)

    expect(second).toEqual({
      rules: 1,
      students: 1,
      created: 0,
      skipped: 1,
      missedIds: [],
    })
    expect(H.insertCalls).toBe(1) // 仍是第一轮那一次,第二轮连 insert 都没发
    expect(H.records).toHaveLength(window.length - 1)
    expect(JSON.stringify(H.records)).toBe(snapshot)
    expect(H.unscripted).toBe(0)
  })

  it('反向(成对):已请假(leave)的日子不被写成 absent,既有行一字不改', async () => {
    const leaveDate = '2026-11-02'
    seedRow(STUDENT_1, CLASS_A, leaveDate, 'leave')
    const before = H.records.find((r) => r.date === leaveDate)
    script({
      rule: [[ruleRow(CLASS_A, '19:00')]],
      enrollment: [[enrollRow(STUDENT_1)]],
      record: [[existingRow(STUDENT_1, leaveDate)]],
      schedule: NO_SCHEDULE_ROWS,
    })

    const result = await runAbsentAttendance(AT_CRON_04)

    expect(absentDates(STUDENT_1)).toEqual(['2026-11-01', '2026-11-03'])
    expect(result.created).toBe(2)
    const after = H.records.find((r) => r.date === leaveDate)
    expect(after?.status).toBe('leave')
    expect(after?.id).toBe(before?.id)
    // 写入批次里根本没有 (S1, 11-02) 这一对 —— 不靠"事后覆盖"
    expect(H.insertBatches.flat().map((v) => `${v.studentId}@${v.date}`)).not.toContain(
      `${STUDENT_1}@${leaveDate}`,
    )
    expect(H.records).toHaveLength(3)
  })

  it('窗口吃掉周末:周一 18:30 那轮把周五~周日都判掉(cron 停跑两天也接得上)', async () => {
    script({
      rule: [[ruleRow(CLASS_A, '19:00')]],
      enrollment: [[enrollRow(STUDENT_1)]],
      record: [[]],
      schedule: NO_SCHEDULE_ROWS,
    })

    await runAbsentAttendance(AT_CRON_MON)

    // 2026-11-07=周六、11-08=周日:旧实现"只判当日"时这两天结构上补不到
    expect(absentDates(STUDENT_1)).toEqual(['2026-11-06', '2026-11-07', '2026-11-08'])
  })

  it('上海 00:30 那轮(当日未到 08:30)按默认窗仍补到新一日之前 ⇒ 判据基准仍是上海日', async () => {
    script({
      rule: [[ruleRow(CLASS_A, '08:30')]],
      enrollment: [[enrollRow(STUDENT_1)]],
      record: [[]],
      schedule: NO_SCHEDULE_ROWS,
    })

    const result = await runAbsentAttendance(new Date('2026-11-03T16:30:00.000Z'))

    // 该时刻的上海日键 = 2026-11-04;窗口 11-01~11-04,当日 00:30 < 08:30 ⇒ 当日不判
    expect(absentDates(STUDENT_1)).toEqual(['2026-11-01', '2026-11-02', '2026-11-03'])
    expect(result.rules).toBe(1)
  })

  it('软删记录照现状**不**挡住补录(部分唯一索引只约束未软删行)', async () => {
    H.records.push({
      id: 'seed-soft-deleted',
      studentId: STUDENT_1,
      classId: CLASS_A,
      date: '2026-11-03',
      status: 'present',
      checkInMethod: 'self',
      operatedBy: null,
      checkInTime: '2026-11-03T00:20:00.000Z',
      checkOutTime: null,
      remark: null,
      deletedAt: '2026-11-03T12:00:00.000Z',
    })
    script({
      rule: [[ruleRow(CLASS_A, '08:30')]],
      enrollment: [[enrollRow(STUDENT_1)]],
      record: [[]], // 真库不会把软删行答出来(SQL 里 isNull(deletedAt))
      schedule: NO_SCHEDULE_ROWS,
    })

    const result = await runAbsentAttendance(AT_10_00, SAME_DAY_ONLY)

    expect(result.created).toBe(1)
    expect(H.records.filter((r) => r.studentId === STUDENT_1)).toHaveLength(2)
    expect(H.records.find((r) => r.id === 'seed-soft-deleted')?.status).toBe('present')
  })
})

describe('runAbsentAttendance ⑧:回溯下界 —— 规则没建/学生没进班的日子不造历史', () => {
  it('规则当日才建 ⇒ 窗口里早于它的日子一条不补', async () => {
    script({
      // 北京 2026-11-03 18:30 落库 ⇒ 下界 = 2026-11-03
      rule: [[ruleRow(CLASS_A, '19:00', new Date('2026-11-03T10:30:00.000Z'))]],
      enrollment: [[enrollRow(STUDENT_1)]],
      record: [[]],
      schedule: NO_SCHEDULE_ROWS,
    })

    await runAbsentAttendance(AT_CRON_04)

    expect(absentDates(STUDENT_1)).toEqual(['2026-11-03'])
  })

  it('学生 11-03 才报名 ⇒ 11-01/11-02 不补(与 ⑦ 首条同窗无下界时形成对照)', async () => {
    script({
      rule: [[ruleRow(CLASS_A, '19:00')]],
      enrollment: [[enrollRow(STUDENT_1, '2026-11-03')]],
      record: [[]],
      schedule: NO_SCHEDULE_ROWS,
    })

    const result = await runAbsentAttendance(AT_CRON_04)

    expect(absentDates(STUDENT_1)).toEqual(['2026-11-03'])
    expect(result.created).toBe(1)
    expect(result.students).toBe(1)
  })

  it('量不到下界(列缺失/非法形)⇒ 不设界照常补判,不静默也不误判成"不可判"', async () => {
    script({
      rule: [[ruleRow(CLASS_A, '19:00', null)]], // 取不到 createdAt
      enrollment: [[{ studentId: STUDENT_1, enrollDate: '不是日期' }]],
      record: [[]],
      schedule: NO_SCHEDULE_ROWS,
    })

    const result = await runAbsentAttendance(AT_CRON_04)

    expect(result.created).toBe(DEFAULT_BACKFILL_DAYS) // 前 3 天全补(当日未到 19:00 不判)
    expect(absentDates(STUDENT_1)).toEqual(['2026-11-01', '2026-11-02', '2026-11-03'])
  })
})

describe('排课门控 ⑨:那天根本没课 ⇒ 不写缺勤(2026-11-07,ATT-SCHEDGATE 票)', () => {
  /**
   * 立因(现读为证):回溯窗一开,判定只看"那天有没有打卡"、不看"那天有没有课"的旧病
   * 被成倍放大 —— 每轮多写 3 个业务日的假缺勤。对要进免责链条的记录,**误判比漏判更脏**:
   * 漏判没人响,误判会直接变成给家长看的记录。
   * 本组把三态逐档钉死:判得出无课 ⇒ 不写;判不出(没排过课/表读不动/weekday 坏) ⇒ **照旧判**。
   */
  const info = vi.mocked(logger.info)
  const warn = vi.mocked(logger.warn)

  /** 点名要看得见内容,不是只数次数:从 logger 调用里挑出消息含指定串的第一条 */
  const findLog = (include: string): { msg: string; data: Record<string, unknown> } => {
    for (const spy of [info, warn]) {
      for (const call of spy.mock.calls) {
        const msg = String(call[0] ?? '')
        if (msg.includes(include)) {
          return { msg, data: (call[1] ?? {}) as Record<string, unknown> }
        }
      }
    }
    throw new Error(`日志里没有含「${include}」的一条 ⇒ 点名没落地`)
  }

  beforeEach(() => {
    info.mockClear()
    warn.mockClear()
  })

  it('正向对照(成对之一):该班周六**有课** ⇒ 周六照样补出缺勤,门控没把有课的日子吞掉', async () => {
    script({
      rule: [[ruleRow(CLASS_A, '08:30')]],
      enrollment: [[enrollRow(STUDENT_1), enrollRow(STUDENT_2)]],
      record: [[]],
      schedule: [[schedRow(CLASS_A, WEEKDAYS.sat)]],
    })

    const result = await runAbsentAttendance(AT_SAT, SAME_DAY_ONLY)

    expect(result).toEqual({ rules: 1, students: 2, created: 2, skipped: 0, missedIds: [] })
    expect(absentDates()).toEqual(['2026-11-07', '2026-11-07'])
    expect(findLog('edu attendance absent job done').data).toMatchObject({
      scheduleGatedOutDates: 0,
      scheduleFullyGatedClasses: 0,
      scheduleNoSchoolClasses: 0,
      scheduleUnjudgedClasses: 0,
      scheduleReadFailed: false,
    })
    expect(H.unscripted).toBe(0)
  })

  it('无排课的周六 ⇒ 整班一条不写,且连在册学生都不查(零 IO),日志点名被剔的日子', async () => {
    script({
      rule: [[ruleRow(CLASS_A, '08:30')]],
      schedule: [[schedRow(CLASS_A, WEEKDAYS.mon), schedRow(CLASS_A, WEEKDAYS.fri)]],
    })

    const result = await runAbsentAttendance(AT_SAT, SAME_DAY_ONLY)

    expect(result).toEqual({ rules: 1, students: 0, created: 0, skipped: 0, missedIds: [] })
    expect(H.records).toHaveLength(0)
    expect(H.insertCalls).toBe(0)
    expect(H.readOrder).toEqual(['rule', 'schedule'])
    expect(findLog('该班窗口内全无排课').data).toMatchObject({
      classId: CLASS_A,
      gatedOut: ['2026-11-07'],
    })
    expect(findLog('edu attendance absent job done').data).toMatchObject({
      scheduleGatedOutDates: 1,
      scheduleFullyGatedClasses: 1,
      scheduleNoSchoolClasses: 0,
      scheduleUnjudgedClasses: 0,
    })
    expect(H.unscripted).toBe(0)
  })

  it('窗口内逐日门控:周五有课照判、周六周日无课剔掉(absent_after 晚于跑批 ⇒ 当日仍不判)', async () => {
    script({
      rule: [[ruleRow(CLASS_A, '19:00')]],
      enrollment: [[enrollRow(STUDENT_1)]],
      record: [[]],
      schedule: [[schedRow(CLASS_A, WEEKDAYS.mon), schedRow(CLASS_A, WEEKDAYS.fri)]],
    })

    const result = await runAbsentAttendance(AT_CRON_MON)

    // 窗口 11-06(五)/11-07(六)/11-08(日)/11-09(一,当日未到 19:00 不判)⇒ 只剩 11-06
    expect(absentDates(STUDENT_1)).toEqual(['2026-11-06'])
    expect(result.created).toBe(1)
    expect(findLog('edu attendance absent job done').data).toMatchObject({
      scheduleGatedOutDates: 2,
      scheduleFullyGatedClasses: 0,
    })
    expect(H.unscripted).toBe(0)
  })

  it('反向对照(与上一条同夹具):周末也排了课 ⇒ 六/日照旧补,门控只认"有没有课"不认"是不是周末"', async () => {
    script({
      rule: [[ruleRow(CLASS_A, '19:00')]],
      enrollment: [[enrollRow(STUDENT_1)]],
      record: [[]],
      schedule: [
        [
          schedRow(CLASS_A, WEEKDAYS.fri),
          schedRow(CLASS_A, WEEKDAYS.sat),
          schedRow(CLASS_A, WEEKDAYS.sun),
        ],
      ],
    })

    const result = await runAbsentAttendance(AT_CRON_MON)

    expect(absentDates(STUDENT_1)).toEqual(['2026-11-06', '2026-11-07', '2026-11-08'])
    expect(result.created).toBe(3)
    expect(findLog('edu attendance absent job done').data).toMatchObject({
      scheduleGatedOutDates: 0,
    })
  })

  it('该班排课表**一条有效记录都没有** ⇒ 判不出"无课",照旧判缺勤并点名班级枚数(跳过变永久停摆这一格被封死)', async () => {
    script({
      rule: [[ruleRow(CLASS_A, '08:30')]],
      enrollment: [[enrollRow(STUDENT_1), enrollRow(STUDENT_2)]],
      record: [[]],
      schedule: [[]], // 库里这班从没排过课
    })

    const result = await runAbsentAttendance(AT_SAT, SAME_DAY_ONLY)

    // 失效方向 = 照旧判:周六也照写(与"正向对照:周六有课"同形),绝不静默整班跳过
    expect(result).toEqual({ rules: 1, students: 2, created: 2, skipped: 0, missedIds: [] })
    expect(absentDates()).toEqual(['2026-11-07', '2026-11-07'])
    const named = findLog('一条有效记录都没有')
    expect(named.data).toMatchObject({ sampleIds: [CLASS_A], omittedIds: 0 })
    expect(findLog('edu attendance absent job done').data).toMatchObject({
      scheduleNoSchoolClasses: 1,
      scheduleUnjudgedClasses: 0,
      scheduleGatedOutDates: 0,
    })
    expect(H.unscripted).toBe(0)
  })

  it('两班对照:有排课的班被门控、没排课的班照旧判,两档各走各的、不互相传染;排课表整轮只读一条', async () => {
    script({
      rule: [[ruleRow(CLASS_A, '08:30'), ruleRow(CLASS_B, '08:30')]],
      // A 班被门控判成"整窗无课"⇒ 结构上不会去读它的在册学生(零 IO),
      // 所以 enroll/record 队列里只有 B 班那一枚答复(多给就是一条没人消费的死脚本)
      enrollment: [[enrollRow(STUDENT_2)]],
      record: [[]],
      schedule: [[schedRow(CLASS_A, WEEKDAYS.mon)]], // 只有 A 班排过课,B 班零行
    })

    const result = await runAbsentAttendance(AT_SAT, SAME_DAY_ONLY)

    expect(result).toMatchObject({ rules: 2, students: 1, created: 1 })
    expect(H.records.filter((r) => r.classId === CLASS_A)).toHaveLength(0)
    expect(absentDates(STUDENT_2)).toEqual(['2026-11-07'])
    expect(H.readOrder).toEqual(['rule', 'schedule', 'enrollment', 'record'])
    expect(H.readOrder.filter((k) => k === 'schedule')).toHaveLength(1)
    expect(findLog('edu attendance absent job done').data).toMatchObject({
      scheduleFullyGatedClasses: 1,
      scheduleNoSchoolClasses: 1,
      scheduleGatedOutDates: 1,
    })
    expect(H.unscripted).toBe(0)
  })

  it('排课表读不动(relation 不存在)⇒ 照旧判缺勤 + warn 点名,不抛错、不把"读不到"记成"没课"', async () => {
    H.failReads = ['schedule']
    script({
      rule: [[ruleRow(CLASS_A, '08:30')]],
      enrollment: [[enrollRow(STUDENT_1), enrollRow(STUDENT_2)]],
      record: [[]],
    })

    const result = await runAbsentAttendance(AT_SAT, SAME_DAY_ONLY)

    expect(result).toEqual({ rules: 1, students: 2, created: 2, skipped: 0, missedIds: [] })
    expect(H.records).toHaveLength(2)
    const named = findLog('排课表读不到')
    expect(named.data).toMatchObject({ classes: 1, sampleIds: [CLASS_A] })
    expect(String(named.data.reason)).toContain('does not exist')
    expect(findLog('edu attendance absent job done').data).toMatchObject({
      scheduleReadFailed: true,
      scheduleUnjudgedClasses: 1,
      scheduleNoSchoolClasses: 0,
      scheduleGatedOutDates: 0,
    })
  })

  it('weekday 列读得到却全是非法档 ⇒ unjudged:照旧判缺勤并点名(排课数据坏了不等于没课)', async () => {
    script({
      rule: [[ruleRow(CLASS_A, '08:30')]],
      enrollment: [[enrollRow(STUDENT_1)]],
      record: [[]],
      schedule: [
        [
          { classId: CLASS_A, weekday: '周六' },
          { classId: CLASS_A, weekday: 9 },
        ],
      ],
    })

    const result = await runAbsentAttendance(AT_SAT, SAME_DAY_ONLY)

    expect(result).toEqual({ rules: 1, students: 1, created: 1, skipped: 0, missedIds: [] })
    const named = findLog('读不出合法星期几')
    expect(named.data).toMatchObject({ sampleIds: [CLASS_A], malformedWeekdayRows: 2 })
    expect(findLog('edu attendance absent job done').data).toMatchObject({
      scheduleUnjudgedClasses: 1,
      scheduleMalformedWeekdays: 2,
    })
    expect(H.unscripted).toBe(0)
  })

  it('已有 leave 的日子不因门控改写:门控只减"无课日",既有行一字不动、有课日照常补', async () => {
    seedRow(STUDENT_1, CLASS_A, '2026-11-07', 'leave')
    const before = H.records.find((r) => r.date === '2026-11-07')
    script({
      rule: [[ruleRow(CLASS_A, '08:30')]],
      enrollment: [[enrollRow(STUDENT_1), enrollRow(STUDENT_2)]],
      record: [[existingRow(STUDENT_1, '2026-11-07')]],
      schedule: [[schedRow(CLASS_A, WEEKDAYS.sat)]], // 只有周六排课
    })

    const result = await runAbsentAttendance(AT_SAT)

    // 默认窗 11-04(三)~11-07(六):前三天无课 ⇒ 被门控剔掉(各 1 枚,共 3 枚),
    // 11-07 有课 ⇒ 照判;而 11-07 上 S1 已有 leave ⇒ 不写、不改
    expect(absentDates(STUDENT_2)).toEqual(['2026-11-07'])
    expect(absentDates(STUDENT_1)).toEqual([])
    expect(result.created).toBe(1)
    const after = H.records.find((r) => r.date === '2026-11-07')
    expect(after?.status).toBe('leave')
    expect(after?.id).toBe(before?.id)
    expect(H.insertBatches.flat().map((v) => `${v.studentId}@${v.date}`)).not.toContain(
      `${STUDENT_1}@2026-11-07`,
    )
    expect(findLog('edu attendance absent job done').data).toMatchObject({
      scheduleGatedOutDates: 3,
      scheduleFullyGatedClasses: 0,
    })
  })
})

describe('排课门控 ⑩:星期几与三态档位由生产实现单源定义(§22c 判据零复制)', () => {
  it('weekdayOfBizDayKey:1=周一…7=周日 七日照表(与 edu_course_schedule.weekday 同键);非法形 ⇒ null', () => {
    expect(jobTest.weekdayOfBizDayKey('2026-11-02')).toBe(WEEKDAYS.mon)
    expect(jobTest.weekdayOfBizDayKey('2026-11-03')).toBe(WEEKDAYS.tue)
    expect(jobTest.weekdayOfBizDayKey('2026-11-04')).toBe(WEEKDAYS.wed)
    expect(jobTest.weekdayOfBizDayKey('2026-11-05')).toBe(WEEKDAYS.thu)
    expect(jobTest.weekdayOfBizDayKey('2026-11-06')).toBe(WEEKDAYS.fri)
    expect(jobTest.weekdayOfBizDayKey('2026-11-07')).toBe(WEEKDAYS.sat)
    expect(jobTest.weekdayOfBizDayKey('2026-11-01')).toBe(WEEKDAYS.sun)
    // 周日界与跨年:2026-11-08 仍是周日、2027-01-01 是周五
    expect(jobTest.weekdayOfBizDayKey('2026-11-08')).toBe(WEEKDAYS.sun)
    expect(jobTest.weekdayOfBizDayKey('2027-01-01')).toBe(WEEKDAYS.fri)
    // 量不到 ⇒ null(不猜星期几 ⇒ 调用方按"照旧判"处置)
    expect(jobTest.weekdayOfBizDayKey('2026-11-7')).toBeNull()
    expect(jobTest.weekdayOfBizDayKey('昨天')).toBeNull()
    expect(jobTest.weekdayOfBizDayKey('2026-13-40')).toBeNull()
    expect(jobTest.weekdayOfBizDayKey('')).toBeNull()
  })

  it('buildClassScheduleGates:≥1 条合法 weekday ⇒ gated;零行 ⇒ no-schedule;全非法 ⇒ unjudged', () => {
    const gated = jobTest.buildClassScheduleGates({
      classIds: [CLASS_A],
      rows: [
        { classId: CLASS_A, weekday: 6 },
        { classId: CLASS_A, weekday: '6' },
      ],
    })
    expect(gated.gates.get(CLASS_A)?.state).toBe('gated')
    expect(Array.from(gated.gates.get(CLASS_A)?.weekdays ?? []).sort()).toEqual([6])
    expect(gated.foreignRows).toBe(0)

    // 从没排过课 ⇒ no-schedule(照旧判,不是"整班跳过")
    const silent = jobTest.buildClassScheduleGates({ classIds: [CLASS_A], rows: [] })
    expect(silent.gates.get(CLASS_A)?.state).toBe('no-schedule')

    // 读到了课却折不出星期几 ⇒ unjudged(与 no-schedule 分档,便于日志分别点名)
    const broken = jobTest.buildClassScheduleGates({
      classIds: [CLASS_A],
      rows: [
        { classId: CLASS_A, weekday: null },
        { classId: CLASS_A, weekday: 8 },
      ],
    })
    expect(broken.gates.get(CLASS_A)?.state).toBe('unjudged')
    expect(broken.gates.get(CLASS_A)?.malformedWeekdays).toBe(2)

    // 答复里出现别的班 ⇒ 只报数不改档位
    const foreign = jobTest.buildClassScheduleGates({
      classIds: [CLASS_A],
      rows: [{ classId: CLASS_B, weekday: 1 }],
    })
    expect(foreign.foreignRows).toBe(1)
    expect(foreign.gates.get(CLASS_A)?.state).toBe('no-schedule')
  })

  it('gateDueDates:**失效方向恒为照旧判** —— no-schedule / unjudged / 无档位一律全量放行', () => {
    const dates = ['2026-11-06', '2026-11-07', '2026-11-08']
    for (const state of ['no-schedule', 'unjudged'] as const) {
      const passed = jobTest.gateDueDates(dates, {
        state,
        weekdays: new Set<number>(),
        malformedWeekdays: state === 'unjudged' ? 1 : 0,
      })
      expect(passed.dates).toEqual(dates)
      expect(passed.gatedOut).toEqual([])
    }
    expect(jobTest.gateDueDates(dates, undefined).dates).toEqual(dates)

    const gated = jobTest.gateDueDates(dates, {
      state: 'gated',
      weekdays: new Set([WEEKDAYS.fri]),
      malformedWeekdays: 0,
    })
    expect(gated.dates).toEqual(['2026-11-06'])
    expect(gated.gatedOut).toEqual(['2026-11-07', '2026-11-08'])

    // 日键畸形折不出星期几 ⇒ 照旧判并单列计数(判不出 ≠ 无课)
    const undetermined = jobTest.gateDueDates(['2026-11-07', '不是日期'], {
      state: 'gated',
      weekdays: new Set([WEEKDAYS.mon]),
      malformedWeekdays: 0,
    })
    expect(undetermined.dates).toEqual(['不是日期'])
    expect(undetermined.undetermined).toEqual(['不是日期'])
    expect(undetermined.gatedOut).toEqual(['2026-11-07'])
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
      schedule: NO_SCHEDULE_ROWS,
    })

    const result = await runAbsentAttendance(AT_10_00, SAME_DAY_ONLY)

    expect(result.students).toBe(2)
    expect(result.created).toBe(2)
    expect(H.records).toHaveLength(2)
  })

  it('同人多期报名 ⇒ 回溯下界取较晚那一期(绝不把没进班的日子算成缺勤)', async () => {
    script({
      rule: [[ruleRow(CLASS_A, '08:30')]],
      enrollment: [[enrollRow(STUDENT_1, '2026-10-01'), enrollRow(STUDENT_1, '2026-11-02')]],
      record: [[]],
      schedule: NO_SCHEDULE_ROWS,
    })

    const result = await runAbsentAttendance(AT_10_00)

    // 窗口 4 天(2026-10-31~11-03),但下界被抬到 11-02 ⇒ 只补 11-02 与 11-03
    expect(result.students).toBe(1)
    expect(result.created).toBe(2)
    expect(absentDates(STUDENT_1)).toEqual(['2026-11-02', '2026-11-03'])
  })

  it('连跑两轮不重复 ⇒ 每轮读队列都被消费干净(unscripted 恒 0)', async () => {
    const window = jobTest.buildBizDayWindow('2026-11-03', DEFAULT_BACKFILL_DAYS)
    script({
      rule: [[ruleRow(CLASS_A, '08:30')]],
      enrollment: [[{ studentId: STUDENT_1 }]],
      record: [[]],
      schedule: NO_SCHEDULE_ROWS,
    })
    const first = await runAbsentAttendance(AT_10_00)
    expect(H.unscripted).toBe(0)
    // 默认窗:含当日 4 个业务日,当日已过 08:30 ⇒ 4 条
    expect(first.created).toBe(window.length)
    expect(H.records).toHaveLength(window.length)

    H.reads.rule.push([ruleRow(CLASS_A, '08:30')])
    H.reads.enrollment.push([{ studentId: STUDENT_1 }])
    H.reads.record.push([existingRow(STUDENT_1, window[0]!)])
    H.reads.schedule.push([])
    const second = await runAbsentAttendance(AT_10_00)

    // 并发/读漏:预筛只答出 1 天而库里其实 4 天都有 ⇒ insert 仍会发,但 uq 索引 +
    // onConflictDoNothing 保证一条也不重复入库,没落库的学生进 missedIds(门 134 的"响")
    expect(second.created).toBe(0)
    expect(second.missedIds).toEqual([STUDENT_1])
    expect(H.unscripted).toBe(0)
    expect(H.records).toHaveLength(window.length)
    expect(H.insertCalls).toBe(2)

    // 第三轮:库里真少了 11-02 那一天(其余三天照旧答出)⇒ 只补那一日,不是整窗重来
    const missing = '2026-11-02'
    const stillThere = window.filter((d) => d !== missing)
    H.records = H.records.filter((r) => r.date !== missing)
    H.reads.rule.push([ruleRow(CLASS_A, '08:30')])
    H.reads.enrollment.push([{ studentId: STUDENT_1 }])
    H.reads.record.push(existingRowsFor([STUDENT_1], stillThere))
    H.reads.schedule.push([])
    const third = await runAbsentAttendance(AT_10_00)

    // 幂等是按 (学生,日期) **对**判的:已存在的 3 天不进 values,缺的那 1 天照补
    expect(third.created).toBe(1)
    expect(third.skipped).toBe(0)
    expect(third.missedIds).toEqual([])
    expect(H.records.map((r) => r.date).sort()).toEqual([...window].sort())
    expect(H.unscripted).toBe(0)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
