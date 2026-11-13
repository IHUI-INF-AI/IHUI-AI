// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * F-94(P2,越权/信息泄露):`GET /api/knowledge/:id` 此前
 *  ① `_shared.ts` 的 isPublicKnowledgeGet 把整段 `/knowledge/*` GET 从鉴权里放行;
 *  ② knowledge-routes 只按 id 裸查,未叠加列表侧已有的 `isPublished=true AND status=1`。
 * 结果:未登录者凭已知 id 即可读到未发布/下线草稿。
 *
 * 本文件钉住:
 *  ① 匿名读未发布/下线 → 404,响应体不含标题/正文(不泄漏存在性);
 *  ② 匿名读已发布且 status=1 → 200;
 *  ③ 作者本人登录后可读自己的草稿(含 status=0),保留原有预览能力;
 *  ④ 其他登录用户读别人的草稿 → 404;
 *  ⑤ 凭证失效时按匿名公开口径处理(不把公开读打成 401);
 *  ⑥ 公开列表口径不变(与详情共用同一个谓词)。
 *
 * 测试隔离:db/drizzle/auth 层整体桩掉,用可求值的条件桩模拟 where 过滤,不连 PostgreSQL。
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import Fastify, { type FastifyInstance, type FastifyPluginAsync } from 'fastify'

const h = vi.hoisted(() => {
  process.env.DATABASE_URL ??= 'postgresql://test:test@localhost:5432/test'
  process.env.JWT_SECRET ??= 'test-jwt-secret-for-vitest-at-least-32-chars'
  return { rows: [] as Record<string, unknown>[] }
})

type Cond =
  | { op: 'eq'; left: unknown; right: unknown }
  | { op: 'and' | 'or'; args: Cond[] }
  | { op: 'sql'; vals: unknown[] }
  | undefined

/** 条件求值:列标记形如 `knowledge_base.isPublished`,按行上的同名字段比较。 */
function matches(cond: Cond, row: Record<string, unknown>): boolean {
  if (!cond) return true
  if (cond.op === 'eq') {
    const column = String(cond.left)
    const key = column.includes('.') ? column.slice(column.lastIndexOf('.') + 1) : column
    return row[key] === cond.right
  }
  if (cond.op === 'and') return cond.args.every((c) => matches(c, row))
  if (cond.op === 'or') return cond.args.some((c) => matches(c, row))
  if (cond.op === 'sql') {
    return (cond.vals ?? []).every((v) =>
      Array.isArray(v) ? v.every((x) => matches(x as Cond, row)) : matches(v as Cond, row),
    )
  }
  return true
}

vi.mock('drizzle-orm', () => ({
  eq: (left: unknown, right: unknown) => ({ op: 'eq', left, right }),
  and: (...args: Cond[]) => ({ op: 'and', args }),
  or: (...args: Cond[]) => ({ op: 'or', args }),
  asc: (col: unknown) => ({ op: 'asc', col }),
  desc: (col: unknown) => ({ op: 'desc', col }),
  sql: (_strs: TemplateStringsArray, ...vals: unknown[]) => ({ op: 'sql', vals }),
  ilike: (left: unknown, right: unknown) => ({ op: 'ilike', left, right }),
}))

vi.mock('@ihui/database', () => ({
  knowledgeBase: {
    id: 'knowledge_base.id',
    title: 'knowledge_base.title',
    summary: 'knowledge_base.summary',
    content: 'knowledge_base.content',
    coverImage: 'knowledge_base.coverImage',
    categoryId: 'knowledge_base.categoryId',
    authorId: 'knowledge_base.authorId',
    viewCount: 'knowledge_base.viewCount',
    likeCount: 'knowledge_base.likeCount',
    isPublished: 'knowledge_base.isPublished',
    status: 'knowledge_base.status',
    createdAt: 'knowledge_base.createdAt',
    updatedAt: 'knowledge_base.updatedAt',
  },
  resourceLikes: {
    id: 'resource_likes.id',
    resourceType: 'resource_likes.resourceType',
    resourceId: 'resource_likes.resourceId',
    userId: 'resource_likes.userId',
    createdAt: 'resource_likes.createdAt',
  },
}))

vi.mock('../src/db/index.js', () => {
  function makeChain(selectArg?: Record<string, unknown>) {
    const state: { cond: Cond; limit?: number; offset: number } = { cond: undefined, offset: 0 }

    const chain = {
      then(resolve: (value: unknown) => unknown) {
        const visible = h.rows.filter((row) => matches(state.cond, row))
        const end = state.limit === undefined ? undefined : state.offset + state.limit
        const result =
          selectArg !== undefined ? [{ count: visible.length }] : visible.slice(state.offset, end)
        resolve(result)
        return Promise.resolve(result)
      },
      from() {
        return chain
      },
      leftJoin() {
        return chain
      },
      where(cond: Cond) {
        state.cond = cond
        return chain
      },
      orderBy() {
        return chain
      },
      limit(n: number) {
        state.limit = n
        return chain
      },
      offset(n: number) {
        state.offset = n
        return chain
      },
    }
    return chain
  }

  const dbMock = {
    select: (arg?: Record<string, unknown>) => makeChain(arg),
    insert: () => makeChain(),
    update: () => makeChain(),
    delete: () => makeChain(),
    execute: vi.fn().mockResolvedValue([]),
  }
  return { db: dbMock, dbRead: dbMock, dbClient: {} }
})

/** 身份从 `x-test-user` 头注入;`Bearer invalid` 复刻凭证失效的 401 抛错。 */
vi.mock('../src/plugins/auth.js', () => {
  interface MockRequest {
    headers: Record<string, string | string[] | undefined>
    userId?: string
  }
  const authenticate = async (request: MockRequest): Promise<void> => {
    if (request.headers.authorization === 'Bearer invalid') {
      const err = new Error('Invalid or expired token') as Error & { statusCode: number }
      err.statusCode = 401
      throw err
    }
    const userId = request.headers['x-test-user']
    if (userId === undefined) {
      const err = new Error('Authentication required') as Error & { statusCode: number }
      err.statusCode = 401
      throw err
    }
    request.userId = String(userId)
  }
  return {
    authenticate,
    requireActiveUser: async () => undefined,
    checkAuth: async () => true,
  }
})

import { userAuthPreHandler } from '../src/routes/user/_shared.js'
import knowledgeRoutes from '../src/routes/user/knowledge-routes.js'

const USER_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const OTHER_USER_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
const PUBLISHED_ID = '11111111-1111-4111-8111-111111111111'
const DRAFT_ID = '22222222-2222-4222-8222-222222222222'
const OFFLINE_ID = '33333333-3333-4333-8333-333333333333'
const OTHER_DRAFT_ID = '44444444-4444-4444-8444-444444444444'

const NOW = new Date('2026-11-13T00:00:00Z')

function row(
  id: string,
  title: string,
  isPublished: boolean,
  status: number,
  authorId = USER_ID,
): Record<string, unknown> {
  return {
    id,
    title,
    summary: null,
    content: `${title}的正文`,
    coverImage: null,
    categoryId: null,
    authorId,
    viewCount: 0,
    likeCount: 0,
    isPublished,
    status,
    createdAt: NOW,
    updatedAt: NOW,
  }
}

/** 复刻 user/index.ts:插件级 preHandler(userAuthPreHandler)+ knowledge 子路由。 */
async function buildApp(): Promise<FastifyInstance> {
  const app = Fastify({ logger: false })
  const plugin: FastifyPluginAsync = async (server) => {
    server.addHook('preHandler', userAuthPreHandler)
    await server.register(knowledgeRoutes)
  }
  await app.register(plugin, { prefix: '/api' })
  await app.ready()
  return app
}

let app: FastifyInstance

beforeAll(async () => {
  app = await buildApp()
})

afterAll(async () => {
  await app.close()
})

beforeEach(() => {
  h.rows = [
    row(PUBLISHED_ID, '已发布条目', true, 1),
    row(DRAFT_ID, '未发布草稿', false, 1),
    row(OFFLINE_ID, '已下线条目', true, 0),
    row(OTHER_DRAFT_ID, '他人草稿', false, 1, OTHER_USER_ID),
  ]
})

describe('F-94 匿名读:只允许公开口径', () => {
  it('① 未发布/下线详情匿名 → 404,且不回传标题/正文', async () => {
    for (const id of [DRAFT_ID, OFFLINE_ID]) {
      const res = await app.inject({ method: 'GET', url: `/api/knowledge/${id}` })
      expect(res.statusCode, `id=${id} 匿名读到了非公开条目`).toBe(404)
      expect(res.json().code).toBe(404)
      expect(JSON.stringify(res.json())).not.toContain('未发布草稿')
      expect(JSON.stringify(res.json())).not.toContain('已下线条目')
    }
  })

  it('① 不存在的 id 匿名 → 404(与不可见条目同形,不泄漏存在性)', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/knowledge/99999999-9999-4999-8999-999999999999',
    })
    expect(res.statusCode).toBe(404)
  })

  it('② 已发布且 status=1 匿名 → 200,返回原文', async () => {
    const res = await app.inject({ method: 'GET', url: `/api/knowledge/${PUBLISHED_ID}` })
    expect(res.statusCode).toBe(200)
    const knowledge = res.json().data.knowledge as Record<string, unknown>
    expect(knowledge.id).toBe(PUBLISHED_ID)
    expect(knowledge.content).toBe('已发布条目的正文')
  })

  it('⑤ 凭证失效时按匿名口径处理:公开可读 200、草稿仍 404', async () => {
    const published = await app.inject({
      method: 'GET',
      url: `/api/knowledge/${PUBLISHED_ID}`,
      headers: { authorization: 'Bearer invalid' },
    })
    expect(published.statusCode).toBe(200)

    const draft = await app.inject({
      method: 'GET',
      url: `/api/knowledge/${DRAFT_ID}`,
      headers: { authorization: 'Bearer invalid' },
    })
    expect(draft.statusCode).toBe(404)
  })
})

describe('F-94 登录读:作者可预览自己的草稿,他人不可', () => {
  it('③ 作者本人可读自己的草稿与下线条目', async () => {
    for (const id of [DRAFT_ID, OFFLINE_ID]) {
      const res = await app.inject({
        method: 'GET',
        url: `/api/knowledge/${id}`,
        headers: { 'x-test-user': USER_ID },
      })
      expect(res.statusCode, `id=${id} 作者读不到自己的条目`).toBe(200)
      expect(res.json().data.knowledge.id).toBe(id)
    }
  })

  it('④ 其他登录用户读别人的草稿 → 404', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/knowledge/${DRAFT_ID}`,
      headers: { 'x-test-user': OTHER_USER_ID },
    })
    expect(res.statusCode).toBe(404)
    expect(JSON.stringify(res.json())).not.toContain('未发布草稿')
  })

  it('④ 其他登录用户读已发布条目仍 200', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/knowledge/${PUBLISHED_ID}`,
      headers: { 'x-test-user': OTHER_USER_ID },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().data.knowledge.id).toBe(PUBLISHED_ID)
  })
})

describe('F-94 列表口径未被误伤', () => {
  it('⑥ 匿名列表只返回 isPublished=true 且 status=1', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/knowledge' })
    expect(res.statusCode).toBe(200)
    const data = res.json().data as { list: Array<{ id: string }>; total: number }
    expect(data.list.map((x) => x.id)).toEqual([PUBLISHED_ID])
    expect(data.total).toBe(1)
  })
})
