// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

/**
 * F-11 教育积分账本串行化回归(离线,不连库)。
 *
 * 病灶:`edu_point_records` 是追加型账本,旧实现用
 * `ORDER BY created_at DESC LIMIT 1 FOR UPDATE` 锁“上一行流水”。T1 只 INSERT
 * 新行、不改旧行,T2 在 READ COMMITTED 下仍读到同一旧 balance,两边用同一个
 * beforeBalance 落库;会员无流水时锁空集,两事务都从 0 起算。
 *
 * 判据:
 *  ① 四个事务入口(increase/decrease 走 adjustEduPoints、fallbackPoints、
 *     awardFirstSharePoints、awardAdPoints)的第一条事务语句都是按 member 维度的
 *     `pg_advisory_xact_lock(hashtext(...))`;
 *  ② 流水 SELECT 不再带 `FOR UPDATE` —— “上一行流水”不再是锁锚点;
 *  ③ 顺序调用时余额累加正确,每次 beforeBalance 等于上一次 afterBalance;
 *  ④ 同会员并发追加被锁串行化,总余额不丢更新。
 *
 * 假 db 按真实 SQL 的可观察结果实现:条件经 PgDialect 编译后按列/参数匹配,
 * advisory lock 用内存队列模拟事务级互斥(事务结束释放)。
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'

const BASE_TIME = Date.UTC(2026, 0, 1)

const harness = vi.hoisted(() => ({
  records: [] as Array<Record<string, any>>,
  channels: [] as Array<Record<string, any>>,
  points: [] as Array<Record<string, any>>,
  statements: [] as Array<{
    inTx: boolean
    kind: 'select' | 'insert' | 'execute'
    table?: string
    text: string
    params: unknown[]
    forUpdate: boolean
  }>,
  lockTail: new Map<string, Promise<void>>(),
  seq: 0,
}))

vi.mock('../src/db/index.js', async () => {
  const { PgDialect } = await import('drizzle-orm/pg-core')
  const schema = await import('@ihui/database')
  const dialect = new PgDialect()

  type Row = Record<string, any>
  type TableKey = 'records' | 'channels' | 'points'

  const TABLE_KEYS = new Map<unknown, TableKey>([
    [schema.eduPointRecords, 'records'],
    [schema.eduPointChannels, 'channels'],
    [schema.eduPoints, 'points'],
  ])

  const compile = (expr: unknown) => dialect.sqlToQuery(expr as never)
  const camel = (col: string) => col.replace(/_([a-z])/g, (_m, c: string) => c.toUpperCase())

  function tableOf(table: unknown): TableKey {
    const key = TABLE_KEYS.get(table)
    if (!key) throw new Error('fake-db: 未识别的表')
    return key
  }

  function rowsOf(name: TableKey): Row[] {
    if (name === 'records') return harness.records
    if (name === 'channels') return harness.channels
    return harness.points
  }

  function columnOf(expr: unknown): string {
    const name = (expr as { name?: unknown }).name
    if (typeof name === 'string' && name.length > 0) return camel(name)
    throw new Error('fake-db: 无法解析列表达式')
  }

  function project(row: Row, projection: Record<string, unknown>): Row {
    const out: Row = {}
    for (const [key, expr] of Object.entries(projection)) out[key] = row[columnOf(expr)]
    return out
  }

  /** where 谓词:编译后按 `"col" = $n` 抽取等值对(本用例只产生等值条件)。 */
  function matches(row: Row, cond: unknown): boolean {
    if (cond === undefined) return true
    const { sql: text, params } = compile(cond)
    const pairs = [...text.matchAll(/"(\w+)"\s*=\s*\$(\d+)/g)]
    if (pairs.length === 0) throw new Error(`fake-db: 无法解析 where ${text}`)
    return pairs.every(([, col, idx]) => row[camel(col!)] === params[Number(idx) - 1])
  }

  function orderOf(specs: unknown[]): Array<{ key: string; desc: boolean }> {
    return specs.map((spec) => {
      const { sql: text } = compile(spec)
      const m = /"(\w+)"\s+(asc|desc)/i.exec(text)
      if (!m) throw new Error(`fake-db: 无法解析 orderBy ${text}`)
      return { key: camel(m[1]!), desc: m[2]!.toLowerCase() === 'desc' }
    })
  }

  function compare(a: unknown, b: unknown): number {
    if (a instanceof Date || b instanceof Date) {
      return new Date(a as Date).getTime() - new Date(b as Date).getTime()
    }
    if (typeof a === 'string' && typeof b === 'string') return a < b ? -1 : a > b ? 1 : 0
    return Number(a) - Number(b)
  }

  function makeSelect(inTx: boolean, projection?: Record<string, unknown>) {
    let table: TableKey | undefined
    let cond: unknown
    let order: unknown[] = []
    let limit: number | undefined
    let forUpdate = false

    const run = (): Row[] => {
      if (!table) throw new Error('fake-db: select 缺 from')
      const where = cond === undefined ? { sql: '', params: [] as unknown[] } : compile(cond)
      harness.statements.push({
        inTx,
        kind: 'select',
        table,
        text: where.sql,
        params: where.params,
        forUpdate,
      })
      let rows = rowsOf(table).filter((row) => matches(row, cond))
      const specs = orderOf(order)
      if (specs.length > 0) {
        rows = [...rows].sort((a, b) => {
          for (const spec of specs) {
            const delta = compare(a[spec.key], b[spec.key])
            if (delta !== 0) return spec.desc ? -delta : delta
          }
          return 0
        })
      }
      if (limit !== undefined) rows = rows.slice(0, limit)
      return projection
        ? rows.map((row) => project(row, projection))
        : rows.map((row) => ({ ...row }))
    }

    const chain: any = {
      from(t: unknown) {
        table = tableOf(t)
        return chain
      },
      where(c: unknown) {
        cond = c
        return chain
      },
      orderBy(...specs: unknown[]) {
        order = specs
        return chain
      },
      limit(n: number) {
        limit = n
        return chain
      },
      for() {
        // 记录旧实现形态:流水 SELECT 若仍带 FOR UPDATE,用例②会变红。
        forUpdate = true
        return chain
      },
      then(resolve: (v: Row[]) => void, reject?: (e: unknown) => void) {
        return Promise.resolve().then(run).then(resolve, reject)
      },
    }
    return chain
  }

  function makeInsert(inTx: boolean, tableName: TableKey) {
    let values: Row = {}
    let inserted: Row[] | null = null

    const apply = (projection?: Record<string, unknown>): Row[] => {
      if (!inserted) {
        harness.seq += 1
        const row: Row = {
          id: crypto.randomUUID(),
          createdAt: new Date(BASE_TIME + harness.seq * 1000),
          ...values,
        }
        rowsOf(tableName).push(row)
        harness.statements.push({
          inTx,
          kind: 'insert',
          table: tableName,
          text: `insert into ${tableName}`,
          params: [],
          forUpdate: false,
        })
        inserted = [row]
      }
      return projection ? inserted.map((row) => project(row, projection)) : inserted
    }

    const chain: any = {
      values(v: Row) {
        values = v
        return chain
      },
      returning(projection?: Record<string, unknown>) {
        return Promise.resolve(apply(projection))
      },
      then(resolve: (v: Row[]) => void, reject?: (e: unknown) => void) {
        return Promise.resolve().then(() => apply()).then(resolve, reject)
      },
    }
    return chain
  }

  /** 事务级 advisory lock 的内存版:同键排队,事务结束释放。 */
  async function acquire(key: string): Promise<() => void> {
    const prev = harness.lockTail.get(key) ?? Promise.resolve()
    let release!: () => void
    const gate = new Promise<void>((resolve) => {
      release = resolve
    })
    harness.lockTail.set(
      key,
      prev.then(() => gate),
    )
    await prev
    return () => release()
  }

  function makeApi(inTx: boolean, releases: Array<() => void> | null) {
    const api: any = {
      select: (projection?: Record<string, unknown>) => makeSelect(inTx, projection),
      insert: (table: unknown) => makeInsert(inTx, tableOf(table)),
      async execute(expr: unknown) {
        const q = compile(expr)
        harness.statements.push({
          inTx,
          kind: 'execute',
          text: q.sql,
          params: q.params,
          forUpdate: false,
        })
        if (/pg_advisory_xact_lock/i.test(q.sql)) {
          const release = await acquire(String(q.params[0] ?? ''))
          releases?.push(release)
        }
        return []
      },
      async transaction(cb: (tx: unknown) => Promise<unknown>) {
        const txReleases: Array<() => void> = []
        const tx = makeApi(true, txReleases)
        try {
          return await cb(tx)
        } finally {
          for (const release of txReleases.reverse()) release()
        }
      },
    }
    return api
  }

  const api = makeApi(false, null)
  return { db: api, dbRead: api }
})

import {
  increasePoints,
  decreasePoints,
  fallbackPoints,
  awardFirstSharePoints,
  awardAdPoints,
} from '../src/db/point-queries.js'

const MEMBER = '11111111-1111-4111-8111-111111111111'
const CHANNEL = '22222222-2222-4222-8222-222222222222'
const POINT = '33333333-3333-4333-8333-333333333333'

function seedRecord(memberId: string, point: number): string {
  const row = {
    id: crypto.randomUUID(),
    memberId,
    point,
    balance: point,
    type: 'increase',
    description: null,
    refId: null,
    createdAt: new Date(BASE_TIME),
  }
  harness.records.push(row)
  return row.id
}

function adjustInput(amount: number) {
  return { memberId: MEMBER, channelId: CHANNEL, pointId: POINT, amount }
}

beforeEach(() => {
  harness.records.length = 0
  harness.channels.length = 0
  harness.points.length = 0
  harness.statements.length = 0
  harness.lockTail.clear()
  harness.seq = 0
  harness.channels.push({ id: CHANNEL, name: '默认渠道', status: 1 })
  harness.points.push({ id: POINT, name: '默认规则', status: 1 })
})

describe('F-11 教育积分账本按会员串行化', () => {
  it('①四个事务入口都先取会员级 advisory lock,②流水 SELECT 不再带 FOR UPDATE', async () => {
    const cases: Array<[string, string, () => Promise<unknown>]> = [
      ['increasePoints', MEMBER, () => increasePoints(adjustInput(10))],
      [
        'decreasePoints',
        MEMBER,
        () => {
          seedRecord(MEMBER, 50)
          return decreasePoints(adjustInput(10))
        },
      ],
      [
        'fallbackPoints',
        MEMBER,
        () => {
          const recordId = seedRecord(MEMBER, 10)
          return fallbackPoints(recordId)
        },
      ],
      ['awardFirstSharePoints', MEMBER, () => awardFirstSharePoints(MEMBER, 10)],
      ['awardAdPoints', MEMBER, () => awardAdPoints(MEMBER, 10, 'ad', 'ref-1')],
    ]

    for (const [name, memberId, run] of cases) {
      harness.records.length = 0
      harness.statements.length = 0

      const result = await run()
      expect(result, name).toBeTruthy()

      const txStatements = harness.statements.filter((s) => s.inTx)
      expect(txStatements.length, name).toBeGreaterThan(0)

      const lock = txStatements[0]!
      expect(lock.kind, name).toBe('execute')
      expect(lock.text, name).toContain('pg_advisory_xact_lock')
      expect(lock.text, name).toContain('hashtext($1)')
      expect(lock.params[0], name).toBe(`edu_point_ledger:${memberId}`)

      const recordSelects = harness.statements.filter(
        (s) => s.table === 'records' && s.kind === 'select',
      )
      expect(recordSelects.length, name).toBeGreaterThan(0)
      expect(
        recordSelects.some((s) => s.forUpdate),
        `${name}:流水 SELECT 不得再以 FOR UPDATE 锁上一行`,
      ).toBe(false)

      const lockIndex = harness.statements.indexOf(lock)
      // 事务外的 findRecordById 允许先读原记录;锁必须先于事务内的流水读取。
      const firstRecordReadInTx = harness.statements.findIndex(
        (s) => s.inTx && s.table === 'records' && s.kind === 'select',
      )
      expect(lockIndex, name).toBeLessThan(firstRecordReadInTx)
    }
  })

  it('③顺序调用余额累加正确,beforeBalance 恒等于上次 afterBalance', async () => {
    const balances: number[] = []
    const first = await increasePoints(adjustInput(10))
    expect(first.beforeBalance).toBe(0)
    expect(first.afterBalance).toBe(10)
    balances.push(first.afterBalance)

    const second = await increasePoints(adjustInput(5))
    expect(second.beforeBalance).toBe(balances.at(-1))
    expect(second.afterBalance).toBe(15)
    balances.push(second.afterBalance)

    const third = await decreasePoints(adjustInput(3))
    expect(third.beforeBalance).toBe(balances.at(-1))
    expect(third.afterBalance).toBe(12)
    balances.push(third.afterBalance)

    const ad = await awardAdPoints(MEMBER, 7, 'ad reward', 'ref-ad')
    expect(ad.beforeBalance).toBe(balances.at(-1))
    expect(ad.afterBalance).toBe(19)
    balances.push(ad.afterBalance)

    const share = await awardFirstSharePoints(MEMBER, 2)
    expect(share.beforeBalance).toBe(balances.at(-1))
    expect(share.afterBalance).toBe(21)
    balances.push(share.afterBalance)

    const fallback = await fallbackPoints(first.record.id)
    expect(fallback.beforeBalance).toBe(balances.at(-1))
    expect(fallback.afterBalance).toBe(11)
    expect(fallback.record.type).toBe('fallback')
    expect(fallback.record.refId).toBe(first.record.id)
  })

  it('④同会员并发追加被 advisory lock 串行化,余额不丢更新', async () => {
    await Promise.all([
      awardAdPoints(MEMBER, 10, 'ad-a', 'ref-a'),
      awardAdPoints(MEMBER, 5, 'ad-b', 'ref-b'),
    ])

    const latest = [...harness.records].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    )[0]
    expect(latest?.balance).toBe(15)
    expect(
      harness.records.map((r) => r.balance).sort((a, b) => a - b),
    ).toEqual([10, 15])
  })
})
