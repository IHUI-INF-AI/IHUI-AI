// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// HR-2 契约测试:考勤日结 / 假期额度 / 补卡提交 / 补卡审批。
// 照抄 hr-jobs-contract.test.ts 骨架:vi.hoisted 账本 H + vi.mock 假库,全程不连真库。
// 假库按对象引用分流(H.keyOf(t),用 `t === H.tables.xxx` 判),不靠表名字符串。
// barrel 未接线(hr-shift-daily.js 未在 packages/database/src/schema/index.ts export)⇒
// 这里直接 vi.mock('@ihui/database') 补 4 张表 stub 对象;stub 只是身份引用,服务里对表的所有
// drizzle 操作都打在下方假 db 链上,表 stub 本身从不被调用。

import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── vi.hoisted 账本:工厂 mock 在模块求值前就要拿到它 ──────────────────────────
const H = vi.hoisted(() => {
  // 4 张表 stub:身份引用即可,服务只把它们当 drizzle 表 token 传进 db 链
  const tables = {
    hrAttendanceDaily: { name: 'hr_attendance_daily' },
    hrAttendanceRecord: { name: 'hr_attendance_record' },
    hrLeaveBalance: { name: 'hr_leave_balance' },
    hrPunchFix: { name: 'hr_punch_fix' },
  }
  type Key = keyof typeof tables
  type Row = Record<string, unknown>
  type Ledger = {
    reads: Key[]
    insertFix: Row[]
    updateFix: Row[]
    updateRecord: Row[]
    queue: Record<Key, Row[]>
  }

  function fresh(): Ledger {
    return {
      reads: [],
      insertFix: [],
      updateFix: [],
      updateRecord: [],
      queue: {
        hrAttendanceDaily: [],
        hrAttendanceRecord: [],
        hrLeaveBalance: [],
        hrPunchFix: [],
      },
    }
  }

  let L: Ledger = fresh()

  return {
    tables,
    keyOf: (t: unknown): Key | null =>
      (Object.keys(tables) as Key[]).find((k) => tables[k] === t) ?? null,
    get reads() {
      return L.reads
    },
    get insertFix() {
      return L.insertFix
    },
    get updateFix() {
      return L.updateFix
    },
    get updateRecord() {
      return L.updateRecord
    },
    reset: () => {
      L = fresh()
    },
    /** 给某张表预置一条 select 命中行 */
    seed(k: Key, row: Row) {
      L.queue[k].push(row)
    },
    /** 弹出某张表的 select 命中行(队列空返回 undefined) */
    pop(k: Key): Row | undefined {
      return L.queue[k].shift()
    },
    /** 弹出某张表全部预置行 */
    drain(k: Key): Row[] {
      const rows = L.queue[k]
      L.queue[k] = []
      return rows
    },
    /** 当前预置行数(给 count 查询用,不消费队列) */
    count(k: Key): number {
      return L.queue[k].length
    },
  }
})

// ── vi.mock('@ihui/database'):补 4 张表 stub(barrel 未接线时服务 import 会炸)──
vi.mock('@ihui/database', () => ({
  hrAttendanceDaily: H.tables.hrAttendanceDaily,
  hrAttendanceRecord: H.tables.hrAttendanceRecord,
  hrLeaveBalance: H.tables.hrLeaveBalance,
  hrPunchFix: H.tables.hrPunchFix,
}))

// ── vi.mock('../src/db/index.js'):返回 { db, dbRead, dbWriter, dbClient } ─────
// select/insert/update 全部 chainable;.then 触发时从账本弹行并记录读/写。
// select(fields) 带 projection 参数 = count 查询 ⇒ 返回 [{ c: 队列当前长度 }];
// select() 无参 = list 查询 ⇒ drain 队列返回真实行。
vi.mock('../src/db/index.js', () => {
  type Key = keyof typeof H.tables

  function makeSelectChain(table: unknown, isCount: boolean) {
    const key = H.keyOf(table) as Key | null
    const chain = {
      where: () => chain,
      orderBy: () => chain,
      limit: () => chain,
      offset: () => chain,
      from: () => chain,
      then: (resolve: (rows: unknown[]) => unknown, reject: (e: unknown) => unknown) => {
        if (key) H.reads.push(key)
        const rows = isCount ? [{ c: key ? H.count(key) : 0 }] : key ? H.drain(key) : []
        return Promise.resolve(rows).then(resolve, reject)
      },
    }
    return chain
  }

  const db = {
    select: (fields?: any) => ({
      from: (t: unknown) => makeSelectChain(t, fields !== undefined),
    }),
    insert: (t: unknown) => ({
      values: (row: Record<string, unknown>) => ({
        returning: () =>
          Promise.resolve([row]).then((rows) => {
            if (H.keyOf(t) === 'hrPunchFix') H.insertFix.push(row)
            return rows
          }),
      }),
    }),
    update: (t: unknown) => ({
      set: (patch: Record<string, unknown>) => ({
        where: () => ({
          returning: () =>
            Promise.resolve([patch]).then((rows) => {
              const k = H.keyOf(t)
              if (k === 'hrPunchFix') H.updateFix.push(patch)
              if (k === 'hrAttendanceRecord') H.updateRecord.push(patch)
              return rows
            }),
        }),
      }),
    }),
  }

  return {
    db,
    dbRead: db,
    dbWriter: db,
    dbClient: { query: async () => ({ rows: [] }) },
  }
})

// ── vi.mock('../src/utils/logger.js'):吞掉日志 ────────────────────────────────
vi.mock('../src/utils/logger.js', () => ({
  logger: { info: () => {}, warn: () => {}, error: () => {}, debug: () => {} },
}))

import {
  listAttendanceDaily,
  listLeaveBalances,
  submitPunchFix,
  approvePunchFix,
} from '../src/services/hr-daily.js'

beforeEach(() => {
  H.reset()
})

// ── 用例 ──────────────────────────────────────────────────────────────────────
describe('HR-2 契约:考勤日结 / 假期额度 / 补卡', () => {
  it('listAttendanceDaily 走 select 链返回 { list, total }', async () => {
    H.seed('hrAttendanceDaily', { id: 'd1', employeeId: 'e1', date: '2026-11-01' })
    H.seed('hrAttendanceDaily', { id: 'd2', employeeId: 'e1', date: '2026-11-02' })

    const result = await listAttendanceDaily({ employeeId: 'e1' })
    expect(result.list).toHaveLength(2)
    expect(result.list[0]).toMatchObject({ id: 'd1' })
    // count + list 两次读同一张表
    expect(H.reads.filter((k) => k === 'hrAttendanceDaily').length).toBe(2)
  })

  it('listAttendanceDaily 空表返回 { list: [], total: 0 }', async () => {
    const result = await listAttendanceDaily({})
    expect(result.list).toEqual([])
    expect(result.total).toBe(0)
  })

  it('listLeaveBalances 走 select 链返回数组', async () => {
    H.seed('hrLeaveBalance', { employeeId: 'e1', leaveType: 'annual', year: 2026, total: 10 })
    H.seed('hrLeaveBalance', { employeeId: 'e1', leaveType: 'sick', year: 2026, total: 5 })

    const rows = await listLeaveBalances({ employeeId: 'e1' })
    expect(Array.isArray(rows)).toBe(true)
    expect(rows).toHaveLength(2)
    expect(rows[0]).toMatchObject({ leaveType: 'annual' })
  })

  it('submitPunchFix 落 pending 单且 reason 被 trim', async () => {
    const row = await submitPunchFix({
      employeeId: 'e1',
      departmentId: 'd1',
      date: '2026-11-01',
      punchType: 'check_in',
      reason: ' 忘打卡 ',
    })

    expect(row).toMatchObject({ employeeId: 'e1', status: 'pending', reason: '忘打卡' })
    expect(H.insertFix).toHaveLength(1)
    expect(H.insertFix[0]).toMatchObject({ status: 'pending', reason: '忘打卡' })
  })

  it('submitPunchFix 日期格式非法抛错', async () => {
    await expect(
      submitPunchFix({
        employeeId: 'e1',
        departmentId: 'd1',
        date: '2026/11/01',
        punchType: 'check_in',
        reason: 'ok',
      }),
    ).rejects.toThrow(/YYYY-MM-DD/)
    expect(H.insertFix).toHaveLength(0)
  })

  it('submitPunchFix punch_type 非法抛错', async () => {
    await expect(
      submitPunchFix({
        employeeId: 'e1',
        departmentId: 'd1',
        date: '2026-11-01',
        punchType: 'lunch' as 'check_in',
        reason: 'ok',
      }),
    ).rejects.toThrow(/punch_type|check_in|check_out/)
    expect(H.insertFix).toHaveLength(0)
  })

  it('submitPunchFix reason 为空抛错', async () => {
    await expect(
      submitPunchFix({
        employeeId: 'e1',
        departmentId: 'd1',
        date: '2026-11-01',
        punchType: 'check_in',
        reason: '   ',
      }),
    ).rejects.toThrow(/事由/)
    expect(H.insertFix).toHaveLength(0)
  })

  it('approvePunchFix 通过 → 回写 hr_attendance_record 的 status/checkInTime', async () => {
    const punchTime = new Date('2026-11-01T09:00:00Z')
    H.seed('hrPunchFix', {
      id: 'pf1',
      employeeId: 'e1',
      departmentId: 'd1',
      date: '2026-11-01',
      punchType: 'check_in',
      punchTime,
      status: 'pending',
    })
    H.seed('hrAttendanceRecord', {
      id: 'r1',
      employeeId: 'e1',
      departmentId: 'd1',
      date: '2026-11-01',
    })

    const outcome = await approvePunchFix({ punchFixId: 'pf1', approverId: 'mgr1', approve: true })

    expect(outcome.punchFix).toMatchObject({ status: 'approved', approverId: 'mgr1' })
    expect(outcome.attendanceRecord).toMatchObject({ status: 'present', checkInTime: punchTime })
    expect(H.updateRecord).toHaveLength(1)
    expect(H.updateRecord[0]).toMatchObject({ status: 'present' })
    expect(H.updateFix).toHaveLength(1)
    expect(H.updateFix[0]).toMatchObject({ status: 'approved' })
  })

  it('approvePunchFix 驳回 → 不动 hr_attendance_record', async () => {
    H.seed('hrPunchFix', {
      id: 'pf2',
      employeeId: 'e1',
      departmentId: 'd1',
      date: '2026-11-01',
      punchType: 'check_out',
      status: 'pending',
    })

    const outcome = await approvePunchFix({ punchFixId: 'pf2', approverId: 'mgr1', approve: false })

    expect(outcome.punchFix).toMatchObject({ status: 'rejected' })
    expect(outcome.attendanceRecord).toBeNull()
    expect(H.updateRecord).toHaveLength(0)
    expect(H.updateFix).toHaveLength(1)
    expect(H.updateFix[0]).toMatchObject({ status: 'rejected' })
  })

  it('重复审批非 pending 单被拒', async () => {
    H.seed('hrPunchFix', {
      id: 'pf3',
      employeeId: 'e1',
      departmentId: 'd1',
      date: '2026-11-01',
      punchType: 'check_in',
      status: 'approved', // 已处理
    })

    await expect(
      approvePunchFix({ punchFixId: 'pf3', approverId: 'mgr1', approve: true }),
    ).rejects.toThrow(/已处理|重复审批/)
    expect(H.updateRecord).toHaveLength(0)
    expect(H.updateFix).toHaveLength(0)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
