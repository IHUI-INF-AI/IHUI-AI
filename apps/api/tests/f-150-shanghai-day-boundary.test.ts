// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * F-150 企业学习报表 UTC 切日 + endDate 丢最后一天 的回归测试(2026-11-13 立)。
 *
 * 判据不复制(§22c):走生产 findCompanyStudyReport，用 Drizzle PgDialect 把 where/
 * groupBy 编译成真实 SQL 断言四条:
 *  ① 下界 = 上海日 00:00(`::timestamp AT TIME ZONE`，>= 闭) —— 不再把 UTC 0-8 点报名归前一天
 *  ② 上界 = 次月日 00:00(`<` 开) —— 不再 `<= endDate::timestamptz`(当日 00:00)丢最后一天
 *  ③ 趋势聚合键 = to_char(... AT TIME ZONE 'Asia/Shanghai')(不再会话时区 ::date)
 *  ④ 不传日期 ⇒ 不加时间谓词(口径不变,阳性对照)
 * 桩面: db 收集器只记录查询形状并回空集,不连生产库(§5 测试隔离铁律)。
 */
import { describe, it, beforeEach, expect, vi } from 'vitest'
import { PgDialect } from 'drizzle-orm/pg-core'

const h = vi.hoisted(() => {
  process.env.DATABASE_URL ??= 'postgresql://test:test@localhost:5432/test'
  process.env.JWT_SECRET ??= 'test-jwt-secret-for-vitest-at-least-32-chars'
  process.env.NODE_ENV = 'test'
  return {
    queries: [] as Array<{
      label: string
      whereSql: string
      whereParams: unknown[]
      extraSql: string
    }>,
  }
})

vi.mock('../src/db/index.js', () => {
  const dialect = new PgDialect()
  const compile = (cond: unknown) => {
    try {
      const q = dialect.sqlToQuery(cond as never)
      return { sql: q.sql, params: q.params as unknown[] }
    } catch {
      return { sql: '', params: [] }
    }
  }
  interface Captured {
    label: string
    where?: unknown
    groupSql?: unknown
    orderSql?: unknown
  }
  const finish = (st: Captured) => {
    const w = st.where ? compile(st.where) : { sql: '', params: [] as unknown[] }
    const g = st.groupSql ? compile(st.groupSql).sql : ''
    const o = st.orderSql ? compile(st.orderSql).sql : ''
    h.queries.push({
      label: st.label,
      whereSql: w.sql,
      whereParams: w.params,
      extraSql: `${g} ${o}`,
    })
    return st.label === 'trend'
      ? Promise.resolve([])
      : Promise.resolve([
          {
            totalLessons: 0,
            totalSignups: 0,
            completedCount: 0,
            activeCount: 0,
            refundedCount: 0,
            avgProgress: 0,
            activeMembers: 0,
          },
        ])
  }
  const makeQ = (st: Captured): any => {
    const q: any = {}
    const pass = () => makeQ(st)
    q.from = pass
    q.innerJoin = pass
    q.leftJoin = pass
    q.where = (c: unknown) => {
      if (st.where === undefined) st.where = c
      const next = makeQ(st)
      // rows 链 with→groupBy 或直接结束(trend), summary 链 with→limit? 统一 thenable
      next.then = (f?: any) => finish(st).then(f)
      next.catch = (f: any) => finish(st).catch(f)
      next.finally = (f: any) => finish(st).finally(f)
      return next
    }
    q.groupBy = (g: unknown) => {
      if (st.groupSql === undefined) st.groupSql = g
      const next = makeQ(st)
      next.orderBy = (o: unknown) => {
        if (st.orderSql === undefined) st.orderSql = o
        return next
      }
      next.limit = () => finish(st)
      next.then = (f: any) => finish(st).then(f)
      return next
    }
    q.orderBy = (o: unknown) => {
      if (st.orderSql === undefined) st.orderSql = o
      return next_(st)
    }
    const next_ = (s: Captured) => {
      const n: any = makeQ(s)
      return n
    }
    q.limit = () => finish(st)
    q.then = (f: any) => finish(st).then(f)
    q.catch = (f: any) => finish(st).catch(f)
    return q
  }
  let seq = 0
  const db = {
    select: () => {
      const label = seq++ % 2 === 0 ? 'rows' : 'trend'
      return makeQ({ label } as Captured)
    },
  }
  return { db, dbRead: db, dbClient: {} }
})

import { findCompanyStudyReport } from '../src/db/learn-extended-queries.js'

describe('F-150 — 企业学习报表上海业务日口径', () => {
  beforeEach(() => {
    h.queries.length = 0
  })

  const shanghaiBoundarySql = /AT TIME ZONE 'Asia\/Shanghai'/

  it('传 startDate/endDate ⇒ WHERE 含"上海 00:00 闭下界 + 次日 00:00 开上界",参数=原始日期串', async () => {
    await findCompanyStudyReport({ startDate: '2026-10-01', endDate: '2026-10-31' })
    expect(h.queries.length).toBeGreaterThanOrEqual(1)
    const q = h.queries[0]
    expect(q.whereSql).toMatch(/>=/)
    expect(q.whereSql).toMatch(shanghaiBoundarySql)
    // 上界必须是 `<`(开区间到次日 00:00),绝不残留 `<= endDate::timestamptz`
    expect(q.whereSql).toMatch(/</)
    expect(q.whereSql).not.toMatch(/<= \$\d+::timestamptz/)
    expect(q.whereParams).toContain('2026-10-01')
    expect(q.whereParams).toContain('2026-10-31')
  })

  it('趋势聚合键按上海日切(不再会话时区 ::date)', async () => {
    await findCompanyStudyReport({ startDate: '2026-10-01', endDate: '2026-10-31' })
    const trend = h.queries.find((x) => x.label === 'trend')
    expect(trend).toBeDefined()
    expect(trend!.extraSql).toMatch(/to_char\(.*AT TIME ZONE 'Asia\/Shanghai'/)
    expect(trend!.extraSql).not.toMatch(/::date/)
  })

  it('不传日期 ⇒ 两条查询 WHERE 都不含时间谓词(阳性对照,口径不变)', async () => {
    await findCompanyStudyReport({})
    expect(h.queries.length).toBe(1) // 无日期不跑趋势
    expect(h.queries[0].whereSql).not.toMatch(/AT TIME ZONE/)
    expect(h.queries[0].whereSql).not.toMatch(/created_at >= \$\d+::/i)
  })

  it('趋势与汇总共享同一时间口径(F-149 唯一口径不回归)', async () => {
    await findCompanyStudyReport({ startDate: '2026-10-01', endDate: '2026-10-31' })
    const rows = h.queries.find((x) => x.label === 'rows')
    const trend = h.queries.find((x) => x.label === 'trend')
    expect(rows!.whereSql).toBe(trend!.whereSql)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
