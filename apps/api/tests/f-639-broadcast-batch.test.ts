// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * F-639 回归锁(2026-11-13)。不连库:mock db 链式。
 *
 * 病灶:`broadcastNotification` 对 `users` 全表选 id(无 status 过滤,含 3=注销),
 * 随后单条 `insert().values(全部用户)`;约 1.6 万用户 × 4 参数即越过 PG 65535 参数上限,
 * 整批 500 一条不发,且持续向注销/禁用账号投递。
 *
 * 本文件锁:
 *   ① 1 万收件人 ⇒ 分 ≥20 批,每批不超过 BROADCAST_INSERT_CHUNK_SIZE;
 *   ② status=0(禁用)/ status=3(注销)被排除,只投递 status=1;
 *   ③ 某批写失败 ⇒ 抛出并带批次与已写入行数,不静默当成功;
 *   ④ 成功路径 created 计数 = 实际落库行数(尾批不齐也如实累加)。
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'

type UserRow = { id: string; status: number }
type Batch = Record<string, unknown>[]

const H = vi.hoisted(() => ({
  usersRows: [] as UserRow[],
  whereArgs: [] as unknown[],
  insertBatches: [] as Batch[],
  insertCalls: 0,
  /** 第 N 次 insert(1 起)让 returning 抛错 ⇒ 模拟该批写失败;0 = 不注入 */
  failInsertCall: 0,
}))

vi.mock('../src/db/index.js', () => {
  const tableNameOf = (table: unknown): string => {
    const name = (table as Record<symbol, unknown>)[Symbol.for('drizzle:Name')]
    return typeof name === 'string' ? name : 'unknown'
  }

  /** `eq(users.status, 1)` 产生的 SQL 对象里带一个值为 1 的绑定参数。 */
  const hasStatusOneParam = (cond: unknown): boolean => {
    const chunks = (cond as { queryChunks?: unknown[] } | undefined)?.queryChunks ?? []
    return chunks.some((c) => (c as { value?: unknown }).value === 1)
  }

  const selectChain = () => {
    let rows: UserRow[] = []
    const step: Record<string, unknown> = {}
    step.from = vi.fn((table: unknown) => {
      if (tableNameOf(table) === 'users') rows = [...H.usersRows]
      return step
    })
    step.where = vi.fn((cond: unknown) => {
      H.whereArgs.push(cond)
      // 与真实 SQL 同语义:带 status=1 谓词时,禁用(0)/注销(3)行不返回。
      if (hasStatusOneParam(cond)) rows = rows.filter((r) => r.status === 1)
      return step
    })
    step.then = (resolve: (v: unknown) => void, reject?: (e: unknown) => void) =>
      Promise.resolve(rows.map((r) => ({ id: r.id }))).then(resolve, reject)
    return step
  }

  const insertChain = () => {
    H.insertCalls += 1
    const callNo = H.insertCalls
    let values: Batch = []
    const step: Record<string, unknown> = {}
    step.values = vi.fn((v: Batch | Record<string, unknown>) => {
      values = Array.isArray(v) ? [...v] : [v]
      H.insertBatches.push(values)
      return step
    })
    step.returning = vi.fn(() =>
      callNo === H.failInsertCall
        ? Promise.reject(new Error(`insert batch #${callNo} failed`))
        : Promise.resolve(values.map((r, i) => ({ ...r, id: `n-${callNo}-${i}` }))),
    )
    return step
  }

  const dbMock = {
    select: vi.fn(() => selectChain()),
    insert: vi.fn(() => insertChain()),
    execute: vi.fn(() => Promise.resolve([])),
  }
  return { db: dbMock, dbRead: dbMock, dbClient: {} }
})

import {
  BROADCAST_INSERT_CHUNK_SIZE,
  broadcastNotification,
} from '../src/db/notification-queries.js'

const INPUT = { title: '系统维护通知', content: '今晚 23:00 例行维护', type: 'system' }

/** 造 n 个用户;status 固定时全部同状态,否则按 i % 2 交替 1/0 */
const makeUsers = (n: number, status = 1, prefix = 'u'): UserRow[] =>
  Array.from({ length: n }, (_, i) => ({
    id: `${prefix}-${String(i + 1).padStart(5, '0')}`,
    status,
  }))

beforeEach(() => {
  H.usersRows = []
  H.whereArgs = []
  H.insertBatches = []
  H.insertCalls = 0
  H.failInsertCall = 0
})

describe('F-639 ①:1 万收件人分 ≥20 批,每批 ≤500', () => {
  it('10,000 个有效用户 ⇒ 20 批 × 500 行,created 全量返回', async () => {
    H.usersRows = makeUsers(10_000)

    const created = await broadcastNotification(INPUT)

    expect(BROADCAST_INSERT_CHUNK_SIZE).toBe(500)
    expect(H.insertCalls).toBeGreaterThanOrEqual(20)
    expect(H.insertBatches).toHaveLength(20)
    expect(H.insertBatches.map((b) => b.length)).toEqual(Array.from({ length: 20 }, () => 500))
    expect(H.insertBatches.every((b) => b.length <= BROADCAST_INSERT_CHUNK_SIZE)).toBe(true)
    expect(created).toHaveLength(10_000)
  })
})

describe('F-639 ②:禁用 / 注销用户被排除', () => {
  it('status=0 与 status=3 的账号不进入任何批次', async () => {
    H.usersRows = [
      { id: 'u-active-1', status: 1 },
      { id: 'u-disabled', status: 0 },
      { id: 'u-active-2', status: 1 },
      { id: 'u-deleted', status: 3 },
    ]

    const created = await broadcastNotification(INPUT)

    expect(H.whereArgs).toHaveLength(1)
    expect(H.insertBatches.flat().map((r) => r.userId)).toEqual(['u-active-1', 'u-active-2'])
    expect(created.map((n) => n.userId)).toEqual(['u-active-1', 'u-active-2'])
  })
})

describe('F-639 ③:单批失败被抛出并带批次/已写入行数', () => {
  it('第 2 批 insert 抛错 ⇒ 拒绝且不静默当成功', async () => {
    H.usersRows = makeUsers(1_203)
    H.failInsertCall = 2

    const err = await broadcastNotification(INPUT).catch((e: unknown) => e as Error)

    expect(err).toBeInstanceOf(Error)
    expect(err.message).toContain('第 2 批')
    expect(err.message).toContain('已写入 500/1203 行')
    expect(err.message).toContain('insert batch #2 failed')
    // 只尝试了两批:首批已真落库,失败批之后的行没有被当成成功
    expect(H.insertCalls).toBe(2)
    expect(H.insertBatches.map((b) => b.length)).toEqual([500, 500])
  })
})

describe('F-639 ④:成功计数按实际成功行累加', () => {
  it('1,203 个收件人 ⇒ 批次 [500,500,203],created=1203', async () => {
    H.usersRows = makeUsers(1_203)

    const created = await broadcastNotification(INPUT)

    expect(H.insertBatches.map((b) => b.length)).toEqual([500, 500, 203])
    expect(created).toHaveLength(1_203)
    expect(new Set(created.map((n) => n.userId)).size).toBe(1_203)
    expect(created.every((n) => n.title === INPUT.title && n.type === INPUT.type)).toBe(true)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
