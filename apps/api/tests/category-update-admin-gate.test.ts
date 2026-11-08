// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

/**
 * F-360(P1,特权提升域):`PUT /api/categories/:categoryId` 此前只走登录闸,
 * body 以 `as UpdateCategoryInput` 裸透传给 `updateCategory` —— 任意登录用户可改写
 * 任意分类的 name / status / isPaid(付费墙开关)。同资源的 DELETE 早已 requireAdmin,
 * 写面却没有任何角色判定与字段白名单。
 *
 * 本文件钉住三条边界:
 *  ① 普通用户(roleId 0)⇒ 403,且**一次写库都没有**发生(不是"写了再回滚");
 *  ② 管理员(roleId >= 1)⇒ 200,恰好一次写库,合法的运营字段照常落库;
 *  ③ body 只认 UpdateCategoryInput 的字段白名单 —— 多给/禁改键 ⇒ 400 且零写库,
 *     不做静默剥离(否则 `categoryId`/`createdAt` 之类的透传仍是一条越权写面)。
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import Fastify, { type FastifyInstance } from 'fastify'

const h = vi.hoisted(() => {
  process.env.DATABASE_URL ??= 'postgresql://test:test@localhost:5432/test'
  process.env.JWT_SECRET ??= 'test-jwt-secret-for-vitest-at-least-32-chars'
  return {
    writes: [] as Record<string, unknown>[],
    row: {} as Record<string, unknown>,
  }
})

/**
 * 只桩构造 SQL 的那一层(`agents-queries` 用的 `db` 出口)。
 * `set()` 是唯一能证明"写发生了"的位置 —— 走到它就已经组出了 UPDATE。
 */
vi.mock('../src/db/index.js', () => {
  const db = {
    update: () => ({
      set: (values: Record<string, unknown>) => {
        h.writes.push(values)
        return {
          where: () => ({ returning: async () => [{ ...h.row, ...values }] }),
        }
      },
    }),
  }
  return { db, dbRead: db, dbClient: {} }
})

/**
 * 身份从请求头注入,JWT 语义(roleId >= 1 为管理员)与真实实现一致;
 * 真实鉴权闸本体由 require-permission 专项测试覆盖。
 */
vi.mock('../src/plugins/auth.js', () => {
  interface MockRequest {
    headers: Record<string, string | string[] | undefined>
    userId?: string
    jwtPayload?: { userId?: string; roleId?: number }
  }
  interface MockReply {
    status: (code: number) => { send: (body: unknown) => void }
  }
  const authenticate = (request: MockRequest): void => {
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
    authenticate: async (request: MockRequest) => authenticate(request),
    checkAuth: async (request: MockRequest, reply: MockReply): Promise<boolean> => {
      try {
        authenticate(request)
        return true
      } catch (e) {
        const statusCode = (e as Error & { statusCode?: number }).statusCode ?? 401
        reply.status(statusCode).send({ code: statusCode, message: 'Authentication required' })
        return false
      }
    },
    requireActiveUser: async () => undefined,
  }
})

vi.mock('../src/plugins/require-permission.js', async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>
  interface MockRequest {
    headers: Record<string, string | string[] | undefined>
    userId?: string
    jwtPayload?: { userId?: string; roleId?: number }
  }
  interface MockReply {
    status: (code: number) => { send: (body: unknown) => void }
  }
  return {
    ...actual,
    requireAdmin: async (request: MockRequest, reply: MockReply): Promise<void> => {
      const role = request.headers['x-test-role']
      if (role === undefined) {
        reply.status(401).send({ code: 401, message: 'Authentication required' })
        return
      }
      request.userId = String(request.headers['x-test-user'] ?? '')
      request.jwtPayload = { userId: request.userId, roleId: Number(role) }
      if (Number(role) < 1) {
        reply.status(403).send({ code: 403, message: '需要管理员权限' })
      }
    },
  }
})

import { agentsRoutes } from '../src/routes/agents.js'

const USER_A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const CATEGORY_ID = '33333333-3333-4333-8333-333333333333'
const CATEGORY_ROW = {
  categoryId: CATEGORY_ID,
  name: '原分类',
  description: null,
  icon: null,
  sort: 0,
  status: '1',
  isPaid: true,
  createdAt: new Date('2026-01-01T00:00:00Z'),
  updatedAt: new Date('2026-01-01T00:00:00Z'),
}

function authHeaders(roleId: number, userId: string) {
  return { 'x-test-role': String(roleId), 'x-test-user': userId }
}

async function buildApp(): Promise<FastifyInstance> {
  const app = Fastify({ logger: false })
  await app.register(agentsRoutes, { prefix: '/api' })
  await app.ready()
  return app
}

beforeEach(() => {
  h.row = { ...CATEGORY_ROW }
  h.writes.length = 0
})

describe('F-360 普通登录用户不得改写分类', () => {
  it('PUT /api/categories/:id(roleId 0)→ 403 且零写库', async () => {
    const app = await buildApp()
    const res = await app.inject({
      method: 'PUT',
      url: `/api/categories/${CATEGORY_ID}`,
      headers: authHeaders(0, USER_A),
      payload: { isPaid: false, name: 'hacked' },
    })
    // 先断写库次数:旧代码的证伪点就是"403 之前已经组出 UPDATE"
    expect(h.writes).toHaveLength(0)
    expect(res.statusCode).toBe(403)
    await app.close()
  })

  it('未登录 → 401 且零写库', async () => {
    const app = await buildApp()
    const res = await app.inject({
      method: 'PUT',
      url: `/api/categories/${CATEGORY_ID}`,
      payload: { isPaid: false },
    })
    expect(res.statusCode).toBe(401)
    expect(h.writes).toHaveLength(0)
    await app.close()
  })
})

describe('F-360 管理员一侧能力不被收口误伤', () => {
  it('PUT /api/categories/:id(roleId 1)→ 200,恰好一次写库且 isPaid/name 落库', async () => {
    const app = await buildApp()
    const res = await app.inject({
      method: 'PUT',
      url: `/api/categories/${CATEGORY_ID}`,
      headers: authHeaders(1, USER_A),
      payload: { isPaid: false, name: '合规改名' },
    })
    expect(res.statusCode).toBe(200)
    expect(h.writes).toHaveLength(1)
    expect(h.writes[0]).toMatchObject({ isPaid: false, name: '合规改名' })
    expect(h.writes[0]).toHaveProperty('updatedAt')
    await app.close()
  })

  it('合法子集字段(sort)→ 200 一次写库', async () => {
    const app = await buildApp()
    const res = await app.inject({
      method: 'PUT',
      url: `/api/categories/${CATEGORY_ID}`,
      headers: authHeaders(1, USER_A),
      payload: { sort: 3 },
    })
    expect(res.statusCode).toBe(200)
    expect(h.writes).toHaveLength(1)
    expect(h.writes[0]).toMatchObject({ sort: 3 })
    await app.close()
  })
})

describe('F-360 body 字段白名单', () => {
  it('多给未知键(categoryId / createdAt)→ 400 且零写库(不得静默剥离后放行)', async () => {
    const app = await buildApp()
    const res = await app.inject({
      method: 'PUT',
      url: `/api/categories/${CATEGORY_ID}`,
      headers: authHeaders(1, USER_A),
      payload: { name: '改名', categoryId: '44444444-4444-4444-8444-444444444444', createdAt: '2020-01-01' },
    })
    expect(h.writes).toHaveLength(0)
    expect(res.statusCode).toBe(400)
    await app.close()
  })

  it('字段类型越界(isPaid 传字符串)→ 400 且零写库', async () => {
    const app = await buildApp()
    const res = await app.inject({
      method: 'PUT',
      url: `/api/categories/${CATEGORY_ID}`,
      headers: authHeaders(1, USER_A),
      payload: { isPaid: 'false' },
    })
    expect(h.writes).toHaveLength(0)
    expect(res.statusCode).toBe(400)
    await app.close()
  })
})
