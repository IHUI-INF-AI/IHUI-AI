// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * F-173 回归锁(2026-11-13)。
 *
 * 病灶:公开 GET /api/help/articles 只按 category 查询,未过滤 isPublished,
 * 草稿文章(含正文)可被匿名读取;而公开详情接口却对草稿返回 404,两条读路径口径不一致。
 *
 * 本文件锁:
 *   ① 公开列表的 SQL 条件必须含 is_published = true;
 *   ② 公开详情(按 slug)读草稿 → 404,且不自增 viewCount;
 *   ③ 管理端列表不加发布过滤、按 id 的写路径仍能读到草稿;
 *   ④ 已发布文章的公开列表/详情读取正常。
 *
 * 只 mock auth / require-permission / db,不连接真实 PG。
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import Fastify, { type FastifyInstance } from 'fastify'
import { PgDialect } from 'drizzle-orm/pg-core'
import type { SQL } from 'drizzle-orm'

vi.mock('../src/plugins/auth.js', () => ({
  authenticate: vi.fn(async () => {}),
}))

vi.mock('../src/plugins/require-permission.js', () => ({
  requireAdmin: vi.fn(async () => {}),
}))

vi.mock('../src/db/index.js', () => ({
  db: { select: vi.fn(), insert: vi.fn(), update: vi.fn(), delete: vi.fn() },
  dbRead: { select: vi.fn() },
  dbClient: {},
}))

import { db, dbRead } from '../src/db/index.js'
import { adminContentRoutes, contentRoutes } from '../src/routes/content.js'

type Row = Record<string, unknown>

/**
 * 极简 drizzle 查询器替身:支持链式 from/set/values/where/orderBy/limit,
 * 可被 await(thenable),并把 where 谓词收集到 whereSink 供 SQL 断言。
 */
function createBuilder(rows: Row[], whereSink: unknown[]) {
  const builder = {
    from: () => builder,
    set: () => builder,
    values: () => builder,
    onConflictDoNothing: () => builder,
    where: (cond: unknown) => {
      whereSink.push(cond)
      return builder
    },
    orderBy: () => builder,
    limit: () => builder,
    returning: () => Promise.resolve(rows),
    then: (onFulfilled?: (value: Row[]) => unknown, onRejected?: (reason: unknown) => unknown) =>
      Promise.resolve(rows).then(onFulfilled, onRejected),
  }
  return builder
}

const DRAFT_ID = '11111111-1111-4111-8111-111111111111'
const PUB_ID = '22222222-2222-4222-8222-222222222222'

const draftArticle: Row = {
  id: DRAFT_ID,
  category: 'account',
  title: '草稿文章',
  slug: 'draft-article',
  content: '草稿机密正文',
  sortOrder: 0,
  isPublished: false,
  viewCount: 0,
  createdAt: new Date('2026-11-01T00:00:00Z'),
  updatedAt: new Date('2026-11-01T00:00:00Z'),
}

const publishedArticle: Row = {
  ...draftArticle,
  id: PUB_ID,
  title: '已发布文章',
  slug: 'published-article',
  content: '公开正文',
  isPublished: true,
}

describe('F-173 公开帮助文章读路径必须只返回已发布', () => {
  let app: FastifyInstance
  let selectRows: Row[][] = []
  let updateRows: Row[][] = []
  let selectWheres: unknown[] = []

  const dialect = new PgDialect()

  const renderWhere = (cond: unknown): { sql: string; params: unknown[] } =>
    dialect.sqlToQuery(cond as SQL)

  beforeAll(async () => {
    app = Fastify({ logger: false })
    await app.register(contentRoutes, { prefix: '/api' })
    await app.register(adminContentRoutes, { prefix: '/api/admin' })
    await app.ready()
  })

  afterAll(async () => {
    await app.close()
  })

  beforeEach(() => {
    selectRows = []
    updateRows = []
    selectWheres = []
    vi.mocked(dbRead.select).mockReset()
    vi.mocked(dbRead.select).mockImplementation(() => {
      const rows = selectRows.shift() ?? []
      return createBuilder(rows, selectWheres) as never
    })
    vi.mocked(db.update).mockReset()
    vi.mocked(db.update).mockImplementation(() => {
      const rows = updateRows.shift() ?? []
      return createBuilder(rows, []) as never
    })
  })

  const enqueueSelect = (...batches: Row[][]) => {
    selectRows.push(...batches)
  }

  it('① 公开列表 SQL 条件含 is_published = true(带 category 时叠加)', async () => {
    enqueueSelect([publishedArticle])
    const res = await app.inject({
      method: 'GET',
      url: '/api/help/articles?category=account',
    })
    expect(res.statusCode).toBe(200)
    expect((res.json() as { data: { list: Row[] } }).data.list).toHaveLength(1)

    expect(selectWheres).toHaveLength(1)
    const filtered = renderWhere(selectWheres[0])
    expect(filtered.sql).toContain('"help_articles"."is_published"')
    expect(filtered.params).toContain(true)

    // 不带 category 时同样必须带发布过滤
    enqueueSelect([publishedArticle])
    const resNoCategory = await app.inject({ method: 'GET', url: '/api/help/articles' })
    expect(resNoCategory.statusCode).toBe(200)
    expect(selectWheres).toHaveLength(2)
    const plain = renderWhere(selectWheres[1])
    expect(plain.sql).toContain('"help_articles"."is_published"')
    expect(plain.params).toContain(true)
  })

  it('② 公开详情按 slug 读草稿 → 404,且不自增 viewCount', async () => {
    enqueueSelect([draftArticle])
    const res = await app.inject({
      method: 'GET',
      url: '/api/help/articles/draft-article',
    })
    expect(res.statusCode).toBe(404)
    expect((res.json() as { message: string }).message).toBe('文章不存在')
    expect(res.body).not.toContain('草稿机密正文')
    expect(vi.mocked(db.update)).not.toHaveBeenCalled()
  })

  it('③ 管理端列表不带发布过滤,草稿可见(含正文)', async () => {
    enqueueSelect([publishedArticle, draftArticle])
    const res = await app.inject({
      method: 'GET',
      url: '/api/admin/help/articles',
    })
    expect(res.statusCode).toBe(200)
    const list = (res.json() as { data: { list: Row[] } }).data.list
    expect(list).toHaveLength(2)
    expect(list.map((a) => a.slug)).toEqual(['published-article', 'draft-article'])
    expect(list[1]?.content).toBe('草稿机密正文')
    // 管理端查询不得加 isPublished 条件
    expect(selectWheres).toHaveLength(1)
    expect(selectWheres[0]).toBeUndefined()
  })

  it('③b 管理端按 id 读草稿(编辑前置查询)仍可读到', async () => {
    enqueueSelect([draftArticle])
    updateRows.push([{ ...draftArticle, title: '草稿文章(已改)' }])
    const res = await app.inject({
      method: 'PATCH',
      url: `/api/admin/help/articles/${DRAFT_ID}`,
      payload: { title: '草稿文章(已改)' },
    })
    expect(res.statusCode).toBe(200)
    expect((res.json() as { data: { article: Row } }).data.article.title).toBe('草稿文章(已改)')
  })

  it('④ 已发布文章的公开列表与详情读取正常', async () => {
    enqueueSelect([publishedArticle])
    const listRes = await app.inject({ method: 'GET', url: '/api/help/articles' })
    expect(listRes.statusCode).toBe(200)
    expect((listRes.json() as { data: { list: Row[] } }).data.list[0]?.slug).toBe(
      'published-article',
    )

    // 详情:文章 → 同分类邻居列表 → 分类名
    enqueueSelect([publishedArticle], [], [{ name: '账户与登录' }])
    const detailRes = await app.inject({
      method: 'GET',
      url: '/api/help/articles/published-article',
    })
    expect(detailRes.statusCode).toBe(200)
    const body = detailRes.json() as { data: { article: Row; categoryName?: string } }
    expect(body.data.article.content).toBe('公开正文')
    expect(body.data.categoryName).toBe('账户与登录')
    // 已发布文章详情仍会自增 viewCount
    expect(vi.mocked(db.update)).toHaveBeenCalledTimes(1)
  })
})
