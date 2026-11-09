// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * F-365(P2,越权信息泄露):`routes/agents.ts` 的结算缓存运维端点此前只走登录闸。
 *   - `POST /api/settlement/cache/force-refresh` 会执行全表 sum(`findSettlementSummary`)、
 *     写共享缓存键 `settlement:summary`,并把**全平台财务汇总**直接放进响应体;
 *   - `GET /api/settlement/stats/income-overview` 与 `/settlement/summary` 同源返回同一份汇总;
 *   - `GET /api/settlement/cache/info`、`POST /api/settlement/cache/force-check` 同属缓存运维面。
 * 对照同资源早已 admin-only 的 `GET /settlement/summary`,这些端点漏配 `requireAdmin`。
 *
 * 本文件用 Fastify inject + mocked db/cache 钉住请求级行为:
 *  ① 普通用户(roleId 0)⇒ 403,且**零** `findSettlementSummary` 调用、**零**缓存读/写;
 *  ② 管理员(roleId >= 1)⇒ 200,刷新只执行一次且响应仍返回 summary;
 *  ③ 未登录 ⇒ 401 且零副作用(不削弱既有鉴权)。
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import Fastify, { type FastifyInstance } from 'fastify'

const SUMMARY = {
  totalAmount: 123456,
  settledAmount: 100000,
  unsettledAmount: 23456,
  totalCount: 42,
  settledCount: 30,
  unsettledCount: 12,
}

const h = vi.hoisted(() => ({
  summaryCalls: 0,
  cacheSets: [] as unknown[][],
  cacheExistsCalls: 0,
  cacheTtlCalls: 0,
}))

vi.mock('../src/db/index.js', () => ({
  db: {},
  dbRead: {},
  dbClient: {},
}))

/**
 * 只替换汇总查询:调用次数本身就是"是否真的执行了全表 sum"的证据。
 * 其余导出保持原样,路由注册期不会缺符号。
 */
vi.mock('../src/db/agents-queries.js', async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>
  return {
    ...actual,
    findSettlementSummary: async () => {
      h.summaryCalls += 1
      return { ...SUMMARY }
    },
  }
})

/**
 * 身份从请求头注入,roleId >= 1 为管理员;真实鉴权闸本体由 require-permission 专项测试覆盖。
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
const CACHE_KEY = 'settlement:summary'

function authHeaders(roleId: number, userId = USER_A) {
  return { 'x-test-role': String(roleId), 'x-test-user': userId }
}

async function buildApp(): Promise<FastifyInstance> {
  const app = Fastify({ logger: false })
  // 缓存走 mock:exists/ttl/set 的调用次数即"是否真的碰过共享缓存键"的证据。
  app.decorate('redis', {
    exists: async () => {
      h.cacheExistsCalls += 1
      return 0
    },
    ttl: async () => {
      h.cacheTtlCalls += 1
      return -2
    },
    set: async (...args: unknown[]) => {
      h.cacheSets.push(args)
      return 'OK'
    },
  } as unknown as FastifyInstance['redis'])
  await app.register(agentsRoutes, { prefix: '/api' })
  await app.ready()
  return app
}

beforeEach(() => {
  h.summaryCalls = 0
  h.cacheSets.length = 0
  h.cacheExistsCalls = 0
  h.cacheTtlCalls = 0
})

describe('F-365 普通登录用户不得刷新结算缓存/读全平台财务汇总', () => {
  it('POST /api/settlement/cache/force-refresh(roleId 0)→ 403,零汇总查询、零缓存写', async () => {
    const app = await buildApp()
    const res = await app.inject({
      method: 'POST',
      url: '/api/settlement/cache/force-refresh',
      headers: authHeaders(0),
    })
    expect(res.statusCode).toBe(403)
    expect(h.summaryCalls).toBe(0)
    expect(h.cacheSets).toHaveLength(0)
    // 旧代码会把全平台汇总塞进响应体;403 后响应中不得出现任何汇总字段。
    expect(res.body).not.toContain('totalAmount')
    expect(res.body).not.toContain(String(SUMMARY.totalAmount))
    await app.close()
  })

  it.each([
    ['GET', '/api/settlement/summary'],
    ['GET', '/api/settlement/stats/income-overview'],
  ])('%s %s(roleId 0)→ 403,零汇总查询', async (method, url) => {
    const app = await buildApp()
    const res = await app.inject({ method, url, headers: authHeaders(0) })
    expect(res.statusCode).toBe(403)
    expect(h.summaryCalls).toBe(0)
    expect(res.body).not.toContain('totalAmount')
    await app.close()
  })

  it.each([
    ['GET', '/api/settlement/cache/info'],
    ['POST', '/api/settlement/cache/force-check'],
  ])('%s %s(roleId 0)→ 403,零缓存读', async (method, url) => {
    const app = await buildApp()
    const res = await app.inject({ method, url, headers: authHeaders(0) })
    expect(res.statusCode).toBe(403)
    expect(h.cacheExistsCalls).toBe(0)
    expect(h.cacheTtlCalls).toBe(0)
    await app.close()
  })

  it('POST force-refresh 未登录 → 401 且零副作用', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'POST', url: '/api/settlement/cache/force-refresh' })
    expect(res.statusCode).toBe(401)
    expect(h.summaryCalls).toBe(0)
    expect(h.cacheSets).toHaveLength(0)
    await app.close()
  })
})

describe('F-365 管理员一侧能力不被收口误伤', () => {
  it('POST force-refresh(roleId 1)→ 200,汇总查询恰好一次、缓存写恰好一次,响应仍返回 summary', async () => {
    const app = await buildApp()
    const res = await app.inject({
      method: 'POST',
      url: '/api/settlement/cache/force-refresh',
      headers: authHeaders(1),
    })
    expect(res.statusCode).toBe(200)
    expect(h.summaryCalls).toBe(1)
    expect(h.cacheSets).toHaveLength(1)
    expect(h.cacheSets[0]?.[0]).toBe(CACHE_KEY)
    const body = JSON.parse(res.body)
    expect(body.data.refreshed).toBe(true)
    expect(body.data.summary).toMatchObject(SUMMARY)
    expect(JSON.parse(String(h.cacheSets[0]?.[1]))).toMatchObject(SUMMARY)
    await app.close()
  })

  it.each([
    ['GET', '/api/settlement/summary'],
    ['GET', '/api/settlement/stats/income-overview'],
  ])('%s %s(roleId 1)→ 200 且返回全平台汇总', async (method, url) => {
    const app = await buildApp()
    const res = await app.inject({ method, url, headers: authHeaders(1) })
    expect(res.statusCode).toBe(200)
    expect(h.summaryCalls).toBe(1)
    expect(JSON.parse(res.body).data).toMatchObject(SUMMARY)
    await app.close()
  })

  it.each([
    ['GET', '/api/settlement/cache/info', { cached: false, ttlSeconds: -2, key: CACHE_KEY }],
    ['POST', '/api/settlement/cache/force-check', { cached: false, checked: true }],
  ])('%s %s(roleId 1)→ 200 且仍可读缓存状态', async (method, url, expected) => {
    const app = await buildApp()
    const res = await app.inject({ method, url, headers: authHeaders(1) })
    expect(res.statusCode).toBe(200)
    expect(h.cacheExistsCalls).toBe(1)
    expect(JSON.parse(res.body).data).toMatchObject(expected)
    await app.close()
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
