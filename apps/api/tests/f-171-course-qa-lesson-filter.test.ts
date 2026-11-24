// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * F-171 课程问答先全站分页再内存过滤(分页/total 双失真)的回归测试(2026-11-13 立)。
 *
 * 判据不复制(§22c):走生产 findAllCommunityPosts，用 Drizzle 自带 pg 方言把
 * where 条件编译成真实 SQL —— 断言 lessonId/status/search **三条都进 WHERE**，
 * 且分页行查询与 count 查询共享同一 where 对象(同口径)。
 * 不连生产库:db 桩只收集查询形状与 where，不执行 SQL(§5 测试隔离铁律)。
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { PgDialect } from 'drizzle-orm/pg-core'

const h = vi.hoisted(() => {
  process.env.DATABASE_URL ??= 'postgresql://test:test@localhost:5432/test'
  process.env.JWT_SECRET ??= 'test-jwt-secret-for-vitest-at-least-32-chars'
  process.env.NODE_ENV = 'test'
  return {
    /** 每次 select 查询捕获的 where 参数与 SQL */
    queries: [] as Array<{ label: 'rows' | 'count'; whereSql: string; whereParams: unknown[] }>,
    selectCount: 0,
    /** 用例 4:桩行的覆盖返回(createdAt 为 Date,与真库 postgres 返回同形) */
    rowsOverride: undefined as unknown[] | undefined,
    countOverride: undefined as number | undefined,
  }
})

vi.mock('../src/db/index.js', async () => {
  const dialect = new PgDialect()
  interface QState {
    where?: unknown
    finalized: boolean
  }
  const record = (state: QState, label: 'rows' | 'count') => {
    if (state.finalized) {
      return Promise.resolve(
        label === 'count' ? [{ count: h.countOverride ?? 0 }] : (h.rowsOverride ?? []),
      )
    }
    state.finalized = true
    let whereSql = ''
    const whereParams: unknown[] = []
    if (state.where) {
      const sqlObj = dialect.sqlToQuery(state.where as any)
      whereSql = sqlObj.sql
      whereParams.push(...sqlObj.params)
    }
    h.queries.push({ label, whereSql, whereParams })
    return Promise.resolve(
      label === 'count' ? [{ count: h.countOverride ?? 0 }] : (h.rowsOverride ?? []),
    )
  }
  const makeQ = (state: QState, label: 'rows' | 'count'): any => {
    const q: any = {}
    const passthrough = () => makeQ(state, label)
    q.from = passthrough
    q.innerJoin = passthrough
    q.leftJoin = passthrough
    q.groupBy = passthrough
    q.orderBy = () => {
      // rows 链: ...where(cond).orderBy(...).limit(n).offset(m)
      if (label === 'rows') return makeQ(state, 'rows')
      return record(state, label)
    }
    q.where = (cond: unknown) => {
      state.where = cond
      // 返回同一个 q(保留 label 语义): rows 继续 orderBy, count 以 thenable 收尾
      const next = makeQ(state, label)
      if (label === 'count') {
        next.then = (f?: any) => record(state, 'count').then(f)
        next.catch = (f: any) => record(state, 'count').catch(f)
        next.finally = (f: any) => record(state, 'count').finally(f)
      }
      return next
    }
    q.limit = (n?: number) => {
      void n
      if (label === 'rows') {
        const next = makeQ(state, label)
        next.then = (f?: any) => record(state, 'rows').then(f)
        next.catch = (f: any) => record(state, 'rows').catch(f)
        next.finally = (f: any) => record(state, 'rows').finally(f)
        return next
      }
      return record(state, label)
    }
    q.offset = () => record(state, 'rows')
    q.execute = () => record(state, label)
    q.then = (f?: any) => record(state, label).then(f)
    q.catch = (f: any) => record(state, label).catch(f)
    q.finally = (f: any) => record(state, label).finally(f)
    return q
  }
  const db = {
    select: () => {
      // 生产 findAllCommunityPosts 每个用例恰好发 2 条查询: 第 1 条 rows、第 2 条 count(按调用序分诊)
      const label: 'rows' | 'count' = h.selectCount % 2 === 0 ? 'rows' : 'count'
      h.selectCount++
      const state: QState = { finalized: false, where: undefined }
      return makeQ(state, label)
    },
  }
  return { db, dbRead: db, dbClient: {} }
})

// 本路由 preHandler 调 checkAuth ⇒ 桩放行并注入 userId(机制与本票无关)
vi.mock('../src/plugins/auth.js', () => ({
  checkAuth: async (request: { userId?: string }): Promise<boolean> => {
    request.userId ??= 'u1'
    return true
  },
}))

import { findAllCommunityPosts } from '../src/db/learn-extended-queries.js'

describe('F-171 — findAllCommunityPosts 的 lessonId 下推 WHERE', () => {
  beforeEach(() => {
    h.queries.length = 0
    h.selectCount = 0
  })

  it('传 lessonId ⇒ rows 与 count 两条 SQL 的 WHERE 都含 lesson_id 谓词', async () => {
    await findAllCommunityPosts({
      page: 1,
      pageSize: 20,
      status: 'published',
      lessonId: 'bbbbbbbb-1111-4111-8111-111111111111',
    })
    expect(h.queries).toHaveLength(2)
    const [rows, count] = h.queries
    expect(rows.label).toBe('rows')
    expect(count.label).toBe('count')
    for (const q of [rows, count]) {
      expect(q.whereSql).toMatch(/lesson_id/)
      expect(q.whereSql).toMatch(/status/)
      expect(q.whereParams).toContain('bbbbbbbb-1111-4111-8111-111111111111')
      expect(q.whereParams).toContain('published')
    }
  })

  it('不传 lessonId ⇒ WHERE 不含 lesson_id(全站社区列表口径不受影响)', async () => {
    await findAllCommunityPosts({ page: 2, pageSize: 10, status: 'published' })
    expect(h.queries).toHaveLength(2)
    for (const q of h.queries) {
      expect(q.whereSql).not.toMatch(/lesson_id/)
      expect(q.whereSql).toMatch(/status/)
    }
  })

  it('search + lessonId 同传 ⇒ 三条谓词共存(SQL 真 AND,不是调用方再 filter)', async () => {
    await findAllCommunityPosts({
      page: 1,
      pageSize: 20,
      search: 'python',
      status: 'published',
      lessonId: 'cccccccc-1111-4111-8111-111111111111',
    })
    for (const q of h.queries) {
      expect(q.whereSql).toMatch(/title.{0,4}ilike/i)
      expect(q.whereSql).toMatch(/lesson_id/)
      expect(q.whereSql).toMatch(/status/)
      expect(q.whereParams).toContain('%python%')
    }
  })

  it('路由面回归:GET /edu/courses/:id/qa 不再做内存 filter —— 结果 list 原样透传、total 取查询值', async () => {
    // 行为面:桩查询返回 3 条本课帖子 + total=57(旧缺陷形态 total 只会是 filtered.length≤pageSize)
    h.rowsOverride = [
      {
        id: 'p1',
        userId: 'u1',
        userName: null,
        lessonId: 'dddddddd-1111-4111-8111-111111111111',
        lessonTitle: null,
        title: 't1',
        content: null,
        isPinned: false,
        status: 'published',
        replyCount: 0,
        viewCount: 0,
        createdAt: new Date('2026-01-01T00:00:00Z'),
      },
      {
        id: 'p2',
        userId: 'u1',
        userName: null,
        lessonId: 'dddddddd-1111-4111-8111-111111111111',
        lessonTitle: null,
        title: 't2',
        content: null,
        isPinned: false,
        status: 'published',
        replyCount: 1,
        viewCount: 2,
        createdAt: new Date('2026-01-02T00:00:00Z'),
      },
      {
        id: 'p3',
        userId: 'u1',
        userName: null,
        lessonId: 'dddddddd-1111-4111-8111-111111111111',
        lessonTitle: null,
        title: 't3',
        content: '有正文',
        isPinned: true,
        status: 'published',
        replyCount: 1,
        viewCount: 2,
        createdAt: new Date('2026-01-03T00:00:00Z'),
      },
    ]
    h.countOverride = 57
    try {
      const { default: Fastify } = await import('fastify')
      const { eduFrontendRoutes } = await import('../src/routes/edu-frontend-routes.js')
      const app = Fastify({ logger: false })
      // 本路由 handler 读 request.userId ⇒ preHandler 注入(与鉴权链无关,同 admin-relay-key-pool-put 形态)
      app.addHook('onRequest', async (req) => {
        ;(req as any).userId ??= 'u1'
      })
      await app.register(eduFrontendRoutes)
      await app.ready()
      const res = await app.inject({
        method: 'GET',
        url: '/edu/courses/dddddddd-1111-4111-8111-111111111111/qa?page=1&pageSize=3',
      })
      expect(res.statusCode).toBe(200)
      const body = res.json()
      // 57 必须原样透出；list 三条同课帖子不得被内存 filter 误杀(修复前正是这两处失真)
      expect(body.data.total).toBe(57)
      expect(body.data.list).toHaveLength(3)
      // 路由下推面: rows WHERE 含 lesson_id,参数含本课 id(修复前 WHERE 只有 status)
      const rowsQ = h.queries.find((q) => q.label === 'rows')
      expect(rowsQ?.whereSql).toMatch(/lesson_id/)
      expect(rowsQ?.whereParams).toContain('dddddddd-1111-4111-8111-111111111111')
      await app.close()
    } finally {
      h.rowsOverride = undefined
      h.countOverride = undefined
    }
  })
})

// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
