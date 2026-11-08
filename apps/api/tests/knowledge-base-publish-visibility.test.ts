// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

/**
 * F-329(P2,越权发布/草稿泄露域):`/api/knowledge-base` 整族路由此前只继承
 * `other/index.ts` 的 authenticate,写面无角色闸、body 原样落库,读面(list/detail)
 * 也没有发布态条件 —— 任意登录用户可 `POST { isPublished:true, status:1 }` 立刻上线,
 * `isPublished=false` / `status=0` 的草稿与下线内容同样会出现在列表/详情。
 *
 * 本文件钉住:
 *  ① 未登录写 → 401 且零写库;
 *  ② 普通用户 POST/PUT → 403 且零 insert/update(不是"写了再回滚");
 *  ③ 普通用户列表/详情看不到 isPublished=false 或 status!=1 的条目(详情按 404,不泄漏存在性);
 *  ④ 已发布且 status=1 的条目普通用户照常可见;
 *  ⑤ 管理员写入成功,isPublished/status 按入参落库;
 *  ⑥ 管理员读取仍可见草稿(管理后台需要)。
 *
 * 测试隔离:db 层整体桩掉,并用可求值的条件桩模拟 where 过滤,不连真实 PostgreSQL。
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import Fastify, { type FastifyInstance } from 'fastify'

const h = vi.hoisted(() => {
  process.env.DATABASE_URL ??= 'postgresql://test:test@localhost:5432/test'
  process.env.JWT_SECRET ??= 'test-jwt-secret-for-vitest-at-least-32-chars'
  return {
    rows: [] as Record<string, unknown>[],
    writes: [] as Array<{ op: 'insert' | 'update'; payload: Record<string, unknown> }>,
  }
})

type Cond =
  | { op: 'eq'; left: unknown; right: unknown }
  | { op: 'and'; args: Cond[] }
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
  if (cond.op === 'sql') {
    return (cond.vals ?? []).every((v) =>
      Array.isArray(v)
        ? v.every((x) => matches(x as Cond, row))
        : matches(v as Cond, row),
    )
  }
  return true
}

vi.mock('drizzle-orm', () => ({
  eq: (left: unknown, right: unknown) => ({ op: 'eq', left, right }),
  and: (...args: Cond[]) => ({ op: 'and', args }),
  asc: (col: unknown) => ({ op: 'asc', col }),
  desc: (col: unknown) => ({ op: 'desc', col }),
  sql: (strs: TemplateStringsArray, ...vals: unknown[]) => ({ op: 'sql', vals }),
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
  knowledgeBaseCategories: {
    id: 'knowledge_base_categories.id',
    name: 'knowledge_base_categories.name',
    sortOrder: 'knowledge_base_categories.sortOrder',
  },
  users: {
    id: 'users.id',
    nickname: 'users.nickname',
  },
}))

vi.mock('../src/db/index.js', () => {
  function makeChain(kind: 'select' | 'insert' | 'update' | 'delete', selectArg?: Record<string, unknown>) {
    const state: {
      cond: Cond
      limit?: number
      offset: number
      values?: Record<string, unknown>
      set?: Record<string, unknown>
      returning: boolean
    } = { cond: undefined, offset: 0, returning: false }

    const chain = {
      then(resolve: (value: unknown) => unknown) {
        let result: unknown = []
        if (kind === 'select') {
          const visible = h.rows.filter((row) => matches(state.cond, row))
          const isCount = selectArg !== undefined && Object.prototype.hasOwnProperty.call(selectArg, 'cnt')
          if (isCount) {
            result = [{ cnt: visible.length }]
          } else {
            const end = state.limit === undefined ? undefined : state.offset + state.limit
            result = visible.slice(state.offset, end)
          }
        } else if (kind === 'insert') {
          h.writes.push({ op: 'insert', payload: state.values ?? {} })
          result = [{ id: 'created-id', ...state.values }]
        } else if (kind === 'update') {
          h.writes.push({ op: 'update', payload: state.set ?? {} })
          result = state.returning ? [{ id: 'existing-id', ...state.set }] : []
        }
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
      values(v: Record<string, unknown>) {
        state.values = v
        return chain
      },
      set(v: Record<string, unknown>) {
        state.set = v
        return chain
      },
      returning() {
        state.returning = true
        return chain
      },
    }
    return chain
  }

  const dbMock = {
    select: (arg?: Record<string, unknown>) => makeChain('select', arg),
    insert: () => makeChain('insert'),
    update: () => makeChain('update'),
    delete: () => makeChain('delete'),
  }
  return { db: dbMock, dbRead: dbMock, dbClient: {} }
})

/** 身份从 `x-test-role` 头注入,复刻 other/index.ts 插件级 authenticate 的请求语义。 */
vi.mock('../src/plugins/auth.js', () => {
  interface MockRequest {
    headers: Record<string, string | string[] | undefined>
    userId?: string
    jwtPayload?: { userId?: string; roleId?: number }
  }
  const authenticate = async (request: MockRequest): Promise<void> => {
    const role = request.headers['x-test-role']
    if (role === undefined) {
      const err = new Error('Authentication required') as Error & { statusCode: number }
      err.statusCode = 401
      throw err
    }
    request.userId = String(request.headers['x-test-user'] ?? '')
    request.jwtPayload = { userId: request.userId, roleId: Number(role) }
  }
  return {
    authenticate,
    requireActiveUser: async () => undefined,
    checkAuth: async (request: MockRequest, reply: { status: (code: number) => { send: (body: unknown) => void } }) => {
      try {
        await authenticate(request)
        return true
      } catch (e) {
        const statusCode = (e as Error & { statusCode?: number }).statusCode ?? 401
        reply.status(statusCode).send({ code: statusCode, message: 'Authentication required' })
        return false
      }
    },
  }
})

/** requireAdmin 替身:未登录 401、roleId<1 403、管理员放行;isSystemAdmin 与真实谓词同语义。 */
vi.mock('../src/plugins/require-permission.js', () => ({
  requireAdmin: async (
    request: { headers: Record<string, string | string[] | undefined> },
    reply: { status: (code: number) => { send: (body: unknown) => void } },
  ): Promise<void> => {
    const role = request.headers['x-test-role']
    if (role === undefined) {
      reply.status(401).send({ code: 401, message: 'Authentication required' })
      return
    }
    if (Number(role) < 1) {
      reply.status(403).send({ code: 403, message: '需要管理员权限' })
    }
  },
  isSystemAdmin: (request: { jwtPayload?: { roleId?: number } }) =>
    (request.jwtPayload?.roleId ?? 0) >= 1,
}))

import { authenticate } from '../src/plugins/auth.js'
import { knowledgeBaseRoutes } from '../src/routes/other/knowledge-base-routes.js'

const USER_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const ADMIN_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
const PUBLISHED_ID = '11111111-1111-4111-8111-111111111111'
const DRAFT_ID = '22222222-2222-4222-8222-222222222222'
const DISABLED_ID = '33333333-3333-4333-8333-333333333333'

const NOW = new Date('2026-11-08T00:00:00Z')

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
    content: '正文',
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

function headers(roleId: number, userId: string) {
  return { 'x-test-role': String(roleId), 'x-test-user': userId }
}

/** 复刻 other/index.ts:46-53 的插件级 authenticate —— 被测插件本体不自带该 hook。 */
async function buildApp(): Promise<FastifyInstance> {
  const app = Fastify({ logger: false })
  const withAuth = async (server: FastifyInstance): Promise<void> => {
    server.addHook('preHandler', async (request, reply) => {
      try {
        await authenticate(request)
      } catch (e) {
        const statusCode = (e as Error & { statusCode?: number }).statusCode ?? 401
        return reply.status(statusCode).send({ code: statusCode, message: '操作失败,请稍后重试' })
      }
    })
    await server.register(knowledgeBaseRoutes)
  }
  await app.register(withAuth, { prefix: '/api' })
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
    row(PUBLISHED_ID, '已发布正常条目', true, 1),
    row(DRAFT_ID, '未发布草稿', false, 1),
    row(DISABLED_ID, '已下线条目', true, 0),
  ]
  h.writes = []
})

describe('F-329 写面管理员闸', () => {
  it('① 未登录 POST/PUT → 401 且零写库', async () => {
    const post = await app.inject({ method: 'POST', url: '/api/knowledge-base', payload: { title: 'x' } })
    expect(post.statusCode).toBe(401)
    const put = await app.inject({
      method: 'PUT',
      url: `/api/knowledge-base/${PUBLISHED_ID}`,
      payload: { isPublished: true, status: 1 },
    })
    expect(put.statusCode).toBe(401)
    expect(h.writes).toEqual([])
  })

  it('② 普通用户 POST/PUT → 403 且零 insert/update', async () => {
    const post = await app.inject({
      method: 'POST',
      url: '/api/knowledge-base',
      headers: headers(0, USER_ID),
      payload: { title: 'x', isPublished: true, status: 1 },
    })
    // 旧代码:201,且 isPublished=true 落库
    expect(post.statusCode).toBe(403)
    expect(h.writes).toEqual([])

    const put = await app.inject({
      method: 'PUT',
      url: `/api/knowledge-base/${PUBLISHED_ID}`,
      headers: headers(0, USER_ID),
      payload: { isPublished: true, status: 1 },
    })
    expect(put.statusCode).toBe(403)
    expect(h.writes).toEqual([])
  })

  it('⑤ 管理员 POST → 201,isPublished/status 按入参落库', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/knowledge-base',
      headers: headers(1, ADMIN_ID),
      payload: { title: '官方发布', isPublished: true, status: 1 },
    })
    expect(res.statusCode).toBe(201)
    expect(h.writes).toHaveLength(1)
    expect(h.writes[0]).toMatchObject({
      op: 'insert',
      payload: { title: '官方发布', isPublished: true, status: 1, authorId: ADMIN_ID },
    })
    expect(res.json().data.item.isPublished).toBe(true)
    expect(res.json().data.item.status).toBe(1)
  })

  it('⑤ 管理员 PUT → 200,isPublished/status 按入参落库且只写一次', async () => {
    h.rows = [row(PUBLISHED_ID, '旧标题', true, 1, ADMIN_ID)]
    const res = await app.inject({
      method: 'PUT',
      url: `/api/knowledge-base/${PUBLISHED_ID}`,
      headers: headers(1, ADMIN_ID),
      payload: { title: '合规改名', isPublished: false, status: 0 },
    })
    expect(res.statusCode).toBe(200)
    expect(h.writes).toHaveLength(1)
    expect(h.writes[0]).toMatchObject({
      op: 'update',
      payload: { title: '合规改名', isPublished: false, status: 0 },
    })
    expect(h.writes[0]?.payload).toHaveProperty('updatedAt')
  })
})

describe('F-329 读面发布态过滤', () => {
  it('③ 普通用户列表:草稿/下线不可见,只见已发布且 status=1', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/knowledge-base',
      headers: headers(0, USER_ID),
    })
    expect(res.statusCode).toBe(200)
    const data = res.json().data as { list: Array<{ id: string }>; total: number }
    // 旧代码:[PUBLISHED,DRAFT,DISABLED] 三条全可见
    expect(data.list.map((x) => x.id)).toEqual([PUBLISHED_ID])
    expect(data.total).toBe(1)
  })

  it('③ 普通用户详情:草稿/下线 → 404(不泄漏存在性)', async () => {
    for (const id of [DRAFT_ID, DISABLED_ID]) {
      const res = await app.inject({
        method: 'GET',
        url: `/api/knowledge-base/${id}`,
        headers: headers(0, USER_ID),
      })
      // 旧代码:200 且返回该行原文(title=未发布草稿 / 已下线条目)
      expect(res.statusCode, `id=${id} 普通用户不该读到非公开条目`).toBe(404)
    }
    expect(h.writes).toEqual([])
  })

  it('④ 普通用户:已发布且 status=1 的条目列表/详情均可见', async () => {
    const list = await app.inject({
      method: 'GET',
      url: '/api/knowledge-base',
      headers: headers(0, USER_ID),
    })
    expect(list.statusCode).toBe(200)
    expect(list.json().data.list[0].id).toBe(PUBLISHED_ID)

    const detail = await app.inject({
      method: 'GET',
      url: `/api/knowledge-base/${PUBLISHED_ID}`,
      headers: headers(0, USER_ID),
    })
    expect(detail.statusCode).toBe(200)
    expect(detail.json().data.item.id).toBe(PUBLISHED_ID)
  })

  it('⑥ 管理员列表/详情仍可见草稿(管理后台读草稿能力不被误伤)', async () => {
    const list = await app.inject({
      method: 'GET',
      url: '/api/knowledge-base',
      headers: headers(1, ADMIN_ID),
    })
    expect(list.statusCode).toBe(200)
    const ids = (list.json().data.list as Array<{ id: string }>).map((x) => x.id)
    expect(ids).toEqual([PUBLISHED_ID, DRAFT_ID, DISABLED_ID])
    expect(list.json().data.total).toBe(3)

    const detail = await app.inject({
      method: 'GET',
      url: `/api/knowledge-base/${DRAFT_ID}`,
      headers: headers(1, ADMIN_ID),
    })
    expect(detail.statusCode).toBe(200)
    expect(detail.json().data.item.id).toBe(DRAFT_ID)
  })
})
