// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * F-176 回归锁(2026-11-13)。
 *
 * 病灶:圈子帖 / 问答详情按 id 直查(community-queries 的 findPostById / findAskById),
 * 只按 id 过滤、未带 status=1 ⇒ 已下架(status!=1)内容仍可通过
 * GET /api/circles/posts/:id、GET /api/asks/:id 直读;而列表读档一直带 status=1,
 * 违规内容下架形同虚设。
 *
 * 本文件锁:
 *   ① 已下架圈子帖详情 → 404;
 *   ② 已下架问答详情 → 404;
 *   ③ 在架圈子帖 / 问答详情 → 200;
 *   ④ 管理端仍可读到已下架帖子(管理端走 findPostByIdForAdmin,不过滤 status)。
 *
 * 只 mock db / authenticate,用 Fastify inject,不连真实 PG。
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import Fastify, { type FastifyInstance } from 'fastify'

const state = vi.hoisted(() => ({
  posts: [] as Array<Record<string, unknown>>,
  asks: [] as Array<Record<string, unknown>>,
}))

vi.mock('../src/plugins/auth.js', () => ({
  authenticate: vi.fn(
    async (request: {
      headers: Record<string, unknown>
      userId?: string
      jwtPayload?: { userId: string; roleId: number }
    }) => {
      const auth = request.headers.authorization
      if (!auth) {
        const err = new Error('Authentication required') as Error & { statusCode: number }
        err.statusCode = 401
        throw err
      }
      request.userId = 'f176-user'
      request.jwtPayload = {
        userId: 'f176-user',
        roleId: String(auth).includes('admin') ? 1 : 0,
      }
    },
  ),
  hasHumanJwtCredential: vi.fn(() => false),
}))

vi.mock('../src/db/index.js', async () => {
  const { PgDialect } = await import('drizzle-orm/pg-core')
  const { asks, circlePosts } = await import('@ihui/database')
  const dialect = new PgDialect()

  const rowsOf = (table: unknown): Array<Record<string, unknown>> => {
    if (table === circlePosts) return state.posts
    if (table === asks) return state.asks
    return []
  }

  // 用真实 drizzle 方言把 where 条件渲染成 SQL,再按 AND 顶层的 id / status 等值条件裁剪,
  // 模拟 PG 的过滤行为(其余谓词如 visibility 的 OR 分支不求值,本文件只关心 status 闸)。
  const applyWhere = (table: unknown, cond: unknown) => {
    const candidates = rowsOf(table)
    if (!cond) return candidates
    const { sql, params } = dialect.sqlToQuery(cond as never)
    const pinned: Array<{ column: string; value: unknown }> = []
    const re = /"([a-z_]+)" = \$(\d+)/g
    let matched: RegExpExecArray | null
    while ((matched = re.exec(sql)) !== null) {
      pinned.push({ column: matched[1]!, value: params[Number(matched[2]) - 1] })
    }
    return candidates.filter((row) =>
      pinned.every(({ column, value }) => {
        if (column === 'id') return row.id === value
        if (column === 'status') return row.status === value
        return true
      }),
    )
  }

  const readChain = () => {
    let table: unknown
    let cond: unknown
    const chain: Record<string, unknown> = {}
    Object.assign(chain, {
      from(t: unknown) {
        table = t
        return chain
      },
      leftJoin() {
        return chain
      },
      innerJoin() {
        return chain
      },
      where(c: unknown) {
        cond = c
        return chain
      },
      orderBy() {
        return chain
      },
      limit() {
        return chain
      },
      offset() {
        return chain
      },
      then(onFulfilled: (v: unknown) => unknown, onRejected?: (e: unknown) => unknown) {
        return Promise.resolve(applyWhere(table, cond)).then(onFulfilled, onRejected)
      },
    })
    return chain
  }

  const db = {
    select: () => readChain(),
    insert: () => ({ values: () => ({ returning: async () => [] }) }),
    update: () => ({ set: () => ({ where: () => ({ returning: async () => [] }) }) }),
    delete: () => ({ where: async () => [] }),
    execute: async () => [],
  }

  return { db, dbRead: { select: () => readChain() }, dbClient: {} }
})

import circlesRoutes from '../src/routes/community/circles.js'
import asksRoutes from '../src/routes/community/asks.js'

const POST_ID = '11111111-1111-4111-8111-111111111111'
const ASK_ID = '22222222-2222-4222-8222-222222222222'
const USER_TOKEN = 'Bearer f176-user-token'
const ADMIN_TOKEN = 'Bearer f176-admin-token'

const postRow = (status: number): Record<string, unknown> => ({
  id: POST_ID,
  circleId: '33333333-3333-4333-8333-333333333333',
  userId: 'f176-author',
  title: '帖子标题',
  content: '帖子正文',
  images: null,
  viewCount: 3,
  likeCount: 0,
  replyCount: 0,
  isPinned: false,
  status,
  visibility: 'public',
  createdAt: new Date('2026-11-01T00:00:00Z'),
  updatedAt: new Date('2026-11-01T00:00:00Z'),
})

const askRow = (status: number): Record<string, unknown> => ({
  id: ASK_ID,
  userId: 'f176-author',
  title: '问答标题',
  content: '问答正文',
  tags: null,
  viewCount: 1,
  answerCount: 0,
  likeCount: 0,
  isResolved: false,
  status,
  createdAt: new Date('2026-11-01T00:00:00Z'),
  updatedAt: new Date('2026-11-01T00:00:00Z'),
  authorName: '作者',
})

describe('F-176 圈子帖/问答详情必须按 status=1 过滤', () => {
  let app: FastifyInstance

  beforeAll(async () => {
    app = Fastify({ logger: false })
    await app.register(circlesRoutes, { prefix: '/api' })
    await app.register(asksRoutes, { prefix: '/api' })
    await app.ready()
  })

  afterAll(async () => {
    await app.close()
  })

  beforeEach(() => {
    state.posts = []
    state.asks = []
  })

  it('① 已下架圈子帖详情返回 404', async () => {
    state.posts = [postRow(-1)]

    const res = await app.inject({
      method: 'GET',
      url: `/api/circles/posts/${POST_ID}`,
      headers: { authorization: USER_TOKEN },
    })
    expect(res.statusCode).toBe(404)
    expect((res.json() as { code: number }).code).toBe(404)
  })

  it('② 已下架问答详情返回 404', async () => {
    state.asks = [askRow(0)]

    const res = await app.inject({
      method: 'GET',
      url: `/api/asks/${ASK_ID}`,
      headers: { authorization: USER_TOKEN },
    })
    expect(res.statusCode).toBe(404)
    expect((res.json() as { code: number }).code).toBe(404)
  })

  it('③ 在架圈子帖 / 问答详情仍返回 200', async () => {
    state.posts = [postRow(1)]
    const postRes = await app.inject({
      method: 'GET',
      url: `/api/circles/posts/${POST_ID}`,
      headers: { authorization: USER_TOKEN },
    })
    expect(postRes.statusCode).toBe(200)
    expect((postRes.json() as { data: { post: { id: string } } }).data.post.id).toBe(POST_ID)

    state.asks = [askRow(1)]
    const askRes = await app.inject({
      method: 'GET',
      url: `/api/asks/${ASK_ID}`,
      headers: { authorization: USER_TOKEN },
    })
    expect(askRes.statusCode).toBe(200)
    expect((askRes.json() as { data: { ask: { id: string } } }).data.ask.id).toBe(ASK_ID)
  })

  it('④ 管理端仍可读到已下架帖子', async () => {
    state.posts = [postRow(-1)]

    const res = await app.inject({
      method: 'GET',
      url: `/api/admin/circles/posts/${POST_ID}/comments`,
      headers: { authorization: ADMIN_TOKEN },
    })
    expect(res.statusCode).toBe(200)
    expect((res.json() as { code: number }).code).toBe(0)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
