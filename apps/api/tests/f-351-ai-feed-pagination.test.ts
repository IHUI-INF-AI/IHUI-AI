// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * F-351 回归锁(2026-11-13)。
 *
 * 病灶:listFeedItems 在 ai_feed_hot_item 为空时 fallback 到 ai_world_items,
 * fallback 只 .limit() 无 .offset(),且 total 取 fallback.length ⇒ 第 2 页起重复第 1 页;
 * 主查询 orderBy(lastSeenAt, currentHot) 无稳定 tie-breaker,批量 upsert 同毫秒时翻页重复/漏条。
 *
 * 本文件锁:
 *   ① 空表 fallback 第 1/2 页带不同 offset、结果不同,且 total 为独立 count(非当前页条数);
 *   ② 主查询 orderBy 含 id desc tie-breaker;
 *   ③ 同 lastSeenAt/currentHot 的多条按 id 稳定排序,翻页不重复。
 *
 * 用内存假 DB 模拟 WHERE / ORDER BY / LIMIT / OFFSET 的 SQL 语义,不触达真实 PG。
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

const state = vi.hoisted(() => {
  process.env.DATABASE_URL ??= 'postgresql://test:test@localhost:5432/test'
  process.env.JWT_SECRET ??= 'test-jwt-secret-for-vitest-at-least-32-chars'
  process.env.NODE_ENV = 'test'
  process.env.AI_SERVICE_URL = 'http://ai-service.test'
  return {
    feedRows: [] as Array<Record<string, unknown>>,
    worldRows: [] as Array<Record<string, unknown>>,
    /** 每次 orderBy 调用的表与渲染后 SQL,供断言 tie-breaker */
    orderBys: [] as Array<{ table: string; sql: string }>,
    /** 每次查询的表、limit、offset,供断言 fallback 是否真正分页 */
    queries: [] as Array<{ table: string; limit: number | undefined; offset: number | undefined }>,
  }
})

vi.mock('../src/db/index.js', async () => {
  const { PgDialect } = await import('drizzle-orm/pg-core')
  const dialect = new PgDialect()
  const nameSymbol = Symbol.for('drizzle:Name')

  const tableName = (t: unknown): string => String((t as Record<symbol, unknown>)[nameSymbol] ?? '')

  const camel = (col: string): string => col.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase())

  const renderSql = (expr: unknown): string => dialect.sqlToQuery(expr as never).sql

  /** 只模拟本用例出现的等值 WHERE(and(eq, eq))。 */
  const matchesWhere = (cond: unknown, row: Record<string, unknown>): boolean => {
    if (cond === undefined || cond === null) return true
    const q = dialect.sqlToQuery(cond as never)
    const re = /"([a-z_]+)"\s*=\s*\$(\d+)/gi
    let m: RegExpExecArray | null
    while ((m = re.exec(q.sql))) {
      const key = camel(m[1])
      if (row[key] !== q.params[Number(m[2]) - 1]) return false
    }
    return true
  }

  /** 把 orderBy 表达式解析为列+方向,并按 PostgreSQL 语义排序。 */
  const sortRows = (rows: Array<Record<string, unknown>>, exprs: unknown[]) => {
    const terms: Array<{ col: string; dir: 'asc' | 'desc' }> = []
    for (const expr of exprs) {
      const re = /"([a-z_]+)"\s+(asc|desc)/gi
      let m: RegExpExecArray | null
      const sqlText = renderSql(expr)
      while ((m = re.exec(sqlText))) {
        terms.push({ col: camel(m[1]), dir: m[2].toLowerCase() as 'asc' | 'desc' })
      }
    }
    const norm = (v: unknown): unknown => (v instanceof Date ? v.getTime() : v)
    return [...rows].sort((a, b) => {
      for (const { col, dir } of terms) {
        const av = norm(a[col])
        const bv = norm(b[col])
        if (av === bv) continue
        const aNull = av === null || av === undefined
        const bNull = bv === null || bv === undefined
        if (aNull || bNull) {
          if (aNull && bNull) continue
          // PG 默认:desc → NULLS FIRST,asc → NULLS LAST
          return (aNull ? -1 : 1) * (dir === 'desc' ? 1 : -1)
        }
        const cmp = (av as number) < (bv as number) ? -1 : (av as number) > (bv as number) ? 1 : 0
        return dir === 'desc' ? -cmp : cmp
      }
      return 0
    })
  }

  const chainSelect = (selected?: Record<string, unknown>) => {
    let table = ''
    let projection: Record<string, unknown> | undefined = selected
    let whereCond: unknown
    let orderExprs: unknown[] = []
    let limitN: number | undefined
    let offsetN: number | undefined

    const execute = (): unknown => {
      const rows = table === 'ai_world_items' ? state.worldRows : state.feedRows
      const filtered = rows.filter((r) => matchesWhere(whereCond, r))
      if (projection && Object.prototype.hasOwnProperty.call(projection, 'count')) {
        return [{ count: filtered.length }]
      }
      const sorted = sortRows(filtered, orderExprs)
      const start = offsetN ?? 0
      const end = limitN === undefined ? undefined : start + limitN
      return sorted.slice(start, end).map((r) => ({ ...r }))
    }

    const step: Record<string, unknown> = {}
    step.select = (p?: Record<string, unknown>) => {
      projection = p
      return step
    }
    step.from = (t: unknown) => {
      table = tableName(t)
      return step
    }
    step.where = (c: unknown) => {
      whereCond = c
      return step
    }
    step.orderBy = (...exprs: unknown[]) => {
      orderExprs = exprs
      state.orderBys.push({ table, sql: exprs.map((e) => renderSql(e)).join(', ') })
      return step
    }
    step.limit = (n: number) => {
      limitN = n
      return step
    }
    step.offset = (n: number) => {
      offsetN = n
      state.queries.push({ table, limit: limitN, offset: offsetN })
      return step
    }
    step.then = (resolve: (v: unknown) => void, reject?: (e: unknown) => void) =>
      Promise.resolve(execute()).then(resolve, reject)
    step.catch = (reject?: (e: unknown) => void) => Promise.resolve(execute()).catch(reject)
    return step
  }

  return { db: { select: chainSelect }, dbRead: { select: chainSelect }, dbClient: {} }
})

import { listFeedItems } from '../src/services/ai-feed-service.js'

const feedRow = (id: string, overrides: Record<string, unknown> = {}): Record<string, unknown> => ({
  id,
  sourceCode: 'hackernews',
  platformItemId: `p-${id}`,
  title: `title-${id}`,
  summary: null,
  url: null,
  coverUrl: null,
  author: null,
  currentRank: null,
  currentHot: 100,
  publishTime: null,
  firstSeenAt: new Date('2026-11-13T00:00:00.000Z'),
  lastSeenAt: new Date('2026-11-13T00:00:00.000Z'),
  llmCategory: null,
  llmTags: null,
  llmSummary: null,
  llmProcessedAt: null,
  trendTag: null,
  trendGrowthPct: null,
  titleEn: null,
  titleJa: null,
  titleKo: null,
  createdAt: new Date('2026-11-13T00:00:00.000Z'),
  updatedAt: new Date('2026-11-13T00:00:00.000Z'),
  ...overrides,
})

const worldRow = (n: number, overrides: Record<string, unknown> = {}): Record<string, unknown> => {
  const id = `00000000-0000-4000-8000-00000000000${n}`
  return {
    id,
    kind: 'news',
    title: `world-${n}`,
    summary: null,
    url: null,
    coverUrl: null,
    source: 'aiworld',
    publishedAt: new Date(`2026-11-0${n}T00:00:00.000Z`),
    fetchedAt: new Date(`2026-11-0${n}T00:00:00.000Z`),
    trendingScore: n * 10,
    status: 1,
    ...overrides,
  }
}

beforeEach(() => {
  state.feedRows = []
  state.worldRows = []
  state.orderBys = []
  state.queries = []
})

describe('F-351 ai-feed 分页', () => {
  it('① 空表 fallback 分页带 offset,结果不同且 total 为独立 count', async () => {
    state.feedRows = []
    state.worldRows = [1, 2, 3, 4, 5].map((n) => worldRow(n))

    const p1 = await listFeedItems({ page: 1, pageSize: 2 })
    const p2 = await listFeedItems({ page: 2, pageSize: 3 })

    expect(p1.list.map((i) => i.id)).toEqual([
      '00000000-0000-4000-8000-000000000005',
      '00000000-0000-4000-8000-000000000004',
    ])
    expect(p2.list.map((i) => i.id)).toEqual([
      '00000000-0000-4000-8000-000000000002',
      '00000000-0000-4000-8000-000000000001',
    ])
    // 两页互不重叠
    const ids = [...p1.list, ...p2.list].map((i) => i.id)
    expect(new Set(ids).size).toBe(ids.length)
    // total 是表内总条数,不是当前页条数
    expect(p1.total).toBe(5)
    expect(p2.total).toBe(5)
    expect(p1.total).not.toBe(p1.list.length)
    // fallback 查询确实按页带 offset(page=2,pageSize=3 → offset 3)
    const worldPage2 = state.queries.find((q) => q.table === 'ai_world_items' && q.offset === 3)
    expect(worldPage2).toBeTruthy()
    expect(worldPage2?.limit).toBe(3)
  })

  it('② 主查询 orderBy 含 id desc tie-breaker', async () => {
    state.feedRows = [feedRow('00000000-0000-4000-8000-00000000000a')]

    await listFeedItems({ page: 1, pageSize: 10 })

    const feedOrder = state.orderBys.find((o) => o.table === 'ai_feed_hot_item')
    expect(feedOrder).toBeTruthy()
    expect(feedOrder?.sql).toMatch(/"last_seen_at"\s+desc/i)
    expect(feedOrder?.sql).toMatch(/"current_hot"\s+desc/i)
    expect(feedOrder?.sql).toMatch(/"id"\s+desc/i)
  })

  it('③ 同 lastSeenAt 多条按 id 稳定排序,翻页不重复', async () => {
    const same = new Date('2026-11-13T00:00:00.000Z')
    state.feedRows = ['a', 'b', 'c', 'd', 'e'].map((suffix) =>
      feedRow(`00000000-0000-4000-8000-00000000000${suffix}`, { lastSeenAt: same }),
    )

    const p1 = await listFeedItems({ page: 1, pageSize: 2 })
    const p2 = await listFeedItems({ page: 2, pageSize: 2 })
    const p3 = await listFeedItems({ page: 3, pageSize: 2 })

    const ids = [...p1.list, ...p2.list, ...p3.list].map((i) => i.id)
    expect(ids).toEqual([
      '00000000-0000-4000-8000-00000000000e',
      '00000000-0000-4000-8000-00000000000d',
      '00000000-0000-4000-8000-00000000000c',
      '00000000-0000-4000-8000-00000000000b',
      '00000000-0000-4000-8000-00000000000a',
    ])
    expect(new Set(ids).size).toBe(5)
    expect(p3.total).toBe(5)
  })
})
