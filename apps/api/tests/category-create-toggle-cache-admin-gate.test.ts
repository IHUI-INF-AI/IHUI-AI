// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

/**
 * F-359 / F-361 / F-362(P2/P2/P3,越权写平台运营资产):
 * `agent_categories` 无属主列,是平台运营资产 —— 同资源的 DELETE 早已 `requireAdmin`,
 * 但下面五个写/运维端点此前只走登录闸:
 *   - F-359 `POST /api/categories/create` 任意登录用户可建平台级分类;
 *   - F-361 `POST /api/categories/:id/enable|disable` 任意登录用户可翻转付费开关;
 *   - F-362 `POST /api/categories/cache/reload` / `DELETE /api/categories/cache/clear`
 *     任意登录用户可制造 DB→Redis 写放大或清空全局分类缓存。
 *
 * 本文件用 Fastify inject + mocked 查询层/Redis 钉住请求级行为:
 *  ① 未登录 ⇒ 401,且零查询层写、零缓存读写;
 *  ② 普通用户(roleId 0)⇒ 403,且**一次 create/update/findCategoryList 都没调用**、
 *     **零 cache pipeline set / del / keys** —— 不是"写完再回滚";
 *  ③ 管理员(roleId >= 1)⇒ 200,五条端点能力照旧(恰好一次副作用);
 *  ④ create 的 zod 白名单 `.strict()`:未声明键(ownerId/categoryId/createdAt)⇒ 400 且零写库,
 *     不做静默剥离。isPaid 属 CreateCategoryInput 既有合法字段,按票面"仅 name 及现有合法字段"保留。
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import Fastify, { type FastifyInstance } from 'fastify'

const h = vi.hoisted(() => {
  process.env.DATABASE_URL ??= 'postgresql://test:test@localhost:5432/test'
  process.env.JWT_SECRET ??= 'test-jwt-secret-for-vitest-at-least-32-chars'
  return {
    createCalls: 0,
    updateCalls: 0,
    updatePatches: [] as Record<string, unknown>[],
    listCalls: 0,
    redisKeysCalls: 0,
    redisDelCalls: 0,
    pipelineSetCalls: 0,
    pipelineExecCalls: 0,
    redisGetCalls: 0,
  }
})

/** 查询层整体桩掉:调用次数即"handler 是否真的走到了写库/读库"的证据。 */
vi.mock('../src/db/index.js', () => ({
  db: {},
  dbRead: {},
  dbClient: {},
}))

vi.mock('../src/db/agents-queries.js', async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>
  const ROW = {
    categoryId: '33333333-3333-4333-8333-333333333333',
    name: '原分类',
    description: null,
    icon: null,
    sort: 0,
    status: '1',
    isPaid: false,
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-01T00:00:00Z'),
  }
  return {
    ...actual,
    createCategory: async (data: Record<string, unknown>) => {
      h.createCalls += 1
      return { ...ROW, ...data }
    },
    updateCategory: async (_categoryId: string, patch: Record<string, unknown>) => {
      h.updateCalls += 1
      h.updatePatches.push({ ...patch })
      return { ...ROW, ...patch }
    },
    findCategoryList: async () => {
      h.listCalls += 1
      return { list: [{ ...ROW }], total: 1, page: 1, pageSize: 1000 }
    },
  }
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
const CACHE_KEY = 'agent:category:cache:all'

function authHeaders(roleId: number, userId = USER_A) {
  return { 'x-test-role': String(roleId), 'x-test-user': userId }
}

async function buildApp(): Promise<FastifyInstance> {
  const app = Fastify({ logger: false })
  // 缓存走 mock:keys/del/pipeline.set/exec 的调用次数即"是否真的碰过全局分类缓存"的证据。
  const redis = {
    keys: async () => {
      h.redisKeysCalls += 1
      return [CACHE_KEY]
    },
    del: async (...keys: unknown[]) => {
      h.redisDelCalls += 1
      return keys.length
    },
    get: async () => {
      h.redisGetCalls += 1
      return null
    },
    pipeline: () => {
      const pipe = {
        set: (..._args: unknown[]) => {
          h.pipelineSetCalls += 1
          return pipe
        },
        exec: async () => {
          h.pipelineExecCalls += 1
          return []
        },
      }
      return pipe
    },
  }
  app.decorate('redis', redis as unknown as FastifyInstance['redis'])
  await app.register(agentsRoutes, { prefix: '/api' })
  await app.ready()
  return app
}

beforeEach(() => {
  h.createCalls = 0
  h.updateCalls = 0
  h.updatePatches.length = 0
  h.listCalls = 0
  h.redisKeysCalls = 0
  h.redisDelCalls = 0
  h.pipelineSetCalls = 0
  h.pipelineExecCalls = 0
  h.redisGetCalls = 0
})

function expectNoSideEffects() {
  expect(h.createCalls).toBe(0)
  expect(h.updateCalls).toBe(0)
  expect(h.listCalls).toBe(0)
  expect(h.redisKeysCalls).toBe(0)
  expect(h.redisDelCalls).toBe(0)
  expect(h.pipelineSetCalls).toBe(0)
  expect(h.pipelineExecCalls).toBe(0)
}

const ENDPOINTS = [
  ['POST', '/api/categories/create', { name: '越权分类' }] as const,
  ['POST', `/api/categories/${CATEGORY_ID}/enable`, undefined] as const,
  ['POST', `/api/categories/${CATEGORY_ID}/disable`, undefined] as const,
  ['POST', '/api/categories/cache/reload', undefined] as const,
  ['DELETE', '/api/categories/cache/clear', undefined] as const,
]

describe('未登录 → 401 且零写库/零缓存写', () => {
  it.each(ENDPOINTS)('%s %s', async (method, url, payload) => {
    const app = await buildApp()
    const res = await app.inject({ method, url, payload })
    expect(res.statusCode).toBe(401)
    expectNoSideEffects()
    await app.close()
  })
})

describe('F-359/F-361/F-362 普通登录用户(roleId 0)一律 403 且零副作用', () => {
  it('POST /api/categories/create → 403 且零 create', async () => {
    const app = await buildApp()
    const res = await app.inject({
      method: 'POST',
      url: '/api/categories/create',
      headers: authHeaders(0),
      payload: { name: '越权分类' },
    })
    expect(res.statusCode).toBe(403)
    expect(h.createCalls).toBe(0)
    expect(h.updateCalls).toBe(0)
    await app.close()
  })

  it('POST /api/categories/:id/enable → 403 且零 update', async () => {
    const app = await buildApp()
    const res = await app.inject({
      method: 'POST',
      url: `/api/categories/${CATEGORY_ID}/enable`,
      headers: authHeaders(0),
    })
    expect(res.statusCode).toBe(403)
    expect(h.updateCalls).toBe(0)
    expect(h.updatePatches).toHaveLength(0)
    await app.close()
  })

  it('POST /api/categories/:id/disable → 403 且零 update', async () => {
    const app = await buildApp()
    const res = await app.inject({
      method: 'POST',
      url: `/api/categories/${CATEGORY_ID}/disable`,
      headers: authHeaders(0),
    })
    expect(res.statusCode).toBe(403)
    expect(h.updateCalls).toBe(0)
    expect(h.updatePatches).toHaveLength(0)
    await app.close()
  })

  it('POST /api/categories/cache/reload → 403 且零 DB 列表查询、零 pipeline 写', async () => {
    const app = await buildApp()
    const res = await app.inject({
      method: 'POST',
      url: '/api/categories/cache/reload',
      headers: authHeaders(0),
    })
    expect(res.statusCode).toBe(403)
    expect(h.listCalls).toBe(0)
    expect(h.pipelineSetCalls).toBe(0)
    expect(h.pipelineExecCalls).toBe(0)
    await app.close()
  })

  it('DELETE /api/categories/cache/clear → 403 且零 keys/del', async () => {
    const app = await buildApp()
    const res = await app.inject({
      method: 'DELETE',
      url: '/api/categories/cache/clear',
      headers: authHeaders(0),
    })
    expect(res.statusCode).toBe(403)
    expect(h.redisKeysCalls).toBe(0)
    expect(h.redisDelCalls).toBe(0)
    await app.close()
  })
})

describe('管理员(roleId 1)同操作能力不被误伤', () => {
  it('POST /api/categories/create → 200,恰好一次 create,合法字段照常落库', async () => {
    const app = await buildApp()
    const res = await app.inject({
      method: 'POST',
      url: '/api/categories/create',
      headers: authHeaders(1),
      payload: { name: '合规新分类', isPaid: true },
    })
    expect(res.statusCode).toBe(200)
    expect(h.createCalls).toBe(1)
    const body = JSON.parse(res.body)
    expect(body.code).toBe(0)
    expect(body.data).toMatchObject({ name: '合规新分类', isPaid: true })
    await app.close()
  })

  it('POST enable → 200,恰好一次 update 且 patch 为 {isPaid:true}', async () => {
    const app = await buildApp()
    const res = await app.inject({
      method: 'POST',
      url: `/api/categories/${CATEGORY_ID}/enable`,
      headers: authHeaders(1),
    })
    expect(res.statusCode).toBe(200)
    expect(h.updateCalls).toBe(1)
    expect(h.updatePatches[0]).toMatchObject({ isPaid: true })
    await app.close()
  })

  it('POST disable → 200,恰好一次 update 且 patch 为 {isPaid:false}', async () => {
    const app = await buildApp()
    const res = await app.inject({
      method: 'POST',
      url: `/api/categories/${CATEGORY_ID}/disable`,
      headers: authHeaders(1),
    })
    expect(res.statusCode).toBe(200)
    expect(h.updateCalls).toBe(1)
    expect(h.updatePatches[0]).toMatchObject({ isPaid: false })
    await app.close()
  })

  it('POST cache/reload → 200,一次列表查询 + pipe set(all + 每条分类)/exec', async () => {
    const app = await buildApp()
    const res = await app.inject({
      method: 'POST',
      url: '/api/categories/cache/reload',
      headers: authHeaders(1),
    })
    expect(res.statusCode).toBe(200)
    expect(h.listCalls).toBe(1)
    // 1 条分类:all 键 + category:<id> 键 = 2 次 set
    expect(h.pipelineSetCalls).toBe(2)
    expect(h.pipelineExecCalls).toBe(1)
    expect(JSON.parse(res.body).data).toMatchObject({ reloaded: true, count: 1 })
    await app.close()
  })

  it('DELETE cache/clear → 200,一次 keys + 一次 del 且仍返回 cleared', async () => {
    const app = await buildApp()
    const res = await app.inject({
      method: 'DELETE',
      url: '/api/categories/cache/clear',
      headers: authHeaders(1),
    })
    expect(res.statusCode).toBe(200)
    expect(h.redisKeysCalls).toBe(1)
    expect(h.redisDelCalls).toBe(1)
    expect(JSON.parse(res.body).data).toMatchObject({ cleared: true, deleted: 1 })
    await app.close()
  })
})

describe('F-359 create body 字段白名单(.strict)', () => {
  it.each([
    ['ownerId', { name: '分类', ownerId: USER_A }],
    ['categoryId', { name: '分类', categoryId: CATEGORY_ID }],
    ['createdAt', { name: '分类', createdAt: '2020-01-01' }],
  ])('未声明键 %s → 400 且零写库(不得静默剥离后放行)', async (_key, payload) => {
    const app = await buildApp()
    const res = await app.inject({
      method: 'POST',
      url: '/api/categories/create',
      headers: authHeaders(1),
      payload,
    })
    expect(res.statusCode).toBe(400)
    expect(h.createCalls).toBe(0)
    await app.close()
  })

  it('字段类型越界(isPaid 传字符串)→ 400 且零写库', async () => {
    const app = await buildApp()
    const res = await app.inject({
      method: 'POST',
      url: '/api/categories/create',
      headers: authHeaders(1),
      payload: { name: '分类', isPaid: 'true' },
    })
    expect(res.statusCode).toBe(400)
    expect(h.createCalls).toBe(0)
    await app.close()
  })

  it('缺 name → 400 且零写库', async () => {
    const app = await buildApp()
    const res = await app.inject({
      method: 'POST',
      url: '/api/categories/create',
      headers: authHeaders(1),
      payload: { description: '只有描述' },
    })
    expect(res.statusCode).toBe(400)
    expect(h.createCalls).toBe(0)
    await app.close()
  })
})
