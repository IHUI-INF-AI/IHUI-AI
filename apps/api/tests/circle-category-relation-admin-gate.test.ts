// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * F-158(P2,越权写全局配置):`circle_category_relation` 是全局类目树配置,
 * 但两条写端点 `POST /api/circles/category-relation` 与
 * `DELETE /api/circles/category-relation/:rid` 此前只走插件级 `authenticate`
 * (topics.ts 的 server.addHook('preHandler')),没有任何管理员校验 ——
 * 任意登录用户可污染/无限插入全站分类层级。
 *
 * 本文件用 Fastify inject + mocked 查询层钉住请求级行为:
 *  ① 未登录 ⇒ 401,且 insert/delete 计数为 0;
 *  ② 普通登录用户(roleId 0)⇒ 403,且零 insert/零 delete(不是"写完再回滚");
 *  ③ 管理员(roleId >= 1)⇒ 成功,且副作用恰好一次(insert 1 / delete 1);
 *  ④ 既有错误码不退化:非法 body ⇒ 400 且零写;不存在 id ⇒ 404;非整数 id ⇒ 400 且零写。
 * 读接口(GET /circles/category-relation/list)不在票面范围,行为保持现状。
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import Fastify, { type FastifyInstance } from 'fastify'

const h = vi.hoisted(() => {
  process.env.DATABASE_URL ??= 'postgresql://test:test@localhost:5432/test'
  process.env.JWT_SECRET ??= 'test-jwt-secret-for-vitest-at-least-32-chars'
  return {
    insertCalls: 0,
    deleteCalls: 0,
    insertedValues: [] as Record<string, unknown>[],
    deleteResult: [] as number[],
  }
})

/** 查询层整体桩掉:insert/delete 返回链的调用次数即"handler 是否真的走到了写库"。 */
vi.mock('../src/db/index.js', () => ({
  db: {
    insert: () => ({
      values: (values: Record<string, unknown>) => ({
        returning: async () => {
          h.insertCalls += 1
          h.insertedValues.push(values)
          return [{ id: 1001, ...values }]
        },
      }),
    }),
    delete: () => ({
      where: () => ({
        returning: async () => {
          h.deleteCalls += 1
          return h.deleteResult.map((id) => ({ id }))
        },
      }),
    }),
  },
  dbRead: {},
  dbClient: {},
}))

// 本族其它 section 的同模块导入:整体桩掉,测试结构上不连真实查询层(§5 测试隔离铁律)
vi.mock('../src/db/social-queries.js', () => ({
  countSubscribers: vi.fn(),
  findTagById: vi.fn(),
  isSubscribed: vi.fn(),
  subscribe: vi.fn(),
  unsubscribe: vi.fn(),
}))
vi.mock('../src/db/sensitive-words-queries.js', () => ({
  sanitizeUgcInput: vi.fn(),
}))

/** 身份从请求头注入,JWT 语义(roleId >= 1 为管理员)与真实实现一致。 */
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
  }
})

/** 复用真实 requireAdmin 的对外语义(401/403/放行),但不下钻 TOTP/RBAC 查询。 */
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

import topicsRoutes from '../src/routes/community/topics.js'

const ADMIN_USER = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const NORMAL_USER = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
const POST_URL = '/api/circles/category-relation'
const DELETE_URL = '/api/circles/category-relation/7'

const VALID_BODY = {
  childCategoryId: 11,
  fatherCategoryId: 22,
  directFatherCategoryId: 33,
  isSub: false,
}

function authHeaders(roleId: number, userId = ADMIN_USER) {
  return { 'x-test-role': String(roleId), 'x-test-user': userId }
}

async function buildApp(): Promise<FastifyInstance> {
  const app = Fastify({ logger: false })
  await app.register(topicsRoutes, { prefix: '/api' })
  await app.ready()
  return app
}

beforeEach(() => {
  h.insertCalls = 0
  h.deleteCalls = 0
  h.insertedValues.length = 0
  h.deleteResult = []
})

describe('① 未登录 → 401 且零写', () => {
  it('POST /api/circles/category-relation → 401,零 insert', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'POST', url: POST_URL, payload: VALID_BODY })
    expect(res.statusCode).toBe(401)
    expect(h.insertCalls).toBe(0)
    expect(h.insertedValues).toHaveLength(0)
    await app.close()
  })

  it('DELETE /api/circles/category-relation/:rid → 401,零 delete', async () => {
    const app = await buildApp()
    h.deleteResult = [7]
    const res = await app.inject({ method: 'DELETE', url: DELETE_URL })
    expect(res.statusCode).toBe(401)
    expect(h.deleteCalls).toBe(0)
    await app.close()
  })
})

describe('② F-158 普通登录用户(roleId 0)一律 403 且零写', () => {
  it('POST → 403 且零 insert(不是写完再回滚)', async () => {
    const app = await buildApp()
    const res = await app.inject({
      method: 'POST',
      url: POST_URL,
      headers: authHeaders(0, NORMAL_USER),
      payload: VALID_BODY,
    })
    expect(res.statusCode).toBe(403)
    expect(h.insertCalls).toBe(0)
    expect(h.insertedValues).toHaveLength(0)
    await app.close()
  })

  it('DELETE → 403 且零 delete(即便 id 真实存在)', async () => {
    const app = await buildApp()
    h.deleteResult = [7]
    const res = await app.inject({
      method: 'DELETE',
      url: DELETE_URL,
      headers: authHeaders(0, NORMAL_USER),
    })
    expect(res.statusCode).toBe(403)
    expect(h.deleteCalls).toBe(0)
    await app.close()
  })
})

describe('③ 管理员(roleId 1)同操作能力不被误伤且副作用恰好一次', () => {
  it('POST → 201,恰好一次 insert,合法字段照常落库', async () => {
    const app = await buildApp()
    const res = await app.inject({
      method: 'POST',
      url: POST_URL,
      headers: authHeaders(1),
      payload: VALID_BODY,
    })
    expect(res.statusCode).toBe(201)
    expect(h.insertCalls).toBe(1)
    expect(h.insertedValues[0]).toMatchObject(VALID_BODY)
    expect(JSON.parse(res.body).code).toBe(0)
    await app.close()
  })

  it('DELETE → 200,恰好一次 delete 且仍返回 deleted:true', async () => {
    const app = await buildApp()
    h.deleteResult = [7]
    const res = await app.inject({
      method: 'DELETE',
      url: DELETE_URL,
      headers: authHeaders(1),
    })
    expect(res.statusCode).toBe(200)
    expect(h.deleteCalls).toBe(1)
    expect(JSON.parse(res.body).data).toMatchObject({ id: 7, deleted: true })
    await app.close()
  })
})

describe('④ 既有 400/404 错误码不退化', () => {
  it('POST 非法 body(缺 fatherCategoryId)→ 400 且零 insert', async () => {
    const app = await buildApp()
    const res = await app.inject({
      method: 'POST',
      url: POST_URL,
      headers: authHeaders(1),
      payload: { childCategoryId: 11, directFatherCategoryId: 33 },
    })
    expect(res.statusCode).toBe(400)
    expect(h.insertCalls).toBe(0)
    await app.close()
  })

  it('DELETE 不存在的 id → 404(delete 已尝试但零命中)', async () => {
    const app = await buildApp()
    h.deleteResult = []
    const res = await app.inject({
      method: 'DELETE',
      url: '/api/circles/category-relation/999999',
      headers: authHeaders(1),
    })
    expect(res.statusCode).toBe(404)
    expect(h.deleteCalls).toBe(1)
    await app.close()
  })

  it('DELETE 非整数 id → 400 且零 delete', async () => {
    const app = await buildApp()
    const res = await app.inject({
      method: 'DELETE',
      url: '/api/circles/category-relation/abc',
      headers: authHeaders(1),
    })
    expect(res.statusCode).toBe(400)
    expect(h.deleteCalls).toBe(0)
    await app.close()
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
